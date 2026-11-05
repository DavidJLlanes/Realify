/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Escena y cielo»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"escena", label:"Escena y cielo", items:[
    { cmd:"sky.replace", ic:"cloud-sun", label:"Reemplazar cielo…",
      help:"Detecta el cielo con IA (DeepLab/ADE20K) y lo sustituye por un color, un degradado o una foto propia, en una capa nueva con su propia máscara." },
    { cmd:"filter.lens",    label:"Adaptive Photo Lens…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/><path d="M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5"/></svg>',
      help:"Reconoce el tipo de foto con un modelo local y aplica el revelado que le va" }
] };
