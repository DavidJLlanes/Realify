/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · VISOR
   La foto a pantalla completa, sin marcos: ocupa todo y las barras flotan encima. Se repinta cuando la sesión o la vista previa cambian.
   Entradas: montarVisor(escenario). Salidas: nada (escucha app/store.js).
   Límites: muestra el lienzo actual de la sesión tal cual; el zoom y los gestos están en ui/gestos.js.
   ═══════════════════════════════════════════════════════════════ */
import { original } from "../app/session.js";
import { vista } from "../app/render.js";
import { leer, poner, suscribir } from "../app/store.js";
import { h } from "./dom.js";
import { crearGestos } from "./gestos.js";

export function montarVisor(escenario) {
  const foto = h("div", { class: "foto" });
  escenario.prepend(foto);
  const gestos = crearGestos(escenario, foto, { alTocar: () => { if (leer().foto) poner({ barras: !leer().barras }); } });
  let dims = "";

  suscribir(est => {
    document.documentElement.classList.toggle("barras-ocultas", !est.barras);
    const o = original(), v = vista();
    if (foto.firstChild !== v) foto.replaceChildren(...(v ? [v] : []));
    const d = o ? `${o.width}x${o.height}` : "";
    if (o) { foto.style.width = o.width + "px"; foto.style.height = o.height + "px"; }
    if (d !== dims) { dims = d; gestos.ajustar(o ? o.width : 0, o ? o.height : 0); }
  });
}
