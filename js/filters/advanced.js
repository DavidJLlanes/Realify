/* Filtros avanzados. Todos pasan por runFilter para conservar el mismo
   flujo que el resto: vista previa, una capa por efecto, parámetros
   reeditables y porcentaje independiente en el panel de capas. */
import { runFilter } from "./basic.js";
import { slider, pickerGroup } from "../editor/adjust.js";
import { surfaceBlurHi, channelDenoiseHi, smartSharpenHi, lensBlurHi } from "../editor/floatspatial.js";

const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
const PREVIEW_PIXELS = 5e5;

function selectRow(label, value, options, change){
  const row = document.createElement("div");
  row.className = "field";
  const lab = document.createElement("label"); lab.textContent = label;
  const sel = document.createElement("select"); sel.className = "grow";
  for(const [v, text] of options){
    const op = document.createElement("option"); op.value = v; op.textContent = text;
    if(v === value) op.selected = true; sel.appendChild(op);
  }
  sel.addEventListener("change", () => change(sel.value));
  row.append(lab, sel); return row;
}

function controls(entries){
  const box = document.createElement("div");
  box.appendChild(pickerGroup(entries));
  return box;
}

function proxy(src, final){
  const w = src.width, h = src.height;
  if(final || w * h <= PREVIEW_PIXELS){
    /* Nunca se procesa `src` directamente: durante el recálculo del
       deslizador es la capa base y debe permanecer intacta. */
    const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(src,0,0);
    return { canvas:c, w, h, scale:1 };
  }
  const scale = Math.sqrt(PREVIEW_PIXELS / (w * h));
  const pw = Math.max(1, Math.round(w * scale)), ph = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas"); c.width = pw; c.height = ph;
  c.getContext("2d").drawImage(src, 0, 0, pw, ph);
  return { canvas:c, w:pw, h:ph, scale };
}

function pixels(canvas){
  return canvas.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, canvas.width, canvas.height);
}

function put(layer, work, image, original){
  work.getContext("2d").putImageData(image, 0, 0);
  const x = layer.ctx; x.save(); x.globalCompositeOperation = "copy";
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  x.drawImage(work, 0, 0, layer.canvas.width, layer.canvas.height); x.restore();
}

function blurCanvas(src, radius){
  if(radius <= .01) return src;
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const x = c.getContext("2d"); x.filter = `blur(${radius}px)`;
  x.drawImage(src, 0, 0); x.filter = "none"; return c;
}

function bilinear(d,w,h,x,y,c){
  x=Math.max(0,Math.min(w-1,x)); y=Math.max(0,Math.min(h-1,y));
  const x0=x|0,y0=y|0,x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
  const a=d[(y0*w+x0)*4+c],b=d[(y0*w+x1)*4+c],q=d[(y1*w+x0)*4+c],e=d[(y1*w+x1)*4+c];
  return (a+(b-a)*fx)*(1-fy)+(q+(e-q)*fx)*fy;
}

function copyAlpha(out, src){ for(let i=3;i<out.length;i+=4) out[i]=src[i]; }

