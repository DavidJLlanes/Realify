/* ═══════════════════════════════════════════════════════════════
   EXPORTAR HEIC (fase 16 de PENDIENTE.md)
   No hay un codificador HEVC que se pueda distribuir en la web (x265 es GPL y HEVC tiene patentes), así que se usa el que trae el
   dispositivo mediante WebCodecs (`VideoEncoder`, códec hvc1): Safari en Apple, y Chrome/Edge en equipos con codificador HEVC por
   hardware. Se codifica un único fotograma «clave» y se empaqueta en un HEIC con el escritor propio de io/heif.js.
   Sólo se ofrece donde `heicSupported()` dice que sí; en los demás sitios, AVIF.
   Color: 8 bits (o 10 con HEVC Main 10, desde los 16 bits del motor de precisión), 4:2:0, BT.709 de rango limitado (sRGB) o con primarios Display P3;
   la conversión RGB→YUV la hacemos aquí para que la etiqueta de color (`colr`) sea exacta. Los metadatos (EXIF/XMP) se añaden aparte, como en AVIF (io/metacontainers.js).
   ═══════════════════════════════════════════════════════════════ */

import { writeHeic, annexBToHevc, hevcLevel } from "./heif.js";

/* Perfil Main (8 bits) o Main 10 (10 bits): «hvc1.<perfil>.<compatibilidad>.L<nivel>.B0» */
const codecFor = (w, h, bits = 8) => { const l = hevcLevel(w, h); return l ? `hvc1.${bits === 10 ? "2.4" : "1.6"}.L${l}.B0` : null; };

