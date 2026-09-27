/* ═══════════════════════════════════════════════════════════════
   MARCO DE LA CAPA DE TEXTO
   Los tiradores que rodean un texto seleccionado: escalar por las
   esquinas, girar desde el asa de arriba y —si es un párrafo—
   ensanchar o estirar el marco por los lados, con las líneas
   reajustándose mientras se arrastra.

   Todo se calcula en el sistema SIN girar del texto y se gira sólo al
   pintar y al comparar la posición del puntero (`toTextSpace`). Así
   redimensionar un texto torcido es la misma cuenta que redimensionar
   uno recto, en vez de un caso aparte lleno de senos y cosenos.
   ═══════════════════════════════════════════════════════════════ */

import { view } from "./view.js";
import { emit } from "../core/bus.js";
import { record } from "../core/history.js";
import { isText, textBounds, textQuad, toTextSpace, rotatePoint,
         textOverflows, renderTextLayer } from "./text.js";

/* Radio de agarre de un tirador, en píxeles de pantalla. Generoso a
   propósito: con el dedo, un cuadrado de seis píxeles no se acierta. */
const GRAB = 11;
/* Cuánto se separa el asa de giro del borde superior. */
const SPIN_GAP = 26;

let drag = null;

export const isBoxDragging = () => !!drag;

/* Posiciones de los tiradores en el sistema sin girar. Los laterales
   sólo existen en un párrafo: en texto de punto no hay ancho que
   ajustar, el renglón mide lo que mide. */
function handlePoints(layer){
  const b = textBounds(layer);
  const mx = b.x + b.w / 2, my = b.y + b.h / 2;
  const boxed = Number.isFinite(layer.text.boxW) && layer.text.boxW > 0;
  const out = [
    { id:"nw", x:b.x,        y:b.y },
    { id:"ne", x:b.x + b.w,  y:b.y },
    { id:"se", x:b.x + b.w,  y:b.y + b.h },
    { id:"sw", x:b.x,        y:b.y + b.h },
    { id:"spin", x:mx, y:b.y - SPIN_GAP / view.zoom }
  ];
  if(boxed){
    out.push({ id:"w", x:b.x,       y:my },
             { id:"e", x:b.x + b.w, y:my },
             { id:"n", x:mx, y:b.y },
             { id:"s", x:mx, y:b.y + b.h });
  }
  return out;
}

/* Qué tirador cae bajo el puntero, si es que hay alguno. */
export function hitHandle(layer, p){
  if(!isText(layer)) return null;
  const q = toTextSpace(layer, p);
  const r = GRAB / view.zoom;
  for(const h of handlePoints(layer)){
    if(Math.abs(q.x - h.x) <= r && Math.abs(q.y - h.y) <= r) return h.id;
  }
  return null;
}

export function cursorFor(id, layer){
  if(id === "spin") return "grab";
  if(id === "w" || id === "e") return "ew-resize";
  if(id === "n" || id === "s") return "ns-resize";
  if(id === "nw" || id === "se") return "nwse-resize";
  if(id === "ne" || id === "sw") return "nesw-resize";
  return null;
}

export function beginBoxDrag(layer, id, p){
  if(!isText(layer)) return false;
  const t = layer.text;
  drag = {
    layer, id,
    before: { ...t },
    start: toTextSpace(layer, p),
    box: textBounds(layer),
    // Ángulo del puntero respecto al ancla al empezar a girar, para
    // que la pieza no salte al agarrarla.
    grip: Math.atan2(p.y - t.y, p.x - t.x) * 180 / Math.PI - (t.angle || 0)
  };
  return true;
}

