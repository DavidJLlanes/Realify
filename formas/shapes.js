/* ═══════════════════════════════════════════════════════════════
   FORMAS · CATÁLOGO
   Cada forma es una lista de contornos en coordenadas unitarias
   (centradas en 0, dentro de [-1, 1]); los contornos interiores hacen
   agujeros (regla par-impar: anillo, marco, rosquilla…). `fill: true`
   deja que la forma se estire para llenar la caja (rectángulo, cápsula);
   si no, conserva su proporción.

   Formas con parámetros: «polígono» (lados), «estrella» (puntas y
   profundidad) y esquinas redondeadas para todas las poligonales.
   ═══════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const reg = (n, a0 = -Math.PI / 2, r = 1) => Array.from({ length: n }, (_, i) => [Math.cos(a0 + i * TAU / n) * r, Math.sin(a0 + i * TAU / n) * r]);
const polar = (n, f, a0 = -Math.PI / 2) => Array.from({ length: n }, (_, i) => { const t = i / n * TAU; const r = f(t); return [Math.cos(a0 + t) * r, Math.sin(a0 + t) * r]; });
const circle = (r = 1, cx = 0, cy = 0, n = 96) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * r, cy + Math.sin(i / n * TAU) * r]);
const star = (n, inner) => { const pts = []; for(let i = 0; i < n * 2; i++){ const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? inner : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return pts; };
const rev = p => p.slice().reverse();
function roundRectPts(w, h, r, n = 10){
  const pts = [], cs = [[w - r, -h + r, -Math.PI / 2], [w - r, h - r, 0], [-w + r, h - r, Math.PI / 2], [-w + r, -h + r, Math.PI]];
  for(const [cx, cy, a0] of cs) for(let i = 0; i <= n; i++){ const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}
/* Unión aproximada de círculos, muestreada en polar desde el centro */
function blob(C, n = 240){
  const pts = [];
  for(let i = 0; i < n; i++){
    const a = i / n * TAU, dx = Math.cos(a), dy = Math.sin(a);
    let r = 0;
    for(const [cx, cy, cr] of C){ const b = dx * cx + dy * cy, c = cx * cx + cy * cy - cr * cr, d = b * b - c; if(d >= 0){ const t = b + Math.sqrt(d); if(t > r) r = t; } }
    pts.push([dx * r, dy * r]);
  }
  return pts;
}

