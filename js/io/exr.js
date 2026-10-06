/* ═══════════════════════════════════════════════════════════════
   OPENEXR (fase 6 de PENDIENTE.md)
   Escritor propio de OpenEXR de una sola parte, por líneas (scanline),
   sin dependencias: el formato es abierto y sencillo, y escribirlo aquí
   evita cargar un códec de megas para algo que son cuatro cabeceras y
   una compresión zlib.

   · Luz LINEAL, no codificada: un EXR guarda cantidad de luz. Los datos
     de Realify (sRGB codificado, 16 bits) se convierten con la curva
     exacta; el alfa se guarda ASOCIADO (RGB × A, lo que esperan Nuke,
     After Effects y Photoshop al leer un EXR).
   · HALF (16 bits en coma flotante, por defecto: la precisión de sobra
     para una foto y la mitad de peso) o FLOAT (32 bits).
   · Compresión ZIP (16 líneas por bloque, como el original) o sin
     comprimir; si un bloque no se reduce, se guarda tal cual.
   · Atributo `chromaticities`: primarios sRGB/Rec. 709 o Display P3
     (D65), para que quien lo abra sepa en qué espacio está la luz.
   Se escribe el archivo bloque a bloque: en memoria sólo está lo ya
   comprimido, no la foto entera en coma flotante.
   Sin DOM: lo usan la exportación y las pruebas en Node.
   ═══════════════════════════════════════════════════════════════ */

export const EXR_CHROMATICITIES = {
  srgb:         [0.640, 0.330, 0.300, 0.600, 0.150, 0.060, 0.3127, 0.3290],
  "display-p3": [0.680, 0.320, 0.265, 0.690, 0.150, 0.060, 0.3127, 0.3290]
};

const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
/** Float32 → half (binary16), redondeado al más cercano. */
export function floatToHalf(x){
  f32[0] = x;
  const f = u32[0], s = (f >>> 16) & 0x8000;
  let e = ((f >>> 23) & 0xff) - 127 + 15, m = f & 0x7fffff;
  if(e <= 0){                                   // subnormal o cero
    if(e < -10) return s;
    m = (m | 0x800000) >> (1 - e);
    if(m & 0x1000) m += 0x2000;
    return s | (m >> 13);
  }
  if(e >= 31) return s | 0x7c00 | (((f & 0x7fffffff) > 0x7f800000) ? 0x200 : 0);   // infinito o NaN
  if(m & 0x1000){ m += 0x2000; if(m & 0x800000){ m = 0; e++; if(e >= 31) return s | 0x7c00; } }
  return s | (e << 10) | (m >> 13);
}

/** Curva sRGB → luz lineal para códigos de 16 bits (tabla de 65 536). */
let LIN16 = null;
export function srgb16ToLinear(){
  if(LIN16) return LIN16;
  LIN16 = new Float32Array(65536);
  for(let i = 0; i < 65536; i++){ const v = i / 65535; LIN16[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return LIN16;
}

const enc = new TextEncoder();
const concat = parts => { const n = parts.reduce((a, p) => a + p.length, 0), o = new Uint8Array(n); let k = 0; for(const p of parts){ o.set(p, k); k += p.length; } return o; };
const cstr = s => { const b = enc.encode(s), o = new Uint8Array(b.length + 1); o.set(b); return o; };
const i32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, true); return b; };
const f32le = v => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, true); return b; };
const attr = (name, type, value) => concat([cstr(name), cstr(type), i32(value.length), value]);

/* Atributos estándar de OpenEXR para los metadatos: `owner` (autor y copyright), `comments` (descripción), `capDate` («AAAA:MM:DD HH:MM:SS»), `latitude`/`longitude`
   (grados, floats). Los atributos van en orden alfabético por costumbre: «capDate»/«comments» antes de «compression»; «latitude», «longitude» y «owner» después de
   «lineOrder». `meta` = { owner, comments, capDate, latitude, longitude }; lo que falte no se escribe. */
const strAttr = (name, text) => attr(name, "string", enc.encode(String(text)));
function metaAttrs(meta, where){
  if(!meta) return [];
  const out = [];
  if(where === "before"){ if(meta.capDate) out.push(strAttr("capDate", meta.capDate)); if(meta.comments) out.push(strAttr("comments", meta.comments)); }
  else {
    if(Number.isFinite(meta.latitude)) out.push(attr("latitude", "float", f32le(meta.latitude)));
    if(Number.isFinite(meta.longitude)) out.push(attr("longitude", "float", f32le(meta.longitude)));
    if(meta.owner) out.push(strAttr("owner", meta.owner));
  }
  return out;
}

async function deflate(u8){
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
}

/* Compresión ZIP de OpenEXR: los bytes pares a la primera mitad y los
   impares a la segunda, un predictor de diferencias y zlib. */
function zipPrepare(raw){
  const n = raw.length, tmp = new Uint8Array(n), half = (n + 1) >> 1;
  for(let i = 0, a = 0, b = half; i < n; i++){ if(i & 1) tmp[b++] = raw[i]; else tmp[a++] = raw[i]; }
  for(let i = n - 1; i > 0; i--) tmp[i] = (tmp[i] - tmp[i - 1] + 128 + 256) & 255;
  return tmp;
}

