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
     que ya tenía el corrector de perspectiva (editor/perspective.js):
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

import { doc, activeLayer } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { record } from "../core/history.js";
import { COARSE } from "../core/device.js";
import { scheduleCompose, scheduleOverlay } from "./compositor.js";
import { toast, status } from "../ui/toast.js";
import { view, toImage } from "./view.js";
import { warpRectToQuad, warpRectToMesh, makeWarpGrid } from "./perspective.js";
import { contentBounds } from "./align.js";
import { snapValue, snapCandidatesX, snapCandidatesY } from "./rulers.js";

const stageEl = document.getElementById("stage");

const PROXY_MAX  = COARSE ? 640 : 1100;
const MESH_DRAG  = COARSE ? 5   : 9;
const MESH_REST  = COARSE ? 9   : 14;
const MESH_APPLY = 36;
const WARP_SUBDIV_DRAG = 2, WARP_SUBDIV_REST = 4, WARP_SUBDIV_APPLY = 8;

export const xform = {
  mode: "free",          // "free" | "warp"
  proportional: false,
  box: null,              // {x,y,w,h} rectángulo original, fijo durante toda la sesión
  // parámetros de la transformación afín (modo libre)
  sx: 1, sy: 1,
  angle: 0,               // radianes
  skewX: 0, skewY: 0,     // radianes
  tx: 0, ty: 0,           // desplazamiento del CENTRO de giro respecto al centro de `box`
  flipH: false, flipV: false,
  pivot: null,            // [x,y] en coordenadas de imagen; null = centro de `box`
  // deformar
  meshCols: 3, meshRows: 3,
  grid: null,             // puntos de control actuales (modo warp)
  quad: null,             // esquinas actuales, recalculadas — lo que de verdad se pinta
  _drag: null             // gesto en curso; ver xformDown()
};

let layerId = null, srcFull = null, srcBox = null, srcProxy = null;
/* Lo que se ve ANTES de esta sesión — no confundir con `srcFull`: en
   un objeto inteligente que ya tenía una transformación aplicada de
   antes, `srcFull` es el original íntegro sin ninguna (de ahí sale la
   vista previa al arrastrar), pero «Cancelar» tiene que devolver la
   capa a como estaba AL ABRIR la herramienta, no al original en
   crudo, o cancelar borraría de un plumazo cualquier ajuste ya
   aplicado en una sesión anterior. */
let sessionStart = null;
let armed = false;
/* true cuando la capa de esta sesión es un objeto inteligente: cambia
   de dónde sale `srcFull` (del original guardado, no de la capa tal
   como está ahora) y hace que `xformApply()` acumule en
   `smartTransform` en vez de destruir los píxeles. Ver
   editor/smartobject.js. */
let smartSession = false;
/* Un número que cambia cada vez que se empieza o se termina una
   sesión: ver xformPreview() para por qué hace falta aparte de
   `armed`. */
let session = 0;

const isIdentity = () =>
  xform.mode === "free" &&
  Math.abs(xform.sx - 1) < 1e-4 && Math.abs(xform.sy - 1) < 1e-4 &&
  Math.abs(xform.angle) < 1e-5 && Math.abs(xform.skewX) < 1e-5 && Math.abs(xform.skewY) < 1e-5 &&
  Math.abs(xform.tx) < 0.05 && Math.abs(xform.ty) < 0.05 && !xform.flipH && !xform.flipV;

/* ── entrada y salida ─────────────────────────────────────────── */
function pickBox(layer){
  const b = contentBounds(layer);
  if(!b || b.w < 2 || b.h < 2) return { x: 0, y: 0, w: doc.w, h: doc.h };
  return b;
}

export function xformCanStart(){
  if(!doc.open) return false;
  const l = activeLayer();
  if(!l) return false;
  if(l.locked) return false;
  if(l.type === "adjust" || l.type === "group" || l.type === "fill" || l.type === "shape") return false;
  return true;
}

