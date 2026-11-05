/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · COMPENSACIÓN DEL FONDO
   Al estrechar un cuerpo, la zona que ocupaba deja de estar tapada y hay que rellenarla con fondo. `descubierto` calcula esa zona
   (donde había persona y tras la deformación ya no) y `rellenar` la rellena con un modelo de relleno que se le pasa como función
   (LaMa en escritorio, ver lama.js; en las pruebas, uno falso). Se trabaja en un recorte cuadrado a N×N alrededor del hueco y se
   mezcla de vuelta con borde suave, así el resto de la imagen no cambia ni un píxel.
   Entradas: máscara de persona (Float32Array 0-1) y campo; imagen RGBA, hueco y `inpaint(rgbaN, huecoN, N)`. Sin DOM.
   Las rectas del fondo que cruzan el hueco se vuelven a trazar (lineas.js). Límites: MI-GAN no está en el catálogo (sólo LaMa).
   ═══════════════════════════════════════════════════════════════ */
import { muestrear } from "./field.js";
import { gauss } from "../portrait/shared/blur.js";
import { lineas, pintarLineas } from "./lineas.js";

/* Máscara 0/1 de lo que era persona y tras aplicar el campo ya no lo es (algo agrandada, para llevarse el halo). */
export function descubierto(persona, W, H, campo, { dilatar = 3 } = {}){
  const v = new Float32Array(W * H), d = [0, 0];
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    muestrear(campo, x, y, d);
    const sx = Math.min(W - 1, Math.max(0, x + d[0])), sy = Math.min(H - 1, Math.max(0, y + d[1]));
    const x0 = Math.min(W - 2, Math.floor(sx)), y0 = Math.min(H - 2, Math.floor(sy)), u = sx - x0, t = sy - y0, o = y0 * W + x0;
    const m2 = persona[o] * (1 - u) * (1 - t) + persona[o + 1] * u * (1 - t) + persona[o + W] * (1 - u) * t + persona[o + W + 1] * u * t;
    v[y * W + x] = Math.max(0, persona[y * W + x] - m2);
  }
  if(dilatar > 0){ const g = gauss(v, W, H, dilatar); for(let i = 0; i < v.length; i++) v[i] = g[i] * 4 > 0.05 ? 1 : 0; }
  else for(let i = 0; i < v.length; i++) v[i] = v[i] > 0.05 ? 1 : 0;
  return v;
}

function cajaDe(h, W, H){
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(h[y * W + x] > 0.5){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/* Recorte cuadrado (lado `s`) del RGBA, escalado a N×N con interpolación bilineal. */
function recortar(rgba, W, H, r, N){
  const out = new Uint8ClampedArray(N * N * 4), k = r.s / N;
  for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
    const sx = Math.min(W - 1, Math.max(0, r.x + (x + 0.5) * k - 0.5)), sy = Math.min(H - 1, Math.max(0, r.y + (y + 0.5) * k - 0.5));
    const x0 = Math.min(W - 2, Math.floor(sx)), y0 = Math.min(H - 2, Math.floor(sy)), u = sx - x0, t = sy - y0;
    for(let c = 0; c < 4; c++){
      const a = rgba[(y0 * W + x0) * 4 + c], b = rgba[(y0 * W + x0 + 1) * 4 + c], d = rgba[((y0 + 1) * W + x0) * 4 + c], e = rgba[((y0 + 1) * W + x0 + 1) * 4 + c];
      out[(y * N + x) * 4 + c] = a * (1 - u) * (1 - t) + b * u * (1 - t) + d * (1 - u) * t + e * u * t;
    }
  }
  return out;
}

export async function rellenar({ rgba, W, H, hueco, inpaint, N = 512, margen = 0.5, persona = null, rectas = true }){
  const b = cajaDe(hueco, W, H); if(!b) return rgba;
  const lado = Math.min(Math.min(W, H), Math.max(64, Math.round(Math.max(b.x1 - b.x0, b.y1 - b.y0) * (1 + margen * 2))));
  const r = { s: lado, x: Math.max(0, Math.min(W - lado, Math.round((b.x0 + b.x1) / 2 - lado / 2))), y: Math.max(0, Math.min(H - lado, Math.round((b.y0 + b.y1) / 2 - lado / 2))) };
  const entrada = recortar(rgba, W, H, r, N), hn = new Uint8Array(N * N), k = lado / N;
  for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
    let on = 0;                                        // máximo de la zona dentro del píxel de N (no se escapa nada)
    for(let yy = Math.floor(y * k); yy <= Math.min(lado - 1, Math.floor((y + 1) * k)) && !on; yy++)
      for(let xx = Math.floor(x * k); xx <= Math.min(lado - 1, Math.floor((x + 1) * k)); xx++) if(hueco[(r.y + yy) * W + r.x + xx] > 0.5){ on = 1; break; }
    hn[y * N + x] = on;
  }
  const res = await inpaint(entrada, hn, N);
  const blanda = gauss(hueco, W, H, 1.5), out = new Uint8ClampedArray(rgba);
  for(let y = r.y; y < r.y + lado; y++) for(let x = r.x; x < r.x + lado; x++){
    const i = y * W + x; if(hueco[i] < 0.5 && blanda[i] < 0.02) continue;
    const a = Math.min(1, Math.max(hueco[i], blanda[i] * 2));
    const sx = Math.min(N - 1.001, (x - r.x + 0.5) / k - 0.5), sy = Math.min(N - 1.001, (y - r.y + 0.5) / k - 0.5);
    const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy)), u = Math.max(0, sx - x0), t = Math.max(0, sy - y0);
    for(let c = 0; c < 3; c++){
      const v = res[(y0 * N + x0) * 4 + c] * (1 - u) * (1 - t) + res[(y0 * N + x0 + 1) * 4 + c] * u * (1 - t) + res[((y0 + 1) * N + x0) * 4 + c] * (1 - u) * t + res[((y0 + 1) * N + x0 + 1) * 4 + c] * u * t;
      out[i * 4 + c] = rgba[i * 4 + c] * (1 - a) + v * a;
    }
  }
  if(rectas){                                                // las rectas del fondo que cruzan el hueco se vuelven a trazar
    const ex = new Float32Array(W * H); for(let i = 0; i < ex.length; i++) ex[i] = Math.max(hueco[i], persona ? persona[i] : 0);
    const ls = lineas(rgba, W, H, hueco, ex);
    if(ls.length) pintarLineas(out, rgba, W, H, hueco, ex, ls);
  }
  return out;
}
