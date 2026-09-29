// Pruebas del revelado Premium (raw/premium/). Se ejecuta igual que
// rendering.mjs: RAW_PLAYWRIGHT apunta al index.mjs de Playwright y
// RAW_BROWSER (opcional) al ejecutable de Chromium.
// Sin fotografías: los RAW se generan (DNG Bayer en color, Rec.2020).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const { chromium } = await import(pathToFileURL(process.env.RAW_PLAYWRIGHT).href);
const root = fileURLToPath(new URL("../../", import.meta.url));
const server = createServer(async (req, res) => {
  try{
    if(req.url === "/test.html"){ res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><meta charset="utf-8"><body>'); return; }
    const filename = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if(!filename.startsWith(root)) throw new Error("Outside project");
    res.setHeader("Content-Type", filename.endsWith(".wasm") ? "application/wasm" : "application/javascript");
    res.end(await readFile(filename));
  }catch{ res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.RAW_BROWSER || undefined, headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/test.html`);
  const r = await page.evaluate(async () => {
    const { colorDng } = await import("/raw/tests/dng-color-fixture.js");
    const { RawDecoder } = await import("/raw/decoder.js");
    const { defaults, normalize } = await import("/raw/state.js");
    const { resizeLinear } = await import("/raw/source.js");
    const { GPUPreview } = await import("/raw/gpu-preview.js");
    const { PremiumGPU } = await import("/raw/premium/gpu.js");
    const { renderPhoto } = await import("/raw/pipeline.js");
    const { renderPremiumRows } = await import("/raw/premium/render.js");
    const { bt709Decode } = await import("/raw/premium/core.js");
    const { tiff16 } = await import("/raw/premium/output.js");
    const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    const lab = (r, g, b) => { r = lin(r / 255); g = lin(g / 255); b = lin(b / 255);
      const l = Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), m = Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), s = Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
      return [0.2104542553*l+0.7936177850*m-0.0040720468*s, 1.9779984951*l-2.4285922050*m+0.4505937099*s, 0.0259040371*l+0.7827717662*m-0.8086757660*s]; };
    const out = {};
    // Escena: degradado, parches fuera de sRGB, escala de grises y ruido
    const W = 480, H = 320;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const noise = Float32Array.from({ length: W * H }, () => (rnd() - 0.5) * 0.03);
    const scene = (x, y) => {
      if(y < 100) return [0.25 + y / 400, 0.35 + y / 500, 0.7];
      if(x < 120) return [0.02, 0.45, 0.04];                      // verde de Rec.2020, fuera de sRGB
      if(x < 240) return [0.6, 0.03, 0.02];
      if(x < 360){ const t = (y - 100) / 220; const v = 0.18 * 2 ** (t * 8 - 6); return [v, v, v]; }
      return [0.1 + noise[y * W + x], 0.12 + noise[y * W + x], 0.08];
    };
    const bytes = colorDng(W, H, scene);
    // 1. Motor: Rec.2020 exacto tras deshacer la curva BT.709
    const dec = await RawDecoder.open(new File([bytes], "p.dng"), { ...defaults(), premium: true });
    const src = dec.source;
    const at = (x, y) => [0, 1, 2].map(c => bt709Decode(src.data[(y * W + x) * 3 + c] / 65536) * src.gain);
    const g = at(60, 200), rd = at(180, 200);
    out.decode = { space: src.space, gain: src.gain, green: g.map(v => +v.toFixed(3)), red: rd.map(v => +v.toFixed(3)) };
    // 2. GPU ≡ CPU (ΔE OKLab ×100)
    const proxy = resizeLinear(src, W, H, "premium");
    const cv = document.createElement("canvas"), gpu = new GPUPreview(cv); gpu.setSource(proxy);
    const pg = new PremiumGPU(gpu), gl = gpu.gl, deltas = [];
    for(const s of [{}, { exposure: 1, contrast: 40, whites: 30, blacks: -30 }, { shadows: 70, highlights: -70, clarity: 60, dehaze: 40 },
                    { noise: 60, colorNoise: 70, texture: 40, sharpen: 60 }, { saturation: 50, vibrance: -40, hue: 30, vignette: 50, lensVignette: -30, grain: 30 }]){
      const st = normalize({ ...defaults(), ...s, premium: true });
      pg.render(st, false, [W, H]);
      const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const cd = renderPhoto(proxy, st).getContext("2d").getImageData(0, 0, W, H).data;
      let sum = 0, max = 0;
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
        const gi = ((H - 1 - y) * W + x) * 4, ci = (y * W + x) * 4, a = lab(px[gi], px[gi+1], px[gi+2]), b = lab(cd[ci], cd[ci+1], cd[ci+2]);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100; sum += d; max = Math.max(max, d);
      }
      deltas.push({ mean: sum / (W * H), max });
    }
    out.gpuCpu = deltas;
    // 3. Tono: escala de grises monótona, gris medio y sin recorte duro
    const tone = renderPremiumRows(src, { ...defaults(), premium: true }, 0, H, W, H, 8);
    const col = x => { const v = []; for(let y = 102; y < 318; y++) v.push(tone[(y * W + x) * 4 + 1]); return v; };
    const grey = col(300); let mono = true; for(let i = 1; i < grey.length; i++) if(grey[i] + 1 < grey[i - 1]) mono = false;
    out.tone = { monotonic: mono, darkest: grey[0], brightest: grey.at(-1) };
    // 4. Color: el verde fuera de gama conserva el tono (antes se recortaba un canal)
    const std = await RawDecoder.open(new File([bytes], "p.dng"), defaults());
    const stdOut = renderPhoto(std.source, defaults()).getContext("2d").getImageData(60, 200, 1, 1).data;
    const premOut = tone.slice((200 * W + 60) * 4, (200 * W + 60) * 4 + 3);
    const refLab = (() => { const M = [[1.6605, -0.5876, -0.0728], [-0.1246, 1.1329, -0.0083], [-0.0182, -0.1006, 1.1187]]; const s = M.map(r => r[0] * .02 + r[1] * .45 + r[2] * .04);
      const l = Math.cbrt(0.4122214708*s[0]+0.5363325363*s[1]+0.0514459929*s[2]), m = Math.cbrt(0.2119034982*s[0]+0.6806995451*s[1]+0.1073969566*s[2]), q = Math.cbrt(0.0883024619*s[0]+0.2817188376*s[1]+0.6299787005*s[2]);
      return [1.9779984951*l-2.4285922050*m+0.4505937099*q, 0.0259040371*l+0.7827717662*m-0.8086757660*q]; })();
    const hue = ab => Math.atan2(ab[1], ab[0]) * 180 / Math.PI;
    const hPrem = hue(lab(...premOut).slice(1)), hStd = hue(lab(stdOut[0], stdOut[1], stdOut[2]).slice(1)), hRef = hue(refLab);
    out.hue = { reference: +hRef.toFixed(1), premium: +hPrem.toFixed(1), standard: +hStd.toFixed(1) };
    std.dispose();
    // 5. Franjas sin costuras y reducción en luz lineal
    const st = { ...defaults(), premium: true, clarity: 50, noise: 40, sharpen: 50 };
    const whole = renderPremiumRows(src, st, 0, H, W, H, 8);
    let seams = 0; for(let d0 = 0; d0 < H; d0 += 37){ const d1 = Math.min(H, d0 + 37), part = renderPremiumRows(src, st, d0, d1, W, H, 8); for(let i = 0; i < part.length; i++) if(part[i] !== whole[d0 * W * 4 + i]) seams++; }
    const small = renderPremiumRows(src, st, 0, 160, 240, 160, 8);
    out.strips = { differentBytes: seams, smallBytes: small.length };
    // 6. TIFF de 16 bits
    const px16 = renderPremiumRows(src, st, 0, H, W, H, 16), tif = new Uint8Array(await tiff16(px16, W, H).arrayBuffer());
    out.tiff = { size: tif.length, magic: [...tif.slice(0, 4)], expected: W * H * 6 + 182, distinct: new Set(px16).size };
    dec.dispose(); pg.dispose(); gpu.dispose();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  assert.equal(r.decode.space, "rec2020");
  for(const [a, b] of [[r.decode.green, [0.02, 0.45, 0.04]], [r.decode.red, [0.6, 0.03, 0.02]]]) a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 0.02, `Rec.2020 exacto: ${a} ≈ ${b}`));
  for(const d of r.gpuCpu){ assert.ok(d.mean < 0.05, `ΔE medio GPU/CPU ${d.mean}`); assert.ok(d.max < 1, `ΔE máximo GPU/CPU ${d.max}`); }
  assert.ok(r.tone.monotonic, "curva monótona");
  assert.ok(r.tone.darkest < 20 && r.tone.brightest > 200, `rango tonal ${r.tone.darkest}..${r.tone.brightest}`);
  const dh = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  assert.ok(dh(r.hue.premium, r.hue.reference) < 4, `tono conservado ${r.hue.premium} vs ${r.hue.reference}`);
  assert.equal(r.strips.differentBytes, 0, "las franjas coinciden con el revelado entero");
  assert.equal(r.strips.smallBytes, 240 * 160 * 4);
  assert.deepEqual(r.tiff.magic, [73, 73, 42, 0]); assert.equal(r.tiff.size, r.tiff.expected);
  assert.ok(r.tiff.distinct > 1000, "16 bits reales");
  assert.deepEqual(errors, []);
  console.log("revelado Premium: todo correcto");
}finally{ await browser.close(); server.close(); }
