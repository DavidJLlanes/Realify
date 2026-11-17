/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PANEL DE AJUSTAR
   Fila con «Auto» y los 15 ajustes (cada uno con un anillo que muestra su valor) y, debajo, la regla del ajuste elegido. Arrastrar la
   regla cambia la receta en vivo; al soltar se cierra un paso de historial.
   Entradas: montarAjustar(contenedor). Salidas: { desmontar() }.
   Límites: la interfaz no calcula píxeles: sólo escribe valores en la sesión (app/session.js) y el motor los aplica.
   ═══════════════════════════════════════════════════════════════ */
import { cambiar, cerrarPaso, receta } from "../../app/session.js";
import { medirAutoActual } from "../../app/render.js";
import { suscribir } from "../../app/store.js";
import { h } from "../../ui/dom.js";
import { icono } from "../../ui/icons.js";
import { crearRegla } from "../../ui/ruler.js";
import { crearFila } from "../../ui/strip.js";
import { AJUSTES } from "./params.js";

const anillo = (v, min, max) => {
  const f = v >= 0 ? v / (max || 1) : v / (min || 1), g = Math.min(1, Math.abs(f)) * 360;
  return v === 0 ? "none" : v > 0 || min === 0 ? `conic-gradient(var(--acento) ${g}deg, transparent 0)` : `conic-gradient(transparent ${360 - g}deg, var(--acento) 0)`;
};

export function montarAjustar(contenedor) {
  let elegido = AJUSTES[0];
  const fila = crearFila("ajustes");
  const regla = crearRegla({ alCambiar: v => cambiar({ [elegido.id]: v }), alSoltar: cerrarPaso });

  const auto = h("button", { class: "ajuste auto", role: "option", onclick: async () => { cambiar((await medirAutoActual()).ajustes); cerrarPaso(); } },
    h("span", { class: "disco" }, icono("wand-sparkles")), h("span", { class: "nombre" }, "Auto"));
  const botones = AJUSTES.map(a => h("button", { class: "ajuste", role: "option", "data-id": a.id, onclick: () => elegir(a) },
    h("span", { class: "disco" }, icono(a.icono)), h("span", { class: "nombre" }, a.texto)));
  fila.el.append(auto, ...botones);

  function elegir(a) { elegido = a; sincronizar(); fila.centrar(botones[AJUSTES.indexOf(a)]); }
  function sincronizar() {
    const vals = receta().ajustes;
    botones.forEach((b, i) => {
      const a = AJUSTES[i], v = vals[a.id] || 0;
      b.setAttribute("aria-selected", String(a === elegido));
      b.firstChild.style.setProperty("--anillo", anillo(v, a.min, a.max));
      b.classList.toggle("activo", v !== 0);
    });
    regla.poner(vals[elegido.id] || 0, elegido.min, elegido.max, elegido.def);
  }

  contenedor.append(regla.el, fila.el);
  sincronizar();
  const baja = suscribir(sincronizar);
  return { desmontar() { baja(); contenedor.replaceChildren(); } };
}
