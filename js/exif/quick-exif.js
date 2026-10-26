/* ═══════════════════════════════════════════════════════════════
   HDR · EXPOSICIÓN DESDE EXIF
   Lee de un JPEG o TIFF sólo lo necesario para ordenar un horquillado:
   tiempo de exposición, diafragma, ISO y compensación. Si falta (HEIC,
   fotos pasadas por WhatsApp…), el motor estima la exposición a
   partir de los píxeles (ver `estimateEvs` en engine.js).
   ═══════════════════════════════════════════════════════════════ */

export async function readExposure(file){
  try{
    // Primero la cabecera (lo normal en un JPEG); si no está ahí —HEIC,
    // PNG, WebP o un JPEG con el EXIF al final—, el archivo entero.
    const head = await file.slice(0, 262144).arrayBuffer();
    const r = parseAt(head, findTiff(head));
    if(r || file.size <= 262144) return r;
    const all = await file.slice(0, Math.min(file.size, 64 << 20)).arrayBuffer();
    return parseAt(all, findTiff(all));
  }catch{ return null; }
}

const isTiff = (u, i) => i >= 0 && i + 8 <= u.length &&
  ((u[i] === 0x49 && u[i + 1] === 0x49 && u[i + 2] === 0x2a && u[i + 3] === 0) ||
   (u[i] === 0x4d && u[i + 1] === 0x4d && u[i + 2] === 0 && u[i + 3] === 0x2a));
const tag4 = (u, i, t) => u[i] === t.charCodeAt(0) && u[i + 1] === t.charCodeAt(1) && u[i + 2] === t.charCodeAt(2) && u[i + 3] === t.charCodeAt(3);

/* Posición de la cabecera TIFF del EXIF, o -1. JPEG: segmento APP1.
   TIFF/DNG: al principio. Resto (HEIC, PNG eXIf, WebP EXIF…): se
   busca la cabecera TIFF justo detrás de «Exif\0\0» o de la etiqueta
   del bloque. */
export function findTiff(buf){
  const u = new Uint8Array(buf), dv = new DataView(buf);
  if(u.length < 8) return -1;
  if(dv.getUint16(0) === 0xffd8){
    let p = 2;
    while(p + 4 < u.length){
      if(u[p] !== 0xff) break;
      const marker = u[p + 1], len = dv.getUint16(p + 2);
      if(marker === 0xe1 && p + 10 < u.length && dv.getUint32(p + 4) === 0x45786966) return p + 10;
      if(marker === 0xda) break;
      p += 2 + len;
    }
  }
  if(isTiff(u, 0)) return 0;
  for(let i = 8; i < u.length - 8; i++){
    if(u[i] !== 0x49 && u[i] !== 0x4d) continue;
    if(!isTiff(u, i)) continue;
    if(tag4(u, i - 6, "Exif") && u[i - 2] === 0 && u[i - 1] === 0) return i;
    if(tag4(u, i - 4, "eXIf")) return i;            // PNG: tipo del bloque y luego los datos
    if(tag4(u, i - 8, "EXIF")) return i;            // WebP: etiqueta, tamaño y datos
  }
  return -1;
}

function parseAt(buf, tiff){
  if(tiff < 0) return null;
  const dv = new DataView(buf);
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
      const rat = () => { const o = u32(val); if(tiff + o + 8 > dv.byteLength) return NaN; return type === 10 ? s32(o) / (s32(o + 4) || 1) : u32(o) / (u32(o + 4) || 1); };
      if(tag === 0x829a) out.exposureTime = rat();
      else if(tag === 0x829d) out.fNumber = rat();
      else if(tag === 0x8827) out.iso = type === 3 ? u16(val) : u32(val);
      else if(tag === 0x9204) out.bias = rat();
      else if(tag === 0x8769 && !isExif) read(u32(val), true);
    }
  };
  read(u32(4), false);
  return Object.keys(out).length ? out : null;
}

/** «1/250 s · f/8 · ISO 100» */
export function exposureText(e){
  if(!e) return "";
  const t = e.exposureTime > 0 ? (e.exposureTime >= 1 ? `${+e.exposureTime.toFixed(1)} s` : `1/${Math.round(1 / e.exposureTime)} s`) : "";
  return [t, e.fNumber ? `f/${+e.fNumber.toFixed(1)}` : "", e.iso ? `ISO ${e.iso}` : ""].filter(Boolean).join(" · ");
}
