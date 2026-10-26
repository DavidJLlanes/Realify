/* ═══════════════════════════════════════════════════════════════
   transformtool · drag
   Parte de js/editor/tools/transformtool.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { offset } from "../grab.js";
import { doc } from "../../../core/doc.js";
import { snapValue, snapCandidatesX, snapCandidatesY } from "../rulers.js";
import { view } from "../../../core/view.js";
import { scheduleOverlay } from "../../render/compositor.js";
import { armed, session, renderPreview } from "./session.js";
import { xform, xformRecompute, pivotPoint } from "./common.js";

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

export const RAD = Math.PI / 180;

export function xformMove(p, e){
  if(!armed) return;
  const d = xform._drag;
  if(!d) return;
  if(d.off) p = offset(p, d.off);

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
    } else {
      // Imán suave a los múltiplos de 45° (0°, 90°…) para dejar la capa recta con el dedo
      const step = 45 * RAD, near = Math.round(ang / step) * step;
      if(Math.abs(ang - near) < 2 * RAD) ang = near;
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

    // Respecto al pivote YA desplazado (pivote + traslación al empezar):
    // si la capa se había movido antes, medir desde el pivote sin
    // desplazar daba escalas equivocadas.
    const t0 = { x: d.s0.tx, y: d.s0.ty };
    const loFrom = toLocal({ x: d.from.x - t0.x, y: d.from.y - t0.y }, piv);
    const loNow  = toLocal({ x: p.x - t0.x, y: p.y - t0.y }, piv);
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
      // Desde la esquina/borde opuesto, que queda FIJO donde estaba al
      // empezar: la escala es lo que mide, en los ejes de la caja, el
      // vector de ese punto fijo al puntero. (Antes el punto fijo se
      // recalculaba con la escala del paso anterior y, con movimientos
      // rápidos —el dedo—, la esquina opuesta se desplazaba y el
      // tirador se quedaba atrás del puntero.)
      const opp = toWorldLocal(oppLocalFor(d, sxSign, sySign, halfW, halfH), d.s0.sx, d.s0.sy, piv, d.s0.tx, d.s0.ty);
      const v = toLocal({ x: p.x - opp[0] + piv[0], y: p.y - opp[1] + piv[1] }, piv);
      if(sxSign) newSx = Math.max(0.02, v[0] / (2 * sxSign * halfW));
      if(sySign) newSy = Math.max(0.02, v[1] / (2 * sySign * halfH));
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
      const oppLocal = oppLocalFor(d, sxSign, sySign, halfW, halfH);
      const oldOpp = toWorldLocal(oppLocal, d.s0.sx, d.s0.sy, piv, d.s0.tx, d.s0.ty);
      xform.sx = newSx; xform.sy = newSy;
      const newOpp = toWorldLocal(oppLocal, newSx, newSy, piv, 0, 0);
      // `oldOpp` ya incluye la traslación inicial: no volver a sumarla
      // (con la capa movida antes, la caja saltaba al escalar).
      xform.tx = oldOpp[0] - newOpp[0];
      xform.ty = oldOpp[1] - newOpp[1];
    }

    xformRecompute();
    xformPreview("drag");
  }
}

/* Punto opuesto al tirador agarrado, en ejes locales sin escalar. */
function oppLocalFor(d, sxSign, sySign, halfW, halfH){
  const cornerSigns = [[-1,-1],[1,-1],[1,1],[-1,1]];
  return d.kind === "corner"
    ? [-cornerSigns[d.i][0] * halfW, -cornerSigns[d.i][1] * halfH]
    : [sxSign ? -sxSign * halfW : 0, sySign ? -sySign * halfH : 0];
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
