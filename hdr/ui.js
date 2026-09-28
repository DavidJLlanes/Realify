/* ═══════════════════════════════════════════════════════════════
   HDR · VENTANA
   Pantalla completa, como el revelador RAW (js/ui/fsshell.js):

     · Escritorio: a la izquierda las fotos (hasta 11) con su
       exposición detectada y los estilos en miniatura; en el centro el
       resultado; a la derecha los ajustes.
     · Móvil: el resultado arriba; abajo la tira de fotos, un
       desplegable de grupo, otro de ajuste y su deslizador. El
       desplegable de estilos abre una hoja de miniaturas.

   Los grupos van en el orden en que conviene trabajar: primero lo que
   cambia la FUSIÓN (la exposición de cada foto —«Foto elegida»—, la
   alineación y el antifantasmas), después el estilo y el método, y al
   final los retoques de tono, color y detalle. La exposición de una
   foto se ve cambiar en tiempo real mientras se arrastra (ver
   `schedule`, con un borrador más pequeño durante el gesto).
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, stateHistory, decodePhoto, pickFiles, thumbButton } from "../js/ui/fsshell.js";
import { DEFAULTS, METHODS, PRESETS, presetSettings } from "./presets.js";
import { readExposure, exposureText } from "./exif.js";
import { evFromExif } from "./engine.js";
import { toast } from "../js/ui/toast.js";
import { sortable } from "../js/ui/sortable.js";
import { isRaw, developRaws, exifFromRaw, pickOpenPhotos } from "./sources.js";
import { dialog } from "../js/ui/dialog.js";

export const MAX_PHOTOS = 11;
const MOBILE = matchMedia("(max-width:900px)");
const TOUCH = matchMedia("(pointer:coarse)").matches;
/* Tamaño de trabajo: en el móvil, el mismo límite que un documento
   (core/device.js); en el ordenador, 4096 px (11 fotos de 12 MP ya son
   medio giga en memoria). */
const WORK_SIDE = TOUCH || MOBILE.matches ? 2400 : 4096;
const PREVIEW_SIDE = TOUCH || MOBILE.matches ? 900 : 1400;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STEPS = [[1 / 3, "⅓ EV"], [2 / 3, "⅔ EV"], [1, "1 EV"], [4 / 3, "1⅓ EV"], [5 / 3, "1⅔ EV"], [2, "2 EV"], [7 / 3, "2⅓ EV"], [8 / 3, "2⅔ EV"], [3, "3 EV"], [4, "4 EV"]];
/* «+2⅓ EV»: los horquillados van por tercios de paso. */
const evText = v => {
  const n = Math.round(v * 3), a = Math.abs(n), w = Math.floor(a / 3), r = a % 3;
  return (n > 0 ? "+" : n < 0 ? "−" : "±") + (w || !r ? w : "") + (r === 1 ? "⅓" : r === 2 ? "⅔" : "") + " EV";
};

