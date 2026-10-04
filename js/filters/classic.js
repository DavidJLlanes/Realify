/* Galería de desenfoque, restauración, enfoque y deformación clásicos.
   Todos pasan por runFilter: vista previa, capa independiente y parámetros reeditables. */
import { grabPx, drawPx } from "../editor/grab.js";
import { runFilter, FILTER_PREVIEW_LIMIT } from "./basic.js";
import { sharpenRGBA, sharpenMargin } from "./sharpen-engine.js";
import { slider, pickerGroup } from "../editor/adjust.js";
import { activeLayer } from "../core/doc.js";

const clamp=(v,a=0,b=255)=>v<a?a:v>b?b:v;
const LIMIT=4e5;
function controls(rows){const b=document.createElement("div");b.appendChild(pickerGroup(rows));return b;}
function selectRow(label,value,items,on){const r=document.createElement("div");r.className="field";r.innerHTML=`<label>${label}</label><select class="grow">${items.map(([v,n])=>`<option value="${v}"${v===value?" selected":""}>${n}</option>`).join("")}</select>`;r.querySelector("select").onchange=e=>on(e.target.value);return r;}
function proxy(src,final){const w=src.width,h=src.height;if(final||w*h<=LIMIT){const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(src,0,0);return{c,w,h,s:1};}const s=Math.sqrt(LIMIT/(w*h)),W=Math.max(1,Math.round(w*s)),H=Math.max(1,Math.round(h*s)),c=document.createElement("canvas");c.width=W;c.height=H;c.getContext("2d").drawImage(src,0,0,W,H);return{c,w:W,h:H,s};}
function image(c){return c.getContext("2d",{willReadFrequently:true}).getImageData(0,0,c.width,c.height);}
function put(layer,c,im){c.getContext("2d").putImageData(im,0,0);const x=layer.ctx;x.save();x.globalCompositeOperation="copy";x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.drawImage(c,0,0,layer.canvas.width,layer.canvas.height);x.restore();}
function bilinear(d,w,h,x,y,k){x=clamp(x,0,w-1);y=clamp(y,0,h-1);const x0=x|0,y0=y|0,x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0,a=d[(y0*w+x0)*4+k],b=d[(y0*w+x1)*4+k],c=d[(y1*w+x0)*4+k],e=d[(y1*w+x1)*4+k];return(a+(b-a)*fx)*(1-fy)+(c+(e-c)*fx)*fy;}
function nativeBlur(c,r){if(r<=.01)return c;const o=document.createElement("canvas");o.width=c.width;o.height=c.height;const x=o.getContext("2d");x.filter=`blur(${r}px)`;x.drawImage(c,0,0);return o;}
function boxBlur(d,w,h,r){r=Math.max(1,Math.round(r));const out=new Uint8ClampedArray(d.length),stride=w+1;for(let k=0;k<4;k++){const q=new Float64Array((w+1)*(h+1));for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){row+=d[((y-1)*w+x-1)*4+k];q[y*stride+x]=q[(y-1)*stride+x]+row;}}for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x0=Math.max(0,x-r),y0=Math.max(0,y-r),x1=Math.min(w,x+r+1),y1=Math.min(h,y+r+1),sum=q[y1*stride+x1]-q[y0*stride+x1]-q[y1*stride+x0]+q[y0*stride+x0];out[(y*w+x)*4+k]=sum/((x1-x0)*(y1-y0));}}return out;}
/* Mediana por histograma deslizante (Huang): mismo resultado que
   ordenar la ventana de cada píxel, pero sin ordenar nada. La versión
   anterior hacía un sort por píxel y canal: con una foto de 6 MP, más
   de medio minuto con la app congelada al aplicar. */
function median(d,w,h,r){r=Math.max(1,Math.round(r));const out=new Uint8ClampedArray(d),hist=new Int32Array(256);for(let k=0;k<3;k++)for(let y=0;y<h;y++){const y0=Math.max(0,y-r),y1=Math.min(h-1,y+r),rows=y1-y0+1;hist.fill(0);let n=0,m=0,lt=0;const col=(x,s)=>{for(let yy=y0;yy<=y1;yy++){const v=d[(yy*w+x)*4+k];hist[v]+=s;if(v<m)lt+=s;}n+=s*rows;};for(let x=0;x<=Math.min(w-1,r);x++)col(x,1);for(let x=0;x<w;x++){if(x>0){if(x-r-1>=0)col(x-r-1,-1);if(x+r<w)col(x+r,1);}const t=n>>1;while(lt>t){m--;lt-=hist[m];}while(lt+hist[m]<=t){lt+=hist[m];m++;}out[(y*w+x)*4+k]=m;}}return out;}

