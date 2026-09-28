/* ═══════════════════════════════════════════════════════════════
   CORTAR · PLAN DE CORTES
   Rectángulos de los trozos (en píxeles de la imagen), por filas, y la
   zona de la imagen que se usa. Los modos con proporción fija (carrusel
   y perfil de Instagram) recortan lo que sobra; `ox`/`oy` (0-1) dicen
   dónde queda esa zona (0,5 = centrada) y se cambian arrastrando.
   ═══════════════════════════════════════════════════════════════ */

export const RATIOS = [["1:1", 1], ["4:5", .8], ["3:4", .75], ["2:3", 2 / 3], ["9:16", .5625], ["16:9", 16 / 9], ["4:3", 4 / 3], ["3:2", 1.5]];
export const MODES = [
  ["grid", "Cuadrícula"], ["size", "Tamaño fijo"], ["carousel", "Carrusel"],
  ["instagram", "Instagram"], ["manual", "A mano"]
];

export function plan(p, W, H){
  let area = { x: 0, y: 0, w: W, h: H }, xs = [0, 1], ys = [0, 1];
  if(p.mode === "grid"){ xs = even(p.cols); ys = even(p.rows); }
  else if(p.mode === "size"){
    const cols = Math.max(1, Math.ceil(W / p.tileW)), rows = Math.max(1, Math.ceil(H / p.tileH));
    xs = [...Array(cols).keys()].map(i => i * p.tileW / W).concat(1);
    ys = [...Array(rows).keys()].map(i => i * p.tileH / H).concat(1);
  }
  else if(p.mode === "manual"){ xs = [0, ...p.xs.slice().sort((a, b) => a - b), 1]; ys = [0, ...p.ys.slice().sort((a, b) => a - b), 1]; }
  else {
    const ig = p.mode === "instagram";
    const r = ig ? (p.igRatio === "3:4" ? .75 : 1) : (RATIOS.find(x => x[0] === p.ratio) || RATIOS[0])[1];
    const cols = ig ? 3 : p.pieces, rows = ig ? p.igRows : 1;
    const target = cols * r / rows;                  // proporción total ancho / alto
    if(W / H > target){ const w = H * target; area = { x: (W - w) * p.ox, y: 0, w, h: H }; }
    else { const h = W / target; area = { x: 0, y: (H - h) * p.oy, w: W, h }; }
    xs = even(cols); ys = even(rows);
  }
  const rects = [];
  for(let r = 0; r < ys.length - 1; r++) for(let c = 0; c < xs.length - 1; c++){
    const x0 = Math.round(area.x + area.w * xs[c]), x1 = Math.round(area.x + area.w * Math.min(1, xs[c + 1]));
    const y0 = Math.round(area.y + area.h * ys[r]), y1 = Math.round(area.y + area.h * Math.min(1, ys[r + 1]));
    if(x1 - x0 < 1 || y1 - y0 < 1) continue;
    rects.push({ r, c, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return { rects, area, xs, ys, rows: ys.length - 1, cols: xs.length - 1 };
}
const even = n => [...Array(n + 1).keys()].map(i => i / n);

/** Número de cada trozo: por filas; en el perfil de Instagram, en el
    orden de SUBIDA (la última publicación queda arriba a la izquierda,
    así que se sube primero la de abajo a la derecha). */
export const pieceNumber = (p, total, i) => p.mode === "instagram" ? total - i : i + 1;

/** Miniatura SVG de cada modo (para la hoja del móvil). */
export function modeSvg(id){
  const R = (x, y, w, h, o = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"${o}/>`;
  if(id === "grid") return `<svg viewBox="0 0 48 48">${R(4, 8, 40, 32)}<path d="M17.3 8v32M30.7 8v32M4 24h40" stroke="#15191e" stroke-width="2"/></svg>`;
  if(id === "size") return `<svg viewBox="0 0 48 48">${R(4, 8, 40, 32)}<path d="M16 8v32M28 8v32M40 8v32M4 18h40M4 28h40" stroke="#15191e" stroke-width="2"/></svg>`;
  if(id === "carousel") return `<svg viewBox="0 0 48 48">${R(2, 14, 44, 20)}<path d="M13 14v20M24 14v20M35 14v20" stroke="#15191e" stroke-width="2"/></svg>`;
  if(id === "instagram") return `<svg viewBox="0 0 48 48">${R(9, 4, 30, 40)}<path d="M19 4v40M29 4v40M9 17.3h30M9 30.7h30" stroke="#15191e" stroke-width="2"/></svg>`;
  return `<svg viewBox="0 0 48 48">${R(4, 8, 40, 32)}<path d="M20 8v32M4 30h40" stroke="#15191e" stroke-width="2"/><circle cx="20" cy="30" r="3.5" fill="#6794ff"/></svg>`;
}
