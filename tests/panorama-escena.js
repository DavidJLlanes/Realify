/* Escena sintética de las pruebas de Panorámica (se importa DENTRO de la página, no en Node): un cilindro con textura de ruido de valor a varias
   escalas y de verdad conocida. `makeScene({ W, H, F })` devuelve { view(yawGrados) → lienzo, set({ contrast, noise }) }: cada vista es lo que
   vería una cámara de focal F (px) girada yawGrados. Sirve a tests/panorama-local.mjs, panorama-banco.mjs y panorama-ui.mjs. */
export function makeScene({ W = 960, H = 640, F = 760 } = {}){
  const hash = (x, y) => { let v = Math.imul(x * 73856093 ^ y * 19349663, 0x85ebca6b); v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16; return (v >>> 0) / 4294967296; };
  const noiseAt = (u, v) => { const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, s = t => t * t * (3 - 2 * t);
    const a = hash(x, y), b = hash(x + 1, y), c = hash(x, y + 1), d = hash(x + 1, y + 1);
    return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy); };
  let contrast = 1, noise = 0, seed = 5;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const scene = (az, ty) => 0.5 + contrast * (0.15 + 0.85 * (0.5 * noiseAt(az * 60, ty * 60) + 0.3 * noiseAt(az * 150, ty * 150) + 0.2 * noiseAt(az * 400, ty * 400)) - 0.5) + (noise ? (rnd() + rnd() + rnd() - 1.5) * noise / 255 * 2 : 0);
  const view = yaw => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true }), im = x.createImageData(W, H), y0 = yaw * Math.PI / 180;
    for(let j = 0; j < H; j++) for(let i = 0; i < W; i++){
      const px = (i - W / 2) / F, py = (j - H / 2) / F, az = y0 + Math.atan(px), ty = py / Math.hypot(1, px), v = Math.round(255 * scene(az, ty)), o = 4 * (j * W + i);
      im.data[o] = v; im.data[o + 1] = v * 0.92; im.data[o + 2] = v * 0.85; im.data[o + 3] = 255;
    }
    x.putImageData(im, 0, 0); return c;
  };
  return { view, W, H, F, set: o => { if(o.contrast !== undefined) contrast = o.contrast; if(o.noise !== undefined) noise = o.noise; } };
}
