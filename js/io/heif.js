/* ═══════════════════════════════════════════════════════════════
   EMPAQUETADOR HEIF (HEIC) PROPIO · sin DOM, sin dependencias
   Un HEIC de una sola imagen es un contenedor ISO-BMFF: `ftyp`, `meta` (item «hvc1» con sus propiedades hvcC, ispe, clap,
   colr y pixi) y `mdat` con el fotograma HEVC. Aquí sólo se escribe ese contenedor: la codificación HEVC la hace el codificador
   del propio dispositivo (WebCodecs, ver io/heic.js), así que no se distribuye ningún codificador (x265 es GPL y HEVC tiene
   patentes) y el HEIC sale con las propiedades que lee cualquier visor (libheif, Apple, Windows con la extensión HEIF).
   ═══════════════════════════════════════════════════════════════ */

const enc = new TextEncoder();
const u16 = n => Uint8Array.of((n >> 8) & 255, n & 255);
const u32 = n => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const cat = parts => { let n = 0; for(const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for(const p of parts){ o.set(p, k); k += p.length; } return o; };
const box = (type, ...payload) => { const body = cat(payload); return cat([u32(8 + body.length), enc.encode(type), body]); };
const fullbox = (type, version, flags, ...payload) => box(type, Uint8Array.of(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...payload);

/** Nivel HEVC (general_level_idc) mínimo para una imagen de w×h, o 0 si ningún nivel la admite. */
export function hevcLevel(w, h){
  const px = w * h;
  for(const [max, level] of [[983040, 93], [2228224, 123], [8912896, 153], [35651584, 183], [142606336, 186]]) if(px <= max) return level;
  return 0;
}

/* ── Annex B → formato HEVC (longitudes de 4 bytes) + hvcC ───────────────────── */
function nalUnits(u8){
  const out = []; let i = 0, start = -1;
  const isStart = k => u8[k] === 0 && u8[k + 1] === 0 && (u8[k + 2] === 1 || (u8[k + 2] === 0 && u8[k + 3] === 1));
  while(i < u8.length - 3){
    if(isStart(i)){
      const len = u8[i + 2] === 1 ? 3 : 4;
      if(start >= 0) out.push(u8.subarray(start, i));
      i += len; start = i;
    } else i++;
  }
  if(start >= 0 && start < u8.length) out.push(u8.subarray(start));
  return out;
}
const unescape = u8 => { const o = []; for(let i = 0; i < u8.length; i++){ if(i >= 2 && u8[i] === 3 && u8[i - 1] === 0 && u8[i - 2] === 0) continue; o.push(u8[i]); } return Uint8Array.from(o); };

/**
 * Si el codificador entrega Annex B (con los conjuntos de parámetros dentro), saca VPS/SPS/PPS para construir el `hvcC` y deja
 * sólo los NAL de imagen con prefijo de longitud. `chroma`/`bitDepth` son los que se codificaron (4:2:0, 8 bits).
 */
export function annexBToHevc(u8, { chroma = 1, bitDepth = 8 } = {}){
  const vps = [], sps = [], pps = [], slices = [];
  for(const n of nalUnits(u8)){
    const t = (n[0] >> 1) & 63;
    if(t === 32) vps.push(n); else if(t === 33) sps.push(n); else if(t === 34) pps.push(n); else if(t !== 35) slices.push(n);   // 35 = delimitador
  }
  if(!vps.length || !sps.length || !pps.length || !slices.length) throw new Error("el flujo HEVC no trae VPS, SPS, PPS y datos de imagen");
  const s = unescape(sps[0].subarray(2));            // sin la cabecera del NAL (2 bytes)
  const ptl = s.subarray(1, 13);                     // perfil/tier (1), compatibilidad (4), restricciones (6), nivel (1)
  const arrays = [[32, vps], [33, sps], [34, pps]].map(([type, list]) => cat([Uint8Array.of(0x80 | type), u16(list.length), ...list.flatMap(n => [u16(n.length), n])]));
  const hvcc = cat([Uint8Array.of(1, ptl[0]), ptl.subarray(1, 5), ptl.subarray(5, 11), Uint8Array.of(ptl[11]),
    u16(0xF000), Uint8Array.of(0xFC, 0xFC | chroma, 0xF8 | (bitDepth - 8), 0xF8 | (bitDepth - 8)), u16(0), Uint8Array.of(0x0F, 3), ...arrays]);
  // 0x0F: constantFrameRate 0, numTemporalLayers 1, temporalIdNested 1, lengthSizeMinusOne 3
  const sample = cat(slices.flatMap(n => [u32(n.length), n]));
  return { hvcc, sample };
}

/**
 * HEIC de una imagen.
 * @param sample    fotograma HEVC con prefijo de longitud de 4 bytes (formato «hevc» de WebCodecs)
 * @param hvcc      registro HEVCDecoderConfigurationRecord
 * @param width,height  tamaño visible; `codedWidth`/`codedHeight`: tamaño codificado (si es mayor se recorta con `clap`)
 * @param colr      { primaries, transfer, matrix, fullRange } (CICP) o { icc: Uint8Array }
 */
export function writeHeic({ sample, hvcc, width, height, codedWidth = width, codedHeight = height, colr = { primaries: 1, transfer: 13, matrix: 1, fullRange: false } }){
  const props = [box("hvcC", hvcc), fullbox("ispe", 0, 0, u32(codedWidth), u32(codedHeight))];
  const assoc = [0x80 | 1, 2];                                                // hvcC (esencial), ispe
  if(codedWidth !== width || codedHeight !== height){
    // recorte: el centro de la imagen visible respecto al centro de la codificada
    props.push(box("clap", u32(width), u32(1), u32(height), u32(1), u32((codedWidth - width) * -1 >>> 0), u32(2), u32((codedHeight - height) * -1 >>> 0), u32(2)));
    assoc.push(0x80 | props.length);
  }
  props.push(colr.icc ? box("colr", enc.encode("prof"), colr.icc)
                      : box("colr", enc.encode("nclx"), u16(colr.primaries), u16(colr.transfer), u16(colr.matrix), Uint8Array.of(colr.fullRange ? 0x80 : 0)));
  assoc.push(props.length);
  props.push(fullbox("pixi", 0, 0, Uint8Array.of(3, 8, 8, 8)));
  assoc.push(props.length);
  const ftyp = box("ftyp", enc.encode("heic"), u32(0), enc.encode("mif1"), enc.encode("heic"));
  const build = offset => fullbox("meta", 0, 0,
    fullbox("hdlr", 0, 0, u32(0), enc.encode("pict"), u32(0), u32(0), u32(0), Uint8Array.of(0)),
    fullbox("pitm", 0, 0, u16(1)),
    fullbox("iinf", 0, 0, u16(1), fullbox("infe", 2, 0, u16(1), u16(0), enc.encode("hvc1"), Uint8Array.of(0))),
    fullbox("iloc", 0, 0, Uint8Array.of(0x44, 0x00), u16(1), u16(1), u16(0), u16(1), u32(offset), u32(sample.length)),
    box("iprp", box("ipco", ...props), fullbox("ipma", 0, 0, u32(1), u16(1), Uint8Array.of(assoc.length), Uint8Array.from(assoc))));
  const metaLen = build(0).length, offset = ftyp.length + metaLen + 8;
  return cat([ftyp, build(offset), box("mdat", sample)]);
}
