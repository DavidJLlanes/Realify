/* ═══════════════════════════════════════════════════════════════
   IMPERFECCIONES Y TONO · MOTOR (puro, sin DOM)
   Dos pasos sobre la piel: (1) tono: acerca la CROMA local (rojeces, manchas) a la de la piel de alrededor sin tocar la luminancia ni
   las sombras; (2) imperfecciones: detecta puntos pequeños y oscuros o rojos (acné, granos) con una diferencia de gaussianas y los
   rellena con la piel de alrededor, conservando la textura fina. Entradas: ctx { W, H, R, G, B, Y, F, piel } y { tono_int, imperf_int }.
   Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { gauss, gaussMasked, smoothstep } from "../shared/blur.js";
import { sqrtPlane, channels, luma } from "../shared/planes.js";

function tono(ctx, int){
  const { W, H } = ctx, n = W * H, eps = 1e-4;
  const cR = new Float32Array(n), cB = new Float32Array(n);
  for(let i = 0; i < n; i++){ const y = Math.max(ctx.Y[i], eps); cR[i] = ctx.R[i] / y; cB[i] = ctx.B[i] / y; }
  const sR = gaussMasked(cR, ctx.piel, W, H, ctx.F * 0.012), sB = gaussMasked(cB, ctx.piel, W, H, ctx.F * 0.012);
  const rR = gaussMasked(cR, ctx.piel, W, H, ctx.F * 0.09), rB = gaussMasked(cB, ctx.piel, W, H, ctx.F * 0.09);
  for(let i = 0; i < n; i++){
    if(ctx.piel[i] < 0.02) continue;
    const dR = sR[i] - rR[i], dB = sB[i] - rB[i];
    const w = int * ctx.piel[i] * Math.exp(-((dR * dR + dB * dB) / (0.35 * rR[i]) ** 2));      // las desviaciones enormes (sombras, labios) no se tocan
    const R = (cR[i] - w * dR) * ctx.Y[i], B = (cB[i] - w * dB) * ctx.Y[i];
    ctx.R[i] = Math.max(0, R); ctx.B[i] = Math.max(0, B);
    ctx.G[i] = Math.max(0, (ctx.Y[i] - 0.2126 * ctx.R[i] - 0.0722 * ctx.B[i]) / 0.7152);
  }
}

function imperfecciones(ctx, int){
  const { W, H } = ctx, n = W * H, P = sqrtPlane(ctx.Y);
  const a = gauss(P, W, H, Math.max(0.8, ctx.F * 0.004)), b = gauss(P, W, H, ctx.F * 0.03);
  const m = new Float32Array(n);
  for(let i = 0; i < n; i++) m[i] = ctx.piel[i] < 0.05 ? 0 : smoothstep(0.03, 0.07, b[i] - a[i]);   // puntos más oscuros que su entorno
  const libre = new Float32Array(n); for(let i = 0; i < n; i++) libre[i] = ctx.piel[i] * (1 - m[i]);
  for(const ch of channels(ctx)){
    const fino = gauss(ch, W, H, Math.max(0.8, ctx.F * 0.004)), cerca = gaussMasked(ch, libre, W, H, ctx.F * 0.02);
    for(let i = 0; i < n; i++) if(m[i] > 0.01) ch[i] = Math.max(0, ch[i] + int * m[i] * (cerca[i] - fino[i]));
  }
}

export function stage(ctx, p){
  const t = (p.tono_int ?? 0) / 100, im = (p.imperf_int ?? 0) / 100;
  if(t > 0){ tono(ctx, t); }
  if(im > 0){ imperfecciones(ctx, im); }
  luma(ctx);
}
