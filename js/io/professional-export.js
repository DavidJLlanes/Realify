/* Exportación profesional: comparación, variantes de escala y salida
   por capas/grupos. Reutiliza el compositor real para que cada archivo
   coincida con lo que se ve en el documento. */
import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { isMobile } from "../core/device.js";
import { saveOrShare, sanitizeFilename, stamp } from "./export.js";
import { buildZip, crc32 } from "./zip.js";
import { prepareForType, hasTransparency, alphaFieldsHTML, wireAlphaFields } from "./alpha.js";
import { isP3Doc, toSrgbCanvas } from "../core/colorspace.js";
import { highPrecisionAvailableFor, renderHighPrecisionCanvas, renderPrecisionAdjustmentStack } from "../core/high-precision-safe.js?v=4";

const enc=new TextEncoder();
const cleanName=sanitizeFilename;
const mimeOf=f=>f==="jpg"?"image/jpeg":f==="png"?"image/png":f==="webp"?"image/webp":f==="avif"?"image/avif":f==="tiff"?"image/tiff":f==="psd"?"image/vnd.adobe.photoshop":/^ps[db]/.test(f)?"image/vnd.adobe.photoshop":f==="heic"?"image/heic":"application/pdf";
const extOf=f=>f==="tiff"?"tif":f.startsWith("psb")?"psb":f.startsWith("psd")?"psd":f;
/* PSD/PSB de 16 bits: la imagen final del motor de precisión (coma flotante) sin pasar por los 8 bits del lienzo */
async function psd16Of(scale,psb,{alpha,background}){
  const w=Math.round(doc.w*scale),h=Math.round(doc.h*scale);
  const precise=await renderPrecisionAdjustmentStack(w,h,{bits16:true,alpha,background,layersOnly:false,srgb:false});
  if(!precise?.data16)throw new Error(precise?.reason||"No se pudo preparar la exportación de 16 bits");
  return (await import("./psd16.js")).psd16(precise.data16,{psb});
}
const blobOf=(c,type,q)=>new Promise(r=>c.toBlob(r,type,type==="image/png"?undefined:q));

function resizeCanvas(src,w,h){
  if(src.width===w&&src.height===h)return src;
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const x=c.getContext("2d",{colorSpace:"srgb"});x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";
  x.drawImage(src,0,0,w,h);return c;
}

/* Igual que la exportación rápida: la previsualización del diálogo se
   queda en Canvas para responder al instante; la precisión lineal se
   reserva para cada archivo definitivo. */
function resizeForExport(src,w,h,precision){
  if(!precision)return resizeCanvas(src,w,h);
  const result=renderHighPrecisionCanvas(src,w,h);
  return result.canvas||resizeCanvas(src,w,h);
}

function descendants(groupId,out=[]){
  for(const l of doc.layers.filter(x=>x.groupId===groupId)){out.push(l);if(l.type==="group")descendants(l.id,out);}
  return out;
}

function exportItems(scope){
  if(scope==="document")return [{name:doc.name||"documento",canvas:flatten()}];
  return doc.layers.filter(l=>l.type==="group"||l.type!=="adjust").map(l=>{
    /* Al pedir cada elemento se exporta su contenido aunque estuviera
       oculto en la composición general; no se muta la pila real. */
    const layers=(l.type==="group"?[l,...descendants(l.id,[])]:[l]).map(x=>({...x,visible:true}));
    return {name:l.name||"capa",canvas:flatten(null,layers,doc.w,doc.h)};
  });
}

