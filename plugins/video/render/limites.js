/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · LÍMITES (puro, sin DOM)
   Fijados con la medida de un iPhone (docs/video-medidas/iphone-safari.json); sólo hay un móvil medido: se revisan al medir un Android. Mejor negarse con un mensaje claro que colgar el dispositivo.
   Entradas: proyecto, tipo de dispositivo y salida deseada. Salidas: { ok, motivo } y la salida ajustada al máximo.
   ═══════════════════════════════════════════════════════════════ */
import { duracionProyecto } from "../project/modelo.js";

export const LIMITES = { movil: { duracion: 300 }, escritorio: { duracion: 600 }, ladoMaximo: 1920, previa: 480 };

export function comprobarExportacion(p, movil){
  const d = duracionProyecto(p), max = movil ? LIMITES.movil.duracion : LIMITES.escritorio.duracion;
  if(d <= 0) return { ok: false, motivo: "No hay nada que exportar: añade un vídeo" };
  if(d > max) return { ok: false, motivo: `El proyecto dura ${Math.round(d)} s y el máximo en este dispositivo es ${max} s. Recorta o divide el vídeo.` };
  return { ok: true, motivo: "" };
}
/** Reduce la salida para que su lado largo no pase del máximo, conservando la proporción y con medidas pares (los códecs las piden). */
export function salidaAjustada({ ancho, alto }){
  const k = Math.min(1, LIMITES.ladoMaximo / Math.max(ancho, alto)), par = n => Math.max(2, Math.round(n * k / 2) * 2);
  return { ancho: par(ancho), alto: par(alto) };
}
export function tamanoPrevia({ ancho, alto }){
  const k = LIMITES.previa / Math.max(ancho, alto), par = n => Math.max(2, Math.round(n * k / 2) * 2);
  return { ancho: par(ancho), alto: par(alto) };
}
export const FORMATOS_SALIDA = { vertical: { ancho: 1080, alto: 1920 }, horizontal: { ancho: 1920, alto: 1080 }, cuadrado: { ancho: 1080, alto: 1080 } };
