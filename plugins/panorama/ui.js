/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA DESDE FOTOS · INTERFAZ
   Pantalla completa (js/ui/kit/fsshell.js), como «Unir fotos»:
     · Escritorio: fotos a la izquierda (se reordenan con ← →), vista
       previa en el centro y ajustes a la derecha.
     · Móvil: vista previa a pantalla completa, tira de fotos y UN
       control cada vez (grupo → ajuste → deslizador).
   Las fotos se unen EN EL DISPOSITIVO (stitch.js). El análisis lento
   (dónde está cada foto) se hace una vez al pedir la vista previa; las
   opciones de proyección, horizonte, mezcla y recorte sólo repiten el
   paso rápido. Nada sale del dispositivo.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, decodePhoto, pickFiles, scaledCanvas } from "../../js/ui/kit/fsshell.js";
import { toast } from "../../js/core/toast.js";
import { premiumSwitch, premiumPref } from "../../js/ui/kit/premium.js";
import { escText as esc } from "../../js/core/util/html.js";
import { analyzePhotos, renderPanorama, AUTO_ORDER_LIMIT } from "./stitch.js";
import { hasInk } from "./masks.js";
import { openMaskEditor } from "./mask-editor.js";
import { openPointsEditor } from "./points-editor.js";

const MAX_PHOTOS = 25;
const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
const WORK_SIDE = TOUCH ? 2400 : 3000, PROXY_SIDE = TOUCH ? 700 : 1000;
const PREFS_KEY = "realify.panorama.options";
/** Opciones que se recuerdan entre sesiones (las de cada panorámica —horizonte, recorte— no). */
const REMEMBERED = ["projection", "blend", "lens", "exposure", "autoOrder", "autoCrop"];
const PROJECTIONS = [["auto", "Automática"], ["cyl", "Cilíndrica"], ["sph", "Esférica"], ["merc", "Mercator"], ["rect", "Plana (rectilínea)"], ["stereo", "Estereográfica"], ["fish", "Ojo de pez"]];

const loadPrefs = () => { try{ return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; }catch{ return {}; } };
const savePrefs = o => { try{ localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(REMEMBERED.map(k => [k, o[k]])))); }catch{} };

