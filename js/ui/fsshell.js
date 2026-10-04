/* ═══════════════════════════════════════════════════════════════
   PLUGINS A PANTALLA COMPLETA · ESTRUCTURA COMÚN
   HDR, Unir, Cortar y Formas comparten la misma ventana que el
   revelador RAW, Curvas y el collage:

     · Escritorio: barra de arriba (Cancelar · título · deshacer,
       rehacer, Aplicar), panel izquierdo, la imagen en el centro y los
       ajustes a la derecha.
     · Móvil: la imagen a pantalla completa y, abajo, UN control cada
       vez: un desplegable para el grupo, otro para el ajuste y su
       deslizador, como Tono y saturación. Los desplegables con
       miniaturas (estilos, formas…) abren una hoja con la rejilla de
       miniaturas, como el selector de diseños del collage.

   La vista hace zoom con la rueda, el pellizco, doble clic o
   Ctrl + / − / 0 y se desplaza arrastrando; un plugin puede quedarse
   con los gestos sobre la imagen (mover una forma, arrastrar un
   corte) con `setInteract`.
   ═══════════════════════════════════════════════════════════════ */

const MOBILE = "(max-width:900px)";
const isMobile = () => matchMedia(MOBILE).matches;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
import { dockPremium } from "./premium.js";


