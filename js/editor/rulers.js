/* ═══════════════════════════════════════════════════════════════
   REGLAS Y GUÍAS
   Dos franjas finas con marcas, ancladas a los bordes superior e
   izquierdo del lienzo, y unas líneas que se arrastran hacia fuera de
   ellas para marcar dónde debería alinearse algo. Las guías se
   guardan en `doc.guides` en coordenadas de DOCUMENTO —no de
   pantalla—, así que sobreviven al zoom y al paneo sin recalcular
   nada: sólo cambia dónde caen en pantalla al dibujarlas, nunca su
   valor guardado.
   ═══════════════════════════════════════════════════════════════ */

import { isTouch } from "./grab.js";
import { doc } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit, on } from "../core/bus.js";
import { view, toImage } from "./view.js";
import { setGuideOverlay, scheduleOverlay } from "./compositor.js";

const stage = document.getElementById("stage");

/* ── snapping ─────────────────────────────────────────────────
   Pura, sin DOM: dado un valor en coordenadas de imagen y una lista
   de candidatos (también en imagen), devuelve el candidato más cercano
   si cae dentro de la tolerancia en PANTALLA —convertida a imagen
   dividiendo por el zoom, porque «cerca» tiene que sentirse igual de
   cerca da igual el nivel de acercamiento—, o el valor tal cual si
   ninguno está lo bastante cerca. */
/* `gridStep`, si se da (>0), añade un candidato más sin tener que
   enumerar cada múltiplo de la cuadrícula como si fuera una guía más
   —con una cuadrícula de 10 px en un documento de 4000 sería, no es
   coña, 400 candidatos por eje que comparar en cada fotograma de un
   arrastre—: basta con redondear al múltiplo más cercano y ver si esa
   distancia es la mejor, un cálculo O(1) en vez de recorrer una lista
   entera. */
export function snapValue(v, candidates, tolPx, zoom, gridStep){
  const tol = tolPx / Math.max(zoom, 1e-6);
  let best = v, bestD = tol;
  for(const c of candidates){
    const d = Math.abs(v - c);
    if(d < bestD){ bestD = d; best = c; }
  }
  if(gridStep > 0){
    const g = Math.round(v / gridStep) * gridStep;
    const d = Math.abs(v - g);
    if(d < bestD){ bestD = d; best = g; }
  }
  return best;
}

/* Los candidatos de siempre: los bordes y el centro del documento, más
   todas las guías del eje correspondiente, más cualquier candidato
   extra que traiga quien llama —los bordes y centros de otras capas,
   por ejemplo—. */
export function snapCandidatesX(w, guides, extra){ return extra ? [0, w/2, w, ...guides.v, ...extra] : [0, w/2, w, ...guides.v]; }
export function snapCandidatesY(h, guides, extra){ return extra ? [0, h/2, h, ...guides.h, ...extra] : [0, h/2, h, ...guides.h]; }

export function snapPoint(p, w, h, guides, tolPx, zoom){
  return {
    x: snapValue(p.x, snapCandidatesX(w, guides), tolPx, zoom, snapToGridEnabled() ? gridStep() : 0),
    y: snapValue(p.y, snapCandidatesY(h, guides), tolPx, zoom, snapToGridEnabled() ? gridStep() : 0)
  };
}

/* Ajusta un RANGO —no un punto suelto— contra los candidatos: prueba
   sus dos bordes y su centro, y se queda con el enganche que quede
   más cerca de cualquiera de los tres, aplicado como un ÚNICO
   desplazamiento a todo el rango. Es lo que hace falta para mover
   una capa o una selección ya hechas —Photoshop no sólo centra lo que
   arrastras, también encaja cualquiera de sus bordes—, a diferencia
   de `snapValue`, que sólo sabe ajustar un punto suelto (el que se
   usa al ESTAR DIBUJANDO una selección nueva, donde de momento no hay
   más que la esquina bajo el dedo). Devuelve `{ offset, at }`: el
   desplazamiento a aplicar (0 si nada engancha) y la posición exacta
   del candidato que ganó —para poder dibujar la línea de ajuste ahí,
   no basta con saber cuánto se movió—. */
