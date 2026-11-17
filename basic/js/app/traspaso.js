/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · TRASPASO A REALIFY
   Envía la foto editada (resultado final a resolución completa, PNG sin pérdida) a Realify y la abre allí, o sólo cambia de app. También
   recibe la foto que Realify le manda con «Abrir en Realify Basic», tanto si Basic se abrió para ello como si ya estaba abierta.
   Entradas: iniciarTraspaso(avisar) · enviarARealify(avisar) · irARealify(). Salidas: la foto recibida queda en app/session.js.
   Límites: la mecánica (almacén compartido y canal) es js/core/handoff.js; aquí sólo se conecta con la sesión y los avisos.
   ═══════════════════════════════════════════════════════════════ */
import { abrirArchivo } from "./files.js";
import { renderFinal } from "./render.js";
import { leer } from "./store.js";

import { abrirApp, copiarFoto, dejarFoto, escucharTraspaso, recibirAlArrancar, reservarVentana, traspasar, usaPortapapeles } from "../../../js/core/handoff.js";
const abrirRecibida = async t => { await abrirArchivo(new File([t.blob], `${t.nombre || "foto"}.png`, { type: "image/png" })); };

export async function iniciarTraspaso(avisar) {
  escucharTraspaso("basic", async t => { await abrirRecibida(t); avisar("Foto recibida de Realify"); });
  const r = await recibirAlArrancar("basic");
  if (r.traspaso) { await abrirRecibida(r.traspaso); avisar("Foto recibida de Realify"); }
  else if (r.pedida) avisar("No llegó la foto. Guarda una copia en Realify y ábrela aquí.");
}

const aPNG = async () => { const l = await renderFinal(); return new Promise(r => l.toBlob(r, "image/png")); };

/* iPhone con las apps instaladas: sin ventanas nuevas. La foto se copia al portapapeles (dentro del toque) y se deja en el almacén; en
   Realify se recibe sola si comparten almacenamiento, y si no, con «Pegar imagen». */
async function porPortapapeles(info, avisar) {
  const blob = aPNG(), copiada = copiarFoto(blob);
  await dejarFoto("realify", { blob: await blob, nombre: info.nombre });
  avisar(await copiada ? "Foto copiada. Abre Realify desde su icono: si no aparece sola, pulsa «Pegar imagen»" : "No se pudo copiar. Guarda una copia y ábrela en Realify");
}

export async function enviarARealify(avisar) {
  const info = leer().foto;
  if (info && usaPortapapeles()) return porPortapapeles(info, avisar);
  const ventana = reservarVentana("realify");      // dentro del toque: iOS no deja abrir ventanas después
  if (!info) { ventana?.close(); return; }
  const blob = await aPNG();
  const r = await traspasar("realify", { blob, nombre: info.nombre }, ventana);
  if (r === "enviada") avisar("Foto enviada: cambia a la ventana de Realify");
}

export const irARealify = avisar => { if (abrirApp("realify") === "manual") avisar("Abre Realify desde su icono de inicio"); };
