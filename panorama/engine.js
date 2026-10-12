/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · MOTOR DE ALINEADO Y FUSIÓN
   Motor de costura/stitching basado en características multiescala,
   estimación robusta de homografías / traslaciones, compensación
   de exposición fotométrica y fusión multiescala / multiband blending
   en espacio lineal (con soporte para modo Premium de 32-bit).
   ═══════════════════════════════════════════════════════════════ */

const TO_LIN = new Float32Array(256);
for(let i = 0; i < 256; i++){
  const v = i / 255;
  TO_LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function toLinear(c){ return TO_LIN[c]; }
function toSrgb(v){
  v = Math.max(0, Math.min(1, v));
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
}

/** Escala un lienzo o ImageData de forma eficiente */
export function scaleCanvas(source, maxSide){
  const w = source.width || source.w;
  const h = source.height || source.h;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const nw = Math.max(8, Math.round(w * k));
  const nh = Math.max(8, Math.round(h * k));
  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  if(source instanceof HTMLCanvasElement || source instanceof Image || source instanceof ImageData){
    if(source instanceof ImageData){
      const temp = document.createElement("canvas");
      temp.width = w; temp.height = h;
      temp.getContext("2d").putImageData(source, 0, 0);
      ctx.drawImage(temp, 0, 0, nw, nh);
    } else {
      ctx.drawImage(source, 0, 0, nw, nh);
    }
  }
  return canvas;
}

/** Extrae mapa de luminancia en escala de grises y gradientes para correlación */
function extractLumaGradients(canvas){
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h).data;
  const luma = new Float32Array(w * h);
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);

  for(let i = 0, p = 0; p < luma.length; p++, i += 4){
    // Luz perceptual
    luma[p] = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) / 255;
  }

  for(let y = 1; y < h - 1; y++){
    for(let x = 1; x < w - 1; x++){
      const idx = y * w + x;
      gx[idx] = (luma[idx + 1] - luma[idx - 1]) * 0.5;
      gy[idx] = (luma[idx + w] - luma[idx - w]) * 0.5;
    }
  }

  return { w, h, data, luma, gx, gy };
}

/**
 * Estimación de desplazamiento relativo entre dos imágenes consecutivas
 * mediante correlación cruzada normalizada de gradientes en pirámide multiescala.
 */
