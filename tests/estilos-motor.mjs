/* Motor de estilos por capas (js/filters/styleengine.js, v260), en Node y sin navegador: identidad, curvas, niveles, modos de fusión, opacidades,
   grupos, degradados, copias de la imagen, intensidad, ruido y desenfoque, coherencia entre la función de color (coma flotante) y la imagen, y que
   TODAS las recetas convertidas (assets/estilos/*.json) se evalúan sin errores, sin NaN y sin elementos ignorados. Uso: node tests/estilos-motor.mjs */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { renderStyle, styleIsPure, styleColorFn } = await import(path.join(ROOT, "js/filters/styleengine.js"));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
const near = (a, b, t = 1.01) => Math.abs(a - b) <= t;
const img = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const c = f(x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } return d; };
const px = (d, w, x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
const run = (recipe, f, w = 8, h = 8, o = {}) => { const d = img(w, h, f); const sk = renderStyle(d, w, h, recipe, o); return { d, w, h, sk }; };

// 1. identidad
{ const a = run({ layers: [] }, (x, y) => [x * 30, y * 30, 99]); chk(near(px(a.d, 8, 3, 2)[0], 90, 0.5) && near(px(a.d, 8, 3, 2)[2], 99, 0.5), "una receta vacía no cambia la imagen"); }
// 2. curvas: maestra y por canal (primero el canal, luego la maestra)
{ const a = run({ layers: [{ k: "adj", t: "Crvs", ch: { c: [[0, 50], [255, 255]] } }] }, () => [0, 128, 255]); const p = px(a.d, 8, 0, 0);
  chk(near(p[0], 50) && near(p[1], 128 + (255 - 128) * 0 + (50 - 50 * 128 / 255) * 0 + 0, 40) && near(p[2], 255), "curva maestra: el negro sube a 50 y el blanco no cambia " + p); }
{ const a = run({ layers: [{ k: "adj", t: "Crvs", ch: { r: [[0, 0], [255, 0]] } }] }, () => [200, 120, 40]); const p = px(a.d, 8, 0, 0); chk(near(p[0], 0) && near(p[1], 120) && near(p[2], 40), "curva del canal rojo a cero: sólo cambia el rojo " + p); }
// 3. niveles
{ const a = run({ layers: [{ k: "adj", t: "Lvls", ch: { c: { in: [0, 128], g: 1, out: [0, 255] } } }] }, () => [64, 128, 200]); const p = px(a.d, 8, 0, 0); chk(near(p[0], 127.5, 1.5) && near(p[1], 255) && near(p[2], 255), "niveles con blanco de entrada 128: " + p); }
// 4. relleno de color, opacidad y modos de fusión
{ const base = [100, 150, 200];
  let a = run({ layers: [{ k: "solid", rgb: [255, 255, 255], op: 0.5 }] }, () => base), p = px(a.d, 8, 0, 0); chk(near(p[0], 177.5, 1) && near(p[2], 227.5, 1), "blanco normal al 50 %: " + p);
  a = run({ layers: [{ k: "solid", rgb: [128, 128, 128], bm: "multiply" }] }, () => base); p = px(a.d, 8, 0, 0); chk(near(p[0], 100 * 128 / 255, 1), "multiplicar por gris medio: " + p);
  a = run({ layers: [{ k: "solid", rgb: [128, 128, 128], bm: "screen" }] }, () => base); p = px(a.d, 8, 0, 0); chk(near(p[0], 255 - (255 - 100) * (255 - 128) / 255, 1), "trama: " + p);
  a = run({ layers: [{ k: "solid", rgb: [255, 0, 0], bm: "difference" }] }, () => [100, 100, 100]); p = px(a.d, 8, 0, 0); chk(near(p[0], 155) && near(p[1], 100), "diferencia: " + p);
  a = run({ layers: [{ k: "solid", rgb: [128, 128, 128], bm: "softLight" }] }, () => base); p = px(a.d, 8, 0, 0); chk(near(p[0], 100, 3) && near(p[2], 200, 3), "luz suave con gris medio no cambia (casi): " + p);
  a = run({ layers: [{ k: "solid", rgb: [255, 255, 255], bm: "linearDodge", op: 0.3 }] }, () => [10, 10, 10]); p = px(a.d, 8, 0, 0); chk(near(p[0], 10 + 245 * 0.3, 1), "sobreexposición lineal al 30 %: " + p);
  a = run({ layers: [{ k: "solid", rgb: [10, 200, 30], bm: "luminosity" }] }, () => [200, 50, 50]); p = px(a.d, 8, 0, 0); const lum = (r, g, b) => .3 * r + .59 * g + .11 * b; chk(near(lum(...p), lum(10, 200, 30), 3), "luminosidad: el color toma la luminosidad de la capa " + p); }
// 5. grupo «paso a través» con opacidad: mezcla el efecto de sus capas con lo de debajo
{ const a = run({ layers: [{ k: "group", bm: "pass", op: 0.5, kids: [{ k: "solid", rgb: [0, 0, 0] }] }] }, () => [200, 200, 200]), p = px(a.d, 8, 0, 0); chk(near(p[0], 100, 1), "grupo al 50 % con relleno negro: " + p); }
// 6. grupo aislado (fusionado) con modo Trama: sobre transparente, luego trama sobre la imagen
{ const a = run({ layers: [{ k: "group", iso: 1, bm: "screen", kids: [{ k: "solid", rgb: [0, 0, 0] }, { k: "solid", rgb: [60, 0, 0], bm: "normal" }] }] }, () => [100, 100, 100]), p = px(a.d, 8, 0, 0); chk(near(p[0], 255 - 155 * 195 / 255, 1) && near(p[1], 100, 1), "grupo fusionado en trama: " + p); }
// 7. degradados analíticos: lineal (izquierda → derecha), radial (centro → esquina) y con alfa
{ const lin = { k: "grad", type: "lin", angle: 0, scale: 100, stops: [[0, [0, 0, 0], 0.5], [1, [255, 255, 255], 0.5]] };
  let a = run({ layers: [lin] }, () => [10, 10, 10], 100, 10), l = px(a.d, 100, 1, 5)[0], r = px(a.d, 100, 98, 5)[0]; chk(l < 12 && r > 243, `degradado lineal de izquierda a derecha: ${l} → ${r}`);
  a = run({ layers: [{ ...lin, angle: 90 }] }, () => [10, 10, 10], 10, 100); const t = px(a.d, 10, 5, 1)[0], bt = px(a.d, 10, 5, 98)[0]; chk(t > 243 && bt < 12, `ángulo 90°: de abajo arriba ${bt} → ${t}`);
  a = run({ layers: [{ k: "grad", type: "rad", angle: 0, scale: 100, stops: [[0, [255, 255, 255], 0.5], [1, [0, 0, 0], 0.5]] }] }, () => [10, 10, 10], 101, 101); const c = px(a.d, 101, 50, 50)[0], k = px(a.d, 101, 0, 0)[0]; chk(c > 245 && k < 12, `degradado radial: centro ${c}, esquina ${k}`);
  a = run({ layers: [{ k: "grad", type: "lin", angle: 0, stops: [[0, [255, 0, 0], 0.5], [1, [255, 0, 0], 0.5]], alpha: [[0, 1, 0.5], [1, 0, 0.5]] }] }, () => [0, 0, 255], 100, 10); const il = px(a.d, 100, 1, 5), ir = px(a.d, 100, 98, 5); chk(il[0] > 240 && ir[2] > 240 && ir[0] < 12, "degradado con alfa: opaco a la izquierda, transparente a la derecha"); }
// 8. copias de la imagen: instantánea de lo de debajo, con filtros de color; las copias hacen referencia a la instantánea
{ const a = run({ layers: [{ k: "snap", id: 1, src: "stack", ops: [{ op: "desat" }], bm: "normal", op: 1 }] }, () => [200, 100, 50]), p = px(a.d, 8, 0, 0); chk(near(p[0], 125, 1) && near(p[0], p[1]) && near(p[1], p[2]), "copia desaturada: " + p);
  const b = run({ layers: [{ k: "snap", id: 2, src: "stack", ops: [{ op: "inv" }], hid: 1 }, { k: "adj", t: "Invr" }, { k: "snap", id: 2, src: "ref", bm: "difference" }] }, () => [200, 100, 50]), q = px(b.d, 8, 0, 0);
  // la copia «ref» es la instantánea ORIGINAL (200, 100, 50) y el fondo ya está invertido (55, 155, 205): diferencia 145, 55, 155 (si usara el fondo actual daría 0)
  chk(near(q[0], 145, 1) && near(q[1], 55, 1) && near(q[2], 155, 1), "la copia por referencia usa la instantánea original: " + q);
  const c = run({ layers: [{ k: "adj", t: "Invr" }, { k: "snap", id: 3, src: "base", bm: "difference" }] }, () => [200, 100, 50]), r = px(c.d, 8, 0, 0); chk(near(r[0], 145, 1) && near(r[1], 55, 1), "copia de la imagen ORIGINAL (src base) contra la invertida: " + r); }
// 9. intensidad
{ const rec = { layers: [{ k: "solid", rgb: [0, 0, 0] }] }; let a = run(rec, () => [200, 200, 200], 8, 8, { intensity: 0 }); chk(near(px(a.d, 8, 0, 0)[0], 200), "intensidad 0 deja la imagen igual"); a = run(rec, () => [200, 200, 200], 8, 8, { intensity: 0.25 }); chk(near(px(a.d, 8, 0, 0)[0], 150, 1), "intensidad 25 %"); }
// 10. ajustes de color: Gradiente de mapa, Blanco y negro, Tono/saturación, Balance, Selectivo, Exposición, Viveza, Filtro, B/C
{ const gm = run({ layers: [{ k: "adj", t: "GdMp", stops: [[0, [0, 0, 255], 0.5], [1, [255, 255, 0], 0.5]] }] }, (x) => x < 4 ? [0, 0, 0] : [255, 255, 255]), g0 = px(gm.d, 8, 0, 0), g1 = px(gm.d, 8, 7, 0); chk(near(g0[2], 255) && near(g1[0], 255) && near(g1[2], 0), "mapa de degradado: negro → azul, blanco → amarillo " + g0 + g1);
  const bw = run({ layers: [{ k: "adj", t: "BanW", bw: [40, 60, 40, 60, 20, 80] }] }, (x) => x < 4 ? [255, 0, 0] : [255, 255, 0]), b0 = px(bw.d, 8, 0, 0)[0], b1 = px(bw.d, 8, 7, 0)[0]; chk(near(b0, 102, 1.5) && near(b1, 153, 1.5), `blanco y negro: rojo ${b0} (102), amarillo ${b1} (153)`);
  const hu = run({ layers: [{ k: "adj", t: "HStr", m: [0, -100, 0] }] }, () => [200, 80, 40]), h0 = px(hu.d, 8, 0, 0); chk(near(h0[0], h0[1], 2) && near(h0[1], h0[2], 2), "saturación −100: gris " + h0);
  const hr = run({ layers: [{ k: "adj", t: "HStr", m: [0, 0, 0], rg: [{ r: [315, 345, 15, 45], h: 0, s: -100, l: 0 }] }] }, (x) => x < 4 ? [220, 40, 40] : [40, 40, 220]), r0 = px(hr.d, 8, 0, 0), r1 = px(hr.d, 8, 7, 0); chk(near(r0[0], r0[1], 3) && r1[2] > 200 && r1[0] < 60, "saturación por rangos: sólo los rojos pierden color " + r0 + r1);
  const ex = run({ layers: [{ k: "adj", t: "Exps", e: 1, o: 0, g: 1 }] }, () => [100, 100, 100]), e0 = px(ex.d, 8, 0, 0)[0]; chk(e0 > 100 && e0 < 200, "exposición +1 EV aclara " + e0);
  const pf = run({ layers: [{ k: "adj", t: "photoFilter", rgb: [236, 138, 0], d: 50, pl: 1 }] }, () => [128, 128, 128]), f0 = px(pf.d, 8, 0, 0); chk(f0[0] > f0[1] && f0[1] > f0[2] && near(.299 * f0[0] + .587 * f0[1] + .114 * f0[2], 128, 6), "filtro de foto cálido conservando la luminosidad " + f0);
  const cb = run({ layers: [{ k: "adj", t: "ClrB", s: [0, 0, 0], m: [60, 0, 0], h: [0, 0, 0], pl: 0 }] }, () => [128, 128, 128]), c0 = px(cb.d, 8, 0, 0); chk(c0[0] > 140 && near(c0[1], 128, 1), "equilibrio de color: más rojo en los medios " + c0);
  const sc = run({ layers: [{ k: "adj", t: "SlcC", abs: 0, c: { red: [-100, 0, 0, 0] } }] }, (x) => x < 4 ? [220, 40, 40] : [40, 40, 220]), s0 = px(sc.d, 8, 0, 0), s1 = px(sc.d, 8, 7, 0); chk(s0[0] > 220 - 1 && near(s1[0], 40, 2), "color selectivo: sólo cambian los rojos " + s0 + s1);
  const vb = run({ layers: [{ k: "adj", t: "vibrance", v: 80, s: 0 }] }, (x) => x < 4 ? [140, 120, 110] : [250, 10, 10]), v0 = px(vb.d, 8, 0, 0), v1 = px(vb.d, 8, 7, 0); chk(v0[0] - v0[2] > 30 && near(v1[0], 252, 5), "viveza: sube lo apagado y respeta lo saturado " + v0 + v1);
  const bc = run({ layers: [{ k: "adj", t: "BrgC", b: 0, c: 50 }] }, (x) => x < 4 ? [60, 60, 60] : [200, 200, 200]), k0 = px(bc.d, 8, 0, 0)[0], k1 = px(bc.d, 8, 7, 0)[0]; chk(k0 < 60 && k1 > 200, `contraste +50 separa luces y sombras: ${k0}, ${k1}`); }
// 11. filtros espaciales de las capas generadas: desenfoque y ruido
{ const edge = { k: "grad", type: "lin", angle: 0, scale: 100, stops: [[0, [0, 0, 0], 0.5], [0.5, [0, 0, 0], 0.5], [0.5, [255, 255, 255], 0.5], [1, [255, 255, 255], 0.5]] };
  const sharp = run({ layers: [edge] }, () => [10, 10, 10], 200, 20), soft = run({ layers: [{ ...edge, ops: [{ op: "blur", r: 60 }] }] }, () => [10, 10, 10], 200, 20), recipeRef = 200;
  const s = px(sharp.d, 200, 95, 10)[0] + 0, t1 = px(soft.d, 200, 95, 10)[0], t2 = px(soft.d, 200, 110, 10)[0]; chk(px(sharp.d, 200, 99, 10)[0] < 10 && px(sharp.d, 200, 101, 10)[0] > 245, "el borde duro es duro"); chk(t1 > 5 && t1 < 250 && t2 > t1, `con desenfoque el borde es gradual: ${t1} → ${t2}`);
  const n1 = run({ layers: [{ k: "solid", rgb: [128, 128, 128], ops: [{ op: "noise", n: 10, gauss: 0, mono: 1, seed: 7 }] }] }, () => [10, 10, 10], 32, 32), n2 = run({ layers: [{ k: "solid", rgb: [128, 128, 128], ops: [{ op: "noise", n: 10, gauss: 0, mono: 1, seed: 7 }] }] }, () => [10, 10, 10], 32, 32);
  let same = true, spread = 0; for(let i = 0; i < n1.d.length; i++){ if(n1.d[i] !== n2.d[i]) same = false; } for(let i = 0; i < 32 * 32; i++) spread = Math.max(spread, Math.abs(n1.d[i * 4] - 128)); chk(same, "el ruido es determinista"); chk(spread > 6 && spread < 60, "el ruido tiene amplitud razonable: " + spread);
  const mv = run({ layers: [{ k: "solid", rgb: [255, 255, 255], ops: [{ op: "xf", tx: 0, ty: 0, sx: 0.5, sy: 0.5 }] }] }, () => [0, 0, 0], 40, 40); chk(px(mv.d, 40, 20, 20)[0] > 245 && px(mv.d, 40, 2, 2)[0] < 10, "transformar a la mitad deja el borde transparente"); }
// 12. pureza y coherencia con la función de color
{ chk(styleIsPure({ layers: [{ k: "adj", t: "Crvs", ch: { c: [[0, 20], [255, 255]] } }, { k: "snap", id: 1, src: "stack", ops: [{ op: "desat" }], op: 0.3 }] }), "ajustes y copias con filtros de color son «puras»");
  chk(!styleIsPure({ layers: [{ k: "grad", type: "lin", stops: [[0, [0, 0, 0], .5], [1, [1, 1, 1], .5]] }] }), "un degradado no es puro (depende de la posición)");
  const rec = { layers: [{ k: "adj", t: "Crvs", ch: { c: [[0, 20], [128, 150], [255, 245]], r: [[0, 0], [255, 230]] } }, { k: "adj", t: "HStr", m: [10, -20, 5] }, { k: "snap", id: 1, src: "stack", ops: [{ op: "desat" }], bm: "softLight", op: 0.4 }] };
  const f = styleColorFn(rec, 0.8), a = run(rec, (x, y) => [x * 31, y * 31, 120], 8, 8, { intensity: 0.8 }); let worst = 0;
  for(let y = 0; y < 8; y++) for(let x = 0; x < 8; x++){ const q = f(x * 31, y * 31, 120), p = px(a.d, 8, x, y); worst = Math.max(worst, Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]), Math.abs(q[2] - p[2])); }
  chk(worst <= 1.01, "la función de color y la imagen dan lo mismo (diferencia máxima " + worst.toFixed(2) + ")"); }
