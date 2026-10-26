/* ═══════════════════════════════════════════════════════════════
   metadata · read
   Parte de js/io/meta/metadata.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { findTiff } from "../../../exif/quick-exif.js";
import { ascii, td, enc } from "./common.js";

/* ── lectura del EXIF en bruto ────────────────────────────────────── */
const TSIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

const SWAP = { 3: 2, 8: 2, 4: 4, 9: 4, 11: 4, 5: 4, 10: 4, 12: 8 };   // tamaño de cada trozo que se da la vuelta

/** Entradas (tag, tipo, cuenta, bytes en little endian) de IFD0, del IFD Exif y del GPS del bloque TIFF que
    empieza en `base` de `buf`. */
export function parseTiff(buf, base){
  const dv = new DataView(buf), len = dv.byteLength;
  if(base < 0 || base + 8 > len) return null;
  const le = dv.getUint16(base) === 0x4949;
  const u16 = o => dv.getUint16(base + o, le), u32 = o => dv.getUint32(base + o, le);
  const readIfd = off => {
    const list = [];
    if(off <= 0 || base + off + 2 > len) return list;
    const n = u16(off);
    for(let i = 0; i < n; i++){
      const e = off + 2 + i * 12;
      if(base + e + 12 > len) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4), unit = TSIZE[type];
      if(!unit) continue;
      const size = unit * count;
      if(size > (1 << 24)) continue;
      const vo = size <= 4 ? e + 8 : u32(e + 8);
      if(base + vo + size > len) continue;
      const bytes = new Uint8Array(buf.slice(base + vo, base + vo + size));
      const sw = SWAP[type];
      if(!le && sw) for(let k = 0; k + sw <= size; k += sw) bytes.subarray(k, k + sw).reverse();
      list.push({ tag, type, count, bytes, off: size <= 4 ? -1 : vo });
    }
    return list;
  };
  const pointer = (list, tag) => { const e = list.find(x => x.tag === tag); return e && e.bytes.length >= 4 ? new DataView(e.bytes.buffer, e.bytes.byteOffset, 4).getUint32(0, true) : 0; };
  const ifd0 = readIfd(u32(4));
  return { ifd0, exif: readIfd(pointer(ifd0, 0x8769)), gps: readIfd(pointer(ifd0, 0x8825)), le };
}

function u32be(u, i){ return ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0; }

function* jpegSegments(u){
  if(u[0] !== 0xFF || u[1] !== 0xD8) return;
  let i = 2;
  while(i + 4 <= u.length){
    if(u[i] !== 0xFF) break;
    const m = u[i + 1];
    if(m === 0xDA || m === 0xD9) break;
    if(m === 0x01 || (m >= 0xD0 && m <= 0xD7)){ i += 2; continue; }
    const len = (u[i + 2] << 8) | u[i + 3];
    if(len < 2) break;
    yield { marker: m, start: i, data: u.subarray(i + 4, i + 2 + len) };
    i += 2 + len;
  }
}

/** Conjuntos IIM [{ rec, ds, bytes }] de unos datos IIM en bruto (empiezan por 0x1C). */
export function parseIim(body){
  const out = [];
  let i = 0;
  while(i + 5 <= body.length && body[i] === 0x1C){
    const rec = body[i + 1], ds = body[i + 2];
    let n = (body[i + 3] << 8) | body[i + 4], hdr = 5;
    if(n & 0x8000){ const k = n & 0x7FFF; n = 0; for(let j = 0; j < k; j++) n = n * 256 + body[i + 5 + j]; hdr = 5 + k; }
    out.push({ rec, ds, bytes: body.slice(i + hdr, i + hdr + n) });
    i += hdr + n;
  }
  return out;
}

