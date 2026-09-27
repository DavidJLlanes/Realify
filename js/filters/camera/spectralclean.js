/* ═══════════════════════════════════════════════════════════════
   LIMPIEZA ESPECTRAL GENERALIZADA
   «Eliminar patrones de upsampling» ataca una firma concreta: picos
   exactos cada 2 y 4 píxeles, la huella de una convolución traspuesta
   de paso fijo. Esto es más general: analiza el espectro de Fourier
   completo por bloques y atenúa cualquier bin que sobresalga muy por
   encima de lo que una imagen natural produciría a esa misma
   distancia radial del centro —el espectro de una foto real decae
   suavemente con la frecuencia; una rejilla artificial, de cualquier
   origen y a cualquier paso, rompe esa suavidad con un pico aislado—.

   Es CPU y no aparece en la vista previa, igual que la compresión
   JPEG real: una FFT 2D por cada bloque solapado de la imagen no es
   cosa de recalcular en cada movimiento de un deslizador.
   ═══════════════════════════════════════════════════════════════ */

import { fft1d } from "../../analysis/fft.js";

const N = 128; // tamaño de bloque, potencia de 2

function ifft1d(re, im, n){
  for(let i = 0; i < n; i++) im[i] = -im[i];
  fft1d(re, im, n);
  const inv = 1 / n;
  for(let i = 0; i < n; i++){ re[i] *= inv; im[i] = -im[i] * inv; }
}

function fft2d(re, im, n){
  const rr = new Float64Array(n), ii = new Float64Array(n);
  for(let y = 0; y < n; y++){
    const o = y * n;
    for(let i = 0; i < n; i++){ rr[i] = re[o+i]; ii[i] = im[o+i]; }
    fft1d(rr, ii, n);
    for(let i = 0; i < n; i++){ re[o+i] = rr[i]; im[o+i] = ii[i]; }
  }
  for(let x = 0; x < n; x++){
    for(let i = 0; i < n; i++){ rr[i] = re[i*n+x]; ii[i] = im[i*n+x]; }
    fft1d(rr, ii, n);
    for(let i = 0; i < n; i++){ re[i*n+x] = rr[i]; im[i*n+x] = ii[i]; }
  }
}

function ifft2d(re, im, n){
  const rr = new Float64Array(n), ii = new Float64Array(n);
  for(let y = 0; y < n; y++){
    const o = y * n;
    for(let i = 0; i < n; i++){ rr[i] = re[o+i]; ii[i] = im[o+i]; }
    ifft1d(rr, ii, n);
    for(let i = 0; i < n; i++){ re[o+i] = rr[i]; im[o+i] = ii[i]; }
  }
  for(let x = 0; x < n; x++){
    for(let i = 0; i < n; i++){ rr[i] = re[i*n+x]; ii[i] = im[i*n+x]; }
    ifft1d(rr, ii, n);
    for(let i = 0; i < n; i++){ re[i*n+x] = rr[i]; im[i*n+x] = ii[i]; }
  }
}

/* Atenúa, dentro de un bloque ya transformado, los bins cuya magnitud
   excede `thresh` veces la mediana de su propio anillo radial —el
   nivel que ese mismo bloque produce «de fondo» a esa distancia del
   centro—. `dcGuard` protege un radio mínimo alrededor de la
   continua: ahí vive la iluminación y el contraste general de la
   imagen, no ninguna rejilla, y tocarlo sólo aplana la foto. */
function cleanBlock(re, im, n, thresh, amt, dcGuard){
  const half = n >> 1;
  const mag = new Float64Array(n * n);
  for(let i = 0; i < n * n; i++) mag[i] = Math.hypot(re[i], im[i]);

  const maxR = Math.floor(Math.hypot(half, half)) + 1;
  const bins = Array.from({ length: maxR }, () => []);
  for(let y = 0; y < n; y++){
    const dy = ((y + half) % n) - half;
    for(let x = 0; x < n; x++){
      const dx = ((x + half) % n) - half;
      const r = Math.round(Math.hypot(dx, dy));
      if(r < maxR) bins[r].push(mag[y*n+x]);
    }
  }
  const radialMedian = bins.map(arr => {
    if(!arr.length) return 0;
    arr.sort((a, b) => a - b);
    return arr[arr.length >> 1];
  });

  const minR = Math.max(2, Math.round(dcGuard * half));
  for(let y = 0; y < n; y++){
    const dy = ((y + half) % n) - half;
    for(let x = 0; x < n; x++){
      const dx = ((x + half) % n) - half;
      const r = Math.round(Math.hypot(dx, dy));
      if(r < minR) continue;
      const i = y * n + x;
      const base = radialMedian[r] || 0;
      const excess = mag[i] - base * thresh;
      if(excess > 0){
        const target = base * thresh + excess * (1 - amt);
        const scale = mag[i] > 1e-9 ? target / mag[i] : 1;
        re[i] *= scale; im[i] *= scale;
      }
    }
  }
}

