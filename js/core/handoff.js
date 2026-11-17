/* ═══════════════════════════════════════════════════════════════
   NÚCLEO · TRASPASO ENTRE REALIFY Y REALIFY BASIC
   Pasar una foto (ya con la edición aplicada) de una app a la otra, y abrir la otra app. Las dos viven en el mismo origen, así que
   comparten IndexedDB y BroadcastChannel (sin servidor). La foto se deja en un almacén de un solo hueco y la app que la recibe la toma.
   Si la otra app ya está abierta se lo avisa por el canal y espera su confirmación; si no, abre una ventana nueva con ?recibir=1.
   Entradas: reservarVentana(destino) (síncrona, dentro del toque) · traspasar(destino, { blob, nombre }, ventana) · abrirApp(destino) · tomarTraspaso(para) · escucharTraspaso(app, alRecibir) · recibirAlArrancar(app).
   Salidas: "enviada" (la otra app ya abierta la importó) · "abierta" (se abrió una ventana) · "manual" (iPhone con la app instalada: hay que abrir la otra desde su icono) · { blob, nombre, de, para } al tomar.
   Límites: la foto caduca a los 10 min. En el iPhone con las apps instaladas cada una tiene su propio almacenamiento: allí la foto
   viaja por el servidor (js/core/relevo.js) y esto sólo se usa para el resto (escritorio, Android, navegador).
   ═══════════════════════════════════════════════════════════════ */
const BD = "realify-traspaso", ALMACEN = "fotos", CLAVE = "ultima", CADUCA = 10 * 60e3;
export const APPS = { realify: new URL("../../", import.meta.url).href, basic: new URL("../../basic/", import.meta.url).href };

const abrirBD = () => new Promise((ok, mal) => {
  const r = indexedDB.open(BD, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
  r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
});
const operar = async (modo, f) => {
  const bd = await abrirBD();
  return new Promise((ok, mal) => { const t = bd.transaction(ALMACEN, modo), r = f(t.objectStore(ALMACEN)); t.oncomplete = () => { bd.close(); ok(r?.result); }; t.onerror = () => mal(t.error); });
};

const de = destino => (destino === "basic" ? "realify" : "basic");

/** Toma (y borra) la foto pendiente PARA esa app (`para` = "realify" | "basic"), o null si no hay, es de la otra o caducó. */
export async function tomarTraspaso(para) {
  const t = await operar("readwrite", s => { const g = s.get(CLAVE); g.onsuccess = () => { if (g.result && (g.result.para === para || Date.now() - g.result.t >= CADUCA)) s.delete(CLAVE); }; return g; });
  return t && t.para === para && Date.now() - t.t < CADUCA ? t : null;
}

/** Cada app llama a esto al arrancar: cuando la otra le deja una foto con la app ya abierta, se la pasa a alRecibir y confirma. */
export function escucharTraspaso(app, alRecibir) {
  const canal = new BroadcastChannel(BD);
  canal.onmessage = async e => {
    if (e.data?.t !== "foto" || e.data.para !== app) return;
    const t = await tomarTraspaso(app);
    if (t) { await alRecibir(t); canal.postMessage({ t: "ok", para: de(app) }); }
  };
  /* iOS: cada app instalada es otra ventana que se queda dormida; al volver a primer plano mira si le dejaron una foto. */
  const mirar = async () => { if (document.visibilityState === "visible") { const t = await tomarTraspaso(app); if (t) await alRecibir(t); } };
  document.addEventListener("visibilitychange", mirar);
  return () => { canal.close(); document.removeEventListener("visibilitychange", mirar); };
}

/** Al arrancar: ¿hay una foto esperando para esta app? `pedida` = la otra app nos abrió con ?recibir (la dirección se limpia). */
export async function recibirAlArrancar(app) {
  const q = new URLSearchParams(location.search), pedida = q.has("recibir");
  if (pedida) { q.delete("recibir"); history.replaceState(null, "", location.pathname + (q.size ? "?" + q : "") + location.hash); }
  return { pedida, traspaso: await tomarTraspaso(app) };
}

/* iOS (y los bloqueadores de ventanas) sólo dejan abrir una ventana dentro del propio toque: por eso la ventana se RESERVA al instante,
   antes de calcular nada (reservarVentana, síncrona), y luego se le pone la dirección. Si ya había una ventana con ese nombre, se reutiliza.
   Para que el cambio sea suave, la ventana reservada nace ya del color de fondo de la app de destino (nunca blanca) y la app que llega
   aparece con un fundido; si hay que navegar en la misma ventana, la actual se desvanece antes. */
const FONDO = { basic: "#000", realify: "#1b1d20" };

/* iPhone con la app instalada: no se navega nunca la ventana de la app hacia la otra (el icono de Realify acabaría abriendo Basic al
   volver, porque iOS reanuda la última página). Se deja la foto y se avisa para que la persona abra la otra app desde su icono. */
const iosInstalada = () => navigator.standalone === true;

export function reservarVentana(destino) {
  if (iosInstalada()) return null;
  let w = null;
  try { w = window.open("", "realify-" + destino); } catch { return null; }
  try {
    if (w && w.location.href === "about:blank") { w.__reservada = true; w.document.write(`<!doctype html><meta name="color-scheme" content="dark"><meta name="theme-color" content="${FONDO[destino]}"><title>Realify</title><body style="margin:0;background:${FONDO[destino]}">`); w.document.close(); }
  } catch { /* sin acceso: se queda como está */ }
  return w;
}
/* «Blanca» = la ventana que acabamos de reservar (document.write cambia su dirección, así que se marca con una propiedad). */
const esBlanca = w => { try { return w.__reservada === true || w.location.href === "about:blank"; } catch { return false; } };
const mismaVentana = (destino, url) => {
  document.documentElement.classList.add("saliendo");
  setTimeout(() => { location.href = url; }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200);
};
const llevar = (w, destino, query = "") => {
  if (iosInstalada()) return "manual";
  const url = APPS[destino] + query;
  if (!w) mismaVentana(destino, url); else if (esBlanca(w)) w.location.replace(url);
  return "abierta";
};

/** Sólo cambiar de app (sin foto). `ventana` = la reservada en el toque. */
export function abrirApp(destino, ventana = reservarVentana(destino)) { return llevar(ventana, destino); }

/** Deja la foto y abre la otra app (o se la entrega si ya estaba abierta). `ventana` = reservarVentana(destino), pedida en el toque. */
export async function traspasar(destino, { blob, nombre }, ventana) {
  await operar("readwrite", s => s.put({ blob, nombre, de: de(destino), para: destino, t: Date.now() }, CLAVE));
  const canal = new BroadcastChannel(BD);
  const lista = await new Promise(ok => {
    const plazo = setTimeout(() => ok(false), 700);
    canal.onmessage = e => { if (e.data?.t === "ok" && e.data.para === de(destino)) { clearTimeout(plazo); ok(true); } };
    canal.postMessage({ t: "foto", para: destino });
  });
  canal.close();
  if (lista) { if (ventana && esBlanca(ventana)) ventana.close(); return "enviada"; }
  return llevar(ventana, destino, "?recibir=1");
}
