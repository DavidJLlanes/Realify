/* ═══════════════════════════════════════════════════════════════
   basic · local-contrast-engine (motor de píxeles, sin DOM)
   Contraste local sobre la luminancia, COMPARTIDO por «Detalle y estructura» de Realify Pro y la «Definición» de Realify Basic.
   Filtro guiado (He et al.) como base que respeta los bordes (sin halos ni niebla), dos franjas (estructura ancha y detalle fino)
   y peso de medios tonos (no quema luces ni empasta sombras). Los radios salen del lado corto de la imagen.
   Entradas: claridadPixeles(data RGBA, w, h, { structure −100..100, detail −100..100 }); guidedBase(L, w, h, r, eps).
   Salidas: nada (modifica data). Límites: sin DOM; el color no se desplaza (se suma el mismo delta a R, G y B).
   ═══════════════════════════════════════════════════════════════ */
import { boxBlurFloat } from "../../../editor/selection/refineedge-math.js";

/* Suavizado que respeta los bordes: filtro guiado (He et al.) con la
   propia luminancia como guía. Dentro de una zona lisa promedia como
   un desenfoque de caja; en un borde fuerte —varianza local muy por
   encima de `eps`— devuelve casi el valor original. Es justo lo que
   hace falta como «base» para separar el contraste local del resto:
   restando un desenfoque normal, el borde entre un cielo claro y una
   silueta oscura aparecía como diferencia enorme y se amplificaba en
   un halo blanco (o, en negativo, en una niebla oscura), que es el
   defecto que tenía la versión anterior de «Detalle y estructura». */
export function guidedBase(L, w, h, r, eps){
  const n = w * h, LL = new Float32Array(n);
  for(let i = 0; i < n; i++) LL[i] = L[i] * L[i];
  const mean = boxBlurFloat(L, w, h, r), corr = boxBlurFloat(LL, w, h, r);
  const a = new Float32Array(n), b = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const v = corr[i] - mean[i] * mean[i];
    a[i] = v / (v + eps);
    b[i] = mean[i] - a[i] * mean[i];
  }
  const ma = boxBlurFloat(a, w, h, r), mb = boxBlurFloat(b, w, h, r);
  const out = new Float32Array(n);
  for(let i = 0; i < n; i++) out[i] = ma[i] * L[i] + mb[i];
  return out;
}

export function claridadPixeles(d, w, h, { structure = 0, detail = 0 } = {}){
  if(!structure && !detail) return;
  const n = w * h, L = new Float32Array(n);
  for(let i = 0, j = 0; j < n; i += 4, j++) L[j] = (0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]) / 255;
  const side = Math.min(w, h), out = Float32Array.from(L);
  if(structure){
    const base = guidedBase(L, w, h, Math.max(2, Math.round(side * 0.02)), 0.006);
    const k = structure > 0 ? structure / 100 * 1.6 : structure / 100;
    for(let j = 0; j < n; j++) out[j] += (L[j] - base[j]) * k;
  }
  if(detail){
    const base = guidedBase(L, w, h, Math.max(1, Math.round(side * 0.0018)), 0.0015);
    const k = detail > 0 ? detail / 100 * 2 : detail / 100;
    for(let j = 0; j < n; j++) out[j] += (L[j] - base[j]) * k;
  }
  for(let i = 0, j = 0; j < n; i += 4, j++){
    const l = L[j], delta = (out[j] - l) * (1 - Math.pow(2 * l - 1, 4)) * 255;    // peso de medios tonos
    if(!delta) continue;
    for(let c = 0; c < 3; c++){ const v = d[i+c] + delta; d[i+c] = v < 0 ? 0 : v > 255 ? 255 : v; }
  }
}
