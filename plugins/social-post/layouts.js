/* ═══════════════════════════════════════════════════════════════
   COLLAGE / HISTORY / POST · DISEÑOS
   Cada diseño es una lista de huecos para fotos. Un hueco es un
   polígono CONVEXO en coordenadas unitarias (0…1 del área útil, es
   decir, del lienzo menos el margen exterior), así que el mismo diseño
   sirve para cualquier formato: cuadrado, historia vertical o banner.

     R(x, y, w, h)       rectángulo
     P([[x, y], …])      polígono convexo (diagonales, triángulos)
     F(x, y, w, h, rot)  foto «suelta»: se dibuja encima, girada, sin
                         separación (collages esparcidos, foto dentro
                         de foto)

   El espaciado entre fotos se aplica desplazando hacia dentro cada
   lado que NO toca el borde del área útil; así las diagonales y los
   triángulos quedan con la misma separación que una cuadrícula.

   Las composiciones clásicas (cuadrículas, «grande + pequeñas»,
   molinete, mosaico) son las mismas que usan instacollage, Insta-Collage
   y los editores de historias; aquí se describen como datos.
   ═══════════════════════════════════════════════════════════════ */

const R = (x, y, w, h) => ({ poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] });
const P = pts => ({ poly: pts });
const F = (x, y, w, h, rot = 0) => ({ float: true, rect: [x, y, w, h], rot });
const E = (x, y, w, h) => ({ poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], ellipse: true });
const grid = (cols, rows) => {
  const out = [];
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++) out.push(R(c / cols, r / rows, 1 / cols, 1 / rows));
  return out;
};

