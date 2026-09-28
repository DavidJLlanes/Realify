/* Herramientas fotográficas adicionales. Los efectos que cambian píxeles
   trabajan sobre una copia, crean un paso de historial y respetan la capa
   activa. Las selecciones y máscaras siguen el modelo nativo del editor. */

import { doc, activeLayer, addLayer } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { addMask } from "../editor/masks.js";
import { commitFilter, filterBase } from "../editor/filterlayer.js";
import { featherMask } from "../editor/selection.js";
import { renderExport } from "../io/export.js";
import { COARSE, isMobile } from "../core/device.js";

/* Igual que PREVIEW_LIMIT en editor/adjust.js, pero más estricto: las
   tres funciones que pasan por `liveDialog` —corrección de lente,
   enfoque selectivo, retrato— son notablemente más caras por píxel
   que un simple recorrido de LUT (bilinear ×4, convolución 3×3, dos
   pasadas de desenfoque de caja de hasta 40 px), así que el límite
   general de 1,2 MP ya se nota en ellas, y en `pointer:coarse` se
   recorta más todavía. */
const LIVE_PREVIEW_LIMIT = COARSE ? 4e5 : 1.2e6;

const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
const deep = x => JSON.parse(JSON.stringify(x));

function canvasCopy(src){
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  c.getContext("2d", { colorSpace:"srgb" }).drawImage(src, 0, 0); return c;
}

function restore(layer, canvas){
  layer.ctx.save(); layer.ctx.globalCompositeOperation = "copy";
  layer.ctx.drawImage(canvas, 0, 0); layer.ctx.restore();
  layer.thumbDirty = true; emit("doc:structure"); emit("doc:change");
}

function rasterLayer(){
  const layer = activeLayer();
  if(!layer) { toast("No hay capa activa"); return null; }
  if(layer.locked) { toast("La capa está bloqueada"); return null; }
  if(layer.type === "adjust") { toast("Selecciona una capa de imagen"); return null; }
  return layer;
}

/* El efecto se calcula sobre la capa activa para poder verlo, pero al
   confirmar se devuelve la capa a como estaba y el resultado se lleva
   a una capa nueva encima. Ver editor/filterlayer.js. */
function commitEffect(layer, before, label, params = {}, base = layer, edit = null){
  const after = canvasCopy(layer.canvas);
  restore(layer, before);
  commitFilter({ base, edit, result: after, title: label, filter: label, params });
  toast(label + (edit ? " · actualizado" : " · capa nueva"), "ok");
}

function sliderRow(id, label, min, max, value, unit = "", step = 1){
  return `<div class="field"><label for="${id}">${label}</label>` +
    `<input class="grow" type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">` +
    `<span class="unit mono" data-for="${id}">${value}${unit}</span></div>`;
}

function wireValues(body, units = {}){
  body.querySelectorAll('input[type="range"]').forEach(r => r.addEventListener("input", () => {
    const out = body.querySelector(`[data-for="${r.id}"]`);
    if(out) out.textContent = r.value + (units[r.id] || "");
  }));
}

const UNITS = { bgTol:"", bgFeather:" px", dnLum:"%", dnChroma:"%",
  lensDist:"", lensCA:" px", lensVig:"%", ssAmount:"%", ssRadius:" px",
  ssThreshold:"", maskFeather:" px", portraitSmooth:"%", portraitShine:"%",
  portraitEye:"%", trScale:"%", trRotate:"°", trSkewX:"°", trSkewY:"°",
  wmOpacity:"%", wmSize:" px", aiStrength:"%" };

const BUILTIN_LENS_PROFILES={
  "apple-iphone15-main":{name:"Apple iPhone 15 Pro · principal",make:"Apple",model:"iPhone 15 Pro",lens:"iPhone 15 Pro back camera",distortion:-8,ca:.35,vignette:7},
  "canon-ef2470-24":{name:"Canon EF 24-70mm f/2.8L II · 24 mm",make:"Canon",lens:"EF24-70mm f/2.8L II USM",distortion:-6,ca:.3,vignette:6},
  "nikon-z1424-14":{name:"NIKKOR Z 14-24mm f/2.8 S · 14 mm",make:"Nikon",lens:"NIKKOR Z 14-24mm f/2.8 S",distortion:-14,ca:.55,vignette:12},
  "sony-fe1635-16":{name:"Sony FE 16-35mm F2.8 GM · 16 mm",make:"Sony",lens:"FE 16-35mm F2.8 GM",distortion:-11,ca:.45,vignette:9},
  "gopro-hero12":{name:"GoPro HERO12 Black · gran angular",make:"GoPro",model:"HERO12 Black",distortion:-36,ca:1.4,vignette:25}
};
function lensProfiles(){let custom={};try{custom=JSON.parse(localStorage.getItem("realify.lensProfiles")||"{}");}catch{}return{...BUILTIN_LENS_PROFILES,...custom};}

/* Cableado compartido por los dos tipos de diálogo: la etiqueta junto
   a cada deslizador, el interruptor de modo de la máscara por rango, y
   el selector de perfil de lente que rellena sus tres deslizadores.
   `settingsDialog` (aplica al cerrar) y `liveDialog` (vista previa en
   marcha) montan sobre el mismo HTML, así que comparten este cableado
   en vez de duplicarlo. */
