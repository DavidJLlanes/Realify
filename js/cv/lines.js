/* ═══════════════════════════════════════════════════════════════
   DETECCIÓN AUTOMÁTICA DE LÍNEAS PARA LA PERSPECTIVA (fase 8)
   OpenCV (bordes de Canny + Hough probabilista) encuentra los segmentos
   largos de la foto; aquí se separan en los que deben quedar VERTICALES
   (cantos de edificios, puertas, farolas) y HORIZONTALES (cornisas,
   horizonte, marcos), y de cada familia se eligen hasta 3 guías
   coherentes entre sí —las que apuntan al mismo punto de fuga— que son
   las que acepta el modo «Guías» de la herramienta Perspectiva.
   `pickFamily` es pura (sin DOM) para poder probarla en Node.
   ═══════════════════════════════════════════════════════════════ */

const SIDE = 1400;
const deg = Math.PI / 180;

/** Ángulo (grados, 0-180) de un segmento respecto al eje x. */
const angleOf = s => { let a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) / deg; if(a < 0) a += 180; return a; };
const lenOf = s => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
/** Recta del segmento en forma homogénea [a, b, c] normalizada (ax + by + c = 0). */
function lineOf(s){
  const a = s.y1 - s.y2, b = s.x2 - s.x1, c = s.x1 * s.y2 - s.x2 * s.y1, n = Math.hypot(a, b) || 1;
  return [a / n, b / n, c / n];
}
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];

/**
 * Mejor familia de segmentos que convergen a un mismo punto de fuga (o paralelos): RANSAC sobre parejas; gana el punto de fuga que más longitud de
 * segmentos explica (su recta pasa a menos de `tolDeg` grados del punto de fuga). Devuelve { members: índices, score: longitud explicada, total }.
 */
