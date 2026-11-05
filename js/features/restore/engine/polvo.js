/* ═══════════════════════════════════════════════════════════════
   RESTAURAR · POLVO Y MOTAS (puro, sin DOM)
   Las motas del sensor son manchas pequeñas, algo más oscuras y casi redondas sobre zonas LISAS (cielo, paredes). Se busca en log-luminancia lo que
   queda por debajo de su entorno (restando un paso bajo de radio ~1,2× el tamaño máximo), se agrupan los píxeles, y sólo se aceptan las manchas con tamaño
   y redondez razonables cuyo contorno es liso (así una rama o una pestaña no se confunden). Se rellenan con el color del contorno (convolución
   normalizada) sin tocar nada más. Entradas: planos (se modifican), valores { sensibilidad 0-100, tamano px máx. de la mota (4-60) }.
   Salida: { motas: número, mascara: Float32Array 0-1 } (la máscara sirve para crear una selección).
   ═══════════════════════════════════════════════════════════════ */
import { gauss, gaussMasked } from "../../portrait/shared/blur.js";

export const hayPolvo = v => (v.sensibilidad || 0) > 0;

export function detectarMotas(p, v){
  const { W, H, Y } = p, n = W * H, s = Math.min(100, Math.max(0, v.sensibilidad == null ? 50 : v.sensibilidad)) / 100, maxD = Math.min(60, Math.max(4, v.tamano || 24));
  const ly = new Float32Array(n); for(let i = 0; i < n; i++) ly[i] = Math.log(Math.max(Y[i], 1e-4));
  const bajo = gauss(ly, W, H, Math.max(2, maxD * 0.7)), d = new Float32Array(n), ab = [];
  for(let i = 0; i < n; i++){ d[i] = ly[i] - bajo[i]; }
  for(let i = 0; i < n; i += 5) ab.push(Math.abs(d[i])); ab.sort((a, b) => a - b);
  const sigma = (ab[ab.length >> 1] || 0.005) / 0.6745, umbral = Math.max(0.012, sigma * (6 - 3 * s));
  const cand = new Uint8Array(n), etiq = new Int32Array(n).fill(-1), comp = [];
  for(let i = 0; i < n; i++) if(d[i] < -umbral) cand[i] = 1;
  for(let i = 0; i < n; i++){
    if(!cand[i] || etiq[i] >= 0) continue;
    const pila = [i], cs = []; etiq[i] = comp.length; let x0 = W, x1 = 0, y0 = H, y1 = 0;
    while(pila.length){ const q = pila.pop(), x = q % W, y = (q - x) / W; cs.push(q); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const xx = x + dx, yy = y + dy; if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if(cand[j] && etiq[j] < 0){ etiq[j] = comp.length; pila.push(j); } } }
    comp.push({ cs, x0, x1, y0, y1 });
  }
  const mascara = new Float32Array(n); let motas = 0;
  for(const c of comp){
    const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, area = c.cs.length;
    if(area < 5 || Math.max(w, h) > maxD || area / (w * h) < 0.5 || Math.max(w, h) / Math.min(w, h) > 2.2) continue;
    /* contorno liso: la desviación de d en el anillo exterior debe ser pequeña */
    let sa = 0, sb = 0, k = 0; const m = Math.ceil(Math.max(w, h) * 0.8) + 2;
    for(let y = Math.max(0, c.y0 - m); y <= Math.min(H - 1, c.y1 + m); y++) for(let x = Math.max(0, c.x0 - m); x <= Math.min(W - 1, c.x1 + m); x++){ const i = y * W + x; if(etiq[i] >= 0 || cand[i]) continue; sa += d[i]; sb += d[i] * d[i]; k++; }
    if(k < 8) continue; const sd = Math.sqrt(Math.max(0, sb / k - (sa / k) ** 2)); if(sd > Math.max(sigma * 3, umbral * 0.7)) continue;
    for(const q of c.cs) mascara[q] = 1; motas++;
  }
  return { motas, mascara: motas ? gauss(dilatar(mascara, W, H, 2), W, H, 1) : mascara };
}

function dilatar(m, W, H, r){
  const o = new Float32Array(m.length);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ if(m[y * W + x] <= 0.5) continue; for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++){ const xx = x + dx, yy = y + dy; if(xx >= 0 && yy >= 0 && xx < W && yy < H) o[yy * W + xx] = 1; } }
  return o;
}

export function quitarMotas(p, v){
  const { W, H, R, G, B, Y } = p, { motas, mascara } = detectarMotas(p, v);
  if(!motas) return { motas: 0, mascara };
  const peso = new Float32Array(W * H); for(let i = 0; i < peso.length; i++) peso[i] = 1 - Math.min(1, mascara[i] * 1.5);
  const sg = Math.max(3, (v.tamano || 24) * 0.6), fr = gaussMasked(R, peso, W, H, sg), fg = gaussMasked(G, peso, W, H, sg), fb = gaussMasked(B, peso, W, H, sg);
  for(let i = 0; i < W * H; i++){ const m = Math.min(1, mascara[i] * 1.5); if(m <= 0) continue; R[i] += m * (fr[i] - R[i]); G[i] += m * (fg[i] - G[i]); B[i] += m * (fb[i] - B[i]); Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i]; }
  return { motas, mascara };
}
