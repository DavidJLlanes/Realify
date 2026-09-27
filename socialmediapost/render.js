/* ═══════════════════════════════════════════════════════════════
   COLLAGE / HISTORY / POST · DIBUJO
   Fondo y fotos de la composición. Lo usan igual la vista previa (a la
   escala de la pantalla) y el resultado (a tamaño real, una capa por
   foto): sólo cambia `k`, los píxeles de destino por píxel del lienzo.

   Medidas relativas del estado, para que cambiar de formato no rompa
   nada: espaciado, margen, redondeo y borde van en milésimas del lado
   menor del lienzo.
   ═══════════════════════════════════════════════════════════════ */

import { layoutById, cellsFor } from "./layouts.js";
import { SHAPE_LIST, fitShape } from "../js/core/shapes.js";

export const rel = (v, W, H) => v / 1000 * Math.min(W, H);

/** Pieza suelta del modo «Libre» ({ cx, cy, w, h } en fracciones del
    lienzo y `rot` en grados) como hueco girado en píxeles. */
export function freeCell(it, W, H){
  const cx = it.cx * W, cy = it.cy * H, w = Math.max(4, it.w * W), h = Math.max(4, it.h * H), rot = it.rot || 0;
  const a = rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { float: true, free: true, cx, cy, w, h, rot, pts, box: { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }, ellipse: false };
}

/** Huecos del diseño actual en píxeles del lienzo. */
export const cellsOf = (S, W, H) => S.layout === "free"
  ? (S.free || []).map(it => freeCell(it, W, H))
  : cellsFor(layoutById(S.layout), W, H, rel(S.gap, W, H), rel(S.margin, W, H));

/* Camino de un hueco con las esquinas redondeadas (o elipse). */
export function cellPath(ctx, c, radius){
  ctx.beginPath();
  if(c.ellipse){
    ctx.ellipse(c.box.x + c.box.w / 2, c.box.y + c.box.h / 2, c.box.w / 2, c.box.h / 2, 0, 0, Math.PI * 2);
    return;
  }
  const p = c.pts, n = p.length;
  if(radius <= .5){ p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); return; }
  // arcTo en cada vértice, limitado a la mitad de sus dos lados
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.moveTo(...mid(p[n - 1], p[0]));
  for(let i = 0; i < n; i++){
    const a = p[i], b = p[(i + 1) % n], z = p[(i - 1 + n) % n];
    const r = Math.min(radius, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, Math.hypot(a[0] - z[0], a[1] - z[1]) / 2);
    ctx.arcTo(a[0], a[1], b[0], b[1], r);
  }
  ctx.closePath();
}

/* Versión girada / volteada de una foto (se guarda para no repetirla). */
const oriented = new WeakMap();
export function orientedPhoto(img, rot, flip){
  if(!rot && !flip) return img;
  let m = oriented.get(img);
  if(!m){ m = new Map(); oriented.set(img, m); }
  const key = `${rot}|${flip}`;
  if(m.has(key)) return m.get(key);
  const swap = rot % 180 !== 0;
  const c = document.createElement("canvas");
  c.width = swap ? img.height : img.width; c.height = swap ? img.width : img.height;
  const x = c.getContext("2d");
  x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); if(flip) x.scale(-1, 1);
  x.drawImage(img, -img.width / 2, -img.height / 2);
  m.set(key, c);
  return c;
}

/* Dónde cae la foto dentro de su hueco (recorte «cover» con zoom y
   encuadre, fx / fy de 0 a 100). Para las sueltas se usa su rectángulo sin girar. */
export function photoRect(c, img, slot){
  const bw = c.float ? c.w : c.box.w, bh = c.float ? c.h : c.box.h;
  const k = Math.max(bw / img.width, bh / img.height) * (slot.zoom / 100);
  const dw = img.width * k, dh = img.height * k;
  const ox = c.float ? -bw / 2 : c.box.x, oy = c.float ? -bh / 2 : c.box.y;
  return { x: ox + (bw - dw) * slot.fx / 100, y: oy + (bh - dh) * slot.fy / 100, w: dw, h: dh, bw, bh };
}

/* ── Fondo ─────────────────────────────────────────────────────── */
let blurCache = { key: "", canvas: null };
function blurred(img, amount){
  const key = `${img.width}x${img.height}|${amount}`;
  if(blurCache.key === key && blurCache.img === img) return blurCache.canvas;
  // Reducir mucho y volver a ampliar: desenfoque fuerte y barato que
  // da lo mismo en todos los navegadores.
  const side = Math.round(8 + (100 - amount) * 1.2);
  const c = document.createElement("canvas");
  const k = side / Math.max(img.width, img.height);
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
  blurCache = { key, img, canvas: c };
  return c;
}
export function drawBackground(ctx, S, W, H, k, bgPhoto){
  ctx.save(); ctx.scale(k, k);
  if(S.bg === "color"){ ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, W, H); }
  else if(S.bg === "gradient"){
    const a = S.bgAngle * Math.PI / 180, r = Math.abs(W / 2 * Math.cos(a)) + Math.abs(H / 2 * Math.sin(a));
    const g = ctx.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
    g.addColorStop(0, S.bgColor); g.addColorStop(1, S.bgColor2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if(S.bg === "blur"){
    if(bgPhoto){
      const small = blurred(bgPhoto, S.bgBlur);
      const s = Math.max(W / small.width, H / small.height) * 1.08;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(small, (W - small.width * s) / 2, (H - small.height * s) / 2, small.width * s, small.height * s);
      ctx.fillStyle = `rgba(0,0,0,${S.bgDim / 100})`; ctx.fillRect(0, 0, W, H);
    } else { ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, W, H); }
  }
  // «transparent»: nada
  ctx.restore();
}

