/* ═══════════════════════════════════════════════════════════════
   CURVAS · EDITOR A PANTALLA COMPLETA
   Mismo armazón que el revelador RAW (raw/ui.js): Cancelar / deshacer
   / rehacer / Aplicar arriba y la imagen en el centro.

     · Escritorio: a la izquierda los estilos, con una miniatura de la
       propia foto con cada estilo aplicado (y su curva en la esquina);
       en el centro la imagen; a la derecha el canal, la curva, el
       vínculo luminosidad ↔ color y los botones de restablecer.
     · Móvil: la imagen arriba y, debajo, un desplegable de estilo que
       abre una hoja con las mismas miniaturas, los canales, la curva
       y una fila de acciones.

   Aquí sólo está la presentación: runAdjust (adjust.js) sigue haciendo
   la vista previa sobre la capa, el aplicar como capa de filtro y el
   historial del documento. En cada `onPreview` se copia la capa a este
   lienzo; «Antes» enseña el original mientras se mantiene pulsado.
   ═══════════════════════════════════════════════════════════════ */

import { curveEditor, curveThumb, CHANNEL_COLORS, CURVE_PRESETS, userCurvePresets, saveUserCurvePresets, applyCurves } from "./curves.js";
import { anyDialogOpen, promptDlg } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { premiumSwitch, premiumPref, dockPremium } from "../ui/premium.js";
import { autoCurvePoints } from "./tonepremium.js";

const MOBILE = "(max-width:900px)";
const CH = ["rgb", "r", "g", "b", "lum"];
const CH_LABEL = { rgb: "RGB", r: "Rojo", g: "Verde", b: "Azul", lum: "Luz" };
const ID = () => [[0, 0], [255, 255]];
const THUMB = 112;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const isId = p => p.length === 2 && p[0][0] === 0 && p[0][1] === 0 && p[1][0] === 255 && p[1][1] === 255;
const copyPts = p => p.map(q => [q[0], q[1]]);