export function xformBegin(){
  xformEnd();
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return; }
  if(l.locked){ toast("La capa está bloqueada"); return; }
  if(l.type === "adjust"){ toast("Una capa de ajuste no tiene píxeles que transformar", "err"); return; }
  if(l.type === "group"){ toast("Selecciona una capa dentro del grupo, no el grupo", "err"); return; }
  // Transformar deformaría los píxeles ya dibujados sin tocar
  // `fill`/`shape`: la próxima vez que se editara un parámetro se
  // volvería a dibujar en el tamaño/sitio de antes, deshaciendo el
  // ajuste sin avisar. Una forma se redimensiona con sus propias asas
  // (herramienta Formas); un relleno no tiene límites que escalar.
  if(l.type === "fill" || l.type === "shape"){
    toast(l.type === "shape"
      ? `Redimensiona «${l.name}» con la herramienta Formas (U), no con Transformación libre.`
      : `«${l.name}» rellena todo el lienzo: no hay nada que transformar.`, "err");
    return;
  }

  session++;
  layerId = l.id;
  smartSession = !!(l.smart && l.smartSource && l.smartBox);

  sessionStart = document.createElement("canvas");
  sessionStart.width = l.canvas.width; sessionStart.height = l.canvas.height;
  sessionStart.getContext("2d").drawImage(l.canvas, 0, 0);

  srcFull = document.createElement("canvas");
  if(smartSession){
    // El origen es el ORIGINAL íntegro guardado al convertir la capa,
    // nunca el resultado ya remuestreado de la última vez: por eso no
    // pierde nitidez al reescalar una y otra vez.
    srcFull.width = l.smartSource.width; srcFull.height = l.smartSource.height;
    srcFull.getContext("2d").drawImage(l.smartSource, 0, 0);
  } else {
    srcFull.width = l.canvas.width; srcFull.height = l.canvas.height;
    srcFull.getContext("2d").drawImage(l.canvas, 0, 0);
  }

  // El objeto inteligente mide sus parámetros contra una caja FIJA
  // desde que se convirtió —si se recalculara con contentBounds() en
  // cada sesión, rotar la habría dejado con una caja distinta la
  // próxima vez y «continuar donde se dejó» habría dejado de tener
  // sentido—. Una capa normal sigue partiendo de su contenido actual.
  xform.box = smartSession ? l.smartBox : pickBox(l);

  /* `warpRectToQuad`/`warpRectToMesh` tratan la imagen que reciben
     como el CUADRADO UNIDAD ENTERO que hay que encajar en el destino
     —así es como ya la usaba el corrector de perspectiva, para el que
     el destino siempre es el documento entero—. Aquí el destino es
     sólo `xform.box`, así que lo que se les pasa no puede ser la capa
     completa (400×400 si el rectángulo mide 100×60): hay que recortar
     antes a un lienzo del tamaño exacto de la caja. Como la caja sale
     de `contentBounds()`, fuera de ella no hay nada que perder. */
  srcBox = document.createElement("canvas");
  srcBox.width = Math.max(1, Math.round(xform.box.w));
  srcBox.height = Math.max(1, Math.round(xform.box.h));
  srcBox.getContext("2d").drawImage(srcFull, -xform.box.x, -xform.box.y);

  const k = Math.min(1, PROXY_MAX / Math.max(srcBox.width, srcBox.height));
  srcProxy = srcBox;
  if(k < 1){
    srcProxy = document.createElement("canvas");
    srcProxy.width = Math.max(1, Math.round(srcBox.width * k));
    srcProxy.height = Math.max(1, Math.round(srcBox.height * k));
    const px = srcProxy.getContext("2d");
    px.imageSmoothingQuality = "high";
    px.drawImage(srcBox, 0, 0, srcProxy.width, srcProxy.height);
  }

  const prev = smartSession ? l.smartTransform : null;
  if(prev){
    // Continuar donde lo dejó la vez anterior, no desde cero: el
    // objeto sigue teniendo la escala/giro/sesgo que ya tenía, y
    // ajustarlo más se mide desde ahí.
    xform.sx = prev.sx; xform.sy = prev.sy;
    xform.angle = prev.angle; xform.skewX = prev.skewX; xform.skewY = prev.skewY;
    xform.tx = prev.tx; xform.ty = prev.ty;
    xform.flipH = prev.flipH; xform.flipV = prev.flipV;
    xform.mode = prev.mode || "free";
    xform.meshCols = prev.meshCols || 3; xform.meshRows = prev.meshRows || 3;
    xform.grid = prev.grid ? prev.grid.map(p => [...p]) : null;
  } else {
    xform.sx = xform.sy = 1;
    xform.angle = xform.skewX = xform.skewY = 0;
    xform.tx = xform.ty = 0;
    xform.flipH = xform.flipV = false;
    xform.mode = "free";
    xform.meshCols = 3; xform.meshRows = 3;
    xform.grid = null;
  }
  xform.pivot = null;
  xformRecompute();
  armed = true;
  stageEl?.addEventListener("pointermove", onHover);
}