export function boxDragTo(p, shift){
  if(!drag) return;
  const { layer, id, before, box } = drag;
  const t = layer.text;

  if(id === "spin"){
    const now = Math.atan2(p.y - t.y, p.x - t.x) * 180 / Math.PI;
    let a = now - drag.grip;
    // Con Mayúsculas, de quince en quince: los ángulos redondos son
    // los que se quieren casi siempre.
    if(shift) a = Math.round(a / 15) * 15;
    t.angle = Math.round(a * 10) / 10;
    apply(layer);
    return;
  }

  const q = toTextSpace(layer, p);

  // Laterales de un párrafo: mueven ese borde y dejan el opuesto
  // clavado, así que el ancla se recoloca al centro del marco nuevo.
  if(id === "w" || id === "e" || id === "n" || id === "s"){
    let x0 = box.x, x1 = box.x + box.w, y0 = box.y, y1 = box.y + box.h;
    if(id === "w") x0 = Math.min(q.x, x1 - before.size * 0.8);
    if(id === "e") x1 = Math.max(q.x, x0 + before.size * 0.8);
    if(id === "n") y0 = Math.min(q.y, y1 - before.size * 0.5);
    if(id === "s") y1 = Math.max(q.y, y0 + before.size * 0.5);
    setFrame(layer, x0, y0, x1, y1, before);
    apply(layer);
    return;
  }

  /* Esquinas: escalan el texto entero. El factor sale de comparar la
     diagonal hasta la esquina opuesta antes y ahora, que es lo que
     mantiene fija esa esquina mientras se arrastra la de enfrente. */
  const fixed = {
    nw: { x: box.x + box.w, y: box.y + box.h },
    ne: { x: box.x,         y: box.y + box.h },
    se: { x: box.x,         y: box.y },
    sw: { x: box.x + box.w, y: box.y }
  }[id];

  const dx0 = drag.start.x - fixed.x, dy0 = drag.start.y - fixed.y;
  const dx1 = q.x - fixed.x,          q1y = q.y - fixed.y;
  const d0 = Math.hypot(dx0, dy0) || 1;
  const d1 = Math.hypot(dx1, q1y);
  const k = Math.max(0.08, d1 / d0);

  const size = Math.max(4, Math.min(900, Math.round(before.size * k)));
  t.size = size;
  // Todo lo que está medido en píxeles del documento escala con el
  // cuerpo: si no, al agrandar un texto su contorno y su sombra se
  // quedarían finos y el conjunto dejaría de ser el mismo rótulo.
  const s = size / (before.size || 1);
  if(Number.isFinite(before.boxW)) t.boxW = Math.max(before.size * 0.8, before.boxW * s);
  if(Number.isFinite(before.boxH)) t.boxH = Math.max(before.size * 0.5, before.boxH * s);
  t.tracking    = Math.round((before.tracking || 0) * s);
  t.strokeWidth = Math.round((before.strokeWidth || 0) * s);
  t.shadowX     = Math.round((before.shadowX || 0) * s);
  t.shadowY     = Math.round((before.shadowY || 0) * s);
  t.shadowBlur  = Math.round((before.shadowBlur || 0) * s);
  t.bgPadding   = Math.round((before.bgPadding || 0) * s);
  t.bgRadius    = Math.round((before.bgRadius || 0) * s);
  if(Number.isFinite(before.circleRadius)) t.circleRadius = Math.round(before.circleRadius * s);

  /* La esquina contraria tiene que quedarse donde estaba. Se mide
     dónde ha ido a parar con el tamaño nuevo y se corrige el ancla esa
     misma diferencia, ya girada al sistema del documento. */
  const after = textBounds(layer);
  const moved = {
    nw: { x: after.x + after.w, y: after.y + after.h },
    ne: { x: after.x,           y: after.y + after.h },
    se: { x: after.x,           y: after.y },
    sw: { x: after.x + after.w, y: after.y }
  }[id];
  const off = rotatePoint(fixed.x - moved.x, fixed.y - moved.y, 0, 0, t.angle || 0);
  t.x = Math.round(before.x + off.x);
  t.y = Math.round(before.y + off.y);

  apply(layer);
}

/* Recoloca marco y ancla a partir de dos esquinas en el sistema sin
   girar, corrigiendo el desplazamiento del centro para que el borde
   que NO se arrastra no se mueva en pantalla. */
function setFrame(layer, x0, y0, x1, y1, before){
  const t = layer.text;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const off = rotatePoint(cx - (before.x), cy - (before.y), 0, 0, t.angle || 0);
  t.boxW = Math.round(x1 - x0);
  t.boxH = Math.round(y1 - y0);
  t.x = Math.round(before.x + off.x);
  t.y = Math.round(before.y + off.y);
}

function apply(layer){
  renderTextLayer(layer);
  emit("doc:change");
}

export function endBoxDrag(){
  if(!drag) return;
  const { layer, before } = drag;
  drag = null;
  const after = { ...layer.text };
  if(Object.keys(after).every(k => after[k] === before[k])) return;
  const put = st => {
    Object.assign(layer.text, st);
    renderTextLayer(layer);
    emit("doc:structure");
    emit("doc:change");
  };
  record("Transformar texto", () => put(before), () => put(after));
  emit("doc:structure");
}

/* ── pintado ───────────────────────────────────────────────────── */

export function drawTextBox(ctx, layer){
  if(!isText(layer)) return;
  const px = 1 / view.zoom;
  const quad = textQuad(layer);
  const t = layer.text;

  const over = textOverflows(layer);

  ctx.save();
  ctx.lineWidth = px;
  // Marco en rojo cuando lo escrito no cabe en su alto: el texto sigue
  // viéndose entero, pero queda claro que el marco se le ha quedado
  // pequeño y hay que estirarlo.
  ctx.strokeStyle = over ? "rgba(224,92,76,.95)" : "rgba(232,163,61,.95)";
  ctx.setLineDash([5 * px, 4 * px]);
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  for(let i = 1; i < quad.length; i++) ctx.lineTo(quad[i].x, quad[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Varilla hasta el asa de giro, para que se lea como una pieza del
  // marco y no como un punto suelto flotando encima.
  const pts = handlePoints(layer).map(h => ({
    id: h.id, ...rotatePoint(h.x, h.y, t.x, t.y, t.angle || 0)
  }));
  const spin = pts.find(h => h.id === "spin");
  const top = { x: (quad[0].x + quad[1].x) / 2, y: (quad[0].y + quad[1].y) / 2 };
  if(spin){
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(spin.x, spin.y);
    ctx.stroke();
  }

  const r = 4.5 * px;
  for(const h of pts){
    ctx.beginPath();
    if(h.id === "spin") ctx.arc(h.x, h.y, r, 0, 6.2832);
    else ctx.rect(h.x - r, h.y - r, r * 2, r * 2);
    ctx.fillStyle = over && h.id !== "spin" ? "#e05c4c" : "#fff";
    ctx.fill();
    ctx.strokeStyle = "rgba(20,22,26,.9)";
    ctx.stroke();
  }
  ctx.restore();
}
