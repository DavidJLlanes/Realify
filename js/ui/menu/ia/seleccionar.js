/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Seleccionar»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"seleccionar", label:"Seleccionar", items:[
    { cmd:"ai.tapSelect", ic:"mouse-pointer-click", label:"Selección con un toque Premium 👑…", premium:true,
      help:"Toca un objeto y la IA (Segment Anything) lo selecciona entero; toca más para añadir o quitar partes. Borde afinado a la resolución de la foto." },
    { cmd:"sel.subject", ic:"user-round", label:"Seleccionar sujeto",
      help:"Detecta a la persona con IA (BodyPix); si no encuentra a nadie, cae al fondo por color conectado a los bordes." },
    { cmd:"sel.sky", ic:"cloud",     label:"Seleccionar cielo",
      help:"Detecta el cielo con IA (DeepLab/ADE20K)." },
    { cmd:"ai.textSelect", ic:"text-select", label:"Seleccionar por texto Premium 👑…", premium:true,
      help:"Escribe lo que quieres seleccionar —«persona», «cielo», «coche rojo», «césped sin personas»— y sale una selección o la máscara de la capa. Reconoce 150 tipos de cosas (nombres y sinónimos en español) y colores; el borde se ajusta a la foto. Todo en tu equipo." },
    { cmd:"ai.depthSelect", ic:"mountain-snow", label:"Seleccionar por profundidad Premium 👑…", premium:true,
      help:"La IA calcula la distancia de cada punto: elige primer plano, plano medio, fondo o un intervalo (toca la imagen para elegir una distancia) y deja una selección o la máscara de una capa, con el borde ajustado a la foto." }
] };