/* [id, nombre, huecos] */
const LIST = [
  /* «Libre»: sin huecos fijos. Cada foto es una pieza suelta que se
     coloca, escala y gira a mano (ver `freeCell` en render.js). */
  ["free", "Libre (colócalas donde quieras)", []],
  ["one", "Una foto", [R(0, 0, 1, 1)]],
  ["frame-tb", "Foto con espacio arriba y abajo", [R(0, .2, 1, .6)]],
  ["polaroid", "Polaroid (texto abajo)", [R(0, 0, 1, .8)]],
  ["circle", "Foto en círculo", [E(.1, .1, .8, .8)]],
  ["pip", "Foto dentro de foto", [R(0, 0, 1, 1), F(.56, .6, .36, .3, 0)]],
  ["2v", "Dos en columnas", [R(0, 0, .5, 1), R(.5, 0, .5, 1)]],
  ["2h", "Dos en filas", [R(0, 0, 1, .5), R(0, .5, 1, .5)]],
  ["2band", "Dos con franja central", [R(0, 0, 1, .42), R(0, .58, 1, .42)]],
  ["2big-l", "Grande y estrecha", [R(0, 0, .66, 1), R(.66, 0, .34, 1)]],
  ["2big-t", "Grande arriba, estrecha abajo", [R(0, 0, 1, .66), R(0, .66, 1, .34)]],
  ["2diag", "Dos en diagonal", [P([[0, 0], [.62, 0], [.38, 1], [0, 1]]), P([[.62, 0], [1, 0], [1, 1], [.38, 1]])]],
  ["3v", "Tres columnas", grid(3, 1)],
  ["3h", "Tres filas", grid(1, 3)],
  ["3l", "Grande a la izquierda + 2", [R(0, 0, .6, 1), R(.6, 0, .4, .5), R(.6, .5, .4, .5)]],
  ["3r", "2 + grande a la derecha", [R(0, 0, .4, .5), R(0, .5, .4, .5), R(.4, 0, .6, 1)]],
  ["3t", "Grande arriba + 2", [R(0, 0, 1, .6), R(0, .6, .5, .4), R(.5, .6, .5, .4)]],
  ["3b", "2 + grande abajo", [R(0, 0, .5, .4), R(.5, 0, .5, .4), R(0, .4, 1, .6)]],
  ["3diag", "Tres en diagonal", [P([[0, 0], [.45, 0], [.2, 1], [0, 1]]), P([[.45, 0], [.8, 0], [.55, 1], [.2, 1]]), P([[.8, 0], [1, 0], [1, 1], [.55, 1]])]],
  ["3scatter", "Tres esparcidas", [F(.04, .06, .56, .42, -8), F(.42, .3, .54, .4, 6), F(.08, .56, .52, .4, -3)]],
  ["4grid", "Cuadrícula 2 × 2", grid(2, 2)],
  ["4v", "Cuatro columnas", grid(4, 1)],
  ["4h", "Cuatro filas", grid(1, 4)],
  ["4t", "Grande arriba + 3", [R(0, 0, 1, .62), R(0, .62, 1 / 3, .38), R(1 / 3, .62, 1 / 3, .38), R(2 / 3, .62, 1 / 3, .38)]],
  ["4l", "Grande a la izquierda + 3", [R(0, 0, .62, 1), R(.62, 0, .38, 1 / 3), R(.62, 1 / 3, .38, 1 / 3), R(.62, 2 / 3, .38, 1 / 3)]],
  ["4mosaic", "Mosaico de 4", [R(0, 0, .6, .55), R(.6, 0, .4, .55), R(0, .55, .4, .45), R(.4, .55, .6, .45)]],
  ["4x", "Cuatro triángulos", [P([[0, 0], [1, 0], [.5, .5]]), P([[1, 0], [1, 1], [.5, .5]]), P([[1, 1], [0, 1], [.5, .5]]), P([[0, 1], [0, 0], [.5, .5]])]],
  ["4scatter", "Cuatro esparcidas", [F(.03, .04, .5, .4, -7), F(.47, .08, .5, .4, 5), F(.05, .52, .5, .4, 4), F(.46, .55, .5, .4, -6)]],
  ["5a", "2 arriba + 3 abajo", [R(0, 0, .5, .5), R(.5, 0, .5, .5), R(0, .5, 1 / 3, .5), R(1 / 3, .5, 1 / 3, .5), R(2 / 3, .5, 1 / 3, .5)]],
  ["5b", "3 arriba + 2 abajo", [R(0, 0, 1 / 3, .5), R(1 / 3, 0, 1 / 3, .5), R(2 / 3, 0, 1 / 3, .5), R(0, .5, .5, .5), R(.5, .5, .5, .5)]],
  ["5l", "Grande + 4 pequeñas", [R(0, 0, .5, 1), R(.5, 0, .25, .5), R(.75, 0, .25, .5), R(.5, .5, .25, .5), R(.75, .5, .25, .5)]],
  ["5pin", "Molinete", [R(0, 0, .6, .4), R(.6, 0, .4, .6), R(.4, .6, .6, .4), R(0, .4, .4, .6), R(.4, .4, .2, .2)]],
  ["6a", "Cuadrícula 2 × 3", grid(2, 3)],
  ["6b", "Cuadrícula 3 × 2", grid(3, 2)],
  ["6big", "Grande + 5 pequeñas", [R(0, 0, 2 / 3, 2 / 3), R(2 / 3, 0, 1 / 3, 1 / 3), R(2 / 3, 1 / 3, 1 / 3, 1 / 3), R(0, 2 / 3, 1 / 3, 1 / 3), R(1 / 3, 2 / 3, 1 / 3, 1 / 3), R(2 / 3, 2 / 3, 1 / 3, 1 / 3)]],
  ["7", "3 + panorámica + 3", [R(0, 0, 1 / 3, .3), R(1 / 3, 0, 1 / 3, .3), R(2 / 3, 0, 1 / 3, .3), R(0, .3, 1, .4), R(0, .7, 1 / 3, .3), R(1 / 3, .7, 1 / 3, .3), R(2 / 3, .7, 1 / 3, .3)]],
  ["8", "Cuadrícula 2 × 4", grid(2, 4)],
  ["9", "Cuadrícula 3 × 3", grid(3, 3)],
  ["12", "Cuadrícula 3 × 4", grid(3, 4)],
  ["16", "Cuadrícula 4 × 4", grid(4, 4)]
];

export const LAYOUTS = LIST.map(([id, label, cells]) => ({ id, label, cells }));
export const layoutById = id => LAYOUTS.find(l => l.id === id) || LAYOUTS[0];

const EPS = 1e-6;
const onBorder = (a, b) =>
  (Math.abs(a[0]) < EPS && Math.abs(b[0]) < EPS) || (Math.abs(a[0] - 1) < EPS && Math.abs(b[0] - 1) < EPS) ||
  (Math.abs(a[1]) < EPS && Math.abs(b[1]) < EPS) || (Math.abs(a[1] - 1) < EPS && Math.abs(b[1] - 1) < EPS);

