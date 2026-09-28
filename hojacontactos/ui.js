/* ═══════════════════════════════════════════════════════════════
   HOJA DE CONTACTOS · VENTANA
   Pantalla completa (js/ui/fsshell.js). Coloca muchas fotos en páginas
   de papel (A4, A3, A5, Carta, 10 × 15…) en una cuadrícula con margen,
   separación, título y pie con el nombre del archivo. Se ve página a
   página y se guarda como PDF de varias páginas o como capas.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, stateHistory, decodePhoto, pickFiles, scaledCanvas } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

const PAGES = { a4: [210, 297], a3: [297, 420], a5: [148, 210], letter: [215.9, 279.4], legal: [215.9, 355.6], p10x15: [100, 150], p13x18: [130, 180] };
const PAGE_OPTS = [["a4", "A4"], ["a3", "A3"], ["a5", "A5"], ["letter", "Carta"], ["legal", "Oficio"], ["p10x15", "Foto 10 × 15"], ["p13x18", "Foto 13 × 18"]];
const MAX_PHOTOS = 200;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Páginas como lienzos a `dpi`. */
export function renderPages(photos, S, dpi, onlyPage = -1){
  let [mw, mh] = PAGES[S.page];
  if(S.orient === "landscape" || (S.orient === "auto" && photos.length && photos.filter(p => p.w > p.h).length > photos.length / 2)) [mw, mh] = [mh, mw];
  const px = mm => mm / 25.4 * dpi;
  const W = Math.round(px(mw)), H = Math.round(px(mh)), M = px(S.margin), G = px(S.gap);
  const titleH = S.title ? px(S.titleSize * 1.9) : 0;
  const capH = S.captions ? px(S.capSize * 1.6) : 0;
  const cols = S.cols, cellW = (W - 2 * M - (cols - 1) * G) / cols;
  const imgH = cellW * S.cellRatio;
  const cellH = imgH + capH;
  const rows = Math.max(1, Math.floor((H - 2 * M - titleH + G) / (cellH + G)));
  const perPage = rows * cols, pages = Math.max(1, Math.ceil(photos.length / perPage));
  const out = [];
  for(let pg = 0; pg < pages; pg++){
    if(onlyPage >= 0 && pg !== onlyPage){ out.push(null); continue; }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
    x.fillStyle = S.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = S.text; x.textBaseline = "middle";
    if(S.title){
      x.font = `700 ${px(S.titleSize)}px system-ui, sans-serif`; x.textAlign = "left";
      x.fillText(S.title, M, M + titleH / 2 - px(S.titleSize * .2));
      x.font = `500 ${px(S.titleSize * .6)}px system-ui, sans-serif`; x.textAlign = "right"; x.globalAlpha = .6;
      x.fillText(`${pg + 1} / ${pages}`, W - M, M + titleH / 2 - px(S.titleSize * .2)); x.globalAlpha = 1;
    }
    const slice = photos.slice(pg * perPage, (pg + 1) * perPage);
    slice.forEach((p, i) => {
      const cx = M + (i % cols) * (cellW + G), cy = M + titleH + Math.floor(i / cols) * (cellH + G);
      const img = p.canvas;
      if(S.fit === "cover"){
        const k = Math.max(cellW / img.width, imgH / img.height), sw = cellW / k, sh = imgH / k;
        x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, cx, cy, cellW, imgH);
      } else {
        const k = Math.min(cellW / img.width, imgH / img.height), w = img.width * k, h = img.height * k;
        x.drawImage(img, cx + (cellW - w) / 2, cy + (imgH - h) / 2, w, h);
      }
      if(S.border > 0){ x.strokeStyle = S.text; x.globalAlpha = .35; x.lineWidth = px(S.border / 10); x.strokeRect(cx, cy, cellW, imgH); x.globalAlpha = 1; }
      if(S.captions){
        x.font = `500 ${px(S.capSize)}px system-ui, sans-serif`; x.textAlign = "center"; x.fillStyle = S.text;
        let t = S.numbers ? `${pg * perPage + i + 1}. ${p.name}` : p.name;
        while(t.length > 3 && x.measureText(t).width > cellW) t = t.slice(0, -2);
        if(t !== (S.numbers ? `${pg * perPage + i + 1}. ${p.name}` : p.name)) t = t.slice(0, -1) + "…";
        x.fillText(t, cx + cellW / 2, cy + imgH + capH / 2);
      }
    });
    out.push(c);
  }
  return { pages: out, count: pages, perPage };
}

