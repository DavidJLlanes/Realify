/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CARA · GRUPOS Y MANDOS
   Junta los parámetros de las funciones de piel (cada una declara los suyos en su carpeta de js/features/portrait/) en los grupos del
   editor. Las fases 4 y 6 añaden más grupos (ojos, boca, pelo, luz…). Entradas: ninguna.
   Salidas: GRUPOS, PARAMS y inicio(grupo) = valores de arranque (sólo la función abierta con intensidad, las demás a 0).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS as arrugas } from "../../js/features/portrait/skin-wrinkles/params.js";
import { PARAMS as ojeras } from "../../js/features/portrait/skin-dark-circles/params.js";
import { PARAMS as brillos } from "../../js/features/portrait/skin-shine/params.js";
import { PARAMS as textura } from "../../js/features/portrait/skin-texture/params.js";
import { PARAMS as tono } from "../../js/features/portrait/skin-even/params.js";

export const GRUPOS = [{ id: "arrugas", label: "Arrugas" }, { id: "ojeras", label: "Ojeras" }, { id: "brillos", label: "Brillos" },
  { id: "textura", label: "Textura" }, { id: "tono", label: "Imperfecciones" }];
export const PARAMS = [...arrugas, ...ojeras, ...brillos, ...textura, ...tono];

/** Valores de arranque: las intensidades (_int) de los demás grupos empiezan en 0 para que sólo actúe la función que se abrió. */
export function inicio(grupo){
  const v = {};
  for(const p of PARAMS) if(p.key.endsWith("_int") && p.group !== grupo) v[p.key] = 0;
  return v;
}
export const hayEfecto = v => PARAMS.some(p => p.key.endsWith("_int") && (v[p.key] || 0) > 0);
