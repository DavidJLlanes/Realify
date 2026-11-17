/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PANEL DE ESTILOS
   Una sola fila deslizante con «Original» y todos los estilos prediseñados de Realify (sin categorías), cada uno con su miniatura
   hecha con la foto del usuario y su nombre. Al elegir uno aparece encima la regla de intensidad (0–100, 100 por defecto).
   Entradas: montarEstilos(contenedor). Salidas: { desmontar() }.
   Límites: sólo escribe `estilo` en la sesión; el cálculo es del motor (engine/estilo.js). El catálogo se carga al entrar en la pestaña.
   ═══════════════════════════════════════════════════════════════ */
import { cambiarEstilo, cerrarPaso, original, receta } from "../../app/session.js";
import { suscribir } from "../../app/store.js";
import { cargarEstilos } from "../../engine/estilo.js";
import { h } from "../../ui/dom.js";
import { crearRegla } from "../../ui/ruler.js";
import { crearFila } from "../../ui/strip.js";
import { crearMiniaturas } from "./thumbs.js";

const LADO = 112;

export async function montarEstilos(contenedor) {
  const catalogo = await cargarEstilos(), { LOOKS } = catalogo, fila = crearFila("estilos");
  const regla = crearRegla({ min: 0, max: 100, valor: 100, def: 100, formato: v => v + " %", alCambiar: k => cambiarEstilo({ k }), alSoltar: cerrarPaso });
  const mini = crearMiniaturas(original(), LADO, catalogo);
  const elegir = n => { cambiarEstilo({ n }); cerrarPaso(); fila.centrar(botones[n + 1]); };
  const boton = (n, nombre) => h("button", { class: "ajuste estilo", role: "option", "data-n": n, onclick: () => elegir(n) },
    h("span", { class: "mini" }), h("span", { class: "nombre" }, nombre));
  const botones = [boton(-1, "Original"), ...LOOKS.map((l, i) => boton(i, l.name))];
  fila.el.append(...botones);

  /* Las miniaturas se pintan por tandas para que el panel aparezca al momento (primero las más cercanas al estilo elegido). */
  let vivo = true, siguiente = 0;
  const pintar = () => {
    if (!vivo) return;
    for (let k = 0; k < 6 && siguiente < botones.length; k++, siguiente++) {
      const c = mini.canvas(siguiente - 1), b = botones[siguiente].firstChild;
      b.replaceChildren(Object.assign(document.createElement("canvas"), { width: LADO, height: LADO })); b.firstChild.getContext("2d").drawImage(c, 0, 0);
    }
    if (siguiente < botones.length) requestAnimationFrame(pintar);
  };

  function sincronizar() {
    const e = receta().estilo;
    botones.forEach((b, i) => b.setAttribute("aria-selected", String(i - 1 === e.n)));
    regla.el.hidden = e.n < 0;
    regla.poner(e.k, 0, 100, 100, v => v + " %");
  }
  contenedor.append(regla.el, fila.el);
  sincronizar(); requestAnimationFrame(pintar);
  if (receta().estilo.n >= 0) setTimeout(() => botones[receta().estilo.n + 1].scrollIntoView({ inline: "center", block: "nearest" }), 0);
  const baja = suscribir(sincronizar);
  return { desmontar() { vivo = false; baja(); contenedor.replaceChildren(); } };
}