/* Procesa la luminancia de `srcCanvas` por bloques solapados (overlap-
   add con ventana de Hann, paso N/2), aplicando `blockFn(re,im,n)`
   sobre el espectro de cada bloque antes de deshacer la transformada.
   El color se conserva intacto: se reinyecta sólo la diferencia de
   luminancia, así que nada de esto puede virar el tono de la imagen.
   Función compartida por todas las operaciones espectrales de este
   módulo: sólo cambia qué le hacen al espectro entre FFT e IFFT. */
function processByBlocks(srcCanvas, blockFn, onProgress){
  const w = srcCanvas.width, h = srcCanvas.height;
  const sctx = srcCanvas.getContext("2d", { willReadFrequently: true });
  const src = sctx.getImageData(0, 0, w, h);

  const step = N / 2;
  const win = new Float64Array(N);
  for(let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));

  const lumOut = new Float64Array(w * h);
  const wOut = new Float64Array(w * h);

  const tilesY = Math.ceil((h + step) / step);
  const tilesX = Math.ceil((w + step) / step);
  let done = 0, total = tilesX * tilesY;

  for(let ty = -step; ty < h; ty += step){
    for(let tx = -step; tx < w; tx += step){
      const re = new Float64Array(N * N), im = new Float64Array(N * N);
      for(let y = 0; y < N; y++){
        const sy = Math.min(h - 1, Math.max(0, ty + y));
        for(let x = 0; x < N; x++){
          const sx = Math.min(w - 1, Math.max(0, tx + x));
          const i = (sy * w + sx) * 4;
          const l = (0.2126*src.data[i] + 0.7152*src.data[i+1] + 0.0722*src.data[i+2]) / 255;
          re[y*N+x] = (l - 0.5) * win[y] * win[x];
        }
      }
      fft2d(re, im, N);
      blockFn(re, im, N);
      ifft2d(re, im, N);

      for(let y = 0; y < N; y++){
        const py = ty + y;
        if(py < 0 || py >= h) continue;
        for(let x = 0; x < N; x++){
          const px = tx + x;
          if(px < 0 || px >= w) continue;
          const wgt = win[y] * win[x];
          lumOut[py*w+px] += re[y*N+x] + 0.5 * wgt;
          wOut[py*w+px] += wgt;
        }
      }
      done++;
      if(onProgress && (done & 7) === 0) onProgress(done / total);
    }
  }

  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d");
  const outImg = octx.createImageData(w, h);
  for(let p = 0; p < w * h; p++){
    const i = p * 4;
    const wgt = wOut[p] || 1;
    const lumClean = Math.max(0, Math.min(1, lumOut[p] / wgt));
    const l0 = (0.2126*src.data[i] + 0.7152*src.data[i+1] + 0.0722*src.data[i+2]) / 255;
    // Reinyectar la luminancia limpia conservando el croma original,
    // vía una diferencia aplicada por igual a los tres canales: no es
    // una conversión de color exacta, pero evita virajes de tono en
    // los bordes de contraste fuerte sin necesitar YCbCr completo.
    const delta = lumClean - l0;
    outImg.data[i]   = Math.max(0, Math.min(255, src.data[i]   + delta*255));
    outImg.data[i+1] = Math.max(0, Math.min(255, src.data[i+1] + delta*255));
    outImg.data[i+2] = Math.max(0, Math.min(255, src.data[i+2] + delta*255));
    outImg.data[i+3] = src.data[i+3];
  }
  octx.putImageData(outImg, 0, 0);
  return out;
}

/**
 * Elimina patrones periódicos anómalos del espectro de frecuencias de
 * la luminancia, procesando por bloques solapados (overlap-add con
 * ventana de Hann) para cubrir toda la imagen. El color se conserva
 * intacto: la rejilla vive en la luminancia, no en el croma.
 * @param {HTMLCanvasElement} srcCanvas
 * @param {{amt?:number, thresh?:number, dcGuard?:number, onProgress?:(f:number)=>void}} opt
 * @returns {HTMLCanvasElement} un canvas nuevo con el resultado
 */
export function removePeriodicPatterns(srcCanvas, opt = {}){
  const { amt = 0.6, thresh = 2.2, dcGuard = 0.04, onProgress } = opt;
  return processByBlocks(srcCanvas,
    (re, im, n) => cleanBlock(re, im, n, thresh, amt, dcGuard),
    onProgress);
}