export function snapRange(a0, a1, candidates, tolPx, zoom, gridStep){
  const tol = tolPx / Math.max(zoom, 1e-6);
  const anchors = [a0, (a0 + a1) / 2, a1];
  let bestOffset = 0, bestAt = null, bestD = tol;
  for(const anchor of anchors){
    for(const c of candidates){
      const d = Math.abs(anchor - c);
      if(d < bestD){ bestD = d; bestOffset = c - anchor; bestAt = c; }
    }
    if(gridStep > 0){
      const g = Math.round(anchor / gridStep) * gridStep;
      const d = Math.abs(anchor - g);
      if(d < bestD){ bestD = d; bestOffset = g - anchor; bestAt = g; }
    }
  }
  return { offset: bestOffset, at: bestAt };
}

/* ── estado y persistencia ───────────────────────────────────── */
let showGuides = true;
let showRulers = true;
try{ showGuides = localStorage.getItem("realify.guides") !== "0"; }catch{}
try{ showRulers = localStorage.getItem("realify.rulers") !== "0"; }catch{}

export const guidesVisible = () => showGuides;
export const rulersVisible = () => showRulers;

export function setGuidesVisible(v){
  showGuides = v;
  try{ localStorage.setItem("realify.guides", v ? "1" : "0"); }catch{}
  scheduleOverlay();
}
export function setRulersVisible(v){
  showRulers = v;
  try{ localStorage.setItem("realify.rulers", v ? "1" : "0"); }catch{}
  layoutRulers();
}

/* ── cuadrícula ───────────────────────────────────────────────────
   Un espaciado y unas subdivisiones, nada más: como cualquier
   cuadrícula de maquetación, sirve tanto de referencia visual como de
   otra fuente de candidatos de ajuste, independiente de las guías. */
let showGrid = false;
let snapToGridOn = false;
let gridSizeVal = 50;      // separación entre líneas MAYORES, en píxeles de documento
let gridSubVal = 4;        // subdivisiones menores por celda mayor
try{ showGrid = localStorage.getItem("realify.grid") === "1"; }catch{}
try{ snapToGridOn = localStorage.getItem("realify.gridSnap") === "1"; }catch{}
try{
  const s = JSON.parse(localStorage.getItem("realify.gridConfig") || "null");
  if(s && s.size > 0){ gridSizeVal = s.size; gridSubVal = Math.max(1, s.sub | 0); }
}catch{}

export const gridVisible = () => showGrid;
export const snapToGridEnabled = () => snapToGridOn;
export const gridConfig = () => ({ size: gridSizeVal, sub: gridSubVal });
export const gridStep = () => gridSizeVal / gridSubVal;

export function setGridVisible(v){
  showGrid = v;
  try{ localStorage.setItem("realify.grid", v ? "1" : "0"); }catch{}
  scheduleOverlay();
}
export function setSnapToGrid(v){
  snapToGridOn = v;
  try{ localStorage.setItem("realify.gridSnap", v ? "1" : "0"); }catch{}
}
export function setGridConfig(size, sub){
  gridSizeVal = Math.max(2, Math.round(size) || 50);
  gridSubVal = Math.max(1, Math.round(sub) || 1);
  try{ localStorage.setItem("realify.gridConfig", JSON.stringify({ size: gridSizeVal, sub: gridSubVal })); }catch{}
  scheduleOverlay();
}

/* Líneas menores tenues cada `gridStep()`, mayores más marcadas cada
   `gridSizeVal` —la misma jerarquía visual de dos niveles que
   cualquier papel milimetrado—. Sólo se dibuja lo que cae dentro del
   documento, y sólo si el paso en PANTALLA no se ha apelmazado por un
   zoom muy alejado —una cuadrícula de 2 px de espaciado en pantalla no
   ayuda a nadie, sólo ensucia la vista—. */
function drawGridLines(ctx){
  if(!showGrid || !doc.open) return;
  const step = gridStep();
  if(step * view.zoom < 4) return;
  const px = 1 / Math.max(view.zoom, 1e-6);
  // Índice ENTERO, no una `x` que va sumando `step` en el propio bucle:
  // con un paso que no sea entero (una cuadrícula de 50 px a 3
  // subdivisiones da un paso de 16,666…), acumular el error de cada
  // suma iba desalineando las líneas más lejanas del origen.
  const nx = Math.ceil(doc.w / step), ny = Math.ceil(doc.h / step);

  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = px;
  ctx.beginPath();
  for(let i = 1; i < nx; i++){ if(i % gridSubVal === 0) continue; const x = i*step; ctx.moveTo(x, 0); ctx.lineTo(x, doc.h); }
  for(let i = 1; i < ny; i++){ if(i % gridSubVal === 0) continue; const y = i*step; ctx.moveTo(0, y); ctx.lineTo(doc.w, y); }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.beginPath();
  const nMajorX = Math.floor(doc.w / gridSizeVal), nMajorY = Math.floor(doc.h / gridSizeVal);
  for(let i = 0; i <= nMajorX; i++){ const x = i*gridSizeVal; ctx.moveTo(x, 0); ctx.lineTo(x, doc.h); }
  for(let i = 0; i <= nMajorY; i++){ const y = i*gridSizeVal; ctx.moveTo(0, y); ctx.lineTo(doc.w, y); }
  ctx.stroke();
}

