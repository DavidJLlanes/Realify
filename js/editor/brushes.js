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
  scatterDynamics:"none",angleDynamics:"direction",symmetry:"none",symmetryCount:6,
  texture:"none",textureScale:100,textureDepth:70,
  colorMode:"solid",gradientLength:600,gradientRepeat:"pingpong"};
export const brushConfig={...defaults,...read(CFG_KEY,{})};
let customTips=read(TIPS_KEY,[]),runtime=new Map(),stampCache=new Map();

function read(k,fallback){try{return JSON.parse(localStorage.getItem(k)||"")||fallback;}catch{return fallback;}}
/** Cambia un ajuste del pincel desde fuera (barra de opciones). */
export function setBrushOption(key,value){if(!(key in defaults))return;brushConfig[key]=value;stampCache.clear();save();}
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
function tintedTip(id,color){const key=id+color;if(stampCache.has(key))return stampCache.get(key);if(stampCache.size>256)stampCache.clear();const src=tipSource(id);if(!src||!src.width)return null;const c=document.createElement("canvas");c.width=src.naturalWidth||src.width;c.height=src.naturalHeight||src.height;const x=c.getContext("2d");x.drawImage(src,0,0,c.width,c.height);x.globalCompositeOperation="source-in";x.fillStyle=color;x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation="source-over";stampCache.set(key,c);return c;}

function sensor(kind,pressure,speed,inverse=false){if(kind==="pressure")return .12+.88*pressure;if(kind==="speed"){const fast=clamp(speed/1.8);return inverse?fast:1-fast*.78;}return 1;}
function realPressure(e){const p=e&&Number.isFinite(e.pressure)?e.pressure:0;return p>0&&p!==.5?clamp(p):1;}
/* Reflejo de `pt` en la recta que pasa por el centro con dirección
   (ux, uy) unitaria. Las diagonales siguen la diagonal REAL del
   documento (de esquina a esquina), no 45°, para que en una foto
   apaisada la simetría caiga de esquina a esquina. */
function reflect(pt,cx,cy,ux,uy){const dx=pt.x-cx,dy=pt.y-cy,d=dx*ux+dy*uy;return{x:cx+2*d*ux-dx,y:cy+2*d*uy-dy,rot:2*Math.atan2(uy,ux)};}
const diag=(doc,anti)=>{const l=Math.hypot(doc.w,doc.h)||1;return[doc.w/l,(anti?-doc.h:doc.h)/l];};
function variants(pt,doc){const cx=doc.w/2,cy=doc.h/2,out=[{x:pt.x,y:pt.y,rot:0}],m=brushConfig.symmetry;
  if(m==="horizontal"||m==="both")out.push({x:doc.w-pt.x,y:pt.y,rot:Math.PI});
  if(m==="vertical"||m==="both")out.push({x:pt.x,y:doc.h-pt.y,rot:0});
  if(m==="both")out.push({x:doc.w-pt.x,y:doc.h-pt.y,rot:Math.PI});
  if(m==="diagonal"||m==="diagonals")out.push(reflect(pt,cx,cy,...diag(doc,false)));
  if(m==="antidiagonal"||m==="diagonals")out.push(reflect(pt,cx,cy,...diag(doc,true)));
  if(m==="diagonals")out.push({x:doc.w-pt.x,y:doc.h-pt.y,rot:Math.PI});
  if(m==="radial"){out.length=0;const n=Math.max(2,brushConfig.symmetryCount|0),dx=pt.x-cx,dy=pt.y-cy;for(let i=0;i<n;i++){const a=i*Math.PI*2/n,c=Math.cos(a),s=Math.sin(a);out.push({x:cx+dx*c-dy*s,y:cy+dx*s+dy*c,rot:a});}}
  return out;
}
/** Ejes de simetría activos, como segmentos [x0,y0,x1,y1] en
    coordenadas del documento (para dibujarlos como guía). */
export function symmetryAxes(doc){const m=brushConfig.symmetry,w=doc.w,h=doc.h,cx=w/2,cy=h/2,out=[];
  if(m==="horizontal"||m==="both")out.push([cx,0,cx,h]);
  if(m==="vertical"||m==="both")out.push([0,cy,w,cy]);
  if(m==="diagonal"||m==="diagonals")out.push([0,0,w,h]);
  if(m==="antidiagonal"||m==="diagonals")out.push([0,h,w,0]);
  if(m==="radial"){const n=Math.max(2,brushConfig.symmetryCount|0),R=Math.hypot(w,h)/2;for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/n;out.push([cx,cy,cx+Math.cos(a)*R,cy+Math.sin(a)*R]);}}
  return out;}
