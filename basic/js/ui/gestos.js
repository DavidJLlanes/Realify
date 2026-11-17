/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · GESTOS DEL VISOR
   Zoom y desplazamiento de la foto: pellizco y arrastre con el dedo, rueda y arrastre con el ratón, doble toque o doble clic
   para acercar y volver (si está acercada, alejada o movida, el doble toque la vuelve a ajustar y centrar). Se puede alejar por
   debajo del ajuste y la foto se arrastra libremente con cualquier zoom (sin perderla de vista). Un toque suelto avisa con alTocar (muestra u oculta las barras).
   Entradas: crearGestos(zona, elemento, { alTocar }). Salidas: { ajustar(ancho, alto), reservar(arriba, abajo) (zona libre para mandos superpuestos), encuadrar(), aLogico(evento) → [x, y] en píxeles de la foto }.
   Deja en el elemento la variable CSS --inv (1 / zoom) para que los mandos superpuestos mantengan su tamaño en pantalla.
   Límites: no pinta la foto (eso es ui/viewport.js); el zoom va de 0,25 a 8 veces el tamaño ajustado.
   ═══════════════════════════════════════════════════════════════ */
const MAX_ZOOM = 8, MIN_ZOOM = 0.25;              // alejar hasta un cuarto del tamaño ajustado (la foto queda centrada)

export function crearGestos(zona, el, { alTocar = () => {} } = {}) {
  let w = 0, h = 0, ra = 0, rb = 0, s = 1, x = 0, y = 0, s0 = 1, ultimoToque = { t: 0, x: 0, y: 0 };
  const dedos = new Map();
  let inicio = null;

  const aplicar = () => { el.style.transform = `translate(${x}px, ${y}px) scale(${s})`; el.style.setProperty("--inv", 1 / s); };
  /* La foto se mueve libremente con cualquier zoom; sólo se impide perderla: siempre queda a la vista al menos un tercio de ella
     (o de la pantalla, si es más grande). */
  function limitar() {
    const W = zona.clientWidth, H = zona.clientHeight - ra - rb, aw = w * s, ah = h * s, mx = Math.min(aw, W) / 3, my = Math.min(ah, H) / 3;
    x = Math.min(W - mx, Math.max(mx - aw, x));
    y = Math.min(ra + H - my, Math.max(ra + my - ah, y));
  }
  const centrar = () => { x = (zona.clientWidth - w * s) / 2; y = (zona.clientHeight - ra - rb - h * s) / 2 + ra; };
  const ajustada = () => Math.abs(s / s0 - 1) < 0.05 && Math.abs(x - (zona.clientWidth - w * s) / 2) < 2 && Math.abs(y - ((zona.clientHeight - ra - rb - h * s) / 2 + ra)) < 2;
  function zoomEn(px, py, nuevo) {
    nuevo = Math.min(s0 * MAX_ZOOM, Math.max(s0 * MIN_ZOOM, nuevo));
    x = px - (px - x) * (nuevo / s); y = py - (py - y) * (nuevo / s); s = nuevo; limitar(); aplicar();
  }
  function encuadrar() {
    if (!w) return;
    s0 = s = Math.min(zona.clientWidth / w, (zona.clientHeight - ra - rb) / h); centrar(); aplicar();
  }
  const punto = e => { const r = zona.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const medio = () => { const p = [...dedos.values()]; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2, Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1])]; };

  zona.addEventListener("pointerdown", e => {
    if (!w || e.target.closest(".barra, .menu, .bienvenida, .asa")) return;
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
    } else { x += px - ax; y += py - ay; limitar(); aplicar(); }          // arrastrar con un dedo o el ratón: mover la foto
  });
  const soltar = e => {
    if (!dedos.delete(e.pointerId) || !inicio) return;
    const [px, py] = punto(e);
    if (inicio.n === 1 && inicio.mov < 8 && performance.now() - inicio.t < 350) {
      const doble = performance.now() - ultimoToque.t < 300 && Math.hypot(px - ultimoToque.x, py - ultimoToque.y) < 30;
      ultimoToque = { t: doble ? 0 : performance.now(), x: px, y: py };
      if (doble) { if (ajustada()) zoomEn(px, py, s0 * 2.5); else { s = s0; centrar(); aplicar(); } } else setTimeout(() => { if (ultimoToque.t) alTocar(); }, 300);
    }
    if (!dedos.size) inicio = null;
  };
  zona.addEventListener("pointerup", soltar);
  zona.addEventListener("pointercancel", soltar);
  zona.addEventListener("wheel", e => { if (!w) return; e.preventDefault(); const [px, py] = punto(e); zoomEn(px, py, s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015))); }, { passive: false });
  addEventListener("resize", encuadrar);

  return { reservar(arriba, abajo) { ra = arriba; rb = abajo; encuadrar(); }, ajustar(ancho, alto) { w = ancho; h = alto; encuadrar(); }, encuadrar, aLogico(e) { const [px, py] = punto(e); return [(px - x) / s, (py - y) / s]; } };
}
