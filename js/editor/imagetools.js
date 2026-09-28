/* ═══════════════════════════════════════════════════════════════
   IMAGEN › RECORTAR EN FORMA
   (Dividir en trozos es ahora el plugin «Cortar en partes», cortar/.)

   Recortar en forma: deja la imagen dentro de un círculo, un
   polígono, una estrella, un corazón… (la biblioteca común de
   js/core/shapes.js) con TRANSPARENCIA fuera, y opcionalmente ajusta
   el lienzo a la forma. Todas las capas se recortan igual y es un
   solo paso de historial.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer, cropDoc } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { record, recordLayers } from "../core/history.js";
import { flatten } from "./layertree.js";
import { fit as fitView } from "./view.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { slider } from "./adjust.js";
import { SHAPE_LIST, fitShape, tracePath, shapeSvg } from "../core/shapes.js";
import { autoCompact } from "../ui/compact.js";

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
function selectRow(label, value, items, on){
  const r = el(`<div class="field"><label>${label}</label><select class="grow">${items.map(([v, n]) => `<option value="${v}"${String(v) === String(value) ? " selected" : ""}>${n}</option>`).join("")}</select></div>`);
  r.querySelector("select").addEventListener("change", e => on(e.target.value));
  return r;
}
function numberRow(label, value, min, max, on, unit = ""){
  const r = el(`<div class="field"><label>${label}</label><input type="number" class="grow" min="${min}" max="${max}" value="${value}"><span class="unit">${unit}</span></div>`);
  const i = r.querySelector("input");
  i.addEventListener("input", () => { const v = clamp(Math.round(+i.value || min), min, max); on(v); });
  i.addEventListener("change", () => { i.value = clamp(Math.round(+i.value || min), min, max); });
  return r;
}

/* ════════════════ Recortar en forma ════════════════ */
/* Estado estructural del documento, sin copiar píxeles (como en el
   creador de memes): para deshacer en un solo paso. */
function capture(){
  return { w: doc.w, h: doc.h, layers: doc.layers.slice(),
           parts: doc.layers.map(l => ({ l, canvas: l.canvas, ctx: l.ctx, mask: l.mask, shape: l.shape, smartBox: l.smartBox, smartTransform: l.smartTransform })) };
}
function restore(s){
  doc.w = s.w; doc.h = s.h; doc.layers = s.layers.slice();
  for(const p of s.parts){ Object.assign(p.l, { canvas: p.canvas, ctx: p.ctx, mask: p.mask, shape: p.shape, smartBox: p.smartBox, smartTransform: p.smartTransform }); p.l.thumbDirty = true; }
  doc.selection = null;
  emit("doc:resize"); emit("doc:structure"); emit("doc:change");
  fitView();
}

