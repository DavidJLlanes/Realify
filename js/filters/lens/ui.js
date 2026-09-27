/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE PHOTO LENS · PANEL
   Un selector con los 92 tipos de foto, un botón que pregunta al
   modelo cuál es, una insignia que dice en qué quedó la cosa, un
   deslizador de intensidad y, plegados, los siete ajustes del preset
   por si el revelado propuesto pide un retoque.

   El resultado va a una capa nueva encima de la de origen, con los
   parámetros guardados dentro: se puede deshacer, bajar de opacidad,
   enmascarar, y volver a abrir este panel sobre esa capa para
   cambiar el tipo o la intensidad sin rehacer nada.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer, layerIndex } from "../../core/doc.js";
import { emit } from "../../core/bus.js";
import { COARSE, isMobile } from "../../core/device.js";
import { dialog } from "../../ui/dialog.js";
import { toast, status } from "../../ui/toast.js";
import { commitFilter, filterOf } from "../../editor/filterlayer.js";
import { GROUPS, CATEGORIES, CATEGORY_BY_ID, ADJ_KEYS, ADJ_LABELS, neutralAdj } from "./categories.js";
import { applyLens } from "./render.js";
import { classify, ensureModel, cachedModelInfo, CONFIDENCE_MIN } from "./classify.js";

export const FILTER_ID = "lens";
const LS_KEY = "realify.lens";

/* Píxeles como mucho para la vista previa; la aplicación final va a
   resolución completa. Mismo criterio que el resto de filtros CPU de
   la app, más estricto en pantallas táctiles. */
const PREVIEW_LIMIT = COARSE ? 4e5 : 1.2e6;

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

const scaleAdj = (adj, intensity) =>
  Object.fromEntries(ADJ_KEYS.map(k => [k, (adj[k] || 0) * intensity / 100]));

function loadPrefs(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }catch{ return {}; }
}
function savePrefs(p){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(p)); }catch{}
}

const layerBelow = l => {
  const i = layerIndex(l.id);
  return i > 0 ? doc.layers[i - 1] : null;
};

/* ── panel ───────────────────────────────────────────────────── */
export async function openLens(opts = {}){
  if(opts.render){
    const p = opts.init || {};
    const c = document.createElement("canvas");
    applyLens(opts.render.src, c, scaleAdj(p.adj || neutralAdj(), p.intensity ?? 100));
    return c;
  }
  const layer = opts.edit || activeLayer();
  if(!doc.open || !layer){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  if(layer.type === "adjust"){ toast("Una capa de ajuste no tiene píxeles que revelar", "err"); return; }
  if(layer.type === "text"){ toast("Rasteriza el texto antes de aplicarle un filtro"); return; }

  /* Reabrir sobre una capa que ya es un revelado de este filtro: se
     edita ESA capa —se toma como origen la de debajo y se sustituyen
     sus píxeles— en vez de apilar un segundo revelado encima del
     primero, que es lo que nadie quiere al pulsar dos veces el mismo
     menú. */
  const prev = opts.edit ? { id: FILTER_ID, params: opts.init || filterOf(layer)?.params || {} } : filterOf(layer);
  const editing = !!(prev && prev.id === FILTER_ID && layerBelow(layer));
  const sourceLayer = editing ? layerBelow(layer) : layer;
  const source = snapshot(sourceLayer);
  const before = snapshot(layer);
  const proxy = proxyOf(source);
  const scratch = document.createElement("canvas");

  const prefs = loadPrefs();
  const st = {
    category: editing ? (prev.params.category || "auto") : "auto",
    intensity: editing ? (prev.params.intensity ?? 100) : (prefs.intensity ?? 100),
    adj: editing && prev.params.adj ? { ...prev.params.adj } : neutralAdj(),
    detection: editing ? (prev.params.detection || null) : null,
    manual: editing
  };

  const body = document.createElement("div");
  body.className = "lens";
  body.innerHTML = buildHtml(st);
  const q = s => body.querySelector(s);

  /* Vista previa: se revela el proxy y se estira sobre la capa. En
     móvil el proxy cabe en 0,4 MP y el deslizador sigue al dedo. */
  /* La clasificación es asíncrona: si el panel se cierra antes de que
     el modelo conteste, su `preview()` tardío pintaría sobre la capa
     ya devuelta a su estado. Cerrado el panel, no se pinta más. */
  let queued = false, lastMs = 0, closed = false;
  const preview = () => {
    if(queued || closed) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if(closed) return;
      lastMs = applyLens(proxy, scratch, scaleAdj(st.adj, st.intensity));
      const x = layer.ctx;
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = "copy";
      x.imageSmoothingQuality = "high";
      x.drawImage(scratch, 0, 0, layer.canvas.width, layer.canvas.height);
      x.restore();
      layer.thumbDirty = true;
      emit("doc:change");
      status(`Adaptive Photo Lens · ${Math.round(lastMs)} ms`);
    });
  };

  wire(body, q, st, source, preview);
  preview();

  if(!editing || st.category === "auto") runDetection(q, st, source, preview);

  const res = await dialog({
    title: "Adaptive Photo Lens",
    body, wide: !isMobile(), cls: isMobile() ? "dlg-lens dlg-compact" : "dlg-lens",
    buttons: [
      { label:"Cancelar", value:null },
      { label: editing ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }
    ]
  });

  closed = true;
  restore(layer, before);
  if(res !== "go"){ status(""); return; }

  status("Revelando a resolución completa…");
  const full = document.createElement("canvas");
  const ms = applyLens(source, full, scaleAdj(st.adj, st.intensity));
  const params = {
    category: st.category, intensity: st.intensity, adj: { ...st.adj },
    detection: st.detection ? {
      category: st.detection.category, confidence: st.detection.confidence,
      sure: st.detection.sure, ms: st.detection.ms,
      label: st.detection.model ? st.detection.model.top[0].label : null
    } : null
  };
  savePrefs({ intensity: st.intensity });

  commitFilter({ base: sourceLayer, edit: editing ? layer : null, result: full,
                 title: "Adaptive Photo Lens", filter: FILTER_ID, params });
  toast(`Adaptive Photo Lens · ${catLabel(st.category)} · ${editing ? Math.round(ms) + " ms" : "capa nueva"}`, "ok");
  status("");
}

