/* Prueba del ajuste de haces de «Panorámica» (plugins/panorama/bundle.js), sin navegador: seis fotos con giros y focal conocidos,
   coincidencias con ruido de 0,5 px y un 10 % de falsas, y como punto de partida giros encadenados con error y la focal un 15 % mal.
   Debe converger a < 0,1° de error entre fotos y < 0,5 % de focal, y no empeorar con ayuda de la pérdida de Huber.
   Segunda parte: las mismas fotos con distorsión de lente (k1 = −0,08, k2 = 0,02); con `distortion: 2` debe recuperar k1 y k2 (±0,01) y
   la focal (< 1 %), y sin pedirla debe quedar claramente peor.
   Uso: node tests/panorama-bundle.mjs */
import { refineCamera, expRot, angleBetween, undistort } from "../plugins/panorama/bundle.js";
let seed = 7; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296, gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
const mul = (a, b) => { const o = Array(9).fill(0); for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++) for(let k = 0; k < 3; k++) o[3 * i + j] += a[3 * i + k] * b[3 * k + j]; return o; };
const tr = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const W = 1400, H = 1000, F = 900, D = Math.PI / 180, C = { cx: W / 2, cy: H / 2 };
const n = 6, truth = Array.from({ length: n }, (_, i) => expRot(0, (i - 2.5) * 20 * D, 0)).map((r, i) => mul(r, expRot((i % 2 ? 1 : -1) * 0.03, 0, 0.02 * (i % 3 - 1))));
const project = (R, d) => { const y = mul(tr(R), [d[0], 0, 0, d[1], 0, 0, d[2], 0, 0]); const u = [y[0], y[3], y[6]]; return u[2] > 0.05 ? [F * u[0] / u[2] + C.cx, F * u[1] / u[2] + C.cy] : null; };
const KT = [-0.08, 0.02];
// Pasa un punto sin distorsión (px) al medido: invierte x·(1 + k1·r² + k2·r⁴) por punto fijo
const distort = (p, K) => { if(!K) return p; const xu = (p[0] - C.cx) / F, yu = (p[1] - C.cy) / F; let x = xu, y = yu; for(let i = 0; i < 30; i++){ const r2 = x * x + y * y, s = 1 + K[0] * r2 + K[1] * r2 * r2; x = xu / s; y = yu / s; } return [x * F + C.cx, y * F + C.cy]; };
const makeObs = K => {
const obs = [];
for(let a = 0; a < n; a++) for(let b = a + 1; b < n; b++){
  const pts = [];
  for(let k = 0; k < 600; k++){
    const x = (rnd() - 0.5) * 0.9 * W / F, y = (rnd() - 0.5) * 0.9 * H / F, r = mul(truth[a], [x, 0, 0, y, 0, 0, 1, 0, 0]), d = [r[0], r[3], r[6]];
    const pa0 = project(truth[a], d), pb0 = project(truth[b], d);
    if(!pa0 || !pb0 || pb0[0] < 0 || pb0[0] > W || pb0[1] < 0 || pb0[1] > H) continue;
    const pa = distort(pa0, K), pb = distort(pb0, K);
    const bad = rnd() < 0.1;
    pts.push(pa[0] + gauss() * 0.5, pa[1] + gauss() * 0.5, bad ? rnd() * W : pb[0] + gauss() * 0.5, bad ? rnd() * H : pb[1] + gauss() * 0.5);
  }
  if(pts.length >= 80) obs.push({ a, b, pts });
}
return obs; };
const obs = makeObs(null);
// Inicio: giros encadenados con un error de ~0,6° por paso y focal 15 % mal
const R0 = [truth[0]]; for(let i = 1; i < n; i++){ const rel = mul(tr(truth[i - 1]), truth[i]); R0.push(mul(R0[i - 1], mul(rel, expRot(0.01 * gauss(), 0.01 * gauss(), 0.005 * gauss())))); }
const centers = Array(n).fill(C), out = refineCamera({ R: R0, f: F * 1.15, centers, obs, fixed: 0 });
let worst = 0; for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++) worst = Math.max(worst, Math.abs(angleBetween(out.R[i], out.R[j]) - angleBetween(truth[i], truth[j])));
let worst0 = 0; for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++) worst0 = Math.max(worst0, Math.abs(angleBetween(R0[i], R0[j]) - angleBetween(truth[i], truth[j])));
const fErr = 100 * Math.abs(out.f - F) / F;
console.log(`observaciones ${out.count} · iteraciones ${out.iters} · mediana ${out.medBefore.toFixed(2)} → ${out.medAfter.toFixed(2)} px · giro máx. ${worst0.toFixed(3)}° → ${worst.toFixed(3)}° · focal ${fErr.toFixed(3)} %`);
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
chk(!out.rejected, "el ajuste se rechazó"); chk(worst < 0.1, "error de giro entre fotos ≥ 0,1°"); chk(fErr < 0.5, "error de focal ≥ 0,5 %"); chk(out.medAfter < 1, "la mediana del residuo debe quedar por debajo de 1 px");
// Con distorsión de lente
const obsD = makeObs(KT), fit = d => refineCamera({ R: R0, f: F * 1.1, centers, obs: obsD, fixed: 0, distortion: d, loss: "cauchy" });
const off = fit(0), on = fit(2);
let worstD = 0; for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++) worstD = Math.max(worstD, Math.abs(angleBetween(on.R[i], on.R[j]) - angleBetween(truth[i], truth[j])));
console.log(`con lente: sin k → mediana ${off.medAfter.toFixed(2)} px · con k → ${on.medAfter.toFixed(2)} px, k1 ${on.k[0].toFixed(4)} (real ${KT[0]}), k2 ${on.k[1].toFixed(4)} (real ${KT[1]}), focal ${(100 * Math.abs(on.f - F) / F).toFixed(2)} %, giro máx. ${worstD.toFixed(3)}°`);
chk(Math.abs(on.k[0] - KT[0]) < 0.01 && Math.abs(on.k[1] - KT[1]) < 0.01, "no recuperó k1 y k2 (±0,01)"); chk(Math.abs(on.f - F) / F < 0.01, "focal con lente ≥ 1 %"); chk(worstD < 0.1, "giro con lente ≥ 0,1°");
chk(on.medAfter < 1 && off.medAfter > 2 * on.medAfter, "sin pedir distorsión debería quedar peor que pidiéndola");
console.log(bad ? "panorama-bundle: FALLO" : "panorama-bundle: OK"); process.exit(bad ? 1 : 0);
