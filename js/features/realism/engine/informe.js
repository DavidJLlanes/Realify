/* ═══════════════════════════════════════════════════════════════
   REALISMO · MEDIDAS PARA EL INFORME (puro, sin DOM)
   Nitidez (varianza del laplaciano, en luminancia de 0-255), ruido (mediana de la desviación local en bloques lisos), rango dinámico
   (pasos entre el percentil 0,5 y el 99,5 en luz lineal) y luces/sombras recortadas. Se miden sobre una copia de ≤ 1024 px de lado.
   Entradas: RGBA 8 bits, ancho, alto. Salida: { nitidez, ruido, pasos, quemado, negro } y juicio(m) → lista de {clave, nivel, texto}.
   ═══════════════════════════════════════════════════════════════ */

export function medir(rgba, W, H){
  const n = W * H, Y = new Float32Array(n), lin = new Float32Array(n);
  for(let i = 0; i < n; i++){ const y = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]; Y[i] = y; const v = y / 255; lin[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
  let s = 0, s2 = 0, c = 0;
  for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){ const i = y * W + x, l = Y[i - 1] + Y[i + 1] + Y[i - W] + Y[i + W] - 4 * Y[i]; s += l; s2 += l * l; c++; }
  const nitidez = c ? s2 / c - (s / c) ** 2 : 0, sd = [];
  for(let by = 0; by + 8 <= H; by += 8) for(let bx = 0; bx + 8 <= W; bx += 8){
    let a = 0, b = 0;
    for(let y = 0; y < 8; y++) for(let x = 0; x < 8; x++){ const v = Y[(by + y) * W + bx + x]; a += v; b += v * v; }
    const m = a / 64; if(m < 20 || m > 235) continue;
    sd.push(Math.sqrt(Math.max(0, b / 64 - m * m)));
  }
  sd.sort((p, q) => p - q);
  const ruido = sd.length ? sd[Math.floor(sd.length * 0.1)] : 0, ord = Float32Array.from(lin).sort();
  const p0 = Math.max(ord[Math.floor(n * 0.005)], 1e-4), p1 = Math.max(ord[Math.floor(n * 0.995)], 2e-4);
  let q = 0, k = 0; for(let i = 0; i < n; i++){ if(Y[i] >= 253) q++; if(Y[i] <= 2) k++; }
  return { nitidez, ruido, pasos: Math.log2(p1 / p0), quemado: q / n, negro: k / n };
}

export function juicio(m){
  const L = [];
  L.push({ clave: "nitidez", nivel: m.nitidez < 15 ? "aviso" : "ok", texto: `Nitidez ${m.nitidez < 15 ? "baja (foto blanda o muy suavizada)" : m.nitidez > 600 ? "alta" : "normal"} · laplaciano ${m.nitidez.toFixed(0)}` });
  L.push({ clave: "ruido", nivel: m.ruido < 0.6 ? "aviso" : "ok", texto: m.ruido < 0.6 ? `Ruido casi nulo (σ ${m.ruido.toFixed(2)}): un sensor real deja algo de grano, es típico de imágenes generadas.` : `Ruido de sensor presente (σ ${m.ruido.toFixed(2)}).` });
  L.push({ clave: "rango", nivel: m.pasos < 5 || m.pasos > 15 ? "aviso" : "ok", texto: `Rango dinámico de ${m.pasos.toFixed(1)} pasos` + (m.pasos < 5 ? " (muy plano)" : m.pasos > 15 ? " (poco creíble)" : "") });
  L.push({ clave: "recortes", nivel: m.quemado > 0.03 || m.negro > 0.05 ? "aviso" : "ok", texto: `Luces recortadas ${(m.quemado * 100).toFixed(1)} % · sombras recortadas ${(m.negro * 100).toFixed(1)} %` });
  return L;
}
