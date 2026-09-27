/* ═══════════════════════════════════════════════════════════════
   UNMARK · PANEL

   PROVENIENCIA: Este filtro está basado en el repositorio
   https://github.com/wiltodelta/remove-ai-watermarks
   Las etapas de detección de marcas visibles, relleno por difusión
   armónica + parche de textura, y perturbación de píxeles (DWT-DCT,
   transformación geométrica, ruido, etc.) adaptan conceptos y
   heurísticas del proyecto de referencia mencionado.

   Modelo: Vista previa en vivo sobre la capa activa mientras se
   mueven los mandos; al aceptar, se escribe el resultado en una
   capa nueva. La vista previa trabaja sobre un proxy reducido y
   sin las etapas lentas (espectro, JPEG); Aplicar lo hace todo a
   resolución completa por el mismo camino.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer, layerIndex } from "../../core/doc.js";
import { emit } from "../../core/bus.js";
import { isMobile, COARSE } from "../../core/device.js";
import { dialog } from "../../ui/dialog.js";
import { toast, status, progress } from "../../ui/toast.js";
import { run } from "../../ui/commands.js";
import { commitFilter, filterOf } from "../../editor/filterlayer.js";
import { CHAIN, CHAIN_BY_ID, SECTIONS, STAGES_OF } from "./chain.js";
import { normalizeState, PRESETS, presetStages, varyStages } from "./state.js";
import { detectMarks } from "./detect.js";
import { effectiveStages, process, previewRects, buildMask, imageDataOf } from "./engine.js";
import { detectProvenance, describeProvenance } from "../../analysis/provenance.js";
import { exifState, saveExif } from "../../exif/ui.js";
import { difference } from "../purepixel/engine.js";

export const FILTER_ID = "unmark";
const LS_KEY = "realify.unmark";
const PREVIEW_LIMIT = COARSE ? 4e5 : 1.2e6;

export const filterState = normalizeState(null);
try{
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
  Object.assign(filterState, normalizeState(saved));
}catch{}

function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({
    stages: filterState.stages, seed: filterState.seed, dose: filterState.dose
  })); }catch{}
}

/* ── lienzos auxiliares ──────────────────────────────────────── */
const snapshot = l => {
  const c = document.createElement("canvas");
  c.width = l.canvas.width; c.height = l.canvas.height;
  c.getContext("2d", { willReadFrequently: true }).drawImage(l.canvas, 0, 0);
  return c;
};
const restore = (l, snap) => {
  const x = l.ctx;
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = "copy"; x.drawImage(snap, 0, 0); x.restore();
  l.thumbDirty = true;
  emit("doc:change");
};
function proxyOf(src){
  const w = src.width, h = src.height;
  if(w * h <= PREVIEW_LIMIT) return src;
  const k = Math.sqrt(PREVIEW_LIMIT / (w * h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function sizeThumb(cv, w, h){
  let MAXW = 620, MAXH = 260;
  if(isMobile()){
    const dpr = Math.min(2, devicePixelRatio || 1);
    MAXW = Math.round(Math.min(innerWidth, 900) * dpr);
    MAXH = Math.round(Math.min(innerHeight * 0.55, 900) * dpr);
  }
  const k = Math.min(MAXW / w, MAXH / h, 1);
  cv.width  = Math.max(1, Math.round(w * k));
  cv.height = Math.max(1, Math.round(h * k));
}
const layerBelow = l => { const i = layerIndex(l.id); return i > 0 ? doc.layers[i - 1] : null; };

/* ── sesión del panel ────────────────────────────────────────── */
let S = null;   // todo lo vivo mientras el panel está abierto

function applyPolicy(mode){
  if(mode === "clean"){ exifState.on = false; saveExif(); }
  else if(mode === "camera"){ exifState.on = true; saveExif(); }
}

/* Detección sobre el ORIGINAL a tamaño completo; se guarda con la
   sesión y las regiones elegidas por defecto son las de más
   puntuación. Corre en un tick aparte para no congelar el panel. */
function runDetection(){
  const p = filterState.stages.detect.p;
  S.detection = detectMarks(S.source, { sens: p.sens, zones: p.zones, minsize: p.minsize, maxsize: p.maxsize });
  S.chosen = new Set(S.detection.regions.filter(r => r.score >= 0.45).map(r => r.id));
  S.regenCache = null;
  renderRegions();
}

function renderRegions(){
  const box = S.body.querySelector("#umRegions");
  if(!box) return;
  if(!S.detection){ box.innerHTML = `<p class="hint" style="margin:0">Pulsa «Detectar marcas» o mueve la sensibilidad.</p>`; return; }
  const rs = S.detection.regions;
  if(!rs.length){ box.innerHTML = `<p class="hint" style="margin:0">No se ha encontrado nada que parezca un rótulo o logotipo en esa zona. Prueba con más sensibilidad, otra zona, la zona conocida del generador o una región manual.</p>`; return; }
  box.innerHTML = rs.map(r => `
    <label class="chk um-region">
      <input type="checkbox" data-rid="${r.id}"${S.chosen.has(r.id) ? " checked" : ""}>
      <span class="um-region-name">${r.label}</span>
      <span class="mono um-region-meta">${r.w}×${r.h} px · ${Math.round(r.score * 100)} %</span>
    </label>`).join("");
  box.querySelectorAll("input[data-rid]").forEach(cb => cb.addEventListener("change", () => {
    const id = +cb.dataset.rid;
    if(cb.checked) S.chosen.add(id); else S.chosen.delete(id);
    S.regenCache = null;
    schedulePreview();
  }));
}

/* ── vista previa ────────────────────────────────────────────── */
let previewTimer = null;
function schedulePreview(){
  if(!S) return;
  if(previewTimer) return;
  previewTimer = requestAnimationFrame(() => { previewTimer = null; renderPreview(); });
}

async function renderPreview(){
  if(!S) return;
  if(S.busy){ S.dirty = true; return; }
  S.busy = true; S.dirty = false;
  const ticket = ++S.ticket;
  const eff = effectiveStages(filterState);
  const ctx = { detection: S.detection, chosenIds: S.chosen, selection: S.selection, selW: doc.w, selH: doc.h };
  try{
    const { canvas, info } = await process(S.proxy, eff, {
      seed: filterState.seed, preview: true, ctx, regenCache: S.regenCache
    });
    if(ticket !== S.ticket || !S) return;
    S.last = canvas;
    const x = S.layer.ctx;
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "copy";
    x.imageSmoothingQuality = "high";
    x.drawImage(canvas, 0, 0, S.layer.canvas.width, S.layer.canvas.height);
    x.restore();
    S.layer.thumbDirty = true;
    emit("doc:change");
    paintThumb(canvas);
    drawOverlay(eff);
    const n = CHAIN.filter(s => eff[s.id].on).length;
    const st = difference(S.proxyData.data, imageDataOf(canvas).data);
    const psnr = Number.isFinite(st.psnr) ? `PSNR ${st.psnr.toFixed(1)} dB` : "sin cambio";
    const extra = info.maskPx ? ` · marca ${(info.maskPx / (S.proxy.width * S.proxy.height) * 100).toFixed(2)} %` : "";
    const srv = info.regen ? " · regenerada" : "";
    status(`Unmark · ${n} de ${CHAIN.length} etapas · ${Math.round(info.ms)} ms · ${psnr}${extra}${srv}`);
    S.body.querySelector("#umStats").textContent =
      `${psnr} · máx ${st.max} · ${Math.round(info.ms)} ms${info.regen ? " · con regeneración del servidor" : ""}`;
  }catch(err){
    console.error("[unmark]", err);
    status("Unmark · " + err.message);
  }finally{
    if(S){ S.busy = false; if(S.dirty) schedulePreview(); }
  }
}

function paintThumb(src){
  const cv = S.prevCv;
  if(!cv || !cv.width) return;
  const x = S.prevCx;
  x.clearRect(0, 0, cv.width, cv.height);
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, cv.width, cv.height);
}

function drawOverlay(eff){
  const ov = S.overCv; if(!ov) return;
  const x = ov.getContext("2d");
  x.clearRect(0, 0, ov.width, ov.height);
  if(!S.showRects) return;
  const rects = previewRects(eff, ov.width, ov.height,
    { detection: S.detection, chosenIds: S.chosen });
  const COLOR = { detect: "#e8a33d", off: "rgba(200,200,200,.55)", vendor: "#4a7fb5", region: "#4a9d63" };
  x.lineWidth = 1.5;
  for(const r of rects){
    x.strokeStyle = COLOR[r.kind];
    x.setLineDash(r.kind === "off" ? [3, 3] : []);
    x.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(2, r.w), Math.max(2, r.h));
  }
  x.setLineDash([]);
}

/* ── ajuste recomendado ──────────────────────────────────────── */
function recommend(){
  const src = S.source;
  const W = src.width, H = src.height;
  const mp = W * H / 1e6;
  // Ruido y bloques JPEG sobre una losa central nativa
  const tile = Math.min(256, W, H);
  const c = document.createElement("canvas");
  c.width = tile; c.height = tile;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(src, (W - tile) >> 1, (H - tile) >> 1, tile, tile, 0, 0, tile, tile);
  const d = x.getImageData(0, 0, tile, tile).data;
  const L = new Float32Array(tile * tile);
  for(let p = 0, i = 0; p < L.length; p++, i += 4) L[p] = (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]) / 255;
  const res = [];
  let bH = 0, iH = 0, nbH = 0, niH = 0;
  for(let y = 1; y < tile - 1; y++)
    for(let xx = 1; xx < tile - 1; xx++){
      const p = y * tile + xx;
      res.push(Math.abs(4*L[p] - 2*(L[p-1] + L[p+1] + L[p-tile] + L[p+tile])
              + L[p-tile-1] + L[p-tile+1] + L[p+tile-1] + L[p+tile+1]));
      const dd = Math.abs(L[p] - L[p-1]);
      if(dd <= 14/255){ if((xx & 7) === 0){ bH += dd; nbH++; } else { iH += dd; niH++; } }
    }
  res.sort((a, b) => a - b);
  const noise = res[res.length >> 1] / (0.6745 * 6);
  const block = (nbH && niH) ? (bH/nbH) / Math.max(iH/niH, 0.002) : 1;
  const unit = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  const noisy = unit(noise, 0.004, 0.025);
  const blocky = unit(block, 1.06, 1.30);
  const small = unit(1 - mp, 0, 0.7);      // < 1 MP → 0..1
  const big = unit(mp, 2, 12);

  if(!S.detection) runDetection();
  const found = S.detection.regions.filter(r => r.score >= 0.45);
  const prov = S.provenance;

  const P = {
    ...PRESETS["Todo apagado"],
    detect:{on: found.length > 0},
    inpaint:{on: found.length > 0, method:"hybrid", texture: mix(45, 70, noisy), grain: mix(15, 45, noisy)},
    geometry:{on:true, rot: mix(35, 20, small), crop: mix(18, 10, small), shift:50, aniso: mix(25, 12, small)},
    resample:{on:true, amt: mix(30, 14, small), mix: mix(70, 80, small)},
    dwt:{on:true, ll: mix(45, 30, small), hf: mix(40, 25, small), levels: big > 0.5 ? "3" : "2"},
    dct:{on:true, amt: mix(45, 28, small), band: 50},
    blursharp:{on:true, blur: mix(30, 18, small), sharp: mix(40, 30, small)},
    noise:{on:true, lum: mix(34, 10, noisy), chr: mix(16, 5, noisy), size: mix(15, 30, big)},
    lsb:{on:true, bits:"2"},
    spectral:{on: blocky < 0.3, amt: 35},
    jpeg:{on:true, q: mix(78, 88, blocky), gens: mix(15, 5, blocky), jitter: 30},
    policy:{on:true, mode: exifState.on ? "camera" : "clean"}
  };
  const report = [
    found.length ? `${found.length} marca${found.length > 1 ? "s" : ""} visible${found.length > 1 ? "s" : ""} → relleno híbrido` : "sin marca visible clara → sin relleno",
    `ruido σ ${(noise * 100).toFixed(2)} %` + (noisy > 0.5 ? " (ya granulada → menos ruido)" : ""),
    blocky > 0 ? `bloques JPEG ×${block.toFixed(2)} → menos recompresión` : "sin bloques JPEG previos",
    `${mp.toFixed(1)} MP` + (small > 0.3 ? " (pequeña → perturbaciones más suaves)" : ""),
    prov?.aiDeclared ? "el archivo declara origen IA → sin metadatos al exportar"
      : prov?.c2pa ? "credenciales C2PA en el archivo → sin metadatos al exportar" : null
  ].filter(Boolean);
  return { state: normalizeState({ stages: presetStages(P), seed: filterState.seed, dose: 100 }), report };
}

