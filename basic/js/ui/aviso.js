/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · AVISO
   Mensaje breve y translúcido sobre la foto («Copia guardada», «Procesando…»).
   Entradas: avisar(texto, { fijo }) · ocultarAviso(). Salidas: ninguna.
   Límites: un solo aviso a la vez; desaparece solo a los 2,6 s salvo que sea fijo (hasta ocultarAviso()).
   ═══════════════════════════════════════════════════════════════ */
import { h } from "./dom.js";

let nodo = null, reloj = 0;

export function avisar(texto, { fijo = false } = {}) {
  nodo ||= document.body.appendChild(h("div", { class: "aviso", role: "status" }));
  nodo.textContent = texto; nodo.classList.add("visible");
  clearTimeout(reloj);
  if (!fijo) reloj = setTimeout(ocultarAviso, 2600);
}

export function ocultarAviso() { clearTimeout(reloj); nodo?.classList.remove("visible"); }
