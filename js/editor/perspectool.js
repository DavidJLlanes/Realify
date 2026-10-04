/* ═══════════════════════════════════════════════════════════════
   MÓDULO DE PERSPECTIVA

   Cuatro formas de llegar al mismo sitio, porque cada foto pide una:

   · GUÍAS — se traza sobre la foto lo que uno SABE que está recto: el
     horizonte, el canto de un edificio, el marco de una puerta. De ahí
     se deduce la corrección. Es lo más fiable, porque no se ajusta a
     ojo sino a partir de algo conocido.
   · ESQUINAS — las cuatro esquinas de la foto se arrastran a mano.
   · BORDES — se estira un lado entero, como en Snapseed.
   · AJUSTES — deslizadores de trapecio vertical, trapecio horizontal,
     giro y escala, para el retoque fino.

   Todo comparte un único cuadrilátero de DESTINO: la imagen entera se
   estira para caber en él. Esa dirección importa. La versión anterior
   trataba el cuadrilátero como la zona de ORIGEN a enderezar, que es
   la convención del recorte en perspectiva de Photoshop; se maneja al
   revés que la mano (arrastrar a la derecha movía el contenido a la
   izquierda) y, sobre todo, mientras se arrastraba la foto no se movía
   en absoluto: sólo una línea naranja. Se veía como que la herramienta
   no hacía nada, porque efectivamente no hacía nada visible.

   Aquí la foto se deforma en directo mientras se arrastra.
   ═══════════════════════════════════════════════════════════════ */

import { grabDoc, drawPx, nearest } from "./grab.js";
import { doc } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { record } from "../core/history.js";
import { COARSE } from "../core/device.js";
import { scheduleCompose, scheduleOverlay } from "./compositor.js";
import { toast, status } from "../ui/toast.js";
import { view } from "./view.js";
import { warpRectToQuad, unitSquareToQuad, quadToUnitSquare,
         homographyFromGuides, quadFromHomography, fillScaleFor } from "./perspective.js";

/* La vista previa trabaja sobre una copia reducida. Deformar 24 MP en
   cada fotograma de arrastre es imposible: cada celda de la malla es
   un drawImage recortado de la imagen ENTERA, así que el coste va con
   el número de celdas por el tamaño de la imagen. Con una copia de
   1100 px y una malla basta de 10×10 la deformación va fluida, y al
   aplicar se rehace a resolución completa con una malla de 40×40.

   `ctx.clip()` —una llamada por cada uno de los dos triángulos de
   cada celda— es de las operaciones más caras del canvas 2D en los
   navegadores móviles, y encima el coste se multiplica por el número
   de capas del documento. Un móvil no tiene ni la GPU ni la CPU de un
   escritorio, así que ahí se recorta más: menos resolución de proxy y
   una malla más basta durante el arrastre. `pointer:coarse`
   (core/device.js) es la señal correcta —no el ancho de la ventana,
   que un tablet grande también puede ser táctil y lento—. */
const PROXY_MAX  = COARSE ? 640 : 1100;
const MESH_DRAG  = COARSE ? 5   : 10;
const MESH_REST  = COARSE ? 10  : 16;
const MESH_APPLY = 40;

export const persp = {
  mode: "guides",      // guides | corners | edges | adjust
  showGrid: true,
  base: null,          // cuadrilátero antes de los deslizadores
  quad: null,          // el definitivo, base + deslizadores
  guides: [],          // {x1,y1,x2,y2,kind:"v"|"h"} en coords de la imagen ORIGINAL
  drawing: null,       // guía en curso
  drag: null,
  vert: 0, horz: 0, rot: 0, scale: 100
};

let src = null;        // [{id, full, proxy}]
let armed = false;

const identityQuad = () => [[0,0],[doc.w,0],[doc.w,doc.h],[0,doc.h]];

function isIdentity(q){
  if(!q) return true;
  const id = identityQuad();
  return q.every(([x, y], i) =>
    Math.abs(x - id[i][0]) < 0.01 && Math.abs(y - id[i][1]) < 0.01);
}

