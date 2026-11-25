/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MENÚ «···»
   Desplegable translúcido bajo el botón de tres puntos: abrir otra foto, guardar una copia y volver al original. Al pie, en
   pequeño, la compilación cargada y el alto de pantalla usado (diagnóstico).
   Entradas: crearMenu(botonAncla, acciones) con acciones = [{ id, texto, icono, ver?(estado), alTocar }].
   Salidas: { cerrar() }. Límites: se cierra al tocar fuera, con Escape o al elegir una opción.
   ═══════════════════════════════════════════════════════════════ */
import { textoAlto } from "../app/alto.js";
import { errorMotor } from "../app/render.js";
import { leer } from "../app/store.js";
import { h } from "./dom.js";
import { icono } from "./icons.js";

/* La compilación cargada (el ?v= de main.js): sirve para saber si el móvil ya tiene la última versión. */
const compilacion = () => (/[?&]v=(\d+)/.exec(document.querySelector('script[src*="main.js"]')?.src || "") || [])[1] || "?";

export function crearMenu(ancla, acciones) {
  const menu = h("div", { class: "menu", role: "menu", hidden: true });
  ancla.closest(".ancla-menu").append(menu);
  const cerrar = () => { menu.hidden = true; ancla.setAttribute("aria-expanded", "false"); };

  function abrir() {
    menu.replaceChildren(...acciones.filter(a => !a.ver || a.ver(leer())).map(a =>
      h("button", { class: "menu-op", role: "menuitem", onclick: () => { cerrar(); a.alTocar(); } }, icono(a.icono), h("span", {}, a.texto))),
      h("div", { class: "menu-pie" }, `Compilación ${compilacion()} · ${textoAlto()}` + (errorMotor() ? ` · ERROR: ${errorMotor()}` : "")));
    menu.hidden = false; ancla.setAttribute("aria-expanded", "true");
  }
  ancla.addEventListener("click", e => { e.stopPropagation(); menu.hidden ? abrir() : cerrar(); });
  addEventListener("pointerdown", e => { if (!menu.hidden && !menu.contains(e.target) && !ancla.contains(e.target)) cerrar(); });
  addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });
  return { cerrar };
}
