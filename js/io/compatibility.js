/* Importadores de formatos profesionales. Los decodificadores viven
   en vendor y trabajan íntegramente en el navegador. */
import { doc, newDoc, makeLayer } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { clear as clearHistory } from "../core/history.js";
import { clearSnapshots } from "../core/snapshots.js";
import { defaultText, renderTextLayer, FONTS } from "../editor/text.js";
import { fromPsName } from "./psdfonts.js";
import { defaultStyles } from "../editor/layerstyles.js";
import { RAW_EXTENSIONS } from "../../raw/formats.js";
import { hiToCanvas8 } from "../core/hisrc.js";

const ext=file=>(file.name.split(".").pop()||"").toLowerCase();
export const compatibleFile=file=>file?.type?.startsWith("image/")||["psd","psb","tif","tiff","heic","heif","jxl","svg",...RAW_EXTENSIONS].includes(ext(file));
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

function parsePsd(buffer,opts={}){
  const A=globalThis.agPsd;if(!A)throw new Error("El decodificador PSD no está disponible");
  if(A.initializeCanvas)A.initializeCanvas((w,h)=>canvas(w,h));
  return A.readPsd(buffer,{skipThumbnail:true,...opts});
}
/* Profundidad de un PSD/PSB (cabecera): con 16 bits se leen los datos tal cual (useImageData) para no bajarlos a 8 */
const psdDepth=buffer=>buffer.byteLength>=26?new DataView(buffer).getUint16(22):8;
/** Píxeles de 16 bits de una capa de un PSD (RGBA Uint16 sin asociar) → trozo de lienzo de 8 bits (su redondeo tramado, como exige core/hisrc.js) y origen de 16 bits con su rectángulo. */
function hiPixels(id,left,top,W,H){
  const w=id.width,h=id.height,x0=Math.max(0,-left),y0=Math.max(0,-top),x1=Math.min(w,W-left),y1=Math.min(h,H-top);
  if(x1<=x0||y1<=y0)return null;
  const cw=x1-x0,ch=y1-y0,data=new Uint16Array(cw*ch*3),img=new ImageData(cw,ch),d=img.data,s=id.data;
  for(let y=0,k=0;y<ch;y++)for(let x=0;x<cw;x++,k++){
    const i=((y0+y)*w+x0+x)*4,j=k*3,o=k*4,R=s[i],G=s[i+1],B=s[i+2],A=s[i+3];
    data[j]=R;data[j+1]=G;data[j+2]=B;
    d[o+3]=Math.round(A/257);
    if(A){d[o]=hiToCanvas8(R,x,y,0,true);d[o+1]=hiToCanvas8(G,x,y,1,true);d[o+2]=hiToCanvas8(B,x,y,2,true);}
  }
  return {img,px:left+x0,py:top+y0,hiSrc:{data,w:cw,h:ch,dither:true,x:left+x0,y:top+y0,canvasW:W,canvasH:H}};
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
  if((e==="psd"||e==="psb")){const p=parsePsd(await file.arrayBuffer());if(!p.canvas)throw new Error("El PSD no contiene una composición");return p.canvas;}
  return createImageBitmap(file,{colorSpaceConversion:"default",premultiplyAlpha:"default"});
}

/* Modos de Photoshop (nombres de ag-psd) → los de Realify */
const blend={normal:"source-over",multiply:"multiply",screen:"screen",overlay:"overlay",darken:"darken",lighten:"lighten",difference:"difference",exclusion:"exclusion",
  "color burn":"color-burn","color dodge":"color-dodge","hard light":"hard-light","soft light":"soft-light",hue:"hue",saturation:"saturation",color:"color",luminosity:"luminosity",
  "linear dodge":"lighter","linear light":"linear-light","linear burn":"linear-burn",subtract:"subtract",divide:"divide","pin light":"pin-light","vivid light":"vivid-light",
  "hard mix":"hard-mix","darker color":"darker-color","lighter color":"lighter-color",dissolve:"dissolve","pass through":"source-over"};
