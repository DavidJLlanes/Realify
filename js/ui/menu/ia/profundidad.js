/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Profundidad»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"profundidad", label:"Profundidad", items:[
    { cmd:"ai.depthBlur", ic:"aperture", label:"Desenfoque por profundidad Premium 👑…", premium:true,
      help:"La IA (Depth Anything) calcula la distancia de cada punto: toca donde enfocar y lo demás se desenfoca según su distancia, sin halos y con bokeh en las luces. Capa nueva." },
    { cmd:"ai.depthFog", ic:"cloud-fog", label:"Niebla por distancia Premium 👑…", premium:true,
      help:"Añade bruma que crece con la distancia, del color de lo más lejano de la foto (o blanca, cálida, fría). Capa nueva." },
    { cmd:"ai.depthLight", ic:"sunset", label:"Luz por profundidad Premium 👑…", premium:true,
      help:"Aclara lo cercano y oscurece lo lejano (o al revés) según la distancia, con punto de giro y transición suaves y sin recortar las luces. Capa nueva." },
    { cmd:"ai.depthPlanes", ic:"layers-plus", label:"Separar planos Premium 👑…", premium:true,
      help:"Reparte la foto en 2, 3 o 4 planos por distancia y crea una capa por plano con su máscara, para retocarlos por separado." },
    { cmd:"ai.photo3d", ic:"move-3d", label:"Foto 3D Premium 👑…", premium:true,
      help:"Anima la foto con paralaje (lo cercano se mueve más que lo lejano) y la guarda como GIF." }
] };
