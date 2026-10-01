/* ═══════════════════════════════════════════════════════════════
   LECTORES DE ALTA PROFUNDIDAD (fase 4 de PENDIENTE.md)
   El navegador decodifica toda imagen a 8 bits por canal. Aquí se leen
   aparte los bits que sobran, para guardarlos como origen de la capa
   base (core/hisrc.js):
     · PNG de 16 bits (RGB, RGBA, gris, gris + alfa; sin entrelazar):
       lector propio, con la descompresión del navegador.
     · TIFF de 16 bits (sin comprimir, LZW, Deflate, PackBits, con o sin
       predictor, intel o motorola): UTIF, el mismo que ya abre los TIFF.
     · AVIF de 10 o 12 bits: decodificador libavif + dav1d de jSquash
       (js/vendor/avif), que sólo se carga en ese caso.
   Devuelven { data: Uint16Array RGB (0-65535), w, h, bits } o null.
   Ninguno aplica perfiles de color: quien llama compara el resultado con
   lo que ha pintado el navegador y sólo lo usa si coinciden.
   ═══════════════════════════════════════════════════════════════ */

const ext = f => (f.name.split(".").pop() || "").toLowerCase();

/** ¿Puede traer este archivo más de 8 bits? (comprobación barata) */
export async function sniffHighDepth(file){
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  // PNG: IHDR justo tras la firma; profundidad en el byte 24
  if(head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47) return head[24] === 16 ? "png" : null;
  if(/^tiff?$/.test(ext(file)) && ((head[0] === 0x49 && head[1] === 0x49) || (head[0] === 0x4D && head[1] === 0x4D))) return "tiff";
  // AVIF: caja ftyp con marca avif/avis
  const brand = String.fromCharCode(...head.subarray(8, 12));
  if(String.fromCharCode(...head.subarray(4, 8)) === "ftyp" && /avi[fs]/.test(brand)) return "avif";
  return null;
}

