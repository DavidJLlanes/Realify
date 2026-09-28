/* ═══════════════════════════════════════════════════════════════
   HOJA DE CONTACTOS · ENTRADA
   PDF con todas las páginas o cada página en una capa nueva (en una
   pestaña nueva, del tamaño del papel).
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openContacts(){
  await ensureShellStyles();
  const { openContactSheet } = await import("./ui.js");
  openContactSheet({
    onAccept: async (pages, { output, title, dpi }) => {
      if(output === "pdf"){
        const { pdfFromCanvases } = await import("../js/io/formats.js");
        const blob = await pdfFromCanvases(pages, { page: "image", quality: .88, dpi });
        const { saveOrShare, stamp } = await import("../js/io/export.js");
        const safe = String(title || "hoja-de-contactos").replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "hoja-de-contactos";
        const r = await saveOrShare(blob, `${safe}-${stamp()}.pdf`);
        if(r !== "cancelled") toast(`PDF de ${pages.length} ${pages.length === 1 ? "página" : "páginas"} · ${Math.round(blob.size / 1024)} KB`, "ok");
        return;
      }
      for(let i = 0; i < pages.length; i++) await resultToLayer(pages[i], { name: `Página ${i + 1}`, docName: `${title || "Hoja de contactos"} · ${i + 1}`, newDocument: true });
      toast(`${pages.length} ${pages.length === 1 ? "página" : "páginas"} en pestañas nuevas`, "ok");
    }
  });
}
