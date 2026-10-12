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
import { on } from "../js/core/bus.js";
import { activeTab, listTabs } from "../js/core/documents.js";
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

/* ── Stickers pendientes por documento ──
   Al cerrar con Cancelar, ✕ o Esc, los stickers colocados NO se pierden: se
   guardan en memoria, ligados a la pestaña (documento) y no a todo el
   editor, y la próxima vez que se abra el editor en ese documento vuelven
   a estar donde estaban. Al aplicar se convierten en capas y el estado se
   borra; las capas que ya existían (stickers de antes, fotos…) son capas
   normales y no se tocan.

   En memoria y no en localStorage: son pocos números por sticker, pero
   sólo tienen sentido mientras el documento siga abierto —las coordenadas
   son de ESA imagen—, no hay nada que recuperar tras recargar la página y
   un almacenamiento persistente dejaría restos de documentos que ya no
   existen, con cuota y errores que manejar para nada. */
const pending = new Map();      // clave del documento → { w, h, stickers }
const keyOf = () => activeTab()?.tabId ?? "unico";

/* Fuera los de pestañas cerradas. Al cambiar la lista de pestañas, «unico»
   (un documento sin pestaña) ya no corresponde a lo que hay abierto. */
function prune(){
  const alive = new Set(listTabs().map(t => t.tabId));
  for(const k of [...pending.keys()]) if(!alive.has(k)) pending.delete(k);
}
on("docs:change", prune);
on("doc:new", () => { if(!listTabs().length) pending.delete("unico"); });

/* Los stickers guardados valen si la imagen sigue siendo la misma: con otro
   tamaño pero la misma proporción (cambiar el tamaño de imagen) se escalan;
   si cambió la proporción (recorte, girar…) ya no sabrían dónde ir y se
   descartan avisando. */
function restoreFor(key){
  const p = pending.get(key);
  if(!p) return null;
  if(p.w === doc.w && p.h === doc.h) return p.stickers;
  pending.delete(key);
  const kx = doc.w / p.w, ky = doc.h / p.h;
  if(Math.abs(kx - ky) / Math.max(kx, ky) > 0.01){
    toast("Los stickers pendientes se descartaron: la imagen cambió de forma", "err");
    return null;
  }
  return p.stickers.map(s => ({ ...s, x: s.x * kx, y: s.y * ky, size: s.size * kx }));
}

export async function openStickers(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  await ensureStyles();
  const { openStickerEditor } = await import("./ui.js");
  const key = keyOf();
  const initial = restoreFor(key);
  const background = flatten();
  openStickerEditor({
    background,
    initial: initial ? { stickers: initial } : null,
    onClose: (reason, stickers) => {
      if(reason === "accept" || !stickers.length) pending.delete(key);
      else pending.set(key, { w: doc.w, h: doc.h, stickers });
      if(reason !== "accept" && stickers.length)
        toast(stickers.length === 1 ? "Sticker pendiente guardado en este documento" : `${stickers.length} stickers pendientes guardados en este documento`);
    },
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
