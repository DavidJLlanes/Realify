/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · FILA DESLIZABLE
   Fila horizontal de botones con desplazamiento (los ajustes de Ajustar, los estilos de Estilos). Se desplaza con el dedo, con el
   ratón (arrastrando) y con la rueda; el elemento elegido se centra solo.
   Entradas: crearFila(clase). Salidas: { el, centrar(boton) } y alDobleToque(boton, fn).
   Límites: sólo contiene y desplaza; qué lleva cada botón lo decide quien la usa.
   ═══════════════════════════════════════════════════════════════ */
import { h } from "./dom.js";

/** Doble toque o doble clic en un botón: llama a alDoble (el primer toque sigue haciendo lo suyo). Funciona igual con ratón y con el dedo. */
export function alDobleToque(boton, alDoble, ms = 320) {
  let t = 0;
  boton.addEventListener("click", () => { const ahora = performance.now(); if (ahora - t < ms) { t = 0; alDoble(); } else t = ahora; });
}

export function crearFila(clase = "") {
  const el = h("div", { class: "fila-desliza " + clase, role: "listbox" });
  let a = null;
  el.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") a = { x: e.clientX, s: el.scrollLeft, mov: 0 }; });
  el.addEventListener("pointermove", e => { if (!a) return; a.mov = Math.max(a.mov, Math.abs(e.clientX - a.x)); if (a.mov > 5) el.scrollLeft = a.s - (e.clientX - a.x); });
  addEventListener("pointerup", () => { if (a && a.mov > 5) el.addEventListener("click", e => e.stopPropagation(), { capture: true, once: true }); a = null; });
  el.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  return { el, centrar: (b, suave = true) => centrarEn(el, b, suave) };
}

/* Centra el botón desplazando SÓLO la fila. scrollIntoView no vale: cuando la fila ya no puede moverse más (el último elemento)
   desplaza también los contenedores de fuera —aunque tengan overflow: hidden— y en el iPhone toda la interfaz se iba a un lado. */
function centrarEn(fila, b, suave = true) {
  if (!fila || !b) return;
  const f = fila.getBoundingClientRect(), r = b.getBoundingClientRect();
  const izq = Math.max(0, Math.min(fila.scrollWidth - fila.clientWidth, fila.scrollLeft + (r.left - f.left) - (f.width - r.width) / 2));
  fila.scrollTo({ left: izq, behavior: suave ? "smooth" : "auto" });
}
