/* ═══════════════════════════════════════════════════════════════
   METADATOS DEL ORIGINAL AL EXPORTAR (fase 15 de PENDIENTE.md)

   El lienzo del navegador codifica sin metadatos: un JPEG, PNG o WebP exportado sale
   «limpio». Aquí se puede, a elección de la persona, volver a escribir parte de lo que traía
   el archivo original, filtrado:

     autor       Artist y Copyright (EXIF), By-line, Copyright, Credit y Source (IPTC), creador,
                 derechos y términos de uso (XMP)
     fecha       fecha y hora de la toma (EXIF, IPTC y XMP)
     cámara      marca, modelo, objetivo, exposición, ISO, flash… (EXIF estándar)
     gps         ubicación GPS (EXIF) y lugar (IPTC y XMP)
     texto       descripción, comentarios, título y palabras clave
     ids         números de serie e identificador único de la imagen (sólo con «Todos»)

   Siempre se descartan: la miniatura incrustada (enseña el original SIN recortar ni retocar,
   un clásico agujero de privacidad), las notas del fabricante (MakerNote: números de serie,
   contadores, nombre del propietario), la orientación (el lienzo ya sale girado) y el perfil
   ICC del original (los píxeles ya están convertidos al espacio del documento; el perfil de
   éste lo incrusta la exportación como siempre).

   Por construcción es una LISTA BLANCA: nada se copia que no esté nombrado aquí. El EXIF se
   reescribe etiqueta a etiqueta (sea el original big o little endian); IPTC y XMP se construyen
   de nuevo con los campos permitidos, no se filtran los originales.
   ═══════════════════════════════════════════════════════════════ */

import { findTiff } from "../../hdr/exif.js";
import { buildTIFF } from "../exif/writer.js";
import { crc32 } from "./zip.js";

export { META_NONE, META_PRESETS, metaActive } from "./metapresets.js";

/* ── ExifReader (MPL-2.0, sin modificar) bajo demanda ─────────────── */
let xrLoading = null;
export function loadExifReader(){
  if(globalThis.ExifReader) return Promise.resolve(globalThis.ExifReader);
  if(xrLoading) return xrLoading;
  xrLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../vendor/exifreader/exif-reader.js", import.meta.url).href;
    s.onload = () => globalThis.ExifReader ? resolve(globalThis.ExifReader) : reject(new Error("ExifReader no arrancó"));
    s.onerror = () => reject(new Error("No se pudo cargar el lector de metadatos"));
    document.head.appendChild(s);
  }).finally(() => { if(!globalThis.ExifReader) xrLoading = null; });
  return xrLoading;
}

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
      list.push({ tag, type, count, bytes });
    }
    return list;
  };
  const pointer = (list, tag) => { const e = list.find(x => x.tag === tag); return e && e.bytes.length >= 4 ? new DataView(e.bytes.buffer, e.bytes.byteOffset, 4).getUint32(0, true) : 0; };
  const ifd0 = readIfd(u32(4));
  return { ifd0, exif: readIfd(pointer(ifd0, 0x8769)), gps: readIfd(pointer(ifd0, 0x8825)) };
}

/* ── clasificación de etiquetas (lista blanca) ────────────────────── */
const IFD0_CLASS = {
  0x010E: "text", 0x010F: "camera", 0x0110: "camera", 0x0131: "camera", 0x0132: "date", 0x013B: "author", 0x8298: "author",
  0x011A: "camera", 0x011B: "camera", 0x0128: "camera", 0x0213: "camera"
};
const EXIF_CLASS = {
  0x9003: "date", 0x9004: "date", 0x9010: "date", 0x9011: "date", 0x9012: "date", 0x9290: "date", 0x9291: "date", 0x9292: "date",
  0xA430: "author", 0x9286: "text", 0xA431: "ids", 0xA435: "ids", 0xA420: "ids"
};
// Del IFD Exif se descartan siempre: notas del fabricante, interoperabilidad y lo que se vuelve a escribir
const EXIF_DROP = new Set([0x927C, 0xA005, 0x8769, 0x8825, 0xA002, 0xA003, 0x9000, 0xA001]);

const bytesOf = (tag, type, count, bytes) => ({ tag, type, count, bytes });
const longEntry = (tag, v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return bytesOf(tag, 4, 1, b); };
const shortEntry = (tag, v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return bytesOf(tag, 3, 1, b); };

