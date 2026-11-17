/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · VISOR
   La foto a pantalla completa, sin marcos: ocupa todo y las barras flotan encima. Se repinta cuando la sesión o la vista previa cambian.
   Entradas: montarVisor(escenario). Salidas: { foto, gestos } (el contenedor de la foto y sus gestos, para los paneles que dibujan encima).
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
    const o = original(), v = vista(), t = est.dims || (o && { w: o.width, h: o.height });
    if (v && foto.firstChild !== v) foto.replaceChildren(v, ...[...foto.children].filter(n => n.classList.contains("recorte-sobre")));
    if (!v) foto.replaceChildren();
    const d = t ? `${t.w}x${t.h}` : "";
    if (t) { foto.style.width = t.w + "px"; foto.style.height = t.h + "px"; }
    if (d !== dims) { dims = d; gestos.ajustar(t ? t.w : 0, t ? t.h : 0); }
  });
  return { foto, gestos };
}
