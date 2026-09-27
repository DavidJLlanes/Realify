/* ═══════════════════════════════════════════════════════════════
   IMAGEN › DIVIDIR EN TROZOS  ·  IMAGEN › RECORTAR EN FORMA

   Dividir en trozos: corta la imagen (todas las capas combinadas) en
   una cuadrícula de filas × columnas, en trozos de un tamaño fijo, en
   un carrusel panorámico (varias publicaciones seguidas que forman
   una sola imagen al deslizar) o en la cuadrícula del perfil de
   Instagram (3 columnas, numeradas en el orden en que hay que
   subirlas). Los trozos se guardan en un ZIP, como archivos sueltos o
   como capas del propio documento.

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

/* ════════════════ Dividir en trozos ════════════════ */
const RATIOS = [["1:1", 1], ["4:5", .8], ["3:4", .75], ["9:16", .5625], ["16:9", 16 / 9], ["2:3", 2 / 3]];

/* Rectángulos de los trozos (en píxeles del documento), por filas, y
   el rectángulo del documento que se usa (los modos con proporción
   fija recortan lo que sobra, centrado). */
function slicePlan(p, W, H){
  let area = { x: 0, y: 0, w: W, h: H }, rows = 1, cols = 1;
  if(p.mode === "grid"){ rows = p.rows; cols = p.cols; }
  else if(p.mode === "size"){ cols = Math.max(1, Math.ceil(W / p.tileW)); rows = Math.max(1, Math.ceil(H / p.tileH)); }
  else if(p.mode === "carousel" || p.mode === "instagram"){
    const r = p.mode === "instagram" ? (p.igRatio === "3:4" ? .75 : 1) : (RATIOS.find(x => x[0] === p.ratio) || RATIOS[0])[1];
    cols = p.mode === "instagram" ? 3 : p.pieces; rows = p.mode === "instagram" ? p.igRows : 1;
    const target = cols * r / rows;                  // proporción total ancho / alto
    if(W / H > target){ const w = H * target; area = { x: (W - w) / 2, y: 0, w, h: H }; }
    else { const h = W / target; area = { x: 0, y: (H - h) / 2, w: W, h }; }
  }
  const out = [];
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
    let x0, y0, x1, y1;
    if(p.mode === "size"){ x0 = c * p.tileW; y0 = r * p.tileH; x1 = Math.min(W, x0 + p.tileW); y1 = Math.min(H, y0 + p.tileH); }
    else { x0 = area.x + area.w * c / cols; x1 = area.x + area.w * (c + 1) / cols; y0 = area.y + area.h * r / rows; y1 = area.y + area.h * (r + 1) / rows; }
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    out.push({ r, c, x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) });
  }
  return { rects: out, rows, cols, area };
}

