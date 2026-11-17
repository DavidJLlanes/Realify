/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · AVISO
   Mensaje breve y translúcido sobre la foto («Guardada», «No se pudo abrir…»).
   Entradas: avisar(texto). Salidas: ninguna. Límites: un solo aviso a la vez; desaparece solo a los 2,6 s.
   ═══════════════════════════════════════════════════════════════ */
import { h } from "./dom.js";

let nodo = null, reloj = 0;

export function avisar(texto) {
  nodo ||= document.body.appendChild(h("div", { class: "aviso", role: "status" }));
  nodo.textContent = texto; nodo.classList.add("visible");
  clearTimeout(reloj); reloj = setTimeout(() => nodo.classList.remove("visible"), 2600);
}
