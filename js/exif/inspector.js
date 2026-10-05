/* ═══════════════════════════════════════════════════════════════
   INSPECTOR DE METADATOS (fase 15 de PENDIENTE.md)
   Enseña TODO lo que lleva escrito el archivo original de la foto abierta (o de uno que se elija): EXIF, ubicación
   GPS, IPTC, XMP, perfil ICC, MPF, Photoshop, notas del fabricante y miniatura, con un resumen de lo que revela de
   quien la hizo (dónde, cuándo, con qué cámara, con qué números de serie). La lectura la hace ExifReader (MPL-2.0,
   sin modificar, js/vendor/exifreader) y todo ocurre en el equipo.

   Distinto de «Metadatos EXIF…» (exif/ui.js), que ESCRIBE datos de cámara en una exportación, y de «Limpiar
   metadatos» (io/stripui.js), que los quita de un archivo sin recomprimir.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { isMobile } from "../core/device.js";
import { loadExifReader } from "../io/metadata.js";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MAX_READ = 64 << 20;

const GROUPS = [
  ["file", "Archivo"], ["jfif", "JFIF"], ["pngFile", "PNG"], ["png", "PNG (texto)"], ["riff", "WebP"], ["exif", "EXIF"], ["gps", "Ubicación GPS"],
  ["iptc", "IPTC"], ["xmp", "XMP"], ["icc", "Perfil de color (ICC)"], ["mpf", "MPF (varias imágenes)"],
  ["photoshop", "Photoshop"], ["makerNotes", "Notas del fabricante"], ["composite", "Calculados"], ["Thumbnail", "Miniatura"]
];

/** Texto legible de una etiqueta de ExifReader (`description` si la hay; si no, su valor). */
function tagText(t){
  if(t == null) return "";
  if(typeof t !== "object") return String(t);
  let v = t.description ?? t.value;
  if(Array.isArray(v)) v = v.map(x => (x && typeof x === "object" ? (x.description ?? x.value ?? JSON.stringify(x)) : x)).join(", ");
  else if(v && typeof v === "object") v = JSON.stringify(v);
  v = String(v ?? "");
  return v.length > 240 ? v.slice(0, 240) + "…" : v;
}

/* El resumen de privacidad: qué dice el archivo de quien lo hizo */
function summarize(tags){
  const ex = tags.exif || {}, gps = tags.gps || {}, items = [];
  const t = (g, k) => tagText(g[k]);
  const mk = t(ex, "Make"), md = t(ex, "Model");
  const make = md && mk && md.toLowerCase().startsWith(mk.toLowerCase()) ? md : [mk, md].filter(Boolean).join(" ");   // «Canon EOS R6», no «Canon Canon EOS R6»
  const lat = gps.Latitude, lon = gps.Longitude;
  if(lat != null && lon != null) items.push({ risk: true, label: "Ubicación GPS", text: `${(+lat).toFixed(5)}, ${(+lon).toFixed(5)}` + (gps.Altitude != null ? ` · ${Math.round(gps.Altitude)} m` : "") });
  const date = t(ex, "DateTimeOriginal") || t(ex, "DateTime");
  if(date) items.push({ label: "Fecha de la toma", text: date });
  if(make) items.push({ label: "Cámara", text: make + (t(ex, "LensModel") ? " · " + t(ex, "LensModel") : "") });
  const exposure = [t(ex, "ExposureTime"), t(ex, "FNumber"), ex.ISOSpeedRatings ? "ISO " + t(ex, "ISOSpeedRatings") : "", t(ex, "FocalLength")].filter(Boolean).join(" · ");
  if(exposure) items.push({ label: "Exposición", text: exposure });
  const owner = [t(ex, "Artist"), t(ex, "CameraOwnerName"), tags.iptc && tags.iptc["By-line"] ? tagText(tags.iptc["By-line"]) : ""].filter(Boolean);
  if(owner.length) items.push({ risk: true, label: "Autor / propietario", text: [...new Set(owner)].join(" · ") });
  const copyright = t(ex, "Copyright") || (tags.iptc && tags.iptc["Copyright Notice"] ? tagText(tags.iptc["Copyright Notice"]) : "");
  if(copyright) items.push({ label: "Copyright", text: copyright });
  const serial = [t(ex, "BodySerialNumber"), t(ex, "SerialNumber"), t(ex, "LensSerialNumber"), t(ex, "ImageUniqueID")].filter(Boolean);
  if(serial.length) items.push({ risk: true, label: "Números de serie / identificador", text: serial.join(" · ") });
  if(tags.Thumbnail) items.push({ risk: true, label: "Miniatura incrustada", text: "puede enseñar la foto sin recortar ni retocar" });
  if(tags.makerNotes && Object.keys(tags.makerNotes).length) items.push({ risk: true, label: "Notas del fabricante", text: "pueden llevar contadores y números de serie" });
  if(tags.xmp && Object.keys(tags.xmp).length) items.push({ label: "XMP", text: Object.keys(tags.xmp).length + " campos" });
  if(tags.iptc && Object.keys(tags.iptc).length) items.push({ label: "IPTC", text: Object.keys(tags.iptc).length + " campos" });
  return items;
}