function wireCommon(host){
  wireValues(host, UNITS);
  const mode=host.querySelector("#maskMode");
  if(mode) mode.addEventListener("change",()=>{
    host.querySelector("#maskLum").hidden=mode.value!=="lum";
    host.querySelector("#maskColor").hidden=mode.value!=="color";
  });
  const bgMethod=host.querySelector("#bgMethod");
  if(bgMethod){
    const sync=()=>{host.querySelector("#bgTolRow").hidden=bgMethod.value!=="color";};
    bgMethod.addEventListener("change",sync);sync();
  }
  const profile=host.querySelector("#lensProfile");
  if(profile){
    const profiles=lensProfiles();for(const [id,p] of Object.entries(profiles)){const o=document.createElement("option");o.value=id;o.textContent=p.name||id;profile.appendChild(o);}
    const applyProfile=id=>{let p=profiles[id];if(id==="auto"){const meta=doc.source?.exif||{},hay=(meta.make+" "+meta.model+" "+meta.lens).toLowerCase();p=Object.values(profiles).find(q=>hay&&[q.make,q.model,q.lens].some(v=>v&&hay.includes(v.toLowerCase())));if(!p){toast("No se encontró un perfil coincidente en los EXIF", "err");return;}}if(!p)return;[["lensDist",p.distortion],["lensCA",p.ca],["lensVig",p.vignette]].forEach(([id,v])=>{const el=host.querySelector("#"+id);el.value=v;el.dispatchEvent(new Event("input"));});};
    profile.addEventListener("change",()=>applyProfile(profile.value));
    const input=host.querySelector("#lensProfileFile"),button=host.querySelector("#lensImport");if(button&&input){button.onclick=()=>input.click();input.onchange=async()=>{try{const raw=JSON.parse(await input.files[0].text()),items=Array.isArray(raw)?raw:[raw],saved=JSON.parse(localStorage.getItem("realify.lensProfiles")||"{}");for(const q of items){if(!q.name||![q.distortion,q.ca,q.vignette].every(Number.isFinite))throw new Error("Formato inválido");saved[q.id||q.name.toLowerCase().replace(/\W+/g,"-")]=q;}localStorage.setItem("realify.lensProfiles",JSON.stringify(saved));toast("Perfil óptico importado; vuelve a abrir el filtro","ok");}catch(e){toast("No se pudo importar el perfil: "+e.message,"err");}};}
  }
}

async function settingsDialog(title, html, wide = false){
  const body = document.createElement("div"); body.innerHTML = html;
  const result = await dialog({ title, body, wide,
    cls: isMobile() ? "dlg-compact" : "",
    buttons:[{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }],
    onOpen: wireCommon });
  return result === "go" ? body : null;
}

/* Diálogo con vista previa en vivo: cada deslizador recalcula sobre el
   ORIGINAL —nunca sobre el resultado del fotograma anterior, que
   acumularía error de redondeo— y escribe el resultado en la capa al
   momento, igual que runFilter/runAdjust. Cancelar devuelve la capa a
   como estaba; Aplicar lleva el resultado a una capa nueva (ver
   editor/filterlayer.js), en vez de sobrescribir la capa de origen.

   Por encima de `LIVE_PREVIEW_LIMIT`, `compute` se ejecuta sobre una
   copia REDUCIDA mientras se arrastra —igual que editor/adjust.js—, y
   el resultado se escala sobre la capa real con un único `drawImage`.
   Al aceptar se recalcula UNA VEZ MÁS a resolución completa: lo que
   se ve durante el arrastre es una aproximación, lo que se guarda no
   debe serlo. `compute(src, w, h, host, scale)` recibe los píxeles
   ORIGINALES (nunca los muta), el propio `host` para leer los
   controles, y `scale` (1 en resolución completa, <1 en el proxy) por
   si algún parámetro está en píxeles ABSOLUTOS y necesita reescalarse
   para que el aspecto de la vista previa no cambie con el tamaño del
   proxy —el mismo contrato que ya tenían `correctLensPixels`,
   `selectiveSharpenPixels` y `portraitPixels`, que ignoran `scale` si
   no les hace falta—. */
/* `fill(host, p)` deja los controles con los valores de `p`, `read(host)`
   los lee, y `compute(src, w, h, p, scale)` calcula con un objeto de
   parámetros en vez de mirar el DOM: así el registro de filtros puede
   pedir el mismo cálculo sin diálogo (`opts.render`) y reabrir el
   panel con los valores guardados en la capa (`opts.init`, `opts.edit`). */
async function liveDialog(title, html, { compute, label, read, fill, defaults }, opts = {}){
  const p0 = { ...defaults, ...opts.init };
  if(opts.render){
    const src = opts.render.src, w = src.width, h = src.height;
    const data = src.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, w, h).data;
    const out = compute(data, w, h, p0, 1);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
    return c;
  }

  const edit = opts.edit || null;
  const layer = edit || rasterLayer(); if(!layer) return false;
  const base = edit ? filterBase(edit) : layer;
  if(!base){ toast("La capa de filtro no tiene ninguna capa debajo", "err"); return false; }
  const before = canvasCopy(layer.canvas);
  const source = edit ? canvasCopy(base.canvas) : before;
  const w = source.width, h = source.height;
  const fullData = source.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, w, h).data;

  const big = w * h > LIVE_PREVIEW_LIMIT;
  let smallCanvas = null, smallData = null, sw = w, sh = h, scale = 1;
  if(big){
    scale = Math.sqrt(LIVE_PREVIEW_LIMIT / (w * h));
    sw = Math.max(1, Math.round(w * scale)); sh = Math.max(1, Math.round(h * scale));
    smallCanvas = document.createElement("canvas");
    smallCanvas.width = sw; smallCanvas.height = sh;
    const sx = smallCanvas.getContext("2d", { willReadFrequently: true });
    sx.drawImage(source, 0, 0, sw, sh);
    smallData = sx.getImageData(0, 0, sw, sh).data;
  }

  let host, queued = false;
  const redraw = () => {
    if(queued || !host) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const p = read(host);
      if(big){
        const out = compute(smallData, sw, sh, p, scale);
        smallCanvas.getContext("2d").putImageData(new ImageData(out, sw, sh), 0, 0);
        const x = layer.ctx;
        x.save(); x.globalCompositeOperation = "copy"; x.imageSmoothingQuality = "high";
        x.drawImage(smallCanvas, 0, 0, w, h); x.restore();
      } else {
        const out = compute(fullData, w, h, p, 1);
        layer.ctx.putImageData(new ImageData(out, w, h), 0, 0);
      }
      layer.thumbDirty = true; emit("doc:change");
    });
  };

  const body = document.createElement("div"); body.innerHTML = html;
  const result = await dialog({ title, body,
    cls: isMobile() ? "dlg-compact" : "",
    buttons:[{ label:"Cancelar", value:null }, { label: edit ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }],
    onOpen: h => {
      host = h;
      wireCommon(host);
      if(opts.init) fill(host, p0);
      host.addEventListener("input", redraw);
      redraw();
    }
  });

  if(result !== "go"){ restore(layer, before); return false; }
  const p = read(host);
  if(big){
    // Recalculado a resolución completa, aunque la vista previa
    // trabajara sobre el proxy reducido: lo aplicado no puede ser una
    // aproximación.
    status("Aplicando…");
    const out = compute(fullData, w, h, p, 1);
    layer.ctx.putImageData(new ImageData(out, w, h), 0, 0);
    status("");
  }
  commitEffect(layer, before, label, p, base, edit);
  return true;
}

