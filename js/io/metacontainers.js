/* ═══════════════════════════════════════════════════════════════
   METADATOS EN AVIF, JPEG XL Y TIFF (v253)
   `injectContainer(u8, meta)` incrusta { exif (bloque TIFF), xmp (texto), iim (IPTC en bruto) } en un archivo ya codificado, reconociendo el
   formato por los primeros bytes. No recodifica nada: sólo añade cajas o etiquetas.

     · AVIF (HEIF): se añaden al `meta` los elementos «Exif» y «mime» (XMP) con sus entradas en `iinf`, `iloc` y `iref` (referencia «cdsc» a la
       imagen principal) y los datos van en una caja `mdat` nueva al final; el `iloc` se reescribe entero (desplazamientos de 4 bytes) y los
       desplazamientos de lo que ya había se corrigen por lo que crece el `meta`.
     · JPEG XL: el códec devuelve el flujo «desnudo»; se envuelve en el contenedor ISO (firma, `ftyp`, caja «Exif», caja «xml » y `jxlc`). Si ya era
       un contenedor, las cajas nuevas van antes del primer `jxlc`/`jxlp`.
     · TIFF: se añaden al IFD principal Artist, Copyright, descripción, fecha…, el IFD Exif (y GPS), el XMP (700) y el IPTC (33723); el IFD nuevo se
       escribe al final del archivo y la cabecera pasa a apuntar a él (lo anterior no se mueve).
   El PDF no pasa por aquí: lleva sus metadatos desde que se construye (io/formats.js › pdfFromCanvases).
   ═══════════════════════════════════════════════════════════════ */

import { parseTiff } from "./metadata.js";

const enc = s => new TextEncoder().encode(s);
const ascii = (u, i, n) => { let s = ""; for(let k = 0; k < n && i + k < u.length; k++) s += String.fromCharCode(u[i + k]); return s; };
const concat = parts => { let n = 0; for(const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for(const p of parts){ out.set(p, o); o += p.length; } return out; };
const u32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0); return b; };
const u16 = v => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v); return b; };
const box = (type, ...payload) => { const body = concat(payload); return concat([u32(8 + body.length), enc(type), body]); };

export function injectContainer(u8, meta){
  if(ascii(u8, 4, 4) === "ftyp") return injectHeif(u8, meta);
  if((u8[0] === 0xFF && u8[1] === 0x0A) || ascii(u8, 4, 4) === "JXL ") return injectJxl(u8, meta);
  if(u8[0] === 0x49 && u8[1] === 0x49 && u8[2] === 0x2A && u8[3] === 0) return injectTiff(u8, meta);
  return null;
}

/* ── cajas ISO ─────────────────────────────────────────────────── */
function readBoxes(u8, start, end){
  const out = [];
  let o = start;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  while(o + 8 <= end){
    let size = dv.getUint32(o), hdr = 8;
    const type = ascii(u8, o + 4, 4);
    if(size === 1){ size = Number(dv.getBigUint64(o + 8)); hdr = 16; }
    else if(size === 0) size = end - o;
    if(size < hdr || o + size > end) break;
    out.push({ type, start: o, hdr, size, end: o + size });
    o += size;
  }
  return out;
}