export const SYMMETRY_MODES=[["none","Ninguna"],["horizontal","Eje vertical (izquierda ↔ derecha)"],["vertical","Eje horizontal (arriba ↕ abajo)"],["both","Ambos ejes (cuatro cuadrantes)"],["diagonal","Diagonal ↘"],["antidiagonal","Diagonal ↗"],["diagonals","Ambas diagonales"],["radial","Radial (caleidoscopio)"]];

/* ── Texturas procedurales ─────────────────────────────────────
   Mosaicos de 256 px que se repiten sin costuras (todo el ruido es
   periódico), fijos al DOCUMENTO: la textura no se mueve con cada
   toque del pincel, igual que la de un papel. Se usan como máscara de
   opacidad de cada toque; «Relieve» decide cuánto se nota. */
export const TEXTURES=[["none","Sin textura"],["grain","Grano"],["paper","Papel"],["canvas","Lienzo"],["crystals","Cristales"],["scratches","Rayones"],["sponge","Esponja"],["noise","Ruido fino"]];
const T=256,texCache=new Map();
function periodicNoise(freq,seed){const g=new Float32Array((freq+1)*(freq+1));for(let y=0;y<=freq;y++)for(let x=0;x<=freq;x++)g[y*(freq+1)+x]=hash(x%freq,y%freq,seed);return(u,v)=>{const x=u*freq,y=v*freq,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),i=y0*(freq+1)+x0,a=g[i],b=g[i+1],c=g[i+freq+1],d=g[i+freq+2];return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;};}
function textureValues(kind){const v=new Float32Array(T*T);
  if(kind==="grain"||kind==="noise"){for(let i=0;i<v.length;i++)v[i]=hash(i%T,(i/T)|0,kind==="grain"?21:33);if(kind==="grain"){const o=new Float32Array(v.length);for(let y=0;y<T;y++)for(let x=0;x<T;x++){let s=0;for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++)s+=v[((y+k+T)%T)*T+(x+j+T)%T];o[y*T+x]=s/9;}for(let i=0;i<v.length;i++)v[i]=Math.min(1,Math.max(0,(o[i]-.5)*2.6+.5));}}
  else if(kind==="paper"||kind==="sponge"){const oct=[periodicNoise(4,1),periodicNoise(8,2),periodicNoise(16,3),periodicNoise(32,4),periodicNoise(64,5)],w=[.4,.25,.17,.11,.07];for(let y=0;y<T;y++)for(let x=0;x<T;x++){let n=0;for(let k=0;k<oct.length;k++)n+=oct[k](x/T,y/T)*w[k];v[y*T+x]=kind==="paper"?Math.min(1,Math.max(0,(n-.5)*2.2+.55)):(n>.52?1:n>.47?(n-.47)/.05:0);}}
  else if(kind==="canvas"){for(let y=0;y<T;y++)for(let x=0;x<T;x++){const a=Math.sin(x/T*Math.PI*2*32),b=Math.sin(y/T*Math.PI*2*32),weave=((x>>3)+(y>>3))&1?a:b;v[y*T+x]=.55+.35*weave+.1*(hash(x,y,7)-.5);}}
  else if(kind==="crystals"){const n=42,pts=[];for(let i=0;i<n;i++)pts.push([hash(i,1,91)*T,hash(i,2,91)*T,.35+hash(i,3,91)*.65]);for(let y=0;y<T;y++)for(let x=0;x<T;x++){let d1=1e9,d2=1e9,c=0;for(const [px,py,val] of pts)for(let oy=-T;oy<=T;oy+=T)for(let ox=-T;ox<=T;ox+=T){const d=Math.hypot(x-px-ox,y-py-oy);if(d<d1){d2=d1;d1=d;c=val;}else if(d<d2)d2=d;}const edge=Math.min(1,(d2-d1)/3);v[y*T+x]=c*edge;}}
  else if(kind==="scratches"){v.fill(1);for(let i=0;i<70;i++){const a=(hash(i,4,61)-.5)*.9+(hash(i,9,61)>.7?Math.PI/2:0),len=40+hash(i,5,61)*220,x0=hash(i,6,61)*T,y0=hash(i,7,61)*T,depth=.25+hash(i,8,61)*.75,wd=hash(i,10,61)>.8?2:1;for(let t=0;t<len;t+=.5){const px=Math.round(x0+Math.cos(a)*t),py=Math.round(y0+Math.sin(a)*t);for(let k=0;k<wd;k++){const j=((py+k+T*4)%T)*T+(px+T*4)%T;v[j]=Math.min(v[j],1-depth*(.6+.4*Math.sin(t*.05)));}}}}
  return v;}
