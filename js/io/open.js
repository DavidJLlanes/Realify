/* Apertura de imágenes: selector, arrastre y pegado. */

import { hasWideGamut } from "../core/colorspace.js";
import { newDoc, doc, addLayer } from "../core/doc.js";
import { clear as clearHistory, recordLayers, record } from "../core/history.js";
import { clearSnapshots } from "../core/snapshots.js";
import { toast, status } from "../ui/toast.js";
import { emit } from "../core/bus.js";
import { confirmDlg } from "../ui/dialog.js";
import { openAsNewTab, refreshActiveTabMeta } from "../core/documents.js";
import { compatibleFile, decodeCompatible, openPsd, svgCanvas } from "./compatibility.js";
import { isRawFile } from "../../raw/formats.js";
import { docSizeLimit, galleryAccept } from "../core/device.js";

const picker = document.getElementById("filePicker");
const stage  = document.getElementById("stage");
const empty  = document.getElementById("empty");

async function readExifIdentity(file){
  if(!/jpe?g/i.test(file.type||file.name))return null;
  try{
    const dv=new DataView(await file.slice(0,262144).arrayBuffer());let p=2,tiff=-1;
    while(p+4<dv.byteLength){if(dv.getUint8(p)!==0xff)break;const marker=dv.getUint8(p+1),len=dv.getUint16(p+2);if(marker===0xe1&&p+10<dv.byteLength&&dv.getUint32(p+4)===0x45786966){tiff=p+10;break;}p+=2+len;}
    if(tiff<0)return null;const le=dv.getUint16(tiff)===0x4949,u16=o=>dv.getUint16(tiff+o,le),u32=o=>dv.getUint32(tiff+o,le),first=u32(4),out={};
    const ascii=(entry,count)=>{const off=count<=4?entry+8:u32(entry+8),end=Math.min(dv.byteLength,tiff+off+count);let s="";for(let i=tiff+off;i<end&&dv.getUint8(i);i++)s+=String.fromCharCode(dv.getUint8(i));return s.trim();};
    const scan=(off,isExif=false)=>{const n=u16(off);for(let i=0;i<n;i++){const e=off+2+i*12,tag=u16(e),type=u16(e+2),count=u32(e+4);if(type===2&&(tag===0x010f||tag===0x0110||tag===0xa434)){const v=ascii(e,count);if(tag===0x010f)out.make=v;else if(tag===0x0110)out.model=v;else out.lens=v;}if(!isExif&&tag===0x8769)scan(u32(e+8),true);}};scan(first);return Object.keys(out).length?out:null;
  }catch{return null;}
}

async function decodeImage(file){
  try{
    return await decodeCompatible(file);
  }catch(err){
    if(err instanceof TypeError) return createImageBitmap(file);
    throw err;
  }
}

async function keepHighDepth(file, bmp, w, h){
  try{
    const { decodeHighDepth } = await import("./hidepth.js");
    const hi = await decodeHighDepth(file);
    if(!hi) return 0;
    const H = await import("../core/hisrc.js");
    if(!H.hiAllowed(w, h) || !H.matchesImage(bmp, hi.data, hi.w, hi.h, hi.kind === "avif" ? { mean: 1, worst: 2.5, far: 0.005 } : undefined)) return 0;
    const data = H.resizeHi(hi.data, hi.w, hi.h, w, h);
    return H.adoptHi(doc.layers[0], data, w, h) ? hi.bits : 0;
  }catch(err){ console.warn("[alta profundidad]", err); return 0; }
}

/* Límite de tamaño: ver `docSizeLimit` en core/device.js. */
const limitFor = docSizeLimit;

