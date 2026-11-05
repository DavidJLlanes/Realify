/* ═══════════════════════════════════════════════════════════════
   RELIGHT · PROFUNDIDAD DEL RECORTE (puro, sin DOM)
   Pasa el mapa de profundidad de la foto entera (Depth Anything V2 Small, 518 px o más) al recorte de trabajo de una cara con
   interpolación bilineal. Entradas: mapa { d: Float32 0-1, w, h }, tamaño de la foto y recorte { x, y, k, W, H }.
   Salida: Float32Array(W·H) con la profundidad (1 = cerca).
   ═══════════════════════════════════════════════════════════════ */

export function profundidadRecorte(map, srcW, srcH, crop){
  const mw = map.w || map.n, mh = map.h || map.n, { W, H } = crop, out = new Float32Array(W * H);
  for(let y = 0; y < H; y++){
    const v = Math.min(mh - 1.001, Math.max(0, (crop.y + (y + 0.5) / crop.k) / srcH * mh - 0.5)), b = v | 0, ty = v - b;
    for(let x = 0; x < W; x++){
      const u = Math.min(mw - 1.001, Math.max(0, (crop.x + (x + 0.5) / crop.k) / srcW * mw - 0.5)), a = u | 0, tx = u - a;
      out[y * W + x] = (map.d[b * mw + a] * (1 - tx) + map.d[b * mw + a + 1] * tx) * (1 - ty) + (map.d[(b + 1) * mw + a] * (1 - tx) + map.d[(b + 1) * mw + a + 1] * tx) * ty;
    }
  }
  return out;
}
