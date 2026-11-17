/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · VISOR
   La foto a pantalla completa, sin marcos: ocupa todo y las barras flotan encima. Se repinta cuando la sesión cambia.
   Entradas: montarVisor(escenario). Salidas: nada (escucha app/store.js).
   Límites: muestra el lienzo actual de la sesión tal cual; el zoom y los gestos están en ui/gestos.js.
   ═══════════════════════════════════════════════════════════════ */
import { actual } from "../app/session.js";
import { leer, poner, suscribir } from "../app/store.js";
import { h } from "./dom.js";
import { crearGestos } from "./gestos.js";

export function montarVisor(escenario) {
  const foto = h("div", { class: "foto" });
  escenario.prepend(foto);
  const gestos = crearGestos(escenario, foto, { alTocar: () => { if (leer().foto) poner({ barras: !leer().barras }); } });
  let visto = -1, dims = "";

  suscribir(est => {
    document.documentElement.classList.toggle("barras-ocultas", !est.barras);
    if (est.version === visto) return;
    visto = est.version;
    const l = actual();
    foto.replaceChildren(...(l ? [l] : []));
    const d = l ? `${l.width}x${l.height}` : "";
    if (l) { foto.style.width = l.width + "px"; foto.style.height = l.height + "px"; }
    if (d !== dims) { dims = d; gestos.ajustar(l ? l.width : 0, l ? l.height : 0); }
  });
}
