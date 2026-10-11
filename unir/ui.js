/* ═══════════════════════════════════════════════════════════════
   UNIR · VENTANA
   Pantalla completa (js/ui/fsshell.js): unión simple en fila,
   columna o cuadrícula, con separación y fondo. Las panorámicas
   tienen su propio editor en panorama/.
   Escritorio: fotos a la izquierda (se reordenan con ← →), resultado en
   el centro y ajustes a la derecha. Móvil: tira de fotos y un control.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, stateHistory, decodePhoto, pickFiles, scaledCanvas } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

const MAX_PHOTOS = 20;
const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
const WORK_SIDE = TOUCH ? 2400 : 4000;
const PREVIEW_SIDE = TOUCH ? 700 : 1000;
/* Área máxima del resultado: Safari no dibuja lienzos de más de ~16,7 MP. */
const MAX_AREA = TOUCH ? 16e6 : 60e6;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const LAYOUTS = [["row", "Fila"], ["col", "Columna"], ["grid2", "2 columnas"], ["grid3", "3 columnas"], ["grid4", "4 columnas"]];
function layoutSvg(id){
  const r = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`;
  if(id === "row") return `<svg viewBox="0 0 48 48">${r(3, 14, 13, 20)}${r(17.5, 14, 13, 20)}${r(32, 14, 13, 20)}</svg>`;
  if(id === "col") return `<svg viewBox="0 0 48 48">${r(14, 3, 20, 13)}${r(14, 17.5, 20, 13)}${r(14, 32, 20, 13)}</svg>`;
  const c = +id.slice(4), s = (42 - (c - 1) * 2) / c;
  let o = ""; for(let y = 0; y < c; y++) for(let x = 0; x < c; x++) o += r(3 + x * (s + 2), 3 + y * (s + 2), s, s);
  return `<svg viewBox="0 0 48 48">${o}</svg>`;
}

/* ── Unión simple (hilo principal: son sólo drawImage) ── */
function roundRect(x, X, Y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}
export function renderSimple(pics, S, maxArea){
  const n = pics.length; if(!n) return null;
  const gapK = S.gap / 1000, marginK = S.margin / 1000, radK = S.radius / 1000;
  let cells = [], W, H;
  if(S.layout === "row" || S.layout === "col"){
    const row = S.layout === "row";
    const base = S.fit ? Math.min(...pics.map(p => row ? p.height : p.width)) : Math.max(...pics.map(p => row ? p.height : p.width));
    const unit = base, gap = Math.round(unit * gapK), m = Math.round(unit * marginK);
    let pos = m;
    for(const p of pics){
      const k = S.fit ? base / (row ? p.height : p.width) : 1;
      const w = Math.round(p.width * k), h = Math.round(p.height * k);
      const cross = row ? h : w, off = S.align === "start" ? 0 : S.align === "end" ? base - cross : (base - cross) / 2;
      cells.push(row ? { p, x: pos, y: m + off, w, h } : { p, x: m + off, y: pos, w, h });
      pos += (row ? w : h) + gap;
    }
    const along = pos - gap + m;
    W = row ? along : base + 2 * m; H = row ? base + 2 * m : along;
  } else {
    const c = +S.layout.slice(4), rows = Math.ceil(n / c);
    const cw = Math.min(...pics.map(p => p.width));
    const ratio = S.cellRatio === "auto" ? pics.map(p => p.height / p.width).sort((a, b) => a - b)[n >> 1] : +S.cellRatio;
    const ch = Math.round(cw * ratio), gap = Math.round(cw * gapK), m = Math.round(cw * marginK);
    W = c * cw + (c - 1) * gap + 2 * m; H = rows * ch + (rows - 1) * gap + 2 * m;
    pics.forEach((p, i) => cells.push({ p, x: m + (i % c) * (cw + gap), y: m + Math.floor(i / c) * (ch + gap), w: cw, h: ch, cell: true }));
  }
  const k = Math.min(1, Math.sqrt(maxArea / (W * H)));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(W * k)); out.height = Math.max(1, Math.round(H * k));
  const x = out.getContext("2d");
  x.imageSmoothingQuality = "high";
  if(!S.transparent){ x.fillStyle = S.bg; x.fillRect(0, 0, out.width, out.height); }
  for(const c of cells){
    const X = c.x * k, Y = c.y * k, w = c.w * k, h = c.h * k, r = Math.min(w, h) * radK * 5;
    x.save();
    if(r > 0){ roundRect(x, X, Y, w, h, r); x.clip(); }
    if(c.cell){
      // Cuadrícula: la foto llena la celda (recorte) o cabe entera
      const pw = c.p.width, ph = c.p.height;
      const s = S.cellFit === "contain" ? Math.min(w / pw, h / ph) : Math.max(w / pw, h / ph);
      x.drawImage(c.p, X + (w - pw * s) / 2, Y + (h - ph * s) / 2, pw * s, ph * s);
    } else x.drawImage(c.p, X, Y, w, h);
    x.restore();
  }
  return out;
}

export function openMergeEditor({ current = null, onAccept }){
  const photos = [];   // { id, name, full (canvas), proxy (canvas), thumb }
  let seq = 0, usedCurrent = false, closed = false, timer = 0;
  const state = {
    simple: { layout: "row", fit: true, align: "center", gap: 20, margin: 0, radius: 0, bg: "#ffffff", transparent: false, cellRatio: "auto", cellFit: "cover" },
    order: []
  };
  const sh = createShell({
    title: "Unir fotos", subtitle: "Unión en fila, columna o cuadrícula", applyLabel: "Unir fotos",
    onCancel: () => close(), onApply: () => apply(), onUndo: () => hist.undo(), onRedo: () => hist.redo()
  });
  const hist = stateHistory(state, () => {
    Object.assign(Sm, state.simple); state.simple = Sm;
    controls.refresh(); renderPhotos(); schedule();
  }, sh);
  const Sm = state.simple;
  sh.setApplyEnabled(false);

  const ordered = () => state.order.map(id => photos.find(p => p.id === id)).filter(Boolean);
  const empty = () => sh.setEmpty(photos.length ? null :
    `<b>Unir fotos</b><span>Añade dos o más fotos para colocarlas en fila, columna o cuadrícula.</span>
     <button type="button" data-add>Añadir fotos</button>` +
    (current ? `<button type="button" data-cur style="background:#272b31;color:#e9edf4;border-color:#3b414b">Usar la imagen abierta</button>` : ""));
  sh.stage.addEventListener("click", e => { if(e.target.closest("[data-add]")) addPhotos(); else if(e.target.closest("[data-cur]")) addCurrent(); });

  async function addItems(items){
    const room = MAX_PHOTOS - photos.length;
    if(room <= 0){ toast(`Máximo ${MAX_PHOTOS} fotos`, "err"); return; }
    items = items.slice(0, room);
    sh.setBusy("Abriendo fotos…");
    const images = [];
    try{
      for(const it of items){
        const full = it.canvas || await decodePhoto(it.file, WORK_SIDE);
        const id = ++seq, proxy = scaledCanvas(full, PREVIEW_SIDE);
        photos.push({ id, name: it.name, full, proxy, thumb: scaledCanvas(full, 160).toDataURL("image/jpeg", .8) });
        state.order.push(id);
      }
      hist.reset();
    }catch(err){ toast(err.message, "err"); }
    finally{ sh.setBusy(null); }
    afterChange();
  }
  async function addPhotos(){ const files = await pickFiles(); if(files.length) addItems(files.map(f => ({ file: f, name: f.name }))); }
  function addCurrent(){ if(!current || usedCurrent) return; usedCurrent = true; addItems([{ canvas: current.canvas, name: current.name }]); }
  async function removePhoto(id){
    const i = photos.findIndex(p => p.id === id); if(i < 0) return;
    photos.splice(i, 1); state.order = state.order.filter(x => x !== id);
    hist.reset(); afterChange();
  }
  function move(id, d){
    const i = state.order.indexOf(id), j = i + d;
    if(i < 0 || j < 0 || j >= state.order.length) return;
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    hist.commit(); renderPhotos(); schedule();
  }
  function afterChange(){
    sh.setApplyEnabled(photos.length > 0);
    sh.setSubtitle(photos.length ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}` : "Unión en fila, columna o cuadrícula");
    empty(); renderPhotos(); controls.refresh();
    if(!photos.length){ sh.setView(null); return; }
    schedule();
  }

  function photoRow(p, compact){
    const row = document.createElement("div");
    row.className = "fsp-photo";
    const i = state.order.indexOf(p.id);
    row.innerHTML = `<img alt="" src="${p.thumb}"><div><b>${i + 1}. ${esc(p.name)}</b><small>${p.full.width} × ${p.full.height}</small></div>
      <span class="ops">${compact ? `<small class="ev">${i + 1}</small>` : `<button type="button" class="x" data-mv="-1" aria-label="Antes">←</button><button type="button" class="x" data-mv="1" aria-label="Después">→</button>`}<button type="button" class="x" data-rm aria-label="Quitar">✕</button></span>`;
    row.addEventListener("click", e => {
      if(e.target.closest("[data-rm]")) removePhoto(p.id);
      else if(e.target.closest("[data-mv]")) move(p.id, +e.target.closest("[data-mv]").dataset.mv);
    });
    return row;
  }
  function renderPhotos(){
    const L = sh.left; L.innerHTML = "";
    const h = document.createElement("h3"); h.textContent = `Fotos (${photos.length})`; L.appendChild(h);
    const list = document.createElement("div"); list.className = "fsp-photos";
    ordered().forEach(p => list.appendChild(photoRow(p, false)));
    L.appendChild(list);
    const add = document.createElement("button"); add.type = "button"; add.className = "fsp-btn dashed"; add.textContent = "+ Añadir fotos"; add.addEventListener("click", addPhotos); L.appendChild(add);
    if(current && !usedCurrent){ const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn"; b.textContent = "Usar la imagen abierta"; b.addEventListener("click", addCurrent); L.appendChild(b); }
    const n = document.createElement("p"); n.className = "fsp-note";
    n.textContent = "Cambia el orden con ← y →.";
    L.appendChild(n);
  }
  function mobilePhotos(){
    const wrap = document.createElement("div"); wrap.className = "fsp-mphotos";
    ordered().forEach(p => {
      const r = photoRow(p, true);
      // En el móvil, tocar la foto la adelanta un puesto
      r.addEventListener("click", e => { if(!e.target.closest("[data-rm]")) move(p.id, -1); });
      wrap.appendChild(r);
    });
    if(photos.length < MAX_PHOTOS){
      const b = document.createElement("button"); b.type = "button"; b.className = "fsp-photo";
      b.style.cssText = "display:grid;place-items:center;width:68px;height:68px;color:#e9edf4;font-size:22px;background:#272b31;border-style:dashed";
      b.setAttribute("aria-label", "Añadir fotos"); b.textContent = "+"; b.addEventListener("click", addPhotos); wrap.appendChild(b);
    }
    return wrap;
  }

  const sections = [
    { id: "layout", label: "Diseño", props: [
      { key: "s.layout", label: "Diseño", type: "thumbs", options: LAYOUTS, thumb: layoutSvg },
      { key: "s.fit", label: "Igualar tamaños", type: "toggle", when: () => !Sm.layout.startsWith("grid") },
      { key: "s.align", label: "Alineación", type: "seg", options: [["start", "Inicio"], ["center", "Centro"], ["end", "Final"]], when: () => !Sm.layout.startsWith("grid") && !Sm.fit },
      { key: "s.cellRatio", label: "Proporción de las celdas", type: "select", when: () => Sm.layout.startsWith("grid"), options: [["auto", "Como las fotos"], ["1", "Cuadradas 1:1"], ["1.25", "Verticales 4:5"], ["0.75", "Horizontales 4:3"], ["0.5625", "Panorámicas 16:9"], ["1.7778", "Historias 9:16"]] },
      { key: "s.cellFit", label: "Foto en la celda", type: "seg", when: () => Sm.layout.startsWith("grid"), options: [["cover", "Llenar"], ["contain", "Entera"]] }
    ] },
    { id: "style", label: "Separación y fondo", props: [
      { key: "s.gap", label: "Separación", type: "range", min: 0, max: 200, def: 20 },
      { key: "s.margin", label: "Margen exterior", type: "range", min: 0, max: 200, def: 0 },
      { key: "s.radius", label: "Esquinas redondeadas", type: "range", min: 0, max: 100, def: 0 },
      { key: "s.transparent", label: "Fondo transparente", type: "toggle" },
      { key: "s.bg", label: "Color de fondo", type: "color", when: () => !Sm.transparent }
    ] }
  ];
  const get = k => Sm[k.slice(2)];
  const controls = mountControls(sh, {
    sections, get,
    set: (k, v, final) => {
      Sm[k.slice(2)] = v;
      if(final){ hist.commit(); if(["s.layout", "s.fit", "s.transparent"].includes(k)){ controls.refresh(); renderPhotos(); } }
      schedule(final ? 0 : 60);
    },
    mobileExtra: () => mobilePhotos()
  });

  /* ── Vista previa ── */
  function schedule(delay = 0){
    if(!photos.length) return;
    clearTimeout(timer);
    timer = setTimeout(preview, delay);
  }
  function preview(){
    const c = renderSimple(ordered().map(p => p.proxy), Sm, PREVIEW_SIDE * PREVIEW_SIDE * 1.5);
    sh.setView(c, !!sh.view);
  }

  let applying = false;
  async function apply(){
    if(!photos.length || applying) return;
    applying = true; sh.setApplyEnabled(false);
    try{
      let canvas;
      canvas = renderSimple(ordered().map(p => p.full), Sm, MAX_AREA);
      await onAccept(canvas, { count: photos.length });
      close();
    }catch(err){ toast("No se pudo unir: " + err.message, "err"); sh.setBusy(null); sh.setApplyEnabled(true); applying = false; }
  }
  function close(){ if(closed) return; closed = true; sh.close(); }

  empty(); renderPhotos();
  return { close };
}
