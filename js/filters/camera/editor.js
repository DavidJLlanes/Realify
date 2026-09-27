/* ═══════════════════════════════════════════════════════════════
   REALIFY · VENTANA
   Mismo formato que el revelador RAW, el Filtro Vintage, Stickers y el
   creador de memes: ventana a pantalla completa con Cancelar /
   deshacer / rehacer / Aplicar.

     · Escritorio: a la izquierda histograma, espectro, informe del
       ajuste recomendado y semillas; en el centro la vista previa, con
       zoom de verdad hasta 1:1 —el grano y el patrón del sensor sólo se
       juzgan píxel a píxel— y «Comparar»; a la derecha el ajuste
       predefinido, la dosis y las 31 etapas de la cadena.
     · Móvil: la foto ocupa toda la pantalla (mantener pulsado =
       original); abajo, el desplegable de ajuste predefinido, el de
       mando y el control elegido.

   La vista previa ya no escribe en la capa: la cadena se calcula a
   resolución completa en un lienzo de trabajo, igual que antes, y sólo
   se pinta en la ventana. Aplicar entrega ese mismo lienzo al editor.
   ═══════════════════════════════════════════════════════════════ */

import { CHAIN, CHAIN_BY_ID } from "./chain.js";
import { PRESETS } from "./presets.js";
import { normalizeState, varyStages, presetStages } from "./state.js";
import { applyCpuStages, cpuStagesActive } from "./cpustages.js";
import { spectrum } from "../../analysis/fft.js";
import { toast } from "../../ui/toast.js";
import * as engine from "./engine.js";

const MOBILE = "(max-width:900px)";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const REC = "__rec__";

/**
 * `source`: lienzo original (la capa de debajo). `state`: estado de la
 * cadena, se modifica en el sitio. `recommend()` → { state, report }.
 * `onAccept(resultCanvas)`; `onClose()`.
 */
