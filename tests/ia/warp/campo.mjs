/* Prueba en Node del motor de deformación (js/features/warp): campo MLS, plegados, protegidas, rectas, render CPU y fondo. */
import assert from "node:assert/strict";
import { campoMLS, limitar, minDet, adelante, muestrear, crearCampo, deformarCPU, descubierto, rellenar, enderezar } from "../../../js/features/warp/index.js";

const W = 160, H = 120;
let rnd = 7; const R = () => (rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296;

/* 1 · sin manos el campo es la identidad */
{ const c = campoMLS(W, H, []); assert.equal(Math.max(...c.dx.map(Math.abs), ...c.dy.map(Math.abs)), 0); }

/* 2 · una mano: el punto (x,y) acaba en (tx,ty) y los puntos fijos no se mueven */
for(const modo of ["similitud", "rigida", "afin"]){
  const manos = [{ x: 80, y: 60, tx: 92, ty: 56 }, { x: 40, y: 40, tx: 40, ty: 48 }];
  const c = campoMLS(W, H, manos, { modo, paso: 4, fijos: [{ x: 130, y: 90 }] });
  for(const m of manos){ const a = adelante(c, m.x, m.y); assert(Math.hypot(a.x - m.tx, a.y - m.ty) < 0.6, `${modo}: la mano llega a su destino (${a.x.toFixed(2)},${a.y.toFixed(2)})`); }
  const d = muestrear(c, 130, 90); assert(Math.hypot(d[0], d[1]) < 0.3, `${modo}: el punto fijo no se mueve`);
}

/* 3 · zona protegida: el campo es exactamente cero bajo la máscara */
{ const prot = new Float32Array(W * H); for(let y = 30; y < 90; y++) for(let x = 100; x < 150; x++) prot[y * W + x] = 1;
  const c = campoMLS(W, H, [{ x: 60, y: 60, tx: 85, ty: 60 }], { protegida: prot, paso: 4 });
  let max = 0, d = [0, 0]; for(let y = 30; y < 90; y++) for(let x = 100; x < 150; x++){ muestrear(c, x, y, d); max = Math.max(max, Math.abs(d[0]), Math.abs(d[1])); }
  assert.equal(max, 0, "zona protegida inmóvil");
  const lejos = muestrear(c, 60, 60); assert(Math.abs(lejos[0]) > 5, "fuera de la zona sí se mueve"); }

/* 4 · rectas: los destinos siguen alineados aunque la mano esté torcida */
{ const manos = [0, 1, 2, 3, 4].map(i => ({ x: 20 + i * 30, y: 60, tx: 20 + i * 30, ty: 60 + (i % 2 ? 6 : -6) }));
  const r = enderezar(manos, [[0, 1, 2, 3, 4]]);
  const [a, b] = [r[0], r[4]]; let max = 0;
  for(const p of r) max = Math.max(max, Math.abs((b.tx - a.tx) * (a.ty - p.ty) - (a.tx - p.tx) * (b.ty - a.ty)) / Math.hypot(b.tx - a.tx, b.ty - a.ty));
  assert(max < 1e-6, "destinos alineados (" + max + ")"); }

/* 5 · plegados: un campo suave no se reduce; uno exagerado sí y queda con determinante positivo */
{ const suave = campoMLS(W, H, [{ x: 80, y: 60, tx: 86, ty: 60 }], { paso: 4 });
  const s = limitar(suave); assert(!s.reducido && s.escala === 1 && s.minDet > 0.15, "campo suave intacto");
  const duro = campoMLS(W, H, [{ x: 70, y: 60, tx: 90, ty: 60 }, { x: 90, y: 60, tx: 70, ty: 60 }], { paso: 4, alpha: 2 });
  assert(minDet(duro) < 0.15, "el campo cruzado se pliega");
  const l = limitar(duro); assert(l.reducido && l.escala < 1 && l.minDet >= 0.149, "reducido hasta no plegar (escala " + l.escala.toFixed(2) + ")"); }

/* 6 · invertibilidad: adelante y atrás devuelven el mismo punto */
{ const c = limitar(campoMLS(W, H, [{ x: 60, y: 50, tx: 72, ty: 54 }, { x: 110, y: 80, tx: 104, ty: 74 }], { paso: 4 })).campo; let peor = 0;
  for(let k = 0; k < 200; k++){ const x = 5 + R() * (W - 10), y = 5 + R() * (H - 10), a = adelante(c, x, y), d = muestrear(c, a.x, a.y); peor = Math.max(peor, Math.hypot(a.x + d[0] - x, a.y + d[1] - y)); }
  assert(peor < 0.01, "ida y vuelta (" + peor + ")"); }

/* 7 · render CPU: identidad exacta, traslación entera, y el borde transparente no mancha */
{ const img = new Uint8ClampedArray(W * H * 4); for(let i = 0; i < W * H; i++){ img[i * 4] = (i * 7) % 256; img[i * 4 + 1] = (i * 13) % 256; img[i * 4 + 2] = (i * 29) % 256; img[i * 4 + 3] = 255; }
  for(const lineal of [true, false]){
    const id = deformarCPU(img, W, H, crearCampo(W, H), { lineal });
    let dif = 0; for(let i = 0; i < img.length; i++) dif = Math.max(dif, Math.abs(id[i] - img[i])); assert(dif <= 1, "identidad (" + lineal + "): " + dif);
    const c = crearCampo(W, H); c.dx.fill(3); const t = deformarCPU(img, W, H, c, { lineal }); let dt = 0;
    for(let y = 0; y < H; y++) for(let x = 0; x < W - 5; x++) for(let k = 0; k < 3; k++) dt = Math.max(dt, Math.abs(t[(y * W + x) * 4 + k] - img[(y * W + x + 3) * 4 + k]));
    assert(dt <= 1, "traslación 3 px (" + lineal + "): " + dt); }
  const rec = new Uint8ClampedArray(W * H * 4); for(let i = 0; i < W * H; i++){ const x = i % W; if(x > 60 && x < 100){ rec[i * 4] = 200; rec[i * 4 + 1] = 30; rec[i * 4 + 2] = 30; rec[i * 4 + 3] = 255; } else { rec[i * 4 + 2] = 255; } }
  const c = campoMLS(W, H, [{ x: 80, y: 60, tx: 88, ty: 60 }], { paso: 4 }), o = deformarCPU(rec, W, H, c);
  for(let i = 0; i < W * H; i++) if(o[i * 4 + 3] > 250) assert(o[i * 4 + 2] < 60, "sin halo azul en el recorte"); }

/* 8 · protegida en el render: los píxeles protegidos salen idénticos */
{ const img = new Uint8ClampedArray(W * H * 4); for(let i = 0; i < W * H; i++){ img[i * 4] = (i * 31) % 256; img[i * 4 + 1] = (i * 17) % 256; img[i * 4 + 2] = (i * 5) % 256; img[i * 4 + 3] = 255; }
  const prot = new Float32Array(W * H); for(let y = 20; y < 100; y++) for(let x = 100; x < 150; x++) prot[y * W + x] = 1;
  const o = deformarCPU(img, W, H, campoMLS(W, H, [{ x: 50, y: 60, tx: 75, ty: 60 }], { protegida: prot, paso: 4 })); let dif = 0;
  for(let y = 20; y < 100; y++) for(let x = 100; x < 150; x++) for(let k = 0; k < 3; k++) dif = Math.max(dif, Math.abs(o[(y * W + x) * 4 + k] - img[(y * W + x) * 4 + k]));
  assert(dif <= 1, "área protegida conservada: " + dif); }

/* 9 · fondo: lo que deja libre la persona se rellena y el resto no cambia */
{ const persona = new Float32Array(W * H); for(let y = 20; y < 110; y++) for(let x = 50; x < 110; x++) persona[y * W + x] = 1;
  const img = new Uint8ClampedArray(W * H * 4); for(let i = 0; i < W * H; i++){ const p = persona[i]; img[i * 4] = p ? 200 : 40; img[i * 4 + 1] = p ? 60 : 90; img[i * 4 + 2] = p ? 60 : 160; img[i * 4 + 3] = 255; }
  const c = campoMLS(W, H, [{ x: 50, y: 65, tx: 70, ty: 65 }, { x: 110, y: 65, tx: 90, ty: 65 }], { paso: 4 });   // estrecha por los dos lados
  const hueco = descubierto(persona, W, H, c, { dilatar: 2 }); let n = 0; for(const v of hueco) n += v;
  assert(n > 200, "hay zona descubierta (" + n + ")");
  const fake = async (rgba, hole, N) => { const o = new Uint8ClampedArray(rgba); for(let i = 0; i < N * N; i++) if(hole[i]){ o[i * 4] = 40; o[i * 4 + 1] = 90; o[i * 4 + 2] = 160; } return o; };
  const r = await rellenar({ rgba: img, W, H, hueco, inpaint: fake, N: 128 });
  let fuera = 0, dentro = 0;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const i = y * W + x, d = Math.abs(r[i * 4] - img[i * 4]);
    if(hueco[i] > 0.5){ if(Math.abs(r[i * 4] - 40) < 25) dentro++; } else if(d > 0 && x < 20) fuera++; }
  assert(dentro > n * 0.7, "el hueco se rellena de fondo (" + dentro + "/" + n + ")"); assert.equal(fuera, 0, "lejos del hueco nada cambia"); }

console.log("warp (campo): OK");