/* ── entrada y salida ─────────────────────────────────────────── */
export function perspBegin(){
  perspEnd();
  if(!doc.open) return;
  src = doc.layers.map(l => {
    const full = document.createElement("canvas");
    full.width = l.canvas.width; full.height = l.canvas.height;
    full.getContext("2d").drawImage(l.canvas, 0, 0);

    const k = Math.min(1, PROXY_MAX / Math.max(full.width, full.height));
    let proxy = full;
    if(k < 1){
      proxy = document.createElement("canvas");
      proxy.width  = Math.max(1, Math.round(full.width  * k));
      proxy.height = Math.max(1, Math.round(full.height * k));
      const px = proxy.getContext("2d");
      px.imageSmoothingQuality = "high";
      px.drawImage(full, 0, 0, proxy.width, proxy.height);
    }
    return { id: l.id, full, proxy };
  });
  persp.base = identityQuad();
  persp.quad = identityQuad();
  persp.guides = [];
  persp.drawing = null;
  persp.drag = null;
  persp.vert = persp.horz = persp.rot = 0;
  persp.scale = 100;
  armed = true;
}

export function perspEnd(){
  src = null;
  armed = false;
  persp.drawing = null;
  persp.drag = null;
}

/* Devuelve las capas a como estaban antes de tocar nada. */
export function perspRestore(){
  if(!src) return;
  for(const s of src){
    const l = doc.layers.find(x => x.id === s.id);
    if(!l) continue;
    const x = l.ctx;
    x.save();
    x.globalCompositeOperation = "copy";
    x.globalAlpha = 1;
    x.drawImage(s.full, 0, 0);
    x.restore();
    l.thumbDirty = true;
  }
  scheduleCompose();
}

/* ── composición del cuadrilátero ─────────────────────────────── */
function withSliders(base){
  const cx = doc.w / 2, cy = doc.h / 2;
  const kv = (persp.vert || 0) / 100 * 0.45;
  const kh = (persp.horz || 0) / 100 * 0.45;

  // Trapecio: el vertical ensancha abajo y estrecha arriba (o al
  // revés), el horizontal hace lo propio con los lados.
  let q = base.map(([x, y], i) => {
    const arriba = i === 0 || i === 1;
    const izq    = i === 0 || i === 3;
    const fx = 1 + (arriba ? -kv : kv);
    const fy = 1 + (izq    ? -kh : kh);
    return [cx + (x - cx) * fx, cy + (y - cy) * fy];
  });

  const r = (persp.rot || 0) * Math.PI / 180;
  const s = (persp.scale ?? 100) / 100;
  if(r || Math.abs(s - 1) > 1e-9){
    const c = Math.cos(r), sn = Math.sin(r);
    q = q.map(([x, y]) => {
      const dx = (x - cx) * s, dy = (y - cy) * s;
      return [cx + dx * c - dy * sn, cy + dx * sn + dy * c];
    });
  }
  return q;
}

export function perspRecompute(){
  if(!persp.base) persp.base = identityQuad();
  persp.quad = withSliders(persp.base);
}

/* ── vista previa ─────────────────────────────────────────────── */
let pend = false, dragging = false;

export function perspPreview(quality){
  if(!armed || !src) return;
  if(quality === "drag") dragging = true;
  if(pend) return;
  pend = true;
  requestAnimationFrame(() => {
    pend = false;
    const mesh = dragging ? MESH_DRAG : MESH_REST;
    dragging = false;
    renderPreview(mesh);
  });
}

function renderPreview(mesh){
  if(!armed || !src) return;
  const q = persp.quad;
  if(isIdentity(q)){ perspRestore(); scheduleOverlay(); return; }

  for(const s of src){
    const l = doc.layers.find(x => x.id === s.id);
    if(!l) continue;
    // Se deforma la copia reducida directamente sobre el lienzo de la
    // capa, que ya tiene el tamaño del documento: un paso menos que
    // pasar por un lienzo intermedio.
    warpRectToQuad(l.ctx, s.proxy, q, doc.w, doc.h, mesh, mesh);
    l.thumbDirty = true;
  }
  scheduleCompose();
  scheduleOverlay();
}

/* ── guías ────────────────────────────────────────────────────── */
/* Un punto del lienzo (que ya está deformado) llevado a coordenadas de
   la imagen original, para guardar la guía pegada a su contenido. */
function toOriginal(p){
  const inv = quadToUnitSquare(persp.quad || identityQuad());
  const [u, v] = inv(p.x, p.y);
  return { x: u * doc.w, y: v * doc.h };
}

/* Y la vuelta, para dibujarla donde ha ido a parar su contenido. */
function toCanvas(x, y){
  const f = unitSquareToQuad(persp.quad || identityQuad());
  return f(x / doc.w, y / doc.h);
}

