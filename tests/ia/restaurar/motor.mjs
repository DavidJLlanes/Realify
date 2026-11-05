/* ═════════════════════════════════════════════════
   PRUEBA · motores de restauración (Node, sin navegador)
   Escenas sintéticas con la respuesta conocida: desenfoque de movimiento y de enfoque, motas del sensor, moiré y ruido.
   Uso: node tests/ia/restaurar/motor.mjs
   ═════════════════════════════════════════════════ */
import { quitarDesenfoque, estimar, quitarMotas, quitarMoire, limpiarRuido, nivelRuido } from "../../../js/features/restore/engine/index.js";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const W = 256, H = 192, n = W * H;
const nuevo = () => ({ W, H, R: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n), Y: new Float32Array(n) });
const gris = (p, f) => { for (let i = 0; i < n; i++) { const v = f(i % W, (i / W) | 0); p.R[i] = p.G[i] = p.B[i] = p.Y[i] = Math.min(1, Math.max(0, v)); } return p; };
const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const gn = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.sqrt(0.5); };
const mediaR = (a, x0, x1, y0, y1) => { let s = 0, c = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += a[y * W + x]; c++; } return s / c; };
const dev = (a, x0, x1, y0, y1) => { const m = mediaR(a, x0, x1, y0, y1); let s = 0, c = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += (a[y * W + x] - m) ** 2; c++; } return Math.sqrt(s / c); };
const nitidez = (a) => { let s = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) s += Math.abs(a[y * W + x + 1] - a[y * W + x - 1]); return s; };
const mezcla = (p, k) => { for (let i = 0; i < n; i++) { p.R[i] = p.G[i] = p.B[i] = p.Y[i] = k[i]; } };

/* escena con bordes: cuadrados y barras */
const nitida = (x, y) => 0.15 + 0.6 * (((x >> 5) + (y >> 5)) % 2) + 0.15 * (((x / 7) | 0) % 2 === 0 && x > 100 ? 1 : 0);

/* 1 · movimiento horizontal de 9 px */
{
  const o = gris(nuevo(), nitida), b = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let t = -4; t <= 4; t++) s += o.Y[y * W + Math.min(W - 1, Math.max(0, x + t))]; b[y * W + x] = s / 9; }
  const p = gris(nuevo(), (x, y) => b[y * W + x]), antes = nitidez(p.Y), est = estimar(p.Y, W, H, "movimiento");
  console.log(`desenfoque: ángulo estimado ${est.angulo}° · largo ${est.largo} (real 0°, 9)`);
  ok(Math.min(est.angulo, 180 - est.angulo) <= 12, "el ángulo estimado no es horizontal"); ok(est.largo >= 6 && est.largo <= 13, "el largo estimado está lejos de 9");
  quitarDesenfoque(p, { tipo: "movimiento", largo: 9, angulo: 0, cantidad: 100 });
  const despues = nitidez(p.Y), real = nitidez(o.Y);
  console.log(`desenfoque: nitidez ${antes.toFixed(1)} → ${despues.toFixed(1)} (original ${real.toFixed(1)})`);
  ok(despues > antes * 1.25, "no recupera nitidez"); ok(despues < real * 1.25, "sobre-afila (halos)");
  ok(p.R.every(v => v >= 0 && v <= 1), "valores fuera de gama");
  const q = gris(nuevo(), (x, y) => b[y * W + x]); quitarDesenfoque(q, { tipo: "movimiento", cantidad: 0 }); let d = 0; for (let i = 0; i < n; i++) d += Math.abs(q.Y[i] - p.Y[i] * 0 - b[i]); ok(d < 1e-3, "con cantidad 0 cambia");
}

/* 2 · enfoque (disco de radio 3) */
{
  const o = gris(nuevo(), nitida), b = new Float32Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, c = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) { s += o.Y[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]; c++; } b[y * W + x] = s / c; }
  const p = gris(nuevo(), (x, y) => b[y * W + x]), antes = nitidez(p.Y), est = estimar(p.Y, W, H, "enfoque");
  console.log(`enfoque: radio estimado ${est.radio.toFixed(1)} (real 3)`);
  ok(est.radio >= 1.5 && est.radio <= 5.5, "el radio estimado está lejos de 3");
  quitarDesenfoque(p, { tipo: "enfoque", radio: 3, cantidad: 100 });
  console.log(`enfoque: nitidez ${antes.toFixed(1)} → ${nitidez(p.Y).toFixed(1)} (original ${nitidez(o.Y).toFixed(1)})`);
  ok(nitidez(p.Y) > antes * 1.12, "no recupera nitidez");
}

