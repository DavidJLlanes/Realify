/* ═══════════════════════════════════════════════════════════════
   PERFIL ICC EN LOS ARCHIVOS EXPORTADOS (fase 2 de PENDIENTE.md)
   Un documento en Display P3 guarda números P3: si el archivo no lleva
   su perfil, cualquier visor los toma por sRGB y los colores salen
   cambiados. Chromium ya incrusta el perfil al codificar desde un
   lienzo P3 (JPEG y PNG), pero no todos los navegadores lo garantizan:
   aquí se comprueba y, si falta, se inserta el perfil de core/icc.js.
   ═══════════════════════════════════════════════════════════════ */

import { profileFor } from "../core/icc.js";
import { crc32 } from "./zip.js";

async function deflate(u8){
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
}

/** Fragmento PNG iCCP con el perfil de `space` (comprimido) */
export async function pngIccpChunk(space){
  const name = new TextEncoder().encode(space === "display-p3" ? "Display P3" : "sRGB");
  const z = await deflate(profileFor(space));
  const payload = new Uint8Array(name.length + 2 + z.length);
  payload.set(name); payload[name.length] = 0; payload[name.length + 1] = 0; payload.set(z, name.length + 2);
  const out = new Uint8Array(12 + payload.length), v = new DataView(out.buffer);
  v.setUint32(0, payload.length); out.set([0x69, 0x43, 0x43, 0x50], 4); out.set(payload, 8);
  v.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)));
  return out;
}

function pngWithIcc(u8, chunk){
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const parts = [u8.subarray(0, 8)];
  let i = 8, has = false;
  while(i + 8 <= u8.length){
    const n = v.getUint32(i), type = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]), end = i + 12 + n;
    if(type === "iCCP") has = true;
    // sRGB y gAMA/cHRM contradirían al perfil P3: fuera
    if(!(type === "sRGB" || type === "gAMA" || type === "cHRM")) parts.push(u8.subarray(i, end));
    if(type === "IHDR") parts.push(chunk);
    i = end;
  }
  return has ? null : parts;
}

function jpegHasIcc(u8){
  let i = 2;
  while(i + 4 < u8.length && u8[i] === 0xFF){
    const m = u8[i + 1], len = (u8[i + 2] << 8) | u8[i + 3];
    if(m === 0xDA) break;
    if(m === 0xE2 && String.fromCharCode(...u8.subarray(i + 4, i + 15)) === "ICC_PROFILE") return true;
    i += 2 + len;
  }
  return false;
}
function jpegWithIcc(u8, profile){
  const seg = new Uint8Array(4 + 14 + profile.length);
  seg[0] = 0xFF; seg[1] = 0xE2;
  const len = 2 + 14 + profile.length; seg[2] = len >> 8; seg[3] = len & 255;
  seg.set(new TextEncoder().encode("ICC_PROFILE"), 4); seg[15] = 0; seg[16] = 1; seg[17] = 1;
  seg.set(profile, 18);
  // Tras SOI y, si lo hay, el APP0 (JFIF)
  let at = 2;
  if(u8[2] === 0xFF && u8[3] === 0xE0) at = 4 + ((u8[4] << 8) | u8[5]);
  return [u8.subarray(0, at), seg, u8.subarray(at)];
}

/** Devuelve `blob` con el perfil de `space` incrustado (si no lo tenía). */
export async function ensureIcc(blob, space){
  if(!blob || space !== "display-p3") return blob;
  const u8 = new Uint8Array(await blob.arrayBuffer());
  if(blob.type === "image/png"){
    const parts = pngWithIcc(u8, await pngIccpChunk(space));
    return parts ? new Blob(parts, { type: "image/png" }) : blob;
  }
  if(blob.type === "image/jpeg"){
    if(jpegHasIcc(u8)) return blob;
    return new Blob(jpegWithIcc(u8, profileFor(space)), { type: "image/jpeg" });
  }
  return blob;
}