/* ── procedencia del archivo de origen ───────────────────────── */
async function loadProvenance(){
  const box = S.body.querySelector("#umProv");
  const f = doc.source?.file;
  if(!f){ box.innerHTML = `<p class="hint" style="margin:0">Este documento no viene de un archivo (o se creó en blanco), así que no hay metadatos de origen que leer. Al exportar no se escribirá nada salvo lo que decida la política de arriba.</p>`; return; }
  try{
    const u8 = new Uint8Array(await f.arrayBuffer());
    const found = detectProvenance(u8);
    S.provenance = found;
    const tags = [];
    if(found.c2pa) tags.push(`<b class="um-tag um-tag-bad">C2PA</b>`);
    if(found.aiDeclared) tags.push(`<b class="um-tag um-tag-bad">XMP · ${found.sourceType}</b>`);
    else if(found.xmp) tags.push(`<b class="um-tag">XMP</b>`);
    if(found.exif) tags.push(`<b class="um-tag">EXIF</b>`);
    for(const m of found.markers) if(/texto incrustado/.test(m)) tags.push(`<b class="um-tag um-tag-bad">prompt en texto</b>`);
    box.innerHTML = `
      <div class="um-provhead"><span class="mono">${f.name}</span> · ${(found.container || "?").toUpperCase()} · ${(f.size / 1024).toFixed(0)} KB</div>
      <div class="um-tags">${tags.length ? tags.join("") : `<b class="um-tag um-tag-ok">sin marcas declaradas</b>`}</div>
      <p class="hint" style="margin:6px 0 8px">${describeProvenance(found)} Todo esto desaparece al exportar por el lienzo; si además quieres el archivo original limpio sin recomprimir, usa el botón.</p>
      <button type="button" id="umStrip">Limpiar el archivo original sin recomprimir…</button>`;
    box.querySelector("#umStrip").addEventListener("click", () => run("an.strip"));
  }catch(err){
    box.innerHTML = `<p class="hint" style="margin:0">No se pudo leer el archivo de origen: ${err.message}</p>`;
  }
}

