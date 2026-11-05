/* ═══════════════════════════════════════════════════════════════
   FORMA DE LA CARA · PARÁMETROS
   Mandos del grupo «Forma» del editor de cara (esquema de js/ui/kit/params-panel.js). Rangos pequeños a propósito (cambios naturales); el
   perfil infantil usa un rango reducido (`ranges`). `fx`: el mando activa el efecto; su valor neutro es 0. Entradas: ninguna. Salida: PARAMS.
   ═══════════════════════════════════════════════════════════════ */
const KID = { nino: [-5, 5], nina: [-5, 5] };

export const PARAMS = [
  { key: "forma_cara",     label: "Cara más fina ↔ más ancha", type: "range", min: -20, max: 20, step: 1, def: 0, group: "forma", fx: true, ranges: KID },
  { key: "forma_mandibula", label: "Mandíbula",                type: "range", min: -20, max: 20, step: 1, def: 0, group: "forma", fx: true, ranges: KID },
  { key: "forma_menton",   label: "Mentón (corto ↔ largo)",    type: "range", min: -20, max: 20, step: 1, def: 0, group: "forma", fx: true, ranges: KID },
  { key: "forma_nariz",    label: "Nariz (fina ↔ ancha)",      type: "range", min: -20, max: 20, step: 1, def: 0, group: "forma", fx: true, ranges: KID },
  { key: "forma_ojos",     label: "Tamaño de los ojos",        type: "range", min: -20, max: 20, step: 1, def: 0, group: "forma", fx: true, ranges: KID },
  { key: "forma_labios",   label: "Grosor de los labios",      type: "range", min: -20, max: 20, step: 1, def: 0, group: "forma", fx: true, ranges: KID }
];
