/* ═══════════════════════════════════════════════════════════════
   ROPA Y TEJIDOS · MANDOS Y GRUPOS
   Los mandos son los mismos para las cuatro funciones de ropa (cada una abre el editor en su grupo): planchar, color, textura y telas.
   Lo que se elige sobre la prenda (`prenda`) y el modo del toque (`telaModo`) valen para todos los grupos. Entradas: ninguna.
   Salidas: GRUPOS, PARAMS, inicio(), hayEfecto().
   ═══════════════════════════════════════════════════════════════ */
import { hayCambioRopa } from "./engine/index.js";

export const GRUPOS = [
  { id: "planchar", label: "Planchar" }, { id: "color", label: "Color" }, { id: "textura", label: "Textura" }, { id: "telas", label: "Telas y fondos" }
];

const PRENDAS = [["todo", "Toda la ropa"], ["arriba", "Camiseta o chaqueta"], ["vestido", "Vestido"], ["falda", "Falda"], ["pantalon", "Pantalón"]];

export const PARAMS = [
  { key: "prenda", label: "Prenda", type: "select", def: "todo", group: "planchar", options: PRENDAS },
  { key: "arrugas", label: "Planchar arrugas", type: "range", min: 0, max: 100, step: 1, def: 0, unit: " %", group: "planchar", fx: true },
  { key: "tamano", label: "Tamaño de los pliegues", type: "range", min: 0, max: 100, step: 1, def: 40, unit: " %", group: "planchar" },
  { key: "conservar", label: "Conservar la forma", type: "range", min: 0, max: 100, step: 1, def: 30, unit: " %", group: "planchar" },
  { key: "conservaTrama", label: "Conservar la trama", type: "range", min: 0, max: 100, step: 1, def: 100, unit: " %", group: "planchar", neutro: 100, fx: true },
  { key: "tono", label: "Tono", type: "range", min: -180, max: 180, step: 1, def: 0, unit: " °", group: "color", fx: true },
  { key: "saturacion", label: "Saturación", type: "range", min: -100, max: 100, step: 1, def: 0, unit: " %", group: "color", fx: true },
  { key: "luminosidad", label: "Luminosidad", type: "range", min: -100, max: 100, step: 1, def: 0, unit: " %", group: "color", fx: true },
  { key: "tinte", label: "Tinte (blanco, gris o negro)", type: "range", min: 0, max: 100, step: 1, def: 0, unit: " %", group: "color", fx: true },
  { key: "trama", label: "Trama del tejido", type: "range", min: -100, max: 100, step: 1, def: 0, unit: " %", group: "textura", fx: true },
  { key: "rellenar", label: "Rellenar zonas lisas", type: "range", min: 0, max: 100, step: 1, def: 0, unit: " %", group: "textura", fx: true },
  { key: "telaElegir", label: "Tocar para elegir la tela", type: "toggle", def: true, group: "telas" },
  { key: "telaModo", label: "Cada toque", type: "seg", def: "add", group: "telas", options: [["add", "Añade"], ["sub", "Quita"]] },
  { key: "telaTolerancia", label: "Tolerancia de color", type: "range", min: 0, max: 100, step: 1, def: 40, unit: " %", group: "telas" },
  { key: "telaIA", label: "Ajustar el borde con IA", type: "toggle", def: true, group: "telas" }
];

/** Valores de arranque: los mandos con efecto (`fx`) de los demás grupos empiezan en su neutro; el grupo abierto, en su valor. */
export function inicio(grupo){
  const v = {}; for(const p of PARAMS) if(p.fx && p.group !== grupo) v[p.key] = p.neutro ?? 0;
  return v;
}
export const hayEfecto = v => hayCambioRopa(v);
