/* ═══════════════════════════════════════════════════════════════
   EDITAR METADATOS ANTES DE EXPORTAR (v253)
   Título, descripción, autor, copyright, palabras clave, fecha y ubicación que se escribirán en el archivo exportado (EXIF, IPTC y XMP a la vez;
   en PDF, el diccionario Info y el XMP). Lo escrito aquí MANDA sobre lo que traiga el original aunque la casilla de su tipo esté apagada; un campo
   vacío no cambia nada, salvo uno que venía relleno con lo del original: vaciarlo lo QUITA del archivo exportado (`over.remove`). Viven en el documento (`doc.metaEdit`): se guardan en el proyecto.
   El editor abre con lo que ya trae el archivo original, para retocarlo en vez de escribirlo desde cero.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { isMobile } from "../core/device.js";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Campos editados del documento (copia limpia) o null. */
export function get(){
  const o = doc.metaEdit;
  return o && count(o) ? { ...o, keywords: [...(o.keywords || [])], remove: [...(o.remove || [])] } : null;
}
/** Cuántos campos hay escritos. */
export function count(o){
  if(!o) return 0;
  return ["title", "description", "author", "copyright", "date"].filter(k => o[k]).length + ((o.keywords || []).length ? 1 : 0) + (Number.isFinite(o.lat) && Number.isFinite(o.lon) ? 1 : 0) + (o.remove || []).length;
}
export function clear(){ doc.metaEdit = null; }

/** Abre el editor; devuelve true si se guardó algo. */
export async function open(){
  if(!doc.open){ toast("No hay documento abierto"); return false; }
  const cur = doc.metaEdit || {};
  const body = document.createElement("div");
  const field = (id, label, inner) => `<div class="field"><label for="${id}">${label}</label>${inner}</div>`;
  body.innerHTML = `
    ${field("meTitle", "Título", `<input type="text" id="meTitle" class="grow" maxlength="200" value="${esc(cur.title)}">`)}
    ${field("meDesc", "Descripción", `<textarea id="meDesc" class="grow" rows="3" maxlength="2000">${esc(cur.description)}</textarea>`)}
    ${field("meAuthor", "Autor", `<input type="text" id="meAuthor" class="grow" maxlength="120" value="${esc(cur.author)}">`)}
    ${field("meCopy", "Copyright", `<input type="text" id="meCopy" class="grow" maxlength="200" placeholder="© 2024 Nombre" value="${esc(cur.copyright)}">`)}
    ${field("meKeys", "Palabras clave", `<input type="text" id="meKeys" class="grow" placeholder="playa, verano, familia" value="${esc((cur.keywords || []).join(", "))}">`)}
    ${field("meDate", "Fecha y hora", `<input type="datetime-local" id="meDate" class="grow" value="${esc(cur.date)}">`)}
    <div class="field"><label>Ubicación</label>
      <input type="number" id="meLat" class="grow" step="0.000001" min="-90" max="90" placeholder="Latitud" value="${Number.isFinite(cur.lat) ? cur.lat : ""}">
      <input type="number" id="meLon" class="grow" step="0.000001" min="-180" max="180" placeholder="Longitud" value="${Number.isFinite(cur.lon) ? cur.lon : ""}"></div>
    <p class="hint" id="meHint" style="margin-top:9px"></p>`;
  const $ = s => body.querySelector(s);
  let pending = null;
  const had = {};                    // lo que traía el original (para saber qué se ha vaciado a propósito)
  const gone = new Set(cur.remove || []);
  const r = await dialog({
    title: "Editar metadatos", body, cls: isMobile() ? "dlg-compact" : "",
    buttons: [{ label: "Cancelar", value: null }, { label: "Quitar los campos", value: "clear" }, { label: "Guardar", primary: true, value: "ok" }],
    onOpen(b){
      const hint = b.querySelector("#meHint");
      hint.textContent = "Se escriben en el archivo exportado (EXIF, IPTC y XMP; en PDF, sus propiedades). Mandan sobre los del original.";
      // con el original a mano, se rellena lo que traiga (sin pisar lo ya escrito)
      if(!(doc.source && doc.source.file)) return;
      pending = (async () => {
        try{
          const M = await import("./metadata.js"), f = M.fieldsFromOriginal(await M.readOriginalMetadata(doc.source.file));
          const set = (key, sel, v) => { if(v === "" || v == null || (Array.isArray(v) && !v.length)) return; had[key] = true; const el = b.querySelector(sel); if(el && !el.value && !gone.has(key)) el.value = v; };
          set("title", "#meTitle", f.title); set("description", "#meDesc", f.description); set("author", "#meAuthor", f.author); set("copyright", "#meCopy", f.copyright);
          set("keywords", "#meKeys", (f.keywords || []).join(", ")); set("date", "#meDate", f.date); set("gps", "#meLat", f.lat); set("gps", "#meLon", f.lon);
          hint.textContent += " Los campos vienen del original: cámbialos, déjalos o vacíalos para quitarlos.";
        }catch(err){ console.warn("[metadatos]", err); }
      })();
    }
  });
  if(pending) await pending;           // si se cierra deprisa, que no falte saber qué traía el original
  if(r === "clear"){ clear(); toast("Campos de metadatos quitados"); return true; }
  if(r !== "ok") return false;
  const num = s => { const v = parseFloat(s); return Number.isFinite(v) ? v : null; };
  const lat = num($("#meLat").value), lon = num($("#meLon").value);
  const o = {
    title: $("#meTitle").value.trim(), description: $("#meDesc").value.trim(), author: $("#meAuthor").value.trim(), copyright: $("#meCopy").value.trim(),
    keywords: $("#meKeys").value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean).slice(0, 60), date: $("#meDate").value || ""
  };
  if(lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180){ o.lat = lat; o.lon = lon; }
  // lo que venía del original y se ha vaciado se quita del archivo exportado (también si ya estaba marcado y se sigue sin rellenar)
  const empty = { title: !o.title, description: !o.description, author: !o.author, copyright: !o.copyright, keywords: !o.keywords.length, date: !o.date, gps: o.lat == null };
  o.remove = Object.keys(empty).filter(k => empty[k] && (had[k] || gone.has(k)));
  doc.metaEdit = count(o) ? o : null;
  toast(doc.metaEdit ? `Metadatos: ${count(o)} campo${count(o) > 1 ? "s" : ""} para la exportación` : "Sin campos de metadatos", "ok");
  return true;
}
