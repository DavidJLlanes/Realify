/* ═══════════════════════════════════════════════════════════════
   COLLAGE / HISTORY / POST · VENTANA
   Misma estructura que el creador de memes, Stickers, el Filtro
   Vintage y el revelador RAW: ventana a pantalla completa con
   Cancelar / deshacer / rehacer / Aplicar.

     · Escritorio: a la izquierda formato (redes, proporciones,
       móviles, a medida) con su orientación, el diseño del collage,
       las fotos y los textos; en el centro la composición en vivo; a
       la derecha lo elegido (foto o texto), la composición y el fondo.
     · Móvil: la composición a pantalla completa; abajo, formato y
       orientación, diseño y «+ Fotos», un desplegable de ajuste con su
       control, la bandeja de fotos y una fila de acciones.

   En la composición: tocar un hueco lo elige; arrastrar dentro de él
   encuadra la foto y soltar sobre otro hueco las intercambia; la
   rueda o dos dedos hacen zoom. Las fotos de la bandeja se arrastran
   a un hueco (o se tocan para ponerlas en el elegido). Los textos
   funcionan como en el creador de memes.
   ═══════════════════════════════════════════════════════════════ */

import { FORMATS, GROUPS, format, sizeOf, naturalOrient, aspectText, safeZones } from "./formats.js";
import { LAYOUTS, layoutById, layoutSvg } from "./layouts.js";
import { cellsOf, cellPath, drawBackground, drawCell, orientedPhoto, photoRect, hitCell, rel, SHAPES, shapeOf, shapeIdOf, localCell } from "./render.js";
import { PROPS as TEXT_PROPS, PROP_GROUPS, prop as textProp, TEXT_PRESETS, newText, applyPreset } from "../memes/model.js";
import { renderText, drawText } from "../memes/text.js";
import { loadFont } from "../memes/fonts.js";
import { toast } from "../js/ui/toast.js";
import { shapeSvg } from "../js/core/shapes.js";

const MOBILE = "(max-width:900px)";
const MAX_SIDE = 5000, PROXY_SIDE = 1600;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

