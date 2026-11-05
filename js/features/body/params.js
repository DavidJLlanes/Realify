/* ═══════════════════════════════════════════════════════════════
   CUERPO · MANDOS Y GRUPOS
   Los mandos salen de js/ai/people/profiles.js (BODY_PARAMS: cada uno con su perfil y su rango); aquí sólo se añaden los grupos del
   editor, los ajustes rápidos por perfil y los perfiles que se ofrecen. Entradas: ninguna. Salidas: GRUPOS, PARAMS, PERFILES, aplicarAjuste.
   ═══════════════════════════════════════════════════════════════ */
import { BODY_PARAMS, PROFILES, PROFILE_IDS, presetsFor } from "../../ai/people/profiles.js";

export const GRUPOS = [
  { id: "silueta", label: "Silueta" }, { id: "cabeza", label: "Cabeza y cuello" }, { id: "torso", label: "Torso" }, { id: "caderas", label: "Caderas" },
  { id: "brazos", label: "Brazos" }, { id: "piernas", label: "Piernas" }, { id: "postura", label: "Postura" }, { id: "definicion", label: "Definición" },
  { id: "piel", label: "Piel del cuerpo" }
];

const opciones = perfil => [["", "—"], ...presetsFor(perfil).map(p => [p.id, p.label])];
const ADULTO = ["hombre", "mujer"], INFANTIL = ["nino", "nina"];

export const PARAMS = [
  ...BODY_PARAMS,
  { key: "ajusteAdulto", label: "Ajuste rápido", type: "select", def: "", group: "silueta", only: ADULTO, options: () => opciones("mujer") },
  { key: "ajusteInfantil", label: "Ajuste rápido", type: "select", def: "", group: "silueta", only: INFANTIL, options: () => opciones("nino") }
];

export const PERFILES = PROFILE_IDS.map(id => ({ id, label: PROFILES[id].label }));

/* Un ajuste rápido sube los mandos del preset (recortados al rango del perfil). Devuelve los valores a poner o null. */
export function aplicarAjuste(perfil, id){
  const p = presetsFor(perfil).find(x => x.id === id);
  return p ? p.values : null;
}
