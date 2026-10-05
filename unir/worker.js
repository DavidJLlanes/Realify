/* ═══════════════════════════════════════════════════════════════
   UNIR · WORKER DE PANORÁMICAS
   Guarda las fotos (en el orden elegido) y calcula la panorámica a
   tamaño de vista previa o final. La posición de cada foto se guarda
   mientras no cambien el orden, la proyección, el campo de visión ni
   la dirección: mover la transición o el recorte sólo recompone.
   ═══════════════════════════════════════════════════════════════ */

import { resize, cylindrical, layout, compose, placed } from "./engine.js";

let imgs = [], cache = null;
const post = (m, t) => self.postMessage(m, t || []);

/* Mismo alto (panorámica horizontal) o mismo ancho (vertical). */
function normalized(side, vertical){
  const ref = vertical ? Math.min(...imgs.map(i => i.w)) : Math.min(...imgs.map(i => i.h));
  const target = Math.min(ref, side);
  return imgs.map(im => {
    const k = target / (vertical ? im.w : im.h);
    return resize(im, Math.max(8, Math.round(im.w * k)), Math.max(8, Math.round(im.h * k)));
  });
}

function build(s, side){
  const vertical = s.dir === "v";
  let set = normalized(side, vertical);
  if(s.projection === "cyl") set = set.map(im => cylindrical(im, s.fov, vertical));
  else set = set.map(im => { const d = new Uint8ClampedArray(im.data); for(let i = 3; i < d.length; i += 4) d[i] = 255; return { ...im, data: d }; });
  const k = JSON.stringify([s.projection, s.fov, s.dir, side, imgs.length, imgs.map(i => i.id)]);
  let L = cache?.key === k ? cache.L : null;
  if(!L){ L = layout(set, s.dir); cache = { key: k, L }; }
  const out = compose(set, L, { blend: s.blend / 100 * Math.max(8, (vertical ? set[0].h : set[0].w) * 0.25), useGain: s.gain, crop: s.crop });
  return { out, L };
}

const handlers = {
  set(m){ imgs = m.images.map(im => ({ id: im.id, w: im.w, h: im.h, data: new Uint8ClampedArray(im.data) })); cache = null; return { ok: true }; },
  order(m){ const byId = new Map(imgs.map(i => [i.id, i])); imgs = m.ids.map(id => byId.get(id)).filter(Boolean); cache = null; return { ok: true }; },
  remove(m){ imgs = imgs.filter(i => i.id !== m.id); cache = null; return { ok: true }; },
  add(m){ for(const im of m.images) imgs.push({ id: im.id, w: im.w, h: im.h, data: new Uint8ClampedArray(im.data) }); cache = null; return { ok: true }; },
  /* Panorámica precisa: las fotos llegan ya llevadas a su sitio (RGBA con alfa, posiciones en el mosaico) desde unir/precise.js */
  placed(m){
    const set = m.images.map(im => ({ w: im.w, h: im.h, data: new Uint8ClampedArray(im.data) })), pos = m.images.map(im => ({ x: im.x, y: im.y }));
    const L = placed(set, pos), out = compose(set, L, { blend: m.s.blend / 100 * Math.max(8, set[0].w * 0.25), useGain: m.s.gain, crop: m.s.crop });
    return { w: out.w, h: out.h, data: out.data.buffer, found: L.found, dir: "h", transfer: [out.data.buffer] };
  },
  pano(m){
    if(imgs.length < 2) throw new Error("Hacen falta al menos 2 fotos para una panorámica");
    if(m.final) post({ type: "progress", msg: "Uniendo a resolución completa…" });
    let side = m.side;
    if(m.final){
      // Tamaño final: lo más grande posible sin pasar del área máxima.
      const prev = build(m.s, 360);
      const k = Math.sqrt(m.maxArea / Math.max(1, prev.out.w * prev.out.h));
      side = Math.max(200, Math.min(m.side, Math.floor(360 * k)));
      cache = null;
    }
    const { out, L } = build(m.s, side);
    return { w: out.w, h: out.h, data: out.data.buffer, found: L.found, dir: L.dir, transfer: [out.data.buffer] };
  }
};

self.onmessage = e => {
  const m = e.data || {}, fn = handlers[m.type];
  if(!fn) return;
  try{
    const r = fn(m), transfer = r?.transfer || [];
    if(r) delete r.transfer;
    post({ type: "result", req: m.req, ...r }, transfer);
  }catch(err){ post({ type: "error", req: m.req, message: String(err?.message || err) }); }
};
