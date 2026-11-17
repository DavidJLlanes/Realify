/* ═══════════════════════════════════════════════════════════════
   E/S · TRASPASO DESDE REALIFY BASIC
   Recibe la foto que Realify Basic deja con «Abrir en Realify» y la abre como un documento nuevo, tanto si Realify se abrió para ello
   (?recibir=1) como si ya estaba abierto (aviso por BroadcastChannel). También envía el documento actual a Basic.
   En el iPhone con las apps instaladas (cada una con su almacenamiento) la foto viaja cifrada por realify.es y llega sola; la primera
   vez se emparejan las dos apps con un código de 6 cifras.
   Entradas: initHandoff() (al arrancar) · sendToBasic(ventana) · openBasic(ventana) · pairBasic() (emparejar a mano, menú). Salidas: abre el documento / la otra app.
   Límites: el envío es el documento aplanado a su tamaño completo, en PNG (sin pérdida; por el servidor, JPEG 95 % si pasa de 15 MB).
   ═══════════════════════════════════════════════════════════════ */
import { abrirApp, escucharTraspaso, recibirAlArrancar, traspasar } from "../core/handoff.js";
import { canjearCodigo, crearCodigo, enviarRelevo, escucharRelevo, usaRelevo } from "../core/relevo.js";
import { doc } from "../core/doc.js";
import { toast, progress } from "../core/toast.js";
import { dialog } from "../ui/kit/dialog.js";
import { openFile } from "./open.js";

const AVISO = "Abre Realify Basic desde su icono de inicio";
const abrirRecibida = t => openFile(new File([t.blob], `${t.nombre || "foto"}${t.blob.type === "image/jpeg" ? ".jpg" : ".png"}`, { type: t.blob.type || "image/png" }))
  .then(() => toast("Foto recibida de Realify Basic", "ok"));

/* Diálogos del emparejamiento (sólo iPhone con las apps instaladas, una vez). */
const codigoGrande = c => `<p style="margin:0 0 12px">Abre Realify Basic desde su icono y escribe este código. Solo hace falta una vez: después las fotos pasan solas.</p>
  <div style="font-size:38px;font-weight:800;letter-spacing:.08em;text-align:center;font-variant-numeric:tabular-nums">${c.slice(0, 3)} ${c.slice(3)}</div>`;
const ensenarCodigo = c => dialog({ title: "Emparejar con Realify Basic", body: codigoGrande(c), buttons: [{ label: "Entendido", primary: true, value: true }] });

function pedirCodigo(_de, error, titulo = "Realify Basic quiere pasarte una foto") {
  const caja = document.createElement("div");
  caja.innerHTML = `<p class="hint" style="margin:0 0 10px">Escribe el código que ves en Realify Basic. Solo hace falta una vez.</p>
    ${error ? `<p style="margin:0 0 10px;color:var(--warn,#f5c542)">${error}</p>` : ""}
    <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000 000" aria-label="Código"
      style="width:100%;font-size:28px;font-weight:700;letter-spacing:.12em;text-align:center">`;
  const campo = caja.querySelector("input");
  return dialog({ title: titulo, body: caja, buttons: [
    { label: "Ahora no", value: null }, { label: "Emparejar", primary: true, value: "ok" }] }).then(v => (v === "ok" ? campo.value : null));
}

export async function initHandoff() {
  escucharTraspaso("realify", abrirRecibida);
  escucharRelevo("realify", { pedirCodigo, alRecibir: abrirRecibida });
  const r = await recibirAlArrancar("realify");
  if (r.traspaso) abrirRecibida(r.traspaso);
  else if (r.pedida) toast("No llegó la foto. Guarda una copia en Basic y ábrela aquí.", "err");
}

const exportar = async tipo => (await import("./export/export.js?v=82")).renderExport({ w: doc.w, h: doc.h, type: tipo, quality: 0.95 });

/* Por el servidor: hay que esperar a que termine la subida antes de cambiar de app (iOS duerme la que se queda atrás). */
async function porRelevo() {
  toast("Preparando la foto…");
  let blob = await exportar("image/png");
  if (blob.size > 15 * 1024 * 1024) blob = await exportar("image/jpeg");
  try {
    const r = await enviarRelevo("realify", "basic", { blob, nombre: doc.name || "realify" }, { alProgreso: p => { progress(p); toast(`Enviando la foto… ${Math.round(p * 100)} %`); } });
    progress(null);
    if (r.codigo) ensenarCodigo(r.codigo);
    else toast("Foto enviada: abre Realify Basic desde su icono", "ok");
  } catch (e) { progress(null); toast(e.message || "No se pudo enviar la foto", "err"); }
}

export async function sendToBasic(ventana) {
  if (!doc.open) { toast("No hay documento abierto"); ventana?.close?.(); return; }
  if (usaRelevo()) return porRelevo();
  const r = await traspasar("basic", { blob: await exportar("image/png"), nombre: doc.name || "realify" }, ventana);
  if (r === "enviada") toast("Foto enviada a Realify Basic: cambia a esa ventana", "ok");
}

export const openBasic = ventana => { if (abrirApp("basic", ventana) === "manual") toast(AVISO); };

/** Emparejar a mano (Archivo › Emparejar con Realify Basic…, sólo iPhone instalado): enseñar un código o escribir el de Basic. */
export async function pairBasic() {
  const modo = await dialog({ title: "Emparejar con Realify Basic",
    body: `<p class="hint" style="margin:0">Para que las fotos pasen solas entre las dos apps. Una enseña un código y la otra lo escribe.</p>`,
    buttons: [{ label: "Escribir código", value: "escribir" }, { label: "Enseñar código", primary: true, value: "ensenar" }] });
  try {
    if (modo === "ensenar") return void ensenarCodigo(await crearCodigo("realify", "basic"));
    if (modo !== "escribir") return;
    for (let i = 0, error = ""; i < 3; i++) {
      const texto = await pedirCodigo("basic", error, "Emparejar con Realify Basic");
      if (!texto) return;
      const r = await canjearCodigo("realify", texto);
      if (r === "ok") return void toast("Emparejada con Realify Basic", "ok");
      if (r === "limite") return void toast("Demasiados intentos: prueba dentro de un rato", "err");
      error = "Ese código no vale. Revísalo en Realify Basic.";
    }
  } catch (e) { toast(e.message || "No se pudo emparejar", "err"); }
}
