/* ═══════════════════════════════════════════════════════════════
   CABELLO · MOTOR (puro, sin DOM)
   Sobre la máscara del pelo (modelo de partes refinado con filtro guiado): TONO (gira el color en el plano a-b de OKLab), SATURACIÓN,
   LUZ, BRILLO (sube los reflejos del pelo, no las sombras) y VOLUMEN (contraste local suave a escala de mechón). El tono no toca la
   luminosidad, así que las sombras y mechones se conservan. Entradas: ctx { W, H, R, G, B, Y, F, mascaras.pelo } y { pelo_tono -180..180,
   pelo_sat -100..100, pelo_luz -50..50, pelo_brillo 0-100, pelo_volumen 0-100 }. Salida: modifica ctx.R/G/B en sitio.
   ═══════════════════════════════════════════════════════════════ */
import { oklab, linear } from "../../ai-kit/oklab.js";
import { gauss, smoothstep } from "../shared/blur.js";
import { channels, luma } from "../shared/planes.js";

export function stage(ctx, p){
  const tono = (p.pelo_tono ?? 0) * Math.PI / 180, sat = (p.pelo_sat ?? 0) / 100, luz = (p.pelo_luz ?? 0) / 100, br = (p.pelo_brillo ?? 0) / 100, vol = (p.pelo_volumen ?? 0) / 100;
  const m = ctx.mascaras && ctx.mascaras.pelo; if(!m || (!tono && !sat && !luz && br <= 0 && vol <= 0)) return;
  const { W, H } = ctx, n = W * H, [R, G, B] = channels(ctx), lab = new Float32Array(3), rgb = new Float32Array(3);
  const baja = vol > 0 ? channels(ctx).map(c => gauss(c, W, H, Math.max(2, ctx.F * 0.03))) : null, ct = Math.cos(tono), st = Math.sin(tono);
  for(let i = 0; i < n; i++){
    const w = m[i]; if(w < 0.01) continue;
    let r = R[i], g = G[i], b = B[i];
    if(vol > 0){ const k = vol * smoothstep(0.35, 0.9, w) * 0.9;                   // el volumen no llega al borde del pelo (sin halo sobre el fondo)
       r += (r - baja[0][i]) * k; g += (g - baja[1][i]) * k; b += (b - baja[2][i]) * k; }
    oklab(Math.max(0, r), Math.max(0, g), Math.max(0, b), lab);
    let a = lab[1], bb = lab[2]; const croma = Math.hypot(a, bb);
    if(tono || sat){
      const base = croma < 0.015 ? [0.012, 0.008] : [a, bb];                // pelo casi gris: se parte de un tono cálido suave
      const a2 = base[0] * ct - base[1] * st, b2 = base[0] * st + base[1] * ct, h = Math.hypot(a2, b2), c = h * (sat >= 0 ? 1 + 1.6 * sat : 1 + sat);
      const f = h > 1e-6 ? c / h : 0;
      a += (a2 * f - a) * w; bb += (b2 * f - bb) * w;
    }
    lab[0] = Math.max(0, lab[0] + luz * 0.25 * w + br * 0.3 * w * smoothstep(0.45, 0.85, lab[0]));
    linear(lab[0], a, bb, rgb); R[i] = Math.max(0, rgb[0]); G[i] = Math.max(0, rgb[1]); B[i] = Math.max(0, rgb[2]);
  }
  luma(ctx);
}
