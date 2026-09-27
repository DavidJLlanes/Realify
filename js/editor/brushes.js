/* Motor de pinceles profesionales: puntas, dinámica, dispersión,
   suavizado y simetría. Todo es local; las puntas importadas se
   guardan como máscaras PNG en localStorage. */
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { activeLayer } from "../core/doc.js";
import { emit } from "../core/bus.js";

const CFG_KEY="realify.brush.config",TIPS_KEY="realify.brush.tips";
const defaults={tip:"round",flow:100,spacing:12,scatter:0,angle:0,smoothing:35,
  sizeDynamics:"pressure",opacityDynamics:"none",flowDynamics:"none",
  scatterDynamics:"none",angleDynamics:"direction",symmetry:"none",symmetryCount:6};
export const brushConfig={...defaults,...read(CFG_KEY,{})};
let customTips=read(TIPS_KEY,[]),runtime=new Map(),stampCache=new Map();

function read(k,fallback){try{return JSON.parse(localStorage.getItem(k)||"")||fallback;}catch{return fallback;}}
function save(){try{localStorage.setItem(CFG_KEY,JSON.stringify(brushConfig));localStorage.setItem(TIPS_KEY,JSON.stringify(customTips.slice(-40)));}catch{toast("No queda espacio para guardar más puntas", "err");}}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function hash(a,b,c=1){let n=(a*374761393+b*668265263+c*69069)|0;n=(n^(n>>>13))*1274126177;return((n^(n>>>16))>>>0)/4294967295;}
function imageFor(tip){if(runtime.has(tip.id))return runtime.get(tip.id);const im=new Image();im.src=tip.data;runtime.set(tip.id,im);return im;}

const BUILTINS=[
  {id:"round",name:"Redondo"},{id:"square",name:"Cuadrado"},
  {id:"chalk",name:"Tiza"},{id:"spray",name:"Aerógrafo disperso"}
];
export const brushTips=()=>[...BUILTINS,...customTips];

function generatedTip(id){if(runtime.has(id))return runtime.get(id);const c=document.createElement("canvas"),x=c.getContext("2d");c.width=c.height=128;x.fillStyle="#fff";
  if(id==="square")x.fillRect(5,5,118,118);
  else if(id==="chalk"){for(let y=4;y<124;y+=3)for(let z=4;z<124;z+=3){const a=hash(z,y,8),r=Math.hypot(z-64,y-64);if(r<59&&a>.28){x.globalAlpha=.25+a*.75;x.fillRect(z,y,2+(a*3|0),2+(a*3|0));}}}
  else if(id==="spray"){for(let i=0;i<520;i++){const a=hash(i,2,7)*Math.PI*2,r=Math.sqrt(hash(i,9,3))*60;x.globalAlpha=.15+hash(i,3,4)*.7;x.beginPath();x.arc(64+Math.cos(a)*r,64+Math.sin(a)*r,.5+hash(i,5,2)*1.7,0,Math.PI*2);x.fill();}}
  runtime.set(id,c);return c;
}
function tipSource(id){if(id==="round")return null;const b=BUILTINS.find(t=>t.id===id);return b?generatedTip(id):imageFor(customTips.find(t=>t.id===id)||customTips[0]||{id:"round",data:""});}
function tintedTip(id,color){const key=id+color;if(stampCache.has(key))return stampCache.get(key);const src=tipSource(id);if(!src||!src.width)return null;const c=document.createElement("canvas");c.width=src.naturalWidth||src.width;c.height=src.naturalHeight||src.height;const x=c.getContext("2d");x.drawImage(src,0,0,c.width,c.height);x.globalCompositeOperation="source-in";x.fillStyle=color;x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation="source-over";stampCache.set(key,c);return c;}

