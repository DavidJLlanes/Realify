/* ═══════════════════════════════════════════════════════════════
   NÚCLEO · RELEVO DE FOTOS POR EL SERVIDOR (iPhone con las apps instaladas)
   En el iPhone cada app web instalada tiene su propio almacenamiento, así que Realify y Realify Basic no pueden dejarse la foto en el
   móvil. Las dos se emparejan UNA vez (una clave aleatoria que viaja bajo un código de 6 cifras que la persona escribe) y desde
   entonces la foto va cifrada (AES-GCM, en el dispositivo) al buzón de la otra app en realify.es, que la recoge sola al abrirse.
   Entradas: usaRelevo() · enviarRelevo(app, destino, { blob, nombre }, { alProgreso }) · escucharRelevo(app, { pedirCodigo, alRecibir }).
   Salidas: enviarRelevo → { codigo } si aún falta emparejar (enseñarlo) o {} si ya está · alRecibir({ blob, nombre }).
   Límites: servidor en server/traspaso/ (en memoria; la foto se borra al entregarla o a los 15 min). Sin interfaz: cada app pone la
   suya para enseñar y pedir el código. El emparejamiento vive en el localStorage de cada app.
   ═══════════════════════════════════════════════════════════════ */
const API = location.origin + "/api/traspaso/";      // las dos apps viven en la raíz del mismo dominio
const GUARDA = "realify-relevo:", CODIGO_VIVE = 25 * 60e3;

/** ¿Hace falta el relevo? Sólo con la app instalada en el iPhone (en el resto las dos apps comparten almacenamiento). */
export const usaRelevo = () => navigator.standalone === true;

const b64 = u8 => btoa(String.fromCharCode(...u8));
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

const leerPar = app => { try { return JSON.parse(localStorage.getItem(GUARDA + app)) || null; } catch { return null; } };
const guardarPar = (app, par) => { try { par ? localStorage.setItem(GUARDA + app, JSON.stringify(par)) : localStorage.removeItem(GUARDA + app); } catch { /* sin almacén */ } };

/* La clave de 48 bytes: 32 de AES y 16 que identifican la pareja (de ahí salen los buzones). */
const claveAES = par => crypto.subtle.importKey("raw", deB64(par.clave).slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
const buzon = async (par, para) => hex(await crypto.subtle.digest("SHA-256", new Uint8Array([...deB64(par.clave).slice(32), ...new TextEncoder().encode(":" + para)]))).slice(0, 32);

async function cifrar(par, { blob, nombre }) {
  const cab = new TextEncoder().encode(JSON.stringify({ nombre: nombre || "foto", tipo: blob.type || "image/png" }));
  const claro = new Uint8Array(3 + cab.length + blob.size);
  claro.set([1, cab.length >> 8, cab.length & 255]); claro.set(cab, 3); claro.set(new Uint8Array(await blob.arrayBuffer()), 3 + cab.length);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return new Blob([iv, await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await claveAES(par), claro)]);
}
async function descifrar(par, buf) {
  const u8 = new Uint8Array(buf);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8.slice(0, 12) }, await claveAES(par), u8.slice(12)));
  const n = (claro[1] << 8) | claro[2], cab = JSON.parse(new TextDecoder().decode(claro.slice(3, 3 + n)));
  return { blob: new Blob([claro.slice(3 + n)], { type: cab.tipo }), nombre: cab.nombre };
}

const pedir = (ruta, op = {}) => fetch(API + ruta, { cache: "no-store", ...op });
const enviarJSON = (ruta, datos) => pedir(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });

/* Subida con progreso (fetch no lo da): la app que envía no debe pedir que se cambie de app hasta que termine, porque iOS la duerme. */
const subir = (ruta, cuerpo, alProgreso) => new Promise((ok, mal) => {
  const x = new XMLHttpRequest();
  x.open("PUT", API + ruta);
  x.upload.onprogress = e => e.lengthComputable && alProgreso?.(e.loaded / e.total);
  x.onload = () => (x.status < 300 ? ok() : mal(new Error(x.status === 413 ? "La foto es demasiado grande para pasarla" : "El servidor no aceptó la foto (" + x.status + ")")));
  x.onerror = () => mal(new Error("Sin conexión con realify.es"));
  x.send(cuerpo);
});

