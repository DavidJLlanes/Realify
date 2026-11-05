/* Prueba de los motores de realismo (sin DOM): zonas lisas + grano, avisos de manos y dientes, medidas del informe. */
import { toPlanes } from "../../../js/features/portrait/shared/planes.js";
import { mapaLiso } from "../../../js/features/realism/engine/zonas.js";
import { anadirGrano } from "../../../js/features/realism/engine/grano.js";
import { revisarMano, contarDientes } from "../../../js/features/realism/engine/avisos.js";
import { medir, juicio } from "../../../js/features/realism/engine/informe.js";
let fallos = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALLO ") + m); if(!c) fallos++; };
const W = 200, H = 120, rgba = new Uint8ClampedArray(W * H * 4); let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const o = (y * W + x) * 4, base = 110 + x * 0.1, r = x < W / 2 ? (rnd() - 0.5) * 24 : 0; rgba[o] = rgba[o + 1] = rgba[o + 2] = base + r; rgba[o + 3] = 255; }
const p = toPlanes(rgba, W, H), { liso, cobertura } = mapaLiso(p);
const med = (x0, x1) => { let a = 0, n = 0; for(let y = 20; y < 100; y++) for(let x = x0; x < x1; x++){ a += liso[y * W + x]; n++; } return a / n; };
ok(med(10, 70) < 0.2, "la mitad con ruido no es lisa (" + med(10, 70).toFixed(2) + ")");
ok(med(130, 190) > 0.8, "la mitad plana es lisa (" + med(130, 190).toFixed(2) + ")");
const antes = Float32Array.from(p.G); anadirGrano(p, liso, { fuerza: 80, tam: 30 });
let dI = 0, dD = 0; for(let y = 20; y < 100; y++){ for(let x = 10; x < 70; x++) dI += Math.abs(p.G[y * W + x] - antes[y * W + x]); for(let x = 130; x < 190; x++) dD += Math.abs(p.G[y * W + x] - antes[y * W + x]); }
ok(dD > dI * 5 && dD > 0, "el grano va sólo a la zona lisa (" + dD.toFixed(2) + " vs " + dI.toFixed(2) + ")");
const m1 = mapaLiso(toPlanes(rgba, W, H)); ok(Math.abs(m1.cobertura - cobertura) < 1e-9, "determinista");
// mano normal vs dedo larguísimo
const mano = () => { const pt = []; pt[0] = [0, 0, 0]; const bases = [[-40, -20], [-18, -55], [0, -60], [18, -55], [34, -45]];
  [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]].forEach((d, k) => { const [bx, by] = bases[k], len = [14, 20, 22, 20, 15][k]; d.forEach((id, j) => { pt[id] = [bx + (k - 2) * 2 * j, by - len * j, 0]; }); }); return pt; };
ok(revisarMano(mano()).length === 0, "una mano normal no da avisos " + JSON.stringify(revisarMano(mano()).map(a => a.codigo)));
const rara = mano(); [9, 10, 11, 12].forEach((id, j) => { rara[id] = [0, -60 - 60 * j, 0]; });
ok(revisarMano(rara).some(a => a.codigo === "dedo-largo"), "dedo larguísimo detectado");
const doblada = mano(); doblada[7] = [-18, -95, 0]; doblada[8] = [-18, -60, 0];
ok(revisarMano(doblada).some(a => a.codigo === "articulacion"), "articulación imposible detectada");
// dientes: boca abierta con N separaciones
const dientes = n => { const w = 300, h = 160, L = new Float32Array(w * h).fill(0.2); const pts = []; pts[78] = [60, 80]; pts[308] = [240, 80]; pts[13] = [150, 70]; pts[14] = [150, 110];
  for(let y = 72; y < 100; y++) for(let x = 70; x < 230; x++) L[y * w + x] = 0.85 - (Math.round((x - 70) / 160 * n) !== Math.round((x - 69) / 160 * n) ? 0.35 : 0); return { L, w, h, pts }; };
const a = dientes(8), b = dientes(18); const ra = contarDientes(a.L, a.w, a.h, a.pts), rb = contarDientes(b.L, b.w, b.h, b.pts);
ok(ra && ra.abierta && ra.separaciones >= 6 && ra.separaciones <= 10, "8 dientes → " + ra.separaciones + " separaciones");
ok(rb && rb.separaciones > 12, "18 dientes → " + rb.separaciones + " separaciones");
const cer = dientes(8); cer.pts[14] = [150, 73]; ok(contarDientes(cer.L, cer.w, cer.h, cer.pts).abierta === false, "boca cerrada no se mide");
// informe
const m = medir(rgba, W, H); ok(m.ruido > 0 && m.pasos > 0 && juicio(m).length === 4, "informe: " + JSON.stringify(m));
const plana = new Uint8ClampedArray(W * H * 4).fill(128); const mp = medir(plana, W, H); ok(juicio(mp).find(x => x.clave === "ruido").nivel === "aviso", "foto sin ruido → aviso");
process.exit(fallos ? 1 : 0);
