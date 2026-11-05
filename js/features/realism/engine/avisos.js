/* ═══════════════════════════════════════════════════════════════
   REALISMO · AVISOS DE MANOS Y DIENTES SOSPECHOSOS (puro, sin DOM)
   Sólo AVISA, nunca corrige. Manos: con los 21 puntos de cada mano (en 3D) mira la longitud de cada dedo frente a la palma, que no
   haya dedos muy distintos entre sí, que los nudillos estén repartidos con regularidad y que ninguna articulación se doble de forma
   imposible. Dientes: con la boca abierta cuenta las separaciones entre dientes a lo largo de la fila superior. Son indicios, no pruebas.
   Entradas: puntos de la mano ([x,y,z]×21); luminancia 0-1 (Float32, ancho, alto) y los 478 puntos de la cara. Salida: lista de avisos
   { codigo, texto, valor }.
   ═══════════════════════════════════════════════════════════════ */

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
const DEDOS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const NOM = ["pulgar", "índice", "corazón", "anular", "meñique"];
const cadena = (pt, d) => d3(pt[d[0]], pt[d[1]]) + d3(pt[d[1]], pt[d[2]]) + d3(pt[d[2]], pt[d[3]]);

export function revisarMano(pt){
  const av = [];
  if(!pt || pt.length < 21) return av;
  const palma = d3(pt[0], pt[9]); if(palma < 8) return av;
  const L = DEDOS.map(d => cadena(pt, d) / palma);
  for(let k = 1; k < 5; k++) if(L[k] > 1.35) av.push({ codigo: "dedo-largo", valor: L[k], texto: `El dedo ${NOM[k]} es muy largo frente a la palma (×${L[k].toFixed(2)}).` });
  if(L[1] > 0 && (L[3] / L[1] < 0.62 || L[3] / L[1] > 1.55)) av.push({ codigo: "dedos-desiguales", valor: L[3] / L[1], texto: "El índice y el anular tienen longitudes muy distintas." });
  if(L[0] < 0.3 || L[0] > 1.4) av.push({ codigo: "pulgar", valor: L[0], texto: "El pulgar tiene una proporción poco habitual." });
  const g = [5, 9, 13, 17].slice(1).map((m, i) => d3(pt[[5, 9, 13, 17][i]], pt[m]));
  if(Math.max(...g) / Math.max(1e-6, Math.min(...g)) > 2.4) av.push({ codigo: "nudillos", valor: Math.max(...g) / Math.min(...g), texto: "Los nudillos están repartidos de forma irregular." });
  DEDOS.forEach((d, k) => {
    for(let j = 0; j < 2; j++){
      const a = [pt[d[j + 1]][0] - pt[d[j]][0], pt[d[j + 1]][1] - pt[d[j]][1], (pt[d[j + 1]][2] || 0) - (pt[d[j]][2] || 0)];
      const b = [pt[d[j + 2]][0] - pt[d[j + 1]][0], pt[d[j + 2]][1] - pt[d[j + 1]][1], (pt[d[j + 2]][2] || 0) - (pt[d[j + 1]][2] || 0)];
      const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) + 1e-9);
      if(c < -0.5){ av.push({ codigo: "articulacion", valor: c, texto: `El dedo ${NOM[k]} se dobla de una forma poco natural.` }); return; }
    }
  });
  return av;
}

const SUP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];

/** Separaciones entre dientes a lo largo de la fila superior (boca abierta). Devuelve { abierta, separaciones } o null si no se puede medir. */
export function contarDientes(L, W, H, pts){
  const c0 = pts[78], c1 = pts[308], u = pts[13], l = pts[14];
  if(!c0 || !c1 || !u || !l) return null;
  const ancho = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), abre = Math.hypot(l[0] - u[0], l[1] - u[1]);
  if(ancho < 40) return null;
  if(abre / ancho < 0.12) return { abierta: false, separaciones: 0 };
  const mx = (c0[0] + c1[0]) / 2, my = (c0[1] + c1[1]) / 2, vx = u[0] - mx + (l[0] - u[0]) * 0.3, vy = u[1] - my + (l[1] - u[1]) * 0.3;
  const N = Math.round(ancho), prof = new Float32Array(N);
  for(let i = 0; i < N; i++){
    const t = 0.12 + 0.76 * i / (N - 1), x = Math.round(c0[0] + (c1[0] - c0[0]) * t + vx), y = Math.round(c0[1] + (c1[1] - c0[1]) * t + vy);
    prof[i] = x >= 0 && y >= 0 && x < W && y < H ? L[y * W + x] : 0;
  }
  const suave = (a, r) => a.map((_, i) => { let s = 0, n = 0; for(let k = Math.max(0, i - r); k <= Math.min(a.length - 1, i + r); k++){ s += a[k]; n++; } return s / n; });
  const p = suave(Array.from(prof), Math.max(1, Math.round(N / 200))), m = suave(p, Math.round(N / 8)), sep = N / 40;
  let n = 0, ult = -1e9;
  for(let i = 1; i < N - 1; i++) if(p[i] < p[i - 1] && p[i] <= p[i + 1] && m[i] - p[i] > 0.05 && i - ult >= sep){ n++; ult = i; }
  return { abierta: true, separaciones: n };
}

export function revisarDientes(L, W, H, pts){
  const r = contarDientes(L, W, H, pts), av = [];
  if(r && r.abierta && r.separaciones > 12) av.push({ codigo: "dientes", valor: r.separaciones, texto: `Se cuentan ${r.separaciones} separaciones en la fila de dientes: puede haber más dientes de los normales.` });
  return av;
}
