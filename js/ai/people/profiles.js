/* ═══════════════════════════════════════════════════════════════
   PERSONAS · PERFILES (hombre, mujer, niño, niña) — SOLO DATOS
   Define los mandos del editor de cuerpo y de la forma de la cara, con sus rangos por perfil. El editor sólo los pinta
   (js/ui/kit/params-panel.js) y el motor sólo recibe valores ya recortados con `clampTo`: nada de aquí calcula píxeles.
   SEGURIDAD (plan, F6.9): el perfil infantil NO tiene mandos de pecho, caderas, glúteos ni definición muscular, y usa
   rangos reducidos. Ningún modelo estima la edad ni el sexo: el perfil lo elige la persona; si las proporciones sugieren un
   menor, `suggestProfile` propone el infantil como punto de partida (sólo propone: la persona decide).
   Entradas: ninguna. Salidas: PROFILES, PROFILE_IDS, BODY_PARAMS, controlsFor, clampTo, sanitize, suggestProfile, PRESETS.
   ═══════════════════════════════════════════════════════════════ */

export const PROFILE_IDS = ["hombre", "mujer", "nino", "nina"];
const ADULT = ["hombre", "mujer"];

export const PROFILES = {
  hombre: { id: "hombre", label: "Hombre", infantil: false },
  mujer:  { id: "mujer",  label: "Mujer",  infantil: false },
  nino:   { id: "nino",   label: "Niño",   infantil: true },
  nina:   { id: "nina",   label: "Niña",   infantil: true }
};

/* Rango reducido del perfil infantil, para quien lo tiene (silueta y piernas). */
const KID = { nino: [-3, 3], nina: [-3, 3] };
const KID_SMALL = { nino: [-5, 5], nina: [-5, 5] };

/* Esquema común (mismo formato que params-panel): `only` restringe a perfiles; `ranges` da el rango propio de un perfil.
   Un mando con `only: ADULT` NO EXISTE para el perfil infantil, ni en la interfaz ni en los valores. */
export const BODY_PARAMS = [
  // Silueta
  { key: "delgado",    label: "Delgado ↔ ancho",       type: "range", min: -20, max: 20, def: 0, group: "silueta", ranges: KID },
  { key: "altura",     label: "Altura",                type: "range", min: -10, max: 10, def: 0, group: "silueta", ranges: KID_SMALL },
  { key: "piernasTorso", label: "Piernas / torso",     type: "range", min: -10, max: 10, def: 0, group: "silueta", ranges: KID_SMALL },
  // Cabeza y cuello
  { key: "cabeza",     label: "Tamaño de la cabeza",   type: "range", min: -10, max: 10, def: 0, group: "cabeza", ranges: KID_SMALL },
  { key: "cuelloLargo", label: "Largo del cuello",     type: "range", min: -10, max: 10, def: 0, group: "cabeza", ranges: KID_SMALL },
  { key: "cuelloGrosor", label: "Grosor del cuello",   type: "range", min: -10, max: 10, def: 0, group: "cabeza", ranges: KID_SMALL },
  // Torso
  { key: "hombros",    label: "Hombros",               type: "range", min: -20, max: 20, def: 0, group: "torso", ranges: KID },
  { key: "pecho",      label: "Pecho",                 type: "range", min: -20, max: 20, def: 0, group: "torso", only: ADULT },
  { key: "cintura",    label: "Cintura",               type: "range", min: -20, max: 20, def: 0, group: "torso", only: ADULT },
  { key: "abdomen",    label: "Abdomen",               type: "range", min: -20, max: 20, def: 0, group: "torso", only: ADULT },
  { key: "espalda",    label: "Espalda",               type: "range", min: -20, max: 20, def: 0, group: "torso", only: ADULT },
  // Caderas y glúteos
  { key: "caderas",    label: "Caderas",               type: "range", min: -20, max: 20, def: 0, group: "caderas", only: ADULT },
  { key: "gluteos",    label: "Glúteos",               type: "range", min: -20, max: 20, def: 0, group: "caderas", only: ADULT },
  // Brazos
  { key: "brazoLargo", label: "Largo del brazo",       type: "range", min: -10, max: 10, def: 0, group: "brazos", ranges: KID_SMALL },
  { key: "brazoGrosor", label: "Grosor del brazo",     type: "range", min: -20, max: 20, def: 0, group: "brazos", ranges: KID },
  { key: "munecas",    label: "Muñecas",               type: "range", min: -10, max: 10, def: 0, group: "brazos", ranges: KID_SMALL },
  { key: "manos",      label: "Manos",                 type: "range", min: -10, max: 10, def: 0, group: "brazos", ranges: KID_SMALL },
  // Piernas
  { key: "piernaLargo", label: "Largo de la pierna",   type: "range", min: -10, max: 10, def: 0, group: "piernas", ranges: KID_SMALL },
  { key: "musloGrosor", label: "Grosor del muslo",     type: "range", min: -20, max: 20, def: 0, group: "piernas", ranges: KID },
  { key: "pantorrilla", label: "Pantorrilla",          type: "range", min: -20, max: 20, def: 0, group: "piernas", ranges: KID },
  { key: "rodillas",   label: "Rodillas",              type: "range", min: -10, max: 10, def: 0, group: "piernas", ranges: KID_SMALL },
  { key: "tobillos",   label: "Tobillos",              type: "range", min: -10, max: 10, def: 0, group: "piernas", ranges: KID_SMALL },
  { key: "pies",       label: "Pies",                  type: "range", min: -10, max: 10, def: 0, group: "piernas", ranges: KID_SMALL },
  // Postura
  { key: "erguir",     label: "Erguir la espalda",     type: "range", min: 0, max: 20, def: 0, group: "postura", ranges: { nino: [0, 10], nina: [0, 10] } },
  { key: "cuelloAdelante", label: "Cuello adelantado", type: "range", min: -20, max: 20, def: 0, group: "postura", ranges: KID },
  { key: "hombrosPostura", label: "Hombros caídos",    type: "range", min: -20, max: 20, def: 0, group: "postura", ranges: KID },
  // Definición (no existe en el perfil infantil)
  { key: "musculo",    label: "Musculatura",           type: "range", min: 0, max: 20, def: 0, group: "definicion", only: ADULT },
  { key: "tono",       label: "Tono (luz y relieve)",  type: "range", min: 0, max: 20, def: 0, group: "definicion", only: ADULT },
  // Piel del cuerpo
  { key: "pielSuavizar", label: "Suavizar",            type: "range", min: 0, max: 100, def: 0, group: "piel", only: ADULT },
  { key: "pielUniformar", label: "Uniformar",          type: "range", min: 0, max: 100, def: 0, group: "piel" },
  { key: "bronceado",  label: "Bronceado",             type: "range", min: 0, max: 100, def: 0, group: "piel", only: ADULT }
];

