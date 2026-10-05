/* ═══════════════════════════════════════════════════════════════
   PSD/PSB DE 16 BITS CON CAPAS (v254)
   ag-psd sólo escribe 8 bits. Aquí se aprovecha todo lo que sabe escribir —el árbol de grupos, máscaras, modos de fusión, ajustes, efectos de capa, texto,
   objetos inteligentes y «Fusionar si»— y se REESCRIBE el archivo a 16 bits: se leen los registros de capa que dejó ag-psd (copiando tal cual sus
   datos extra: máscaras, rangos de fusión, nombre y bloques adicionales), se sustituyen sus rectángulos y canales por los de 16 bits propios y
   se mueve todo a un bloque «Lr16» (así guarda las capas Photoshop en un documento de 16 bits). El compuesto final también va en 16 bits.

   `agBytes`: el PSD/PSB de 8 bits que escribió ag-psd, con una imagen mínima en cada capa (1×1) y las capas en el orden de `providers`.
   `providers`: un elemento por registro de capa, EN EL ORDEN DEL ARCHIVO (de abajo arriba; un grupo = divisor, hijos, grupo):
       null (sin píxeles: divisores, grupos, ajustes) o { rect:{top,left,bottom,right}, planes:{ r,g,b,a: Uint16Array de ese rectángulo }|null,
       mask:{ rect, data: Uint16Array }|null }
   `composite`: { data: Uint16Array (RGB o RGBA entrelazado), channels, w, h }
   ═══════════════════════════════════════════════════════════════ */

const u16 = (v, i) => (v[i] << 8) | v[i + 1];
const be32 = (dv, o) => dv.getUint32(o);
const align = (n, a) => (n + a - 1) & ~(a - 1);

function concat(parts){
  let n = 0; for(const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for(const p of parts){ out.set(p, o); o += p.length; }
  return out;
}
const w16 = v => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v); return b; };
const w32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0); return b; };
const w64 = v => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v)); return b; };
const i16 = v => { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v); return b; };
const i32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v); return b; };

/** Una capa de 16 bits en bytes de canal: [raw u16 compresión 0][muestras big endian]. */
function channelBytes(samples){
  const out = new Uint8Array(2 + samples.length * 2), dv = new DataView(out.buffer);
  for(let i = 0; i < samples.length; i++) dv.setUint16(2 + i * 2, samples[i]);
  return out;
}

