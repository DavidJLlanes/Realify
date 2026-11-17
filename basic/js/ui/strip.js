/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · FILA DESLIZABLE
   Fila horizontal de botones con desplazamiento (los ajustes de Ajustar, los estilos de Estilos). Se desplaza con el dedo, con el
   ratón (arrastrando) y con la rueda; el elemento elegido se centra solo.
   Entradas: crearFila(clase). Salidas: { el, centrar(boton) }.
   Límites: sólo contiene y desplaza; qué lleva cada botón lo decide quien la usa.
   ═══════════════════════════════════════════════════════════════ */
import { h } from "./dom.js";

export function crearFila(clase = "") {
  const el = h("div", { class: "fila-desliza " + clase, role: "listbox" });
  let a = null;
  el.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") a = { x: e.clientX, s: el.scrollLeft, mov: 0 }; });
  el.addEventListener("pointermove", e => { if (!a) return; a.mov = Math.max(a.mov, Math.abs(e.clientX - a.x)); if (a.mov > 5) el.scrollLeft = a.s - (e.clientX - a.x); });
  addEventListener("pointerup", () => { if (a && a.mov > 5) el.addEventListener("click", e => e.stopPropagation(), { capture: true, once: true }); a = null; });
  el.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  return { el, centrar: b => b?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }) };
}
