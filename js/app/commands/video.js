/* ═══════════════════════════════════════════════════════════
   APP · comandos del editor de vídeo
   Parte de js/main.js (el arranque), que importa este módulo. El editor vive en plugins/video y sólo se carga con import() al usarlo; no necesita documento abierto.
   ═══════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";

const abrir = async (importar = false) => (await import("../../../plugins/video/index.js")).openVideo({ importar });

registerAll({
  "video.edit":   { run: () => abrir(false), enabled: () => true },
  "video.import": { run: () => abrir(true),  enabled: () => true }
});
