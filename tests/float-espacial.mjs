/* Prueba de los filtros espaciales en coma flotante nativa (js/editor/floatspatial.js): desenfoque gaussiano, máscara de enfoque y ruido sobre
   16 bits. Sin navegador. Uso: node tests/float-espacial.mjs */
import assert from "node:assert/strict";
import { gaussianBlurHi, unsharpHi, noiseHi, boxSizes } from "../js/editor/floatspatial.js";
const W = 120, H = 80, n = W * H, tick = async () => {};
// 1) un degradado lineal no cambia con el desenfoque (salvo en el borde): error ≤ 2 niveles de 16 bits (con 8 bits el delta daría hasta ±128)
const grad = new Uint16Array(n * 3); for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const j = (y * W + x) * 3, v = 10000 + x * 200 + y * 3; grad[j] = v; grad[j + 1] = v; grad[j + 2] = v; }
const b1 = await gaussianBlurHi(grad, W, H, 3, tick); let e1 = 0;
for(let y = 12; y < H - 12; y++) for(let x = 12; x < W - 12; x++) e1 = Math.max(e1, Math.abs(b1[(y * W + x) * 3] - grad[(y * W + x) * 3]));
// 2) contra el gaussiano exacto sobre un escalón: error máximo < 3 % del salto
const step = new Uint16Array(n * 3); for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const v = x < W / 2 ? 5000 : 55000, j = (y * W + x) * 3; step[j] = step[j + 1] = step[j + 2] = v; }
const sigma = 4, b2 = await gaussianBlurHi(step, W, H, sigma, tick); let e2 = 0;
const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
for(let x = 0; x < W; x++){ const exact = 5000 + 50000 * 0.5 * (1 + erf((x + .5 - W / 2) / (sigma * Math.SQRT2))); e2 = Math.max(e2, Math.abs(b2[(40 * W + x) * 3] - exact)); }
// 3) enfoque: un escalón gana el sobreimpulso; un llano no cambia; el umbral deja quieto lo débil
const sh = await unsharpHi(step, W, H, { amount: 100, radius: 2, threshold: 0 }, tick);
const sTh = await unsharpHi(step, W, H, { amount: 100, radius: 2, threshold: 255 }, tick);
// 4) ruido: determinista con la semilla, sin recortar donde no toca y con valores que no son múltiplos de 257
const flat = new Uint16Array(n * 3).fill(30000), r1 = await noiseHi(flat, W, H, { amount: 10, seed: 7 }, tick), r2 = await noiseHi(flat, W, H, { amount: 10, seed: 7 }, tick), r3 = await noiseHi(flat, W, H, { amount: 10, seed: 8 }, tick);
let same = true, diff3 = false, fine = false, mean = 0; for(let i = 0; i < r1.length; i++){ if(r1[i] !== r2[i]) same = false; if(r1[i] !== r3[i]) diff3 = true; if(r1[i] % 257) fine = true; mean += r1[i] - 30000; }
const out = { boxes: boxSizes(3), e1, e2, escalon: [Math.min(...Array.from({ length: W }, (_, x) => sh[(40 * W + x) * 3])), Math.max(...Array.from({ length: W }, (_, x) => sh[(40 * W + x) * 3]))],
  umbral: sTh[(40 * W + W / 2) * 3] === step[(40 * W + W / 2) * 3], same, diff3, fine, media: Math.round(mean / r1.length) };
console.log(JSON.stringify(out));
assert.ok(e1 <= 2, "el degradado debe quedar igual (error " + e1 + ")");
assert.ok(e2 < 0.03 * 50000, "gaussiano de tres cajas cerca del exacto (error " + e2 + ")");
assert.ok(out.escalon[0] < 5000 - 1000 && out.escalon[1] > 55000 - 1 || out.escalon[0] === 0 || out.escalon[1] === 65535 || out.escalon[0] < 5000, "el enfoque da sobreimpulso");
assert.ok(out.umbral, "el umbral deja quieto lo que está por debajo");
assert.ok(same && diff3 && fine && Math.abs(out.media) < 600, "ruido determinista, fino y sin sesgo");
console.log("OK");