function sensor(kind,pressure,speed,inverse=false){if(kind==="pressure")return .12+.88*pressure;if(kind==="speed"){const fast=clamp(speed/1.8);return inverse?fast:1-fast*.78;}return 1;}
function realPressure(e){const p=e&&Number.isFinite(e.pressure)?e.pressure:0;return p>0&&p!==.5?clamp(p):1;}
function variants(pt,doc){const cx=doc.w/2,cy=doc.h/2,out=[{x:pt.x,y:pt.y,rot:0}],m=brushConfig.symmetry;
  if(m==="horizontal"||m==="both")out.push({x:doc.w-pt.x,y:pt.y,rot:Math.PI});
  if(m==="vertical"||m==="both")out.push({x:pt.x,y:doc.h-pt.y,rot:0});
  if(m==="both")out.push({x:doc.w-pt.x,y:doc.h-pt.y,rot:Math.PI});
  if(m==="radial"){out.length=0;const n=Math.max(2,brushConfig.symmetryCount|0),dx=pt.x-cx,dy=pt.y-cy;for(let i=0;i<n;i++){const a=i*Math.PI*2/n,c=Math.cos(a),s=Math.sin(a);out.push({x:cx+dx*c-dy*s,y:cy+dx*s+dy*c,rot:a});}}
  return out;
}
function roundGradient(ctx,x,y,r,color,hardness){const inner=clamp(hardness/100,0,.98),g=ctx.createRadialGradient(x,y,r*inner,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color.length===7?color+"00":color);return g;}
function stamp(ctx,pt,angle,size,alpha,color,hardness,seed){const scatter=size*brushConfig.scatter/100*sensor(brushConfig.scatterDynamics,pt.pressure,pt.speed,true),sa=hash(seed,11,5)*Math.PI*2,sr=Math.sqrt(hash(seed,17,9))*scatter,x=pt.x+Math.cos(sa)*sr,y=pt.y+Math.sin(sa)*sr,source=tipSource(brushConfig.tip);ctx.save();ctx.globalAlpha=clamp(alpha);ctx.globalCompositeOperation="source-over";
  if(!source){ctx.fillStyle=hardness>=99?color:roundGradient(ctx,x,y,size/2,color,hardness);ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();}
  else{const tip=tintedTip(brushConfig.tip,color);if(tip){const ratio=(tip.naturalWidth||tip.width)/(tip.naturalHeight||tip.height),w=ratio>=1?size:size*ratio,h=ratio>=1?size/ratio:size;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(tip,-w/2,-h/2,w,h);}}
  ctx.restore();
}

/** Pinta un segmento y devuelve el sobrante de espaciado para el siguiente. */
export function paintProfessionalSegment(ctx,a,b,{event,color,size,hardness,opacity,velocity=0,carry=0,doc,seed=1}={}){const pressure=realPressure(event),sizeK=sensor(brushConfig.sizeDynamics,pressure,velocity),opacityK=sensor(brushConfig.opacityDynamics,pressure,velocity),flowK=sensor(brushConfig.flowDynamics,pressure,velocity),diameter=Math.max(1,size*sizeK),step=Math.max(1,diameter*brushConfig.spacing/100),dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),direction=Math.atan2(dy,dx),points=[];let avail=carry+dist,along=-carry;
  if(dist===0)points.push({x:b.x,y:b.y});else while(avail>=step){along+=step;points.push({x:a.x+dx/dist*along,y:a.y+dy/dist*along});avail-=step;}carry=dist===0?0:avail;
  let index=0;for(const p of points){const dynAngle=brushConfig.angleDynamics==="direction"?direction:brushConfig.angleDynamics==="pressure"?(pressure-.5)*Math.PI:brushConfig.angleDynamics==="speed"?clamp(velocity/2)*Math.PI:0,angle=brushConfig.angle*Math.PI/180+dynAngle,alpha=(opacity/100)*opacityK*(brushConfig.flow/100)*flowK;for(const v of variants(p,doc)){stamp(ctx,{...v,pressure,speed:velocity},angle+v.rot,diameter,alpha,color,hardness,seed+index++);}}
  return carry;
}

/* Caja conservadora de lo que puede tocar un segmento, incluidas la
   dispersión y todas las copias simétricas. La usa el compositor para
   reservar e invalidar sólo los mosaicos alcanzados por el trazo. */