export function openRealifyEditor({ source, state, title = "Realify", editing = false, recommend, onAccept, onClose }){
  const W = source.width, H = source.height;
  const work = document.createElement("canvas"); work.width = W; work.height = H;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  let closed = false, accepting = false, showOriginal = false, onlyActive = false, memory = null, report = "";
  const history = [], future = [];
  const snap = () => JSON.stringify({ stages: state.stages, seed: state.seed, camSeed: state.camSeed, dose: state.dose });
  const remember = () => { history.push(snap()); if(history.length > 60) history.shift(); future.length = 0; syncActions(); };
  const restoreSnap = s => { Object.assign(state, normalizeState(JSON.parse(s))); state.solo = null; engine.invalidateCache(); syncAll(); schedule(); };

  const presetOptions = () => `<option value="">Valores actuales</option><option value="${REC}">✦ Ajuste recomendado para esta foto</option>` +
    Object.keys(PRESETS).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  const mb = engine.vramEstimate(W, H) / 1048576;

  const root = document.createElement("section");
  root.className = "rf-editor";
  root.innerHTML = `
    <header class="rf-topbar">
      <button class="rf-cancel" type="button">Cancelar</button>
      <button class="rf-close" type="button" aria-label="Cancelar">✕</button>
      <div class="rf-title"><b>${esc(title)}</b><span class="rf-status">Simulación de captura</span></div>
      <div class="rf-actions">
        <button type="button" data-action="vary" title="Desvía un poco cada valor activo y sortea una semilla de disparo nueva" aria-label="Variar">⚄</button>
        <button type="button" data-action="undo" aria-label="Deshacer">↶</button>
        <button type="button" data-action="redo" aria-label="Rehacer">↷</button>
        <button class="primary" type="button" data-action="accept">${editing ? "Guardar cambios" : "Aplicar"}</button>
      </div>
    </header>
    <main class="rf-workspace">
      <aside class="rf-left">
        <div class="rf-box"><span>Histograma</span><canvas class="rf-hist" width="256" height="76"></canvas></div>
        <div class="rf-box"><span>Espectro</span><canvas class="rf-spec" width="256" height="256"></canvas></div>
        <div class="rf-box rf-report-box" hidden><span>Ajuste recomendado</span><p class="rf-report"></p></div>
        <div class="rf-box"><span>Semillas</span><div class="rf-seeds"></div>
          <p class="rf-hint">La semilla de <b>cámara</b> fija el patrón del sensor, idéntico en todas las fotos de un mismo equipo: mantenla en un lote para que todas compartan esa huella. La de <b>disparo</b> cambia el grano de cada foto.</p>
          ${mb > 700 ? `<p class="rf-hint rf-warn">La cadena completa puede usar hasta ${Math.round(mb)} MB de memoria de vídeo. Si va a tirones, reduce la imagen antes.</p>` : ""}
        </div>
      </aside>
      <div class="rf-preview">
        <canvas></canvas>
        <div class="rf-zoom">Encajar</div>
        <div class="rf-view-buttons">
          <button type="button" class="rf-compare" title="Mantén pulsado para ver el original">Comparar</button>
          <button type="button" data-zoom="1" title="Ver a tamaño real (1:1)">1:1</button>
          <button type="button" data-zoom="0" title="Encajar vista">⌗</button>
        </div>
      </div>
      <aside class="rf-controls">
        <label class="rf-preset"><span>Ajuste predefinido</span><select data-role="preset">${presetOptions()}</select></label>
        <div class="rf-dose"></div>
        <div class="rf-tools">
          <button type="button" data-tool="only">Sólo activas</button>
          <button type="button" data-tool="all">Apagar todo</button>
        </div>
        <div class="rf-stages"></div>
      </aside>
    </main>
    <footer class="rf-mobile">
      <p class="rf-mobile-report" hidden></p>
      <select data-role="preset" aria-label="Ajuste predefinido">${presetOptions()}</select>
      <select class="rf-picker" aria-label="Mando"></select>
      <div class="rf-mobile-control"></div>
    </footer>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const stageCanvas = $(".rf-preview canvas"), sctx = stageCanvas.getContext("2d");
  const preview = $(".rf-preview");

  /* ── Render de la cadena ─────────────────────────────────────── */
  let frame = 0, cpuTimer = 0, cpuTicket = 0, statsTimer = 0, lastMs = 0, withCpu = false;
  const activeCount = () => CHAIN.filter(s => state.stages[s.id].on).length;
  const setStatus = extra => { $(".rf-status").textContent = `${activeCount()} de ${CHAIN.length} etapas${extra ? " · " + extra : ""}`; };
  function render(stable = false){
    engine.setSeed(state.seed); engine.setCameraSeed(state.camSeed);
    lastMs = engine.renderTo(wctx, state.stages, { dose: state.dose / 100, solo: state.solo, stable });
    withCpu = false;
    setStatus(`${Math.round(lastMs)} ms`);
    cpuTicket++;
    if(!stable) scheduleCpu();
    paint(); scheduleStats();
  }
  const schedule = () => { if(!frame && !closed) frame = requestAnimationFrame(() => { frame = 0; if(!closed) render(); }); };
  /* Las etapas de CPU (limpieza espectral, JPEG) son lentas: se aplican
     cuando los mandos llevan un instante quietos, sobre una copia, y se
     descartan si mientras tanto hubo otro render. */
  function scheduleCpu(){
    clearTimeout(cpuTimer);
    if(!cpuStagesActive(state.stages, state.dose / 100)) return;
    cpuTimer = setTimeout(async () => {
      const ticket = cpuTicket;
      const copy = document.createElement("canvas"); copy.width = W; copy.height = H;
      copy.getContext("2d").drawImage(work, 0, 0);
      setStatus("etapas de CPU…");
      await applyCpuStages(copy, state.stages, state.dose / 100, () => {});
      if(closed || ticket !== cpuTicket) return;
      wctx.save(); wctx.globalCompositeOperation = "copy"; wctx.drawImage(copy, 0, 0); wctx.restore();
      withCpu = true; setStatus("con CPU"); paint(); scheduleStats();
    }, 380);
  }

  /* ── Vista: encajar o zoom real, con desplazamiento ─────────── */
  let view = { zoom: 0, cx: W / 2, cy: H / 2 };   // zoom 0 = encajar; si no, píxeles de pantalla por píxel de imagen
  const fitScale = () => {
    const r = preview.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const pad = matchMedia(MOBILE).matches ? 0 : 24 * dpr;
    return Math.min((r.width * dpr - pad * 2) / W, (r.height * dpr - pad * 2) / H);
  };
  const scaleNow = () => view.zoom || fitScale();
  function paint(){
    if(closed) return;
    const r = preview.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(r.width * dpr)), ch = Math.max(1, Math.round(r.height * dpr));
    if(stageCanvas.width !== cw || stageCanvas.height !== ch){ stageCanvas.width = cw; stageCanvas.height = ch; }
    const k = scaleNow();
    if(!view.zoom){ view.cx = W / 2; view.cy = H / 2; }
    // Que el centro no se salga de la imagen
    const halfW = cw / 2 / k, halfH = ch / 2 / k;
    view.cx = W <= halfW * 2 ? W / 2 : Math.max(halfW, Math.min(W - halfW, view.cx));
    view.cy = H <= halfH * 2 ? H / 2 : Math.max(halfH, Math.min(H - halfH, view.cy));
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, cw, ch);
    sctx.imageSmoothingEnabled = k < 1; sctx.imageSmoothingQuality = "high";
    sctx.setTransform(k, 0, 0, k, cw / 2 - view.cx * k, ch / 2 - view.cy * k);
    sctx.drawImage(showOriginal ? source : work, 0, 0);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    $(".rf-zoom").textContent = view.zoom ? `${Math.round(view.zoom * 100 / dpr)} %` : `Encajar · ${Math.round(k * 100 / dpr)} %`;
  }
  const setZoom = (z, ax, ay) => {
    const dpr = Math.min(devicePixelRatio || 1, 2), fitK = fitScale();
    const next = z <= fitK * 1.001 ? 0 : Math.min(8 * dpr, z);
    if(next && ax != null){
      const k = scaleNow(), r = preview.getBoundingClientRect();
      const ix = view.cx + ((ax - r.left) * dpr - stageCanvas.width / 2) / k, iy = view.cy + ((ay - r.top) * dpr - stageCanvas.height / 2) / k;
      view.cx = ix - ((ax - r.left) * dpr - stageCanvas.width / 2) / next;
      view.cy = iy - ((ay - r.top) * dpr - stageCanvas.height / 2) / next;
    }
    view.zoom = next; paint();
  };
  root.querySelectorAll("[data-zoom]").forEach(b => b.addEventListener("click", () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    setZoom(+b.dataset.zoom ? dpr : 0);
  }));
  preview.addEventListener("wheel", e => { e.preventDefault(); setZoom(scaleNow() * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
  preview.addEventListener("dblclick", e => {
    if(e.target.closest("button")) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    setZoom(view.zoom ? 0 : dpr, e.clientX, e.clientY);
  });
  const pointers = new Map(); let drag = null, pinch = null;
  preview.addEventListener("pointerdown", e => {
    if(e.target.closest("button")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try{ preview.setPointerCapture(e.pointerId); }catch{}
    if(pointers.size === 2){
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: scaleNow(), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag = null; if(showOriginal){ showOriginal = false; paint(); }
      return;
    }
    if(view.zoom){ drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; preview.classList.add("is-panning"); }
    else if(e.pointerType === "touch"){ showOriginal = true; paint(); }
  });
  preview.addEventListener("pointermove", e => {
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if(pinch && pointers.size === 2){
      const [a, b] = [...pointers.values()];
      setZoom(pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.d, pinch.mx, pinch.my);
    } else if(drag){
      const k = scaleNow();
      view.cx = drag.cx - (e.clientX - drag.x) * dpr / k; view.cy = drag.cy - (e.clientY - drag.y) * dpr / k; paint();
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if(pointers.size < 2) pinch = null;
    if(!pointers.size){ drag = null; preview.classList.remove("is-panning"); if(showOriginal){ showOriginal = false; paint(); } }
  };
  preview.addEventListener("pointerup", endPointer); preview.addEventListener("pointercancel", endPointer);
  const cmp = $(".rf-compare");
  cmp.addEventListener("pointerdown", e => { e.preventDefault(); showOriginal = true; paint(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => cmp.addEventListener(ev, () => { if(showOriginal){ showOriginal = false; paint(); } }));

  /* ── Histograma y espectro (escritorio) ─────────────────────── */
  const statsSample = document.createElement("canvas");
  function scheduleStats(){
    clearTimeout(statsTimer);
    if(matchMedia(MOBILE).matches) return;
    statsTimer = setTimeout(() => {
      if(closed) return;
      const k = Math.min(1, 512 / Math.max(W, H));
      statsSample.width = Math.max(1, Math.round(W * k)); statsSample.height = Math.max(1, Math.round(H * k));
      const sx = statsSample.getContext("2d", { willReadFrequently: true });
      sx.drawImage(work, 0, 0, statsSample.width, statsSample.height);
      const d = sx.getImageData(0, 0, statsSample.width, statsSample.height).data, bins = 64;
      const r = new Float64Array(bins), g = new Float64Array(bins), b = new Float64Array(bins);
      for(let i = 0; i < d.length; i += 4){ r[d[i] * bins >> 8]++; g[d[i + 1] * bins >> 8]++; b[d[i + 2] * bins >> 8]++; }
      const hc = $(".rf-hist"), hx = hc.getContext("2d"), mx = Math.max(1, ...r, ...g, ...b);
      hx.clearRect(0, 0, hc.width, hc.height); hx.globalCompositeOperation = "lighter";
      for(const [arr, col] of [[r, "rgba(255,90,90,.6)"], [g, "rgba(90,255,120,.6)"], [b, "rgba(90,150,255,.6)"]]){
        hx.fillStyle = col; hx.beginPath(); hx.moveTo(0, hc.height);
        for(let i = 0; i < bins; i++) hx.lineTo(i * hc.width / bins, hc.height - arr[i] / mx * hc.height);
        hx.lineTo(hc.width, hc.height); hx.closePath(); hx.fill();
      }
      hx.globalCompositeOperation = "source-over";
      spectrum(statsSample, statsSample.width, statsSample.height, $(".rf-spec"));
    }, 180);
  }

  /* ── Controles ───────────────────────────────────────────────── */
  const slider = (label, value, min, max, onInput, { track = true, onDown = null, onUp = null } = {}) => {
    const el = document.createElement("div");
    el.className = "rf-field";
    el.innerHTML = `<span>${esc(label)}<b>${value}</b></span><div class="rf-slider-row"><button type="button" class="rf-step" data-step="-1" aria-label="Disminuir ${esc(label)}">−</button><input type="range" min="${min}" max="${max}" step="1" value="${value}" aria-label="${esc(label)}"><button type="button" class="rf-step" data-step="1" aria-label="Aumentar ${esc(label)}">+</button></div>`;
    const input = el.querySelector("input"), out = el.querySelector("b");
    let started = false;
    const set = (v, record) => { v = Math.max(min, Math.min(max, Math.round(+v))); input.value = v; if(record && track) remember(); out.textContent = onInput(v) ?? v; };
    input.addEventListener("pointerdown", () => onDown?.());
    input.addEventListener("pointerup", () => onUp?.());
    input.addEventListener("input", () => { set(input.value, !started); started = true; });
    input.addEventListener("change", () => { started = false; onUp?.(); });
    input.addEventListener("dblclick", () => { /* sin valor «cero» común: nada */ });
    el.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => { set(+input.value + +b.dataset.step, true); onUp?.(); }));
    return el;
  };
  /* Valor que se ve junto a un mando: con dosis < 100 %, también el efectivo («50 → 25»). */
  const valueLabel = (id, key) => {
    const raw = state.stages[id].p[key], dose = state.dose / 100;
    if(dose >= 1) return String(raw);
    const eff = Math.round(engine.effParams(state.stages, id, dose)[key]);
    return eff === raw ? String(raw) : `${raw} → ${eff}`;
  };
  const clearPreset = () => root.querySelectorAll("[data-role=preset]").forEach(s => { s.value = ""; });

  function paramControl(s, pr){
    const st = state.stages[s.id];
    if(pr.type === "choice"){
      const el = document.createElement("label");
      el.className = "rf-field rf-choice";
      el.innerHTML = `<span>${esc(pr.label)}</span><select aria-label="${esc(s.name)}: ${esc(pr.label)}">${pr.options.map(o => `<option value="${esc(o.v)}"${o.v === st.p[pr.k] ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
      el.querySelector("select").addEventListener("change", e => { remember(); st.p[pr.k] = e.target.value; clearPreset(); engine.invalidateCache(); schedule(); });
      return el;
    }
    return slider(pr.label, st.p[pr.k], pr.min ?? 0, 100, v => {
      st.p[pr.k] = v; clearPreset(); schedule(); return valueLabel(s.id, pr.k);
    }, {
      // Arrastrar: se congela lo anterior de la cadena para que vaya fluido
      onDown: () => { if(!CHAIN_BY_ID[s.id].cpu) engine.buildCache(state.stages, state.dose / 100, state.solo, engine.STEP_INDEX[s.id]); },
      onUp: () => engine.invalidateCache()
    });
  }
  function stageHead(s, i, flat = false){
    const st = state.stages[s.id];
    const head = document.createElement("div");
    head.className = "rf-stage-head";
    head.innerHTML = `<span class="rf-num">${i + 1}</span><span class="rf-name">${esc(s.name)}</span>
      <button type="button" class="rf-solo${state.solo === s.id ? " on" : ""}" title="Aislar esta etapa: ver sólo su efecto">S</button>
      <label class="rf-switch" title="Activar o desactivar"><input type="checkbox"${st.on ? " checked" : ""} aria-label="Activar ${esc(s.name)}"><i></i></label>`;
    head.querySelector("input").addEventListener("change", e => { remember(); st.on = e.target.checked; engine.invalidateCache(); syncAll(); schedule(); });
    head.querySelector(".rf-solo").addEventListener("click", e => { e.stopPropagation(); state.solo = state.solo === s.id ? null : s.id; engine.invalidateCache(); syncAll(); schedule(); });
    if(!flat) head.addEventListener("click", e => { if(e.target.closest("input,button,label")) return; head.parentElement.classList.toggle("open"); });
    return head;
  }
  const openStages = new Set();
  function buildStages(){
    const host = $(".rf-stages"); host.innerHTML = "";
    CHAIN.forEach((s, i) => {
      if(onlyActive && !state.stages[s.id].on) return;
      const sec = document.createElement("section");
      sec.className = "rf-stage" + (state.stages[s.id].on ? " on" : "") + (openStages.has(s.id) ? " open" : "");
      sec.appendChild(stageHead(s, i));
      const body = document.createElement("div"); body.className = "rf-stage-body";
      body.innerHTML = `<p class="rf-note">${esc(s.note)}</p>`;
      for(const pr of s.params) body.appendChild(paramControl(s, pr));
      sec.appendChild(body);
      new MutationObserver(() => { if(sec.classList.contains("open")) openStages.add(s.id); else openStages.delete(s.id); }).observe(sec, { attributes: true, attributeFilter: ["class"] });
      host.appendChild(sec);
    });
    if(!host.children.length) host.innerHTML = `<p class="rf-hint">No hay etapas activas.</p>`;
  }
  function buildDose(host){
    host.innerHTML = "";
    // Al soltar se rehacen las etiquetas «50 → 25» de los mandos, que
    // dependen de la dosis.
    host.appendChild(slider("Dosis (fuerza de toda la cadena)", state.dose, 0, 100, v => {
      state.dose = v; engine.invalidateCache(); schedule(); return `${v} %`;
    }, { onUp: () => buildStages() }));
    host.querySelector("b").textContent = `${state.dose} %`;
  }
  function buildSeeds(host){
    host.innerHTML = `
      <div class="rf-seed"><span>Disparo</span><input type="number" min="0" max="99999" data-seed="seed" value="${state.seed}"><button type="button" data-new="seed" title="Otra semilla de disparo">⟳</button></div>
      <div class="rf-seed"><span>Cámara</span><input type="number" min="0" max="99999" data-seed="camSeed" value="${state.camSeed}"><button type="button" data-new="camSeed" title="Otro sensor">⟳</button></div>`;
    host.querySelectorAll("[data-seed]").forEach(inp => inp.addEventListener("change", () => {
      remember(); state[inp.dataset.seed] = Math.round(Math.max(0, Math.min(99999, +inp.value || 0))); inp.value = state[inp.dataset.seed];
      engine.invalidateCache(); schedule();
    }));
    host.querySelectorAll("[data-new]").forEach(b => b.addEventListener("click", () => {
      remember(); state[b.dataset.new] = Math.floor(Math.random() * 99999); engine.invalidateCache(); syncAll(); schedule();
    }));
  }

  /* Móvil: un único desplegable con todos los mandos y su control debajo */
  let pick = "dose";
  function buildPicker(){
    const p = $(".rf-picker");
    p.innerHTML = `<optgroup label="General"><option value="dose">Dosis</option><option value="seeds">Semillas</option><option value="report">Informe del ajuste recomendado</option></optgroup>` +
      CHAIN.map((s, i) => `<optgroup label="${i + 1}. ${esc(s.name)}${state.stages[s.id].on ? " ●" : ""}"><option value="stage:${s.id}">${i + 1}. ${esc(s.name)} · activar / aislar</option>${s.params.map(pr => `<option value="param:${s.id}:${pr.k}">${i + 1}. ${esc(s.name)} · ${esc(pr.label)}</option>`).join("")}</optgroup>`).join("");
    p.value = pick;
    if(p.value !== pick){ pick = "dose"; p.value = "dose"; }
  }
  function buildMobileControl(){
    const host = $(".rf-mobile-control"); host.innerHTML = "";
    if(pick === "dose"){ buildDose(host); return; }
    if(pick === "seeds"){ const d = document.createElement("div"); d.className = "rf-seeds"; buildSeeds(d); host.appendChild(d); return; }
    if(pick === "report"){ host.innerHTML = `<p class="rf-hint">${report ? esc(report) : "Elige «✦ Ajuste recomendado para esta foto» en el primer desplegable para medir la imagen."}</p>`; return; }
    const [kind, id, key] = pick.split(":"), s = CHAIN_BY_ID[id], i = CHAIN.indexOf(s);
    if(kind === "stage"){ const box = document.createElement("div"); box.className = "rf-stage on"; box.appendChild(stageHead(s, i, true)); host.appendChild(box); return; }
    const pr = s.params.find(p => p.k === key);
    const c = paramControl(s, pr);
    if(!state.stages[id].on){
      const note = document.createElement("p"); note.className = "rf-hint"; note.textContent = "Esta etapa está apagada: actívala en «Activar / aislar» para que el mando tenga efecto.";
      host.appendChild(note);
    }
    host.appendChild(c);
  }
  $(".rf-picker").addEventListener("change", e => { pick = e.target.value; buildMobileControl(); });

  function syncAll(){
    buildStages(); buildDose($(".rf-dose")); buildSeeds($(".rf-left .rf-seeds"));
    buildPicker(); buildMobileControl();
    $("[data-tool=only]").classList.toggle("on", onlyActive);
    $("[data-tool=all]").textContent = activeCount() ? "Apagar todo" : "Encender todo";
    syncActions();
  }
  const syncActions = () => {
    $("[data-action=undo]").disabled = !history.length || accepting;
    $("[data-action=redo]").disabled = !future.length || accepting;
  };
  const showReport = text => {
    report = text;
    $(".rf-report-box").hidden = !text; $(".rf-report").textContent = text;
    const m = $(".rf-mobile-report"); m.hidden = !text; m.textContent = text;
  };
  $(".rf-mobile-report").addEventListener("click", () => { $(".rf-mobile-report").hidden = true; });

  /* ── Ajustes predefinidos, recomendado, herramientas ─────────── */
  root.querySelectorAll("[data-role=preset]").forEach(sel => sel.addEventListener("change", () => {
    const v = sel.value;
    if(!v) return;
    remember();
    if(v === REC){
      try{
        const { state: next, report: rep } = recommend();
        Object.assign(state, normalizeState(next)); state.solo = null;
        showReport("Medido: " + (rep || []).join(" · ") + ". Revísalo y pulsa Aplicar para conservarlo.");
      }catch(error){ showReport(`No se pudo calcular el ajuste: ${error.message}`); }
      clearPreset();
    } else {
      const pr = PRESETS[v]; if(!pr) return;
      state.stages = presetStages(pr); state.solo = null;
      root.querySelectorAll("[data-role=preset]").forEach(s => { s.value = v; });
    }
    engine.invalidateCache(); syncAll(); schedule();
  }));
  $("[data-tool=only]").addEventListener("click", () => { onlyActive = !onlyActive; syncAll(); });
  $("[data-tool=all]").addEventListener("click", () => {
    remember();
    if(activeCount()){ memory = Object.fromEntries(CHAIN.map(s => [s.id, state.stages[s.id].on])); CHAIN.forEach(s => state.stages[s.id].on = false); }
    else CHAIN.forEach(s => state.stages[s.id].on = memory ? memory[s.id] !== false : true);
    clearPreset(); engine.invalidateCache(); syncAll(); schedule();
  });
  $("[data-action=vary]").addEventListener("click", () => {
    if(accepting) return;
    remember(); varyStages(state.stages); state.seed = Math.floor(Math.random() * 99999);
    clearPreset(); engine.invalidateCache(); syncAll(); schedule();
  });
  $("[data-action=undo]").addEventListener("click", () => { const p = history.pop(); if(!p) return; future.push(snap()); restoreSnap(p); });
  $("[data-action=redo]").addEventListener("click", () => { const n = future.pop(); if(!n) return; history.push(snap()); restoreSnap(n); });

  /* ── Aplicar / cancelar ──────────────────────────────────────── */
  $(".rf-cancel").addEventListener("click", () => close());
  $(".rf-close").addEventListener("click", () => close());
  $("[data-action=accept]").addEventListener("click", async () => {
    if(accepting || closed) return;
    accepting = true; syncActions();
    const button = $("[data-action=accept]"); button.disabled = true; button.textContent = "Aplicando…";
    root.querySelectorAll(".rf-controls input,.rf-controls select,.rf-controls button,.rf-mobile select,.rf-mobile input,.rf-mobile button,[data-action=vary]").forEach(el => el.disabled = true);
    try{
      // «Solo» es sólo para inspeccionar: se aplica la cadena completa,
      // por el mismo camino que la vista previa.
      state.solo = null;
      clearTimeout(cpuTimer); cpuTicket++;
      engine.invalidateCache();
      render(true);
      setStatus("aplicando etapas de CPU…");
      await applyCpuStages(work, state.stages, state.dose / 100, () => {});
      if(closed) return;
      await onAccept(work);
      close(true);
    }catch(error){
      toast(error?.message || "No se pudo aplicar Realify", "err");
      accepting = false; button.disabled = false; button.textContent = editing ? "Guardar cambios" : "Aplicar";
      root.querySelectorAll("input,select,button").forEach(el => el.disabled = false); syncActions();
    }
  });
  const onKey = e => {
    if(closed) return;
    if(e.target.matches?.("input[type=number]")) return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); $(e.shiftKey ? "[data-action=redo]" : "[data-action=undo]").click(); }
    if(e.key === "Escape" && !accepting) close();
    if(e.key === "0" && !e.target.matches?.("input,select")) setZoom(0);
  };
  const observer = new ResizeObserver(() => paint());
  observer.observe(preview);
  function close(applied = false){
    if(closed) return;
    closed = true;
    cancelAnimationFrame(frame); clearTimeout(cpuTimer); clearTimeout(statsTimer); cpuTicket++;
    observer.disconnect(); document.removeEventListener("keydown", onKey, true);
    state.solo = null; engine.invalidateCache();
    root.remove();
    if(!applied) work.width = work.height = 1;
    onClose?.(applied);
  }
  document.addEventListener("keydown", onKey, true);
  syncAll(); render();
  return { close };
}