/* Rellena deslizadores y casillas a partir de un mapa id → valor y
   refresca la etiqueta numérica de cada uno. */
function fillFields(host, map){
  for(const [id, v] of Object.entries(map)){
    const el = host.querySelector("#" + id);
    if(!el) continue;
    if(el.type === "checkbox") el.checked = !!v;
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: false }));
  }
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

/* Alfa 0-255 del sujeto a tamaño de documento. La imagen se estira al
   cuadrado de entrada del modelo (igual que ImageToolbox) y la máscara
   vuelve a su proporción al escalarla: el modelo ve la escena entera,
   sin recortes. */
async function aiBackgroundMask(layer, id){
  const [{ MODELS }, { runModel }] = await Promise.all([import("../ai/models.js"), import("../ai/runtime.js")]);
  const n = MODELS[id].input;
  const thumb = document.createElement("canvas"); thumb.width = thumb.height = n;
  const tx = thumb.getContext("2d", { willReadFrequently:true });
  tx.imageSmoothingQuality = "high";
  tx.drawImage(layer.canvas, 0, 0, n, n);
  const rgba = tx.getImageData(0, 0, n, n).data;
  const { mask } = await runModel("matte", id, { rgba, size: n }, [rgba.buffer]);

  const small = tx.createImageData(n, n);
  for(let i = 0; i < mask.length; i++){ small.data[i*4] = small.data[i*4+1] = small.data[i*4+2] = 255; small.data[i*4+3] = mask[i]; }
  tx.clearRect(0, 0, n, n); tx.putImageData(small, 0, 0);
  const big = document.createElement("canvas"); big.width = doc.w; big.height = doc.h;
  const bx = big.getContext("2d", { willReadFrequently:true });
  bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = "high";
  bx.drawImage(thumb, 0, 0, doc.w, doc.h);
  const alpha = bx.getImageData(0, 0, doc.w, doc.h).data, out = new Uint8ClampedArray(doc.w * doc.h);
  for(let p = 0; p < out.length; p++) out[p] = alpha[p*4+3];
  return out;
}

export async function removeBackground(){
  const layer = rasterLayer(); if(!layer) return;
  let saved = "u2netp";
  try{ const v = localStorage.getItem(BG_KEY); if(BG_METHODS.some(([k]) => k === v)) saved = v; }catch{}
  const { sizeNote, crashedBefore } = await import("../ai/runtime.js");
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
  const { activeTab, switchTo } = await import("../core/documents.js"), tabId = activeTab()?.tabId;
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

/* ── Reducción de ruido ─────────────────────────────────────── */
export function denoisePixels(src,w,h,lumStrength,chromaStrength){
  const out=new Uint8ClampedArray(src), tmp=new Float32Array(src.length);
  const ls=lumStrength/100, cs=chromaStrength/100;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let sy=0,su=0,sv=0,sw=0; const ci=(y*w+x)*4;
    const cy=.299*src[ci]+.587*src[ci+1]+.114*src[ci+2];
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      const xx=Math.max(0,Math.min(w-1,x+ox)),yy=Math.max(0,Math.min(h-1,y+oy)),i=(yy*w+xx)*4;
      const Y=.299*src[i]+.587*src[i+1]+.114*src[i+2];
      const weight=Math.exp(-Math.abs(Y-cy)/22)*(ox||oy?1:2);
      sy+=Y*weight;su+=(src[i+2]-Y)*weight;sv+=(src[i]-Y)*weight;sw+=weight;
    }
    const fy=sy/sw,fu=su/sw,fv=sv/sw;
    const oy=cy+(fy-cy)*ls, ou=(src[ci+2]-cy)+(fu-(src[ci+2]-cy))*cs;
    const ov=(src[ci]-cy)+(fv-(src[ci]-cy))*cs;
    tmp[ci]=clamp(oy+ov);tmp[ci+2]=clamp(oy+ou);tmp[ci+1]=clamp((oy-.299*tmp[ci]-.114*tmp[ci+2])/.587);tmp[ci+3]=src[ci+3];
  }
  for(let i=0;i<out.length;i++) out[i]=tmp[i]; return out;
}