export function professionalSegmentBounds(a,b,size,documentModel){
  const reach=Math.max(2,size*(.55+brushConfig.scatter/100)+3),pts=[];
  for(const p of [a,b])for(const v of variants(p,documentModel))pts.push(v);
  const minX=Math.min(...pts.map(p=>p.x))-reach,minY=Math.min(...pts.map(p=>p.y))-reach;
  const maxX=Math.max(...pts.map(p=>p.x))+reach,maxY=Math.max(...pts.map(p=>p.y))+reach;
  return{x:minX,y:minY,w:maxX-minX,h:maxY-minY};
}

export function smoothBrushPoint(previous,target){if(!previous)return target;const k=1-clamp(brushConfig.smoothing/100)*.88;return{x:previous.x+(target.x-previous.x)*k,y:previous.y+(target.y-previous.y)*k};}

function inputFile(accept){return new Promise(resolve=>{const i=document.createElement("input");i.type="file";i.accept=accept;i.onchange=()=>resolve(i.files?.[0]||null);i.click();});}
function canvasToTip(canvas,name){const max=512,s=Math.min(1,max/Math.max(canvas.width,canvas.height)),w=Math.max(1,Math.round(canvas.width*s)),h=Math.max(1,Math.round(canvas.height*s)),src=document.createElement("canvas");src.width=w;src.height=h;src.getContext("2d").drawImage(canvas,0,0,w,h);const im=src.getContext("2d").getImageData(0,0,w,h),hasAlpha=im.data.some((v,i)=>i%4===3&&v<250),mask=document.createElement("canvas");mask.width=w;mask.height=h;const mi=mask.getContext("2d").createImageData(w,h);for(let i=0;i<im.data.length;i+=4){const l=.2126*im.data[i]+.7152*im.data[i+1]+.0722*im.data[i+2];mi.data[i]=mi.data[i+1]=mi.data[i+2]=255;mi.data[i+3]=hasAlpha?im.data[i+3]:255-l;}mask.getContext("2d").putImageData(mi,0,0);return addTip(mask,name);}
function addTip(canvas,name){const id="tip-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),data=canvas.toDataURL("image/png"),tip={id,name,data};customTips.push(tip);const im=new Image();im.src=data;runtime.set(id,im);brushConfig.tip=id;save();stampCache.clear();return tip;}
async function imageFileTip(){const f=await inputFile("image/png,image/jpeg,image/webp,image/gif");if(!f)return null;const url=URL.createObjectURL(f);try{const im=new Image();await new Promise((ok,no)=>{im.onload=ok;im.onerror=no;im.src=url;});const c=document.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext("2d").drawImage(im,0,0);return canvasToTip(c,f.name.replace(/\.[^.]+$/,"")||"Punta importada");}finally{URL.revokeObjectURL(url);}}

function packBits(bytes,pos,width,height,rowBytes=2){const lengths=[];for(let y=0;y<height;y++){if(pos+rowBytes>bytes.length)throw Error("RLE truncado");let n=rowBytes===2?(bytes[pos]<<8|bytes[pos+1]):(bytes[pos]<<24|bytes[pos+1]<<16|bytes[pos+2]<<8|bytes[pos+3]);lengths.push(n>>>0);pos+=rowBytes;}const out=new Uint8Array(width*height);for(let y=0;y<height;y++){const end=pos+lengths[y];let x=0;while(pos<end&&x<width){let n=bytes[pos++];if(n>127)n-=256;if(n>=0){const count=n+1;out.set(bytes.subarray(pos,pos+count),y*width+x);pos+=count;x+=count;}else if(n!==-128){const count=1-n,v=bytes[pos++];out.fill(v,y*width+x,y*width+Math.min(width,x+count));x+=count;}}}return{data:out,pos};}
function maskTip(mask,w,h,name){const c=document.createElement("canvas");c.width=w;c.height=h;const im=c.getContext("2d").createImageData(w,h);for(let i=0;i<mask.length;i++){const a=i*4;im.data[a]=im.data[a+1]=im.data[a+2]=255;im.data[a+3]=mask[i];}c.getContext("2d").putImageData(im,0,0);return addTip(c,name);}
function parseV12(bytes,version,count,name){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tips=[];let p=4;const u16=()=>{const n=v.getUint16(p);p+=2;return n;},u32=()=>{const n=v.getUint32(p);p+=4;return n;},i32=()=>{const n=v.getInt32(p);p+=4;return n;};for(let n=0;n<count&&p+6<=bytes.length;n++){const type=u16(),size=u32(),end=Math.min(bytes.length,p+size);if(type!==2){p=end;continue;}p+=4;const spacing=u16();let tipName=`${name} ${n+1}`;if(version===2){const chars=u32();if(chars>0&&chars<1024&&p+chars*2<=end){let s="";for(let i=0;i<chars;i++){const c=u16();if(c)s+=String.fromCharCode(c);}if(s)tipName=s;}}p+=1+8;const top=i32(),left=i32(),bottom=i32(),right=i32(),depth=u16(),w=right-left,h=bottom-top;if(w<1||h<1||w>10000||h>10000||depth!==8||p>=end){p=end;continue;}const comp=bytes[p++];let mask;if(comp===0){mask=bytes.slice(p,p+w*h);p+=w*h;}else if(comp===1){const r=packBits(bytes,p,w,h);mask=r.data;p=r.pos;}if(mask?.length===w*h)tips.push(maskTip(mask,w,h,tipName));p=end;}return tips;}
function findAscii(bytes,text,start=0){outer:for(let i=start;i<=bytes.length-text.length;i++){for(let j=0;j<text.length;j++)if(bytes[i+j]!==text.charCodeAt(j))continue outer;return i;}return-1;}
function parseV6(bytes,sub,name){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),mark=findAscii(bytes,"8BIMsamp",4);if(mark<0)throw Error("El ABR no contiene puntas raster");let p=mark+8;if(p+4>bytes.length)throw Error("Sección samp truncada");const sectionEnd=Math.min(bytes.length,p+4+v.getUint32(p));p+=4;const tips=[];for(let n=0;p+4<sectionEnd;n++){const size=v.getUint32(p);p+=4;const padded=(size+3)&~3,end=Math.min(sectionEnd,p+padded),skip=sub===1?47:301;if(p+skip+19>end){p=end;continue;}p+=skip;const top=v.getInt32(p),left=v.getInt32(p+4),bottom=v.getInt32(p+8),right=v.getInt32(p+12),depth=v.getUint16(p+16),comp=bytes[p+18];p+=19;const w=right-left,h=bottom-top;if(w<1||h<1||w>10000||h>10000||(depth!==8&&depth!==16)){p=end;continue;}let mask;if(comp===0){if(depth===8)mask=bytes.slice(p,p+w*h);else{mask=new Uint8Array(w*h);for(let i=0;i<mask.length;i++)mask[i]=bytes[p+i*2];}}else if(comp===1&&depth===8){mask=packBits(bytes,p,w,h).data;}if(mask?.length===w*h)tips.push(maskTip(mask,w,h,`${name} ${n+1}`));p=end;}return tips;}
async function importAbr(){const f=await inputFile(".abr,application/octet-stream");if(!f)return[];const bytes=new Uint8Array(await f.arrayBuffer());if(bytes.length<4)throw Error("Archivo ABR vacío");const version=bytes[0]<<8|bytes[1],count=bytes[2]<<8|bytes[3],base=f.name.replace(/\.abr$/i,"");if(version===1||version===2)return parseV12(bytes,version,count,base);if(version===6||version===10)return parseV6(bytes,count,base);throw Error(`Versión ABR ${version} no compatible`);}

