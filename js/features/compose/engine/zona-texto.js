/* ═══════════════════════════════════════════════════════════════
   COMPOSICIÓN · ZONA LIBRE PARA TEXTO (puro, sin DOM)
   Busca dónde poner un texto o una marca de agua sin tapar lo importante. Coste de cada posición del rectángulo = importancia media (sujeto y
   caras, mapa de smartcrop) × 3 + textura media (energía del gradiente: un texto sobre follaje no se lee) + margen al borde (no pegado) − un
   pequeño premio por esquinas y tercios (donde se espera un texto). Devuelve también el color de texto que se lee mejor (claro sobre oscuro).
   Entradas: imp (Float32 gw×gh), tex (Float32 gw×gh, 0-1), lum (Float32 gw×gh, 0-1), tamaño del rectángulo en celdas (cw, ch) y `ancla`
   opcional ("esquinas" | "libre"). Salida: { x, y, w, h (celdas), coste, claro: boolean (texto claro) } o null.
   ═══════════════════════════════════════════════════════════════ */

export function texturaDe(lum, gw, gh){
  const t = new Float32Array(gw * gh);
  for(let y = 1; y < gh - 1; y++) for(let x = 1; x < gw - 1; x++){ const i = y * gw + x; t[i] = Math.min(1, (Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + gw] - lum[i - gw])) * 4); }
  return t;
}

function integral(a, gw, gh){
  const S = new Float64Array((gw + 1) * (gh + 1));
  for(let y = 0; y < gh; y++){ let r = 0; for(let x = 0; x < gw; x++){ r += a[y * gw + x]; S[(y + 1) * (gw + 1) + x + 1] = S[y * (gw + 1) + x + 1] + r; } }
  return (x0, y0, x1, y1) => S[y1 * (gw + 1) + x1] - S[y0 * (gw + 1) + x1] - S[y1 * (gw + 1) + x0] + S[y0 * (gw + 1) + x0];
}

export function zonaTexto(imp, tex, lum, gw, gh, cw, ch, { margen = 0.03 } = {}){
  cw = Math.max(1, Math.min(gw, Math.round(cw))); ch = Math.max(1, Math.min(gh, Math.round(ch)));
  const sI = integral(imp, gw, gh), sT = integral(tex, gw, gh), sL = integral(lum, gw, gh), area = cw * ch, m = Math.round(margen * Math.max(gw, gh));
  let mejor = null;
  for(let y = 0; y + ch <= gh; y++) for(let x = 0; x + cw <= gw; x++){
    const i = sI(x, y, x + cw, y + ch) / area, t = sT(x, y, x + cw, y + ch) / area;
    const borde = Math.min(x, y, gw - x - cw, gh - y - ch), pegado = borde < m ? (m - borde) / Math.max(1, m) : 0;
    const px = (x + cw / 2) / gw, py = (y + ch / 2) / gh, esq = Math.min(Math.hypot(px - 0.15, py - 0.12), Math.hypot(px - 0.85, py - 0.12), Math.hypot(px - 0.15, py - 0.88), Math.hypot(px - 0.85, py - 0.88), Math.hypot(px - 0.5, py - 0.88));
    const coste = i * 3 + t * 1 + pegado * 0.5 + Math.min(esq, 0.5) * 0.12;
    if(!mejor || coste < mejor.coste) mejor = { x, y, w: cw, h: ch, coste };
  }
  if(!mejor) return null;
  mejor.claro = sL(mejor.x, mejor.y, mejor.x + cw, mejor.y + ch) / area < 0.5;
  return mejor;
}