const support = {};
/** ¿Puede este dispositivo codificar HEVC (de 8 bits, o de 10 con `bits` = 10)? (cacheado). */
export function heicSupported(bits = 8){
  if(support[bits]) return support[bits];
  support[bits] = (async () => {
    try{
      if(typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return false;
      const s = await VideoEncoder.isConfigSupported({ codec: codecFor(1280, 720, bits), width: 1280, height: 720, bitrate: 2e6, framerate: 1 });
      return !!s.supported;
    }catch{ return false; }
  })();
  return support[bits];
}

/** Calidad 0-1 → bits por píxel de un fotograma (framerate 1 ⇒ bitrate = bits por imagen). */
const bppFor = q => 0.25 + 2.6 * q * q;

/** RGBA 8 bits → I420 (BT.709, rango limitado), con relleno por repetición hasta el tamaño codificado. */
export function rgbaToI420(rgba, w, h, cw, ch){
  const y = new Uint8Array(cw * ch), u = new Uint8Array((cw >> 1) * (ch >> 1)), v = new Uint8Array(u.length);
  const Kr = 0.2126, Kb = 0.0722, Kg = 1 - Kr - Kb;
  const cb = new Float32Array(cw * ch), cr = new Float32Array(cw * ch);
  for(let j = 0; j < ch; j++){
    const sj = Math.min(j, h - 1);
    for(let i = 0; i < cw; i++){
      const p = (sj * w + Math.min(i, w - 1)) * 4, R = rgba[p] / 255, G = rgba[p + 1] / 255, B = rgba[p + 2] / 255, Y = Kr * R + Kg * G + Kb * B;
      y[j * cw + i] = Math.round(16 + 219 * Y);
      cb[j * cw + i] = (B - Y) / (2 * (1 - Kb)); cr[j * cw + i] = (R - Y) / (2 * (1 - Kr));
    }
  }
  const hw = cw >> 1;
  for(let j = 0; j < ch >> 1; j++) for(let i = 0; i < hw; i++){
    const a = (2 * j) * cw + 2 * i, b = a + cw;
    u[j * hw + i] = Math.round(128 + 224 * (cb[a] + cb[a + 1] + cb[b] + cb[b + 1]) / 4);
    v[j * hw + i] = Math.round(128 + 224 * (cr[a] + cr[a + 1] + cr[b] + cr[b + 1]) / 4);
  }
  const out = new Uint8Array(y.length + u.length + v.length); out.set(y, 0); out.set(u, y.length); out.set(v, y.length + u.length);
  return out;
}

/** RGBA/RGB de 16 bits (color codificado sin premultiplicar) → I010 (BT.709, rango limitado de 10 bits: Y 64–940, C 64–960), con relleno por repetición hasta el tamaño codificado. Devuelve Uint16 (planos Y, U, V). */
export function rgba16ToI010(data, channels, w, h, cw, ch){
  const y = new Uint16Array(cw * ch), u = new Uint16Array((cw >> 1) * (ch >> 1)), v = new Uint16Array(u.length);
  const Kr = 0.2126, Kb = 0.0722, Kg = 1 - Kr - Kb, cb = new Float32Array(cw * ch), cr = new Float32Array(cw * ch);
  for(let j = 0; j < ch; j++){
    const sj = Math.min(j, h - 1);
    for(let i = 0; i < cw; i++){
      const p = (sj * w + Math.min(i, w - 1)) * channels, R = data[p] / 65535, G = data[p + 1] / 65535, B = data[p + 2] / 65535, Y = Kr * R + Kg * G + Kb * B;
      y[j * cw + i] = Math.round(64 + 876 * Y);
      cb[j * cw + i] = (B - Y) / (2 * (1 - Kb)); cr[j * cw + i] = (R - Y) / (2 * (1 - Kr));
    }
  }
  const hw = cw >> 1;
  for(let j = 0; j < ch >> 1; j++) for(let i = 0; i < hw; i++){
    const a = (2 * j) * cw + 2 * i, b = a + cw;
    u[j * hw + i] = Math.round(512 + 896 * (cb[a] + cb[a + 1] + cb[b] + cb[b + 1]) / 4);
    v[j * hw + i] = Math.round(512 + 896 * (cr[a] + cr[a + 1] + cr[b] + cr[b + 1]) / 4);
  }
  const out = new Uint16Array(y.length + u.length + v.length); out.set(y, 0); out.set(u, y.length); out.set(v, y.length + u.length);
  return out;
}

/** HEIC de 10 bits desde los 16 bits del motor de precisión ({ data, channels, width, height }): HEVC Main 10 del codificador del dispositivo (formato de píxel I420P10/I010). */
export async function encodeHeicDeep(d16, { quality = .85, space = "srgb" } = {}){
  const w = d16.width, h = d16.height, cw = (w + 1) & ~1, ch = (h + 1) & ~1, codec = codecFor(cw, ch, 10);
  if(!codec) throw new Error("la imagen es demasiado grande para HEVC (máximo unos 140 megapíxeles)");
  if(!(await heicSupported(10))) throw new Error("este dispositivo no puede codificar HEVC de 10 bits: usa HEIC de 8 bits o AVIF de 10 bits");
  const p3 = space === "display-p3", cs = { primaries: p3 ? "smpte432" : "bt709", transfer: "iec61966-2-1", matrix: "bt709", fullRange: false };
  const planes = rgba16ToI010(d16.data, d16.channels, w, h, cw, ch);
  let frame = null, lastErr = null;
  for(const format of ["I420P10", "I010"]){ try{ frame = new VideoFrame(planes, { format, codedWidth: cw, codedHeight: ch, timestamp: 0, colorSpace: cs }); break; }catch(e){ lastErr = e; } }
  if(!frame) throw new Error("este navegador no admite fotogramas de 10 bits para el codificador: " + (lastErr?.message || lastErr));
  return await packHeic(frame, { w, h, cw, ch, codec, bits: 10, quality, p3 });
}

/** Codifica un VideoFrame con el codificador del dispositivo y lo empaqueta en HEIC. */
async function packHeic(frame, { w, h, cw, ch, codec, bits, quality, p3 }){
  const cfgBase = { codec, width: cw, height: ch, bitrate: Math.round(cw * ch * bppFor(Math.min(1, Math.max(0, quality)))), framerate: 1, latencyMode: "quality" };
  let cfg = { ...cfgBase, hevc: { format: "hevc" } };
  if(!(await VideoEncoder.isConfigSupported(cfg)).supported) cfg = cfgBase;                      // Safari: sin la opción «hevc» entrega Annex B
  let chunk = null, description = null, failure = null;
  const encoder = new VideoEncoder({
    output: (c, meta) => { chunk = c; description = meta?.decoderConfig?.description || null; },
    error: e => { failure = e; }
  });
  try{
    encoder.configure(cfg);
    encoder.encode(frame, { keyFrame: true });
    await encoder.flush();
  }catch(e){ throw new Error("el codificador HEVC del dispositivo falló: " + (e.message || e)); }
  finally{ frame.close(); try{ encoder.close(); }catch{} }
  if(failure || !chunk) throw new Error("el codificador HEVC del dispositivo no devolvió imagen" + (failure ? ": " + failure.message : ""));
  const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
  let sample = data, hvcc = description ? new Uint8Array(description.buffer ? description.buffer.slice(description.byteOffset, description.byteOffset + description.byteLength) : description) : null;
  if(!hvcc){ const r = annexBToHevc(data, { bitDepth: bits }); sample = r.sample; hvcc = r.hvcc; }  // Annex B → formato HEVC
  const colr = { primaries: p3 ? 12 : 1, transfer: 13, matrix: 1, fullRange: false };
  return new Blob([writeHeic({ sample, hvcc, width: w, height: h, codedWidth: cw, codedHeight: ch, bitDepth: bits, colr })], { type: "image/heic" });
}

/**
 * Lienzo → Blob HEIC (image/heic). `quality` 0-1. `space`: "srgb" | "display-p3".
 * Lanza un error claro si el dispositivo no puede.
 */
export async function encodeHeic(canvas, { quality = .85, space = "srgb" } = {}){
  const w = canvas.width, h = canvas.height, cw = (w + 1) & ~1, ch = (h + 1) & ~1;
  const codec = codecFor(cw, ch);
  if(!codec) throw new Error("la imagen es demasiado grande para HEVC (máximo unos 140 megapíxeles)");
  if(!(await heicSupported())) throw new Error("este dispositivo no puede codificar HEVC: usa AVIF");
  const px = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h, { colorSpace: space === "display-p3" ? "display-p3" : "srgb" }).data;
  const p3 = space === "display-p3";
  const cs = { primaries: p3 ? "smpte432" : "bt709", transfer: "iec61966-2-1", matrix: "bt709", fullRange: false };
  const frame = new VideoFrame(rgbaToI420(px, w, h, cw, ch), { format: "I420", codedWidth: cw, codedHeight: ch, timestamp: 0, colorSpace: cs });
  return await packHeic(frame, { w, h, cw, ch, codec, bits: 8, quality, p3 });
}