function textureTile(kind,depth){const key=kind+"|"+depth;if(texCache.has(key))return texCache.get(key);const v=textureValues(kind),c=document.createElement("canvas");c.width=c.height=T;const x=c.getContext("2d"),im=x.createImageData(T,T),k=clamp(depth/100);for(let i=0;i<v.length;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=Math.round(255*(1-k*(1-v[i])));}x.putImageData(im,0,0);texCache.set(key,c);return c;}
let stampBuf=null;
function textured(ctx,x,y,size,draw){const kind=brushConfig.texture;if(!kind||kind==="none")return draw(ctx);
  const r=Math.ceil(size/2)+2,x0=Math.floor(x-r),y0=Math.floor(y-r),S=r*2+1;if(!stampBuf)stampBuf=document.createElement("canvas");if(stampBuf.width<S||stampBuf.height<S){stampBuf.width=Math.max(S,stampBuf.width);stampBuf.height=Math.max(S,stampBuf.height);}
  const t=stampBuf.getContext("2d");t.setTransform(1,0,0,1,0,0);t.globalCompositeOperation="source-over";t.globalAlpha=1;t.clearRect(0,0,S,S);t.translate(-x0,-y0);draw(t);
  t.setTransform(1,0,0,1,0,0);t.globalAlpha=1;t.globalCompositeOperation="destination-in";const pat=t.createPattern(textureTile(kind,brushConfig.textureDepth),"repeat"),sc=Math.max(.1,brushConfig.textureScale/100);pat.setTransform(new DOMMatrix([sc,0,0,sc,-x0,-y0]));t.fillStyle=pat;t.fillRect(0,0,S,S);t.globalCompositeOperation="source-over";
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";ctx.drawImage(stampBuf,0,0,S,S,x0,y0,S,S);ctx.restore();}

/* ── Color a lo largo del trazo ────────────────────────────────
   Pincel de degradado: el color recorre del frontal al de fondo (o el
   arcoíris) según la distancia pintada, como el pincel degradado de
   Photoshop. «Longitud» es cuántos píxeles de trazo tarda en recorrer
   el degradado entero. */
export const COLOR_MODES=[["solid","Color sólido"],["gradient","Degradado frontal → fondo"],["rainbow","Arcoíris"]];
let strokeLen=0;
const toHex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,"0")).join("");
const fromHex=h=>{h=String(h||"#000").replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");const n=parseInt(h.slice(0,6),16)||0;return[n>>16&255,n>>8&255,n&255];};
function strokeColor(color,color2){if(brushConfig.colorMode==="solid")return color;let t=strokeLen/Math.max(1,brushConfig.gradientLength);const rep=brushConfig.gradientRepeat;t=rep==="once"?Math.min(1,t):rep==="repeat"?t%1:(t%2>1?2-t%2:t%2);
  // Cuantizado a 64 pasos: sobra para verse continuo y limita la caché de puntas teñidas
  t=Math.round(t*64)/64;
  if(brushConfig.colorMode==="rainbow"){const h=t*360,f=n=>{const k=(n+h/60)%6;return 255*(1-.9*Math.max(0,Math.min(k,4-k,1)));};return toHex(f(5),f(3),f(1));}
  const a=fromHex(color),b=fromHex(color2||"#ffffff");
  return toHex(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);}

function roundGradient(ctx,x,y,r,color,hardness){const inner=clamp(hardness/100,0,.98),g=ctx.createRadialGradient(x,y,r*inner,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color.length===7?color+"00":color);return g;}
function stamp(ctx,pt,angle,size,alpha,color,hardness,seed){const scatter=size*brushConfig.scatter/100*sensor(brushConfig.scatterDynamics,pt.pressure,pt.speed,true),sa=hash(seed,11,5)*Math.PI*2,sr=Math.sqrt(hash(seed,17,9))*scatter,x=pt.x+Math.cos(sa)*sr,y=pt.y+Math.sin(sa)*sr,source=tipSource(brushConfig.tip);
  textured(ctx,x,y,size*1.5,c=>{c.save();c.globalAlpha=clamp(alpha);c.globalCompositeOperation="source-over";
  if(!source){c.fillStyle=hardness>=99?color:roundGradient(c,x,y,size/2,color,hardness);c.beginPath();c.arc(x,y,size/2,0,Math.PI*2);c.fill();}
  else{const tip=tintedTip(brushConfig.tip,color);if(tip){const ratio=(tip.naturalWidth||tip.width)/(tip.naturalHeight||tip.height),w=ratio>=1?size:size*ratio,h=ratio>=1?size/ratio:size;c.translate(x,y);c.rotate(angle);c.drawImage(tip,-w/2,-h/2,w,h);}}
  c.restore();});
}

/** Pinta un segmento y devuelve el sobrante de espaciado para el siguiente. */
export function paintProfessionalSegment(ctx,a,b,{event,color,color2,size,hardness,opacity,velocity=0,carry=0,doc,seed=1}={}){const pressure=realPressure(event),sizeK=sensor(brushConfig.sizeDynamics,pressure,velocity),opacityK=sensor(brushConfig.opacityDynamics,pressure,velocity),flowK=sensor(brushConfig.flowDynamics,pressure,velocity),diameter=Math.max(1,size*sizeK),step=Math.max(1,diameter*brushConfig.spacing/100),dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),direction=Math.atan2(dy,dx),points=[];let avail=carry+dist,along=-carry;
  if(dist===0){points.push({x:b.x,y:b.y});if(!carry)strokeLen=0;}else while(avail>=step){along+=step;points.push({x:a.x+dx/dist*along,y:a.y+dy/dist*along});avail-=step;}carry=dist===0?0:avail;
  let index=0;for(const p of points){const dynAngle=brushConfig.angleDynamics==="direction"?direction:brushConfig.angleDynamics==="pressure"?(pressure-.5)*Math.PI:brushConfig.angleDynamics==="speed"?clamp(velocity/2)*Math.PI:0,angle=brushConfig.angle*Math.PI/180+dynAngle,alpha=(opacity/100)*opacityK*(brushConfig.flow/100)*flowK,c=strokeColor(color,color2);for(const v of variants(p,doc)){stamp(ctx,{...v,pressure,speed:velocity},angle+v.rot,diameter,alpha,c,hardness,seed+index++);}if(dist)strokeLen+=step;}
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
  const dyn=[ ["none","Sin dinámica"],["pressure","Presión"],["speed","Velocidad"] ],angleDyn=[...dyn,["direction","Dirección del trazo"]];const settings=document.createElement("div");settings.className="brush-settings";settings.append(control("Flujo",range("flow",1,100,"%")),control("Espaciado",range("spacing",1,200,"%")),control("Dispersión",range("scatter",0,300,"%")),control("Ángulo",range("angle",-180,180,"°")),control("Suavizado",range("smoothing",0,100,"%")),control("Tamaño",select("sizeDynamics",dyn)),control("Opacidad",select("opacityDynamics",dyn)),control("Flujo dinámico",select("flowDynamics",dyn)),control("Dispersión dinámica",select("scatterDynamics",dyn)),control("Ángulo dinámico",select("angleDynamics",angleDyn)),control("Simetría",select("symmetry",SYMMETRY_MODES)),control("Radios",range("symmetryCount",2,16,"")),control("Textura",select("texture",TEXTURES)),control("Escala de textura",range("textureScale",25,400,"%")),control("Relieve de textura",range("textureDepth",0,100,"%")),control("Color",select("colorMode",COLOR_MODES)),control("Longitud del degradado",range("gradientLength",20,4000," px")),control("Repetición",select("gradientRepeat",[["pingpong","Ida y vuelta"],["repeat","Repetir"],["once","Una vez"]])));
  const note=document.createElement("p");note.className="hint";note.textContent="Las puntas ABR se importan como máscaras; sus dinámicas se configuran aquí. Las puntas desde imagen usan su transparencia o, si no la tienen, la luminancia invertida.";body.append(tips,actions,settings,note);await dialog({title:"Pinceles profesionales",body,wide:true,cls:"dlg-brushes",buttons:[{label:"Cerrar",primary:true,value:"ok"}]});save();emit("tool:options");}
