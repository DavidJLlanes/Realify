/* Importadores de formatos profesionales. Los decodificadores viven
   en vendor y trabajan íntegramente en el navegador. */
import { doc, newDoc, makeLayer } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { clear as clearHistory } from "../core/history.js";
import { clearSnapshots } from "../core/snapshots.js";
import { defaultText, renderTextLayer } from "../editor/text.js";
import { RAW_EXTENSIONS } from "../../raw/formats.js";

const ext=file=>(file.name.split(".").pop()||"").toLowerCase();
export const compatibleFile=file=>file?.type?.startsWith("image/")||["psd","tif","tiff","heic","heif","jxl","svg",...RAW_EXTENSIONS].includes(ext(file));
const canvas=(w,h)=>{const c=document.createElement("canvas");c.width=w;c.height=h;return c;};

function imageDataCanvas(rgba,w,h){const c=canvas(w,h);c.getContext("2d",{willReadFrequently:true}).putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0);return c;}

async function decodeHeic(file){
  if(typeof globalThis.heic2any!=="function")throw new Error("El decodificador HEIC no está disponible");
  const out=await globalThis.heic2any({blob:file,toType:"image/png"});
  const blob=Array.isArray(out)?out[0]:out;return createImageBitmap(blob);
}

function decodeTiff(buffer){
  const U=globalThis.UTIF;if(!U)throw new Error("El decodificador TIFF no está disponible");
  const ifds=U.decode(buffer).filter(x=>(x.width||x.t256?.[0])&&(x.height||x.t257?.[0]));
  if(!ifds.length)throw new Error("El archivo no contiene una imagen TIFF utilizable");
  /* DNG suele incluir varias vistas: se prueban de mayor a menor y se
     usa la primera que UTIF pueda convertir a RGBA (RAW o previa JPEG). */
  const score=x=>{const w=x.width||x.t256?.[0]||0,h=x.height||x.t257?.[0]||0,compression=x.t259?.[0],photo=x.t262?.[0];return (compression===6||compression===7?1e15:0)+(photo===2?5e14:0)+(photo===32803?-5e14:0)+w*h;};
  ifds.sort((a,b)=>score(b)-score(a));
  let last;
  for(const ifd of ifds)try{U.decodeImage(buffer,ifd);const rgba=U.toRGBA8(ifd);if(rgba?.length)return imageDataCanvas(rgba,ifd.width,ifd.height);}catch(e){last=e;}
  throw last||new Error("No se pudo revelar la imagen TIFF/DNG");
}

function parsePsd(buffer){
  const A=globalThis.agPsd;if(!A)throw new Error("El decodificador PSD no está disponible");
  if(A.initializeCanvas)A.initializeCanvas((w,h)=>canvas(w,h));
  return A.readPsd(buffer,{skipThumbnail:true});
}

export async function decodeCompatible(file){
  const e=ext(file);
  if(e==="heic"||e==="heif")return decodeHeic(file);
  if(e==="jxl"||file.type==="image/jxl"){
    /* Safari lo abre de serie; en el resto, decodificador propio (vendor/jxl) */
    try{return await createImageBitmap(file,{colorSpaceConversion:"default",premultiplyAlpha:"default"});}catch{}
    return (await import("./codecs.js")).decodeJxlToCanvas(await file.arrayBuffer());
  }
  if(e==="tif"||e==="tiff"||e==="dng")return decodeTiff(await file.arrayBuffer());
  if(e==="psd"){const p=parsePsd(await file.arrayBuffer());if(!p.canvas)throw new Error("El PSD no contiene una composición");return p.canvas;}
  return createImageBitmap(file,{colorSpaceConversion:"default",premultiplyAlpha:"default"});
}

const blend={normal:"source-over",multiply:"multiply",screen:"screen",overlay:"overlay",darken:"darken",lighten:"lighten",difference:"difference",exclusion:"exclusion",colorBurn:"color-burn",colorDodge:"color-dodge",hardLight:"hard-light",softLight:"soft-light"};
const rgbaHex=c=>c&&typeof c==="object"?"#"+[c.r,c.g,c.b].map(v=>Math.max(0,Math.min(255,v||0)).toString(16).padStart(2,"0")).join(""):"#ffffff";

function maskFor(src,w,h){
  const mc=src?.canvas||src?.imageData;if(!mc)return null;
  const c=canvas(w,h),x=c.getContext("2d",{willReadFrequently:true});x.fillStyle="#fff";x.fillRect(0,0,w,h);
  if(mc instanceof ImageData){const t=imageDataCanvas(mc.data,mc.width,mc.height);x.drawImage(t,src.left||0,src.top||0);}
  else x.drawImage(mc,src.left||0,src.top||0);
  return {canvas:c,ctx:x};
}

