/* ═══════════════════════════════════════════════════════════════
   ESTILO · TRANSFERENCIA DE COLOR Y TONO EN OKLab (puro, sin DOM)
   Mide la foto (o la de referencia) en OKLab POR ZONAS (cielo, personas, resto): media y desviación de L, a, b, croma medio y 33 cuantiles de
   L. Después lleva cada zona de la foto a las estadísticas de la misma zona de la referencia (si la referencia no la tiene, a las globales):
   el tono por emparejamiento de cuantiles (como un histograma) y el color por media y desviación, con la razón de desviaciones limitada a ×0,5-×2
   para no inventar colores. Las zonas se mezclan con pesos suaves. Las estadísticas son un objeto sencillo, así que se pueden guardar en un archivo.
   Entradas: planos { W, H, R, G, B } en luz lineal; pesos { cielo?, personas? } (Float32Array 0-1, del tamaño de los planos). Salidas:
   estadisticas() → { version, zonas, global }; transferir() modifica R, G, B en sitio; sugerir() → ajustes aproximados.
   ═══════════════════════════════════════════════════════════════ */
import { oklab, linear } from "../../ai-kit/oklab.js";

export const ZONAS = ["cielo", "personas", "resto"], NQ = 33, BINS = 1024, MIN_PESO = 0.02;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function pesosPorZona(n, pesos){
  const w = { cielo: pesos.cielo || null, personas: pesos.personas || null };
  const resto = new Float32Array(n);
  for(let i = 0; i < n; i++) resto[i] = Math.max(0, 1 - (w.cielo ? w.cielo[i] : 0) - (w.personas ? w.personas[i] : 0));
  w.resto = resto; return w;
}

function labPlanos(p){
  const n = p.W * p.H, L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n), o = new Float32Array(3);
  for(let i = 0; i < n; i++){ oklab(p.R[i], p.G[i], p.B[i], o); L[i] = o[0]; A[i] = o[1]; B[i] = o[2]; }
  return { L, A, B };
}

function medir(lab, w, n){
  let s = 0, mL = 0, mA = 0, mB = 0, cr = 0; const hist = new Float64Array(BINS);
  for(let i = 0; i < n; i++){ const k = w ? w[i] : 1; if(k <= 0) continue; s += k; mL += k * lab.L[i]; mA += k * lab.A[i]; mB += k * lab.B[i]; cr += k * Math.hypot(lab.A[i], lab.B[i]); hist[clamp(Math.floor(lab.L[i] * BINS), 0, BINS - 1)] += k; }
  if(s <= 0) return null;
  mL /= s; mA /= s; mB /= s;
  let vL = 0, vA = 0, vB = 0;
  for(let i = 0; i < n; i++){ const k = w ? w[i] : 1; if(k <= 0) continue; vL += k * (lab.L[i] - mL) ** 2; vA += k * (lab.A[i] - mA) ** 2; vB += k * (lab.B[i] - mB) ** 2; }
  const q = []; let acc = 0, j = 0;
  for(let k = 0; k < NQ; k++){ const t = s * k / (NQ - 1); while(j < BINS - 1 && acc + hist[j] < t){ acc += hist[j]; j++; } q.push(+((j + 0.5) / BINS).toFixed(4)); }
  const r = v => +v.toFixed(5);
  return { peso: r(s / n), media: [r(mL), r(mA), r(mB)], desv: [r(Math.sqrt(vL / s)), r(Math.sqrt(vA / s)), r(Math.sqrt(vB / s))], croma: r(cr / s), q };
}

export function estadisticas(p, pesos = {}){
  const n = p.W * p.H, lab = labPlanos(p), w = pesosPorZona(n, pesos), zonas = {};
  for(const z of ZONAS){ if(!w[z]) continue; const m = medir(lab, w[z], n); if(m && m.peso >= MIN_PESO) zonas[z] = m; }
  return { version: 1, zonas, global: medir(lab, null, n) };
}

/** Tabla L → L de la referencia por cuantiles (BINS entradas). */
function tablaTono(src, ref){
  const lut = new Float32Array(BINS);
  for(let b = 0; b < BINS; b++){
    const L = (b + 0.5) / BINS; let k = 1; while(k < NQ - 1 && src.q[k] < L) k++;
    const a = src.q[k - 1], c = src.q[k], t = c > a ? clamp((L - a) / (c - a), 0, 1) : 0, u = (k - 1 + t) / (NQ - 1);
    const f = u * (NQ - 1), i0 = Math.min(NQ - 2, Math.floor(f)), r = f - i0;
    lut[b] = ref.q[i0] + (ref.q[i0 + 1] - ref.q[i0]) * r;
  }
  return lut;
}

export function transferir(p, ref, pesos = {}, { fuerza = 80, tono = 100, color = 100 } = {}){
  const n = p.W * p.H, mine = estadisticas(p, pesos), lab = labPlanos(p), w = pesosPorZona(n, pesos), tt = tono / 100, cc = color / 100, ff = fuerza / 100;
  const zs = Object.keys(mine.zonas).map(z => {
    const s = mine.zonas[z], r = ref.zonas[z] || ref.global;
    return { z, s, r, lut: tablaTono(s, r), ra: clamp(r.desv[1] / Math.max(1e-4, s.desv[1]), 0.5, 2), rb: clamp(r.desv[2] / Math.max(1e-4, s.desv[2]), 0.5, 2) };
  });
  const o = new Float32Array(3);
  for(let i = 0; i < n; i++){
    let sw = 0, tl = 0, ta = 0, tb = 0; const L = lab.L[i], a = lab.A[i], b = lab.B[i];
    for(const Z of zs){
      const k = w[Z.z][i]; if(k <= 0) continue;
      const Lr = Z.lut[clamp(Math.floor(L * BINS), 0, BINS - 1)];
      tl += k * (L + (Lr - L) * tt);
      ta += k * (a + ((a - Z.s.media[1]) * Z.ra + Z.r.media[1] - a) * cc);
      tb += k * (b + ((b - Z.s.media[2]) * Z.rb + Z.r.media[2] - b) * cc);
      sw += k;
    }
    if(sw <= 0) continue;
    const L2 = L + (tl / sw - L) * ff, a2 = a + (ta / sw - a) * ff, b2 = b + (tb / sw - b) * ff;
    linear(L2, a2, b2, o);
    p.R[i] = Math.max(0, o[0]); p.G[i] = Math.max(0, o[1]); p.B[i] = Math.max(0, o[2]);
  }
}

/** Ajustes aproximados que acercan la foto a la referencia (con las estadísticas globales). */
export function sugerir(mine, ref){
  const s = mine.global, r = ref.global;
  const ev = 3 * Math.log2(Math.max(0.05, r.media[0]) / Math.max(0.05, s.media[0]));
  return {
    exposicion: +clamp(ev, -3, 3).toFixed(2),
    contraste: Math.round(clamp((r.desv[0] / Math.max(1e-4, s.desv[0]) - 1) * 100, -60, 60)),
    calidez: Math.round(clamp((r.media[2] - s.media[2]) * 500, -100, 100)),
    tinte: Math.round(clamp((r.media[1] - s.media[1]) * 500, -100, 100)),
    saturacion: Math.round(clamp((r.croma / Math.max(1e-4, s.croma) - 1) * 100, -80, 80))
  };
}
