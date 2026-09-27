/* ═══════════════════════════════════════════════════════════════
   STICKERS · VENTANA
   Misma estructura que el Filtro Vintage y el revelador RAW: ventana a
   pantalla completa, barra superior con Cancelar / deshacer / rehacer
   / Aplicar.

     · Escritorio: catálogo a la izquierda (buscador, grupo, estilo y
       tono), la foto con los stickers en el centro y, a la derecha,
       las propiedades del sticker elegido.
     · Móvil: la foto ocupa toda la pantalla; abajo, «+ Sticker» (abre
       el catálogo a pantalla completa), un desplegable de propiedad
       con su deslizador y una fila de acciones.

   En la foto: tocar un sticker lo elige, arrastrarlo lo mueve, el
   tirador de la esquina lo escala y gira, y con dos dedos se pellizca
   y gira. Todo se guarda en coordenadas de la imagen completa.
   ═══════════════════════════════════════════════════════════════ */

import { loadCatalog, filterCatalog, emojiUrl, loadImage, GROUP_LABELS, STYLES, TONES } from "./catalog.js";
import { buildSprite, drawSprite } from "./render.js";
import { toast } from "../js/ui/toast.js";

const MOBILE = "(max-width:900px)";
const PREFS = "realify.stickers";

/* Propiedades con deslizador. `size` se muestra como % del lado corto. */
const PROPS = [
  { key: "size",    label: "Tamaño",   min: 2,    max: 150, unit: " %" },
  { key: "rot",     label: "Rotación", min: -180, max: 180, unit: "°" },
  { key: "opacity", label: "Opacidad", min: 0,    max: 100, unit: " %" },
  { key: "outline", label: "Borde de pegatina", min: 0, max: 100, unit: "" },
  { key: "shadow",  label: "Sombra",   min: 0,    max: 100, unit: "" }
];

let uidSeq = 0;

