/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · BARRA DE PESTAÑAS
   Píldora de cristal en la parte baja con Ajustar · Estilos · Recortar. La activa va en blanco con un triángulo del color de acento.
   Entradas: montarPestanas(escenario). Salidas: la variable CSS --pie (alto de la barra) y el cambio de `pestana` en app/store.js.
   Límites: no monta paneles; eso llega con cada fase (ver tabs/index.js).
   ═══════════════════════════════════════════════════════════════ */
import { poner, suscribir } from "../app/store.js";
import { PESTANAS } from "../tabs/index.js";
import { h } from "./dom.js";
import { icono } from "./icons.js";

export function montarPestanas(escenario) {
  const botones = PESTANAS.map(p => h("button", { class: "pestana", role: "tab", "data-id": p.id, onclick: () => poner({ pestana: p.id }) },
    icono(p.icono), h("span", {}, p.texto)));
  const barra = h("nav", { class: "barra barra-inf" }, h("div", { class: "pildora pestanas", role: "tablist" }, botones));
  escenario.append(barra);
  /* El alto real de la barra (píldora + hueco inferior) en --pie: los paneles se apoyan justo encima, sin hueco de más (shell.css/controls.css). */
  const medir = () => document.documentElement.style.setProperty("--pie", barra.offsetHeight + "px");
  new ResizeObserver(medir).observe(barra); medir();
  suscribir(e => botones.forEach(b => b.setAttribute("aria-selected", String(b.dataset.id === e.pestana))));
}
