/* ═══════════════════════════════════════════════════════════════
   LABIOS Y CEJAS · MOTOR (puro, sin DOM)
   Labios: color (croma y tono hacia el rojo) y definición (contraste local) en OKLab sobre la máscara de los labios. Cejas: oscurecer y dar
   más color, y rellenar huecos acercando los píxeles claros de dentro de la ceja al color de la ceja. Entradas: ctx { W, H, R, G, B, Y, F,
   zonas } y { labios_int -100..100, labios_def 0-100, cejas_int 0-100, cejas_huecos 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { oklab, linear } from "../../ai-kit/oklab.js";
import { gauss, smoothstep } from "../shared/blur.js";
import { channels, luma } from "../shared/planes.js";

function colorCeja(ctx, lab){
  const n = ctx.W * ctx.H, v = [], m = ctx.zonas.cejas;
  for(let i = 0; i < n; i++) if(m[i] > 0.6){ oklab(ctx.R[i], ctx.G[i], ctx.B[i], lab); v.push([lab[0], lab[1], lab[2]]); }
  if(v.length < 10) return null;
  v.sort((a, b) => a[0] - b[0]); const mitad = v.slice(0, Math.max(5, v.length >> 1));
  return [0, 1, 2].map(k => mitad.reduce((s, q) => s + q[k], 0) / mitad.length);
}

export function stage(ctx, p){
  const li = (p.labios_int ?? 0) / 100, ld = (p.labios_def ?? 0) / 100, ci = (p.cejas_int ?? 0) / 100, ch = (p.cejas_huecos ?? 0) / 100;
  if(!li && ld <= 0 && ci <= 0 && ch <= 0) return;
  const { W, H } = ctx, n = W * H, [R, G, B] = channels(ctx), lab = new Float32Array(3), rgb = new Float32Array(3), lm = ctx.zonas.labios, cm = ctx.zonas.cejas;
  const baja = ld > 0 ? gauss(ctx.Y, W, H, Math.max(1.5, ctx.F * 0.025)) : null;
  const cc = ch > 0 || ci > 0 ? colorCeja(ctx, lab) : null;
  for(let i = 0; i < n; i++){
    const wl = lm[i], wc = cm[i]; if(wl < 0.01 && wc < 0.01) continue;
    let r = R[i], g = G[i], b = B[i];
    if(wl > 0.01 && (li || ld > 0)){
      oklab(r, g, b, lab);
      if(li){ const c = 1 + li * 0.7 * wl; lab[1] = lab[1] * c + (li > 0 ? 0.02 * li * wl : 0); lab[2] = lab[2] * (1 + (c - 1) * 0.6); }
      if(ld > 0 && baja[i] > 1e-4){ const y = ctx.Y[i] / baja[i]; lab[0] = Math.max(0, lab[0] * (1 + (y - 1) * ld * wl * 0.8)); }
      linear(lab[0], lab[1], lab[2], rgb); r = rgb[0]; g = rgb[1]; b = rgb[2];
    }
    if(wc > 0.01 && cc){
      oklab(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab);
      const d = lab[0] - cc[0], pelo = 1 - smoothstep(0.1, 0.2, d);            // lo muy claro es piel, no un hueco: ni se rellena ni se oscurece
      if(ch > 0){ const hueco = smoothstep(0.015, 0.06, d) * pelo * ch * wc; lab[0] += (cc[0] - lab[0]) * hueco; lab[1] += (cc[1] - lab[1]) * hueco; lab[2] += (cc[2] - lab[2]) * hueco; }
      if(ci > 0){ const k = ci * wc * pelo; lab[0] *= 1 - 0.35 * k; lab[1] *= 1 + 0.4 * k; lab[2] *= 1 + 0.4 * k; }
      linear(lab[0], lab[1], lab[2], rgb); r = rgb[0]; g = rgb[1]; b = rgb[2];
    }
    R[i] = Math.max(0, r); G[i] = Math.max(0, g); B[i] = Math.max(0, b);
  }
  luma(ctx);
}
