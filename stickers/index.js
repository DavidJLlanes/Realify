/* ═══════════════════════════════════════════════════════════════
   STICKERS · ENTRADA
   Abre el editor sobre la composición actual del documento y, al
   aplicar, crea UNA CAPA POR STICKER encima de la capa activa, en el
   mismo orden en que se apilaban en el editor. Todas en un solo paso
   de historial: un Ctrl+Z las quita juntas.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../js/core/doc.js";
import { recordLayers } from "../js/core/history.js";
import { flatten } from "../js/editor/layertree.js";
import { toast } from "../js/ui/toast.js";
import { buildSprite, drawSprite } from "./render.js";

/* Igual que el Filtro Vintage: la hoja de estilos no depende de que
   index.html la enlace. */
function ensureStyles(){
  const href = new URL("./stickers.css", import.meta.url).href;
  if(document.querySelector('link[href$="stickers/stickers.css"]') ||
     [...document.styleSheets].some(s => s.href === href)) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

export async function openStickers(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  await ensureStyles();
  const { openStickerEditor } = await import("./ui.js");
  const background = flatten();
  openStickerEditor({
    background,
    onAccept: async (stickers, images) => {
      recordLayers("Añadir stickers", () => {
        for(const s of stickers){
          const layer = addLayer({ name: `Sticker · ${s.name}` });
          const sprite = buildSprite(images.get(s.uid), s, 1);
          drawSprite(layer.ctx, sprite, s.x, s.y, s.opacity);
          sprite.canvas.width = sprite.canvas.height = 1;
          layer.thumbDirty = true;
        }
      });
      toast(stickers.length === 1 ? "Sticker añadido en una capa nueva" : `${stickers.length} stickers añadidos, cada uno en su capa`, "ok");
    }
  });
}
