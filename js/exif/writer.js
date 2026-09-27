/* ══════════════════════════════════════════════════════════════
   ESCRITOR TIFF / EXIF
   Sin librerías: todo el proceso sigue ocurriendo en el equipo.
   ══════════════════════════════════════════════════════════════ */

import { BODIES, LENSES, BODY_BY_ID, LENS_BY_ID, cropOf,
         maxAperture, shSec } from "./db.js";

/* ── escritor TIFF/Exif ──────────────────────────────────────── */
/* Las etiquetas ASCII de EXIF (tipo 2) se leen como texto de 8 bits,
   no como UTF-8. Escribir «©» en UTF-8 son dos bytes y un lector
   normal muestra «Â©»; en latin1 es un solo byte 0xA9 y sale bien.
   Latin1 cubre además todas las vocales acentuadas, la ñ y los signos
   de apertura, que es justo lo que hace falta en español. Lo que no
   quepa se translitera quitando el diacrítico, y si tampoco, va '?'.
   Los caracteres de control pasan a espacio: un salto de línea dentro
   de un campo EXIF rompe la presentación en muchos lectores. */
export function toLatin1(s){
  const bytes = [];
  for(const ch of String(s).normalize("NFC")){
    const c = ch.codePointAt(0);
    if(c < 0x20){ bytes.push(0x20); continue; }
    if(c <= 0xFF){ bytes.push(c); continue; }
    let done = false;
    for(const p of ch.normalize("NFD")){
      const pc = p.codePointAt(0);
      if(pc >= 0x20 && pc <= 0xFF){ bytes.push(pc); done = true; break; }
    }
    if(!done) bytes.push(0x3F);
  }
  bytes.push(0);
  return new Uint8Array(bytes);
}

export function eAscii(tag, s){ const b = toLatin1(s); return {tag,type:2,count:b.length,bytes:b}; }
export function eShort(tag, ...v){
  const b = new Uint8Array(v.length*2), dv = new DataView(b.buffer);
  v.forEach((x,i)=>dv.setUint16(i*2, x, true));
  return {tag,type:3,count:v.length,bytes:b};
}
export function eLong(tag, ...v){
  const b = new Uint8Array(v.length*4), dv = new DataView(b.buffer);
  v.forEach((x,i)=>dv.setUint32(i*4, x>>>0, true));
  return {tag,type:4,count:v.length,bytes:b};
}
export function eRat(tag, pairs){
  const b = new Uint8Array(pairs.length*8), dv = new DataView(b.buffer);
  pairs.forEach((p,i)=>{ dv.setUint32(i*8, p[0]>>>0, true); dv.setUint32(i*8+4, p[1]>>>0, true); });
  return {tag,type:5,count:pairs.length,bytes:b};
}
export function eSRat(tag, pairs){
  const b = new Uint8Array(pairs.length*8), dv = new DataView(b.buffer);
  pairs.forEach((p,i)=>{ dv.setInt32(i*8, p[0]|0, true); dv.setInt32(i*8+4, p[1]|0, true); });
  return {tag,type:10,count:pairs.length,bytes:b};
}
export function eUndef(tag, arr){ const b = new Uint8Array(arr); return {tag,type:7,count:b.length,bytes:b}; }
export function eByte(tag, arr){  const b = new Uint8Array(arr); return {tag,type:1,count:b.length,bytes:b}; }

export function ifdBytes(entries){
  let data = 0;
  for(const e of entries) if(e.bytes.length > 4) data += e.bytes.length + (e.bytes.length & 1);
  return 2 + 12*entries.length + 4 + data;
}

/* Las etiquetas van en orden ascendente dentro de cada IFD: lo pide
   la especificación y los validadores estrictos se quejan si no. */
export function writeIFD(u8, dv, start, entries){
  const list = entries.slice().sort((a,b)=>a.tag-b.tag);
  dv.setUint16(start, list.length, true);
  let p = start + 2;
  let dp = start + 2 + 12*list.length + 4;
  for(const e of list){
    dv.setUint16(p, e.tag, true);
    dv.setUint16(p+2, e.type, true);
    dv.setUint32(p+4, e.count, true);
    if(e.bytes.length <= 4){
      u8.set(e.bytes, p+8);
    } else {
      dv.setUint32(p+8, dp, true);
      u8.set(e.bytes, dp);
      dp += e.bytes.length + (e.bytes.length & 1);
    }
    p += 12;
  }
  dv.setUint32(p, 0, true);
}