export async function reduceNoise(opts = {}){
  return liveDialog("Reducción de ruido", `
    ${sliderRow("dnLum","Luminancia",0,100,35,"%")}
    ${sliderRow("dnChroma","Color",0,100,60,"%")}
    <p class="hint">Suaviza el ruido conservando bordes mediante diferencias de luminancia.</p>`, {
    label: "Reducción de ruido",
    defaults: { lum: 35, chroma: 60 },
    compute: (src, w, h, p) => denoisePixels(src, w, h, p.lum, p.chroma),
    read: host => ({ lum: +host.querySelector("#dnLum").value, chroma: +host.querySelector("#dnChroma").value }),
    fill: (host, p) => fillFields(host, { dnLum: p.lum, dnChroma: p.chroma })
  }, opts);
}

/* ── Restauración con IA (SCUNet, FBCNN) ─────────────────────
   Modelos de ImageToolbox por teselas (ver js/ai/worker.js). Tardan
   demasiado para una vista previa en vivo, así que usan el diálogo de
   «aplicar al cerrar» y el resultado va, como el resto de efectos, a
   una capa de filtro nueva encima de la original. */
const AI_RESTORE = {
  scunet: { title: "Reducción de ruido con IA", label: "Reducción de ruido IA",
            hint: "SCUNet elimina el ruido real de cámara conservando el detalle. Trabaja por teselas; en imágenes grandes puede tardar unos minutos." },
  fbcnn:  { title: "Quitar artefactos JPEG con IA", label: "Artefactos JPEG IA",
            hint: "FBCNN elimina bloques, halos y bandas de compresión JPEG. Sube la intensidad cuanto más comprimida esté la imagen." }
};

async function aiRestore(id){
  const layer = rasterLayer(); if(!layer) return;
  const cfg = AI_RESTORE[id];
  if(id === "scunet" && COARSE){
    const { confirmDlg } = await import("../ui/dialog.js");
    if(!(await confirmDlg("Reducción de ruido con IA en el móvil",
      "SCUNet es un modelo grande (91 MB): en un móvil puede tardar varios minutos y calentar el teléfono. Si la página se cierra por falta de memoria, tu imagen se recupera al volver. ¿Continuar?", "Continuar"))) return;
  }
  const { sizeNote, runModel } = await import("../ai/runtime.js");
  const note = await sizeNote(id);
  const body = await settingsDialog(cfg.title, `
    <p class="hint">${cfg.hint}</p>
    ${id === "fbcnn" ? sliderRow("aiStrength", "Intensidad", 0, 100, 50, "%") : ""}
    <p class="hint">Modelo: ${id === "scunet" ? "SCUNet" : "FBCNN"} (${note}). Se procesa en este equipo.</p>`);
  if(!body) return;
  const strength = id === "fbcnn" ? +body.querySelector("#aiStrength").value : 0;
  const before = canvasCopy(layer.canvas);
  const w = layer.canvas.width, h = layer.canvas.height;
  const rgba = layer.ctx.getImageData(0, 0, w, h).data;
  let res;
  try{ res = await runModel("restore", id, { rgba, w, h, strength }, [rgba.buffer]); }
  catch(err){ toast(cfg.title + ": " + err.message, "err"); return; }
  layer.ctx.putImageData(new ImageData(res.rgba, w, h), 0, 0);
  commitEffect(layer, before, cfg.label, id === "fbcnn" ? { strength } : {});
}

export const aiDenoise = () => aiRestore("scunet");
export const aiDejpeg  = () => aiRestore("fbcnn");

/* ── Corrección de lente ────────────────────────────────────── */
function bilinear(src,w,h,x,y,c){
  x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
  const x0=x|0,y0=y|0,x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
  const a=src[(y0*w+x0)*4+c],b=src[(y0*w+x1)*4+c],d=src[(y1*w+x0)*4+c],e=src[(y1*w+x1)*4+c];
  return (a+(b-a)*fx)*(1-fy)+(d+(e-d)*fx)*fy;
}
export function correctLensPixels(src,w,h,{distortion=0,ca=0,vignette=0}={}){
  const out=new Uint8ClampedArray(src.length),k=distortion/100,aspect=w/h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const nx=(x/(w-1)-.5)*2*aspect,ny=(y/(h-1)-.5)*2,r2=nx*nx+ny*ny;
    const f=1+k*r2*.32,sx=(nx*f/aspect*.5+.5)*(w-1),sy=(ny*f*.5+.5)*(h-1);
    const len=Math.sqrt(r2)||1,dx=ca*(nx/len),dy=ca*(ny/len),i=(y*w+x)*4;
    out[i]=bilinear(src,w,h,sx+dx,sy+dy,0);out[i+1]=bilinear(src,w,h,sx,sy,1);out[i+2]=bilinear(src,w,h,sx-dx,sy-dy,2);
    const gain=1+(vignette/100)*Math.min(1,r2/(aspect*aspect+1)*2);
    out[i]=clamp(out[i]*gain);out[i+1]=clamp(out[i+1]*gain);out[i+2]=clamp(out[i+2]*gain);out[i+3]=bilinear(src,w,h,sx,sy,3);
  }return out;
}
export async function lensCorrection(opts = {}){
  return liveDialog("Corrección de lente", `
    <div class="field"><label>Perfil</label><select id="lensProfile" class="grow"><option value="manual">Manual</option><option value="auto">Automático desde EXIF</option></select></div>
    <div class="field"><label>Base de datos</label><button id="lensImport" type="button" class="grow">Importar perfil JSON…</button><input id="lensProfileFile" type="file" accept="application/json,.json" hidden></div>
    ${sliderRow("lensDist","Distorsión",-100,100,0)}
    ${sliderRow("lensCA","Aberración cromática",-6,6,0," px",.25)}
    ${sliderRow("lensVig","Compensar viñeteado",-100,100,0,"%")}`, {
    label: "Corrección de lente",
    defaults: { distortion: 0, ca: 0, vignette: 0 },
    // `ca` está en píxeles ABSOLUTOS: en el proxy reducido de la vista
    // previa hay que encogerlo en la misma proporción, o la
    // aberración cromática se vería más marcada ahí que en el
    // resultado final a resolución completa (el resto de parámetros
    // ya son relativos al tamaño de la imagen, vía `nx`/`ny`
    // normalizados, y no necesitan este ajuste).
    compute: (src, w, h, p, scale = 1) => correctLensPixels(src, w, h, {
      distortion: p.distortion, ca: p.ca * scale, vignette: p.vignette
    }),
    read: host => ({
      distortion: +host.querySelector("#lensDist").value,
      ca: +host.querySelector("#lensCA").value,
      vignette: +host.querySelector("#lensVig").value
    }),
    fill: (host, p) => fillFields(host, { lensDist: p.distortion, lensCA: p.ca, lensVig: p.vignette })
  }, opts);
}

