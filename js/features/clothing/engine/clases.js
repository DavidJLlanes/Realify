/* ═══════════════════════════════════════════════════════════════
   ROPA · CLASES DE COLOR DE LA PRENDA (puro, sin DOM)
   Reparte los píxeles de la máscara en 1 a 4 clases por color (k-medias sobre la cromaticidad en luz lineal; las clases con centros casi
   iguales se funden). Una prenda lisa queda en una clase; una con rayas o estampado tiene una por tinta. Así, al aplanar pliegues, la luz
   de cada tinta se promedia sólo con su misma tinta y la raya no se mezcla con la tela. Entradas: planos y máscara 0-1.
   Salida: lista de máscaras Float32Array (la suma es la máscara original).
   ═══════════════════════════════════════════════════════════════ */
const MAX = 4, FUNDIR = 0.14;

export function clasesColor(p, mask){
  const { R, B, Y } = p, n = mask.length, rg = new Float32Array(n), bg = new Float32Array(n), idx = [];
  for(let i = 0; i < n; i++) if(mask[i] > 0.5){ const y = Y[i] + 1e-4; rg[i] = Math.log((R[i] + 1e-4) / y); bg[i] = Math.log((B[i] + 1e-4) / y); idx.push(i); }
  if(idx.length < 50) return [mask];
  const paso = Math.max(1, idx.length / 4000 | 0);
  let cen = [];                                                  // centros iniciales: el primero, y los más lejanos (farthest-first)
  const dist = (i, c) => Math.hypot(rg[i] - c[0], bg[i] - c[1]);
  cen.push([rg[idx[0]], bg[idx[0]]]);
  while(cen.length < MAX){
    let mejor = -1, d = FUNDIR;
    for(let k = 0; k < idx.length; k += paso){ const m = Math.min(...cen.map(c => dist(idx[k], c))); if(m > d){ d = m; mejor = idx[k]; } }
    if(mejor < 0) break; cen.push([rg[mejor], bg[mejor]]);
  }
  if(cen.length === 1) return [mask];
  for(let it = 0; it < 6; it++){
    const s = cen.map(() => [0, 0, 0]);
    for(let k = 0; k < idx.length; k += paso){ const i = idx[k]; let b = 0, d = 1e9; for(let c = 0; c < cen.length; c++){ const e = dist(i, cen[c]); if(e < d){ d = e; b = c; } } s[b][0] += rg[i]; s[b][1] += bg[i]; s[b][2]++; }
    cen = cen.map((c, j) => s[j][2] ? [s[j][0] / s[j][2], s[j][1] / s[j][2]] : c);
  }
  const out = cen.map(() => new Float32Array(n));
  for(const i of idx){ let b = 0, d = 1e9; for(let c = 0; c < cen.length; c++){ const e = dist(i, cen[c]); if(e < d){ d = e; b = c; } } out[b][i] = mask[i]; }
  for(let i = 0; i < n; i++) if(mask[i] > 0 && mask[i] <= 0.5) out[0][i] = mask[i];       // borde suave: a la primera clase
  return out;
}