function pinPreview(source,p,preview){const c=document.createElement("canvas"),W=280,H=Math.max(100,Math.round(W*source.height/source.width));c.width=W;c.height=H;c.style.cssText="width:100%;max-height:170px;object-fit:contain;touch-action:none;border:1px solid var(--line);border-radius:6px";const x=c.getContext("2d"),draw=()=>{x.drawImage(source,0,0,W,H);x.fillStyle="#f0a83c";x.strokeStyle="#141517";x.lineWidth=2;for(const pin of p.pins){const px=pin.x/100*W,py=pin.y/100*H;x.beginPath();x.arc(px,py,drawPx(6),0,Math.PI*2);x.fill();x.stroke();x.beginPath();x.moveTo(px,py);x.lineTo(px+pin.dx/100*W,py+pin.dy/100*H);x.strokeStyle="#f0a83c";x.stroke();}};let active=-1;const pos=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100];};c.onpointerdown=e=>{const [px,py]=pos(e),r=c.getBoundingClientRect(),tol=grabPx(10);let bd=tol;active=-1;p.pins.forEach((q,i)=>{const d=Math.hypot((q.x-px)/100*r.width,(q.y-py)/100*r.height);if(d<bd){bd=d;active=i;}});if(active<0){p.pins.push({x:px,y:py,dx:0,dy:0});active=p.pins.length-1;}c.setPointerCapture(e.pointerId);draw();preview();};c.onpointermove=e=>{if(active<0)return;const [px,py]=pos(e),q=p.pins[active];q.dx=px-q.x;q.dy=py-q.y;draw();preview();};c.onpointerup=()=>active=-1;draw();return c;}

export function blurGallery(opts={}){const p={mode:"field",amount:18,centerX:50,centerY:50,size:35,angle:0,pins:[{x:35,y:50,dx:18,dy:0},{x:65,y:50,dx:-12,dy:0}],...opts.init};return runFilter({title:"Galería de desenfoque",id:"blur-gallery",params:p,float:"delta",build(preview){const b=controls([{label:"Cantidad",node:slider("Cantidad",0,80,p.amount,v=>{p.amount=v;preview();}," px")},{label:"Centro X",node:slider("Centro X",0,100,p.centerX,v=>{p.centerX=v;preview();},"%")},{label:"Centro Y",node:slider("Centro Y",0,100,p.centerY,v=>{p.centerY=v;preview();},"%")},{label:"Extensión",node:slider("Extensión",5,100,p.size,v=>{p.size=v;preview();},"%")},{label:"Ángulo",node:slider("Ángulo",-180,180,p.angle,v=>{p.angle=v;preview();},"°")}]);b.prepend(selectRow("Modo",p.mode,[["field","Campo con pines"],["iris","Iris"],["tilt","Tilt-shift"],["path","Trayecto"],["spin","Giro"]],v=>{p.mode=v;preview();}));const src=activeLayer()?.canvas;if(src)b.appendChild(pinPreview(src,p,preview));const hint=document.createElement("p");hint.className="hint";hint.textContent="En Campo/Trayecto, toca para crear un pin y arrastra para indicar dirección.";b.append(hint);return b;},apply(layer,src,final){const q=proxy(src,final),im=image(q.c),d=im.data,out=new Uint8ClampedArray(d.length),blur=image(nativeBlur(q.c,p.amount*q.s)).data,cx=q.w*p.centerX/100,cy=q.h*p.centerY/100,rad=p.angle*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad),scale=Math.max(1,Math.min(q.w,q.h)*p.size/100),steps=Math.max(3,Math.round(p.amount/4));for(let y=0;y<q.h;y++)for(let x=0;x<q.w;x++){const i=(y*q.w+x)*4,dx=x-cx,dy=y-cy;let mask=1;if(p.mode==="iris")mask=clamp((Math.hypot(dx,dy)-scale*.55)/(scale*.45),0,1);else if(p.mode==="tilt")mask=clamp((Math.abs(-sn*dx+cs*dy)-scale*.2)/(scale*.45),0,1);if(p.mode==="path"||p.mode==="field"){let vx=0,vy=0,ws=0;for(const pin of p.pins){const px=pin.x/100*q.w,py=pin.y/100*q.h,w=1/(20+Math.hypot(x-px,y-py));vx+=pin.dx/100*q.w*w;vy+=pin.dy/100*q.h*w;ws+=w;}vx/=ws||1;vy/=ws||1;if(p.mode==="field"){const f=clamp(Math.hypot(vx,vy)/Math.max(1,q.w*.12),0,1);for(let k=0;k<4;k++)out[i+k]=d[i+k]+(blur[i+k]-d[i+k])*f;}else for(let k=0;k<4;k++){let sum=0;for(let n=0;n<=steps;n++){const t=n/steps-.5;sum+=bilinear(d,q.w,q.h,x+vx*t,y+vy*t,k);}out[i+k]=sum/(steps+1);}continue;}if(p.mode==="spin"){const a=p.amount/700;for(let k=0;k<4;k++){let sum=0;for(let n=0;n<=steps;n++){const t=(n/steps-.5)*a,co=Math.cos(t),si=Math.sin(t);sum+=bilinear(d,q.w,q.h,cx+dx*co-dy*si,cy+dx*si+dy*co,k);}out[i+k]=sum/(steps+1);}continue;}for(let k=0;k<4;k++)out[i+k]=d[i+k]+(blur[i+k]-d[i+k])*mask;}im.data.set(out);put(layer,q.c,im);}},opts);}