/** Bloque TIFF/EXIF nuevo con lo que permite `policy`, o null si no queda nada. `w`×`h`: medidas del archivo
    exportado; `p3`: el documento está en Display P3. */
export function buildFilteredExif(parsed, policy, { w, h, p3 = false, original = false } = {}){
  if(!parsed) return null;
  const keep = (cls) => !!policy[cls];
  /* `original`: se limpia el propio archivo original sin recodificarlo (Limpiar metadatos): la orientación y las
     etiquetas de estructura del EXIF siguen siendo ciertas y se conservan; sin ello (exportación), no. */
  const ifd0 = parsed.ifd0.filter(e => { if(original && e.tag === 0x0112) return true; const c = IFD0_CLASS[e.tag]; return c && keep(c); });
  let exif = parsed.exif.filter(e => {
    if(original && (e.tag === 0x9000 || e.tag === 0xA001 || e.tag === 0xA002 || e.tag === 0xA003)) return true;
    if(EXIF_DROP.has(e.tag)) return false;
    const c = EXIF_CLASS[e.tag] || "camera";
    return keep(c);
  });
  const gps = policy.gps ? parsed.gps.slice() : [];
  if(exif.length && !original){
    exif.push(bytesOf(0x9000, 7, 4, new Uint8Array([0x30, 0x32, 0x33, 0x32])));          // ExifVersion «0232»
    exif.push(shortEntry(0xA001, p3 ? 0xFFFF : 1));                                       // ColorSpace
    if(w && h){ exif.push(longEntry(0xA002, w)); exif.push(longEntry(0xA003, h)); }       // medidas del archivo, no del original
  }
  if(!ifd0.length && !exif.length && !gps.length) return null;
  return buildTIFF(ifd0, exif, gps);
}

/* ── IPTC (IIM) ───────────────────────────────────────────────────── */
const IPTC_SETS = {
  author: [80, 85, 110, 115, 116],
  text: [5, 25, 40, 105, 120, 122],
  date: [55, 60, 62, 63],
  gps: [26, 90, 92, 95, 100, 101]
};

function u32be(u, i){ return ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0; }
const ascii = (u, i, n) => { let s = ""; for(let k = 0; k < n && i + k < u.length; k++) s += String.fromCharCode(u[i + k]); return s; };

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

/** Conjuntos de datos IIM del archivo (JPEG con APP13 de Photoshop): [{ rec, ds, bytes }] */
export function readIptc(u8){
  const out = [];
  for(const seg of jpegSegments(u8)){
    if(seg.marker !== 0xED || ascii(seg.data, 0, 13) !== "Photoshop 3.0") continue;
    const d = seg.data;
    let p = 14;
    while(p + 12 <= d.length && ascii(d, p, 4) === "8BIM"){
      const id = (d[p + 4] << 8) | d[p + 5];
      const nameLen = d[p + 6], nameTotal = 1 + nameLen + ((1 + nameLen) & 1);
      const q = p + 6 + nameTotal;
      const size = u32be(d, q);
      const body = d.subarray(q + 4, q + 4 + size);
      if(id === 0x0404){
        let i = 0;
        while(i + 5 <= body.length && body[i] === 0x1C){
          const rec = body[i + 1], ds = body[i + 2];
          let n = (body[i + 3] << 8) | body[i + 4], hdr = 5;
          if(n & 0x8000){ const k = n & 0x7FFF; n = 0; for(let j = 0; j < k; j++) n = n * 256 + body[i + 5 + j]; hdr = 5 + k; }
          out.push({ rec, ds, bytes: body.slice(i + hdr, i + hdr + n) });
          i += hdr + n;
        }
      }
      p = q + 4 + size + (size & 1);
    }
  }
  return out;
}