/* ── Formas geométricas para las fotos ─────────────────────────
   En lugar del hueco rectangular (o diagonal) del diseño, la foto
   puede ir dentro de cualquier forma de la biblioteca común
   (js/core/shapes.js): círculo, elipse, polígonos de 3 a 10 lados,
   estrellas de 4 a 10 puntas, corazón, flor, gota, escudo, cruz, luna,
   sello, nube, bocadillo… encajada y centrada en el hueco. */
export const SHAPES = [["rect", "Según el diseño"], ...SHAPE_LIST.map(([id, name]) => [id, name])];

/* Hueco suelto (girado) en sus coordenadas propias, centrado en 0. */
export const localCell = c => c.float
  ? { ...c, pts: [[-c.w / 2, -c.h / 2], [c.w / 2, -c.h / 2], [c.w / 2, c.h / 2], [-c.w / 2, c.h / 2]], box: { x: -c.w / 2, y: -c.h / 2, w: c.w, h: c.h } }
  : c;

/** Forma `id` encajada en la caja del hueco `c`. */
export function shapeOf(c, id){
  if(!id || id === "rect") return c;
  const s = fitShape(id, c.box);
  return s ? { ...c, ...s } : c;
}
/* Forma que toca a un hueco: la suya propia o, si no tiene, la general. */
export const shapeIdOf = (S, slot) => slot?.shape || S.shape;

/* ── Una foto en su hueco ──────────────────────────────────────── */
export function drawCell(ctx, S, c, img, slot, W, H, k, { empty = false } = {}){
  const radius = rel(S.radius, W, H), border = rel(S.border, W, H);
  ctx.save(); ctx.scale(k, k);
  if(c.float){ ctx.translate(c.cx, c.cy); ctx.rotate(c.rot * Math.PI / 180); }
  const shape = shapeOf(localCell(c), shapeIdOf(S, slot));
  // Sombra: se pinta la forma rellena con sombra y luego la foto encima.
  if(S.shadow > 0 && img){
    const px = Math.min(W, H) / 1000;
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.min(.85, .25 + S.shadow / 160)})`;
    ctx.shadowBlur = S.shadow * px * 1.4 * k; ctx.shadowOffsetY = S.shadow * px * .45 * k;
    cellPath(ctx, shape, radius); ctx.fillStyle = border > 0 ? S.borderColor : "#000"; ctx.fill();
    ctx.restore();
  }
  // Marco: el borde es un anillo por dentro del hueco, como un paspartú.
  if(border > 0 && img){ cellPath(ctx, shape, radius); ctx.fillStyle = S.borderColor; ctx.fill(); }
  const inner = border > 0 && img ? shrink(shape, border) : shape;
  ctx.save();
  cellPath(ctx, inner, inner === shape ? radius : Math.max(0, radius - border)); ctx.clip();
  if(img){
    const r = photoRect({ ...inner, float: false }, img, slot);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
  } else if(empty){
    const b = inner.box;
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
  ctx.restore();
}
/* Hueco reducido `d` píxeles hacia dentro (para el marco). */
function shrink(c, d){
  if(c.ellipse) return { ...c, box: { x: c.box.x + d, y: c.box.y + d, w: Math.max(1, c.box.w - d * 2), h: Math.max(1, c.box.h - d * 2) } };
  /* Curvas y formas cóncavas (corazón, estrellas…): desplazar lados
     no sirve con tantos vértices o con picos hacia dentro; se escala la
     forma hacia su centro lo justo para dejar `d` en la caja. */
  if(c.smooth || c.concave){
    const b = c.box, cx = b.x + b.w / 2, cy = b.y + b.h / 2, kx = Math.max(.05, (b.w - d * 2) / b.w), ky = Math.max(.05, (b.h - d * 2) / b.h);
    return { ...c, pts: c.pts.map(([x, y]) => [cx + (x - cx) * kx, cy + (y - cy) * ky]), box: { x: cx - b.w * kx / 2, y: cy - b.h * ky / 2, w: b.w * kx, h: b.h * ky } };
  }
  const cx = c.pts.reduce((s, p) => s + p[0], 0) / c.pts.length, cy = c.pts.reduce((s, p) => s + p[1], 0) / c.pts.length;
  // Desplazar cada lado hacia el centro: para un convexo, aproximación
  // exacta en rectángulos y muy buena en diagonales.
  const n = c.pts.length, lines = c.pts.map((a, i) => {
    const b = c.pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if((cx - a[0]) * nx + (cy - a[1]) * ny < 0){ nx = -nx; ny = -ny; }
    return { p: [a[0] + nx * d, a[1] + ny * d], v: [dx, dy] };
  });
  const pts = lines.map((l, i) => {
    const m = lines[(i - 1 + n) % n], den = m.v[0] * l.v[1] - m.v[1] * l.v[0];
    if(Math.abs(den) < 1e-9) return l.p;
    const t = ((l.p[0] - m.p[0]) * l.v[1] - (l.p[1] - m.p[1]) * l.v[0]) / den;
    return [m.p[0] + m.v[0] * t, m.p[1] + m.v[1] * t];
  });
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { ...c, pts, box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
}

/** ¿Está el punto (x, y) del lienzo dentro del hueco? */
export function hitCell(c, x, y){
  let pts = c.pts;
  if(c.ellipse){
    const b = c.box, dx = (x - b.x - b.w / 2) / (b.w / 2), dy = (y - b.y - b.h / 2) / (b.h / 2);
    return dx * dx + dy * dy <= 1;
  }
  let inside = false;
  for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
