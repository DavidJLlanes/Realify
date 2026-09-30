/* ═══════════════════════════════════════════════════════════════
   IA · CARAS (Premium 👑)
   Detección con YuNet (OpenCV Zoo, MIT, 232 KB, viaja con la web).
   Procesado Premium («el bueno y el mejor»):
     · Bueno: la foto se analiza con el lado mayor a 640 px, donde YuNet
       rinde mejor con caras medianas y grandes.
     · Mejor: si la foto es grande, una segunda pasada a 1280 px encuentra
       también las caras pequeñas (un grupo, gente al fondo); las dos se
       juntan con supresión de solapes y se descartan las detecciones
       sin forma de cara (ojos demasiado juntos o fuera de la caja).
   Devuelve, en píxeles de la foto: { x, y, w, h, score, eyes: [[x,y],
   [x,y]] (derecho, izquierdo de la persona), nose, mouth: [[x,y],[x,y]] }.
   ═══════════════════════════════════════════════════════════════ */

import { runModel } from "./runtime.js";

function pixels(source, side){
  const k = Math.min(1, side / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * k)), h = Math.max(1, Math.round(source.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(source, 0, 0, w, h);
  return { rgba: x.getImageData(0, 0, w, h).data, w, h, k };
}

const iou = (a, b) => {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return i / Math.max(1e-6, a.w * a.h + b.w * b.h - i);
};

/** Caras de `source` (un lienzo), de mayor a menor confianza. */
export async function detectFaces(source, { threshold = 0.6 } = {}){
  const long = Math.max(source.width, source.height);
  let all = [];
  const run = async (rgba, w, h, s, ox, oy) => {
    const r = await runModel("faces", "yunet", { rgba, w, h, threshold }, [rgba.buffer], { quiet: true });
    for(const f of r.faces) all.push({ x: (f.x + ox) * s, y: (f.y + oy) * s, w: f.w * s, h: f.h * s, score: f.score,
                                       pts: f.pts.map(([px, py]) => [(px + ox) * s, (py + oy) * s]) });
  };
  // Bueno: la foto entera a 640 (la entrada del modelo)
  { const { rgba, w, h, k } = pixels(source, 640); await run(rgba, w, h, 1 / k, 0, 0); }
  // Mejor: a 1280 en teselas de 640 que se solapan (caras pequeñas)
  if(long > 900){
    const big = pixels(source, Math.min(1280, long)), T = 640, step = 512;
    const xs = [], ys = [];
    for(let x = 0; ; x += step){ xs.push(Math.min(x, Math.max(0, big.w - T))); if(x + T >= big.w) break; }
    for(let y = 0; ; y += step){ ys.push(Math.min(y, Math.max(0, big.h - T))); if(y + T >= big.h) break; }
    const c = document.createElement("canvas"); c.width = big.w; c.height = big.h;
    c.getContext("2d").putImageData(new ImageData(big.rgba, big.w, big.h), 0, 0);
    const cx = c.getContext("2d", { willReadFrequently: true });
    for(const y0 of [...new Set(ys)]) for(const x0 of [...new Set(xs)]){
      const tw = Math.min(T, big.w - x0), th = Math.min(T, big.h - y0);
      const rgba = cx.getImageData(x0, y0, tw, th).data;
      await run(rgba, tw, th, 1 / big.k, x0, y0);
    }
  }
  // Supresión de solapes: la de más confianza se queda
  all.sort((a, b) => b.score - a.score);
  const keep = [];
  for(const f of all) if(!keep.some(g => iou(f, g) > 0.3)) keep.push(f);
  // Forma de cara: ojos separados entre el 20 % y el 70 % del ancho y
  // los cinco puntos dentro de la caja (algo holgada)
  return keep.filter(f => {
    const [re, le] = f.pts, d = Math.hypot(le[0] - re[0], le[1] - re[1]);
    if(d < f.w * 0.2 || d > f.w * 0.75) return false;
    return f.pts.every(([px, py]) => px > f.x - f.w * 0.15 && px < f.x + f.w * 1.15 && py > f.y - f.h * 0.15 && py < f.y + f.h * 1.15);
  }).map(f => ({ x: f.x, y: f.y, w: f.w, h: f.h, score: f.score,
                 eyes: [f.pts[0], f.pts[1]], nose: f.pts[2], mouth: [f.pts[3], f.pts[4]] }));
}
