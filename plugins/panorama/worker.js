/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · WORKER DE MEZCLA
   Iguala la exposición y mezcla las fotos ya colocadas (engine.js)
   fuera del hilo de la interfaz: el mosaico final puede llegar a
   decenas de megapíxeles.
   Mensaje:   { type: "compose", req, images:[{ w, h, x, y, data }], options }
   Respuesta: { type: "result", req, w, h, data } | { type: "error", req, message }
   ═══════════════════════════════════════════════════════════════ */

import { placed, compose } from "./engine.js";

self.onmessage = e => {
  const m = e.data || {};
  if(m.type !== "compose") return;
  try{
    const set = m.images.map(im => ({ w: im.w, h: im.h, data: im.data }));
    const layout = placed(set, m.images.map(im => ({ x: im.x, y: im.y })));
    const out = compose(set, layout, m.options);
    self.postMessage({ type: "result", req: m.req, w: out.w, h: out.h, data: out.data.buffer }, [out.data.buffer]);
  }catch(err){ self.postMessage({ type: "error", req: m.req, message: String(err?.message || err) }); }
};
