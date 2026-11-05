/* ═════════════════════════════════════════════════
   PRUEBA · motores de escena, cielo y color (Node, sin navegador)
   Escenas sintéticas con la respuesta conocida: neblina, cielo, realce por tipo, balance por zonas, luces quemadas, unificar iluminación,
   aberración cromática con la distancia y luz con relieve. Uso: node tests/ia/escena/motor.mjs
   ═════════════════════════════════════════════════ */
import { mejorarCielo, quitarNeblina, realzarTipo, balanceZonas, recuperarLuces, armonizar, cromaProfundidad, luzRelieve } from "../../../js/features/scene/engine/index.js";
import { oklab } from "../../../js/features/ai-kit/oklab.js";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const W = 200, H = 150, n = W * H;
const nuevo = () => ({ W, H, R: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n), Y: new Float32Array(n) });
const fijaY = p => { for (let i = 0; i < n; i++) p.Y[i] = 0.2126 * p.R[i] + 0.7152 * p.G[i] + 0.0722 * p.B[i]; return p; };
const copia = p => ({ W, H, R: Float32Array.from(p.R), G: Float32Array.from(p.G), B: Float32Array.from(p.B), Y: Float32Array.from(p.Y) });
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const std = (a, x0 = 0, x1 = W, y0 = 0, y1 = H) => { let s = 0, s2 = 0, c = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = a[y * W + x]; s += v; s2 += v * v; c++; } const m = s / c; return Math.sqrt(Math.max(0, s2 / c - m * m)); };
const media = (a, x0, x1, y0, y1) => { let s = 0, c = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += a[y * W + x]; c++; } return s / c; };
const sinCambio = (a, b, mask) => { let d = 0; for (let i = 0; i < n; i++) if (!mask || mask[i] === 0) d += Math.abs(a.R[i] - b.R[i]) + Math.abs(a.G[i] - b.G[i]) + Math.abs(a.B[i] - b.B[i]); return d; };

/* 0 · una foto SIN neblina (contrastada, con negros y paredes claras) casi no cambia con la fuerza por defecto (fallo visto con una foto real) */
{
  const p = nuevo(), d = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, muro = x < W * 0.6 && y < H * 0.6, v = muro ? 0.75 + 0.1 * rnd() : 0.01 + 0.03 * rnd(); p.R[i] = v; p.G[i] = v * 0.97; p.B[i] = v * 0.9; d[i] = 1 - y / H; } fijaY(p);
  const o = copia(p); quitarNeblina(p, d, { fuerza: 60, profundidad: 50 });
  const cambio = sinCambio(p, o) / (3 * n); console.log(`neblina (foto sin neblina): cambio medio ${cambio.toFixed(4)}`);
  ok(cambio < 0.02, "quita «neblina» que no existe: cambio medio " + cambio.toFixed(4));
}

/* 1 · neblina con profundidad */
{
  const J = nuevo(), d = new Float32Array(n), A = 0.85;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, v = 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(x / 6) * Math.sin(y / 5)) + 0.05 * rnd(); J.R[i] = v; J.G[i] = v * 0.9; J.B[i] = v * 0.8; d[i] = 1 - y / H; }
  const p = nuevo(); for (let i = 0; i < n; i++) { const t = Math.exp(-1.6 * (1 - d[i])) * 0.7 + 0.2; p.R[i] = J.R[i] * t + A * (1 - t); p.G[i] = J.G[i] * t + A * (1 - t); p.B[i] = J.B[i] * t + A * (1 - t); } fijaY(p);
  const o = copia(p), antes = std(p.Y, 0, W, 90, 140);
  quitarNeblina(p, d, { fuerza: 85, profundidad: 60 }); const despues = std(p.Y, 0, W, 90, 140);
  console.log(`neblina: contraste de lo lejano ${antes.toFixed(3)} → ${despues.toFixed(3)}`);
  ok(despues > antes * 1.3, "no recupera contraste en lo lejano");
  const q = copia(o); quitarNeblina(q, d, { fuerza: 0 }); ok(sinCambio(q, o) === 0, "con fuerza 0 cambia la imagen");
  ok(p.R.every(v => v >= 0 && v <= 1), "valores fuera de gama");
}