/* Perfil radial de magnitud (promedio por anillo, no mediana: aquí
   interesa la energía real de la banda, no aislar picos) de un único
   recorte central grande, y el exponente `alpha` de la ley de
   potencia mag(r) ≈ A·r^-alpha que mejor lo ajusta, por regresión
   lineal en log-log sobre el tramo medio del espectro —se descarta la
   zona muy cercana a la continua (domina el contenido, no la
   textura) y el borde de Nyquist (pocas muestras, ruidoso)—. */
export function estimateSpectralSlope(srcCanvas){
  const n = 256;
  const w = srcCanvas.width, h = srcCanvas.height;
  const c = document.createElement("canvas");
  c.width = n; c.height = n;
  const cx = c.getContext("2d", { willReadFrequently: true });
  if(w >= n && h >= n) cx.drawImage(srcCanvas, (w-n)>>1, (h-n)>>1, n, n, 0, 0, n, n);
  else cx.drawImage(srcCanvas, 0, 0, n, n);
  const d = cx.getImageData(0, 0, n, n).data;
  const lum = new Float64Array(n * n);
  for(let p = 0, i = 0; p < n * n; p++, i += 4)
    lum[p] = (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]) / 255;
  const { alpha, rRef } = spectralStats(lum, n);
  return { alpha, rRef };
}

/**
 * Estadísticas del espectro de una losa cuadrada de luminancia (0..1)
 * de lado `n` (potencia de 2), a resolución nativa. Devuelve:
 *  · alpha   exponente de la ley de potencia mag ∝ r^-alpha (log-log)
 *  · rRef    radio de anclaje usado por normalizeSpectralSlope
 *  · peak2   magnitud en los bins de período 2 px (Nyquist en x, y y
 *            diagonal) relativa a la mediana de su anillo: la firma
 *            de un tablero de ajedrez / upsampling ×2
 *  · peak4   ídem para período 4 px (upsampling ×4 en cascada)
 *  · peakMax el bin más destacado de todo el espectro fuera del
 *            centro, relativo a la mediana de su anillo: cualquier
 *            periodicidad, a cualquier paso
 * Todo relativo a la mediana del anillo, no absoluto: así una foto
 * muy contrastada y una plana dan el mismo «1.0» cuando no hay pico.
 */
