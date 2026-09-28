/* ═══════════════════════════════════════════════════════════════
   HDR · ENTRADA
   Abre el editor HDR (con las fotos abiertas en Realify disponibles
   como fotos del horquillado, tal como se están editando) y, al crear, abre el resultado SIEMPRE como una
   foto recién abierta: pestaña propia, una sola capa, historial vacío
   y ese HDR como «antes» de Comparar. (Antes, si la imagen abierta era
   del horquillado, se añadía como capa encima de ella y Comparar
   enseñaba la foto original en vez del HDR.)
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openHdr(){
  await ensureShellStyles();
  const [{ openHdrEditor }, { doc }, { flatten }, docs] = await Promise.all([
    import("./ui.js"), import("../js/core/doc.js"), import("../js/editor/layertree.js"), import("../js/core/documents.js")]);

  /* Fotos abiertas en Realify: cada pestaña, tal como se está editando. */
  const openDocs = {
    list(){
      const tabs = docs.listTabs();
      if(tabs.length) return tabs.map(t => ({ id: t.tabId, title: t.title || "Foto", thumb: t.thumb || null }));
      return doc.open ? [{ id: null, title: doc.name || "Imagen abierta", thumb: null }] : [];
    },
    /* Compone cada pestaña pedida (se visita un instante; al acabar se
       vuelve a la que estaba activa, detrás del editor a pantalla completa). */
    grab(ids){
      const start = docs.activeTab()?.tabId ?? null, out = [];
      try{
        for(const id of ids){
          if(id !== null && id !== docs.activeTab()?.tabId && !docs.switchTo(id, { force: true })) continue;
          if(!doc.open) continue;
          out.push({ tabId: id, canvas: flatten(), name: doc.name || "Foto", file: doc.source?.file || null, rawMetadata: doc.source?.rawMetadata || null });
        }
      }finally{ if(start !== null && docs.activeTab()?.tabId !== start) docs.switchTo(start, { force: true }); }
      return out;
    }
  };

  openHdrEditor({
    openDocs,
    onAccept: async (canvas, { count, style }) => {
      await resultToLayer(canvas, { name: `HDR · ${style}`, docName: "HDR", newDocument: true });
      toast(`HDR de ${count} ${count === 1 ? "foto" : "fotos"} abierto como foto nueva · ${canvas.width} × ${canvas.height}`, "ok");
    }
  });
}