export function xformEnd(){
  session++;
  layerId = null; srcFull = null; srcBox = null; srcProxy = null; sessionStart = null;
  armed = false; smartSession = false;
  stageEl?.removeEventListener("pointermove", onHover);
}

/* El resto de la aplicación sólo llama a `current.move()` MIENTRAS se
   arrastra (ver main.js): para que el cursor cambie a la flecha de
   girar o de escalar en cuanto se PASA por encima de un tirador, sin
   necesidad de bajar el botón, esta herramienta escucha el puntero
   por su cuenta. Se activa y desactiva junto con `xformBegin`/`xformEnd`. */
function onHover(e){
  if(!armed || xform._drag) return;
  const p = toImage(e.clientX, e.clientY);
  if(xform.mode === "warp"){
    const onPoint = xformWarpHandleAt(p) >= 0;
    stageEl.style.cursor = onPoint ? "grab" : (pointInQuad(p, quadFromGrid()) ? "move" : "default");
    return;
  }
  const h = xformHandleAt(p);
  stageEl.style.cursor = h ? xformCursorFor(h)
    : (xform.quad && pointInQuad(p, xform.quad) ? "move" : "default");
}

export function xformRestore(){
  if(!armed || layerId === null) return;
  const l = doc.layers.find(x => x.id === layerId);
  if(!l) return;
  const x = l.ctx;
  x.save(); x.globalCompositeOperation = "copy"; x.globalAlpha = 1;
  x.drawImage(sessionStart, 0, 0);
  x.restore();
  l.thumbDirty = true;
  scheduleCompose();
}

/* ── geometría ────────────────────────────────────────────────── */
function pivotPoint(){
  if(xform.pivot) return xform.pivot;
  const { x, y, w, h } = xform.box;
  return [x + w/2, y + h/2];
}

/* El cuadrilátero de destino a partir de los cinco parámetros afines:
   centrar en el pivote, sesgar, rotar, escalar (con el signo del
   volteo), y devolver al sitio con la traslación. El orden importa —
   es el mismo que aplicaría `ctx.transform` leído de derecha a
   izquierda— y es el que hace que «Escala» siga refiriéndose a los
   ejes de LA CAJA, no a los de la pantalla, una vez que ya está
   rotada. */
function affineQuad(){
  const { x, y, w, h } = xform.box;
  const [px, py] = pivotPoint();
  const cs = Math.cos(xform.angle), sn = Math.sin(xform.angle);
  const sx = xform.sx * (xform.flipH ? -1 : 1);
  const sy = xform.sy * (xform.flipV ? -1 : 1);
  const corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  return corners.map(([cx0, cy0]) => {
    // Respecto al pivote, en los ejes ORIGINALES de la caja
    let dx = cx0 - px, dy = cy0 - py;
    // Sesgo (shear) sobre esos ejes
    dx = dx + dy * Math.tan(xform.skewX);
    dy = dy + dx * Math.tan(xform.skewY);
    // Escala
    dx *= sx; dy *= sy;
    // Rotación
    const rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
    return [px + rx + xform.tx, py + ry + xform.ty];
  });
}

