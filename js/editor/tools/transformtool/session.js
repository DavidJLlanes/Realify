/* ═══════════════════════════════════════════════════════════════
   transformtool · session
   Parte de js/editor/tools/transformtool.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { COARSE } from "../../../core/device.js";
import { contentBounds } from "../../align.js";
import { doc, activeLayer } from "../../../core/doc.js";
import { toast, status } from "../../../core/toast.js";
import { toImage, view } from "../../../core/view.js";
import { scheduleCompose, scheduleOverlay } from "../../render/compositor.js";
import { warpRectToMesh, warpRectToQuad } from "../perspective.js";
import { drawPx, grabDoc, nearest, offset } from "../grab.js";
import { emit } from "../../../core/bus.js";
import { record } from "../../../core/history.js";
import { xform, xformRecompute, pivotPoint } from "./common.js";

const stageEl = document.getElementById("stage");

const PROXY_MAX  = COARSE ? 640 : 1100;

const MESH_DRAG  = COARSE ? 5   : 9;

const MESH_REST  = COARSE ? 9   : 14;

const MESH_APPLY = 36;

const WARP_SUBDIV_DRAG = 2, WARP_SUBDIV_REST = 4, WARP_SUBDIV_APPLY = 8;

let layerId = null, srcFull = null, srcBox = null, srcProxy = null;

/* Lo que se ve ANTES de esta sesión — no confundir con `srcFull`: en
   un objeto inteligente que ya tenía una transformación aplicada de
   antes, `srcFull` es el original íntegro sin ninguna (de ahí sale la
   vista previa al arrastrar), pero «Cancelar» tiene que devolver la
   capa a como estaba AL ABRIR la herramienta, no al original en
   crudo, o cancelar borraría de un plumazo cualquier ajuste ya
   aplicado en una sesión anterior. */
let sessionStart = null;

export let armed = false;

/* true cuando la capa de esta sesión es un objeto inteligente: cambia
   de dónde sale `srcFull` (del original guardado, no de la capa tal
   como está ahora) y hace que `xformApply()` acumule en
   `smartTransform` en vez de destruir los píxeles. Ver
   editor/layers/smartobject.js. */
let smartSession = false;

/* Un número que cambia cada vez que se empieza o se termina una
   sesión: ver xformPreview() para por qué hace falta aparte de
   `armed`. */
export let session = 0;

export const isIdentity = () =>
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

