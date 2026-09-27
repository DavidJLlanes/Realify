/* ═══════════════════════════════════════════════════════════════
   COLLAGE / HISTORY / POST · ENTRADA
   Abre el editor (con la imagen actual como primera foto, si hay un
   documento abierto) y, al aplicar, crea la composición como un
   DOCUMENTO NUEVO en su propia pestaña, con el tamaño del formato
   elegido: nunca toca el documento de partida.

   Capas del resultado, de abajo arriba:
     · «Fondo»: color, degradado o foto difuminada (vacía si es
       transparente),
     · «Foto N»: una por hueco ocupado, ya recortada a su forma, con su
       marco y su sombra,
     · una por texto.
   ═══════════════════════════════════════════════════════════════ */

import { doc, newDoc, addLayer } from "../js/core/doc.js";
import { clear as clearHistory } from "../js/core/history.js";
import { clearSnapshots } from "../js/core/snapshots.js";
import { openAsNewTab } from "../js/core/documents.js";
import { emit } from "../js/core/bus.js";
import { flatten } from "../js/editor/layertree.js";
import { fit as fitView } from "../js/editor/view.js";
import { toast } from "../js/ui/toast.js";
import { renderText, drawText } from "../memes/text.js";
import { cellsOf, drawBackground, drawCell, orientedPhoto } from "./render.js";

function ensureStyles(){
  const href = new URL("./post.css", import.meta.url).href;
  if(document.querySelector('link[href$="socialmediapost/post.css"]') ||
     [...document.styleSheets].some(s => s.href === href)) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/* Nombre del documento: el del formato («Instagram · historia…») */
const docName = f => f.id === "custom" ? "Composición" : f.label;

export async function openSocialPost(){
  await ensureStyles();
  const { openPostEditor } = await import("./ui.js");
  const photo = doc.open ? flatten() : null;
  openPostEditor({
    photo,
    onAccept: async (S, { W, H, format }, photos) => {
      const cells = cellsOf(S, W, H);
      const texts = S.texts.map(t => ({ t, r: renderText(t, W, H, 1) })).filter(x => x.r);
      const bgId = S.slots.find(s => s.photo)?.photo || S.photos[0];
      const ok = await openAsNewTab(() => {
        newDoc(W, H, { name: docName(format), layerName: "Fondo" });
        const base = doc.layers[0];
        if(S.bg !== "transparent") drawBackground(base.ctx, S, W, H, 1, bgId ? photos.get(bgId) : null);
        base.thumbDirty = true;
        let n = 0;
        cells.forEach((c, i) => {
          const slot = S.slots[i], img = slot?.photo && photos.get(slot.photo);
          if(!img) return;
          const l = addLayer({ name: `Foto ${++n}`, above: doc.layers.length });
          drawCell(l.ctx, S, c, orientedPhoto(img, slot.rot, slot.flip), slot, W, H, 1);
          l.thumbDirty = true;
        });
        for(const { t, r } of texts){
          const l = addLayer({ name: `Texto · ${String(t.text).replace(/\s+/g, " ").trim().slice(0, 28)}`, above: doc.layers.length });
          drawText(l.ctx, t, r); l.thumbDirty = true;
        }
        clearHistory();
        clearSnapshots();
      });
      if(!ok) throw new Error("No se pudo abrir la pestaña nueva");
      document.getElementById("empty")?.classList.add("hide");
      emit("doc:structure"); emit("doc:change");
      fitView();
      toast(`Composición creada en una pestaña nueva · ${W} × ${H}`, "ok");
    }
  });
}