async function decodeImage(blob){
  let bmp;
  try{ bmp = await createImageBitmap(blob); }
  catch{ throw new Error("No se pudo leer esa imagen. Prueba con JPEG, PNG o WebP."); }
  const c = scaled(bmp, MAX_SIDE);
  bmp.close?.();
  return c;
}
function scaled(img, side){
  const k = Math.min(1, side / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/* ── Ajustes (escritorio: paneles; móvil: desplegable) ── */
const R = (key, label, min, max, unit = "") => ({ key, label, type: "range", min, max, unit });
const LIENZO_PROPS = [
  { key: "scale", label: "Resolución", type: "select", options: [[50, "50 % (más ligero)"], [75, "75 %"], [100, "100 % (recomendada)"], [150, "150 %"], [200, "200 % (máxima calidad)"]] },
  { key: "customW", label: "Ancho (px)", type: "number", min: 16, max: 8192, custom: true },
  { key: "customH", label: "Alto (px)", type: "number", min: 16, max: 8192, custom: true },
  { key: "guides", label: "Ver zonas seguras", type: "toggle" }
];
const COMP_PROPS = [
  R("gap", "Espaciado entre fotos", 0, 100),
  R("margin", "Margen exterior", 0, 150),
  R("radius", "Esquinas redondeadas", 0, 100),
  { key: "shape", label: "Forma de las fotos", type: "shape", options: SHAPES },
  R("border", "Marco de cada foto", 0, 60),
  { key: "borderColor", label: "Color del marco", type: "color" },
  R("shadow", "Sombra de las fotos", 0, 100)
];
const BG_PROPS = [
  { key: "bg", label: "Fondo", type: "select", options: [["color", "Color liso"], ["gradient", "Degradado"], ["blur", "Foto difuminada"], ["transparent", "Transparente"]] },
  { key: "bgColor", label: "Color", type: "color", when: S => S.bg !== "transparent" && S.bg !== "blur" },
  { key: "bgColor2", label: "Segundo color", type: "color", when: S => S.bg === "gradient" },
  { ...R("bgAngle", "Ángulo del degradado", 0, 360, "°"), when: S => S.bg === "gradient" },
  { ...R("bgBlur", "Desenfoque", 0, 100), when: S => S.bg === "blur" },
  { ...R("bgDim", "Oscurecer", 0, 100, " %"), when: S => S.bg === "blur" }
];
const CELL_PROPS = [
  { key: "shape", label: "Forma de esta foto", type: "shape", options: [["", "Como las demás"], ...SHAPES], empty: true },
  R("zoom", "Zoom", 100, 500, " %"),
  R("fx", "Encuadre horizontal", 0, 100, " %"),
  R("fy", "Encuadre vertical", 0, 100, " %")
];
/* Pieza del diseño «Libre»: tamaño (lado mayor, en % del lado menor
   del lienzo) y giro. */
const FREE_PROPS = [R("fsize", "Tamaño", 5, 200, " %"), R("frot", "Giro", -180, 180, "°")];
const newSlot = (photo = null, shape = "") => ({ photo, zoom: 100, fx: 50, fy: 50, rot: 0, flip: false, shape });
/* Miniatura SVG de una forma (para los botones de «Forma»). */
function shapeIcon(id){
  const box = { pts: [[2, 2], [22, 2], [22, 22], [2, 22]], box: { x: 2, y: 2, w: 20, h: 20 } };
  if(!id) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" class="ln"/></svg>`;
  if(id === "rect") return `<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="${box.pts.map(p => p.join(",")).join(" ")}"/></svg>`;
  return shapeSvg(id);
}
/* Número de lados o de puntas, en pequeño sobre el botón */
const shapeBadge = id => { const m = /^(?:poly|star)(\d+)$/.exec(id); return id === "triangle" ? "3" : m ? m[1] : ""; };

export function openPostEditor({ photo = null, onAccept, onClose = null }){
  /* Fotos: lienzo a tamaño de trabajo + copia ligera para la vista.
     Viven fuera del estado (un lienzo no se clona); el estado guarda
     sus ids y el historial funciona igual. */
  const photos = new Map();   // id → { full, proxy, thumb }
  let photoSeq = 0;
  const addPhoto = canvas => {
    const id = ++photoSeq;
    const proxy = Math.max(canvas.width, canvas.height) > PROXY_SIDE ? scaled(canvas, PROXY_SIDE) : canvas;
    photos.set(id, { full: canvas, proxy, thumb: scaled(proxy, 160).toDataURL("image/jpeg", .8) });
    return id;
  };

  const S = {
    format: "ig-portrait", orient: "portrait", custom: { w: 1080, h: 1350 }, scale: 100, guides: true,
    layout: photo ? "one" : "4grid",
    gap: 12, margin: 12, radius: 0, shape: "rect", border: 0, borderColor: "#ffffff", shadow: 0,
    bg: "color", bgColor: "#ffffff", bgColor2: "#8ec5ff", bgAngle: 135, bgBlur: 70, bgDim: 15,
    photos: [], slots: [], texts: [],
    free: []          // piezas del diseño «Libre»: { cx, cy, w, h, rot } (fracciones del lienzo)
  };
  if(photo){ const id = addPhoto(photo); S.photos.push(id); }
  let sel = null;               // { type: "cell", i } | { type: "text", uid }
  let closed = false, accepting = false, activeProp = "gap";
  const history = [], future = [];
  const snapshot = () => ({ S: structuredClone(S), sel: sel && { ...sel } });
  const pushHistory = s => { history.push(s); if(history.length > 80) history.shift(); future.length = 0; syncActions(); };
  const remember = () => pushHistory(snapshot());

  const fmt = () => format(S.format);
  const size = () => { const s = sizeOf(fmt(), S.orient, S.custom), k = S.scale / 100; return { W: Math.max(16, Math.round(s.w * k)), H: Math.max(16, Math.round(s.h * k)) }; };
  let { W, H } = size();
  let cells = [];
  const relayout = () => {
    const W0 = W, H0 = H;
    ({ W, H } = size());
    /* El cuerpo de letra y el ancho de caja de los textos van en
       proporción al ANCHO del lienzo: al cambiar de forma (vertical ↔
       horizontal, historia ↔ banner) se corrigen para que el texto
       conserve su tamaño respecto al lado menor. */
    if(W0 && H0 && (W0 !== W || H0 !== H)){
      const f = (Math.min(W0, H0) / W0) / (Math.min(W, H) / W);
      if(Math.abs(f - 1) > 1e-6) for(const t of S.texts){ t.size = clamp(t.size * f, 10, 300); t.w = clamp(t.w * f, 10, 100); }
      /* Las piezas libres conservan su forma en píxeles (la foto no se
         deforma) y su tamaño respecto al lado menor. */
      const g = Math.min(W, H) / Math.min(W0, H0);
      for(const it of S.free || []){ it.w = it.w * W0 * g / W; it.h = it.h * H0 * g / H; }
    }
    cells = cellsOf(S, W, H);
    while(S.slots.length < cells.length) S.slots.push(newSlot());
    if(S.slots.length > cells.length) S.slots.length = cells.length;
    if(sel?.type === "cell" && sel.i >= cells.length) sel = null;
  };
  /* Pone las fotos sin usar en los huecos vacíos, por orden. */
  const autofill = () => {
    const used = new Set(S.slots.map(s => s.photo).filter(Boolean));
    const free = S.photos.filter(id => !used.has(id));
    if(isFree()){ for(const id of free) addFreeItem(id); return; }
    for(const s of S.slots){ if(!free.length) break; if(!s.photo) s.photo = free.shift(); }
  };
  const isFree = () => S.layout === "free";
  /* Nueva pieza suelta con la proporción de su foto (la foto entera se
     ve), a la mitad del lado menor del lienzo y escalonada para que
     no queden todas encima unas de otras. `at` (opcional) = centro en
     fracciones del lienzo. */
  function addFreeItem(id, at = null){
    const p = photos.get(id), a = p ? p.full.width / p.full.height : 1;
    const s = Math.min(W, H) * .5, wpx = a >= 1 ? s : s * a, hpx = a >= 1 ? s / a : s;
    const n = S.free.length;
    const it = { cx: at ? at.x : clamp(.5 + ((n % 5) - 2) * .07, .15, .85), cy: at ? at.y : clamp(.5 + (((n / 5) | 0) % 3 - 1) * .08 + ((n % 5) - 2) * .03, .15, .85),
                 w: wpx / W, h: hpx / H, rot: n ? ((n * 37) % 15) - 7 : 0 };
    S.free.push(it); S.slots.push(newSlot(id));
    cells = cellsOf(S, W, H);
    return S.free.length - 1;
  }
  /* Ajusta la pieza a la proporción de una foto nueva (mismo ancho). */
  function fitFreeTo(i, id){
    const p = photos.get(id), it = S.free[i]; if(!p || !it) return;
    it.h = it.w * W / (p.full.width / p.full.height) / H;
  }
  const selText = () => sel?.type === "text" ? S.texts.find(t => t.uid === sel.uid) || null : null;
  const selCell = () => sel?.type === "cell" ? S.slots[sel.i] || null : null;

  const opt = (list, value) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}>${esc(l)}</option>`).join("");
  const formatOptions = () => GROUPS.map(([g, label]) => `<optgroup label="${esc(label)}">${opt(FORMATS.filter(f => f.group === g).map(f => [f.id, f.label]), S.format)}</optgroup>`).join("");

  const root = document.createElement("section");
  root.className = "sp-editor";
  root.innerHTML = `
    <header class="sp-topbar">
      <button class="sp-cancel" type="button">Cancelar</button>
      <button class="sp-close" type="button" aria-label="Cancelar">✕</button>
      <div class="sp-title"><b>Collage / History / Post</b><span class="sp-size"></span></div>
      <div class="sp-actions">
        <button type="button" data-action="undo" aria-label="Deshacer">↶</button>
        <button type="button" data-action="redo" aria-label="Rehacer">↷</button>
        <button class="primary" type="button" data-action="accept">Aplicar</button>
      </div>
    </header>
    <main class="sp-workspace">
      <aside class="sp-left">
        <section><h3>Formato</h3>
          <div class="sp-seg sp-groups">${GROUPS.map(([g, l]) => `<button type="button" data-group="${g}">${esc(l)}</button>`).join("")}</div>
          <div class="sp-formats"></div>
          <div class="sp-custom"></div>
          <div class="sp-seg sp-orient"><button type="button" data-orient="portrait">▯ Vertical</button><button type="button" data-orient="landscape">▭ Horizontal</button></div>
          <div class="sp-lienzo"></div>
        </section>
        <section><h3>Diseño</h3><div class="sp-layouts"></div></section>
        <section><h3>Fotos</h3>
          <div class="sp-tray"></div>
          <div class="sp-photo-btns"><button type="button" data-p="open">📂 Abrir fotos…</button><button type="button" data-p="paste">📋 Pegar</button></div>
          <p class="sp-note">Arrastra una foto a un hueco, o elige un hueco y toca la foto. También puedes soltar archivos aquí o pegar con Ctrl+V.</p>
        </section>
        <section><h3>Textos</h3><div class="sp-textlist"></div><button type="button" class="sp-addtext">＋ Añadir texto</button></section>
      </aside>
      <div class="sp-stage"><canvas></canvas></div>
      <aside class="sp-props"></aside>
    </main>
    <footer class="sp-mobile">
      <div class="sp-row"><select class="sp-format-select" aria-label="Formato">${formatOptions()}</select><button type="button" class="sp-orient-btn" aria-label="Cambiar orientación">⇆</button></div>
      <div class="sp-row"><select class="sp-layout-select" aria-label="Diseño">${opt(LAYOUTS.map(l => [l.id, l.id === "free" ? l.label : `${l.label} · ${l.cells.length}`]), S.layout)}</select><button type="button" class="sp-add primary" data-p="open">＋ Fotos</button></div>
      <select class="sp-prop-select" aria-label="Ajuste"></select>
      <div class="sp-mobile-control"></div>
      <div class="sp-tray sp-tray-m"></div>
      <div class="sp-row sp-acts"></div>
    </footer>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const stage = $(".sp-stage"), canvas = $(".sp-stage canvas"), ctx = canvas.getContext("2d");
  let formatGroup = fmt().group;

  /* ── Vista ── */
  let view = { k: 1, ox: 0, oy: 0, dpr: 1 }, frame = 0;
  const textCache = new Map();
  const fit = () => {
    const box = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * dpr)); canvas.height = Math.max(1, Math.round(box.height * dpr));
    const pad = (matchMedia(MOBILE).matches ? 10 : 28) * dpr;
    const k = Math.min((canvas.width - pad * 2) / W, (canvas.height - pad * 2) / H);
    view = { k, ox: Math.round((canvas.width - W * k) / 2), oy: Math.round((canvas.height - H * k) / 2), dpr };
    textCache.clear(); request();
  };
  const request = () => { if(!frame && !closed) frame = requestAnimationFrame(draw); };
  const rendered = t => {
    const key = JSON.stringify(t) + view.k + W + H;
    const hit = textCache.get(t.uid);
    if(hit && hit.key === key) return hit.r;
    const r = renderText(t, W, H, view.k);
    textCache.set(t.uid, { key, r });
    return r;
  };
  const bgPhotoId = () => S.slots.find(s => s.photo)?.photo || S.photos[0] || null;
  const img = (slot, full = false) => {
    const p = slot?.photo && photos.get(slot.photo);
    return p ? orientedPhoto(full ? p.full : p.proxy, slot.rot, slot.flip) : null;
  };
  let dropTarget = -1;          // hueco resaltado mientras se arrastra
  const HANDLE = 14;
  const corners = r => {
    const a = r.rot, c = Math.cos(a), s = Math.sin(a), hw = r.w / 2, hh = r.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [r.cx + u * c - v * s, r.cy + u * s + v * c]);
  };
  function draw(){
    frame = 0; if(closed) return;
    const d = view.dpr, k = view.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(view.ox, view.oy);
    // Tablero de transparencia bajo un fondo transparente
    if(S.bg === "transparent"){
      const q = 10 * d; ctx.fillStyle = "#e9e9e9"; ctx.fillRect(0, 0, W * k, H * k); ctx.fillStyle = "#cfcfcf";
      for(let y = 0; y < H * k; y += q) for(let x = (y / q) % 2 ? q : 0; x < W * k; x += q * 2) ctx.fillRect(x, y, Math.min(q, W * k - x), Math.min(q, H * k - y));
    }
    const bg = bgPhotoId() && photos.get(bgPhotoId());
    drawBackground(ctx, S, W, H, k, bg?.proxy);
    cells.forEach((c, i) => drawCell(ctx, S, c, img(S.slots[i]), S.slots[i], W, H, k, { empty: true }));
    // Huecos vacíos: un «+» para que se vea dónde van las fotos
    ctx.save(); ctx.scale(k, k);
    cells.forEach((c, i) => {
      if(S.slots[i]?.photo) return;
      const cx = c.float ? c.cx : c.box.x + c.box.w / 2, cy = c.float ? c.cy : c.box.y + c.box.h / 2;
      const r = Math.min(c.float ? c.w : c.box.w, c.float ? c.h : c.box.h) * .12;
      ctx.strokeStyle = "rgba(120,130,150,.9)"; ctx.lineWidth = Math.max(1.5 * d / k, r * .12); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    });
    ctx.restore();
    ctx.beginPath(); ctx.rect(0, 0, W * k, H * k); ctx.clip();
    for(const t of S.texts) drawText(ctx, t, rendered(t));
    ctx.restore();
    drawGuides();
    // Hueco elegido o de destino
    const mark = (i, color) => {
      const c = cells[i]; if(!c) return;
      ctx.save(); ctx.translate(view.ox, view.oy); ctx.scale(k, k);
      if(c.float){ ctx.translate(c.cx, c.cy); ctx.rotate(c.rot * Math.PI / 180); }
      cellPath(ctx, shapeOf(localCell(c), shapeIdOf(S, S.slots[i])), rel(S.radius, W, H));
      ctx.restore();
      ctx.save(); ctx.lineWidth = 2.5 * d; ctx.strokeStyle = color; ctx.shadowColor = "#000a"; ctx.shadowBlur = 3 * d; ctx.stroke(); ctx.restore();
    };
    if(sel?.type === "cell") mark(sel.i, "#6794ff");
    const fh = freeHandle();
    if(fh){
      ctx.save(); ctx.fillStyle = "#6794ff"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5 * d; ctx.shadowColor = "#000a"; ctx.shadowBlur = 3 * d;
      ctx.beginPath(); ctx.arc(fh[0], fh[1], HANDLE * d * .75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.shadowBlur = 0; ctx.font = `${12 * d}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⤡", fh[0], fh[1] + .5);
      ctx.restore();
    }
    if(dropTarget >= 0) mark(dropTarget, "#7fe0a3");
    const t = selText(), r = t && rendered(t);
    if(r){
      const pts = corners({ cx: r.cx + view.ox, cy: r.cy + view.oy, w: r.w, h: r.h, rot: t.rot * Math.PI / 180 });
      ctx.save(); ctx.lineWidth = 1.5 * d; ctx.strokeStyle = "#fff"; ctx.setLineDash([6 * d, 4 * d]); ctx.shadowColor = "#000a"; ctx.shadowBlur = 3 * d;
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]); const [hx, hy] = pts[2];
      ctx.fillStyle = "#6794ff"; ctx.beginPath(); ctx.arc(hx, hy, HANDLE * d * .75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.shadowBlur = 0; ctx.font = `${12 * d}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⤡", hx, hy + .5);
      ctx.restore();
    }
    const f = fmt();
    $(".sp-size").textContent = `${f.id === "custom" ? "Personalizado" : f.label} · ${W} × ${H} · ${aspectText(W, H)}`;
  }

  /* Zonas seguras: lo que taparán la interfaz de la red social o el
     propio teléfono. Sólo en la vista; no salen en el resultado. */
  function drawGuides(){
    const z = S.guides && safeZones(fmt(), W, H);
    if(!z) return;
    const k = view.k, d = view.dpr, x0 = view.ox, y0 = view.oy, w = W * k, h = H * k;
    ctx.save();
    ctx.fillStyle = "rgba(255,70,90,.16)"; ctx.strokeStyle = "rgba(255,120,135,.9)"; ctx.lineWidth = 1 * d; ctx.setLineDash([5 * d, 4 * d]);
    ctx.font = `600 ${11 * d}px system-ui, sans-serif`; ctx.textBaseline = "top";
    const band = (x, y, bw, bh, label, atBottom = false) => {
      if(bw <= 0 || bh <= 0) return;
      ctx.fillRect(x, y, bw, bh); ctx.strokeRect(x + .5, y + .5, bw - 1, bh - 1);
      if(label && bh > 18 * d){
        // Etiqueta sobre una píldora oscura: se lee sobre fondos claros
        ctx.save(); ctx.setLineDash([]);
        const tw = Math.min(ctx.measureText(label).width, bw - 16 * d);
        // La de arriba, pegada a su borde inferior: arriba del todo la
        // taparían los botones de la barra en móvil.
        const ly = atBottom ? y + bh - 19 * d : y + 3 * d;
        ctx.fillStyle = "rgba(20,8,12,.72)"; ctx.beginPath(); ctx.roundRect(x + 4 * d, ly, tw + 8 * d, 16 * d, 4 * d); ctx.fill();
        ctx.fillStyle = "#ffd5da"; ctx.fillText(label, x + 8 * d, ly + 2.5 * d, bw - 16 * d); ctx.restore();
      }
    };
    const story = fmt().safe !== "phone";
    band(x0, y0, w, z.top * h, story ? "Zona tapada por la app (perfil, botones)" : "Barra de estado", true);
    band(x0, y0 + h - z.bottom * h, w, z.bottom * h, story ? "Zona tapada por la app (respuesta, enlaces)" : "");
    if(z.side){ band(x0, y0, z.side * w, h, ""); band(x0 + w - z.side * w, y0, z.side * w, h, ""); }
    if(z.right) band(x0 + w - z.right * w, y0 + z.top * h, z.right * w, h - (z.top + z.bottom) * h, "");
    ctx.setLineDash([]);
    // Pantalla del móvil: esquinas redondeadas y cámara frontal
    if(z.radius){
      const r = Math.min(w, h) * z.radius;
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.roundRect(x0, y0, w, h, r); ctx.fill("evenodd");
      const portrait = h >= w, cw = Math.min(w, h);
      ctx.fillStyle = "#000";
      if(z.cutout === "island"){ ctx.beginPath(); const iw = cw * .3, ih = cw * .085; portrait ? ctx.roundRect(x0 + (w - iw) / 2, y0 + cw * .03, iw, ih, ih / 2) : ctx.roundRect(x0 + cw * .03, y0 + (h - iw) / 2, ih, iw, ih / 2); ctx.fill(); }
      else if(z.cutout === "notch"){ const iw = cw * .45, ih = cw * .075; ctx.beginPath(); portrait ? ctx.roundRect(x0 + (w - iw) / 2, y0 - ih, iw, ih * 2, ih * .8) : ctx.roundRect(x0 - ih, y0 + (h - iw) / 2, ih * 2, iw, ih * .8); ctx.fill(); }
      else if(z.cutout === "hole"){ const rr = cw * .028; ctx.beginPath(); portrait ? ctx.arc(x0 + w / 2, y0 + cw * .05, rr, 0, Math.PI * 2) : ctx.arc(x0 + cw * .05, y0 + h / 2, rr, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  const ensureFonts = () => {
    for(const t of S.texts) loadFont(t.font, t.bold ? 700 : 400, t.italic).then(() => { textCache.clear(); request(); });
  };

  /* ── Controles genéricos ── */
  const valueText = (p, v) => p.type === "range" ? `${Math.round(v)}${p.unit || ""}` : "";
  function control(p, value, onChange, mobile = false){
    const wrap = document.createElement("div");
    wrap.className = `sp-field sp-${p.type}`;
    const label = mobile ? "" : `<span>${esc(p.label)}${p.type === "range" ? `<b>${valueText(p, value)}</b>` : ""}</span>`;
    if(p.type === "range"){
      wrap.innerHTML = `${label}${mobile ? `<span><b>${valueText(p, value)}</b></span>` : ""}<div class="sp-slider-row"><button type="button" class="sp-step" data-step="-1" aria-label="Disminuir">−</button><input type="range" min="${p.min}" max="${p.max}" step="1" value="${value}" aria-label="${esc(p.label)}"><button type="button" class="sp-step" data-step="1" aria-label="Aumentar">+</button></div>`;
      const input = wrap.querySelector("input"), out = wrap.querySelector("b");
      let started = false;
      const set = (v, final) => { v = clamp(Math.round(+v), p.min, p.max); input.value = v; out.textContent = valueText(p, v); onChange(v, final, started); };
      input.addEventListener("input", () => { set(input.value, false); started = true; });
      input.addEventListener("change", () => { set(input.value, true); started = false; });
      wrap.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => set(+input.value + +b.dataset.step, true)));
    } else if(p.type === "color"){
      wrap.innerHTML = `${label}<input type="color" value="${value}" aria-label="${esc(p.label)}">`;
      const input = wrap.querySelector("input");
      let started = false;
      input.addEventListener("input", () => { onChange(input.value, false, started); started = true; });
      input.addEventListener("change", () => { onChange(input.value, true, true); started = false; });
    } else if(p.type === "select" || p.type === "preset"){
      const list = p.type === "preset" ? [["", "Elegir un estilo…"], ...TEXT_PRESETS.map(x => [x[0], x[1]])] : p.options;
      wrap.innerHTML = `${label}<select aria-label="${esc(p.label)}">${opt(list, p.type === "preset" ? "" : value)}</select>`;
      const s = wrap.querySelector("select");
      s.addEventListener("change", () => { onChange(s.value, true); if(p.type === "preset") s.value = ""; });
    } else if(p.type === "shape"){
      if(mobile){
        wrap.innerHTML = `<select aria-label="${esc(p.label)}">${opt(p.options, value)}</select>`;
        const s = wrap.querySelector("select");
        s.addEventListener("change", () => onChange(s.value, true));
      } else {
        wrap.innerHTML = `${label}<div class="sp-shapes">${p.options.map(([v, l]) => `<button type="button" data-shape="${esc(v)}" title="${esc(l)}" aria-label="${esc(l)}" class="${v === value ? "on" : ""}">${shapeIcon(v)}${shapeBadge(v) ? `<span>${shapeBadge(v)}</span>` : ""}</button>`).join("")}</div>`;
        wrap.querySelectorAll("[data-shape]").forEach(b => b.addEventListener("click", () => {
          wrap.querySelectorAll("[data-shape]").forEach(x => x.classList.toggle("on", x === b));
          onChange(b.dataset.shape, true);
        }));
      }
    } else if(p.type === "toggle"){
      wrap.innerHTML = `<label class="sp-toggle"><input type="checkbox"${value ? " checked" : ""}><span>${esc(p.label)}</span></label>`;
      const c = wrap.querySelector("input");
      c.addEventListener("change", () => onChange(c.checked, true));
    } else if(p.type === "number"){
      wrap.innerHTML = `${label}<input type="number" min="${p.min}" max="${p.max}" step="1" value="${value}" inputmode="numeric" aria-label="${esc(p.label)}">`;
      const n = wrap.querySelector("input");
      n.addEventListener("change", () => { const v = clamp(Math.round(+n.value || p.min), p.min, p.max); n.value = v; onChange(v, true); });
    } else if(p.type === "text"){
      wrap.innerHTML = `${label}<textarea rows="${mobile ? 1 : 3}" aria-label="${esc(p.label)}" placeholder="Escribe el texto…">${esc(value)}</textarea>`;
      const a = wrap.querySelector("textarea");
      let started = false;
      a.addEventListener("input", () => { onChange(a.value, false, started); started = true; });
      a.addEventListener("change", () => { started = false; });
    }
    return wrap;
  }

  /* ── Cambios ── */
  const numeric = new Set(["scale"]);
  const setProp = (key, value, final, started) => {
    if(accepting) return;
    if(numeric.has(key)) value = +value;
    const cur = key === "customW" ? S.custom.w : key === "customH" ? S.custom.h : S[key];
    if(cur === value) return;
    if(!started) remember();
    if(key === "customW") S.custom.w = value; else if(key === "customH") S.custom.h = value; else S[key] = value;
    if(["scale", "customW", "customH", "gap", "margin"].includes(key)){ relayout(); if(key !== "gap" && key !== "margin") fit(); }
    if(key === "bg" || key === "scale") syncPanels();
    request();
  };
  const freeValue = key => {
    const it = S.free[sel?.i]; if(!it) return 0;
    return key === "frot" ? Math.round(it.rot || 0) : Math.round(Math.max(it.w * W, it.h * H) / Math.min(W, H) * 100);
  };
  const setFreeProp = (key, value, final, started) => {
    const it = S.free[sel?.i]; if(!it || accepting) return;
    if(!started) remember();
    if(key === "frot") it.rot = value;
    else { const f = value / Math.max(1, freeValue("fsize")); it.w *= f; it.h *= f; }
    cells = cellsOf(S, W, H); request();
  };
  const setCellProp = (key, value, final, started) => {
    const s = selCell(); if(!s || accepting || s[key] === value) return;
    if(!started) remember();
    s[key] = value; request();
  };
  const setTextProp = (key, value, final, started) => {
    const t = selText(); if(!t || accepting) return;
    if(key === "preset"){ if(!value) return; remember(); applyPreset(t, value); ensureFonts(); syncPanels(); request(); return; }
    if(t[key] === value) return;
    if(!started) remember();
    t[key] = value;
    if(key === "font" || key === "bold" || key === "italic") ensureFonts();
    if(key === "text") syncTextList();
    if(["font", "bold", "italic", "caps", "fill"].includes(key)) syncPanels();
    request();
  };
  const chooseFormat = id => {
    if(accepting || id === S.format) return;
    remember();
    const f = format(id);
    S.format = f.id;
    // Las proporciones siguen la orientación elegida; el resto, la suya.
    if(f.group !== "ratio" && f.group !== "custom") S.orient = naturalOrient(f);
    formatGroup = f.group;
    relayout(); fit(); syncPanels();
  };
  const setOrient = o => {
    if(accepting || o === S.orient) return;
    remember();
    S.orient = o;
    if(S.format === "custom" && (o === "landscape") !== (S.custom.w > S.custom.h)) S.custom = { w: S.custom.h, h: S.custom.w };
    relayout(); fit(); syncPanels();
  };
  const chooseLayout = id => {
    if(accepting || id === S.layout) return;
    remember();
    // Las fotos colocadas se conservan por orden en el diseño nuevo.
    const placed = S.slots.filter(s => s.photo);
    if(id === "free"){
      /* A «Libre»: cada foto sigue donde estaba, ahora como pieza
         suelta que se puede mover; los huecos vacíos desaparecen. */
      S.free = []; const slots = [];
      cells.forEach((c, i) => {
        const sl = S.slots[i]; if(!sl?.photo) return;
        S.free.push(c.float ? { cx: c.cx / W, cy: c.cy / H, w: c.w / W, h: c.h / H, rot: c.rot || 0 }
                            : { cx: (c.box.x + c.box.w / 2) / W, cy: (c.box.y + c.box.h / 2) / H, w: c.box.w / W, h: c.box.h / H, rot: 0 });
        slots.push({ ...sl });
      });
      S.layout = id; S.slots = slots; sel = null;
      relayout(); autofill(); syncPanels(); request();
      toast("Diseño libre: arrastra cada foto, usa la esquina para escalar y girar");
      return;
    }
    S.layout = id; S.slots = []; S.free = []; sel = null;
    relayout();
    placed.slice(0, S.slots.length).forEach((s, i) => { S.slots[i] = { ...s }; });
    autofill(); syncPanels(); request();
  };

  /* ── Paneles ── */
  function syncPanels(){
    const f = fmt(), mobile = matchMedia(MOBILE).matches;
    // Formato (escritorio)
    root.querySelectorAll("[data-group]").forEach(b => b.classList.toggle("on", b.dataset.group === formatGroup));
    const list = $(".sp-formats");
    const items = FORMATS.filter(x => x.group === formatGroup);
    list.hidden = formatGroup === "custom";
    list.innerHTML = items.map(x => {
      const s = sizeOf(x, x.group === "ratio" ? S.orient : naturalOrient(x), S.custom), k = 18 / Math.max(s.w, s.h);
      return `<button type="button" data-format="${x.id}" class="${x.id === S.format ? "on" : ""}"><i style="width:${Math.max(4, s.w * k).toFixed(1)}px;height:${Math.max(4, s.h * k).toFixed(1)}px"></i><b>${esc(x.label)}</b><span>${s.w} × ${s.h}</span></button>`;
    }).join("");
    list.querySelectorAll("[data-format]").forEach(b => b.addEventListener("click", () => chooseFormat(b.dataset.format)));
    const custom = $(".sp-custom"); custom.innerHTML = "";
    if(formatGroup === "custom"){
      if(S.format !== "custom"){ const b = document.createElement("button"); b.type = "button"; b.className = "sp-wide"; b.textContent = "Usar medidas personalizadas"; b.addEventListener("click", () => chooseFormat("custom")); custom.appendChild(b); }
      else for(const p of LIENZO_PROPS.filter(p => p.custom)) custom.appendChild(control(p, p.key === "customW" ? S.custom.w : S.custom.h, (v, fi, st) => setProp(p.key, v, fi, st)));
    }
    root.querySelectorAll("[data-orient]").forEach(b => { b.classList.toggle("on", b.dataset.orient === S.orient); });
    const lz = $(".sp-lienzo"); lz.innerHTML = "";
    for(const p of LIENZO_PROPS.filter(p => !p.custom)){
      if(p.key === "guides" && !f.safe) continue;
      lz.appendChild(control(p, S[p.key], (v, fi, st) => setProp(p.key, v, fi, st)));
    }
    if(f.group === "phone") lz.insertAdjacentHTML("beforeend", `<p class="sp-note">Resolución nativa de la pantalla: sirve para fondos de pantalla e historias a medida de ese móvil.</p>`);
    // Diseños (miniaturas con la forma del lienzo)
    const lay = $(".sp-layouts");
    lay.innerHTML = LAYOUTS.map(l => `<button type="button" data-layout="${l.id}" title="${esc(l.label)}${l.id === "free" ? "" : ` · ${l.cells.length} ${l.cells.length === 1 ? "foto" : "fotos"}`}" class="${l.id === S.layout ? "on" : ""}">${layoutSvg(l, W, H)}<span>${l.id === "free" ? "∞" : l.cells.length}</span></button>`).join("");
    lay.querySelectorAll("[data-layout]").forEach(b => b.addEventListener("click", () => chooseLayout(b.dataset.layout)));
    // Móvil
    $(".sp-format-select").value = S.format;
    $(".sp-layout-select").value = S.layout;
    syncTray(); syncTextList(); syncProps(mobile); syncActions();
  }
  function syncTray(){
    const counts = new Map();
    S.slots.forEach(s => { if(s.photo) counts.set(s.photo, (counts.get(s.photo) || 0) + 1); });
    root.querySelectorAll(".sp-tray").forEach(tray => {
      tray.innerHTML = S.photos.map(id => `<div class="sp-thumb${counts.has(id) ? " used" : ""}" data-photo="${id}"><img src="${photos.get(id).thumb}" alt="" draggable="false">${counts.has(id) ? `<em>✓</em>` : ""}<button type="button" data-remove="${id}" aria-label="Quitar foto">✕</button></div>`).join("") +
        (tray.classList.contains("sp-tray-m") ? `<button type="button" class="sp-thumb-add" data-p="open" aria-label="Añadir fotos">＋</button>` : "") +
        (!S.photos.length && !tray.classList.contains("sp-tray-m") ? `<p class="sp-note">Sin fotos todavía.</p>` : "");
      tray.querySelectorAll("[data-photo]").forEach(el => wireThumb(el, +el.dataset.photo));
      tray.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); removePhoto(+b.dataset.remove); }));
      tray.querySelectorAll("[data-p=open]").forEach(b => b.addEventListener("click", openPhotos));
    });
  }
  const syncTextList = () => {
    const list = $(".sp-textlist");
    list.innerHTML = S.texts.length ? "" : `<p class="sp-note">Sin textos.</p>`;
    S.texts.slice().reverse().forEach(t => {
      const b = document.createElement("button");
      b.type = "button"; b.className = sel?.type === "text" && sel.uid === t.uid ? "on" : "";
      b.textContent = String(t.text).replace(/\s+/g, " ").trim() || "(vacío)";
      b.addEventListener("click", () => { sel = { type: "text", uid: t.uid }; syncPanels(); request(); });
      list.appendChild(b);
    });
  };
  const openGroups = new Set(["cell", "comp", "texto", "tipo", "relleno"]);
  const section = (id, title, body) => {
    const sec = document.createElement("details");
    sec.open = openGroups.has(id);
    sec.addEventListener("toggle", () => { if(sec.open) openGroups.add(id); else openGroups.delete(id); });
    sec.innerHTML = `<summary>${esc(title)}</summary>`;
    body.forEach(el => sec.appendChild(el));
    return sec;
  };
  const cellButtons = () => {
    const acts = document.createElement("div"); acts.className = "sp-buttons";
    acts.innerHTML = isFree()
      ? `<button type="button" data-do="replace">📂 Cambiar foto</button><button type="button" data-do="dupfree">⧉ Duplicar</button><button type="button" data-do="front">▲ Delante</button><button type="button" data-do="back">▼ Detrás</button><button type="button" data-do="rotate">↻ Girar foto</button><button type="button" data-do="flip">⇋ Voltear</button><button type="button" data-do="center">⌖ Centrar encuadre</button><button type="button" data-do="removefree" class="danger">✕ Quitar del lienzo</button>`
      : `<button type="button" data-do="replace">📂 Cambiar foto</button><button type="button" data-do="swap">⇄ Intercambiar</button><button type="button" data-do="rotate">↻ Girar</button><button type="button" data-do="flip">⇋ Voltear</button><button type="button" data-do="center">⌖ Centrar</button><button type="button" data-do="clear" class="danger">✕ Vaciar hueco</button>`;
    acts.querySelectorAll("[data-do]").forEach(b => b.addEventListener("click", () => act(b.dataset.do)));
    return acts;
  };
  function syncProps(mobile){
    const host = $(".sp-props"); host.innerHTML = "";
    const t = selText(), s = selCell();
    if(s){
      host.appendChild(section("cell", isFree() ? `Foto ${sel.i + 1}` : `Foto del hueco ${sel.i + 1}`, s.photo
        ? [...(isFree() ? FREE_PROPS.map(p => control(p, freeValue(p.key), (v, f, st) => setFreeProp(p.key, v, f, st))) : []),
           ...CELL_PROPS.map(p => control(p, s[p.key], (v, f, st) => setCellProp(p.key, v, f, st))), cellButtons()]
        : [Object.assign(document.createElement("p"), { className: "sp-note", textContent: "Hueco vacío: arrastra una foto de la bandeja, tócala, o ábrela desde aquí." }),
           ...CELL_PROPS.filter(p => p.empty).map(p => control(p, s[p.key], (v, f, st) => setCellProp(p.key, v, f, st))), cellButtons()]));
    } else if(t){
      for(const [g, label] of PROP_GROUPS){
        const els = TEXT_PROPS.filter(p => p.group === g && !((p.key === "color2" || p.key === "gradAngle") && t.fill !== "gradient"))
          .map(p => control(p, t[p.key], (v, f, st) => setTextProp(p.key, v, f, st)));
        host.appendChild(section(g, label, els));
      }
      const acts = document.createElement("div"); acts.className = "sp-buttons";
      acts.innerHTML = `<button type="button" data-do="dup">⧉ Duplicar</button><button type="button" data-do="front">▲ Delante</button><button type="button" data-do="back">▼ Detrás</button><button type="button" data-do="del" class="danger">✕ Eliminar</button>`;
      acts.querySelectorAll("[data-do]").forEach(b => b.addEventListener("click", () => act(b.dataset.do)));
      host.appendChild(acts);
    } else {
      const empty = document.createElement("div"); empty.className = "sp-props-empty";
      empty.innerHTML = `<b>Sin selección</b><span>Toca un hueco para encuadrar su foto o un texto para editarlo.</span>`;
      host.appendChild(empty);
    }
    host.appendChild(section("comp", "Composición", COMP_PROPS.map(p => control(p, S[p.key], (v, f, st) => setProp(p.key, v, f, st)))));
    host.appendChild(section("bg", "Fondo", BG_PROPS.filter(p => !p.when || p.when(S)).map(p => control(p, S[p.key], (v, f, st) => setProp(p.key, v, f, st)))));

    // Móvil: desplegable de ajustes + su control + acciones
    const groups = [
      ["Lienzo", LIENZO_PROPS.filter(p => (!p.custom || S.format === "custom") && (p.key !== "guides" || fmt().safe))],
      ["Composición", COMP_PROPS],
      ["Fondo", BG_PROPS.filter(p => !p.when || p.when(S))]
    ];
    if(s) groups.unshift(["Foto elegida", [...(isFree() && s.photo ? FREE_PROPS.map(p => ({ ...p, freeProp: true })) : []), ...CELL_PROPS.filter(p => s.photo || p.empty).map(p => ({ ...p, cell: true }))]]);
    const ps = $(".sp-prop-select");
    ps.innerHTML = groups.map(([label, ps]) => `<optgroup label="${esc(label)}">${ps.map(p => `<option value="${p.freeProp ? "f:" : p.cell ? "c:" : "s:"}${p.key}">${esc(p.label)}</option>`).join("")}</optgroup>`).join("") +
      (t ? PROP_GROUPS.map(([g, label]) => `<optgroup label="Texto · ${esc(label)}">${TEXT_PROPS.filter(p => p.group === g).map(p => `<option value="t:${p.key}">${esc(p.label)}</option>`).join("")}</optgroup>`).join("") : "");
    const valid = [...ps.options].map(o => o.value);
    if(!valid.includes(activeProp)) activeProp = t ? "t:text" : s && s.photo ? "c:zoom" : "s:gap";
    ps.value = activeProp;
    mobileControl();
    const acts = $(".sp-acts");
    acts.innerHTML = `<button type="button" data-do="addtext">＋ Texto</button>` + (s && isFree()
      ? `<button type="button" data-do="front">▲ Delante</button><button type="button" data-do="dupfree">⧉ Duplicar</button><button type="button" data-do="removefree" class="danger">✕ Quitar</button>`
      : s
      ? `<button type="button" data-do="replace">📂 Cambiar</button><button type="button" data-do="rotate">↻ Girar</button><button type="button" data-do="clear" class="danger">✕ Vaciar</button>`
      : t ? `<button type="button" data-do="dup">⧉ Duplicar</button><button type="button" data-do="front">▲ Delante</button><button type="button" data-do="del" class="danger">✕ Eliminar</button>`
      : `<button type="button" data-p="paste">📋 Pegar foto</button>`);
    acts.querySelectorAll("[data-do]").forEach(b => b.addEventListener("click", () => b.dataset.do === "addtext" ? addText() : act(b.dataset.do)));
    acts.querySelectorAll("[data-p=paste]").forEach(b => b.addEventListener("click", pastePhotos));
    root.classList.toggle("has-selection", !!(s || t));
  }
  const mobileControl = () => {
    const host = $(".sp-mobile-control"); host.innerHTML = "";
    const [kind, key] = [activeProp.slice(0, 1), activeProp.slice(2)];
    if(kind === "s"){
      const p = [...LIENZO_PROPS, ...COMP_PROPS, ...BG_PROPS].find(p => p.key === key);
      const v = key === "customW" ? S.custom.w : key === "customH" ? S.custom.h : S[key];
      if(p) host.appendChild(control(p, v, (val, f, st) => { setProp(key, val, f, st); if(key === "bg") syncProps(true); }, true));
    } else if(kind === "f"){
      const p = FREE_PROPS.find(p => p.key === key);
      if(selCell() && p) host.appendChild(control(p, freeValue(key), (v, f, st) => setFreeProp(key, v, f, st), true));
    } else if(kind === "c"){
      const s = selCell(), p = CELL_PROPS.find(p => p.key === key);
      if(s && p) host.appendChild(control(p, s[key], (v, f, st) => setCellProp(key, v, f, st), true));
    } else {
      const t = selText(), p = textProp(key);
      if(t && p) host.appendChild(control(p, t[key], (v, f, st) => setTextProp(key, v, f, st), true));
    }
  };
  $(".sp-prop-select").addEventListener("change", e => { activeProp = e.target.value; mobileControl(); });
  root.querySelectorAll("[data-group]").forEach(b => b.addEventListener("click", () => { formatGroup = b.dataset.group; syncPanels(); }));
  root.querySelectorAll("[data-orient]").forEach(b => b.addEventListener("click", () => setOrient(b.dataset.orient)));
  $(".sp-orient-btn").addEventListener("click", () => setOrient(S.orient === "portrait" ? "landscape" : "portrait"));
  $(".sp-format-select").addEventListener("change", e => chooseFormat(e.target.value));
  $(".sp-layout-select").addEventListener("change", e => chooseLayout(e.target.value));
  root.querySelectorAll(".sp-photo-btns [data-p=open], .sp-add[data-p=open]").forEach(b => b.addEventListener("click", openPhotos));
  $(".sp-photo-btns [data-p=paste]").addEventListener("click", pastePhotos);

  /* ── Fotos: abrir, pegar, soltar, quitar ── */
  async function addBlobs(blobs, target = -1){
    if(accepting || !blobs.length) return;
    const decoded = [];
    for(const b of blobs){ try{ decoded.push(await decodeImage(b)); }catch(e){ toast(e.message, "err"); } }
    if(!decoded.length || closed) return;
    remember();
    const ids = decoded.map(addPhoto);
    S.photos.push(...ids);
    // Soltada sobre un hueco: la primera va ahí; el resto, a los vacíos
    if(target >= 0 && S.slots[target]){ S.slots[target] = newSlot(ids[0], S.slots[target].shape); if(isFree()) fitFreeTo(target, ids[0]); }
    else if(sel?.type === "cell" && S.slots[sel.i] && !S.slots[sel.i].photo){ S.slots[sel.i] = newSlot(ids[0], S.slots[sel.i].shape); }
    autofill();
    syncPanels(); request();
    toast(ids.length === 1 ? "Foto añadida" : `${ids.length} fotos añadidas`, "ok");
  }
  function openPhotos(target = -1){
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = target < 0 || typeof target !== "number";
    input.addEventListener("change", () => { if(input.files?.length) addBlobs([...input.files], typeof target === "number" ? target : -1); });
    input.click();
  }
  async function pastePhotos(){
    try{
      const items = await navigator.clipboard.read(), blobs = [];
      for(const item of items){ const type = item.types.find(t => t.startsWith("image/")); if(type) blobs.push(await item.getType(type)); }
      if(blobs.length) addBlobs(blobs); else toast("No hay ninguna imagen en el portapapeles");
    }catch{ toast("El navegador no ha dejado leer el portapapeles. Prueba con Ctrl+V o con «Abrir fotos».", "err"); }
  }
  /* Ctrl+V: sólo si lo pegado es una imagen; se para la propagación
     para que el pegado propio de la app (js/io/open.js) no la ponga de
     capa en el documento de detrás. */
  const onPaste = e => {
    if(closed) return;
    const files = [...(e.clipboardData?.items || [])].filter(i => i.kind === "file" && i.type.startsWith("image/")).map(i => i.getAsFile()).filter(Boolean);
    if(!files.length) return;
    e.preventDefault(); e.stopPropagation();
    addBlobs(files);
  };
  root.addEventListener("dragover", e => {
    if(![...(e.dataTransfer?.types || [])].includes("Files")) return;
    e.preventDefault(); e.stopPropagation();
    const i = e.target === canvas ? cellAt(...toLocal(e.clientX, e.clientY)) : -1;
    if(i !== dropTarget){ dropTarget = i; request(); }
  });
  root.addEventListener("dragleave", e => { if(e.target === canvas){ dropTarget = -1; request(); } });
  root.addEventListener("drop", e => {
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith("image/"));
    e.preventDefault(); e.stopPropagation();
    const target = e.target === canvas ? cellAt(...toLocal(e.clientX, e.clientY)) : -1;
    dropTarget = -1; request();
    if(files.length) addBlobs(files, target);
  });
  function removePhoto(id){
    if(accepting) return;
    remember();
    S.photos = S.photos.filter(p => p !== id);
    if(isFree()){
      for(let i = S.slots.length - 1; i >= 0; i--) if(S.slots[i].photo === id){ S.slots.splice(i, 1); S.free.splice(i, 1); }
      sel = null; cells = cellsOf(S, W, H);
    } else S.slots.forEach(s => { if(s.photo === id) Object.assign(s, newSlot(null, s.shape)); });
    syncPanels(); request();
  }
  const assign = (i, id) => {
    if(accepting || !S.slots[i]) return;
    remember();
    S.slots[i] = newSlot(id, S.slots[i].shape);
    if(isFree()) fitFreeTo(i, id);
    sel = { type: "cell", i };
    syncPanels(); request();
  };
  /* Miniatura de la bandeja: tocar = al hueco elegido (o al primero
     vacío); arrastrar = al hueco donde se suelte. */
  function wireThumb(el, id){
    el.addEventListener("pointerdown", e => {
      if(e.target.closest("[data-remove]") || accepting) return;
      const x0 = e.clientX, y0 = e.clientY;
      let ghost = null, lastInside = null;
      try{ el.setPointerCapture(e.pointerId); }catch{}
      const move = ev => {
        if(!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8){
          ghost = document.createElement("img"); ghost.src = photos.get(id).thumb; ghost.className = "sp-ghost"; root.appendChild(ghost);
        }
        if(!ghost) return;
        ghost.style.transform = `translate(${ev.clientX - 32}px, ${ev.clientY - 32}px)`;
        const r = canvas.getBoundingClientRect();
        const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        const i = inside ? cellAt(...toLocal(ev.clientX, ev.clientY)) : -1;
        lastInside = inside ? toLocal(ev.clientX, ev.clientY) : null;
        if(i !== dropTarget){ dropTarget = i; request(); }
      };
      const up = () => {
        el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", cancel);
        if(ghost){
          ghost.remove(); const i = dropTarget; dropTarget = -1;
          if(i >= 0) assign(i, id);
          else if(isFree() && lastInside){ remember(); const j = addFreeItem(id, { x: clamp(lastInside[0] / (W * view.k), 0, 1), y: clamp(lastInside[1] / (H * view.k), 0, 1) }); sel = { type: "cell", i: j }; syncPanels(); request(); }
          else request();
          return;
        }
        if(isFree()){ remember(); const j = addFreeItem(id); sel = { type: "cell", i: j }; syncPanels(); request(); return; }
        let i = sel?.type === "cell" ? sel.i : S.slots.findIndex(s => !s.photo);
        if(i < 0){ toast("Elige primero el hueco donde ponerla"); return; }
        assign(i, id);
      };
      const cancel = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", cancel); ghost?.remove(); dropTarget = -1; request(); };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", cancel);
    });
  }

  /* ── Acciones ── */
  const addText = () => {
    if(accepting) return;
    remember();
    const t = newText({ text: "Tu texto", y: 88 });
    applyPreset(t, "caption");
    t.size = Math.round(70 * Math.min(W, H) / W);
    S.texts.push(t); sel = { type: "text", uid: t.uid }; activeProp = "t:text";
    ensureFonts(); syncPanels(); request(); focusText();
  };
  $(".sp-addtext").addEventListener("click", addText);
  const focusText = () => {
    const mobile = matchMedia(MOBILE).matches;
    if(mobile){ activeProp = "t:text"; $(".sp-prop-select").value = "t:text"; mobileControl(); }
    const a = root.querySelector(mobile ? ".sp-mobile-control textarea" : ".sp-props textarea");
    if(a){ a.focus(); a.select(); }
  };
  function act(what){
    if(accepting) return;
    const t = selText(), s = selCell();
    if(s){
      const i = sel.i;
      if(what === "replace"){ openPhotos(i); return; }
      if(isFree() && ["front", "back", "dupfree", "removefree", "dup", "del"].includes(what)){
        remember();
        const move = (from, to) => { const [f] = S.free.splice(from, 1), [sl] = S.slots.splice(from, 1); S.free.splice(to, 0, f); S.slots.splice(to, 0, sl); };
        if(what === "front"){ move(i, S.free.length - 1); sel = { type: "cell", i: S.free.length - 1 }; }
        else if(what === "back"){ move(i, 0); sel = { type: "cell", i: 0 }; }
        else if(what === "dupfree" || what === "dup"){ S.free.push({ ...S.free[i], cx: clamp(S.free[i].cx + .04, 0, 1), cy: clamp(S.free[i].cy + .04, 0, 1) }); S.slots.push({ ...S.slots[i] }); sel = { type: "cell", i: S.free.length - 1 }; }
        else { S.free.splice(i, 1); S.slots.splice(i, 1); sel = null; }
        cells = cellsOf(S, W, H);
        syncPanels(); request(); return;
      }
      if(what === "swap"){
        const j = (i + 1) % S.slots.length; if(j === i) return;
        remember(); [S.slots[i], S.slots[j]] = [S.slots[j], S.slots[i]]; sel = { type: "cell", i: j };
      } else {
        if(!s.photo && what !== "clear") return;
        remember();
        if(what === "rotate") s.rot = (s.rot + 90) % 360;
        else if(what === "flip") s.flip = !s.flip;
        else if(what === "center") Object.assign(s, { zoom: 100, fx: 50, fy: 50 });
        else if(what === "clear") Object.assign(s, newSlot(null, s.shape));
      }
      syncPanels(); request(); return;
    }
    if(!t) return;
    const k = S.texts.indexOf(t);
    remember();
    if(what === "dup"){ const c = { ...structuredClone(t), uid: newText().uid, x: Math.min(95, t.x + 4), y: Math.min(95, t.y + 4) }; S.texts.splice(k + 1, 0, c); sel = { type: "text", uid: c.uid }; }
    else if(what === "front"){ S.texts.splice(k, 1); S.texts.push(t); }
    else if(what === "back"){ S.texts.splice(k, 1); S.texts.unshift(t); }
    else if(what === "del"){ S.texts.splice(k, 1); sel = null; textCache.delete(t.uid); }
    syncPanels(); request();
  }
  const syncActions = () => {
    $("[data-action=undo]").disabled = !history.length || accepting;
    $("[data-action=redo]").disabled = !future.length || accepting;
    $("[data-action=accept]").disabled = accepting;
  };

  /* ── Gestos en la composición ── */
  const toLocal = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * view.dpr - view.ox, (cy - r.top) * view.dpr - view.oy]; };
  const cellAt = (x, y) => {
    const px = x / view.k, py = y / view.k;
    for(let i = cells.length - 1; i >= 0; i--) if(hitCell(cells[i], px, py)) return i;
    return -1;
  };
  const textAt = (x, y) => {
    for(let i = S.texts.length - 1; i >= 0; i--){
      const t = S.texts[i], r = rendered(t); if(!r) continue;
      const a = -t.rot * Math.PI / 180, dx = x - r.cx, dy = y - r.cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if(Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return t;
    }
    return null;
  };
  const onHandle = (x, y) => {
    const t = selText(), r = t && rendered(t); if(!r) return false;
    const [hx, hy] = corners({ ...r, rot: t.rot * Math.PI / 180 })[2];
    return Math.hypot(x - hx, y - hy) <= HANDLE * view.dpr * 1.6;
  };
  /* Encuadre: el desplazamiento en pantalla pasa a coordenadas de la
     foto (girada si el hueco está girado) y de ahí a fx / fy. */
  const pan = (i, s0, dx, dy) => {
    const c = cells[i], slot = S.slots[i], im = img(slot); if(!im) return;
    const a = -(c.rot || 0) * Math.PI / 180, lx = (dx * Math.cos(a) - dy * Math.sin(a)) / view.k, ly = (dx * Math.sin(a) + dy * Math.cos(a)) / view.k;
    const inner = shapeOf(localCell(c), shapeIdOf(S, slot));
    const r = photoRect({ ...inner, float: false }, im, slot);
    if(r.bw - r.w < -.5) slot.fx = clamp(s0.fx + lx / (r.bw - r.w) * 100, 0, 100);
    if(r.bh - r.h < -.5) slot.fy = clamp(s0.fy + ly / (r.bh - r.h) * 100, 0, 100);
  };
  /* Tirador (esquina inferior derecha) de la pieza libre elegida, en
     píxeles de la vista. */
  function freeHandle(){
    if(!isFree() || sel?.type !== "cell" || !cells[sel.i]) return null;
    const [x, y] = cells[sel.i].pts[2];
    return [view.ox + x * view.k, view.oy + y * view.k];
  }
  const pointers = new Map();
  let gesture = null, lastTap = { t: 0, uid: null };
  canvas.addEventListener("pointerdown", e => {
    if(accepting) return;
    const [x, y] = toLocal(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x, y });
    try{ canvas.setPointerCapture(e.pointerId); }catch{}
    const t = selText(), s = selCell();
    if(pointers.size === 2){
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      if(t) gesture = { type: "pinch", d, ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, size: t.size, w: t.w, rot: t.rot, tx: t.x, ty: t.y, saved: gesture?.saved || snapshot() };
      else if(s && isFree()){ const it = S.free[sel.i]; gesture = { type: "freepinch", i: sel.i, d, ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, it0: { ...it }, saved: gesture?.saved || snapshot() }; }
      else if(s && s.photo) gesture = { type: "cellpinch", d, zoom: s.zoom, saved: gesture?.saved || snapshot() };
      return;
    }
    if(pointers.size > 1) return;
    const fh = freeHandle();
    if(fh && Math.hypot(x + view.ox - fh[0], y + view.oy - fh[1]) <= HANDLE * view.dpr * 1.6){
      const c = cells[sel.i], cx = c.cx * view.k, cy = c.cy * view.k;
      gesture = { type: "freehandle", i: sel.i, saved: snapshot(), cx, cy, d0: Math.hypot(x - cx, y - cy) || 1, a0: Math.atan2(y - cy, x - cx), it0: { ...S.free[sel.i] } };
      return;
    }
    if(onHandle(x, y)){
      const r = rendered(t);
      gesture = { type: "handle", saved: snapshot(), d0: Math.hypot(x - r.cx, y - r.cy) || 1, a0: Math.atan2(y - r.cy, x - r.cx), size: t.size, w: t.w, rot: t.rot, cx: r.cx, cy: r.cy };
      return;
    }
    const hit = textAt(x, y);
    if(hit){
      const now = performance.now();
      if(lastTap.uid === hit.uid && now - lastTap.t < 350){ focusText(); lastTap = { t: 0, uid: null }; return; }
      lastTap = { t: now, uid: hit.uid };
      if(!(sel?.type === "text" && sel.uid === hit.uid)){ sel = { type: "text", uid: hit.uid }; syncPanels(); }
      gesture = { type: "move", saved: snapshot(), x0: x, y0: y, tx: hit.x, ty: hit.y };
      request(); return;
    }
    const i = cellAt(x, y);
    if(i >= 0){
      if(!(sel?.type === "cell" && sel.i === i)){ sel = { type: "cell", i }; syncPanels(); }
      const slot = S.slots[i];
      /* En «Libre», arrastrar mueve la pieza; con Alt (o Mayús) se
         encuadra la foto dentro de ella, como en los demás diseños. */
      gesture = isFree() && !e.altKey && !e.shiftKey
        ? { type: "freemove", i, saved: snapshot(), x0: x, y0: y, it0: { ...S.free[i] } }
        : { type: "cell", i, saved: snapshot(), x0: x, y0: y, s0: { fx: slot.fx, fy: slot.fy } };
    } else if(sel){ sel = null; syncPanels(); gesture = null; }
    request();
  });
  canvas.addEventListener("pointermove", e => {
    if(!pointers.has(e.pointerId) || !gesture) return;
    const [x, y] = toLocal(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x, y });
    if(gesture.type === "freemove" && pointers.size === 1){
      const it = S.free[gesture.i]; if(!it) return;
      it.cx = clamp(gesture.it0.cx + (x - gesture.x0) / (W * view.k), -.2, 1.2);
      it.cy = clamp(gesture.it0.cy + (y - gesture.y0) / (H * view.k), -.2, 1.2);
      gesture.moved = true; cells = cellsOf(S, W, H); request(); return;
    }
    if(gesture.type === "freehandle"){
      const it = S.free[gesture.i]; if(!it) return;
      const f = clamp(Math.hypot(x - gesture.cx, y - gesture.cy) / gesture.d0, .05, 20);
      it.w = clamp(gesture.it0.w * f, .02, 3); it.h = clamp(gesture.it0.h * f, .02, 3);
      it.rot = Math.round(((gesture.it0.rot + (Math.atan2(y - gesture.cy, x - gesture.cx) - gesture.a0) * 180 / Math.PI + 540) % 360) - 180);
      gesture.moved = true; cells = cellsOf(S, W, H); request(); return;
    }
    if(gesture.type === "freepinch" && pointers.size === 2){
      const it = S.free[gesture.i]; if(!it) return;
      const [a, b] = [...pointers.values()], f = (Math.hypot(a.x - b.x, a.y - b.y) || 1) / gesture.d;
      it.w = clamp(gesture.it0.w * f, .02, 3); it.h = clamp(gesture.it0.h * f, .02, 3);
      it.rot = Math.round(((gesture.it0.rot + (Math.atan2(b.y - a.y, b.x - a.x) - gesture.ang) * 180 / Math.PI + 540) % 360) - 180);
      it.cx = gesture.it0.cx + ((a.x + b.x) / 2 - gesture.mx) / (W * view.k); it.cy = gesture.it0.cy + ((a.y + b.y) / 2 - gesture.my) / (H * view.k);
      gesture.moved = true; cells = cellsOf(S, W, H); request(); return;
    }
    if(gesture.type === "cell" && pointers.size === 1){
      if(!S.slots[gesture.i].photo) return;
      pan(gesture.i, gesture.s0, x - gesture.x0, y - gesture.y0); gesture.moved = true;
      // Sobre otro hueco: soltar ahí intercambia las fotos
      const over = isFree() ? -1 : cellAt(x, y);
      dropTarget = over >= 0 && over !== gesture.i ? over : -1;
      request(); return;
    }
    if(gesture.type === "cellpinch" && pointers.size === 2){
      const s = selCell(); if(!s) return;
      const [a, b] = [...pointers.values()];
      s.zoom = clamp(Math.round(gesture.zoom * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / gesture.d), 100, 500);
      gesture.moved = true; request(); return;
    }
    const t = selText(); if(!t) return;
    const sx = 100 / (W * view.k), sy = 100 / (H * view.k);
    if(gesture.type === "move" && pointers.size === 1){ t.x = gesture.tx + (x - gesture.x0) * sx; t.y = gesture.ty + (y - gesture.y0) * sy; gesture.moved = true; }
    else if(gesture.type === "handle"){
      const f = Math.hypot(x - gesture.cx, y - gesture.cy) / gesture.d0;
      t.size = clamp(gesture.size * f, 10, 300); t.w = clamp(gesture.w * f, 10, 100);
      t.rot = Math.round(((gesture.rot + (Math.atan2(y - gesture.cy, x - gesture.cx) - gesture.a0) * 180 / Math.PI + 540) % 360) - 180);
      gesture.moved = true;
    } else if(gesture.type === "pinch" && pointers.size === 2){
      const [a, b] = [...pointers.values()], f = (Math.hypot(a.x - b.x, a.y - b.y) || 1) / gesture.d;
      t.size = clamp(gesture.size * f, 10, 300); t.w = clamp(gesture.w * f, 10, 100);
      t.rot = Math.round(((gesture.rot + (Math.atan2(b.y - a.y, b.x - a.x) - gesture.ang) * 180 / Math.PI + 540) % 360) - 180);
      t.x = gesture.tx + ((a.x + b.x) / 2 - gesture.mx) * sx; t.y = gesture.ty + ((a.y + b.y) / 2 - gesture.my) * sy;
      gesture.moved = true;
    }
    request();
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if(!gesture) return;
    if(!pointers.size){
      if(gesture.type === "cell" && dropTarget >= 0){
        // Intercambio: el encuadre del arrastre no cuenta
        const i = gesture.i, j = dropTarget;
        Object.assign(S.slots[i], gesture.s0);
        [S.slots[i], S.slots[j]] = [S.slots[j], S.slots[i]];
        sel = { type: "cell", i: j }; dropTarget = -1;
        pushHistory(gesture.saved); syncPanels(); request();
      } else if(gesture.moved && gesture.saved){ pushHistory(gesture.saved); syncPanels(); }
      gesture = null;
    } else if(gesture.type === "pinch"){
      const [p] = [...pointers.values()], t = selText();
      gesture = t ? { type: "move", saved: gesture.saved, moved: gesture.moved, x0: p.x, y0: p.y, tx: t.x, ty: t.y } : null;
    } else if(gesture.type === "freepinch"){
      const [p] = [...pointers.values()], it = S.free[gesture.i];
      gesture = it ? { type: "freemove", i: gesture.i, saved: gesture.saved, moved: gesture.moved, x0: p.x, y0: p.y, it0: { ...it } } : null;
    } else if(gesture.type === "cellpinch"){
      const [p] = [...pointers.values()], s = selCell();
      gesture = s ? { type: "cell", i: sel.i, saved: gesture.saved, moved: gesture.moved, x0: p.x, y0: p.y, s0: { fx: s.fx, fy: s.fy } } : null;
    }
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", e => { dropTarget = -1; endPointer(e); });
  canvas.addEventListener("dblclick", e => {
    const [x, y] = toLocal(e.clientX, e.clientY), hit = textAt(x, y);
    if(hit){ sel = { type: "text", uid: hit.uid }; syncPanels(); focusText(); return; }
    const i = cellAt(x, y);
    if(i >= 0 && !S.slots[i].photo) openPhotos(i);
  });
  /* Rueda sobre un hueco: zoom de su foto (un paso de historial por
     ráfaga de rueda). */
  let wheelTimer = 0;
  canvas.addEventListener("wheel", e => {
    if(accepting) return;
    const [x, y] = toLocal(e.clientX, e.clientY), i = cellAt(x, y);
    if(i < 0 || !S.slots[i].photo) return;
    e.preventDefault();
    if(!wheelTimer) remember();
    clearTimeout(wheelTimer); wheelTimer = setTimeout(() => { wheelTimer = 0; syncPanels(); }, 400);
    const s = S.slots[i];
    s.zoom = clamp(Math.round(s.zoom * Math.exp(-e.deltaY * .0015)), 100, 500);
    if(!(sel?.type === "cell" && sel.i === i)){ sel = { type: "cell", i }; syncPanels(); }
    request();
  }, { passive: false });

  /* ── Barra superior ── */
  const restore = s => { Object.assign(S, structuredClone(s.S)); sel = s.sel; formatGroup = fmt().group; ({ W, H } = size()); relayout(); textCache.clear(); ensureFonts(); fit(); syncPanels(); };
  $("[data-action=undo]").addEventListener("click", () => { const p = history.pop(); if(!p) return; future.push(snapshot()); restore(p); });
  $("[data-action=redo]").addEventListener("click", () => { const n = future.pop(); if(!n) return; history.push(snapshot()); restore(n); });
  $(".sp-cancel").addEventListener("click", () => close());
  $(".sp-close").addEventListener("click", () => close());
  $("[data-action=accept]").addEventListener("click", async () => {
    if(accepting || closed) return;
    if(!S.slots.some(s => s.photo) && !S.texts.length){ toast("Añade al menos una foto o un texto"); return; }
    accepting = true; syncActions();
    const button = $("[data-action=accept]"); button.textContent = "Aplicando…";
    try{
      await Promise.all(S.texts.map(t => loadFont(t.font, t.bold ? 700 : 400, t.italic)));
      const full = new Map([...photos].map(([id, p]) => [id, p.full]));
      await onAccept(structuredClone(S), { W, H, format: fmt() }, full);
      close();
    }catch(error){
      console.error(error);
      toast(error?.message || "No se pudo crear la composición", "err");
      accepting = false; button.textContent = "Aplicar"; syncActions();
    }
  });
  const onKey = e => {
    if(closed) return;
    const typing = e.target.matches?.("input, textarea, select");
    if(e.key === "Escape"){ e.preventDefault(); if(typing) e.target.blur(); else if(!accepting) close(); return; }
    if(typing) return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); $(e.shiftKey ? "[data-action=redo]" : "[data-action=undo]").click(); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d"){ e.preventDefault(); act("dup"); return; }
    if(e.key === "Delete" || e.key === "Backspace"){ if(selText()){ e.preventDefault(); act("del"); } else if(selCell()){ e.preventDefault(); act(isFree() ? "removefree" : "clear"); } return; }
    if(isFree() && selCell() && e.key.startsWith("Arrow")){
      e.preventDefault(); remember();
      const it = S.free[sel.i], st = (e.shiftKey ? 10 : 1) / Math.min(W, H);
      if(e.key === "ArrowLeft") it.cx -= st * Math.min(W, H) / W; if(e.key === "ArrowRight") it.cx += st * Math.min(W, H) / W;
      if(e.key === "ArrowUp") it.cy -= st * Math.min(W, H) / H; if(e.key === "ArrowDown") it.cy += st * Math.min(W, H) / H;
      cells = cellsOf(S, W, H); request(); return;
    }
    const t = selText();
    if(t && e.key.startsWith("Arrow")){
      e.preventDefault(); remember();
      const step = e.shiftKey ? 2 : .25;
      if(e.key === "ArrowLeft") t.x -= step; if(e.key === "ArrowRight") t.x += step;
      if(e.key === "ArrowUp") t.y -= step; if(e.key === "ArrowDown") t.y += step;
      request();
    }
  };
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  /* Al cruzar el punto de corte escritorio ↔ móvil cambian los
     controles visibles. */
  const mq = matchMedia(MOBILE), onMq = () => syncPanels();
  mq.addEventListener?.("change", onMq);
  const close = () => {
    if(closed) return;
    closed = true; cancelAnimationFrame(frame); observer.disconnect(); mq.removeEventListener?.("change", onMq);
    document.removeEventListener("keydown", onKey, true); document.removeEventListener("paste", onPaste, true);
    textCache.clear(); photos.clear(); root.remove(); onClose?.();
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("paste", onPaste, true);

  relayout(); autofill(); syncPanels(); fit();
  return { close };
}