function control(label,node){const r=document.createElement("label");r.className="brush-control";const s=document.createElement("span");s.textContent=label;r.append(s,node);return r;}
function range(key,min,max,unit=""){const wrap=document.createElement("span");wrap.className="brush-range";const i=document.createElement("input"),v=document.createElement("b");i.type="range";i.min=min;i.max=max;i.value=brushConfig[key];v.textContent=i.value+unit;i.oninput=()=>{brushConfig[key]=+i.value;v.textContent=i.value+unit;save();};wrap.append(i,v);return wrap;}
function select(key,items){const s=document.createElement("select");for(const [v,n]of items){const o=document.createElement("option");o.value=v;o.textContent=n;s.append(o);}s.value=brushConfig[key];s.onchange=()=>{brushConfig[key]=s.value;save();};return s;}
function renderTipGallery(host){host.innerHTML="";for(const tip of brushTips()){const b=document.createElement("button");b.type="button";b.className="brush-tip"+(tip.id===brushConfig.tip?" active":"");b.title=tip.name;const c=document.createElement("canvas");c.width=c.height=46;const x=c.getContext("2d");x.fillStyle="#fff";const src=tip.id==="round"?null:tipSource(tip.id);if(src&&src.width)x.drawImage(src,3,3,40,40);else{x.beginPath();x.arc(23,23,18,0,Math.PI*2);x.fill();}const n=document.createElement("span");n.textContent=tip.name;b.append(c,n);b.onclick=()=>{brushConfig.tip=tip.id;save();renderTipGallery(host);};host.append(b);}}