const val=v=>v&&typeof v==="object"?(v.value??0):(+v||0);
const alpha01=v=>v==null?1:v>1?v/255:v;
const rgbaHex=c=>c&&typeof c==="object"?"#"+[c.r,c.g,c.b].map(v=>Math.max(0,Math.min(255,v||0)).toString(16).padStart(2,"0")).join(""):"#ffffff";

/* La máscara de Photoshop es un tono de gris (R); la de Realify, el alfa de su lienzo. Fuera del rectángulo vale «defaultColor». */
function maskFor(src,w,h){
  const mc=src?.canvas||src?.imageData;if(!mc)return null;       // `imageData` de un PSD de 16 bits: Uint16 (se baja a 8, que es lo que vale una máscara de Realify)
  const c=canvas(w,h),x=c.getContext("2d",{willReadFrequently:true}),out=x.createImageData(w,h),o=out.data;
  const def=src.defaultColor==null?255:src.defaultColor;
  for(let i=0;i<o.length;i+=4){o[i]=o[i+1]=o[i+2]=0;o[i+3]=def;}
  const mw=mc.width,mh=mc.height,left=src.left||0,top=src.top||0;
  const d=mc.data?mc.data:mc.getContext("2d",{willReadFrequently:true}).getImageData(0,0,mw,mh).data,sc=d instanceof Uint16Array?1/257:1;
  for(let y=0;y<mh;y++){const Y=y+top;if(Y<0||Y>=h)continue;for(let X0=0;X0<mw;X0++){const X=X0+left;if(X<0||X>=w)continue;o[(Y*w+X)*4+3]=Math.round(d[(y*mw+X0)*4]*sc);}}
  x.putImageData(out,0,0);
  return {canvas:c,ctx:x};
}

/* Efectos de capa de Photoshop → estilos de Realify (sombra, resplandor exterior, trazo, degradado) */
function stylesFrom(fx){
  if(!fx)return null;const st=defaultStyles();let any=false;const on=e=>e&&e.enabled!==false&&e.present!==false;
  const sh=[].concat(fx.dropShadow||[]).find(on);
  if(sh){const d=val(sh.distance),a=(+sh.angle||0)*Math.PI/180;st.shadow={enabled:true,color:rgbaHex(sh.color),opacity:Math.round((sh.opacity??.75)*100),blur:val(sh.size),x:+(-d*Math.cos(a)).toFixed(2),y:+(d*Math.sin(a)).toFixed(2)};any=true;}
  if(on(fx.outerGlow)){st.glow={enabled:true,color:rgbaHex(fx.outerGlow.color),opacity:Math.round((fx.outerGlow.opacity??.75)*100),size:val(fx.outerGlow.size)};any=true;}
  const sk=[].concat(fx.stroke||[]).find(on);if(sk&&sk.fillType!=="gradient"&&sk.fillType!=="pattern"){st.stroke={enabled:true,color:rgbaHex(sk.color),width:val(sk.size)};any=true;}
  const gr=[].concat(fx.gradientOverlay||[]).find(on),cs=gr?.gradient?.colorStops;
  if(gr&&cs&&cs.length>=2){st.gradient={enabled:true,color1:rgbaHex(cs[0].color),color2:rgbaHex(cs[cs.length-1].color),angle:Math.round(-(+gr.angle||0)),opacity:Math.round((gr.opacity??1)*100)};any=true;}
  return any?st:null;
}

