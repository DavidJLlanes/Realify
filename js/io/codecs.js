/* ═══════════════════════════════════════════════════════════════
   GESTOR DE CÓDECS (fase 6 de PENDIENTE.md)
   Los códecs de imagen que el navegador no trae (AVIF, JPEG XL) son
   módulos WebAssembly de uno o dos megas: aquí viven todos, se cargan
   sólo al elegir su formato —o al abrir un archivo de ese formato— y
   se reutilizan después. Cada uno declara qué sabe hacer (profundidad
   de bits, transparencia, sin pérdidas) y con qué licencia viaja, y el
   diálogo Exportar lo usa para saber qué ofrecer y cuánto cuesta.

     · AVIF  — libaom/libavif (jSquash, Apache-2.0): 8, 10 y 12 bits.
               Con 10 y 12 bits recibe los 16 bits del motor de alta
               precisión (core/precision-stack.js): en una rampa oscura,
               8 bits conserva 26 niveles, 10 bits 103 y 12 bits 406.
               El archivo sale etiquetado sRGB o Display P3 (caja `colr`).
     · JPEG XL — libjxl (jSquash, Apache-2.0, versión monohilo): sólo
               8 bits de entrada; con o sin pérdidas.
     · OpenEXR — escritor propio (js/io/exr.js), sin WebAssembly.

   Estimación antes de exportar: se codifican unos recortes de la propia
   foto a la escala de salida y se mide cuánto pesan y cuánto se parecen
   al original una vez decodificados (PSNR). El peso total sale de los
   bytes por píxel de las muestras; sirve para decidir, no es exacto.
   ═══════════════════════════════════════════════════════════════ */

/* ── Registro ────────────────────────────────────────────────── */
export const CODECS = {
  avif: { label: "AVIF",       mime: "image/avif", ext: "avif", bits: [8, 10, 12], alpha: true,  lossless: true, wasm: "1,2 MB", license: "Apache-2.0 (libaom, libavif)" },
  jxl:  { label: "JPEG XL",    mime: "image/jxl",  ext: "jxl",  bits: [8],         alpha: true,  lossless: true, wasm: "1,4 MB", license: "Apache-2.0 (jSquash) · BSD-3-Clause (libjxl)" },
  exr:  { label: "OpenEXR",    mime: "image/x-exr", ext: "exr", bits: [16],        alpha: true,  lossless: true, wasm: null,     license: "código propio" }
};

const loaded = new Map();
const once = (key, make) => { if(!loaded.has(key)) loaded.set(key, make().catch(e => { loaded.delete(key); throw e; })); return loaded.get(key); };

export const avifEncoder = () => once("avif-enc", async () => (await import("../vendor/avif/avif_enc.js")).default({ noInitialRun: true }));
export const avifDecoder = () => once("avif-dec", async () => (await import("../vendor/avif/avif_dec.js")).default({ noInitialRun: true }));
export const jxlEncoder  = () => once("jxl-enc",  async () => (await import("../vendor/jxl/jxl_enc.js")).default({ noInitialRun: true }));
export const jxlDecoder  = () => once("jxl-dec",  async () => (await import("../vendor/jxl/jxl_dec.js")).default({ noInitialRun: true }));

/** Megapíxeles que un códec admite sin agotar la memoria (el codificador
    de AVIF o JPEG XL necesita varias veces el tamaño de la imagen). */
export function codecMaxPixels(){
  const mem = navigator.deviceMemory || 8;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return (coarse || mem <= 4) ? 8e6 : 24e6;
}

/* ── Utilidades ──────────────────────────────────────────────── */
const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/** 16 bits → `bits` bits (RGBA, Uint16 en el rango de esa profundidad: es lo
    que espera el codificador). Con `dither`, un tramado de ±½ nivel que
    reparte el error de redondeo y evita escalones en degradados. */
export function toBitDepthRGBA(data16, channels, width, height, bits, dither = true){
  const max = (1 << bits) - 1, k = max / 65535, n = width * height, out = new Uint16Array(n * 4);
  for(let p = 0, i = 0, o = 0; p < n; p++, i += channels, o += 4){
    for(let c = 0; c < 3; c++){
      const v = Math.round(data16[i + c] * k + (dither ? hash(p * 3 + c) - 0.5 : 0));
      out[o + c] = v < 0 ? 0 : v > max ? max : v;
    }
    out[o + 3] = channels === 4 ? Math.round(data16[i + 3] * k) : max;
  }
  return out;
}

/** Corrige en el propio archivo la etiqueta de color del AVIF (la caja
    `colr`/`nclx`: el codificador la deja «sin especificar»). sRGB =
    primarios 1 y transferencia 13; Display P3 = primarios 12 y 13. Sólo
    cambia dos números de la misma caja: el tamaño del archivo no varía. */