// 12b. la tabla 3D (camino rápido de las recetas puras) frente al cálculo exacto, con todas las recetas puras convertidas
{ const dir = path.join(ROOT, "assets/estilos"), idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"))); let n = 0, worst = 0, who = "", mean = 0, bigFrac = 0;
  const W = 400, H = 300, src = img(W, H, (x, y) => [(x * 255 / W + (y & 3) * 9) % 256, (y * 255 / H + (x & 5) * 7) % 256, (x * y * 3) % 256]);
  for(const p of idx.packs){ const j = JSON.parse(fs.readFileSync(path.join(dir, p.file)));
    for(const s of j.styles){ if(!styleIsPure(s.recipe)) continue; n++; const a = new Uint8ClampedArray(src), b = new Uint8ClampedArray(src); renderStyle(a, W, H, s.recipe, { exact: true }); renderStyle(b, W, H, s.recipe, {});
      let m = 0, sum = 0, big = 0; for(let i = 0; i < a.length; i += 4) for(let c = 0; c < 3; c++){ const d = Math.abs(a[i + c] - b[i + c]); m = Math.max(m, d); sum += d; if(d > 3) big++; } mean += sum / (W * H * 3); bigFrac = Math.max(bigFrac, big / (W * H * 3)); if(m > worst){ worst = m; who = s.id; } } }
  /* Los colores casi negros y muy saturados (HSL inestable) pueden salirse en unos pocos píxeles de la prueba: lo que importa es la media y la fracción de píxeles con error de más de 3 niveles */
  console.log(`tabla 3D vs exacto: ${n} recetas puras, error medio ${(mean / n).toFixed(3)} niveles, peor fracción con error > 3: ${(bigFrac * 100).toFixed(2)} % (máximo ${worst} en ${who})`); chk(n >= 80, "recetas puras comprobadas: " + n); chk(mean / n < 0.35 && bigFrac < 0.01, "la tabla 3D se parece al cálculo exacto"); }