/* ── panel ───────────────────────────────────────────────────── */
/* Cálculo sin diálogo (registro de filtros): la misma cadena que
   Aplicar, con las regiones detectadas que quedaron guardadas en la
   capa como zonas a rellenar. */
async function renderHeadless(src, params){
  const st = normalizeState(params?.state);
  st.solo = null;
  const eff = effectiveStages(st);
  const regions = (params?.regions || []).map((r, i) => ({ ...r, id: i, label: "" }));
  const ctx = regions.length
    ? { detection: { regions, fullW: src.width, fullH: src.height }, chosenIds: new Set(regions.map(r => r.id)) }
    : {};
  const { canvas } = await process(src, eff, { seed: st.seed, preview: false, ctx });
  return canvas;
}

export async function openUnmark(opts = {}){
  if(opts.render) return renderHeadless(opts.render.src, opts.init);
  if(S) return;
  const layer = opts.edit || activeLayer();
  if(!doc.open || !layer){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  if(layer.type === "adjust"){ toast("Una capa de ajuste no tiene píxeles que limpiar", "err"); return; }
  if(layer.type === "text"){ toast("Rasteriza el texto antes de aplicarle un filtro"); return; }

  const prev = opts.edit ? { id: FILTER_ID, params: opts.init || filterOf(layer)?.params || {} } : filterOf(layer);
  const editing = !!(prev && prev.id === FILTER_ID && layerBelow(layer));
  const sourceLayer = editing ? layerBelow(layer) : layer;
  if(editing && prev.params?.state) Object.assign(filterState, normalizeState(prev.params.state));

  const source = snapshot(sourceLayer);
  const before = snapshot(layer);
  const proxy = proxyOf(source);

  S = {
    layer, source, before, proxy, proxyData: imageDataOf(proxy),
    selection: doc.selection?.mask || null,
    detection: null, chosen: new Set(), provenance: null,
    regenCache: null, last: null, busy: false, dirty: false, ticket: 0,
    showRects: true, body: null, prevCv: null, prevCx: null, overCv: null
  };
  filterState.solo = null;

  const body = document.createElement("div");
  body.className = "cadena-panel unmark-panel";
  body.innerHTML = buildHtml();
  S.body = body;
  wire(body);

  status("Buscando marcas…");
  setTimeout(() => {
    if(!S) return;
    if(filterState.stages.detect.on) runDetection();
    schedulePreview();
    loadProvenance();
  }, 0);

  const res = await dialog({
    title: isMobile() ? "Unmark" : "Unmark — limpieza de marcas y procedencia",
    body, wide: true, cls: isMobile() ? "dlg-compact" : "dlg-full",
    buttons: [
      { label:"Cancelar", value:null },
      { label: editing ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }
    ]
  });

  if(previewTimer){ cancelAnimationFrame(previewTimer); previewTimer = null; }
  S.ticket++;
  restore(layer, before);

  if(res !== "go"){ status(""); S = null; return; }

  filterState.solo = null;
  const eff = effectiveStages(filterState);
  const ctx = { detection: S.detection, chosenIds: S.chosen, selection: S.selection, selW: doc.w, selH: doc.h };
  status("Unmark · a resolución completa…");
  progress(0.05);
  let result;
  try{
    result = await process(source, eff, {
      seed: filterState.seed, preview: false, ctx,
      onStatus: m => status("Unmark · " + m),
      onProgress: f => progress(0.2 + f * 0.7)
    });
  }catch(err){
    console.error("[unmark]", err);
    progress(null);
    toast("Unmark: " + err.message, "err");
    status("");
    S = null;
    return;
  }
  progress(null);
  applyPolicy(eff.policy.on ? eff.policy.p.mode : "keep");
  save();

  const params = { state: { stages: filterState.stages, seed: filterState.seed, dose: filterState.dose },
                   regions: S.detection ? S.detection.regions.filter(r => S.chosen.has(r.id))
                     .map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, score: r.score })) : [] };
  const after = result.canvas;
  commitFilter({ base: sourceLayer, edit: editing ? layer : null, result: after,
                 title: "Unmark", filter: FILTER_ID, params });
  toast(editing ? `Unmark · actualizado · ${Math.round(result.info.ms)} ms`
                : `Unmark · capa nueva · ${Math.round(result.info.ms)} ms`, "ok");
  status("");
  S = null;
}

