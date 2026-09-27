/* ══════════════════════════════════════════════════════════════
   UNMARK · DETECCIÓN DE MARCAS VISIBLES

   PROVENIENCIA: Basado en https://github.com/wiltodelta/remove-ai-watermarks
   El heurístico de detección está adaptado del proyecto de referencia
   mencionado, optimizado para identificar logotipos y rótulos de
   generadores de IA.

   Un logotipo o un rótulo superpuesto tiene tres rasgos que casi
   nada de una escena real reúne a la vez en el borde de la foto:
   es FINO (trazos de unos pocos píxeles), es CLARO u OSCURO respecto
   a lo que tiene justo debajo, y casi no tiene COLOR (blanco, gris,
   negro semitransparente). El detector busca exactamente eso:

   · Top-hat morfológico: L − apertura(L) realza lo claro y fino;
     cierre(L) − L, lo oscuro y fino. Un elemento estructurante de
     ~1 % del lado corto deja pasar trazos de texto y logotipos y
     borra cualquier forma más gruesa (una nube, una camisa blanca).
   · Umbral por sensibilidad + poca croma → mapa de candidatos.
   · Dilatación anisótropa (más en horizontal: las letras de una
     palabra van en fila) + componentes conexas + fusión de cajas
     cercanas → regiones.
   · Cada región se puntúa por lo que destaca sobre su entorno
     inmediato, y se filtra por tamaño y proporción plausibles.

   Es un heurístico, no un modelo: acertará con casi todos los
   rótulos y fallará con texto real que esté pegado al borde. Por
   eso las regiones se listan y se pueden descartar una a una.
   ══════════════════════════════════════════════════════════════ */

const WORK = 1024;

/* Mín/máx separable con ventana 2r+1: erosión y dilatación en gris. */
function rankFilter(src, w, h, r, isMax, tmp, dst){
  const pick = isMax ? Math.max : Math.min;
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w; x++){
      let v = src[row + x];
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      for(let k = x0; k <= x1; k++) v = pick(v, src[row + k]);
      tmp[row + x] = v;
    }
  }
  for(let x = 0; x < w; x++){
    for(let y = 0; y < h; y++){
      let v = tmp[y * w + x];
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      for(let k = y0; k <= y1; k++) v = pick(v, tmp[k * w + x]);
      dst[y * w + x] = v;
    }
  }
}

function dilateBinary(src, w, h, rx, ry){
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w; x++){
      let v = 0;
      const x0 = Math.max(0, x - rx), x1 = Math.min(w - 1, x + rx);
      for(let k = x0; k <= x1 && !v; k++) v = src[row + k];
      tmp[row + x] = v;
    }
  }
  for(let x = 0; x < w; x++){
    for(let y = 0; y < h; y++){
      let v = 0;
      const y0 = Math.max(0, y - ry), y1 = Math.min(h - 1, y + ry);
      for(let k = y0; k <= y1 && !v; k++) v = tmp[k * w + x];
      out[y * w + x] = v;
    }
  }
  return out;
}

/* Máscara de dónde se busca: 1 dentro de la zona. */
function zoneMask(zones, w, h){
  const m = new Uint8Array(w * h);
  const s = Math.min(w, h);
  const band = Math.round(0.14 * s), corner = Math.round(0.26 * s), bottom = Math.round(0.20 * h);
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      let ok = false;
      if(zones === "all") ok = true;
      else if(zones === "edges") ok = x < band || y < band || x >= w - band || y >= h - band;
      else if(zones === "corners") ok = (x < corner || x >= w - corner) && (y < corner || y >= h - corner);
      else if(zones === "bottom") ok = y >= h - bottom;
      if(ok) m[y * w + x] = 1;
    }
  }
  return m;
}

function components(bin, w, h){
  const label = new Int32Array(w * h);
  const comps = [];
  const stack = new Int32Array(w * h);
  let next = 1;
  for(let p = 0; p < w * h; p++){
    if(!bin[p] || label[p]) continue;
    let sp = 0, n = 0;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    const pixels = [];
    stack[sp++] = p; label[p] = next;
    while(sp){
      const q = stack[--sp];
      const qx = q % w, qy = (q / w) | 0;
      n++; pixels.push(q);
      if(qx < x0) x0 = qx; if(qx > x1) x1 = qx;
      if(qy < y0) y0 = qy; if(qy > y1) y1 = qy;
      for(let dy = -1; dy <= 1; dy++){
        const ny = qy + dy; if(ny < 0 || ny >= h) continue;
        for(let dx = -1; dx <= 1; dx++){
          const nx = qx + dx; if(nx < 0 || nx >= w) continue;
          const r = ny * w + nx;
          if(bin[r] && !label[r]){ label[r] = next; stack[sp++] = r; }
        }
      }
    }
    comps.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n, pixels });
    next++;
  }
  return comps;
}

