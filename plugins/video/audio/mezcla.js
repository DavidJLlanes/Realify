/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · MEZCLA DE AUDIO (puro, sin DOM)
   Convierte la línea de tiempo en sonido: por cada clip con audio que cae en la ventana [desde, hasta) lee su tramo del medio (a la velocidad del clip), le aplica el volumen
   del clip y de la pista, un fundido de 5 ms en los bordes (sin chasquidos) y lo suma. Entradas: proyecto, ventana, tasa de salida y un proveedor de PCM
   `pcm(segmento) → { canales:[Float32Array…], tasa, t0 } | null` (segmento = { clip, pista, a, b }) (lo decodificado de ese tramo; t0 = segundo del medio de la primera muestra). Salida: { canales:[L,R], tasa }.
   Límites: la velocidad cambia el tono (remuestreo lineal, sin conservar el tono); mono se reparte a los dos canales; el resultado se recorta a ±1.
   ═══════════════════════════════════════════════════════════════ */
import { finClip, volumenClip } from "../project/modelo.js";

const FUNDIDO = 0.005;

/** Clips con sonido que tocan [desde, hasta): { clip, pista, a, b } con a..b el tramo del MEDIO que hace falta. */
export function segmentos(p, desde, hasta){
  const out = [];
  for(const pista of p.pistas) for(const clip of pista.clips){
    if(!p.medios[clip.medio]?.audio || volumenClip(clip) <= 0 || (pista.volumen ?? 1) <= 0 || pista.silenciada) continue;
    const i = Math.max(desde, clip.inicio), f = Math.min(hasta, finClip(clip)); if(f <= i) continue;
    out.push({ clip, pista, a: clip.dentro + (i - clip.inicio) * clip.velocidad, b: clip.dentro + (f - clip.inicio) * clip.velocidad });
  }
  return out;
}
export const hayAudio = p => segmentos(p, 0, Infinity).length > 0;

export function mezclar(p, { desde, hasta, tasa = 48000, pcm }){
  const n = Math.max(0, Math.round((hasta - desde) * tasa)), L = new Float32Array(n), R = new Float32Array(n);
  for(const seg of segmentos(p, desde, hasta)){
    const { clip, pista } = seg, src = pcm(seg); if(!src) continue;
    const g = volumenClip(clip) * (pista.volumen ?? 1), fin = finClip(clip), l = src.canales[0], r = src.canales[1] || l, len = l.length;
    const n0 = Math.max(0, Math.ceil((clip.inicio - desde) * tasa)), n1 = Math.min(n, Math.floor((fin - desde) * tasa));
    for(let k = n0; k < n1; k++){
      const t = desde + k / tasa, pos = (clip.dentro + (t - clip.inicio) * clip.velocidad - src.t0) * src.tasa, i0 = Math.floor(pos);
      if(i0 < 0 || i0 >= len) continue; const i1 = Math.min(len - 1, i0 + 1), fr = pos - i0;
      const f = Math.min(1, (t - clip.inicio) / FUNDIDO, (fin - t) / FUNDIDO) * g;
      L[k] += (l[i0] + (l[i1] - l[i0]) * fr) * f; R[k] += (r[i0] + (r[i1] - r[i0]) * fr) * f;
    }
  }
  for(let k = 0; k < n; k++){ L[k] = L[k] > 1 ? 1 : L[k] < -1 ? -1 : L[k]; R[k] = R[k] > 1 ? 1 : R[k] < -1 ? -1 : R[k]; }
  return { canales: [L, R], tasa };
}