/* Cada guía se clasifica por su propia inclinación: una línea más
   ancha que alta es una horizontal, y al revés. Es lo que uno espera
   sin tener que decírselo, y el caso ambiguo (45°) no se da trazando
   sobre algo que de verdad debería estar recto. */
function classify(g){
  return Math.abs(g.x2 - g.x1) >= Math.abs(g.y2 - g.y1) ? "h" : "v";
}

export function perspStraighten(){
  const v = persp.guides.filter(g => g.kind === "v");
  const h = persp.guides.filter(g => g.kind === "h");
  if(!v.length && !h.length){ persp.base = identityQuad(); perspRecompute(); return; }
  const H = homographyFromGuides(v, h, doc.w, doc.h);
  persp.base = quadFromHomography(H, doc.w, doc.h);
  perspRecompute();
}

/* «Automático»: OpenCV busca los segmentos largos casi verticales y casi
   horizontales (js/cv/lines.js) y los pone como guías, que es justo lo
   que hace uno a mano; después se afina arrastrando o borrando guías. */
export async function perspAuto(){
  if(!armed || !src) return;
  const lib = await (await import("../cv/opencv.js")).loadOpenCv();
  if(!lib || !armed || !src) return;
  status("Buscando líneas rectas…");
  await new Promise(r => setTimeout(r, 30));
  // Foto sin deformar: las copias completas de las capas visibles, en su orden
  const flat = document.createElement("canvas"); flat.width = doc.w; flat.height = doc.h;
  const fx = flat.getContext("2d");
  for(const s of src){ const l = doc.layers.find(x => x.id === s.id); if(!l || l.visible === false) continue; fx.globalAlpha = l.opacity ?? 1; fx.drawImage(s.full, 0, 0, doc.w, doc.h); }
  const { detectGuides } = await import("../cv/lines.js");
  const r = detectGuides(lib.cv, flat);
  status("");
  if(!r.v.length && !r.h.length){ toast("No he encontrado líneas rectas claras: traza las guías a mano"); return; }
  persp.base = identityQuad(); persp.quad = identityQuad();
  persp.guides = [...r.v.map(g => ({ ...g, kind: "v" })), ...r.h.map(g => ({ ...g, kind: "h" }))];
  perspStraighten(); perspPreview();
  emit("tool:options"); scheduleOverlay();
  toast(`${r.v.length} guías verticales y ${r.h.length} horizontales: arrastra o toca una para corregirla`, "ok");
}

export function perspClearGuides(){
  persp.guides = [];
  persp.base = identityQuad();
  perspRecompute();
  perspPreview();
}

/* Como en el Guided Upright de Lightroom móvil: máximo 3 guías por
   familia. Al trazar una 4ª del mismo tipo, la más antigua de esa
   familia se suelta sola para hacerle sitio, sin avisos ni bloqueos
   que interrumpan el gesto. */
const MAX_GUIDES_PER_KIND = 3;

function makeRoomFor(kind){
  const idx = persp.guides.findIndex(g => g.kind === kind);
  if(idx >= 0 && persp.guides.filter(g => g.kind === kind).length >= MAX_GUIDES_PER_KIND)
    persp.guides.splice(idx, 1);
}

/* Índice de la guía cuyo trazo pasa más cerca del punto, o -1. Poder
   borrar una guía mal puesta sin empezar de cero es la diferencia
   entre usar el modo y abandonarlo. */
export function perspGuideAt(p){
  const tol = grabDoc(view.zoom, 14);
  let mejor = -1, mejorD = tol;
  persp.guides.forEach((g, i) => {
    const a = toCanvas(g.x1, g.y1), b = toCanvas(g.x2, g.y2);
    const d = distPointSeg(p.x, p.y, a[0], a[1], b[0], b[1]);
    if(d < mejorD){ mejorD = d; mejor = i; }
  });
  return mejor;
}

function distPointSeg(px, py, x1, y1, x2, y2){
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy;
  if(len2 < 1e-9) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1)*dx + (py - y1)*dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}

