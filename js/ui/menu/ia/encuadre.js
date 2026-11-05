/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Encuadre y composición»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"encuadre", label:"Encuadre y composición", items:[
    { cmd:"ai.smartCrop", ic:"scan", label:"Recorte inteligente para redes Premium 👑…", premium:true,
      help:"Elige el formato (Instagram, historias, YouTube, Pinterest…) y la IA propone el mejor encuadre: conserva el sujeto y las caras, no corta cabezas y deja el sujeto en los tercios. Arrastra para afinarlo."},
    { cmd:"ai.faceCrop", ic:"frame", label:"Recorte de retrato Premium 👑", premium:true,
      help:"Abre Recortar con el marco encuadrado en la cara (ojos en el tercio superior, cabeza y hombros)." }
] };