export function tagAvifColor(bytes, space){
  const prim = space === "display-p3" ? 12 : 1, trans = 13;
  for(let i = 4; i + 16 < bytes.length; i++){
    if(bytes[i] === 0x63 && bytes[i + 1] === 0x6f && bytes[i + 2] === 0x6c && bytes[i + 3] === 0x72 &&
       bytes[i + 4] === 0x6e && bytes[i + 5] === 0x63 && bytes[i + 6] === 0x6c && bytes[i + 7] === 0x78){   // «colr» + «nclx»
      bytes[i + 8] = prim >> 8; bytes[i + 9] = prim & 255; bytes[i + 10] = trans >> 8; bytes[i + 11] = trans & 255;
      return true;
    }
  }
  return false;
}

const AVIF_BASE = { qualityAlpha: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0, speed: 6, chromaDeltaQ: false, sharpness: 0, tune: 0, enableSharpYUV: false };

/* ── AVIF ────────────────────────────────────────────────────── */

/** RGBA de 8 bits → AVIF. `quality` 0-100; 100 = sin pérdidas (4:4:4). */
export async function encodeAvif8(rgba, width, height, { quality = 60, space = "srgb" } = {}){
  const m = await avifEncoder(), lossless = quality >= 100;
  const out = m.encode(rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height,
    { ...AVIF_BASE, quality: lossless ? 100 : Math.round(quality), subsample: lossless ? 3 : 1, bitDepth: 8 });
  if(!out) throw new Error("No se pudo codificar en AVIF");
  const bytes = new Uint8Array(out); tagAvifColor(bytes, space);
  return new Blob([bytes], { type: "image/avif" });
}

/** Datos de 16 bits de Realify → AVIF de `bits` (10 o 12) bits. */
export async function encodeAvifDeep({ data, channels, width, height }, bits, { quality = 80, space = "srgb" } = {}){
  const m = await avifEncoder(), lossless = quality >= 100;
  const rgba = toBitDepthRGBA(data, channels, width, height, bits, !lossless);
  const out = m.encode(new Uint8Array(rgba.buffer), width, height,
    { ...AVIF_BASE, quality: lossless ? 100 : Math.round(quality), subsample: lossless ? 3 : 1, bitDepth: bits });
  if(!out) throw new Error("No se pudo codificar en AVIF de " + bits + " bits");
  const bytes = new Uint8Array(out); tagAvifColor(bytes, space);
  return new Blob([bytes], { type: "image/avif" });
}

/* ── JPEG XL ─────────────────────────────────────────────────── */

/** RGBA de 8 bits → JPEG XL. `quality` 0-100; 100 = sin pérdidas. */
export async function encodeJxl(rgba, width, height, { quality = 85, effort = 7 } = {}){
  const m = await jxlEncoder(), lossless = quality >= 100;
  const out = m.encode(rgba, width, height, {
    effort, quality: lossless ? 100 : Math.round(quality), progressive: false, epf: -1, lossyPalette: false,
    decodingSpeedTier: 0, photonNoiseIso: 0, lossyModular: false, lossless
  });
  if(!out) throw new Error("No se pudo codificar en JPEG XL");
  return new Blob([new Uint8Array(out)], { type: "image/jxl" });
}

