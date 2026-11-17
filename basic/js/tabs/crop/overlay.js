/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · RECORTE SOBRE LA FOTO
   El rectángulo de recorte con asas en las esquinas y los lados, cuadrícula de tercios y el exterior atenuado. Se mueve arrastrando
   dentro y se redimensiona con las asas (respetando la proporción elegida); nunca sale de la foto girada o corregida. Vive dentro del
   contenedor de la foto, así que sigue el zoom y el desplazamiento; sus asas mantienen su tamaño en pantalla (--inv).
   Entradas: montarSobre({ foto, gestos }). Salidas: { desmontar() }.
   Límites: sólo escribe `rect` (en 0..1 del marco) en la sesión; la geometría válida la decide engine/geometria.js.
   ═══════════════════════════════════════════════════════════════ */
import { geometria } from "../../app/render.js";
import { cambiarRecorte, cerrarPaso, receta } from "../../app/session.js";
import { suscribir } from "../../app/store.js";
import { RATIOS, dentroDelQuad } from "../../engine/geometria.js";
import { h } from "../../ui/dom.js";

const ASAS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], MIN = 48;

export function montarSobre({ foto, gestos }) {
  const asas = ASAS.map(([dx, dy]) => h("div", { class: "asa " + (dx && dy ? "esquina" : "lado"), "data-dx": dx, "data-dy": dy }));
  const marco = h("div", { class: "asa marco" }, h("i", { class: "terc" }), ...asas);
  const sobre = h("div", { class: "recorte-sobre" }, marco);
  foto.append(sobre);
  let arrastre = null;

  function dibujar() {
    const g = geometria(); if (!g) return;
    const r = g.rect; sobre.style.cssText = `width:${g.frame.w}px;height:${g.frame.h}px`;
    marco.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
  }

  const guardar = r => { const g = geometria(); cambiarRecorte({ rect: { x0: r.x / g.frame.w, y0: r.y / g.frame.h, x1: (r.x + r.w) / g.frame.w, y1: (r.y + r.h) / g.frame.h } }); };

  sobre.addEventListener("pointerdown", e => {
    const t = e.target.closest(".asa"); if (!t) return;
    e.preventDefault(); sobre.setPointerCapture(e.pointerId);
    const g = geometria(), [px, py] = gestos.aLogico(e);
    arrastre = { g, px, py, r0: { ...g.rect }, dx: +t.dataset.dx || 0, dy: +t.dataset.dy || 0, mover: t === marco, asp: aspecto(g) };
  });
  sobre.addEventListener("pointermove", e => {
    if (!arrastre) return;
    const [px, py] = gestos.aLogico(e), a = arrastre, ddx = px - a.px, ddy = py - a.py;
    guardar(a.mover ? mover(a, ddx, ddy) : cambiarTamano(a, ddx, ddy));
  });
  const fin = () => { if (arrastre) { arrastre = null; cerrarPaso(); } };
  sobre.addEventListener("pointerup", fin); sobre.addEventListener("pointercancel", fin);

  const quita = suscribir(dibujar); dibujar();
  return { desmontar() { quita(); sobre.remove(); } };
}

/* Proporción fija (ancho/alto) de la receta, o null si es libre. «Original» = la de la foto ya girada. */
function aspecto(g) {
  const r = receta().recorte, p = r.proporcion || "orig";
  if (p === "libre") return null;
  if (p === "orig") { const { w, h } = g.origen; return (r.giro || 0) % 180 ? h / w : w / h; }
  return RATIOS[p];
}

/* Se acerca el movimiento a lo máximo que cabe dentro del cuadrilátero (bisección sobre la fracción del arrastre). */
function mover(a, dx, dy) {
  const en = t => ({ ...a.r0, x: a.r0.x + dx * t, y: a.r0.y + dy * t });
  if (dentroDelQuad(en(1), a.g.quad)) return en(1);
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (dentroDelQuad(en(m), a.g.quad)) lo = m; else hi = m; }
  return en(lo);
}

function cambiarTamano(a, ddx, ddy) {
  const r = a.r0, ax = a.dx > 0 ? r.x : a.dx < 0 ? r.x + r.w : r.x + r.w / 2, ay = a.dy > 0 ? r.y : a.dy < 0 ? r.y + r.h : r.y + r.h / 2;
  const fx = a.dx ? a.dx : 0, fy = a.dy ? a.dy : 0;
  const cand = k => {                                   // k = 1: el arrastre pedido; menos: más cerca del ancla
    let w = a.dx ? Math.max(MIN, r.w + fx * ddx * k) : r.w, h = a.dy ? Math.max(MIN, r.h + fy * ddy * k) : r.h;
    if (a.asp) { if (a.dx && (!a.dy || w / r.w >= h / r.h)) h = w / a.asp; else w = h * a.asp; }
    const x = a.dx > 0 ? ax : a.dx < 0 ? ax - w : ax - w / 2, y = a.dy > 0 ? ay : a.dy < 0 ? ay - h : ay - h / 2;
    return { x, y, w, h };
  };
  if (dentroDelQuad(cand(1), a.g.quad)) return cand(1);
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (dentroDelQuad(cand(m), a.g.quad)) lo = m; else hi = m; }
  return cand(lo);
}