function psdTextLayer(src,parentId){
  const l=makeLayer({name:src.name||"Texto",type:"text"});l.groupId=parentId;l.visible=!src.hidden;l.opacity=src.opacity==null?1:(src.opacity>1?src.opacity/255:src.opacity);
  const t=src.text||{},style=t.style||t.styleRuns?.[0]?.style||{};
  const rawSize=style.fontSize, size=typeof rawSize==="number"?rawSize:rawSize?.value;
  l.text={...defaultText(),content:t.text||t.value||src.name||"Texto",x:(src.left||0)+Math.max(1,(src.right-src.left||0))/2,y:(src.top||0)+Math.max(1,(src.bottom-src.top||0))/2,size:Math.round(size||defaultText().size),color:rgbaHex(style.fillColor||style.color)};
  renderTextLayer(l);return l;
}

function importPsdNodes(nodes,parentId=null,out=[]){
  /* PSD guarda visualmente de arriba abajo; Realify compone de abajo
     arriba, por eso se invierte cada nivel. */
  for(const src of [...(nodes||[])].reverse()){
    if(src.children){const g=makeLayer({name:src.name||"Grupo",type:"group"});g.groupId=parentId;g.visible=!src.hidden;g.opacity=src.opacity==null?1:(src.opacity>1?src.opacity/255:src.opacity);out.push(g);importPsdNodes(src.children,g.id,out);continue;}
    const l=src.text?psdTextLayer(src,parentId):makeLayer({name:src.name||"Capa"});
    l.groupId=parentId;l.visible=!src.hidden;l.opacity=src.opacity==null?1:(src.opacity>1?src.opacity/255:src.opacity);l.blend=blend[src.blendMode]||"source-over";l.clipped=!!src.clipping;
    if(!src.text&&src.canvas)l.ctx.drawImage(src.canvas,src.left||0,src.top||0);
    const m=maskFor(src.mask,doc.w,doc.h);if(m)l.mask=m;l.thumbDirty=true;out.push(l);
  }return out;
}

export async function openPsd(file){
  const psd=parsePsd(await file.arrayBuffer());newDoc(psd.width,psd.height,{name:file.name.replace(/\.[^.]+$/,"")});
  doc.layers=importPsdNodes(psd.children||[]);if(!doc.layers.length){const l=makeLayer({name:"Composición"});if(psd.canvas)l.ctx.drawImage(psd.canvas,0,0);doc.layers=[l];}
  doc.activeId=doc.layers[doc.layers.length-1].id;doc.source={w:psd.width,h:psd.height,type:file.type||"image/vnd.adobe.photoshop",size:file.size,name:file.name,file};
  clearHistory();clearSnapshots();emit("doc:new");emit("doc:structure");emit("doc:change");return psd;
}

/* Tamaño propio de un SVG: width/height si los trae en unidades
   absolutas; si no, el viewBox; y si tampoco, un lado razonable. Un
   <img> de un SVG sin tamaño declarado da naturalWidth 0 en algunos
   navegadores, y eso acabaría en un lienzo vacío. */
function svgSize(source,img){
  if(img.naturalWidth&&img.naturalHeight)return [img.naturalWidth,img.naturalHeight];
  const root=new DOMParser().parseFromString(source,"image/svg+xml").documentElement;
  const vb=(root.getAttribute("viewBox")||"").trim().split(/[\s,]+/).map(Number);
  if(vb.length===4&&vb[2]>0&&vb[3]>0)return [Math.round(vb[2]),Math.round(vb[3])];
  return [1024,1024];
}

/* createImageBitmap() no acepta SVG en Chrome («The source image could
   not be decoded»): hay que pasar por un <img>, que sí sabe
   rasterizarlo, y dibujarlo en un lienzo. */
export async function svgCanvas(file,w=0,h=0){
  const source=await file.text(),url=URL.createObjectURL(new Blob([source],{type:"image/svg+xml"}));
  try{
    const img=new Image();img.src=url;
    try{await img.decode();}catch{throw new Error("El SVG no es válido o usa algo que el navegador no puede dibujar");}
    const [sw,sh]=svgSize(source,img);
    const c=canvas(w||sw,h||sh);c.getContext("2d").drawImage(img,0,0,c.width,c.height);return {canvas:c,source};
  }finally{URL.revokeObjectURL(url);}
}

/* Cualquier formato que la app sabe abrir, a algo dibujable: lo usan
   los caminos que sólo necesitan los píxeles (procesar por lotes), para
   que no se queden atrás respecto a «Abrir imagen». */
export async function decodeAny(file){
  if(ext(file)==="svg")return (await svgCanvas(file)).canvas;
  return decodeCompatible(file);
}