/** Segmento APP13 con sólo los conjuntos IPTC que permite `policy`, o null. */
export function buildIptc(sets, policy){
  const allowed = new Set();
  for(const cls of Object.keys(IPTC_SETS)) if(policy[cls]) for(const d of IPTC_SETS[cls]) allowed.add(d);
  const kept = sets.filter(s => s.rec === 2 && allowed.has(s.ds) && s.bytes.length < 32768);
  if(!kept.length) return null;
  const charset = sets.find(s => s.rec === 1 && s.ds === 90);          // codificación de caracteres (UTF-8 o la antigua)
  const parts = [];
  const add = (rec, ds, bytes) => { parts.push(new Uint8Array([0x1C, rec, ds, bytes.length >> 8, bytes.length & 255]), bytes); };
  add(2, 0, new Uint8Array([0, 4]));                                     // versión del registro
  kept.sort((a, b) => a.ds - b.ds);
  if(charset) parts.unshift(new Uint8Array([0x1C, 1, 90, charset.bytes.length >> 8, charset.bytes.length & 255]), charset.bytes);
  for(const s of kept) add(2, s.ds, s.bytes);
  const iim = concat(parts);
  const pad = iim.length & 1;
  const irb = new Uint8Array(4 + 2 + 2 + 4 + iim.length + pad);
  irb.set([0x38, 0x42, 0x49, 0x4D, 0x04, 0x04, 0, 0], 0);                // «8BIM», recurso 0x0404, nombre vacío
  new DataView(irb.buffer).setUint32(8, iim.length);
  irb.set(iim, 12);
  const head = new TextEncoder().encode("Photoshop 3.0\0");
  return concat([head, irb]);
}

