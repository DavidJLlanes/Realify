/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PINTADO
   Qué se ve: el original si la receta es neutra; si no, una vista previa de ≤ 1600 px (1200 en móvil) calculada con el mismo motor
   Premium (con la tabla rápida de color), recalculando sólo las etapas que cambian, y repintada como mucho una vez por fotograma. renderFinal() calcula la foto a resolución completa
   desde el original para guardar. Los motores de píxeles se cargan al primer ajuste (import dinámico).
   Entradas: iniciarRender() · vista() · renderFinal() · medirAutoActual(). Salidas: lienzos y el estado `vistaV` de app/store.js.
   Límites: el cálculo final bloquea la página unos segundos en fotos grandes (se avisa con `procesando`).
   ═══════════════════════════════════════════════════════════════ */
import { esNeutra } from "../engine/neutra.js";
import { original, receta } from "./session.js";
import { leer, poner, suscribir } from "./store.js";

const LADO_VISTA = matchMedia("(max-width: 900px)").matches ? 1200 : 1600;
let motor = null, proxy = null, proxyDe = null, cadena = null, lienzoVista = null, pendiente = false;

const cargarMotor = () => (motor ||= import("../engine/pipeline.js"));
const nuevoLienzo = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

function prepararProxy() {
  const o = original();
  if (proxyDe === o) return proxy;
  const k = Math.min(1, LADO_VISTA / Math.max(o.width, o.height)), w = Math.max(1, Math.round(o.width * k)), h = Math.max(1, Math.round(o.height * k));
  const c = nuevoLienzo(w, h), x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(o, 0, 0, w, h);
  proxyDe = o; proxy = x.getImageData(0, 0, w, h); lienzoVista = nuevoLienzo(w, h); cadena = null;
  return proxy;
}

export function vista() { return !original() ? null : esNeutra(receta()) ? original() : lienzoVista || original(); }

async function pintar() {
  pendiente = false;
  if (!original() || esNeutra(receta())) { poner({ vistaV: leer().vistaV + 1 }); return; }
  const { crearCadena } = await cargarMotor(), base = prepararProxy();
  cadena ||= crearCadena(base);
  lienzoVista.getContext("2d").putImageData(cadena.render(receta(), { rapido: true }), 0, 0);
  poner({ vistaV: leer().vistaV + 1 });
}

export function iniciarRender() {
  let visto = -1;
  suscribir(e => { if (e.version === visto) return; visto = e.version; if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } });
}

export async function renderFinal() {
  const o = original();
  if (esNeutra(receta())) return o;
  poner({ procesando: true });
  await new Promise(r => setTimeout(r, 40));                 // deja pintar el aviso antes de bloquear
  try {
    const { aplicarReceta } = await cargarMotor(), x = o.getContext("2d", { willReadFrequently: true });
    const img = aplicarReceta(x.getImageData(0, 0, o.width, o.height), receta(), { rapido: false });
    const c = nuevoLienzo(o.width, o.height); c.getContext("2d").putImageData(img, 0, 0);
    return c;
  } finally { poner({ procesando: false }); }
}

export async function medirAutoActual() {
  const [{ medirAuto }] = await Promise.all([import("../engine/auto.js")]);
  return medirAuto(prepararProxy());
}
