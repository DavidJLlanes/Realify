/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · MEZCLADOR (decodifica lo necesario y mezcla, sin DOM)
   Para una ventana de tiempo pide a cada lector el sonido de los tramos que hacen falta (con un margen para interpolar) y llama a la mezcla pura (mezcla.js).
   Entradas: { proyecto, lectorDe(idMedio)→Promise<lector con audio(a,b)>, desde, hasta, tasa }. Salida: { canales:[L,R], tasa } (silencio si no hay audio).
   ═══════════════════════════════════════════════════════════════ */
import { segmentos, mezclar } from "./mezcla.js";

export async function mezclarVentana({ proyecto, lectorDe, desde, hasta, tasa = 48000 }){
  const datos = new Map(), MARGEN = 0.05;
  for(const s of segmentos(proyecto, desde, hasta)){
    const l = await lectorDe(s.clip.medio); datos.set(s.clip.id, l?.audio ? await l.audio(Math.max(0, s.a - MARGEN), s.b + MARGEN) : null);
  }
  return mezclar(proyecto, { desde, hasta, tasa, pcm: s => datos.get(s.clip.id) });
}
