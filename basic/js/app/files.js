/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ARCHIVOS
   Abrir una foto (selector, arrastrar y soltar o pegar) y guardar una copia (hoja de compartir del móvil o descarga).
   Entradas: pedirArchivo() · abrirArchivo(file) · guardarCopia() · escucharEntradas(elemento).
   Salidas: la foto queda en app/session.js. Los formatos que sabe abrir son los de Realify (HEIC, TIFF, RAW, PSD, JXL…).
   Límites: iOS no admite lienzos de más de 16 Mpx, así que una foto mayor se reduce a ese tamaño al abrirla.
   ═══════════════════════════════════════════════════════════════ */
import { liberar, renderFinal } from "./render.js";
import { iniciar } from "./session.js";
import { leer } from "./store.js";

const MAX_PIXELES = 16e6;
const ACEPTA = "image/*,.heic,.heif,.tif,.tiff,.dng,.psd,.jxl,.cr2,.cr3,.nef,.arw,.orf,.rw2";
let entrada = null;

function aLienzo(fuente) {
  const k = Math.min(1, Math.sqrt(MAX_PIXELES / (fuente.width * fuente.height)));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(fuente.width * k)); c.height = Math.max(1, Math.round(fuente.height * k));
  c.getContext("2d").drawImage(fuente, 0, 0, c.width, c.height);
  if (fuente.close) fuente.close(); else if (fuente instanceof HTMLCanvasElement && fuente !== c) { fuente.width = 0; fuente.height = 0; }   // devuelve su memoria (iOS)
  return c;
}

export async function abrirArchivo(file) {
  const { decodeAny } = await import("../../../js/io/formats/compatibility.js");
  const lienzo = aLienzo(await decodeAny(file));
  iniciar(lienzo, { nombre: file.name.replace(/\.[^.]+$/, "") || "foto", tipo: file.type === "image/png" ? "image/png" : "image/jpeg" });
}

function crearEntrada() {
  if (entrada) return entrada;
  entrada = Object.assign(document.createElement("input"), { type: "file", accept: ACEPTA, hidden: true });
  entrada.addEventListener("change", () => { const f = entrada.files[0]; entrada.value = ""; if (f) abrirArchivo(f).catch(error); });
  document.body.append(entrada);
  return entrada;
}

export function pedirArchivo() { crearEntrada().click(); }

export function escucharEntradas(zona) {
  crearEntrada();
  zona.addEventListener("dragover", e => e.preventDefault());
  zona.addEventListener("drop", e => { e.preventDefault(); const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/") || x.name.includes(".")); if (f) abrirArchivo(f).catch(error); });
  addEventListener("paste", e => { const f = [...(e.clipboardData?.files || [])][0]; if (f) abrirArchivo(f).catch(error); });
}

export async function guardarCopia() {
  const info = leer().foto;
  if (!info) return false;
  const l = await renderFinal();
  const png = info.tipo === "image/png", ext = png ? "png" : "jpg";
  const blob = await new Promise(r => l.toBlob(r, info.tipo, .95));
  liberar(l);                                              // el resultado a tamaño completo ya no hace falta (memoria de iOS)
  const archivo = new File([blob], `${info.nombre}-basic.${ext}`, { type: info.tipo });
  if (navigator.canShare?.({ files: [archivo] })) { try { await navigator.share({ files: [archivo] }); return true; } catch (e) { if (e.name === "AbortError") return false; } }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(archivo), download: archivo.name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

function error(e) { dispatchEvent(new CustomEvent("basic:error", { detail: e?.message || String(e) })); }
