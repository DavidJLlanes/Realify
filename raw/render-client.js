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
  async setSource(source) {
    if(source.linear&&source.data){
      const data=source.data.slice();
      await this.request('source',{source:{...source,data}},[data.buffer]);return;
    }
    const bitmap = await createImageBitmap(source);
    if (this.closed) { bitmap.close(); throw new Error("Procesador cerrado"); }
    try { await this.request("source", { bitmap }, [bitmap]); }
    catch (error) { bitmap.close(); throw error; }
  }
  render(settings) { return this.request("render", { settings }); }
  dispose(error = new Error("Procesador cerrado")) {
    this.closed = true;
    this.worker.terminate();
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }
}