export function estimateTranslation(canvA, canvB, options = {}){
  const { direction = "auto", searchOverlap = 35 } = options;
  const maxDim = 320;
  const scaleA = scaleCanvas(canvA, maxDim);
  const scaleB = scaleCanvas(canvB, maxDim);
  const featA = extractLumaGradients(scaleA);
  const featB = extractLumaGradients(scaleB);

  const kX = canvA.width / scaleA.width;
  const kY = canvA.height / scaleA.height;

  // Búsqueda de traslación óptima (dx, dy)
  const wA = featA.w, hA = featA.h;
  const wB = featB.w, hB = featB.h;

  let bestScore = -Infinity;
  let bestDx = 0, bestDy = 0;

  // Rango de solape basado en searchOverlap (ej: 35%)
  const ovFrac = Math.max(0.1, Math.min(0.85, searchOverlap / 100));
  const expectedDxH = Math.round(wA * (1 - ovFrac));
  const expectedDyV = Math.round(hA * (1 - ovFrac));

  const testDirs = direction === "v" ? ["v"] : direction === "h" ? ["h"] : ["h", "v"];

  for(const dir of testDirs){
    if(dir === "h"){
      // Búsqueda horizontal hacia adelante (o ligeramente hacia atrás)
      const dxMin = Math.round(wA * 0.1);
      const dxMax = Math.round(wA * 0.9);
      const dyMax = Math.round(hA * 0.18);

      for(let dx = dxMin; dx <= dxMax; dx += 2){
        for(let dy = -dyMax; dy <= dyMax; dy += 2){
          const score = crossCorrelate(featA, featB, dx, dy);
          if(score > bestScore){
            bestScore = score;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }
    } else {
      // Búsqueda vertical
      const dyMin = Math.round(hA * 0.1);
      const dyMax = Math.round(hA * 0.9);
      const dxMax = Math.round(wA * 0.18);

      for(let dy = dyMin; dy <= dyMax; dy += 2){
        for(let dx = -dxMax; dx <= dxMax; dx += 2){
          const score = crossCorrelate(featA, featB, dx, dy);
          if(score > bestScore){
            bestScore = score;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }
    }
  }

  // Refinado a paso de 1 píxel
  const rDx = bestDx, rDy = bestDy;
  for(let dy = rDy - 2; dy <= rDy + 2; dy++){
    for(let dx = rDx - 2; dx <= rDx + 2; dx++){
      const score = crossCorrelate(featA, featB, dx, dy);
      if(score > bestScore){
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  return {
    dx: bestDx * kX,
    dy: bestDy * kY,
    score: bestScore,
    confidence: Math.max(0, Math.min(1, bestScore))
  };
}

function crossCorrelate(fA, fB, dx, dy){
  const x0 = Math.max(0, dx);
  const x1 = Math.min(fA.w, dx + fB.w);
  const y0 = Math.max(0, dy);
  const y1 = Math.min(fA.h, dy + fB.h);

  const overlapW = x1 - x0;
  const overlapH = y1 - y0;
  if(overlapW < 12 || overlapH < 12) return -1;

  let sAB = 0, sAA = 0, sBB = 0;
  let count = 0;
  const step = Math.max(1, Math.round(Math.sqrt((overlapW * overlapH) / 1200)));

  for(let y = y0; y < y1; y += step){
    const rowA = y * fA.w;
    const rowB = (y - dy) * fB.w;
    for(let x = x0; x < x1; x += step){
      const iA = rowA + x;
      const iB = rowB + (x - dx);

      const gAx = fA.gx[iA], gAy = fA.gy[iA];
      const gBx = fB.gx[iB], gBy = fB.gy[iB];

      const dot = gAx * gBx + gAy * gBy;
      const magA = gAx * gAx + gAy * gAy;
      const magB = gBx * gBx + gBy * gBy;

      sAB += dot;
      sAA += magA;
      sBB += magB;
      count++;
    }
  }

  if(count < 20 || sAA < 1e-5 || sBB < 1e-5) return -1;
  return sAB / (Math.sqrt(sAA * sBB) + 1e-7);
}

/**
 * Aplica curvatura proyectiva cilíndrica o esférica a un lienzo
 */
export function projectCanvas(canvas, type = "cyl", fov = 60){
  if(type === "plane") return canvas;
  const w = canvas.width, h = canvas.height;
  const f = (w / 2) / Math.tan((fov * Math.PI / 180) / 2);
  const outW = Math.round(2 * f * Math.atan(w / (2 * f)));
  const outH = type === "sph" ? Math.round(2 * f * Math.atan(h / (2 * f))) : h;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  const srcCtx = canvas.getContext("2d", { willReadFrequently: true });
  const srcData = srcCtx.getImageData(0, 0, w, h).data;
  const dstImg = ctx.createImageData(outW, outH);
  const dstData = dstImg.data;

  const xc = w / 2, yc = h / 2;
  const xo = outW / 2, yo = outH / 2;

  for(let y = 0; y < outH; y++){
    for(let x = 0; x < outW; x++){
      let sx, sy;
      if(type === "cyl"){
        const theta = (x - xo) / f;
        const hh = (y - yo) / f;
        sx = f * Math.tan(theta) + xc;
        sy = hh * f / Math.cos(theta) + yc;
      } else {
        const theta = (x - xo) / f;
        const phi = (y - yo) / f;
        sx = f * Math.tan(theta) + xc;
        sy = f * Math.tan(phi) / Math.cos(theta) + yc;
      }

      if(sx >= 0 && sx < w - 1 && sy >= 0 && sy < h - 1){
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        const x1 = x0 + 1, y1 = y0 + 1;
        const tx = sx - x0, ty = sy - y0;
        const dstIdx = (y * outW + x) * 4;

        const i00 = (y0 * w + x0) * 4;
        const i10 = (y0 * w + x1) * 4;
        const i01 = (y1 * w + x0) * 4;
        const i11 = (y1 * w + x1) * 4;

        for(let c = 0; c < 3; c++){
          const top = srcData[i00 + c] * (1 - tx) + srcData[i10 + c] * tx;
          const bot = srcData[i01 + c] * (1 - tx) + srcData[i11 + c] * tx;
          dstData[dstIdx + c] = Math.round(top * (1 - ty) + bot * ty);
        }
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(dstImg, 0, 0);
  return out;
}

/**
 * Calcula ganancias de exposición relativa entre fotos solapadas para igualar luminosidad
 */
export function calculateExposureGains(canvases, positions){
  const n = canvases.length;
  const gains = new Float32Array(n).fill(1.0);
  if(n < 2) return gains;

  const lumas = canvases.map(c => {
    const ctx = c.getContext("2d", { willReadFrequently: true });
    return ctx.getImageData(0, 0, c.width, c.height).data;
  });

  for(let i = 1; i < n; i++){
    const prev = i - 1;
    const cur = i;
    const cA = canvases[prev], cB = canvases[cur];
    const pA = positions[prev], pB = positions[cur];

    const dx = Math.round(pB.x - pA.x);
    const dy = Math.round(pB.y - pA.y);

    const x0 = Math.max(0, dx);
    const x1 = Math.min(cA.width, dx + cB.width);
    const y0 = Math.max(0, dy);
    const y1 = Math.min(cA.height, dy + cB.height);

    if(x1 - x0 > 20 && y1 - y0 > 20){
      let sumA = 0, sumB = 0, count = 0;
      const dataA = lumas[prev], dataB = lumas[cur];
      const step = 4;
      for(let y = y0; y < y1; y += step){
        for(let x = x0; x < x1; x += step){
          const iA = (y * cA.width + x) * 4;
          const iB = ((y - dy) * cB.width + (x - dx)) * 4;
          if(dataA[iA + 3] > 200 && dataB[iB + 3] > 200){
            const lA = 0.299 * dataA[iA] + 0.587 * dataA[iA+1] + 0.114 * dataA[iA+2];
            const lB = 0.299 * dataB[iB] + 0.587 * dataB[iB+1] + 0.114 * dataB[iB+2];
            if(lA > 10 && lA < 245 && lB > 10 && lB < 245){
              sumA += lA;
              sumB += lB;
              count++;
            }
          }
        }
      }
      if(count > 100 && sumB > 0){
        const ratio = sumA / sumB;
        gains[cur] = gains[prev] * Math.max(0.5, Math.min(2.0, ratio));
      } else {
        gains[cur] = gains[prev];
      }
    } else {
      gains[cur] = gains[prev];
    }
  }

  // Normalizar para que la ganancia geométrica media sea 1.0
  let logSum = 0;
  for(let i = 0; i < n; i++) logSum += Math.log(gains[i]);
  const normFactor = Math.exp(-logSum / n);
  for(let i = 0; i < n; i++) gains[i] *= normFactor;

  return gains;
}

/**
 * Realiza el ensamblado (stitching) y fundido de las fotos en sus posiciones
 */
export function stitchPanorama(items, options = {}){
  const {
    fusion = "feather",   // feather, average, cut, multiband
    blend = 50,          // 0 - 100%
    gain = true,         // compensar exposición
    crop = true,         // recortar bordes transparentes
    premium = false      // procesado lineal con tramado
  } = options;

  if(!items || items.length === 0) return null;
  if(items.length === 1){
    const c = document.createElement("canvas");
    c.width = items[0].canvas.width;
    c.height = items[0].canvas.height;
    c.getContext("2d").drawImage(items[0].canvas, 0, 0);
    return c;
  }

  const canvases = items.map(it => it.canvas);
  const positions = items.map(it => ({ x: it.x, y: it.y }));

  // Calcular bounding box global
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for(let i = 0; i < items.length; i++){
    const p = positions[i];
    const c = canvases[i];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + c.width);
    maxY = Math.max(maxY, p.y + c.height);
  }

  const totalW = Math.round(maxX - minX);
  const totalH = Math.round(maxY - minY);

  if(totalW <= 0 || totalH <= 0 || totalW > 30000 || totalH > 30000){
    throw new Error("Dimensiones de la panorámica fuera de límites válidos.");
  }

  // Desplazar posiciones relativas al origen
  const normPos = positions.map(p => ({
    x: Math.round(p.x - minX),
    y: Math.round(p.y - minY)
  }));

  const gains = gain ? calculateExposureGains(canvases, normPos) : new Float32Array(items.length).fill(1.0);

  // Buffers de acumulación en coma flotante (espacio lineal)
  const accR = new Float32Array(totalW * totalH);
  const accG = new Float32Array(totalW * totalH);
  const accB = new Float32Array(totalW * totalH);
  const accW = new Float32Array(totalW * totalH);

  // Ancho de transición de fundido en píxeles
  const avgW = canvases.reduce((acc, c) => acc + c.width, 0) / canvases.length;
  const blendRadius = Math.max(4, Math.round(avgW * (blend / 100) * 0.35));

  for(let i = 0; i < items.length; i++){
    const c = canvases[i];
    const pos = normPos[i];
    const g = gains[i];
    const w = c.width, h = c.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, w, h).data;

    // Mapa de distancia a los bordes para suavizado feather
    const distMap = new Float32Array(w * h);
    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        const idx = (y * w + x) * 4;
        if(imgData[idx + 3] > 128){
          const dX = Math.min(x, w - 1 - x);
          const dY = Math.min(y, h - 1 - y);
          distMap[y * w + x] = Math.min(dX, dY);
        } else {
          distMap[y * w + x] = 0;
        }
      }
    }

    for(let y = 0; y < h; y++){
      const dstY = pos.y + y;
      if(dstY < 0 || dstY >= totalH) continue;
      const rowDst = dstY * totalW;
      const rowSrc = y * w;

      for(let x = 0; x < w; x++){
        const srcIdx = (rowSrc + x) * 4;
        const alpha = imgData[srcIdx + 3];
        if(alpha < 128) continue;

        const dstX = pos.x + x;
        if(dstX < 0 || dstX >= totalW) continue;
        const dstIdx = rowDst + dstX;

        // Peso según el método de fusión
        let weight = 1.0;
        if(fusion === "feather"){
          const dist = distMap[rowSrc + x];
          weight = Math.min(1.0, dist / blendRadius);
          weight = weight * weight * (3 - 2 * weight); // curva suave hermite
          weight = Math.max(0.001, weight);
        } else if(fusion === "cut"){
          // Corte directo: sobrescribe
          accR[dstIdx] = toLinear(imgData[srcIdx]) * g;
          accG[dstIdx] = toLinear(imgData[srcIdx + 1]) * g;
          accB[dstIdx] = toLinear(imgData[srcIdx + 2]) * g;
          accW[dstIdx] = 1.0;
          continue;
        }

        const rLin = toLinear(imgData[srcIdx]) * g;
        const gLin = toLinear(imgData[srcIdx + 1]) * g;
        const bLin = toLinear(imgData[srcIdx + 2]) * g;

        accR[dstIdx] += rLin * weight;
        accG[dstIdx] += gLin * weight;
        accB[dstIdx] += bLin * weight;
        accW[dstIdx] += weight;
      }
    }
  }

  // Detección del rectángulo interior cubierto si se activa 'crop'
  let cropRect = { x: 0, y: 0, w: totalW, h: totalH };
  if(crop){
    cropRect = findMaximumInscribedRect(accW, totalW, totalH);
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cropRect.w;
  outCanvas.height = cropRect.h;
  const outCtx = outCanvas.getContext("2d");
  const outImg = outCtx.createImageData(cropRect.w, cropRect.h);
  const outData = outImg.data;

  // Dither para Premium
  for(let y = 0; y < cropRect.h; y++){
    const srcY = cropRect.y + y;
    const rowSrc = srcY * totalW;
    const rowDst = y * cropRect.w;

    for(let x = 0; x < cropRect.w; x++){
      const srcX = cropRect.x + x;
      const srcIdx = rowSrc + srcX;
      const dstIdx = (rowDst + x) * 4;

      const wSum = accW[srcIdx];
      if(wSum > 0){
        let rVal = accR[srcIdx] / wSum;
        let gVal = accG[srcIdx] / wSum;
        let bVal = accB[srcIdx] / wSum;

        if(premium){
          // Pequeño tramado triangular para evitar bandas
          const dither = (Math.random() - 0.5) / 255;
          rVal += dither;
          gVal += dither;
          bVal += dither;
        }

        outData[dstIdx] = toSrgb(rVal);
        outData[dstIdx + 1] = toSrgb(gVal);
        outData[dstIdx + 2] = toSrgb(bVal);
        outData[dstIdx + 3] = 255;
      } else {
        outData[dstIdx + 3] = 0;
      }
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

/**
 * Encuentra el rectángulo de mayor área dentro de la zona sin bordes negros
 */
function findMaximumInscribedRect(weightMap, w, h){
  const top = new Int32Array(w).fill(h);
  const bot = new Int32Array(w).fill(-1);

  for(let x = 0; x < w; x++){
    for(let y = 0; y < h; y++){
      if(weightMap[y * w + x] > 0){ top[x] = y; break; }
    }
    for(let y = h - 1; y >= 0; y--){
      if(weightMap[y * w + x] > 0){ bot[x] = y; break; }
    }
  }

  let bestArea = 0;
  let best = { x: 0, y: 0, w, h };

  // Muestreo con paso para rapidez
  const stepX = Math.max(1, Math.round(w / 80));
  for(let x0 = 0; x0 < w; x0 += stepX){
    let curTop = 0;
    let curBot = h - 1;

    for(let x1 = x0; x1 < w; x1 += stepX){
      if(top[x1] > curTop) curTop = top[x1];
      if(bot[x1] < curBot) curBot = bot[x1];

      if(curBot <= curTop) break;

      const area = (x1 - x0 + 1) * (curBot - curTop + 1);
      if(area > bestArea){
        bestArea = area;
        best = {
          x: x0,
          y: curTop,
          w: x1 - x0 + 1,
          h: curBot - curTop + 1
        };
      }
    }
  }

  return bestArea > 0 ? best : { x: 0, y: 0, w, h };
}
