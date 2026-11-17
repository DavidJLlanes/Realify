/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · BARRA DE PESTAÑAS
   Píldora de cristal en la parte baja con Ajustar · Estilos · Recortar. La activa va en blanco con un triángulo del color de acento.
   Entradas: montarPestanas(escenario). Salidas: nada (cambia `pestana` en app/store.js).
   Límites: no monta paneles; eso llega con cada fase (ver tabs/index.js).
   ═══════════════════════════════════════════════════════════════ */
import { poner, suscribir } from "../app/store.js";
import { PESTANAS } from "../tabs/index.js";
import { h } from "./dom.js";
import { icono } from "./icons.js";

export function montarPestanas(escenario) {
  const botones = PESTANAS.map(p => h("button", { class: "pestana", role: "tab", "data-id": p.id, onclick: () => poner({ pestana: p.id }) },
    icono(p.icono), h("span", {}, p.texto)));
  escenario.append(h("nav", { class: "barra barra-inf" }, h("div", { class: "pildora pestanas", role: "tablist" }, botones)));
  suscribir(e => botones.forEach(b => b.setAttribute("aria-selected", String(b.dataset.id === e.pestana))));
}