/* ── construcción ────────────────────────────────────────────── */
function buildHtml(){
  const mob = isMobile();
  const presetNames = Object.keys(PRESETS);
  const sections = SECTIONS.map(sec => `
    <div class="um-sec" data-sec="${sec.id}">
      <b>${sec.name}</b><span>${sec.note}</span>
    </div>
    ${STAGES_OF(sec.id).map(s => stageHtml(s, mob)).join("")}
    ${sec.id === "provenance" ? `<div class="um-report" id="umProv"><p class="hint" style="margin:0">Leyendo el archivo de origen…</p></div>` : ""}`).join("");

  return `
  <div class="cadena-prevwrap um-prevwrap">
    <div class="um-prev">
      <canvas id="umPrev"></canvas>
      <canvas id="umOver" class="um-over"></canvas>
    </div>
    ${mob ? "" : `<div class="um-side">
      <div class="um-legend">
        <i style="border-color:#e8a33d"></i> detectada
        <i style="border-color:#4a7fb5"></i> generador
        <i style="border-color:#4a9d63"></i> manual
        <i style="border-color:rgba(200,200,200,.55);border-style:dashed"></i> descartada
      </div>
      <label class="chk"><input type="checkbox" id="umRects" checked> Mostrar zonas</label>
      <span class="hint mono" id="umStats" style="margin:0"></span>
    </div>`}
  </div>
  ${mob ? `<span class="hint mono um-stats-mob" id="umStats"></span>` : ""}

  <div class="cadena-dose">
    <label for="umDose">Dosis</label>
    <input type="range" id="umDose" min="0" max="100" step="1" value="${filterState.dose}"
           title="Multiplica la fuerza de todas las perturbaciones a la vez; 0 % conserva el original">
    <span class="unit mono" id="umDoseV">${filterState.dose}%</span>
    <button id="umCompare" title="Mantén pulsado para ver el original">Comparar</button>
  </div>

  <div class="cadena-actions">
    <div class="field cadena-preset-field">
      <label>Preset</label>
      <select id="umPreset" class="grow" aria-label="Preset">
        <option value="">Valores actuales</option>
        ${presetNames.map(n => `<option>${n}</option>`).join("")}
      </select>
    </div>
    <button id="umDetect" title="Busca rótulos y logotipos en la imagen">Detectar marcas</button>
    <button id="cdRec" title="Mide la imagen y propone una configuración">Ajuste recomendado</button>
    <button id="umOnly" title="Mostrar sólo las etapas encendidas">Sólo activas</button>
    <button id="umAll">Apagar todo</button>
    <button id="umVary" title="Desvía cada valor y sortea semilla">Variar</button>
  </div>

  <div class="cadena-top" id="cdRecRow" hidden>
    <span class="hint" id="cdRecInfo" style="margin:0"></span>
  </div>

  <details class="cadena-adv"${mob ? "" : " open"}>
    <summary>Semilla</summary>
    <div class="cadena-advbody">
      <div class="cadena-top">
        <div class="field" style="margin:0">
          <label style="width:auto">Semilla</label>
          <input type="number" id="umSeed" style="width:82px" value="${filterState.seed}"
                 title="Fija el sorteo de todas las perturbaciones; cambia para otra variante">
          <button id="umNewSeed" class="icon" title="Nueva semilla">⟳</button>
        </div>
      </div>
      <p class="hint" style="margin:6px 0 0">Todo el filtro se ejecuta en tu equipo: detección, relleno y todas las perturbaciones son cálculos locales sin dependencias externas.</p>
    </div>
  </details>

  <div class="cadena-stages">${sections}</div>`;
}