/* 2 · cielo */
{
  const p = nuevo(), cielo = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (y < 80) { cielo[i] = 1; const v = 0.6 + 0.12 * Math.sin(x / 9) * Math.cos(y / 7); p.R[i] = p.G[i] = p.B[i] = v; } else { p.R[i] = 0.05; p.G[i] = 0.2; p.B[i] = 0.04; } }
  fijaY(p); const o = copia(p), a = new Float32Array(3);
  mejorarCielo(p, cielo, { relleno: 100, realce: 0, primerPlano: 0 });
  oklab(p.R[20 * W + 100], p.G[20 * W + 100], p.B[20 * W + 100], a);
  console.log(`cielo: color del cielo gris tras rellenar a=${a[1].toFixed(3)} b=${a[2].toFixed(3)}`);
  ok(a[2] < -0.04, "el cielo apagado no se vuelve azul"); ok(std(p.Y, 0, W, 10, 70) > 0.01, "se pierde el detalle de las nubes");
  let suelo = 0; for (let i = 100 * W + 5; i < n; i++) suelo += Math.abs(p.G[i] - o.G[i]); ok(suelo < 0.5, "toca el suelo con sólo «relleno»");
  const q = copia(o); mejorarCielo(q, cielo, { primerPlano: 50 }); ok(media(q.G, 0, W, 100, 140) > media(o.G, 0, W, 100, 140) * 1.2, "el primer plano no se aclara");
}

/* 3 · realzar por tipo */
{
  const p = nuevo(), m = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (x < 100) m[i] = 1; p.R[i] = 0.1; p.G[i] = 0.3 + 0.05 * Math.sin(x / 3); p.B[i] = 0.35; } fijaY(p);
  const o = copia(p), a = new Float32Array(3), b = new Float32Array(3);
  realzarTipo(p, m, "agua", 60, 50);
  oklab(o.R[50], o.G[50], o.B[50], a); oklab(p.R[50], p.G[50], p.B[50], b);
  console.log(`tipo: croma del agua ${Math.hypot(a[1], a[2]).toFixed(3)} → ${Math.hypot(b[1], b[2]).toFixed(3)}`);
  ok(Math.hypot(b[1], b[2]) > Math.hypot(a[1], a[2]) * 1.15, "no sube la saturación del agua");
  let fuera = 0; for (let y = 0; y < H; y++) for (let x = 100; x < W; x++) fuera += Math.abs(p.G[y * W + x] - o.G[y * W + x]); ok(fuera === 0, "toca fuera de la máscara");
}

/* 4 · balance de blancos por zonas */
{
  const p = nuevo();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, v = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(x / 8 + y / 11)), c = x < W / 2 ? [1.25, 1, 0.75] : [0.8, 1, 1.25]; p.R[i] = Math.min(1, v * c[0]); p.G[i] = Math.min(1, v * c[1]); p.B[i] = Math.min(1, v * c[2]); } fijaY(p);
  const dev = (q, x0, x1) => Math.abs(Math.log(media(q.R, x0, x1, 20, 130) / media(q.B, x0, x1, 20, 130)));
  const antes = [dev(p, 10, 90), dev(p, 110, 190)]; balanceZonas(p, { fuerza: 100, zonas: 2 }); const despues = [dev(p, 10, 90), dev(p, 110, 190)];
  console.log(`balance: desviación R/B izquierda ${antes[0].toFixed(2)} → ${despues[0].toFixed(2)} · derecha ${antes[1].toFixed(2)} → ${despues[1].toFixed(2)}`);
  ok(despues[0] < antes[0] * 0.4 && despues[1] < antes[1] * 0.4, "no neutraliza las dos luces");
}