export function utilityBlur(opts={}){const p={mode:"box",radius:5,threshold:22,sides:6,...opts.init};return runFilter({title:"Desenfoques clásicos",id:"utility-blur",params:p,float:"delta",build(preview){const b=controls([{label:"Radio",node:slider("Radio",1,40,p.radius,v=>{p.radius=v;preview();}," px")},{label:"Umbral",node:slider("Umbral",0,100,p.threshold,v=>{p.threshold=v;preview();})},{label:"Lados",node:slider("Lados",3,12,p.sides,v=>{p.sides=v;preview();})}]);b.prepend(selectRow("Tipo",p.mode,[["box","Caja"],["shape","Forma"],["average","Promedio"],["smart","Suavizado inteligente"]],v=>{p.mode=v;preview();}));return b;},apply(layer,src,final){const q=proxy(src,final),im=image(q.c),d=im.data;if(p.mode==="average"){let s=[0,0,0,0],n=d.length/4;for(let i=0;i<d.length;i+=4)for(let k=0;k<4;k++)s[k]+=d[i+k];for(let i=0;i<d.length;i+=4)for(let k=0;k<4;k++)d[i+k]=s[k]/n;}else{const b=p.mode==="shape"?image(nativeBlur(q.c,p.radius*q.s*(.65+p.sides/18))).data:boxBlur(d,q.w,q.h,p.radius*q.s);if(p.mode==="smart")for(let i=0;i<d.length;i+=4){const a=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2],z=.2126*b[i]+.7152*b[i+1]+.0722*b[i+2],f=clamp(1-Math.abs(a-z)/Math.max(1,p.threshold),0,1);for(let k=0;k<3;k++)d[i+k]+= (b[i+k]-d[i+k])*f;}else d.set(b);}put(layer,q.c,im);}},opts);}

export function restoration(opts={}){const p={mode:"median",radius:2,threshold:28,strength:70,...opts.init};return runFilter({title:"Restauración de escaneados",id:"restoration",params:p,float:"delta",build(preview){const b=controls([{label:"Radio",node:slider("Radio",1,6,p.radius,v=>{p.radius=v;preview();}," px")},{label:"Umbral",node:slider("Umbral",0,100,p.threshold,v=>{p.threshold=v;preview();})},{label:"Fuerza",node:slider("Fuerza",0,100,p.strength,v=>{p.strength=v;preview();},"%")}]);b.prepend(selectRow("Proceso",p.mode,[["median","Mediana"],["dust","Polvo y rascaduras"],["descreen","Destramar"]],v=>{p.mode=v;preview();}));return b;},apply(layer,src,final){const q=proxy(src,final),im=image(q.c),d=im.data,a=p.strength/100;if(p.mode==="descreen"){const b=boxBlur(d,q.w,q.h,Math.max(1,p.radius*q.s));for(let i=0;i<d.length;i+=4)for(let k=0;k<3;k++)d[i+k]+= (b[i+k]-d[i+k])*a*.75;}else{const m=median(d,q.w,q.h,Math.max(1,p.radius*q.s));for(let i=0;i<d.length;i+=4){const diff=Math.abs(.2126*(d[i]-m[i])+.7152*(d[i+1]-m[i+1])+.0722*(d[i+2]-m[i+2]));const f=p.mode==="median"?a:(diff>p.threshold?a:0);for(let k=0;k<3;k++)d[i+k]+= (m[i+k]-d[i+k])*f;}}put(layer,q.c,im);}},opts);}