/* 3 · motas */
{
  const base = (x, y) => 0.55 + 0.2 * (y / H), p = gris(nuevo(), base), tex = gris(nuevo(), (x, y) => 0.4 + 0.2 * Math.sin(x / 2) * Math.sin(y / 2));
  const motas = [[60, 40, 6], [150, 70, 8], [200, 130, 5]];
  for (const [cx, cy, r] of motas) for (let y = cy - r - 2; y <= cy + r + 2; y++) for (let x = cx - r - 2; x <= cx + r + 2; x++) { const d = Math.hypot(x - cx, y - cy); if (d < r + 2) p.R[y * W + x] = p.G[y * W + x] = p.B[y * W + x] = p.Y[y * W + x] = base(x, y) * (1 - 0.1 * Math.min(1, (r + 2 - d) / 2)); }
  for (let y = 100; y < 180; y++) for (let x = 10; x < 120; x++) { const i = y * W + x; p.R[i] = p.G[i] = p.B[i] = p.Y[i] = tex.Y[i]; }
  const o = { Y: Float32Array.from(p.Y), R: Float32Array.from(p.R) };
  const r = quitarMotas(p, { sensibilidad: 70, tamano: 24 });
  const prof = (a, cx, cy) => Math.abs(a[cy * W + cx] - base(cx, cy));
  console.log(`motas: ${r.motas} detectadas · desviación en el centro ${motas.map(([cx, cy]) => prof(o.Y, cx, cy).toFixed(3)).join("/")} → ${motas.map(([cx, cy]) => prof(p.Y, cx, cy).toFixed(3)).join("/")}`);
  ok(r.motas >= 3, "no encuentra las 3 motas"); ok(motas.every(([cx, cy]) => prof(p.Y, cx, cy) < prof(o.Y, cx, cy) * 0.25), "no borra las motas");
  let tocada = 0; for (let y = 100; y < 180; y++) for (let x = 10; x < 120; x++) tocada += Math.abs(p.Y[y * W + x] - o.Y[y * W + x]); ok(tocada < 0.5, "toca la textura (" + tocada.toFixed(2) + ")");
}

/* 4 · moiré */
{
  const p = gris(nuevo(), (x, y) => 0.45 + 0.2 * (x / W) + 0.05 * Math.sin(x / 40)), o = Float32Array.from(p.Y);
  const f = 2 * Math.PI / 6.4, ang = 0.5, amp = 0.05;
  for (let i = 0; i < n; i++) { const x = i % W, y = (i / W) | 0, m = amp * Math.sin(f * (x * Math.cos(ang) + y * Math.sin(ang))); p.R[i] += m * 1.2; p.B[i] -= m * 1.2; p.G[i] += m * 0.4; p.Y[i] = 0.2126 * p.R[i] + 0.7152 * p.G[i] + 0.0722 * p.B[i]; }
  const patron = (a) => { let sr = 0, si = 0; for (let i = 0; i < n; i++) { const x = i % W, y = (i / W) | 0, ph = f * (x * Math.cos(ang) + y * Math.sin(ang)); sr += (a[i] - 0) * Math.cos(ph); si += a[i] * Math.sin(ph); } return Math.hypot(sr, si) / n * 2; };
  const crom = q => { const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = q.R[i] - q.B[i]; return c; };
  const antes = patron(crom(p)), picos = quitarMoire(p, { cantidad: 100 }), despues = patron(crom(p));
  console.log(`moiré: ${picos} picos · amplitud del patrón en el color ${antes.toFixed(4)} → ${despues.toFixed(4)}`);
  ok(despues < antes * 0.3, "no atenúa el moiré"); let dv = 0; for (let i = 0; i < n; i++) dv += Math.abs(p.Y[i] - o[i]); ok(dv / n < 0.012, "estropea la imagen limpia (" + (dv / n).toFixed(4) + ")");
}

/* 5 · limpiar ruido */
{
  const limpia = (x, y) => 0.2 + 0.5 * (x > 128 ? 1 : 0) + 0.1 * (y / H), p = gris(nuevo(), limpia), o = Float32Array.from(p.Y);
  for (let i = 0; i < n; i++) { p.R[i] += 0.03 * gn(); p.G[i] += 0.03 * gn(); p.B[i] += 0.03 * gn(); p.R[i] = Math.min(1, Math.max(0, p.R[i])); p.G[i] = Math.min(1, Math.max(0, p.G[i])); p.B[i] = Math.min(1, Math.max(0, p.B[i])); p.Y[i] = 0.2126 * p.R[i] + 0.7152 * p.G[i] + 0.0722 * p.B[i]; }
  const err = (a, x0, x1) => { let s = 0, c = 0; for (let y = 20; y < 170; y++) for (let x = x0; x < x1; x++) { s += (a[y * W + x] - o[y * W + x]) ** 2; c++; } return Math.sqrt(s / c); };
  const antes = err(p.Y, 20, 100), sg = nivelRuido(p.Y, W, H); limpiarRuido(p, { fuerza: 100 }); const despues = err(p.Y, 20, 100);
  const salto = mediaR(p.Y, 135, 160, 20, 170) - mediaR(p.Y, 96, 121, 20, 170), saltoO = mediaR(o, 135, 160, 20, 170) - mediaR(o, 96, 121, 20, 170);
  console.log(`ruido: σ estimada ${sg.toFixed(3)} · error ${antes.toFixed(4)} → ${despues.toFixed(4)} · salto del borde ${saltoO.toFixed(3)} → ${salto.toFixed(3)}`);
  ok(despues < antes * 0.5, "no reduce el ruido a la mitad"); ok(salto > saltoO * 0.85, "aplana el borde");
}

console.log(fallos ? "restaurar (motor): FALLO" : "restaurar (motor): OK");
process.exit(fallos ? 1 : 0);
