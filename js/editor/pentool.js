/* ═══════════════════════════════════════════════════════════════
   PLUMA — TRAZADOS BÉZIER
   Un trazado es una lista de subtrazados; cada uno, una lista de
   anclas con dos tiradores cada una (`in`/`out`, en coordenadas
   absolutas de imagen — no deltas—, colapsados sobre la propia ancla
   cuando no se han arrastrado, que es lo que hace que el segmento
   salga recto en vez de curvo). Clic suelto pone un ancla de esquina;
   clic y arrastre la convierte en una ancla curva con tiradores
   simétricos, igual que en cualquier editor vectorial. Clic sobre la
   primera ancla del subtrazado en curso lo cierra.

   El relleno para convertir a selección o a máscara se apoya en el
   propio motor de trazados del lienzo (`Path2D` + `bezierCurveTo`) en
   vez de rasterizar la curva a mano: a diferencia del resto de
   selection.js —rectángulo, elipse, lazo—, que sí valía la pena
   mantener como matemática pura y comprobable sin navegador, una
   Bézier bien antialiseada de verdad es exactamente el trabajo que ya
   hace el motor nativo, y reescribirlo a mano sólo para poder
   probarlo fuera del navegador habría costado mucho por una ganancia
   que aquí no hace falta.
   ═══════════════════════════════════════════════════════════════ */

import { grabDoc, drawPx, nearest } from "./grab.js";
import { doc } from "../core/doc.js";
import { view } from "./view.js";
import { scheduleOverlay } from "./compositor.js";
import { commitSelection } from "./selection.js";
import { addMask } from "./masks.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { toast } from "../ui/toast.js";

const HIT_R = 9;  /* con el dedo lo agranda grab.js */         // radio de acierto sobre ancla/tirador, en píxeles de pantalla
const CLOSE_R = 11;       // radio, algo mayor, para acertar sobre la ancla inicial y cerrar

export const pen = {
  subpaths: [],     // subtrazados YA cerrados o dejados abiertos a propósito
  current: null,    // subtrazado en curso (aún no cerrado ni aparcado), o null
  _drag: null
};

let armed = false;

const newAnchor = (x, y) => ({ x, y, in: [x, y], out: [x, y] });

export function penArmed(){ return armed; }

export function penBegin(){
  pen.subpaths = [];
  pen.current = null;
  pen._drag = null;
  armed = true;
  scheduleOverlay();
}

export function penEnd(){
  armed = false;
  pen.subpaths = [];
  pen.current = null;
  pen._drag = null;
}

export function penHasPath(){
  return pen.subpaths.length > 0 || (pen.current && pen.current.points.length > 1);
}

/* ── geometría ───────────────────────────────────────────────── */
function allOpenAndClosed(){
  return pen.current ? [...pen.subpaths, pen.current] : pen.subpaths;
}

/* Ancla o tirador más cercano dentro del radio `t` (no el primero de
   la lista: con el dedo el radio es grande y varios pueden solaparse). */
function hitNearest(p, t, parts){
  const cands = [], ids = [];
  const add = (pts, si) => pts.forEach((a, i) => {
    for(const part of parts){
      cands.push(part === "anchor" ? [a.x, a.y] : a[part]);
      ids.push({ subpath: si, point: i, part });
    }
  });
  pen.subpaths.forEach((sp, si) => add(sp.points, si));
  if(pen.current) add(pen.current.points, -1);
  const k = nearest(p, cands, t);
  return k < 0 ? null : ids[k];
}
const hitAnchor = (p, t) => hitNearest(p, t, ["anchor"]);
const hitHandle = (p, t) => hitNearest(p, t, ["out", "in"]);

function pointsOf(subpathIdx){
  return subpathIdx === -1 ? pen.current.points : pen.subpaths[subpathIdx].points;
}

/* ── gestos ──────────────────────────────────────────────────── */
export function penDown(p, e){
  if(!armed) return;
  const t = grabDoc(view.zoom, HIT_R);

  // Reeditar un ancla o un tirador ya puestos, de un subtrazado
  // cerrado o del que está en curso — siempre que no se esté a punto
  // de cerrar el trazado (eso se comprueba antes, más abajo).
  const hAnchor = hitAnchor(p, t);
  const hHandle = !hAnchor ? hitHandle(p, t) : null;

  if(pen.current){
    const pts = pen.current.points;
    const closeT = grabDoc(view.zoom, CLOSE_R);
    if(pts.length > 2 && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) < closeT){
      pen.current.closed = true;
      pen.subpaths.push(pen.current);
      pen.current = null;
      pen._drag = null;
      scheduleOverlay();
      return;
    }
  }

  if(hAnchor){
    pen._drag = { kind: "anchor", ...hAnchor, from: p,
      start: { ...pointsOf(hAnchor.subpath)[hAnchor.point] } };
    return;
  }
  if(hHandle){
    pen._drag = { kind: "handle", ...hHandle, from: p,
      start: pointsOf(hHandle.subpath)[hHandle.point][hHandle.part].slice() };
    return;
  }

  // Ancla nueva: si el usuario arrastra antes de soltar, se vuelve
  // curva con tiradores simétricos (ver penMove); si no arrastra, se
  // queda de esquina (los dos tiradores colapsados sobre ella).
  if(!pen.current) pen.current = { closed: false, points: [] };
  pen.current.points.push(newAnchor(p.x, p.y));
  pen._drag = { kind: "newHandle", subpath: -1, point: pen.current.points.length - 1, from: p };
  scheduleOverlay();
}