export function curvesFullscreen({ state, hist, preview, source, title = "Curvas", edit = false }){
  let resolve = null, closed = false, comparing = false, frame = 0, layer = null;

  /* Interruptor Premium 👑 (móvil: arriba a la izquierda, junto a ✕;
     se coloca al presentar el editor, ver present()) */
  const premium = premiumSwitch({ checked: !!state.premium, title: "Curvas de alta calidad: coma flotante sin bandas, curva maestra sin cambiar el tono ni sobresaturar (función Premium)",
    onChange: on => { state.premium = on; premiumPref.set("curves", on); commit(); preview(); } });

  /* ── Deshacer / rehacer propios del editor ── */
  const snap = () => JSON.stringify({ points: state.points, link: state.link, mix: state.mix, preset: state.preset, premium: !!state.premium });
  let last = snap();
  const past = [], future = [];
  const commit = () => {
    const now = snap();
    if(now === last) return;
    past.push(last); if(past.length > 60) past.shift();
    future.length = 0; last = now; syncActions();
  };
  const restoreSnap = json => {
    const o = JSON.parse(json);
    for(const k of CH) state.points[k] = o.points[k] ? copyPts(o.points[k]) : ID();
    state.link = o.link; state.mix = o.mix; state.preset = o.preset;
    if(state.premium !== !!o.premium){ state.premium = !!o.premium; premiumPref.set("curves", state.premium); premium?.set(state.premium); }
    last = json; refreshAll(); preview();
  };
  const undo = () => { if(!past.length) return; future.push(snap()); restoreSnap(past.pop()); syncActions(); };
  const redo = () => { if(!future.length) return; past.push(snap()); restoreSnap(future.pop()); syncActions(); };

  /* ── Estilos ── */
  const allPresets = () => [
    ...CURVE_PRESETS.map(([id, name, set]) => ({ id, name, set, mine: false })),
    ...userCurvePresets().map(u => ({ id: u.id, name: u.name, set: u.points, mine: true }))
  ];
  const presetName = () => {
    const p = state.preset && allPresets().find(x => x.id === state.preset);
    if(p) return p.name;
    return CH.every(k => isId(state.points[k])) ? "Sin estilo" : "Personalizada";
  };

  /* Miniaturas: la foto (recorte cuadrado centrado, 112 px) con cada
     estilo aplicado, más su curva en la esquina. Se calculan una vez. */
  const thumbCache = new Map();
  let thumbBase = null;
  const baseThumb = () => {
    if(thumbBase || !source) return thumbBase;
    const c = document.createElement("canvas"); c.width = c.height = THUMB;
    const x = c.getContext("2d", { willReadFrequently: true });
    const s = Math.min(source.width, source.height);
    x.imageSmoothingQuality = "high";
    x.fillStyle = "#16181b"; x.fillRect(0, 0, THUMB, THUMB);
    x.drawImage(source, (source.width - s) / 2, (source.height - s) / 2, s, s, 0, 0, THUMB, THUMB);
    thumbBase = x.getImageData(0, 0, THUMB, THUMB);
    return thumbBase;
  };
  const thumbFor = p => {
    const key = p.id + JSON.stringify(p.set);
    if(thumbCache.has(key)) return thumbCache.get(key);
    const base = baseThumb();
    const c = document.createElement("canvas"); c.width = c.height = THUMB;
    const x = c.getContext("2d");
    if(base){
      const d = new ImageData(new Uint8ClampedArray(base.data), THUMB, THUMB);
      applyCurves(d.data, { points: p.set, link: false, mix: 50 });
      x.putImageData(d, 0, 0);
    }
    const t = curveThumb(p.set, 40);
    x.globalAlpha = .92; x.drawImage(t, THUMB - 42, THUMB - 42, 40, 40);
    const url = c.toDataURL("image/jpeg", .86);
    thumbCache.set(key, url);
    return url;
  };
  const presetButtons = cls => allPresets().map(p => `
    <button type="button" class="${cls}${p.id === state.preset ? " on" : ""}" data-preset="${esc(p.id)}" aria-pressed="${p.id === state.preset}" title="${esc(p.name)}">
      <img src="${thumbFor(p)}" alt="" draggable="false"><span>${esc(p.name)}</span>
      ${p.mine ? `<i class="cvf-del" data-del="${esc(p.id)}" role="button" aria-label="Borrar estilo ${esc(p.name)}">✕</i>` : ""}
    </button>`).join("");

  /* ── Marcado ── */
  const root = document.createElement("section");
  root.className = "cv-editor";
  root.innerHTML = `
    <header class="cvf-topbar">
      <button class="cvf-cancel" type="button">Cancelar</button>
      <button class="cvf-close" type="button" aria-label="Cancelar">✕</button>
      <div class="cvf-title"><b>${esc(title)}</b><span class="cvf-sub"></span></div>
      <div class="cvf-actions">
        <button type="button" data-a="undo" aria-label="Deshacer">↶</button>
        <button type="button" data-a="redo" aria-label="Rehacer">↷</button>
        <button class="primary" type="button" data-a="accept">${edit ? "Guardar cambios" : "Aplicar"}</button>
      </div>
    </header>
    <main class="cvf-workspace">
      <aside class="cvf-left">
        <h3>Estilos</h3>
        <div class="cvf-presets"></div>
        <button type="button" class="cvf-wide" data-a="save">＋ Guardar estilo actual…</button>
        <p class="cvf-note">Clic derecho sobre un estilo propio para borrarlo.</p>
      </aside>
      <div class="cvf-stage"><canvas></canvas><button type="button" class="cvf-compare" aria-label="Ver la imagen original mientras se mantiene pulsado">◐ Antes</button></div>
      <aside class="cvf-right">
        <h3>Canal</h3>
        <div class="cvf-slot-channels"></div>
        <div class="cvf-slot-host"></div>
        <div class="cvf-seg cvf-view"><button type="button" data-view="one">Un panel</button><button type="button" data-view="rgb3">R · G · B a la vez</button></div>
        <div class="cvf-slot-link"></div>
        <div class="cvf-seg cvf-resets"><button type="button" data-a="auto" title="Calcula una curva para esta foto (negro, blanco y medios; con Premium, también neutraliza las dominantes)">Automático</button><button type="button" data-a="reset">Restablecer canal</button><button type="button" data-a="resetAll">Restablecer todo</button></div>
        <p class="cvf-note">Clic para añadir un punto y arrastrar para moverlo. Para quitarlo: clic derecho, doble clic o arrastrarlo fuera del cuadro. Las demás curvas se ven en tenue y el histograma de la imagen, detrás.</p>
      </aside>
    </main>
    <footer class="cvf-mobile">
      <div class="cvf-row">
        <div class="cvf-pick"><select aria-hidden="true" tabindex="-1"><option></option></select><button type="button" class="cvf-pick-hit" aria-haspopup="dialog"></button></div>
        <button type="button" class="cvf-icon cvf-auto" data-a="auto" aria-label="Curva automática" title="Curva automática">Auto</button>
        <button type="button" class="cvf-icon" data-a="reset" aria-label="Restablecer canal">⟲</button>
      </div>
      <div class="cvf-mslot-channels"></div>
      <div class="cvf-mslot-host"></div>
      <div class="cvf-mslot-link"></div>
    </footer>
    <div class="cvf-sheet" role="dialog" aria-modal="true" aria-label="Estilos de curvas" hidden>
      <div class="cvf-sheet-panel">
        <header><b>Estilos</b><button type="button" class="cvf-sheet-close" aria-label="Cerrar">✕</button></header>
        <div class="cvf-sheet-grid"></div>
        <button type="button" class="cvf-wide cvf-sheet-save" data-a="save">＋ Guardar estilo actual…</button>
      </div>
    </div>`;
  const $ = s => root.querySelector(s);

  /* Controles que viven en el panel derecho (escritorio) o en el pie
     (móvil): son los mismos nodos, se mueven al cambiar de tamaño. */
  const channels = document.createElement("div");
  channels.className = "cvf-channels";
  channels.innerHTML = CH.map(k => `<button type="button" data-ch="${k}" style="--c:${CHANNEL_COLORS[k]}">${CH_LABEL[k]}</button>`).join("");
  const host = document.createElement("div");
  host.className = "cvf-host";
  const linkBox = document.createElement("div");
  linkBox.className = "cvf-linkbox";
  linkBox.innerHTML = `
    <div class="cvf-linkrow">
      <label class="cvf-toggle"><input type="checkbox"> Vincular luminosidad y color</label>
    </div>
    <div class="cvf-mix" hidden>
      <span>Reparto color ↔ luminosidad <b></b></span>
      <input type="range" min="0" max="100" step="1" aria-label="Reparto entre color y luminosidad">
    </div>`;
  const linkInput = linkBox.querySelector("input[type=checkbox]");
  const mixRow = linkBox.querySelector(".cvf-mix"), mixInput = mixRow.querySelector("input"), mixVal = mixRow.querySelector("b");

  const place = () => {
    const m = matchMedia(MOBILE).matches;
    $(m ? ".cvf-mslot-channels" : ".cvf-slot-channels").appendChild(channels);
    $(m ? ".cvf-mslot-host" : ".cvf-slot-host").appendChild(host);
    $(m ? ".cvf-mslot-link" : ".cvf-slot-link").appendChild(linkBox);
    if(m && state.view !== "one") state.view = "one";
    if(!m) closeSheet();
    renderEditors();
  };

  /* ── Editores de curva ── */
  let editors = [];
  const others = ch => CH.filter(k => k !== ch && !(state.link && (k === "lum" || k === "rgb") && (ch === "lum" || ch === "rgb")))
    .filter(k => !isId(state.points[k]))
    .map(k => ({ points: state.points[k], color: CHANNEL_COLORS[k] }));
  const setPts = (ch, pts) => {
    state.points[ch] = pts; state.preset = null;
    if(state.link && (ch === "rgb" || ch === "lum")) state.points[ch === "rgb" ? "lum" : "rgb"] = copyPts(pts);
    preview(); syncLabels();
  };
  const onEnd = () => { commit(); refreshAll(); };
  function renderEditors(){
    host.innerHTML = ""; editors = [];
    root.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
    if(state.view === "rgb3" && !matchMedia(MOBILE).matches){
      const grid = document.createElement("div");
      grid.className = "cvf-rgb3";
      for(const ch of ["r", "g", "b"]){
        const cell = document.createElement("div");
        cell.innerHTML = `<small style="color:${CHANNEL_COLORS[ch]}">${CH_LABEL[ch]}</small>`;
        const ed = curveEditor({ getPoints: () => state.points[ch], setPoints: pts => setPts(ch, pts), hist, channel: () => ch,
          overlays: () => others(ch), maxWidth: 400, onEnd });
        cell.appendChild(ed.el); grid.appendChild(cell); editors.push(ed);
      }
      host.appendChild(grid);
    } else {
      const ed = curveEditor({ getPoints: () => state.points[state.channel], setPoints: pts => setPts(state.channel, pts),
        hist, channel: () => state.channel, overlays: () => others(state.channel),
        histMode: () => state.channel === "rgb" ? "rgb" : "one", maxWidth: 1000, onEnd });
      host.appendChild(ed.el); editors.push(ed);
    }
    channels.querySelectorAll("[data-ch]").forEach(b => b.classList.toggle("on", state.view === "one" && b.dataset.ch === state.channel));
  }
  function syncLabels(){
    const name = presetName();
    const opt = $(".cvf-pick option"); opt.textContent = `Estilo: ${name}`;
    $(".cvf-pick-hit").setAttribute("aria-label", `Estilo: ${name}. Cambiar`);
    root.querySelectorAll("[data-preset]").forEach(b => {
      const on = b.dataset.preset === state.preset;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
    });
  }
  function syncLink(){
    linkInput.checked = state.link;
    mixRow.hidden = !state.link;
    mixInput.value = state.mix; mixVal.textContent = `${state.mix} %`;
  }
  function renderPresets(){
    $(".cvf-presets").innerHTML = presetButtons("cvf-preset");
    if(!$(".cvf-sheet").hidden) $(".cvf-sheet-grid").innerHTML = presetButtons("cvf-preset");
  }
  function refreshAll(){
    editors.forEach(e => e.refresh());
    channels.querySelectorAll("[data-ch]").forEach(b => b.classList.toggle("on", state.view === "one" && b.dataset.ch === state.channel));
    syncLabels(); syncLink();
  }
  function syncActions(){
    $("[data-a=undo]").disabled = !past.length;
    $("[data-a=redo]").disabled = !future.length;
  }

  const applyPreset = id => {
    const p = allPresets().find(x => x.id === id); if(!p) return;
    for(const k of CH) state.points[k] = p.set[k] ? copyPts(p.set[k]) : ID();
    if(state.link){ const src = p.set.lum && !p.set.rgb ? "lum" : "rgb"; state.points[src === "rgb" ? "lum" : "rgb"] = copyPts(state.points[src]); }
    state.preset = id;
    commit(); refreshAll(); preview();
  };
  /* Automático: curva calculada para la foto (tonepremium.js). Normal:
     sólo la maestra; Premium: además, cada canal (neutraliza dominantes). */
  const autoCurve = () => {
    if(!source) return;
    const k = Math.min(1, 800 / Math.max(source.width, source.height)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(source.width * k)); c.height = Math.max(1, Math.round(source.height * k));
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(source, 0, 0, c.width, c.height);
    const pts = autoCurvePoints(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height, !!state.premium);
    for(const ch of CH) state.points[ch] = copyPts(pts[ch]);
    if(state.link) state.points.lum = copyPts(state.points.rgb);
    state.preset = null;
    commit(); refreshAll(); preview();
    toast(state.premium ? "Curva automática Premium" : "Curva automática", "ok");
  };
  const deletePreset = id => {
    saveUserCurvePresets(userCurvePresets().filter(u => u.id !== id));
    if(state.preset === id) state.preset = null;
    renderPresets(); syncLabels();
  };
  const savePreset = async () => {
    const name = await promptDlg("Guardar estilo de curvas", "Nombre del estilo", "Mi curva");
    if(!name || closed) return;
    const list = userCurvePresets(), id = "u" + Date.now();
    list.push({ id, name: name.trim().slice(0, 40), points: JSON.parse(JSON.stringify(state.points)) });
    saveUserCurvePresets(list);
    state.preset = id; last = snap();
    renderPresets(); syncLabels();
    toast("Estilo guardado", "ok");
  };

  /* ── Hoja de estilos (móvil) ── */
  const sheet = $(".cvf-sheet");
  const openSheet = () => {
    $(".cvf-sheet-grid").innerHTML = presetButtons("cvf-preset");
    sheet.hidden = false;
    const cur = $(".cvf-sheet-grid .on");
    cur?.scrollIntoView({ block: "center" });
    cur?.focus({ preventScroll: true });
  };
  function closeSheet(){
    if(sheet.hidden) return;
    sheet.hidden = true;
    if(matchMedia(MOBILE).matches) $(".cvf-pick-hit").focus({ preventScroll: true });
  }

  /* ── Vista previa ── */
  const stage = $(".cvf-stage"), view = $(".cvf-stage canvas"), vctx = view.getContext("2d");
  /* Zoom de la vista previa: `zoom` multiplica el encaje (1 = imagen
     entera) y `panX/panY` desplazan en píxeles del lienzo. Rueda,
     pellizco o Ctrl + / − amplían; arrastrar desplaza; doble clic o
     Ctrl+0 vuelven a encajar. */
  let zoom = 1, panX = 0, panY = 0;
  const layout = src => {
    const pad = (matchMedia(MOBILE).matches ? 8 : 24) * (devicePixelRatio || 1);
    const k = Math.min((view.width - pad * 2) / src.width, (view.height - pad * 2) / src.height) * zoom;
    const w = Math.max(1, src.width * k), h = Math.max(1, src.height * k);
    return { w, h, x: (view.width - w) / 2 + panX, y: (view.height - h) / 2 + panY };
  };
  const draw = () => {
    frame = 0;
    if(closed) return;
    const src = comparing ? source : layer?.canvas;
    vctx.clearRect(0, 0, view.width, view.height);
    if(!src) return;
    const { w, h, x, y } = layout(src);
    vctx.imageSmoothingEnabled = zoom < 2; vctx.imageSmoothingQuality = "high";
    vctx.drawImage(src, x, y, w, h);
  };
  const request = () => { if(!frame && !closed) frame = requestAnimationFrame(draw); };
  const fit = () => {
    const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    view.width = Math.max(1, Math.round(r.width * dpr)); view.height = Math.max(1, Math.round(r.height * dpr));
    request();
  };
  const observer = new ResizeObserver(fit);

  /* ── Eventos ── */
  root.addEventListener("click", e => {
    const del = e.target.closest("[data-del]");
    if(del){ e.stopPropagation(); deletePreset(del.dataset.del); return; }
    const pr = e.target.closest("[data-preset]");
    if(pr){ applyPreset(pr.dataset.preset); if(pr.closest(".cvf-sheet")) closeSheet(); return; }
    const ch = e.target.closest("[data-ch]");
    if(ch){ state.channel = ch.dataset.ch; state.view = "one"; renderEditors(); return; }
    const v = e.target.closest("[data-view]");
    if(v){ state.view = v.dataset.view; renderEditors(); return; }
    const a = e.target.closest("[data-a]")?.dataset.a;
    if(a === "undo") undo();
    else if(a === "redo") redo();
    else if(a === "accept") finish("go");
    else if(a === "auto") autoCurve();
    else if(a === "reset"){ setPts(state.channel, ID()); commit(); refreshAll(); }
    else if(a === "resetAll"){ for(const k of CH) state.points[k] = ID(); state.preset = null; commit(); refreshAll(); preview(); }
    else if(a === "save") savePreset();
  });
  root.addEventListener("contextmenu", e => {
    const pr = e.target.closest(".cvf-left [data-preset]");
    if(!pr) return;
    const p = allPresets().find(x => x.id === pr.dataset.preset);
    if(p?.mine){ e.preventDefault(); deletePreset(p.id); }
  });
  $(".cvf-cancel").addEventListener("click", () => finish(null));
  $(".cvf-close").addEventListener("click", () => finish(null));
  $(".cvf-pick-hit").addEventListener("click", openSheet);
  $(".cvf-sheet-close").addEventListener("click", closeSheet);
  sheet.addEventListener("click", e => { if(e.target === sheet) closeSheet(); });
  linkInput.addEventListener("change", () => {
    state.link = linkInput.checked;
    if(state.link){
      const src = state.channel === "lum" ? "lum" : "rgb";
      state.points[src === "rgb" ? "lum" : "rgb"] = copyPts(state.points[src]);
    }
    commit(); refreshAll(); preview();
  });
  mixInput.addEventListener("input", () => { state.mix = +mixInput.value; mixVal.textContent = `${state.mix} %`; preview(); });
  mixInput.addEventListener("change", commit);
  mixInput.addEventListener("dblclick", () => { state.mix = 50; syncLink(); preview(); commit(); });

  const cmp = $(".cvf-compare");
  const setCompare = on => { if(comparing === on) return; comparing = on; cmp.classList.toggle("on", on); request(); };
  cmp.addEventListener("pointerdown", e => { e.preventDefault(); try{ cmp.setPointerCapture(e.pointerId); }catch{} setCompare(true); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => cmp.addEventListener(t, () => setCompare(false)));
  cmp.addEventListener("contextmenu", e => e.preventDefault());

  /* Zoom y desplazamiento sobre la vista previa */
  const dpr = () => view.width / Math.max(1, stage.clientWidth);
  const zoomTo = (z, cx, cy) => {
    z = Math.max(1, Math.min(32, z));
    const r = stage.getBoundingClientRect(), d = dpr();
    // El punto bajo el cursor se queda quieto: en coordenadas del lienzo, relativo al centro.
    const px = cx === undefined ? 0 : (cx - r.left) * d - view.width / 2;
    const py = cy === undefined ? 0 : (cy - r.top) * d - view.height / 2;
    panX = px - (px - panX) * z / zoom;
    panY = py - (py - panY) * z / zoom;
    zoom = z;
    if(zoom === 1){ panX = panY = 0; }
    request();
  };
  const pts = new Map();
  let gest = null;
  const beginGesture = () => {
    const p = [...pts.values()];
    gest = p.length === 1 ? { x: p[0].x, y: p[0].y, px: panX, py: panY }
         : p.length === 2 ? { pinch: true, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), z: zoom,
                              cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 } : null;
  };
  stage.addEventListener("pointerdown", e => {
    if(e.target === cmp || pts.size >= 2) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try{ stage.setPointerCapture(e.pointerId); }catch{}
    beginGesture();
  });
  stage.addEventListener("pointermove", e => {
    if(!gest || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.values()];
    if(gest.pinch && p.length === 2){
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      zoomTo(gest.z * d / Math.max(gest.d, 1), gest.cx, gest.cy);
    } else if(!gest.pinch && zoom > 1){
      const d = dpr();
      panX = gest.px + (e.clientX - gest.x) * d;
      panY = gest.py + (e.clientY - gest.y) * d;
      request();
    }
  });
  const endGesture = e => { if(pts.delete(e.pointerId)) beginGesture(); };
  stage.addEventListener("pointerup", endGesture);
  stage.addEventListener("pointercancel", endGesture);
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    zoomTo(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  }, { passive: false });
  stage.addEventListener("dblclick", e => { if(e.target !== cmp) zoomTo(zoom > 1 ? 1 : 3, e.clientX, e.clientY); });

  /* Teclado: Esc cancela (o cierra la hoja), Ctrl+Z / Ctrl+Mayús+Z
     deshacen y rehacen aquí. Mientras el editor está abierto, ninguna
     tecla llega a los atajos de la app que hay detrás. Con un diálogo
     encima (Guardar estilo) se deja hacer a ese diálogo. */
  const onKey = e => {
    if(closed || anyDialogOpen()) return;
    const typing = e.target.matches?.("input:not([type=range]):not([type=checkbox]), textarea, select");
    if(e.key === "Escape"){
      e.preventDefault(); e.stopPropagation();
      if(!sheet.hidden) closeSheet(); else finish(null);
      return;
    }
    if(typing) return;
    e.stopPropagation();
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if(mod && k === "z"){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if(mod && k === "y"){ e.preventDefault(); redo(); }
    else if(mod && (k === "+" || k === "=")){ e.preventDefault(); zoomTo(zoom * 1.25); }
    else if(mod && k === "-"){ e.preventDefault(); zoomTo(zoom / 1.25); }
    else if(mod && (k === "0" || k === "1")){ e.preventDefault(); zoomTo(1); }
  };
  const mq = matchMedia(MOBILE);
  const onMq = () => { place(); fit(); };

  function finish(value){
    if(closed) return;
    closed = true;
    cancelAnimationFrame(frame); observer.disconnect();
    mq.removeEventListener?.("change", onMq);
    document.removeEventListener("keydown", onKey, true);
    root.remove();
    resolve?.(value);
  }

  return {
    el: root,
    /* runAdjust avisa aquí después de cada vista previa. */
    onPreview: request,
    /* Abre el editor; devuelve "go" al aplicar o null al cancelar. */
    present({ layer: l }){
      layer = l;
      $(".cvf-sub").textContent = l?.name ? `Capa: ${l.name}` : "";
      document.body.appendChild(root);
      dockPremium(premium, { mobile: sw => root.querySelector(".cvf-close").after(sw), desktop: sw => root.querySelector(".cvf-actions").prepend(sw) });
      document.addEventListener("keydown", onKey, true);
      mq.addEventListener?.("change", onMq);
      observer.observe(stage);
      place(); renderPresets(); refreshAll(); syncActions(); fit();
      return new Promise(r => { resolve = r; });
    }
  };
}
