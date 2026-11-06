/* ═══════════════════════════════════════════════════════════
   APP · comandos del editor de vídeo
   Parte de js/main.js (el arranque), que importa este módulo. El editor vive en plugins/video y sólo se carga con import() al usarlo; no necesita documento abierto.
   ═══════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";

const abrir = async (opciones = {}) => (await import("../../../plugins/video/index.js")).openVideo(opciones);

/* El selector se abre EN EL MISMO toque (en el iPhone, si antes se descarga el código del editor, el navegador lo bloquea); el editor se carga después, con los vídeos ya elegidos. */
function elegirVideos(){
  const i = document.createElement("input");
  i.type = "file"; i.accept = "video/*,.mp4,.mov,.webm,.mkv,.m4v"; i.multiple = true;
  i.style.cssText = "position:fixed;left:-9999px;opacity:0";
  document.body.appendChild(i);
  i.addEventListener("change", () => { const f = [...i.files]; i.remove(); if(f.length) abrir({ archivos: f }); });
  i.addEventListener("cancel", () => i.remove());
  i.click();
}

registerAll({
  "video.edit":   { run: () => abrir(), enabled: () => true },
  "video.import": { run: elegirVideos, enabled: () => true }
});

/* Vídeos soltados en la ventana (js/io/open.js avisa con este evento para no tocar la puerta del editor). */
document.addEventListener("realify:abrir-video", e => { if(e.detail?.length) abrir({ archivos: e.detail }); });
