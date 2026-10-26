/* ═══════════════════════════════════════════════════════════════
   metadata · build exif
   Parte de js/io/meta/metadata.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { toLatin1, buildTIFF } from "../../../exif/writer.js";
import { enc, concat, NS, td } from "./common.js";

/* ── clasificación de etiquetas (lista blanca) ────────────────────── */
const IFD0_CLASS = {
  0x010E: "text", 0x010F: "camera", 0x0110: "camera", 0x0131: "camera", 0x0132: "date", 0x013B: "author", 0x8298: "author",
  0x011A: "camera", 0x011B: "camera", 0x0128: "camera", 0x0213: "camera"
};

const EXIF_CLASS = {
  0x9003: "date", 0x9004: "date", 0x9010: "date", 0x9011: "date", 0x9012: "date", 0x9290: "date", 0x9291: "date", 0x9292: "date",
  0xA430: "author", 0x9286: "text", 0xA431: "ids", 0xA435: "ids", 0xA420: "ids"
};

// Del IFD Exif se descartan siempre: notas del fabricante, interoperabilidad y lo que se vuelve a escribir
const EXIF_DROP = new Set([0x927C, 0xA005, 0x8769, 0x8825, 0xA002, 0xA003, 0x9000, 0xA001]);

const bytesOf = (tag, type, count, bytes) => ({ tag, type, count, bytes });

const longEntry = (tag, v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return bytesOf(tag, 4, 1, b); };

const shortEntry = (tag, v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return bytesOf(tag, 3, 1, b); };

/* Fechas y coordenadas de los campos editados (ver io/meta/metaedit.js) */
const pad2 = n => String(n).padStart(2, "0");

/** «2024-05-03T18:30[:45]» (hora local de un <input datetime-local>) → { y, mo, d, h, mi, s } o null */
export function parseLocalDate(v){
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v || ""));
  return m ? { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0) } : null;
}

const exifDateStr = t => `${t.y}:${pad2(t.mo)}:${pad2(t.d)} ${pad2(t.h)}:${pad2(t.mi)}:${pad2(t.s)}`;

const ratDeg = v => { v = Math.abs(v); const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), sec = Math.round((mf - m) * 60 * 10000); return [[d, 1], [m, 1], [sec, 10000]]; };

const asciiEntry = (tag, text) => { const b = toLatin1(text); return bytesOf(tag, 2, b.length, b); };

const ratEntry = (tag, pairs) => { const b = new Uint8Array(pairs.length * 8), dv = new DataView(b.buffer); pairs.forEach((p, i) => { dv.setUint32(i * 8, p[0] >>> 0, true); dv.setUint32(i * 8 + 4, p[1] >>> 0, true); }); return bytesOf(tag, 5, pairs.length, b); };

const hasGpsOver = o => o && Number.isFinite(o.lat) && Number.isFinite(o.lon);

/** Bloque TIFF/EXIF nuevo con lo que permite `policy` y lo que se haya editado (`over`), o null si no queda nada. `w`×`h`: medidas
    del archivo exportado; `p3`: el documento está en Display P3. `maker`: { off, bytes } la nota del fabricante del original, que se copia
    (sólo si `policy.maker`) en el MISMO desplazamiento donde estaba, porque casi todas llevan dentro desplazamientos absolutos que no se
    pueden mover: los IFD nuevos se escriben detrás. */
