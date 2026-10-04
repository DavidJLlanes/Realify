/* Exportación. El diálogo enseña el peso estimado antes de guardar,
   que es la pregunta que uno se hace y que casi ninguna herramienta
   responde hasta después de descargar. */

import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { prepareForType, hasTransparency, alphaFieldsHTML, wireAlphaFields } from "./alpha.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { sanitizeFilename, safeWebFilename } from "./export-utils.js";
import { isP3Doc, toSrgbCanvas } from "../core/colorspace.js";
import { docHasHi } from "../core/hisrc.js";
import { codecMaxPixels } from "./codecs.js";
import { highPrecisionAvailableFor, highPrecisionCapabilities, renderHighPrecisionCanvas, renderPrecisionAdjustmentStack } from "../core/high-precision-safe.js?v=4";
export { sanitizeFilename, safeWebFilename } from "./export-utils.js";

export function download(blob, name){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const canPickExportFile = () => typeof window.showSaveFilePicker === "function";

const isTouchDevice = () =>
  matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;

const isAppleDevice = () => {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPad|iPhone|iPod|Macintosh/.test(ua) || /Mac|iPhone|iPad|iPod/.test(platform);
};

const shareFile = async (blob, name) => {
  if(typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return false;
  const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
  if(!navigator.canShare({ files: [file] })) return false;
  await navigator.share({ files: [file], title: name });
  return true;
};

function pickerTypes(type){
  if(type === "application/vnd.realify+json"){
    return [{ description: "Proyecto Realify", accept: { "application/vnd.realify+json": [".realify"] } }];
  }
  if(type === "image/png"){
    return [{ description: "PNG", accept: { "image/png": [".png"] } }];
  }
  if(type === "image/webp"){
    return [{ description: "WebP", accept: { "image/webp": [".webp"] } }];
  }
  if(type === "image/avif") return [{ description: "AVIF", accept: { "image/avif": [".avif"] } }];
  if(type === "image/jxl") return [{ description: "JPEG XL", accept: { "image/jxl": [".jxl"] } }];
  if(type === "image/x-exr") return [{ description: "OpenEXR", accept: { "image/x-exr": [".exr"] } }];
  if(type === "image/tiff") return [{ description: "TIFF", accept: { "image/tiff": [".tif", ".tiff"] } }];
  if(type === "image/gif") return [{ description: "GIF", accept: { "image/gif": [".gif"] } }];
  if(type === "application/pdf") return [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }];
  return [{ description: "JPEG", accept: { "image/jpeg": [".jpg", ".jpeg"] } }];
}

async function saveWithPicker(blob, name){
  if(!canPickExportFile()) return false;
  const handle = await window.showSaveFilePicker({
    suggestedName: name,
    types: pickerTypes(blob.type),
    excludeAcceptAllOption: false
  });
  const writable = await handle.createWritable();
  try{
    await writable.write(blob);
  }finally{
    await writable.close();
  }
  return true;
}

/* En el escritorio, `<a download>` es fiable de sobra. En el móvil no
   tanto: Safari y Chrome para Android no siempre dejan claro que el
   archivo se ha guardado, y en algunas versiones ni siquiera ofrecen
   una carpeta de descargas visible desde la propia galería. La API
   de compartir, cuando existe, abre la hoja nativa del sistema con
   «Guardar en Fotos» / «Guardar en archivo», que es exactamente
   donde alguien espera que acabe una foto retocada. Se intenta
   primero ahí y sólo se cae a la descarga clásica si no está
   disponible, el navegador la rechaza, o el usuario cancela. */
export async function saveOrShare(blob, name, mode = "auto"){
  if(mode === "picker"){
    try{
      if(await saveWithPicker(blob, name)) return "picked";
    }catch(err){
      if(err && err.name === "AbortError") return "cancelled";
      throw err;
    }
  }

  if(mode === "share" || mode === "gallery" ||
     ((mode === "auto" || mode === "picker") && isTouchDevice() && !canPickExportFile())){
    try{
      if(await shareFile(blob, name)) return mode === "gallery" ? "gallery" : "shared";
    }catch(err){
      if(err && err.name === "AbortError") return "cancelled";   // el usuario cerró la hoja
      // Cualquier otro fallo (formato no admitido, etc.): se cae a la descarga normal
    }
  }

  if(mode === "download" || mode === "auto" || mode === "picker" || mode === "share" || mode === "gallery"){
    download(blob, name);
    return "downloaded";
  }

  download(blob, name);
  return "downloaded";
}

/* Quita lo que ningún sistema de archivos deja usar en un nombre
   (Windows es el más estricto de los tres) y los espacios sobrantes
   en los bordes, sin tocar nada más: acentos, mayúsculas y espacios
   internos se quedan tal cual los escribió quien exporta. */
export function compatibilityInfo(){
  const picker = canPickExportFile();
  const share = typeof navigator.canShare === "function" && typeof navigator.share === "function";
  const apple = isAppleDevice();
  const device = apple ? "Apple" : isTouchDevice() ? "móvil" : "ordenador";
  let message;
  if(apple && share) message = "En iPhone, iPad o Mac se abrirá la hoja de compartir para guardar en Fotos o Archivos.";
  else if(!picker && isTouchDevice()) message = "Este navegador no permite elegir una carpeta directamente; se usará Compartir o Descargas.";
  else if(!picker) message = "Este navegador no permite elegir carpeta; el archivo irá a Descargas.";
  else message = "Este navegador permite elegir nombre y ubicación al guardar.";
  return { picker, share, apple, device, message };
}

export const EXPORT_PRESETS = {
  original:{ label:"Personalizada / tamaño actual", max:0, type:"image/jpeg", quality:90, clean:false, kb:0 },
  web:{ label:"Web optimizada", max:2560, type:"image/webp", quality:82, clean:true, kb:500 },
  instagram:{ label:"Instagram", max:1440, type:"image/jpeg", quality:82, clean:true, kb:1000 },
  youtube:{ label:"YouTube / miniatura", max:1920, type:"image/jpeg", quality:86, clean:true, kb:2000 },
  marketplace:{ label:"Marketplace", max:2000, type:"image/jpeg", quality:88, clean:true, kb:1500 },
  email:{ label:"Correo electrónico", max:1600, type:"image/jpeg", quality:75, clean:true, kb:500 },
  wallpaper:{ label:"Fondo de pantalla", max:3840, type:"image/jpeg", quality:92, clean:true, kb:5000 },
  print:{ label:"Impresión", max:0, type:"image/png", quality:100, clean:false, kb:0 }
};

export function stamp(){
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
         "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

let lastPrecisionInfo={mode:"compatible",reason:"Motor rápido"};
/* Formatos de más de 8 bits (PNG/TIFF 16, AVIF 10/12) y OpenEXR: parten de
   los 16 bits del motor de alta precisión, así que lo piden siempre. */
const is16 = t => /;(10|12|16)$/.test(t) || t === "image/x-exr";
const avifDepth = t => { const m = /^image\/avif;(10|12)$/.exec(t); return m ? +m[1] : 0; };
const extOfType = t => ({ "image/png": "png", "image/png;16": "png", "image/webp": "webp", "image/avif": "avif",
  "image/avif;10": "avif", "image/avif;12": "avif", "image/jxl": "jxl", "image/x-exr": "exr",
  "image/tiff": "tif", "image/tiff;16": "tif", "application/pdf": "pdf" })[t] || "jpg";
const depthText = t => /;16$/.test(t) ? " · 16 bits" : avifDepth(t) ? ` · ${avifDepth(t)} bits` : t === "image/x-exr" ? " · EXR half" : "";
export const exportPrecisionInfo=()=>({...lastPrecisionInfo});

/* `alpha`: conservar la transparencia si el formato la admite (PNG, WebP,
   AVIF). Si no la admite —JPEG, PDF— o no se quiere, las zonas
   transparentes se rellenan con `background` (ver io/alpha.js). Lo que se
   guarda es siempre el acoplado de las capas visibles. */
export async function renderExport({ w, h, type, quality, precision = false, dither = false, alpha = true, background = "#ffffff", colorSpace = "auto" }){
  let flat = null, out = null;
  /* «image/png;16» y «image/tiff;16»: 16 bits por canal, siempre con el
     motor de alta precisión (core/precision-stack.js). */
  const bits16 = /;16$/.test(type), deepAvif = avifDepth(type), isExr = type === "image/x-exr", isJxl = type === "image/jxl";
  /* Documento en Display P3 (core/colorspace.js): JPEG, PNG, AVIF, EXR y los
     de 16 bits se guardan en P3 con su perfil o etiqueta de color; el resto
     de formatos (sin perfil: WebP, JPEG XL, TIFF de 8 bits, PDF) y quien
     pida sRGB, convertidos a sRGB. */
  const keepP3 = isP3Doc() && colorSpace !== "srgb" && (bits16 || deepAvif || isExr || ["image/jpeg", "image/png", "image/avif"].includes(type));
  const toSrgb = isP3Doc() && !keepP3;
  /* AVIF y JPEG XL necesitan varias veces el tamaño de la imagen en memoria */
  if((deepAvif || isJxl) && w * h > codecMaxPixels())
    throw new Error(`${isJxl ? "JPEG XL" : "AVIF de " + deepAvif + " bits"} admite hasta ${Math.round(codecMaxPixels() / 1e6)} megapíxeles en este dispositivo: reduce el tamaño`);
  if(bits16 || deepAvif || isExr){
    const precise = await renderPrecisionAdjustmentStack(w, h, { bits16: true, alpha, background, layersOnly: false, srgb: toSrgb });
    if(!precise?.data16) throw new Error(precise?.reason || "No se pudo preparar la exportación de " + (deepAvif || 16) + " bits");
    lastPrecisionInfo = { mode: precise.mode, reason: precise.reason };
    const d16 = precise.data16, space = d16.space === "display-p3" ? "display-p3" : "srgb";
    if(deepAvif) return (await import("./codecs.js")).encodeAvifDeep({ data: d16.data, channels: d16.channels, width: d16.w || w, height: d16.h || h }, deepAvif, { quality: Math.round((quality ?? .8) * 100), space });
    if(isExr){
      const X = await import("./exr.js");
      return X.encodeExr({ width: d16.w || w, height: d16.h || h, hasAlpha: d16.channels === 4, space,
        getLine: X.lineReaderFromData16({ data: d16.data, channels: d16.channels, width: d16.w || w }) });
    }
    const f16 = await import("./formats16.js");
    return type.startsWith("image/png") ? f16.png16(d16) : f16.tiff16(d16);
  }
  if(precision){
    /* Primero, la pila completa recompuesta en coma flotante (capas,
       ajustes, fusión y remuestreo lineal). Si el documento usa algo
       que ese motor aún no reproduce, el compuesto de 8 bits con
       remuestreo de alta precisión; y si no cabe en memoria, el motor
       compatible de siempre. */
    let precise = await renderPrecisionAdjustmentStack(w, h, { dither, layersOnly: false });
    if(!precise?.canvas) precise = renderHighPrecisionCanvas(flat = flatten(), w, h, { dither });
    lastPrecisionInfo={mode:precise.mode,reason:precise.reason};
    if(precise.canvas)out=precise.canvas;
  }
  if(!flat)flat=flatten();
  if(!out)out=flat;
  if(out===flat && (w !== doc.w || h !== doc.h)){
    out = document.createElement("canvas");
    out.width = w; out.height = h;
    const x = out.getContext("2d", { colorSpace:"srgb" });
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = "high";
    // Reducciones fuertes en pasos de mitad: una sola llamada con
    // factor menor que 0.5 alias visiblemente en varios navegadores.
    let src = flat, sw = doc.w, sh = doc.h;
    while(sw * 0.5 > w && sh * 0.5 > h){
      const t = document.createElement("canvas");
      t.width = Math.max(1, sw >> 1); t.height = Math.max(1, sh >> 1);
      const tx = t.getContext("2d", { colorSpace:"srgb" });
      tx.imageSmoothingQuality = "high";
      tx.drawImage(src, 0, 0, t.width, t.height);
      src = t; sw = t.width; sh = t.height;
    }
    x.drawImage(src, 0, 0, w, h);
  }
  if(!precision)lastPrecisionInfo={mode:"compatible",reason:"Motor rápido"};
  if(toSrgb) out = toSrgbCanvas(out);
  out = prepareForType(out, type, { alpha, background });
  /* AVIF, JPEG XL y PDF no los genera `toBlob`: ver io/formats.js y io/codecs.js */
  if(type === "image/avif") return (await import("./formats.js")).avifFromCanvas(out, quality ?? .6, keepP3 ? "display-p3" : "srgb").catch(() => null);
  if(isJxl){
    const px = out.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, out.width, out.height, { colorSpace: "srgb" }).data;
    return (await import("./codecs.js")).encodeJxl(px, out.width, out.height, { quality: Math.round((quality ?? .85) * 100) });
  }
  if(type === "application/pdf") return (await import("./formats.js")).pdfFromCanvases([out], { ...pdfOptions, quality: quality ?? .9 }).catch(() => null);
  if(type === "image/tiff") return (await import("./professional-formats.js")).tiffFromCanvas(out);
  const blob = await new Promise(res => out.toBlob(res, type, quality));
  return keepP3 ? (await import("./icc-embed.js")).ensureIcc(blob, "display-p3") : blob;
}
/* Página del PDF (la elige el diálogo de exportar) */
let pdfOptions = { page: "image", orientation: "auto", margin: 0 };

/* Codifica repetidamente hasta respetar el peso pedido. Primero baja la
   calidad de JPEG/WebP y, sólo si hace falta, reduce dimensiones. PNG no
   tiene control de calidad, así que usa únicamente la segunda estrategia. */
export async function renderCleanWeb({ w, h, type, quality = .82, maxBytes = 500 * 1024, alpha = true, background = "#ffffff" }){
  let cw = Math.max(1, Math.round(w)), ch = Math.max(1, Math.round(h));
  let q = type === "image/png" ? undefined : Math.max(.45, Math.min(.92, quality));
  // «Limpio para web»: siempre sRGB, lo que mejor entiende cualquier web
  let blob = await renderExport({ w:cw, h:ch, type, quality:q, alpha, background, colorSpace:"srgb" });
  for(let attempt = 0; blob && blob.size > maxBytes && attempt < 12; attempt++){
    if(q !== undefined && q > .54){
      q = Math.max(.52, q - .07);
    }else{
      const scale = Math.max(.72, Math.sqrt(maxBytes / blob.size) * .96);
      cw = Math.max(1, Math.round(cw * scale));
      ch = Math.max(1, Math.round(ch * scale));
    }
    blob = await renderExport({ w:cw, h:ch, type, quality:q, alpha, background, colorSpace:"srgb" });
  }
  return { blob, w:cw, h:ch, quality:q };
}

export async function exportDialog(){
  if(!doc.open){ toast("No hay documento abierto"); return; }

  const wrap = document.createElement("div");
  const defaultName = `${doc.name || "realify"}-${stamp()}`;
  wrap.innerHTML = `
    <div class="field"><label>Plantilla</label>
      <select id="exPreset" class="grow">${Object.entries(EXPORT_PRESETS).map(([key,p]) =>
        `<option value="${key}">${p.label}</option>`).join("")}</select></div>
    <div class="field"><label>Nombre</label>
      <input type="text" id="exName" class="grow" value="${defaultName.replace(/"/g,"&quot;")}">
      <span class="unit mono" id="exExt">.jpg</span></div>
    <div class="field"><label>Formato</label>
      <select id="exType" class="grow">
        <option value="image/jpeg">JPEG</option>
        <option value="image/png">PNG</option>
        <option value="image/webp">WebP</option>
        <option value="image/avif">AVIF (más ligero)</option>
        <option value="image/avif;10">AVIF 10 bits (alta calidad)</option>
        <option value="image/avif;12">AVIF 12 bits (archivo; poca compatibilidad)</option>
        <option value="image/jxl">JPEG XL (sin pérdidas o con pérdidas)</option>
        <option value="image/tiff">TIFF (sin pérdidas, 8 bits)</option>
        <option value="image/png;16">PNG 16 bits (máxima calidad)</option>
        <option value="image/tiff;16">TIFF 16 bits (máxima calidad)</option>
        <option value="image/x-exr">OpenEXR (luz lineal, 16 bits)</option>
        <option value="application/pdf">PDF</option>
      </select></div>
    ${alphaFieldsHTML("exA")}
    <div class="field" id="exPdfRow" hidden><label>Página</label>
      <select id="exPdfPage" class="grow">
        <option value="image">Del tamaño de la imagen</option>
        <option value="a4">A4</option><option value="a3">A3</option><option value="a5">A5</option>
        <option value="letter">Carta</option><option value="legal">Oficio (Legal)</option>
        <option value="photo10x15">Foto 10 × 15 cm</option>
      </select></div>
    <div class="field" id="exPdfMarginRow" hidden><label>Margen</label>
      <input type="number" id="exPdfMargin" class="grow" min="0" max="100" value="10"><span class="unit">mm</span></div>
    <div class="field"><label>Destino</label>
      <select id="exDest" class="grow">
        <option value="auto">Automático</option>
        <option value="picker">Elegir carpeta o ubicación…</option>
        <option value="gallery">Guardar en galería / Fotos</option>
        <option value="share">Compartir / guardar con el sistema</option>
        <option value="download">Descargas del navegador</option>
      </select></div>
    <p class="hint" id="exDestHint" style="margin:-2px 0 9px"></p>
    <div class="compat-note" id="exCompat"></div>
    <label class="chk" style="margin:0 0 7px"><input type="checkbox" id="exPrecision">
      <b>Alta precisión al exportar</b> · capas y ajustes en coma flotante, sin bandas</label>
    <p class="hint" id="exPrecisionHint" style="margin:-3px 0 9px"></p>
    <label class="chk" style="margin:0 0 7px"><input type="checkbox" id="exDither">
      <b>Tramado a 8 bits</b> · evita bandas en cielos y degradados</label>
    ${isP3Doc() ? `<div class="field"><label>Color</label>
      <select id="exColor" class="grow">
        <option value="display-p3">Display P3 · gama amplia</option>
        <option value="srgb">sRGB · máxima compatibilidad</option>
      </select></div>
    <p class="hint" id="exColorHint" style="margin:-3px 0 9px"></p>`
    : `<p class="hint" style="margin:-1px 0 9px">Color: <b>sRGB</b> para mantener una apariencia consistente entre navegadores.</p>`}
    <label class="chk" style="margin-bottom:9px"><input type="checkbox" id="exClean">
      <b>Limpio para web</b> · sin metadatos, nombre seguro y peso controlado</label>
    <div class="field" id="exWeightRow" hidden><label>Peso máximo</label>
      <input type="number" id="exMaxKB" class="grow" min="50" max="10000" step="50" value="500">
      <span class="unit">KB</span></div>
    <p class="hint" id="exCleanHint" hidden style="margin:-2px 0 9px">Convierte a sRGB, limita el lado mayor a 2560 px y ajusta calidad o tamaño hasta acercarse al peso elegido.</p>
    <div class="field" id="qRow"><label>Calidad</label>
      <input type="range" id="exQ" class="grow" min="30" max="100" value="90">
      <span class="unit mono" id="exQV">90</span></div>
    <p class="hint" id="exQHint" hidden style="margin:-3px 0 9px"></p>
    <div class="section-label">Tamaño</div>
    <div class="field"><label>Ancho</label>
      <input type="number" id="exW" class="grow" min="1" max="16384" value="${doc.w}">
      <span class="unit">px</span></div>
    <div class="field"><label>Alto</label>
      <input type="number" id="exH" class="grow" min="1" max="16384" value="${doc.h}">
      <span class="unit">px</span></div>
    <label class="chk"><input type="checkbox" id="exLink" checked>
      Mantener proporción</label>
    <div class="field" style="margin-top:8px"><label>Escala</label>
      <input type="range" id="exPct" class="grow" min="5" max="200" step="1" value="100">
      <span class="unit mono" id="exPctV" style="min-width:44px;text-align:right">100 %</span></div>
    <div class="seg" style="margin-top:2px">
      <button data-pct="200">200 %</button>
      <button data-pct="100">100 %</button>
      <button data-pct="50">50 %</button>
      <button data-pct="25">25 %</button>
    </div>
    <p class="hint" id="exEst" style="margin:12px 0 0">Calculando…</p>`;

  let estTimer = null, alphaUI = null;
  // ¿Hay zonas transparentes en lo visible? Decide qué se propone.
  const hasAlpha = hasTransparency(flatten());
  /* Mientras no se toque el campo, el nombre sigue el automatismo de
     siempre —incluido el nombre de cámara del panel EXIF, si está
     activo—. En cuanto el usuario escribe algo, esa elección manda
     por encima de cualquier otro automatismo: es justo lo que pide. */
  let nameEdited = false;

  const res = await dialog({
    title: "Exportar",
    body: wrap,
    buttons: [
      { label:"Cancelar", value:null },
      { label:"Exportar", primary:true, value:"go" }
    ],
    onOpen(body){
      const name = body.querySelector("#exName");
      const preset = body.querySelector("#exPreset");
      const ext  = body.querySelector("#exExt");
      const type = body.querySelector("#exType");
      const dest = body.querySelector("#exDest");
      const destHint = body.querySelector("#exDestHint");
      const compat = body.querySelector("#exCompat");
      const clean = body.querySelector("#exClean");
      const precision = body.querySelector("#exPrecision");
      const precisionHint = body.querySelector("#exPrecisionHint");
      const dither = body.querySelector("#exDither");
      /* La foto trae más de 8 bits (RAW, PNG/TIFF de 16, AVIF de 10/12):
         alta precisión y tramado de entrada, para que lleguen al archivo. */
      const hasHi = docHasHi(doc.layers);
      if(hasHi){ precision.checked = true; dither.checked = true; }
      const weightRow = body.querySelector("#exWeightRow");
      const cleanHint = body.querySelector("#exCleanHint");
      const q    = body.querySelector("#exQ");
      const qv   = body.querySelector("#exQV");
      const qRow = body.querySelector("#qRow");
      const W    = body.querySelector("#exW");
      const H    = body.querySelector("#exH");
      const link = body.querySelector("#exLink");
      const est  = body.querySelector("#exEst");
      const pct  = body.querySelector("#exPct");
      const pctV = body.querySelector("#exPctV");
      const ar = doc.w / doc.h;
      compat.innerHTML = `<strong>${compatibilityInfo().device}:</strong> ${compatibilityInfo().message}`;
      // PNG de 16 bits necesita la compresión nativa del navegador
      if(typeof CompressionStream !== "function") type.querySelector('option[value="image/png;16"]')?.remove();
      /* Color en documentos P3: P3 con perfil en JPEG, PNG y 16 bits;
         el resto de formatos no lleva perfil y se guarda en sRGB. */
      const colorSel = body.querySelector("#exColor"), colorHint = body.querySelector("#exColorHint");
      let colorChoice = "display-p3";   // lo elegido por el usuario, para volver a ello
      const syncColor = () => {
        if(!colorSel) return;
        const ok = ["image/jpeg","image/png","image/png;16","image/tiff;16","image/avif","image/avif;10","image/avif;12","image/x-exr"].includes(type.value) && !clean.checked;
        colorSel.disabled = !ok;
        colorSel.value = ok ? colorChoice : "srgb";
        colorHint.textContent = !ok ? (clean.checked ? "«Limpio para web» guarda en sRGB." : "Este formato no lleva perfil de color: se guarda en sRGB.")
          : colorSel.value === "display-p3" ? "Conserva los colores más saturados de la foto; el archivo lleva su perfil Display P3."
          : "Convierte a sRGB: los colores fuera de sRGB se ajustan al más cercano.";
      };
      colorSel?.addEventListener("change", () => { colorChoice = colorSel.value; syncColor(); });
      /* Calidad 100 = sin pérdidas en los códecs que lo permiten (AVIF, JPEG XL) */
      const qHint = body.querySelector("#exQHint");
      const syncQHint = () => {
        const lossy = type.value === "image/jxl" || type.value.startsWith("image/avif");
        qHint.hidden = !lossy;
        if(lossy) qHint.textContent = "100 = sin pérdidas (el archivo pesa mucho más).";
      };
      const precisionState=()=>{
        syncColor();
        const possible=highPrecisionAvailableFor(+W.value||doc.w,+H.value||doc.h),cap=highPrecisionCapabilities();
        /* 16 bits: siempre alta precisión y sin tramado (no hace falta) */
        if(is16(type.value)){
          precision.checked=true;precision.disabled=true;dither.disabled=true;
          const what = avifDepth(type.value) ? `AVIF de ${avifDepth(type.value)} bits: parte de los 16 bits del motor de alta precisión` : type.value === "image/x-exr" ? "OpenEXR: luz lineal en coma flotante de 16 bits (half), con alfa asociado" : "16 bits por canal";
          precisionHint.textContent=possible.ok?(hasHi?`${what}, con los bits reales de la foto original: capas y ajustes recompuestos en coma flotante.`:`${what}: capas y ajustes recompuestos en coma flotante, sin redondear a 8 bits.`):`No disponible: ${possible.reason}.`;
          return;
        }
        precision.disabled=!possible.ok||clean.checked;
        // El tramado sólo tiene sentido con datos de más de 8 bits, que
        // aquí sólo existen en el motor Float32.
        dither.disabled=precision.disabled||!precision.checked;
        if(clean.checked)precisionHint.textContent="La exportación limpia prioriza el peso y utiliza el motor rápido.";
        else if(!possible.ok)precisionHint.textContent=`Se usará el motor compatible: ${possible.reason}.`;
        else if(hasHi)precisionHint.textContent="La foto original tiene más de 8 bits por canal: con alta precisión se usan al exportar (sin bandas en cielos y sombras).";
        else precisionHint.textContent=`Disponible en este dispositivo${cap.webgpu?" · WebGPU detectada para futuras aceleraciones":" · cálculo CPU compatible"}. La vista previa sigue siendo rápida.`;
      };

      /* El deslizador y las casillas de ancho/alto son dos vistas del
         mismo número, así que cada uno pone al día al otro sin volver
         a disparar su propio evento (`input` sólo salta por gesto del
         usuario, no al asignar `.value`, así que no hay bucle). */
      const applyPct = p => {
        W.value = Math.max(1, Math.round(doc.w * p / 100));
        H.value = Math.max(1, Math.round(doc.h * p / 100));
        pct.value = Math.min(200, Math.max(5, Math.round(p)));
        pctV.textContent = Math.round(p) + " %";
      };
      const syncPctFromW = () => {
        const p = (+W.value || 1) / doc.w * 100;
        pct.value = Math.min(200, Math.max(5, Math.round(p)));
        pctV.textContent = (p < 10 ? p.toFixed(1) : Math.round(p)) + " %";
      };
      const applyPreset = () => {
        const p = EXPORT_PRESETS[preset.value];
        if(!p || preset.value === "original") return;
        const scale = p.max ? Math.min(1, p.max / Math.max(doc.w, doc.h)) : 1;
        W.value = Math.max(1, Math.round(doc.w * scale));
        H.value = Math.max(1, Math.round(doc.h * scale));
        type.value = p.type; q.value = p.quality; qv.textContent = p.quality;
        qRow.style.display = p.type === "image/png" ? "none" : "";
        ext.textContent = "." + extOf(p.type);
        alphaUI?.sync(); syncPdf?.();
        clean.disabled = p.type === "image/tiff";
        clean.checked = p.clean && !clean.disabled; weightRow.hidden = cleanHint.hidden = !clean.checked;
        if(p.kb) body.querySelector("#exMaxKB").value = p.kb;
        if(p.clean){ name.value = safeWebFilename(name.value); nameEdited = true; }
        syncPctFromW(); precisionState(); estimate();
      };

      const estimate = async () => {
        est.textContent = "Calculando…";
        clearTimeout(estTimer);
        estTimer = setTimeout(async () => {
          if(type.value === "image/tiff" || type.value === "image/tiff;16"){
            const keep=alphaUI?.values().alpha, bytes=type.value === "image/tiff" ? 4 : keep ? 8 : 6;
            const mib=((+W.value||1)*(+H.value||1)*bytes+1024)/1048576;
            est.textContent=`TIFF sin comprimir: aproximadamente ${mib.toFixed(1)} MB`;
            return;
          }
          if(type.value === "image/png;16"){
            est.textContent="PNG de 16 bits: sin pérdidas; suele ocupar entre 2 y 3 veces un PNG normal.";
            return;
          }
          const ow = +W.value || 1, oh = +H.value || 1, fmtKb = bytes => { const kb = bytes / 1024; return kb > 1024 ? (kb/1024).toFixed(2) + " MB" : Math.round(kb) + " KB"; };
          const qual = +q.value / 100, T = type.value;
          const codec = T === "image/jxl" || T.startsWith("image/avif");
          /* Códecs pesados (AVIF, JPEG XL): se codifican sólo unos recortes
             representativos y se extrapola el peso; de paso se mide el
             parecido con el original (PSNR). */
          if(codec || T === "image/jpeg" || T === "image/webp"){
            try{
              const C = await import("./codecs.js");
              if(codec && ow * oh > C.codecMaxPixels()){ est.textContent = `Este formato admite hasta ${Math.round(C.codecMaxPixels() / 1e6)} megapíxeles en este dispositivo: reduce el tamaño.`; return; }
              const r = await C.estimateCodec({ type: T, source: flatten(), outW: ow, outH: oh, quality: qual });
              const cal = r.lossless || r.psnr === Infinity ? "sin pérdidas" : `${C.qualityWord(r.psnr)} (PSNR ${r.psnr.toFixed(0)} dB)`;
              est.textContent = `Peso aproximado: ${fmtKb(r.bytes)} · Calidad estimada: ${cal}`;
              return;
            }catch(err){
              if(codec){ est.textContent = "No se pudo estimar el peso: " + err.message; return; }
            }
          }
          if(T === "image/x-exr"){
            const bytes = ow * oh * (alphaUI?.values().alpha ? 4 : 3) * 2 * 0.6;
            est.textContent = `OpenEXR (half, ZIP): aproximadamente ${fmtKb(bytes)} (varía mucho con el detalle)`;
            return;
          }
          const b = await renderExport({
            w: ow, h: oh,
            type: T,
            quality: T === "image/png" ? undefined : qual,
            ...(alphaUI ? alphaUI.values() : {})
          });
          if(!b){ est.textContent = "Este navegador no puede generar ese formato."; return; }
          est.textContent = `Peso aproximado: ${fmtKb(b.size)}`;
        }, 260);
      };

      const extOf = extOfType;
      const syncDestination = () => {
        const picker = canPickExportFile();
        const share = typeof navigator.canShare === "function" && typeof navigator.share === "function";
        const apple = isAppleDevice();
        dest.querySelector('option[value="picker"]').disabled = !picker;
        dest.querySelector('option[value="gallery"]').disabled = !share || !apple;
        dest.querySelector('option[value="share"]').disabled = !share;

        if(dest.value === "picker" && !picker) dest.value = "auto";
        if(dest.value === "gallery" && (!share || !apple)) dest.value = share ? "share" : "auto";
        if(dest.value === "share" && !share) dest.value = "auto";

        const txt = {
          auto: picker
            ? "Mantiene el comportamiento habitual: descarga en escritorio y usa la hoja del sistema en móvil cuando está disponible."
            : "Usa la hoja del sistema en móvil cuando está disponible; si no, descarga en la carpeta del navegador.",
          picker: "Abre el guardado nativo para escoger nombre y ubicación. Disponible en navegadores compatibles de escritorio.",
          gallery: "En iPhone, iPad o Mac abre la hoja de compartir para elegir Guardar imagen, Fotos o Archivos.",
          share: "Abre la hoja del sistema para enviar, guardar en archivos o compartir con otra app.",
          download: "Guarda mediante la descarga normal del navegador."
        };
        destHint.textContent = txt[dest.value] || "";
      };
      name.addEventListener("input", () => { nameEdited = true; });
      preset.addEventListener("change", applyPreset);
      clean.addEventListener("change", () => {
        weightRow.hidden = cleanHint.hidden = !clean.checked;
        if(clean.checked){
          const max = 2560, scale = Math.min(1, max / Math.max(doc.w, doc.h));
          W.value = Math.max(1, Math.round(doc.w * scale));
          H.value = Math.max(1, Math.round(doc.h * scale));
          q.value = 82; qv.textContent = "82";
          name.value = safeWebFilename(name.value);
          nameEdited = true;
          syncPctFromW(); precisionState(); estimate();
        }
        precisionState();
      });
      precision.addEventListener("change", precisionState);
      dest.addEventListener("change", syncDestination);
      const pdfRow = body.querySelector("#exPdfRow"), pdfMarginRow = body.querySelector("#exPdfMarginRow");
      const syncPdf = () => {
        pdfRow.hidden = type.value !== "application/pdf";
        pdfMarginRow.hidden = type.value !== "application/pdf" || body.querySelector("#exPdfPage").value === "image";
        pdfOptions = { page: body.querySelector("#exPdfPage").value, orientation: "auto",
                       margin: body.querySelector("#exPdfPage").value === "image" ? 0 : (+body.querySelector("#exPdfMargin").value || 0) * 72 / 25.4 };
      };
      body.querySelector("#exPdfPage").addEventListener("change", syncPdf);
      body.querySelector("#exPdfMargin").addEventListener("input", syncPdf);
      type.addEventListener("change", () => {
        syncPdf(); alphaUI.sync();
        qRow.style.display = ["image/png","image/tiff","image/png;16","image/tiff;16","image/x-exr"].includes(type.value) ? "none" : "";
        syncQHint();
        clean.disabled = type.value.startsWith("image/tiff") || is16(type.value);
        if(clean.disabled){clean.checked=false;weightRow.hidden=cleanHint.hidden=true;}
        ext.textContent = "." + extOf(type.value);
        precisionState(); estimate();
      });
      // Con transparencia, se propone PNG para no perderla sin darse cuenta.
      if(hasAlpha && type.value === "image/jpeg"){ type.value = "image/png"; qRow.style.display = "none"; }
      alphaUI = wireAlphaFields(body, { id: "exA", getType: () => type.value, hasAlpha, onChange: () => estimate(),
        switchTo: t => { type.value = t; type.dispatchEvent(new Event("change")); } });
      ext.textContent = "." + extOf(type.value);
      q.addEventListener("input", () => { qv.textContent = q.value; estimate(); });
      W.addEventListener("input", () => {
        if(link.checked && +W.value >= 1) H.value = Math.max(1, Math.round(+W.value / ar));
        syncPctFromW();
        precisionState(); estimate();
      });
      H.addEventListener("input", () => {
        if(link.checked && +H.value >= 1) W.value = Math.max(1, Math.round(+H.value * ar));
        syncPctFromW();
        precisionState(); estimate();
      });
      pct.addEventListener("input", () => { applyPct(+pct.value); precisionState(); estimate(); });
      // Doble clic en el deslizador vuelve al tamaño original
      pct.addEventListener("dblclick", () => { applyPct(100); precisionState(); estimate(); });
      body.querySelectorAll("[data-pct]").forEach(b =>
        b.addEventListener("click", () => { applyPct(+b.dataset.pct); precisionState(); estimate(); }));
      syncDestination();
      precisionState();
      estimate();
    }
  });

  clearTimeout(estTimer);
  if(res !== "go") return;

  const type = wrap.querySelector("#exType").value;
  const q    = +wrap.querySelector("#exQ").value / 100;
  const w    = Math.max(1, +wrap.querySelector("#exW").value);
  const h    = Math.max(1, +wrap.querySelector("#exH").value);
  const dest = wrap.querySelector("#exDest").value;
  const clean = wrap.querySelector("#exClean").checked;
  const precision = (wrap.querySelector("#exPrecision").checked || is16(type)) && !clean;
  const dither = precision && wrap.querySelector("#exDither").checked;
  const alphaOpts = { alpha: wrap.querySelector("#exAAlpha").checked && !wrap.querySelector("#exAAlpha").disabled, background: wrap.querySelector("#exABg").value };

  status("Exportando…");
  let blob, cleanResult;
  try{
    cleanResult = clean ? await renderCleanWeb({
      w, h, type, quality:q,
      maxBytes:Math.max(50, +wrap.querySelector("#exMaxKB").value || 500) * 1024, ...alphaOpts
    }) : null;
    blob = cleanResult ? cleanResult.blob : await renderExport({
      w, h, type, quality: type.startsWith("image/png") ? undefined : q, precision, dither, ...alphaOpts,
      colorSpace: wrap.querySelector("#exColor")?.value || "auto"
    });
  }catch(err){ status(""); toast("No se pudo exportar: " + (err.message || err), "err"); return; }
  if(!blob){ toast("La exportación ha fallado", "err"); return; }
  const ext = extOfType(type);

  // Si el panel EXIF está activo, el JPEG sale con su cabecera
  let out = blob, named = null;
  try{
    const exif = await import("../exif/ui.js");
    if(!clean){
      out = await exif.withExif(blob, w, h, true);
      if(exif.useCameraNaming() && type === "image/jpeg") named = exif.cameraName();
    }
  }catch{ /* el panel EXIF no se ha abierto nunca */ }

  const typed = clean ? safeWebFilename(wrap.querySelector("#exName").value)
                      : sanitizeFilename(wrap.querySelector("#exName").value);
  const name = nameEdited && typed ? `${typed}.${ext}`
             : named || `${defaultName}.${ext}`;
  let result = "downloaded";
  try{
    result = await saveOrShare(out, name, dest);
  }catch{
    toast("No se pudo guardar en esa ubicación", "err");
    return;
  }
  if(result === "cancelled") { toast(""); return; }
  const verb = result === "shared" ? "Compartido"
             : result === "gallery" ? "Enviado a Fotos/Galería"
             : result === "picked" ? "Guardado"
             : "Exportado";
  const finalW = cleanResult?.w || w, finalH = cleanResult?.h || h;
  const precisionText=is16(type)?depthText(type):precision&&exportPrecisionInfo().mode==="high-precision"?" · alta precisión":precision?" · modo compatible":"";
  toast(`${verb} ${finalW} × ${finalH} · ` +
        `${(out.size / 1024).toFixed(0)} KB` + (clean ? " · limpio · sRGB" : out !== blob ? " · con EXIF" : "") + precisionText, "ok");
}

export async function quickPng(){
  if(!doc.open){ toast("No hay documento abierto"); return; }
  const blob = await renderExport({ w: doc.w, h: doc.h, type: "image/png" });
  const result = await saveOrShare(blob, `${doc.name || "realify"}-${stamp()}.png`);
  if(result === "cancelled") return;
  toast(result === "shared" ? "PNG compartido" : "PNG exportado", "ok");
}