const catLabel = id => (CATEGORY_BY_ID[id] || CATEGORY_BY_ID.auto).label;

/* ── construcción ────────────────────────────────────────────── */
function buildHtml(st){
  const options = GROUPS.map(g => `
    <optgroup label="${g.label}">
      ${CATEGORIES.filter(c => c.group === g.id).map(c =>
        `<option value="${c.id}"${c.id === st.category ? " selected" : ""}>${c.label}</option>`).join("")}
    </optgroup>`).join("");

  const adjRows = ADJ_KEYS.map(k => `
    <label class="lens-adj-row" data-key="${k}">
      <span class="lens-adj-name">${ADJ_LABELS[k]}</span>
      <input type="range" min="-100" max="100" step="1" value="${st.adj[k]}" aria-label="${ADJ_LABELS[k]}">
      <b class="mono lens-adj-val">${st.adj[k]}</b>
    </label>`).join("");

  return `
  <div class="lens-grid">
    <div class="lens-field lens-cat">
      <label for="lensCat">Tipo de foto</label>
      <select id="lensCat" aria-label="Tipo de foto">${options}</select>
    </div>
    <button id="lensDetect" type="button" class="lens-detect"
            title="Analiza la imagen con el modelo local y elige el tipo">Detectar automáticamente</button>
    <div id="lensBadge" class="lens-badge lens-badge-idle" aria-live="polite"></div>
  </div>

  <div id="lensSuggest" class="lens-suggest" hidden>
    <span class="lens-suggest-label">No estoy seguro. ¿Alguna de estas?</span>
    <div class="lens-chips"></div>
  </div>

  <div class="lens-field lens-amount">
    <label for="lensAmt">Intensidad</label>
    <input type="range" id="lensAmt" min="0" max="100" step="1" value="${st.intensity}"
           aria-label="Intensidad del filtro">
    <b class="mono" id="lensAmtV">${st.intensity}%</b>
  </div>

  <details class="lens-adv"${isMobile() ? "" : " open"}>
    <summary>Ajustes del preset</summary>
    <div class="lens-adj">${adjRows}</div>
    <div class="lens-adv-foot">
      <button id="lensReset" type="button">Volver al preset del tipo</button>
      <span class="hint">La intensidad multiplica estos siete valores; al 0 % la foto queda tal cual.</span>
    </div>
  </details>

  <p class="hint lens-note">El modelo se ejecuta en tu equipo y la imagen no sale de él. Sabe reconocer
    objetos y escenas; lo que no puede ver —un contraluz, una silueta, un retrato— lo deduce de
    los propios píxeles, y si no está seguro te lo dice y te deja elegir.</p>`;
}