export function openContactSheet({ onAccept }){
  const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
  const photos = [];   // { name, canvas (≤1600 px), w, h, thumb }
  let closed = false, pageIdx = 0;
  const state = { s: { page: "a4", orient: "auto", cols: 4, cellRatio: .75, fit: "contain", margin: 12, gap: 4, bg: "#ffffff", text: "#222222",
    title: "Hoja de contactos", titleSize: 6, captions: true, numbers: true, capSize: 2.6, border: 0, output: "pdf", dpi: 200 } };
  const S = state.s;
  const sh = createShell({ title: "Hoja de contactos", subtitle: "Muchas fotos en páginas para imprimir o repasar", applyLabel: "Crear",
    onCancel: () => close(), onApply: () => apply(), onUndo: () => hist.undo(), onRedo: () => hist.redo() });
  const hist = stateHistory(state, () => { Object.assign(S, state.s); state.s = S; controls.refresh(); render(); }, sh);
  sh.setApplyEnabled(false);
  const empty = () => sh.setEmpty(photos.length ? null : `<b>Hoja de contactos</b><span>Añade las fotos (hasta ${MAX_PHOTOS}).</span><button type="button" data-add>Añadir fotos</button>`);
  sh.stage.addEventListener("click", e => { if(e.target.closest("[data-add]")) addPhotos(); });

  async function addPhotos(){
    const files = await pickFiles();
    if(!files.length) return;
    sh.setBusy("Abriendo fotos…");
    for(const f of files.slice(0, MAX_PHOTOS - photos.length)){
      try{
        const c = await decodePhoto(f, 1600);
        photos.push({ name: f.name.replace(/\.[^.]+$/, ""), canvas: c, w: c.width, h: c.height, thumb: scaledCanvas(c, 120).toDataURL("image/jpeg", .75) });
      }catch(err){ toast(err.message, "err"); }
    }
    sh.setBusy(null);
    sh.setApplyEnabled(photos.length > 0);
    empty(); renderLeft(); render();
  }
  function renderLeft(){
    const L = sh.left; L.innerHTML = `<h3>Fotos (${photos.length})</h3>`;
    const list = document.createElement("div"); list.className = "fsp-photos";
    photos.forEach((p, i) => {
      const r = document.createElement("div"); r.className = "fsp-photo";
      r.innerHTML = `<img alt="" src="${p.thumb}"><div><b>${esc(p.name)}</b><small>${p.w} × ${p.h}</small></div><span class="ops"><button type="button" class="x" aria-label="Quitar">✕</button></span>`;
      r.querySelector("button").addEventListener("click", () => { photos.splice(i, 1); sh.setApplyEnabled(photos.length > 0); empty(); renderLeft(); render(); });
      list.appendChild(r);
    });
    L.appendChild(list);
    const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn dashed"; b.textContent = "+ Añadir fotos"; b.addEventListener("click", addPhotos); L.appendChild(b);
  }
  function render(){
    if(!photos.length){ sh.setView(null); return; }
    const info = renderPages(photos, S, 30, -1);
    pageIdx = Math.min(pageIdx, info.count - 1);
    const r = renderPages(photos, S, TOUCH ? 60 : 80, pageIdx);
    sh.setView(r.pages[pageIdx], !!sh.view);
    sh.setSubtitle(`${photos.length} fotos · ${r.count} ${r.count === 1 ? "página" : "páginas"} · ${r.perPage} por página · viendo la ${pageIdx + 1}`);
    controls?.renderMobile?.();
  }
  const sections = [
    { id: "pages", label: "Página", props: [
      { key: "pageNav", label: "Página que se ve", type: "custom", render: () => {
        const w = document.createElement("div"); w.className = "fsp-row2";
        const prev = document.createElement("button"), next = document.createElement("button");
        prev.type = next.type = "button"; prev.className = next.className = "fsp-btn"; prev.textContent = "← Anterior"; next.textContent = "Siguiente →";
        prev.onclick = () => { pageIdx = Math.max(0, pageIdx - 1); render(); };
        next.onclick = () => { pageIdx++; render(); };
        w.append(prev, next); return w;
      } },
      { key: "page", label: "Tamaño del papel", type: "select", options: PAGE_OPTS },
      { key: "orient", label: "Orientación", type: "seg", options: [["auto", "Auto"], ["portrait", "Vertical"], ["landscape", "Horizontal"]] },
      { key: "margin", label: "Margen", type: "range", min: 0, max: 40, unit: " mm", def: 12 }
    ] },
    { id: "grid", label: "Cuadrícula", props: [
      { key: "cols", label: "Columnas", type: "range", min: 1, max: 10, def: 4 },
      { key: "gap", label: "Separación", type: "range", min: 0, max: 20, unit: " mm", def: 4 },
      { key: "cellRatio", label: "Proporción de cada foto", type: "select", options: [[.75, "Horizontal 4:3"], [.6667, "Horizontal 3:2"], [1, "Cuadrada"], [1.333, "Vertical 3:4"], [1.5, "Vertical 2:3"]] },
      { key: "fit", label: "Foto", type: "seg", options: [["contain", "Entera"], ["cover", "Llenar"]] },
      { key: "border", label: "Borde de cada foto", type: "range", min: 0, max: 10, def: 0 }
    ] },
    { id: "text", label: "Textos", props: [
      { key: "title", label: "Título", type: "text" },
      { key: "titleSize", label: "Tamaño del título", type: "range", min: 3, max: 14, unit: " mm", def: 6 },
      { key: "captions", label: "Nombre bajo cada foto", type: "toggle" },
      { key: "numbers", label: "Numerar", type: "toggle", when: () => S.captions },
      { key: "capSize", label: "Tamaño del nombre", type: "range", min: 1.5, max: 6, step: .1, unit: " mm", def: 2.6, when: () => S.captions },
      { key: "bg", label: "Color del papel", type: "color" },
      { key: "text", label: "Color del texto", type: "color" }
    ] },
    { id: "out", label: "Resultado", props: [
      { key: "output", label: "Crear", type: "select", options: [["pdf", "PDF (todas las páginas)"], ["layers", "Cada página en una capa nueva"]] },
      { key: "dpi", label: "Resolución", type: "select", options: [[150, "150 ppp (ligero)"], [200, "200 ppp"], [300, "300 ppp (imprenta)"]] }
    ] }
  ];
  const controls = mountControls(sh, { sections, get: k => S[k],
    set: (k, v, final) => { S[k] = v; if(final){ hist.commit(); if(k === "captions") controls.refresh(); } render(); },
    mobileExtra: () => { const w = document.createElement("div"); w.className = "fsp-mtools"; const b = document.createElement("button"); b.type = "button"; b.textContent = `+ Fotos (${photos.length})`; b.onclick = addPhotos; w.appendChild(b); return w; } });

  async function apply(){
    if(!photos.length) return;
    sh.setBusy("Creando las páginas…");
    await new Promise(r => setTimeout(r, 30));
    try{
      const { pages } = renderPages(photos, S, S.dpi);
      await onAccept(pages, { output: S.output, title: S.title, dpi: S.dpi });
      close();
    }catch(err){ toast("No se pudo crear la hoja: " + err.message, "err"); sh.setBusy(null); }
  }
  function close(){ if(closed) return; closed = true; sh.close(); }
  empty(); renderLeft();
  return { close };
}