export function lensBlur(opts = {}){
  const p={ radius:14, focus:50, range:18, map:"luminance", invert:false, ...opts.init };
  return runFilter({ title:"Desenfoque de lente", id:"lens-blur", params:p,float:"delta",
    native: () => p.radius > 0 ? (inp, w, h, tick) => lensBlurHi(inp, w, h, p, tick) : null,
    build(preview){
      const box=controls([
        {label:"Radio",node:slider("Radio",0,60,p.radius,v=>{p.radius=v;preview();}," px")},
        {label:"Plano enfocado",node:slider("Plano enfocado",0,100,p.focus,v=>{p.focus=v;preview();},"%")},
        {label:"Rango enfocado",node:slider("Rango enfocado",1,60,p.range,v=>{p.range=v;preview();},"%")}
      ]);
      box.prepend(selectRow("Mapa de profundidad",p.map,[["luminance","Luminancia"],["radial","Distancia al centro"]],v=>{p.map=v;preview();}));
      const chk=document.createElement("label");chk.className="chk";chk.innerHTML='<input type="checkbox"> Invertir profundidad';
      chk.querySelector("input").checked=p.invert;chk.querySelector("input").addEventListener("change",e=>{p.invert=e.target.checked;preview();});box.appendChild(chk);return box;
    },
    apply(layer,src,final){
      const q=proxy(src,final), a=pixels(q.canvas), b=pixels(blurCanvas(q.canvas,p.radius*q.scale));
      const d=a.data,bd=b.data,cx=(q.w-1)/2,cy=(q.h-1)/2,max=Math.hypot(cx,cy)||1;
      for(let y=0,i=0;y<q.h;y++)for(let x=0;x<q.w;x++,i+=4){
        let depth=p.map==="radial"?Math.hypot(x-cx,y-cy)/max:(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255;
        if(p.invert)depth=1-depth;const f=Math.min(1,Math.abs(depth*100-p.focus)/Math.max(1,p.range));
        for(let c=0;c<3;c++)d[i+c]=d[i+c]+(bd[i+c]-d[i+c])*f;
      } put(layer,q.canvas,a,src);
    }
  },opts);
}

export function radialBlur(opts = {}){
  const p={ mode:"zoom", amount:20, centerX:50, centerY:50, ...opts.init };
  return runFilter({title:"Desenfoque radial / zoom",id:"radial-blur",params:p,float:"delta",
    build(preview){const box=controls([
      {label:"Cantidad",node:slider("Cantidad",0,100,p.amount,v=>{p.amount=v;preview();},"%")},
      {label:"Centro X",node:slider("Centro X",0,100,p.centerX,v=>{p.centerX=v;preview();},"%")},
      {label:"Centro Y",node:slider("Centro Y",0,100,p.centerY,v=>{p.centerY=v;preview();},"%")}
    ]);box.prepend(selectRow("Modo",p.mode,[["zoom","Zoom"],["spin","Rotación"]],v=>{p.mode=v;preview();}));return box;},
    apply(layer,src,final){const q=proxy(src,final),im=pixels(q.canvas),d=im.data,out=new Uint8ClampedArray(d.length),cx=q.w*p.centerX/100,cy=q.h*p.centerY/100,n=Math.max(1,Math.round(p.amount/5)),strength=p.amount/100*.18;
      for(let y=0;y<q.h;y++)for(let x=0;x<q.w;x++){const i=(y*q.w+x)*4;let sums=[0,0,0,0];for(let s=0;s<=n;s++){const t=(s/n-.5)*2*strength;let sx,sy;if(p.mode==="spin"){const dx=x-cx,dy=y-cy,co=Math.cos(t),si=Math.sin(t);sx=cx+dx*co-dy*si;sy=cy+dx*si+dy*co;}else{sx=x+(cx-x)*t;sy=y+(cy-y)*t;}for(let c=0;c<4;c++)sums[c]+=bilinear(d,q.w,q.h,sx,sy,c);}for(let c=0;c<4;c++)out[i+c]=sums[c]/(n+1);}im.data.set(out);put(layer,q.canvas,im,src);}
  },opts);
}

export function surfaceBlur(opts = {}){
  const p={ radius:8, threshold:24, ...opts.init };
  return runFilter({title:"Desenfoque de superficie",id:"surface-blur",params:p,float:"delta",
    native: () => (inp, w, h, tick) => surfaceBlurHi(inp, w, h, p, tick),
    build:preview=>controls([
      {label:"Radio",node:slider("Radio",1,50,p.radius,v=>{p.radius=v;preview();}," px")},
      {label:"Umbral",node:slider("Umbral",0,100,p.threshold,v=>{p.threshold=v;preview();})}
    ]),
    apply(layer,src,final){const q=proxy(src,final),im=pixels(q.canvas),bl=pixels(blurCanvas(q.canvas,p.radius*q.scale)),d=im.data,b=bl.data;for(let i=0;i<d.length;i+=4){const l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2],lb=.2126*b[i]+.7152*b[i+1]+.0722*b[i+2],f=Math.max(0,1-Math.abs(l-lb)/Math.max(1,p.threshold));for(let c=0;c<3;c++)d[i+c]+= (b[i+c]-d[i+c])*f;}put(layer,q.canvas,im,src);}
  },opts);
}