/** Mandos que existen para un perfil, con su rango propio (copias: no toca el original). */
export function controlsFor(profile){
  const out = [];
  for(const p of BODY_PARAMS){
    if(p.only && !p.only.includes(profile)) continue;
    const r = p.ranges && p.ranges[profile];
    out.push(r ? { ...p, min: r[0], max: r[1] } : { ...p });
  }
  return out;
}

/** Recorta un valor al rango del perfil. Devuelve null si el mando NO existe en ese perfil (nunca un valor). */
export function clampTo(profile, key, value){
  const c = controlsFor(profile).find(p => p.key === key);
  if(!c || !Number.isFinite(value)) return null;
  return Math.min(c.max, Math.max(c.min, value));
}

/** Valores listos para el motor: descarta los mandos que el perfil no tiene y recorta el resto. */
export function sanitize(profile, values){
  const out = {};
  for(const c of controlsFor(profile)){
    const v = clampTo(profile, c.key, values && values[c.key]);
    out[c.key] = v === null ? c.def : v;
  }
  return out;
}

/* Presets: sólo los mandos que cambian, en valores del rango adulto o infantil según el perfil. */
export const PRESETS = {
  adulto: [
    { id: "equilibrar", label: "Equilibrar proporciones", values: { piernasTorso: 2, cabeza: -1 } },
    { id: "alto",       label: "Más alto",                values: { altura: 4, piernaLargo: 2 } },
    { id: "esbelto",    label: "Esbelto",                 values: { delgado: -6, cintura: -4 } },
    { id: "atletico",   label: "Atlético",                values: { hombros: 5, musculo: 6, tono: 5, cintura: -3 } }
  ],
  infantil: [
    { id: "alto",    label: "Más alto", values: { altura: 2 } },
    { id: "postura", label: "Postura",  values: { erguir: 6, cuelloAdelante: -3 } }
  ]
};

/** Presets del perfil, ya recortados a su rango. */
export function presetsFor(profile){
  const lista = PROFILES[profile]?.infantil ? PRESETS.infantil : PRESETS.adulto;
  return lista.map(p => ({ ...p, values: Object.fromEntries(Object.entries(sanitize(profile, p.values)).filter(([k]) => k in p.values)) }));
}

/** Proporción cabeza/altura a partir de la cual se propone el perfil infantil como punto de partida (heurística, no estima edad). */
export const CHILD_HEAD_RATIO = 0.19;

/** Perfil de partida: el infantil si las proporciones sugieren un menor; si no, `preferido` (el que eligió la persona) o null. */
export function suggestProfile(proportions, preferido = null){
  const r = proportions && proportions.cabezaAltura;
  if(Number.isFinite(r) && r >= CHILD_HEAD_RATIO){
    // La persona eligió hombre o mujer: se parte del infantil que le corresponde (niño / niña); sin elección, «niño»
    return preferido === "mujer" || preferido === "nina" ? "nina" : "nino";
  }
  return preferido && PROFILES[preferido] ? preferido : null;
}
