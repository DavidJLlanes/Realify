/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · BARRA SUPERIOR
   Dos filas de píldoras de cristal sobre la foto. Fila 1: Cancelar y OK. Fila 2: deshacer/rehacer y el menú «···».
   Cancelar cierra la foto (si hay cambios pide un segundo toque); OK guarda una copia y se apaga mientras no haya cambios.
   Entradas: montarBarraSuperior(escenario, { alCerrar, alGuardar, acciones }). Salidas: nada (escucha app/store.js).
   Límites: la lógica de deshacer y guardar vive en app/; aquí sólo se conectan los botones.
   ═══════════════════════════════════════════════════════════════ */
import { deshacer, rehacer } from "../app/session.js";
import { suscribir } from "../app/store.js";
import { h } from "./dom.js";
import { icono } from "./icons.js";
import { crearMenu } from "./menu.js";

export function montarBarraSuperior(escenario, { alCerrar, alGuardar, acciones }) {
  let armado = 0;
  const cancelar = h("button", { class: "pildora texto", onclick: () => {
    if (!armado && cancelar.dataset.sucio) { cancelar.textContent = "¿Descartar?"; armado = setTimeout(() => { armado = 0; cancelar.textContent = "Cancelar"; }, 3000); return; }
    clearTimeout(armado); armado = 0; cancelar.textContent = "Cancelar"; alCerrar();
  } }, "Cancelar");
  const ok = h("button", { class: "pildora texto fuerte", onclick: alGuardar }, "OK");
  const atras = h("button", { class: "boton-icono", "aria-label": "Deshacer", onclick: deshacer }, icono("undo"));
  const adelante = h("button", { class: "boton-icono", "aria-label": "Rehacer", onclick: rehacer }, icono("redo"));
  const mas = h("button", { class: "boton-icono", "aria-label": "Más opciones", "aria-haspopup": "menu", "aria-expanded": "false" }, icono("mas"));
  const zonaMas = h("div", { class: "ancla-menu" }, h("div", { class: "pildora grupo" }, mas));

  escenario.append(h("header", { class: "barra barra-sup" },
    h("div", { class: "fila" }, cancelar, ok),
    h("div", { class: "fila" }, h("div", { class: "pildora grupo" }, atras, adelante), zonaMas)));
  crearMenu(mas, acciones);

  suscribir(e => {
    atras.disabled = !e.puedeDeshacer; adelante.disabled = !e.puedeRehacer; ok.disabled = !e.sucio;
    cancelar.dataset.sucio = e.sucio ? "1" : "";
  });
}
