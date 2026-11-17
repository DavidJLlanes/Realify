/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · RECORTAR (tabla)
   Lo que ofrece la pestaña Recortar, sólo como datos: acciones de un toque (girar, voltear), la elección de proporción y los tres
   ajustes con regla (enderezar, perspectiva vertical y horizontal), con su rango y cómo se muestra el valor.
   Entradas: ninguna. Salidas: REGLAS = [{ id, texto, icono, min, max, def, clave, formato }] · PROPORCIONES = [{ id, texto }].
   Límites: el ángulo se guarda en décimas de grado en la regla (−450..450) y en grados en la receta (clave `angulo`).
   ═══════════════════════════════════════════════════════════════ */
const signo = v => (v > 0 ? "+" + v : String(v));

export const REGLAS = [
  { id: "enderezar", texto: "Enderezar", icono: "enderezar", min: -450, max: 450, def: 0, clave: "angulo", escala: 10, formato: v => (v > 0 ? "+" : "") + (v / 10).toFixed(1) + "°" },
  { id: "vertical", texto: "Vertical", icono: "persV", min: -100, max: 100, def: 0, clave: "persV", escala: 1, formato: signo },
  { id: "horizontal", texto: "Horizontal", icono: "persH", min: -100, max: 100, def: 0, clave: "persH", escala: 1, formato: signo },
];

export const PROPORCIONES = [
  { id: "libre", texto: "Libre" }, { id: "orig", texto: "Original" }, { id: "1:1", texto: "1:1" }, { id: "4:3", texto: "4:3" },
  { id: "3:2", texto: "3:2" }, { id: "16:9", texto: "16:9" }, { id: "3:4", texto: "3:4" }, { id: "2:3", texto: "2:3" }, { id: "9:16", texto: "9:16" },
];
