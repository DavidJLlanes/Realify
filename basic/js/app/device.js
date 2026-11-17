/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · DISPOSITIVO
   Decide si la interfaz usa las proporciones de móvil o de escritorio y lo anota en <html data-dispositivo>.
   Entradas: ninguna. Salidas: iniciarDispositivo() · esEscritorio().
   Límites: escritorio = pantalla ancha (≥ 900 px) con ratón; una tableta en vertical cuenta como móvil.
   ═══════════════════════════════════════════════════════════════ */
const consulta = matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");

export const esEscritorio = () => consulta.matches;

export function iniciarDispositivo() {
  const poner = () => { document.documentElement.dataset.dispositivo = esEscritorio() ? "escritorio" : "movil"; };
  poner();
  consulta.addEventListener("change", poner);
}
