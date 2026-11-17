/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PANEL DE RECORTAR
   Regla y fila, como en Ajustar. La fila lleva: Girar 90°, Voltear, Proporción (cambia la fila por las proporciones) y los ajustes
   con regla Enderezar, Vertical y Horizontal. El recorte se coloca arrastrando las asas sobre la foto (tabs/crop/overlay.js).
   Entradas: montarRecortar(contenedor, { foto, gestos }). Salidas: { desmontar() }.
   Límites: no calcula nada de geometría (engine/geometria.js); sólo escribe valores en la sesión.
   ═══════════════════════════════════════════════════════════════ */
import { cambiarRecorte, cerrarPaso, receta } from "../../app/session.js";
import { suscribir } from "../../app/store.js";
import { h } from "../../ui/dom.js";
import { icono } from "../../ui/icons.js";
import { crearRegla } from "../../ui/ruler.js";
import { alDobleToque, crearFila } from "../../ui/strip.js";
import { montarSobre } from "./overlay.js";
import { PROPORCIONES, REGLAS } from "./params.js";

const paso = parche => { cambiarRecorte({ ...parche, rect: null }); cerrarPaso(); };

export function montarRecortar(contenedor, visor) {
  let elegida = REGLAS[0], modo = "ajustes";
  const fila = crearFila("ajustes");
  const regla = crearRegla({ alSoltar: cerrarPaso, alCambiar: v => cambiarRecorte({ [elegida.clave]: v / elegida.escala, rect: null }) });
  const boton = (texto, ic, alTocar, extra = "") => h("button", { class: "ajuste " + extra, role: "option", onclick: alTocar }, h("span", { class: "disco" }, icono(ic)), h("span", { class: "nombre" }, texto));
  const reglas = REGLAS.map(r => boton(r.texto, r.icono, () => { elegida = r; sincronizar(); fila.centrar(reglas[REGLAS.indexOf(r)]); }));
  reglas.forEach((b, i) => alDobleToque(b, () => paso({ [REGLAS[i].clave]: 0 })));   // doble toque en la regla: a cero
  const acciones = [
    boton("Girar", "girar", () => paso({ giro: ((receta().recorte.giro || 0) + 90) % 360 }), "accion"),
    boton("Voltear", "voltear", () => paso({ volteoH: !receta().recorte.volteoH }), "accion"),
    boton("Proporción", "proporcion", () => { modo = "proporciones"; sincronizar(); }, "accion"),
  ];
  const chips = [boton("Atrás", "atras", () => { modo = "ajustes"; sincronizar(); }, "accion"),
    ...PROPORCIONES.map(p => h("button", { class: "chip", role: "option", "data-id": p.id, onclick: () => { paso({ proporcion: p.id }); } }, p.texto))];

  function sincronizar() {
    const r = receta().recorte;
    fila.el.replaceChildren(...(modo === "ajustes" ? [...acciones, ...reglas] : chips));
    regla.el.hidden = modo !== "ajustes";
    reglas.forEach((b, i) => { const v = r[REGLAS[i].clave] || 0; b.setAttribute("aria-selected", String(REGLAS[i] === elegida)); b.classList.toggle("activo", v !== 0); b.firstChild.style.setProperty("--anillo", v ? `conic-gradient(var(--acento) ${Math.min(1, Math.abs(v * elegida.escala / (REGLAS[i].max))) * 360}deg, transparent 0)` : "none"); });
    acciones[0].classList.toggle("activo", !!r.giro); acciones[1].classList.toggle("activo", !!r.volteoH);
    chips.forEach(c => c.setAttribute("aria-selected", String(c.dataset?.id === (r.proporcion || "orig"))));
    regla.poner(Math.round((r[elegida.clave] || 0) * elegida.escala), elegida.min, elegida.max, elegida.def, elegida.formato);
  }

  contenedor.append(regla.el, fila.el);
  sincronizar();
  const sobre = montarSobre(visor), baja = suscribir(sincronizar);
  const reservar = () => visor.gestos.reservar(64, Math.max(0, innerHeight - contenedor.getBoundingClientRect().top + 4));
  requestAnimationFrame(reservar); addEventListener("resize", reservar);
  return { desmontar() { baja(); removeEventListener("resize", reservar); visor.gestos.reservar(0, 0); sobre.desmontar(); contenedor.replaceChildren(); } };
}