/* ── Enfoque selectivo ──────────────────────────────────────── */
const skinLike=(r,g,b)=>r>70&&r>g*1.05&&g>b*.9&&r-b>15;
export function selectiveSharpenPixels(src,w,h,{amount=70,threshold=10,protectSkin=true,protectSky=true}={}){
  const out=new Uint8ClampedArray(src),a=amount/100;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=(y*w+x)*4,r=src[i],g=src[i+1],b=src[i+2];
    if(protectSkin&&skinLike(r,g,b))continue;
    const sky=protectSky&&b>r*1.12&&b>g*1.05;
    for(let c=0;c<3;c++){
      let sum=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)sum+=src[((y+oy)*w+x+ox)*4+c];
      const diff=src[i+c]-sum/9;if(Math.abs(diff)>threshold&&!sky)out[i+c]=clamp(src[i+c]+diff*a);
    }
  }return out;
}
export async function selectiveSharpen(opts = {}){
  return liveDialog("Enfoque selectivo", `
    <p class="hint" style="margin-top:0">Realza los bordes (como Enfocar), pero salta los tonos
      de piel y los cielos azules lisos para no dejarlos granulados: son las dos zonas donde
      cualquier enfoque se nota antes y peor. Sube la Cantidad para ver el efecto con claridad;
      el Umbral evita amplificar el ruido fino de las zonas ya lisas.</p>
    ${sliderRow("ssAmount","Cantidad",0,200,70,"%")}
    ${sliderRow("ssThreshold","Umbral",0,50,8)}
    <label class="chk"><input id="ssSkin" type="checkbox" checked> Proteger tonos de piel</label>
    <label class="chk"><input id="ssSky" type="checkbox" checked> Proteger cielos y zonas azules lisas</label>`, {
    label: "Enfoque selectivo",
    defaults: { amount: 70, threshold: 8, protectSkin: true, protectSky: true },
    compute: (src, w, h, p) => selectiveSharpenPixels(src, w, h, p),
    read: host => ({
      amount: +host.querySelector("#ssAmount").value,
      threshold: +host.querySelector("#ssThreshold").value,
      protectSkin: host.querySelector("#ssSkin").checked,
      protectSky: host.querySelector("#ssSky").checked
    }),
    fill: (host, p) => fillFields(host, { ssAmount: p.amount, ssThreshold: p.threshold, ssSkin: p.protectSkin, ssSky: p.protectSky })
  }, opts);
}

/* ── Máscaras por luminosidad o color ───────────────────────── */
function rgbHue(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(!d)return 0;
  let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return (h*60+360)%360;}
export function rangeMask(src,w,h,{mode="lum",low=64,high=192,hue=0,tolerance=30}={}){
  const m=new Uint8ClampedArray(w*h);
  for(let p=0,i=0;p<m.length;p++,i+=4){
    if(mode==="lum"){const y=.2126*src[i]+.7152*src[i+1]+.0722*src[i+2];
      const edge=Math.max(1,Math.min(32,(high-low)/4));m[p]=clamp(Math.min((y-low)/edge,(high-y)/edge,1)*255);}
    else{const h0=rgbHue(src[i],src[i+1],src[i+2]),d=Math.min(Math.abs(h0-hue),360-Math.abs(h0-hue));m[p]=clamp((1-d/Math.max(1,tolerance))*255);}
  }return m;
}
/* El panel de verdad —quince niveles de luz/medios/sombras, vista
   previa y salida directa a máscara de capa— vive en
   editor/luminositymasks.js, que reutiliza esta misma `rangeMask` para
   su modo «color»; este diálogo de un solo modo quedó sustituido por
   ese panel (ver sel.rangeMask en main.js) y no lo llama nadie más. */

