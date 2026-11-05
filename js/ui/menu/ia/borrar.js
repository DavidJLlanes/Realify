/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Borrar y rellenar»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"borrar", label:"Borrar y rellenar", items:[
    { cmd:"ai.magicErase", ic:"eraser", label:"Borrador mágico Premium 👑…", premium:true,
      help:"Toca lo que quieras quitar (personas, cables, objetos): la IA lo selecciona y LaMa rellena el hueco. El resultado va a una capa nueva." },
    { cmd:"image.removeBackground", ic:"image-minus", label:"Eliminar fondo…" },
    { cmd:"ai.expand", ic:"expand", label:"Expandir con IA…",
      help:"Agranda el lienzo (a un formato o con márgenes) y la IA (LaMa) rellena los bordes nuevos. El resultado se abre en una pestaña nueva." }
] };
