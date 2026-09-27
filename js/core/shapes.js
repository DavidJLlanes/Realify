/* ═══════════════════════════════════════════════════════════════
   FORMAS GEOMÉTRICAS
   Biblioteca común de formas para meter fotos dentro (collage) o
   recortar una imagen con transparencia (Imagen › Recortar en forma).

   `fitShape(id, box)` devuelve la forma encajada en la caja
   { x, y, w, h }:
     · { ellipse: true, box }       círculos y elipses (exactos)
     · { pts: [[x, y], …], box, smooth, concave }  el resto, como
       polígono (las curvas —corazón, gota, flor…— muestreadas con
       suficientes puntos para verse lisas a cualquier tamaño).

   Dos maneras de encajar: las formas «regulares» (polígonos,
   estrellas, corazón, flor, sello) conservan su proporción y se
   centran en la caja; las «de relleno» (elipse, rombo, arco, cápsula,
   escudo, gota) se estiran hasta llenarla.
   ═══════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;

/* [id, nombre, grupo] */
export const SHAPE_LIST = [
  ["circle", "Círculo", "Básicas"], ["ellipse", "Elipse", "Básicas"], ["pill", "Cápsula", "Básicas"],
  ["diamond", "Rombo", "Básicas"], ["arch", "Arco", "Básicas"],
  ["triangle", "Triángulo", "Polígonos"], ["poly5", "Pentágono", "Polígonos"], ["poly6", "Hexágono", "Polígonos"],
  ["poly7", "Heptágono", "Polígonos"], ["poly8", "Octógono", "Polígonos"], ["poly9", "Eneágono", "Polígonos"], ["poly10", "Decágono", "Polígonos"],
  ["star4", "Estrella de 4 puntas", "Estrellas"], ["star5", "Estrella de 5 puntas", "Estrellas"], ["star6", "Estrella de 6 puntas", "Estrellas"],
  ["star7", "Estrella de 7 puntas", "Estrellas"], ["star8", "Estrella de 8 puntas", "Estrellas"], ["star9", "Estrella de 9 puntas", "Estrellas"],
  ["star10", "Estrella de 10 puntas", "Estrellas"],
  ["heart", "Corazón", "Especiales"], ["flower", "Flor", "Especiales"], ["drop", "Gota", "Especiales"], ["shield", "Escudo", "Especiales"],
  ["cross", "Cruz", "Especiales"], ["moon", "Luna", "Especiales"], ["badge", "Sello festoneado", "Especiales"],
  ["cloud", "Nube", "Especiales"], ["bubble", "Bocadillo", "Especiales"]
];
export const shapeName = id => (SHAPE_LIST.find(s => s[0] === id) || [id, id])[1];

const STAR_INNER = { 4: .4, 5: .4, 6: .52, 7: .55, 8: .58, 9: .6, 10: .62 };

/* Puntos de cada forma en coordenadas unitarias (centradas en 0,
   radio ~1) y si se estira para llenar la caja. */
