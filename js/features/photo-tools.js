/* Herramientas fotográficas adicionales. Los efectos que cambian píxeles
   trabajan sobre una copia, crean un paso de historial y respetan la capa
   activa. Las selecciones y máscaras siguen el modelo nativo del editor. */

import { doc, addLayer } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/kit/dialog.js";
import { toast } from "../core/toast.js";
import { addMask } from "../editor/layers/masks.js";
import "../editor/layers/filterlayer.js";
import "../editor/render/floatfilter.js";
import "../editor/selection/selection.js";
import { renderExport } from "../io/export/export.js";
import { COARSE, isMobile } from "../core/device.js";
import { clamp, liveDialog, fillFields, canvasCopy, commitEffect, restore } from "./photo-tools/portrait.js";
import { sliderRow, rasterLayer, wireCommon } from "./photo-tools/common.js";
import { settingsDialog } from "./photo-tools/remove-background.js";
export { backgroundMask, removeBackground } from "./photo-tools/remove-background.js";
export { portraitPixels, portraitRetouch } from "./photo-tools/portrait.js";

const deep = x => JSON.parse(JSON.stringify(x));

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
    label: "Reducción de ruido", float: "delta",
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
    const { confirmDlg } = await import("../ui/kit/dialog.js");
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
    label: "Enfoque selectivo", float: "delta",
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
   editor/selection/luminositymasks.js, que reutiliza esta misma `rangeMask` para
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

/* ── Transformación de capa ─────────────────────────────────── */
export async function transformLayer(){
  const layer=rasterLayer();if(!layer)return;
  const before=canvasCopy(layer.canvas),beforeMask=layer.mask?canvasCopy(layer.mask.canvas):null;
  const oldType=layer.type,oldText=deep(layer.text||null),cx=doc.w/2,cy=doc.h/2;
  /* Vista previa en directo: cada cambio de un deslizador redibuja la capa desde la
     copia ORIGINAL (nunca desde el fotograma anterior). Cancelar la deja como estaba. */
  let host=null,queued=false,closed=false;
  const val=id=>host.querySelector("#"+id);
  const applyTransform=(ctx,src)=>{
    const rot=+val("trRotate").value*Math.PI/180,skX=Math.tan(+val("trSkewX").value*Math.PI/180),skY=Math.tan(+val("trSkewY").value*Math.PI/180),sc=+val("trScale").value/100;
    ctx.save();ctx.globalCompositeOperation="copy";ctx.globalAlpha=1;ctx.clearRect(0,0,doc.w,doc.h);ctx.translate(cx,cy);ctx.rotate(rot);ctx.transform(1,skY,skX,1,0,0);
    ctx.scale((val("trFlipH").checked?-1:1)*sc,(val("trFlipV").checked?-1:1)*sc);ctx.imageSmoothingQuality="high";ctx.drawImage(src,-cx,-cy);ctx.restore();
  };
  const draw=()=>{applyTransform(layer.ctx,before);if(layer.mask)applyTransform(layer.mask.ctx,beforeMask);layer.thumbDirty=true;emit("doc:change");};
  const redraw=()=>{
    if(queued||!host)return;queued=true;
    requestAnimationFrame(()=>{queued=false;if(!closed&&host)draw();});
  };
  const body=document.createElement("div");
  body.innerHTML=`${sliderRow("trScale","Escala",10,300,100,"%")}${sliderRow("trRotate","Rotación",-180,180,0,"°")}${sliderRow("trSkewX","Inclinar X",-60,60,0,"°")}${sliderRow("trSkewY","Inclinar Y",-60,60,0,"°")}
    <label class="chk"><input id="trFlipH" type="checkbox"> Voltear horizontalmente</label><label class="chk"><input id="trFlipV" type="checkbox"> Voltear verticalmente</label>`;
  const result=await dialog({title:"Transformar capa",body,cls:isMobile()?"dlg-compact":"",
    buttons:[{label:"Cancelar",value:null},{label:"Aplicar",primary:true,value:"go"}],
    onOpen:h=>{host=h;wireCommon(h);h.addEventListener("input",redraw);h.addEventListener("change",redraw);}});
  closed=true;
  if(result!=="go"){
    restore(layer,before);
    if(layer.mask&&beforeMask){layer.mask.ctx.save();layer.mask.ctx.globalCompositeOperation="copy";layer.mask.ctx.drawImage(beforeMask,0,0);layer.mask.ctx.restore();}
    return;
  }
  draw();
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
