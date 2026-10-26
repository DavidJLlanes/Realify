/* ═══════════════════════════════════════════════════════════════
   TRANSFORMACIÓN LIBRE (Ctrl+T)
   La versión con tiradores de «Transformar capa…»: en vez de un
   diálogo con deslizadores, un marco sobre la propia capa que se
   arrastra a mano, con vista previa en directo. Dos modos:

   · LIBRE — escala, rotación, sesgo y traslación, como un rectángulo
     de verdad. Se guarda como los CINCO números de una transformación
     afín (escala X/Y, ángulo, sesgo X/Y, más el desplazamiento del
     centro) en vez de como cuatro esquinas sueltas: así «Escala 150 %»
     en la barra de opciones significa lo mismo pase lo que pase con
     el giro, y arrastrar una esquina no puede dejar el cuadrilátero
     retorcido sobre sí mismo por accidente. El cuadrilátero que de
     verdad se dibuja sale de aplicar esos cinco números al rectángulo
     ORIGINAL, y se reutiliza el mismo motor de deformación por malla
     que ya tenía el corrector de perspectiva (editor/tools/perspective.js):
     un rectángulo también es un cuadrilátero, sólo que uno con las
     cuatro esquinas en ángulo recto.
   · DEFORMAR — una rejilla de puntos de control que se arrastran uno
     a uno, para doblar o drapear la capa. Empieza donde lo dejó el
     modo Libre, como en Photoshop.

   Lo que NO tiene esta primera versión: distorsionar una esquina de
   forma independiente (Ctrl+esquina en Photoshop) y perspectiva de
   verdad dentro de la propia herramienta —para eso ya está el corrector
   de perspectiva, que sigue siendo el sitio correcto—. Lo que sí:
   escala libre o proporcional, rotación con imán a 15°, sesgo con
   Ctrl+arrastrar un borde, voltear, y un punto de pivote que se puede
   mover.
   ═══════════════════════════════════════════════════════════════ */

import "./grab.js";
import { doc, activeLayer } from "../../core/doc.js";
import "../../core/bus.js";
import "../../core/history.js";
import "../../core/device.js";
import "../render/compositor.js";
import { toast } from "../../core/toast.js";
import "../../core/view.js";
import "./perspective.js";
import "../align.js";
import "./rulers.js";
import { xform, affineQuad, xformRecompute } from "./transformtool/common.js";
import { xformPreview, RAD } from "./transformtool/drag.js";
import { armed, isIdentity } from "./transformtool/session.js";
export { xform, xformRecompute } from "./transformtool/common.js";
export { xformBegin, xformEnd, xformRestore, xformHandleAt, xformWarpHandleAt, xformCursorFor, xformDown, xformResetAll, xformApply, drawXformOverlay } from "./transformtool/session.js";
export { xformPreview, xformMove } from "./transformtool/drag.js";

export function xformCanStart(){
  if(!doc.open) return false;
  const l = activeLayer();
  if(!l) return false;
  if(l.locked) return false;
  if(l.type === "adjust" || l.type === "group" || l.type === "fill" || l.type === "shape") return false;
  return true;
}

/* Al pasar a Deformar, la rejilla neutra parte de donde haya dejado
   el modo Libre —el cuadrilátero actual—, no del rectángulo original:
   igual que Photoshop, cambiar de modo no debe deshacer lo ya hecho. */
export function xformSetMode(mode){
  if(mode === xform.mode) return;
  if(mode === "warp"){
    const q = xform.quad || affineQuad();
    const [tl, tr, , bl] = q;
    const grid = [];
    for(let j = 0; j <= xform.meshRows; j++){
      const v = j / xform.meshRows;
      const lx = tl[0] + (bl[0]-tl[0])*v, ly = tl[1] + (bl[1]-tl[1])*v;
      const rx = tr[0] + (q[2][0]-tr[0])*v, ry = tr[1] + (q[2][1]-tr[1])*v;
      for(let i = 0; i <= xform.meshCols; i++){
        const u = i / xform.meshCols;
        grid.push([lx + (rx-lx)*u, ly + (ry-ly)*u]);
      }
    }
    xform.grid = grid;
  }
  xform.mode = mode;
  xformRecompute();
  xformPreview();
}