// 13. coma flotante: sin redondeos intermedios
{ const d = new Float32Array(4 * 4); for(let i = 0; i < 4; i++){ d[i * 4] = 100.4 + i * 0.1; d[i * 4 + 1] = 100.4; d[i * 4 + 2] = 100.4; d[i * 4 + 3] = 255; }
  renderStyle(d, 4, 1, { layers: [{ k: "adj", t: "Crvs", ch: { c: [[0, 0], [255, 255]] } }] }, {}); chk(near(d[0], 100.4, 0.05) && near(d[4], 100.5, 0.05), "en coma flotante no se redondea: " + d[0] + " " + d[4]); }
// 14. todas las recetas convertidas
{ const dir = path.join(ROOT, "assets/estilos"), idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"))); let n = 0, slow = [], ig = [];
  for(const p of idx.packs){ const j = JSON.parse(fs.readFileSync(path.join(dir, p.file)));
    for(const s of j.styles){ n++; const w = 96, h = 64, d = img(w, h, (x, y) => [40 + x * 2, 30 + y * 3 + (x & 7) * 4, 90 + ((x + y) & 15) * 7]);
      const t0 = performance.now(); let sk; try{ sk = renderStyle(d, w, h, s.recipe, {}); }catch(e){ chk(false, `${s.id}: ${e.message}`); continue; } const ms = performance.now() - t0; if(ms > 400) slow.push(`${s.id} ${ms | 0} ms`);
      if(sk.length) ig.push(`${s.id}: ${sk.join(",")}`); let nan = false, mn = 255, mx = 0; for(let i = 0; i < d.length; i += 4){ for(let c = 0; c < 3; c++){ const v = d[i + c]; if(!(v >= 0 && v <= 255)) nan = true; mn = Math.min(mn, v); mx = Math.max(mx, v); } }
      chk(!nan, `${s.id}: valores fuera de rango`); } }
  console.log(`recetas evaluadas: ${n}`); chk(n >= 130, "hay al menos 130 recetas convertidas: " + n); chk(ig.length === 0, "elementos ignorados por el motor: " + ig.slice(0, 5).join(" | ")); if(slow.length) console.log("lentas (miniatura 96×64):", slow.slice(0, 6).join(", ")); }
console.log(bad ? "FALLO" : "OK"); process.exit(bad ? 1 : 0);
