/* ═══════════════════════════════════════════════════════════════
   EXIF DE CÁMARA Y OBJETIVO (fase 9 de PENDIENTE.md)
   Lee de un JPEG, TIFF/DNG, HEIC, PNG o WebP lo que hace falta para
   elegir el perfil de lente: marca y modelo de la cámara, modelo del
   objetivo, distancia focal (y su equivalente en 35 mm), diafragma y
   distancia de enfoque. Sin DOM salvo `File`.
   ═══════════════════════════════════════════════════════════════ */

import { findTiff } from "../../hdr/exif.js";

export async function readLensExif(file){
  try{
    const head = await file.slice(0, 262144).arrayBuffer();
    const r = parse(head, findTiff(head));
    if(r || file.size <= 262144) return r;
    const all = await file.slice(0, Math.min(file.size, 64 << 20)).arrayBuffer();
    return parse(all, findTiff(all));
  }catch{ return null; }
}

function parse(buf, tiff){
  if(tiff < 0) return null;
  const dv = new DataView(buf), le = dv.getUint16(tiff) === 0x4949;
  const u16 = o => dv.getUint16(tiff + o, le), u32 = o => dv.getUint32(tiff + o, le);
  const out = {};
  const ascii = (e, count) => {
    const off = count <= 4 ? e + 8 : u32(e + 8); let s = "";
    for(let i = tiff + off, end = Math.min(dv.byteLength, tiff + off + count); i < end && dv.getUint8(i); i++) s += String.fromCharCode(dv.getUint8(i));
    return s.trim();
  };
  const rat = (e, k = 0) => { const o = u32(e + 8) + 8 * k; if(tiff + o + 8 > dv.byteLength) return NaN; const d = u32(o + 4); return d ? u32(o) / d : NaN; };
  const read = (off, isExif) => {
    if(tiff + off + 2 > dv.byteLength) return;
    const n = u16(off);
    for(let i = 0; i < n; i++){
      const e = off + 2 + i * 12;
      if(tiff + e + 12 > dv.byteLength) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      if(type === 2){
        if(tag === 0x010f) out.make = ascii(e, count);
        else if(tag === 0x0110) out.model = ascii(e, count);
        else if(tag === 0xa433) out.lensMake = ascii(e, count);
        else if(tag === 0xa434) out.lens = ascii(e, count);
      } else if(tag === 0x920a) out.focal = rat(e);
      else if(tag === 0xa405) out.focal35 = type === 3 ? dv.getUint16(tiff + e + 8, le) : u32(e + 8);
      else if(tag === 0x829d) out.fNumber = rat(e);
      else if(tag === 0x9206) out.distance = rat(e);
      else if(tag === 0xa432 && count === 4) out.lensInfo = [0, 1, 2, 3].map(k => rat(e, k));
      else if(tag === 0x8769 && !isExif) read(u32(e + 8), true);
    }
  };
  read(u32(4), false);
  return Object.keys(out).length ? out : null;
}