/* ── Máscara lineal o radial ────────────────────────────────── */
export function gradientMask(w,h,{kind="linear",angle=0,centerX=50,centerY=50,size=50,invert=false}={}){
  const m=new Uint8ClampedArray(w*h),rad=angle*Math.PI/180,cx=w*centerX/100,cy=h*centerY/100;
  const scale=Math.max(1,Math.min(w,h)*size/100),dx=Math.cos(rad),dy=Math.sin(rad);
  for(let y=0,p=0;y<h;y++)for(let x=0;x<w;x++,p++){
    let v=kind==="radial"?1-Math.hypot(x-cx,y-cy)/scale:.5+((x-cx)*dx+(y-cy)*dy)/(scale*2);
    v=Math.max(0,Math.min(1,v));if(invert)v=1-v;m[p]=Math.round(v*255);
  }return m;
}
export async function gradientLayerMask(){
  const layer=rasterLayer();if(!layer)return;if(layer.mask){toast("La capa ya tiene una máscara");return;}
  const body=await settingsDialog("Máscara degradada",`
    <div class="field"><label>Forma</label><select id="gmKind" class="grow"><option value="linear">Lineal</option><option value="radial">Radial</option></select></div>
    ${sliderRow("gmAngle","Ángulo",-180,180,0,"°")}${sliderRow("gmX","Centro X",0,100,50,"%")}${sliderRow("gmY","Centro Y",0,100,50,"%")}${sliderRow("gmSize","Extensión",5,150,55,"%")}
    <label class="chk"><input id="gmInvert" type="checkbox"> Invertir máscara</label>`);
  if(!body)return;doc.selection={mask:gradientMask(doc.w,doc.h,{kind:body.querySelector("#gmKind").value,angle:+body.querySelector("#gmAngle").value,centerX:+body.querySelector("#gmX").value,centerY:+body.querySelector("#gmY").value,size:+body.querySelector("#gmSize").value,invert:body.querySelector("#gmInvert").checked}),w:doc.w,h:doc.h};
  addMask(layer,true);doc.selection=null;emit("doc:structure");emit("doc:change");toast("Máscara degradada añadida", "ok");
}

/* ── Retrato ──────────────────────────────────────────────────
   La versión anterior tenía dos problemas de fondo, no de matiz:

   1. `skinLike` era un SÍ/NO binario. En el propio límite del umbral,
      variaciones de color naturales de la piel (una sombra suave, un
      poro algo más rojo) hacen que un píxel entre y el vecino salga,
      así que el suavizado se aplicaba a parches con un borde visible
      en vez de a una zona continua: el clásico aspecto «de plástico a
      trozos» del retoque de piel mal hecho.

   2. El radio de muestreo era SIEMPRE de 1 píxel (una media de 3×3),
      sin relación con el tamaño de la imagen ni con el deslizador de
      cantidad. En una foto de varios megapíxeles, difuminar un solo
      píxel de radio no toca ni los poros más finos: subir «Suavizado»
      al máximo apenas cambiaba nada visible, que es justo el «no
      funciona bien» que se reportó.

   Esta versión sustituye el umbral por un peso continuo (0 a 1, sin
   escalón), liga el radio de suavizado al tamaño real del documento y
   al deslizador, y protege los bordes de verdad: sólo se difumina
   donde la imagen YA es plana alrededor —piel lisa—, no donde hay
   contraste local fuerte —el borde de un ojo, una ceja, el contorno
   de los labios—, comparando la imagen con una versión de referencia
   desenfocada a un radio pequeño y fijo. */

const smoothstep = (lo, hi, x) => { const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

/* Peso de "parece piel", continuo en vez de todo-o-nada. Mismas
   condiciones que el umbral original, cada una convertida en una
   rampa suave alrededor de su mismo punto de corte. */
function skinWeight(r, g, b){
  return smoothstep(60, 90, r) *
         smoothstep(0.95, 1.15, r / Math.max(1, g)) *
         smoothstep(0.80, 1.00, g / Math.max(1, b)) *
         smoothstep(5, 25, r - b);
}

/* Desenfoque de caja separable con ventana deslizante: el coste no
   depende del radio, sólo del número de píxeles. Hace falta porque
   aquí el radio escala con el documento y puede ser de varias decenas
   de píxeles —una caja ingenua de radio 30 recorriendo cada píxel
   sería, en una foto de varios megapíxeles, órdenes de magnitud más
   lenta que esto—. */
function boxBlur(src, w, h, radius){
  if(radius <= 0) return Float32Array.from(src);
  const clampi = (v, hi) => v < 0 ? 0 : v > hi ? hi : v;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  const size = radius * 2 + 1;
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let c = 0; c < 4; c++){
      let sum = 0;
      for(let x = -radius; x <= radius; x++) sum += src[(row + clampi(x, w - 1)) * 4 + c];
      for(let x = 0; x < w; x++){
        tmp[(row + x) * 4 + c] = sum / size;
        sum += src[(row + clampi(x + radius + 1, w - 1)) * 4 + c] -
               src[(row + clampi(x - radius, w - 1)) * 4 + c];
      }
    }
  }
  for(let x = 0; x < w; x++){
    for(let c = 0; c < 4; c++){
      let sum = 0;
      for(let y = -radius; y <= radius; y++) sum += tmp[(clampi(y, h - 1) * w + x) * 4 + c];
      for(let y = 0; y < h; y++){
        out[(y * w + x) * 4 + c] = sum / size;
        sum += tmp[(clampi(y + radius + 1, h - 1) * w + x) * 4 + c] -
               tmp[(clampi(y - radius, h - 1) * w + x) * 4 + c];
      }
    }
  }
  return out;
}

