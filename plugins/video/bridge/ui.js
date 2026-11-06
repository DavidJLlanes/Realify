/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PUENTE · INTERFAZ
   Lo que el editor toma prestado de la interfaz común: el armazón a pantalla completa (js/ui/kit/fsshell.js, el mismo de collage y editores de IA), los avisos, la descarga de archivos y
   el tipo de dispositivo. Si esos módulos cambian de sitio o de nombre, se arregla aquí. Entradas: ninguna. Salidas: reexportaciones.
   ═══════════════════════════════════════════════════════════════ */
export { createShell, ensureShellStyles, mountControls, pickFiles } from "../../../js/ui/kit/fsshell.js";
export { toast } from "../../../js/core/toast.js";
export { download } from "../../../js/io/export/export.js";
export { isMobile } from "../../../js/core/device.js";
