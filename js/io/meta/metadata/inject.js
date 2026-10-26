/* ═══════════════════════════════════════════════════════════════
   metadata · inject
   Parte de js/io/meta/metadata.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { crc32 } from "../../formats/zip.js";
import { enc, NS, ascii, concat } from "./common.js";

/* ── incrustar en el archivo exportado ────────────────────────────── */
function app1Exif(tiff){
  const len = 2 + 6 + tiff.length;
  if(len > 65535) return null;
  const seg = new Uint8Array(2 + len);
  seg.set([0xFF, 0xE1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0], 0);
  seg.set(tiff, 10);
  return seg;
}

function app1Seg(head, body){
  const len = 2 + head.length + body.length;
  const seg = new Uint8Array(2 + len);
  seg.set([0xFF, 0xE1, len >> 8, len & 255], 0);
  seg.set(head, 4); seg.set(body, 4 + head.length);
  return seg;
}

/** Segmentos APP1 de XMP: uno si cabe; si no, XMP EXTENDIDO (especificación de Adobe): un paquete principal que sólo anuncia el GUID del
    extendido (MD5 en mayúsculas del paquete completo) y el paquete completo troceado en segmentos de «http://ns.adobe.com/xmp/extension/». */
export function xmpSegments(xmp){
  const head = enc("http://ns.adobe.com/xap/1.0/\0"), body = enc(xmp);
  if(2 + head.length + body.length <= 65535) return [app1Seg(head, body)];
  const guid = md5hex(body).toUpperCase();
  const main = enc(`<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="${NS.rdf}"><rdf:Description rdf:about="" xmlns:xmpNote="${NS.xmpNote}" xmpNote:HasExtendedXMP="${guid}"/></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`);
  const segs = [app1Seg(head, main)], eh = enc("http://ns.adobe.com/xmp/extension/\0"), CH = 65000;
  for(let off = 0; off < body.length; off += CH){
    const data = body.subarray(off, off + CH), h = new Uint8Array(eh.length + 40), dv = new DataView(h.buffer);
    h.set(eh, 0); h.set(enc(guid), eh.length); dv.setUint32(eh.length + 32, body.length); dv.setUint32(eh.length + 36, off);
    segs.push(app1Seg(h, data));
  }
  return segs;
}