/* Capa de ajuste de Photoshop → de Realify (invertir, niveles y curvas; el resto no se puede traducir) */
function adjustFrom(src){
  const a=src.adjustment;if(!a)return null;
  if(a.type==="invert")return {type:"invert",params:{}};
  if(a.type==="levels"){
    const chans=[["rgb","rgb"],["red","r"],["green","g"],["blue","b"]],id=c=>!c||(c.shadowInput===0&&c.highlightInput===255&&c.shadowOutput===0&&c.highlightOutput===255&&Math.abs((c.midtoneInput??1)-1)<1e-6);
    const used=chans.filter(([k])=>!id(a[k]));if(used.length>1)return null;
    const [k,ch]=used[0]||["rgb","rgb"],c=a[k]||{};
    return {type:"levels",params:{inLow:c.shadowInput??0,inHigh:c.highlightInput??255,gamma:c.midtoneInput??1,outLow:c.shadowOutput??0,outHigh:c.highlightOutput??255,channel:ch}};
  }
  if(a.type==="exposure"&&!a.offset&&Math.abs((a.gamma??1)-1)<1e-6)return {type:"exposure",params:{ev:a.exposure||0}};
  if(a.type==="channel mixer"&&a.monochrome&&a.gray&&Math.abs(a.gray.red-21)<=1&&Math.abs(a.gray.green-72)<=1&&Math.abs(a.gray.blue-7)<=1&&!a.gray.constant)return {type:"gray",params:{}};
  if(a.type==="hue/saturation"&&a.master&&!a.colorize)return {type:"hsl",params:{hue:a.master.hue||0,sat:a.master.saturation||0,light:a.master.lightness||0,colorize:false}};
  if(a.type==="brightness/contrast")return {type:"bc",params:{brightness:a.brightness||0,contrast:a.contrast||0,protect:100,pivot:"auto",useLegacy:!!a.useLegacy}};
  if(a.type==="curves"&&(a.red||a.green||a.blue)){            // curvas por canal con la forma de un balance de blancos (ganancia por canal): Realify lo reconoce
    const gain=pts=>{if(!pts||pts.length<2)return 1;const p=pts.map(q=>[q.input,q.output]).sort((x,y)=>x[0]-y[0]),last=p[p.length-1];
      if(p.length===2)return p[0][0]===0&&p[0][1]===0&&last[0]===255?last[1]/255:NaN;
      return p.length===3&&p[1][1]===255&&last[1]===255&&p[0][0]===0&&p[0][1]===0&&p[1][0]>0?255/p[1][0]:NaN;};
    const r=gain(a.red),g=gain(a.green),b=gain(a.blue);
    if([r,g,b].every(Number.isFinite)&&Math.abs(r+b-2)<.03){const temp=Math.round((r-b)/.8*100),tint=Math.round((1-g)/.25*100);if(temp||tint)return {type:"wb",params:{temp,tint}};}
    return null;
  }
  if(a.type==="curves"&&a.rgb&&a.rgb.length>=2&&!a.red&&!a.green&&!a.blue)return {type:"curves",params:{points:a.rgb.map(p=>[p.input,p.output])}};
  return null;
}

function psdTextLayer(src,parentId){
  const l=makeLayer({name:src.name||"Texto",type:"text"});l.groupId=parentId;l.visible=!src.hidden;l.opacity=src.opacity==null?1:(src.opacity>1?src.opacity/255:src.opacity);
  const t=src.text||{},style=t.style||t.styleRuns?.[0]?.style||{};
  const rawSize=style.fontSize, size=typeof rawSize==="number"?rawSize:rawSize?.value;
  const m=t.transform||[1,0,0,1,0,0],angle=Math.atan2(m[1],m[0]),scale=Math.hypot(m[0],m[1])||1;
  const d=defaultText(),sz=Math.round((size||d.size)*scale);
  l.text={...d,content:t.text||t.value||src.name||"Texto",x:(src.left||0)+Math.max(1,(src.right-src.left||0))/2,y:(src.top||0)+Math.max(1,(src.bottom-src.top||0))/2,size:sz,color:rgbaHex(style.fillColor||style.color)};
  const just=t.paragraphStyle?.justification;if(just==="left"||just==="center"||just==="right")l.text.align=just;else if(typeof just==="string"&&/^justify/.test(just))l.text.align="left";
  const f=fromPsName(style.font?.name,FONTS.map(x=>x[0]).filter(x=>typeof x==="string"));
  if(f){l.text.font=f.stack;if(f.bold)l.text.weight=700;if(f.italic)l.text.italic=true;}else if(style.font?.name)l.text.font=style.font.name;
  if(style.fauxBold)l.text.weight=700;if(style.fauxItalic)l.text.italic=true;
  if(Number.isFinite(style.tracking)&&sz)l.text.tracking=+(style.tracking*sz/1000).toFixed(2);
  const lead=style.leading;if(Number.isFinite(lead)&&lead>0&&!style.autoLeading&&sz)l.text.lineHeight=+Math.min(4,Math.max(.5,lead*scale/sz)).toFixed(3);
  if(style.strokeFlag&&style.outlineWidth>0){l.text.strokeWidth=+(style.outlineWidth*scale).toFixed(2);l.text.strokeColor=rgbaHex(style.strokeColor);}
  if(Math.abs(angle)>1e-4)l.text.angle=+(angle*180/Math.PI).toFixed(2);
  if(t.shapeType==="box"&&Array.isArray(t.boxBounds)){      // texto de párrafo: el marco y su centro (el origen es su esquina superior izquierda; el giro, alrededor de su centro)
    const bw=(t.boxBounds[2]-t.boxBounds[0])*scale,bh=(t.boxBounds[3]-t.boxBounds[1])*scale,cs=Math.cos(angle),sn=Math.sin(angle);
    if(bw>0&&bh>0){l.text.boxW=Math.round(bw);l.text.boxH=Math.round(bh);l.text.x=m[4]+(bw/2)*cs-(bh/2)*sn;l.text.y=m[5]+(bw/2)*sn+(bh/2)*cs;}
  }
  renderTextLayer(l);return l;
}

