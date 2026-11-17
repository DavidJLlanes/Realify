/* ═══════════════════════════════════════════════════════════════
   E/S · TRASPASO DESDE REALIFY BASIC
   Recibe la foto que Realify Basic deja con «Abrir en Realify» y la abre como un documento nuevo, tanto si Realify se abrió para ello
   (?recibir=1) como si ya estaba abierto (aviso por BroadcastChannel). También envía el documento actual a Basic.
   Entradas: initHandoff() (al arrancar) · sendToBasic() · openBasic(). Salidas: abre el documento / la otra app.
   Límites: el envío es el documento aplanado a su tamaño completo, en PNG (sin pérdida).
   ═══════════════════════════════════════════════════════════════ */
import { escucharTraspaso, recibirAlArrancar, traspasar, abrirApp } from "../core/handoff.js";
import { doc } from "../core/doc.js";
import { toast } from "../core/toast.js";
import { openFile } from "./open.js";

const AVISO = "Abre Realify Basic desde su icono de inicio";
const abrirRecibida = t => openFile(new File([t.blob], `${t.nombre || "foto"}.png`, { type: "image/png" })).then(() => toast("Foto recibida de Realify Basic", "ok"));

export async function initHandoff() {
  escucharTraspaso("realify", abrirRecibida);
  const r = await recibirAlArrancar("realify");
  if (r.traspaso) abrirRecibida(r.traspaso);
  else if (r.pedida) toast("No llegó la foto. Guarda una copia en Basic y ábrela aquí.", "err");
}

export async function sendToBasic(ventana) {
  if (!doc.open) { toast("No hay documento abierto"); ventana?.close?.(); return; }
  const { renderExport } = await import("./export/export.js?v=82");
  const blob = await renderExport({ w: doc.w, h: doc.h, type: "image/png" });
  const r = await traspasar("basic", { blob, nombre: doc.name || "realify" }, ventana);
  if (r === "enviada") toast("Foto enviada a Realify Basic: cambia a esa ventana", "ok");
  else if (r === "manual") toast("Foto lista. " + AVISO + " para recibirla", "ok");
}

export const openBasic = ventana => { if (abrirApp("basic", ventana) === "manual") toast(AVISO); };
