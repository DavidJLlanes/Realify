/* Prueba de la mezcla de «Panorámica» (plugins/panorama/engine.js, fusión "multiband", y multiband.js), sin navegador: dos fotos perfectamente
   alineadas de una misma escena con textura, una 25 % más clara, y un objeto (disco magenta) que sólo sale en una de ellas dentro del solape.
   La mezcla multibanda debe: no dejar el objeto a medias (sin dobles), no dejar escalón de exposición, y ser claramente mejor que la mezcla
   por distancia al borde ("seam"). Se repite con las fotos una sobre otra (costura horizontal).
   Uso: node tests/panorama-mezcla.mjs */
import { placed, compose } from "../plugins/panorama/engine.js";
const hash = (x, y) => { let v = Math.imul(x * 73856093 ^ y * 19349663, 0x85ebca6b); v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16; return (v >>> 0) / 4294967296; };
const noise = (u, v) => { const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, s = t => t * t * (3 - 2 * t), a = hash(x, y), b = hash(x + 1, y), c = hash(x, y + 1), d = hash(x + 1, y + 1); return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy); };
const scene = (x, y) => 0.25 + 0.5 * (0.5 * noise(x / 90, y / 90) + 0.3 * noise(x / 25, y / 25) + 0.2 * noise(x / 7, y / 7));   // luz lineal 0.25–0.75
const W = 800, H = 600, OV = 300;
function make(pos, gains, discs){
  return pos.map((p, i) => {
    const data = new Uint8ClampedArray(W * H * 4);
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const o = (y * W + x) * 4; let r, g, b;
      const d = discs[i] && Math.hypot(x + p.x - discs[i].x, y + p.y - discs[i].y) < discs[i].r;
      if(d){ r = 255; g = 0; b = 255; }
      else { const v = Math.min(1, scene(x + p.x, y + p.y) * gains[i]), e = (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255; r = e; g = e; b = e; }
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
    return { w: W, h: H, data };
  });
}
const lum = (d, o) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
function measure(out, blobBox, rect, horizontal){
  let blob = 0, partial = 0;
  for(let y = blobBox.y0; y < blobBox.y1; y++) for(let x = blobBox.x0; x < blobBox.x1; x++){
    const o = ((y - rect.y) * out.w + (x - rect.x)) * 4, m = (out.data[o] + out.data[o + 2]) / 2 - out.data[o + 1];   // 0 en gris, 255 en magenta
    if(m > 60){ blob++; if(m < 200) partial++; }
  }
  // Escalón de exposición: mayor salto entre medias de columnas (o filas) contiguas, sin el disco
  let step = 0, prev = null; const n = horizontal ? out.h : out.w, m = horizontal ? out.w : out.h;
  for(let a = 0; a < n; a++){
    let s = 0, c = 0;
    for(let b = 0; b < m; b++){ const o = horizontal ? (a * out.w + b) * 4 : (b * out.w + a) * 4; if((out.data[o] + out.data[o + 2]) / 2 - out.data[o + 1] > 60) continue; s += lum(out.data, o); c++; }
    const v = c ? s / c : prev; if(prev != null && v != null) step = Math.max(step, Math.abs(v - prev)); prev = v;
  }
  return { blob, partial, step };
}
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
for(const horizontal of [false, true]){
  const pos = horizontal ? [{ x: 0, y: 0 }, { x: 0, y: H - OV }] : [{ x: 0, y: 0 }, { x: W - OV, y: 0 }];
  const disc = horizontal ? { x: W / 2, y: H - OV / 2, r: 45 } : { x: W - OV / 2, y: H / 2, r: 45 }, blobBox = { x0: Math.round(disc.x - 50), x1: Math.round(disc.x + 50), y0: Math.round(disc.y - 50), y1: Math.round(disc.y + 50) };
  const imgs = make(pos, [1, 1.25], [null, disc]), L = placed(imgs, pos), r = {};
  for(const fusion of ["seam", "multiband"]){
    const t0 = performance.now(), out = compose(imgs, L, { fusion, crop: false });
    r[fusion] = { ...measure(out, blobBox, { x: 0, y: 0 }, horizontal), ms: Math.round(performance.now() - t0) };
  }
  console.log(horizontal ? "horizontal" : "vertical  ", "seam:", JSON.stringify(r.seam), "· multiband:", JSON.stringify(r.multiband));
  const tag = horizontal ? "costura horizontal: " : "costura vertical: ";
  chk(r.multiband.blob === 0 || r.multiband.blob > 3000 && r.multiband.partial / r.multiband.blob < 0.15, tag + "el objeto queda a medias");
  chk(r.multiband.step < 4, tag + `escalón de exposición ${r.multiband.step.toFixed(1)} ≥ 4`);
  chk(r.seam.blob > 0 && r.seam.partial > r.multiband.partial * 2 + 50, tag + "debería haber menos doble que con «seam»");
}
console.log(bad ? "panorama-mezcla: FALLO" : "panorama-mezcla: OK"); process.exit(bad ? 1 : 0);
