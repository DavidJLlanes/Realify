/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Mejorar y restaurar»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"mejorar", label:"Mejorar y restaurar", items:[
    { cmd:"ai.upscale", ic:"scaling", label:"Ampliar con IA…",
      help:"Amplía ×2 o ×4 recuperando detalle (Real-ESRGAN, SPAN, UltraSharp). Se procesa en tu equipo; el resultado se abre en una pestaña nueva." },
    { cmd:"filter.aiDenoise", ic:"denoise-ai", label:"Reducción de ruido con IA…",
      help:"SCUNet (modelo de ImageToolbox): quita el ruido real de cámara conservando el detalle. La primera vez descarga el modelo (91 MB)." },
    { cmd:"filter.aiDejpeg", ic:"file-image", label:"Quitar artefactos JPEG con IA…",
      help:"FBCNN (modelo de ImageToolbox): elimina bloques y halos de compresión. La primera vez descarga el modelo (144 MB)." },
    { cmd:"ai.lowLight", ic:"lightbulb", label:"Iluminar con IA Premium 👑…", premium:true,
      help:"Para fotos oscuras o a contraluz: la IA (Zero-DCE++) decide cuánto levantar cada zona y cada color, sin halos, limpiando el ruido que aparece en las sombras. Automático: una foto bien expuesta no cambia. Capa que se reabre." },
    { cmd:"ai.colorize", ic:"colorize", label:"Colorear con IA…",
      help:"Da color a fotos en blanco y negro (SpongeColor, Colorizer, DDColor) manteniendo la nitidez original. Crea una capa nueva." }
] };
