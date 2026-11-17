/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · GEOMETRÍA DEL RECORTE
   Matemática pura del recorte: dónde caen las cuatro esquinas de la foto tras voltear, girar 90°, perspectiva vertical y horizontal
   y enderezar; el marco que las contiene; y el mayor rectángulo del tamaño pedido que cabe dentro sin dejar huecos vacíos.
   Entradas: calcularGeo(recorte, ancho, alto) con recorte = { giro, volteoH, volteoV, angulo (°), persV, persH (−100..100),
   proporcion ("libre" | "orig" | "4:3"…), rect ({x0,y0,x1,y1} en 0..1 del marco, o null = el mayor posible) }.
   Salidas: { origen: {w,h}, frame: {w,h}, quad: [4 puntos en el marco: dónde caen la esquina sup. izq., sup. der., inf. der. e inf. izq. de la foto],
   rect: {x,y,w,h} en píxeles del marco, salida: {w,h} } · dentroDelQuad(rect, quad) · RATIOS.
   Límites: sin DOM; las unidades son píxeles de la foto original (el visor las escala).
   ═══════════════════════════════════════════════════════════════ */
export const RATIOS = { "1:1": 1, "4:3": 4 / 3, "3:2": 3 / 2, "16:9": 16 / 9, "3:4": 3 / 4, "2:3": 2 / 3, "9:16": 9 / 16 };
const PERSPECTIVA_MAX = 0.35, rad = g => g * Math.PI / 180;

function esquinas(r, W, H) {
  let p = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
  if (r.volteoH) p = p.map(([x, y]) => [-x, y]);
  if (r.volteoV) p = p.map(([x, y]) => [x, -y]);
  const g = rad(r.giro || 0), c = Math.round(Math.cos(g)), s = Math.round(Math.sin(g));
  p = p.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  const v = (r.persV || 0) / 100 * PERSPECTIVA_MAX, h = (r.persH || 0) / 100 * PERSPECTIVA_MAX;
  if (v) p = p.map(([x, y]) => [x * (1 - v * Math.sign(y)), y]);       // v > 0: la parte de arriba se ensancha
  if (h) p = p.map(([x, y]) => [x, y * (1 - h * Math.sign(x))]);       // h > 0: el lado izquierdo se agranda
  const a = rad(r.angulo || 0), ca = Math.cos(a), sa = Math.sin(a);
  return p.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
}

/* ¿Está el punto dentro del cuadrilátero convexo (con una tolerancia de 0,02 px)? */
function dentro(pt, q) {
  let area = 0;
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area >= 0 ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if (sg * ((b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0])) / l < -0.02) return false;
  }
  return true;
}
export const dentroDelQuad = (r, q) => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].every(p => dentro(p, q));

/* Mayor rectángulo de proporción `asp` (ancho/alto) dentro de q: se prueban centros alrededor del centro del cuadrilátero y, en cada
   uno, se busca por bisección el mayor alto que cabe. */
function mayorRect(q, frame, asp) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  let mejor = null;
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const x = cx + i * frame.w * 0.04, y = cy + j * frame.h * 0.04;
    let lo = 0, hi = Math.min(frame.h, frame.w / asp);
    for (let k = 0; k < 22; k++) {
      const m = (lo + hi) / 2, r = { x: x - m * asp / 2, y: y - m / 2, w: m * asp, h: m };
      if (dentroDelQuad(r, q)) lo = m; else hi = m;
    }
    if (!mejor || lo > mejor.h) mejor = { x: x - lo * asp / 2, y: y - lo / 2, w: lo * asp, h: lo };
  }
  return mejor;
}

export function calcularGeo(r, W, H) {
  const p = esquinas(r, W, H), xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const mx = Math.min(...xs), my = Math.min(...ys);
  const quad = p.map(([x, y]) => [x - mx, y - my]), frame = { w: Math.max(...xs) - mx, h: Math.max(...ys) - my };
  const llena = quad.every(([x, y]) => (Math.abs(x) < 0.01 || Math.abs(x - frame.w) < 0.01) && (Math.abs(y) < 0.01 || Math.abs(y - frame.h) < 0.01));
  const imp = (r.giro || 0) % 180 ? H / W : W / H, prop = r.proporcion || "orig";
  let rect;
  if (r.rect) rect = { x: r.rect.x0 * frame.w, y: r.rect.y0 * frame.h, w: (r.rect.x1 - r.rect.x0) * frame.w, h: (r.rect.y1 - r.rect.y0) * frame.h };
  else if (llena && (prop === "orig" || prop === "libre")) rect = { x: 0, y: 0, w: frame.w, h: frame.h };
  else if (prop === "libre") {
    for (const a of [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.33, 1.5, 1.78, 2, 2.4]) { const c = mayorRect(quad, frame, a); if (!rect || c.w * c.h > rect.w * rect.h) rect = c; }
  } else rect = mayorRect(quad, frame, prop === "orig" ? imp : RATIOS[prop] || imp);
  return { origen: { w: W, h: H }, frame, quad, rect, salida: { w: Math.max(1, Math.round(rect.w)), h: Math.max(1, Math.round(rect.h)) } };
}
