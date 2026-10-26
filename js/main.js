/* ═══════════════════════════════════════════════════════════════
   ARRANQUE
   Importa los módulos de js/app/ (que registran los comandos, los atajos de teclado, la barra de herramientas, los
   gestos del lienzo y la barra de estado) y ejecuta la secuencia de inicio. Todo lo demás vive en su módulo y se
   comunica por el bus.
   ═══════════════════════════════════════════════════════════════ */

import { installColorSpace } from "./core/colorspace.js";
import { initLandscapeNotice } from "./ui/landscape.js";
import { installKeyboardFit } from "./ui/kit/keyboard.js";
import { on } from "./core/bus.js";
import { doc } from "./core/doc.js";
import "./core/history.js";
import "./core/snapshots.js";
import "./core/view.js";
import "./editor/render/compositor.js";
import "./editor/tools/tools.js";
import "./editor/tools/transformtool.js";
import "./editor/imageops.js";
import "./editor/selection/selection.js";
import "./editor/layers/masks.js";
import "./editor/layers/maskadjust.js";
import "./editor/layers/adjustlayers.js";
import "./editor/layers/layercontent.js";
import "./editor/layers/blendif.js";
import { initRulers } from "./editor/tools/rulers.js";
import "./editor/selection/selection-overlay.js";
import "./core/viewport-lock.js";
import { initColorSwatch } from "./ui/colorswatch.js";
import "./core/commands.js";
import { initMenu } from "./ui/menu.js";
import { initPanels, renderInfo } from "./ui/panels.js";
import "./editor/align.js";
import "./editor/tools/fillcontent.js";
import { renderOptions } from "./ui/optionsbar.js";
import { initOpen } from "./io/open.js";
import "./io/export/export.js?v=82";
import { initProjects } from "./io/project.js";
import "./ui/kit/dialog.js";
import "./core/toast.js";
import "./editor/text/text.js";
import "./editor/text/textstyles.js";
import "./editor/clipboard.js";
import "./editor/text/textedit.js";
import { initPWA, resumeAfterUpdate } from "./pwa.js";
import { initMobileBar } from "./ui/mobilebar.js";
import { initToolDrawer } from "./ui/tooldrawer.js";
import "./core/device.js";
import { maybeShowOnboarding } from "./ui/help/onboarding.js";
import { initDocbar } from "./ui/docbar.js";
import "./editor/documents.js";
import "./editor/layers/groups.js";
import "./editor/layers/layerstyles.js";
import "./editor/layers/smartobject.js";
import "./editor/selection/pentool.js";
import "./app/dom.js";
import "./app/commands/helpers.js";
import "./app/commands/file.js";
import "./app/commands/ai.js";
import "./app/commands/layer.js";
import "./app/commands/image.js";
import "./app/commands/analysis.js";
import "./app/commands/edit.js";
import "./app/commands/filter.js";
import "./app/commands/view.js";
import "./app/commands/selection.js";
import "./app/commands/tools.js";
import "./app/commands/help.js";
import "./app/commands/adjust.js";
import "./app/shortcuts.js";
import { buildTools } from "./app/toolbar.js";
import "./app/canvas-input.js";
import { syncStatus } from "./app/statusbar.js";

// Espacio de color del documento (P3 en fotos de gama amplia): antes de
// que se cree ningún lienzo de documento. Ver core/colorspace.js.
installColorSpace();

/* ═══ arranque ═══ */
initPWA();

initLandscapeNotice();

installKeyboardFit();

initMenu();

initPanels();

import("./ui/histogrampanel.js").then(m => m.initHistogramPanel());

initOpen();

initDocbar();

initProjects();

resumeAfterUpdate();   // lo que se guardó justo antes de actualizar la app (pwa.js)

// Si la página se cayó con un modelo de IA pesado en marcha (ai/runtime.js)
try{ if(localStorage.getItem("realify.aiRunning")) import("./ai/runtime.js").then(m => m.recoverAfterCrash()); }catch{}

try{ if(localStorage.getItem("realify.hdrRunning")) import("../plugins/hdr/index.js").then(m => m.recoverHdrCrash()); }catch{}

initMobileBar();

initToolDrawer();

initRulers();

/* Aviso informativo de cookies. Se importa aparte y sin bloquear: los
   filtros de «avisos de cookies» de algunos bloqueadores (uBlock con
   EasyList Cookie, «I don't care about cookies»…) bloqueaban el archivo
   cuando se llamaba cookiebar.js, y al ser un import estático Firefox no
   llegaba a arrancar la app. Si lo bloquean, la app funciona sin él. */
import("./ui/help/prefsnote.js").then(m => m.initPrefsNote()).catch(() => {});

buildTools();

initColorSwatch(document.getElementById("tools"));

renderOptions();

syncStatus();

renderInfo();

/* Un aviso antes de perder el trabajo. Sólo cuando hay algo abierto:
   preguntar con el lienzo vacío es ruido. */
addEventListener("beforeunload", e => {
  if(!doc.open) return;
  e.preventDefault();
  e.returnValue = "";
});

on("doc:new", () => setTimeout(maybeShowOnboarding, 500));

console.info("Realify · listo");

/* Arrancada: el vigilante (js/boot-guard.js) deja de esperar; y un
   aviso si el navegador bloquea algo que el editor necesita (lectura
   del lienzo, WebGL2, almacenamiento). */
window.__realifyReady = true;

setTimeout(() => import("./core/compat.js").then(m => m.showCompatNotice()).catch(() => {}), 800);