/**
 * @param width, height
 * @param hasAlpha   escribir canal A
 * @param getLine    (y, R, G, B, A) → rellena Float32Array(width) con la luz LINEAL
 *                   de la línea y (A sólo si hasAlpha; las R, G, B ya asociadas)
 * @param space      "srgb" | "display-p3" (atributo chromaticities)
 * @param pixelType  "half" (por defecto) | "float"
 * @param compression "zip" (por defecto) | "none"
 * @returns Blob (image/x-exr)
 */
export async function encodeExr({ width, height, hasAlpha = false, getLine, space = "srgb", pixelType = "half", compression = "zip", onProgress = null, meta = null }){
  const names = hasAlpha ? ["A", "B", "G", "R"] : ["B", "G", "R"];      // el orden alfabético lo exige el formato
  const half = pixelType !== "float", bpp = half ? 2 : 4, ptype = half ? 1 : 2;
  const linesPerBlock = compression === "zip" ? 16 : 1, ccode = compression === "zip" ? 3 : 0;

  const chlist = concat([
    ...names.map(n => concat([cstr(n), i32(ptype), new Uint8Array(4), i32(1), i32(1)])),   // pLinear 0 + 3 reservados, muestreo 1×1
    new Uint8Array(1)
  ]);
  const box = concat([i32(0), i32(0), i32(width - 1), i32(height - 1)]);
  const chroma = concat((EXR_CHROMATICITIES[space] || EXR_CHROMATICITIES.srgb).map(f32le));
  const header = concat([
    new Uint8Array([0x76, 0x2f, 0x31, 0x01]), new Uint8Array([2, 0, 0, 0]),          // número mágico y versión 2 (una parte, por líneas)
    attr("channels", "chlist", chlist),
    attr("chromaticities", "chromaticities", chroma),
    ...metaAttrs(meta, "before"),
    attr("compression", "compression", new Uint8Array([ccode])),
    attr("dataWindow", "box2i", box),
    attr("displayWindow", "box2i", box),
    attr("lineOrder", "lineOrder", new Uint8Array([0])),
    ...metaAttrs(meta, "after"),
    attr("pixelAspectRatio", "float", f32le(1)),
    attr("screenWindowCenter", "v2f", concat([f32le(0), f32le(0)])),
    attr("screenWindowWidth", "float", f32le(1)),
    new Uint8Array(1)
  ]);

  const nBlocks = Math.ceil(height / linesPerBlock), tableLen = nBlocks * 8;
  const R = new Float32Array(width), G = new Float32Array(width), B = new Float32Array(width), A = new Float32Array(width);
  const chans = { R, G, B, A };
  const lineBytes = width * bpp * names.length;
  const chunks = [], offsets = new Array(nBlocks);
  let offset = header.length + tableLen;

  for(let blk = 0; blk < nBlocks; blk++){
    const y0 = blk * linesPerBlock, rows = Math.min(linesPerBlock, height - y0);
    const raw = new Uint8Array(rows * lineBytes), dv = new DataView(raw.buffer);
    let o = 0;
    for(let r = 0; r < rows; r++){
      getLine(y0 + r, R, G, B, A);
      for(const n of names){
        const src = chans[n];
        if(half) for(let x = 0; x < width; x++, o += 2) dv.setUint16(o, floatToHalf(src[x]), true);
        else for(let x = 0; x < width; x++, o += 4) dv.setFloat32(o, src[x], true);
      }
    }
    let data = raw;
    if(compression === "zip"){
      const z = await deflate(zipPrepare(raw));
      if(z.length < raw.length) data = z;        // si no se reduce, el bloque va sin comprimir
    }
    const head = new Uint8Array(8), hv = new DataView(head.buffer);
    hv.setInt32(0, y0, true); hv.setInt32(4, data.length, true);
    offsets[blk] = offset;
    chunks.push(head, data);
    offset += 8 + data.length;
    if(onProgress && (blk & 15) === 0){ onProgress((blk + 1) / nBlocks); await new Promise(r => setTimeout(r, 0)); }
  }

  const table = new Uint8Array(tableLen), tv = new DataView(table.buffer);
  offsets.forEach((v, i) => tv.setBigUint64(i * 8, BigInt(v), true));
  return new Blob([header, table, ...chunks], { type: "image/x-exr" });
}

/** Adaptador: datos de 16 bits de Realify (sRGB codificado, RGB o RGBA
    entrelazado; el alfa, lineal) → líneas de luz lineal con alfa asociado. */
export function lineReaderFromData16({ data, channels, width }){
  const lin = srgb16ToLinear();
  return (y, R, G, B, A) => {
    let i = y * width * channels;
    for(let x = 0; x < width; x++, i += channels){
      const a = channels === 4 ? data[i + 3] / 65535 : 1;
      R[x] = lin[data[i]] * a; G[x] = lin[data[i + 1]] * a; B[x] = lin[data[i + 2]] * a; A[x] = a;
    }
  };
}