/* ── AVIF / HEIF ───────────────────────────────────────────────── */
function injectHeif(u8, { exif, xmp }){
  if(!exif && !xmp) return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const top = readBoxes(u8, 0, u8.length), metaBox = top.find(b => b.type === "meta");
  if(!metaBox) return null;
  const mStart = metaBox.start + metaBox.hdr + 4, kids = readBoxes(u8, mStart, metaBox.end);
  const get = t => kids.find(k => k.type === t);
  const pitm = get("pitm"), iinf = get("iinf"), iloc = get("iloc"), iref = get("iref");
  if(!pitm || !iinf || !iloc) return null;
  const pv = u8[pitm.start + pitm.hdr], primary = pv === 0 ? dv.getUint16(pitm.start + pitm.hdr + 4) : dv.getUint32(pitm.start + pitm.hdr + 4);
  // elementos existentes (iinf)
  const iv = u8[iinf.start + iinf.hdr], icPos = iinf.start + iinf.hdr + 4;
  const count = iv === 0 ? dv.getUint16(icPos) : dv.getUint32(icPos), infes = readBoxes(u8, icPos + (iv === 0 ? 2 : 4), iinf.end);
  let maxId = primary;
  const itemType = {};
  for(const e of infes){
    const ev = u8[e.start + e.hdr], p = e.start + e.hdr + 4, id = ev >= 3 ? dv.getUint32(p) : dv.getUint16(p);
    if(id > maxId) maxId = id;
    if(ev >= 2) itemType[id] = ascii(u8, p + (ev >= 3 ? 4 : 2) + 2, 4);
  }
  if(infes.length !== count && infes.length === 0) return null;
  // iloc existente
  const lv = u8[iloc.start + iloc.hdr];
  let p = iloc.start + iloc.hdr + 4;
  const offSize = u8[p] >> 4, lenSize = u8[p] & 15, baseSize = u8[p + 1] >> 4, idxSize = lv >= 1 ? u8[p + 1] & 15 : 0;
  p += 2;
  const rd = n => { let v = 0; for(let i = 0; i < n; i++) v = v * 256 + u8[p + i]; p += n; return v; };
  const nItems = lv < 2 ? (p += 2, dv.getUint16(p - 2)) : (p += 4, dv.getUint32(p - 4));
  const items = [];
  for(let i = 0; i < nItems; i++){
    const id = lv < 2 ? rd(2) : rd(4);
    let method = 0; if(lv >= 1){ method = rd(2) & 15; }
    const dri = rd(2), base = rd(baseSize), ne = rd(2), ext = [];
    for(let k = 0; k < ne; k++){ if(lv >= 1 && idxSize) rd(idxSize); ext.push({ off: rd(offSize), len: rd(lenSize) }); }
    items.push({ id, method, dri, base, ext });
    if(id > maxId) maxId = id;
  }
  // elementos nuevos
  const add = [];
  if(exif) add.push({ type: "Exif", data: concat([u32(0), exif]) });                       // desplazamiento de la cabecera TIFF = 0
  if(xmp) add.push({ type: "mime", ct: "application/rdf+xml", data: enc(xmp) });
  add.forEach((a, i) => { a.id = maxId + 1 + i; });
  if(add.some(a => a.id > 65535) && (lv < 2 && iv === 0)) return null;
  const infeNew = add.map(a => {
    const name = a.ct ? concat([enc("\0"), enc(a.ct + "\0")]) : enc("\0");
    return box("infe", new Uint8Array([2, 0, 0, 0]), u16(a.id), u16(0), enc(a.type), name);
  });
  const newCount = count + add.length;
  const iinfNew = box("iinf", new Uint8Array([iv, 0, 0, 0]), iv === 0 ? u16(newCount) : u32(newCount), u8.subarray(icPos + (iv === 0 ? 2 : 4), iinf.end), ...infeNew);
  const idBytes = v => (get("iref") && u8[iref.start + iref.hdr] === 1) ? u32(v) : u16(v);
  const cdsc = add.map(a => box("cdsc", idBytes(a.id), u16(1), idBytes(primary)));
  const irefNew = iref ? box("iref", u8.subarray(iref.start + iref.hdr, iref.end), ...cdsc) : box("iref", new Uint8Array([0, 0, 0, 0]), ...cdsc);
  // iloc nuevo (desplazamientos de 4 bytes, sin base) — depende de `delta` y de dónde van los datos nuevos
  const buildIloc = (delta, dataStart) => {
    const parts = [new Uint8Array([lv, 0, 0, 0, 0x44, lv >= 1 ? 0 : 0]), lv < 2 ? u16(items.length + add.length) : u32(items.length + add.length)];
    const oldEnd = metaBox.end;
    for(const it of items){
      parts.push(lv < 2 ? u16(it.id) : u32(it.id));
      if(lv >= 1) parts.push(u16(it.method));
      parts.push(u16(it.dri), u16(it.ext.length));
      for(const e of it.ext){
        let off = it.base + e.off;
        if(it.method === 0 && off >= oldEnd) off += delta;
        parts.push(u32(off), u32(e.len));
      }
    }
    let at = dataStart;
    for(const a of add){
      parts.push(lv < 2 ? u16(a.id) : u32(a.id));
      if(lv >= 1) parts.push(u16(0));
      parts.push(u16(0), u16(1), u32(at), u32(a.data.length));
      at += a.data.length;
    }
    return box("iloc", ...parts);
  };
  const assemble = (delta, dataStart) => {
    const parts = [];
    for(const k of kids){
      if(k === iinf) parts.push(iinfNew);
      else if(k === iloc) parts.push(buildIloc(delta, dataStart));
      else if(k === iref) parts.push(irefNew);
      else parts.push(u8.subarray(k.start, k.end));
    }
    if(!iref) parts.push(irefNew);
    return box("meta", u8.subarray(metaBox.start + metaBox.hdr, mStart), ...parts);
  };
  const first = assemble(0, 0), delta = first.length - metaBox.size;
  const dataStart = u8.length + delta + 8;                                                // tras la cabecera de la mdat nueva
  const meta = assemble(delta, dataStart);
  if(meta.length !== first.length) return null;
  const mdat = box("mdat", ...add.map(a => a.data));
  return new Blob([u8.subarray(0, metaBox.start), meta, u8.subarray(metaBox.end), mdat], { type: "image/avif" });
}

