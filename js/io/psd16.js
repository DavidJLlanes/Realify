/* ═══════════════════════════════════════════════════════════════
   PSD / PSB DE 16 BITS POR CANAL (compuesto, sin capas)
   ag-psd sólo escribe 8 bits. Para no tirar la precisión de la exportación en coma flotante
   (core/precision-stack.js) este escritor deja el resultado final tal cual: un documento de Photoshop RGB de
   16 bits con una sola imagen (Photoshop lo abre como «Fondo»), sin compresión, perfil ICC incrustado (sRGB o
   Display P3) y 72 ppp. Con alfa, el canal va como canal extra «Alpha 1».
   `img`: { data: Uint16Array (RGB o RGBA entrelazado), channels: 3|4, w, h, space } — como png16 / tiff16.
   `psb`: formato grande (versión 2, hasta 300 000 px por lado) en vez de PSD (30 000 px).
   ═══════════════════════════════════════════════════════════════ */

import { profileFor } from "../core/icc.js";

export function psd16(img, { psb = false } = {}){
  const { data, channels: ch, w, h } = img;
  if(ch !== 3 && ch !== 4) throw new Error("PSD de 16 bits: se esperan 3 o 4 canales");
  const max = psb ? 300000 : 30000;
  if(w > max || h > max) throw new Error(`${psb ? "PSB" : "PSD"} admite como máximo ${max.toLocaleString("es")} píxeles por lado${psb ? "" : ": usa PSB"}`);
  const icc = profileFor(img.space === "display-p3" ? "display-p3" : "srgb");
  const res = [];
  const resource = (id, bytes) => { const pad = bytes.length & 1; const r = new Uint8Array(12 + bytes.length + pad), v = new DataView(r.buffer);
    r.set([0x38, 0x42, 0x49, 0x4D], 0); v.setUint16(4, id); v.setUint32(8, bytes.length); r.set(bytes, 12); res.push(r); };
  const ppi = new Uint8Array(16), pv = new DataView(ppi.buffer);
  pv.setUint32(0, 72 << 16); pv.setUint16(4, 1); pv.setUint16(6, 2); pv.setUint32(8, 72 << 16); pv.setUint16(12, 1); pv.setUint16(14, 2);   // 72 ppp; ancho/alto en cm
  resource(1005, ppi);
  resource(1039, icc);
  const resLen = res.reduce((a, r) => a + r.length, 0);
  const planeBytes = w * h * 2, imgBytes = 2 + planeBytes * ch;
  const lmi = psb ? 8 : 4;                                    // longitud de «layer and mask info»: 0
  const total = 26 + 4 + 4 + resLen + lmi + imgBytes;
  const out = new Uint8Array(total), v = new DataView(out.buffer);
  out.set([0x38, 0x42, 0x50, 0x53], 0);                      // 8BPS
  v.setUint16(4, psb ? 2 : 1); v.setUint16(12, ch); v.setUint32(14, h); v.setUint32(18, w); v.setUint16(22, 16); v.setUint16(24, 3);   // RGB
  let o = 26;
  v.setUint32(o, 0); o += 4;                                   // datos del modo de color
  v.setUint32(o, resLen); o += 4;
  for(const r of res){ out.set(r, o); o += r.length; }
  o += lmi;                                                    // layer and mask info vacío
  v.setUint16(o, 0); o += 2;                                   // sin compresión
  for(let c = 0; c < ch; c++) for(let i = c, n = w * h; n--; i += ch, o += 2) v.setUint16(o, data[i]);
  return new Blob([out], { type: "image/vnd.adobe.photoshop" });
}