export function highPass(opts = {}){
  const p={ radius:4, contrast:100, ...opts.init };
  return runFilter({title:"Paso alto",id:"high-pass",params:p,
    build:preview=>controls([
      {label:"Radio",node:slider("Radio",.5,50,p.radius,v=>{p.radius=v;preview();}," px",.5)},
      {label:"Contraste",node:slider("Contraste",0,300,p.contrast,v=>{p.contrast=v;preview();},"%")}
    ]),
    apply(layer,src,final){const q=proxy(src,final),im=pixels(q.canvas),bl=pixels(blurCanvas(q.canvas,p.radius*q.scale)),d=im.data,b=bl.data,k=p.contrast/100,m=Math.min(1,k);for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++){const hp=clamp(128+(d[i+c]-b[i+c])*Math.max(1,k));d[i+c]+= (hp-d[i+c])*m;}put(layer,q.canvas,im,src);}
  },opts);
}

export function channelDenoise(opts = {}){
  const p={ red:25, green:20, blue:40, radius:2, ...opts.init };
  return runFilter({title:"Reducción de ruido por canal",id:"channel-denoise",params:p,float:"delta",
    native: () => (inp, w, h, tick) => channelDenoiseHi(inp, w, h, p, tick),
    build:preview=>controls([
      {label:"Canal rojo",node:slider("Canal rojo",0,100,p.red,v=>{p.red=v;preview();},"%")},
      {label:"Canal verde",node:slider("Canal verde",0,100,p.green,v=>{p.green=v;preview();},"%")},
      {label:"Canal azul",node:slider("Canal azul",0,100,p.blue,v=>{p.blue=v;preview();},"%")},
      {label:"Radio",node:slider("Radio",1,8,p.radius,v=>{p.radius=v;preview();}," px")}
    ]),
    apply(layer,src,final){const q=proxy(src,final),im=pixels(q.canvas),bl=pixels(blurCanvas(q.canvas,p.radius*q.scale)),d=im.data,b=bl.data,k=[p.red/100,p.green/100,p.blue/100];for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++)d[i+c]+= (b[i+c]-d[i+c])*k[c];put(layer,q.canvas,im,src);}
  },opts);
}

export function smartSharpen(opts = {}){
  const p={ amount:90, radius:1.5, threshold:4, halo:35, ...opts.init };
  return runFilter({title:"Nitidez inteligente",id:"smart-sharpen",params:p,float:"delta",
    native: () => (inp, w, h, tick) => smartSharpenHi(inp, w, h, p, tick),
    build:preview=>controls([
      {label:"Cantidad",node:slider("Cantidad",0,300,p.amount,v=>{p.amount=v;preview();},"%")},
      {label:"Radio",node:slider("Radio",.5,12,p.radius,v=>{p.radius=v;preview();}," px",.5)},
      {label:"Umbral",node:slider("Umbral",0,40,p.threshold,v=>{p.threshold=v;preview();})},
      {label:"Reducir halos",node:slider("Reducir halos",0,100,p.halo,v=>{p.halo=v;preview();},"%")}
    ]),
    apply(layer,src,final){const q=proxy(src,final),im=pixels(q.canvas),bl=pixels(blurCanvas(q.canvas,p.radius*q.scale)),d=im.data,b=bl.data,a=p.amount/100,limit=255-(p.halo/100)*220;for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++){const diff=d[i+c]-b[i+c];if(Math.abs(diff)>p.threshold)d[i+c]=clamp(d[i+c]+Math.max(-limit,Math.min(limit,diff*a)));}put(layer,q.canvas,im,src);}
  },opts);
}