export function portraitPixels(src, w, h, { smooth = 25, shine = 20, redEye = 60 } = {}){
  const out = new Uint8ClampedArray(src);
  const n = src.length;

  // Radio de suavizado: proporcional al deslizador Y al tamaño real
  // del documento (2 % del lado menor en el máximo), para que el
  // efecto se note igual de bien en una miniatura que en una foto de
  // 24 MP. Tope de 40 px por rendimiento en documentos enormes.
  const smoothT = smooth / 100;
  const radius = Math.round(smoothT * Math.min(40, Math.max(2, Math.min(w, h) * 0.02)));
  // Referencia de contraste local: un radio pequeño y FIJO, no ligado
  // al deslizador, así que sigue distinguiendo piel de bordes sea cual
  // sea la cantidad de suavizado pedida.
  const EDGE_R = 2;

  const smoothed = radius > 0 ? boxBlur(src, w, h, radius) : null;
  const edgeRef  = boxBlur(src, w, h, EDGE_R);

  for(let p = 0, i = 0; p < w * h; p++, i += 4){
    const r = src[i], g = src[i + 1], b = src[i + 2];

    let rr = r, gg = g, bb = b;

    if(redEye && r > g * 1.4 && r > b * 1.4 && r > 70){
      const t = smoothstep(1.4, 1.9, Math.min(r / Math.max(1, g), r / Math.max(1, b))) *
                smoothstep(70, 110, r) * (redEye / 100);
      const avg = (g + b) / 2;
      rr = r + (avg - r) * t;
    }

    if(smoothed && smoothT > 0){
      const sw = skinWeight(r, g, b);
      if(sw > 0.001){
        // Cuánto se protege este píxel de tocarse: alto si hay un
        // borde de verdad cerca (el color local cambia deprisa), bajo
        // en piel lisa. Se mide sobre el canal ROJO, el más estable
        // entre piel e iluminación.
        const localContrast = Math.abs(r - edgeRef[i]) + Math.abs(g - edgeRef[i+1]) + Math.abs(b - edgeRef[i+2]);
        const edgeProtect = 1 - smoothstep(10, 45, localContrast);
        const blend = sw * smoothT * edgeProtect;
        if(blend > 0.001){
          rr = rr + (smoothed[i]   - rr) * blend;
          gg = gg + (smoothed[i+1] - gg) * blend;
          bb = bb + (smoothed[i+2] - bb) * blend;
        }
      }
    }

    if(shine > 0){
      // Los brillos se miden sobre la versión YA local-suavizada
      // (edgeRef), no sobre el píxel crudo: así el punto de corte no
      // depende del ruido de un solo píxel, que es lo que antes daba
      // un moteado en vez de una reducción de brillo continua.
      const lLocal = (edgeRef[i] + edgeRef[i+1] + edgeRef[i+2]) / 3;
      const t = smoothstep(165, 220, lLocal) * (shine / 100) * 55;
      if(t > 0){ rr -= t; gg -= t; bb -= t; }
    }

    out[i] = clamp(rr); out[i+1] = clamp(gg); out[i+2] = clamp(bb);
  }
  return out;
}
export async function portraitRetouch(opts = {}){
  return liveDialog("Retoque de retrato", `
    ${sliderRow("portraitSmooth","Suavizado de piel",0,100,25,"%")}${sliderRow("portraitShine","Reducir brillos",0,100,20,"%")}${sliderRow("portraitEye","Corregir ojos rojos",0,100,70,"%")}
    <p class="hint">Trabaja sólo sobre colores compatibles con piel y píxeles rojos intensos, protegiendo
      ojos, cejas y demás bordes reales para que la piel no quede de plástico.</p>`, {
    label: "Retoque de retrato",
    defaults: { smooth: 25, shine: 20, redEye: 70 },
    compute: (src, w, h, p) => portraitPixels(src, w, h, p),
    read: host => ({
      smooth: +host.querySelector("#portraitSmooth").value,
      shine: +host.querySelector("#portraitShine").value,
      redEye: +host.querySelector("#portraitEye").value
    }),
    fill: (host, p) => fillFields(host, { portraitSmooth: p.smooth, portraitShine: p.shine, portraitEye: p.redEye })
  }, opts);
}

/* ── Transformación de capa ─────────────────────────────────── */
export async function transformLayer(){
  const layer=rasterLayer();if(!layer)return;const body=await settingsDialog("Transformar capa",`
    ${sliderRow("trScale","Escala",10,300,100,"%")}${sliderRow("trRotate","Rotación",-180,180,0,"°")}${sliderRow("trSkewX","Inclinar X",-60,60,0,"°")}${sliderRow("trSkewY","Inclinar Y",-60,60,0,"°")}
    <label class="chk"><input id="trFlipH" type="checkbox"> Voltear horizontalmente</label><label class="chk"><input id="trFlipV" type="checkbox"> Voltear verticalmente</label>`);if(!body)return;
  const before=canvasCopy(layer.canvas),beforeMask=layer.mask?canvasCopy(layer.mask.canvas):null;
  const oldType=layer.type,oldText=deep(layer.text||null),cx=doc.w/2,cy=doc.h/2;
  const applyTransform=(ctx,src)=>{ctx.save();ctx.globalCompositeOperation="copy";ctx.clearRect(0,0,doc.w,doc.h);ctx.translate(cx,cy);ctx.rotate(+body.querySelector("#trRotate").value*Math.PI/180);ctx.transform(1,Math.tan(+body.querySelector("#trSkewY").value*Math.PI/180),Math.tan(+body.querySelector("#trSkewX").value*Math.PI/180),1,0,0);const s=+body.querySelector("#trScale").value/100;ctx.scale((body.querySelector("#trFlipH").checked?-1:1)*s,(body.querySelector("#trFlipV").checked?-1:1)*s);ctx.drawImage(src,-cx,-cy);ctx.restore();};
  applyTransform(layer.ctx,canvasCopy(before));if(layer.mask)applyTransform(layer.mask.ctx,canvasCopy(beforeMask));
  if(layer.type==="text"){layer.type="raster";layer.text=null;}
  const after=canvasCopy(layer.canvas),afterMask=layer.mask?canvasCopy(layer.mask.canvas):null;
  const set=(pixels,mask,type,text)=>{restore(layer,pixels);if(layer.mask&&mask){layer.mask.ctx.save();layer.mask.ctx.globalCompositeOperation="copy";layer.mask.ctx.drawImage(mask,0,0);layer.mask.ctx.restore();}layer.type=type;layer.text=deep(text);emit("doc:structure");emit("doc:change");};
  record("Transformar capa",()=>set(before,beforeMask,oldType,oldText),()=>set(after,afterMask,"raster",null));layer.thumbDirty=true;emit("doc:structure");emit("doc:change");toast("Transformación aplicada", "ok");
}