/* ── JPEG XL ───────────────────────────────────────────────────── */
function injectJxl(u8, { exif, xmp }){
  if(!exif && !xmp) return null;
  const extra = [];
  if(exif) extra.push(box("Exif", u32(0), exif));
  if(xmp) extra.push(box("xml ", enc(xmp)));
  if(u8[0] === 0xFF && u8[1] === 0x0A){
    const sig = new Uint8Array([0, 0, 0, 12, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A]);
    return new Blob([sig, box("ftyp", enc("jxl "), u32(0), enc("jxl ")), ...extra, box("jxlc", u8)], { type: "image/jxl" });
  }
  const bs = readBoxes(u8, 0, u8.length);
  const at = bs.findIndex(b => b.type === "jxlc" || b.type === "jxlp");
  if(at < 0) return null;
  const parts = [];
  bs.forEach((b, i) => {
    if(i === at) parts.push(...extra);
    if(b.type === "Exif" || b.type === "xml ") return;          // los anteriores, fuera
    parts.push(u8.subarray(b.start, b.end));
  });
  return new Blob(parts, { type: "image/jxl" });
}

/* ── TIFF ──────────────────────────────────────────────────────── */
const TS = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const IFD0_ADD = new Set([0x010E, 0x010F, 0x0110, 0x0131, 0x0132, 0x013B, 0x8298]);      // lo que el EXIF filtrado aporta al IFD principal de un TIFF

/* Nota del fabricante en un TIFF: en el EXIF de un JPEG/AVIF/JXL va en el mismo desplazamiento que tenía, pero un TIFF ya tiene sus datos ahí.
   Se añade al final y se corrigen los desplazamientos que lleva dentro: Canon los cuenta desde el principio del archivo (se suma lo que se ha movido);
   Nikon (tipo 3) los cuenta desde su propia cabecera y sirve donde sea. Otros fabricantes no se copian a un TIFF. */
function relocateMaker(maker, newOff){
  const b = maker.bytes.slice();
  if(/^Nikon\0\x02/.test(String.fromCharCode(...b.subarray(0, 7)))) return b;
  if(!/^Canon/i.test(maker.make)) return null;
  const dv = new DataView(b.buffer), delta = newOff - maker.off, n = dv.getUint16(0, true);
  if(2 + n * 12 > b.length) return null;
  for(let i = 0; i < n; i++){
    const e = 2 + i * 12, size = (TS[dv.getUint16(e + 2, true)] || 0) * dv.getUint32(e + 4, true);
    if(size > 4) dv.setUint32(e + 8, (dv.getUint32(e + 8, true) + delta) >>> 0, true);
  }
  return b;
}

