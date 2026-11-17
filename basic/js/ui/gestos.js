/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · GESTOS DEL VISOR
   Zoom y desplazamiento de la foto: pellizco y arrastre con el dedo, rueda y arrastre con el ratón, doble toque o doble clic
   para acercar y volver. Un toque suelto avisa con alTocar (muestra u oculta las barras).
   Entradas: crearGestos(zona, elemento, { alTocar }). Salidas: { ajustar(ancho, alto), encuadrar() }.
   Límites: no pinta la foto (eso es ui/viewport.js); el zoom llega a 8 veces el tamaño ajustado.
   ═══════════════════════════════════════════════════════════════ */
const MAX_ZOOM = 8;

export function crearGestos(zona, el, { alTocar = () => {} } = {}) {
  let w = 0, h = 0, s = 1, x = 0, y = 0, s0 = 1, ultimoToque = { t: 0, x: 0, y: 0 };
  const dedos = new Map();
  let inicio = null;

  const aplicar = () => { el.style.transform = `translate(${x}px, ${y}px) scale(${s})`; };
  function limitar() {
    const W = zona.clientWidth, H = zona.clientHeight, aw = w * s, ah = h * s;
    x = aw <= W ? (W - aw) / 2 : Math.min(0, Math.max(W - aw, x));
    y = ah <= H ? (H - ah) / 2 : Math.min(0, Math.max(H - ah, y));
  }
  function zoomEn(px, py, nuevo) {
    nuevo = Math.min(s0 * MAX_ZOOM, Math.max(s0, nuevo));
    x = px - (px - x) * (nuevo / s); y = py - (py - y) * (nuevo / s); s = nuevo; limitar(); aplicar();
  }
  function encuadrar() {
    if (!w) return;
    s0 = s = Math.min(zona.clientWidth / w, zona.clientHeight / h); x = y = 0; limitar(); aplicar();
  }
  const punto = e => { const r = zona.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const medio = () => { const p = [...dedos.values()]; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2, Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1])]; };

  zona.addEventListener("pointerdown", e => {
    if (!w || e.target.closest(".barra, .menu, .bienvenida")) return;
    zona.setPointerCapture(e.pointerId); dedos.set(e.pointerId, punto(e));
    inicio = { t: performance.now(), mov: 0, n: dedos.size, ref: dedos.size === 2 ? medio() : null };
  });
  zona.addEventListener("pointermove", e => {
    if (!dedos.has(e.pointerId)) return;
    const [px, py] = punto(e), [ax, ay] = dedos.get(e.pointerId);
    dedos.set(e.pointerId, [px, py]); inicio.mov += Math.abs(px - ax) + Math.abs(py - ay);
    if (dedos.size === 2) {
      const [cx, cy, d] = medio(), [rx, ry, rd] = inicio.ref;
      x += cx - rx; y += cy - ry; zoomEn(cx, cy, s * (d / rd)); inicio.ref = [cx, cy, d];
    } else if (s > s0 * 1.001) { x += px - ax; y += py - ay; limitar(); aplicar(); }
  });
  const soltar = e => {
    if (!dedos.delete(e.pointerId) || !inicio) return;
    const [px, py] = punto(e);
    if (inicio.n === 1 && inicio.mov < 8 && performance.now() - inicio.t < 350) {
      const doble = performance.now() - ultimoToque.t < 300 && Math.hypot(px - ultimoToque.x, py - ultimoToque.y) < 30;
      ultimoToque = { t: doble ? 0 : performance.now(), x: px, y: py };
      if (doble) zoomEn(px, py, s > s0 * 1.05 ? s0 : s0 * 2.5); else setTimeout(() => { if (ultimoToque.t) alTocar(); }, 300);
    }
    if (!dedos.size) inicio = null;
  };
  zona.addEventListener("pointerup", soltar);
  zona.addEventListener("pointercancel", soltar);
  zona.addEventListener("wheel", e => { if (!w) return; e.preventDefault(); const [px, py] = punto(e); zoomEn(px, py, s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015))); }, { passive: false });
  addEventListener("resize", encuadrar);

  return { ajustar(ancho, alto) { w = ancho; h = alto; encuadrar(); }, encuadrar };
}