/* ── Simulación de compresión social ────────────────────────── */
const SOCIAL={instagram:{label:"Instagram",max:1440,q:.78},whatsapp:{label:"WhatsApp",max:1600,q:.72},facebook:{label:"Facebook",max:2048,q:.76},x:{label:"X",max:4096,q:.82}};
export async function socialPreview(){
  const body=document.createElement("div");body.innerHTML=`<div class="field"><label>Servicio</label><select id="spPlatform" class="grow">${Object.entries(SOCIAL).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join("")}</select></div><div class="preview-pair"><div><span>Original</span><canvas id="spBefore"></canvas></div><div><span>Simulación</span><canvas id="spAfter"></canvas></div></div><p class="hint" id="spInfo">Calculando…</p>`;
  await dialog({title:"Prueba de compresión para redes sociales",body,wide:true,buttons:[{label:"Cerrar",primary:true,value:null}],onOpen:host=>{
    const update=async()=>{const p=SOCIAL[host.querySelector("#spPlatform").value],scale=Math.min(1,p.max/Math.max(doc.w,doc.h)),w=Math.round(doc.w*scale),h=Math.round(doc.h*scale);const blob=await renderExport({w,h,type:"image/jpeg",quality:p.q});for(const [id,source] of [["spBefore",await renderExport({w,h,type:"image/png"})],["spAfter",blob]]){const b=await createImageBitmap(source),c=host.querySelector("#"+id);c.width=w;c.height=h;c.getContext("2d").drawImage(b,0,0);b.close();}host.querySelector("#spInfo").textContent=`${w} × ${h} · calidad simulada ${Math.round(p.q*100)} · ${Math.round(blob.size/1024)} KB. Es una aproximación: cada plataforma puede cambiar su compresor.`;};host.querySelector("#spPlatform").addEventListener("change",update);update();}});
}

/* ── Marca de agua ──────────────────────────────────────────── */
export async function watermark(){
  const body=await settingsDialog("Marca de agua",`<div class="field"><label>Texto</label><input id="wmText" class="grow" value="© ${doc.name || "Realify"}"></div><div class="field"><label>Logotipo</label><input id="wmLogo" class="grow" type="file" accept="image/*"></div><p class="hint">Si eliges un logotipo, sustituirá al texto.</p><div class="field"><label>Posición</label><select id="wmPos" class="grow"><option value="br">Abajo derecha</option><option value="bl">Abajo izquierda</option><option value="center">Centro</option><option value="tile">Repetida</option></select></div>${sliderRow("wmOpacity","Opacidad",5,100,45,"%")}${sliderRow("wmSize","Tamaño",10,300,32," px")}<div class="field"><label>Color</label><input id="wmColor" type="color" value="#ffffff"></div>`);if(!body)return;
  const text=body.querySelector("#wmText").value.trim(),logoFile=body.querySelector("#wmLogo").files[0];if(!text&&!logoFile)return;const layer=addLayer({name:"Marca de agua"}),x=layer.ctx,size=+body.querySelector("#wmSize").value,pos=body.querySelector("#wmPos").value;x.globalAlpha=+body.querySelector("#wmOpacity").value/100;const pad=Math.max(12,size*.5);
  if(logoFile){const bmp=await createImageBitmap(logoFile),dw=size*(bmp.width/bmp.height),dh=size;const px=pos==="bl"?pad:pos==="center"?(doc.w-dw)/2:doc.w-pad-dw,py=pos==="center"?(doc.h-dh)/2:doc.h-pad-dh;if(pos==="tile")for(let yy=pad;yy<doc.h;yy+=dh*3)for(let xx=pad;xx<doc.w;xx+=dw*2)x.drawImage(bmp,xx,yy,dw,dh);else x.drawImage(bmp,px,py,dw,dh);bmp.close();}
  else{x.font=`600 ${size}px sans-serif`;x.fillStyle=body.querySelector("#wmColor").value;x.textBaseline="bottom";const width=x.measureText(text).width;
  if(pos==="tile"){x.textAlign="center";x.translate(doc.w/2,doc.h/2);x.rotate(-Math.PI/6);for(let yy=-doc.h;yy<doc.h*1.5;yy+=size*4)for(let xx=-doc.w;xx<doc.w*1.5;xx+=width+size*3)x.fillText(text,xx-doc.w/2,yy-doc.h/2);}
  else{x.textAlign=pos==="bl"?"left":pos==="center"?"center":"right";const px=pos==="bl"?pad:pos==="center"?doc.w/2:doc.w-pad,py=pos==="center"?doc.h/2+size/2:doc.h-pad;x.fillText(text,px,py);}}
  x.globalAlpha=1;layer.thumbDirty=true;const index=doc.layers.indexOf(layer);
  record("Añadir marca de agua",()=>{const i=doc.layers.indexOf(layer);if(i>=0)doc.layers.splice(i,1);doc.activeId=doc.layers[Math.max(0,index-1)]?.id||null;emit("doc:structure");emit("doc:change");},()=>{if(!doc.layers.includes(layer))doc.layers.splice(Math.min(index,doc.layers.length),0,layer);doc.activeId=layer.id;emit("doc:structure");emit("doc:change");});
  emit("doc:structure");emit("doc:change");toast("Marca de agua añadida en una capa nueva", "ok");
}

export { SOCIAL };