/** ¿Sigue esperando el código que enseñó esta app? Si la otra ya lo canjeó, la pareja queda confirmada. */
async function revisarPendiente(app, par) {
  if (!par?.codigo) return par;
  const r = await pedir("par/" + par.codigo).catch(() => null);
  const d = r?.ok ? await r.json() : null;
  if (d?.canjeado) { const listo = { clave: par.clave }; guardarPar(app, listo); return listo; }
  if (r?.status === 404 || Date.now() - par.t > CODIGO_VIVE) return { clave: par.clave, codigo: null, t: par.t };   // caducó: hará falta otro
  return par;
}

/** Envía la foto cifrada al buzón de `destino`. Si las apps aún no están emparejadas, devuelve el código que hay que enseñar. */
export async function enviarRelevo(app, destino, foto, { alProgreso } = {}) {
  let par = await revisarPendiente(app, leerPar(app));
  if (!par) { par = { clave: b64(crypto.getRandomValues(new Uint8Array(48))), codigo: null, t: Date.now() }; guardarPar(app, par); }
  await subir("buzon/" + await buzon(par, destino), await cifrar(par, foto), alProgreso);
  if (!("codigo" in par)) return {};                              // ya emparejadas
  if (!par.codigo) {
    const r = await enviarJSON("par", { clave: par.clave, de: app, para: destino });
    if (!r.ok) throw new Error(r.status === 429 ? "Demasiados intentos: prueba dentro de un rato" : "No se pudo preparar el emparejamiento");
    par = { clave: par.clave, codigo: (await r.json()).codigo, t: Date.now() }; guardarPar(app, par);
  }
  return { codigo: par.codigo };
}

/* La otra app nos está esperando: se pide el código (hasta 3 intentos) y, si vale, esta app guarda la clave. */
let descartado = 0;
async function emparejarSiEsperan(app, pedirCodigo) {
  if (Date.now() - descartado < 2 * 60e3) return false;
  const r = await pedir("par?para=" + app).catch(() => null);
  if (r?.status !== 200) return false;
  const { de } = await r.json();
  for (let i = 0, error = ""; i < 3; i++) {
    const codigo = (await pedirCodigo(de, error))?.replace(/\D/g, "");
    if (!codigo) { descartado = Date.now(); return false; }
    const c = await enviarJSON("par/canjear", { codigo, para: app }).catch(() => null);
    if (c?.ok) { guardarPar(app, { clave: (await c.json()).clave }); return true; }
    error = c?.status === 429 ? "Demasiados intentos. Prueba dentro de un rato." : "Ese código no vale. Revísalo en la otra app.";
    if (c?.status === 429) { descartado = Date.now(); return false; }
  }
  descartado = Date.now();
  return false;
}

/** Mira el buzón de esta app (y si la otra espera emparejarse, pide el código). Devuelve la foto o null. */
async function mirar(app, pedirCodigo) {
  await emparejarSiEsperan(app, pedirCodigo);
  const par = await revisarPendiente(app, leerPar(app));
  if (!par) return null;
  const r = await pedir("buzon/" + await buzon(par, app)).catch(() => null);
  if (r?.status !== 200) return null;
  const foto = await descifrar(par, await r.arrayBuffer()).catch(() => null);   // clave de una pareja anterior: se descarta
  if (foto && "codigo" in par) guardarPar(app, { clave: par.clave });          // la otra app ya tiene la clave: pareja confirmada
  return foto;
}

/** Cada app lo llama al arrancar (sólo hace algo con usaRelevo()): mira al abrirse, al volver a primer plano y un rato después. */
export function escucharRelevo(app, { pedirCodigo, alRecibir }) {
  if (!usaRelevo()) return () => {};
  let ocupado = false, hasta = 0, reloj = 0;
  const una = async () => {
    if (ocupado || document.visibilityState !== "visible") return;
    ocupado = true;
    try { const foto = await mirar(app, pedirCodigo); if (foto) await alRecibir(foto); } catch { /* sin red: ya mirará otra vez */ } finally { ocupado = false; }
  };
  const ciclo = () => { clearTimeout(reloj); una(); if (Date.now() < hasta) reloj = setTimeout(ciclo, 3000); };
  const despertar = () => { if (document.visibilityState === "visible") { hasta = Date.now() + 30e3; ciclo(); } };
  document.addEventListener("visibilitychange", despertar);
  addEventListener("pageshow", despertar); addEventListener("online", despertar);
  despertar();
  return () => { clearTimeout(reloj); document.removeEventListener("visibilitychange", despertar); removeEventListener("pageshow", despertar); removeEventListener("online", despertar); };
}