function snapshotGuides(){ return { h: doc.guides.h.slice(), v: doc.guides.v.slice() }; }

function commit(label, before, after){
  doc.guides = after;
  record(label,
    () => { doc.guides = before; emit("doc:change"); },
    () => { doc.guides = after;  emit("doc:change"); });
  emit("doc:change");
}

export function addGuide(axis, pos){
  const before = snapshotGuides();
  const after = snapshotGuides();
  after[axis] = [...after[axis], pos].sort((a,b) => a-b);
  commit("Añadir guía", before, after);
}

export function removeGuideAt(axis, index){
  const before = snapshotGuides();
  if(index < 0 || index >= before[axis].length) return;
  const after = snapshotGuides();
  after[axis].splice(index, 1);
  commit("Eliminar guía", before, after);
}

export function clearGuides(){
  const before = snapshotGuides();
  if(!before.h.length && !before.v.length) return;
  commit("Borrar guías", before, { h:[], v:[] });
}

/* Arrastrar una guía existente: en vivo mientras se mueve el dedo, sin
   abrir un paso de historial en cada fotograma —igual que la vista
   previa de una capa de ajuste—, y un único paso al soltar. */
export function previewMoveGuide(axis, index, pos){
  if(index < 0 || index >= doc.guides[axis].length) return;
  doc.guides[axis][index] = pos;
  emit("doc:change");
}

export function commitMoveGuide(axis, index, fromPos, toPos){
  if(index < 0 || index >= doc.guides[axis].length) return;
  // Tocarla sin moverla (p. ej. el primer toque de un doble toque) no
  // es un paso de historial.
  if(fromPos === toPos) return;
  const before = snapshotGuides();
  before[axis][index] = fromPos;
  const after = snapshotGuides();
  after[axis][index] = toPos;
  after[axis].sort((a,b) => a-b);
  commit("Mover guía", before, after);
}

/* Punto de imagen bajo el dedo cerca de una guía existente, dentro de
   tolerancia en pantalla. Devuelve {axis, index} o null. */
export function guideAt(p, tolPx = 8){
  const tol = tolPx / Math.max(view.zoom, 1e-6);
  for(let i = 0; i < doc.guides.v.length; i++)
    if(Math.abs(p.x - doc.guides.v[i]) < tol) return { axis:"v", index:i };
  for(let i = 0; i < doc.guides.h.length; i++)
    if(Math.abs(p.y - doc.guides.h[i]) < tol) return { axis:"h", index:i };
  return null;
}

/* ── dibujo de las guías (hueco de superposición) ───────────────
   Se ejecuta dentro del contexto YA transformado a coordenadas de
   imagen (traslación + zoom de la vista), igual que cualquier otra
   superposición: las líneas se trazan de un borde al otro del
   documento en unidades de imagen, sin volver a convertir nada. */
/* Guías de composición de la cuadrícula inteligente (smartgrid.js):
   se registran desde allí para no cargar ese módulo si no se usa. */
let compositionFn = null;
export function setCompositionOverlay(fn){ compositionFn = fn; scheduleOverlay(); }