export function renderPreview(drag){
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

/* Distancia (px de pantalla, con el ratón) del borde superior al botón de
   girar, el tirador redondo con flecha que sale por encima de la caja. */
const KNOB_GAP = 30;

/* [x, y, bx, by]: posición del tirador de girar y el punto del borde
   superior del que sale. Sigue a la caja al girarla, así que siempre
   queda «por encima» del lado que era el superior. */
function rotateKnob(){
  const q = xform.quad;
  const mx = (q[0][0] + q[1][0]) / 2, my = (q[0][1] + q[1][1]) / 2;
  const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
  let dx = mx - cx, dy = my - cy;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const gap = drawPx(KNOB_GAP) / Math.max(view.zoom, 1e-6);
  return [mx + dx * gap, my + dy * gap, mx, my];
}

export function xformHandleAt(p){
  if(!armed || xform.mode !== "free") return null;
  const q = xform.quad;
  const t = grabDoc(view.zoom, HANDLE_R);
  // Esquinas, puntos medios y pivote compiten: gana el más cercano, así
  // una caja pequeña en pantalla sigue dejando elegir cada tirador.
  const mids = [[0,1],[1,2],[2,3],[3,0]];
  const cands = [...q, ...mids.map(([a,b]) => [(q[a][0]+q[b][0])/2, (q[a][1]+q[b][1])/2]), pivotPoint(), rotateKnob()];
  const i = nearest(p, cands, t);
  if(i >= 0 && i < 4) return { kind:"corner", i, at: cands[i] };
  if(i >= 4 && i < 8){ const k = i - 4, [a,b] = mids[k]; return { kind:"edge", a, b, axis: k % 2 === 0 ? "h" : "v", at: cands[i] }; }
  if(i === 8) return { kind:"pivot", at: cands[8] };
  if(i === 9) return { kind:"rotate", knob:true, at: cands[9] };
  // Girar: el anillo de fuera de cada esquina, sólo si no se está dentro de la caja.
  const rr = t + grabDoc(view.zoom, ROTATE_R - HANDLE_R);
  if(!pointInQuad(p, q)){
    const j = nearest(p, q, rr);
    if(j >= 0) return { kind:"rotate", i: j };
  }
  return null;
}

export function xformWarpHandleAt(p){
  if(!armed || xform.mode !== "warp") return -1;
  return nearest(p, xform.grid, grabDoc(view.zoom, HANDLE_R));
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
    // Desfase entre el dedo y el centro del tirador: el tirador no salta
    // bajo el puntero, se arrastra tal cual se cogió.
    const off = h.at ? { x: h.at[0] - p.x, y: h.at[1] - p.y } : null;
    if(off) p = offset(p, off);
    if(h.kind === "pivot"){ xform._drag = { kind:"pivot", from: p, off }; return; }
    if(h.kind === "rotate"){
      const piv = pivotPoint();
      const a0 = Math.atan2(p.y - piv[1], p.x - piv[0]);
      xform._drag = { kind:"rotate", startAngle: xform.angle, pointerAngle0: a0 };
      return;
    }
    if(h.kind === "corner"){
      xform._drag = { kind:"corner", i: h.i, from: p, off,
        s0: { sx: xform.sx, sy: xform.sy, tx: xform.tx, ty: xform.ty } };
      return;
    }
    if(h.kind === "edge"){
      xform._drag = { kind:"edge", axis: h.axis, from: p, off,
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
    const rad = drawPx(5) * px;
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

  const r = drawPx(7) * px;
  const dot = (x, y) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = "#e8a33d"; ctx.fill();
    ctx.lineWidth = 1.6 * px; ctx.strokeStyle = "#fff"; ctx.stroke();
  };
  for(const [x, y] of q) dot(x, y);
  for(const [a, b] of [[0,1],[1,2],[2,3],[3,0]])
    dot((q[a][0]+q[b][0])/2, (q[a][1]+q[b][1])/2);

  // Tirador de girar: un círculo por encima del borde superior, unido a él
  const [kx, ky, bx, by] = rotateKnob();
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky);
  ctx.strokeStyle = "#e8a33d"; ctx.lineWidth = 1.5 * px; ctx.stroke();
  const kr = drawPx(9) * px;
  ctx.beginPath(); ctx.arc(kx, ky, kr, 0, 6.2832);
  ctx.fillStyle = "#e8a33d"; ctx.fill();
  ctx.lineWidth = 1.6 * px; ctx.strokeStyle = "#fff"; ctx.stroke();
  // Flecha circular dentro del tirador
  ctx.beginPath(); ctx.arc(kx, ky, kr * 0.5, -2.4, 1.4);
  ctx.lineWidth = 1.6 * px; ctx.strokeStyle = "#fff"; ctx.stroke();
  const ex = kx + Math.cos(1.4) * kr * 0.5, ey = ky + Math.sin(1.4) * kr * 0.5;
  ctx.beginPath(); ctx.moveTo(ex - kr * 0.38, ey - kr * 0.05); ctx.lineTo(ex, ey); ctx.lineTo(ex + kr * 0.05, ey - kr * 0.4);
  ctx.stroke();

  const piv = pivotPoint();
  ctx.beginPath();
  ctx.arc(piv[0], piv[1], 6*px, 0, 6.2832);
  ctx.moveTo(piv[0]-9*px, piv[1]); ctx.lineTo(piv[0]+9*px, piv[1]);
  ctx.moveTo(piv[0], piv[1]-9*px); ctx.lineTo(piv[0], piv[1]+9*px);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4*px; ctx.stroke();
}