export function penMove(p, e){
  if(!armed) return;
  const d = pen._drag;
  if(!d){ scheduleOverlay(); return; }   // sólo para refrescar el resaltado del hover

  if(d.kind === "newHandle"){
    const a = pointsOf(d.subpath)[d.point];
    const dx = p.x - d.from.x, dy = p.y - d.from.y;
    a.out = [a.x + dx, a.y + dy];
    a.in  = [a.x - dx, a.y - dy];
    scheduleOverlay();
    return;
  }
  if(d.kind === "anchor"){
    const a = pointsOf(d.subpath)[d.point];
    const dx = p.x - d.from.x, dy = p.y - d.from.y;
    const ox = d.start.out[0] - d.start.x, oy = d.start.out[1] - d.start.y;
    const ix = d.start.in[0]  - d.start.x, iy = d.start.in[1]  - d.start.y;
    a.x = d.start.x + dx; a.y = d.start.y + dy;
    a.out = [a.x + ox, a.y + oy];
    a.in  = [a.x + ix, a.y + iy];
    scheduleOverlay();
    return;
  }
  if(d.kind === "handle"){
    const a = pointsOf(d.subpath)[d.point];
    // Relativo a donde se cogió: el tirador no salta bajo el dedo.
    p = { x: d.start[0] + (p.x - d.from.x), y: d.start[1] + (p.y - d.from.y) };
    a[d.part] = [p.x, p.y];
    // Simétrico salvo que se rompa a propósito con Alt —comprobado en
    // cada movimiento, no sólo al agarrar el tirador, para poder
    // decidir a media arrastrada—: el tirador opuesto se refleja por
    // la ancla, a la misma distancia.
    if(!e?.altKey){
      const other = d.part === "out" ? "in" : "out";
      a[other] = [a.x - (p.x - a.x), a.y - (p.y - a.y)];
    }
    scheduleOverlay();
    return;
  }
}

export function penUp(){
  if(!armed) return;
  pen._drag = null;
}

/* Quita la última ancla puesta del subtrazado en curso (Retroceso
   mientras se dibuja) — no toca el historial de deshacer de la app:
   es corregir el gesto a medio hacer, no un paso que se haya llegado
   a confirmar. */
export function penUndoPoint(){
  if(!armed || !pen.current || !pen.current.points.length) return false;
  pen.current.points.pop();
  if(!pen.current.points.length) pen.current = null;
  pen._drag = null;
  scheduleOverlay();
  return true;
}

/* Cierra a mano el subtrazado en curso (botón «Cerrar», o Intro):
   con Intro se suele querer TERMINARLO sin más, no necesariamente
   unir el último punto con el primero — así que esto lo aparca
   abierto en vez de forzar el cierre; para cerrarlo de verdad, clic
   sobre la primera ancla. */
export function penFinishOpen(){
  if(!armed || !pen.current || pen.current.points.length < 2) return false;
  pen.current.closed = false;
  pen.subpaths.push(pen.current);
  pen.current = null;
  pen._drag = null;
  scheduleOverlay();
  return true;
}

export function penCancel(){
  if(!armed) return;
  pen.subpaths = [];
  pen.current = null;
  pen._drag = null;
  scheduleOverlay();
}

/* ── relleno ─────────────────────────────────────────────────── */
function buildPath2D(subpaths){
  const path = new Path2D();
  for(const sp of subpaths){
    const pts = sp.points;
    if(pts.length < 2) continue;
    path.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++){
      const a = pts[i-1], b = pts[i];
      path.bezierCurveTo(a.out[0], a.out[1], b.in[0], b.in[1], b.x, b.y);
    }
    // Un trazado abierto se cierra con una recta sólo para poder
    // rellenarlo — no altera los propios puntos guardados: es la
    // misma convención que usa Photoshop al convertir un trazado
    // abierto en selección.
    const a = pts[pts.length - 1], b = pts[0];
    if(sp.closed) path.bezierCurveTo(a.out[0], a.out[1], b.in[0], b.in[1], b.x, b.y);
    else path.lineTo(b.x, b.y);
    path.closePath();
  }
  return path;
}

function fillCanvas(w, h, subpaths){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { colorSpace:"srgb" });
  ctx.fillStyle = "#fff";
  ctx.fill(buildPath2D(subpaths), "nonzero");
  return c;
}