/* ── tiradores de esquina y borde ─────────────────────────────── */
export function perspHandleAt(p){
  const q = persp.base;
  if(!q) return null;
  const t = grabDoc(view.zoom, 22);
  if(persp.mode === "edges"){
    const E = [[0,1],[1,2],[2,3],[3,0]];
    const k = nearest(p, E.map(([a, b]) => [(q[a][0] + q[b][0]) / 2, (q[a][1] + q[b][1]) / 2]), t);
    return k < 0 ? null : { kind:"edge", a: E[k][0], b: E[k][1] };
  }
  const i = nearest(p, q, t);
  return i < 0 ? null : { kind:"corner", i };
}

/* ── gestos ───────────────────────────────────────────────────── */
export function perspDown(p){
  if(!armed) return;

  if(persp.mode === "guides"){
    const i = perspGuideAt(p);
    if(i >= 0){                       // tocar una guía la borra
      persp.guides.splice(i, 1);
      perspStraighten();
      perspPreview();
      return;
    }
    const o = toOriginal(p);
    persp.drawing = { x1:o.x, y1:o.y, x2:o.x, y2:o.y };
    return;
  }

  const h = perspHandleAt(p);
  if(!h) return;
  persp.drag = { h, from: p,
    start: h.kind === "corner" ? [[...persp.base[h.i]]]
                               : [[...persp.base[h.a]], [...persp.base[h.b]]] };
}

export function perspMove(p){
  if(!armed) return;

  if(persp.drawing){
    const o = toOriginal(p);
    persp.drawing.x2 = o.x; persp.drawing.y2 = o.y;
    scheduleOverlay();
    return;
  }

  const d = persp.drag;
  if(!d) return;
  const dx = p.x - d.from.x, dy = p.y - d.from.y;
  const q = persp.base;
  if(d.h.kind === "corner"){
    q[d.h.i] = [d.start[0][0] + dx, d.start[0][1] + dy];
  } else {
    q[d.h.a] = [d.start[0][0] + dx, d.start[0][1] + dy];
    q[d.h.b] = [d.start[1][0] + dx, d.start[1][1] + dy];
  }
  perspRecompute();
  perspPreview("drag");
}

export function perspUp(){
  if(!armed) return;

  if(persp.drawing){
    const g = persp.drawing;
    persp.drawing = null;
    // Un trazo de menos de 30 px es un clic despistado, no una guía
    const largo = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    if(largo >= 30){
      g.kind = classify(g);
      makeRoomFor(g.kind);
      persp.guides.push(g);
      perspStraighten();
    }
    perspPreview();
    return;
  }

  if(persp.drag){
    persp.drag = null;
    perspPreview();
  }
}

export function perspCancel(){
  if(persp.drag){
    const d = persp.drag, q = persp.base;
    if(d.h.kind === "corner") q[d.h.i] = d.start[0];
    else { q[d.h.a] = d.start[0]; q[d.h.b] = d.start[1]; }
    persp.drag = null;
    perspRecompute();
  }
  persp.drawing = null;
  perspPreview();
}

/* ── acciones ─────────────────────────────────────────────────── */
export function perspFill(){
  if(!armed) return 100;
  const k = fillScaleFor(persp.quad || identityQuad(), doc.w, doc.h);
  persp.scale = Math.min(300, Math.round(persp.scale * k));
  perspRecompute();
  perspPreview();
  return persp.scale;
}

export function perspReset(){
  if(!armed) return;
  persp.base = identityQuad();
  persp.guides = [];
  persp.drawing = null;
  persp.vert = persp.horz = persp.rot = 0;
  persp.scale = 100;
  perspRecompute();
  perspRestore();
  scheduleOverlay();
}

/* Aplica a resolución completa y lo mete en el historial. El tamaño
   del documento no cambia: lo que se ve en la vista previa es
   exactamente lo que queda, sin sorpresas de recorte. */