async function readTags(file){
  const XR = await loadExifReader();
  const buf = await file.slice(0, Math.min(file.size, MAX_READ)).arrayBuffer();
  let tags, c2pa = null;
  try{ c2pa = await (await import("./c2pa.js")).readC2pa(new Uint8Array(buf)); }catch(err){ console.warn("[c2pa]", err); }
  try{ tags = XR.load(buf, { expanded: true, includeUnknown: true }); }
  catch(err){
    // un archivo con credenciales C2PA pero sin EXIF sigue teniendo algo que enseñar
    if(!c2pa) throw new Error(/No Exif|Invalid image|metadata/i.test(String(err?.message)) ? "El archivo no lleva metadatos que se puedan leer." : String(err?.message || err));
    tags = {};
  }
  tags._c2pa = c2pa;
  // Lo que ExifReader no cuenta como grupo: el archivo mismo
  tags.file = { ...(tags.file || {}), Nombre: file.name, Tamaño: (file.size / 1048576 >= 1 ? (file.size / 1048576).toFixed(2) + " MB" : Math.round(file.size / 1024) + " KB"), Tipo: file.type || "?" };
  return tags;
}

/* Credenciales de contenido (C2PA): ver exif/c2pa.js para lo que se comprueba y lo que no */
function renderC2pa(c){
  const row = (k, v, bad) => v ? `<div class="field" style="align-items:flex-start;margin:2px 0"><label style="width:140px;flex:none;${bad ? "color:var(--bad)" : ""}">${esc(k)}</label><div style="flex:1;word-break:break-word">${esc(v)}</div></div>` : "";
  const who = n => n ? [n.CN, n.O].filter(Boolean).join(" · ") : "";
  const out = [`<div class="section-label">Credenciales de contenido (C2PA) · ${esc(c.container)}</div>`];
  if(!c.manifests.length) return out.join("") + `<p class="hint">${esc(c.note)}</p>`;
  const act = c.manifests.find(m => m.active) || c.manifests[c.manifests.length - 1];
  const st = act.hash ? (act.hash.status === "match" ? ["Los datos del archivo coinciden con lo firmado", false] : act.hash.status === "mismatch" ? ["¡El archivo se modificó después de firmarse!", true] : ["Hash de los datos sin comprobar", false]) : null;
  out.push(`<div style="margin:0 0 6px">`
    + row("Generado con", act.claim.generator) + row("Título", act.claim.title) + row("Formato", act.claim.format)
    + row("Autor", act.authors.join(", "))
    + row("Acciones", act.actions.map(a => `${a.action}${a.agent ? " (" + a.agent + ")" : ""}`).join(" → "))
    + row("Fuente digital", [...new Set(act.sourceTypes)].join(", "), act.aiDeclared)
    + row("Componentes", act.ingredients.join(", "))
    + (act.signature ? row("Firma", [act.signature.alg, who(act.signature.cert && act.signature.cert.subject)].filter(Boolean).join(" · ")) + row("Emisor del certificado", who(act.signature.cert && act.signature.cert.issuer))
        + row("Validez del certificado", act.signature.cert ? `${act.signature.cert.notBefore} → ${act.signature.cert.notAfter}` : "") : "")
    + (st ? row("Integridad", st[0], st[1]) : "")
    + `</div>`);
  if(c.manifests.length > 1) out.push(`<p class="hint" style="margin:0 0 4px">Historial: ${c.manifests.length} manifiestos (el archivo se editó ${c.manifests.length - 1} vez/veces después de crearse).</p>`);
  out.push(`<details class="meta-group" style="margin:4px 0"><summary style="cursor:pointer"><b>Afirmaciones</b> <span class="hint" style="margin:0">· ${act.assertions.length}</span></summary><div style="margin:4px 0 0 4px">${act.assertions.map(a => row(a.label, a.summary || "—")).join("")}</div></details>`);
  out.push(`<p class="hint" style="margin:4px 0 8px">Aquí <b>no se verifica la firma</b> ni la cadena de certificados: sólo se lee lo declarado y se comprueba el hash de los datos. Una credencial es una declaración de quien la firmó, no una prueba de que la imagen sea real; y al exportar desde Realify se pierde (cambiar un píxel la invalida).</p>`);
  return out.join("");
}

