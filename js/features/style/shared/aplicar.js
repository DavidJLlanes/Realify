/* ═══════════════════════════════════════════════════════════════
   ESTILO · APLICAR UNAS ESTADÍSTICAS A UNA FOTO
   Copia de trabajo en luz lineal → zonas (IA) → transferencia → lienzo del tamaño de la foto. Lo usan «Mis estilos» (una foto o todas las abiertas). Entradas: lienzo, estadísticas, { fuerza, tono, color }. Salida: lienzo con el resultado.
   ═══════════════════════════════════════════════════════════════ */
import { trabajar, aLienzo } from "../../scene/shared/trabajo.js";
import { WORK } from "../../ai-kit/preview.js";
import { transferir } from "../engine/transferir.js";
import { zonasDe } from "./referencia.js";

export async function colorearCon(src, stats, v = {}){
  const prep = trabajar(src, WORK()), pesos = await zonasDe(src, prep);
  transferir(prep.planes, stats, pesos, { fuerza: v.fuerza ?? 80, tono: v.tono ?? 100, color: v.color ?? 100 });
  return aLienzo(prep, src);
}
