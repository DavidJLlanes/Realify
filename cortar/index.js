/* ═══════════════════════════════════════════════════════════════
   CORTAR · ENTRADA
   Corta la imagen abierta (todas las capas combinadas) o, sin
   documento, una foto que se elige. Cada trozo puede ir a:
     · una CAPA NUEVA del documento, en su sitio (un solo deshacer),
     · una pestaña nueva cada uno,
     · un ZIP o archivos sueltos.
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, pickFiles, decodePhoto } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openCut(){
  await ensureShellStyles();
  const [{ openCutEditor }, { doc }, { flatten }] = await Promise.all([
    import("./ui.js"), import("../js/core/doc.js"), import("../js/editor/layertree.js")]);
  let source, name, fromDoc = doc.open;
  if(fromDoc){ source = flatten(); name = doc.name || "imagen"; }
  else {
    const [file] = await pickFiles({ multiple: false });
    if(!file) return;
    try{ source = await decodePhoto(file, 8192); }catch(err){ toast(err.message, "err"); return; }
    name = file.name.replace(/\.[^.]+$/, "");
  }
  const prefix = String(name).replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "imagen";
  openCutEditor({ source, name: prefix, canLayers: fromDoc, onAccept: (pieces, o) => save(source, pieces, o, prefix) });
}

async function save(src, pieces, o, prefix){
  const piece = (q, fill) => {
    const c = document.createElement("canvas"); c.width = q.w; c.height = q.h;
    const x = c.getContext("2d");
    if(fill){ x.fillStyle = "#fff"; x.fillRect(0, 0, q.w, q.h); }
    x.drawImage(src, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
    return c;
  };
  if(o.output === "layers"){
    const [{ doc, addLayer }, { record }, { emit }] = await Promise.all([import("../js/core/doc.js"), import("../js/core/history.js"), import("../js/core/bus.js")]);
    const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
    let last = null;
    for(const q of pieces){
      const l = addLayer({ name: `Trozo ${q.n}`, above: doc.layers.length });
      l.ctx.drawImage(src, q.x, q.y, q.w, q.h, q.x, q.y, q.w, q.h);
      l.thumbDirty = true; last = l;
    }
    const nextLayers = doc.layers.slice(), nextActive = last?.id ?? prevActive;
    const put = (layers, active) => { doc.layers = layers.slice(); doc.activeId = active; emit("doc:structure"); emit("doc:change"); };
    record("Cortar en partes", () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
    emit("doc:structure"); emit("doc:change");
    toast(`${pieces.length} trozos en capas nuevas`, "ok");
    return;
  }
  if(o.output === "tabs"){
    const { resultToLayer } = await import("../js/ui/fsshell.js");
    for(const q of pieces) await resultToLayer(piece(q, false), { name: `Trozo ${q.n}`, docName: `${prefix} · ${q.n}`, newDocument: true });
    toast(`${pieces.length} trozos abiertos en pestañas nuevas`, "ok");
    return;
  }
  const mime = o.format === "png" ? "image/png" : o.format === "jpeg" ? "image/jpeg" : "image/webp";
  const ext = o.format === "jpeg" ? "jpg" : o.format;
  const pad = String(pieces.length).length, entries = [];
  const base = String(o.prefix || prefix).replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "imagen";
  toast("Preparando los trozos…");
  for(const q of pieces){
    const blob = await new Promise(r => piece(q, o.format === "jpeg").toBlob(r, mime, o.quality / 100));
    entries.push({ name: `${base}_${String(q.n).padStart(pad, "0")}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()), blob });
  }
  const { download, saveOrShare, stamp } = await import("../js/io/export.js");
  if(o.output === "files"){
    for(const e of entries){ download(e.blob, e.name); await new Promise(r => setTimeout(r, 180)); }
  } else {
    const { buildZip } = await import("../js/io/zip.js");
    await saveOrShare(buildZip(entries), `${base}-trozos-${stamp()}.zip`);
  }
  toast(`${entries.length} trozos guardados`, "ok");
}