function render(tags, onPick, onClean){
  const wrap = document.createElement("div");
  wrap.className = "meta-inspector";
  const summary = summarize(tags);
  if(tags._c2pa) summary.push({ risk: tags._c2pa.manifests.some(m => m.aiDeclared), label: "Credenciales de contenido (C2PA)", text: tags._c2pa.manifests.length ? (tags._c2pa.manifests.find(m => m.active)?.claim.generator || "manifiesto") + (tags._c2pa.manifests.some(m => m.aiDeclared) ? " · declara contenido hecho por una IA" : "") : "bloque sin manifiesto legible" });
  const risks = summary.filter(i => i.risk).length;
  const parts = [];
  parts.push(`<div class="field" style="flex-wrap:wrap;gap:6px">
    <button type="button" data-a="pick">Elegir otro archivo…</button>
    <button type="button" data-a="copy">Copiar todo</button>
    <button type="button" data-a="clean">Limpiar un archivo…</button></div>`);
  parts.push(summary.length
    ? `<div class="section-label">Resumen</div>
       <div style="margin:0 0 6px;font-size:var(--fs-sm)">${risks ? `<b style="color:var(--bad)">El archivo revela ${risks} dato${risks > 1 ? "s" : ""} personal${risks > 1 ? "es" : ""}.</b> Al exportar puedes elegir qué conservar.` : "No se ven datos personales en lo más habitual."}</div>
       <div class="meta-sum">${summary.map(i => `<div class="field" style="align-items:flex-start;margin:2px 0"><label style="width:140px;flex:none;${i.risk ? "color:var(--bad)" : ""}">${i.risk ? "⚠ " : ""}${esc(i.label)}</label><span class="grow" style="overflow-wrap:anywhere">${esc(i.text)}</span></div>`).join("")}</div>`
    : `<p class="hint">Este archivo no lleva metadatos legibles: ni ubicación, ni cámara, ni autor.</p>`);
  if(tags._c2pa) parts.push(renderC2pa(tags._c2pa));
  if(tags.Thumbnail && tags.Thumbnail.base64) parts.push(`<div class="section-label">Miniatura incrustada</div><img alt="Miniatura incrustada" style="max-width:100%;max-height:140px;border-radius:var(--r);border:1px solid var(--line)" src="data:${tags.Thumbnail.type || "image/jpeg"};base64,${tags.Thumbnail.base64}">`);
  for(const [key, title] of GROUPS){
    const g = tags[key];
    if(!g || key === "Thumbnail") continue;
    const rows = Object.entries(g).filter(([k]) => !/^(_|Thumbnail$)/.test(k));
    if(!rows.length) continue;
    parts.push(`<details class="meta-group" style="margin:6px 0"><summary style="cursor:pointer"><b>${esc(title)}</b> <span class="hint" style="margin:0">· ${rows.length}</span></summary>
      <div style="margin:4px 0 0 4px">${rows.map(([k, v]) => `<div class="field" style="align-items:flex-start;margin:1px 0"><label style="width:150px;flex:none;font-size:var(--fs-xs)">${esc(k)}</label><span class="grow mono" style="font-size:var(--fs-xs);overflow-wrap:anywhere">${esc(tagText(v))}</span></div>`).join("")}</div></details>`);
  }
  wrap.innerHTML = parts.join("");
  wrap.addEventListener("click", e => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if(a === "pick") onPick();
    else if(a === "clean") onClean();
    else if(a === "copy"){
      const lines = [];
      for(const [key, title] of GROUPS){ const g = tags[key]; if(!g || key === "Thumbnail") continue; lines.push(`## ${title}`); for(const [k, v] of Object.entries(g)) if(!k.startsWith("_")) lines.push(`${k}: ${tagText(v)}`); }
      navigator.clipboard?.writeText(lines.join("\n")).then(() => toast("Metadatos copiados", "ok"), () => toast("No se pudo copiar", "err"));
    }
  });
  return wrap;
}

export async function openMetadataInspector(){
  let file = doc.open && doc.source && doc.source.file ? doc.source.file : null;
  const host = document.createElement("div");
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*,.dng,.heic,.heif,.tif,.tiff"; input.hidden = true; host.appendChild(input);
  const out = document.createElement("div"); host.appendChild(out);
  const show = async () => {
    out.innerHTML = `<p class="hint">Leyendo…</p>`;
    try{
      const tags = await readTags(file);
      out.replaceChildren(render(tags, () => input.click(), async () => { const { openStrip } = await import("../io/stripui.js"); openStrip(); }));
    }catch(err){
      out.innerHTML = `<p class="hint" style="color:var(--bad)">${esc(err.message || err)}</p><button type="button" class="wide" data-a="pick">Elegir otro archivo…</button>`;
      out.querySelector("[data-a=pick]").addEventListener("click", () => input.click());
    }
  };
  input.addEventListener("change", () => { const f = input.files[0]; input.value = ""; if(f){ file = f; show(); } });
  if(file) show();
  else out.innerHTML = `<p class="hint">Esta foto no se abrió desde un archivo (o no hay ninguna abierta). Elige el archivo cuyos metadatos quieres ver.</p><button type="button" class="wide primary" id="mdPick">Elegir archivo…</button>`;
  out.querySelector("#mdPick")?.addEventListener("click", () => input.click());
  await dialog({ title: "Inspector de metadatos", body: host, wide: true, cls: isMobile() ? "dlg-compact" : "", buttons: [{ label: "Cerrar", primary: true, value: null }] });
}