export function rebuildPsd16(agBytes, providers, { width, height, psb = false, composite }){
  const u = agBytes, dv = new DataView(u.buffer, u.byteOffset, u.byteLength), L = psb ? 8 : 4;
  // ── cabecera, datos del modo de color y recursos de imagen: tal cual ──
  const cmLen = be32(dv, 26), irStart = 30 + cmLen, irLen = be32(dv, irStart), lmStart = irStart + 4 + irLen;
  const head = u.slice(0, lmStart);
  const hv = new DataView(head.buffer);
  hv.setUint16(22, 16);                                         // profundidad
  hv.setUint16(12, composite.channels);
  // ── capas y máscaras: recorrer lo que escribió ag-psd ──
  const big = o => psb ? Number(dv.getBigUint64(o)) : be32(dv, o);
  const lmLen = big(lmStart), lmBody = lmStart + L, lmEnd = lmBody + lmLen;
  const liLen = big(lmBody);
  let p = lmBody + L, count = dv.getInt16(p); p += 2;
  const n = Math.abs(count), recs = [];
  for(let i = 0; i < n; i++){
    const r = { };
    r.nch = u16(u, p + 16);
    let q = p + 18;
    r.chan = [];
    for(let c = 0; c < r.nch; c++){ r.chan.push({ id: dv.getInt16(q), len: psb ? Number(dv.getBigUint64(q + 2)) : be32(dv, q + 2) }); q += 2 + L; }
    r.tail = u.subarray(q, q + 12);                                // firma, modo, opacidad, recorte, indicadores, relleno
    const extraLen = be32(dv, q + 12);
    r.extra = u.slice(q + 16, q + 16 + extraLen);
    p = q + 16 + extraLen;
    recs.push(r);
  }
  if(recs.length !== providers.length) throw new Error(`PSD de 16 bits: ${recs.length} registros de capa y ${providers.length} orígenes de píxeles`);
  // lo que sigue al bloque de capas (máscara global y bloques adicionales: enlaces de objetos inteligentes, patrones…) se conserva
  let after = lmBody + L + liLen;
  const globalAndTagged = u.slice(after, lmEnd);

  // ── registros y datos de canal nuevos ──
  const recBytes = [], dataBytes = [];
  recs.forEach((r, i) => {
    const pv = providers[i], rect = pv && pv.planes ? pv.rect : { top: 0, left: 0, bottom: 0, right: 0 };
    const chans = [], datas = [];
    const has = !!(pv && pv.planes);
    const w = rect.right - rect.left, h = rect.bottom - rect.top;
    for(const [id, key] of [[-1, "a"], [0, "r"], [1, "g"], [2, "b"]]){
      const d = has ? channelBytes(pv.planes[key]) : new Uint8Array(2);
      chans.push([id, d.length]); datas.push(d);
    }
    const extra = r.extra.slice();
    const hasMaskChan = r.chan.some(c => c.id === -2 || c.id === -3);
    if(hasMaskChan){
      const mk = pv && pv.mask;
      const d = mk ? channelBytes(mk.data) : new Uint8Array(2);
      chans.push([-2, d.length]); datas.push(d);
      // el rectángulo de la máscara que se escribió con la imagen mínima: se pone el real (los 16 primeros bytes de la zona de máscara)
      const mlen = new DataView(extra.buffer).getUint32(0);
      if(mk && mlen >= 20){ const ev = new DataView(extra.buffer); ev.setInt32(4, mk.rect.top); ev.setInt32(8, mk.rect.left); ev.setInt32(12, mk.rect.bottom); ev.setInt32(16, mk.rect.right); }
    }
    recBytes.push(concat([i32(rect.top), i32(rect.left), i32(rect.bottom), i32(rect.right), w16(chans.length),
      ...chans.map(([id, len]) => concat([i16(id), psb ? w64(len) : w32(len)])), r.tail, w32(extra.length), extra]));
    dataBytes.push(...datas);
  });
  const layerInfo = concat([i16(count < 0 ? -n : n), ...recBytes, ...dataBytes]);
  const block = concat([layerInfo, new Uint8Array(align(layerInfo.length, 4) - layerInfo.length)]);
  const lr16 = concat([new TextEncoder().encode(psb ? "8B64" : "8BIM"), new TextEncoder().encode("Lr16"), psb ? w64(block.length) : w32(block.length), block]);
  const lmNew = concat([psb ? w64(0) : w32(0), globalAndTagged, lr16]);        // capas «clásicas»: vacío; las de 16 bits van en Lr16
  const lmWithLen = concat([psb ? w64(lmNew.length) : w32(lmNew.length), lmNew]);

  // ── compuesto: 16 bits sin comprimir, plano a plano ──
  const { data, channels, w, h } = composite, plane = w * h;
  const img = new Uint8Array(2 + plane * channels * 2), iv = new DataView(img.buffer);
  iv.setUint16(0, 0);
  let o = 2;
  for(let c = 0; c < channels; c++) for(let k = 0, idx = c; k < plane; k++, idx += channels, o += 2) iv.setUint16(o, data[idx]);
  return concat([head, lmWithLen, img]);
}

/** Inserta un recurso de imagen (id) en un PSD/PSB ya escrito. */
export function addImageResource(u8, id, bytes){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const cmdLen = dv.getUint32(26), irStart = 30 + cmdLen, irLen = dv.getUint32(irStart);
  const data = bytes.length & 1 ? Uint8Array.from([...bytes, 0]) : bytes;
  const res = new Uint8Array(12 + data.length), rv = new DataView(res.buffer);
  res.set([0x38, 0x42, 0x49, 0x4D], 0); rv.setUint16(4, id); rv.setUint32(8, bytes.length); res.set(data, 12);
  const out = new Uint8Array(u8.length + res.length);
  out.set(u8.subarray(0, irStart + 4 + irLen), 0);
  out.set(res, irStart + 4 + irLen);
  out.set(u8.subarray(irStart + 4 + irLen), irStart + 4 + irLen + res.length);
  new DataView(out.buffer).setUint32(irStart, irLen + res.length);
  return out;
}