/* Enfoque avanzado / estabilizador: motor en coma flotante sobre la
   luminancia (sharpen-engine.js). La vista previa en vivo usa una copia
   reducida sólo mientras se mueve un mando; al soltar, la versión
   completa sustituye a la copia (runFilter con `asyncRefine`), en el
   diálogo y en el panel. Todo se calcula en un worker: la interfaz no
   se congela ni con la deconvolución de movimiento en fotos grandes. */
/* Varios workers (uno por núcleo, hasta 4), cada uno con una franja
   horizontal y un margen que cubre el alcance de todas las pasadas: el
   resultado es idéntico al de calcularlo de una vez. */
const sharpPool=[],sharpJobs=new Map(),sharpTickets=new WeakMap();let sharpSeq=0,sharpBusy=false,sharpNext=null;
function sharpWorker(k){
  if(sharpPool[k])return sharpPool[k];
  const wk=new Worker(new URL("./sharpen-worker.js",import.meta.url),{type:"module"});
  wk.onmessage=e=>{const j=sharpJobs.get(e.data.id);if(!j)return;sharpJobs.delete(e.data.id);e.data.error?j.reject(new Error(e.data.error)):j.resolve(new Uint8ClampedArray(e.data.data));};
  wk.onerror=()=>{for(const [id,j] of sharpJobs)if(j.k===k){sharpJobs.delete(id);j.fallback();}sharpPool[k]=null;};
  return sharpPool[k]=wk;
}
function sharpStrip(k,data,w,h,p,scale){
  const id=++sharpSeq,copy=data.slice();
  return new Promise((resolve,reject)=>{
    sharpJobs.set(id,{k,resolve,reject,fallback:()=>resolve(sharpenRGBA(data.slice(),w,h,p,scale))});
    sharpWorker(k).postMessage({id,data:copy.buffer,w,h,p:{...p},scale},[copy.buffer]);
  });
}
async function sharpenAsync(data,w,h,p,scale=1){
  if(typeof Worker==="undefined")return sharpenRGBA(data,w,h,p,scale);
  try{
    const m=sharpenMargin(p,scale),cores=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||2)-1));
    const n=Math.max(1,Math.min(cores,Math.floor(h/Math.max(64,2*m))));
    const out=new Uint8ClampedArray(data.length),row=w*4,jobs=[];
    for(let k=0;k<n;k++){
      const y0=Math.round(h*k/n),y1=Math.round(h*(k+1)/n),a=Math.max(0,y0-m),b=Math.min(h,y1+m);
      jobs.push(sharpStrip(k,data.subarray(a*row,b*row),w,b-a,p,scale).then(r=>out.set(r.subarray((y0-a)*row,(y1-a)*row),y0*row)));
    }
    await Promise.all(jobs);
    return out;
  }catch{return sharpenRGBA(data,w,h,p,scale);}
}
export function advancedSharpen(opts={}){const p={mode:"unsharp",amount:110,radius:1.5,threshold:4,edge:55,halo:45,angle:0,...opts.init};return runFilter({title:"Enfoque avanzado / estabilizador",id:"advanced-sharpen",params:p,float:"delta",asyncRefine:true,build(preview){const b=controls([{label:"Cantidad",node:slider("Cantidad",0,300,p.amount,v=>{p.amount=v;preview();},"%")},{label:"Radio",node:slider("Radio",.5,8,p.radius,v=>{p.radius=v;preview();}," px",.5)},{label:"Umbral",node:slider("Umbral",0,40,p.threshold,v=>{p.threshold=v;preview();})},{label:"Proteger bordes",node:slider("Proteger bordes",0,100,p.edge,v=>{p.edge=v;preview();},"%")},{label:"Reducir halos",node:slider("Reducir halos",0,100,p.halo,v=>{p.halo=v;preview();},"%")},{label:"Ángulo movimiento",node:slider("Ángulo",-180,180,p.angle,v=>{p.angle=v;preview();},"°")}]);b.prepend(selectRow("Método",p.mode,[["unsharp","Máscara de enfoque"],["focus","Deconvolución de foco"],["motion","Estabilizador de movimiento"]],v=>{p.mode=v;preview();}));return b;},
  async apply(layer,src,final){return sharpApply(p,layer,src,final);}},opts);}
