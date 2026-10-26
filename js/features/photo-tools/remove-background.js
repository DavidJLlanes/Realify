/* ═══════════════════════════════════════════════════════════════
   photo-tools · remove background
   Parte de js/features/photo-tools.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../../ui/kit/dialog.js";
import { isMobile, COARSE } from "../../core/device.js";
import { doc, addLayer } from "../../core/doc.js";
import { toast } from "../../core/toast.js";
import { featherMask } from "../../editor/selection/selection.js";
import { emit } from "../../core/bus.js";
import { record } from "../../core/history.js";
import { wireCommon, rasterLayer, sliderRow } from "./common.js";

export async function settingsDialog(title, html, wide = false){
  const body = document.createElement("div"); body.innerHTML = html;
  const result = await dialog({ title, body, wide,
    cls: isMobile() ? "dlg-compact" : "",
    buttons:[{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }],
    onOpen: wireCommon });
  return result === "go" ? body : null;
}

/* ── Eliminar fondo ─────────────────────────────────────────── */
export function backgroundMask(img, tolerance){
  const { data, width:w, height:h } = img;
  const samples = [[0,0],[w-1,0],[0,h-1],[w-1,h-1],[w>>1,0],[w>>1,h-1]];
  let rr=0,gg=0,bb=0;
  for(const [x,y] of samples){ const i=(y*w+x)*4; rr+=data[i]; gg+=data[i+1]; bb+=data[i+2]; }
  rr/=samples.length; gg/=samples.length; bb/=samples.length;
  const limit = tolerance * tolerance * 3.2, bg = new Uint8Array(w*h), q = new Int32Array(w*h);
  let head=0, tail=0;
  const push = p => { if(!bg[p]){ bg[p]=1; q[tail++]=p; } };
  const matches = p => { const i=p*4,dr=data[i]-rr,dg=data[i+1]-gg,db=data[i+2]-bb;
    return dr*dr+dg*dg+db*db <= limit || data[i+3] < 20; };
  for(let x=0;x<w;x++){ if(matches(x)) push(x); const b=(h-1)*w+x;if(matches(b)) push(b); }
  for(let y=0;y<h;y++){ const a=y*w,b=a+w-1;if(matches(a)) push(a);if(matches(b)) push(b); }
  while(head<tail){ const p=q[head++],x=p%w,y=(p/w)|0;
    if(x&&matches(p-1))push(p-1);if(x<w-1&&matches(p+1))push(p+1);
    if(y&&matches(p-w))push(p-w);if(y<h-1&&matches(p+w))push(p+w); }
  const mask = new Uint8ClampedArray(w*h);
  for(let p=0;p<mask.length;p++) mask[p]=bg[p]?0:255;
  return mask;
}

/* Métodos de «Eliminar fondo»: los tres de IA vienen de ImageToolbox
   (ver js/ai/models.js); «color» es el relleno por inundación desde los
   bordes de siempre, que sigue siendo el mejor para fondos lisos. */
const BG_METHODS = [
  ["u2netp", "IA rápida · U²-Net"],
  ["modnet", "IA retratos · MODNet"],
  ["isnet",  "IA máxima calidad · ISNet"],
  ["color",  "Color de los bordes"]
];

const BG_KEY = "realify.bgMethod";

/* Alfa 0-255 del sujeto a tamaño de documento (js/ai/matte.js): pasada
   global del modelo + borde refinado con filtro guiado a resolución completa. */
async function aiBackgroundMask(layer, id){
  const { matteAlpha } = await import("../../ai/matte.js");
  return matteAlpha(layer.canvas, id);
}

