/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · VISTA DE LA LÍNEA DE TIEMPO (pura, sin DOM)
   Zoom y desplazamiento: relación entre segundos y píxeles. Entradas: vista { pps (píxeles por segundo), desde (segundo del borde izquierdo) }. Salidas: vistas nuevas / números.
   El zoom se hace alrededor de un punto (el dedo o el cursor) para que ese punto no se mueva.
   ═══════════════════════════════════════════════════════════════ */
export const PPS_MIN = 2, PPS_MAX = 2000;
export const vistaInicial = (duracion = 10, ancho = 600) => ({ pps: Math.min(PPS_MAX, Math.max(PPS_MIN, ancho / Math.max(1, duracion * 1.1))), desde: 0 });
export const tAPx = (v, t) => (t - v.desde) * v.pps;
export const pxAT = (v, px) => v.desde + px / v.pps;
export function zoomEn(v, factor, px){
  const pps = Math.min(PPS_MAX, Math.max(PPS_MIN, v.pps * factor)), t = pxAT(v, px);
  return { pps, desde: Math.max(0, t - px / pps) };
}
export const desplazar = (v, dpx) => ({ ...v, desde: Math.max(0, v.desde + dpx / v.pps) });
/** Ajusta una posición al borde de clip o al fotograma más cercano si está a menos de `umbralPx`. */
export function imantar(v, t, bordes, fps, umbralPx = 8){
  let mejor = null, d = umbralPx + 1;
  for(const b of bordes){ const x = Math.abs(tAPx(v, b) - tAPx(v, t)); if(x <= umbralPx && x < d){ mejor = b; d = x; } }
  return mejor !== null ? mejor : Math.round(t * fps) / fps;
}