function join(parts){let n=0;for(const p of parts)n+=p.length;const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function pdfFromJpeg(jpeg,w,h){
  const img=new Uint8Array(jpeg),ptW=612,ptH=ptW*h/w,content=enc.encode(`q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q\n`);
  const bodies=[
    enc.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    enc.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    join([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`),img,enc.encode("\nendstream")]),
    join([enc.encode(`<< /Length ${content.length} >>\nstream\n`),content,enc.encode("endstream")])
  ];
  const parts=[enc.encode("%PDF-1.4\n%Realify\n")],offsets=[0];let pos=parts[0].length;
  bodies.forEach((b,i)=>{offsets.push(pos);const o=join([enc.encode(`${i+1} 0 obj\n`),b,enc.encode("\nendobj\n")]);parts.push(o);pos+=o.length;});
  const xref=pos;let table=`xref\n0 ${bodies.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)table+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  parts.push(enc.encode(table+`trailer\n<< /Size ${bodies.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return new Blob(parts,{type:"application/pdf"});
}

async function tagPngSRGB(blob){
  const src=new Uint8Array(await blob.arrayBuffer());
  if(src.length<33)return blob;
  const type=enc.encode("sRGB"),chunk=new Uint8Array(13),v=new DataView(chunk.buffer);
  v.setUint32(0,1);chunk.set(type,4);chunk[8]=0;v.setUint32(9,crc32(chunk.subarray(4,9)));
  return new Blob([src.subarray(0,33),chunk,src.subarray(33)],{type:"image/png"});
}

/* `opts`: { alpha, background } — ver io/alpha.js. */
async function encodeCanvas(canvas,format,quality,profile=true,opts={}){
  /* Documento en Display P3: PNG y JPEG lo conservan con su perfil; el
     resto de formatos (sin perfil) se guarda en sRGB. */
  const keepP3=isP3Doc()&&(format==="png"||format==="jpg"||format==="webp"||format==="tiff"||format==="heic");
  if(isP3Doc()&&!keepP3)canvas=toSrgbCanvas(canvas);
  canvas=prepareForType(canvas,mimeOf(format),opts);
  if(format==="tiff") return (await import("./professional-formats.js")).tiffFromCanvas(canvas,keepP3?"display-p3":"srgb");
  if(format==="heic") return (await import("./heic.js")).encodeHeic(canvas,{quality,space:keepP3?"display-p3":"srgb"});
  if(format==="pdf"){
    const jpg=await blobOf(canvas,"image/jpeg",quality);
    return pdfFromJpeg(await jpg.arrayBuffer(),canvas.width,canvas.height);
  }
  const blob=await blobOf(canvas,mimeOf(format),quality);
  if(keepP3)return (await import("./icc-embed.js")).ensureIcc(blob,"display-p3");
  return profile&&format==="png"&&blob?tagPngSRGB(blob):blob;
}

function paintPreview(canvas,source){
  const max=330,s=Math.min(max/source.width,220/source.height,1);canvas.width=Math.max(1,Math.round(source.width*s));canvas.height=Math.max(1,Math.round(source.height*s));
  canvas.getContext("2d").drawImage(source,0,0,canvas.width,canvas.height);
}

export async function professionalExport(){
  if(!doc.open){toast("No hay documento abierto");return;}
  const flat=flatten(),base=cleanName(doc.name||"realify")||"realify";
  const body=document.createElement("div");
  body.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <figure style="margin:0"><canvas id="pxBefore" style="width:100%;background:#111"></canvas><figcaption class="mono" style="font-size:11px;margin-top:3px">Original</figcaption></figure>
      <figure style="margin:0"><canvas id="pxAfter" style="width:100%;background:#111"></canvas><figcaption class="mono" id="pxInfo" style="font-size:11px;margin-top:3px">Exportación</figcaption></figure>
    </div>
    <div class="field"><label>Nombre</label><input id="pxName" class="grow" value="${base.replace(/"/g,"&quot;")}"></div>
    <div class="field"><label>Formato</label><select id="pxFormat" class="grow"><option value="jpg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="avif">AVIF</option><option value="tiff">TIFF (sin pérdidas, 8 bits)</option><option value="psd">PSD (capas, máscaras y estilos)</option><option value="psb">PSB (PSD para documentos enormes)</option><option value="psd16">PSD de 16 bits (sólo imagen final)</option><option value="psb16">PSB de 16 bits (sólo imagen final)</option><option value="pdf">PDF</option></select></div>
    ${alphaFieldsHTML("pxA")}
    <div class="field" id="pxQualityRow"><label>Calidad</label><input id="pxQuality" type="range" class="grow" min="20" max="100" value="88"><span class="unit mono" id="pxQualityV">88</span></div>
    <div class="field"><label>Contenido</label><select id="pxScope" class="grow"><option value="document">Documento compuesto</option><option value="layers">Cada capa y grupo</option></select></div>
    <div class="field"><label>Escalas</label><div class="grow" style="display:flex;gap:14px"><label class="chk"><input type="checkbox" data-scale="1" checked>1×</label><label class="chk"><input type="checkbox" data-scale="2">2×</label><label class="chk"><input type="checkbox" data-scale="3">3×</label></div></div>
    <label class="chk"><input id="pxPrecision" type="checkbox"> Alta precisión al exportar</label>
    <p class="hint" id="pxPrecisionHint" style="margin:-3px 0 8px"></p>
    <label class="chk" id="pxProfileRow"><input id="pxProfile" type="checkbox" checked> Incrustar/etiquetar perfil sRGB</label>
    <p class="hint" id="pxSupport">PNG recibe una etiqueta sRGB explícita; JPEG, WebP y AVIF usan la gestión de color sRGB del codificador del navegador. AVIF depende de que el navegador lo incluya.</p>`;
  let timer=null,lastUrl="",alphaUI=null;
  const hasAlpha=hasTransparency(flat);
  const update=()=>{clearTimeout(timer);timer=setTimeout(async()=>{
    const f=body.querySelector("#pxFormat").value,q=+body.querySelector("#pxQuality").value/100;
    if(f==="heic"){
      paintPreview(body.querySelector("#pxAfter"),flat);
      body.querySelector("#pxInfo").textContent="HEIC · lo codifica el HEVC de este dispositivo; el peso lo decide él (8 bits, sin metadatos)";
      return;
    }
    if(/^ps[db]/.test(f)){
      paintPreview(body.querySelector("#pxAfter"),flat);
      body.querySelector("#pxInfo").textContent=f.endsWith("16")?`${f.slice(0,3).toUpperCase()} de 16 bits · imagen final sin comprimir (≈ ${(doc.w*doc.h*6/1048576).toFixed(1)} MB a 1×)`:`${f.toUpperCase()} · capas, máscaras y estilos; tamaño según contenido`;
      return;
    }
    const sample=resizeCanvas(flat,Math.min(doc.w,900),Math.max(1,Math.round(Math.min(doc.w,900)*doc.h/doc.w)));
    const blob=await encodeCanvas(sample,f,q,body.querySelector("#pxProfile").checked,alphaUI?alphaUI.values():{});
    if(!blob){body.querySelector("#pxInfo").textContent=`${f.toUpperCase()} no disponible`;return;}
    if(lastUrl)URL.revokeObjectURL(lastUrl);lastUrl=URL.createObjectURL(blob);
    const bmp=await createImageBitmap(blob.type==="application/pdf"?await blobOf(sample,"image/jpeg",q):blob);
    paintPreview(body.querySelector("#pxAfter"),bmp);bmp.close();
    body.querySelector("#pxInfo").textContent=`${f.toUpperCase()} · ${(blob.size/1024).toFixed(0)} KB estimados`;
  },220);};
  paintPreview(body.querySelector("#pxBefore"),flat);paintPreview(body.querySelector("#pxAfter"),flat);
  const result=await dialog({title:"Exportar como",body,wide:true,cls:isMobile()?"dlg-compact":"dlg-export-pro",buttons:[{label:"Cancelar",value:null},{label:"Exportar",primary:true,value:"go"}],onOpen(host){
    const f=host.querySelector("#pxFormat"),q=host.querySelector("#pxQuality"),qv=host.querySelector("#pxQualityV"),row=host.querySelector("#pxQualityRow");
    const precision=host.querySelector("#pxPrecision"),hint=host.querySelector("#pxPrecisionHint");
    const precisionState=()=>{const biggest=Math.max(...[...host.querySelectorAll("[data-scale]:checked")].map(x=>+x.dataset.scale),1),ok=highPrecisionAvailableFor(doc.w*biggest,doc.h*biggest);const lay=f.value==="psd"||f.value==="psb";precision.disabled=!ok.ok||lay;hint.textContent=lay?"PSD y PSB conservan píxeles de 8 bits por canal; capas, máscaras y estilos siguen editables en Photoshop.":ok.ok?"Capas y ajustes en coma flotante y remuestreo en RGB lineal al generar los archivos; la previsualización sigue siendo rápida.":`Se usará el motor compatible: ${ok.reason}.`;};
    /* HEIC sólo donde el dispositivo trae un codificador HEVC (io/heic.js) */
    import("./heic.js").then(H=>H.heicSupported()).then(ok=>{if(!ok||f.querySelector('option[value="heic"]'))return;const o=document.createElement("option");o.value="heic";o.textContent="HEIC (Apple, ligero y de alta calidad)";f.querySelector('option[value="avif"]')?.after(o);}).catch(()=>{});
    if(hasAlpha&&f.value==="jpg"){f.value="png";row.hidden=true;}
    alphaUI=wireAlphaFields(host,{id:"pxA",getType:()=>f.value,hasAlpha,onChange:update,switchTo:()=>{f.value="png";f.dispatchEvent(new Event("change"));}});
    f.addEventListener("change",()=>{
      const psd=f.value==="psd"||f.value==="psb",tiff=f.value==="tiff";
      row.hidden=["png","tiff","psd","psb","psd16","psb16"].includes(f.value);
      host.querySelector("#pxScope").disabled=psd||f.value.endsWith("16");
      if(psd||f.value.endsWith("16"))host.querySelector("#pxScope").value="document";
      host.querySelector("#pxABox").hidden=psd;
      host.querySelector("#pxProfileRow").hidden=psd||tiff||f.value.endsWith("16");
      host.querySelector("#pxSupport").textContent=psd
        ?"Grupos, capas, máscaras reales, sombra/resplandor/trazo/degradado como efectos de Photoshop, los 27 modos de fusión y las capas de ajuste Invertir, Niveles y Curvas. Texto, objetos inteligentes y el resto se rasterizan (copia oculta de referencia). PSB admite hasta 300 000 px por lado. Guarda también el .realify para reeditarlo."
        :f.value.endsWith("16")?"Imagen final de 16 bits por canal (PSD/PSB RGB sin capas, sin comprimir) con perfil sRGB o Display P3 incrustado y 72 ppp: para no perder los 16 bits del motor de precisión. Con transparencia lleva un canal alfa. Para conservar las capas elige PSD o PSB de capas.":tiff?"TIFF RGBA sin pérdidas, 8 bits por canal y sin perfil ICC incrustado.":"PNG recibe una etiqueta sRGB explícita; JPEG, WebP y AVIF usan la gestión de color sRGB del navegador.";
      alphaUI.sync();precisionState();update();
    });q.addEventListener("input",()=>{qv.textContent=q.value;update();});host.querySelector("#pxProfile").addEventListener("change",update);update();
    host.querySelectorAll("[data-scale]").forEach(x=>x.addEventListener("change",precisionState));precisionState();
  }});
  clearTimeout(timer);if(lastUrl)URL.revokeObjectURL(lastUrl);if(result!=="go")return;
  const format=body.querySelector("#pxFormat").value,quality=+body.querySelector("#pxQuality").value/100,scope=body.querySelector("#pxScope").value,profile=body.querySelector("#pxProfile").checked,precision=body.querySelector("#pxPrecision").checked;
  const alphaOpts={alpha:body.querySelector("#pxAAlpha").checked&&!body.querySelector("#pxAAlpha").disabled,background:body.querySelector("#pxABg").value};
  const scales=[...body.querySelectorAll("[data-scale]:checked")].map(x=>+x.dataset.scale);if(!scales.length){toast("Selecciona al menos una escala","err");return;}
  const layered=format==="psd"||format==="psb",wide16=format==="psd16"||format==="psb16",items=layered||wide16?[{name:doc.name||"documento"}]:exportItems(scope),entries=[];status("Exportando archivos…");
  try{for(const item of items)for(const scale of scales){
    /* La ruta Float32 completa se puede usar para el documento, donde
       conocemos la pila de filtros. Las salidas de capa/grupo conservan
       su compositor actual hasta que cada tipo de capa se migre. */
    const precise=precision&&scope==="document"&&!layered&&!wide16?await renderPrecisionAdjustmentStack(item.canvas.width*scale,item.canvas.height*scale,{layersOnly:false}):null;
    const c=layered||wide16?null:precise?.canvas||resizeForExport(item.canvas,item.canvas.width*scale,item.canvas.height*scale,precision);
    const blob=wide16?await psd16Of(scale,format==="psb16",alphaOpts):layered?(await import("./professional-formats.js")).layeredPsd(scale,{psb:format==="psb"}):await encodeCanvas(c,format,quality,profile,alphaOpts);
    if(!blob){status("");toast(`${format.toUpperCase()} no está disponible en este navegador`,"err");return;}
    const itemName=scope==="document"?(cleanName(body.querySelector("#pxName").value)||base):cleanName(item.name)||"capa";
    entries.push({name:`${itemName}@${scale}x.${extOf(format)}`,data:new Uint8Array(await blob.arrayBuffer())});
  }}catch(error){status("");toast("No se pudo exportar: "+(error.message||error),"err");return;}
  let out,name;
  if(entries.length===1){out=new Blob([entries[0].data],{type:mimeOf(format)});name=entries[0].name;}
  else{out=buildZip(entries);name=`${cleanName(body.querySelector("#pxName").value)||base}-export-${stamp()}.zip`;}
  status("");const saved=await saveOrShare(out,name,"auto");if(saved!=="cancelled")toast(`Exportados ${entries.length} archivo${entries.length===1?"":"s"} · ${(out.size/1024/1024).toFixed(2)} MB`,"ok");
}