export function buildTIFF(ifd0, exifIfd, gpsIfd){
  const hasGps = gpsIfd && gpsIfd.length;
  const pExif = eLong(0x8769, 0);
  const pGps  = eLong(0x8825, 0);
  const i0 = ifd0.concat([pExif], hasGps ? [pGps] : []);

  const s0 = 8;
  const sE = s0 + ifdBytes(i0);
  const sG = sE + ifdBytes(exifIfd);
  const total = sG + (hasGps ? ifdBytes(gpsIfd) : 0);

  new DataView(pExif.bytes.buffer).setUint32(0, sE, true);
  if(hasGps) new DataView(pGps.bytes.buffer).setUint32(0, sG, true);

  const buf = new ArrayBuffer(total);
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  u8[0] = 0x49; u8[1] = 0x49;              // "II": Canon escribe little endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, 8, true);
  writeIFD(u8, dv, s0, i0);
  writeIFD(u8, dv, sE, exifIfd);
  if(hasGps) writeIFD(u8, dv, sG, gpsIfd);
  return u8;
}

export const apex32 = x => [Math.round(x*32), 32];
/* Segundos con denominador 100: unos 30 cm de resolución, que es el
   orden de lo que escribe una cámara. Con /10000 estaríamos
   declarando precisión milimétrica, que ningún GPS tiene y que por
   sí sola canta. */
export function dmsRat(v){
  v = Math.abs(v);
  const d = Math.floor(v);
  const mf = (v - d)*60;
  const m = Math.floor(mf);
  return [[d,1],[m,1],[Math.round((mf-m)*60*100),100]];
}
export function exifDate(d){
  // Una fecha inválida escribiría "NaN:NaN:NaN" en el archivo, que es
  // peor que no escribir nada: se cae al momento actual.
  if(!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
  const p = n=>String(n).padStart(2,"0");
  return d.getFullYear()+":"+p(d.getMonth()+1)+":"+p(d.getDate())+" "+
         p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds());
}

/* Construye el bloque TIFF completo a partir de unos valores ya
   sorteados o introducidos a mano. w/h son los del archivo que se
   está exportando, no los del sensor: una cámara que guarda un JPEG
   reducido escribe la resolución real del archivo. */