export function xformRecompute(){
  if(!xform.box) return;
  if(xform.mode === "warp"){
    if(!xform.grid) xform.grid = makeWarpGrid(xform.box.x, xform.box.y, xform.box.w, xform.box.h, xform.meshCols, xform.meshRows);
    return;
  }
  xform.quad = affineQuad();
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

/* ── vista previa ────────────────────────────────────────────── */
let pend = false, dragging = false;
export function xformPreview(quality){
  if(!armed) return;
  if(quality === "drag") dragging = true;
  if(pend) return;
  pend = true;
  const mySession = session;
  requestAnimationFrame(() => {
    pend = false;
    const drag = dragging; dragging = false;
    /* Si mientras el fotograma estaba pendiente se ha cerrado esta
       sesión (se aplicó, se canceló, o —el caso raro que de verdad
       importa— se abrió OTRO documento con esta misma herramienta
       aún activa, que la vuelve a armar sobre la capa nueva antes de
       que este fotograma llegue a pintarse— este dibujo ya no
       corresponde a nada: pintaría los píxeles VIEJOS sobre la capa
       NUEVA. Comparar el número de sesión, no sólo `armed`, es lo que
       distingue «se cerró» de «se volvió a abrir otra vez». */
    if(mySession !== session) return;
    renderPreview(drag);
  });
}

function renderPreview(drag){
  if(!armed) return;
  const l = doc.layers.find(x => x.id === layerId);
  if(!l) return;
  if(xform.mode === "free" && isIdentity()){
    xformRestore();
    scheduleOverlay();
    return;
  }
  if(xform.mode === "warp"){
    warpRectToMesh(l.ctx, srcProxy, xform.grid, xform.meshCols, xform.meshRows, doc.w, doc.h,
                    drag ? WARP_SUBDIV_DRAG : WARP_SUBDIV_REST);
  } else {
    warpRectToQuad(l.ctx, srcProxy, xform.quad, doc.w, doc.h, drag ? MESH_DRAG : MESH_REST, drag ? MESH_DRAG : MESH_REST);
  }
  l.thumbDirty = true;
  scheduleCompose();
  scheduleOverlay();
}

/* ── tiradores, modo libre ───────────────────────────────────── */
const HANDLE_R = 10;
const ROTATE_R = 26;

/* Un punto de pantalla llevado a los ejes LOCALES de la caja —los de
   antes de escalar, deshaciendo sólo la rotación—, respecto al
   pivote. Es sobre estos ejes donde tiene sentido medir «cuánto ha
   crecido el ancho» al arrastrar una esquina, sea cual sea el giro
   actual. */
function toLocal(p, pivot){
  const dx = p.x - pivot[0], dy = p.y - pivot[1];
  const cs = Math.cos(-xform.angle), sn = Math.sin(-xform.angle);
  return [dx * cs - dy * sn, dx * sn + dy * cs];
}

export function xformHandleAt(p){
  if(!armed || xform.mode !== "free") return null;
  const q = xform.quad;
  const t = HANDLE_R / Math.max(view.zoom, 1e-6);
  for(let i = 0; i < 4; i++)
    if(Math.hypot(p.x - q[i][0], p.y - q[i][1]) < t) return { kind:"corner", i };
  const mids = [[0,1],[1,2],[2,3],[3,0]];
  for(let k = 0; k < 4; k++){
    const [a,b] = mids[k];
    const mx = (q[a][0]+q[b][0])/2, my = (q[a][1]+q[b][1])/2;
    if(Math.hypot(p.x - mx, p.y - my) < t) return { kind:"edge", a, b, axis: k % 2 === 0 ? "h" : "v" };
  }
  const piv = pivotPoint();
  if(Math.hypot(p.x - piv[0], p.y - piv[1]) < t) return { kind:"pivot" };
  const rr = ROTATE_R / Math.max(view.zoom, 1e-6);
  for(let i = 0; i < 4; i++)
    if(Math.hypot(p.x - q[i][0], p.y - q[i][1]) < rr) return { kind:"rotate", i };
  return null;
}

export function xformWarpHandleAt(p){
  if(!armed || xform.mode !== "warp") return -1;
  const t = HANDLE_R / Math.max(view.zoom, 1e-6);
  const grid = xform.grid;
  for(let i = 0; i < grid.length; i++)
    if(Math.hypot(p.x - grid[i][0], p.y - grid[i][1]) < t) return i;
  return -1;
}

function pointInQuad(p, q){
  let sign = 0;
  for(let i = 0; i < 4; i++){
    const a = q[i], b = q[(i+1)%4];
    const cr = (b[0]-a[0])*(p.y-a[1]) - (b[1]-a[1])*(p.x-a[0]);
    if(Math.abs(cr) < 1e-9) continue;
    const s = cr > 0 ? 1 : -1;
    if(sign === 0) sign = s; else if(s !== sign) return false;
  }
  return true;
}

/* Nombre del cursor CSS para cada tirador. No gira con la caja —una
   flecha diagonal fija aunque el rectángulo esté a 40°— porque un
   cursor que rota de verdad exige generar un SVG por ángulo; es una
   pérdida cosmética, no funcional: el tirador se agarra y se mueve
   igual de bien mirando cualquier flecha. */
const CORNER_CURSOR = ["nwse-resize", "nesw-resize", "nwse-resize", "nesw-resize"];
const EDGE_CURSOR = { h: "ns-resize", v: "ew-resize" };
export function xformCursorFor(h){
  if(!h) return "default";
  if(h.kind === "corner") return CORNER_CURSOR[h.i];
  if(h.kind === "edge") return EDGE_CURSOR[h.axis];
  if(h.kind === "rotate") return "grab";
  if(h.kind === "pivot") return "crosshair";
  return "default";
}

/* ── gestos, modo libre ──────────────────────────────────────── */
export function xformDown(p, e){
  if(!armed) return;

  if(xform.mode === "warp"){
    const i = xformWarpHandleAt(p);
    if(i >= 0){ xform._drag = { kind:"warp", i, from: p, start: [...xform.grid[i]] }; return; }
    if(pointInQuad(p, quadFromGrid())){ xform._drag = { kind:"panWarp", from: p, start: xform.grid.map(pt => [...pt]) }; }
    return;
  }

  const h = xformHandleAt(p);
  if(h){
    if(h.kind === "pivot"){ xform._drag = { kind:"pivot", from: p }; return; }
    if(h.kind === "rotate"){
      const piv = pivotPoint();
      const a0 = Math.atan2(p.y - piv[1], p.x - piv[0]);
      xform._drag = { kind:"rotate", startAngle: xform.angle, pointerAngle0: a0 };
      return;
    }
    if(h.kind === "corner"){
      xform._drag = { kind:"corner", i: h.i, from: p,
        s0: { sx: xform.sx, sy: xform.sy, tx: xform.tx, ty: xform.ty } };
      return;
    }
    if(h.kind === "edge"){
      xform._drag = { kind:"edge", axis: h.axis, from: p,
        s0: { sx: xform.sx, sy: xform.sy, tx: xform.tx, ty: xform.ty } };
      return;
    }
  }
  if(pointInQuad(p, xform.quad)){
    xform._drag = { kind:"move", from: p, tx0: xform.tx, ty0: xform.ty };
  }
}

function quadFromGrid(){
  const g = xform.grid, c = xform.meshCols, r = xform.meshRows;
  return [g[0], g[c], g[(r)*(c+1)+c], g[r*(c+1)]];
}

const RAD = Math.PI / 180;

export function xformMove(p, e){
  if(!armed) return;
  const d = xform._drag;
  if(!d) return;

  if(d.kind === "panWarp"){
    const dx = p.x - d.from.x, dy = p.y - d.from.y;
    xform.grid = d.start.map(([x,y]) => [x+dx, y+dy]);
    xformPreview("drag");
    return;
  }
  if(d.kind === "warp"){
    let np = { x: d.start[0] + (p.x - d.from.x), y: d.start[1] + (p.y - d.from.y) };
    if(e?.shiftKey){
      const guides = { h: doc.guides.h, v: doc.guides.v };
      np = { x: snapValue(np.x, snapCandidatesX(doc.w, guides), 6, view.zoom),
             y: snapValue(np.y, snapCandidatesY(doc.h, guides), 6, view.zoom) };
    }
    xform.grid[d.i] = [np.x, np.y];
    xformPreview("drag");
    return;
  }

  if(d.kind === "move"){
    let dx = p.x - d.from.x, dy = p.y - d.from.y;
    if(e?.shiftKey){
      if(Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
    }
    xform.tx = d.tx0 + dx; xform.ty = d.ty0 + dy;
    xformRecompute();
    xformPreview("drag");
    return;
  }

  if(d.kind === "pivot"){
    xform.pivot = [p.x, p.y];
    scheduleOverlay();
    return;
  }

  if(d.kind === "rotate"){
    const piv = pivotPoint();
    const a1 = Math.atan2(p.y - piv[1], p.x - piv[0]);
    let ang = d.startAngle + (a1 - d.pointerAngle0);
    if(e?.shiftKey){
      const step = 15 * RAD;
      ang = Math.round(ang / step) * step;
    }
    xform.angle = ang;
    xformRecompute();
    xformPreview("drag");
    return;
  }

  if(d.kind === "corner" || d.kind === "edge"){
    // Se trabaja en los ejes LOCALES de la caja (los de antes de
    // escalar), así que primero se deshace la rotación/sesgo del
    // arrastre para saber cuánto ha crecido cada eje "de verdad".
    const piv = pivotPoint();
    const alt = e?.altKey, ctrl = e?.ctrlKey, shift = e?.shiftKey;

    if(ctrl && d.kind === "edge"){
      // Ctrl+borde: sesgar en vez de escalar — el mismo modificador
      // que usa Photoshop para lo mismo dentro de Transformación libre.
      const loFrom = toLocal(d.from, piv), loNow = toLocal(p, piv);
      const { w, h } = xform.box;
      if(d.axis === "v"){   // borde izq/der: sesgo vertical
        const dSkew = (loNow[1] - loFrom[1]) / Math.max(1, w/2 * Math.abs(xform.sx || 1));
        xform.skewY = Math.max(-1.2, Math.min(1.2, (d.skew0 ?? xform.skewY) + dSkew));
      } else {               // borde arriba/abajo: sesgo horizontal
        const dSkew = (loNow[0] - loFrom[0]) / Math.max(1, h/2 * Math.abs(xform.sy || 1));
        xform.skewX = Math.max(-1.2, Math.min(1.2, (d.skew0 ?? xform.skewX) + dSkew));
      }
      d.skew0 = d.axis === "v" ? xform.skewY : xform.skewX;
      xformRecompute();
      xformPreview("drag");
      return;
    }

    const loFrom = toLocal(d.from, piv), loNow = toLocal(p, piv);
    const { w, h } = xform.box;
    const halfW = w/2, halfH = h/2;
    // Signo del cuadrante que se está agarrando, en los ejes locales
    // SIN escalar: de qué lado de la caja original está esa esquina.
    const cornerSigns = [[-1,-1],[1,-1],[1,1],[-1,1]];
    const sxSign = d.kind === "corner" ? cornerSigns[d.i][0]
                 : (d.axis === "v" ? (loFrom[0] >= 0 ? 1 : -1) : 0);
    const sySign = d.kind === "corner" ? cornerSigns[d.i][1]
                 : (d.axis === "h" ? (loFrom[1] >= 0 ? 1 : -1) : 0);

    // Dos anclas posibles, dos fórmulas distintas. Desde el centro
    // (Alt) la escala es simétrica y se lee directamente de dónde ha
    // caído el puntero respecto al centro. Desde la esquina/borde
    // opuesto —el caso normal— hay que medir el crecimiento respecto
    // a ESE punto, no al centro: son sitios distintos salvo que el
    // pivote esté justo en medio, y usar la fórmula del centro aquí
    // hacía que el tirador se pasara de largo del puntero al arrastrar.
    let newSx = xform.sx, newSy = xform.sy;
    if(alt){
      if(sxSign) newSx = Math.max(0.02, (loNow[0] * sxSign) / halfW);
      if(sySign) newSy = Math.max(0.02, (loNow[1] * sySign) / halfH);
    } else {
      if(sxSign) newSx = Math.max(0.02, (loNow[0] + sxSign * halfW) / (2 * sxSign * halfW));
      if(sySign) newSy = Math.max(0.02, (loNow[1] + sySign * halfH) / (2 * sySign * halfH));
    }

    if(shift){
      // Proporcional: el eje que más ha cambiado manda sobre el otro.
      if(d.kind === "corner"){
        const r = xform.sy !== 0 ? newSx / (d.s0.sx || 1) : 1;
        const rY = d.s0.sy !== 0 ? newSy / (d.s0.sy || 1) : r;
        const k = Math.abs(newSx - d.s0.sx) > Math.abs(newSy - d.s0.sy) ? r : rY;
        newSx = d.s0.sx * k; newSy = d.s0.sy * k;
      } else if(d.axis === "v"){
        newSy = d.s0.sy * (newSx / (d.s0.sx || 1));
      } else {
        newSx = d.s0.sx * (newSy / (d.s0.sy || 1));
      }
    }

    if(alt){
      // Desde el centro: el pivote se queda quieto, no hace falta
      // compensar con `tx/ty` — el pivote YA es el centro por defecto,
      // y si se movió a mano, «desde el centro» se entiende como
      // «desde el pivote actual», que es justo lo que ya hace este
      // cálculo al trabajar en ejes locales respecto al pivote.
      xform.sx = newSx; xform.sy = newSy;
    } else {
      // Desde la esquina/borde opuesto: hay que desplazar tx/ty para
      // que el punto opuesto no se mueva ni un píxel en pantalla.
      const oppLocal = d.kind === "corner"
        ? [-cornerSigns[d.i][0] * halfW, -cornerSigns[d.i][1] * halfH]
        : [sxSign ? -sxSign * halfW : 0, sySign ? -sySign * halfH : 0];
      const oldOpp = toWorldLocal(oppLocal, xform.sx, xform.sy, piv, d.s0.tx, d.s0.ty);
      xform.sx = newSx; xform.sy = newSy;
      const newOpp = toWorldLocal(oppLocal, newSx, newSy, piv, 0, 0);
      xform.tx = d.s0.tx + (oldOpp[0] - newOpp[0]);
      xform.ty = d.s0.ty + (oldOpp[1] - newOpp[1]);
    }

    xformRecompute();
    xformPreview("drag");
  }
}

/* Punto local (ya en ejes de la caja, sin escalar) llevado a mundo
   con una escala y una traslación concretas — para el cálculo de "que
   el punto opuesto no se mueva" de arriba. */
function toWorldLocal(local, sx, sy, piv, tx, ty){
  const cs = Math.cos(xform.angle), sn = Math.sin(xform.angle);
  let dx = local[0], dy = local[1];
  dx = dx + dy * Math.tan(xform.skewX);
  dy = dy + dx * Math.tan(xform.skewY);
  dx *= sx; dy *= sy;
  const rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
  return [piv[0] + rx + tx, piv[1] + ry + ty];
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

export function xformResetAll(){
  if(!armed) return;
  xform.sx = xform.sy = 1;
  xform.angle = xform.skewX = xform.skewY = 0;
  xform.tx = xform.ty = 0;
  xform.flipH = xform.flipV = false;
  xform.pivot = null;
  xform.mode = "free";
  xform.grid = null;
  xformRecompute();
  xformRestore();
  scheduleOverlay();
}

export function xformApply(){
  if(!armed || layerId === null || !doc.open) return false;
  if(xform.mode === "free" && isIdentity()){ toast("No hay ninguna transformación que aplicar"); return false; }

  const l = doc.layers.find(x => x.id === layerId);
  if(!l) return false;
  status("Aplicando transformación…");

  // «Antes» es cómo se veía la capa AL ABRIR esta sesión —no el
  // original en crudo de un objeto inteligente, que puede llevar ya
  // una transformación de una sesión anterior encima—: mismo motivo
  // que xformRestore(), ver el comentario de `sessionStart` arriba.
  const before = document.createElement("canvas");
  before.width = sessionStart.width; before.height = sessionStart.height;
  before.getContext("2d").drawImage(sessionStart, 0, 0);
  const smartTransformBefore = smartSession && l.smartTransform ? { ...l.smartTransform } : null;

  if(xform.mode === "warp"){
    warpRectToMesh(l.ctx, srcBox, xform.grid, xform.meshCols, xform.meshRows, doc.w, doc.h, WARP_SUBDIV_APPLY);
  } else {
    warpRectToQuad(l.ctx, srcBox, xform.quad, doc.w, doc.h, MESH_APPLY, MESH_APPLY);
  }
  if(l.type === "text"){ l.type = "raster"; l.text = null; }
  l.thumbDirty = true;

  // Un objeto inteligente no "olvida" el original al aplicar: guarda
  // los parámetros acumulados para poder seguir ajustándolos la
  // próxima vez sin perder nitidez — `srcFull`/`srcBox`, que sí salen
  // del original, son los que ya han hecho el remuestreo de verdad
  // unas líneas más arriba.
  const smartTransformAfter = smartSession ? {
    mode: xform.mode, sx: xform.sx, sy: xform.sy,
    angle: xform.angle, skewX: xform.skewX, skewY: xform.skewY,
    tx: xform.tx, ty: xform.ty, flipH: xform.flipH, flipV: xform.flipV,
    meshCols: xform.meshCols, meshRows: xform.meshRows,
    grid: xform.grid ? xform.grid.map(p => [...p]) : null
  } : null;
  if(smartSession) l.smartTransform = smartTransformAfter;

  const after = document.createElement("canvas");
  after.width = l.canvas.width; after.height = l.canvas.height;
  after.getContext("2d").drawImage(l.canvas, 0, 0);

  const targetLayerId = layerId;
  // `xformEnd()` (más abajo) pone `smartSession` a false: estas
  // funciones se invocan mucho después, al deshacer o rehacer, así
  // que necesitan su propia copia y no la variable del módulo.
  const wasSmartSession = smartSession;
  const restore = (snap, smartT) => {
    const cur = doc.layers.find(x => x.id === targetLayerId);
    if(!cur) return;
    const x = cur.ctx;
    x.save(); x.globalCompositeOperation = "copy"; x.globalAlpha = 1;
    x.drawImage(snap, 0, 0); x.restore();
    cur.thumbDirty = true;
    if(wasSmartSession) cur.smartTransform = smartT;
    emit("doc:structure"); emit("doc:change");
  };
  record("Transformación libre",
    () => restore(before, smartTransformBefore),
    () => restore(after, smartTransformAfter));

  xformEnd();
  status("");
  emit("doc:structure"); emit("doc:change");
  toast("Transformación aplicada", "ok");
  return true;
}

/* ── superposición ────────────────────────────────────────────── */
export function drawXformOverlay(ctx){
  if(!armed) return;
  const px = 1 / Math.max(view.zoom, 1e-6);

  if(xform.mode === "warp"){
    const g = xform.grid, c = xform.meshCols, r = xform.meshRows;
    ctx.strokeStyle = "rgba(232,163,61,.85)";
    ctx.lineWidth = px;
    ctx.beginPath();
    for(let j = 0; j <= r; j++){
      ctx.moveTo(g[j*(c+1)][0], g[j*(c+1)][1]);
      for(let i = 1; i <= c; i++) ctx.lineTo(g[j*(c+1)+i][0], g[j*(c+1)+i][1]);
    }
    for(let i = 0; i <= c; i++){
      ctx.moveTo(g[i][0], g[i][1]);
      for(let j = 1; j <= r; j++) ctx.lineTo(g[j*(c+1)+i][0], g[j*(c+1)+i][1]);
    }
    ctx.stroke();
    const rad = 5 * px;
    for(const [x, y] of g){
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832);
      ctx.fillStyle = "#e8a33d"; ctx.fill();
      ctx.lineWidth = 1.5*px; ctx.strokeStyle = "#fff"; ctx.stroke();
    }
    return;
  }

  const q = xform.quad;
  ctx.strokeStyle = "#e8a33d";
  ctx.lineWidth = 1.5 * px;
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]);
  ctx.closePath();
  ctx.stroke();
  // Cruceta central por los puntos medios, como en Photoshop
  ctx.strokeStyle = "rgba(232,163,61,.5)";
  ctx.beginPath();
  ctx.moveTo((q[0][0]+q[1][0])/2, (q[0][1]+q[1][1])/2);
  ctx.lineTo((q[2][0]+q[3][0])/2, (q[2][1]+q[3][1])/2);
  ctx.moveTo((q[1][0]+q[2][0])/2, (q[1][1]+q[2][1])/2);
  ctx.lineTo((q[3][0]+q[0][0])/2, (q[3][1]+q[0][1])/2);
  ctx.stroke();

  const r = 7 * px;
  const dot = (x, y) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = "#e8a33d"; ctx.fill();
    ctx.lineWidth = 1.6 * px; ctx.strokeStyle = "#fff"; ctx.stroke();
  };
  for(const [x, y] of q) dot(x, y);
  for(const [a, b] of [[0,1],[1,2],[2,3],[3,0]])
    dot((q[a][0]+q[b][0])/2, (q[a][1]+q[b][1])/2);

  const piv = pivotPoint();
  ctx.beginPath();
  ctx.arc(piv[0], piv[1], 6*px, 0, 6.2832);
  ctx.moveTo(piv[0]-9*px, piv[1]); ctx.lineTo(piv[0]+9*px, piv[1]);
  ctx.moveTo(piv[0], piv[1]-9*px); ctx.lineTo(piv[0], piv[1]+9*px);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4*px; ctx.stroke();
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
