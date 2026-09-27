/* ═══════════════════════════════════════════════════════════════
   SEPARACIÓN DE FRECUENCIAS
   El retoque de piel serio no toca la foto entera de un tirón: separa
   COLOR Y LUZ (baja frecuencia, un desenfoque de la propia foto) de
   TEXTURA (alta frecuencia, lo que ese desenfoque se dejó fuera),
   cada una en su propia capa, para poder igualar un tono irregular en
   la de baja sin difuminar un solo poro, o corregir una marca en la
   de alta sin manchar el color de alrededor.

   La cuenta exacta (el método «Apply Image» de cualquier editor de
   verdad): Alta = (Original − Baja) / 2 + 128, recombinada sobre Baja
   con el modo Luz lineal (editor/blend.js) — la única combinación que
   reconstruye el original al dividir entre dos y sumar 128 en vez de
   restar sin más: un gris exacto en Alta (128, «sin textura ahí») dejа
   Baja intacta, y cualquier otro valor la aclara o la oscurece
   exactamente lo que había de diferencia con el original.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer, makeLayer, layerIndex } from "../core/doc.js";
import { blurred } from "./basic.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { isMobile } from "../core/device.js";
import { slider } from "../editor/adjust.js";
import { toast, status } from "../ui/toast.js";

function uniqueName(base){
  const taken = new Set(doc.layers.map(l => l.name));
  if(!taken.has(base)) return base;
  for(let n = 2; ; n++){
    const candidate = `${base} ${n}`;
    if(!taken.has(candidate)) return candidate;
  }
}

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

function buildHighFreq(originalCanvas, lowCanvas){
  const w = originalCanvas.width, h = originalCanvas.height;
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d", { colorSpace:"srgb" });
  const o = originalCanvas.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, w, h).data;
  const l = lowCanvas.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, w, h).data;
  const res = octx.createImageData(w, h);
  const r = res.data;
  for(let i = 0; i < o.length; i += 4){
    r[i]   = clamp255((o[i]   - l[i])   / 2 + 128);
    r[i+1] = clamp255((o[i+1] - l[i+1]) / 2 + 128);
    r[i+2] = clamp255((o[i+2] - l[i+2]) / 2 + 128);
    r[i+3] = o[i+3];   // el alfa del original, no el gris: transparente sigue siéndolo
  }
  octx.putImageData(res, 0, 0);
  return out;
}

export async function openFreqSep(){
  if(!doc.open) return;
  const layer = activeLayer();
  if(!layer){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  if(layer.type === "adjust" || layer.type === "group"){
    toast("Esta capa no tiene píxeles propios que separar", "err");
    return;
  }

  const p = { radius: 10 };
  const box = document.createElement("div");
  box.appendChild(slider("Radio de desenfoque", 1, 60, p.radius, v => { p.radius = v; }, "px"));
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Deja dos capas nuevas encima del original (que se apaga, no se borra): " +
    "«Baja frecuencia» —color y luz, para igualar un tono irregular sin perder ni un poro— y " +
    "«Alta frecuencia» —la textura, en modo Luz lineal, para corregir una marca sin manchar el " +
    "color de alrededor—. El radio decide dónde cae la frontera entre una y otra: más alto, más " +
    "detalle fino se cuenta como «color» en vez de como «textura».";
  box.appendChild(hint);

  const res = await dialog({
    title: "Separación de frecuencias", body: box,
    cls: isMobile() ? "dlg-compact" : "",
    buttons: [{ label:"Cancelar", value:null }, { label:"Separar", primary:true, value:"go" }]
  });
  if(res !== "go") return;

  status("Separando frecuencias…");
  const low = blurred(layer.canvas, p.radius);
  const high = buildHighFreq(layer.canvas, low);

  const prevLayers = doc.layers.slice();
  const prevActive = doc.activeId;

  const lowLayer = makeLayer({ name: uniqueName("Baja frecuencia") });
  lowLayer.ctx.drawImage(low, 0, 0);

  const highLayer = makeLayer({ name: uniqueName("Alta frecuencia") });
  highLayer.ctx.drawImage(high, 0, 0);
  highLayer.blend = "linear-light";

  const i = layerIndex(layer.id);
  const nextLayers = prevLayers.slice();
  nextLayers.splice(i + 1, 0, lowLayer, highLayer);

  const put = (layers, active, originalVisible) => {
    doc.layers = layers; doc.activeId = active; layer.visible = originalVisible;
    emit("doc:structure"); emit("doc:change");
  };
  put(nextLayers, highLayer.id, false);
  record("Separación de frecuencias",
    () => put(prevLayers, prevActive, true),
    () => put(nextLayers, highLayer.id, false));

  status("");
  toast("Separación de frecuencias creada", "ok");
}