async function sharpApply(p,layer,src,final){
    /* Cada llamada saca un número por capa: si al volver del worker ya
       hay otra más reciente (se movió un mando), su resultado no se pinta. */
    const ticket=(sharpTickets.get(layer)||0)+1,w=src.width,h=src.height;sharpTickets.set(layer,ticket);
    if(final)sharpNext=null;            // lo pendiente de la vista previa ya no vale
    if(final||w*h<=FILTER_PREVIEW_LIMIT){
      const data=src.getContext("2d",{willReadFrequently:true}).getImageData(0,0,w,h).data;
      const out=await sharpenAsync(data,w,h,p);
      if(ticket!==sharpTickets.get(layer))return;
      layer.ctx.putImageData(new ImageData(out,w,h),0,0);
      return;
    }
    /* Vista previa: un solo trabajo en el worker a la vez; si llegan
       más mientras tanto, sólo se calcula el último (no se acumula
       retraso al arrastrar). */
    if(sharpBusy){sharpNext=()=>sharpApply(p,layer,src,false);return;}
    sharpBusy=true;
    try{
    const s=Math.sqrt(FILTER_PREVIEW_LIMIT/(w*h)),W=Math.max(1,Math.round(w*s)),H=Math.max(1,Math.round(h*s)),c=document.createElement("canvas");c.width=W;c.height=H;
    const cx=c.getContext("2d",{willReadFrequently:true});cx.imageSmoothingQuality="high";cx.drawImage(src,0,0,W,H);
    const out=await sharpenAsync(cx.getImageData(0,0,W,H).data,W,H,p,W/w);
    if(ticket!==sharpTickets.get(layer))return;
    put(layer,c,new ImageData(out,W,H));
    }finally{sharpBusy=false;const next=sharpNext;sharpNext=null;if(next)next();}
}

export function classicDistort(opts={}){const p={mode:"wave",amount:30,size:35,angle:0,centerX:50,centerY:50,...opts.init};return runFilter({title:"Distorsionar clásico",id:"classic-distort",params:p,build(preview){const b=controls([{label:"Cantidad",node:slider("Cantidad",-100,100,p.amount,v=>{p.amount=v;preview();},"%")},{label:"Tamaño",node:slider("Tamaño",2,100,p.size,v=>{p.size=v;preview();})},{label:"Ángulo",node:slider("Ángulo",-180,180,p.angle,v=>{p.angle=v;preview();},"°")},{label:"Centro X",node:slider("Centro X",0,100,p.centerX,v=>{p.centerX=v;preview();},"%")},{label:"Centro Y",node:slider("Centro Y",0,100,p.centerY,v=>{p.centerY=v;preview();},"%")}]);b.prepend(selectRow("Tipo",p.mode,[["wave","Ondas"],["ripple","Rizo"],["twirl","Molinete"],["pinch","Encoger / hinchar"],["glass","Cristal"],["displace","Desplazar por mapa"],["polar","Coordenadas polares"],["sphere","Esferizar"],["shear","Cizalla"]],v=>{p.mode=v;preview();}));return b;},apply(layer,src,final){const q=proxy(src,final),im=image(q.c),d=im.data,out=new Uint8ClampedArray(d.length),cx=q.w*p.centerX/100,cy=q.h*p.centerY/100,A=p.amount/100,S=Math.max(2,p.size*q.s),ang=p.angle*Math.PI/180;for(let y=0;y<q.h;y++)for(let x=0;x<q.w;x++){let sx=x,sy=y,dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy),th=Math.atan2(dy,dx);if(p.mode==="wave"){sx+=Math.sin(y/S*Math.PI*2)*A*S;sy+=Math.sin(x/S*Math.PI*2)*A*S;}else if(p.mode==="ripple"){const rr=r+Math.sin(r/S*Math.PI*2)*A*S*.35;sx=cx+Math.cos(th)*rr;sy=cy+Math.sin(th)*rr;}else if(p.mode==="twirl"){const t=th+A*Math.max(0,1-r/Math.max(q.w,q.h))*Math.PI;sx=cx+Math.cos(t)*r;sy=cy+Math.sin(t)*r;}else if(p.mode==="pinch"||p.mode==="sphere"){const max=Math.min(q.w,q.h)/2,n=r/max,f=n<1?Math.pow(n,1+(p.mode==="sphere"?-A:A)):n;sx=cx+Math.cos(th)*f*max;sy=cy+Math.sin(th)*f*max;}else if(p.mode==="glass"){sx+=Math.sin(y*.17)*A*S*.25;sy+=Math.sin(x*.19)*A*S*.25;}else if(p.mode==="displace"){sx+=Math.sin((x+y)/S)*A*S*.4;sy+=Math.cos((x-y)/S)*A*S*.4;}else if(p.mode==="polar"){const a=x/q.w*Math.PI*2-Math.PI,rr=(1-y/q.h)*Math.min(q.w,q.h)/2;sx=cx+Math.cos(a)*rr;sy=cy+Math.sin(a)*rr;}else if(p.mode==="shear")sx=x+(y/q.h-.5)*A*q.w*.5*Math.cos(ang);const i=(y*q.w+x)*4;for(let k=0;k<4;k++)out[i+k]=bilinear(d,q.w,q.h,sx,sy,k);}im.data.set(out);put(layer,q.c,im);}},opts);}

