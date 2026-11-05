/* ═══════════════════════════════════════════════════════════════
   ESCENA · BALANCE DE BLANCOS POR ZONAS (puro, sin DOM)
   Estima el iluminante de cada zona de una rejilla con «shades of gray» (norma 6, que pesa lo brillante y no se deja engañar por un objeto
   muy coloreado), lo compara con el iluminante medio de la foto y convierte la diferencia en una ganancia por canal. Las ganancias de la
   rejilla se interpolan en bilineal (sin costuras) y se aplican conservando la luminancia. Sirve para luz mezclada (ventana fría + lámpara
   cálida). Entradas: planos (se modifican), valores { fuerza 0-100, zonas 2-12 }. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
export const hayBalance = v => (v.fuerza || 0) > 0;

export function balanceZonas(p, v){
  const { W, H, R, G, B, Y } = p, g = Math.min(12, Math.max(2, Math.round(v.zonas || 4))), f = Math.min(100, Math.max(0, v.fuerza || 0)) / 100;
  if(f <= 0) return;
  const ilu = Array.from({ length: g * g }, () => [0, 0, 0, 0]);
  for(let y = 0; y < H; y++){ const zy = Math.min(g - 1, (y * g / H) | 0); for(let x = 0; x < W; x++){ const i = y * W + x; if(Y[i] < 0.003) continue; const z = ilu[zy * g + Math.min(g - 1, (x * g / W) | 0)]; z[0] += R[i] ** 6; z[1] += G[i] ** 6; z[2] += B[i] ** 6; z[3]++; } }
  const e = ilu.map(z => z[3] > 20 ? [(z[0] / z[3]) ** (1 / 6), (z[1] / z[3]) ** (1 / 6), (z[2] / z[3]) ** (1 / 6)] : null);
  const ok = e.filter(Boolean); if(!ok.length) return;
  const med = [0, 1, 2].map(c => ok.reduce((s, q) => s + q[c], 0) / ok.length), media = (med[0] + med[1] + med[2]) / 3;
  const gan = e.map(q => { if(!q) return [1, 1, 1]; const gg = [0, 1, 2].map(c => Math.min(1.6, Math.max(0.6, media / Math.max(q[c], 1e-4)))); return gg; });
  const gz = (zx, zy) => gan[Math.min(g - 1, Math.max(0, zy)) * g + Math.min(g - 1, Math.max(0, zx))];
  for(let y = 0; y < H; y++){
    const fy = (y + 0.5) * g / H - 0.5, y0 = Math.floor(fy), ty = fy - y0;
    for(let x = 0; x < W; x++){
      const fx = (x + 0.5) * g / W - 0.5, x0 = Math.floor(fx), tx = fx - x0, i = y * W + x, a = gz(x0, y0), b = gz(x0 + 1, y0), c = gz(x0, y0 + 1), d = gz(x0 + 1, y0 + 1), k = [0, 0, 0];
      for(let q = 0; q < 3; q++){ const m = (a[q] * (1 - tx) + b[q] * tx) * (1 - ty) + (c[q] * (1 - tx) + d[q] * tx) * ty; k[q] = 1 + f * (m - 1); }
      const y1 = 0.2126 * R[i] * k[0] + 0.7152 * G[i] * k[1] + 0.0722 * B[i] * k[2], s = y1 > 1e-6 ? Y[i] / y1 : 1;
      R[i] = Math.min(1, R[i] * k[0] * s); G[i] = Math.min(1, G[i] * k[1] * s); B[i] = Math.min(1, B[i] * k[2] * s);
    }
  }
  for(let i = 0; i < W * H; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
}
