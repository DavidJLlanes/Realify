/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · SUBMENÚ «Retrato»
   Entradas ya existentes de este submenú (mismo cmd, etiqueta y ayuda de siempre); las funciones nuevas se añaden solas desde
   sus manifiestos (ver index.js). Entradas: ninguna. Salida: SUBMENU = { id, label, items }.
   ═══════════════════════════════════════════════════════════════ */

export const SUBMENU = { id:"retrato", label:"Retrato", items:[
    { cmd:"ai.faceBlur", ic:"scan-face", label:"Difuminar caras Premium 👑…", premium:true,
      help:"Encuentra las caras (YuNet) y las difumina, pixela o tapa para proteger la privacidad; toca una para excluirla. Capa nueva." },
    { cmd:"ai.faceRetouch", ic:"sparkles", label:"Retoque de cara Premium 👑…", premium:true,
      help:"La IA separa piel, ojos, dientes y labios en cada cara: suaviza la piel conservando la textura, da luz a los ojos, blanquea los dientes y ajusta el color de los labios. Capa nueva." },
    { cmd:"ai.faceRestore", ic:"user-round", label:"Restaurar caras Premium 👑…", premium:true,
      help:"Reconstruye caras borrosas, pequeñas, antiguas o muy comprimidas con IA (GFPGAN), conservando el color de piel y el grano de la foto; toca una para excluirla. Capa nueva. La primera vez descarga el modelo (170 MB)." },
    { cmd:"ai.redEye", ic:"scan-eye", label:"Ojos rojos Premium 👑", premium:true,
      help:"Encuentra los ojos y les quita el rojo del flash sin tocar el reflejo. Capa nueva." }
] };
