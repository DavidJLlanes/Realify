/* ══════════════════════════════════════════════════════════════
   UNMARK · MARCAS EN MOSAICO (F11.7)
   Los bancos de imágenes y algunos generadores repiten su logotipo o su texto por TODA la foto, casi transparente y en diagonal. Una marca así no se
   parece a un rótulo del borde: lo que la delata es que se REPITE con un desplazamiento fijo. Esto lo busca con una correlación del mapa de «trazos
   finos» (el mismo top-hat que usa detect.js) y, si hay un desplazamiento que repite la mayoría de esos trazos, devuelve como marca SÓLO los píxeles que
   se repiten (no la caja entera), de modo que el relleno toca poco de la foto.
   Entradas: v (fuerza de trazo fino, Float32 w×h), C (croma), w, h, umbral bajo (0,05). Salida: null o { mask, shift:{dx,dy}, score, box } a la resolución de trabajo;
   y codificar/decodificar la máscara a una lista de números (RLE) para guardarla en los parámetros de la capa.
   Límites: es un heurístico; no detecta marcas con una sola copia (esas son del detector normal) ni mosaicos con menos de 3 copias.
   ══════════════════════════════════════════════════════════════ */

const BASE = 128;           // lado largo del mapa binario con el que se correlaciona

/* Mapa reducido a ≤ BASE px con el MÁXIMO de cada celda (conserva los trazos finos), centrado en su media. */
function reducir(v, w, h){
  const f = Math.max(1, Math.ceil(Math.max(w, h) / BASE)), gw = Math.ceil(w / f), gh = Math.ceil(h / f), g = new Float32Array(gw * gh);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = ((y / f) | 0) * gw + ((x / f) | 0); if(v[y * w + x] > g[i]) g[i] = v[y * w + x]; }
  let m = 0; for(let i = 0; i < g.length; i++) m += g[i]; m /= g.length; for(let i = 0; i < g.length; i++) g[i] -= m;
  return { g, gw, gh, f };
}

/** Correlación normalizada del mapa consigo mismo desplazado: el desplazamiento con pico claro sobre el resto es el del mosaico. */
function mejorDesplazamiento(g, gw, gh){
  let e = 0; for(let i = 0; i < g.length; i++) e += g[i] * g[i];
  if(e < 1e-6) return null;
  const minD = Math.max(5, Math.round(Math.min(gw, gh) * 0.07)), res = [];
  for(let dy = 0; dy <= gh / 2; dy++){
    for(let dx = -gw / 2 | 0; dx <= gw / 2; dx++){
      if(dy === 0 && dx <= 0) continue;
      if(Math.abs(dx) < minD && dy < minD) continue;
      let s = 0;
      for(let y = 0; y + dy < gh; y++){
        const a = y * gw, b = (y + dy) * gw;
        for(let x = Math.max(0, -dx); x < gw - Math.max(0, dx); x++) s += g[a + x] * g[b + x + dx];
      }
      res.push({ dx, dy, r: s / e });
    }
  }
  if(!res.length) return null;
  let mu = 0, top = res[0]; for(const o of res){ mu += o.r; if(o.r > top.r) top = o; } mu /= res.length;
  let sd = 0; for(const o of res) sd += (o.r - mu) * (o.r - mu); sd = Math.sqrt(sd / res.length);
  return top.r > 0.12 && (top.r - mu) / (sd + 1e-6) > 5 ? top : null;
}

export function buscarMosaico(v, C, w, h, umbral){
  const n = w * h, { g, gw, gh, f } = reducir(v, w, h), best = mejorDesplazamiento(g, gw, gh);
  if(!best) return null;
  const dx = best.dx * f, dy = best.dy * f, tol = Math.max(1, f), mask = new Uint8Array(n);
  const fuerte = (x, y) => { let m = 0; for(let j = -tol; j <= tol; j++) for(let i = -tol; i <= tol; i++){ const xx = x + i, yy = y + j; if(xx >= 0 && yy >= 0 && xx < w && yy < h && v[yy * w + xx] > m) m = v[yy * w + xx]; } return m; };
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const q = y * w + x; if(v[q] <= umbral || C[q] >= 0.42) continue;
    if(Math.min(v[q], Math.max(fuerte(x + dx, y + dy), fuerte(x - dx, y - dy))) > umbral) mask[q] = 1;
  }
  /* Quita motas sueltas (apertura 1 px) y engorda 2 px: el top-hat da el trazo; la marca real es algo más gruesa. */
  const lim = new Uint8Array(n);
  for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++){ const q = y * w + x; if(mask[q] && mask[q - 1] + mask[q + 1] + mask[q - w] + mask[q + w] >= 2) lim[q] = 1; }
  let hits = 0, x0 = w, y0 = h, x1 = -1, y1 = -1; const gruesa = new Uint8Array(n), r = 2;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(lim[y * w + x]){
    hits++; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
    for(let j = -r; j <= r; j++) for(let i = -r; i <= r; i++){ const xx = x + i, yy = y + j; if(xx >= 0 && yy >= 0 && xx < w && yy < h) gruesa[yy * w + xx] = 1; }
  }
  if(hits < 80) return null;
  return { mask: gruesa, shift: { dx, dy }, score: Math.min(1, best.r * 3), box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}

/** Máscara binaria → lista de números [ceros, unos, ceros, …] (cabe en el JSON de los parámetros). */
export function codificar(mask){
  const out = []; let cur = 0, run = 0;
  for(let i = 0; i < mask.length; i++){ const b = mask[i] ? 1 : 0; if(b === cur) run++; else { out.push(run); cur = b; run = 1; } }
  out.push(run); return out;
}
export function decodificar(rle, n){
  const m = new Uint8Array(n); let p = 0, cur = 0;
  for(const k of rle){ if(cur) m.fill(1, p, p + k); p += k; cur ^= 1; }
  return m;
}
