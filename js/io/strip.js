/* Limpieza de metadatos sin recomprimir: se recorren los segmentos
   del archivo y se descartan los que llevan metadatos, dejando
   intactos los datos de imagen. Reexportar por el lienzo también los
   quita, pero vuelve a codificar y eso degrada. */

export function stripJPEG(u8, keepICC){
  if(u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
  const parts = [u8.subarray(0,2)];
  const kinds = new Set();
  let removed = 0, i = 2;

  while(i < u8.length - 1){
    if(u8[i] !== 0xFF) break;
    let j = i;
    while(u8[j+1] === 0xFF) j++;            // relleno entre marcadores
    const marker = u8[j+1];

    // Marcadores sin carga útil
    if(marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)){
      parts.push(u8.subarray(j, j+2)); i = j+2; continue;
    }
    // A partir del inicio de barrido va el dato comprimido: se copia tal cual
    if(marker === 0xDA){ parts.push(u8.subarray(j)); i = u8.length; break; }

    const len = (u8[j+2] << 8) | u8[j+3];
    if(len < 2) break;
    const seg = u8.subarray(j, j + 2 + len);

    let drop = false, name = null;
    if(marker >= 0xE0 && marker <= 0xEF){
      let tag = "";
      for(let k = j+4; k < Math.min(j+4+8, u8.length) && u8[k]; k++){
        tag += String.fromCharCode(u8[k]);
      }
      const isAdobe = (marker === 0xEE && tag.startsWith("Adobe"));
      const isICC   = (marker === 0xE2 && tag.startsWith("ICC"));
      if(isAdobe || (isICC && keepICC)){
        drop = false;
      } else {
        drop = true;
        name = "APP" + (marker - 0xE0) + (tag ? " " + tag.replace(/[^\x20-\x7E]/g,"") : "");
      }
    } else if(marker === 0xFE){
      drop = true; name = "Comentario";
    }

    if(drop){ removed += seg.length; kinds.add(name); }
    else parts.push(seg);
    i = j + 2 + len;
  }
  return {parts, removed, kinds:[...kinds]};
}

export function stripPNG(u8, keepICC){
  const sig = [137,80,78,71,13,10,26,10];
  for(let i = 0; i < 8; i++) if(u8[i] !== sig[i]) return null;

  const KEEP = new Set(["IHDR","PLTE","IDAT","IEND","tRNS","gAMA","cHRM",
                        "sRGB","sBIT","bKGD","pHYs","acTL","fcTL","fdAT",
                        "hIST","sPLT"]);
  if(keepICC) KEEP.add("iCCP");

  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const parts = [u8.subarray(0,8)];
  const kinds = new Set();
  let removed = 0, i = 8;

  while(i + 8 <= u8.length){
    const len = dv.getUint32(i);
    const type = String.fromCharCode(u8[i+4],u8[i+5],u8[i+6],u8[i+7]);
    const total = 12 + len;
    if(i + total > u8.length) break;
    if(KEEP.has(type)){
      parts.push(u8.subarray(i, i + total));
    } else {
      removed += total; kinds.add(type);
    }
    i += total;
    if(type === "IEND") break;
  }
  return {parts, removed, kinds:[...kinds]};
}

