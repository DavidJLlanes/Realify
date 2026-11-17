/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PANTALLA DE INICIO
   Lo que se ve sin foto: el icono, el nombre y un botón para abrir una (también se puede arrastrar o pegar).
   Entradas: montarBienvenida(escenario, { alAbrir }). Salidas: nada (se oculta sola al abrir una foto).
   ═══════════════════════════════════════════════════════════════ */
import { suscribir } from "../app/store.js";
import { h } from "./dom.js";
import { icono } from "./icons.js";

export function montarBienvenida(escenario, { alAbrir, alPegar }) {
  const pantalla = h("section", { class: "bienvenida" },
    h("img", { src: new URL("../../../assets/android-192.png", import.meta.url).href, alt: "", width: 84, height: 84 }),
    h("h1", {}, "Realify Basic"),
    h("button", { class: "pildora texto fuerte grande", onclick: alAbrir }, icono("abrir"), h("span", {}, "Abrir foto")),
    alPegar && navigator.clipboard?.read ? h("button", { class: "pildora texto", onclick: alPegar }, icono("pegar"), h("span", {}, "Pegar foto")) : null,
    h("p", {}, "o suelta una foto aquí"));
  escenario.append(pantalla);
  suscribir(e => { document.documentElement.classList.toggle("sin-foto", !e.foto); pantalla.hidden = !!e.foto; });
}
