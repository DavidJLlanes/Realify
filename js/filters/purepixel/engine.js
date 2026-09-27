/* PurePixel: bounded spatial processing, independent of Realify.
   Changes texture statistics; it does not establish origin or certify evasion.
   Coordinates seed the grain so a 1:1 crop matches the full-size result. */
export const DEFAULTS = Object.freeze({ smooth: 35, chroma: 25, grain: 20, limit: 6, seed: 1729 });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function normalize(options = {}) {
  const out = {};
  for (const key of ["smooth", "chroma", "grain", "limit", "seed"]) {
    const n = Number(options[key] ?? DEFAULTS[key]);
    out[key] = Number.isFinite(n) ? n : DEFAULTS[key];
  }
  for (const key of ["smooth", "chroma", "grain"]) out[key] = clamp(out[key], 0, 100);
  out.limit = Math.round(clamp(out.limit, 0, 16));
  out.seed = out.seed >>> 0;
  return out;
}

function noise(x, y, seed) {
  let n = (Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77) ^ seed) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296 * 2 - 1;
}

export function difference(before, after) {
  let sum = 0, squares = 0, max = 0, count = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (!before[i + 3]) continue;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(after[i + c] - before[i + c]);
      sum += d; squares += d * d; max = Math.max(max, d); count++;
    }
  }
  const mse = count ? squares / count : 0;
  return { mae: count ? sum / count : 0, max, psnr: mse ? 10 * Math.log10(255 * 255 / mse) : Infinity };
}

export function processPixels({ data, width, height, options, mask = null, originX = 0, originY = 0 }, onProgress = () => {}) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !(data instanceof Uint8ClampedArray) || data.length !== width * height * 4 ||
      (mask && (!(mask instanceof Uint8Array) || mask.length !== width * height))) {
    throw new Error("PurePixel: dimensiones o datos de imagen incorrectos.");
  }
  const p = normalize(options), out = new Uint8ClampedArray(data);
  if (!p.limit || (!p.smooth && !p.chroma && !p.grain)) {
    onProgress(1); return { data: out, stats: difference(data, out) };
  }
  const smooth = p.smooth / 100, chroma = p.chroma / 100, grain = p.grain / 100 * 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x, i = pixel * 4;
      // Fully transparent pixels carry no reliable color; everything else
      // gets processed, but its own alpha fades the effect continuously
      // (see `coverage` below) instead of being cut off at alpha===255,
      // which used to leave a hard visible seam at any soft/antialiased edge.
      if (!data[i + 3] || (mask && !mask[pixel])) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let rr = r * 4, gg = g * 4, bb = b * 4, weights = 4;
      // Bilateral 3x3 neighborhood: suppress fine residuals while limiting
      // mixing across edges and excluding colors from transparent pixels.
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          if (xx === x && yy === y) continue;
          const j = (yy * width + xx) * 4;
          const dr = data[j] - r, dg = data[j + 1] - g, db = data[j + 2] - b;
          const spatial = (xx === x || yy === y) ? 2 : 1;
          const weight = spatial * data[j + 3] / 255 / (1 + (dr * dr + dg * dg + db * db) / 432);
          rr += data[j] * weight; gg += data[j + 1] * weight; bb += data[j + 2] * weight;
          weights += weight;
        }
      }
      const dr = rr / weights - r, dg = gg / weights - g, db = bb / weights - b;
      const dl = dr * 0.2126 + dg * 0.7152 + db * 0.0722;
      const luma = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      const texture = noise(x + originX, y + originY, p.seed) * grain * Math.sqrt(4 * luma * (1 - luma));
      const coverage = (mask ? mask[pixel] / 255 : 1) * (data[i + 3] / 255);
      for (let c = 0; c < 3; c++) {
        const dc = c === 0 ? dr : c === 1 ? dg : db;
        const delta = clamp(smooth * dl + chroma * (dc - dl) + texture, -p.limit, p.limit);
        out[i + c] = data[i + c] + delta * coverage;
      }
    }
    if ((y & 31) === 0) onProgress(y / height);
  }
  onProgress(1);
  return { data: out, stats: difference(data, out) };
}