export async function removeBackground(){
  const layer = rasterLayer(); if(!layer) return;
  let saved = "u2netp";
  try{ const v = localStorage.getItem(BG_KEY); if(BG_METHODS.some(([k]) => k === v)) saved = v; }catch{}
  const { sizeNote, crashedBefore } = await import("../../ai/runtime.js");
  const notes = Object.fromEntries(await Promise.all(
    BG_METHODS.filter(([k]) => k !== "color").map(async ([k]) =>
      [k, (await sizeNote(k)) + (crashedBefore(k) ? ", falló por memoria aquí" : k === "isnet" && COARSE ? ", pesado en móvil" : "")])));
  const body = await settingsDialog("Eliminar fondo", `
    <p class="hint">El sujeto recortado, sin fondo, va a una capa nueva; la original se oculta sin borrarla. «Color de los bordes» funciona mejor con fondos relativamente uniformes.</p>
    <div class="field"><label for="bgMethod">Método</label>
      <select id="bgMethod" class="grow">${BG_METHODS.map(([k, label]) =>
        `<option value="${k}"${k === saved ? " selected" : ""}>${label}${k === "color" ? "" : ` (${notes[k]})`}</option>`).join("")}</select></div>
    <div id="bgTolRow">${sliderRow("bgTol","Tolerancia",5,140,42)}</div>
    ${sliderRow("bgFeather","Suavizar borde",0,30,3," px")}`);
  if(!body) return;
  const method = body.querySelector("#bgMethod").value;
  try{ localStorage.setItem(BG_KEY, method); }catch{}
  const { activeTab, switchTo } = await import("../../editor/documents.js"), tabId = activeTab()?.tabId;
  let mask;
  if(method === "color"){
    const img=layer.ctx.getImageData(0,0,doc.w,doc.h);
    mask=backgroundMask(img,+body.querySelector("#bgTol").value);
  } else {
    try{ mask = await aiBackgroundMask(layer, method); }
    catch(err){
      if(err.cancelled) toast("Eliminar fondo cancelado");
      else toast("No se pudo eliminar el fondo: " + err.message, "err");
      return;
    }
  }
  /* Una máscara que lo deja todo (o nada) no quita ningún fondo: se
     avisa en vez de añadirla y dar a entender que ha funcionado. */
  let kept = 0;
  for(let i = 0; i < mask.length; i++) if(mask[i] > 127) kept++;
  const frac = kept / mask.length;
  if(frac > 0.995 || frac < 0.005){
    toast(method === "color"
      ? "No se ha encontrado un fondo uniforme en los bordes; sube la tolerancia o prueba un método de IA"
      : "La IA no ha distinguido un sujeto del fondo en esta imagen; prueba con otro método", "err");
    return;
  }
  const f=+body.querySelector("#bgFeather").value;
  if(tabId != null) switchTo(tabId, { force: true });   // el documento donde se empezó
  if(f) mask=featherMask(mask,doc.w,doc.h,f);
  cutoutLayer(layer, mask);
  toast("Fondo eliminado en una capa nueva", "ok");
}

/* El resultado va a una capa NUEVA encima de la original, con el fondo
   ya transparente, y la original se oculta (sin borrarla) para que se
   vea el recorte. Así el original queda intacto por si hay que volver a
   él. Todo es un solo paso de deshacer. */
function cutoutLayer(src, mask){
  const w = doc.w, h = doc.h;
  const m = document.createElement("canvas"); m.width = w; m.height = h;
  const mx = m.getContext("2d");
  const a = mx.createImageData(w, h);
  for(let p = 0; p < mask.length; p++) a.data[p * 4 + 3] = mask[p];
  mx.putImageData(a, 0, 0);

  const prevLayers = doc.layers.slice(), prevActive = doc.activeId, wasVisible = src.visible;
  const name = !src.name || /^fondo$/i.test(src.name) ? "Sin fondo" : src.name + " · sin fondo";
  const l = addLayer({ name, above: doc.layers.indexOf(src) + 1 });
  l.groupId = src.groupId;
  l.ctx.drawImage(src.canvas, 0, 0);
  l.ctx.globalCompositeOperation = "destination-in";
  l.ctx.drawImage(m, 0, 0);
  l.ctx.globalCompositeOperation = "source-over";
  l.thumbDirty = true;
  src.visible = false; src.thumbDirty = true;
  const nextLayers = doc.layers.slice(), nextActive = l.id;
  const put = (layers, active, vis) => {
    doc.layers = layers.slice(); doc.activeId = active; src.visible = vis;
    emit("doc:structure"); emit("doc:change");
  };
  record("Eliminar fondo", () => put(prevLayers, prevActive, wasVisible), () => put(nextLayers, nextActive, false));
  emit("doc:structure"); emit("doc:change");
  return l;
}