function drawGuideLines(ctx){
  if(!doc.open) return;
  drawGridLines(ctx);   // debajo de las guías: si coinciden, la guía gana
  if(compositionFn){ ctx.save(); try{ compositionFn(ctx); }finally{ ctx.restore(); } }
  if(!showGuides) return;
  const px = 1 / Math.max(view.zoom, 1e-6);
  ctx.strokeStyle = "rgba(94,196,255,.85)";
  ctx.lineWidth = px;
  ctx.beginPath();
  for(const x of doc.guides.v){ ctx.moveTo(x, 0); ctx.lineTo(x, doc.h); }
  for(const y of doc.guides.h){ ctx.moveTo(0, y); ctx.lineTo(doc.w, y); }
  ctx.stroke();

  if(drag && drag.live !== null){
    ctx.strokeStyle = "#fff";
    ctx.setLineDash([6*px, 4*px]);
    ctx.beginPath();
    if(drag.axis === "v"){ ctx.moveTo(drag.live, 0); ctx.lineTo(drag.live, doc.h); }
    else { ctx.moveTo(0, drag.live); ctx.lineTo(doc.w, drag.live); }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

setGuideOverlay(drawGuideLines);

/* ── arrastrar una guía nueva desde la regla ─────────────────────
   `drag` también lo lee `drawGuideLines` de arriba mientras el gesto
   está en marcha: la línea fantasma que sigue al dedo antes de
   soltarla es el mismo dato, no un segundo estado por separado. */
let drag = null;

function beginDragFromRuler(axis, e){
  const p = toImage(e.clientX, e.clientY);
  drag = { axis, index: -1, live: axis === "v" ? p.x : p.y, from: null };
  scheduleOverlay();
}

function beginDragExisting(hit, e){
  drag = { axis: hit.axis, index: hit.index,
           live: hit.axis === "v" ? doc.guides.v[hit.index] : doc.guides.h[hit.index],
           from: hit.axis === "v" ? doc.guides.v[hit.index] : doc.guides.h[hit.index] };
}

function dragMove(e){
  if(!drag) return;
  const p = toImage(e.clientX, e.clientY);
  const raw = drag.axis === "v" ? p.x : p.y;
  // Se ajusta contra los bordes y el centro del documento (no contra
  // sí misma: excluirse a sí misma de sus propios candidatos evita
  // que una guía se quede pegada tratando de ajustarse contra su
  // propia posición).
  const cand = drag.axis === "v" ? [0, doc.w/2, doc.w] : [0, doc.h/2, doc.h];
  drag.live = snapValue(raw, cand, 6, view.zoom);
  if(drag.index >= 0) previewMoveGuide(drag.axis, drag.index, drag.live);
  scheduleOverlay();
}

function dragEnd(e){
  if(!drag) return;
  const p = { x: e.clientX, y: e.clientY };
  const overStage = insideStage(p);
  const overRuler = overRulerBand(p, drag.axis);
  if(drag.index >= 0){
    // Devolverla a su propia franja la borra, igual que en cualquier
    // editor: es el gesto natural de "quitar esto de aquí". Las
    // franjas están DENTRO del propio #stage (pegadas a su borde), así
    // que hay que comprobar la franja, no el borde del escenario.
    if(!overStage || overRuler) removeGuideAt(drag.axis, drag.index);
    else commitMoveGuide(drag.axis, drag.index, drag.from, drag.live);
  } else if(overStage && !overRuler){
    addGuide(drag.axis, drag.live);
  }
  drag = null;
  scheduleOverlay();
}

function stageRect(){ return stage.getBoundingClientRect(); }
function insideStage(p){
  const r = stageRect();
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}
/* ¿El punto cae sobre la propia franja de la regla de ese eje? Soltar
   ahí —tanto al arrastrar una nueva como al devolver una existente—
   cuenta como "no, aquí no": es el borde estrecho de 18 px pegado al
   límite del escenario, no el resto del lienzo. */
function overRulerBand(p, axis){
  const r = stageRect();
  return axis === "h" ? (p.y - r.top) < RULER_SIZE : (p.x - r.left) < RULER_SIZE;
}

/* ── las dos franjas ──────────────────────────────────────────── */
const RULER_SIZE = 18;
const hRuler = document.createElement("canvas");
const vRuler = document.createElement("canvas");
for(const [el, cursor] of [[hRuler,"ns-resize"],[vRuler,"ew-resize"]]){
  el.style.cssText = `position:absolute;z-index:3;background:var(--s-700,#1c1f23);` +
                     `border-color:var(--line,#333);cursor:${cursor === "ns-resize" ? "row-resize" : "col-resize"}`;
}
/* El largo va con `width`/`height` en CSS, NO con `right:0`/`bottom:0`.
   Un <canvas> es un elemento reemplazado: con la medida en `auto` el
   navegador usa su tamaño INTRÍNSECO —el de los atributos width/height,
   conservando su proporción— y se desentiende de `right`/`bottom`, así
   que la franja nunca se estiraba a lo largo del borde. Peor aún, se
   realimentaba: `drawRuler()` medía ese tamaño encogido, lo multiplicaba
   por el devicePixelRatio y lo devolvía a los atributos, encogiéndolo un
   poco más en cada pasada hasta quedarse en unos 13×20 px. Las dos
   reglas acababan como dos cuadraditos pegados a la esquina, junto al de
   la intersección. Es el mismo motivo por el que el lienzo de
   superposición de compositor.js lleva width/height al 100 %. */
hRuler.style.top = "0"; hRuler.style.left = RULER_SIZE + "px";
hRuler.style.width = `calc(100% - ${RULER_SIZE}px)`;
hRuler.style.height = RULER_SIZE + "px"; hRuler.style.borderBottom = "1px solid var(--line,#333)";
vRuler.style.top = RULER_SIZE + "px"; vRuler.style.left = "0";
vRuler.style.height = `calc(100% - ${RULER_SIZE}px)`;
vRuler.style.width = RULER_SIZE + "px"; vRuler.style.borderRight = "1px solid var(--line,#333)";
hRuler.className = vRuler.className = "ruler-strip";
const corner = document.createElement("div");
corner.className = "ruler-strip";
corner.style.cssText = `position:absolute;z-index:3;top:0;left:0;width:${RULER_SIZE}px;` +
                       `height:${RULER_SIZE}px;background:var(--s-700,#1c1f23);` +
                       `border-right:1px solid var(--line,#333);border-bottom:1px solid var(--line,#333)`;

/* Paso «bonito» entre marcas: el objetivo es una marca cada 60-90 px
   de pantalla más o menos, redondeado a 1/2/5 × una potencia de diez
   —la progresión que usa cualquier regla o eje de gráfica, porque son
   los números que un vistazo lee sin tener que hacer cuentas—. */
function niceStep(zoom, targetPx = 70){
  const raw = targetPx / zoom;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return step * mag;
}

function drawRuler(canvas, axis){
  const dpr = (typeof devicePixelRatio === "number" && devicePixelRatio) || 1;
  /* `clientWidth/Height` y no `getBoundingClientRect()`: con
     `box-sizing:border-box` el rectángulo incluye el borde de 1 px de
     la franja, pero el lienzo sólo pinta dentro de la caja de
     contenido, así que dimensionar el búfer con la medida de fuera lo
     dejaba estirado un 5 % contra las marcas. */
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
  if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
  const cx = canvas.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, cw, ch);
  if(!doc.open) return;

  cx.strokeStyle = "rgba(255,255,255,.35)";
  cx.fillStyle = "rgba(255,255,255,.55)";
  cx.font = "9px system-ui, sans-serif";
  cx.lineWidth = 1;

  const step = niceStep(view.zoom);
  /* `view.x`/`view.y` son la posición del documento relativa al
     escenario ENTERO (stage-x=0), pero cada franja vive desplazada
     RULER_SIZE dentro de él —la horizontal empieza en left:18px, la
     vertical en top:18px—, así que su propio origen de dibujo (0,0
     del lienzo de la franja) no coincide con el del escenario. Sin
     restarlo aquí, la marca del "0" del documento se dibujaba 18 px
     más allá de donde la imagen realmente empieza. */
  const offset = (axis === "h" ? view.x : view.y) - RULER_SIZE;
  const size = axis === "h" ? cw : ch;
  const docSize = axis === "h" ? doc.w : doc.h;

  const first = Math.floor(-offset / view.zoom / step) * step;
  cx.beginPath();
  for(let v = first; v * view.zoom + offset < size; v += step){
    if(v < -step || v > docSize + step) continue;
    const pos = Math.round(v * view.zoom + offset) + 0.5;
    if(axis === "h"){
      cx.moveTo(pos, RULER_SIZE); cx.lineTo(pos, RULER_SIZE * 0.4);
    } else {
      cx.moveTo(RULER_SIZE, pos); cx.lineTo(RULER_SIZE * 0.4, pos);
    }
  }
  cx.stroke();

  cx.save();
  for(let v = first; v * view.zoom + offset < size; v += step){
    if(v < -step || v > docSize + step) continue;
    const pos = v * view.zoom + offset;
    const label = String(Math.round(v));
    if(axis === "h"){
      cx.fillText(label, pos + 2, RULER_SIZE * 0.55);
    } else {
      cx.save();
      cx.translate(RULER_SIZE * 0.62, pos - 2);
      cx.rotate(-Math.PI/2);
      cx.fillText(label, 0, 0);
      cx.restore();
    }
  }
  cx.restore();

  // Marcador de la posición actual del puntero, si se conoce
  if(lastPointer){
    const p = toImage(lastPointer.x, lastPointer.y);
    cx.strokeStyle = "#e8a33d";
    cx.beginPath();
    if(axis === "h"){
      const pos = p.x * view.zoom + offset;
      cx.moveTo(pos, 0); cx.lineTo(pos, RULER_SIZE);
    } else {
      const pos = p.y * view.zoom + offset;
      cx.moveTo(0, pos); cx.lineTo(RULER_SIZE, pos);
    }
    cx.stroke();
  }
}

let lastPointer = null;
function redrawRulers(){
  if(!showRulers) return;
  drawRuler(hRuler, "h");
  drawRuler(vRuler, "v");
}

function layoutRulers(){
  const on = showRulers && doc.open;
  hRuler.hidden = vRuler.hidden = corner.hidden = !on;
  redrawRulers();
}

/* ── eventos ──────────────────────────────────────────────────── */
/* `stopPropagation` es tan necesario aquí como `preventDefault`: sin
   él, el mismo pointerdown burbujea hasta #stage y la herramienta
   activa (Mover, Pincel...) lo procesa TAMBIÉN como si fuera un gesto
   normal sobre el lienzo. El resultado es que arrastrar una guía
   nueva desde la regla mueve a la vez el contenido de la capa activa
   —el arrastre de la herramienta y el de la guía comparten el mismo
   puntero—, descuadrando la imagen sin que la guía en sí haga nada
   destructivo: el daño lo hacía la herramienta de fondo. */
hRuler.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); beginDragFromRuler("h", e); window.addEventListener("pointermove", dragMove); window.addEventListener("pointerup", dragEndOnce); });
vRuler.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); beginDragFromRuler("v", e); window.addEventListener("pointermove", dragMove); window.addEventListener("pointerup", dragEndOnce); });

