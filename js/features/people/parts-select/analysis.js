/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR PARTES · ANÁLISIS
   Pide a js/ai/people/analyze.js sólo lo necesario (pose y partes) con la calidad más alta (Premium: el bueno y el mejor) dentro
   de una sesión de IA con progreso y botón de cancelar. La caché del análisis evita repetirlo si la foto no ha cambiado.
   Entradas: lienzo con la imagen visible. Salida: { personas } o lanza el error (también la cancelación, con `cancelled`).
   ═══════════════════════════════════════════════════════════════ */
import { aiSession } from "../../ai-kit/session.js";
import { analyze } from "../../../ai/people/analyze.js";

export function analizarPersonas(src){
  return aiSession("Buscando las partes de las personas con IA", () => analyze(src, { quality: "mejor", kinds: ["poses", "partes"] }), { unit: "persona" });
}