let smartFiles=null;
/* Objeto inteligente de Photoshop → de Realify: el original es el PNG/JPEG enlazado (caja = su tamaño) y la transformación sale de las esquinas
   (arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda) como giro·escala·sesgo del centro (la misma descomposición que usa affineQuad() de
   editor/transformtool.js, con el sesgo sólo en X y el volteo vertical si la orientación se invierte). null si no es un paralelogramo. */
function smartFromQuad(q,img){
  if(!q||q.length!==8||!q.every(Number.isFinite))return null;
  const w=img.width,h=img.height,P=[[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]];
  if(Math.abs(P[0][0]+P[2][0]-P[1][0]-P[3][0])>.75||Math.abs(P[0][1]+P[2][1]-P[1][1]-P[3][1])>.75)return null;
  const a=(P[1][0]-P[0][0])/w,c=(P[1][1]-P[0][1])/w,b=(P[3][0]-P[0][0])/h,d=(P[3][1]-P[0][1])/h;       // L = [[a,b],[c,d]]
  const sx=Math.hypot(a,c);if(!(sx>1e-6))return null;
  const angle=Math.atan2(c,a),cs=Math.cos(angle),sn=Math.sin(angle),u12=cs*b+sn*d,u22=-sn*b+cs*d;       // R^T·L = [[sx, sx·tanX],[0, sy]]
  const cx=(P[0][0]+P[1][0]+P[2][0]+P[3][0])/4,cy=(P[0][1]+P[1][1]+P[2][1]+P[3][1])/4;
  return {t:{mode:"free",sx,sy:Math.abs(u22),angle,skewX:Math.atan(u12/sx),skewY:0,tx:cx-w/2,ty:cy-h/2,flipH:false,flipV:u22<0,meshCols:3,meshRows:3,grid:null},box:{x:0,y:0,w,h}};
}
function importPsdNodes(nodes,parentId=null,out=[]){
  /* PSD guarda visualmente de arriba abajo; Realify compone de abajo
     arriba, por eso se invierte cada nivel. */
  for(const src of [...(nodes||[])].reverse()){
    if(src.children){const g=makeLayer({name:src.name||"Grupo",type:"group"});g.groupId=parentId;g.visible=!src.hidden;g.opacity=alpha01(src.opacity);g.blend=blend[src.blendMode]||"source-over";g.styles=stylesFrom(src.effects);const gm=maskFor(src.mask,doc.w,doc.h);if(gm){g.mask=gm;g.maskEnabled=!src.mask.disabled;}out.push(g);importPsdNodes(src.children,g.id,out);continue;}
    const adj=adjustFrom(src);
    const l=adj?makeLayer({name:src.name||"Ajuste",type:"adjust"}):src.text?psdTextLayer(src,parentId):makeLayer({name:src.name||"Capa"});
    if(adj){l.adjustType=adj.type;l.adjustParams=adj.params;}
    l.groupId=parentId;l.visible=!src.hidden;l.opacity=alpha01(src.opacity);l.blend=blend[src.blendMode]||"source-over";l.clipped=!!src.clipping;l.styles=stylesFrom(src.effects);
    const br=src.blendingRanges,bi=a=>({blackMin:a[0],blackMax:a[1],whiteMin:a[2],whiteMax:a[3]}),isDef=a=>!a||a.join()==="0,0,255,255";
    if(br&&br.compositeGrayBlendSource&&br.compositeGraphBlendDestinationRange){
      const bf={thisLayer:bi(br.compositeGrayBlendSource),underlying:bi(br.compositeGraphBlendDestinationRange)};
      (br.ranges||[]).slice(0,3).forEach((r,k)=>{if(r&&(!isDef(r.sourceRange)||!isDef(r.destRange))){bf.channels=bf.channels||{};bf.channels["rgb"[k]]={thisLayer:r.sourceRange?bi(r.sourceRange):bi([0,0,255,255]),underlying:r.destRange?bi(r.destRange):bi([0,0,255,255])};}});
      if(!isDef(br.compositeGrayBlendSource)||!isDef(br.compositeGraphBlendDestinationRange)||bf.channels)l.blendIf=bf;
    }
    if(!src.text&&src.canvas)l.ctx.drawImage(src.canvas,src.left||0,src.top||0);
    else if(!src.text&&src.imageData&&src.imageData.data instanceof Uint16Array){          // PSD de 16 bits: se conservan los 16 bits (origen parcial con su rectángulo)
      const r=hiPixels(src.imageData,src.left||0,src.top||0,doc.w,doc.h);if(r){l.ctx.putImageData(r.img,r.px,r.py);l.hiSrc=r.hiSrc;}
    }else if(!src.text&&src.imageData)l.ctx.putImageData(new ImageData(new Uint8ClampedArray(src.imageData.data),src.imageData.width,src.imageData.height),src.left||0,src.top||0);
    const m=maskFor(src.mask,doc.w,doc.h);if(m){l.mask=m;l.maskEnabled=!src.mask.disabled;}const sm=smartFiles&&src.placedLayer&&smartFiles.get(src.placedLayer.placed||src.placedLayer.id);
    if(sm&&!src.text){const st=smartFromQuad(src.placedLayer.transform,sm);       // sólo transformaciones afines (con giro y sesgo): la malla no cabe
      if(st){l.smart=true;l.smartSource=sm;l.smartTransform=st.t;l.smartBox=st.box;}}
    l.thumbDirty=true;out.push(l);
  }return out;
}

export async function openPsd(file){
  const buf=await file.arrayBuffer(),deep=psdDepth(buf)===16;
  const psd=parsePsd(buf,deep?{useImageData:true}:{});newDoc(psd.width,psd.height,{name:file.name.replace(/\.[^.]+$/,"")});
  smartFiles=new Map();
  for(const f of psd.linkedFiles||[]){if(!f.data||!/^(png|jpg|jpeg|webp|gif)$/i.test(f.type||""))continue;
    try{const bm=await createImageBitmap(new Blob([f.data]));const c=canvas(bm.width,bm.height);c.getContext("2d").drawImage(bm,0,0);smartFiles.set(f.id,c);}catch{}}
  doc.layers=importPsdNodes(psd.children||[]);smartFiles=null;if(!doc.layers.length){
    const l=makeLayer({name:"Composición"});
    if(psd.canvas)l.ctx.drawImage(psd.canvas,0,0);
    else if(psd.imageData&&psd.imageData.data instanceof Uint16Array){const r=hiPixels(psd.imageData,0,0,doc.w,doc.h);if(r){l.ctx.putImageData(r.img,r.px,r.py);l.hiSrc=r.hiSrc;}}
    doc.layers=[l];}
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
