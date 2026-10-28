/* Prueba del ajuste de haces de «Panorámica» (plugins/panorama/bundle.js), sin navegador: seis fotos con giros y focal conocidos,
   coincidencias con ruido de 0,5 px y un 10 % de falsas, y como punto de partida giros encadenados con error y la focal un 15 % mal.
   Debe converger a < 0,1° de error entre fotos y < 0,5 % de focal, y no empeorar con ayuda de la pérdida de Huber.
   Uso: node tests/panorama-bundle.mjs */
import { refineCamera, expRot, angleBetween } from "../plugins/panorama/bundle.js";
let seed = 7; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296, gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
const mul = (a, b) => { const o = Array(9).fill(0); for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++) for(let k = 0; k < 3; k++) o[3 * i + j] += a[3 * i + k] * b[3 * k + j]; return o; };
const tr = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const W = 1400, H = 1000, F = 900, D = Math.PI / 180, C = { cx: W / 2, cy: H / 2 };
const n = 6, truth = Array.from({ length: n }, (_, i) => expRot(0, (i - 2.5) * 20 * D, 0)).map((r, i) => mul(r, expRot((i % 2 ? 1 : -1) * 0.03, 0, 0.02 * (i % 3 - 1))));
const project = (R, d) => { const y = mul(tr(R), [d[0], 0, 0, d[1], 0, 0, d[2], 0, 0]); const u = [y[0], y[3], y[6]]; return u[2] > 0.05 ? [F * u[0] / u[2] + C.cx, F * u[1] / u[2] + C.cy] : null; };
const obs = [];
for(let a = 0; a < n; a++) for(let b = a + 1; b < n; b++){
  const pts = [];
  for(let k = 0; k < 600; k++){
    const x = (rnd() - 0.5) * 0.9 * W / F, y = (rnd() - 0.5) * 0.9 * H / F, r = mul(truth[a], [x, 0, 0, y, 0, 0, 1, 0, 0]), d = [r[0], r[3], r[6]];
    const pa = project(truth[a], d), pb = project(truth[b], d);
    if(!pa || !pb || pb[0] < 0 || pb[0] > W || pb[1] < 0 || pb[1] > H) continue;
    const bad = rnd() < 0.1;
    pts.push(pa[0] + gauss() * 0.5, pa[1] + gauss() * 0.5, bad ? rnd() * W : pb[0] + gauss() * 0.5, bad ? rnd() * H : pb[1] + gauss() * 0.5);
  }
  if(pts.length >= 80) obs.push({ a, b, pts });
}
// Inicio: giros encadenados con un error de ~0,6° por paso y focal 15 % mal
const R0 = [truth[0]]; for(let i = 1; i < n; i++){ const rel = mul(tr(truth[i - 1]), truth[i]); R0.push(mul(R0[i - 1], mul(rel, expRot(0.01 * gauss(), 0.01 * gauss(), 0.005 * gauss())))); }
const centers = Array(n).fill(C), out = refineCamera({ R: R0, f: F * 1.15, centers, obs, fixed: 0 });
let worst = 0; for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++) worst = Math.max(worst, Math.abs(angleBetween(out.R[i], out.R[j]) - angleBetween(truth[i], truth[j])));
let worst0 = 0; for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++) worst0 = Math.max(worst0, Math.abs(angleBetween(R0[i], R0[j]) - angleBetween(truth[i], truth[j])));
const fErr = 100 * Math.abs(out.f - F) / F;
console.log(`observaciones ${out.count} · iteraciones ${out.iters} · mediana ${out.medBefore.toFixed(2)} → ${out.medAfter.toFixed(2)} px · giro máx. ${worst0.toFixed(3)}° → ${worst.toFixed(3)}° · focal ${fErr.toFixed(3)} %`);
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(!out.rejected, "el ajuste se rechazó"); chk(worst < 0.1, "error de giro entre fotos ≥ 0,1°"); chk(fErr < 0.5, "error de focal ≥ 0,5 %"); chk(out.medAfter < 1, "la mediana del residuo debe quedar por debajo de 1 px");
console.log(bad ? "panorama-bundle: FALLO" : "panorama-bundle: OK"); process.exit(bad ? 1 : 0);