export function bestFamily(segs, { tolDeg = 1.2 } = {}){
  const L = segs.map(lineOf), len = segs.map(lenOf), mid = segs.map(s => [(s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2]);
  const total = len.reduce((a, b) => a + b, 0);
  let best = null, bestScore = -1;
  const idx = segs.map((_, i) => i).sort((a, b) => len[b] - len[a]).slice(0, 60);
  for(let ii = 0; ii < idx.length; ii++) for(let jj = ii + 1; jj < idx.length; jj++){
    const i = idx[ii], j = idx[jj], vp = cross(L[i], L[j]);        // punto de fuga homogéneo (puede estar en el infinito)
    if(Math.hypot(vp[0], vp[1], vp[2]) < 1e-9) continue;
    let score = 0; const members = [];
    for(let k = 0; k < segs.length; k++){
      // Dirección esperada en el punto medio del segmento: hacia el punto de fuga
      let dx, dy;
      if(Math.abs(vp[2]) < 1e-9 * Math.hypot(vp[0], vp[1])){ dx = vp[0]; dy = vp[1]; }
      else { dx = vp[0] / vp[2] - mid[k][0]; dy = vp[1] / vp[2] - mid[k][1]; }
      const a1 = Math.atan2(dy, dx), a2 = Math.atan2(segs[k].y2 - segs[k].y1, segs[k].x2 - segs[k].x1);
      let d = Math.abs(a1 - a2) % Math.PI; d = Math.min(d, Math.PI - d);
      if(d / deg <= tolDeg){ score += len[k]; members.push(k); }
    }
    if(score > bestScore){ bestScore = score; best = members; }
  }
  if(!best || best.length < 2) best = segs.map((_, i) => i);
  return { members: best, score: Math.max(0, bestScore), total };
}

/**
 * Elige hasta `max` guías de una familia (segmentos casi paralelos o que convergen a un punto de fuga): las de la mejor familia (bestFamily), las más
 * largas y separadas entre sí.
 * @param segs  [{x1,y1,x2,y2}] en píxeles
 * @param W,H   tamaño de la imagen
 */
export function pickFamily(segs, W, H, { max = 3, tolDeg = 1.2, minSep = 0.08 } = {}){
  if(segs.length < 2) return segs.slice(0, max);
  const len = segs.map(lenOf), mid = segs.map(s => [(s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2]);
  const best = bestFamily(segs, { tolDeg }).members;
  // Las más largas, separadas entre sí (por la posición del punto medio en el eje que cruza la familia)
  const horizontalish = segs.length && Math.abs(angleOf(segs[best[0]]) - 90) > 45;
  const pos = k => horizontalish ? mid[k][1] / H : mid[k][0] / W;
  const out = [];
  for(const k of best.sort((a, b) => len[b] - len[a])){
    if(out.every(o => Math.abs(pos(o) - pos(k)) >= minSep)) out.push(k);
    if(out.length >= max) break;
  }
  return out.map(k => segs[k]);
}

/**
 * Las guías HORIZONTALES (pura, sin DOM). Dos casos:
 *   · casi rectas (≤ 4° de la horizontal): la familia paralela de siempre; en una foto frontal «corregirlas» sólo mete ruido.
 *   · fachada vista de lado: las horizontales (y diagonales de hasta 40°) CONVERGEN de verdad en un punto de fuga horizontal. Si una familia de ≥ 3
 *     segmentos explica la mayor parte de lo largo de las líneas candidatas y no son paralelas (ángulos que se abren ≥ 2,5°), se usa esa familia con
 *     su punto de fuga: es lo que permite poner la fachada de frente.
 * @returns { segs, converging }
 */
export function pickHorizontals(segs, W, H, { wideDeg = 40 } = {}){
  const hAng = s => { const a = angleOf(s); return Math.min(a, 180 - a); };
  const wide = segs.filter(s => hAng(s) <= wideDeg), near = segs.filter(s => hAng(s) <= 4);
  if(wide.length >= 3){
    const fam = bestFamily(wide, { tolDeg: 1.8 });
    if(fam.members.length >= 3 && fam.score >= 0.45 * fam.total){
      const angs = fam.members.map(k => { const s = wide[k]; let a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) / deg; if(a > 90) a -= 180; if(a < -90) a += 180; return a; });
      if(Math.max(...angs) - Math.min(...angs) >= 2.5) return { segs: pickFamily(fam.members.map(k => wide[k]), W, H, { tolDeg: 1.8 }), converging: true };
    }
  }
  return { segs: pickFamily(near, W, H), converging: false };
}

/**
 * @param cv      OpenCV
 * @param source  canvas con la foto (compuesta)
 * @returns { v: [...], h: [...] } con segmentos {x1,y1,x2,y2} en píxeles de `source`
 */
export function detectGuides(cv, source){
  const k = Math.min(1, SIDE / Math.max(source.width, source.height)), w = Math.round(source.width * k), h = Math.round(source.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(source, 0, 0, w, h);
  const rgba = cv.matFromImageData(x.getImageData(0, 0, w, h)), g = new cv.Mat(), e = new cv.Mat(), lines = new cv.Mat();
  const segs = [];
  try{
    cv.cvtColor(rgba, g, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(g, g, new cv.Size(5, 5), 1.2);
    cv.Canny(g, e, 40, 120);
    const minLen = Math.max(w, h) * 0.12;
    cv.HoughLinesP(e, lines, 1, Math.PI / 360, Math.max(40, Math.round(minLen * 0.5)), minLen, Math.max(6, Math.round(minLen * 0.06)));
    for(let i = 0; i < lines.rows; i++){
      const d = lines.data32S, o = i * 4;
      segs.push({ x1: d[o] / k, y1: d[o + 1] / k, x2: d[o + 2] / k, y2: d[o + 3] / k });
    }
  }finally{ rgba.delete(); g.delete(); e.delete(); lines.delete(); }
  const vs = segs.filter(s => Math.abs(angleOf(s) - 90) <= 25);
  const hz = pickHorizontals(segs.filter(s => !vs.includes(s)), source.width, source.height);
  return { v: pickFamily(vs, source.width, source.height), h: hz.segs, convergingH: hz.converging, found: { v: vs.length, h: hz.segs.length } };
}
