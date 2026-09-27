/* ═══════════════════════════════════════════════════════════════
   FILTRO VINTAGE · VENTANA
   Misma estructura que el revelador RAW (raw/ui.js): ventana a
   pantalla completa, barra superior con Cancelar / deshacer /
   rehacer / aplicar, vista previa con zoom (rueda, doble clic,
   pellizco) y «mantener pulsado = original».

     · Escritorio: histograma y ayuda a la izquierda; a la derecha el
       desplegable de ajustes predefinidos, las pestañas de grupo y
       todos los deslizadores del grupo.
     · Móvil: la foto ocupa toda la pantalla; abajo, un desplegable de
       ajustes predefinidos, otro de modificador y su deslizador.

   La vista previa se recalcula en la GPU una vez por fotograma como
   mucho, con el último estado pedido: arrastrar un deslizador nunca
   acumula trabajo atrasado.
   ═══════════════════════════════════════════════════════════════ */

import { GROUPS, CONTROLS, control, controlsFor, normalize, valueText } from "./state.js";
import { PRESETS, preset } from "./presets.js";
import { VintageGL } from "./engine.js";
import { toast } from "../js/ui/toast.js";

const MOBILE = "(max-width:900px)";

class Preview {
  constructor(canvas, source, { onDraw, onError }){
    this.canvas = canvas; this.source = source; this.onDraw = onDraw; this.onError = onError;
    this.gl = new VintageGL(canvas);
    this.gl.setImage(source, source.width, source.height);
    this.proxy = document.createElement("canvas");
    this.frame = 0; this.closed = false; this.dirty = true;
    this.observer = new ResizeObserver(() => { this.dirty = true; this.request(); });
    this.observer.observe(canvas.parentElement);
  }
  resize(){
    const box = this.canvas.parentElement.getBoundingClientRect();
    const mobile = matchMedia(MOBILE).matches, dpr = Math.min(devicePixelRatio || 1, 1.5);
    const budget = mobile ? 650000 : 1400000, W = this.source.width, H = this.source.height;
    const k = Math.min(1, Math.max(1, box.width) * dpr / W, Math.max(1, box.height) * dpr / H, Math.sqrt(budget / (W * H)));
    const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    if(!this.dirty && this.proxy.width === w && this.proxy.height === h) return;
    this.proxy.width = w; this.proxy.height = h;
    const x = this.proxy.getContext("2d");
    x.imageSmoothingQuality = "high"; x.clearRect(0, 0, w, h); x.drawImage(this.source, 0, 0, w, h);
    this.gl.setTexture(this.proxy);
    this.dirty = false;
  }
  update(settings, original = false){ this.settings = settings; this.original = original; this.request(); }
  request(){ if(!this.closed && !this.frame && this.settings) this.frame = requestAnimationFrame(() => this.draw()); }
  draw(){
    this.frame = 0;
    if(this.closed) return;
    try{
      this.resize();
      this.gl.render(this.settings, { cw: this.proxy.width, ch: this.proxy.height, original: this.original });
      this.onDraw(this.canvas);
    }catch(error){ this.onError(error); }
  }
  dispose(){
    if(this.closed) return;
    this.closed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.gl.dispose(); this.proxy.width = this.proxy.height = 1; this.source = null;
  }
}