/* ── XMP ──────────────────────────────────────────────────────────── */
const td = new TextDecoder("utf-8", { fatal: false });
function findBytes(u, needle, from = 0){
  const n = needle.length, first = needle[0];
  outer: for(let i = from; i <= u.length - n; i++){
    if(u[i] !== first) continue;
    for(let k = 1; k < n; k++) if(u[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}
const enc = s => new TextEncoder().encode(s);

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

const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", dc: "http://purl.org/dc/elements/1.1/", xmp: "http://ns.adobe.com/xap/1.0/",
  photoshop: "http://ns.adobe.com/photoshop/1.0/", xmpRights: "http://ns.adobe.com/xap/1.0/rights/",
  Iptc4xmpCore: "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
};
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Un valor XMP: texto suelto, atributo de rdf:Description, o lista (Seq/Bag/Alt) → { kind: "text"|"Seq"|"Bag"|"Alt", items:[{ text, lang }] } */
function xmpProp(doc, ns, name){
  const descs = [...doc.getElementsByTagNameNS(NS.rdf, "Description")];
  for(const d of descs){
    const v = d.getAttributeNS(ns, name);
    if(v) return { kind: "text", items: [{ text: v }] };
  }
  const el = doc.getElementsByTagNameNS(ns, name)[0];
  if(!el) return null;
  const list = [...el.children].find(c => c.namespaceURI === NS.rdf && ["Seq", "Bag", "Alt"].includes(c.localName));
  if(list){
    const items = [...list.children].filter(c => c.localName === "li").map(li => ({ text: li.textContent, lang: li.getAttribute("xml:lang") || null })).filter(x => x.text);
    return items.length ? { kind: list.localName, items } : null;
  }
  const t = el.textContent.trim();
  return t ? { kind: "text", items: [{ text: t }] } : null;
}

const XMP_SETS = {
  author: [["dc", "creator"], ["dc", "rights"], ["xmpRights", "UsageTerms"], ["xmpRights", "WebStatement"], ["xmpRights", "Marked"], ["photoshop", "Credit"], ["photoshop", "Source"]],
  text: [["dc", "title"], ["dc", "description"], ["dc", "subject"], ["photoshop", "Headline"]],
  date: [["xmp", "CreateDate"], ["photoshop", "DateCreated"]],
  gps: [["photoshop", "City"], ["photoshop", "State"], ["photoshop", "Country"], ["Iptc4xmpCore", "Location"], ["Iptc4xmpCore", "CountryCode"]]
};

/** Paquete XMP nuevo (texto) con los campos que permite `policy`, o null. */
export function buildXmp(xmpText, policy){
  if(!xmpText) return null;
  let xdoc;
  try{
    xdoc = new DOMParser().parseFromString(xmpText.replace(/^[^<]*/, "").replace(/<\?xpacket[^>]*\?>/g, ""), "application/xml");
    if(xdoc.getElementsByTagName("parsererror").length) return null;
  }catch{ return null; }
  const used = new Set(), body = [];
  for(const cls of Object.keys(XMP_SETS)){
    if(!policy[cls]) continue;
    for(const [pfx, name] of XMP_SETS[cls]){
      const v = xmpProp(xdoc, NS[pfx], name);
      if(!v) continue;
      used.add(pfx);
      if(v.kind === "text") body.push(`<${pfx}:${name}>${esc(v.items[0].text)}</${pfx}:${name}>`);
      else body.push(`<${pfx}:${name}><rdf:${v.kind}>${v.items.map(it => `<rdf:li${it.lang ? ` xml:lang="${esc(it.lang)}"` : ""}>${esc(it.text)}</rdf:li>`).join("")}</rdf:${v.kind}></${pfx}:${name}>`);
    }
  }
  if(!body.length) return null;
  const decl = [...used].map(p => `xmlns:${p}="${NS[p]}"`).join(" ");
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="${NS.rdf}"><rdf:Description rdf:about="" ${decl}>${body.join("")}</rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`;
}

/* ── lectura del original y construcción de lo que se escribe ─────── */
function concat(parts){
  let n = 0; for(const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for(const p of parts){ out.set(p, o); o += p.length; }
  return out;
}

/** Lee del archivo original lo necesario para filtrarlo. */
export async function readOriginalMetadata(file){
  const buf = await file.slice(0, Math.min(file.size, 64 << 20)).arrayBuffer();
  const u8 = new Uint8Array(buf);
  const at = findTiff(buf);
  return { tiff: at >= 0 ? parseTiff(buf, at) : null, xmp: await readXmp(u8), iptc: readIptc(u8) };
}

/** { exif (TIFF), xmp (texto), iptc (APP13) } listos para incrustar según `policy`; cualquier parte puede ser null. */
export function filterMetadata(orig, policy, opts){
  return {
    exif: buildFilteredExif(orig.tiff, policy, opts),
    xmp: buildXmp(orig.xmp, policy),
    iptc: buildIptc(orig.iptc, policy)
  };
}

/* ── incrustar en el archivo exportado ────────────────────────────── */
function app1Exif(tiff){
  const len = 2 + 6 + tiff.length;
  if(len > 65535) return null;
  const seg = new Uint8Array(2 + len);
  seg.set([0xFF, 0xE1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0], 0);
  seg.set(tiff, 10);
  return seg;
}
function app1Xmp(xmp){
  const head = enc("http://ns.adobe.com/xap/1.0/\0"), body = enc(xmp), len = 2 + head.length + body.length;
  if(len > 65535) return null;
  const seg = new Uint8Array(2 + len);
  seg.set([0xFF, 0xE1, len >> 8, len & 255], 0);
  seg.set(head, 4); seg.set(body, 4 + head.length);
  return seg;
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
    const isExif = m === 0xE1 && ascii(u8, j + 4, 4) === "Exif", isXmp = m === 0xE1 && ascii(u8, j + 4, 28) === "http://ns.adobe.com/xap/1.0/";
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
function injectPng(u8, { exif, xmp }){
  if(u8[0] !== 0x89 || u8[1] !== 0x50) return null;
  const add = [];
  if(exif) add.push(pngChunk("eXIf", exif));
  if(xmp) add.push(pngChunk("iTXt", concat([enc("XML:com.adobe.xmp"), new Uint8Array([0, 0, 0, 0, 0]), enc(xmp)])));
  const parts = [u8.subarray(0, 8)];
  let i = 8, placed = false;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  while(i + 8 <= u8.length){
    const n = dv.getUint32(i), type = ascii(u8, i + 4, 4);
    if(type === "IDAT" && !placed){ parts.push(...add); placed = true; }
    if(type === "eXIf") { i += 12 + n; continue; }
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

/** Incrusta `meta` ({ exif, xmp, iptc }) en un JPEG, PNG o WebP recién exportado. Si algo falla, devuelve el archivo tal cual. */
export async function embedMetadata(blob, meta){
  try{
    if(!meta || (!meta.exif && !meta.xmp && !meta.iptc)) return blob;
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let out = null;
    if(blob.type === "image/jpeg"){
      const segs = [meta.exif && app1Exif(meta.exif), meta.xmp && app1Xmp(meta.xmp), meta.iptc && app13(meta.iptc)].filter(Boolean);
      out = segs.length ? injectJpeg(u8, segs) : null;
    } else if(blob.type === "image/png") out = injectPng(u8, meta);
    else if(blob.type === "image/webp") out = injectWebp(u8, meta);
    return out || blob;
  }catch(err){ console.warn("[metadatos]", err); return blob; }
}

/** Texto corto de lo que lleva `meta`, para el aviso tras exportar. */
export function describeMeta(meta, policy){
  const parts = [];
  if(meta.exif || meta.xmp || meta.iptc){
    if(policy.author) parts.push("autor");
    if(policy.date) parts.push("fecha");
    if(policy.camera) parts.push("cámara");
    if(policy.gps) parts.push("GPS");
    if(policy.text) parts.push("descripción");
  }
  return parts.join(", ");
}
