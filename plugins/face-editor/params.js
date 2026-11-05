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
import { PARAMS as luz } from "../../js/features/portrait/face-relight/params.js";
import { PARAMS as ojos } from "../../js/features/portrait/eyes/params.js";
import { PARAMS as labios } from "../../js/features/portrait/lips-brows/params.js";
import { PARAMS as dientes } from "../../js/features/portrait/teeth/params.js";
import { PARAMS as pelo } from "../../js/features/portrait/hair/params.js";
import { PARAMS as sueltos } from "../../js/features/portrait/flyaway-hair/params.js";
import { PARAMS as gafas } from "../../js/features/portrait/glasses-glare/params.js";

export const GRUPOS = [{ id: "arrugas", label: "Arrugas" }, { id: "ojeras", label: "Ojeras" }, { id: "brillos", label: "Brillos" },
  { id: "textura", label: "Textura" }, { id: "tono", label: "Imperfecciones" }, { id: "luz", label: "Luz" }, { id: "ojos", label: "Ojos" },
  { id: "labios", label: "Labios y cejas" }, { id: "dientes", label: "Dientes" }, { id: "pelo", label: "Pelo" }, { id: "sueltos", label: "Pelos sueltos" },
  { id: "gafas", label: "Gafas" }];
export const PARAMS = [...arrugas, ...ojeras, ...brillos, ...textura, ...tono, ...luz, ...ojos, ...labios, ...dientes, ...pelo, ...sueltos, ...gafas];

/** Valores de arranque: los mandos que activan un efecto (`fx`) de los demás grupos empiezan en su valor neutro, para que sólo actúe la
    función que se abrió. */
export function inicio(grupo){
  const v = {};
  for(const p of PARAMS) if(p.fx && p.group !== grupo) v[p.key] = p.neutro ?? 0;
  return v;
}
/** ¿Hay algún efecto activo (algún mando `fx` fuera de su valor neutro)? */
export const hayEfecto = v => PARAMS.some(p => p.fx && v[p.key] !== undefined && v[p.key] !== (p.neutro ?? 0));
/** ¿Pide la luz? (necesita el mapa de profundidad) */
export const pideProfundidad = v => (v.luz_int || 0) > 0;
