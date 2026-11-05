/* ═══════════════════════════════════════════════════════════════
   RETRATO · ANÁLISIS COMÚN DE LAS CARAS
   Pide a js/ai/people/analyze.js sólo lo que necesita la piel (los 478 puntos de la cara y las partes del cuerpo) con la calidad más
   alta (Premium: el bueno y el mejor), dentro de una sesión de IA con progreso y botón de cancelar. La caché evita repetirlo.
   Entradas: lienzo con la imagen visible. Salida: { personas } con las que tienen cara; lanza el error (la cancelación trae `cancelled`).
   ═══════════════════════════════════════════════════════════════ */
import { aiSession } from "../../ai-kit/session.js";
import { analyze } from "../../../ai/people/analyze.js";

export async function analizarCaras(src){
  const res = await aiSession("Buscando las caras con IA", () => analyze(src, { quality: "mejor", kinds: ["landmarks", "partes"] }), { unit: "cara" });
  return { ...res, personas: res.personas.filter(p => p.cara && p.cara.puntos && p.cara.puntos.length >= 468) };
}