function dragEndOnce(e){
  window.removeEventListener("pointermove", dragMove);
  window.removeEventListener("pointerup", dragEndOnce);
  dragEnd(e);
}

/* Arrastrar una guía ya puesta: se detecta en el propio lienzo, no en
   la regla, así que se engancha en captura para no robarle el gesto a
   la herramienta activa salvo que de verdad se empiece encima de una
   guía. Doble clic o doble toque sobre una guía la borra (arrastrarla
   hasta la estrecha franja de la regla es incómodo con el dedo). */
let lastGuideTap = null;
stage.addEventListener("pointerdown", e => {
  if(!showGuides || !doc.open || drag) return;
  const p = toImage(e.clientX, e.clientY);
  const hit = guideAt(p, isTouch() ? 18 : 8);
  if(!hit) return;
  const now = performance.now();
  if(lastGuideTap && lastGuideTap.axis === hit.axis && lastGuideTap.index === hit.index &&
     now - lastGuideTap.t < 400 && Math.hypot(e.clientX - lastGuideTap.x, e.clientY - lastGuideTap.y) < 30){
    e.stopImmediatePropagation(); e.preventDefault();
    lastGuideTap = null;
    removeGuideAt(hit.axis, hit.index);
    scheduleOverlay();
    return;
  }
  lastGuideTap = { axis: hit.axis, index: hit.index, t: now, x: e.clientX, y: e.clientY };
  // Este manejador va en fase de CAPTURA (tercer argumento `true` más
  // abajo), así que corre antes que el de la herramienta activa, que
  // está en fase de burbuja normal. `stopImmediatePropagation` para
  // aquí de verdad —no sólo la captura— y la herramienta nunca llega
  // a enterarse del clic: pulsar a menos de 8 px de pantalla de una
  // guía siempre gana y siempre mueve la guía, nunca dibuja.
  e.stopImmediatePropagation();
  beginDragExisting(hit, e);
  window.addEventListener("pointermove", dragMove);
  window.addEventListener("pointerup", dragEndOnce);
}, true);

addEventListener("pointermove", e => { lastPointer = { x:e.clientX, y:e.clientY }; if(showRulers) redrawRulers(); });
on("view:change", redrawRulers);
on("doc:resize", layoutRulers);
on("doc:new", layoutRulers);
on("doc:structure", () => { if(showRulers) redrawRulers(); });
addEventListener("resize", redrawRulers);

export function initRulers(){
  stage.appendChild(hRuler);
  stage.appendChild(vRuler);
  stage.appendChild(corner);
  layoutRulers();
}