export function buildFilteredExif(parsed, policy, { w, h, p3 = false, original = false, over = null, maker = null } = {}){
  const src = parsed || { ifd0: [], exif: [], gps: [] };
  const keep = (cls) => !!policy[cls];
  /* `original`: se limpia el propio archivo original sin recodificarlo (Limpiar metadatos): la orientación y las
     etiquetas de estructura del EXIF siguen siendo ciertas y se conservan; sin ello (exportación), no. */
  let ifd0 = src.ifd0.filter(e => { if(original && e.tag === 0x0112) return true; const c = IFD0_CLASS[e.tag]; return c && keep(c); });
  let exif = src.exif.filter(e => {
    if(original && (e.tag === 0x9000 || e.tag === 0xA001 || e.tag === 0xA002 || e.tag === 0xA003)) return true;
    if(EXIF_DROP.has(e.tag)) return false;
    const c = EXIF_CLASS[e.tag] || "camera";
    return keep(c);
  });
  let gps = policy.gps ? src.gps.slice() : [];
  // campos que la persona ha pedido quitar del original (se vaciaron en «Editar metadatos»): se quitan aunque su casilla esté encendida
  const rm = new Set((over && over.remove) || []);
  if(rm.size){
    const dropI = new Set(), dropE = new Set();
    if(rm.has("description")) dropI.add(0x010E);
    if(rm.has("author")) dropI.add(0x013B);
    if(rm.has("copyright")) dropI.add(0x8298);
    if(rm.has("date")){ dropI.add(0x0132); for(const t of [0x9003, 0x9004, 0x9010, 0x9011, 0x9012, 0x9290, 0x9291, 0x9292]) dropE.add(t); }
    ifd0 = ifd0.filter(e => !dropI.has(e.tag)); exif = exif.filter(e => !dropE.has(e.tag));
    if(rm.has("gps")) gps = [];
  }
  // campos editados: mandan sobre el original aunque la casilla de su clase esté apagada (la persona los ha escrito)
  const setE = (list, e) => { const i = list.findIndex(x => x.tag === e.tag); if(i >= 0) list.splice(i, 1); list.push(e); };
  if(over){
    if(over.description) setE(ifd0, asciiEntry(0x010E, over.description));
    if(over.author) setE(ifd0, asciiEntry(0x013B, over.author));
    if(over.copyright) setE(ifd0, asciiEntry(0x8298, over.copyright));
    const t = parseLocalDate(over.date);
    if(t){ const str = exifDateStr(t); setE(ifd0, asciiEntry(0x0132, str)); setE(exif, asciiEntry(0x9003, str)); setE(exif, asciiEntry(0x9004, str)); }
    if(hasGpsOver(over)){
      gps = [bytesOf(0x0000, 1, 4, new Uint8Array([2, 3, 0, 0])), asciiEntry(0x0001, over.lat >= 0 ? "N" : "S"), ratEntry(0x0002, ratDeg(over.lat)),
             asciiEntry(0x0003, over.lon >= 0 ? "E" : "W"), ratEntry(0x0004, ratDeg(over.lon))];
    }
  }
  if(exif.length && !original){
    exif.push(bytesOf(0x9000, 7, 4, new Uint8Array([0x30, 0x32, 0x33, 0x32])));          // ExifVersion «0232»
    exif.push(shortEntry(0xA001, p3 ? 0xFFFF : 1));                                       // ColorSpace
    if(w && h){ exif.push(longEntry(0xA002, w)); exif.push(longEntry(0xA003, h)); }       // medidas del archivo, no del original
  }
  if(!ifd0.length && !exif.length && !gps.length) return null;
  // nota del fabricante: sólo con la casilla y en el mismo sitio (el JPEG, que sólo admite ≈64 KB de EXIF, usa la versión sin ella si no cabe: ver filterMetadata)
  let extra = null, start = 8;
  if(policy.maker && maker && maker.bytes && maker.bytes.length && maker.off >= 8 && parsed && parsed.le && !original){
    const inline = new Uint8Array(4); new DataView(inline.buffer).setUint32(0, maker.off, true);
    exif.push(bytesOf(0x927C, 7, maker.bytes.length, inline));
    start = (maker.off + maker.bytes.length + 1) & ~1;
    extra = maker;
  }
  return buildTIFF(ifd0, exif, gps, { start, extra });
}

/* ── IPTC (IIM) ───────────────────────────────────────────────────── */
const IPTC_SETS = {
  author: [80, 85, 110, 115, 116],
  text: [5, 25, 40, 105, 120, 122],
  date: [55, 60, 62, 63],
  gps: [26, 90, 92, 95, 100, 101]
};

/* Qué conjuntos IPTC y propiedades XMP corresponden a cada campo que se puede quitar del original */
const IPTC_REMOVE = { title: [5], description: [120], author: [80], copyright: [116], keywords: [25], date: [55, 60, 62, 63], gps: [26, 90, 92, 95, 100, 101] };