export async function openFile(file){
  if(!file) return;
  if(!compatibleFile(file)){
    toast("Eso no es una imagen", "err");
    return;
  }
  status("Abriendo…");
  try{
    if(isRawFile(file)) return await (await import("../../raw/index.js")).openRawFile(file);
    if(file.name.toLowerCase().endsWith(".psd")){
      await openPsd(file);empty.classList.add("hide");toast(`${file.name} · PSD con capas importado`);return;
    }
    if(file.name.toLowerCase().endsWith(".svg")){
      const decoded=await svgCanvas(file),bmp=decoded.canvas;
      const [w,h,limited]=limitFor(bmp.width,bmp.height);
      const base=newDoc(w,h,{image:bmp,name:file.name.replace(/\.[^.]+$/, ""),layerName:"SVG",source:{w:bmp.width,h:bmp.height,type:"image/svg+xml",size:file.size,name:file.name,file}});
      base.type="svg";base.svgSource=decoded.source;clearHistory();clearSnapshots();empty.classList.add("hide");toast(limited?`SVG abierto a ${w} × ${h}`:`${file.name} · capa vectorial`);return;
    }
    const bmp = await decodeImage(file);
    const exif = await readExifIdentity(file);
    const [w, h, limited] = limitFor(bmp.width, bmp.height);
    /* ¿Tiene colores fuera de sRGB (Display P3, Adobe RGB…)? Entonces el
       documento trabaja en P3 para no recortarlos (core/colorspace.js). */
    const wide = hasWideGamut(bmp);
    newDoc(w, h, {
      colorSpace: wide ? "display-p3" : "srgb",
      image: bmp,
      name: file.name.replace(/\.[^.]+$/, ""),
      layerName: "Fondo",
      /* Se guarda el archivo original tal cual, no sólo sus medidas:
         es lo único que permite limpiar sus metadatos sin recomprimir
         más tarde, aunque el documento ya se haya editado por encima. */
      source: { w: bmp.width, h: bmp.height, type: file.type, size: file.size,
                name: file.name, file, exif }
    });
    /* Más de 8 bits (PNG/TIFF de 16, AVIF de 10/12): la capa base guarda
       también esos datos para la exportación en coma flotante, si
       coinciden con lo que ha decodificado el navegador (core/hisrc.js). */
    const bits = await keepHighDepth(file, bmp, w, h);
    if(typeof bmp.close === "function") bmp.close();
    clearHistory();
    clearSnapshots();
    empty.classList.add("hide");
    toast((limited
      ? `Abierta a ${w} × ${h} (reducida para esta pantalla)`
      : `${file.name} · ${w} × ${h}`) + (bits ? ` · ${bits} bits por canal` : "") + (wide ? " · color de gama amplia (Display P3)" : ""));
  }catch(err){
    console.error(err);
    toast("No se pudo leer ese archivo" + (err?.message ? ": " + err.message : ""), "err");
  }
}

/* Como `openFile`, pero en una pestaña nueva en vez de sustituir lo
   que hubiera abierto: es el camino normal de «Abrir imagen» en
   cuanto puede haber más de un documento a la vez. Ver
   core/documents.js — `openAsNewTab` guarda la pestaña actual antes
   de que `openFile` reescriba la `doc` viva, y registra el resultado
   como una pestaña aparte. */
export const openFileInNewTab = file => openAsNewTab(() => openFile(file));

async function openFilesInNewTabs(files){
  // Uno detrás de otro, no en paralelo: todos escriben sobre la
  // misma `doc` viva mientras se cargan, así que dos a la vez se
  // pisarían el uno al otro.
  for(const f of files) await openFileInNewTab(f);
}

/* Coloca una imagen como capa nueva sobre el documento actual.
   `track:false` la deja fuera del historial y `quiet` sin aviso: los
   usa quien coloca varias de una vez (placeFilesAsLayers), que anota
   un único paso y un único aviso para todas. Devuelve si lo consiguió. */
export async function placeAsLayer(file, { track = true, quiet = false } = {}){
  if(!doc.open){ await openFile(file); return doc.open; }
  try{
    const isSvg=file.name.toLowerCase().endsWith(".svg");
    const decoded=isSvg?await svgCanvas(file):null;
    const bmp=decoded?.canvas||await decodeImage(file);
    const place = () => {
      const l = addLayer({ name: file.name.replace(/\.[^.]+$/, ""), type:isSvg?"svg":"raster" });
      // Encajar dentro del lienzo conservando proporción
      const s = Math.min(doc.w / bmp.width, doc.h / bmp.height, 1);
      const w = bmp.width * s, h = bmp.height * s;
      l.ctx.drawImage(bmp, (doc.w - w) / 2, (doc.h - h) / 2, w, h);
      if(isSvg)l.svgSource=decoded.source;
      l.thumbDirty = true;
    };
    if(track) recordLayers("Colocar imagen", place); else place();
    if(typeof bmp.close==="function")bmp.close();
    emit("doc:structure");
    emit("doc:change");
    if(!quiet) toast("Añadida como capa");
    return true;
  }catch(err){
    console.error(err);
    toast("No se pudo colocar la imagen «" + file.name + "»" + (err?.message ? ": " + err.message : ""), "err");
    return false;
  }
}

/* Varias imágenes como capas, en UN solo paso de deshacer: Ctrl+Z
   quita la pila entera, no una capa por pulsación. Devuelve cuántas
   se colocaron. */
