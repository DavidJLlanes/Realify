/* Prueba en Node del motor de «Forma de la cara»: una cara sintética (malla de 478 puntos con los índices que usa el motor) y comprobaciones
   de lo que cada mando mueve y de lo que no (anclas), sin plegados y con el rango reducido del perfil infantil. Sin fotos de personas. */
import assert from "node:assert/strict";
import { stage, manosForma, hayForma } from "../../../js/features/portrait/face-shape/engine.js";
import { campoMLS, limitar, minDet } from "../../../js/features/warp/index.js";
import { IDX } from "../../../js/features/portrait/shared/landmarks.js";
import { PARAMS } from "../../../js/features/portrait/face-shape/params.js";
import { validate } from "../../../js/ui/kit/params-panel.js";

const W = 300, H = 300, n = W * H, F = 140;
const P = Array.from({ length: 478 }, () => [150, 150]);
IDX.ovalo.forEach((i, k) => { const t = (-90 + k * 10) * Math.PI / 180; P[i] = [150 + 70 * Math.cos(t), 150 + 90 * Math.sin(t)]; });
const ojo = (ids, cx) => ids.forEach((i, k) => { const t = k <= 8 ? k / 8 : (16 - k) / 8, s = cx < 150 ? -1 : 1;
  P[i] = [cx - s * 18 * Math.cos(Math.PI * t) * (cx < 150 ? 1 : -1) * -1, 125 + (k <= 8 ? 1 : -1) * 8 * Math.sin(Math.PI * t)]; });
ojo(IDX.ojoD, 118); ojo(IDX.ojoI, 182);
Object.assign(P, { 1: [150, 155], 6: [150, 130], 9: [150, 118], 98: [140, 162], 327: [160, 162], 129: [134, 158], 358: [166, 158], 49: [130, 152], 279: [170, 152], 48: [136, 160], 278: [164, 160],
  175: [150, 232], 199: [150, 226], 428: [158, 228], 61: [130, 185], 291: [170, 185] });
[...IDX.ceja_D.slice(0, 3)].forEach((i, k) => { P[i] = [100 + k * 8, 105]; }); [...IDX.ceja_I.slice(0, 3)].forEach((i, k) => { P[i] = [200 - k * 8, 105]; });
const sup = [0, 37, 39, 40, 185, 267, 269, 270, 409], inf = [17, 84, 181, 91, 146, 314, 405, 321, 375];
sup.forEach((i, k) => { const t = k / 8; P[i] = [130 + 40 * t, 183 - 5 * Math.sin(Math.PI * t)]; }); inf.forEach((i, k) => { const t = k / 8; P[i] = [130 + 40 * t, 187 + 8 * Math.sin(Math.PI * t)]; });
P[0] = [150, 178]; P[17] = [150, 196];

/* Imagen: fondo oscuro, cara de piel clara, ojos oscuros y labios rojos (para medir áreas) */
const poli = (pts, f) => { for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ let d = false; for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } if(d) f(y * W + x); } };
const planos = () => { const R = new Float32Array(n).fill(0.05), G = new Float32Array(n).fill(0.05), B = new Float32Array(n).fill(0.05), Y = new Float32Array(n);
  poli(IDX.ovalo.map(i => P[i]), i => { R[i] = 0.6; G[i] = 0.45; B[i] = 0.38; });
  for(const ids of [IDX.ojoD, IDX.ojoI]) poli(ids.map(i => P[i]), i => { R[i] = G[i] = B[i] = 0.02; });
  poli([...inf, ...sup.slice().reverse()].map(i => P[i]), i => { R[i] = 0.5; G[i] = 0.1; B[i] = 0.1; });
  for(let i = 0; i < n; i++) Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  return { W, H, R, G, B, Y, F, puntos: P }; };
const ancho = (c, y) => { let k = 0; for(let x = 0; x < W; x++) if(c.R[y * W + x] > 0.3) k++; return k; };
const oscuro = c => { let k = 0; for(let i = 0; i < n; i++) if(c.R[i] < 0.04 && c.G[i] < 0.04 && i % W > 90 && i % W < 210 && ((i / W) | 0) > 105 && ((i / W) | 0) < 145) k++; return k; };
const rojos = c => { let k = 0; for(let i = 0; i < n; i++) if(c.R[i] > 0.3 && c.G[i] < 0.2) k++; return k; };
const base = planos(), con = v => { const c = planos(); stage(c, v); return c; };

assert(!hayForma({}) && hayForma({ forma_ojos: 3 }));
/* sin valores no cambia nada */
{ const c = con({}); assert.deepEqual(Array.from(c.R.slice(0, 500)), Array.from(base.R.slice(0, 500))); }
/* cara: +20 ensancha, −20 estrecha */
{ const a = ancho(con({ forma_cara: 20 }), 150), b = ancho(con({ forma_cara: -20 }), 150), o = ancho(base, 150); assert(a > o + 3 && b < o - 3, `cara ancha/fina (${b} < ${o} < ${a})`); }
/* mandíbula: cambia la parte baja de la cara y deja la frente */
{ const c = con({ forma_mandibula: -20 }); assert(ancho(c, 205) < ancho(base, 205) - 2, "mandíbula más estrecha abajo"); assert(Math.abs(ancho(c, 100) - ancho(base, 100)) <= 1, "y no cambia la frente"); }
/* mentón: +20 lo alarga */
{ const bajo = c => { for(let y = H - 1; y > 0; y--) if(c.R[y * W + 150] > 0.3) return y; return 0; }; assert(bajo(con({ forma_menton: 20 })) > bajo(base) + 2, "mentón más largo"); }
/* ojos: +20 agranda y no mueve la boca; −20 reduce */
{ const c = con({ forma_ojos: 20 }), d = con({ forma_ojos: -20 }); assert(oscuro(c) > oscuro(base) * 1.04 && oscuro(d) < oscuro(base) * 0.96, `ojos (${oscuro(d)} < ${oscuro(base)} < ${oscuro(c)})`);
  assert(Math.abs(rojos(c) - rojos(base)) <= rojos(base) * 0.03, "la boca no cambia al tocar los ojos"); }
/* labios: +20 los engrosa */
{ assert(rojos(con({ forma_labios: 20 })) > rojos(base) * 1.05, "labios más gruesos (" + rojos(base) + " → " + rojos(con({ forma_labios: 20 })) + ")"); }
/* sin plegados con todo al máximo, y el fondo lejano no cambia */
{ const v = { forma_cara: 20, forma_mandibula: 20, forma_menton: 20, forma_nariz: 20, forma_ojos: 20, forma_labios: 20 };
  const campo = campoMLS(W, H, manosForma(P, F, v), { paso: 4, alpha: 1.5 }), l = limitar(campo); assert(minDet(l.campo) >= 0.149, "sin plegados");
  const c = con(v); let lejos = 0; for(let y = 0; y < 20; y++) for(let x = 0; x < W; x++) lejos = Math.max(lejos, Math.abs(c.R[y * W + x] - base.R[y * W + x])); assert(lejos < 1e-4, "fondo lejano intacto"); }
/* perfil infantil: rango reducido */
{ for(const perfil of ["nino", "nina"]){ const { values } = validate(PARAMS, { forma_cara: 20, forma_ojos: -20 }, perfil); assert.deepEqual(values, { forma_cara: 5, forma_ojos: -5 }, perfil); } }

console.log("forma de la cara (motor): OK");