export function distort(opts = {}){
  const p={ mode:"spherize", amount:45, ...opts.init };
  return runFilter({title:"Distorsión",id:"distort",params:p,
    build(preview){const box=controls([{label:"Cantidad",node:slider("Cantidad",-100,100,p.amount,v=>{p.amount=v;preview();},"%")}]);box.prepend(selectRow("Tipo",p.mode,[["spherize","Esferizar"],["polar","Coordenadas polares"],["rect","Polares a rectangulares"]],v=>{p.mode=v;preview();}));return box;},
    apply(layer,src,final){const q=proxy(src,final),im=pixels(q.canvas),d=im.data,out=new Uint8ClampedArray(d.length),cx=(q.w-1)/2,cy=(q.h-1)/2,rx=Math.max(1,cx),ry=Math.max(1,cy),amt=p.amount/100;
      const mix=Math.abs(amt);for(let y=0;y<q.h;y++)for(let x=0;x<q.w;x++){let sx=x,sy=y,nx=(x-cx)/rx,ny=(y-cy)/ry;if(p.mode==="spherize"){const r=Math.hypot(nx,ny);if(r<1){const f=r?Math.pow(r,1+amt*.9)/r:1;sx=cx+nx*f*rx;sy=cy+ny*f*ry;}}else if(p.mode==="polar"){const ang=(x/q.w)*Math.PI*2-Math.PI,r=(1-y/q.h)*Math.min(rx,ry);sx=cx+Math.cos(ang)*r;sy=cy+Math.sin(ang)*r;}else{const ang=Math.atan2(ny,nx),r=Math.min(1,Math.hypot(nx,ny));sx=(ang+Math.PI)/(Math.PI*2)*(q.w-1);sy=(1-r)*(q.h-1);}const i=(y*q.w+x)*4;for(let c=0;c<4;c++){const v=bilinear(d,q.w,q.h,sx,sy,c);out[i+c]=d[i+c]+(v-d[i+c])*mix;}}im.data.set(out);put(layer,q.canvas,im,src);}
  },opts);
}

export function stylize(opts = {}){
  const p={ mode:"emboss", amount:70, angle:135, ...opts.init };
  return runFilter({title:"Estilizar",id:"stylize",params:p,
    build(preview){const box=controls([
      {label:"Cantidad",node:slider("Cantidad",0,200,p.amount,v=>{p.amount=v;preview();},"%")},
      {label:"Ángulo",node:slider("Ángulo",0,360,p.angle,v=>{p.angle=v;preview();},"°")}
    ]);box.prepend(selectRow("Tipo",p.mode,[["emboss","Relieve"],["edges","Hallar bordes"]],v=>{p.mode=v;preview();}));return box;},
    apply(layer,src,final){const q=proxy(src,final),im=pixels(q.canvas),d=im.data,out=new Uint8ClampedArray(d),a=p.angle*Math.PI/180,dx=Math.round(Math.cos(a)),dy=Math.round(Math.sin(a)),k=p.amount/100,m=Math.min(1,k),gain=Math.max(1,k);for(let y=1;y<q.h-1;y++)for(let x=1;x<q.w-1;x++){const i=(y*q.w+x)*4;for(let c=0;c<3;c++){let v;if(p.mode==="edges"){const l=d[(y*q.w+x-1)*4+c],r=d[(y*q.w+x+1)*4+c],u=d[((y-1)*q.w+x)*4+c],dn=d[((y+1)*q.w+x)*4+c];v=(Math.abs(r-l)+Math.abs(dn-u))*gain;}else{const a0=d[((y-dy)*q.w+x-dx)*4+c],b0=d[((y+dy)*q.w+x+dx)*4+c];v=128+(a0-b0)*gain;}out[i+c]=clamp(d[i+c]+(v-d[i+c])*m);}out[i+3]=d[i+3];}im.data.set(out);put(layer,q.canvas,im,src);}
  },opts);
}
