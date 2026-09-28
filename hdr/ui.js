/* ═══════════════════════════════════════════════════════════════
   HDR · VENTANA
   Pantalla completa, como el revelador RAW (js/ui/fsshell.js):

     · Escritorio: a la izquierda las fotos (hasta 11) con su
       exposición detectada —editable— y los estilos en miniatura; en
       el centro el resultado; a la derecha todos los ajustes.
     · Móvil: el resultado arriba; abajo la tira de fotos, un
       desplegable de grupo, otro de ajuste y su deslizador. El
       desplegable de estilos abre una hoja de miniaturas.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, stateHistory, decodePhoto, pickFiles, thumbButton } from "../js/ui/fsshell.js";
import { DEFAULTS, METHODS, PRESETS, presetSettings } from "./presets.js";
import { readExposure, exposureText } from "./exif.js";
import { evFromExif } from "./engine.js";
import { toast } from "../js/ui/toast.js";

export const MAX_PHOTOS = 11;
const MOBILE = matchMedia("(max-width:900px)");
const TOUCH = matchMedia("(pointer:coarse)").matches;
/* Tamaño de trabajo: en el móvil, el mismo límite que un documento
   (core/device.js); en el ordenador, 4096 px (11 fotos de 12 MP ya son
   medio giga en memoria). */
const WORK_SIDE = TOUCH || MOBILE.matches ? 2400 : 4096;
const PREVIEW_SIDE = TOUCH || MOBILE.matches ? 900 : 1400;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const evText = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(Math.round(v * 3) / 3).toFixed(Number.isInteger(Math.round(v * 3) / 3) ? 0 : 1) + " EV";