export function perspApply(){
  if(!armed || !src || !doc.open) return false;
  const q = persp.quad;
  if(isIdentity(q)){ toast("No hay ninguna corrección que aplicar"); return false; }

  status("Aplicando perspectiva…");
  const before = src.map(s => ({ id: s.id, c: s.full }));

  for(const s of src){
    const l = doc.layers.find(x => x.id === s.id);
    if(!l) continue;
    warpRectToQuad(l.ctx, s.full, q, doc.w, doc.h, MESH_APPLY, MESH_APPLY);
    // Una capa de texto deformada ya son píxeles: si conservara sus
    // datos de texto, el primer retoque la volvería a dibujar plana y
    // se perdería la corrección sin avisar.
    if(l.type === "text"){ l.type = "raster"; l.text = null; }
    l.thumbDirty = true;
  }

  const after = doc.layers.map(l => {
    const c = document.createElement("canvas");
    c.width = l.canvas.width; c.height = l.canvas.height;
    c.getContext("2d").drawImage(l.canvas, 0, 0);
    return { id: l.id, c };
  });

  const restore = snaps => {
    for(const s of snaps){
      const l = doc.layers.find(x => x.id === s.id);
      if(!l) continue;
      const x = l.ctx;
      x.save(); x.globalCompositeOperation = "copy"; x.globalAlpha = 1;
      x.drawImage(s.c, 0, 0); x.restore();
      l.thumbDirty = true;
    }
    emit("doc:structure"); emit("doc:change");
  };

  record("Corregir perspectiva", () => restore(before), () => restore(after));

  perspEnd();
  status("");
  emit("doc:structure"); emit("doc:change");
  toast("Perspectiva corregida", "ok");
  return true;
}

/* ── superposición ────────────────────────────────────────────── */
export function drawPerspOverlay(ctx){
  if(!armed) return;
  const px = 1 / Math.max(view.zoom, 1e-6);
  const q = persp.base || identityQuad();

  /* Rejilla de referencia fija sobre el marco: es contra ella contra
     la que se comprueba si un canto ha quedado ya vertical. Tiene que
     ser recta pase lo que pase con la deformación, así que se dibuja
     sobre el marco del documento y no sobre el cuadrilátero. Una
     rejilla que se deformara con la imagen no serviría de referencia
     para nada, porque se torcería igual que lo que hay que enderezar. */
  if(persp.showGrid){
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = px;
    ctx.beginPath();
    for(let i = 1; i < 4; i++){
      const x = doc.w * i / 4, y = doc.h * i / 4;
      ctx.moveTo(x, 0); ctx.lineTo(x, doc.h);
      ctx.moveTo(0, y); ctx.lineTo(doc.w, y);
    }
    ctx.stroke();
  }

  if(persp.mode === "guides"){
    const dibujar = (g, viva) => {
      const a = toCanvas(g.x1, g.y1), b = toCanvas(g.x2, g.y2);
      const kind = g.kind || classify(g);
      const col = kind === "v" ? "#5aa9f5" : "#f5c85a";
      ctx.strokeStyle = col;
      ctx.lineWidth = (viva ? 2.4 : 2) * px;
      ctx.setLineDash(viva ? [8*px, 5*px] : []);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      for(const p of [a, b]){
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.5*px, 0, 6.2832); ctx.fill();
      }
    };
    for(const g of persp.guides) dibujar(g, false);
    if(persp.drawing) dibujar(persp.drawing, true);
    return;
  }

  // Contorno del cuadrilátero y sus tiradores
  ctx.strokeStyle = "#e8a33d";
  ctx.lineWidth = 1.5 * px;
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]);
  ctx.closePath();
  ctx.stroke();

  if(persp.mode === "adjust") return;

  const r = drawPx(8) * px;
  const dot = (x, y) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = "#e8a33d"; ctx.fill();
    ctx.lineWidth = 2 * px; ctx.strokeStyle = "#fff"; ctx.stroke();
  };
  if(persp.mode === "edges"){
    for(const [a, b] of [[0,1],[1,2],[2,3],[3,0]])
      dot((q[a][0]+q[b][0])/2, (q[a][1]+q[b][1])/2);
  } else {
    for(const [x, y] of q) dot(x, y);
  }
}

/* Los mandos viven en el `state` de tools.js porque es de donde los
   lee la barra de opciones; aquí sólo se copian cuando cambian. */
export function perspSync(o){
  let cambio = false;
  for(const k of ["mode", "showGrid", "vert", "horz", "rot", "scale"]){
    if(o[k] !== undefined && persp[k] !== o[k]){ persp[k] = o[k]; cambio = true; }
  }
  if(cambio){ perspRecompute(); perspPreview(); }
}

export const perspArmed = () => armed;
export const perspGuideCount = () => persp.guides.length;
/* Mismo criterio que en transformtool.js: para que cambiar de
   herramienta a media corrección la APLIQUE en vez de descartarla
   (ver deactivate() en tools.js), hace falta saber si hay algo que
   aplicar sin disparar el aviso de perspApply(). */
export const perspHasChange = () => armed && !!src && !isIdentity(persp.quad);