function unitShape(id){
  const reg = (n, a0) => Array.from({ length: n }, (_, i) => [Math.cos(a0 + i * TAU / n), Math.sin(a0 + i * TAU / n)]);
  let m;
  if(id === "triangle") return { pts: reg(3, -Math.PI / 2), fill: false };
  if((m = /^poly(\d+)$/.exec(id))){ const n = +m[1]; return { pts: reg(n, -Math.PI / 2 + (n % 2 ? 0 : Math.PI / n)), fill: false }; }
  if((m = /^star(\d+)$/.exec(id))){
    const n = +m[1], k = STAR_INNER[n] || .5, pts = [];
    for(let i = 0; i < n * 2; i++){ const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? k : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return { pts, fill: false, concave: true };
  }
  const sample = (n, f) => Array.from({ length: n }, (_, i) => f(i / n * TAU));
  switch(id){
    case "diamond": return { pts: [[0, -1], [1, 0], [0, 1], [-1, 0]], fill: true };
    case "heart": return { pts: sample(120, t => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]), fill: false, smooth: true, concave: true };
    case "flower": return { pts: sample(180, t => { const r = .72 + .28 * Math.cos(6 * t); return [Math.cos(t - Math.PI / 2) * r, Math.sin(t - Math.PI / 2) * r]; }), fill: false, smooth: true, concave: true };
    case "badge": return { pts: sample(240, t => { const r = .9 + .1 * Math.cos(18 * t); return [Math.cos(t) * r, Math.sin(t) * r]; }), fill: false, smooth: true, concave: true };
    case "pill": {
      const pts = [];
      for(let i = 0; i <= 24; i++){ const a = Math.PI / 2 + i / 24 * Math.PI; pts.push([-1 + Math.cos(a) * .5 + .5, Math.sin(a)]); }
      for(let i = 0; i <= 24; i++){ const a = -Math.PI / 2 + i / 24 * Math.PI; pts.push([1 + Math.cos(a) * .5 - .5, Math.sin(a)]); }
      // Se reescala luego a la caja: cápsula horizontal si la caja es ancha
      return { pts, fill: true, smooth: true, pill: true };
    }
    case "arch": {
      const pts = [[-1, 1], [-1, 0]];
      for(let i = 0; i <= 40; i++){ const a = Math.PI + i / 40 * Math.PI; pts.push([Math.cos(a), Math.sin(a)]); }
      pts.push([1, 1]);
      return { pts, fill: true, smooth: true };
    }
    case "drop": return { pts: sample(120, t => { const s = Math.sin(t / 2); return [Math.sin(t) * s * s * s * .95, -Math.cos(t)]; }).map(([x, y]) => [x * 1.35, y]), fill: true, smooth: true };
    case "shield": return { pts: shieldPts(), fill: true, smooth: true };
    case "cross": { const a = .34; return { pts: [[-a, -1], [a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a]], fill: false, concave: true }; }
    case "moon": return { pts: moonPts(), fill: false, smooth: true, concave: true };
    case "cloud": {
      // Contorno de la unión de varios círculos, muestreado en polar
      const C = [[-.55, .15, .45], [-.15, -.2, .55], [.35, -.1, .5], [.62, .22, .35], [0, .25, .45], [-.8, .35, .25], [.8, .4, .2]];
      const pts = [];
      for(let i = 0; i < 240; i++){
        const a = i / 240 * TAU, dx = Math.cos(a), dy = Math.sin(a);
        let r = 0;
        for(const [cx, cy, cr] of C){ const b = dx * cx + dy * cy, c = cx * cx + cy * cy - cr * cr, disc = b * b - c; if(disc >= 0){ const t = b + Math.sqrt(disc); if(t > r) r = t; } }
        pts.push([dx * r, dy * r]);
      }
      return { pts, fill: false, smooth: true, concave: true };
    }
    case "bubble": {
      const pts = [];
      for(let i = 0; i < 100; i++){
        const a = Math.PI * .62 + i / 100 * TAU * .94;
        pts.push([Math.cos(a), Math.sin(a) * .78 - .1]);
      }
      pts.push([-.55, 1]);
      return { pts, fill: true, smooth: true, concave: true };
    }
  }
  return null;
}
function shieldPts(){
  const pts = [[-1, -1], [1, -1], [1, -.15]];
  for(let i = 1; i <= 30; i++){ const t = i / 30; pts.push([1 - t, -.15 + 1.15 * Math.sin(t * Math.PI / 2)]); }
  for(let i = 1; i < 30; i++){ const t = i / 30; pts.push([-t, 1 - 1.15 * (1 - Math.cos(t * Math.PI / 2))]); }
  pts.push([-1, -.15]);
  return pts;
}
function moonPts(){
  const pts = [];
  // Exterior: semicírculo izquierdo más amplio; interior: círculo desplazado a la derecha
  for(let i = 0; i <= 80; i++){ const a = Math.PI * .5 + i / 80 * Math.PI * 1.0; pts.push([Math.cos(a), Math.sin(a)]); }
  const R = .82, cx = .38;
  for(let i = 80; i >= 0; i--){
    const y = Math.sin(Math.PI * .5 + i / 80 * Math.PI);
    const x = cx - Math.sqrt(Math.max(0, R * R - y * y));
    pts.push([Math.max(x, -1), y]);
  }
  return pts;
}

const cache = new Map();
function unit(id){ if(!cache.has(id)) cache.set(id, unitShape(id)); return cache.get(id); }

/** Forma `id` encajada en la caja. null si no se conoce. */
export function fitShape(id, box){
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  if(id === "circle"){ const d = Math.min(box.w, box.h); return { ellipse: true, box: { x: cx - d / 2, y: cy - d / 2, w: d, h: d } }; }
  if(id === "ellipse") return { ellipse: true, box: { ...box } };
  const u = unit(id);
  if(!u) return null;
  let pts = u.pts;
  if(u.pill && box.h > box.w) pts = pts.map(([x, y]) => [y, x]);   // cápsula vertical
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const ux = Math.min(...xs), uy = Math.min(...ys), uw = Math.max(...xs) - ux || 1, uh = Math.max(...ys) - uy || 1;
  const kx = u.fill ? box.w / uw : Math.min(box.w / uw, box.h / uh), ky = u.fill ? box.h / uh : kx;
  const ox = cx - (ux + uw / 2) * kx, oy = cy - (uy + uh / 2) * ky;
  const out = pts.map(([x, y]) => [ox + x * kx, oy + y * ky]);
  return { ellipse: false, pts: out, box: { x: ox + ux * kx, y: oy + uy * ky, w: uw * kx, h: uh * ky }, smooth: !!u.smooth, concave: !!u.concave };
}

/** Traza la forma (ya encajada) como camino del contexto. */
export function tracePath(ctx, s){
  ctx.beginPath();
  if(s.ellipse){ ctx.ellipse(s.box.x + s.box.w / 2, s.box.y + s.box.h / 2, s.box.w / 2, s.box.h / 2, 0, 0, TAU); return; }
  s.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}

/** Miniatura SVG de la forma (24×24) para botones. */
export function shapeSvg(id, size = 24){
  const s = fitShape(id, { x: 2, y: id === "ellipse" ? 5 : 2, w: size - 4, h: id === "ellipse" ? size - 10 : size - 4 });
  if(!s) return "";
  const body = s.ellipse
    ? `<ellipse cx="${s.box.x + s.box.w / 2}" cy="${s.box.y + s.box.h / 2}" rx="${s.box.w / 2}" ry="${s.box.h / 2}"/>`
    : `<polygon points="${s.pts.map(p => p.map(v => v.toFixed(2)).join(",")).join(" ")}"/>`;
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${body}</svg>`;
}