function injectTiff(u8, { exif, xmp, iim, maker }){
  if(!exif && !xmp && !iim) return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const ifd = dv.getUint32(4, true), n = dv.getUint16(ifd, true);
  const old = [];
  for(let i = 0; i < n; i++){
    const e = ifd + 2 + i * 12;
    old.push({ tag: dv.getUint16(e, true), raw: u8.subarray(e, e + 12) });
  }
  const have = new Set(old.map(o => o.tag));
  const parsed = exif ? parseTiff(exif.buffer.slice(exif.byteOffset, exif.byteOffset + exif.length), 0) : null;
  const add0 = [], addEx = parsed ? parsed.exif.filter(e => e.tag !== 0x927C) : [], addGps = parsed ? parsed.gps : [];
  if(parsed) for(const e of parsed.ifd0) if(IFD0_ADD.has(e.tag) && !have.has(e.tag)) add0.push(e);
  if(xmp && !have.has(700)){ const b = enc(xmp); add0.push({ tag: 700, type: 1, count: b.length, bytes: b }); }
  if(iim && !have.has(33723)){ add0.push({ tag: 33723, type: 7, count: iim.length, bytes: iim }); }
  if(!add0.length && !addEx.length && !addGps.length) return null;

  const chunks = [u8], pos = { v: u8.length };
  const push = b => { const at = pos.v; chunks.push(b); pos.v += b.length; return at; };
  if(pos.v & 1) push(new Uint8Array(1));
  if(maker && maker.bytes && maker.bytes.length){
    const at = pos.v, moved = relocateMaker(maker, at);
    if(moved){ push(moved); if(pos.v & 1) push(new Uint8Array(1)); addEx.push({ tag: 0x927C, type: 7, count: moved.length, bytes: moved, ext: at }); }
  }
  // un IFD con sus valores largos detrás; devuelve su posición
  const writeIfd = entries => {
    const list = entries.slice().sort((a, b) => a.tag - b.tag), start = pos.v + (pos.v & 1);
    if(pos.v & 1) push(new Uint8Array(1));
    const head = new Uint8Array(2 + list.length * 12 + 4), hv = new DataView(head.buffer);
    hv.setUint16(0, list.length, true);
    let dp = start + head.length;
    const tail = [];
    list.forEach((e, i) => {
      const p = 2 + i * 12;
      if(e.raw){ head.set(e.raw, p); return; }
      hv.setUint16(p, e.tag, true); hv.setUint16(p + 2, e.type, true); hv.setUint32(p + 4, e.count, true);
      if(e.ext != null) hv.setUint32(p + 8, e.ext, true);          // datos ya escritos en otro sitio
      else if(e.bytes.length <= 4) head.set(e.bytes, p + 8);
      else { hv.setUint32(p + 8, dp, true); tail.push(e.bytes); dp += e.bytes.length; if(e.bytes.length & 1){ tail.push(new Uint8Array(1)); dp++; } }
    });
    push(head); for(const t of tail) push(t);
    return start;
  };
  const long = (tag, v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return { tag, type: 4, count: 1, bytes: b }; };
  if(addEx.length) add0.push(long(0x8769, writeIfd(addEx)));
  if(addGps.length) add0.push(long(0x8825, writeIfd(addGps)));
  const newIfd = writeIfd([...old, ...add0]);
  const head = new Uint8Array(u8.subarray(0, 8)); new DataView(head.buffer).setUint32(4, newIfd, true);
  chunks[0] = head.length === 8 ? concat([head, u8.subarray(8)]) : u8;
  return new Blob(chunks, { type: "image/tiff" });
}