function allSubpaths(){
  const list = pen.subpaths.slice();
  if(pen.current && pen.current.points.length > 1) list.push(pen.current);
  return list;
}

export function penToSelection(mode = "new"){
  if(!armed) return false;
  const list = allSubpaths();
  if(!list.length){ toast("No hay ningún trazado que convertir"); return false; }
  const c = fillCanvas(doc.w, doc.h, list);
  const d = c.getContext("2d").getImageData(0, 0, doc.w, doc.h).data;
  const mask = new Uint8ClampedArray(doc.w * doc.h);
  for(let i = 0, p = 3; i < mask.length; i++, p += 4) mask[i] = d[p];
  commitSelection(mask, mode);
  toast("Trazado convertido en selección", "ok");
  return true;
}

export function penToMask(layer, mode = "new"){
  if(!armed || !layer) return false;
  const list = allSubpaths();
  if(!list.length){ toast("No hay ningún trazado que convertir"); return false; }
  const fill = fillCanvas(doc.w, doc.h, list);

  if(!layer.mask){
    addMask(layer, false, true);   // negra (oculta todo): el trazado es lo único que se va a revelar
  }
  const before = document.createElement("canvas");
  before.width = layer.mask.canvas.width; before.height = layer.mask.canvas.height;
  before.getContext("2d").drawImage(layer.mask.canvas, 0, 0);

  const mx = layer.mask.ctx;
  mx.save();
  mx.globalCompositeOperation =
    mode === "subtract" ? "destination-out" :
    mode === "intersect" ? "source-in" :
    mode === "new" ? "copy" : "source-over";   // "add" y "new" pintan encima igual; "new" parte de una máscara recién puesta a negra
  mx.drawImage(fill, 0, 0);
  mx.restore();
  layer.thumbDirty = true;

  const after = document.createElement("canvas");
  after.width = layer.mask.canvas.width; after.height = layer.mask.canvas.height;
  after.getContext("2d").drawImage(layer.mask.canvas, 0, 0);

  const put = snap => {
    if(!layer.mask) return;
    const x = layer.mask.ctx;
    x.save(); x.globalCompositeOperation = "copy"; x.globalAlpha = 1;
    x.drawImage(snap, 0, 0); x.restore();
    layer.thumbDirty = true;
    emit("doc:structure"); emit("doc:change");
  };
  record("Trazado a máscara", () => put(before), () => put(after));
  emit("doc:structure"); emit("doc:change");
  toast("Trazado convertido en máscara de capa", "ok");
  return true;
}

/* ── superposición ───────────────────────────────────────────── */
export function drawPenOverlay(ctx){
  if(!armed) return;
  const px = 1 / Math.max(view.zoom, 1e-6);
  const list = allOpenAndClosed();

  ctx.strokeStyle = "#4fc3f7";
  ctx.lineWidth = 1.4 * px;
  for(const sp of list){
    const pts = sp.points;
    if(!pts.length) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++){
      const a = pts[i-1], b = pts[i];
      ctx.bezierCurveTo(a.out[0], a.out[1], b.in[0], b.in[1], b.x, b.y);
    }
    if(sp.closed){
      const a = pts[pts.length-1], b = pts[0];
      ctx.bezierCurveTo(a.out[0], a.out[1], b.in[0], b.in[1], b.x, b.y);
    }
    ctx.stroke();
  }

  // Tiradores y anclas, sólo del subtrazado en curso y del que se
  // esté arrastrando: pintar los de TODOS los subtrazados cerrados a
  // la vez es ruido una vez que ya no se están tocando.
  const editable = pen.current ? [pen.current] : (pen._drag && pen._drag.subpath >= 0 ? [pen.subpaths[pen._drag.subpath]] : []);
  for(const sp of editable){
    for(const a of sp.points){
      const curved = a.out[0] !== a.x || a.out[1] !== a.y || a.in[0] !== a.x || a.in[1] !== a.y;
      if(curved){
        ctx.strokeStyle = "rgba(79,195,247,.7)";
        ctx.lineWidth = px;
        ctx.beginPath();
        ctx.moveTo(a.in[0], a.in[1]); ctx.lineTo(a.out[0], a.out[1]);
        ctx.stroke();
        for(const h of [a.in, a.out]){
          ctx.beginPath(); ctx.arc(h[0], h[1], drawPx(3.5)*px, 0, 6.2832);
          ctx.fillStyle = "#4fc3f7"; ctx.fill();
        }
      }
    }
  }

  for(const sp of list){
    for(let i = 0; i < sp.points.length; i++){
      const a = sp.points[i];
      const r = drawPx(4) * px;
      ctx.beginPath();
      ctx.rect(a.x - r, a.y - r, r*2, r*2);
      ctx.fillStyle = (pen.current && sp === pen.current && i === 0) ? "#fff" : "#4fc3f7";
      ctx.fill();
      ctx.lineWidth = 1.2*px; ctx.strokeStyle = "#0b3d54"; ctx.stroke();
    }
  }
}
