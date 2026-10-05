/* ═══════════════════════════════════════════════════════════════
   EXPORTAR HEIC (fase 16 de PENDIENTE.md)
   No hay un codificador HEVC que se pueda distribuir en la web (x265 es GPL y HEVC tiene patentes), así que se usa el que trae el
   dispositivo mediante WebCodecs (`VideoEncoder`, códec hvc1): Safari en Apple, y Chrome/Edge en equipos con codificador HEVC por
   hardware. Se codifica un único fotograma «clave» y se empaqueta en un HEIC con el escritor propio de io/heif.js.
   Sólo se ofrece donde `heicSupported()` dice que sí; en los demás sitios, AVIF.
   Color: 8 bits, 4:2:0, BT.709 de rango limitado (sRGB) o con primarios Display P3; la conversión RGB→YUV la hacemos aquí para que
   la etiqueta de color (`colr`) sea exacta. Sin metadatos (privacidad).
   ═══════════════════════════════════════════════════════════════ */

import { writeHeic, annexBToHevc, hevcLevel } from "./heif.js";

const codecFor = (w, h) => { const l = hevcLevel(w, h); return l ? `hvc1.1.6.L${l}.B0` : null; };

let support = null;
/** ¿Puede este dispositivo codificar HEVC? (cacheado). */
export function heicSupported(){
  if(support) return support;
  support = (async () => {
    try{
      if(typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return false;
      const s = await VideoEncoder.isConfigSupported({ codec: codecFor(1280, 720), width: 1280, height: 720, bitrate: 2e6, framerate: 1 });
      return !!s.supported;
    }catch{ return false; }
  })();
  return support;
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
  if(!hvcc){ const r = annexBToHevc(data); sample = r.sample; hvcc = r.hvcc; }                    // Annex B → formato HEVC
  let colr = { primaries: p3 ? 12 : 1, transfer: 13, matrix: 1, fullRange: false };
  const bytes = writeHeic({ sample, hvcc, width: w, height: h, codedWidth: cw, codedHeight: ch, colr });
  return new Blob([bytes], { type: "image/heic" });
}