export function xformUp(){
  if(!armed) return;
  xform._drag = null;
  xformPreview();
}

export function xformCancel(){
  if(!armed) return;
  xform._drag = null;
  xformPreview();
}

/* ── acciones ─────────────────────────────────────────────────── */
export function xformFlip(axis){
  if(!armed) return;
  if(axis === "h") xform.flipH = !xform.flipH; else xform.flipV = !xform.flipV;
  xformRecompute();
  xformPreview();
}

/* Gira la transformación `deg` grados (positivo = sentido horario) desde
   los botones de la barra, sin arrastrar. */
export function xformRotateBy(deg){
  if(!armed) return;
  if(xform.mode !== "free"){ toast("Gira en el modo Libre"); return; }
  let a = xform.angle + deg * RAD;
  while(a > Math.PI + 1e-9) a -= 2 * Math.PI;
  while(a <= -Math.PI + 1e-9) a += 2 * Math.PI;
  xform.angle = a;
  xformRecompute();
  xformPreview();
}

/* Los mandos viven en `state` (tools.js) porque es de donde lee la
   barra de opciones; aquí sólo se copian cuando cambian. Los
   numéricos llegan en las unidades que ve el usuario (grados,
   porcentaje) y se convierten aquí. */
export function xformSync(o){
  if(!armed) return;
  let changed = false;
  if(o.xfMode !== undefined && o.xfMode !== xform.mode){ xformSetMode(o.xfMode); return; }
  if(o.xfProportional !== undefined) xform.proportional = o.xfProportional;
  const wPct = o.xfW !== undefined ? o.xfW / 100 : null;
  const hPct = o.xfH !== undefined ? o.xfH / 100 : null;
  if(wPct !== null && Math.abs(wPct - xform.sx) > 1e-4){ xform.sx = wPct; changed = true; }
  if(hPct !== null && Math.abs(hPct - xform.sy) > 1e-4){ xform.sy = hPct; changed = true; }
  if(o.xfAngle !== undefined){
    const a = o.xfAngle * RAD;
    if(Math.abs(a - xform.angle) > 1e-5){ xform.angle = a; changed = true; }
  }
  if(o.xfSkewX !== undefined){
    const a = o.xfSkewX * RAD;
    if(Math.abs(a - xform.skewX) > 1e-5){ xform.skewX = a; changed = true; }
  }
  if(o.xfSkewY !== undefined){
    const a = o.xfSkewY * RAD;
    if(Math.abs(a - xform.skewY) > 1e-5){ xform.skewY = a; changed = true; }
  }
  if(changed){ xformRecompute(); xformPreview(); }
}

export const xformArmed = () => armed;

/* Si cambiar de herramienta a media transformación debe APLICARLA en
   vez de descartarla (ver deactivate() en tools.js), hace falta saber
   si de verdad hay algo que aplicar: lo mismo que ya comprueba
   xformApply() antes de actuar, expuesto aparte para no duplicar el
   criterio ni disparar su aviso «no hay nada que aplicar» sólo por
   haber tocado otro icono. En modo deformar cualquier sesión cuenta
   como cambio —el mismo criterio, más permisivo, que ya usa
   xformApply()—. */
export const xformHasChange = () => armed && (xform.mode !== "free" || !isIdentity());

export const xformReadout = () => ({
  w: Math.round(xform.sx * 100), h: Math.round(xform.sy * 100),
  angle: Math.round(xform.angle / RAD), skewX: Math.round(xform.skewX / RAD), skewY: Math.round(xform.skewY / RAD)
});
