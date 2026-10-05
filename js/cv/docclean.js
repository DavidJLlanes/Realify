/* ═══════════════════════════════════════════════════════════════
   LIMPIEZA DE DOCUMENTOS (fase 8 de PENDIENTE.md) · sin DOM ni OpenCV
   Una foto de un papel trae sombras, un degradado de luz y un blanco
   grisáceo. Se estima el «papel» de cada zona (máximo por bloques,
   ensanchado y suavizado: el texto desaparece, las sombras quedan) y se
   divide la foto por él, de modo que el papel sale de un blanco liso y
   el texto conserva su contraste:

     · paper: papel aclarado (color) con un contraste algo mayor.
     · gray:  lo mismo en escala de grises.
     · bw:    blanco y negro de texto: umbral de Otsu sobre lo aplanado,
              con un borde suave de ±½ píxel (sin dientes de sierra).

   `cleanDocument(data, w, h, mode)` trabaja sobre RGBA de 8 bits, en su sitio.
   ═══════════════════════════════════════════════════════════════ */

const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v;

/** Mapa del papel (3 canales, Float32 a tamaño completo implícito): rejilla pequeña + interpolación bilineal. */
function paperGrid(data, w, h){
  const step = Math.max(2, Math.round(Math.max(w, h) / 220)), gw = Math.ceil(w / step), gh = Math.ceil(h / step);
  let g = new Float32Array(gw * gh * 3);
  for(let by = 0; by < gh; by++) for(let bx = 0; bx < gw; bx++){
    // Máximo por bloque, canal a canal, ignorando el 10 % más brillante (motas y reflejos)
    for(let c = 0; c < 3; c++){
      const vals = [];
      for(let y = by * step; y < Math.min(h, (by + 1) * step); y += 2) for(let x = bx * step; x < Math.min(w, (bx + 1) * step); x += 2) vals.push(data[(y * w + x) * 4 + c]);
      vals.sort((a, b) => a - b);
      g[(by * gw + bx) * 3 + c] = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.88))];
    }
  }
  // Ensanchar (máximo 3×3, dos veces: se come trazos de hasta ~5 bloques) y suavizar (caja 3×3, dos veces)
  const maxFilter = src => { const o = new Float32Array(src.length); for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++) for(let c = 0; c < 3; c++){ let m = 0; for(let j = -1; j <= 1; j++) for(let i = -1; i <= 1; i++){ const X = Math.min(gw - 1, Math.max(0, x + i)), Y = Math.min(gh - 1, Math.max(0, y + j)); m = Math.max(m, src[(Y * gw + X) * 3 + c]); } o[(y * gw + x) * 3 + c] = m; } return o; };
  const boxFilter = src => { const o = new Float32Array(src.length); for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++) for(let c = 0; c < 3; c++){ let s = 0; for(let j = -1; j <= 1; j++) for(let i = -1; i <= 1; i++){ const X = Math.min(gw - 1, Math.max(0, x + i)), Y = Math.min(gh - 1, Math.max(0, y + j)); s += src[(Y * gw + X) * 3 + c]; } o[(y * gw + x) * 3 + c] = s / 9; } return o; };
  g = maxFilter(maxFilter(g)); g = boxFilter(boxFilter(g));
  return { g, gw, gh, step };
}

/** Otsu sobre un histograma de 256 niveles → umbral 0-255. */
function otsu(hist, total){
  let sum = 0; for(let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sumB = 0, best = 0, thr = 128;
  for(let t = 0; t < 256; t++){
    wB += hist[t]; if(!wB) continue;
    const wF = total - wB; if(!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
    if(v > best){ best = v; thr = t; }
  }
  return thr;
}

export function cleanDocument(data, w, h, mode = "paper"){
  if(mode === "none") return data;
  const { g, gw, gh, step } = paperGrid(data, w, h), n = w * h;
  // Aplanar: v / papel · 255, con interpolación bilineal del papel
  const flat = new Uint8ClampedArray(n * 4);
  const hist = new Float64Array(256);
  for(let y = 0; y < h; y++){
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / step - 0.5)), y0 = fy | 0, y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < w; x++){
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / step - 0.5)), x0 = fx | 0, x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0, i = (y * w + x) * 4;
      for(let c = 0; c < 3; c++){
        const a = g[(y0 * gw + x0) * 3 + c], b = g[(y0 * gw + x1) * 3 + c], d = g[(y1 * gw + x0) * 3 + c], e = g[(y1 * gw + x1) * 3 + c];
        const paper = Math.max(30, (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty);
        flat[i + c] = clamp8(data[i + c] / paper * 255);
      }
      flat[i + 3] = data[i + 3];
      hist[(flat[i] * 0.299 + flat[i + 1] * 0.587 + flat[i + 2] * 0.114) | 0]++;
    }
  }
  if(mode === "bw"){
    const T = Math.min(200, Math.max(110, otsu(hist, n)));
    for(let i = 0; i < n * 4; i += 4){
      const l = flat[i] * 0.299 + flat[i + 1] * 0.587 + flat[i + 2] * 0.114, t = Math.min(1, Math.max(0, (l - (T - 14)) / 28)), v = t * t * (3 - 2 * t) * 255;
      data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = flat[i + 3];
    }
    return data;
  }
  // Papel/gris: negro en el percentil 1,5 de lo aplanado y un poco de curva para que el texto no quede descolorido
  let acc = 0, black = 0; for(let i = 0; i < 256; i++){ acc += hist[i]; if(acc >= n * 0.015){ black = i; break; } }
  black = Math.min(black, 90);
  const lut = new Uint8ClampedArray(256); for(let v = 0; v < 256; v++) lut[v] = 255 * Math.pow(Math.max(0, (v - black) / (255 - black)), 1.15);
  for(let i = 0; i < n * 4; i += 4){
    if(mode === "gray"){ const l = lut[(flat[i] * 0.299 + flat[i + 1] * 0.587 + flat[i + 2] * 0.114) | 0]; data[i] = data[i + 1] = data[i + 2] = l; }
    else { data[i] = lut[flat[i]]; data[i + 1] = lut[flat[i + 1]]; data[i + 2] = lut[flat[i + 2]]; }
    data[i + 3] = flat[i + 3];
  }
  return data;
}

export const FINISHES = [["none", "Sin cambios"], ["paper", "Aclarar el papel"], ["gray", "Escala de grises limpia"], ["bw", "Blanco y negro (texto)"]];
