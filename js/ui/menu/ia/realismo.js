/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Realismo y autenticidad»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"realismo", label:"Realismo y autenticidad", items:[
    { cmd:"filter.camera",  label:"Realify…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><circle cx="12" cy="13" r="3.5"/><path d="M17 10.5h.01"/></svg>',
      help:"Simula óptica, sensor y compresión de una cámara. Abre un panel con controles avanzados; con interruptor Premium 👑 en la propia ventana." },
    { cmd:"filter.cameraPremium", label:"Realify Premium 👑…", premium:true,
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><circle cx="12" cy="13" r="3.5"/><path d="M17 10.5h.01"/></svg>',
      help:"Realify con el motor Premium: cadena en coma flotante de 32 bits, luces que no viran, color en OKLab con mapeo de gama y tramado." },
    { cmd:"filter.purepixel", label:"PurePixel…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16M4 9h16M4 15h16" opacity=".55"/><path d="M9 9h6v6H9z" fill="currentColor" stroke="none" opacity=".85"/></svg>',
      help:"Aplica cambios sutiles a los píxeles de la capa activa. Función experimental." },
    { cmd:"filter.unmark",  label:"Unmark…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 15.5h4.5M16.5 13v5" opacity=".9"/><path d="M4 20 20 4"/></svg>',
      help:"Elimina la marca visible del generador, perturba las marcas invisibles de los píxeles y limpia la procedencia del archivo (C2PA, XMP, EXIF). Panel por secciones con vista previa." },
    { cmd:"an.metrics", ic:"gauge",   label:"Plausibilidad…" },
    { cmd:"an.forensics", ic:"microscope", label:"Segunda opinión…" },
    { cmd:"an.strip", ic:"shield-check",     label:"Limpiar metadatos de un archivo…" }
] };
