/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · REGLA
   Deslizador tipo regla (como el de Fotos): una marca fija en el centro y las divisiones se mueven al arrastrar. El valor se lee
   encima. Doble toque lo devuelve a su valor por defecto. También funciona con la rueda y con las flechas del teclado.
   Entradas: crearRegla({ min, max, valor, def, alCambiar(v), alSoltar() }). Salidas: { el, poner(valor, min, max, def) }.
   Límites: valores enteros; 4 px por unidad; un clic de vibración al cruzar el cero (si el dispositivo la tiene).
   ═══════════════════════════════════════════════════════════════ */
import { h } from "./dom.js";

const PX = 4;

export function crearRegla({ min = -100, max = 100, valor = 0, def = 0, alCambiar = () => {}, alSoltar = () => {} } = {}) {
  const cifra = h("div", { class: "regla-valor" });
  const marcas = h("div", { class: "regla-marcas" });
  const el = h("div", { class: "regla", role: "slider", tabindex: 0 }, cifra, h("div", { class: "regla-ventana" }, marcas), h("div", { class: "regla-centro" }));
  let v = valor, inicio = null, ultimo = 0;

  const pintar = () => {
    cifra.textContent = v > 0 && min < 0 ? "+" + v : String(v);
    marcas.style.transform = `translateX(${-(v - min) * PX}px)`;
    el.setAttribute("aria-valuenow", v); el.setAttribute("aria-valuemin", min); el.setAttribute("aria-valuemax", max);
  };
  const dar = (n, confirmar = true) => {
    n = Math.max(min, Math.min(max, Math.round(n)));
    if (n === v) return;
    if ((v < 0) !== (n < 0) || n === 0) navigator.vibrate?.(4);
    v = n; pintar(); if (confirmar) alCambiar(v);
  };
  const dibujarMarcas = () => {
    marcas.style.width = (max - min) * PX + "px";
    marcas.style.marginLeft = "50%";
    marcas.style.setProperty("--cero", (-min) * PX + "px");
  };

  el.addEventListener("pointerdown", e => { el.setPointerCapture(e.pointerId); inicio = { x: e.clientX, v, t: performance.now(), mov: 0 }; });
  el.addEventListener("pointermove", e => { if (!inicio) return; inicio.mov = Math.max(inicio.mov, Math.abs(e.clientX - inicio.x)); dar(inicio.v - (e.clientX - inicio.x) / PX); });
  const fin = () => {
    if (!inicio) return;
    const toque = inicio.mov < 5 && performance.now() - inicio.t < 300; inicio = null;
    if (toque && performance.now() - ultimo < 320) { dar(def); ultimo = 0; } else if (toque) ultimo = performance.now();
    alSoltar();
  };
  el.addEventListener("pointerup", fin); el.addEventListener("pointercancel", fin);
  el.addEventListener("wheel", e => { e.preventDefault(); dar(v - Math.sign(e.deltaY) * (e.shiftKey ? 10 : 1)); clearTimeout(el._r); el._r = setTimeout(alSoltar, 350); }, { passive: false });
  el.addEventListener("keydown", e => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (d) { e.preventDefault(); dar(v + d * (e.shiftKey ? 10 : 1)); clearTimeout(el._r); el._r = setTimeout(alSoltar, 350); }
  });

  dibujarMarcas(); pintar();
  return { el, poner(nuevo, mn = min, mx = max, df = def) { min = mn; max = mx; def = df; dibujarMarcas(); v = Math.max(min, Math.min(max, nuevo)); pintar(); } };
}