export function openHdrEditor({ current = null, onAccept }){
  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  let req = 0;
  const pending = new Map();
  worker.onmessage = e => {
    const m = e.data || {};
    if(m.type === "progress"){ sh.setBusy(m.msg); return; }
    const p = pending.get(m.req); if(!p) return;
    pending.delete(m.req);
    m.type === "error" ? p.reject(new Error(m.message)) : p.resolve(m);
  };
  worker.onerror = e => { for(const p of pending.values()) p.reject(new Error(e.message || "El motor HDR se ha detenido (posiblemente por falta de memoria).")); pending.clear(); };
  const call = (msg, transfer) => new Promise((resolve, reject) => { const id = ++req; pending.set(id, { resolve, reject }); worker.postMessage({ ...msg, req: id }, transfer || []); });

  const photos = [];   // { name, thumb (dataURL), exif, proxy (canvas para comparar) }
  const state = { s: { ...DEFAULTS, ...presetSettings("realista") }, preset: "realista", evs: [], sel: 0 };
  let evSource = "", size = null, usedCurrent = false, thumbs = new Map(), previewTimer = 0, previewSeq = 0, thumbsSeq = 0, closed = false;

  const sh = createShell({
    title: "Fusión HDR", subtitle: "Hasta 11 fotos de un horquillado", applyLabel: "Crear HDR",
    onCancel: () => close(),
    onApply: () => apply(),
    onUndo: () => hist.undo(),
    onRedo: () => hist.redo()
  });
  const S = state.s;
  // Deshacer sustituye `state.s` por una copia: se vuelca en el mismo
  // objeto para que `S` siga siendo el que usan todos los controles.
  const hist = stateHistory(state, () => { Object.assign(S, state.s); state.s = S; syncEvs(); controls.refresh(); renderPhotos(); schedule(true); }, sh);
  sh.setApplyEnabled(false);

  /* ── Fotos ── */
  const empty = () => sh.setEmpty(photos.length ? null :
    `<b>Fusión HDR</b><span>Añade de 2 a 11 fotos de la misma escena con distinta exposición.<br>La app detecta sola el horquillado (EXIF o brillo) y las alinea.</span>
     <button type="button" data-add>Añadir fotos</button>` +
    (current ? `<button type="button" data-cur style="background:#272b31;color:#e9edf4;border-color:#3b414b">Usar la imagen abierta</button>` : ""));
  sh.stage.addEventListener("click", e => {
    if(e.target.closest("[data-add]")) addPhotos();
    else if(e.target.closest("[data-cur]")) addCurrent();
  });

  async function addFiles(items){
    const room = MAX_PHOTOS - photos.length;
    if(room <= 0){ toast(`Máximo ${MAX_PHOTOS} fotos`, "err"); return; }
    if(items.length > room) toast(`Sólo caben ${room} fotos más (máximo ${MAX_PHOTOS})`, "err");
    items = items.slice(0, room);
    sh.setBusy(`Abriendo ${items.length === 1 ? "la foto" : items.length + " fotos"}…`);
    const images = [], added = [];
    try{
      for(const it of items){
        const canvas = it.canvas || await decodePhoto(it.file, WORK_SIDE);
        const exif = it.exif !== undefined ? it.exif : await readExposure(it.file);
        const data = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
        images.push({ w: canvas.width, h: canvas.height, data: data.buffer, ev: evFromExif(exif) });
        const t = document.createElement("canvas"), k = Math.min(1, 160 / Math.max(canvas.width, canvas.height));
        t.width = Math.round(canvas.width * k); t.height = Math.round(canvas.height * k);
        t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
        const pk = Math.min(1, PREVIEW_SIDE / Math.max(canvas.width, canvas.height)), pc = document.createElement("canvas");
        pc.width = Math.round(canvas.width * pk); pc.height = Math.round(canvas.height * pk);
        pc.getContext("2d").drawImage(canvas, 0, 0, pc.width, pc.height);
        added.push({ name: it.name, thumb: t.toDataURL("image/jpeg", .8), exif, proxy: pc });
      }
      sh.setBusy("Detectando el horquillado y alineando…");
      const r = await call({ type: "add", images, previewSide: PREVIEW_SIDE }, images.map(i => i.data));
      photos.push(...added);
      afterSetup(r);
    }catch(err){ toast(err.message, "err"); }
    finally{ sh.setBusy(null); }
  }
  async function addPhotos(){
    const files = await pickFiles();
    if(files.length) addFiles(files.map(f => ({ file: f, name: f.name })));
  }
  async function addCurrent(){
    if(!current || usedCurrent) return;
    usedCurrent = true;
    const exif = current.file ? await readExposure(current.file) : null;
    addFiles([{ canvas: current.canvas, name: current.name || "Imagen abierta", exif }]);
  }
  async function removePhoto(i){
    try{
      sh.setBusy("Recalculando…");
      const r = await call({ type: "remove", index: i });
      photos.splice(i, 1);
      afterSetup(r);
    }catch(err){ toast(err.message, "err"); }
    finally{ sh.setBusy(null); }
  }
  function afterSetup(r){
    state.evs = r.evs.slice(); evSource = r.source; size = r.w ? [r.w, r.h] : null;
    state.sel = Math.min(state.sel, Math.max(0, photos.length - 1));
    if(S.ghostRef >= photos.length) S.ghostRef = -1;
    hist.reset();
    sh.setApplyEnabled(photos.length > 0);
    sh.setSubtitle(photos.length ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"} · exposición ${evSource}${size ? ` · ${size[0]} × ${size[1]}` : ""}` : "Hasta 11 fotos de un horquillado");
    const shifts = r.shifts || [];
    if(shifts.some(s => s.dx || s.dy)) toast(`Fotos alineadas (desplazamiento máximo ${Math.max(...shifts.map(s => Math.max(Math.abs(s.dx), Math.abs(s.dy))))} px)`);
    empty(); renderPhotos(); controls.refresh();
    thumbs = new Map();
    if(!photos.length){ sh.setView(null); sh.setOriginal(null); return; }
    schedule(true, true);
  }
  async function syncEvs(){ if(photos.length) try{ await call({ type: "setEvs", evs: state.evs }); }catch{} }

  /* Orden visual: de la más oscura a la más clara. */
  const order = () => photos.map((p, i) => i).sort((a, b) => (state.evs[a] ?? 0) - (state.evs[b] ?? 0));
  function photoRow(i, compact){
    const p = photos[i], ev = state.evs[i] ?? 0;
    const row = document.createElement("div");
    row.className = "fsp-photo" + (i === state.sel ? " on" : "");
    row.innerHTML = `<img alt="" src="${p.thumb}"><div><b>${esc(p.name)}</b><small>${evText(ev)}${p.exif ? " · " + esc(exposureText(p.exif)) : ""}</small></div>
      <span class="ops">${compact ? `<small class="ev">${evText(ev)}</small>` : `<button type="button" class="x" data-ev="-1" title="Un tercio de paso menos" aria-label="Menos exposición">−</button><button type="button" class="x" data-ev="1" title="Un tercio de paso más" aria-label="Más exposición">+</button>`}<button type="button" class="x" data-rm aria-label="Quitar ${esc(p.name)}">✕</button></span>`;
    row.addEventListener("click", e => {
      if(e.target.closest("[data-rm]")){ removePhoto(i); return; }
      const d = e.target.closest("[data-ev]");
      if(d){ state.evs[i] = Math.round(((state.evs[i] || 0) + (+d.dataset.ev) / 3) * 3) / 3; hist.commit(); syncEvs().then(() => schedule(true, true)); renderPhotos(); return; }
      state.sel = i; renderPhotos(); controls.renderMobile();
    });
    return row;
  }
  function renderPhotos(){
    const L = sh.left;
    L.innerHTML = "";
    const h = document.createElement("h3"); h.textContent = `Fotos (${photos.length}/${MAX_PHOTOS})`; L.appendChild(h);
    const list = document.createElement("div"); list.className = "fsp-photos";
    for(const i of order()) list.appendChild(photoRow(i, false));
    L.appendChild(list);
    const add = document.createElement("button"); add.type = "button"; add.className = "fsp-btn dashed"; add.textContent = "+ Añadir fotos";
    add.disabled = photos.length >= MAX_PHOTOS; add.addEventListener("click", addPhotos); L.appendChild(add);
    if(current && !usedCurrent){ const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn"; b.textContent = "Usar la imagen abierta"; b.addEventListener("click", addCurrent); L.appendChild(b); }
    if(photos.length){
      const n = document.createElement("p"); n.className = "fsp-note";
      n.textContent = evSource === "exif" ? "Exposición leída del EXIF. Ajústala con − / + si alguna está mal." :
        evSource === "estimada" ? "Sin EXIF de exposición: se ha estimado por el brillo. Corrígela con − / + si hace falta." :
        "Con una sola foto se hace un HDR simulado (mapeo tonal de la propia imagen).";
      L.appendChild(n);
    }
    const hs = document.createElement("h3"); hs.textContent = "Estilos"; L.appendChild(hs);
    const grid = document.createElement("div"); grid.className = "fsp-thumbs";
    for(const [id, label] of PRESETS){
      const b = thumbButton(id, label, v => thumbs.get(v), state.preset === id);
      b.addEventListener("click", () => setPreset(id));
      grid.appendChild(b);
    }
    L.appendChild(grid);
  }
  function mobilePhotos(){
    const wrap = document.createElement("div"); wrap.className = "fsp-mphotos";
    for(const i of order()) wrap.appendChild(photoRow(i, true));
    if(photos.length < MAX_PHOTOS){
      const b = document.createElement("button"); b.type = "button"; b.className = "fsp-photo";
      b.style.cssText = "display:grid;place-items:center;width:56px;height:56px;color:#e9edf4;font-size:22px;background:#272b31;border-style:dashed";
      b.setAttribute("aria-label", "Añadir fotos"); b.textContent = "+"; b.addEventListener("click", addPhotos);
      wrap.appendChild(b);
    }
    return wrap;
  }

  /* ── Ajustes ── */
  function setPreset(id){
    Object.assign(S, presetSettings(id, S));
    state.preset = id;
    hist.commit(); controls.refresh(); renderPhotos(); schedule(false);
  }
  const R = (key, label, min, max, unit = "", def) => ({ key, label, type: "range", min, max, unit, def: def ?? DEFAULTS[key] });
  const is = (...m) => () => m.includes(S.method);
  const sections = [
    { id: "style", label: "Estilo", props: [{ key: "preset", label: "Estilo", type: "thumbs", options: PRESETS.map(p => [p[0], p[1]]), thumb: v => thumbs.get(v) }], when: () => MOBILE.matches },
    { id: "method", label: "Método", props: [{ key: "method", label: "Método de fusión", type: "select", options: METHODS }] },
    { id: "photo", label: "Foto elegida", when: () => MOBILE.matches && photos.length > 0, props: [
      { key: "evSel", label: "Exposición de la foto elegida", type: "range", min: -6, max: 6, step: 1 / 3, fmt: v => evText(v) }
    ] },
    { id: "merge", label: "Fusión de las fotos", props: [
      { key: "align", label: "Alinear las fotos", type: "toggle" },
      { key: "crop", label: "Recortar bordes tras alinear", type: "toggle", when: () => S.align },
      { key: "deghost", label: "Antifantasmas", type: "select", options: [[0, "Desactivado"], [1, "Suave"], [2, "Medio"], [3, "Fuerte"]] },
      { key: "ghostRef", label: "Foto de referencia", type: "select", when: () => S.deghost > 0,
        options: () => [[-1, "Automática (exposición media)"], ...photos.map((p, i) => [i, `${evText(state.evs[i] ?? 0)} · ${p.name}`])] }
    ] },
    { id: "details", label: "Detalles realzados", when: is("details"), props: [
      R("strength", "Fuerza", 0, 100), R("sat", "Saturación del color", 0, 200),
      R("luminosity", "Luminosidad", -100, 100), R("detail", "Contraste de detalle", -100, 100),
      R("smooth", "Suavizado de iluminación", 0, 100), R("micro", "Microsuavizado", 0, 100),
      R("smoothHi", "Suavizar altas luces", 0, 100)
    ] },
    { id: "compressor", label: "Compresor de tonos", when: is("compressor"), props: [
      R("brightness", "Brillo", -100, 100), R("tcontrast", "Compresión de tonos", -100, 100),
      R("whiteCmp", "Punto blanco", 0, 100), R("sat", "Saturación del color", 0, 200)
    ] },
    { id: "drago", label: "Fotográfico", when: is("drago"), props: [
      R("brightness", "Brillo", -100, 100), R("bias", "Contraste", 0, 100), R("sat", "Saturación del color", 0, 200)
    ] },
    { id: "fusion", label: "Fusión de exposición", when: is("fusion"), props: [
      R("wContrast", "Peso del contraste", 0, 200), R("wSat", "Peso de la saturación", 0, 200),
      R("wExpo", "Peso de la exposición", 0, 200), R("expoWidth", "Rango de medios tonos", 0, 100)
    ] },
    { id: "tone", label: "Tono", props: [
      R("exposure", "Exposición", -100, 100), R("contrast", "Contraste", -100, 100),
      R("black", "Punto negro", 0, 100), R("white", "Punto blanco", 0, 100), R("gamma", "Gamma (medios tonos)", -100, 100),
      R("shadows", "Sombras", -100, 100), R("highlights", "Altas luces", -100, 100)
    ] },
    { id: "color", label: "Color", props: [
      R("saturation", "Saturación", -100, 100), R("vibrance", "Intensidad", -100, 100),
      R("satHi", "Saturación en luces", -100, 100), R("satLo", "Saturación en sombras", -100, 100),
      R("temp", "Temperatura", -100, 100), R("tint", "Tinte", -100, 100)
    ] },
    { id: "detail2", label: "Detalle", props: [R("sharpen", "Nitidez", 0, 100)] }
  ];
  const controls = mountControls(sh, {
    sections,
    get: k => k === "preset" ? state.preset : k === "evSel" ? (state.evs[state.sel] ?? 0) : S[k],
    set: (k, v, final) => {
      if(k === "preset"){ setPreset(v); return; }
      if(k === "evSel"){ state.evs[state.sel] = v; if(final){ hist.commit(); syncEvs().then(() => schedule(true, true)); renderPhotos(); } return; }
      S[k] = v;
      const structural = ["align", "crop", "deghost", "ghostRef", "method"].includes(k);
      if(final){ hist.commit(); if(structural) controls.refresh(); }
      schedule(structural && final, structural && final);
    },
    mobileExtra: () => mobilePhotos()
  });

  /* ── Vista previa ── */
  const out = document.createElement("canvas");
  function schedule(merge = false, withThumbs = false){
    if(!photos.length) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const seq = ++previewSeq;
      sh.setBusy(merge ? "Fusionando…" : null);
      try{
        const r = await call({ type: "preview", s: { ...S } });
        if(seq !== previewSeq || closed) return;
        out.width = r.w; out.height = r.h;
        out.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
        const first = !sh.view;
        sh.setView(out, !first);
        const refIdx = order()[(photos.length - 1) >> 1];
        sh.setOriginal(photos[refIdx]?.proxy || null);
      }catch(err){ if(!closed) toast(err.message, "err"); }
      finally{ if(seq === previewSeq) sh.setBusy(null); }
      if(withThumbs || !thumbs.size) makeThumbs();
    }, merge ? 0 : 50);
  }
  async function makeThumbs(){
    const seq = ++thumbsSeq;
    const list = PRESETS.map(([id]) => presetSettings(id, S));
    try{
      const r = await call({ type: "thumbs", list, side: 150 });
      if(seq !== thumbsSeq || closed) return;
      const c = document.createElement("canvas");
      r.list.forEach((t, i) => {
        c.width = t.w; c.height = t.h;
        c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(t.data), t.w, t.h), 0, 0);
        thumbs.set(PRESETS[i][0], c.toDataURL("image/jpeg", .8));
      });
      renderPhotos();
    }catch{}
  }

  /* ── Aplicar / cerrar ── */
  let applying = false;
  async function apply(){
    if(!photos.length || applying) return;
    applying = true;
    sh.setApplyEnabled(false);
    sh.setBusy("Fusionando a resolución completa…");
    try{
      const r = await call({ type: "final", s: { ...S } });
      const c = document.createElement("canvas"); c.width = r.w; c.height = r.h;
      c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      await onAccept(c, { usedCurrent, count: photos.length, style: PRESETS.find(p => p[0] === state.preset)?.[1] || "Personalizado" });
      close();
    }catch(err){
      toast("No se pudo crear el HDR: " + err.message, "err");
      sh.setBusy(null); sh.setApplyEnabled(true); applying = false;
    }
  }
  function close(){
    if(closed) return;
    closed = true;
    worker.terminate();
    sh.close();
  }

  empty(); renderPhotos();
  if(current) sh.setSubtitle("Añade fotos o usa la imagen abierta");
  return { close };
}
