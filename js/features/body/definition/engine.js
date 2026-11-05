/* ═══════════════════════════════════════════════════════════════
   CUERPO · DEFINICIÓN Y PIEL DEL CUERPO (puro, sin DOM)
   Trabaja sobre planos en luz lineal (los de portrait/shared/planes.js) y una máscara de piel del cuerpo (sin cara ni pelo). NO genera
   piel ni músculos: sólo realza la luz y la sombra que la foto ya tiene (relieve), o suaviza, uniformiza y broncea la piel que hay.
     · Tono (0-20): contraste local de la luminosidad a escala media (luz y sombra con relieve).
     · Musculatura (0-20): realza las sombras entre zonas (escala fina), algo menos las luces.
     · Suavizar (0-100): mezcla con un desenfoque de la piel conservando parte del detalle.  · Uniformar (0-100): iguala el color (OKLab).
     · Bronceado (0-100): oscurece y calienta la piel en OKLab.
   Entradas: ctx { W, H, R, G, B, Y, piel (Float32 0-1), F (tamaño de referencia en px) } y valores. Salida: modifica ctx. Sólo adultos
   (el perfil infantil no tiene definición ni suavizar ni bronceado: sanitize no los deja llegar).
   ═══════════════════════════════════════════════════════════════ */
import { gauss } from "../../portrait/shared/blur.js";
import { oklab, linear } from "../../ai-kit/oklab.js";

const logY = Y => { const o = new Float32Array(Y.length); for(let i = 0; i < o.length; i++) o[i] = Math.log(Math.max(1e-4, Y[i])); return o; };
function gananciaPorLuz(ctx, k, sigma, sombras, luces){
  const { W, H, R, G, B, Y, piel } = ctx, L = logY(Y), b = gauss(L, W, H, sigma);
  for(let i = 0; i < Y.length; i++){
    if(piel[i] < 0.01) continue;
    const d = L[i] - b[i], g = Math.exp(k * (d < 0 ? sombras : luces) * d * piel[i]);
    R[i] *= g; G[i] *= g; B[i] *= g;
  }
}

export function stage(ctx, v){
  const { W, H, R, G, B, piel, F } = ctx, n = W * H;
  if(v.tono > 0)    gananciaPorLuz(ctx, 0.9 * v.tono / 20, Math.max(2, F * 0.05), 1, 1);
  if(v.musculo > 0) gananciaPorLuz(ctx, 0.9 * v.musculo / 20, Math.max(1.5, F * 0.018), 1.4, 0.5);
  if(v.pielSuavizar > 0){
    const t = v.pielSuavizar / 100 * 0.7, r = gauss(R, W, H, Math.max(1.2, F * 0.012)), g = gauss(G, W, H, Math.max(1.2, F * 0.012)), b = gauss(B, W, H, Math.max(1.2, F * 0.012));
    for(let i = 0; i < n; i++){ const w = piel[i] * t; R[i] += (r[i] - R[i]) * w; G[i] += (g[i] - G[i]) * w; B[i] += (b[i] - B[i]) * w; }
  }
  if(v.pielUniformar > 0 || v.bronceado > 0){
    const lab = new Float32Array(3), a = new Float32Array(n), bb = new Float32Array(n), L = new Float32Array(n);
    for(let i = 0; i < n; i++){ oklab(R[i], G[i], B[i], lab); L[i] = lab[0]; a[i] = lab[1]; bb[i] = lab[2]; }
    const sa = v.pielUniformar > 0 ? gauss(a, W, H, Math.max(4, F * 0.15)) : a, sb = v.pielUniformar > 0 ? gauss(bb, W, H, Math.max(4, F * 0.15)) : bb;
    const u = (v.pielUniformar || 0) / 100 * 0.8, br = (v.bronceado || 0) / 100, out = new Float32Array(3);
    for(let i = 0; i < n; i++){
      const w = piel[i]; if(w < 0.01) continue;
      const A = a[i] + (sa[i] - a[i]) * u * w + 0.012 * br * w, Bv = bb[i] + (sb[i] - bb[i]) * u * w + 0.02 * br * w;
      linear(L[i] * (1 - 0.1 * br * w), A, Bv, out);
      R[i] = Math.max(0, out[0]); G[i] = Math.max(0, out[1]); B[i] = Math.max(0, out[2]);
    }
  }
}