export function spectralStats(lum, n){
  const win = new Float64Array(n);
  for(let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
  const re = new Float64Array(n * n), im = new Float64Array(n * n);
  for(let y = 0; y < n; y++)
    for(let x = 0; x < n; x++)
      re[y*n+x] = (lum[y*n+x] - 0.5) * win[y] * win[x];
  fft2d(re, im, n);

  const half = n >> 1;
  const maxR = Math.floor(Math.hypot(half, half)) + 1;
  const mag = new Float64Array(n * n);
  const rOf = new Int32Array(n * n);
  const sums = new Float64Array(maxR), counts = new Float64Array(maxR);
  for(let y = 0; y < n; y++){
    const dy = ((y + half) % n) - half;
    for(let x = 0; x < n; x++){
      const dx = ((x + half) % n) - half;
      const r = Math.round(Math.hypot(dx, dy));
      const i = y * n + x;
      mag[i] = Math.hypot(re[i], im[i]);
      rOf[i] = r;
      if(r < maxR){ sums[r] += mag[i]; counts[r]++; }
    }
  }
  const profile = sums.map((s, i) => counts[i] ? s / counts[i] : 0);

  // Pendiente por regresión log-log sobre el tramo medio del espectro.
  const rMin = Math.max(3, Math.round(0.03 * half)), rMax = Math.round(0.9 * half);
  let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
  for(let r = rMin; r <= rMax; r++){
    if(profile[r] <= 0) continue;
    const lx = Math.log(r), ly = Math.log(profile[r]);
    sx += lx; sy += ly; sxx += lx*lx; sxy += lx*ly; cnt++;
  }
  const alpha = cnt < 2 ? 1.0 : -(cnt*sxy - sx*sy) / (cnt*sxx - sx*sx);
  const rRef = Math.round((rMin + rMax) / 2);

  /* Un pico es un bin que destaca sobre su VECINDARIO 2D en el
     espectro, no sólo sobre su anillo: en un espectro anisótropo (un
     horizonte, una fachada) toda la energía va por un eje y cada bin
     de ese eje «destaca» sobre un anillo casi vacío sin ser ningún
     pico. Se compara con la media de un cuadro de 9×9 sin el 3×3
     central, y con un suelo absoluto —una fracción de la magnitud
     media fuera del centro— para que un espectro casi vacío (una
     rampa limpia) no dé cocientes infinitos entre dos ceros. */
  const guard = Math.max(3, Math.round(0.04 * half));
  let gSum = 0, gCnt = 0;
  for(let i = 0; i < n * n; i++) if(rOf[i] >= guard){ gSum += mag[i]; gCnt++; }
  /* Dos suelos: uno relativo a la energía media fuera del centro, y
     otro ABSOLUTO en unidades de cuantización. Un patrón coherente de
     amplitud A sobre toda la losa da un pico ≈ A·(n/2)² (la ventana de
     Hann suma n/2 por eje); por debajo de ~0.6 LSB de amplitud es la
     escalera que deja cuantizar a 8 bits un degradado suave, no una
     rejilla, y sin este suelo una imagen casi plana la convertía en
     un pico gigantesco contra un fondo de ceros. */
  const floorRel = 0.25 * (gCnt ? gSum / gCnt : 0);
  const floorAbs = (0.6 / 255) * half * half;
  const floor = Math.max(floorRel, floorAbs);
  const neighMean = (x, y) => {
    let s = 0, c = 0;
    for(let dy = -4; dy <= 4; dy++){
      for(let dx = -4; dx <= 4; dx++){
        if(Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
        s += mag[((y + dy + n) % n) * n + ((x + dx + n) % n)]; c++;
      }
    }
    return s / c;
  };
  const rel = (x, y) => {
    const i = ((y + n) % n) * n + ((x + n) % n);
    return mag[i] / Math.max(neighMean(x, y), floor);
  };
  // Período 2 px: bins (half,0), (0,half) y la diagonal (half,half).
  const peak2 = Math.max(rel(half, 0), rel(0, half), rel(half, half));
  // Período 4 px: (half/2,0), (0,half/2), (half/2,half/2).
  const q = half >> 1;
  const peak4 = Math.max(rel(q, 0), rel(0, q), rel(q, q));

  /* Pico más destacado a escala FINA (período ≤ 10 px): ahí viven
     las rejillas de un generador; las periodicidades de escena
     —ladrillos, vallas, azulejos— son más gruesas y no son un
     artefacto que corregir. Sólo se calcula el vecindario de los
     candidatos que ya superan 4× el suelo, que son pocos. */
  let peakMax = 1;
  const rFine = Math.max(guard, Math.round(0.2 * half));
  for(let y = 0; y < n; y++){
    for(let x = 0; x < n; x++){
      const i = y * n + x;
      if(rOf[i] < rFine || mag[i] < 4 * floor) continue;
      const v = rel(x, y);
      if(v > peakMax) peakMax = v;
    }
  }
  return { alpha, rRef, peak2, peak4, peakMax };
}

/**
 * Reescala la banda de altas frecuencias del espectro para que su
 * pendiente de caída (magnitud ∝ r^-alpha) se acerque a la de una
 * fotografía real, en vez de la que la imagen trae de fábrica —una
 * imagen generada puede tener, de forma difusa y sin ningún pico
 * aislado, más o menos energía de alta frecuencia de la que un
 * sensor real produciría—. El ajuste ancla en un radio de referencia
 * intermedio, donde la corrección es 1 (sin cambio): eso preserva el
 * brillo y el contraste general del bloque, y sólo redistribuye cómo
 * se reparte la energía entre frecuencias bajas y altas.
 * @param {HTMLCanvasElement} srcCanvas
 * @param {{amt?:number, targetAlpha?:number, dcGuard?:number, onProgress?:(f:number)=>void}} opt
 * @returns {HTMLCanvasElement}
 */
export function normalizeSpectralSlope(srcCanvas, opt = {}){
  const { amt = 0.6, targetAlpha = 1.0, dcGuard = 0.04, onProgress } = opt;
  const { alpha: observedAlpha, rRef } = estimateSpectralSlope(srcCanvas);
  const expo = (observedAlpha - targetAlpha) * amt;

  return processByBlocks(srcCanvas, (re, im, n) => {
    const half = n >> 1;
    const minR = Math.max(2, Math.round(dcGuard * half));
    for(let y = 0; y < n; y++){
      const dy = ((y + half) % n) - half;
      for(let x = 0; x < n; x++){
        const dx = ((x + half) % n) - half;
        const r = Math.round(Math.hypot(dx, dy));
        if(r < minR) continue;
        const i = y * n + x;
        const factor = Math.pow(Math.max(r, 1) / rRef, expo);
        re[i] *= factor; im[i] *= factor;
      }
    }
  }, onProgress);
}