/** Recursos «8BIM» de Photoshop desde `p` (cada uno: firma, id, nombre Pascal par, tamaño, datos): conjuntos IIM del recurso 0x0404. */
function iimFromResources(d, p){
  const out = [];
  while(p + 12 <= d.length && ascii(d, p, 4) === "8BIM"){
    const id = (d[p + 4] << 8) | d[p + 5];
    const nameLen = d[p + 6], nameTotal = 1 + nameLen + ((1 + nameLen) & 1);
    const q = p + 6 + nameTotal;
    const size = u32be(d, q);
    if(id === 0x0404) out.push(...parseIim(d.subarray(q + 4, q + 4 + size)));
    p = q + 4 + size + (size & 1);
  }
  return out;
}

/** Conjuntos IIM de un perfil IPTC suelto: IIM en bruto, o recursos de Photoshop (con o sin la cabecera «Photoshop 3.0»). */
export function iimFromProfile(u){
  if(u[0] === 0x1C) return parseIim(u);
  if(ascii(u, 0, 13) === "Photoshop 3.0") return iimFromResources(u, 14);
  return iimFromResources(u, 0);
}

/* Perfiles «Raw profile type X» de un PNG (tEXt, o zTXt comprimido): bytes decodificados del hexadecimal */
async function pngRawProfiles(u8, name){
  const out = [], key = `Raw profile type ${name}`;
  let i = 8;
  while(i + 12 <= u8.length){
    const n = u32be(u8, i), type = ascii(u8, i + 4, 4);
    if((type === "tEXt" || type === "zTXt") && ascii(u8, i + 8, key.length) === key && u8[i + 8 + key.length] === 0){
      let body = u8.subarray(i + 8 + key.length + 1, i + 8 + n);
      if(type === "zTXt"){
        if(typeof DecompressionStream !== "function") { i += 12 + n; continue; }
        try{ body = new Uint8Array(await new Response(new Blob([body.subarray(1)]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer()); }catch{ i += 12 + n; continue; }
      }
      // «\n<tipo> profile\n<tamaño>\n<hex en líneas>»
      const lines = td.decode(body).split("\n").filter(Boolean), size = parseInt(lines[1], 10), hex = lines.slice(2).join("").replace(/[^0-9a-fA-F]/g, "");
      const bytes = new Uint8Array(Math.min(size || hex.length / 2, hex.length >> 1));
      for(let k = 0; k < bytes.length; k++) bytes[k] = parseInt(hex.substr(k * 2, 2), 16);
      out.push(bytes);
    }
    if(type === "IEND") break;
    i += 12 + n;
  }
  return out;
}

/** Conjuntos de datos IIM del archivo: JPEG (APP13 de Photoshop), PNG («Raw profile type iptc»/«8bim») y TIFF/RAW basados en TIFF
    (etiqueta 33723, o el recurso de Photoshop 34377), [{ rec, ds, bytes }]. `tiff` es el resultado de parseTiff si ya se tiene. */
export async function readIptcAny(u8, tiff = null){
  if(u8[0] === 0xFF && u8[1] === 0xD8) return readIptc(u8);
  if(u8[0] === 0x89 && u8[1] === 0x50){
    const out = [];
    for(const name of ["iptc", "8bim"]) for(const prof of await pngRawProfiles(u8, name)) out.push(...iimFromProfile(prof));
    return out;
  }
  if(tiff){
    const raw = (e) => { if(!e) return null; const b = e.bytes.slice(); if(!tiff.le && e.type === 4) for(let k = 0; k + 4 <= b.length; k += 4) b.subarray(k, k + 4).reverse(); return b; };
    const a = raw(tiff.ifd0.find(e => e.tag === 0x83BB));
    if(a && a.length) return parseIim(a);
    const b = raw(tiff.ifd0.find(e => e.tag === 0x8649));
    if(b && b.length) return iimFromResources(b, 0);
  }
  return [];
}

/** Conjuntos de datos IIM del archivo (JPEG con APP13 de Photoshop): [{ rec, ds, bytes }] */
export function readIptc(u8){
  const out = [];
  for(const seg of jpegSegments(u8)){
    if(seg.marker !== 0xED || ascii(seg.data, 0, 13) !== "Photoshop 3.0") continue;
    out.push(...iimFromResources(seg.data, 14));
  }
  return out;
}

function findBytes(u, needle, from = 0){
  const n = needle.length, first = needle[0];
  outer: for(let i = from; i <= u.length - n; i++){
    if(u[i] !== first) continue;
    for(let k = 1; k < n; k++) if(u[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

/** Texto del paquete XMP del archivo (JPEG, PNG, WebP y, como último recurso, búsqueda del paquete), o null. */
export async function readXmp(u8){
  if(u8[0] === 0xFF && u8[1] === 0xD8){
    for(const seg of jpegSegments(u8)) if(seg.marker === 0xE1 && ascii(seg.data, 0, 28) === "http://ns.adobe.com/xap/1.0/") return td.decode(seg.data.subarray(29));
  } else if(u8[0] === 0x89 && u8[1] === 0x50){
    let i = 8;
    while(i + 12 <= u8.length){
      const n = u32be(u8, i), type = ascii(u8, i + 4, 4);
      if(type === "iTXt" && ascii(u8, i + 8, 17) === "XML:com.adobe.xmp"){
        // palabra clave\0 · indicador de compresión · método · idioma\0 · traducción\0 · texto
        const d = u8.subarray(i + 8, i + 8 + n), comp = d[18];
        const s1 = d.indexOf(0, 20), s2 = d.indexOf(0, s1 + 1);
        let text = d.subarray(s2 + 1);
        if(comp === 1 && typeof DecompressionStream === "function") text = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
        return td.decode(text);
      }
      if(type === "IEND") break;
      i += 12 + n;
    }
  } else if(ascii(u8, 0, 4) === "RIFF" && ascii(u8, 8, 4) === "WEBP"){
    let i = 12;
    while(i + 8 <= u8.length){
      const type = ascii(u8, i, 4), n = u8[i + 4] | (u8[i + 5] << 8) | (u8[i + 6] << 16) | (u8[i + 7] << 24);
      if(type === "XMP ") return td.decode(u8.subarray(i + 8, i + 8 + n));
      i += 8 + n + (n & 1);
    }
  }
  const a = findBytes(u8, enc("<x:xmpmeta"));
  if(a < 0) return null;
  const b = findBytes(u8, enc("</x:xmpmeta>"), a);
  return b < 0 ? null : td.decode(u8.subarray(a, b + 12));
}

/** XMP extendido de un JPEG (varios segmentos APP1 con «http://ns.adobe.com/xmp/extension/» que se recomponen por desplazamiento), o null. */
export function readXmpExtended(u8){
  if(u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
  const H = "http://ns.adobe.com/xmp/extension/\0", parts = [];
  let total = 0, guid = null;
  for(const seg of jpegSegments(u8)){
    if(seg.marker !== 0xE1 || ascii(seg.data, 0, H.length) !== H) continue;
    const d = seg.data, g = ascii(d, H.length, 32), dv = new DataView(d.buffer, d.byteOffset, d.byteLength), t = dv.getUint32(H.length + 32), off = dv.getUint32(H.length + 36);
    if(guid && g !== guid) continue;
    guid = g; total = t;
    if(total > 64 << 20) return null;
    parts.push({ off, data: d.subarray(H.length + 40) });
  }
  if(!parts.length || !total) return null;
  const out = new Uint8Array(total);
  for(const p of parts) if(p.off + p.data.length <= total) out.set(p.data, p.off);
  return td.decode(out);
}

/** Lee del archivo original lo necesario para filtrarlo. */
export async function readOriginalMetadata(file){
  const buf = await file.slice(0, Math.min(file.size, 64 << 20)).arrayBuffer();
  const u8 = new Uint8Array(buf);
  const at = findTiff(buf), tiff = at >= 0 ? parseTiff(buf, at) : null;
  const mk = tiff && tiff.exif.find(e => e.tag === 0x927C);
  return { tiff, xmp: await readXmp(u8), xmpExt: readXmpExtended(u8), iptc: await readIptcAny(u8, tiff), maker: mk && mk.off >= 0 ? { off: mk.off, bytes: mk.bytes } : null };
}
