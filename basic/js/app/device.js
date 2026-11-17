/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · DISPOSITIVO
   Decide si la interfaz usa las proporciones de móvil o de escritorio y lo anota en <html data-dispositivo>.
   Entradas: ninguna. Salidas: iniciarDispositivo() · esEscritorio().
   Límites: fija la página (sin desplazamiento ni zoom propios; sólo la foto y las filas se mueven) y mide el alto visible (--alto). Escritorio = pantalla ancha (≥ 900 px) con ratón; una tableta en vertical cuenta como móvil.
   ═══════════════════════════════════════════════════════════════ */
const consulta = matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");

export const esEscritorio = () => consulta.matches;

/* La página nunca se mueve ni se acerca: sólo la foto (gestos del visor) y las filas deslizantes. Safari de iOS ignora user-scalable=no,
   así que se cortan sus gestos de pellizco y el arrastre que desplazaría o estiraría toda la página. */
function fijarPagina() {
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, e => e.preventDefault(), { passive: false });
  document.addEventListener("touchmove", e => { if (e.touches.length > 1 || !e.target.closest?.(".fila-desliza")) e.preventDefault(); }, { passive: false });
  document.addEventListener("dblclick", e => { if (e.target.closest?.(".barra")) e.preventDefault(); });
}

/* Alto visible real de la app instalada (ver shell.css): se mide y se vuelve a medir al girar o cambiar de tamaño. El teclado no cuenta
   (innerHeight no encoge con él en iOS), así que la interfaz no salta al escribir. */
function medirAlto() {
  const poner = () => document.documentElement.style.setProperty("--alto", innerHeight + "px");
  poner();
  addEventListener("resize", poner); addEventListener("orientationchange", () => setTimeout(poner, 300)); addEventListener("pageshow", poner);
}

export function iniciarDispositivo() {
  fijarPagina();
  medirAlto();
  const poner = () => { document.documentElement.dataset.dispositivo = esEscritorio() ? "escritorio" : "movil"; };
  poner();
  consulta.addEventListener("change", poner);
}