export async function sliceImage(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const W = doc.w, H = doc.h;
  const p = { mode: "grid", rows: 2, cols: 2, tileW: Math.round(W / 2), tileH: Math.round(H / 2), pieces: 3, ratio: "4:5",
              igRows: 3, igRatio: "1:1", format: "png", quality: 92, output: "zip", prefix: (doc.name || "imagen").replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "imagen" };
  const src = flatten();
  const body = document.createElement("div");
  // Vista previa con las líneas de corte
  const pv = document.createElement("canvas");
  const k = Math.min(1, 460 / Math.max(W, H));
  pv.width = Math.max(1, Math.round(W * k)); pv.height = Math.max(1, Math.round(H * k));
  pv.style.cssText = "display:block;margin:0 auto 10px;max-width:100%;height:auto;max-height:260px;border-radius:var(--r);background:var(--s-900)";
  const info = el(`<p class="hint" style="margin:0 0 8px;text-align:center"></p>`);
  const paint = () => {
    const x = pv.getContext("2d"), plan = slicePlan(p, W, H);
    x.clearRect(0, 0, pv.width, pv.height);
    x.drawImage(src, 0, 0, pv.width, pv.height);
    // Lo que se descarta (modos con proporción fija), oscurecido
    x.fillStyle = "rgba(0,0,0,.6)";
    const a = plan.area;
    x.fillRect(0, 0, pv.width, a.y * k); x.fillRect(0, (a.y + a.h) * k, pv.width, pv.height - (a.y + a.h) * k);
    x.fillRect(0, a.y * k, a.x * k, a.h * k); x.fillRect((a.x + a.w) * k, a.y * k, pv.width - (a.x + a.w) * k, a.h * k);
    x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = 1.5; x.setLineDash([5, 4]);
    x.font = "600 12px system-ui"; x.textAlign = "center"; x.textBaseline = "middle";
    plan.rects.forEach((q, i) => {
      x.strokeRect(q.x * k + .5, q.y * k + .5, q.w * k - 1, q.h * k - 1);
      const n = order(p, plan, i) + 1;
      x.fillStyle = "rgba(10,12,16,.7)"; x.beginPath(); x.arc((q.x + q.w / 2) * k, (q.y + q.h / 2) * k, 11, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.fillText(String(n), (q.x + q.w / 2) * k, (q.y + q.h / 2) * k + .5);
    });
    x.setLineDash([]);
    const q = plan.rects[0];
    info.textContent = `${plan.rects.length} trozos · ${q.w} × ${q.h} px${p.mode === "instagram" ? " · numerados en el orden de subida (el 1 primero)" : ""}`;
  };
  const opts = document.createElement("div");
  const renderOpts = () => {
    opts.innerHTML = "";
    if(p.mode === "grid") opts.append(numberRow("Filas", p.rows, 1, 30, v => { p.rows = v; paint(); }), numberRow("Columnas", p.cols, 1, 30, v => { p.cols = v; paint(); }));
    else if(p.mode === "size") opts.append(numberRow("Ancho del trozo", p.tileW, 16, W, v => { p.tileW = v; paint(); }, "px"), numberRow("Alto del trozo", p.tileH, 16, H, v => { p.tileH = v; paint(); }, "px"));
    else if(p.mode === "carousel") opts.append(numberRow("Publicaciones", p.pieces, 2, 10, v => { p.pieces = v; paint(); }), selectRow("Proporción de cada una", p.ratio, RATIOS.map(r => [r[0], r[0]]), v => { p.ratio = v; paint(); }));
    else opts.append(numberRow("Filas del perfil", p.igRows, 1, 6, v => { p.igRows = v; paint(); }), selectRow("Proporción", p.igRatio, [["1:1", "Cuadrada 1:1"], ["3:4", "Vertical 3:4 (perfil actual)"]], v => { p.igRatio = v; paint(); }));
  };
  const modes = el(`<div class="seg" style="margin-bottom:8px">
    <button type="button" data-m="grid">Filas × columnas</button><button type="button" data-m="size">Tamaño fijo</button>
    <button type="button" data-m="carousel">Carrusel</button><button type="button" data-m="instagram">Perfil de Instagram</button></div>`);
  const syncModes = () => modes.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === p.mode));
  modes.addEventListener("click", e => { const b = e.target.closest("[data-m]"); if(!b) return; p.mode = b.dataset.m; syncModes(); renderOpts(); paint(); });
  const out = document.createElement("div");
  out.append(
    selectRow("Guardar como", p.output, [["zip", "Un archivo ZIP"], ["files", "Archivos sueltos"], ["layers", "Capas en este documento"]], v => { p.output = v; }),
    selectRow("Formato", p.format, [["png", "PNG (sin pérdida)"], ["jpeg", "JPEG"], ["webp", "WebP"]], v => { p.format = v; }),
    slider("Calidad (JPEG / WebP)", 40, 100, p.quality, v => { p.quality = v; }, "%"));
  const name = el(`<div class="field"><label>Nombre</label><input type="text" class="grow" maxlength="60"></div>`);
  name.querySelector("input").value = p.prefix;
  name.querySelector("input").addEventListener("input", e => { p.prefix = e.target.value.trim() || "imagen"; });
  body.append(pv, info, modes, opts, out, name);
  syncModes(); renderOpts(); paint();
  const res = await dialog({ title: "Dividir en trozos", body, wide: true,
    buttons: [{ label: "Cancelar", value: null }, { label: "Dividir", primary: true, value: "go" }] });
  if(res !== "go") return;

  const plan = slicePlan(p, W, H);
  const pieces = plan.rects.map((q, i) => ({ ...q, n: order(p, plan, i) + 1 })).sort((a, b) => a.n - b.n);
  if(p.output === "layers"){
    recordLayers("Dividir en trozos", () => {
      for(const q of pieces){
        const l = addLayer({ name: `Trozo ${q.n} (${q.r + 1}-${q.c + 1})`, above: doc.layers.length });
        l.ctx.drawImage(src, q.x, q.y, q.w, q.h, q.x, q.y, q.w, q.h);
        l.thumbDirty = true;
      }
      emit("doc:structure"); emit("doc:change");
    });
    toast(`${pieces.length} trozos añadidos como capas`, "ok");
    return;
  }
  const mime = p.format === "png" ? "image/png" : p.format === "jpeg" ? "image/jpeg" : "image/webp";
  const ext = p.format === "jpeg" ? "jpg" : p.format;
  const pad = String(pieces.length).length;
  const entries = [];
  toast("Preparando los trozos…");
  for(const q of pieces){
    const c = document.createElement("canvas"); c.width = q.w; c.height = q.h;
    const x = c.getContext("2d");
    if(p.format === "jpeg"){ x.fillStyle = "#fff"; x.fillRect(0, 0, q.w, q.h); }
    x.drawImage(src, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
    const blob = await new Promise(r => c.toBlob(r, mime, p.quality / 100));
    entries.push({ name: `${p.prefix}_${String(q.n).padStart(pad, "0")}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()), blob });
  }
  const { download, saveOrShare, stamp } = await import("../io/export.js");
  if(p.output === "files"){
    for(const e of entries){ download(e.blob, e.name); await new Promise(r => setTimeout(r, 180)); }
  } else {
    const { buildZip } = await import("../io/zip.js");
    await saveOrShare(buildZip(entries), `${p.prefix}-trozos-${stamp()}.zip`);
  }
  toast(`${entries.length} trozos guardados`, "ok");
}
/* Número de cada trozo: por filas; en el perfil de Instagram, en el
   orden de SUBIDA (la última publicación queda arriba a la izquierda,
   así que se sube primero la de abajo a la derecha). */
function order(p, plan, i){
  return p.mode === "instagram" ? plan.rects.length - 1 - i : i;
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