/* Desplaza hacia dentro los lados de un polígono convexo (en píxeles)
   la distancia de cada lado, y devuelve los nuevos vértices. */
function inset(pts, dist){
  const n = pts.length;
  let area = 0;
  for(let i = 0; i < n; i++){ const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1;
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    // Normal hacia dentro (con y hacia abajo y orden horario, (-dy, dx))
    const nx = -dy / len * sgn, ny = dx / len * sgn, d = dist[i];
    return { p: [a[0] + nx * d, a[1] + ny * d], v: [dx, dy] };
  });
  return lines.map((l, i) => {
    const m = lines[(i - 1 + n) % n];
    const den = m.v[0] * l.v[1] - m.v[1] * l.v[0];
    if(Math.abs(den) < 1e-9) return l.p;
    const t = ((l.p[0] - m.p[0]) * l.v[1] - (l.p[1] - m.p[1]) * l.v[0]) / den;
    return [m.p[0] + m.v[0] * t, m.p[1] + m.v[1] * t];
  });
}

/**
 * Huecos del diseño en píxeles para un lienzo W×H.
 * `gap` y `margin` en píxeles. Devuelve [{ pts, box, ellipse, float, rot }].
 */
export function cellsFor(layout, W, H, gap, margin){
  const m = Math.min(margin, Math.min(W, H) * .45);
  const iw = W - m * 2, ih = H - m * 2;
  const map = ([u, v]) => [m + u * iw, m + v * ih];
  return layout.cells.map(c => {
    let pts;
    if(c.float){
      const [x, y, w, h] = c.rect, cx = m + (x + w / 2) * iw, cy = m + (y + h / 2) * ih;
      // Las sueltas conservan su forma: se miden sobre el lado menor.
      const s = Math.min(iw, ih), bw = w * (iw + s) / 2, bh = h * (ih + s) / 2;
      const a = c.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      pts = [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]].map(([px, py]) => [cx + px * co - py * si, cy + px * si + py * co]);
      return { pts, box: bbox(pts), float: true, rot: c.rot, w: bw, h: bh, cx, cy };
    }
    const n = c.poly.length;
    const dist = c.poly.map((a, i) => onBorder(a, c.poly[(i + 1) % n]) ? 0 : gap / 2);
    pts = inset(c.poly.map(map), dist);
    return { pts, box: bbox(pts), ellipse: !!c.ellipse, float: false, rot: 0 };
  });
}
function bbox(pts){
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* Miniatura SVG del diseño para los botones (proporción del lienzo). */
export function layoutSvg(layout, w, h){
  const k = 36 / Math.max(w, h), W = Math.max(8, w * k), H = Math.max(8, h * k);
  if(layout.id === "free"){
    const r = (x, y, a, s) => `<rect x="${(x * W - s / 2).toFixed(1)}" y="${(y * H - s * .38).toFixed(1)}" width="${s.toFixed(1)}" height="${(s * .76).toFixed(1)}" transform="rotate(${a} ${(x * W).toFixed(1)} ${(y * H).toFixed(1)})" class="f"/>`;
    const s = Math.min(W, H) * .5;
    return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" aria-hidden="true"><rect class="bg" width="${W.toFixed(1)}" height="${H.toFixed(1)}" rx="1.5"/>${r(.35, .32, -12, s)}${r(.66, .5, 9, s)}${r(.4, .72, -4, s)}</svg>`;
  }
  const cells = cellsFor(layout, W, H, 2, 1.5);
  const shapes = cells.map(c => c.ellipse
    ? `<ellipse cx="${(c.box.x + c.box.w / 2).toFixed(1)}" cy="${(c.box.y + c.box.h / 2).toFixed(1)}" rx="${(c.box.w / 2).toFixed(1)}" ry="${(c.box.h / 2).toFixed(1)}"/>`
    : `<polygon points="${c.pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}"${c.float ? ' class="f"' : ""}/>`).join("");
  return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" aria-hidden="true"><rect class="bg" width="${W.toFixed(1)}" height="${H.toFixed(1)}" rx="1.5"/>${shapes}</svg>`;
}
