/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CARA · PUERTA
   Editor de cara a pantalla completa con zoom en la cara (4.7 del plan). Hoy lleva el grupo «Piel» (arrugas, ojeras, brillos, textura,
   imperfecciones y tono); las fases 4 y 6 añaden ojos, boca, pelo y luz. Entradas: { group } = grupo que se abre. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
export async function openFaceEditor(opts = {}){
  const { abrirEditorCara } = await import("./editor.js");
  return abrirEditorCara(opts);
}
