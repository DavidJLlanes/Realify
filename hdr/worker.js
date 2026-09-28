/* ═══════════════════════════════════════════════════════════════
   HDR · WORKER
   Todo el cálculo fuera del hilo de la interfaz. Guarda las fotos a
   tamaño de trabajo y una copia reducida para la vista previa; el mapa
   de radiancia de la vista previa se guarda mientras no cambien las
   exposiciones, la alineación ni el antifantasmas, así que mover un
   deslizador de mapeo tonal sólo recalcula el mapeo.
   ═══════════════════════════════════════════════════════════════ */

import { downscale, estimateEvs, alignAll, commonRect, mergeRadiance, fuseMertens,
         toneMap, finish, downRadiance } from "./engine.js";

let orig = [], exifEvs = [], previewSide = 1200, alignSide = 2048, stagedFrom = null;
let full = [], proxy = [], draft = null, evs = [], shifts = [], cache = null;

const post = (msg, transfer) => self.postMessage(msg, transfer || []);
const scaleShifts = (k) => shifts.map(s => ({ dx: Math.round(s.dx * k), dy: Math.round(s.dy * k) }));
const key = s => JSON.stringify([s.align, s.crop, s.deghost, s.ghostRef, evs]);

function prepare(imgs, s, k){
  const sh = s.align ? scaleShifts(k) : imgs.map(() => ({ dx: 0, dy: 0 }));
  const rect = s.crop && s.align ? commonRect(imgs[0].w, imgs[0].h, sh) : { x: 0, y: 0, w: imgs[0].w, h: imgs[0].h };
  return { sh, rect };
}

function render(imgs, k, s, radCache){
  const { sh, rect } = prepare(imgs, s, k);
  const opts = { deghost: s.deghost, ref: s.ghostRef, evs };
  let T;
  if(s.method === "fusion") T = fuseMertens(imgs, sh, rect, s, opts);
  else {
    let R = radCache?.();
    if(!R) R = mergeRadiance(imgs, evs, sh, rect, opts);
    T = toneMap(R, s);
    if(radCache) radCache(R);
  }
  return finish(T, s);
}

const handlers = {
  /* Las fotos llegan de una en una («stage») para que la página no tenga
     que retener las 11 a la vez antes de enviarlas: con horquillados
     largos, ese pico de memoria cerraba la pestaña en el móvil. */
  stage(m){
    if(stagedFrom === null) stagedFrom = orig.length;
    const im = m.image;
    orig.push({ w: im.w, h: im.h, data: new Uint8ClampedArray(im.data) }); exifEvs.push(im.ev ?? null);
    return { ok: true };
  },
  unstage(){
    if(stagedFrom !== null){ orig.length = stagedFrom; exifEvs.length = stagedFrom; stagedFrom = null; }
    return { ok: true };
  },
  add(m){
    if(m.previewSide) previewSide = m.previewSide;
    if(m.alignSide) alignSide = m.alignSide;
    const before = stagedFrom ?? orig.length;
    stagedFrom = null;
    for(const im of m.images || []){ orig.push({ w: im.w, h: im.h, data: new Uint8ClampedArray(im.data) }); exifEvs.push(im.ev ?? null); }
    // Las fotos nuevas con otra proporción u orientación que el resto no
    // se quedan, pero no arrastran a las demás: se devuelven sus posiciones
    // (en el orden en que llegaron) para avisar de cuáles eran.
    const ar = im => im.w / im.h, dropped = [];
    let refAr;
    if(before > 0) refAr = ar(orig[0]);
    else {
      const groups = [];
      for(const im of orig){ const g = groups.find(g => Math.abs(g.ar - ar(im)) <= 0.03); if(g) g.n++; else groups.push({ ar: ar(im), n: 1 }); }
      refAr = groups.sort((a, b) => b.n - a.n)[0]?.ar;
    }
    for(let i = orig.length - 1; i >= before; i--){
      if(Math.abs(ar(orig[i]) - refAr) > 0.03){ orig.splice(i, 1); exifEvs.splice(i, 1); dropped.unshift(i - before); }
    }
    // Ninguna encaja con las que ya había: todo sigue como estaba.
    if(orig.length === before && before > 0) return { unchanged: true, dropped };
    if(!orig.length) throw new Error("No se han podido añadir las fotos.");
    try{ return { ...setup(), dropped }; }
    catch(err){
      // La foto que no encaja no se queda: el resto sigue como estaba.
      orig.length = before; exifEvs.length = before;
      if(orig.length) setup();
      throw err;
    }
  },
  remove(m){
    orig.splice(m.index, 1); exifEvs.splice(m.index, 1);
    if(!orig.length){ full = proxy = evs = shifts = []; cache = null; return { evs: [], source: "", shifts: [], w: 0, h: 0 }; }
    return setup();
  }
};