const heart = () => Array.from({ length: 160 }, (_, i) => { const t = i / 160 * TAU; return [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; });

/** [id, nombre, grupo, generador(p) → { paths, fill?, poly? }] */
export const SHAPES = [
  // Básicas
  ["circle", "Círculo", "Básicas", () => ({ paths: [circle()] })],
  ["ellipse", "Elipse", "Básicas", () => ({ paths: [circle()], fill: true })],
  ["square", "Cuadrado", "Básicas", () => ({ paths: [[[-1, -1], [1, -1], [1, 1], [-1, 1]]], poly: true })],
  ["rect", "Rectángulo", "Básicas", () => ({ paths: [[[-1, -1], [1, -1], [1, 1], [-1, 1]]], fill: true, poly: true })],
  ["rounded", "Redondeado", "Básicas", () => ({ paths: [roundRectPts(1, 1, .35)], fill: true })],
  ["pill", "Cápsula", "Básicas", () => ({ paths: [roundRectPts(1, .5, .5, 20)] })],
  ["diamond", "Rombo", "Básicas", () => ({ paths: [[[0, -1], [1, 0], [0, 1], [-1, 0]]], fill: true, poly: true })],
  ["arch", "Arco", "Básicas", () => { const p = [[-1, 1], [-1, 0]]; for(let i = 0; i <= 48; i++){ const a = Math.PI + i / 48 * Math.PI; p.push([Math.cos(a), Math.sin(a)]); } p.push([1, 1]); return { paths: [p], fill: true }; }],
  ["semicircle", "Semicírculo", "Básicas", () => { const p = []; for(let i = 0; i <= 64; i++){ const a = Math.PI + i / 64 * Math.PI; p.push([Math.cos(a), Math.sin(a) + .5]); } return { paths: [p] }; }],
  ["egg", "Huevo", "Básicas", () => ({ paths: [Array.from({ length: 120 }, (_, i) => { const t = i / 120 * TAU, y = Math.sin(t); return [Math.cos(t) * (0.78 + 0.14 * y), y]; })] })],
  // Polígonos
  ["polygon", "Polígono (lados)", "Polígonos", p => ({ paths: [reg(p.sides, -Math.PI / 2 + (p.sides % 2 ? 0 : Math.PI / p.sides))], poly: true })],
  ["triangle", "Triángulo", "Polígonos", () => ({ paths: [reg(3)], poly: true })],
  ["rtriangle", "Triángulo rectángulo", "Polígonos", () => ({ paths: [[[-1, -1], [1, 1], [-1, 1]]], fill: true, poly: true })],
  ["poly5", "Pentágono", "Polígonos", () => ({ paths: [reg(5)], poly: true })],
  ["poly6", "Hexágono", "Polígonos", () => ({ paths: [reg(6, 0)], poly: true })],
  ["poly7", "Heptágono", "Polígonos", () => ({ paths: [reg(7)], poly: true })],
  ["poly8", "Octógono", "Polígonos", () => ({ paths: [reg(8, -Math.PI / 2 + Math.PI / 8)], poly: true })],
  ["poly10", "Decágono", "Polígonos", () => ({ paths: [reg(10, -Math.PI / 2 + Math.PI / 10)], poly: true })],
  ["poly12", "Dodecágono", "Polígonos", () => ({ paths: [reg(12, -Math.PI / 2 + Math.PI / 12)], poly: true })],
  ["parallelogram", "Paralelogramo", "Polígonos", () => ({ paths: [[[-.5, -1], [1, -1], [.5, 1], [-1, 1]]], fill: true, poly: true })],
  ["trapezoid", "Trapecio", "Polígonos", () => ({ paths: [[[-.55, -1], [.55, -1], [1, 1], [-1, 1]]], fill: true, poly: true })],
  // Estrellas y destellos
  ["star", "Estrella (puntas)", "Estrellas", p => ({ paths: [star(p.points, p.inner / 100)], poly: true })],
  ["star4", "Estrella de 4", "Estrellas", () => ({ paths: [star(4, .4)], poly: true })],
  ["star5", "Estrella de 5", "Estrellas", () => ({ paths: [star(5, .4)], poly: true })],
  ["star6", "Estrella de 6", "Estrellas", () => ({ paths: [star(6, .52)], poly: true })],
  ["star8", "Estrella de 8", "Estrellas", () => ({ paths: [star(8, .58)], poly: true })],
  ["star12", "Estrella de 12", "Estrellas", () => ({ paths: [star(12, .7)], poly: true })],
  ["burst", "Destello", "Estrellas", () => ({ paths: [star(16, .78)], poly: true })],
  ["burst24", "Explosión", "Estrellas", () => ({ paths: [star(24, .82)], poly: true })],
  ["sparkle", "Brillo", "Estrellas", () => ({ paths: [Array.from({ length: 160 }, (_, i) => { const t = i / 160 * TAU, c = Math.cos(t), s = Math.sin(t); const r = 1 / Math.pow(Math.pow(Math.abs(c), .5) + Math.pow(Math.abs(s), .5), 2); return [c * r, s * r]; })] })],
  ["sun", "Sol", "Estrellas", () => ({ paths: [polar(360, t => .8 + .2 * Math.max(0, Math.cos(12 * t)) ** 3)] })],
  // Corazones y naturaleza
  ["heart", "Corazón", "Especiales", () => ({ paths: [heart()] })],
  ["flower4", "Flor de 4", "Especiales", () => ({ paths: [polar(240, t => .6 + .4 * Math.abs(Math.cos(2 * t)))] })],
  ["flower", "Flor de 6", "Especiales", () => ({ paths: [polar(240, t => .72 + .28 * Math.cos(6 * t))] })],
  ["flower8", "Margarita", "Especiales", () => ({ paths: [polar(360, t => .55 + .45 * Math.abs(Math.cos(4 * t)) ** .6)] })],
  ["clover", "Trébol", "Especiales", () => ({ paths: [blob([[0, -.48, .42], [.46, .02, .42], [-.46, .02, .42], [0, .1, .3], [0, .6, .12], [.05, .85, .1]])] })],
  ["leaf", "Hoja", "Especiales", () => {
    // Dos arcos de circunferencia que se cortan arriba y abajo (vesica)
    const R = 1.3, d = Math.sqrt(R * R - 1), a0 = Math.atan2(1, d), p = [];
    for(let i = 0; i <= 40; i++){ const t = -a0 + i / 40 * 2 * a0; p.push([-d + R * Math.cos(t), R * Math.sin(t)]); }
    for(let i = 0; i <= 40; i++){ const t = Math.PI - a0 + i / 40 * 2 * a0; p.push([d + R * Math.cos(t), R * Math.sin(t)]); }
    return { paths: [p] };
  }],
  ["drop", "Gota", "Especiales", () => ({ paths: [Array.from({ length: 120 }, (_, i) => { const t = i / 120 * TAU, s = Math.sin(t / 2); return [Math.sin(t) * s * s * s * 1.3, -Math.cos(t)]; })] })],
  ["cloud", "Nube", "Especiales", () => ({ paths: [blob([[-.55, .15, .45], [-.15, -.2, .55], [.35, -.1, .5], [.62, .22, .35], [0, .25, .45], [-.8, .35, .25], [.8, .4, .2]])] })],
  ["moon", "Luna", "Especiales", () => { const p = []; for(let i = 0; i <= 80; i++){ const a = Math.PI * .5 + i / 80 * Math.PI; p.push([Math.cos(a), Math.sin(a)]); } for(let i = 80; i >= 0; i--){ const y = Math.sin(Math.PI * .5 + i / 80 * Math.PI); p.push([Math.max(-1, .38 - Math.sqrt(Math.max(0, .82 * .82 - y * y))), y]); } return { paths: [p] }; }],
  ["paw", "Huella", "Especiales", () => ({ paths: [circle(.42, 0, .35, 64), circle(.2, -.55, -.25, 40), circle(.2, -.2, -.62, 40), circle(.2, .2, -.62, 40), circle(.2, .55, -.25, 40)], union: true })],
  // Símbolos
  ["bubble", "Bocadillo", "Símbolos", () => { const p = []; for(let i = 0; i < 100; i++){ const a = Math.PI * .62 + i / 100 * TAU * .94; p.push([Math.cos(a), Math.sin(a) * .78 - .1]); } p.push([-.55, 1]); return { paths: [p], fill: true }; }],
  ["bubbleSq", "Bocadillo cuadrado", "Símbolos", () => {
    const p = roundRectPts(1, .72, .25).map(([x, y]) => [x, y - .2]);
    p.splice(22, 0, [-.2, .52], [-.55, 1], [-.5, .52]);   // cola, en el lado de abajo
    return { paths: [p], fill: true };
  }],
  ["cross", "Cruz", "Símbolos", () => { const a = .34; return { paths: [[[-a, -1], [a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a]]], poly: true }; }],
  ["xmark", "Aspa", "Símbolos", () => { const a = .3, c = Math.SQRT1_2; const base = [[-a, -1], [a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a]]; return { paths: [base.map(([x, y]) => [(x - y) * c, (x + y) * c])], poly: true }; }],
  ["arrow", "Flecha", "Símbolos", () => ({ paths: [[[-1, -.3], [.2, -.3], [.2, -.75], [1, 0], [.2, .75], [.2, .3], [-1, .3]]], fill: true, poly: true })],
  ["chevron", "Chevrón", "Símbolos", () => ({ paths: [[[-1, -1], [.2, -1], [1, 0], [.2, 1], [-1, 1], [-.2, 0]]], fill: true, poly: true })],
  ["bolt", "Rayo", "Símbolos", () => ({ paths: [[[.15, -1], [-.65, .15], [-.05, .15], [-.3, 1], [.65, -.25], [.05, -.25], [.4, -1]]], poly: true })],
  ["pin", "Ubicación", "Símbolos", () => { const p = []; for(let i = 0; i <= 70; i++){ const a = Math.PI * .8 + i / 70 * Math.PI * 1.4; p.push([Math.cos(a) * .72, Math.sin(a) * .72 - .28]); } p.push([0, 1]); return { paths: [p, rev(circle(.28, 0, -.28, 48))] }; }],
  ["house", "Casa", "Símbolos", () => ({ paths: [[[0, -1], [1, -.1], [.75, -.1], [.75, 1], [-.75, 1], [-.75, -.1], [-1, -.1]]], poly: true })],
  ["crown", "Corona", "Símbolos", () => ({ paths: [[[-1, -.55], [-.5, .05], [0, -.8], [.5, .05], [1, -.55], [.8, .7], [-.8, .7]]], fill: true, poly: true })],
  ["gem", "Gema", "Símbolos", () => ({ paths: [[[-.55, -.75], [.55, -.75], [1, -.2], [0, 1], [-1, -.2]]], poly: true })],
  ["shield", "Escudo", "Símbolos", () => { const p = [[-1, -1], [1, -1], [1, -.15]]; for(let i = 1; i <= 30; i++){ const t = i / 30; p.push([1 - t, -.15 + 1.15 * Math.sin(t * Math.PI / 2)]); } for(let i = 1; i < 30; i++){ const t = i / 30; p.push([-t, 1 - 1.15 * (1 - Math.cos(t * Math.PI / 2))]); } p.push([-1, -.15]); return { paths: [p], fill: true }; }],
  ["tag", "Etiqueta", "Símbolos", () => ({ paths: [[[-1, -.6], [.45, -.6], [1, 0], [.45, .6], [-1, .6]], rev(circle(.13, .38, 0, 32))], fill: true })],
  ["ticket", "Entrada", "Símbolos", () => { const p = []; const r = .22; p.push([-1, -.65], [1, -.65]); for(let i = 0; i <= 20; i++){ const a = -Math.PI / 2 - i / 20 * Math.PI; p.push([1 + Math.cos(a) * r, Math.sin(a) * r]); } p.push([1, .65], [-1, .65]); for(let i = 0; i <= 20; i++){ const a = Math.PI / 2 - i / 20 * Math.PI; p.push([-1 + Math.cos(a) * r, Math.sin(a) * r]); } return { paths: [p], fill: true }; }],
  ["badge", "Sello", "Símbolos", () => ({ paths: [polar(240, t => .9 + .1 * Math.cos(18 * t))] })],
  ["gear", "Engranaje", "Símbolos", () => ({ paths: [polar(480, t => { const s = Math.cos(10 * t); return .78 + .22 * Math.max(-1, Math.min(1, s * 3)) * .5 + .11; }), rev(circle(.32, 0, 0, 64))] })],
  ["ring", "Anillo", "Símbolos", () => ({ paths: [circle(1), rev(circle(.6))] })],
  ["frame", "Marco", "Símbolos", () => ({ paths: [[[-1, -1], [1, -1], [1, 1], [-1, 1]], rev([[-.72, -.72], [.72, -.72], [.72, .72], [-.72, .72]])], fill: true })],
  ["puzzle", "Pieza de puzle", "Símbolos", () => {
    const p = [], k = .22;
    p.push([-.8, -.8], [-k, -.8]);
    for(let i = 1; i < 24; i++){ const a = Math.PI + i / 24 * Math.PI; p.push([Math.cos(a) * k, -.8 + Math.sin(a) * k * 1.2]); }
    p.push([k, -.8], [.8, -.8], [.8, -k]);
    for(let i = 1; i < 24; i++){ const a = -Math.PI / 2 + i / 24 * Math.PI; p.push([.8 + Math.cos(a) * k * 1.2, Math.sin(a) * k]); }
    p.push([.8, k], [.8, .8], [-.8, .8]);
    return { paths: [p] };
  }]
];

export const GROUPS = [...new Set(SHAPES.map(s => s[2]))];
export const shapeById = id => SHAPES.find(s => s[0] === id) || SHAPES[0];

/* Esquinas redondeadas de un contorno poligonal (radio relativo 0-1). */
function roundCorners(pts, rr){
  if(rr <= 0) return pts;
  const out = [], n = pts.length;
  for(let i = 0; i < n; i++){
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const r = Math.min(d1, d2) / 2 * rr;
    const a = [p1[0] + (p0[0] - p1[0]) / d1 * r, p1[1] + (p0[1] - p1[1]) / d1 * r];
    const b = [p1[0] + (p2[0] - p1[0]) / d2 * r, p1[1] + (p2[1] - p1[1]) / d2 * r];
    for(let k = 0; k <= 8; k++){ const t = k / 8, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * p1[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p1[1] + t * t * b[1]]); }
  }
  return out;
}

