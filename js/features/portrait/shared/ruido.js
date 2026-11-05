/* ═══════════════════════════════════════════════════════════════
   RETRATO · RUIDO DETERMINISTA DE BANDA LIMITADA (puro, sin DOM)
   Ruido gaussiano reproducible (misma semilla → mismo resultado) filtrado a un tamaño de grano y normalizado a desviación 1. Lo usan la
   textura de piel y las zonas lisas del realismo. Entradas: ancho, alto, sigma del grano en píxeles y semilla. Salida: Float32Array.
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "./blur.js";
import { hash } from "../../ai-kit/float.js";

export function ruido(W, H, sigma, semilla){
  const r = new Float32Array(W * H);
  for(let i = 0; i < r.length; i++){ const u = hash(i + semilla * 7919), v = hash(i * 3 + semilla * 104729 + 1); r[i] = Math.sqrt(-2 * Math.log(u + 1e-9)) * Math.cos(6.2832 * v); }
  const g = gauss(r, W, H, sigma); let s = 0; for(let i = 0; i < g.length; i++) s += g[i] * g[i];
  const k = 1 / Math.sqrt(s / g.length + 1e-12); for(let i = 0; i < g.length; i++) g[i] *= k;
  return g;
}