export function buildExifBlock(v, w, h){
  const body = BODY_BY_ID[v.bodyId] || BODIES[0];
  const lens = LENS_BY_ID[v.lensId] || LENSES[0];
  const crop = cropOf(body);
  const t = shSec(v.shutter);
  const wide = maxAperture(lens, v.focal);

  const ifd0 = [
    eAscii(0x010F, "Canon"),
    eAscii(0x0110, body.model),
    eShort(0x0112, 1),
    eRat  (0x011A, [[72,1]]),
    eRat  (0x011B, [[72,1]]),
    eShort(0x0128, 2),
    eAscii(0x0132, exifDate(v.date))
  ];
  if(v.software) ifd0.push(eAscii(0x0131, v.software));
  if(v.artist)   ifd0.push(eAscii(0x013B, v.artist));
  if(v.copyright)ifd0.push(eAscii(0x8298, v.copyright));

  // Resolución del plano focal a partir del tamaño real del archivo.
  const fpx = [Math.round(w*1000), Math.round(body.sw/25.4*1000)];
  const fpy = [Math.round(h*1000), Math.round(body.sh/25.4*1000)];

  const exif = [
    eRat  (0x829A, [[v.shutter[0], v.shutter[1]]]),
    eRat  (0x829D, [[Math.round(v.aperture*10), 10]]),
    eShort(0x8822, v.program),
    eShort(0x8827, Math.min(65535, v.iso)),
    eShort(0x8830, 2),                       // SensitivityType: ISO speed
    eLong (0x8832, v.iso),                   // RecommendedExposureIndex
    eUndef(0x9000, [0x30,0x32,0x33,0x31]),   // ExifVersion 2.31
    eAscii(0x9003, exifDate(v.date)),
    eAscii(0x9004, exifDate(v.date)),
    eUndef(0x9101, [1,2,3,0]),
    eSRat (0x9201, [apex32(-Math.log2(t))]),
    eRat  (0x9202, [apex32(2*Math.log2(v.aperture))]),
    eSRat (0x9204, [[v.bias, 3]]),
    eRat  (0x9205, [apex32(2*Math.log2(wide))]),
    eShort(0x9207, v.meter),
    eShort(0x9209, v.flash),
    eRat  (0x920A, [[Math.round(v.focal*10), 10]]),
    eUndef(0xA000, [0x30,0x31,0x30,0x30]),   // FlashpixVersion 1.0
    eShort(0xA001, 1),                       // sRGB
    eLong (0xA002, w),
    eLong (0xA003, h),
    eRat  (0xA20E, [fpx]),
    eRat  (0xA20F, [fpy]),
    eShort(0xA210, 2),
    eShort(0xA401, 0),                       // CustomRendered: normal
    eShort(0xA402, v.program === 1 ? 1 : 0),
    eShort(0xA403, v.wb),
    eShort(0xA405, Math.round(v.focal*crop)),
    eShort(0xA406, v.sceneType),
    eRat  (0xA432, [[lens.fmin,1],[lens.fmax,1],
                    [Math.round(lens.amin*10),10],[Math.round(lens.amax*10),10]]),
    eAscii(0xA433, lens.make),
    eAscii(0xA434, lens.model)
  ];
  if(v.artist) exif.push(eAscii(0xA430, v.artist));
  if(v.serial) exif.push(eAscii(0xA431, v.serial));
  if(v.lensSerial) exif.push(eAscii(0xA435, v.lensSerial));

  let gps = null;
  if(v.gps){
    gps = [
      eByte (0x0000, [2,3,0,0]),
      eAscii(0x0001, v.gps.lat >= 0 ? "N" : "S"),
      eRat  (0x0002, dmsRat(v.gps.lat)),
      eAscii(0x0003, v.gps.lon >= 0 ? "E" : "W"),
      eRat  (0x0004, dmsRat(v.gps.lon)),
      eByte (0x0005, [0]),
      eRat  (0x0006, [[Math.max(0, Math.round((v.gps.alt||0)*100)), 100]])
    ];
  }
  return buildTIFF(ifd0, exif, gps);
}

/* Inserta el APP1 en el JPEG. Canon escribe SOI, APP0 (JFIF) y
   después APP1 (Exif), que es exactamente lo que produce el lienzo
   del navegador más este segmento. Cualquier APP1 Exif previo se
   descarta para no dejar dos. */
export function injectExif(u8, tiff){
  if(u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
  const len = 2 + 6 + tiff.length;
  if(len > 65535) return null;

  const seg = new Uint8Array(2 + len);
  seg[0] = 0xFF; seg[1] = 0xE1;
  seg[2] = (len >>> 8) & 0xFF; seg[3] = len & 0xFF;
  seg.set([0x45,0x78,0x69,0x66,0,0], 4);     // "Exif\0\0"
  seg.set(tiff, 10);

  const head = [u8.subarray(0,2)], tail = [];
  let i = 2, placed = false;

  while(i < u8.length - 1){
    if(u8[i] !== 0xFF) break;
    let j = i;
    while(u8[j+1] === 0xFF) j++;
    const m = u8[j+1];

    if(m === 0x01 || (m >= 0xD0 && m <= 0xD9)){ tail.push(u8.subarray(j, j+2)); i = j+2; continue; }
    if(m === 0xDA){ tail.push(u8.subarray(j)); i = u8.length; break; }

    const sl = (u8[j+2] << 8) | u8[j+3];
    if(sl < 2) break;
    const s = u8.subarray(j, j + 2 + sl);

    if(m === 0xE1 &&
       u8[j+4]===0x45 && u8[j+5]===0x78 && u8[j+6]===0x69 && u8[j+7]===0x66){
      // Exif anterior: fuera
    } else if(m === 0xE0 && !placed){
      head.push(s); head.push(seg); placed = true;
    } else {
      (placed ? tail : head).push(s);
    }
    i = j + 2 + sl;
  }
  if(!placed) head.push(seg);          // sin JFIF: va justo tras SOI
  return new Blob(head.concat(tail), {type:"image/jpeg"});
}

