/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · SESIÓN DE EDICIÓN
   Edición no destructiva: la foto original (nunca se toca) más una «receta» con los valores de cada ajuste. El historial guarda
   sólo recetas (unos pocos bytes cada una), así que deshacer es instantáneo y no hay pérdida de calidad por reaplicar.
   Un gesto (arrastrar un deslizador o un asa de recorte) cambia la receta en vivo con cambiar()/cambiarRecorte() y se cierra con
   cerrarPaso(): un solo paso de historial.
   Entradas: iniciar(lienzo, info) · cambiar(ajustes) · cambiarRecorte(parche) · cambiarEstilo(parche) · cerrarPaso() · deshacer() · rehacer() · volverAlOriginal() · cerrar().
   Salidas: original() · receta() y el estado de app/store.js (foto, version, puedeDeshacer, puedeRehacer, sucio).
   Límites: hasta 200 pasos de historial; la receta lleva `ajustes`, `recorte` y `estilo` ({ n: posición en LOOKS o −1, k: intensidad 0–100 }).
   ═══════════════════════════════════════════════════════════════ */
import { ESTILO0, RECORTE0, esNeutra } from "../engine/neutra.js";
import { poner } from "./store.js";

const MAX_PASOS = 200;
let base = null, datos = null, vivo = nueva(), hist = [], i = -1, version = 0, abierto = false;

function nueva() { return { ajustes: {}, recorte: { ...RECORTE0 }, estilo: { ...ESTILO0 } }; }
const clon = r => ({ ajustes: { ...r.ajustes }, recorte: { ...r.recorte, rect: r.recorte.rect && { ...r.recorte.rect } }, estilo: { ...r.estilo } });
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const original = () => base;
export const receta = () => vivo;

function avisar() {
  poner({
    foto: base ? { ...datos, ancho: base.width, alto: base.height } : null,
    version: ++version, sucio: !esNeutra(vivo),
    puedeDeshacer: i > 0 || (abierto && !igual(vivo, hist[i])), puedeRehacer: i >= 0 && i < hist.length - 1,
  });
}

export function iniciar(lienzo, info) { base = lienzo; datos = info; vivo = nueva(); hist = [clon(vivo)]; i = 0; abierto = false; avisar(); poner({ barras: true }); }

export function cambiar(ajustes) { vivo = { ...vivo, ajustes: { ...vivo.ajustes, ...ajustes } }; abierto = true; avisar(); }
export function cambiarRecorte(parche) { vivo = { ...vivo, recorte: { ...vivo.recorte, ...parche } }; abierto = true; avisar(); }

export function cambiarEstilo(parche) { vivo = { ...vivo, estilo: { ...vivo.estilo, ...parche } }; abierto = true; avisar(); }

export function cerrarPaso() {
  if (!abierto) return;
  abierto = false;
  if (!igual(vivo, hist[i])) {
    hist = hist.slice(0, i + 1); hist.push(clon(vivo));
    if (hist.length > MAX_PASOS) hist.shift();
    i = hist.length - 1;
  }
  avisar();
}

function ir(n) { abierto = false; i = n; vivo = clon(hist[i]); avisar(); }
export function deshacer() { if (abierto && !igual(vivo, hist[i])) ir(i); else if (i > 0) ir(i - 1); }
export function rehacer() { if (i < hist.length - 1) ir(i + 1); }
export function volverAlOriginal() { if (!esNeutra(vivo)) { vivo = nueva(); abierto = true; cerrarPaso(); } }
export function cerrar() { base = null; datos = null; vivo = nueva(); hist = []; i = -1; abierto = false; avisar(); }
