/* ═══════════════════════════════════════════════════════════════
   FILTROS ESPACIALES EN COMA FLOTANTE «DE VERDAD» (v252)
   Desenfoque gaussiano, máscara de enfoque y ruido calculados directamente sobre los 16 bits de la capa, en Float32, sin pasar por el
   resultado de 8 bits (hasta ahora el cambio de 8 bits se sumaba a los 16: «delta»). Reciben `inp` (RGB Uint16Array, W×H, opaco) y devuelven
   otro Uint16Array RGB, o null si no pueden. `tick()` cede el hilo entre pasos para no congelar la interfaz.

   · El desenfoque gaussiano es el clásico de tres cajas sucesivas (Kovesi/Wells, error < 3 % del gaussiano exacto), con bordes extendidos,
     una pasada O(1) por píxel independiente del radio y un plano Float32 por canal.
   · La máscara de enfoque usa la misma fórmula que el filtro de 8 bits (resta a la imagen su versión borrosa, umbral, cantidad).
   · El ruido repite la secuencia aleatoria del filtro de 8 bits (misma semilla) pero sin redondear a 8 bits antes de sumar.
   ═══════════════════════════════════════════════════════════════ */

const tickDefault = () => new Promise(r => setTimeout(r, 0));

/* Tamaños de caja (impares) para aproximar un gaussiano de desviación `sigma` con `n` pasadas. */
export function boxSizes(sigma, n = 3){
  const ideal = Math.sqrt(12 * sigma * sigma / n + 1);
  let wl = Math.floor(ideal); if(wl % 2 === 0) wl--;
  const wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => i < m ? wl : wu);
}

/* Una pasada de caja de radio `r` en horizontal y otra en vertical sobre un plano Float32 (bordes extendidos). `tmp` del mismo tamaño. */
function boxPass(plane, tmp, w, h, r){
  const win = 2 * r + 1;
  for(let y = 0; y < h; y++){
    const row = y * w; let sum = 0;
    for(let k = -r; k <= r; k++) sum += plane[row + Math.min(w - 1, Math.max(0, k))];
    tmp[row] = sum / win;
    for(let x = 1; x < w; x++){ sum += plane[row + Math.min(w - 1, x + r)] - plane[row + Math.max(0, x - r - 1)]; tmp[row + x] = sum / win; }
  }
  for(let x = 0; x < w; x++){
    let sum = 0;
    for(let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    plane[x] = sum / win;
    for(let y = 1; y < h; y++){ sum += tmp[Math.min(h - 1, y + r) * w + x] - tmp[Math.max(0, y - r - 1) * w + x]; plane[y * w + x] = sum / win; }
  }
}

/* Desenfoque gaussiano de un canal (índice k del RGB entrelazado) → plano Float32 desenfocado. */
async function blurChannel(inp, w, h, k, sigma, tick){
  const n = w * h, plane = new Float32Array(n), tmp = new Float32Array(n);
  for(let i = 0, j = k; i < n; i++, j += 3) plane[i] = inp[j];
  for(const size of boxSizes(sigma)){ boxPass(plane, tmp, w, h, (size - 1) >> 1); await tick(); }
  return plane;
}

const to16 = v => v <= 0 ? 0 : v >= 65535 ? 65535 : Math.round(v);

export async function gaussianBlurHi(inp, w, h, sigma, tick = tickDefault){
  if(!(sigma > 0)) return null;
  const out = new Uint16Array(inp.length), n = w * h;
  for(let k = 0; k < 3; k++){
    const p = await blurChannel(inp, w, h, k, sigma, tick);
    for(let i = 0, j = k; i < n; i++, j += 3) out[j] = to16(p[i]);
  }
  return out;
}

/* Máscara de enfoque: v + (v − borroso)·cantidad, y las diferencias por debajo del umbral (niveles de 8 bits) se dejan quietas. */
export async function unsharpHi(inp, w, h, { amount = 60, radius = 2, threshold = 0 } = {}, tick = tickDefault){
  if(!(radius > 0)) return null;
  const out = new Uint16Array(inp.length), n = w * h, amt = amount / 100, th = threshold * 257;
  for(let k = 0; k < 3; k++){
    const p = await blurChannel(inp, w, h, k, radius, tick);
    for(let i = 0, j = k; i < n; i++, j += 3){
      const v = inp[j], diff = v - p[i];
      out[j] = Math.abs(diff) <= th ? v : to16(v + diff * amt);
    }
  }
  return out;
}

/* Ruido (misma secuencia que el filtro de 8 bits: mulberry32 con la semilla, Box-Muller o uniforme). */
export async function noiseHi(inp, w, h, { amount = 12, mono = true, gaussian = true, seed = 1 } = {}, tick = tickDefault){
  const out = new Uint16Array(inp.length), amt = amount * 1.28 * 257;
  let st = (seed | 0) >>> 0;
  const rand = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rnd = gaussian ? () => { const u = Math.max(rand(), 1e-9); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * rand()) * 0.4; } : () => rand() * 2 - 1;
  const n = w * h;
  for(let i = 0, j = 0; i < n; i++, j += 3){
    if(mono){ const d = rnd() * amt; out[j] = to16(inp[j] + d); out[j + 1] = to16(inp[j + 1] + d); out[j + 2] = to16(inp[j + 2] + d); }
    else { out[j] = to16(inp[j] + rnd() * amt); out[j + 1] = to16(inp[j + 1] + rnd() * amt); out[j + 2] = to16(inp[j + 2] + rnd() * amt); }
    if((i & 0x3ffff) === 0x3ffff) await tick();
  }
  return out;
}
