/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR PARTES · PARÁMETROS
   Cuatro mandos globales (por eso interfaz simple, 4.7 del plan): qué parte, de qué persona, suavidad del borde y dónde dejar el resultado.
   La lista de personas se rellena al abrir (depende de la foto): `personasRef.n`.
   ═══════════════════════════════════════════════════════════════ */

export const PARTES = [
  ["pelo", "Pelo"], ["cara", "Cara"], ["piel", "Piel (cara, brazos y piernas)"], ["ropa", "Toda la ropa"],
  ["ropaArriba", "Ropa de arriba"], ["pantalon", "Pantalón"], ["falda", "Falda"], ["vestido", "Vestido"], ["cinturon", "Cinturón"],
  ["zapatos", "Zapatos"], ["brazos", "Brazos"], ["piernas", "Piernas"], ["gafas", "Gafas"], ["sombrero", "Sombrero"],
  ["bolso", "Bolso"], ["bufanda", "Bufanda"], ["persona", "Persona entera"]
];

export const personasRef = { n: 1 };

export const PARAMS = [
  { key: "parte", label: "Parte", type: "select", options: PARTES, def: "pelo" },
  { key: "persona", label: "Persona", type: "select",
    options: () => [["todas", "Todas"], ...Array.from({ length: personasRef.n }, (_, i) => [String(i), `Persona ${i + 1}`])], def: "todas" },
  { key: "suavidad", label: "Suavidad del borde", type: "range", min: 0, max: 40, step: 1, unit: " %", def: 10 },
  { key: "salida", label: "Resultado", type: "seg", options: [["sel", "Selección"], ["mask", "Máscara de la capa"]], def: "sel" }
];
