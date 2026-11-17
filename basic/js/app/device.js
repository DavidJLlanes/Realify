/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · DISPOSITIVO
   Decide si la interfaz usa las proporciones de móvil o de escritorio y lo anota en <html data-dispositivo>.
   Entradas: ninguna. Salidas: iniciarDispositivo() · esEscritorio().
   Límites: en iOS con la app instalada estira el escenario a la pantalla completa. Escritorio = pantalla ancha (≥ 900 px) con ratón; una tableta en vertical cuenta como móvil.
   ═══════════════════════════════════════════════════════════════ */
const consulta = matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");

export const esEscritorio = () => consulta.matches;

/* iOS, app instalada: a veces el área de la página (innerHeight) es más baja que la pantalla y queda un hueco negro debajo de las barras.
   Se estira el escenario hasta el alto real de la pantalla (en vertical; en horizontal screen.height ya no es el alto). */
const instalada = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
function llenarPantalla() {
  const e = document.getElementById("stage");
  if (!e) return;
  const alto = instalada() && innerHeight > innerWidth && screen.height > innerHeight ? screen.height : 0;
  e.style.height = alto ? alto + "px" : "";
}

export function iniciarDispositivo() {
  const poner = () => { document.documentElement.dataset.dispositivo = esEscritorio() ? "escritorio" : "movil"; llenarPantalla(); };
  poner();
  consulta.addEventListener("change", poner);
  addEventListener("resize", llenarPantalla); addEventListener("orientationchange", () => setTimeout(llenarPantalla, 300));
}
