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

const STASH_KEY = "before-hdr", RUNNING = "realify.hdrRunning";

/** Al arrancar (main.js): si la página se cerró con la fusión HDR en
    marcha (falta de memoria en el móvil), reabre las fotos que había. */
export async function recoverHdrCrash(){
  try{ if(!localStorage.getItem(RUNNING)) return; localStorage.removeItem(RUNNING); }catch{ return; }
  let n = 0;
  try{ const { restoreAfterUpdate } = await import("../js/io/project.js"); n = await restoreAfterUpdate(STASH_KEY); }catch{}
  toast("La fusión HDR necesitó más memoria de la que tiene este dispositivo y la página se cerró." +
        (n ? " Tus fotos abiertas se han recuperado." : "") + " Prueba con menos fotos a la vez.", "err");
}

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

  /* Copia de seguridad de las pestañas antes de cargar un horquillado
     largo en el móvil (ver `recoverHdrCrash`): una vez por sesión del
     editor, y se descarta al cerrarlo sin percances. */
  let guarded = false;
  const onHeavy = async () => {
    if(guarded) return;
    guarded = true;
    const { stashForUpdate } = await import("../js/io/project.js");
    await stashForUpdate(STASH_KEY);
    try{ localStorage.setItem(RUNNING, String(Date.now())); }catch{}
  };
  const onClose = () => {
    if(!guarded) return;
    try{ localStorage.removeItem(RUNNING); }catch{}
    import("../js/io/project.js").then(m => m.discardStash(STASH_KEY)).catch(() => {});
  };

  openHdrEditor({
    openDocs, onHeavy, onClose,
    onAccept: async (canvas, { count, style }) => {
      await resultToLayer(canvas, { name: `HDR · ${style}`, docName: "HDR", newDocument: true });
      toast(`HDR de ${count} ${count === 1 ? "foto" : "fotos"} abierto como foto nueva · ${canvas.width} × ${canvas.height}`, "ok");
    }
  });
}
