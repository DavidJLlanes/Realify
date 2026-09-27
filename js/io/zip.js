/* Escritor ZIP propio, sin librerías. Guarda sin comprimir: un JPEG
   ya está comprimido y pasarlo por deflate no gana nada. */

const CRC_TABLE = (()=>{
  const t = new Uint32Array(256);
  for(let i=0;i<256;i++){
    let c = i;
    for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
    t[i] = c>>>0;
  }
  return t;
})();

export function crc32(u8){
  let c = 0xFFFFFFFF;
  for(let i=0;i<u8.length;i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c>>>8);
  return (c ^ 0xFFFFFFFF)>>>0;
}

/* Fecha y hora en el formato de MS-DOS que usa el ZIP: los
   segundos van en pasos de dos, que es toda la resolución que el
   formato tiene desde 1989. */
export function dosStamp(d){
  return {
    time: (d.getHours()<<11) | (d.getMinutes()<<5) | (d.getSeconds()>>1),
    date: ((d.getFullYear()-1980)<<9) | ((d.getMonth()+1)<<5) | d.getDate()
  };
}

export function buildZip(entries){
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;

  for(const e of entries){
    const name = enc.encode(e.name);
    const data = e.data;
    const crc = crc32(data);
    const {time, date} = dosStamp(e.date || new Date());

    const lh = new Uint8Array(30 + name.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0,  0x04034b50, true);   // firma de cabecera local
    lv.setUint16(4,  20, true);           // versión necesaria
    lv.setUint16(6,  0x0800, true);       // nombre en UTF-8
    lv.setUint16(8,  0, true);            // sin comprimir
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lh.set(name, 30);
    chunks.push(lh, data);

    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0,  0x02014b50, true);   // firma de directorio central
    cv.setUint16(4,  20, true);
    cv.setUint16(6,  20, true);
    cv.setUint16(8,  0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);       // dónde empieza su cabecera local
    ch.set(name, 46);
    central.push(ch);

    offset += lh.length + data.length;
  }

  const cdSize = central.reduce((a,c)=>a+c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0,  0x06054b50, true);
  ev.setUint16(8,  entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], {type:"application/zip"});
}

/* El ZIP clásico guarda los desplazamientos en 32 bits, así que por
   encima de 4 GB haría falta ZIP64. Se corta antes, en 1,5 GB, que
   es donde el navegador empieza a sufrir teniéndolo todo en memoria. */

/* El ZIP clásico guarda los desplazamientos en 32 bits. Se corta muy
   antes, donde el navegador empieza a sufrir con todo en memoria. */
export const ZIP_LIMIT = 1536 * 1024 * 1024;
