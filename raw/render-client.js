import { outSpaceOf } from './premium/core.js';

/** A worker owns its source; callers keep at most one render in flight. */
export class RenderWorker {
  constructor() {
    this.worker = new Worker(new URL("./render-worker.js", import.meta.url), { type:"module" });
    this.pending = new Map();
    this.next = 0;
    this.closed = false;
    this.worker.onmessage = ({ data }) => {
      const job = this.pending.get(data.id);
      if (!job) { data.bitmap?.close(); return; }
      this.pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.pixels || data.bitmap);
    };
    this.worker.onerror = event => { event.preventDefault(); this.dispose(new Error(event.message || "No se pudo iniciar el procesador de imagen")); };
    this.worker.onmessageerror = () => this.dispose(new Error("No se pudo transferir la imagen"));
  }
  request(type, payload = {}, transfer = []) {
    if (this.closed) return Promise.reject(new Error("Procesador cerrado"));
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      this.pending.set(id, { resolve, reject });
      try { this.worker.postMessage({ id, type, ...payload }, transfer); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }
  async setSource(source, { transfer = false } = {}) {
    if(source.raster16&&source.data){await this.request('source',{source:{...source,data:source.data.slice()}});return;}   // ráster de 16 bits: copia (el origen sigue siendo de la capa)
    if(source.linear&&source.data){
      const data=transfer?source.data:source.data.slice();
      await this.request('source',{source:{...source,data}},[data.buffer]);return;
    }
    const bitmap = await createImageBitmap(source);
    if (this.closed) { bitmap.close(); throw new Error("Procesador cerrado"); }
    try { await this.request("source", { bitmap }, [bitmap]); }
    catch (error) { bitmap.close(); throw error; }
  }
  render(settings) { return this.request("render", { settings }); }
  /* `outW`×`outH` (opcional): tamaño del resultado. Si es menor que el
     original, cada franja se reduce al dibujarla, de modo que nunca se
     crea el lienzo a resolución completa (en el móvil, un RAW de 48 MP
     no cabe en memoria ni en el límite de lienzo de Safari). */
  async renderToCanvas(settings, width, height, onProgress = ()=>{}, outW = width, outH = height) {
    const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=outH;
    const space=outSpaceOf(settings);
    const ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:space,forceSrgb:space==='srgb'});
    if(!ctx)throw new Error('No se pudo crear el lienzo de salida');
    const sx=outW/width, sy=outH/height, scaled=outW!==width||outH!==height;
    if(scaled){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}
    // Al reducir, el filtro de reescalado lee varias filas por encima y
    // por debajo de cada franja: margen mayor para que no queden costuras.
    const halo=scaled?Math.max(2,Math.ceil(3/Math.min(sx,sy))+2):2;
    // One bounded strip in flight. Two halo rows preserve the largest
    // detail kernel; global coordinates preserve grain, vignette and CA.
    const rows=Math.max(1,Math.min(128,Math.floor(262144/width)));
    try{
      for(let y=0;y<height;y+=rows){
        const count=Math.min(rows,height-y),top=Math.max(0,y-halo),bottom=Math.min(height,y+count+halo);
        const bitmap=await this.request('render',{settings,region:{x:0,y:top,width,height:bottom-top}});
        try{
          if(!scaled)ctx.drawImage(bitmap,0,y-top,width,count,0,y,width,count);
          else{
            // Filas de destino enteras; el origen correspondiente cae dentro
            // de la franja (con sus dos filas de margen), sin costuras.
            const d0=Math.round(y*sy),d1=y+count>=height?outH:Math.round((y+count)*sy);
            if(d1>d0)ctx.drawImage(bitmap,0,d0/sy-top,width,(d1-d0)/sy,0,d0,outW,d1-d0);
          }
        }finally{bitmap.close();}
        onProgress(Math.round((y+count)/height*100));
      }
      return canvas;
    }catch(error){canvas.width=canvas.height=1;throw error;}
  }
  /* Premium: por bandas de filas de SALIDA; cada banda se revela a
     resolución original y se reduce en luz lineal en el worker. */
  async renderPremium(settings, width, height, onProgress = ()=>{}, outW = width, outH = height) {
    const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=outH;
    const space=outSpaceOf(settings);
    const ctx=canvas.getContext('2d',{colorSpace:space,forceSrgb:space==='srgb'});
    if(!ctx)throw new Error('No se pudo crear el lienzo de salida');
    const rows=Math.max(1,Math.min(256,Math.floor(262144*outH/height/Math.max(1,width))));
    try{
      for(let d0=0;d0<outH;d0+=rows){
        const d1=Math.min(outH,d0+rows);
        const bitmap=await this.request('premium',{settings,d0,d1,outW,outH,bits:8});
        try{ctx.drawImage(bitmap,0,d0);}finally{bitmap.close();}
        onProgress(Math.round(d1/outH*100));
      }
      return canvas;
    }catch(error){canvas.width=canvas.height=1;throw error;}
  }
  /* Escena en luz lineal Rec.2020 (Uint16 ×16 384), a outW×outH. */
  async renderLinear(settings, width, height, onProgress = ()=>{}, outW = width, outH = height) {
    const out=new Uint16Array(outW*outH*3);
    const rows=Math.max(1,Math.min(256,Math.floor(262144*outH/height/Math.max(1,width))));
    for(let d0=0;d0<outH;d0+=rows){
      const d1=Math.min(outH,d0+rows);
      const px=await this.request('linear',{settings,d0,d1,outW,outH});
      out.set(px,d0*outW*3);
      onProgress(Math.round(d1/outH*100));
    }
    return out;
  }
  /* 16 bits por canal, RGB entrelazado, a outW×outH (por defecto, a
     resolución original). */
  async render16(settings, width, height, onProgress = ()=>{}, outW = width, outH = height) {
    const out=new Uint16Array(outW*outH*3);
    const rows=Math.max(1,Math.min(256,Math.floor(262144*outH/height/Math.max(1,width))));
    for(let d0=0;d0<outH;d0+=rows){
      const d1=Math.min(outH,d0+rows);
      const px=await this.request('premium',{settings,d0,d1,outW,outH,bits:16});
      out.set(px,d0*outW*3);
      onProgress(Math.round(d1/outH*100));
    }
    return out;
  }
  dispose(error = new Error("Procesador cerrado")) {
    this.closed = true;
    this.worker.terminate();
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }
}
