/* ═══════════════════════════════════════════════════════════════
   NÚCLEO · TRASPASO ENTRE REALIFY Y REALIFY BASIC
   Pasar una foto (ya con la edición aplicada) de una app a la otra, y abrir la otra app. Las dos viven en el mismo origen, así que
   comparten IndexedDB y BroadcastChannel; no hay servidor. La foto se deja en un almacén de un solo hueco y la app que la recibe la toma.
   Si la otra app ya está abierta se lo avisa por el canal y espera su confirmación; si no, abre una pestaña nueva con ?recibir=1.
   Entradas: traspasar(destino, { blob, nombre }) · abrirApp(destino) · tomarTraspaso() · escucharTraspaso(app, alRecibir).
   Salidas: "enviada" (la otra app ya abierta la importó) · "abierta" (se abrió una pestaña) · { blob, nombre, de } al tomar.
   Límites: la foto caduca a los 10 min. Cada app instalada en iOS tiene su propio almacenamiento: si no comparten, la foto no llega
   (quien recibe lo avisa) y queda la vía «Guardar copia» y abrirla desde Fotos.
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

/** Toma (y borra) la foto pendiente, o null si no hay o caducó. */
export async function tomarTraspaso() {
  const t = await operar("readwrite", s => { const g = s.get(CLAVE); s.delete(CLAVE); return g; });
  return t && Date.now() - t.t < CADUCA ? t : null;
}

/** Cada app llama a esto al arrancar: cuando la otra le deja una foto con la app ya abierta, se la pasa a alRecibir y confirma. */
export function escucharTraspaso(app, alRecibir) {
  const canal = new BroadcastChannel(BD);
  canal.onmessage = async e => {
    if (e.data?.t !== "foto" || e.data.para !== app) return;
    const t = await tomarTraspaso();
    if (t) { await alRecibir(t); canal.postMessage({ t: "ok", para: de(app) }); }
  };
  return () => canal.close();
}

/** ¿Hay una foto esperando por la query ?recibir (la otra app nos abrió en una pestaña nueva)? Limpia la dirección. */
export async function recibirAlArrancar() {
  const q = new URLSearchParams(location.search);
  if (!q.has("recibir")) return { pedida: false };
  q.delete("recibir"); history.replaceState(null, "", location.pathname + (q.size ? "?" + q : "") + location.hash);
  return { pedida: true, traspaso: await tomarTraspaso() };
}

const abrir = (destino, query = "") => { window.open(APPS[destino] + query, "realify-" + destino); };

/** Sólo cambiar de app (sin foto). */
export function abrirApp(destino) { abrir(destino); }

/** Deja la foto y abre la otra app (o se la entrega si ya estaba abierta). */
export async function traspasar(destino, { blob, nombre }) {
  await operar("readwrite", s => s.put({ blob, nombre, de: de(destino), t: Date.now() }, CLAVE));
  const canal = new BroadcastChannel(BD);
  const lista = await new Promise(ok => {
    const plazo = setTimeout(() => ok(false), 700);
    canal.onmessage = e => { if (e.data?.t === "ok" && e.data.para === de(destino)) { clearTimeout(plazo); ok(true); } };
    canal.postMessage({ t: "foto", para: destino });
  });
  canal.close();
  if (lista) return "enviada";
  abrir(destino, "?recibir=1");
  return "abierta";
}