export function openPanoramaEditor({ current = null, onAccept }){
  const photos = [];   // { id, name, file, full, proxy, thumb, excl, keep }
  let order = [], seq = 0, closed = false, applying = false, usedCurrent = false, timer = 0, token = 0;
  let analysis = null;   // { cam, matchH, minHeight, count, key, premium }
  const manual = [];     // puntos de control a mano (ver points-editor.js)
  let rev = 0;           // sube al cambiar máscaras o puntos: invalida el análisis
  const S = { premium: premiumPref.get("panorama") };
  const O = { projection: "auto", blend: "multiband", lens: true, exposure: true, autoOrder: true, autoCrop: true,
              level: false, yaw: 0, pitch: 0, roll: 0, cropL: 0, cropT: 0, cropR: 0, cropB: 0, ...Object.fromEntries(Object.entries(loadPrefs()).filter(([k]) => REMEMBERED.includes(k))) };

  const sh = createShell({ title: "Panorámica desde fotos", subtitle: "Añade tus fotos para unirlas", applyLabel: TOUCH ? "Crear" : "Crear panorámica", cls: "fsp-panorama", onCancel: () => close(), onApply: () => apply() });
  sh.addAction(premiumSwitch({ checked: S.premium, title: "Procesado panorámico Premium", onChange: on => { S.premium = on; premiumPref.set("panorama", on); sh.setClass("is-premium", on); } }));
  sh.setClass("is-premium", S.premium);
  sh.setApplyEnabled(false);

  const ordered = () => order.map(id => photos.find(p => p.id === id)).filter(Boolean);
  const autoOrderOn = () => O.autoOrder && photos.length <= AUTO_ORDER_LIMIT;
  /** Qué hace falta recalcular: las fotos (y su orden sólo si no se ordenan solas), la lente, las máscaras y los puntos. */
  const keyNow = () => [autoOrderOn() ? order.slice().sort((a, b) => a - b).join(",") : order.join(","), O.lens, autoOrderOn(), rev].join("|");
  const stale = () => !analysis || analysis.key !== keyNow();
  /** Fotos en el orden en que se analizaron (los giros de `analysis.cam` van por posición). */
  const analyzed = () => analysis.ids.map(id => photos.find(p => p.id === id)).filter(Boolean);

  /* ── Estado vacío y avisos ── */
  function empty(){
    const n = photos.length;
    sh.setEmpty(!n ? `<b>Panorámica</b><span>Añade 2 o más fotos tomadas girando sobre ti mismo, con un 30–50 % de solape, en cualquier orden. Se unen en tu dispositivo, sin subirlas a ningún servidor.</span><button type="button" data-add>Añadir fotos</button>`
      + (current ? `<button type="button" data-cur style="background:#272b31;color:#e9edf4;border-color:#3b414b">Usar la imagen abierta</button>` : "")
      : n >= 2 && stale() && !sh.view ? `<b>${n} fotos</b><span>Calcula la vista previa para ver cómo se unen, ajustar la proyección y el horizonte, y marcar zonas o puntos si hace falta.</span><button type="button" data-prev>Calcular vista previa</button>` : null);
    subtitle();
  }
  sh.stage.addEventListener("click", e => {
    if(e.target.closest("[data-add]")) addPhotos(); else if(e.target.closest("[data-cur]")) addCurrent(); else if(e.target.closest("[data-prev]")) updatePreview(true);
  });
  sh.stage.addEventListener("dragover", e => e.preventDefault());
  sh.stage.addEventListener("drop", e => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])].filter(f => /image\//i.test(f.type) || /\.(jpe?g|png|webp|avif|heic|tiff?)$/i.test(f.name));
    if(files.length) addItems(files.map(file => ({ file, name: file.name })));
  });
  const orderWarning = () => photos.length > AUTO_ORDER_LIMIT ? `Hay más de ${AUTO_ORDER_LIMIT} fotos: no se ordenan solas. Se respeta el orden de la lista (cámbialo con ← →).` : "";

  /* ── Fotos ── */
  async function addItems(items){
    const room = MAX_PHOTOS - photos.length;
    if(room <= 0){ toast(`Máximo ${MAX_PHOTOS} fotos`, "err"); return; }
    const before = photos.length;
    sh.setBusy("Cargando fotos…");
    try{
      for(const it of items.slice(0, room)){
        const full = it.canvas || await decodePhoto(it.file, WORK_SIDE), id = ++seq;
        photos.push({ id, name: it.name || `Foto ${id}`, file: it.file || null, full, proxy: scaledCanvas(full, PROXY_SIDE), thumb: scaledCanvas(full, 160).toDataURL("image/jpeg", .8), excl: null, keep: null });
        order.push(id);
      }
    }catch(err){ toast("Error al cargar fotos: " + err.message, "err"); }
    finally{ sh.setBusy(null); }
    if(items.length > room) toast(`Sólo caben ${MAX_PHOTOS} fotos`, "err");
    if(before <= AUTO_ORDER_LIMIT && photos.length > AUTO_ORDER_LIMIT) toast(orderWarning(), "err");
    afterChange();
  }
  async function addPhotos(){ const files = await pickFiles({ multiple: true }); if(files.length) addItems(files.map(f => ({ file: f, name: f.name }))); }
  function addCurrent(){ if(!current || usedCurrent) return; usedCurrent = true; addItems([{ canvas: current.canvas, name: current.name }]); }
  function removePhoto(id){
    const i = photos.findIndex(p => p.id === id); if(i < 0) return;
    photos.splice(i, 1); order = order.filter(x => x !== id);
    for(let k = manual.length - 1; k >= 0; k--) if(manual[k].a === id || manual[k].b === id) manual.splice(k, 1);
    afterChange();
  }
  function move(id, d){
    const i = order.indexOf(id), j = i + d;
    if(i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    renderPhotos(); controls.renderMobile(); empty(); schedule();
  }
  function subtitle(){
    const n = photos.length, pending = n >= 2 && sh.view && stale() ? " · cambios sin calcular (Calcular vista previa)" : "";
    sh.setSubtitle(n ? `${n} ${n === 1 ? "foto" : "fotos"}${orderWarning() ? " · sin orden automático" : ""}${pending}` : "Añade tus fotos para unirlas");
  }
  function afterChange(){
    sh.setApplyEnabled(photos.length >= 2);
    subtitle();
    if(!photos.length) sh.setView(null);
    renderPhotos(); controls.refresh(); empty();
  }

  function photoRow(p, compact){
    const row = document.createElement("div"); row.className = "fsp-photo";
    const i = order.indexOf(p.id), masked = hasInk(p.excl) || hasInk(p.keep), pts = manual.some(m => m.a === p.id || m.b === p.id);
    row.innerHTML = `<img alt="" src="${p.thumb}"><div><b>${i + 1}. ${esc(p.name)}</b><small>${p.full.width} × ${p.full.height}${masked ? " · máscara" : ""}${pts ? " · puntos" : ""}</small></div>
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
    n.textContent = orderWarning() || "Se ordenan solas; si no, cámbialo con ← y →.";
    L.appendChild(n);
  }
  function mobilePhotos(){
    const wrap = document.createElement("div"); wrap.className = "fsp-mphotos";
    ordered().forEach(p => {
      const r = photoRow(p, true);
      r.addEventListener("click", e => { if(!e.target.closest("[data-rm]")) move(p.id, -1); });   // en el móvil, tocar la foto la adelanta un puesto
      wrap.appendChild(r);
    });
    if(photos.length < MAX_PHOTOS){
      const b = document.createElement("button"); b.type = "button"; b.className = "fsp-photo";
      b.style.cssText = "display:grid;place-items:center;width:68px;height:68px;color:#e9edf4;font-size:22px;background:#272b31;border-style:dashed";
      b.setAttribute("aria-label", "Añadir fotos"); b.textContent = "+"; b.addEventListener("click", addPhotos); wrap.appendChild(b);
    }
    return wrap;
  }

  /* ── Ajustes ── */
  const edited = () => { rev++; renderPhotos(); controls.renderMobile(); empty(); schedule(); };
  const sections = [
    { id: "proj", label: "Proyección y horizonte", props: [
      { key: "projection", label: "Proyección", type: "select", options: PROJECTIONS },
      { key: "level", label: "Nivelar el horizonte", type: "toggle" },
      { key: "yaw", label: "Rumbo", type: "range", min: -180, max: 180, def: 0, unit: "°" },
      { key: "pitch", label: "Inclinación (horizonte)", type: "range", min: -90, max: 90, def: 0, unit: "°" },
      { key: "roll", label: "Giro (enderezar)", type: "range", min: -45, max: 45, step: .5, def: 0, unit: "°" }
    ] },
    { id: "mix", label: "Mezcla y lente", props: [
      { key: "blend", label: "Mezcla", type: "select", options: [["multiband", "Calidad (multibanda)"], ["seam", "Rápida (costura)"], ["feather", "Degradado"]] },
      { key: "exposure", label: "Igualar exposición", type: "toggle" },
      { key: "lens", label: "Corregir distorsión de lente", type: "toggle" },
      { key: "autoOrder", label: "Ordenar las fotos solas", type: "toggle" }
    ] },
    { id: "crop", label: "Recorte", props: [
      { key: "autoCrop", label: "Recortar bordes automáticamente", type: "toggle" },
      { key: "cropL", label: "Quitar a la izquierda", type: "range", min: 0, max: 45, def: 0, unit: " %" },
      { key: "cropR", label: "Quitar a la derecha", type: "range", min: 0, max: 45, def: 0, unit: " %" },
      { key: "cropT", label: "Quitar arriba", type: "range", min: 0, max: 45, def: 0, unit: " %" },
      { key: "cropB", label: "Quitar abajo", type: "range", min: 0, max: 45, def: 0, unit: " %" }
    ] },
    { id: "tools", label: "Corregir uniones", note: "Si una foto no encaja: marca a mano el mismo detalle en dos fotos. Si se cuela gente o un coche: píntalos para no usarlos.", props: [
      { type: "button", key: "t.preview", label: "Calcular vista previa", run: () => updatePreview(true) },
      { type: "button", key: "t.points", label: "Puntos de control…", run: () => openPoints() },
      { type: "button", key: "t.masks", label: "Máscaras…", run: () => openMasks() }
    ] }
  ];
  const controls = mountControls(sh, {
    sections, get: k => O[k],
    set: (k, v, final) => {
      O[k] = v;
      if(REMEMBERED.includes(k)) savePrefs(O);
      if(k === "lens" || k === "autoOrder"){ empty(); if(k === "autoOrder") subtitle(); }
      schedule(final ? 0 : 120);
    },
    mobileExtra: () => mobilePhotos()
  });

  function openPoints(){
    if(photos.length < 2){ toast("Añade al menos dos fotos", "err"); return; }
    openPointsEditor({ photos: ordered(), manual, onChange: edited });
  }
  function openMasks(){
    if(!photos.length){ toast("Añade fotos primero", "err"); return; }
    openMaskEditor({ photos: ordered(), onChange: edited });
  }

  /* ── Vista previa ── */
  const idIndex = list => new Map(list.map((p, i) => [p.id, i]));
  const manualFor = list => { const ix = idIndex(list); return manual.filter(m => ix.has(m.a) && ix.has(m.b)).map(m => ({ a: ix.get(m.a), b: ix.get(m.b), pts: m.pts })); };
  const renderOpts = list => ({
    projection: O.projection, blend: O.blend, exposure: O.exposure, autoCrop: O.autoCrop,
    horizon: { level: O.level, yaw: O.yaw, pitch: O.pitch, roll: O.roll },
    crop: { l: O.cropL / 100, t: O.cropT / 100, r: O.cropR / 100, b: O.cropB / 100 },
    exclude: list.map(p => p.excl), keep: list.map(p => p.keep),
    onProgress: msg => { if(!closed) sh.setBusy(msg); }
  });
  async function analyze(list, premium){
    const key = keyNow();
    const a = await analyzePhotos(list.map(p => p.full), { premium, lens: O.lens, autoOrder: autoOrderOn(), manual: manualFor(list), exclude: list.map(p => p.excl), onProgress: msg => { if(!closed) sh.setBusy(msg); } });
    analysis = { ...a, key, premium, ids: list.map(p => p.id) };
  }
  function schedule(delay = 0){
    clearTimeout(timer);
    if(photos.length < 2) return;
    if(stale()){ empty(); return; }
    timer = setTimeout(() => updatePreview(false), delay);
  }
  /** `force`: pedida con el botón (analiza si hace falta); si no, sólo se repite el paso rápido cuando ya hay análisis. */
  async function updatePreview(force){
    if(applying || photos.length < 2 || closed) return;
    const me = ++token;
    try{
      if(stale()){ if(!force) return; await analyze(ordered(), false); }
      if(me !== token || closed) return;
      const list = analyzed();
      sh.setBusy("Montando la vista previa…");
      const c = await renderPanorama(list.map(p => p.proxy), analysis, renderOpts(list));
      if(me !== token || closed) return;
      sh.setView(c, !!sh.view); sh.setEmpty(null);
    }catch(err){
      if(me !== token || closed) return;
      toast(err.message || "No se pudo montar la vista previa", "err");
      analysis = null; empty();
    }finally{ if(me === token && !closed) sh.setBusy(null); }
  }

  /* ── Crear ── */
  /** Une las fotos en el dispositivo (las fotos nunca salen de él). */
  async function stitch(){
    const all = ordered();
    if(stale() || (S.premium && !analysis.premium)) await analyze(all, S.premium);
    const list = analyzed();
    return renderPanorama(list.map(p => p.full), analysis, { ...renderOpts(list), premium: S.premium });
  }
  async function apply(){
    if(applying || photos.length < 2) return;
    applying = true; token++; sh.setApplyEnabled(false); sh.setBusy("Preparando…");
    try{
      const canvas = await stitch();
      if(closed) return;
      toast("¡Panorámica creada con éxito!", "ok");
      await onAccept(canvas, { count: photos.length });
      close();
    }catch(err){
      if(closed) return;
      toast("Error al crear panorámica: " + err.message, "err");
      sh.setBusy(null); sh.setApplyEnabled(true); applying = false;
    }
  }
  function close(){ if(closed) return; closed = true; clearTimeout(timer); sh.close(); }

  empty(); renderPhotos();
  return { close };
}