export async function openBrushPanel(){const body=document.createElement("div");body.className="brush-panel";const tips=document.createElement("div");tips.className="brush-tip-grid";renderTipGallery(tips);const actions=document.createElement("div");actions.className="brush-actions";const image=document.createElement("button");image.textContent="Punta desde imagen…";image.onclick=async()=>{try{if(await imageFileTip())renderTipGallery(tips);}catch(e){toast("No se pudo leer la imagen: "+e.message,"err");}};const layer=document.createElement("button");layer.textContent="Desde capa activa";layer.onclick=()=>{const l=activeLayer();if(!l)return toast("No hay capa activa");canvasToTip(l.canvas,l.name+" · punta");renderTipGallery(tips);};const abr=document.createElement("button");abr.textContent="Importar .abr…";abr.onclick=async()=>{try{const added=await importAbr();if(!added.length)throw Error("no contiene puntas raster compatibles");renderTipGallery(tips);toast(`${added.length} punta${added.length===1?"":"s"} ABR importada${added.length===1?"":"s"}`,"ok");}catch(e){toast("No se pudo importar: "+e.message,"err");}};actions.append(image,layer,abr);
  const dyn=[ ["none","Sin dinámica"],["pressure","Presión"],["speed","Velocidad"] ],angleDyn=[...dyn,["direction","Dirección del trazo"]];const settings=document.createElement("div");settings.className="brush-settings";settings.append(control("Flujo",range("flow",1,100,"%")),control("Espaciado",range("spacing",1,200,"%")),control("Dispersión",range("scatter",0,300,"%")),control("Ángulo",range("angle",-180,180,"°")),control("Suavizado",range("smoothing",0,100,"%")),control("Tamaño",select("sizeDynamics",dyn)),control("Opacidad",select("opacityDynamics",dyn)),control("Flujo dinámico",select("flowDynamics",dyn)),control("Dispersión dinámica",select("scatterDynamics",dyn)),control("Ángulo dinámico",select("angleDynamics",angleDyn)),control("Simetría",select("symmetry",[["none","Ninguna"],["horizontal","Horizontal"],["vertical","Vertical"],["both","Cuatro ejes"],["radial","Radial"]])),control("Radios",range("symmetryCount",2,16,"")));
  const note=document.createElement("p");note.className="hint";note.textContent="Las puntas ABR se importan como máscaras; sus dinámicas se configuran aquí. Las puntas desde imagen usan su transparencia o, si no la tienen, la luminancia invertida.";body.append(tips,actions,settings,note);await dialog({title:"Pinceles profesionales",body,wide:true,cls:"dlg-brushes",buttons:[{label:"Cerrar",primary:true,value:"ok"}]});save();emit("tool:options");}