const XMP_REMOVE = { title: ["dc:title"], description: ["dc:description"], author: ["dc:creator"], copyright: ["dc:rights"], keywords: ["dc:subject"],
  date: ["xmp:CreateDate", "photoshop:DateCreated"], gps: ["photoshop:City", "photoshop:State", "photoshop:Country", "Iptc4xmpCore:Location", "Iptc4xmpCore:CountryCode", "exif:GPSLatitude", "exif:GPSLongitude"] };

/* Conjuntos IPTC que salen de los campos editados (ver io/meta/metaedit.js) */
const iptcOver = (over, utf8) => {
  const out = [], put = (ds, text) => { if(text) out.push({ rec: 2, ds, bytes: utf8 ? new TextEncoder().encode(text) : toLatin1(text).slice(0, -1) }); };
  if(!over) return out;
  put(5, over.title); put(80, over.author); put(116, over.copyright); put(120, over.description);
  for(const k of over.keywords || []) put(25, k);
  const t = parseLocalDate(over.date);
  if(t){ out.push({ rec: 2, ds: 55, bytes: enc(`${t.y}${pad2(t.mo)}${pad2(t.d)}`) }); out.push({ rec: 2, ds: 60, bytes: enc(`${pad2(t.h)}${pad2(t.mi)}${pad2(t.s)}+0000`) }); }
  return out;
};

/** Datos IIM (bytes en bruto, sin envoltorio de Photoshop) con sólo los conjuntos que permite `policy` más los campos editados, o null. */
export function buildIim(sets, policy, over = null){
  const allowed = new Set();
  for(const cls of Object.keys(IPTC_SETS)) if(policy[cls]) for(const d of IPTC_SETS[cls]) allowed.add(d);
  const rmDs = new Set();
  for(const k of (over && over.remove) || []) for(const d of IPTC_REMOVE[k] || []) rmDs.add(d);
  let kept = sets.filter(s => s.rec === 2 && allowed.has(s.ds) && !rmDs.has(s.ds) && s.bytes.length < 32768);
  const charset = sets.find(s => s.rec === 1 && s.ds === 90);          // codificación de caracteres (UTF-8 o la antigua)
  const isUtf8 = !charset || (charset.bytes.length === 3 && charset.bytes[0] === 0x1B && charset.bytes[1] === 0x25 && charset.bytes[2] === 0x47);
  const mine = iptcOver(over, isUtf8);
  if(mine.length){ const replaced = new Set(mine.map(m => m.ds)); kept = kept.filter(k => !replaced.has(k.ds)).concat(mine); }
  if(!kept.length) return null;
  const parts = [];
  const add = (rec, ds, bytes) => { parts.push(new Uint8Array([0x1C, rec, ds, bytes.length >> 8, bytes.length & 255]), bytes); };
  kept.sort((a, b) => a.ds - b.ds);
  if(charset) add(1, 90, charset.bytes);                                 // el registro 1 va antes que el 2
  else if(mine.length) add(1, 90, new Uint8Array([0x1B, 0x25, 0x47]));
  add(2, 0, new Uint8Array([0, 4]));                                     // versión del registro
  for(const s of kept) add(2, s.ds, s.bytes);
  return concat(parts);
}

/** Segmento APP13 (Photoshop 3.0) con los datos IPTC de `buildIim`, o null. */
export function buildIptc(sets, policy, over = null){
  const iim = buildIim(sets, policy, over);
  return iim ? wrapIim(iim) : null;
}

