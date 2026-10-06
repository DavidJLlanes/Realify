/* ═══════════════════════════════════════════════════════════════
   LOTE · ENTRADA
   · Archivo › Aplicar esta edición a otras fotos…: la foto abierta es
     la referencia; su edición se copia a las otras pestañas y/o a
     fotos de la galería (ver edit.js).
   · Inicio › Editar en lote: abre varias fotos, cada una en su
     pestaña, y explica el flujo (edita una y aplícala a las demás).
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, scaledCanvas } from "../js/ui/fsshell.js";
import { toast, status, progress } from "../js/ui/toast.js";

export async function openBatchEdit(){
  const [{ doc }, docs, { flatten }, { captureEdit, applyEdit }] = await Promise.all([
    import("../js/core/doc.js"), import("../js/core/documents.js"), import("../js/editor/layertree.js"), import("./edit.js")]);
  if(!doc.open){ toast("Abre y edita una foto: su edición es la que se copia", "err"); return; }
  await ensureShellStyles();
  const edit = captureEdit();
  const shared = (await import("../js/io/batchmeta.js")).sharedFields();          // campos de «Editar metadatos» de la foto de referencia
  const master = docs.activeTab()?.tabId;
  // Miniaturas de las demás pestañas (se visitan un instante cada una)
  const tabs = [];
  for(const t of docs.listTabs()){
    if(t.tabId === master) continue;
    if(!docs.switchTo(t.tabId, { force: true })) continue;
    if(doc.open) tabs.push({ tabId: t.tabId, name: doc.name || t.title || "Foto", proxy: scaledCanvas(flatten(), 640) });
  }
  if(master != null) docs.switchTo(master, { force: true });

  const { openBatchEditor } = await import("./ui.js");
  openBatchEditor({
    edit, tabs, hasFields: !!shared,
    onApply: async (list, S) => {
      const [{ openFile }, { renderExport, saveOrShare, stamp }] = await Promise.all([import("../js/io/open.js"), import("../js/io/export.js")]);
      const zip = S.output === "zip", entries = [], failed = [];
      const BM = await import("../js/io/batchmeta.js"), fields = S.metaFields ? shared : null;
      const ext = { "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[S.format] || "jpg";
      for(let i = 0; i < list.length; i++){
        const t = list[i];
        progress(i / list.length); status(`Aplicando la edición · ${i + 1} de ${list.length}: ${t.name}`);
        try{
          let opened = false;
          if(t.kind === "tab"){ if(!docs.switchTo(t.tabId, { force: true })) throw new Error("no se pudo abrir la pestaña"); }
          else { if(!(await docs.openAsNewTab(() => openFile(t.file)))) throw new Error("no se pudo abrir"); opened = true; }
          const res = await applyEdit(edit, { expo: S.expo, expoStrength: S.expoStrength / 100, record: !zip });
          if(zip){
            const blob = await renderExport({ w: doc.w, h: doc.h, type: S.format, quality: S.format === "image/png" ? undefined : S.quality / 100, alpha: S.alpha, background: S.bg });
            if(!blob) throw new Error("no se pudo exportar");
            const withMeta = await BM.embedForBatch(blob, { keep: S.metaKeep, fields });
            entries.push({ name: `${t.name}.${ext}`, data: new Uint8Array(await withMeta.arrayBuffer()) });
            if(opened){ const a = docs.activeTab(); if(a) await docs.closeTab(a.tabId, { confirm: false }); }
            else res.undo();   // en modo ZIP las pestañas abiertas quedan como estaban
          }
        }catch(err){ failed.push(`${t.name}: ${err.message}`); }
      }
      progress(null); status("");
      // ZIP: de vuelta a la foto de referencia. Pestañas: se queda en la última editada.
      if(zip && master != null) docs.switchTo(master, { force: true });
      if(zip && entries.length){
        const { buildZip } = await import("../js/io/zip.js");
        await saveOrShare(buildZip(entries), `${String(edit.name).replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "lote"}-lote-${stamp()}.zip`);
      }
      const ok = list.length - failed.length;
      toast(zip ? `${ok} de ${list.length} fotos editadas en el ZIP` : `Edición aplicada a ${ok} de ${list.length} fotos (cada una en su pestaña, con capas reeditables)`, failed.length ? "err" : "ok");
      if(failed.length) console.warn("[lote] fallos:", failed);
    }
  });
}

/** Inicio › Editar en lote: abre varias fotos en pestañas y explica el paso
    siguiente. Normalmente llegan ya elegidas (`files`, ver
    js/io/open.js › promptStartBatch); sin ellas, se piden aquí. */
export async function startBatch(files = null){
  const [{ pickFiles }, { openFileInNewTab }] = await Promise.all([import("../js/ui/fsshell.js"), import("../js/io/open.js")]);
  if(!files) files = await pickFiles({ accept: "image/*,.heic,.heif,.tif,.tiff,.psd" });
  if(!files.length) return;
  for(const f of files) await openFileInNewTab(f);
  if(files.length < 2) return;
  const { dialog } = await import("../js/ui/dialog.js");
  await dialog({ title: "Editar en lote",
    body: `<p class="hint" style="margin:0 0 8px">Se han abierto <b>${files.length} fotos</b>, cada una en su pestaña.</p>
      <p class="hint" style="margin:0 0 8px"><b>1.</b> Edita una de ellas como siempre: ajustes, filtros, estilos, textos, marca de agua…</p>
      <p class="hint" style="margin:0"><b>2.</b> Cuando te guste, ve a <b>Archivo › Aplicar esta edición a otras fotos…</b> (en el móvil, en Herramientas) y se copiará a las demás, con la opción de igualar su exposición.</p>`,
    buttons: [{ label: "Entendido", primary: true, value: "ok" }] });
}