function mergeBoxes(boxes, gap){
  let merged = true;
  boxes = boxes.slice();
  while(merged){
    merged = false;
    outer: for(let i = 0; i < boxes.length; i++){
      for(let j = i + 1; j < boxes.length; j++){
        const a = boxes[i], b = boxes[j];
        const near = a.x - gap < b.x + b.w && b.x - gap < a.x + a.w &&
                     a.y - gap < b.y + b.h && b.y - gap < a.y + a.h;
        if(!near) continue;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const x1 = Math.max(a.x + a.w, b.x + b.w), y1 = Math.max(a.y + a.h, b.y + b.h);
        boxes[i] = { x, y, w: x1 - x, h: y1 - y, n: a.n + b.n, pixels: a.pixels.concat(b.pixels) };
        boxes.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return boxes;
}

function placeLabel(r, w, h){
  const cx = (r.x + r.w / 2) / w, cy = (r.y + r.h / 2) / h;
  const v = cy < 0.3 ? "arriba" : cy > 0.7 ? "abajo" : "centro";
  const hz = cx < 0.3 ? "izquierda" : cx > 0.7 ? "derecha" : "centro";
  return v === "centro" && hz === "centro" ? "centro" : `${v}-${hz}`;
}

/**
 * @param {HTMLCanvasElement} canvas  imagen completa
 * @param {{sens:number, zones:string, minsize:number, maxsize:number}} p
 * @returns {{regions:Array, mask:Uint8Array, w:number, h:number}}
 *   `mask` a resolución completa, 255 donde hay marca.
 */
export function detectMarks(canvas, p){
  const W = canvas.width, H = canvas.height;
  const k = Math.min(1, WORK / Math.max(W, H));
  const w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(canvas, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;

  const n = w * h;
  const L = new Float32Array(n), C = new Float32Array(n);
  for(let i = 0, q = 0; q < n; i += 4, q++){
    const r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255;
    L[q] = 0.2126*r + 0.7152*g + 0.0722*b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    C[q] = mx - mn;
  }

  const s = Math.min(w, h);
  const se = Math.max(2, Math.round(0.009 * s));
  const tmp = new Float32Array(n), a = new Float32Array(n), b2 = new Float32Array(n);
  // apertura = dilatación(erosión); cierre = erosión(dilatación)
  rankFilter(L, w, h, se, false, tmp, a); rankFilter(a, w, h, se, true, tmp, b2);
  const open = b2;
  const a2 = new Float32Array(n), close = new Float32Array(n);
  rankFilter(L, w, h, se, true, tmp, a2); rankFilter(a2, w, h, se, false, tmp, close);

  const t = 0.22 - (p.sens / 100) * 0.15;
  const zone = zoneMask(p.zones, w, h);
  const cand = new Uint8Array(n), strength = new Float32Array(n);
  for(let q = 0; q < n; q++){
    if(!zone[q]) continue;
    const wt = L[q] - open[q], bt = close[q] - L[q];
    const v = Math.max(wt, bt);
    if(v > t && C[q] < 0.42){ cand[q] = 1; strength[q] = v; }
  }

  const dx = Math.max(2, Math.round(0.010 * s)), dy = Math.max(1, Math.round(0.004 * s));
  const grown = dilateBinary(cand, w, h, dx, dy);
  let comps = components(grown, w, h);
  comps = mergeBoxes(comps, Math.round(0.015 * s));

  const area = w * h;
  const aMin = (0.00015 + (p.minsize / 100) * 0.003) * area;
  const aMax = (0.004 + (p.maxsize / 100) * 0.12) * area;
  const regions = [];
  for(const cp of comps){
    const box = cp.w * cp.h;
    if(box < aMin || box > aMax) continue;
    const ar = cp.w / cp.h;
    if(ar < 0.12 || ar > 14) continue;
    // Fuerza media dentro (sólo píxeles candidatos) frente al anillo alrededor
    let inside = 0, cnt = 0;
    for(let yy = cp.y; yy < cp.y + cp.h; yy++)
      for(let xx = cp.x; xx < cp.x + cp.w; xx++){
        const q = yy * w + xx;
        if(cand[q]){ inside += strength[q]; cnt++; }
      }
    if(cnt < 6) continue;
    const meanIn = inside / cnt;
    const ring = Math.max(3, Math.round(cp.h * 0.8));
    let ringSum = 0, ringN = 0;
    for(let yy = Math.max(0, cp.y - ring); yy < Math.min(h, cp.y + cp.h + ring); yy++)
      for(let xx = Math.max(0, cp.x - ring); xx < Math.min(w, cp.x + cp.w + ring); xx++){
        if(xx >= cp.x && xx < cp.x + cp.w && yy >= cp.y && yy < cp.y + cp.h) continue;
        const q = yy * w + xx;
        ringSum += Math.max(L[q] - open[q], close[q] - L[q]); ringN++;
      }
    const meanRing = ringN ? ringSum / ringN : 0;
    const coverage = cnt / box;
    const isolation = meanIn / (meanRing + 0.02);
    const score = Math.max(0, Math.min(1,
      0.45 * Math.min(1, meanIn / (t * 2.2)) +
      0.35 * Math.min(1, isolation / 5) +
      0.20 * Math.min(1, coverage / 0.25)));
    if(score < 0.34) continue;
    regions.push({ ...cp, score, cnt });
  }
  regions.sort((p1, p2) => p2.score - p1.score);
  regions.length = Math.min(regions.length, 8);

  const out = regions.map((r, i) => ({
    id: i,
    x: Math.round(r.x / k), y: Math.round(r.y / k),
    w: Math.round(r.w / k), h: Math.round(r.h / k),
    score: r.score,
    label: placeLabel(r, w, h)
  }));

  return { regions: out, workW: w, workH: h, scale: k, fullW: W, fullH: H };
}

/* Máscara a resolución completa (0/255) a partir de las regiones
   elegidas: rectángulo sólido de cada caja, con un margen pequeño.
   Un relleno por BORDE (sólo los píxeles finos que dispararon la
   detección) deja intacto el interior de cualquier marca de fondo
   sólido —la píldora «AI生成» de varios generadores es justo eso—:
   el rectángulo entero es la única forma de cubrirla de verdad, y
   el coste de rellenar unos píxeles de fondo de más alrededor del
   texto es insignificante frente a dejar la marca a medias. */
export function fullMaskFromDetection(det, chosenIds, W, H){
  const rects = det.regions.filter(r => chosenIds.has(r.id)).map(r => {
    const pad = Math.max(3, Math.round(Math.min(r.w, r.h) * 0.18));
    return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  });
  return rectMask(rects, W, H);
}

export function upscaleMask(bin, w, h, W, H){
  const out = new Uint8Array(W * H);
  if(w === W && h === H){
    for(let p = 0; p < out.length; p++) out[p] = bin[p] ? 255 : 0;
    return out;
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  const img = x.createImageData(w, h);
  for(let p = 0; p < w * h; p++){
    const v = bin[p] ? 255 : 0;
    img.data[p*4] = v; img.data[p*4+1] = v; img.data[p*4+2] = v; img.data[p*4+3] = 255;
  }
  x.putImageData(img, 0, 0);
  const c2 = document.createElement("canvas");
  c2.width = W; c2.height = H;
  const x2 = c2.getContext("2d", { willReadFrequently: true });
  x2.imageSmoothingEnabled = true;
  x2.imageSmoothingQuality = "high";
  x2.drawImage(c, 0, 0, W, H);
  const d = x2.getImageData(0, 0, W, H).data;
  for(let p = 0; p < W * H; p++) out[p] = d[p*4] > 96 ? 255 : 0;
  return out;
}

/* Rectángulo → máscara (0/255) a resolución completa. */
export function rectMask(rects, W, H, into = null){
  const m = into || new Uint8Array(W * H);
  for(const r of rects){
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y);
    const x1 = Math.min(W, r.x + r.w), y1 = Math.min(H, r.y + r.h);
    for(let y = y0; y < y1; y++) m.fill(255, y * W + x0, y * W + x1);
  }
  return m;
}
