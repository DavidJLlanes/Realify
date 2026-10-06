/* ═══════════════════════════════════════════════════════════════
   FIRMAR CON C2PA · diálogo (v255). La lógica está en js/exif/c2pasign.js.
   Certificado (cadena PEM) y clave privada (PKCS#8 PEM) se cargan desde archivos y viven SÓLO en la memoria de la pestaña: no se guardan en el
   navegador ni en el proyecto. Los ajustes (fuente digital, autor/copyright) sí se recuerdan.
   ═══════════════════════════════════════════════════════════════ */
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { isMobile } from "../core/device.js";
import { doc } from "../core/doc.js";

const KEY = "realify.c2pa";
const load = () => { try{ return JSON.parse(localStorage.getItem(KEY) || "{}"); }catch{ return {}; } };
const save = v => { try{ localStorage.setItem(KEY, JSON.stringify(v)); }catch{} };
let creds = null, who = "";            // credenciales cargadas (en memoria)
let settings = { source: "creation", withMeta: true, ...load() };

/** Formatos que pueden llevar la firma. */
export const SIGNABLE = /^image\/(jpeg|png|avif|heic)(;\d+)?$/;
/** ¿Hay credenciales cargadas? Texto corto del estado para el diálogo Exportar. */
export const state = () => creds ? `Firmará: ${who}` : "Sin firmar";
export const active = () => !!creds;
export const clear = () => { creds = null; who = ""; };

const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("No se pudo leer el archivo")); r.readAsText(f); });
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Abre el diálogo; devuelve true si cambió algo. */
export async function openSign(){
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field"><label>Certificado</label><button type="button" id="c2Cert">Elegir PEM…</button><span class="grow mono" id="c2CertName" style="font-size:11px;padding-left:6px"></span></div>
    <div class="field"><label>Clave privada</label><button type="button" id="c2Key">Elegir PEM…</button><span class="grow mono" id="c2KeyName" style="font-size:11px;padding-left:6px"></span></div>
    <div class="field"><label>Fuente</label><select id="c2Src" class="grow"><option value="creation">Creación digital</option><option value="composite">Fotografía editada (composición)</option><option value="ai">Generada o modificada con IA</option></select></div>
    <label class="chk"><input id="c2Meta" type="checkbox"> Incluir mi autor y copyright de «Editar metadatos»</label>
    <p class="hint" id="c2Hint" style="margin:8px 0 0">Cadena de certificados en PEM (el tuyo primero) y clave en PKCS#8 («BEGIN PRIVATE KEY»). Se firma el archivo exportado (JPEG, PNG, AVIF o HEIC) con un manifiesto nuevo; las credenciales que trajera el original no se conservan. La clave sólo se queda en la memoria de esta pestaña. Un certificado propio sale como «emisor desconocido»: para que un verificador confíe hace falta uno de la lista de C2PA.</p>`;
  const $ = s => body.querySelector(s);
  $("#c2Src").value = settings.source; $("#c2Meta").checked = !!settings.withMeta;
  let certText = null, keyText = null, certName = "", keyName = "";
  const pick = (accept) => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
  $("#c2Cert").addEventListener("click", async () => { const f = await pick(".pem,.crt,.cer,.txt,.ca-bundle,text/plain"); if(f){ certText = await readText(f); certName = f.name; $("#c2CertName").textContent = f.name; } });
  $("#c2Key").addEventListener("click", async () => { const f = await pick(".pem,.key,.txt,text/plain"); if(f){ keyText = await readText(f); keyName = f.name; $("#c2KeyName").textContent = f.name; } });
  if(creds){ $("#c2CertName").textContent = "(cargado)"; $("#c2KeyName").textContent = "(cargada)"; }
  const r = await dialog({ title: "Firmar con credenciales de contenido", body, cls: isMobile() ? "dlg-compact" : "",
    buttons: [{ label: "Cancelar", value: null }, ...(creds ? [{ label: "Quitar la firma", value: "clear" }] : []), { label: "Guardar", primary: true, value: "ok" }] });
  if(r === "clear"){ clear(); toast("Sin firma C2PA"); return true; }
  if(r !== "ok") return false;
  settings = { source: $("#c2Src").value, withMeta: $("#c2Meta").checked }; save(settings);
  if(certText && keyText){
    try{
      const S = await import("../exif/c2pasign.js"), C = await import("../exif/c2pa.js");
      const c = await S.loadCredentials(certText, keyText);
      creds = c;
      const pc = C.parseCert(c.chain[0]), n = pc && pc.subject ? [pc.subject.CN, pc.subject.O].filter(Boolean).join(" · ") : "";
      who = `${n || certName || "certificado"} (${c.signer.name})`;
      toast("Firma C2PA lista: " + who, "ok");
    }catch(err){ creds = null; who = ""; toast(String(err.message || err), "err"); return false; }
  } else if(!creds) toast("Faltan el certificado o la clave: no se firmará", "err");
  return true;
}

/** Firma `blob` si hay credenciales y el formato lo admite; devuelve el blob firmado (o el mismo). Lanza si la firma falla. */
export async function signIfWanted(blob, { title } = {}){
  if(!creds || !SIGNABLE.test(blob.type)) return blob;
  const S = await import("../exif/c2pasign.js"), me = settings.withMeta ? (doc.metaEdit || {}) : {};
  const r = await S.signC2pa(blob, creds, { title: title || doc.name || "", author: me.author || "", copyright: me.copyright || "", source: settings.source, version: String((await import("../pwa-updates.js")).loadedVersion() || "") });
  return r.blob;
}
