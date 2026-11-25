/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PINTADO
   Qué se ve y qué se guarda. Primero la geometría (voltear, girar, enderezar, perspectiva y recorte, en un solo remuestreo) y después
   los ajustes. En la pestaña Recortar se ve el marco entero (para colocar el recorte encima); en las demás, ya recortado.
   Vista: el original si la receta es neutra; si no, una reducción (≤ 1600 px, 1200 en móvil) con el mismo motor Premium, recalculando
   sólo las etapas que cambian y repintando como mucho una vez por fotograma. renderFinal() calcula la foto a resolución completa
   desde el original. Los motores de píxeles se cargan al primer ajuste (import dinámico).
   Entradas: iniciarRender() · vista() · geometria() · renderFinal() · medirAutoActual().
   Salidas: lienzos, la geometría vigente y, en app/store.js, `vistaV` y `dims`.
   Límites: el cálculo final va a un trabajador (engine/worker.js) y la página sigue viva (se avisa con `procesando`); si no hay trabajador, se calcula en el hilo principal.
   ═══════════════════════════════════════════════════════════════ */
import { calcularGeo } from "../engine/geometria.js";
import { esNeutra, esNeutraRecorte } from "../engine/neutra.js";
import { original, receta } from "./session.js";
import { leer, poner, suscribir } from "./store.js";
import { transformar } from "./transformar.js";

const LADO_VISTA = matchMedia("(max-width: 900px)").matches ? 1200 : 1600;
let motor = null, reducida = null, reducidaDe = null, base = null, claveBase = "", cadena = null, lienzoVista = null, pendiente = false, ultimoError = "";

const cargarMotor = () => (motor ||= import("../engine/pipeline.js"));
const nuevoLienzo = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const enRecorte = () => !!leer().foto && leer().pestana === "recortar";
const conPerspectiva = r => !!(r.persV || r.persH);

/** Geometría vigente de la foto abierta, en píxeles de la original (o null sin foto). */
export function geometria() { const o = original(); return o ? calcularGeo(receta().recorte, o.width, o.height) : null; }

function prepararReducida() {
  const o = original();
  if (reducidaDe === o) return reducida;
  const k = Math.min(1, LADO_VISTA / Math.max(o.width, o.height)), w = Math.max(1, Math.round(o.width * k)), h = Math.max(1, Math.round(o.height * k));
  reducida = nuevoLienzo(w, h); const x = reducida.getContext("2d");
  x.imageSmoothingQuality = "high"; x.drawImage(o, 0, 0, w, h);
  reducidaDe = o; claveBase = ""; return reducida;
}

/* Imagen de partida de los ajustes: la reducida ya con la geometría. Sólo se rehace si la geometría cambia (mover el recorte
   en la pestaña Recortar no la toca: el marco no cambia). */
function prepararBase() {
  const src = prepararReducida(), r = receta().recorte, o = original(), recortar = !enRecorte();
  const { rect, ...geom } = r, clave = JSON.stringify([geom, recortar ? rect : 0, recortar, o.width]);
  if (clave === claveBase && base) return base;
  const lienzo = esNeutraRecorte(r) ? src : transformar(src, geometria(), { recortar, anchoOriginal: o.width, perspectiva: conPerspectiva(r) });
  base = lienzo.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, lienzo.width, lienzo.height);
  claveBase = clave; cadena = null; lienzoVista = nuevoLienzo(base.width, base.height);
  return base;
}

export function vista() { return !original() ? null : esNeutra(receta()) && !enRecorte() ? original() : lienzoVista || original(); }

function tamano() {
  const o = original(), g = geometria();
  if (!o) return null;
  return esNeutraRecorte(receta().recorte) ? { w: o.width, h: o.height } : enRecorte() ? { w: g.frame.w, h: g.frame.h } : { w: g.salida.w, h: g.salida.h };
}

async function pintar() {
  pendiente = false;
  if (!original()) return;
  const dims = tamano();
  if (esNeutra(receta()) && !enRecorte()) { poner({ vistaV: leer().vistaV + 1, dims }); return; }
  let img = null;
  try {
    const { crearCadena, cargarEstilos } = await cargarMotor();
    if (receta().estilo.n >= 0) await cargarEstilos();
    img = prepararBase();
    cadena ||= crearCadena(img);
    if (lienzoVista.width !== img.width) { lienzoVista.width = img.width; lienzoVista.height = img.height; }
    lienzoVista.getContext("2d").putImageData(cadena.render(receta(), { rapido: true }), 0, 0);
    ultimoError = "";
  } catch (e) {
    /* Si el motor falla (p. ej. un módulo que no carga en este navegador) nunca se deja la pantalla en negro: se enseña la foto sin
       ajustar y el error queda en el pie del menú «···» para poder diagnosticarlo. Se vuelve a intentar en el siguiente cambio. */
    ultimoError = String(e?.stack || e).split("\n").slice(0, 3).join(" ⏎ ").slice(0, 300);
    console.error("Basic · motor:", e);
    motor = null; cadena = null;
    if (img && lienzoVista) { if (lienzoVista.width !== img.width) { lienzoVista.width = img.width; lienzoVista.height = img.height; } lienzoVista.getContext("2d").putImageData(img, 0, 0); }
  }
  poner({ vistaV: leer().vistaV + 1, dims });
}

/** Último error del motor de la vista previa ("" si todo va bien), para el pie del menú «···». */
export const errorMotor = () => ultimoError;

export function iniciarRender() {
  let visto = "";
  suscribir(e => { const k = e.version + "|" + e.pestana; if (k === visto) return; visto = k; if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } });
}

/* El cálculo pesado va a un trabajador (engine/worker.js) para no congelar la página; si no se puede crear o falla, se hace aquí. */
function enSegundoPlano(img, receta) {
  return new Promise(ok => {
    let w;
    try { w = new Worker(new URL("../engine/worker.js", import.meta.url), { type: "module" }); } catch { ok(null); return; }
    const fin = r => { w.terminate(); ok(r); };
    w.onmessage = e => fin(e.data.error ? null : e.data.img);
    w.onerror = () => fin(null);
    const copia = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
    w.postMessage({ img: copia, receta }, [copia.data.buffer]);
  });
}

export async function renderFinal() {
  const o = original(), r = receta();
  if (esNeutra(r)) return o;
  poner({ procesando: true });
  await new Promise(t => setTimeout(t, 40));                 // deja pintar el aviso antes de bloquear
  try {
    const { aplicarReceta, cargarEstilos } = await cargarMotor();
    if (r.estilo.n >= 0) await cargarEstilos();
    const lienzo = esNeutraRecorte(r.recorte) ? o : transformar(o, geometria(), { recortar: true, anchoOriginal: o.width, perspectiva: conPerspectiva(r.recorte) });
    const datos = lienzo.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, lienzo.width, lienzo.height);
    const img = await enSegundoPlano(datos, r) || aplicarReceta(datos, r, { rapido: false });
    const c = nuevoLienzo(lienzo.width, lienzo.height); c.getContext("2d").putImageData(img, 0, 0);
    return c;
  } finally { poner({ procesando: false }); }
}

export async function medirAutoActual() {
  const [{ medirAuto }] = await Promise.all([import("../engine/auto.js")]);
  return medirAuto(prepararBase());
}
