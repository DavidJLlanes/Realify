/* ═══════════════════════════════════════════════════════════════
   MEJORA AUTOMÁTICA DE UN TOQUE
   El botón «Automático» del cajón de móvil. No es un algoritmo nuevo:
   es «Tono / Color automático» (advanced-color.js) en modo color, con
   neutros equilibrados y sus valores de fábrica, aplicado sin abrir
   el diálogo. Queda como una capa de filtro normal con el id
   «auto-tone-color», así que el doble clic en su «fx» reabre ese
   mismo diálogo con estos valores para afinarlo, y se deshace como
   cualquier otro paso.
   ═══════════════════════════════════════════════════════════════ */

import { activeLayer } from "../core/doc.js";
import { applyDirect } from "./adjust.js";
import { autoToneColor } from "./advanced-color.js";
import { toast } from "../ui/toast.js";

const PARAMS = { mode:"color", clip:.5, neutral:true, mid:0 };

export async function autoEnhance(){
  const layer = activeLayer();
  if(!layer || !layer.canvas){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  // El cálculo en sí es el del modo sin diálogo del filtro original
  // (asíncrono); applyDirect se encarga después de la selección, la
  // capa de filtro y el historial exactamente igual que en el resto.
  const out = await autoToneColor({ init:{ ...PARAMS }, render:{ src:layer.canvas, isFinal:true } });
  const result = out.getContext("2d").getImageData(0, 0, out.width, out.height).data;
  return applyDirect("Mejora automática", data => data.set(result),
    { asLayer:true, filterId:"auto-tone-color", filterParams:{ ...PARAMS } });
}
