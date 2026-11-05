/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CARA · PUERTA
   Editor de cara a pantalla completa con zoom en la cara (4.7 del plan). Lleva los grupos de piel (Fase 3) y de luz, ojos, labios y cejas, dientes,
   pelo, pelos sueltos y gafas (Fase 4); la Fase 6 añade más. Entradas: { group } = grupo que se abre. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openFaceEditor(opts = {}){
  const { abrirEditorCara } = await import("./editor.js");
  return abrirEditorCara(opts);
}