export function openVintageEditor({ source, initial = null, onAccept, onClose = null }){
  const state = normalize(initial), history = [], future = [];
  let activeGroup = GROUPS[0][0], activeKey = CONTROLS[0].key, showingOriginal = false;
  let closed = false, accepting = false, histogramTimer = 0, previewZoom = 1, previewPan = { x: 0, y: 0 };
  // Si abre con valores, el grupo inicial es el del primer modificador activo.
  const firstOn = CONTROLS.find(c => state[c.key] > 0);
  if(firstOn){ activeGroup = firstOn.group; activeKey = firstOn.key; }

  const presetOptions = () => `<option value="">Personalizado</option>` +
    PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join("");

  const root = document.createElement("section");
  root.className = "vf-editor";
  root.innerHTML = `
    <header class="vf-topbar">
      <button class="vf-cancel" type="button">Cancelar</button>
      <button class="vf-close" type="button" aria-label="Cancelar">✕</button>
      <div class="vf-title"><b>Filtro Vintage</b><span>${source.width} × ${source.height}</span></div>
      <div class="vf-actions">
        <button type="button" data-action="seed" title="Nueva variación del polvo, arañazos, fugas de luz…" aria-label="Nueva variación">⚄</button>
        <button type="button" data-action="undo" aria-label="Deshacer">↶</button>
        <button type="button" data-action="redo" aria-label="Rehacer">↷</button>
        <button class="primary" type="button" data-action="accept">Aplicar</button>
      </div>
    </header>
    <main class="vf-workspace">
      <aside class="vf-left">
        <div class="vf-hist"><span>Histograma</span><canvas width="256" height="76"></canvas></div>
        <div class="vf-help"><b></b><span></span></div>
      </aside>
      <div class="vf-preview"><canvas></canvas><div class="vf-zoom">100 %</div><button class="vf-fit" type="button" title="Encajar vista">⌗</button></div>
      <aside class="vf-controls">
        <label class="vf-preset"><span>Ajuste predefinido</span><select data-role="preset">${presetOptions()}</select></label>
        <div class="vf-groups"></div>
        <div class="vf-list"></div>
      </aside>
    </main>
    <footer class="vf-mobile">
      <select aria-label="Ajuste predefinido" data-role="preset">${presetOptions()}</select>
      <select aria-label="Modificador" class="vf-mobile-control"></select>
      <div class="vf-mobile-slider"></div>
    </footer>`;
  document.body.appendChild(root);

  const canvas = root.querySelector(".vf-preview canvas");
  const hist = root.querySelector(".vf-hist canvas"), histCtx = hist.getContext("2d");
  const list = root.querySelector(".vf-list"), groups = root.querySelector(".vf-groups");
  const mobileControl = root.querySelector(".vf-mobile-control"), mobileSlider = root.querySelector(".vf-mobile-slider");
  const presetSelects = root.querySelectorAll("[data-role=preset]");
  const helpTitle = root.querySelector(".vf-help b"), helpText = root.querySelector(".vf-help span");

  const sample = document.createElement("canvas"); sample.width = 128; sample.height = 80;
  const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
  const drawHist = c => {
    clearTimeout(histogramTimer);
    if(matchMedia(MOBILE).matches) return;
    histogramTimer = setTimeout(() => {
      if(closed) return;
      sampleCtx.clearRect(0, 0, 128, 80); sampleCtx.drawImage(c, 0, 0, 128, 80);
      const d = sampleCtx.getImageData(0, 0, 128, 80).data, bins = new Uint32Array(256);
      for(let i = 0; i < d.length; i += 4) bins[Math.round(.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2])]++;
      const top = Math.max(1, ...bins), w = hist.width, h = hist.height;
      histCtx.clearRect(0, 0, w, h); histCtx.fillStyle = "#9ab7ff";
      bins.forEach((v, i) => histCtx.fillRect(i, h - v / top * h, 1, Math.max(1, v / top * h)));
    }, 160);
  };

  let renderer;
  try{ renderer = new Preview(canvas, source, { onDraw: drawHist, onError: e => toast(e.message, "err") }); }
  catch(error){ root.remove(); toast(error.message, "err"); onClose?.(); return null; }

  const schedule = () => { if(!closed) renderer.update(structuredClone(state), showingOriginal); };
  const remember = () => { history.push(structuredClone(state)); if(history.length > 60) history.shift(); future.length = 0; };

  /* El desplegable de ajustes predefinidos muestra el que coincide
     exactamente con el estado, o «Personalizado». */
  const matchPreset = () => {
    const p = PRESETS.find(p => CONTROLS.every(c => (p.values[c.key] || 0) === state[c.key]));
    return p ? p.id : "";
  };
  const showHelp = key => { const item = control(key); helpTitle.textContent = item.label; helpText.textContent = item.help; };

  const setValue = (item, value, { track = false } = {}) => {
    if(accepting || closed) return;
    const next = Math.max(item.min, Math.min(item.max, Math.round(+value)));
    if(state[item.key] === next) return;
    if(track) remember();
    state[item.key] = next; sync(false); schedule();
  };

  const field = (item, mobile = false) =>
    `<div class="vf-field${state[item.key] > 0 ? " is-on" : ""}" role="group" aria-label="${item.label}" title="${item.help}">
       <span>${mobile ? "" : item.label}<b>${valueText(item, state[item.key])}</b></span>
       <div class="vf-slider-row">
         <button type="button" class="vf-step" data-step="-1" aria-label="Disminuir ${item.label}">−</button>
         <input aria-label="${item.label}" title="Doble clic o doble toque: volver a cero" data-key="${item.key}" type="range" min="${item.min}" max="${item.max}" step="${item.step}" value="${state[item.key]}">
         <button type="button" class="vf-step" data-step="1" aria-label="Aumentar ${item.label}">+</button>
       </div>
     </div>`;

  /* Mismo cableado de deslizador que el revelador RAW: un paso de
     historial por gesto, −/+ de un punto, doble clic / doble toque /
     Suprimir para volver a cero. */
  const wireFields = host => host.querySelectorAll("input[data-key]").forEach(input => {
    const item = control(input.dataset.key);
    let started = false, tap = null, down = null, suppressTap = false;
    const reset = () => { setValue(item, 0, { track: true }); started = false; };
    input.addEventListener("focus", () => showHelp(item.key));
    input.addEventListener("input", () => {
      if(accepting || closed) return;
      if(suppressTap){ input.value = "0"; reset(); return; }
      if(!started && +input.value !== state[item.key]){ remember(); started = true; }
      showHelp(item.key);
      setValue(item, input.value);
    });
    input.addEventListener("change", () => { if(suppressTap){ input.value = "0"; reset(); return; } setValue(item, input.value, { track: !started }); started = false; });
    input.addEventListener("dblclick", e => { e.preventDefault(); reset(); });
    input.addEventListener("pointerdown", e => {
      started = false;
      if(e.pointerType !== "touch"){ suppressTap = false; return; }
      const now = performance.now();
      suppressTap = !!tap && now - tap.time < 350 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 28;
      down = { x: e.clientX, y: e.clientY, time: now };
      if(suppressTap){ e.preventDefault(); tap = null; reset(); }
    });
    input.addEventListener("pointerup", e => {
      if(e.pointerType === "touch" && down){
        if(!suppressTap && performance.now() - down.time < 250 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) tap = { x: e.clientX, y: e.clientY, time: performance.now() };
        else tap = null;
      }
      down = null; started = false;
      if(suppressTap){ input.value = "0"; reset(); }
    });
    input.addEventListener("pointercancel", () => { tap = null; down = null; started = false; });
    input.addEventListener("keydown", e => { suppressTap = false; if(e.key === "Backspace" || e.key === "Delete"){ e.preventDefault(); reset(); } });
    input.closest(".vf-field").querySelectorAll("[data-step]").forEach(b =>
      b.addEventListener("click", () => setValue(item, state[item.key] + Number(b.dataset.step), { track: true })));
  });

  const groupButtons = () => {
    groups.innerHTML = GROUPS.map(([key, label]) => {
      const on = controlsFor(key).some(c => state[c.key] > 0);
      return `<button type="button" class="${key === activeGroup ? "on" : ""}${on ? " has-on" : ""}" data-group="${key}">${label}</button>`;
    }).join("");
    groups.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      activeGroup = b.dataset.group; activeKey = controlsFor(activeGroup)[0].key; sync();
    }));
  };
  const mobileOptions = () => {
    mobileControl.innerHTML = GROUPS.map(([g, label]) => `<optgroup label="${label}">${controlsFor(g).map(item =>
      `<option value="${item.key}">${item.label}${state[item.key] > 0 ? ` · ${state[item.key]}` : ""}</option>`).join("")}</optgroup>`).join("");
    mobileControl.value = activeKey;
    mobileSlider.innerHTML = field(control(activeKey), true);
    wireFields(mobileSlider);
  };
  const sync = (full = true) => {
    if(full){
      groupButtons();
      list.innerHTML = controlsFor(activeGroup).map(item => field(item)).join("");
      wireFields(list);
      mobileOptions();
      showHelp(activeKey);
    } else {
      // Refresco ligero durante un arrastre: sin reconstruir el DOM.
      root.querySelectorAll(".vf-field input[data-key]").forEach(input => { input.value = state[input.dataset.key]; });
      root.querySelectorAll(".vf-field").forEach(f => {
        const key = f.querySelector("[data-key]").dataset.key;
        f.querySelector("b").textContent = valueText(control(key), state[key]);
        f.classList.toggle("is-on", state[key] > 0);
      });
      groups.querySelectorAll("button").forEach(b => b.classList.toggle("has-on", controlsFor(b.dataset.group).some(c => state[c.key] > 0)));
      const opt = mobileControl.querySelector(`option[value="${activeKey}"]`), item = control(activeKey);
      if(opt) opt.textContent = item.label + (state[activeKey] > 0 ? ` · ${state[activeKey]}` : "");
    }
    const id = matchPreset();
    presetSelects.forEach(s => { s.value = id; });
  };

  presetSelects.forEach(sel => sel.addEventListener("change", () => {
    const p = preset(sel.value);
    if(!p || accepting) { sync(false); return; }
    remember();
    for(const c of CONTROLS) state[c.key] = p.values[c.key] || 0;
    const first = CONTROLS.find(c => state[c.key] > 0);
    if(first){ activeGroup = first.group; activeKey = first.key; }
    sync(); schedule();
  }));
  mobileControl.addEventListener("change", () => {
    activeKey = mobileControl.value; activeGroup = control(activeKey).group;
    mobileSlider.innerHTML = field(control(activeKey), true); wireFields(mobileSlider); showHelp(activeKey);
  });

  root.querySelector(".vf-cancel").addEventListener("click", () => close());
  root.querySelector(".vf-close").addEventListener("click", () => close());
  root.querySelector("[data-action=seed]").addEventListener("click", () => {
    if(accepting) return;
    remember(); state.seed = (Math.random() * 4294967295 >>> 0) || 1; schedule();
  });
  root.querySelector("[data-action=undo]").addEventListener("click", () => {
    const prev = history.pop(); if(!prev) return;
    future.push(structuredClone(state)); Object.assign(state, prev); sync(); schedule();
  });
  root.querySelector("[data-action=redo]").addEventListener("click", () => {
    const next = future.pop(); if(!next) return;
    history.push(structuredClone(state)); Object.assign(state, next); sync(); schedule();
  });

  root.querySelector("[data-action=accept]").addEventListener("click", async () => {
    if(accepting || closed) return;
    accepting = true;
    const button = root.querySelector("[data-action=accept]"), settings = structuredClone(state);
    button.disabled = true; button.textContent = "Aplicando…";
    root.querySelectorAll("input,select,.vf-step,.vf-groups button,[data-action=undo],[data-action=redo],[data-action=seed]").forEach(el => el.disabled = true);
    let finalGL = null;
    try{
      finalGL = new VintageGL();
      const result = await finalGL.renderFull(source, settings, p => { if(!closed) button.textContent = `Aplicando… ${p} %`; });
      finalGL.dispose(); finalGL = null;
      if(closed){ result.width = result.height = 1; return; }
      await onAccept(result, settings);
      close();
    }catch(error){
      if(!closed) toast(error?.message || "No se pudo aplicar el Filtro Vintage", "err");
    }finally{
      finalGL?.dispose();
      accepting = false;
      if(!closed){ root.querySelectorAll("input,select,button").forEach(el => el.disabled = false); button.textContent = "Aplicar"; }
    }
  });

  /* ── Vista previa: zoom, desplazamiento y «mantener = original» ── */
  const box = root.querySelector(".vf-preview"), zoomLabel = root.querySelector(".vf-zoom");
  const pointers = new Map(); let pinch = null, drag = null;
  const paint = () => { renderer.canvas.style.transform = `translate(${previewPan.x}px,${previewPan.y}px) scale(${previewZoom})`; zoomLabel.textContent = `${Math.round(previewZoom * 100)} %`; };
  const setZoom = z => { previewZoom = Math.max(1, Math.min(4, z)); if(previewZoom === 1) previewPan = { x: 0, y: 0 }; paint(); };
  root.querySelector(".vf-fit").addEventListener("click", () => { previewPan = { x: 0, y: 0 }; setZoom(1); });
  box.addEventListener("dblclick", () => setZoom(previewZoom === 1 ? 1.8 : 1));
  box.addEventListener("wheel", e => { e.preventDefault(); setZoom(previewZoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
  box.addEventListener("pointerdown", e => {
    if(e.target.closest("button")) return;
    if(e.pointerType === "mouse"){
      if(e.button !== 0 || previewZoom <= 1) return;
      e.preventDefault(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: previewPan.x, py: previewPan.y }; box.classList.add("is-panning");
      try{ box.setPointerCapture(e.pointerId); }catch{}
      return;
    }
    if(e.pointerType !== "touch") return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try{ box.setPointerCapture(e.pointerId); }catch{}
    if(pointers.size === 2){
      e.preventDefault(); showingOriginal = false; drag = null; box.classList.add("is-panning");
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z: previewZoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, px: previewPan.x, py: previewPan.y };
      schedule();
    } else if(previewZoom > 1){ e.preventDefault(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: previewPan.x, py: previewPan.y }; box.classList.add("is-panning"); }
    else { showingOriginal = true; schedule(); }
  });
  box.addEventListener("pointermove", e => {
    if(drag?.id === e.pointerId && pointers.size < 2){ previewPan = { x: drag.px + e.clientX - drag.x, y: drag.py + e.clientY - drag.y }; paint(); return; }
    if(e.pointerType !== "touch") return;
    if(pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if(pinch && pointers.size === 2){
      const [a, b] = [...pointers.values()], cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      previewPan = { x: pinch.px + cx - pinch.cx, y: pinch.py + cy - pinch.cy };
      setZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
    }
  });
  const endPointer = e => {
    if(e.pointerType === "mouse"){
      if(drag?.id === e.pointerId){ drag = null; box.classList.remove("is-panning"); }
      return;
    }
    if(e.pointerType !== "touch") return;
    pointers.delete(e.pointerId);
    if(pointers.size < 2){ pinch = null; if(previewZoom <= 1) box.classList.remove("is-panning"); }
    if(pointers.size === 1 && previewZoom > 1){ const [p] = [...pointers.entries()]; drag = { id: p[0], x: p[1].x, y: p[1].y, px: previewPan.x, py: previewPan.y }; }
    if(!pointers.size){ drag = null; box.classList.remove("is-panning"); showingOriginal = false; schedule(); }
  };
  box.addEventListener("pointerup", endPointer); box.addEventListener("pointercancel", endPointer);

  const onKey = e => {
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); root.querySelector(e.shiftKey ? "[data-action=redo]" : "[data-action=undo]").click(); }
    if(e.key === "Escape" && !accepting) close();
  };
  const close = () => {
    if(closed) return;
    closed = true; clearTimeout(histogramTimer); renderer.dispose();
    document.removeEventListener("keydown", onKey, true); root.remove(); onClose?.();
  };
  document.addEventListener("keydown", onKey, true);
  sync(); schedule();
  return { close, state };
}