/** .jxl → lienzo (para abrir archivos que el navegador no entiende). */
export async function decodeJxlToCanvas(buffer){
  const m = await jxlDecoder();
  const img = m.decode(new Uint8Array(buffer));
  if(!img) throw new Error("No se pudo leer el JPEG XL");
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  c.getContext("2d", { willReadFrequently: true }).putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

/* ── Estimación de peso y calidad ───────────────────────────── */
export const PSNR_LEVELS = [[45, "excelente"], [40, "muy buena"], [35, "buena"], [30, "aceptable"], [0, "baja"]];
export const qualityWord = psnr => PSNR_LEVELS.find(([t]) => psnr >= t)[1];

/* Detalle de un recorte: gradiente medio de la luminancia (lo que más
   encarece una compresión). */
function detailOf(c){
  const w = c.width, h = c.height, d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let s = 0, n = 0;
  for(let y = 0; y < h - 1; y += 2) for(let x = 0; x < w - 1; x += 2){
    const i = (y * w + x) * 4, j = i + 4, k = i + w * 4;
    const l = o => d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114;
    s += Math.abs(l(i) - l(j)) + Math.abs(l(i) - l(k)); n++;
  }
  return n ? s / n : 0;
}

/** Recortes de la foto a la escala de salida (`side` px de lado). No se
    toman en sitios fijos —el centro suele ser lo más detallado y sesgaría
    el peso al alza—: se miden varios candidatos repartidos por la foto y se
    eligen los de detalle en los percentiles 10, 30, 50, 70 y 90, cuya media
    representa a la foto entera. */
export function sampleCrops(source, outW, outH, side = 224){
  const s = outW / source.width, cw = Math.min(outW, side), ch = Math.min(outH, side);
  const make = (x0, y0) => {
    // Alineados a la rejilla de 16 px: los bloques de JPEG, WebP y AVIF se
    // comprimen sobre esa rejilla, y un recorte desplazado mediría otra cosa
    // (en una foto que ya era JPEG, mucha menos calidad de la que sale de verdad).
    x0 = Math.max(0, Math.min(outW - cw, Math.round(x0 / 16) * 16)); y0 = Math.max(0, Math.min(outH - ch, Math.round(y0 / 16) * 16));
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    const x = c.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.drawImage(source, x0 / s, y0 / s, cw / s, ch / s, 0, 0, cw, ch);
    return c;
  };
  if(cw >= outW && ch >= outH) return [make(0, 0)];
  const nx = Math.min(8, Math.max(1, Math.floor(outW / cw))), ny = Math.min(6, Math.max(1, Math.floor(outH / ch)));
  const cand = [];
  for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++){
    const c = make(Math.round((outW - cw) * (nx > 1 ? i / (nx - 1) : 0.5)), Math.round((outH - ch) * (ny > 1 ? j / (ny - 1) : 0.5)));
    cand.push({ c, d: detailOf(c) });
  }
  cand.sort((a, b) => a.d - b.d);
  const picks = new Set([0.1, 0.3, 0.5, 0.7, 0.9].map(q => Math.min(cand.length - 1, Math.round(q * (cand.length - 1)))));
  return [...picks].map(i => cand[i].c);
}

function psnrOf(a, b){
  let mse = 0, n = 0;
  for(let i = 0; i < a.length; i += 4){
    for(let c = 0; c < 3; c++){ const e = a[i + c] - b[i + c]; mse += e * e; n++; }
  }
  mse /= Math.max(1, n);
  return mse <= 1e-9 ? Infinity : 10 * Math.log10(255 * 255 / mse);
}

/**
 * @param type     "image/avif" | "image/avif;10" | "image/avif;12" | "image/jxl" | "image/jpeg" | "image/webp"
 * @param source   lienzo plano del documento (el acoplado)
 * @param quality  0-1 (como el resto del diálogo)
 * @returns { bytes, psnr } — bytes totales estimados para outW×outH
 */
export async function estimateCodec({ type, source, outW, outH, quality }){
  const crops = sampleCrops(source, outW, outH);
  let bytes = 0, px = 0, mse = 0, n = 0, lossless = false;
  for(const c of crops){
    const w = c.width, h = c.height, x = c.getContext("2d", { willReadFrequently: true });
    const orig = x.getImageData(0, 0, w, h);
    let blob, dec;
    const q = Math.round(quality * 100);
    if(type.startsWith("image/avif")){
      const bits = +(type.split(";")[1] || 8);
      if(bits === 8) blob = await encodeAvif8(orig.data, w, h, { quality: q });
      else{
        // La muestra sale de 8 bits: se amplía a 16 sólo para medir peso y parecido
        const d16 = new Uint16Array(w * h * 3); for(let i = 0, j = 0; i < orig.data.length; i += 4, j += 3){ d16[j] = orig.data[i] * 257; d16[j + 1] = orig.data[i + 1] * 257; d16[j + 2] = orig.data[i + 2] * 257; }
        blob = await encodeAvifDeep({ data: d16, channels: 3, width: w, height: h }, bits, { quality: q });
      }
      const m = await avifDecoder(); dec = m.decode(new Uint8Array(await blob.arrayBuffer()), 8);
    } else if(type === "image/jxl"){
      blob = await encodeJxl(orig.data, w, h, { quality: q, effort: 5 });
      const m = await jxlDecoder(); dec = m.decode(new Uint8Array(await blob.arrayBuffer()));
    } else {
      blob = await new Promise(r => c.toBlob(r, type, quality));
      const bmp = await createImageBitmap(blob), cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const cx = cv.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" }); cx.drawImage(bmp, 0, 0); bmp.close();
      dec = cx.getImageData(0, 0, w, h);
    }
    bytes += blob.size; px += w * h;
    const p = psnrOf(orig.data, dec.data);
    if(p === Infinity) lossless = true; else { mse += Math.pow(10, -p / 10) * w * h; n += w * h; }
  }
  const total = Math.round(bytes / px * outW * outH);
  return { bytes: total, psnr: n ? 10 * Math.log10(1 / (mse / n)) : Infinity, lossless };
}