export async function shapeCrop(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const W = doc.w, H = doc.h;
  const p = { shape: "circle", size: 100, cx: .5, cy: .5, stretch: 0, rot: 0, feather: 0, outline: 0, outlineColor: "#ffffff", crop: true };
  const src = flatten();
  const body = document.createElement("div");
  const pv = document.createElement("canvas");
  const k = Math.min(1, 460 / Math.max(W, H));
  pv.width = Math.max(1, Math.round(W * k)); pv.height = Math.max(1, Math.round(H * k));
  pv.style.cssText = "display:block;margin:0 auto 10px;max-width:100%;height:auto;max-height:280px;border-radius:var(--r);cursor:move;touch-action:none;background:repeating-conic-gradient(#3a3d42 0 25%,#2a2d31 0 50%) 0 0/16px 16px";
  /* Forma en píxeles del documento: caja cuadrada del lado menor ×
     tamaño, estirable a lo ancho o a lo alto, girada. */
  const geom = () => {
    const base = Math.min(W, H) * p.size / 100, sx = p.stretch > 0 ? 1 + p.stretch / 100 : 1, sy = p.stretch < 0 ? 1 - p.stretch / 100 : 1;
    const bw = base * sx, bh = base * sy, cx = p.cx * W, cy = p.cy * H;
    return { cx, cy, s: fitShape(p.shape, { x: -bw / 2, y: -bh / 2, w: bw, h: bh }) };
  };
  const pathTo = (x, scale = 1) => {
    const g = geom();
    x.save(); x.scale(scale, scale); x.translate(g.cx, g.cy); x.rotate(p.rot * Math.PI / 180);
    tracePath(x, g.s); x.restore();
  };
  const paint = () => {
    const x = pv.getContext("2d");
    x.clearRect(0, 0, pv.width, pv.height);
    x.globalAlpha = .28; x.drawImage(src, 0, 0, pv.width, pv.height); x.globalAlpha = 1;
    x.save(); pathTo(x, k); x.clip(); x.drawImage(src, 0, 0, pv.width, pv.height); x.restore();
    pathTo(x, k); x.strokeStyle = "#e8a33d"; x.lineWidth = 1.5; x.stroke();
  };
  let drag = null;
  pv.addEventListener("pointerdown", e => { pv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, cx: p.cx, cy: p.cy }; });
  pv.addEventListener("pointermove", e => { if(!drag) return; const r = pv.getBoundingClientRect(); p.cx = clamp(drag.cx + (e.clientX - drag.x) / r.width, 0, 1); p.cy = clamp(drag.cy + (e.clientY - drag.y) / r.height, 0, 1); paint(); });
  pv.addEventListener("pointerup", () => { drag = null; });
  pv.addEventListener("wheel", e => { e.preventDefault(); p.size = clamp(Math.round(p.size * Math.exp(-e.deltaY * .0012)), 10, 200); sizeSlider.querySelector("input").value = p.size; sizeSlider.querySelector("input").dispatchEvent(new Event("input")); }, { passive: false });
  const grid = el(`<div class="shape-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:5px;margin-bottom:8px"></div>`);
  for(const [id, name] of SHAPE_LIST){
    const b = el(`<button type="button" title="${name}" aria-label="${name}" data-s="${id}" style="height:38px;padding:0;display:grid;place-items:center">${shapeSvg(id, 22)}</button>`);
    b.querySelector("svg").style.cssText = "width:22px;height:22px;fill:currentColor";
    b.addEventListener("click", () => { p.shape = id; grid.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); paint(); });
    grid.appendChild(b);
  }
  grid.querySelector(`[data-s="${p.shape}"]`).classList.add("on");
  const sizeSlider = slider("Tamaño", 10, 200, p.size, v => { p.size = v; paint(); }, "%");
  const ck = el(`<label class="chk"><input type="checkbox" checked> Ajustar el lienzo a la forma (sin márgenes vacíos)</label>`);
  ck.querySelector("input").addEventListener("change", e => { p.crop = e.target.checked; });
  const color = el(`<div class="field"><label>Color del contorno</label><input type="color" value="${p.outlineColor}"></div>`);
  color.querySelector("input").addEventListener("input", e => { p.outlineColor = e.target.value; });
  body.append(pv, el(`<p class="hint" style="margin:0 0 8px;text-align:center">Arrastra para colocar la forma; la rueda cambia su tamaño.</p>`), grid,
    sizeSlider,
    slider("Estirar (↔ / ↕)", -100, 100, p.stretch, v => { p.stretch = v; paint(); }, "%"),
    slider("Giro", -180, 180, p.rot, v => { p.rot = v; paint(); }, "°"),
    slider("Borde suave", 0, 100, p.feather, v => { p.feather = v; }, " px"),
    slider("Contorno", 0, 60, p.outline, v => { p.outline = v; }, " px"),
    color, ck);
  paint();
  /* Móvil: deslizadores apilados → desplegable + uno (ui/compact.js). */ autoCompact(body);
  const res = await dialog({ title: "Recortar en forma", body, wide: true,
    buttons: [{ label: "Cancelar", value: null }, { label: "Recortar", primary: true, value: "go" }] });
  if(res !== "go") return;

  // Máscara de la forma a tamaño real (con borde suave si se pide)
  const mask = document.createElement("canvas"); mask.width = W; mask.height = H;
  const mx = mask.getContext("2d");
  mx.fillStyle = "#fff";
  if(p.feather > 0) mx.filter = `blur(${p.feather / 2}px)`;
  pathTo(mx); mx.fill();
  mx.filter = "none";
  // Caja de la forma girada (para ajustar el lienzo)
  const g = geom(), a = p.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const pts = g.s.ellipse
    ? Array.from({ length: 64 }, (_, i) => { const t = i / 64 * Math.PI * 2; return [g.s.box.x + g.s.box.w / 2 + Math.cos(t) * g.s.box.w / 2, g.s.box.y + g.s.box.h / 2 + Math.sin(t) * g.s.box.h / 2]; })
    : g.s.pts;
  const wp = pts.map(([x, y]) => [g.cx + x * co - y * si, g.cy + x * si + y * co]);
  const extra = p.feather + p.outline + 1;
  const bx0 = clamp(Math.floor(Math.min(...wp.map(q => q[0])) - extra), 0, W), by0 = clamp(Math.floor(Math.min(...wp.map(q => q[1])) - extra), 0, H);
  const bx1 = clamp(Math.ceil(Math.max(...wp.map(q => q[0])) + extra), 0, W), by1 = clamp(Math.ceil(Math.max(...wp.map(q => q[1])) + extra), 0, H);

  const before = capture();
  for(const l of doc.layers){
    if(!l.canvas || l.type === "group") continue;
    const c = document.createElement("canvas"); c.width = l.canvas.width; c.height = l.canvas.height;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(l.canvas, 0, 0);
    x.globalCompositeOperation = "destination-in"; x.drawImage(mask, 0, 0);
    l.canvas = c; l.ctx = x; l.thumbDirty = true;
    if(l.type === "shape" && l.shape) l.shape = { ...l.shape };
  }
  if(p.outline > 0){
    const l = addLayer({ name: "Contorno de la forma", above: doc.layers.length });
    const x = l.ctx;
    x.save(); x.lineJoin = "round"; x.strokeStyle = p.outlineColor; x.lineWidth = p.outline * 2;
    pathTo(x); x.stroke();
    x.globalCompositeOperation = "destination-in"; pathTo(x); x.fill();
    x.restore(); l.thumbDirty = true;
  }
  if(p.crop && bx1 - bx0 > 0 && by1 - by0 > 0) cropDoc({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
  const after = capture();
  record(`Recortar en forma: ${(SHAPE_LIST.find(s => s[0] === p.shape) || [0, p.shape])[1]}`, () => restore(before), () => restore(after));
  emit("doc:resize"); emit("doc:structure"); emit("doc:change");
  fitView();
  toast("Imagen recortada en forma · lo de fuera queda transparente (exporta en PNG o WebP)", "ok");
}