function setup(){
  {
    full = orig.slice();
    // Mismo tamaño para todas: la menor (si la proporción coincide).
    const W = Math.min(...full.map(i => i.w)), H = Math.min(...full.map(i => i.h));
    for(const im of full){
      if(Math.abs(im.w / im.h - W / H) > 0.03) throw new Error("Las fotos deben tener la misma proporción y orientación (son del mismo horquillado).");
    }
    full = full.map(im => im.w === W && im.h === H ? im : downscale(im, Math.max(W, H)));
    // Por redondeo pueden diferir en un píxel: se recortan todas a la menor.
    const w = Math.min(...full.map(i => i.w)), h = Math.min(...full.map(i => i.h));
    full = full.map(im => im.w === w && im.h === h ? im : cropTo(im, w, h));
    proxy = full.map(im => downscale(im, previewSide));
    draft = null;
    const small = full.map(im => downscale(im, 700));
    // Exposiciones: EXIF si todas lo tienen y no son iguales; si no, estimadas.
    post({ type: "progress", msg: "Detectando la exposición de cada foto…" });
    const ex = exifEvs;
    let source = "exif";
    if(ex.length > 1 && ex.every(v => v !== null && Number.isFinite(v)) && Math.max(...ex) - Math.min(...ex) > 0.2){
      const mn = Math.min(...ex); evs = ex.map(v => Math.round((v - mn) * 3) / 3);
    } else { evs = full.length > 1 ? estimateEvs(small) : [0]; source = full.length > 1 ? "estimada" : "única"; }
    // Alineación, contra la de exposición intermedia, sobre una copia
    // reducida (≤ 2048 px en el ordenador, menos en el móvil).
    const al = full.map(im => downscale(im, alignSide)), k = full[0].w / al[0].w;
    shifts = alignAll(al, evs, (i, n) => post({ type: "progress", msg: `Alineando las fotos · ${i} de ${n}` }))
      .map(s => ({ dx: Math.round(s.dx * k), dy: Math.round(s.dy * k) }));
    cache = null;
    return { evs, source, shifts, w, h };
  }
}

Object.assign(handlers, {
  setEvs(m){ evs = m.evs.slice(); cache = null; return { ok: true }; },
  preview(m){
    if(m.evs) evs = m.evs.slice();
    // Borrador: mientras se arrastra la exposición de una foto, la
    // fusión se rehace entera en cada paso; con una copia más pequeña
    // la vista sigue al dedo en tiempo real.
    if(m.draft){
      if(!draft) draft = proxy.map(im => downscale(im, Math.max(360, Math.round(previewSide * 0.55))));
      const out = render(draft, draft[0].w / full[0].w, m.s, null);
      return { w: out.w, h: out.h, data: out.data.buffer, transfer: [out.data.buffer] };
    }
    const s = m.s, k = proxy[0].w / full[0].w, kk = key(s);
    const radCache = R => { if(R){ cache = { key: kk, R }; return; } return cache?.key === kk ? cache.R : null; };
    const out = render(proxy, k, s, radCache);
    return { w: out.w, h: out.h, data: out.data.buffer, transfer: [out.data.buffer] };
  },
  thumbs(m){
    if(m.evs) evs = m.evs.slice();
    const res = [];
    const k = proxy[0].w / full[0].w;
    let small = null, smallK = 0, R = null;
    for(const s of m.list){
      let out;
      if(s.method === "fusion"){
        if(!small){ small = proxy.map(im => downscale(im, m.side * 1.5)); smallK = small[0].w / full[0].w; }
        out = render(small, smallK, s, null);
      } else {
        if(!R){
          const kk = key(s);
          const base = cache?.key === kk ? cache.R : (() => { const { sh, rect } = prepare(proxy, s, k); return mergeRadiance(proxy, evs, sh, rect, { deghost: s.deghost, ref: s.ghostRef }); })();
          R = downRadiance(base, m.side * 1.5);
        }
        out = finish(toneMap(R, s), s);
      }
      res.push({ w: out.w, h: out.h, data: out.data.buffer });
    }
    return { list: res, transfer: res.map(r => r.data) };
  },
  final(m){
    if(m.evs) evs = m.evs.slice();
    post({ type: "progress", msg: "Fusionando a resolución completa…" });
    const out = render(full, 1, m.s, null);
    return { w: out.w, h: out.h, data: out.data.buffer, transfer: [out.data.buffer] };
  }
});

function cropTo(im, w, h){
  const out = new Uint8ClampedArray(w * h * 4);
  for(let y = 0; y < h; y++) out.set(im.data.subarray(y * im.w * 4, y * im.w * 4 + w * 4), y * w * 4);
  return { w, h, data: out };
}

self.onmessage = e => {
  const m = e.data || {};
  const fn = handlers[m.type];
  if(!fn) return;
  try{
    const r = fn(m);
    const transfer = r?.transfer || [];
    if(r) delete r.transfer;
    post({ type: "result", req: m.req, ...r }, transfer);
  }catch(err){
    post({ type: "error", req: m.req, message: String(err?.message || err) });
  }
};
