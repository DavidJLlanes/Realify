/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · TRASPASO A REALIFY
   Envía la foto editada (resultado final a resolución completa) a Realify y la abre allí, o sólo cambia de app. También recibe la foto
   que Realify le manda con «Abrir en Realify Basic», tanto si Basic se abrió para ello como si ya estaba abierta.
   En el iPhone con las apps instaladas (cada una con su almacenamiento) la foto viaja cifrada por realify.es y llega sola; la primera
   vez se emparejan las dos apps con un código de 6 cifras.
   Entradas: iniciarTraspaso(avisar) · enviarARealify(avisar) · irARealify(avisar) · emparejar(avisar) (a mano, desde el menú). Salidas: la foto recibida queda en app/session.js.
   Límites: la mecánica es js/core/handoff.js (mismo almacenamiento) y js/core/relevo.js (servidor); aquí sólo sesión y avisos.
   ═══════════════════════════════════════════════════════════════ */
import { abrirArchivo } from "./files.js";
import { renderFinal } from "./render.js";
import { leer } from "./store.js";
import { elegirEmparejar, ensenarCodigo, pedirCodigo } from "../ui/codigo.js";

import { abrirApp, escucharTraspaso, recibirAlArrancar, reservarVentana, traspasar } from "../../../js/core/handoff.js";
import { canjearCodigo, crearCodigo, enviarRelevo, escucharRelevo, usaRelevo } from "../../../js/core/relevo.js";

const OTRA = { realify: "Realify" };
const extension = t => (t?.blob?.type === "image/jpeg" ? ".jpg" : ".png");
const abrirRecibida = async t => { await abrirArchivo(new File([t.blob], `${t.nombre || "foto"}${extension(t)}`, { type: t.blob.type || "image/png" })); };

export async function iniciarTraspaso(avisar) {
  const recibida = async t => { await abrirRecibida(t); avisar("Foto recibida de Realify"); };
  escucharTraspaso("basic", recibida);
  escucharRelevo("basic", { pedirCodigo: de => pedirCodigo(OTRA[de] || "Realify"), alRecibir: recibida });
  const r = await recibirAlArrancar("basic");
  if (r.traspaso) await recibida(r.traspaso);
  else if (r.pedida) avisar("No llegó la foto. Guarda una copia en Realify y ábrela aquí.");
}

const aBlob = (lienzo, tipo, q) => new Promise(r => lienzo.toBlob(r, tipo, q));
const aPNG = async () => aBlob(await renderFinal(), "image/png");

/* Por el servidor: PNG sin pérdida si cabe en 15 MB; si no, JPEG al 95 % (viaja ida y vuelta por la red del móvil). */
async function porRelevo(info, avisar) {
  avisar("Preparando la foto…", { fijo: true });
  const lienzo = await renderFinal();
  let blob = await aBlob(lienzo, "image/png");
  if (blob.size > 15 * 1024 * 1024) blob = await aBlob(lienzo, "image/jpeg", 0.95);
  try {
    const r = await enviarRelevo("basic", "realify", { blob, nombre: info.nombre }, { alProgreso: p => avisar(`Enviando la foto… ${Math.round(p * 100)} %`, { fijo: true }) });
    if (r.codigo) { avisar("Foto lista"); ensenarCodigo(r.codigo, "Realify"); }
    else avisar("Foto enviada: abre Realify desde su icono");
  } catch (e) { avisar(e.message || "No se pudo enviar la foto"); }
}

export async function enviarARealify(avisar) {
  const info = leer().foto;
  if (info && usaRelevo()) return porRelevo(info, avisar);
  const ventana = reservarVentana("realify");      // dentro del toque: iOS no deja abrir ventanas después
  if (!info) { ventana?.close(); return; }
  const blob = await aPNG();
  const r = await traspasar("realify", { blob, nombre: info.nombre }, ventana);
  if (r === "enviada") avisar("Foto enviada: cambia a la ventana de Realify");
}

export const irARealify = avisar => { if (abrirApp("realify") === "manual") avisar("Abre Realify desde su icono de inicio"); };

/** Emparejar a mano (menú «···», iPhone instalado): enseñar un código nuevo o escribir el que enseña Realify. */
export async function emparejar(avisar) {
  const modo = await elegirEmparejar("Realify");
  try {
    if (modo === "ensenar") ensenarCodigo(await crearCodigo("basic", "realify"), "Realify");
    else if (modo === "escribir") {
      for (let i = 0, error = ""; i < 3; i++) {
        const texto = await pedirCodigo("Realify", error, { titulo: "Emparejar con Realify" });
        if (!texto) return;
        const r = await canjearCodigo("basic", texto);
        if (r === "ok") { avisar("Emparejada con Realify"); return; }
        if (r === "limite") { avisar("Demasiados intentos: prueba dentro de un rato"); return; }
        error = "Ese código no vale. Revísalo en Realify.";
      }
    }
  } catch (e) { avisar(e.message || "No se pudo emparejar"); }
}