const escapeAttr = s => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function stageHtml(s, mob){
  const st = filterState.stages[s.id];
  const extra = s.id === "detect" ? `<div class="um-regions" id="umRegions"></div>`
              : s.id === "selection" ? `<p class="hint" id="umSelInfo" style="margin:0"></p>`
              : "";
  return `
  <section class="cstage${st.on ? " on" : ""}${mob ? " collapsed" : ""}" data-id="${s.id}" data-sec="${s.sec}">
    <header class="chead">
      <span class="cnum">${CHAIN.indexOf(s) + 1}</span>
      <span class="ccaret" aria-hidden="true">›</span>
      <span class="cname">${s.name}</span>
      ${s.cpu ? `<span class="um-cpu" title="No se ve en la vista previa; se ejecuta al aplicar">al aplicar</span>` : ""}
      <button class="csolo icon" title="Aislar esta etapa">S</button>
      <input type="checkbox" class="sw" ${st.on ? "checked" : ""} aria-label="Activar ${s.name}">
    </header>
    <div class="cbody">
      <p class="hint cnote"${mob ? ' title="Tocar para leer entera"' : ""}>${s.note}</p>
      ${s.params.map(pr => paramHtml(s, pr)).join("")}
      ${extra}
    </div>
  </section>`;
}