export function wrapIim(iim){
  const pad = iim.length & 1;
  const irb = new Uint8Array(4 + 2 + 2 + 4 + iim.length + pad);
  irb.set([0x38, 0x42, 0x49, 0x4D, 0x04, 0x04, 0, 0], 0);                // «8BIM», recurso 0x0404, nombre vacío
  new DataView(irb.buffer).setUint32(8, iim.length);
  irb.set(iim, 12);
  const head = new TextEncoder().encode("Photoshop 3.0\0");
  return concat([head, irb]);
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Un valor XMP: texto suelto, atributo de rdf:Description, o lista (Seq/Bag/Alt) → { kind: "text"|"Seq"|"Bag"|"Alt", items:[{ text, lang }] } */
function xmpProp(doc, ns, name){
  const descs = [...doc.getElementsByTagNameNS(NS.rdf, "Description")];
  for(const d of descs){
    const v = d.getAttributeNS(ns, name);
    if(v) return { kind: "text", items: [{ text: v }] };
  }
  const el = doc.getElementsByTagNameNS(ns, name)[0];
  if(!el) return null;
  const list = [...el.children].find(c => c.namespaceURI === NS.rdf && ["Seq", "Bag", "Alt"].includes(c.localName));
  if(list){
    const items = [...list.children].filter(c => c.localName === "li").map(li => ({ text: li.textContent, lang: li.getAttribute("xml:lang") || null })).filter(x => x.text);
    return items.length ? { kind: list.localName, items } : null;
  }
  const t = el.textContent.trim();
  return t ? { kind: "text", items: [{ text: t }] } : null;
}

const XMP_SETS = {
  author: [["dc", "creator"], ["dc", "rights"], ["xmpRights", "UsageTerms"], ["xmpRights", "WebStatement"], ["xmpRights", "Marked"], ["photoshop", "Credit"], ["photoshop", "Source"]],
  text: [["dc", "title"], ["dc", "description"], ["dc", "subject"], ["photoshop", "Headline"]],
  date: [["xmp", "CreateDate"], ["photoshop", "DateCreated"]],
  gps: [["photoshop", "City"], ["photoshop", "State"], ["photoshop", "Country"], ["Iptc4xmpCore", "Location"], ["Iptc4xmpCore", "CountryCode"]]
};

/* Del IPTC a XMP (para los formatos sin hueco para IPTC —WebP, AVIF, JPEG XL, TIFF, PDF— y para completar un XMP al que le falta algo) */
const IPTC_XMP = {
  author: [[80, "dc", "creator", "Seq"], [116, "dc", "rights", "Alt"], [110, "photoshop", "Credit", "text"], [115, "photoshop", "Source", "text"]],
  text: [[5, "dc", "title", "Alt"], [120, "dc", "description", "Alt"], [25, "dc", "subject", "Bag"], [105, "photoshop", "Headline", "text"]],
  gps: [[90, "photoshop", "City", "text"], [95, "photoshop", "State", "text"], [101, "photoshop", "Country", "text"]]
};

const gpsXmp = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return `${d},${m.toFixed(5)}${v >= 0 ? pos : neg}`; };

/** Paquete XMP nuevo (texto) con los campos que permite `policy` más los editados (`over`), o null. `xmpTexts`: el XMP del original (texto o
    lista de textos: principal y extendido); `iptc`: los conjuntos IPTC del original, que completan lo que falte. */
