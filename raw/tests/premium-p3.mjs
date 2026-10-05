// Pruebas del revelado Premium en Display P3 (v249). Se ejecuta igual que
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
    const { renderPremiumRows, renderPremiumCanvas } = await import("/raw/premium/render.js");
    const { tiff16 } = await import("/raw/premium/output.js");
    const ICC = await import("/js/core/icc.js"), CS = await import("/js/core/colorspace.js");
    const out = { p3: CS.p3Supported() };
    const p3ToSrgb = ICC.rgbMatrix("display-p3", "srgb");
    const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4, enc = v => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    // OKLab de un RGB lineal sRGB (admite valores fuera de [0,1])
    const okl = (r, g, b) => { const l = Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), m = Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), s = Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
      return [0.2104542553*l+0.7936177850*m-0.0040720468*s, 1.9779984951*l-2.4285922050*m+0.4505937099*s, 0.0259040371*l+0.7827717662*m-0.8086757660*s]; };
    const fromSrgb8 = (r, g, b) => okl(lin(r / 255), lin(g / 255), lin(b / 255));
    const fromP3_8 = (r, g, b) => { const v = [r, g, b].map(x => lin(x / 255)); const s = p3ToSrgb.map(row => row[0]*v[0]+row[1]*v[1]+row[2]*v[2]); return okl(s[0], s[1], s[2]); };
    const W = 480, H = 320;
    const scene = (x, y) => {
      if(y < 100) return [0.25 + y / 400, 0.35 + y / 500, 0.7];
      if(x < 120) return [0.02, 0.45, 0.04];                      // verde de Rec.2020: fuera de sRGB, casi dentro de P3
      if(x < 240) return [0.6, 0.03, 0.02];
      if(x < 360){ const t = (y - 100) / 220; const v = 0.18 * 2 ** (t * 8 - 6); return [v, v, v]; }
      return [0.1, 0.12, 0.08];
    };
    const bytes = colorDng(W, H, scene);
    const dec = await RawDecoder.open(new File([bytes], "p.dng"), { ...defaults(), premium: true });
    const src = dec.source;
    const base = { ...defaults(), premium: true };
    const sr = renderPremiumRows(src, { ...base, space: "srgb" }, 0, H, W, H, 8), p3 = renderPremiumRows(src, { ...base, space: "display-p3" }, 0, H, W, H, 8);
    const px = (a, x, y) => [a[(y * W + x) * 4], a[(y * W + x) * 4 + 1], a[(y * W + x) * 4 + 2]];
    const chroma = ab => Math.hypot(ab[1], ab[2]), hue = ab => Math.atan2(ab[2], ab[1]) * 180 / Math.PI;
    const cmp = (x, y) => { const a = fromSrgb8(...px(sr, x, y)), b = fromP3_8(...px(p3, x, y)); return { srgb: px(sr, x, y), p3: px(p3, x, y), cSrgb: +chroma(a).toFixed(4), cP3: +chroma(b).toFixed(4), hSrgb: +hue(a).toFixed(1), hP3: +hue(b).toFixed(1), dL: +Math.abs(a[0] - b[0]).toFixed(4) }; };
    out.verde = cmp(60, 200); out.rojo = cmp(180, 200); out.gris = cmp(300, 200); out.suave = cmp(420, 200); out.cielo = cmp(60, 50);
    // GPU ≡ CPU en P3
    const proxy = resizeLinear(src, W, H, "premium");
    const cv = document.createElement("canvas"), gpu = new GPUPreview(cv); gpu.setSource(proxy);
    const pg = new PremiumGPU(gpu), gl = gpu.gl, deltas = [];
    for(const s of [{}, { exposure: 1, contrast: 40, saturation: 40 }, { shadows: 70, highlights: -70, clarity: 60, vibrance: 50 }]){
      const st = normalize({ ...defaults(), ...s, premium: true, space: "display-p3" });
      pg.render(st, false, [W, H]);
      out.gpuEspacio = gl.drawingBufferColorSpace;
      const g = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, g);
      const cpu = renderPremiumRows(proxy, st, 0, H, W, H, 8);
      let sum = 0, max = 0;
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
        const gi = ((H - 1 - y) * W + x) * 4, ci = (y * W + x) * 4, a = fromP3_8(g[gi], g[gi+1], g[gi+2]), b = fromP3_8(cpu[ci], cpu[ci+1], cpu[ci+2]);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100; sum += d; max = Math.max(max, d);
      }
      deltas.push({ mean: sum / (W * H), max });
    }
    out.gpuCpu = deltas;
    // Lienzo de salida y TIFF con perfil
    const cvP3 = renderPremiumCanvas(src, { ...base, space: "display-p3" }, { region: { y: 0, height: 20 } }), cvS = renderPremiumCanvas(src, { ...base, space: "srgb" }, { region: { y: 0, height: 20 } });
    out.lienzo = { p3: cvP3.getContext("2d").getContextAttributes().colorSpace, srgb: cvS.getContext("2d").getContextAttributes().colorSpace };
    const px16 = renderPremiumRows(src, { ...base, space: "display-p3" }, 0, H, W, H, 16), tif = new Uint8Array(await tiff16(px16, W, H, "display-p3").arrayBuffer()), v = new DataView(tif.buffer);
    const ifd = v.getUint32(4, true), n = v.getUint16(ifd, true); let icc = null, strip = 0;
    for(let k = 0; k < n; k++){ const p = ifd + 2 + k * 12, id = v.getUint16(p, true); if(id === 34675) icc = tif.slice(v.getUint32(p + 8, true), v.getUint32(p + 8, true) + v.getUint32(p + 4, true)); if(id === 273) strip = v.getUint32(p + 8, true); }
    const prof = ICC.profileFor("display-p3");
    out.tiff = { icc: !!icc, mismo: !!icc && icc.length === prof.length && icc.every((x, i) => x === prof[i]), dato: v.getUint16(strip + ((200 * W + 60) * 3 + 1) * 2, true) === px16[(200 * W + 60) * 3 + 1], tam: tif.length };
    out.tiffSrgb = (await tiff16(px16, W, H)).size === W * H * 6 + 182;
    dec.dispose(); pg.dispose(); gpu.dispose();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  if(!r.p3){ console.log("Este Chromium no admite lienzos P3: prueba omitida"); }
  else{
    const dh = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    // El verde de Rec.2020 está fuera de sRGB: con P3 conserva más croma (el mapeo de gama lo recorta menos), con el mismo tono y la misma luminosidad
    assert.ok(r.verde.cP3 > r.verde.cSrgb * 1.04, `P3 conserva más croma en el verde: ${r.verde.cP3} vs ${r.verde.cSrgb}`);
    assert.ok(dh(r.verde.hP3, r.verde.hSrgb) < 4, `tono del verde ${r.verde.hP3} vs ${r.verde.hSrgb}`); assert.ok(r.verde.dL < 0.01, "luminosidad del verde");
    assert.ok(r.rojo.cP3 >= r.rojo.cSrgb * 0.995, "el rojo no pierde croma en P3"); assert.ok(dh(r.rojo.hP3, r.rojo.hSrgb) < 4, "tono del rojo");
    // Colores dentro de sRGB: los dos espacios dan el mismo color (los números P3 son distintos, el color no)
    for(const k of ["gris", "suave", "cielo"]){ const c = r[k]; assert.ok(Math.abs(c.cP3 - c.cSrgb) < 0.01 && c.dL < 0.01 && (c.cSrgb < 0.01 || dh(c.hP3, c.hSrgb) < 3), `${k}: mismo color en sRGB y P3 ${JSON.stringify(c)}`); }
    assert.ok(r.gris.srgb.every((v, i) => Math.abs(v - r.gris.p3[i]) <= 1), "los grises son iguales número a número");
    assert.equal(r.gpuEspacio, "display-p3", "la vista previa de la GPU debe estar en P3");
    for(const d of r.gpuCpu){ assert.ok(d.mean < 0.05, `ΔE medio GPU/CPU en P3 ${d.mean}`); assert.ok(d.max < 1, `ΔE máximo GPU/CPU en P3 ${d.max}`); }
    assert.equal(r.lienzo.p3, "display-p3"); assert.equal(r.lienzo.srgb, "srgb");
    assert.ok(r.tiff.icc && r.tiff.mismo && r.tiff.dato, "TIFF de 16 bits con perfil Display P3 y datos intactos"); assert.ok(r.tiffSrgb, "TIFF sRGB sin cambios");
  }
  assert.deepEqual(errors, []);
  console.log("revelado Premium en P3: todo correcto");
}finally{ await browser.close(); server.close(); }