export function openStickerEditor({ background, onAccept, onClose = null }){
  const W = background.width, H = background.height, SHORT = Math.min(W, H);
  let prefs = { style: "3d", tone: "", group: 0 };
  try{ prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS) || "{}") }; }catch{}
  const savePrefs = () => { try{ localStorage.setItem(PREFS, JSON.stringify(prefs)); }catch{} };

  let stickers = [], selected = null, catalog = null, query = "", closed = false, accepting = false;
  let activeProp = "size";
  const history = [], future = [];
  const snapshot = () => ({ stickers: structuredClone(stickers), selected });
  const remember = () => { history.push(snapshot()); if(history.length > 80) history.shift(); future.length = 0; syncActions(); };
  const sel = () => stickers.find(s => s.uid === selected) || null;

  const opt = (list, value) => list.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("");
  const root = document.createElement("section");
  root.className = "st-editor";
  root.innerHTML = `
    <header class="st-topbar">
      <button class="st-cancel" type="button">Cancelar</button>
      <button class="st-close" type="button" aria-label="Cancelar">✕</button>
      <div class="st-title"><b>Stickers</b><span class="st-count">Sin stickers</span></div>
      <div class="st-actions">
        <button type="button" data-action="undo" aria-label="Deshacer">↶</button>
        <button type="button" data-action="redo" aria-label="Rehacer">↷</button>
        <button class="primary" type="button" data-action="accept">Aplicar</button>
      </div>
    </header>
    <main class="st-workspace">
      <aside class="st-catalog" aria-label="Catálogo de stickers">
        <div class="st-cat-head">
          <input type="search" class="st-search" placeholder="Buscar sticker (p. ej. corazón, gato, fiesta)" aria-label="Buscar sticker" autocomplete="off" spellcheck="false">
          <button type="button" class="st-cat-close" aria-label="Cerrar catálogo">✕</button>
        </div>
        <div class="st-cat-opts">
          <select class="st-group" aria-label="Grupo">${opt(GROUP_LABELS.slice(0, 9).map((l, i) => [String(i), l]), String(prefs.group))}</select>
          <select class="st-style" aria-label="Estilo">${opt(STYLES, prefs.style)}</select>
          <select class="st-tone" aria-label="Tono de piel">${opt(TONES, prefs.tone)}</select>
        </div>
        <div class="st-grid" role="listbox" aria-label="Stickers"><p class="st-note">Cargando stickers…</p></div>
      </aside>
      <div class="st-stage"><canvas></canvas><p class="st-hint">Elige un sticker del catálogo para añadirlo a la foto.</p></div>
      <aside class="st-props">
        <div class="st-props-empty"><b>Sin selección</b><span>Toca un sticker de la foto para editarlo, o añade uno desde el catálogo.</span></div>
        <div class="st-props-body" hidden>
          <div class="st-props-name"></div>
          <div class="st-props-fields"></div>
          <label class="st-row"><span>Estilo</span><select data-p="style">${opt(STYLES, "3d")}</select></label>
          <label class="st-row"><span>Tono de piel</span><select data-p="tone">${opt(TONES, "")}</select></label>
          <div class="st-buttons">
            <button type="button" data-do="flipX">⇋ Voltear</button>
            <button type="button" data-do="flipY">⇵ Voltear</button>
            <button type="button" data-do="dup">⧉ Duplicar</button>
            <button type="button" data-do="front">▲ Delante</button>
            <button type="button" data-do="back">▼ Detrás</button>
            <button type="button" data-do="del" class="danger">✕ Eliminar</button>
          </div>
        </div>
      </aside>
    </main>
    <footer class="st-mobile">
      <div class="st-mobile-row">
        <button type="button" class="st-add primary">＋ Sticker</button>
        <select class="st-mobile-prop" aria-label="Propiedad">${opt(PROPS.map(p => [p.key, p.label]), activeProp)}</select>
      </div>
      <div class="st-mobile-slider"></div>
      <div class="st-mobile-row st-mobile-acts">
        <select data-p="style" aria-label="Estilo">${opt(STYLES, "3d")}</select>
        <select data-p="tone" aria-label="Tono de piel">${opt(TONES, "")}</select>
        <button type="button" data-do="flipX" aria-label="Voltear horizontal">⇋</button>
        <button type="button" data-do="dup" aria-label="Duplicar">⧉</button>
        <button type="button" data-do="front" aria-label="Traer delante">▲</button>
        <button type="button" data-do="del" class="danger" aria-label="Eliminar">✕</button>
      </div>
    </footer>`;
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const stage = $(".st-stage"), canvas = $(".st-stage canvas"), ctx = canvas.getContext("2d");
  const grid = $(".st-grid"), search = $(".st-search");
  const groupSel = $(".st-group"), styleSel = $(".st-style"), toneSel = $(".st-tone");

  /* ── Vista: la foto encajada en el escenario ── */
  let view = { k: 1, ox: 0, oy: 0, dpr: 1 }, bgFit = null, frame = 0;
  const sprites = new Map();   // uid → { key, sprite }
  const fit = () => {
    const box = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * dpr)); canvas.height = Math.max(1, Math.round(box.height * dpr));
    const pad = matchMedia(MOBILE).matches ? 8 : 24;
    const k = Math.min((box.width - pad * 2) / W, (box.height - pad * 2) / H) * dpr;
    view = { k, ox: (canvas.width - W * k) / 2, oy: (canvas.height - H * k) / 2, dpr };
    bgFit = document.createElement("canvas");
    bgFit.width = Math.max(1, Math.round(W * k)); bgFit.height = Math.max(1, Math.round(H * k));
    const bx = bgFit.getContext("2d"); bx.imageSmoothingQuality = "high"; bx.drawImage(background, 0, 0, bgFit.width, bgFit.height);
    sprites.clear(); request();
  };
  const toScreen = (x, y) => [view.ox + x * view.k, view.oy + y * view.k];
  const toImage = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [((cx - r.left) * view.dpr - view.ox) / view.k, ((cy - r.top) * view.dpr - view.oy) / view.k]; };
  const request = () => { if(!frame && !closed) frame = requestAnimationFrame(draw); };

  const urlOf = s => emojiUrl(s.id, s.style, s.tone, s.hasTones);
  const images = new Map();
  const imageFor = s => {
    const url = urlOf(s);
    if(images.has(url)) return images.get(url);
    images.set(url, null);
    loadImage(url).then(img => { images.set(url, img); request(); }).catch(e => toast(e.message, "err"));
    return null;
  };
  const spriteFor = s => {
    const img = imageFor(s); if(!img) return null;
    const key = `${urlOf(s)}|${Math.round(s.size * view.k)}|${s.rot}|${s.flipX}|${s.flipY}|${s.outline}|${s.shadow}`;
    const hit = sprites.get(s.uid);
    if(hit && hit.key === key) return hit.sprite;
    const sprite = buildSprite(img, s, view.k);
    sprites.set(s.uid, { key, sprite });
    return sprite;
  };
  /* Esquinas del cuadro del sticker (con borde) en coordenadas de imagen */
  const corners = s => {
    const half = s.size / 2 * (1 + 0.11 * s.outline / 100), a = s.rot * Math.PI / 180, c = Math.cos(a), n = Math.sin(a);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [s.x + (u * c - v * n) * half, s.y + (u * n + v * c) * half]);
  };
  const HANDLE = 14;
  function draw(){
    frame = 0; if(closed) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgFit, view.ox, view.oy);
    ctx.save(); ctx.beginPath(); ctx.rect(view.ox, view.oy, W * view.k, H * view.k); ctx.clip();
    for(const s of stickers){
      const sp = spriteFor(s); if(!sp) continue;
      const [x, y] = toScreen(s.x, s.y);
      drawSprite(ctx, sp, x, y, s.opacity);
    }
    ctx.restore();
    const s = sel();
    if(s){
      const pts = corners(s).map(p => toScreen(...p)), d = view.dpr;
      ctx.save();
      ctx.lineWidth = 1.5 * d; ctx.strokeStyle = "#fff"; ctx.setLineDash([6 * d, 4 * d]);
      ctx.shadowColor = "#000a"; ctx.shadowBlur = 3 * d;
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]);
      const [hx, hy] = pts[2];
      ctx.fillStyle = "#6794ff"; ctx.beginPath(); ctx.arc(hx, hy, HANDLE * d * .75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `${12 * d}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowBlur = 0;
      ctx.fillText("⤡", hx, hy + .5);
      ctx.restore();
    }
    $(".st-hint").hidden = stickers.length > 0;
  }

  /* ── Catálogo ── */
  const renderGrid = () => {
    if(!catalog) return;
    const items = filterCatalog(catalog.list, query, +groupSel.value);
    grid.innerHTML = items.length ? "" : `<p class="st-note">Ningún sticker coincide con «${query.trim()}».</p>`;
    const frag = document.createDocumentFragment();
    for(const e of items.slice(0, 600)){
      const b = document.createElement("button");
      b.type = "button"; b.className = "st-item"; b.title = e.es; b.setAttribute("aria-label", e.es);
      b.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${emojiUrl(e.id, styleSel.value, toneSel.value, !!e.t)}">`;
      b.addEventListener("click", () => addSticker(e));
      frag.appendChild(b);
    }
    grid.appendChild(frag);
    grid.scrollTop = 0;
    groupSel.disabled = !!query.trim();
  };
  loadCatalog().then(c => { catalog = c; if(!closed) renderGrid(); })
    .catch(e => { grid.innerHTML = `<p class="st-note">${e.message}</p>`; });
  search.addEventListener("input", () => { query = search.value; renderGrid(); });
  groupSel.addEventListener("change", () => { prefs.group = +groupSel.value; savePrefs(); renderGrid(); });
  styleSel.addEventListener("change", () => { prefs.style = styleSel.value; savePrefs(); renderGrid(); });
  toneSel.addEventListener("change", () => { prefs.tone = toneSel.value; savePrefs(); renderGrid(); });
  const openCatalog = () => { root.classList.add("catalog-open"); if(!matchMedia("(pointer:coarse)").matches) search.focus(); };
  const closeCatalog = () => root.classList.remove("catalog-open");
  $(".st-add").addEventListener("click", openCatalog);
  $(".st-cat-close").addEventListener("click", closeCatalog);

  function addSticker(e){
    if(accepting) return;
    remember();
    const n = stickers.length % 6;
    const s = {
      uid: ++uidSeq, id: e.id, name: e.es, hasTones: !!e.t,
      style: styleSel.value, tone: toneSel.value,
      x: W / 2 + (n - 2.5) * SHORT * 0.04, y: H / 2 + (n - 2.5) * SHORT * 0.03,
      size: SHORT * 0.3, rot: 0, flipX: false, flipY: false, opacity: 100, outline: 0, shadow: 0
    };
    stickers.push(s); selected = s.uid;
    closeCatalog(); syncProps(); request();
  }

  /* ── Propiedades ── */
  const propValue = (s, key) => key === "size" ? Math.round(s.size / SHORT * 100) : Math.round(s[key]);
  const setProp = (key, value, track = false) => {
    const s = sel(); if(!s || accepting) return;
    const p = PROPS.find(p => p.key === key);
    const v = Math.max(p.min, Math.min(p.max, Math.round(+value)));
    if(propValue(s, key) === v) return;
    if(track) remember();
    if(key === "size") s.size = SHORT * v / 100; else s[key] = v;
    syncProps(false); request();
  };
  const field = (p, s, mobile = false) =>
    `<div class="st-field" role="group" aria-label="${p.label}">
       <span>${mobile ? "" : p.label}<b>${propValue(s, p.key)}${p.unit}</b></span>
       <div class="st-slider-row">
         <button type="button" class="st-step" data-step="-1" aria-label="Disminuir ${p.label}">−</button>
         <input type="range" data-key="${p.key}" min="${p.min}" max="${p.max}" step="1" value="${propValue(s, p.key)}" aria-label="${p.label}" title="Doble clic o doble toque: valor inicial">
         <button type="button" class="st-step" data-step="1" aria-label="Aumentar ${p.label}">+</button>
       </div>
     </div>`;
  const DEFAULTS = { size: 30, rot: 0, opacity: 100, outline: 0, shadow: 0 };
  const wireFields = host => host.querySelectorAll("input[data-key]").forEach(input => {
    const key = input.dataset.key;
    let started = false, lastTap = 0;
    input.addEventListener("input", () => { if(!started){ remember(); started = true; } setProp(key, input.value); });
    input.addEventListener("change", () => { started = false; });
    input.addEventListener("dblclick", () => setProp(key, DEFAULTS[key], true));
    input.addEventListener("pointerdown", e => {
      if(e.pointerType !== "touch") return;
      const now = performance.now();
      if(now - lastTap < 320){ e.preventDefault(); setProp(key, DEFAULTS[key], true); lastTap = 0; } else lastTap = now;
    });
    input.closest(".st-field").querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => {
      const s = sel(); if(s) setProp(key, propValue(s, key) + Number(b.dataset.step), true);
    }));
  });
  const syncProps = (full = true) => {
    const s = sel();
    $(".st-props-empty").hidden = !!s; $(".st-props-body").hidden = !s;
    root.classList.toggle("has-selection", !!s);
    root.querySelectorAll("[data-do], [data-p], .st-mobile-prop").forEach(el => { el.disabled = !s || accepting; });
    if(s){
      if(full){
        $(".st-props-name").textContent = s.name;
        $(".st-props-fields").innerHTML = PROPS.map(p => field(p, s)).join("");
        wireFields($(".st-props-fields"));
        const mp = PROPS.find(p => p.key === activeProp);
        $(".st-mobile-slider").innerHTML = field(mp, s, true);
        wireFields($(".st-mobile-slider"));
      } else {
        root.querySelectorAll(".st-field input[data-key]").forEach(i => { i.value = propValue(s, i.dataset.key); });
        root.querySelectorAll(".st-field").forEach(f => { const k = f.querySelector("[data-key]").dataset.key, p = PROPS.find(p => p.key === k); f.querySelector("b").textContent = propValue(s, k) + p.unit; });
      }
      root.querySelectorAll("[data-p=style]").forEach(el => { el.value = s.style; });
      root.querySelectorAll("[data-p=tone]").forEach(el => { el.value = s.tone; el.disabled = !s.hasTones || s.style === "hc" || accepting; });
    } else if(full){
      $(".st-mobile-slider").innerHTML = `<p class="st-note">Toca un sticker para editarlo.</p>`;
    }
    const n = stickers.length;
    $(".st-count").textContent = n ? `${n} sticker${n === 1 ? "" : "s"}` : "Sin stickers";
    syncActions();
  };
  const syncActions = () => {
    $("[data-action=undo]").disabled = !history.length || accepting;
    $("[data-action=redo]").disabled = !future.length || accepting;
    $("[data-action=accept]").disabled = !stickers.length || accepting;
  };
  $(".st-mobile-prop").addEventListener("change", e => { activeProp = e.target.value; syncProps(); });
  root.querySelectorAll("[data-p]").forEach(el => el.addEventListener("change", () => {
    const s = sel(); if(!s) return;
    remember(); s[el.dataset.p] = el.value; syncProps(); request();
  }));
  const act = what => {
    const s = sel(); if(!s || accepting) return;
    const i = stickers.indexOf(s);
    remember();
    if(what === "flipX") s.flipX = !s.flipX;
    else if(what === "flipY") s.flipY = !s.flipY;
    else if(what === "dup"){ const c = { ...structuredClone(s), uid: ++uidSeq, x: s.x + SHORT * .04, y: s.y + SHORT * .04 }; stickers.splice(i + 1, 0, c); selected = c.uid; }
    else if(what === "front"){ stickers.splice(i, 1); stickers.push(s); }
    else if(what === "back"){ stickers.splice(i, 1); stickers.unshift(s); }
    else if(what === "del"){ stickers.splice(i, 1); selected = null; sprites.delete(s.uid); }
    syncProps(); request();
  };
  root.querySelectorAll("[data-do]").forEach(b => b.addEventListener("click", () => act(b.dataset.do)));

  /* ── Gestos en la foto ── */
  const hitTest = (x, y) => {
    for(let i = stickers.length - 1; i >= 0; i--){
      const s = stickers[i], a = -s.rot * Math.PI / 180, dx = x - s.x, dy = y - s.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      const half = s.size / 2 * (1 + 0.11 * s.outline / 100);
      if(Math.abs(lx) <= half && Math.abs(ly) <= half) return s;
    }
    return null;
  };
  const onHandle = (x, y) => {
    const s = sel(); if(!s) return false;
    const [hx, hy] = corners(s)[2];
    return Math.hypot(x - hx, y - hy) * view.k <= HANDLE * view.dpr * 1.6;
  };
  const pointers = new Map();
  let gesture = null;
  canvas.addEventListener("pointerdown", e => {
    if(accepting) return;
    const [x, y] = toImage(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x, y });
    try{ canvas.setPointerCapture(e.pointerId); }catch{}
    const s = sel();
    if(pointers.size === 2 && s){
      const [a, b] = [...pointers.values()];
      gesture = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x),
                  mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, size: s.size, rot: s.rot, sx: s.x, sy: s.y, saved: gesture?.saved || snapshot() };
      return;
    }
    if(pointers.size > 1) return;
    if(onHandle(x, y)){
      gesture = { type: "handle", saved: snapshot(), d0: Math.hypot(x - s.x, y - s.y) || 1, a0: Math.atan2(y - s.y, x - s.x), size: s.size, rot: s.rot };
      return;
    }
    const hit = hitTest(x, y);
    if(hit){
      if(selected !== hit.uid){ selected = hit.uid; syncProps(); }
      gesture = { type: "move", saved: snapshot(), dx: hit.x - x, dy: hit.y - y };
    } else if(selected){ selected = null; syncProps(); gesture = null; }
    request();
  });
  canvas.addEventListener("pointermove", e => {
    if(!pointers.has(e.pointerId) || !gesture) return;
    const [x, y] = toImage(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x, y });
    const s = sel(); if(!s) return;
    if(gesture.type === "move" && pointers.size === 1){ s.x = x + gesture.dx; s.y = y + gesture.dy; gesture.moved = true; }
    else if(gesture.type === "handle"){
      const d = Math.hypot(x - s.x, y - s.y), a = Math.atan2(y - s.y, x - s.x);
      s.size = Math.max(SHORT * .02, Math.min(SHORT * 1.5, gesture.size * d / gesture.d0));
      s.rot = Math.round(((gesture.rot + (a - gesture.a0) * 180 / Math.PI + 540) % 360) - 180);
      gesture.moved = true;
    } else if(gesture.type === "pinch" && pointers.size === 2){
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, ang = Math.atan2(b.y - a.y, b.x - a.x);
      s.size = Math.max(SHORT * .02, Math.min(SHORT * 1.5, gesture.size * d / gesture.d));
      s.rot = Math.round(((gesture.rot + (ang - gesture.ang) * 180 / Math.PI + 540) % 360) - 180);
      s.x = gesture.sx + (a.x + b.x) / 2 - gesture.mx; s.y = gesture.sy + (a.y + b.y) / 2 - gesture.my;
      gesture.moved = true;
    }
    syncProps(false); request();
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if(!gesture) return;
    if(pointers.size === 0){
      if(gesture.moved && gesture.saved){ history.push(gesture.saved); if(history.length > 80) history.shift(); future.length = 0; syncActions(); }
      gesture = null;
    } else if(gesture.type === "pinch"){
      // Queda un dedo: sigue moviendo desde donde esté.
      const [p] = [...pointers.values()], s = sel();
      gesture = s ? { type: "move", saved: gesture.saved, moved: gesture.moved, dx: s.x - p.x, dy: s.y - p.y } : null;
    }
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", e => {
    const s = sel(); if(!s) return;
    e.preventDefault();
    if(!gesture?.wheel){ remember(); gesture = { wheel: true }; clearTimeout(canvas._wheelT); }
    clearTimeout(canvas._wheelT); canvas._wheelT = setTimeout(() => { if(gesture?.wheel) gesture = null; }, 400);
    if(e.shiftKey) s.rot = Math.round(((s.rot + (e.deltaY > 0 ? 5 : -5) + 540) % 360) - 180);
    else s.size = Math.max(SHORT * .02, Math.min(SHORT * 1.5, s.size * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
    syncProps(false); request();
  }, { passive: false });

  /* ── Barra superior ── */
  const restoreState = st => { stickers = st.stickers; selected = st.selected; sprites.clear(); syncProps(); request(); };
  $("[data-action=undo]").addEventListener("click", () => { const p = history.pop(); if(!p) return; future.push(snapshot()); restoreState(p); });
  $("[data-action=redo]").addEventListener("click", () => { const n = future.pop(); if(!n) return; history.push(snapshot()); restoreState(n); });
  $(".st-cancel").addEventListener("click", () => close());
  $(".st-close").addEventListener("click", () => close());
  $("[data-action=accept]").addEventListener("click", async () => {
    if(accepting || closed || !stickers.length) return;
    accepting = true; syncProps(false);
    const button = $("[data-action=accept]"); button.textContent = "Aplicando…";
    try{
      // Imágenes a resolución completa antes de componer.
      const imgs = new Map();
      for(const s of stickers) imgs.set(s.uid, await loadImage(urlOf(s)));
      await onAccept(stickers.map(s => ({ ...s })), imgs);
      close();
    }catch(error){
      toast(error?.message || "No se pudieron añadir los stickers", "err");
      accepting = false; button.textContent = "Aplicar"; syncProps(false);
    }
  });

  const onKey = e => {
    if(closed) return;
    const typing = e.target.matches?.("input[type=search], input[type=text]");
    if(e.key === "Escape"){ e.preventDefault(); if(root.classList.contains("catalog-open")) closeCatalog(); else if(!accepting) close(); return; }
    if(typing) return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); $(e.shiftKey ? "[data-action=redo]" : "[data-action=undo]").click(); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d"){ e.preventDefault(); act("dup"); return; }
    if(e.key === "Delete" || e.key === "Backspace"){ if(sel() && !e.target.matches?.("input")){ e.preventDefault(); act("del"); } return; }
    const s = sel();
    if(s && e.key.startsWith("Arrow") && !e.target.matches?.("input,select")){
      e.preventDefault(); remember();
      const step = (e.shiftKey ? 10 : 1) / view.k * view.dpr;
      if(e.key === "ArrowLeft") s.x -= step; if(e.key === "ArrowRight") s.x += step;
      if(e.key === "ArrowUp") s.y -= step; if(e.key === "ArrowDown") s.y += step;
      request();
    }
  };
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  const close = () => {
    if(closed) return;
    closed = true; cancelAnimationFrame(frame); observer.disconnect();
    document.removeEventListener("keydown", onKey, true);
    sprites.clear(); root.remove(); onClose?.();
  };
  document.addEventListener("keydown", onKey, true);
  fit(); syncProps();
  return { close };
}