export function buildXmp(xmpTexts, policy, { iptc = [], over = null } = {}){
  const list = (Array.isArray(xmpTexts) ? xmpTexts : [xmpTexts]).filter(Boolean), docs = [];
  for(const t of list){
    try{
      const d = new DOMParser().parseFromString(t.replace(/^[^<]*/, "").replace(/<\?xpacket[^>]*\?>/g, ""), "application/xml");
      if(!d.getElementsByTagName("parsererror").length) docs.push(d);
    }catch{ /* un paquete roto no impide los demás */ }
  }
  const props = new Map();                         // "pfx:nombre" → { pfx, name, kind, items }
  for(const cls of Object.keys(XMP_SETS)){
    if(!policy[cls]) continue;
    for(const [pfx, name] of XMP_SETS[cls]){
      for(const d of docs){ const v = xmpProp(d, NS[pfx], name); if(v){ props.set(pfx + ":" + name, { pfx, name, ...v }); break; } }
    }
  }
  const dec = new TextDecoder("utf-8", { fatal: false }), latin = u => { let s = ""; for(const b of u) s += String.fromCharCode(b); return s; };
  const iptcUtf8 = (() => { const c = iptc.find(x => x.rec === 1 && x.ds === 90); return !c || (c.bytes.length === 3 && c.bytes[0] === 0x1B && c.bytes[1] === 0x25 && c.bytes[2] === 0x47); })();
  const txt = u => iptcUtf8 ? dec.decode(u) : latin(u);
  for(const cls of Object.keys(IPTC_XMP)){
    if(!policy[cls]) continue;
    for(const [ds, pfx, name, kind] of IPTC_XMP[cls]){
      const key = pfx + ":" + name; if(props.has(key)) continue;
      const vals = iptc.filter(x => x.rec === 2 && x.ds === ds).map(x => txt(x.bytes)).filter(Boolean);
      if(vals.length) props.set(key, { pfx, name, kind, items: (kind === "text" ? vals.slice(0, 1) : kind === "Bag" ? vals : vals.slice(0, 1)).map(text => ({ text, lang: kind === "Alt" ? "x-default" : null })) });
    }
  }
  if(policy.date && !props.has("photoshop:DateCreated")){
    const dts = iptc.find(x => x.rec === 2 && x.ds === 55), m = dts && /^(\d{4})(\d{2})(\d{2})/.exec(txt(dts.bytes));
    if(m) props.set("photoshop:DateCreated", { pfx: "photoshop", name: "DateCreated", kind: "text", items: [{ text: `${m[1]}-${m[2]}-${m[3]}` }] });
  }
  if(over && over.remove) for(const k of over.remove) for(const key of XMP_REMOVE[k] || []) props.delete(key);
  // campos editados
  if(over){
    const one = (pfx, name, text, kind) => { if(text) props.set(pfx + ":" + name, { pfx, name, kind, items: [{ text, lang: kind === "Alt" ? "x-default" : null }] }); };
    one("dc", "title", over.title, "Alt"); one("dc", "description", over.description, "Alt");
    one("dc", "creator", over.author, "Seq"); one("dc", "rights", over.copyright, "Alt");
    if(over.keywords && over.keywords.length) props.set("dc:subject", { pfx: "dc", name: "subject", kind: "Bag", items: over.keywords.map(text => ({ text })) });
    const t = parseLocalDate(over.date);
    if(t){ const iso = `${t.y}-${pad2(t.mo)}-${pad2(t.d)}T${pad2(t.h)}:${pad2(t.mi)}:${pad2(t.s)}`; one("xmp", "CreateDate", iso, "text"); one("photoshop", "DateCreated", iso, "text"); }
    if(hasGpsOver(over)){ one("exif", "GPSLatitude", gpsXmp(over.lat, "N", "S"), "text"); one("exif", "GPSLongitude", gpsXmp(over.lon, "E", "W"), "text"); }
  }
  if(!props.size) return null;
  const used = new Set(), body = [];
  for(const { pfx, name, kind, items } of props.values()){
    used.add(pfx);
    if(kind === "text") body.push(`<${pfx}:${name}>${esc(items[0].text)}</${pfx}:${name}>`);
    else body.push(`<${pfx}:${name}><rdf:${kind}>${items.map(it => `<rdf:li${it.lang ? ` xml:lang="${esc(it.lang)}"` : ""}>${esc(it.text)}</rdf:li>`).join("")}</rdf:${kind}></${pfx}:${name}>`);
  }
  const decl = [...used].map(p => `xmlns:${p}="${NS[p]}"`).join(" ");
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="${NS.rdf}"><rdf:Description rdf:about="" ${decl}>${body.join("")}</rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`;
}

/** { exif (TIFF), xmp (texto), iptc (APP13), iim (IPTC en bruto) } listos para incrustar según `policy`, más los campos editados `over`
    (título, descripción, autor, copyright, palabras clave, fecha, lat/lon); cualquier parte puede ser null. `orig` puede ser null (documento
    sin archivo de origen: sólo salen los campos editados). */
export function filterMetadata(orig, policy, opts = {}){
  const o = orig || { tiff: null, xmp: null, xmpExt: null, iptc: [], maker: null };
  const over = opts.over && Object.values(opts.over).some(v => Array.isArray(v) ? v.length : v !== "" && v != null && !Number.isNaN(v)) ? opts.over : null;
  const exif = buildFilteredExif(o.tiff, policy, { ...opts, over, maker: o.maker });
  // con la nota del fabricante el EXIF puede pasar de los ≈64 KB de un segmento JPEG: ese formato usa la versión sin ella
  const exifJpeg = exif && exif.length > 65000 ? buildFilteredExif(o.tiff, { ...policy, maker: false }, { ...opts, over, maker: null }) : exif;
  const make = o.tiff && o.tiff.ifd0.find(e => e.tag === 0x010F);
  const useMaker = !!(exif && policy.maker && o.maker && o.tiff && o.tiff.le && !opts.original);
  return {
    exif, exifJpeg,
    maker: useMaker ? { off: o.maker.off, bytes: o.maker.bytes, make: make ? td.decode(make.bytes).replace(/\0.*$/s, "") : "" } : null,
    xmp: buildXmp([o.xmp, o.xmpExt], policy, { iptc: o.iptc || [], over }),
    iptc: buildIptc(o.iptc || [], policy, over),
    iim: buildIim(o.iptc || [], policy, over)
  };
}

/** Campos básicos de un paquete XMP ya construido (para el diccionario Info de un PDF): { title, description, author, copyright, keywords, date } */
export function fieldsFromXmp(xmp){
  if(!xmp) return {};
  try{
    const d = new DOMParser().parseFromString(xmp.replace(/^[^<]*/, "").replace(/<\?xpacket[^>]*\?>/g, ""), "application/xml");
    if(d.getElementsByTagName("parsererror").length) return {};
    const one = (ns, n) => { const v = xmpProp(d, ns, n); return v ? v.items.map(i => i.text).join(", ") : ""; };
    return { title: one(NS.dc, "title"), description: one(NS.dc, "description"), author: one(NS.dc, "creator"), copyright: one(NS.dc, "rights"), keywords: one(NS.dc, "subject"), date: one(NS.xmp, "CreateDate") || one(NS.photoshop, "DateCreated") };
  }catch{ return {}; }
}

/** Campos que trae el original, en la forma que usa el editor de metadatos (io/meta/metaedit.js): { title, description, author, copyright, keywords[], date, lat, lon }. */
export function fieldsFromOriginal(orig){
  if(!orig) return {};
  const all = { author: true, date: true, camera: false, gps: true, text: true, ids: false };
  const fx = fieldsFromXmp(buildXmp([orig.xmp, orig.xmpExt], all, { iptc: orig.iptc || [] }));
  const t = orig.tiff, str = (list, tag) => { const e = list && list.find(x => x.tag === tag); return e && e.type === 2 ? new TextDecoder("latin1").decode(e.bytes).replace(/\0+$/, "").trim() : ""; };
  const f = {
    title: fx.title || "", description: fx.description || str(t && t.ifd0, 0x010E), author: fx.author || str(t && t.ifd0, 0x013B), copyright: fx.copyright || str(t && t.ifd0, 0x8298),
    keywords: fx.keywords ? fx.keywords.split(/,\s*/).filter(Boolean) : [], date: ""
  };
  const d = fx.date || str(t && t.exif, 0x9003).replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T");
  if(d) f.date = /T/.test(d) ? d.slice(0, 16) : d.slice(0, 10) + "T00:00";
  const g = t && t.gps;
  if(g && g.length){
    const rat = e => { if(!e || e.type !== 5 || e.bytes.length < 24) return null; const dv = new DataView(e.bytes.buffer, e.bytes.byteOffset, e.bytes.byteLength); const v = i => dv.getUint32(i * 8, true) / (dv.getUint32(i * 8 + 4, true) || 1); return v(0) + v(1) / 60 + v(2) / 3600; };
    const la = rat(g.find(e => e.tag === 2)), lo = rat(g.find(e => e.tag === 4)), ns = str(g, 1), ew = str(g, 3);
    if(la != null && lo != null){ f.lat = +(ns === "S" ? -la : la).toFixed(6); f.lon = +(ew === "W" ? -lo : lo).toFixed(6); }
  }
  return f;
}