/** Contornos de la forma ya colocados: caja centrada en (cx, cy) de
    w × h, girada `rot` grados. Devuelve [[x, y]…] por contorno. */
export function placeShape(id, p, cx, cy, w, h, rot){
  const s = shapeById(id)[3](p);
  let paths = s.paths;
  if(s.poly && p.round > 0) paths = paths.map(c => roundCorners(c, p.round / 100));
  const xs = paths.flat().map(q => q[0]), ys = paths.flat().map(q => q[1]);
  const ux = Math.min(...xs), uy = Math.min(...ys), uw = Math.max(...xs) - ux || 1, uh = Math.max(...ys) - uy || 1;
  const kx = s.fill || p.stretch ? w / uw : Math.min(w / uw, h / uh), ky = s.fill || p.stretch ? h / uh : kx;
  const mx = ux + uw / 2, my = uy + uh / 2, c = Math.cos(rot * Math.PI / 180), sn = Math.sin(rot * Math.PI / 180);
  return {
    union: !!s.union,
    paths: paths.map(con => con.map(([x, y]) => { const X = (x - mx) * kx, Y = (y - my) * ky; return [cx + X * c - Y * sn, cy + X * sn + Y * c]; })),
    w: uw * kx, h: uh * ky
  };
}

/** Traza los contornos en el contexto (regla par-impar salvo `union`). */
export function traceShape(ctx, placed){
  ctx.beginPath();
  for(const con of placed.paths){ con.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
}
export const fillRule = placed => placed.union ? "nonzero" : "evenodd";

/** Miniatura SVG de una forma. */
export function shapeIcon(id, p = { sides: 6, points: 5, inner: 45, round: 0 }){
  const pl = placeShape(id, { ...p, stretch: false }, 24, 24, 40, 40, 0);
  const d = pl.paths.map(c => "M" + c.map(q => q.map(v => v.toFixed(1)).join(",")).join("L") + "Z").join("");
  return `<svg viewBox="0 0 48 48"><path d="${d}" fill-rule="${pl.union ? "nonzero" : "evenodd"}"/></svg>`;
}