/* 5 · recuperar luces */
{
  const p = nuevo(), real = nuevo();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, v = 0.3 + 1.3 * (x / W); real.R[i] = v * 1.0; real.G[i] = v * 0.6; real.B[i] = v * 0.25; p.R[i] = Math.min(1, real.R[i]); p.G[i] = Math.min(1, real.G[i]); p.B[i] = Math.min(1, real.B[i]); } fijaY(p);
  const o = copia(p), x = 170, i = 70 * W + x;
  recuperarLuces(p, { fuerza: 100, umbral: 95 });
  const antes = o.G[i] / o.R[i], despues = p.G[i] / p.R[i], verdad = real.G[i] / real.R[i];
  console.log(`luces: G/R en lo quemado ${antes.toFixed(2)} → ${despues.toFixed(2)} (verdad ${verdad.toFixed(2)})`);
  ok(Math.abs(despues - verdad) < Math.abs(antes - verdad) * 0.6, "no recupera la proporción de color");
  ok(p.R.every(v => v <= 1.0001) && p.G.every(v => v <= 1.0001), "se sale de gama");
  const q = copia(o); recuperarLuces(q, { fuerza: 0 }); ok(sinCambio(q, o) === 0, "con fuerza 0 cambia");
}

/* 6 · unificar iluminación */
{
  const p = nuevo(), m = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, dentro = Math.hypot(x - 100, y - 75) < 30; m[i] = dentro ? 1 : 0; if (dentro) { p.R[i] = 0.6; p.G[i] = 0.35; p.B[i] = 0.2; } else { p.R[i] = 0.15; p.G[i] = 0.25; p.B[i] = 0.5; } } fijaY(p);
  const o = copia(p), a = new Float32Array(3), b = new Float32Array(3);
  armonizar(p, m, { color: 100, luz: 50 }); oklab(o.R[75 * W + 100], o.G[75 * W + 100], o.B[75 * W + 100], a); oklab(p.R[75 * W + 100], p.G[75 * W + 100], p.B[75 * W + 100], b);
  console.log(`armonizar: b del sujeto ${a[2].toFixed(3)} → ${b[2].toFixed(3)} (fondo azul: b < 0)`);
  ok(b[2] < a[2] - 0.02, "el sujeto no se acerca al color del fondo");
  let fuera = 0; for (let i = 0; i < n; i++) if (m[i] === 0 && Math.abs(p.R[i] - o.R[i]) > 0.02) fuera++; ok(fuera < 400, "cambia demasiado fuera del sujeto (" + fuera + " px)");
}

/* 7 · aberración con la distancia */
{
  const p = nuevo(), d = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, v = x > 150 ? 0.9 : 0.1; p.R[i] = p.G[i] = p.B[i] = v; d[i] = x < 100 ? 1 : 0; } fijaY(p);
  const o = copia(p); cromaProfundidad(p, d, { fuerza: 100 });
  const dif = (q) => { let s = 0; for (let y = 0; y < H; y++) for (let x = 140; x < 160; x++) s += Math.abs(q.R[y * W + x] - q.B[y * W + x]); return s; };
  console.log(`croma: |R−B| en el borde lejano ${dif(o).toFixed(2)} → ${dif(p).toFixed(2)}`);
  ok(dif(p) > dif(o) + 1, "no aparece franja de color en lo lejano");
  let cerca = 0; for (let y = 60; y < 90; y++) for (let x = 90; x < 110; x++) cerca += Math.abs(p.R[y * W + x] - o.R[y * W + x]); ok(cerca < 0.5, "toca el centro cercano");
}

/* 8 · luz con relieve */
{
  const p = nuevo(), d = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; d[i] = Math.exp(-((x - 100) ** 2 + (y - 75) ** 2) / 1500); p.R[i] = p.G[i] = p.B[i] = 0.4; } fijaY(p);
  luzRelieve(p, d, { azimut: -60, altura: 10, intensidad: 80, relieve: 80 });
  const izq = media(p.Y, 70, 90, 60, 90), der = media(p.Y, 110, 130, 60, 90);
  console.log(`relieve: lado izquierdo ${izq.toFixed(3)} · lado derecho ${der.toFixed(3)} (luz desde la izquierda)`);
  ok(izq > der * 1.1, "la luz no ilumina el lado que mira a ella");
}

console.log(fallos ? "escena (motor): FALLO" : "escena (motor): OK");
process.exit(fallos ? 1 : 0);