export function adaptiveWideAngle(opts={}){const p={curvature:25,vertical:0,horizontal:0,scale:100,...opts.init};return runFilter({title:"Gran angular adaptable",id:"adaptive-wide-angle",params:p,build:preview=>controls([{label:"Curvatura",node:slider("Curvatura",-100,100,p.curvature,v=>{p.curvature=v;preview();})},{label:"Vertical",node:slider("Vertical",-100,100,p.vertical,v=>{p.vertical=v;preview();})},{label:"Horizontal",node:slider("Horizontal",-100,100,p.horizontal,v=>{p.horizontal=v;preview();})},{label:"Escala",node:slider("Escala",50,150,p.scale,v=>{p.scale=v;preview();},"%")}]),apply(layer,src,final){const q=proxy(src,final),im=image(q.c),d=im.data,out=new Uint8ClampedArray(d.length),cx=(q.w-1)/2,cy=(q.h-1)/2,k=p.curvature/260,sc=100/p.scale;for(let y=0;y<q.h;y++)for(let x=0;x<q.w;x++){let nx=(x-cx)/cx,ny=(y-cy)/cy,r2=nx*nx+ny*ny,f=(1+k*r2)*sc;let sx=cx+nx*f*cx+(ny*p.horizontal/100)*cx*.35,sy=cy+ny*f*cy+(nx*p.vertical/100)*cy*.35,i=(y*q.w+x)*4;for(let c=0;c<4;c++)out[i+c]=bilinear(d,q.w,q.h,sx,sy,c);}im.data.set(out);put(layer,q.c,im);}},opts);}

export function puppetWarp(opts={}){const p={strength:100,pins:[{x:35,y:45,dx:0,dy:0},{x:65,y:55,dx:0,dy:0}],...opts.init};return runFilter({title:"Deformación de posición libre",id:"puppet-warp",params:p,wide:true,build(preview){const b=controls([{label:"Fuerza",node:slider("Fuerza",0,100,p.strength,v=>{p.strength=v;preview();},"%")}]),src=activeLayer()?.canvas;if(src)b.appendChild(pinPreview(src,p,preview));const note=document.createElement("p");note.className="hint";note.textContent="Toca la previsualización para añadir pines y arrástralos para deformar.";b.append(note);return b;},apply(layer,src,final){const q=proxy(src,final),im=image(q.c),d=im.data,out=new Uint8ClampedArray(d.length),a=p.strength/100;for(let y=0;y<q.h;y++)for(let x=0;x<q.w;x++){let vx=0,vy=0,ws=0;for(const pin of p.pins){const px=pin.x/100*q.w,py=pin.y/100*q.h,w=1/(25+(x-px)**2+(y-py)**2);vx+=pin.dx/100*q.w*w;vy+=pin.dy/100*q.h*w;ws+=w;}const sx=x-(vx/(ws||1))*a,sy=y-(vy/(ws||1))*a,i=(y*q.w+x)*4;for(let k=0;k<4;k++)out[i+k]=bilinear(d,q.w,q.h,sx,sy,k);}im.data.set(out);put(layer,q.c,im);}},opts);}