export function ensureShellStyles(){
  const href = new URL("../../css/fsplugin.css", import.meta.url).href;
  if([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href === href)) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/** Ventana a pantalla completa. Ver comentario de cabecera. */
export function createShell({ title, subtitle = "", applyLabel = "Aplicar", cls = "",
                              onApply, onCancel, onUndo, onRedo }){
  const root = document.createElement("section");
  root.className = "fsp" + (cls ? " " + cls : "");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", title);
  root.innerHTML = `
    <header class="fsp-top">
      <button type="button" class="fsp-cancel">Cancelar</button>
      <button type="button" class="fsp-close" aria-label="Cancelar">✕</button>
      <div class="fsp-title"><b>${esc(title)}</b><span class="fsp-sub">${esc(subtitle)}</span></div>
      <div class="fsp-actions">
        <button type="button" data-a="undo" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled>↶</button>
        <button type="button" data-a="redo" aria-label="Rehacer" title="Rehacer (Ctrl+Mayús+Z)" disabled>↷</button>
        <button type="button" class="primary" data-a="apply">${esc(applyLabel)}</button>
      </div>
    </header>
    <main class="fsp-work">
      <aside class="fsp-left"></aside>
      <div class="fsp-stage">
        <canvas></canvas>
        <div class="fsp-empty" hidden></div>
        <div class="fsp-busy" hidden></div>
        <span class="fsp-zoom">—</span>
        <button type="button" class="fsp-compare" hidden aria-label="Ver el original mientras se mantiene pulsado">◐ Antes</button>
        <button type="button" class="fsp-fit" title="Encajar (Ctrl+0)" aria-label="Encajar la imagen">⌗</button>
      </div>
      <aside class="fsp-right"></aside>
    </main>
    <footer class="fsp-mobile"></footer>
    <div class="fsp-sheet" hidden><div class="fsp-sheet-panel"><header><b></b><button type="button" class="fsp-sheet-close" aria-label="Cerrar">✕</button></header><div class="fsp-sheet-grid"></div></div></div>`;
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const stage = $(".fsp-stage"), cv = $(".fsp-stage canvas"), cx = cv.getContext("2d");
  const zoomLbl = $(".fsp-zoom"), busyEl = $(".fsp-busy"), emptyEl = $(".fsp-empty"), cmp = $(".fsp-compare");
  const sheet = $(".fsp-sheet");
  let view = null, original = null, comparing = false, overlay = null, interact = null;
  let zoom = 1, panX = 0, panY = 0, frame = 0, closed = false;

  /* ── Vista ── */
  const dpr = () => cv.width / Math.max(1, stage.clientWidth);
  /** Transformación imagen → lienzo (en píxeles del lienzo). */
  const T = () => {
    const src = view; if(!src) return null;
    const pad = (isMobile() ? 8 : 24) * dpr();
    const k0 = Math.min((cv.width - pad * 2) / src.width, (cv.height - pad * 2) / src.height);
    const k = Math.max(1e-4, k0 * zoom);
    return { k, k0, ox: (cv.width - src.width * k) / 2 + panX, oy: (cv.height - src.height * k) / 2 + panY, dpr: dpr() };
  };
  const draw = () => {
    frame = 0;
    if(closed) return;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, cv.width, cv.height);
    const t = T();
    const src = comparing && original ? original : view;
    if(t && src){
      cx.imageSmoothingEnabled = t.k < 2; cx.imageSmoothingQuality = "high";
      if(comparing && original && (original.width !== view.width || original.height !== view.height)){
        const k = Math.min(view.width / original.width, view.height / original.height);
        const w = original.width * k * t.k, h = original.height * k * t.k;
        cx.drawImage(original, t.ox + (view.width * t.k - w) / 2, t.oy + (view.height * t.k - h) / 2, w, h);
      } else cx.drawImage(src, t.ox, t.oy, src.width * t.k, src.height * t.k);
      zoomLbl.textContent = Math.round(t.k / t.dpr * 100) + " %";
    } else zoomLbl.textContent = "—";
    if(overlay && t && !comparing){ cx.save(); overlay(cx, t); cx.restore(); }
  };
  const redraw = () => { if(!frame && !closed) frame = requestAnimationFrame(draw); };
  const resize = () => {
    const r = stage.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d));
    redraw();
  };
  const ro = new ResizeObserver(resize); ro.observe(stage);

  const zoomTo = (z, clientX, clientY) => {
    z = clamp(z, 0.25, 40);
    const r = stage.getBoundingClientRect(), d = dpr();
    const px = clientX === undefined ? 0 : (clientX - r.left) * d - cv.width / 2;
    const py = clientY === undefined ? 0 : (clientY - r.top) * d - cv.height / 2;
    panX = px - (px - panX) * z / zoom;
    panY = py - (py - panY) * z / zoom;
    zoom = z;
    if(Math.abs(zoom - 1) < 1e-3){ zoom = 1; panX = panY = 0; }
    redraw();
  };
  const fitView = () => { zoom = 1; panX = panY = 0; redraw(); };
  /** Pantalla → imagen */
  const toImage = (clientX, clientY) => {
    const t = T(); if(!t) return null;
    const r = stage.getBoundingClientRect(), d = dpr();
    return { x: ((clientX - r.left) * d - t.ox) / t.k, y: ((clientY - r.top) * d - t.oy) / t.k, k: t.k / d };
  };

  /* Gestos: uno para el plugin (si lo quiere) o desplazar; dos, pellizco. */
  const pts = new Map();
  let g = null, owned = null;
  const begin = () => {
    const p = [...pts.values()];
    g = p.length === 1 ? { x: p[0].x, y: p[0].y, px: panX, py: panY }
      : p.length === 2 ? { pinch: true, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), z: zoom,
                           cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 } : null;
  };
  stage.addEventListener("pointerdown", e => {
    if(e.target !== cv || pts.size >= 2) return;
    if(e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try{ stage.setPointerCapture(e.pointerId); }catch{}
    if(pts.size === 1 && interact && e.button !== 1){
      const p = toImage(e.clientX, e.clientY);
      if(p && interact("down", p, e)){ owned = e.pointerId; return; }
    }
    if(owned !== null && pts.size === 2){ interact?.("cancel", null, e); owned = null; }
    begin();
  });
  stage.addEventListener("pointermove", e => {
    if(owned === e.pointerId){ const p = toImage(e.clientX, e.clientY); if(p) interact?.("move", p, e); return; }
    if(!pts.has(e.pointerId)){
      if(interact && e.pointerType === "mouse"){ const p = toImage(e.clientX, e.clientY); if(p) interact("hover", p, e); }
      return;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if(!g) return;
    const p = [...pts.values()];
    if(g.pinch && p.length === 2){
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      zoomTo(g.z * d / Math.max(g.d, 1), g.cx, g.cy);
    } else if(!g.pinch){
      const d = dpr();
      panX = g.px + (e.clientX - g.x) * d; panY = g.py + (e.clientY - g.y) * d;
      redraw();
    }
  });
  const end = e => {
    if(owned === e.pointerId){ const p = toImage(e.clientX, e.clientY); interact?.("up", p, e); owned = null; pts.delete(e.pointerId); return; }
    if(pts.delete(e.pointerId)) begin();
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("wheel", e => { e.preventDefault(); zoomTo(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
  stage.addEventListener("dblclick", e => { if(e.target === cv && !interact) zoomTo(zoom > 1 ? 1 : 3, e.clientX, e.clientY); });
  $(".fsp-fit").addEventListener("click", fitView);

  const setCompare = on => { if(comparing === on) return; comparing = on; cmp.classList.toggle("on", on); redraw(); };
  cmp.addEventListener("pointerdown", e => { e.preventDefault(); try{ cmp.setPointerCapture(e.pointerId); }catch{} setCompare(true); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => cmp.addEventListener(t, () => setCompare(false)));
  cmp.addEventListener("contextmenu", e => e.preventDefault());

  /* ── Barra de arriba y teclado ── */
  const cancel = () => onCancel?.();
  $(".fsp-cancel").addEventListener("click", cancel);
  $(".fsp-close").addEventListener("click", cancel);
  $('[data-a="undo"]').addEventListener("click", () => onUndo?.());
  $('[data-a="redo"]').addEventListener("click", () => onRedo?.());
  $('[data-a="apply"]').addEventListener("click", () => onApply?.());

  const onKey = e => {
    if(closed || document.querySelector(".modal")) return;
    if(e.key === "Escape"){
      e.preventDefault(); e.stopPropagation();
      if(!sheet.hidden) closeSheet(); else cancel();
      return;
    }
    const typing = e.target.matches?.("input:not([type=range]):not([type=checkbox]):not([type=color]), textarea, select");
    if(typing) return;
    e.stopPropagation();
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if(mod && k === "z"){ e.preventDefault(); e.shiftKey ? onRedo?.() : onUndo?.(); }
    else if(mod && k === "y"){ e.preventDefault(); onRedo?.(); }
    else if(mod && (k === "+" || k === "=")){ e.preventDefault(); zoomTo(zoom * 1.25); }
    else if(mod && k === "-"){ e.preventDefault(); zoomTo(zoom / 1.25); }
    else if(mod && (k === "0" || k === "1")){ e.preventDefault(); fitView(); }
  };
  document.addEventListener("keydown", onKey, true);

  /* ── Hoja de miniaturas (móvil) ── */
  let sheetPick = null;
  function openSheet(title, options, current, thumb, onPick){
    $(".fsp-sheet-panel header b").textContent = title;
    const grid = $(".fsp-sheet-grid");
    grid.innerHTML = "";
    for(const [v, label] of options){
      const b = thumbButton(v, label, thumb, String(v) === String(current));
      b.addEventListener("click", () => { closeSheet(); onPick(v); });
      grid.appendChild(b);
    }
    sheet.hidden = false;
    sheetPick = onPick;
    grid.querySelector(".on")?.scrollIntoView({ block: "center" });
  }
  function closeSheet(){ sheet.hidden = true; sheetPick = null; }
  $(".fsp-sheet-close").addEventListener("click", closeSheet);
  sheet.addEventListener("click", e => { if(e.target === sheet) closeSheet(); });

  const api = {
    root, left: $(".fsp-left"), right: $(".fsp-right"), mobile: $(".fsp-mobile"), stage,
    redraw, fitView, zoomTo, toImage, openSheet, closeSheet,
    get transform(){ return T(); },
    /** Imagen que se muestra (un lienzo). `keep` conserva zoom y encuadre. */
    setView(canvas, keep = true){
      const changed = !view || !canvas || view.width !== canvas.width || view.height !== canvas.height;
      view = canvas;
      if(changed && !keep){ zoom = 1; panX = panY = 0; }
      redraw();
    },
    get view(){ return view; },
    /** Lienzo «antes» para el botón de comparar (null lo oculta). */
    setOriginal(canvas){ original = canvas; cmp.hidden = !canvas; },
    setOverlay(fn){ overlay = fn; redraw(); },
    /** fn(type: down|move|up|hover|cancel, {x,y,k}, evento) → true para quedarse el gesto */
    setInteract(fn){ interact = fn; },
    setSubtitle(s){ $(".fsp-sub").textContent = s || ""; },
    setBusy(msg){ busyEl.hidden = !msg; busyEl.textContent = msg || ""; },
    setUndo(canUndo, canRedo){ $('[data-a="undo"]').disabled = !canUndo; $('[data-a="redo"]').disabled = !canRedo; },
    setApplyEnabled(on){ $('[data-a="apply"]').disabled = !on; },
    setApplyLabel(s){ $('[data-a="apply"]').textContent = s; },
    /** Un elemento más en la barra de arriba, antes de deshacer (p. ej.
        el interruptor Premium con la corona, js/ui/premium.js). */
    addAction(el){
      // El interruptor Premium, en el móvil, a la izquierda junto a ✕
      // (ver dockPremium en premium.js); lo demás, con las acciones.
      if(el.classList?.contains("premium-switch"))
        return dockPremium(el, { mobile: sw => $(".fsp-close").after(sw), desktop: sw => $(".fsp-actions").prepend(sw) });
      $(".fsp-actions").prepend(el); return el;
    },
    setClass(cls, on){ root.classList.toggle(cls, !!on); },
    /** Contenido cuando aún no hay imagen (p. ej. «Añadir fotos»). null lo oculta. */
    setEmpty(html){ emptyEl.hidden = !html; if(html !== null && html !== undefined) emptyEl.innerHTML = html; return emptyEl; },
    close(){
      if(closed) return;
      closed = true;
      cancelAnimationFrame(frame); ro.disconnect();
      document.removeEventListener("keydown", onKey, true);
      root.remove();
    },
    get closed(){ return closed; }
  };
  return api;
}

/* ── Miniaturas ── */
/** Botón de miniatura. `thumb(value)` devuelve un lienzo, una URL de
    imagen o marcado SVG (empieza por «<svg»). */
export function thumbButton(value, label, thumb, on){
  const b = document.createElement("button");
  b.type = "button"; b.className = "fsp-thumb" + (on ? " on" : "");
  b.dataset.v = value;
  let t = null;
  try{ t = thumb ? thumb(value) : null; }catch{}
  if(t instanceof HTMLCanvasElement){
    const img = document.createElement("img"); img.alt = ""; img.src = t.toDataURL("image/jpeg", .82); b.appendChild(img);
  } else if(typeof t === "string" && t.trim().startsWith("<svg")) b.insertAdjacentHTML("beforeend", t);
  else if(typeof t === "string" && t){ const img = document.createElement("img"); img.alt = ""; img.src = t; b.appendChild(img); }
  else b.insertAdjacentHTML("beforeend", '<span class="ph"></span>');
  const s = document.createElement("span"); s.textContent = label; b.appendChild(s);
  return b;
}

/* ── Controles ─────────────────────────────────────────────────
   `sections`: [{ id, label, props: [prop…], when?: () => bool }]
   prop: { key, label, type, … } con type:
     range  { min, max, step, unit, fmt }
     select { options: [[valor, texto]…] }
     thumbs { options, thumb(valor) }      → rejilla / hoja de miniaturas
     seg    { options }                    → botones segmentados
     toggle | color | number { min, max }
     button { run(), label }
   `when(state)` en una prop o sección la oculta si devuelve false.
   `get(key)` / `set(key, valor, final)` leen y escriben el estado del
   plugin; `final` es true al soltar (para el historial).
   ═══════════════════════════════════════════════════════════════ */
export function mountControls(sh, { sections, get, set, desktop = sh.right, mobile = sh.mobile, mobileExtra = null }){
  let secId = sections[0]?.id, keyBySec = {};
  const visSecs = () => sections.filter(s => !s.when || s.when());
  const visProps = s => s.props.filter(p => !p.when || p.when());

  function field(p, compact){
    const v = get(p.key);
    if(p.type === "range"){
      const wrap = document.createElement("label"); wrap.className = "fsp-field";
      const fmt = p.fmt || (x => `${x}${p.unit || ""}`);
      wrap.innerHTML = `<span>${esc(p.label)}<b>${esc(fmt(v))}</b></span><input type="range" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${v}">`;
      const inp = wrap.querySelector("input"), out = wrap.querySelector("b");
      inp.addEventListener("input", () => { out.textContent = fmt(+inp.value); set(p.key, +inp.value, false); });
      inp.addEventListener("change", () => set(p.key, +inp.value, true));
      inp.addEventListener("dblclick", () => { if(p.def !== undefined){ inp.value = p.def; out.textContent = fmt(p.def); set(p.key, p.def, true); } });
      // `buttons`: − / + a los lados, un paso cada toque (ajuste fino con el dedo).
      if(p.buttons){
        const row = document.createElement("div"); row.className = "fsp-rangebtns";
        const mk = (d, txt, lbl) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", lbl);
          b.addEventListener("click", e => { e.preventDefault(); const st = +(p.step || 1), v = clamp(Math.round((+inp.value + d * st) / st) * st, p.min, p.max);
            inp.value = v; out.textContent = fmt(v); set(p.key, v, true); }); return b; };
        inp.replaceWith(row);
        row.append(mk(-1, "−", "Menos"), inp, mk(1, "+", "Más"));
      }
      return wrap;
    }
    if(p.type === "select" || (p.type === "thumbs" && compact)){
      const wrap = document.createElement("div"); wrap.className = "fsp-field";
      const opts = typeof p.options === "function" ? p.options() : p.options;
      const sel = `<select>${opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      wrap.innerHTML = compact && p.type === "thumbs"
        ? `<div class="fsp-pick">${sel}<button type="button" class="fsp-pick-hit" aria-label="${esc(p.label)}: ver miniaturas"></button></div>`
        : `<span>${esc(p.label)}</span>${sel}`;
      const s = wrap.querySelector("select");
      const cast = x => typeof opts[0]?.[0] === "number" ? +x : x;
      s.addEventListener("change", () => set(p.key, cast(s.value), true));
      wrap.querySelector(".fsp-pick-hit")?.addEventListener("click", () =>
        sh.openSheet(p.label, opts, get(p.key), p.thumb, val => { set(p.key, val, true); refresh(); }));
      return wrap;
    }
    if(p.type === "thumbs"){
      const wrap = document.createElement("div");
      wrap.className = "fsp-thumbs";
      const opts = typeof p.options === "function" ? p.options() : p.options;
      for(const [k, l] of opts){
        const b = thumbButton(k, l, p.thumb, String(k) === String(v));
        b.addEventListener("click", () => { set(p.key, k, true); wrap.querySelectorAll(".fsp-thumb").forEach(x => x.classList.toggle("on", x === b)); });
        wrap.appendChild(b);
      }
      return wrap;
    }
    if(p.type === "seg"){
      const wrap = document.createElement("div"); wrap.className = "fsp-field";
      const opts = typeof p.options === "function" ? p.options() : p.options;
      wrap.innerHTML = `${compact ? "" : `<span>${esc(p.label)}</span>`}<div class="fsp-seg">${opts.map(([k, l]) => `<button type="button" data-v="${esc(k)}" class="${String(k) === String(v) ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
      wrap.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
        const k = opts.find(o => String(o[0]) === b.dataset.v)[0];
        wrap.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
        set(p.key, k, true);
      }));
      return wrap;
    }
    if(p.type === "toggle"){
      const wrap = document.createElement("label"); wrap.className = "fsp-toggle";
      wrap.innerHTML = `<span>${esc(p.label)}</span><input type="checkbox"${v ? " checked" : ""}>`;
      const c = wrap.querySelector("input");
      c.addEventListener("change", () => set(p.key, c.checked, true));
      return wrap;
    }
    if(p.type === "color" || p.type === "number" || p.type === "text"){
      const wrap = document.createElement("label"); wrap.className = "fsp-field";
      wrap.innerHTML = `<span>${esc(p.label)}</span><input type="${p.type}"${p.min !== undefined ? ` min="${p.min}"` : ""}${p.max !== undefined ? ` max="${p.max}"` : ""} value="${esc(v)}">`;
      const i = wrap.querySelector("input");
      i.addEventListener(p.type === "color" ? "input" : "change", () => {
        let x = p.type === "number" ? +i.value : i.value;
        if(p.type === "number"){ if(!Number.isFinite(x)) return; x = clamp(x, p.min ?? -Infinity, p.max ?? Infinity); }
        set(p.key, x, p.type !== "color");
      });
      if(p.type === "color") i.addEventListener("change", () => set(p.key, i.value, true));
      return wrap;
    }
    if(p.type === "button"){
      const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn" + (p.dashed ? " dashed" : "");
      b.textContent = p.label; b.addEventListener("click", () => p.run());
      return b;
    }
    if(p.type === "custom") return p.render(compact);
    return document.createElement("div");
  }

  function renderDesktop(){
    if(!desktop) return;
    const top = desktop.scrollTop;
    desktop.innerHTML = "";
    for(const s of visSecs()){
      const h = document.createElement("h3"); h.textContent = s.label; desktop.appendChild(h);
      for(const p of visProps(s)) desktop.appendChild(field(p, false));
      if(s.note){ const n = document.createElement("p"); n.className = "fsp-note"; n.textContent = typeof s.note === "function" ? s.note() : s.note; desktop.appendChild(n); }
    }
    desktop.scrollTop = top;
  }

  function renderMobile(){
    if(!mobile) return;
    mobile.innerHTML = "";
    if(mobileExtra) mobile.appendChild(mobileExtra());
    const secs = visSecs();
    if(!secs.length) return;
    if(!secs.some(s => s.id === secId)) secId = secs[0].id;
    const sec = secs.find(s => s.id === secId), props = visProps(sec);
    let key = keyBySec[secId];
    if(!props.some(p => p.key === key)) key = props[0]?.key;
    keyBySec[secId] = key;
    const row = document.createElement("div");
    const showProp = props.length > 1;
    row.className = "fsp-mrow" + (secs.length > 1 && showProp ? "" : " one");
    if(secs.length > 1){
      const s = document.createElement("select"); s.setAttribute("aria-label", "Grupo");
      s.innerHTML = secs.map(x => `<option value="${esc(x.id)}"${x.id === secId ? " selected" : ""}>${esc(x.label)}</option>`).join("");
      s.addEventListener("change", () => { secId = s.value; renderMobile(); });
      row.appendChild(s);
    }
    if(showProp){
      const s = document.createElement("select"); s.setAttribute("aria-label", "Ajuste");
      s.innerHTML = props.map(p => `<option value="${esc(p.key)}"${p.key === key ? " selected" : ""}>${esc(p.label)}</option>`).join("");
      s.addEventListener("change", () => { keyBySec[secId] = s.value; renderMobile(); });
      row.appendChild(s);
    }
    if(row.children.length) mobile.appendChild(row);
    const p = props.find(x => x.key === key);
    if(p){
      const f = field(p, true);
      // En el móvil el nombre ya está en el desplegable: sólo el valor.
      if(showProp) f.querySelector(":scope > span")?.firstChild?.remove?.();
      mobile.appendChild(f);
    }
  }

  function refresh(){ renderDesktop(); renderMobile(); }
  refresh();
  return { refresh, renderMobile, renderDesktop, select(sec, key){ secId = sec; if(key) keyBySec[sec] = key; renderMobile(); } };
}

/* ── Historial de un estado serializable ── */
export function stateHistory(state, onRestore, sh){
  const past = [], future = [];
  let last = JSON.stringify(state);
  const sync = () => sh?.setUndo(past.length > 0, future.length > 0);
  const put = snap => { const v = JSON.parse(snap); for(const k of Object.keys(state)) delete state[k]; Object.assign(state, v); last = snap; onRestore(); sync(); };
  sync();
  return {
    commit(){ const now = JSON.stringify(state); if(now === last) return; past.push(last); if(past.length > 80) past.shift(); future.length = 0; last = now; sync(); },
    undo(){ if(!past.length) return; future.push(JSON.stringify(state)); put(past.pop()); },
    redo(){ if(!future.length) return; past.push(JSON.stringify(state)); put(future.pop()); },
    reset(){ past.length = future.length = 0; last = JSON.stringify(state); sync(); }
  };
}

/* ── Apertura de fotos (galería de iPhone y Android incluida) ──
   Igual que el collage: <img> primero (respeta la orientación EXIF y
   abre HEIC en Safari), heic2any si hace falta y createImageBitmap
   como último intento. Devuelve un lienzo a como mucho `maxSide`. */
const isHeic = f => /image\/hei[cf]/i.test(f.type || "") || /\.hei[cf]$/i.test(f.name || "");
function loadImg(blob){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}
export async function decodePhoto(blob, maxSide){
  let loaded = null, bmp = null, tiff = null;
  if(/\.(tiff?|jxl)$/i.test(blob.name || "") || /image\/(tiff|jxl)/i.test(blob.type || "")){
    try{ const { decodeCompatible } = await import("../io/compatibility.js"); tiff = await decodeCompatible(blob); }catch{}
  }
  if(!tiff){ try{ loaded = await loadImg(blob); }catch{} }
  if(!tiff && !loaded && isHeic(blob) && typeof globalThis.heic2any === "function"){
    try{
      const out = await globalThis.heic2any({ blob, toType: "image/jpeg", quality: .95 });
      loaded = await loadImg(Array.isArray(out) ? out[0] : out);
    }catch{}
  }
  if(!tiff && !loaded){ try{ bmp = await createImageBitmap(blob); }catch{} }
  const src = tiff || loaded?.img || bmp;
  if(!src || !(src.naturalWidth || src.width)) throw new Error(`No se pudo abrir «${blob.name || "la imagen"}». Prueba con JPEG, PNG, WebP, TIFF o HEIC.`);
  try{ return scaledCanvas(src, maxSide); }
  finally{ bmp?.close?.(); if(loaded) URL.revokeObjectURL(loaded.url); }
}
export function scaledCanvas(img, side){
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const k = Math.min(1, side / Math.max(iw, ih));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Selector de archivos (varias fotos). Resuelve con la lista (vacía si se cancela). */
/* `gallery`: en Android se pide sólo `image/*` para que se abra la galería
   directamente (ver core/device.js); con `gallery: false`, el explorador
   de archivos con todos los formatos de `accept`. */
export function pickFiles({ multiple = true, accept = "image/*,.heic,.heif,.tif,.tiff,.jxl", gallery = true } = {}){
  return new Promise(resolve => {
    const input = document.createElement("input");
    const android = /Android/i.test(navigator.userAgent || "") || navigator.userAgentData?.platform === "Android";
    input.type = "file"; input.accept = gallery && android ? "image/*" : accept; input.multiple = multiple;
    input.style.cssText = "position:fixed;left:-9999px;opacity:0";
    document.body.appendChild(input);
    let done = false;
    const finish = files => { if(done) return; done = true; input.remove(); resolve(files); };
    input.addEventListener("change", () => finish([...input.files]));
    input.addEventListener("cancel", () => finish([]));
    input.click();
  });
}

/* ── Resultado: siempre en una capa nueva ─────────────────────
   Si hay un documento abierto, el resultado va a una capa nueva encima
   de la activa (centrado y, si es mayor que el lienzo, reducido para
   caber). Sin documento —o si `newDocument`— se abre en una pestaña
   nueva con el resultado como capa. Un solo paso de deshacer. */
export async function resultToLayer(canvas, { name, docName, newDocument = false, mix = false } = {}){
  const [{ doc, addLayer, newDoc }, { record, clear: clearHistory }, { emit }, { openAsNewTab }, { fit }, { clearSnapshots }] = await Promise.all([
    import("../core/doc.js"), import("../core/history.js"), import("../core/bus.js"),
    import("../core/documents.js"), import("../editor/view.js"), import("../core/snapshots.js")]);
  if(!doc.open || newDocument){
    const { docSizeLimit } = await import("../core/device.js");
    const [w, h] = docSizeLimit(canvas.width, canvas.height);
    let img = canvas;
    if(w !== canvas.width || h !== canvas.height){ img = document.createElement("canvas"); img.width = w; img.height = h; const x = img.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(canvas, 0, 0, w, h); }
    const ok = await openAsNewTab(() => {
      // Con la imagen ya dentro desde el principio: el «antes» de Comparar
      // se toma del documento recién creado.
      newDoc(w, h, { name: docName || name, layerName: name, image: img });
      doc.layers[0].thumbDirty = true;
      clearHistory(); clearSnapshots();
    });
    if(!ok) throw new Error("No se pudo abrir la pestaña nueva");
    document.getElementById("empty")?.classList.add("hide");
    emit("doc:structure"); emit("doc:change"); fit();
    return "doc";
  }
  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  const l = addLayer({ name });
  const k = Math.min(1, doc.w / canvas.width, doc.h / canvas.height);
  const w = canvas.width * k, h = canvas.height * k;
  l.ctx.imageSmoothingQuality = "high";
  l.ctx.drawImage(canvas, (doc.w - w) / 2, (doc.h - h) / 2, w, h);
  l.thumbDirty = true;
  // `mix`: efecto del mismo tamaño que la foto → porcentaje de aplicación
  // (mezcla con la capa de debajo). No si se ha tenido que reducir.
  if(mix && k === 1 && canvas.width === doc.w && canvas.height === doc.h){
    const { markMixLayer } = await import("../editor/filterlayer.js");
    markMixLayer(l, name);
  }
  const nextLayers = doc.layers.slice(), nextActive = l.id;
  const put = (layers, active) => { doc.layers = layers.slice(); doc.activeId = active; emit("doc:structure"); emit("doc:change"); };
  record(name, () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
  emit("doc:structure"); emit("doc:change");
  return k < 1 ? "layer-scaled" : "layer";
}
