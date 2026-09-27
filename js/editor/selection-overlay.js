/* ═══════════════════════════════════════════════════════════════
   HORMIGAS DE LA SELECCIÓN
   El contorno de `doc.selection`, trazado píxel a píxel y animado tal
   cual en Photoshop: rayas discontinuas blancas y negras alternas que
   se desplazan sin parar mientras haya algo seleccionado. Vive en su
   propio hueco de superposición (ver `setSelectionOverlay` en
   compositor.js), independiente de la herramienta activa: así se
   sigue viendo aunque se cambie a Pincel para pintar dentro de la
   selección, que es justo cuando más falta hace verla.
   ═══════════════════════════════════════════════════════════════ */
import { doc } from "../core/doc.js";
import { on } from "../core/bus.js";
import { view } from "./view.js";
import { setSelectionOverlay, scheduleOverlay } from "./compositor.js";

/* Recorre la máscara y junta, en tramos horizontales y verticales lo
   más largos posible, cada borde de píxel donde «dentro» pasa a
   «fuera» (umbral al 50%, el mismo criterio con el que un borde
   difuminado deja de estar "seleccionado" a efectos visuales). Lineal
   en el número de píxeles; aparte para poder probarlo con números
   sueltos, sin lienzo ni animación de por medio. */
export function traceSelectionOutline(mask, w, h, threshold = 128){
  const horiz = [];
  for(let y = 0; y <= h; y++){
    let start = -1;
    for(let x = 0; x < w; x++){
      const above = y > 0 && mask[(y - 1) * w + x] >= threshold;
      const below = y < h && mask[y * w + x] >= threshold;
      if(above !== below){ if(start === -1) start = x; }
      else if(start !== -1){ horiz.push({ x0: start, x1: x, y }); start = -1; }
    }
    if(start !== -1) horiz.push({ x0: start, x1: w, y });
  }
  const vert = [];
  for(let x = 0; x <= w; x++){
    let start = -1;
    for(let y = 0; y < h; y++){
      const left = x > 0 && mask[y * w + x - 1] >= threshold;
      const right = x < w && mask[y * w + x] >= threshold;
      if(left !== right){ if(start === -1) start = y; }
      else if(start !== -1){ vert.push({ x, y0: start, y1: y }); start = -1; }
    }
    if(start !== -1) vert.push({ x, y0: start, y1: h });
  }
  return { horiz, vert };
}

/* El contorno sólo depende de la máscara, no del fotograma de la
   animación: se recalcula sólo cuando cambia, nunca en cada tic. */
let cache = null;
function outlineFor(sel){
  if(cache && cache.mask === sel.mask) return cache.outline;
  const outline = traceSelectionOutline(sel.mask, sel.w, sel.h);
  cache = { mask: sel.mask, outline };
  return outline;
}

let antsPhase = 0;
const SPEED = 30; // píxeles de recorrido del patrón por segundo
let raf = null, lastT = 0;

function tick(t){
  if(!doc.selection){ raf = null; lastT = 0; return; }
  if(lastT) antsPhase = (antsPhase + (t - lastT) * SPEED / 1000) % 10000;
  lastT = t;
  scheduleOverlay();
  raf = requestAnimationFrame(tick);
}

/* Sólo se anima —y sólo se gasta un fotograma tras otro— mientras
   haya de verdad una selección que mostrar; deseleccionar detiene el
   bucle solo. */
function ensureRunning(){
  if(doc.selection && raf == null){ lastT = 0; raf = requestAnimationFrame(tick); }
}
on("sel:change", ensureRunning);
on("doc:change", ensureRunning);
on("doc:structure", ensureRunning);

function draw(ctx){
  const sel = doc.selection;
  if(!sel) return;
  const { horiz, vert } = outlineFor(sel);
  if(!horiz.length && !vert.length) return;
  const px = 1 / view.zoom;
  const dash = 6 * px;
  ctx.save();
  ctx.lineWidth = px;
  ctx.beginPath();
  for(const s of horiz){ ctx.moveTo(s.x0, s.y); ctx.lineTo(s.x1, s.y); }
  for(const s of vert){ ctx.moveTo(s.x, s.y0); ctx.lineTo(s.x, s.y1); }
  ctx.setLineDash([dash, dash]);
  ctx.strokeStyle = "#000";
  ctx.lineDashOffset = antsPhase;
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.lineDashOffset = antsPhase + dash;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

setSelectionOverlay(draw);
