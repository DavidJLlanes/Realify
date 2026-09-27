/* ═══════════════════════════════════════════════════════════════
   PANEL HISTOGRAMA (interactivo)
   El histograma RGB de la composición, siempre a la vista y al día.
   Está dividido en cinco zonas —Negros, Sombras, Medios, Luces,
   Blancos—: al pasar por encima se resalta la zona y se dice cuánta
   imagen cae en ella; al hacer clic se abre «Tonos del histograma»
   con esa franja elegida, para ajustar SÓLO esos tonos.

   Sólo se recalcula con el panel abierto y con un pequeño retraso
   tras cada cambio del documento, sobre una copia reducida.
   ═══════════════════════════════════════════════════════════════ */

import { on } from "../core/bus.js";
import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { TONE_ZONES } from "../editor/toneband.js";
import { run } from "./commands.js";

const panel = document.getElementById("panel-histogram");
const cv = document.getElementById("histCanvas");
const info = document.getElementById("histInfo");
let hist = null, timer = 0, hover = null;

const bounds = z => [Math.max(0, z[2] - z[3] / 2), Math.min(255, z[2] + z[3] / 2)];
/* Límites de zona contiguos (cada zona hasta el punto medio con la siguiente) */
const EDGES = TONE_ZONES.map((z, i) => [i ? (TONE_ZONES[i - 1][2] + z[2]) / 2 : 0, i < TONE_ZONES.length - 1 ? (z[2] + TONE_ZONES[i + 1][2]) / 2 : 255]);

function compute(){
  timer = 0;
  if(!doc.open || panel.classList.contains("closed")){ hist = null; draw(); return; }
  const full = flatten();
  const k = Math.min(1, Math.sqrt(250000 / (full.width * full.height)));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(full.width * k)); c.height = Math.max(1, Math.round(full.height * k));
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(full, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const h = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), l: new Uint32Array(256), n: 0 };
  for(let i = 0; i < d.length; i += 4){
    if(d[i + 3] < 8) continue;
    h.r[d[i]]++; h.g[d[i + 1]]++; h.b[d[i + 2]]++;
    h.l[(d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) | 0]++; h.n++;
  }
  hist = h;
  draw();
}
const schedule = () => { if(!timer) timer = setTimeout(compute, 350); };

function draw(){
  if(!cv) return;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
  const x = cv.getContext("2d");
  x.clearRect(0, 0, W, H);
  if(!hist){ info.textContent = doc.open ? "" : "Abre una imagen para ver su histograma."; return; }
  // Zona resaltada
  if(hover){
    const [a, b] = EDGES[TONE_ZONES.indexOf(hover)];
    x.fillStyle = "rgba(232,163,61,.14)";
    x.fillRect(a / 255 * W, 0, (b - a) / 255 * W, H);
  }
  let peak = 1;
  for(let i = 2; i < 254; i++) peak = Math.max(peak, hist.r[i], hist.g[i], hist.b[i]);
  x.globalCompositeOperation = "lighter";
  for(const [arr, col] of [[hist.r, "rgba(200,70,60,.6)"], [hist.g, "rgba(60,170,80,.6)"], [hist.b, "rgba(70,100,210,.66)"]]){
    x.fillStyle = col;
    for(let i = 0; i < 256; i++){ const h = Math.min(1, arr[i] / peak) * (H - 2); x.fillRect(i * W / 256, H - h, W / 256 + .6, h); }
  }
  x.globalCompositeOperation = "source-over";
  // Separadores de zona
  x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 1;
  for(const [a] of EDGES.slice(1)){ x.beginPath(); x.moveTo(Math.round(a / 255 * W) + .5, 0); x.lineTo(Math.round(a / 255 * W) + .5, H); x.stroke(); }
  // Recortes: cuánto hay pegado a 0 y a 255
  const n = Math.max(1, hist.n), lo = hist.l[0] / n * 100, hi = hist.l[255] / n * 100;
  if(hover){
    const [a, b] = EDGES[TONE_ZONES.indexOf(hover)];
    let s = 0; for(let i = Math.floor(a); i <= Math.min(255, Math.ceil(b)); i++) s += hist.l[i];
    info.textContent = `${hover[1]} · ${Math.round(s / n * 100)} % de la imagen · clic para ajustar sólo estos tonos`;
  } else info.textContent = `Negro puro ${lo.toFixed(1)} % · blanco puro ${hi.toFixed(1)} % · toca una zona para ajustarla`;
}

function zoneFromEvent(e){
  const r = cv.getBoundingClientRect(), v = (e.clientX - r.left) / r.width * 255;
  return TONE_ZONES[EDGES.findIndex(([a, b]) => v >= a && v <= b)] || null;
}

export function initHistogramPanel(){
  if(!panel || !cv) return;
  on("doc:change", schedule);
  on("doc:new", schedule);
  on("doc:structure", schedule);
  new ResizeObserver(() => draw()).observe(cv);
  // Al desplegar el panel, se calcula al momento
  new MutationObserver(() => { if(!panel.classList.contains("closed")) schedule(); }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  cv.addEventListener("pointermove", e => { const z = zoneFromEvent(e); if(z !== hover){ hover = z; draw(); } });
  cv.addEventListener("pointerleave", () => { hover = null; draw(); });
  cv.addEventListener("click", async e => {
    const z = zoneFromEvent(e);
    if(!z || !doc.open) return;
    const [a, b] = bounds(z);
    run("adj.toneBand", { center: z[2], width: Math.max(12, (b - a) / 2 + 10) });
  });
  schedule();
}

/** Despliega el panel (y en móvil abre la hoja con él delante). */
export async function showHistogramPanel(){
  if(!panel) return;
  const { isMobile } = await import("../core/device.js");
  if(isMobile()){
    const { toggleSheet } = await import("./panels.js");
    toggleSheet(true);
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("closed", p !== panel));
  } else panel.classList.remove("closed");
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  schedule();
}