export function openHdrEditor({ openDocs = null, onAccept }){
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
  const state = { s: { ...DEFAULTS, ...presetSettings("realista") }, preset: "realista", evs: [], sel: 0, order: [] };
  let detected = [], hintShown = false;   // EV detectados al añadir las fotos, para «Pasos entre fotos › Los detectados»
  let evSource = "", size = null, thumbs = new Map(), previewTimer = 0, previewSeq = 0, thumbsSeq = 0, closed = false;

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
  const hist = stateHistory(state, () => { Object.assign(S, state.s); state.s = S; controls.refresh(); renderPhotos(); schedule(false, true); }, sh);
  sh.setApplyEnabled(false);

  /* ── Fotos ── */
  const empty = () => sh.setEmpty(photos.length ? null :
    `<b>Fusión HDR</b><span>Añade de 2 a 11 fotos de la misma escena con distinta exposición (JPEG, HEIC, RAW…) o usa las que tienes abiertas.<br>La app detecta sola el horquillado (EXIF o brillo) y las alinea.</span>
     <button type="button" data-add>Añadir fotos</button>` +
    (openCount() ? `<button type="button" data-cur style="background:#272b31;color:#e9edf4;border-color:#3b414b">${openCount() > 1 ? "Usar las fotos abiertas" : "Usar la foto abierta"}</button>` : ""));
  sh.stage.addEventListener("click", e => {
    if(e.target.closest("[data-add]")) addPhotos();
    else if(e.target.closest("[data-cur]")) addOpen();
  });

  async function addFiles(items){
    const room = MAX_PHOTOS - photos.length;
    if(room <= 0){ toast(`Máximo ${MAX_PHOTOS} fotos`, "err"); return; }
    if(items.length > room) toast(`Sólo caben ${room} fotos más (máximo ${MAX_PHOTOS})`, "err");
    items = items.slice(0, room);
    // RAW: revelarlos (o sacar su JPEG) antes de nada; entran ya como lienzos.
    const rawFlags = await Promise.all(items.map(it => it.file ? isRaw(it.file) : false));
    if(rawFlags.some(Boolean)){
      const raws = items.filter((it, k) => rawFlags[k]);
      const dev = await developRaws(raws.map(it => it.file), { fit: fitWork, busy: m => sh.setBusy(m) });
      if(closed) return;
      const byFile = new Map((dev || []).map(d => [d.file, d]));
      items = items.flatMap((it, k) => {
        if(!rawFlags[k]) return [it];
        const d = byFile.get(it.file);
        return d ? [{ canvas: d.canvas, name: it.name, exif: d.exif }] : [];
      });
      if(!items.length) return;
    }
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
    const { RAW_EXTENSIONS } = await import("../raw/formats.js");
    const files = await pickFiles({ accept: "image/*,.heic,.heif,.tif,.tiff," + [...RAW_EXTENSIONS].map(e => "." + e).join(",") });
    if(files.length) addFiles(files.map(f => ({ file: f, name: f.name })));
  }
  /* Fotos abiertas en Realify (pestañas), tal como se están editando. */
  const usedTabs = new Set();
  const openCount = () => openDocs ? openDocs.list().length : 0;
  async function addOpen(){
    if(!openDocs) return;
    const tabs = openDocs.list().map(t => ({ ...t, used: usedTabs.has(t.id) }));
    const ids = await pickOpenPhotos(tabs);
    if(!ids.length || closed) return;
    const got = openDocs.grab(ids);
    const items = [];
    for(const g of got){
      usedTabs.add(g.tabId);
      let exif = g.rawMetadata ? exifFromRaw(g.rawMetadata) : null;
      if(!exif && g.file && !(await isRaw(g.file))) exif = await readExposure(g.file);
      items.push({ canvas: g.canvas, name: g.name, exif: exif || null });
    }
    if(items.length) addFiles(items);
  }
  /* «+» cuando además hay fotos abiertas: de dónde. */
  async function addAny(){
    if(!openCount()) return addPhotos();
    const v = await dialog({ title: "Añadir fotos", body: `<p class="hint" style="margin:0">Desde el dispositivo (JPEG, HEIC, RAW…) o las fotos que tienes abiertas en Realify, tal como las estás editando.</p>`,
      buttons: [{ label: "Cancelar", value: null }, { label: "Fotos abiertas", value: "open" }, { label: "Del dispositivo", primary: true, value: "files" }], cls: "dlg-stack" });
    if(v === "open") addOpen(); else if(v === "files") addPhotos();
  }
  const fitWork = (w, h) => { const k = Math.min(1, WORK_SIDE / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; };
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
    // Como las etiqueta la cámara: respecto a la foto «normal» (la del
    // medio del horquillado), no respecto a la más oscura: −2 / 0 / +2.
    detected = centered(r.evs); state.evs = detected.slice();
    state.order = byEv(detected);
    evSource = r.source; size = r.w ? [r.w, r.h] : null;
    state.sel = Math.min(state.sel, Math.max(0, photos.length - 1));
    if(S.ghostRef >= photos.length) S.ghostRef = -1;
    hist.reset();
    sh.setApplyEnabled(photos.length > 0);
    sh.setSubtitle(photos.length ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"} · exposición ${evSource}${size ? ` · ${size[0]} × ${size[1]}` : ""}` : "Hasta 11 fotos de un horquillado");
    const shifts = r.shifts || [];
    if(shifts.some(s => s.dx || s.dy)) toast(`Fotos alineadas (desplazamiento máximo ${Math.max(...shifts.map(s => Math.max(Math.abs(s.dx), Math.abs(s.dy))))} px)`);
    empty(); renderPhotos(); controls.refresh();
    // Nada más cargar el horquillado, lo primero es revisar su exposición.
    if(photos.length > 1){
      controls.select("photo", "evSel");
      if(MOBILE.matches && !hintShown){ hintShown = true; toast("Mantén pulsada una foto y arrástrala para cambiarla de sitio"); }
    }
    thumbs = new Map();
    if(!photos.length){ sh.setView(null); sh.setOriginal(null); return; }
    schedule(true, true);
  }
  const round3 = v => Math.round(v * 3) / 3;
  /* Índices de las fotos de la más oscura a la más clara (a igualdad, en el orden en que se añadieron). */
  const byEv = evs => evs.map((v, i) => i).sort((a, b) => evs[a] - evs[b] || a - b);
  /* EV respecto a la foto del medio (la mediana): 0 = exposición normal. */
  function centered(evs){
    if(!evs.length) return [];
    const o = byEv(evs), n = o.length;
    const mid = n % 2 ? evs[o[n >> 1]] : (evs[o[n / 2 - 1]] + evs[o[n / 2]]) / 2;
    return evs.map(v => round3(v - mid));
  }
  /* Orden en pantalla: el que el usuario ha dejado (arrastrando); al
     cargar, de la más oscura a la más clara. Cambiar una exposición NO
     reordena la lista, así la foto elegida no salta de sitio. */
  const order = () => state.order.length === photos.length ? state.order : byEv(state.evs);

  /* Exposición de una foto. `final` = fin del gesto (entra en el
     historial); mientras tanto sólo se actualizan los rótulos y la vista
     (borrador), sin rehacer la lista. */
  function setEv(i, v, final){
    state.evs[i] = round3(v);
    for(const el of document.querySelectorAll(`[data-evlabel="${i}"]`)) el.textContent = evText(state.evs[i]);
    if(final){ hist.commit(); renderPhotos(); controls.refresh(); schedule(false, true); }
    else schedule(false, false, true);
  }
  /* Pasos iguales en el orden de la lista, centrados en la foto del medio. */
  const stepEv = (k, n, step) => round3((k - (n - 1) / 2) * step);
  function setSteps(step){
    if(!photos.length) return;
    if(step === 0){ state.evs = detected.slice(); state.order = byEv(detected); }
    else { const o = order(); o.forEach((i, k) => { state.evs[i] = stepEv(k, o.length, step); }); }
    hist.commit(); renderPhotos(); controls.refresh(); schedule(false, true);
  }
  /* Qué opción de «Pasos entre fotos» describe las exposiciones actuales. */
  function currentStep(){
    if(state.evs.every((v, i) => Math.abs(v - (detected[i] ?? 0)) < 1e-6)) return 0;
    const o = order();
    for(const [st] of STEPS) if(o.every((i, k) => Math.abs(state.evs[i] - stepEv(k, o.length, st)) < 1e-6)) return st;
    return -1;
  }
  /* Arrastrar una foto a otra posición: la lista es el orden de
     exposición, de la más oscura a la más clara, así que los valores de
     EV se quedan en su sitio y pasan a la foto que ahora ocupa cada
     posición. Sirve para corregir un horquillado mal ordenado. */
  function movePhoto(from, to){
    const o = order().slice(), vals = o.map(i => state.evs[i]).sort((a, b) => a - b);
    const [i] = o.splice(from, 1); o.splice(to, 0, i);
    state.order = o;
    o.forEach((j, k) => { state.evs[j] = vals[k]; });
    state.sel = i;
    hist.commit(); renderPhotos(); controls.refresh(); schedule(false, true);
  }

  function photoRow(i, compact){
    const p = photos[i], ev = state.evs[i] ?? 0;
    const row = document.createElement("div");
    row.className = "fsp-photo" + (i === state.sel ? " on" : "");
    row.dataset.sort = i;
    row.innerHTML = `<img alt="" src="${p.thumb}"><div><b>${esc(p.name)}</b><small><span data-evlabel="${i}">${evText(ev)}</span>${p.exif ? " · " + esc(exposureText(p.exif)) : ""}</small></div>
      <span class="ops">${compact ? `<small class="ev" data-evlabel="${i}">${evText(ev)}</small>` : `<button type="button" class="x" data-ev="-1" title="Un tercio de paso menos" aria-label="Menos exposición">−</button><button type="button" class="x" data-ev="1" title="Un tercio de paso más" aria-label="Más exposición">+</button>`}<button type="button" class="x" data-rm aria-label="Quitar ${esc(p.name)}">✕</button></span>`;
    row.addEventListener("click", e => {
      if(e.target.closest("[data-rm]")){ removePhoto(i); return; }
      const d = e.target.closest("[data-ev]");
      if(d){ state.sel = i; setEv(i, (state.evs[i] || 0) + (+d.dataset.ev) / 3, true); return; }
      if(state.sel === i) return;
      state.sel = i; renderPhotos(); controls.refresh();
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
    if(photos.length > 1) sortable(list, { axis: "y", onMove: movePhoto });
    const add = document.createElement("button"); add.type = "button"; add.className = "fsp-btn dashed"; add.textContent = "+ Añadir fotos";
    add.disabled = photos.length >= MAX_PHOTOS; add.addEventListener("click", addPhotos); L.appendChild(add);
    if(openCount() && photos.length < MAX_PHOTOS){ const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn"; b.textContent = openCount() > 1 ? "Usar fotos abiertas…" : "Usar la foto abierta"; b.addEventListener("click", addOpen); L.appendChild(b); }
    if(photos.length){
      const n = document.createElement("p"); n.className = "fsp-note";
      n.textContent = (photos.length > 1 ? "Arrastra las fotos para ordenarlas de la más oscura a la más clara: la exposición sigue al orden. " : "") + (evSource === "exif" ? "Exposición leída del EXIF. Si alguna está mal, elígela y corrígela en «Foto elegida» (o con − / +)." :
        evSource === "estimada" ? "Sin EXIF de exposición: estimada por el brillo. Si sabes los pasos del horquillado, elígelos en «Foto elegida › Pasos entre fotos»; o corrige cada foto." :
        "Con una sola foto se hace un HDR simulado (mapeo tonal de la propia imagen).");
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
    if(photos.length > 1) sortable(wrap, { axis: "x", onMove: movePhoto });
    if(photos.length < MAX_PHOTOS){
      const b = document.createElement("button"); b.type = "button"; b.className = "fsp-photo";
      b.style.cssText = "display:grid;place-items:center;width:68px;height:68px;color:#e9edf4;font-size:22px;background:#272b31;border-style:dashed";
      b.setAttribute("aria-label", "Añadir fotos"); b.textContent = "+"; b.addEventListener("click", addAny);
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
  const selInfo = () => {
    const p = photos[state.sel], d = document.createElement("div");
    d.className = "fsp-photo on"; d.style.cursor = "default";
    if(p) d.innerHTML = `<img alt="" src="${p.thumb}"><div><b>${esc(p.name)}</b><small>Detectada: ${evText(detected[state.sel] ?? 0)}${p.exif ? " · " + esc(exposureText(p.exif)) : ""}</small></div>`;
    return d;
  };
  const sections = [
    // 1. Lo que cambia la fusión: exposición de cada foto, alineación, fantasmas.
    { id: "photo", label: "Foto elegida", when: () => photos.length > 1,
      note: () => MOBILE.matches ? "" : "Elige la foto en la lista de la izquierda. La vista cambia mientras arrastras.",
      props: [
        { key: "selInfo", type: "custom", render: () => selInfo(), when: () => !MOBILE.matches },
        { key: "evSel", label: "Exposición (EV)", type: "range", min: -4, max: 12, step: 1 / 3, fmt: v => evText(v), buttons: true },
        { key: "evStep", label: "Pasos entre fotos", type: "select",
          options: () => [[0, "Los detectados"], ...(currentStep() === -1 ? [[-1, "Personalizados"]] : []), ...STEPS] }
      ] },
    { id: "merge", label: "Fusión de las fotos", props: [
      { key: "align", label: "Alinear las fotos", type: "toggle" },
      { key: "crop", label: "Recortar bordes tras alinear", type: "toggle", when: () => S.align },
      { key: "deghost", label: "Antifantasmas", type: "select", options: [[0, "Desactivado"], [1, "Suave"], [2, "Medio"], [3, "Fuerte"]] },
      { key: "ghostRef", label: "Foto de referencia", type: "select", when: () => S.deghost > 0,
        options: () => [[-1, "Automática (exposición media)"], ...photos.map((p, i) => [i, `${evText(state.evs[i] ?? 0)} · ${p.name}`])] }
    ] },
    // 2. El aspecto general: estilo (en escritorio, miniaturas a la izquierda) y método.
    { id: "style", label: "Estilo", props: [{ key: "preset", label: "Estilo", type: "thumbs", options: PRESETS.map(p => [p[0], p[1]]), thumb: v => thumbs.get(v) }], when: () => MOBILE.matches },
    { id: "method", label: "Método", props: [{ key: "method", label: "Método de fusión", type: "select", options: METHODS }] },
    // 3. Los mandos del método y los retoques finales.
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
    get: k => k === "preset" ? state.preset : k === "evSel" ? (state.evs[state.sel] ?? 0) : k === "evStep" ? currentStep() : S[k],
    set: (k, v, final) => {
      if(k === "preset"){ setPreset(v); return; }
      if(k === "evSel"){ setEv(state.sel, v, final); return; }
      if(k === "evStep"){ if(v !== -1) setSteps(v); return; }
      S[k] = v;
      const structural = ["align", "crop", "deghost", "ghostRef", "method"].includes(k);
      if(final){ hist.commit(); if(structural) controls.refresh(); }
      schedule(structural && final, structural && final);
    },
    mobileExtra: () => mobilePhotos()
  });

  /* ── Vista previa ── */
  const out = document.createElement("canvas");
  /* Una sola vista previa en marcha: si llegan cambios mientras
     tanto, al terminar se calcula la última (no una cola de todas). */
  let running = false, pendingRun = null;
  function schedule(merge = false, withThumbs = false, draft = false){
    if(!photos.length) return;
    clearTimeout(previewTimer);
    const job = { merge, withThumbs: withThumbs || (pendingRun?.withThumbs ?? false), draft };
    previewTimer = setTimeout(() => run(job), merge || draft ? 0 : 50);
  }
  async function run(job){
    if(running){ pendingRun = job; return; }
    running = true;
    const seq = ++previewSeq;
    if(job.merge) sh.setBusy("Fusionando…");
    try{
      const r = await call({ type: "preview", s: { ...S }, evs: state.evs.slice(), draft: job.draft });
      if(!closed && !(pendingRun && !pendingRun.draft && job.draft)){
        out.width = r.w; out.height = r.h;
        out.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
        const first = !sh.view;
        sh.setView(out, !first);
        const refIdx = byEv(state.evs)[(photos.length - 1) >> 1];
        sh.setOriginal(photos[refIdx]?.proxy || null);
      }
    }catch(err){ if(!closed) toast(err.message, "err"); }
    finally{ if(seq === previewSeq) sh.setBusy(null); running = false; }
    if(closed) return;
    if(pendingRun){ const j = pendingRun; pendingRun = null; run(j); return; }
    if(!job.draft && (job.withThumbs || !thumbs.size)) makeThumbs();
  }
  async function makeThumbs(){
    const seq = ++thumbsSeq;
    const list = PRESETS.map(([id]) => presetSettings(id, S));
    try{
      const r = await call({ type: "thumbs", list, side: 150, evs: state.evs.slice() });
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
      const r = await call({ type: "final", s: { ...S }, evs: state.evs.slice() });
      const c = document.createElement("canvas"); c.width = r.w; c.height = r.h;
      c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      await onAccept(c, { count: photos.length, style: PRESETS.find(p => p[0] === state.preset)?.[1] || "Personalizado" });
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
  if(openCount()) sh.setSubtitle(openCount() > 1 ? "Añade fotos o usa las que tienes abiertas" : "Añade fotos o usa la que tienes abierta");
  return { close };
}
