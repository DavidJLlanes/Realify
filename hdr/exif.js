/* ═══════════════════════════════════════════════════════════════
   HDR · EXPOSICIÓN DESDE EXIF
   Lee de un JPEG o TIFF sólo lo necesario para ordenar un horquillado:
   tiempo de exposición, diafragma, ISO y compensación. Si falta (HEIC,
   PNG, fotos pasadas por WhatsApp…), el motor estima la exposición a
   partir de los píxeles (ver `estimateEvs` en engine.js).
   ═══════════════════════════════════════════════════════════════ */

export async function readExposure(file){
  try{
    const dv = new DataView(await file.slice(0, 262144).arrayBuffer());
    let tiff = -1;
    if(dv.getUint16(0) === 0xffd8){
      let p = 2;
      while(p + 4 < dv.byteLength){
        if(dv.getUint8(p) !== 0xff) break;
        const marker = dv.getUint8(p + 1), len = dv.getUint16(p + 2);
        if(marker === 0xe1 && p + 10 < dv.byteLength && dv.getUint32(p + 4) === 0x45786966){ tiff = p + 10; break; }
        p += 2 + len;
      }
    } else if(dv.getUint16(0) === 0x4949 || dv.getUint16(0) === 0x4d4d) tiff = 0;
    if(tiff < 0) return null;
    const le = dv.getUint16(tiff) === 0x4949;
    const u16 = o => dv.getUint16(tiff + o, le), u32 = o => dv.getUint32(tiff + o, le), s32 = o => dv.getInt32(tiff + o, le);
    const out = {};
    const read = (off, isExif) => {
      if(tiff + off + 2 > dv.byteLength) return;
      const n = u16(off);
      for(let i = 0; i < n; i++){
        const e = off + 2 + i * 12;
        if(tiff + e + 12 > dv.byteLength) break;
        const tag = u16(e), type = u16(e + 2), val = e + 8;
        const rat = () => { const o = u32(val); return type === 10 ? s32(o) / (s32(o + 4) || 1) : u32(o) / (u32(o + 4) || 1); };
        if(tag === 0x829a) out.exposureTime = rat();
        else if(tag === 0x829d) out.fNumber = rat();
        else if(tag === 0x8827) out.iso = type === 3 ? u16(val) : u32(val);
        else if(tag === 0x9204) out.bias = rat();
        else if(tag === 0x8769 && !isExif) read(u32(val), true);
      }
    };
    read(u32(4), false);
    return Object.keys(out).length ? out : null;
  }catch{ return null; }
}

/** «1/250 s · f/8 · ISO 100» */
export function exposureText(e){
  if(!e) return "";
  const t = e.exposureTime > 0 ? (e.exposureTime >= 1 ? `${+e.exposureTime.toFixed(1)} s` : `1/${Math.round(1 / e.exposureTime)} s`) : "";
  return [t, e.fNumber ? `f/${+e.fNumber.toFixed(1)}` : "", e.iso ? `ISO ${e.iso}` : ""].filter(Boolean).join(" · ");
}