/* ── cableado ────────────────────────────────────────────────── */
function wire(body, q, st, source, preview){
  const sel = q("#lensCat"), amt = q("#lensAmt"), amtV = q("#lensAmtV");
  const rows = [...body.querySelectorAll(".lens-adj-row")];

  const syncAdjRows = () => rows.forEach(r => {
    const k = r.dataset.key;
    r.querySelector("input").value = st.adj[k];
    r.querySelector(".lens-adj-val").textContent = st.adj[k];
  });

  sel.addEventListener("change", () => {
    st.category = sel.value;
    st.manual = true;
    st.adj = { ...CATEGORY_BY_ID[st.category].preset };
    syncAdjRows();
    setBadge(q, st.category === "auto"
      ? { kind:"idle", text:"Elige un tipo o pulsa «Detectar»" }
      : { kind:"manual", text:`Manual · ${catLabel(st.category)}` });
    q("#lensSuggest").hidden = true;
    preview();
  });

  amt.addEventListener("input", () => {
    st.intensity = +amt.value;
    amtV.textContent = st.intensity + "%";
    preview();
  });

  rows.forEach(r => {
    const k = r.dataset.key, input = r.querySelector("input"), val = r.querySelector(".lens-adj-val");
    input.addEventListener("input", () => {
      st.adj[k] = +input.value;
      val.textContent = input.value;
      preview();
    });
  });

  q("#lensReset").addEventListener("click", () => {
    st.adj = { ...CATEGORY_BY_ID[st.category].preset };
    syncAdjRows();
    preview();
  });

  q("#lensDetect").addEventListener("click", () => runDetection(q, st, source, preview));

  // Sugerencias: un toque y ese es el tipo.
  q("#lensSuggest").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if(!b) return;
    sel.value = b.dataset.cat;
    sel.dispatchEvent(new Event("change"));
    setBadge(q, { kind:"manual", text:`Elegido · ${catLabel(b.dataset.cat)}` });
  });

  // Estado inicial de la insignia
  if(st.manual && st.category !== "auto"){
    setBadge(q, { kind:"manual", text:`Guardado · ${catLabel(st.category)}` });
  } else {
    const info = cachedModelInfo();
    setBadge(q, { kind:"idle", text: info ? "Modelo en caché · listo" : "Preparando el modelo…" });
  }
}

function setBadge(q, { kind, text }){
  const b = q("#lensBadge");
  b.className = `lens-badge lens-badge-${kind}`;
  const icon = { ok:"✅", unsure:"🤔", error:"⚠️", busy:"⏳", manual:"✎", idle:"◌" }[kind] || "";
  b.textContent = `${icon} ${text}`.trim();
}

let detecting = false;
async function runDetection(q, st, source, preview){
  if(detecting) return;
  detecting = true;
  const btn = q("#lensDetect");
  btn.disabled = true;
  const info = cachedModelInfo();
  setBadge(q, { kind:"busy", text: info ? "Analizando…" : "Cargando el modelo (sólo la primera vez)…" });
  q("#lensSuggest").hidden = true;

  try{
    await ensureModel();
    setBadge(q, { kind:"busy", text:"Analizando…" });
    const r = await classify(source);
    st.detection = r;

    if(!r.ok || !r.category){
      setBadge(q, { kind:"error", text:"No se pudo clasificar · elige el tipo a mano" });
      return;
    }

    const seen = r.model && r.model.top[0] ? ` · vio «${r.model.top[0].label}»` : "";
    const pct = Math.round(r.confidence * 100);
    // Se aplica la mejor candidata aunque no sea segura: es mejor ver
    // algo y corregirlo que quedarse mirando una foto sin tocar.
    q("#lensCat").value = r.category;
    st.category = r.category;
    st.adj = { ...CATEGORY_BY_ID[r.category].preset };
    st.manual = false;
    q("#lensAmt").dispatchEvent(new Event("input"));
    [...q(".lens-adj").querySelectorAll(".lens-adj-row")].forEach(row => {
      const k = row.dataset.key;
      row.querySelector("input").value = st.adj[k];
      row.querySelector(".lens-adj-val").textContent = st.adj[k];
    });

    if(r.sure){
      setBadge(q, { kind:"ok", text:`${catLabel(r.category)} · ${pct} %${seen} · ${r.model ? r.model.ms : r.ms} ms` });
    } else {
      setBadge(q, { kind:"unsure", text:`Quizá ${catLabel(r.category)} · ${pct} % (< ${Math.round(CONFIDENCE_MIN*100)} %)${seen}` });
      const chips = q(".lens-chips");
      chips.innerHTML = r.suggestions.map(s =>
        `<button type="button" class="lens-chip" data-cat="${s.id}">${catLabel(s.id)} <b>${Math.round(s.p*100)} %</b></button>`).join("");
      q("#lensSuggest").hidden = false;
    }
    preview();
  }catch(err){
    setBadge(q, { kind:"error", text:`Sin modelo (${String(err.message || err).slice(0, 60)}) · elige a mano` });
  }finally{
    detecting = false;
    btn.disabled = false;
  }
}