function paramHtml(s, pr){
  const st = filterState.stages[s.id];
  if(pr.type === "choice"){
    const val = st.p[pr.k];
    return `
    <div class="cparam cparam-choice" data-stage="${s.id}" data-key="${pr.k}">
      <div class="clabel"><span>${pr.label}</span></div>
      <select class="grow" aria-label="${s.name}: ${pr.label}">
        ${pr.options.map(o => `<option value="${o.v}"${o.v === val ? " selected" : ""}>${o.label}</option>`).join("")}
      </select>
    </div>`;
  }
  return `
  <div class="cparam" data-stage="${s.id}" data-key="${pr.k}">
    <div class="clabel"><span>${pr.label}</span><span class="cval mono">${st.p[pr.k]}</span></div>
    <input type="range" min="${pr.min ?? 0}" max="100" step="1" value="${st.p[pr.k]}"
           aria-label="${s.name}: ${pr.label}">
  </div>`;
}

/* ── cableado ────────────────────────────────────────────────── */
function wire(body){
  const q = sel => body.querySelector(sel);
  const mob = isMobile();

  S.prevCv = q("#umPrev"); S.prevCx = S.prevCv.getContext("2d");
  S.overCv = q("#umOver");
  sizeThumb(S.prevCv, S.proxy.width, S.proxy.height);
  S.overCv.width = S.prevCv.width; S.overCv.height = S.prevCv.height;
  paintThumb(S.proxy);

  const rects = q("#umRects");
  if(rects) rects.addEventListener("change", () => { S.showRects = rects.checked; drawOverlay(effectiveStages(filterState)); });

  if(mob) body.querySelectorAll(".cnote").forEach(n => n.addEventListener("click", () => n.classList.toggle("open")));

  body.querySelectorAll(".chead").forEach(h => {
    h.addEventListener("click", e => {
      if(e.target.closest("input,button")) return;
      const sec = h.parentElement;
      const opening = sec.classList.contains("collapsed");
      if(mob && opening) body.querySelectorAll(".cstage").forEach(o => { if(o !== sec) o.classList.add("collapsed"); });
      sec.classList.toggle("collapsed");
      if(mob && opening) requestAnimationFrame(() => sec.scrollIntoView({ block:"start", behavior:"smooth" }));
    });
  });

  const selInfo = q("#umSelInfo");
  if(selInfo) selInfo.textContent = S.selection
    ? "Hay una selección activa: se usará como zona a rellenar."
    : "No hay selección. Haz una con el lazo, la varita o el rectángulo antes de abrir el filtro.";

  const invalidate = () => { S.regenCache = null; };

  // Interruptores
  body.querySelectorAll(".cstage .sw").forEach(sw => {
    sw.addEventListener("change", () => {
      const id = sw.closest(".cstage").dataset.id;
      filterState.stages[id].on = sw.checked;
      sw.closest(".cstage").classList.toggle("on", sw.checked);
      if(id === "detect" && sw.checked && !S.detection) runDetection();
      if(["detect", "vendor", "region", "selection", "inpaint", "regen"].includes(id)) invalidate();
      q("#umPreset").value = "";
      schedulePreview();
    });
  });

  // Aislar
  body.querySelectorAll(".csolo").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const id = b.closest(".cstage").dataset.id;
      filterState.solo = filterState.solo === id ? null : id;
      body.querySelectorAll(".csolo").forEach(x => x.classList.remove("on"));
      if(filterState.solo) b.classList.add("on");
      schedulePreview();
    });
  });

  // Deslizadores
  body.querySelectorAll(".cparam input").forEach(r => {
    const wrap = r.closest(".cparam");
    const id = wrap.dataset.stage, key = wrap.dataset.key;
    const val = wrap.querySelector(".cval");
    r.addEventListener("input", () => {
      filterState.stages[id].p[key] = +r.value;
      val.textContent = valueLabel(id, key);
      q("#umPreset").value = "";
      if(id === "detect"){ S.detection = null; clearTimeout(S.detTimer); S.detTimer = setTimeout(() => { if(S){ runDetection(); schedulePreview(); } }, 260); return; }
      if(["vendor", "region", "inpaint", "regen"].includes(id)) invalidate();
      schedulePreview();
    });
  });
  body.querySelectorAll(".cparam-choice select").forEach(sel => {
    const wrap = sel.closest(".cparam");
    const id = wrap.dataset.stage, key = wrap.dataset.key;
    sel.addEventListener("change", () => {
      filterState.stages[id].p[key] = sel.value;
      q("#umPreset").value = "";
      if(id === "detect"){ runDetection(); }
      if(["detect", "vendor", "inpaint", "regen"].includes(id)) invalidate();
      schedulePreview();
    });
  });

  // Dosis
  const dose = q("#umDose"), doseV = q("#umDoseV");
  dose.addEventListener("input", () => {
    filterState.dose = +dose.value;
    doseV.textContent = dose.value + "%";
    refreshValueLabels(body);
    invalidate();
    schedulePreview();
  });

  // Semilla
  const seed = q("#umSeed");
  const setSeed = v => {
    filterState.seed = Math.round(Math.max(0, Math.min(99999, v || 0)));
    seed.value = filterState.seed;
    invalidate();
    schedulePreview();
  };
  seed.addEventListener("change", () => setSeed(+seed.value));
  q("#umNewSeed").addEventListener("click", () => setSeed(Math.floor(Math.random() * 99999)));

  // Presets
  q("#umPreset").addEventListener("change", e => {
    const pr = PRESETS[e.target.value];
    if(!pr) return;
    filterState.stages = presetStages(pr);
    filterState.solo = null;
    body.querySelectorAll(".csolo").forEach(b => b.classList.remove("on"));
    syncControls(body);
    if(filterState.stages.detect.on && !S.detection) runDetection();
    invalidate();
    schedulePreview();
  });

  q("#umDetect").addEventListener("click", () => {
    if(!filterState.stages.detect.on){
      filterState.stages.detect.on = true;
      syncControls(body);
    }
    runDetection();
    const sec = body.querySelector('.cstage[data-id="detect"]');
    if(sec){ sec.classList.remove("collapsed"); if(mob) sec.scrollIntoView({ block:"start", behavior:"smooth" }); }
    invalidate();
    schedulePreview();
    const n = S.detection.regions.length;
    toast(n ? `${n} zona${n > 1 ? "s" : ""} candidata${n > 1 ? "s" : ""}` : "No se ha encontrado ninguna marca");
  });

  const onlyBtn = q("#umOnly"), stagesBox = q(".cadena-stages");
  onlyBtn.addEventListener("click", () => {
    const only = stagesBox.classList.toggle("only-on");
    onlyBtn.classList.toggle("on", only);
  });

  let memory = null;
  const allBtn = q("#umAll");
  const allOff = () => !CHAIN.some(s => filterState.stages[s.id].on);
  const syncAll = () => { allBtn.textContent = allOff() ? "Encender todo" : "Apagar todo"; };
  allBtn.addEventListener("click", () => {
    if(!allOff()){
      memory = Object.fromEntries(CHAIN.map(s => [s.id, filterState.stages[s.id].on]));
      CHAIN.forEach(s => filterState.stages[s.id].on = false);
    } else if(memory){
      CHAIN.forEach(s => filterState.stages[s.id].on = memory[s.id] !== false);
    } else {
      CHAIN.forEach(s => filterState.stages[s.id].on = s.on);
    }
    syncControls(body); syncAll();
    invalidate();
    schedulePreview();
  });
  syncAll();

  // Comparar: mantener pulsado enseña el original
  const cmpBtn = q("#umCompare");
  const showOriginal = () => { restore(S.layer, S.before); paintThumb(S.proxy); S.overCv.getContext("2d").clearRect(0, 0, S.overCv.width, S.overCv.height); };
  const showPreview = () => { if(S.last){ const x = S.layer.ctx; x.save(); x.setTransform(1,0,0,1,0,0); x.globalCompositeOperation = "copy"; x.imageSmoothingQuality = "high"; x.drawImage(S.last, 0, 0, S.layer.canvas.width, S.layer.canvas.height); x.restore(); S.layer.thumbDirty = true; emit("doc:change"); paintThumb(S.last); drawOverlay(effectiveStages(filterState)); } else schedulePreview(); };
  cmpBtn.addEventListener("pointerdown", e => { e.preventDefault(); showOriginal(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => cmpBtn.addEventListener(ev, showPreview));

  q("#umVary").addEventListener("click", () => {
    varyStages(filterState.stages);
    filterState.seed = Math.floor(Math.random() * 99999);
    seed.value = filterState.seed;
    q("#umPreset").value = "";
    syncControls(body);
    invalidate();
    schedulePreview();
  });

  // Ajuste recomendado (mismo cableado que Realify)
  const recBtn = q("#cdRec"), recInfo = q("#cdRecInfo");
  let measured = false;
  const changed = () => { if(!measured) return; recInfo.textContent = "Los ajustes han cambiado. Pulsa Ajuste recomendado para volver a medir."; measured = false; };
  body.addEventListener("input", changed);
  body.addEventListener("change", changed);
  body.addEventListener("click", e => { if(e.target.closest("#umAll,#umVary,#umNewSeed,.csolo")) changed(); });
  recBtn.addEventListener("click", () => {
    q("#cdRecRow").hidden = false;
    try{
      const { state, report } = recommend();
      Object.assign(filterState, normalizeState(state));
      filterState.solo = null;
      q("#umPreset").value = "";
      dose.value = filterState.dose; doseV.textContent = filterState.dose + "%";
      seed.value = filterState.seed;
      body.querySelectorAll(".csolo").forEach(b => b.classList.remove("on"));
      syncControls(body); syncAll(); renderRegions();
      recInfo.textContent = "Medido: " + report.join(" · ") + ". Revísalo y pulsa Aplicar para conservarlo.";
      measured = true;
    }catch(err){
      recInfo.textContent = `No se pudo calcular el ajuste: ${err.message}`;
    }
    invalidate();
    schedulePreview();
  });
}

function valueLabel(id, key){
  const raw = filterState.stages[id].p[key];
  const pr = CHAIN_BY_ID[id].params.find(p => p.k === key);
  const dose = filterState.dose / 100;
  if(dose >= 1 || !pr || pr.mode === "keep") return String(raw);
  const eff = pr.mode === "inv" ? raw + (100 - raw) * (1 - dose) : raw * dose;
  const shown = Math.round(eff);
  return shown === raw ? String(raw) : `${raw} → ${shown}`;
}
function refreshValueLabels(body){
  body.querySelectorAll(".cparam:not(.cparam-choice)").forEach(wrap => {
    wrap.querySelector(".cval").textContent = valueLabel(wrap.dataset.stage, wrap.dataset.key);
  });
}
function syncControls(body){
  body.querySelectorAll(".cstage").forEach(el => {
    const st = filterState.stages[el.dataset.id];
    el.classList.toggle("on", st.on);
    el.querySelector(".sw").checked = st.on;
  });
  body.querySelectorAll(".cparam").forEach(wrap => {
    const v = filterState.stages[wrap.dataset.stage].p[wrap.dataset.key];
    if(wrap.classList.contains("cparam-choice")){ wrap.querySelector("select").value = v; return; }
    wrap.querySelector("input").value = v;
    wrap.querySelector(".cval").textContent = valueLabel(wrap.dataset.stage, wrap.dataset.key);
  });
}
