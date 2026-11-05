/* ═══════════════════════════════════════════════════════════════
   ROPA · MOTOR (puro, sin DOM)
   Orden de las etapas sobre los planos en luz lineal: planchar → textura → color (el color va al final para que el cambio de tono no
   altere la luminancia con la que se separaron los pliegues). Entradas: planos, máscara y valores del editor. Salida: nada (modifican los planos).
   ═══════════════════════════════════════════════════════════════ */
import { planchar, hayPlanchado } from "./planchar.js";
import { texturar, hayTextura } from "./textura.js";
import { recolorear, hayRecolor } from "./recolor.js";

export { planchar, texturar, recolorear };
export const hayCambioRopa = v => hayPlanchado(v) || hayTextura(v) || hayRecolor(v);

export function etapas(p, mask, v){
  if(hayPlanchado(v)) planchar(p, mask, v);
  if(hayTextura(v)) texturar(p, mask, v);
  if(hayRecolor(v)) recolorear(p, mask, v);
}