/* MD5 (el XMP extendido lo identifica con él; WebCrypto no lo trae) */
export function md5hex(data){
  const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for(let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
  const n = data.length, total = ((n + 8) >> 6) * 64 + 64, m = new Uint8Array(total);
  m.set(data); m[n] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(total - 8, (n * 8) >>> 0, true); dv.setUint32(total - 4, Math.floor(n / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const rol = (x, c) => (x << c) | (x >>> (32 - c));
  for(let o = 0; o < total; o += 64){
    let A = a0, B = b0, C = c0, D = d0;
    for(let i = 0; i < 64; i++){
      let F, g;
      if(i < 16){ F = (B & C) | (~B & D); g = i; }
      else if(i < 32){ F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
      else if(i < 48){ F = B ^ C ^ D; g = (3 * i + 5) & 15; }
      else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      const tmp = D; D = C; C = B;
      B = (B + rol((A + F + K[i] + dv.getUint32(o + g * 4, true)) | 0, S[(i >> 4) * 4 + (i & 3)])) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true); ov.setUint32(4, b0, true); ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
  return [...out].map(b => b.toString(16).padStart(2, "0")).join("");
}

function app13(iptc){
  const len = 2 + iptc.length;
  if(len > 65535) return null;
  const seg = new Uint8Array(2 + len);
  seg.set([0xFF, 0xED, len >> 8, len & 255], 0);
  seg.set(iptc, 4);
  return seg;
}

function injectJpeg(u8, segs){
  if(u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
  const head = [u8.subarray(0, 2)], tail = [];
  let i = 2, placed = false;
  while(i < u8.length - 1){
    if(u8[i] !== 0xFF) break;
    let j = i; while(u8[j + 1] === 0xFF) j++;
    const m = u8[j + 1];
    if(m === 0x01 || (m >= 0xD0 && m <= 0xD9)){ tail.push(u8.subarray(j, j + 2)); i = j + 2; continue; }
    if(m === 0xDA){ tail.push(u8.subarray(j)); i = u8.length; break; }
    const sl = (u8[j + 2] << 8) | u8[j + 3];
    if(sl < 2) break;
    const s = u8.subarray(j, j + 2 + sl);
    const isExif = m === 0xE1 && ascii(u8, j + 4, 4) === "Exif", isXmp = m === 0xE1 && (ascii(u8, j + 4, 28) === "http://ns.adobe.com/xap/1.0/" || ascii(u8, j + 4, 34) === "http://ns.adobe.com/xmp/extension/");
    if(isExif || isXmp || m === 0xED){ /* los previos, fuera */ }
    else if(m === 0xE0 && !placed){ head.push(s, ...segs); placed = true; }
    else (placed ? tail : head).push(s);
    i = j + 2 + sl;
  }
  if(!placed) head.push(...segs);
  return new Blob([...head, ...tail], { type: "image/jpeg" });
}

function pngChunk(type, payload){
  const out = new Uint8Array(12 + payload.length), v = new DataView(out.buffer);
  v.setUint32(0, payload.length);
  for(let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  v.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)));
  return out;
}

/* IPTC en PNG: no hay chunk propio; la convención (ImageMagick, ExifTool, Photoshop) es un tEXt «Raw profile type iptc» con el perfil en hexadecimal */
function rawProfileChunk(name, bytes){
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""), lines = hex.match(/.{1,72}/g) || [];
  return pngChunk("tEXt", enc(`Raw profile type ${name}\0\n${name === "iptc" ? "IPTC" : name} profile\n${String(bytes.length).padStart(8, " ")}\n${lines.join("\n")}\n`));
}

function injectPng(u8, { exif, xmp, iptc }){
  if(u8[0] !== 0x89 || u8[1] !== 0x50) return null;
  const add = [];
  if(exif) add.push(pngChunk("eXIf", exif));
  if(iptc) add.push(rawProfileChunk("iptc", iptc));
  if(xmp) add.push(pngChunk("iTXt", concat([enc("XML:com.adobe.xmp"), new Uint8Array([0, 0, 0, 0, 0]), enc(xmp)])));
  const parts = [u8.subarray(0, 8)];
  let i = 8, placed = false;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  while(i + 8 <= u8.length){
    const n = dv.getUint32(i), type = ascii(u8, i + 4, 4);
    if(type === "IDAT" && !placed){ parts.push(...add); placed = true; }
    if(type === "eXIf" || (type === "tEXt" && ascii(u8, i + 8, 22) === "Raw profile type iptc\0")) { i += 12 + n; continue; }
    parts.push(u8.subarray(i, i + 12 + n));
    i += 12 + n;
    if(type === "IEND") break;
  }
  return new Blob(parts, { type: "image/png" });
}

function injectWebp(u8, { exif, xmp }){
  if(ascii(u8, 0, 4) !== "RIFF" || ascii(u8, 8, 4) !== "WEBP") return null;
  const chunks = [];
  let i = 12;
  while(i + 8 <= u8.length){
    const type = ascii(u8, i, 4), n = u8[i + 4] | (u8[i + 5] << 8) | (u8[i + 6] << 16) | (u8[i + 7] << 24);
    chunks.push({ type, data: u8.subarray(i + 8, i + 8 + n) });
    i += 8 + n + (n & 1);
  }
  if(!chunks.length) return null;
  let vp8x = chunks.find(c => c.type === "VP8X");
  const rest = chunks.filter(c => c.type !== "VP8X" && c.type !== "EXIF" && c.type !== "XMP ");
  let flags = 0, cw = 0, ch = 0;
  if(vp8x){ flags = vp8x.data[0]; cw = 1 + (vp8x.data[4] | (vp8x.data[5] << 8) | (vp8x.data[6] << 16)); ch = 1 + (vp8x.data[7] | (vp8x.data[8] << 8) | (vp8x.data[9] << 16)); }
  else {
    const img = rest.find(c => c.type === "VP8 " || c.type === "VP8L");
    if(!img) return null;
    const d = img.data;
    if(img.type === "VP8L"){ const bits = (d[1] | (d[2] << 8) | (d[3] << 16) | (d[4] << 24)) >>> 0; cw = (bits & 0x3FFF) + 1; ch = ((bits >>> 14) & 0x3FFF) + 1; if((bits >>> 28) & 1) flags |= 0x10; }
    else { cw = (d[6] | (d[7] << 8)) & 0x3FFF; ch = (d[8] | (d[9] << 8)) & 0x3FFF; }
  }
  if(rest.some(c => c.type === "ALPH")) flags |= 0x10;
  if(rest.some(c => c.type === "ICCP")) flags |= 0x20;
  if(exif) flags |= 0x08;
  if(xmp) flags |= 0x04;
  const head = new Uint8Array(10); head[0] = flags;
  head[4] = (cw - 1) & 255; head[5] = ((cw - 1) >> 8) & 255; head[6] = ((cw - 1) >> 16) & 255;
  head[7] = (ch - 1) & 255; head[8] = ((ch - 1) >> 8) & 255; head[9] = ((ch - 1) >> 16) & 255;
  const list = [{ type: "VP8X", data: head }, ...rest];
  if(exif) list.push({ type: "EXIF", data: exif });
  if(xmp) list.push({ type: "XMP ", data: enc(xmp) });
  const parts = [];
  let total = 4;
  for(const c of list){
    const n = c.data.length, h = new Uint8Array(8);
    h.set(enc(c.type), 0); h[4] = n & 255; h[5] = (n >> 8) & 255; h[6] = (n >> 16) & 255; h[7] = (n >>> 24) & 255;
    parts.push(h, c.data); total += 8 + n;
    if(n & 1){ parts.push(new Uint8Array(1)); total += 1; }
  }
  const riff = new Uint8Array(12);
  riff.set(enc("RIFF"), 0); new DataView(riff.buffer).setUint32(4, total, true); riff.set(enc("WEBP"), 8);
  return new Blob([riff, ...parts], { type: "image/webp" });
}

/** Incrusta `meta` ({ exif, xmp, iptc, iim }) en un JPEG, PNG, WebP, AVIF, JPEG XL o TIFF recién exportado (el PDF los lleva desde que se
    construye: ver pdfFromCanvases). El formato se reconoce por los primeros bytes. Si algo falla, devuelve el archivo tal cual. */
export async function embedMetadata(blob, meta){
  try{
    if(!meta || (!meta.exif && !meta.xmp && !meta.iptc && !meta.iim)) return blob;
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let out = null;
    if(u8[0] === 0xFF && u8[1] === 0xD8){
      const segs = [(meta.exifJpeg || meta.exif) && app1Exif(meta.exifJpeg || meta.exif), ...(meta.xmp ? xmpSegments(meta.xmp) : []), meta.iptc && app13(meta.iptc)].filter(Boolean);
      out = segs.length ? injectJpeg(u8, segs) : null;
    } else if(u8[0] === 0x89 && u8[1] === 0x50) out = injectPng(u8, meta);
    else if(ascii(u8, 0, 4) === "RIFF" && ascii(u8, 8, 4) === "WEBP") out = injectWebp(u8, meta);
    else {
      const C = await import("../metacontainers.js");
      out = C.injectContainer(u8, meta);
    }
    return out || blob;
  }catch(err){ console.warn("[metadatos]", err); return blob; }
}