async function placeFilesAsLayers(files, label = "Colocar imágenes"){
  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  let ok = 0;
  // Uno detrás de otro: cada llamada lee `doc.activeId` para saber
  // encima de qué capa colocarse, y dos a la vez leerían ese valor
  // antes de que la anterior lo hubiera puesto al día.
  for(const f of files) if(await placeAsLayer(f, { track:false, quiet:true })) ok++;
  if(ok){
    const nextLayers = doc.layers.slice(), nextActive = doc.activeId;
    const put = (layers, active) => {
      doc.layers = layers.slice(); doc.activeId = active;
      emit("doc:structure"); emit("doc:change");
    };
    record(label, () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
  }
  return ok;
}

export async function loadFilesAsStack(files){
  const list=[...(files||[])].filter(compatibleFile);if(!list.length)return;
  const total=list.length;
  let ok=0;
  status("Cargando archivos en pila…");
  try{
    if(!doc.open){await openFile(list.shift());if(doc.open)ok++;}
    ok+=await placeFilesAsLayers(list,"Cargar en pila");
  }finally{status("");}
  // Después de limpiar la barra de estado, no antes: el aviso va
  // precisamente ahí en escritorio y el `status("")` lo borraba al
  // instante.
  if(ok===total) toast(`Pila cargada · ${total} archivo${total===1?"":"s"}`,"ok");
  else toast(`Pila cargada · ${ok} de ${total} archivos (el resto no se pudo leer)`,"err");
}

export function initOpen(){
  // Android: galería directa (sólo `image/*`); RAW, PSD, TIFF y SVG,
  // desde «Abrir RAW, PSD o TIFF…» (`filePickerFiles`).
  picker.accept = galleryAccept(picker.accept);
  const stackP = document.getElementById("filePickerStack");
  if(stackP) stackP.accept = galleryAccept(stackP.accept);
  /* Inicio › Editar en lote: el selector se abre EN EL MISMO toque (ver
     promptStartBatch) y el código del lote se carga después, con las
     fotos ya elegidas. */
  const batchP = document.getElementById("filePickerBatch");
  if(batchP){
    batchP.accept = galleryAccept(batchP.accept);
    batchP.addEventListener("change", e => {
      const files = [...e.target.files];
      e.target.value = "";
      if(files.length) import("../../lote/index.js").then(m => m.startBatch(files));
    });
  }
  document.getElementById("filePickerFiles")?.addEventListener("change", e => {
    const files = [...e.target.files].filter(compatibleFile);
    e.target.value = "";
    if(files.length) files.length > 1 ? openFilesInNewTabs(files) : openFileInNewTab(files[0]);
  });
  picker.addEventListener("change", e => {
    const files = [...e.target.files].filter(compatibleFile);
    e.target.value = "";
    if(!files.length) return;
    // Un solo archivo elegido con un documento ya abierto no pregunta
    // nada: siempre suma una pestaña, nunca sustituye —
    // es lo que se espera al pulsar «Abrir imagen» otra vez. Con
    // varios elegidos a la vez (Ctrl/Mayús en el selector del sistema)
    // cada uno se abre en la suya, en el orden en que se eligieron.
    files.length > 1 ? openFilesInNewTabs(files) : openFileInNewTab(files[0]);
  });
  /* Cámara (móvil): el mismo camino que «Abrir imagen», pero con un
     selector que pide al sistema abrir la cámara trasera directamente
     (`capture` en index.html). Donde el navegador no la ofrece, cae
     solo al selector de archivos normal. */
  document.getElementById("cameraPicker")?.addEventListener("change", e => {
    const file = [...e.target.files].find(compatibleFile);
    e.target.value = "";
    if(file) openFileInNewTab(file);
  });
  const stackPicker=document.getElementById("filePickerStack");
  stackPicker?.addEventListener("change",e=>{
    const files=[...e.target.files].filter(compatibleFile);e.target.value="";
    if(files.length)loadFilesAsStack(files);
  });

  // Arrastrar y soltar
  let depth = 0;
  ["dragenter","dragover"].forEach(t =>
    stage.addEventListener(t, e => {
      e.preventDefault();
      if(t === "dragenter") depth++;
      stage.classList.add("dragover");
    }));
  stage.addEventListener("dragleave", e => {
    e.preventDefault();
    if(--depth <= 0){ depth = 0; stage.classList.remove("dragover"); }
  });
  stage.addEventListener("drop", e => {
    e.preventDefault();
    depth = 0;
    stage.classList.remove("dragover");
    const project = [...e.dataTransfer.files].find(x => x.name.toLowerCase().endsWith(".realify"));
    if(project){ import("./project.js").then(m => m.openProjectFile(project)); return; }
    const files = [...e.dataTransfer.files].filter(compatibleFile);
    if(!files.length) return;
    // Con documento abierto y la tecla Mayús, TODO lo soltado entra
    // como capas nuevas de ese mismo documento, una encima de otra —
    // el gesto de siempre para añadir varias fotos a un montaje. Sin
    // Mayús, cada imagen abre su propia pestaña.
    if(files.length > 1) loadFilesAsStack(files);
    else if(doc.open && e.shiftKey) placeFilesAsLayers(files).then(n => {
      if(n) toast(n === 1 ? "Añadida como capa" : `${n} imágenes añadidas como capas`, "ok");
    });
    else openFileInNewTab(files[0]);
  });
  // Evita que soltar fuera del lienzo navegue a la imagen
  addEventListener("dragover", e => e.preventDefault());
  addEventListener("drop", e => e.preventDefault());

  // Pegar desde el portapapeles
  addEventListener("paste", e => {
    const item = [...(e.clipboardData?.items || [])]
      .find(i => i.type.startsWith("image/"));
    if(!item) return;
    const f = item.getAsFile();
    if(f){ e.preventDefault(); doc.open ? placeAsLayer(f) : openFileInNewTab(f); }
  });
}

export function promptOpen(){ picker.click(); }
/** RAW, PSD, TIFF y SVG: desde el explorador de archivos (en Android no
    salen en la galería). */
/** Editar en lote: se abre el selector directamente, sin esperar a cargar
    nada antes —en el móvil (iPhone sobre todo) el navegador sólo deja
    abrir un selector de archivos en el mismo instante del toque; si antes
    se descargaba el código del lote, la primera pulsación no hacía nada—. */
/** Selector de archivos abierto YA, en el mismo toque (sin esperas antes);
    `cb(files)` al elegir. Para comandos que, sin documento abierto, piden
    una foto antes de cargar su propio código (Cortar, Recortar en forma). */
export function pickNow({ multiple = false, accept = "image/*,.heic,.heif,.tif,.tiff,.jxl" } = {}, cb){
  const i = document.createElement("input");
  i.type = "file"; i.accept = galleryAccept(accept); i.multiple = multiple;
  i.style.cssText = "position:fixed;left:-9999px;opacity:0";
  document.body.appendChild(i);
  i.addEventListener("change", () => { const f = [...i.files]; i.remove(); if(f.length) cb(f); });
  i.addEventListener("cancel", () => i.remove());
  i.click();
}
export function promptStartBatch(){ document.getElementById("filePickerBatch")?.click(); }
export function promptOpenFiles(){ document.getElementById("filePickerFiles")?.click(); }

export function promptCamera(){ document.getElementById("cameraPicker")?.click(); }

export function promptLoadStack(){ document.getElementById("filePickerStack")?.click(); }

export async function promptPasteImage(){
  if(!navigator.clipboard?.read){
    toast("Usa Ctrl+V o ⌘V para pegar una imagen en este navegador");
    return;
  }
  try{
    const items = await navigator.clipboard.read();
    for(const item of items){
      const type = item.types.find(t => t.startsWith("image/"));
      if(!type) continue;
      const blob = await item.getType(type);
      const file = new File([blob], "portapapeles.png", { type });
      return doc.open ? placeAsLayer(file) : openFileInNewTab(file);
    }
    toast("El portapapeles no contiene una imagen");
  }catch(err){
    if(err?.name !== "NotAllowedError") console.error(err);
    toast("No se pudo leer el portapapeles; prueba con Ctrl+V o ⌘V", "err");
  }
}

/* Restaurar la foto a como estaba al abrirla: descarta todas las
   capas, ediciones e historial, y parte otra vez del archivo original
   —no del historial de deshacer—, que puede haberse recortado por el
   límite de memoria y ya no llegar tan atrás. Con un documento nuevo
   en blanco (sin archivo de origen) no hay «original» al que volver:
   se avisa en vez de fingir que existe uno. */
export async function revertToOriginal(){
  if(!doc.open) return;
  if(!doc.source?.file){
    toast("Este documento no viene de un archivo abierto; no hay un original al que volver", "err");
    return;
  }
  const ok = await confirmDlg("Restaurar al estado original",
    "Se perderán todas las capas, ediciones e historial de este documento, " +
    "y volverá a como estaba justo al abrirlo. Esto no se puede deshacer.",
    "Restaurar");
  if(!ok) return;
  // Reemplaza el contenido de ESTA pestaña — nunca abre una nueva,
  // que es justo lo que openFile()/openFileInNewTab() harían por su
  // cuenta si no se avisara de que ya hay una activa a la que volver.
  await openFile(doc.source.file);
  refreshActiveTabMeta();
}
