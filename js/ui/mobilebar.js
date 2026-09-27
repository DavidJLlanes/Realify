import { enabled } from "./commands.js";
import { on } from "../core/bus.js";
import { openMobileMenu } from "./menu.js";

/* La lista de filtros que antes vivía aquí —un diálogo propio con
   categorías en <details>— se retiró: es exactamente el mismo
   contenido que ya cubre el cajón «Herramientas» (ver
   tooldrawer.js), con sus mismas categorías y cobertura garantizada
   por su propio checkCoverage(). Tener las dos vías —el botón
   «Filtros» de esta barra Y el asa «Herramientas» sobre ella—
   duplicaba el mismo trabajo por dos caminos distintos sin ninguna
   diferencia real entre ambos. */

function sync(){
  document.querySelectorAll("#mobilebar [data-cmd]").forEach(b => {
    b.disabled = !enabled(b.dataset.cmd);
  });
}

export function initMobileBar(){
  sync();
  on("doc:change", sync); on("doc:structure", sync);
  on("history:change", sync); on("cmd:done", sync);
  document.getElementById("mobilebarMenu")
    .addEventListener("click", e => { e.stopPropagation(); openMobileMenu(e.currentTarget); });
}
