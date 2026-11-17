/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ALTO VISIBLE (app instalada en el iPhone)
   La app ocupa SIEMPRE toda la pantalla y las herramientas nunca quedan tapadas ni cortadas. En el iPhone con la app instalada iOS
   tiene un fallo: la primera vez que sale el teclado (p. ej. al escribir el código de emparejar) encoge la zona de la página y no la
   devuelve hasta cerrar la app (queda una franja negra abajo o las barras se cortan). Aquí se detecta, se «cura» forzando que iOS
   vuelva a medir (ocultar y mostrar la página en el mismo fotograma) y, si aun así sigue encogida, se usa el último alto bueno
   (guardado entre sesiones) o el de la pantalla.
   Lo normal (página bajo la barra de estado, en vertical) es usar la pantalla entera: screen.height, sin fiarse de innerHeight.
   Entradas: vigilarAlto(). Salidas: textoAlto() (diagnóstico) · la variable CSS --alto en <html> (shell.css) y un evento resize cuando cambia (el visor reencuadra).
   Límites: sólo actúa con navigator.standalone (iPhone/iPad instalado); en el resto la página usa su alto natural (100 %).
   ═══════════════════════════════════════════════════════════════ */
const GUARDA = "realify-basic-alto:", HOLGURA = 80;     // la barra de estado más alta mide 62 px: menos que esto es «encogida»

const vertical = () => (screen.orientation?.type ? screen.orientation.type.startsWith("portrait") : innerHeight >= innerWidth);
/* iOS no gira screen.width/height: en vertical la pantalla mide screen.height de alto y en horizontal screen.width. */
const pantalla = () => (vertical() ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height));
const clave = () => GUARDA + (vertical() ? "v" : "h") + Math.round(pantalla());
const leer = () => { try { return +localStorage.getItem(clave()) || 0; } catch { return 0; } };
const guardar = v => { try { localStorage.setItem(clave(), String(v)); } catch { /* sin almacén */ } };
const sano = h => h >= pantalla() - HOLGURA;

/* Ocultar y volver a mostrar el cuerpo en el mismo fotograma obliga a iOS a medir otra vez el alto de la página. */
function curar() {
  const b = document.body; if (!b) return;
  b.style.display = "none"; void b.offsetHeight; b.style.display = "";
  scrollTo(0, 0);
}

/* ¿La página empieza bajo la barra de estado (black-translucent)? Entonces ocupa la pantalla entera. */
function bajoBarra() {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)";
  document.documentElement.append(m); const si = m.offsetHeight > 0; m.remove();
  return si;
}

let actual = "";
/** Para el diagnóstico del menú «···»: cómo se decidió el alto. */
export const diag = { modo: "natural" };
export const textoAlto = () => `${Math.round(screen.width)}×${Math.round(screen.height)} · alto ${actual || "100 %"} (${diag.modo}) · innerHeight ${innerHeight}`;
function poner(px) {
  const v = Math.round(px) + "px";
  if (v === actual) return;
  actual = v; document.documentElement.style.setProperty("--alto", v);
  dispatchEvent(new Event("resize"));                   // gestos.js reencuadra la foto con el alto nuevo
}

const escribiendo = () => document.activeElement?.matches?.("input, textarea, [contenteditable]");

function medir() {
  if (escribiendo()) return;                            // con el teclado abierto no se toca nada (ocultar el cuerpo lo cerraría)
  /* Lo normal en Realify Basic: la página se dibuja bajo la barra de estado, así que ocupa la pantalla ENTERA, diga lo que diga
     innerHeight (iOS 26 la da más corta: le resta la barra de estado o el teclado y deja una franja negra abajo). */
  if (vertical() && bajoBarra()) { diag.modo = "pantalla"; return poner(pantalla()); }
  let h = innerHeight;
  if (!sano(h)) { curar(); h = innerHeight; }
  diag.modo = sano(h) ? "medido" : "guardado";
  if (sano(h)) { guardar(h); return poner(h); }
  // Sigue encogida: el último alto bueno de esta pantalla; si no lo hay y la página se dibuja bajo la barra de estado (lo normal en
  // Realify Basic), la pantalla entera; si no, lo medido (más vale una franja que unas herramientas cortadas).
  poner(leer() || (bajoBarra() ? pantalla() : h));
}

export function vigilarAlto() {
  if (navigator.standalone !== true) return;
  let reloj = 0;
  const luego = (ms = 0) => { clearTimeout(reloj); reloj = setTimeout(medir, ms); };
  medir();
  addEventListener("resize", () => luego(60));
  addEventListener("orientationchange", () => luego(350));
  addEventListener("pageshow", () => luego());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") luego(120); });
  document.addEventListener("focusout", e => { if (e.target.matches?.("input, textarea, [contenteditable]")) { luego(160); setTimeout(medir, 600); } });
  visualViewport?.addEventListener("resize", () => luego(160));
}