/* ── PNG ─────────────────────────────────────────────────────── */
async function inflate(u8){
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
}
async function decodePng16(buf){
  const u8 = new Uint8Array(buf), v = new DataView(buf);
  let i = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while(i + 8 <= u8.length){
    const n = v.getUint32(i), t = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
    if(t === "IHDR"){ w = v.getUint32(i + 8); h = v.getUint32(i + 12); depth = u8[i + 16]; type = u8[i + 17]; interlace = u8[i + 20]; }
    else if(t === "IDAT") idat.push(u8.subarray(i + 8, i + 8 + n));
    else if(t === "IEND") break;
    i += 12 + n;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if(depth !== 16 || !ch || interlace || !w || !h) return null;
  if(typeof DecompressionStream !== "function") return null;
  const raw = await inflate(new Uint8Array(await new Blob(idat).arrayBuffer()));
  const bpp = ch * 2, stride = w * bpp;
  if(raw.length < h * (stride + 1)) return null;
  const cur = new Uint8Array(stride), prev = new Uint8Array(stride), out = new Uint16Array(w * h * 3);
  for(let y = 0; y < h; y++){
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for(let x = 0; x < stride; x++){
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let p;
      switch(f){
        case 0: p = 0; break;
        case 1: p = a; break;
        case 2: p = b; break;
        case 3: p = (a + b) >> 1; break;
        case 4: { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; break; }
        default: return null;
      }
      cur[x] = (row[x] + p) & 255;
    }
    for(let x = 0; x < w; x++){
      const s = x * bpp, o = (y * w + x) * 3;
      if(ch >= 3){ out[o] = cur[s] << 8 | cur[s + 1]; out[o + 1] = cur[s + 2] << 8 | cur[s + 3]; out[o + 2] = cur[s + 4] << 8 | cur[s + 5]; }
      else { const g = cur[s] << 8 | cur[s + 1]; out[o] = out[o + 1] = out[o + 2] = g; }
    }
    prev.set(cur);
  }
  return { data: out, w, h, bits: 16 };
}

/* ── TIFF ────────────────────────────────────────────────────── */
function decodeTiff16(buf){
  const U = globalThis.UTIF;
  if(!U) return null;
  const ifds = U.decode(buf).filter(x => x.t256 && x.t257);
  if(!ifds.length) return null;
  // La imagen principal: la mayor (DNG y similares traen varias)
  ifds.sort((a, b) => b.t256[0] * b.t257[0] - a.t256[0] * a.t257[0]);
  const ifd = ifds[0], bps = ifd.t258 ? ifd.t258[0] : 1, spp = ifd.t277 ? ifd.t277[0] : 1;
  const photo = ifd.t262 ? ifd.t262[0] : 2, fmt = ifd.t339 ? ifd.t339[0] : 1, planar = ifd.t284 ? ifd.t284[0] : 1;
  if(bps !== 16 || fmt !== 1 || planar !== 1 || ifd.t322) return null;            // sólo enteros de 16 bits, entrelazados y por tiras
  if(!((photo === 2 && spp >= 3) || (photo <= 1 && spp >= 1))) return null;
  U.decodeImage(buf, ifd);
  const w = ifd.width, h = ifd.height, d = ifd.data;
  if(!d || d.length < w * h * spp * 2) return null;
  /* UTIF deja siempre los 16 bits en orden intel (da la vuelta a los
     archivos motorola al descomprimir); la comprobación posterior
     descarta cualquier sorpresa. */
  const rd = o => d[o] | d[o + 1] << 8;
  const out = new Uint16Array(w * h * 3), inv = photo === 0;
  for(let p = 0; p < w * h; p++){
    const s = p * spp * 2, o = p * 3;
    if(photo === 2){ out[o] = rd(s); out[o + 1] = rd(s + 2); out[o + 2] = rd(s + 4); }
    else { let g = rd(s); if(inv) g = 65535 - g; out[o] = out[o + 1] = out[o + 2] = g; }
  }
  return { data: out, w, h, bits: 16 };
}

/* ── AVIF ────────────────────────────────────────────────────── */
/* Profundidad del vídeo AV1: caja av1C, byte 2 (high_bitdepth, twelve_bit) */
function avifBits(u8){
  for(let i = 4; i + 8 < u8.length; i++){
    if(u8[i] === 0x61 && u8[i + 1] === 0x76 && u8[i + 2] === 0x31 && u8[i + 3] === 0x43){
      const b = u8[i + 6], high = (b >> 6) & 1, twelve = (b >> 5) & 1;
      return high ? (twelve ? 12 : 10) : 8;
    }
  }
  return 8;
}
let avifDec = null;
async function decodeAvifHigh(buf){
  const bits = avifBits(new Uint8Array(buf));
  if(bits <= 8) return null;
  if(!avifDec){
    const { default: factory } = await import("../vendor/avif/avif_dec.js");
    avifDec = factory({ noInitialRun: true });
  }
  const m = await avifDec;
  const r = m.decode(new Uint8Array(buf), 16);
  if(!r || !r.data) return null;
  const w = r.width, h = r.height, n = w * h, src = r.data, ch = src.length / n;
  if(ch !== 4 && ch !== 3) return null;
  const out = new Uint16Array(n * 3);
  for(let p = 0; p < n; p++){ const s = p * ch, o = p * 3; out[o] = src[s]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + 2]; }
  return { data: out, w, h, bits, kind: "avif" };
}

/** Datos de alta profundidad de `file`, o null si no los tiene o no se
    pueden leer (nunca falla: la foto se abre igual en 8 bits). */
export async function decodeHighDepth(file){
  try{
    const kind = await sniffHighDepth(file);
    if(!kind) return null;
    const buf = await file.arrayBuffer();
    if(kind === "png") return await decodePng16(buf);
    if(kind === "tiff") return decodeTiff16(buf);
    if(kind === "avif") return await decodeAvifHigh(buf);
  }catch(err){ console.warn("[alta profundidad] no se pudo leer:", err); }
  return null;
}
