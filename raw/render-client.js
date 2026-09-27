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
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.bitmap);
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
  async renderToCanvas(settings, width, height, onProgress = ()=>{}) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('No se pudo crear el lienzo de salida');
    // One bounded strip in flight. Two halo rows preserve the largest
    // detail kernel; global coordinates preserve grain, vignette and CA.
    const rows=Math.max(1,Math.min(128,Math.floor(262144/width)));
    try{
      for(let y=0;y<height;y+=rows){
        const count=Math.min(rows,height-y),top=Math.max(0,y-2),bottom=Math.min(height,y+count+2);
        const bitmap=await this.request('render',{settings,region:{x:0,y:top,width,height:bottom-top}});
        try{ctx.drawImage(bitmap,0,y-top,width,count,0,y,width,count);}finally{bitmap.close();}
        onProgress(Math.round((y+count)/height*100));
      }
      return canvas;
    }catch(error){canvas.width=canvas.height=1;throw error;}
  }
  dispose(error = new Error("Procesador cerrado")) {
    this.closed = true;
    this.worker.terminate();
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }
}
