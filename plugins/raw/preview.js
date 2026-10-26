import { GPUPreview } from "./gpu-preview.js";
import { RenderWorker } from "./render-client.js";
import { isLinearSource, resizeLinear } from './source.js';
import { defaults } from './state.js';
import { PremiumGPU } from './premium/gpu.js';
import { outSpaceOf } from './premium/core.js';

/** Bounded preview, one pending state, no queue of obsolete slider frames. */
export class Preview {
  constructor(canvas, source, { onDraw, onError }) {
    this.canvas=canvas;this.source=source;this.onDraw=onDraw;this.onError=onError;
    this.proxy=document.createElement("canvas");this.proxyCtx=this.proxy.getContext("2d");
    this.frame=0;this.busy=false;this.closed=false;this.version=0;this.dirtySource=true;
    this.onLost=event=>{event.preventDefault();this.fallback();this.request();};
    canvas.addEventListener("webglcontextlost",this.onLost);
    try { this.gpu=new GPUPreview(canvas); }
    catch { this.fallback(); }
    this.observer=new ResizeObserver(()=>{this.dirtySource=true;this.request();});
    this.observer.observe(this.canvas.parentElement);
  }
  fallback(){
    if(this.worker||this.closed)return;
    this.premium?.dispose();this.premium=null;
    this.gpu?.dispose();this.gpu=null;
    // A canvas cannot switch from WebGL to 2D; retain its presentation styles.
    const old=this.canvas, next=old.cloneNode(false);
    old.removeEventListener("webglcontextlost",this.onLost);old.replaceWith(next);this.canvas=next;
    this.ctx=next.getContext("2d",{forceSrgb:true});this.ctxSpace="srgb";this.worker=new RenderWorker();this.dirtySource=true;
  }
  resize(){
    const box=this.canvas.parentElement.getBoundingClientRect();
    const mobile=matchMedia("(max-width:900px)").matches;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    const budget=this.gpu?(mobile?650000:1400000):180000;
    const scale=Math.min(1,Math.max(1,box.width)*dpr/this.source.width,Math.max(1,box.height)*dpr/this.source.height,Math.sqrt(budget/(this.source.width*this.source.height)));
    const w=Math.max(1,Math.round(this.source.width*scale)),h=Math.max(1,Math.round(this.source.height*scale));
    if(this.proxy.width===w&&this.proxy.height===h&&!this.dirtySource&&this.proxyTarget===this.target&&(this.proxyTarget==='premium'||this.proxySpace===this.space))return false;
    this.proxyTarget=this.target;this.proxySpace=this.space;
    if(isLinearSource(this.source))this.proxy=resizeLinear(this.source,w,h,this.target,this.space);
    else{this.proxy.width=w;this.proxy.height=h;this.proxyCtx.drawImage(this.source,0,0,w,h);}
    this.dirtySource=false;
    return true;
  }
  update(settings,original=false){this.settings={...settings};this.target=settings.premium?'premium':'standard';this.space=outSpaceOf(settings);this.original=original;this.version++;this.request();}
  setSource(source){this.source=source;this.dirtySource=true;this.version++;this.request();}
  request(){if(!this.closed&&!this.frame&&!this.busy&&this.settings)this.frame=requestAnimationFrame(()=>this.draw());}
  async draw(){
    this.frame=0;if(this.closed||this.busy)return;
    this.busy=true;const version=this.version,settings=this.settings,original=this.original;
    try {
      const changed=this.resize();
      if(this.gpu&&settings.premium&&!this.premium){
        // Revelado Premium en la GPU: necesita texturas flotantes. Si no
        // las hay, todo pasa al worker (misma matemática, en la CPU).
        try{this.premium=new PremiumGPU(this.gpu);}
        catch{this.fallback();this.dirtySource=true;this.busy=false;this.request();return;}
      }
      if(this.gpu){
        if(changed){this.gpu.setSource(this.proxy);this.gpu.sourceVersion=(this.gpu.sourceVersion||0)+1;}
        if(settings.premium)this.premium.render(settings,original,[this.source.width,this.source.height]);
        else{
          const gl=this.gpu.gl,want=isLinearSource(this.proxy)?outSpaceOf(settings):"srgb";
          if(gl&&"drawingBufferColorSpace" in gl&&gl.drawingBufferColorSpace!==want){try{gl.drawingBufferColorSpace=want;}catch{}}
          this.gpu.render(settings,original);
        }
      }else{
        if(changed)await this.worker.setSource(this.proxy);
        if(this.closed)return;
        let result=original&&!isLinearSource(this.proxy)?this.proxy:await this.worker.render(original?{...defaults(),premium:settings.premium,space:settings.space}:settings);
        if(this.closed||version!==this.version){if(result!==this.proxy)result.close();return;}
        if(this.canvas.width!==result.width||this.canvas.height!==result.height){this.canvas.width=result.width;this.canvas.height=result.height;}
        // Vista previa en el espacio de salida del revelado Premium (Display P3 sin recortar a sRGB)
        const want=isLinearSource(this.proxy)?outSpaceOf(settings):"srgb";
        if(this.ctxSpace!==want){
          const old=this.canvas,next=old.cloneNode(false);old.replaceWith(next);this.canvas=next;
          this.ctx=next.getContext("2d",{colorSpace:want,forceSrgb:want==="srgb"});this.ctxSpace=want;
          if(this.canvas.width!==result.width||this.canvas.height!==result.height){this.canvas.width=result.width;this.canvas.height=result.height;}
        }
        this.ctx.clearRect(0,0,result.width,result.height);this.ctx.drawImage(result,0,0);
        if(result!==this.proxy)result.close();
      }
      if(!this.closed)this.onDraw(this.canvas);
    }catch(error){
      if(this.closed)return;
      if(this.gpu){this.fallback();this.version++;}
      else this.onError(error);
    }finally{this.busy=false;if(version!==this.version||this.dirtySource)this.request();}
  }
  dispose(){if(this.closed)return;this.closed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.canvas.removeEventListener("webglcontextlost",this.onLost);this.premium?.dispose();this.gpu?.dispose();this.worker?.dispose();this.source=null;this.proxy=null;this.proxyCtx=null;this.gpu=null;this.worker=null;this.canvas.width=this.canvas.height=1;}
}
