/* ═══════════════════════════════════════════════════════════════
   CREDENCIALES DE CONTENIDO (C2PA) EN EL INSPECTOR (v253)
   Lee el manifiesto C2PA de un archivo —el JUMBF que va en APP11 (JPEG), en un trozo `caBX` (PNG), en un trozo `C2PA` (WebP) o en una caja `jumb`
   (JPEG XL, AVIF/HEIC)— y enseña, sin salir del equipo: quién generó o editó el archivo (claim generator), el título, las acciones declaradas
   (creado, editado, colocado…, con el programa y el tipo de fuente digital: «trainedAlgorithmicMedia» = hecho por una IA), el autor, los componentes
   (ingredientes), las afirmaciones, y de la firma: algoritmo, emisor y titular del certificado y su validez.

   QUÉ SÍ COMPRUEBA: que el manifiesto se puede leer, y que el hash de los datos (`c2pa.hash.data`, SHA-2) coincide con el del archivo: si no, el archivo
   se modificó después de firmarse. QUÉ NO: la firma criptográfica ni la cadena de certificados contra una lista de confianza; por eso el estado se
   llama «sin verificar la firma». Una credencial es una declaración de quien la firmó, no una prueba de que la imagen sea real.
   Realify no firma ni conserva credenciales: al exportar se pierden (cambiar un solo píxel las invalidaría).
   ═══════════════════════════════════════════════════════════════ */

const td = new TextDecoder("utf-8", { fatal: false });
const ascii = (u, i, n) => { let s = ""; for(let k = 0; k < n && i + k < u.length; k++) s += String.fromCharCode(u[i + k]); return s; };

/* ── localizar el JUMBF ────────────────────────────────────────── */
function u32(u, i){ return ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0; }

function findJpeg(u){
  const groups = new Map();                           // En → [{ z, data }]
  let i = 2;
  while(i + 4 <= u.length){
    if(u[i] !== 0xFF) break;
    const m = u[i + 1];
    if(m === 0xDA || m === 0xD9) break;
    if(m === 0x01 || (m >= 0xD0 && m <= 0xD7)){ i += 2; continue; }
    const len = (u[i + 2] << 8) | u[i + 3];
    if(len < 2) break;
    if(m === 0xEB && u[i + 4] === 0x4A && u[i + 5] === 0x50 && i + 4 + 8 <= u.length){          // «JP», En, Z
      const en = (u[i + 6] << 8) | u[i + 7], z = u32(u, i + 8), data = u.subarray(i + 12, i + 2 + len);
      if(!groups.has(en)) groups.set(en, []);
      groups.get(en).push({ z, data });
    }
    i += 2 + len;
  }
  const out = [];
  for(const list of groups.values()){
    list.sort((a, b) => a.z - b.z);
    // cada trozo posterior al primero repite la cabecera de la caja (LBox, TBox): se salta
    const parts = list.map((p, k) => k === 0 ? p.data : p.data.subarray(8));
    let n = 0; for(const p of parts) n += p.length;
    const all = new Uint8Array(n); let o = 0; for(const p of parts){ all.set(p, o); o += p.length; }
    out.push(all);
  }
  return out;
}
function findPng(u){
  const out = [];
  let i = 8;
  while(i + 12 <= u.length){
    const n = u32(u, i), type = ascii(u, i + 4, 4);
    if(type === "caBX") out.push(u.subarray(i + 8, i + 8 + n));
    if(type === "IEND") break;
    i += 12 + n;
  }
  return out;
}
function findWebp(u){
  const out = [];
  let i = 12;
  while(i + 8 <= u.length){
    const type = ascii(u, i, 4), n = u[i + 4] | (u[i + 5] << 8) | (u[i + 6] << 16) | (u[i + 7] << 24);
    if(type === "C2PA") out.push(u.subarray(i + 8, i + 8 + n));
    i += 8 + n + (n & 1);
  }
  return out;
}
function findIso(u){
  const out = [];
  let i = 0;
  while(i + 8 <= u.length){
    let size = u32(u, i), hdr = 8; const type = ascii(u, i + 4, 4);
    if(size === 1){ size = Number(new DataView(u.buffer, u.byteOffset, u.byteLength).getBigUint64(i + 8)); hdr = 16; } else if(size === 0) size = u.length - i;
    if(size < hdr) break;
    if(type === "jumb") out.push(u.subarray(i, i + size));
    // AVIF/HEIC (BMFF): el manifiesto va en una caja «uuid» de C2PA: UUID, versión+flags, «manifest\0», desplazamiento Merkle (8 bytes) y la caja JUMBF
    if(type === "uuid" && u[i + hdr] === 0xD8 && u[i + hdr + 1] === 0xFE && u[i + hdr + 2] === 0xC3 && u[i + hdr + 3] === 0xD6){
      let q = i + hdr + 16 + 4;
      const e = u.indexOf(0, q);
      if(e > 0 && ascii(u, q, e - q) === "manifest"){ q = e + 1 + 8; if(q + 8 <= i + size) out.push(u.subarray(q, i + size)); }
    }
    i += size;
  }
  return out;
}
/** [{ container, roots: Uint8Array[] }] — cada raíz es una caja JUMBF completa (con su cabecera) o, en PNG/WebP, su contenido. */
export function findC2pa(u){
  if(u[0] === 0xFF && u[1] === 0xD8){ const r = findJpeg(u); return r.length ? { container: "JPEG", roots: r } : null; }
  if(u[0] === 0x89 && u[1] === 0x50){ const r = findPng(u); return r.length ? { container: "PNG", roots: r } : null; }
  if(ascii(u, 0, 4) === "RIFF" && ascii(u, 8, 4) === "WEBP"){ const r = findWebp(u); return r.length ? { container: "WebP", roots: r } : null; }
  if(ascii(u, 4, 4) === "ftyp" || ascii(u, 4, 4) === "JXL "){ const r = findIso(u); return r.length ? { container: /^avi[fs]$/.test(ascii(u, 8, 4)) ? "AVIF" : /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii(u, 8, 4)) ? "HEIC" : "ISO", roots: r } : null; }
  return null;
}

/* ── cajas JUMBF ───────────────────────────────────────────────── */
function boxesOf(u, start, end){
  const out = [];
  let o = start;
  while(o + 8 <= end){
    let size = u32(u, o), hdr = 8;
    const type = ascii(u, o + 4, 4);
    if(size === 1){ size = Number(new DataView(u.buffer, u.byteOffset, u.byteLength).getBigUint64(o + 8)); hdr = 16; } else if(size === 0) size = end - o;
    if(size < hdr || o + size > end) break;
    out.push({ type, start: o, body: o + hdr, end: o + size });
    o += size;
  }
  return out;
}
/** Una superbox `jumb`: { label, uuid, boxes: [contenido], kids: [superboxes] } */
function superbox(u, b){
  const kids = boxesOf(u, b.body, b.end), d = kids.find(k => k.type === "jumd");
  if(!d) return null;
  const toggles = u[d.body + 16];
  let label = "";
  if(toggles & 2){ let e = d.body + 17; while(e < d.end && u[e] !== 0) e++; label = td.decode(u.subarray(d.body + 17, e)); }
  const content = kids.filter(k => k.type !== "jumd" && k.type !== "jumb");
  return { label, uuid: [...u.subarray(d.body, d.body + 4)].map(x => String.fromCharCode(x)).join(""), content, children: kids.filter(k => k.type === "jumb").map(k => superbox(u, k)).filter(Boolean), u };
}

/* ── CBOR mínimo (RFC 8949) ────────────────────────────────────── */
export function cborDecode(u, pos = { i: 0 }, depth = 0){
  if(depth > 40) throw new Error("CBOR demasiado anidado");
  const b = u[pos.i++], major = b >> 5, info = b & 31;
  const arg = () => {
    if(info < 24) return info;
    const n = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : -1;
    if(n < 0) return -1;                                                  // indefinido
    let v = 0; for(let k = 0; k < n; k++) v = v * 256 + u[pos.i++];
    return v;
  };
  if(major === 7){
    if(info === 20) return false; if(info === 21) return true; if(info === 22 || info === 23) return null;
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    if(info === 25){ const h = dv.getUint16(pos.i); pos.i += 2; const e = (h >> 10) & 31, f = h & 1023; return (h & 0x8000 ? -1 : 1) * (e === 0 ? f * 2 ** -24 : e === 31 ? (f ? NaN : Infinity) : (1 + f / 1024) * 2 ** (e - 15)); }
    if(info === 26){ const v = dv.getFloat32(pos.i); pos.i += 4; return v; }
    if(info === 27){ const v = dv.getFloat64(pos.i); pos.i += 8; return v; }
    return undefined;
  }
  const n = arg();
  if(major === 0) return n;
  if(major === 1) return -1 - n;
  if(major === 2 || major === 3){
    let bytes;
    if(n < 0){ const parts = []; while(u[pos.i] !== 0xFF) parts.push(cborDecode(u, pos, depth + 1)); pos.i++; bytes = major === 2 ? Uint8Array.from(parts.flatMap(p => [...p])) : enc(parts.join("")); }
    else { bytes = u.subarray(pos.i, pos.i + n); pos.i += n; }
    return major === 2 ? bytes : td.decode(bytes);
  }
  if(major === 4){
    const out = [];
    if(n < 0){ while(u[pos.i] !== 0xFF) out.push(cborDecode(u, pos, depth + 1)); pos.i++; }
    else for(let k = 0; k < n; k++) out.push(cborDecode(u, pos, depth + 1));
    return out;
  }
  if(major === 5){
    const out = new Map();
    const one = () => { const k = cborDecode(u, pos, depth + 1); out.set(k, cborDecode(u, pos, depth + 1)); };
    if(n < 0){ while(u[pos.i] !== 0xFF) one(); pos.i++; } else for(let k = 0; k < n; k++) one();
    return out;
  }
  // etiqueta: se devuelve { tag, value }
  return { tag: n, value: cborDecode(u, pos, depth + 1) };
}
const enc = s => new TextEncoder().encode(s);
const plain = v => {                                                       // Map → objeto para leerlo cómodo
  if(v instanceof Map){ const o = {}; for(const [k, x] of v) o[String(k)] = plain(x); return o; }
  if(Array.isArray(v)) return v.map(plain);
  if(v && typeof v === "object" && "tag" in v && "value" in v) return plain(v.value);
  return v;
};
const readCbor = (u, b) => { try{ return plain(cborDecode(u.subarray(b.body, b.end))); }catch{ return null; } };

/* ── certificado X.509 (lo justo para mostrar emisor, titular y validez) ── */
function der(u, i){
  const tag = u[i]; let n = u[i + 1], h = 2;
  if(n & 0x80){ const k = n & 0x7F; n = 0; for(let j = 0; j < k; j++) n = n * 256 + u[i + 2 + j]; h = 2 + k; }
  return { tag, at: i, start: i + h, end: i + h + n, next: i + h + n };
}
function kids(u, node){ const out = []; let i = node.start; while(i < node.end){ const k = der(u, i); out.push(k); i = k.next; } return out; }
const OID_NAME = { "2.5.4.3": "CN", "2.5.4.10": "O", "2.5.4.11": "OU", "2.5.4.6": "C" };
function oid(u, n){ const b = u.subarray(n.start, n.end); const out = [Math.floor(b[0] / 40), b[0] % 40]; let v = 0; for(let k = 1; k < b.length; k++){ v = v * 128 + (b[k] & 127); if(!(b[k] & 128)){ out.push(v); v = 0; } } return out.join("."); }
function nameOf(u, n){
  const out = {};
  for(const set of kids(u, n)) for(const seq of kids(u, set)){ const [o, v] = kids(u, seq), key = OID_NAME[oid(u, o)]; if(key && !out[key]) out[key] = td.decode(u.subarray(v.start, v.end)); }
  return out;
}
function timeOf(u, n){
  const s = ascii(u, n.start, n.end - n.start); let m;
  if(n.tag === 0x17 && (m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(s))) return `${+m[1] < 50 ? 20 : 19}${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]} UTC`;
  if((m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]} UTC`;
  return s;
}
export function parseCert(u){
  try{
    const cert = der(u, 0), [tbs] = kids(u, cert), f = kids(u, tbs);
    let k = 0; if(f[0].tag === 0xA0) k = 1;                 // versión
    const issuer = nameOf(u, f[k + 2]), validity = kids(u, f[k + 3]), subject = nameOf(u, f[k + 4]);
    return { issuer, subject, notBefore: timeOf(u, validity[0]), notAfter: timeOf(u, validity[1]) };
  }catch{ return null; }
}

/* ── verificación de la firma y de la cadena (WebCrypto) ───────────────
   Qué se comprueba: la firma COSE del manifiesto contra la clave del primer certificado; que cada certificado de la cadena esté firmado por el siguiente;
   que la cadena acabe en un certificado autofirmado; y las fechas de validez (a fecha de hoy). Qué NO se comprueba: que la raíz esté en la lista de
   confianza de C2PA ni la revocación (OCSP): un certificado cualquiera puede firmar un manifiesto correcto. */
const OIDS = {
  "1.2.840.10045.4.3.2": ["ECDSA", "SHA-256"], "1.2.840.10045.4.3.3": ["ECDSA", "SHA-384"], "1.2.840.10045.4.3.4": ["ECDSA", "SHA-512"],
  "1.2.840.113549.1.1.11": ["RSA", "SHA-256"], "1.2.840.113549.1.1.12": ["RSA", "SHA-384"], "1.2.840.113549.1.1.13": ["RSA", "SHA-512"],
  "1.2.840.113549.1.1.10": ["PSS", null], "1.3.101.112": ["Ed25519", null]
};
const CURVES = { "1.2.840.10045.3.1.7": ["P-256", 32], "1.3.132.0.34": ["P-384", 48], "1.3.132.0.35": ["P-521", 66] };
const HASH_OID = { "2.16.840.1.101.3.4.2.1": "SHA-256", "2.16.840.1.101.3.4.2.2": "SHA-384", "2.16.840.1.101.3.4.2.3": "SHA-512" };
const SALT = { "SHA-256": 32, "SHA-384": 48, "SHA-512": 64 };
const intBytes = (u, n, size) => { let b = u.subarray(n.start, n.end); while(b.length > size && b[0] === 0) b = b.subarray(1); const out = new Uint8Array(size); out.set(b, size - b.length); return out; };
/** Piezas de un certificado DER que hacen falta para verificar: { tbs, sigAlg: [tipo, hash, saltLength], sig, spki, curve, rsa, subjectDer, issuerDer } o null */
function certParts(u){
  try{
    const cert = der(u, 0), [tbs, algo, bits] = kids(u, cert), f = kids(u, tbs), k = f[0].tag === 0xA0 ? 1 : 0, alg = kids(u, algo), o = oid(u, alg[0]), kind = OIDS[o];
    if(!kind) return { unsupported: o };
    let hash = kind[1], salt = 0;
    if(kind[0] === "PSS" && alg[1]){                                       // parámetros RSASSA-PSS: [0] hash, [2] sal
      for(const p of kids(u, alg[1])){ const inner = kids(u, p)[0]; if(p.tag === 0xA0) hash = HASH_OID[oid(u, kids(u, inner)[0])] || hash; if(p.tag === 0xA2) salt = intBytes(u, inner, 1)[0]; }
    }
    const spki = f[k + 5], spkiKids = kids(u, spki), keyAlg = kids(u, spkiKids[0]);
    return { tbs: u.subarray(tbs.at, tbs.next), sigAlg: [kind[0], hash, salt || (hash ? SALT[hash] : 0)], sig: u.subarray(bits.start + 1, bits.end), spki: u.subarray(spki.at, spki.next),
      curve: keyAlg[1] && keyAlg[1].tag === 0x06 ? CURVES[oid(u, keyAlg[1])] : null, keyOid: oid(u, keyAlg[0]), subject: u.subarray(f[k + 4].at, f[k + 4].next), issuer: u.subarray(f[k + 2].at, f[k + 2].next),
      dates: [timeOf(u, kids(u, f[k + 3])[0]), timeOf(u, kids(u, f[k + 3])[1])] };
  }catch{ return null; }
}
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
/** Verifica `sig` sobre `data` con la clave pública (SPKI) de `pub`. `kind`: "ES256"… o ["ECDSA"|"RSA"|"PSS"|"Ed25519", hash, sal]. Devuelve true/false o null si el navegador no sabe. */
async function verifyWith(pub, kind, hash, salt, data, sig){
  const S = crypto.subtle;
  try{
    if(kind === "ECDSA"){
      if(!pub.curve) return null;
      const key = await S.importKey("spki", pub.spki, { name: "ECDSA", namedCurve: pub.curve[0] }, false, ["verify"]);
      let raw = sig;
      if(sig[0] === 0x30){                                                     // firma ASN.1 (certificados) → r‖s
        const seq = der(sig, 0), [r, sv] = kids(sig, seq); raw = new Uint8Array(pub.curve[1] * 2); raw.set(intBytes(sig, r, pub.curve[1]), 0); raw.set(intBytes(sig, sv, pub.curve[1]), pub.curve[1]);
      }
      return await S.verify({ name: "ECDSA", hash }, key, raw, data);
    }
    if(kind === "RSA"){ const key = await S.importKey("spki", pub.spki, { name: "RSASSA-PKCS1-v1_5", hash }, false, ["verify"]); return await S.verify("RSASSA-PKCS1-v1_5", key, sig, data); }
    if(kind === "PSS"){ const key = await S.importKey("spki", pub.spki, { name: "RSA-PSS", hash }, false, ["verify"]); return await S.verify({ name: "RSA-PSS", saltLength: salt }, key, sig, data); }
    if(kind === "Ed25519"){ const key = await S.importKey("spki", pub.spki, { name: "Ed25519" }, false, ["verify"]); return await S.verify("Ed25519", key, sig, data); }
  }catch(err){ return null; }
  return null;
}
const COSE_ALG = { "-7": ["ECDSA", "SHA-256"], "-35": ["ECDSA", "SHA-384"], "-36": ["ECDSA", "SHA-512"], "-37": ["PSS", "SHA-256"], "-38": ["PSS", "SHA-384"], "-39": ["PSS", "SHA-512"], "-8": ["Ed25519", null] };
const bstrHead = n => n < 24 ? [0x40 | n] : n < 256 ? [0x58, n] : n < 65536 ? [0x59, n >> 8, n & 255] : [0x5A, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
/** Sig_structure de COSE_Sign1: ["Signature1", protegido, aad vacío, carga] en CBOR */
function sigStructure(protectedBytes, payload){
  const head = [0x84, 0x6A, ...enc("Signature1")];
  const parts = [Uint8Array.from(head), Uint8Array.from(bstrHead(protectedBytes.length)), protectedBytes, Uint8Array.from([0x40]), Uint8Array.from(bstrHead(payload.length)), payload];
  let n = 0; for(const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0; for(const p of parts){ out.set(p, o); o += p.length; }
  return out;
}
/** { signature: "valid"|"invalid"|"unchecked", chain: "ok"|"broken"|"incomplete"|"unchecked", root: bool, expired: bool, detail } */
export async function verifySignature(raw){
  const out = { signature: "unchecked", chain: "unchecked", root: false, expired: false, detail: "" };
  if(!raw || !raw.cose || !raw.chain.length || !globalThis.crypto || !crypto.subtle){ out.detail = "no hay firma o cadena que comprobar"; return out; }
  const certs = raw.chain.map(certParts);
  if(!certs[0] || certs[0].unsupported){ out.detail = "certificado de un tipo no admitido"; return out; }
  const [cose, alg] = [raw.cose, COSE_ALG[String(raw.alg)]];
  if(!alg){ out.detail = `algoritmo de firma no admitido (${raw.alg})`; return out; }
  const data = sigStructure(raw.protectedBytes, raw.claim);
  const ok = await verifyWith(certs[0], alg[0], alg[1], alg[0] === "PSS" ? SALT[alg[1]] : 0, data, cose[3]);
  out.signature = ok === null ? "unchecked" : ok ? "valid" : "invalid";
  if(ok === null) out.detail = "este navegador no sabe comprobar ese tipo de firma";
  // cadena: cada certificado firmado por el siguiente; la última, autofirmada
  let chainOk = true, tested = 0;
  for(let i = 0; i < certs.length; i++){
    const c = certs[i], issuer = certs[i + 1] || (certs[i] && sameBytes(certs[i].subject, certs[i].issuer) ? certs[i] : null);
    if(!c || c.unsupported) { chainOk = null; break; }
    if(!issuer){ out.chain = "incomplete"; break; }
    const r = await verifyWith(issuer, c.sigAlg[0], c.sigAlg[1], c.sigAlg[2], c.tbs, c.sig);
    if(r === null){ chainOk = null; break; }
    tested++;
    if(!r){ chainOk = false; break; }
    if(i === certs.length - 1) out.root = sameBytes(c.subject, c.issuer);
  }
  if(chainOk === false) out.chain = "broken";
  else if(chainOk === null) out.chain = "unchecked";
  else if(out.chain !== "incomplete") out.chain = "ok";
  if(out.chain === "ok" && !out.root) out.chain = "incomplete";
  const now = Date.now();
  out.expired = certs.some(c => c && c.dates && c.dates.some((d, k) => { const t = Date.parse(String(d).replace(" UTC", "Z").replace(" ", "T")); return Number.isFinite(t) && (k === 0 ? t > now : t < now); }));
  return out;
}
const ALG = { "-7": "ES256", "-35": "ES384", "-36": "ES512", "-8": "EdDSA", "-37": "PS256", "-38": "PS384", "-39": "PS512" };

/* ── resumen del manifiesto ────────────────────────────────────── */
const AI_TYPES = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;
const short = s => String(s || "").replace(/^.*[/#]/, "");
function summarizeAssertion(label, data){
  if(!data) return "";
  if(/^c2pa\.actions/.test(label)){
    const list = Array.isArray(data.actions) ? data.actions : [];
    return list.map(a => short(a.action) + (a.softwareAgent ? ` (${typeof a.softwareAgent === "string" ? a.softwareAgent : a.softwareAgent.name || ""})` : "")).join(", ");
  }
  if(/CreativeWork/.test(label)) return (Array.isArray(data.author) ? data.author : []).map(a => a.name).filter(Boolean).join(", ");
  if(/^c2pa\.ingredient/.test(label)) return data.title || data["dc:title"] || "";
  if(/^c2pa\.hash\.data/.test(label)) return `${(data.alg || "").toString()} · ${(data.exclusions || []).length} exclusiones`;
  if(/^c2pa\.training-mining/.test(label)) return "uso para entrenar o minar datos";
  return "";
}
function manifestInfo(sb, active){
  const u = sb.u, info = { label: sb.label, active, claim: {}, assertions: [], actions: [], authors: [], ingredients: [], signature: null, aiDeclared: false, sourceTypes: [], hashAssertion: null, hashBmff: null, thumbnails: [], _raw: null };
  const claimBox = sb.children.find(c => /^c2pa\.claim/.test(c.label)), sigBox = sb.children.find(c => /^c2pa\.signature/.test(c.label)), store = sb.children.find(c => /^c2pa\.assertions/.test(c.label));
  if(claimBox && claimBox.content[0]){
    const c = readCbor(u, claimBox.content[0]) || {};
    const gi = c.claim_generator_info;
    info.claim = {
      generator: (Array.isArray(gi) ? gi : gi ? [gi] : []).map(g => [g.name, g.version].filter(Boolean).join(" ")).filter(Boolean).join(", ") || c.claim_generator || "",
      title: c["dc:title"] || c.title || "", format: c["dc:format"] || c.format || "", alg: c.alg || "", instance: c.instanceID || c.instance_id || ""
    };
  }
  if(store) for(const a of store.children){
    const box = a.content[0], label = a.label;
    if(/^c2pa\.thumbnail/.test(label)){                                          // miniatura: caja «bidb» con los bytes de la imagen
      const bin = a.content.find(c => c.type === "bidb");
      if(bin) info.thumbnails.push({ label, mime: /png$/i.test(label) ? "image/png" : /webp$/i.test(label) ? "image/webp" : "image/jpeg", bytes: u.slice(bin.body, bin.end) });
    }
    let data = null;
    if(box && box.type === "cbor") data = readCbor(u, box);
    else if(box && box.type === "json"){ try{ data = JSON.parse(td.decode(u.subarray(box.body, box.end))); }catch{ /* JSON roto */ } }
    info.assertions.push({ label, summary: summarizeAssertion(label, data) });
    if(/^c2pa\.actions/.test(label) && data && Array.isArray(data.actions)){
      for(const act of data.actions){
        const st = act.digitalSourceType || (act.parameters && act.parameters.digitalSourceType) || "";
        info.actions.push({ action: String(act.action || ""), agent: typeof act.softwareAgent === "string" ? act.softwareAgent : act.softwareAgent && act.softwareAgent.name || "", sourceType: short(st) });
        if(st) info.sourceTypes.push(short(st));
        if(AI_TYPES.test(String(st))) info.aiDeclared = true;
      }
    }
    if(/CreativeWork/.test(label) && data && Array.isArray(data.author)) for(const p of data.author) if(p.name) info.authors.push(p.name);
    if(/^c2pa\.ingredient/.test(label) && data) info.ingredients.push(data.title || data["dc:title"] || "(sin título)");
    if(/^c2pa\.hash\.data/.test(label) && data) info.hashAssertion = data;
    if(/^c2pa\.hash\.bmff/.test(label) && data) info.hashBmff = { label, data };
  }
  if(sigBox && sigBox.content[0]){
    try{
      let cose = cborDecode(u.subarray(sigBox.content[0].body, sigBox.content[0].end));
      if(cose && cose.tag === 18) cose = cose.value;
      const protMap = cose[0] && cose[0].length ? cborDecode(cose[0]) : new Map(), unprot = cose[1] instanceof Map ? cose[1] : new Map(), prot = protMap instanceof Map ? Object.fromEntries([...protMap].map(([k, v]) => [String(k), v])) : {};
      // la cadena de certificados (x5chain, etiqueta 33) va en la cabecera sin proteger o, según la versión, en la protegida
      const chain = unprot.get(33) ?? unprot.get("x5chain") ?? protMap.get?.(33) ?? protMap.get?.("x5chain"), first = Array.isArray(chain) ? chain[0] : chain;
      const sig = { alg: ALG[String(prot[1])] || String(prot[1] ?? ""), cert: first instanceof Uint8Array ? parseCert(first) : null, chainLength: Array.isArray(chain) ? chain.length : chain ? 1 : 0, timestamp: unprot.has("sigTst") || unprot.has("sigTst2") };
      info.signature = sig;
      if(claimBox && claimBox.content[0] && Array.isArray(cose)) info._raw = { cose, claim: u.subarray(claimBox.content[0].body, claimBox.content[0].end), protectedBytes: cose[0] instanceof Uint8Array ? cose[0] : new Uint8Array(0),
        alg: prot[1], chain: (Array.isArray(chain) ? chain : chain ? [chain] : []).filter(c => c instanceof Uint8Array) };
    }catch{ info.signature = { alg: "", cert: null, chainLength: 0 }; }
  }
  return info;
}

/** Hash de los datos del archivo contra el `c2pa.hash.data` del manifiesto activo: { status: "match" | "mismatch" | "unchecked", detail } */
export async function checkDataHash(u, hashAssertion, claimAlg){
  if(!hashAssertion || !hashAssertion.hash || !(hashAssertion.hash instanceof Uint8Array)) return { status: "unchecked", detail: "el manifiesto no lleva un hash de los datos comprobable aquí (p. ej. un BMFF)" };
  const alg = String(hashAssertion.alg || claimAlg || "sha256").toLowerCase().replace(/[^a-z0-9]/g, ""), name = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" }[alg];
  if(!name || !globalThis.crypto || !crypto.subtle) return { status: "unchecked", detail: "algoritmo de hash no admitido" };
  const ex = (hashAssertion.exclusions || []).map(e => [Number(e.start), Number(e.start) + Number(e.length)]).filter(e => Number.isFinite(e[0]) && Number.isFinite(e[1])).sort((a, b) => a[0] - b[0]);
  const parts = []; let at = 0;
  for(const [s, e] of ex){ if(s > at) parts.push(u.subarray(at, s)); at = Math.max(at, e); }
  if(at < u.length) parts.push(u.subarray(at));
  let n = 0; for(const p of parts) n += p.length;
  const buf = new Uint8Array(n); let o = 0; for(const p of parts){ buf.set(p, o); o += p.length; }
  const digest = new Uint8Array(await crypto.subtle.digest(name, buf)), want = hashAssertion.hash;
  const same = digest.length === want.length && digest.every((v, i) => v === want[i]);
  return same ? { status: "match", detail: `${name} de los datos del archivo` } : { status: "mismatch", detail: "el archivo se ha modificado después de firmarse (o la firma es de otro archivo)" };
}

/** Hash BMFF (AVIF, HEIC) contra `c2pa.hash.bmff.v2/v3`: SHA-2 de, por cada caja de primer nivel no excluida y en orden, su desplazamiento (8 bytes, big endian) y sus bytes.
    Sólo las exclusiones de primer nivel (`/uuid` con su UUID, `/ftyp`, `/mfra`, `/free`, `/skip`…); con árboles de Merkle o rutas más hondas queda sin comprobar. */
export async function checkBmffHash(u, bmff, claimAlg){
  const a = bmff && bmff.data;
  if(!a || !(a.hash instanceof Uint8Array)) return { status: "unchecked", detail: "el manifiesto no lleva un hash BMFF comprobable" };
  const name = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" }[String(a.alg || claimAlg || "sha256").toLowerCase().replace(/[^a-z0-9]/g, "")];
  if(!name || !globalThis.crypto || !crypto.subtle) return { status: "unchecked", detail: "algoritmo de hash no admitido" };
  if(a.merkle && a.merkle.length) return { status: "unchecked", detail: "hash BMFF con árbol de Merkle (vídeo fragmentado)" };
  const ex = [];
  for(const e of a.exclusions || []){
    const m = /^\/([A-Za-z0-9 ]{4})$/.exec(String(e.xpath || ""));
    if(!m) return { status: "unchecked", detail: `exclusión «${e.xpath}» que aquí no se interpreta` };
    ex.push({ type: m[1], data: e.data || [] });
  }
  const parts = []; let o = 0, total = 0;
  while(o + 8 <= u.length){
    let size = u32(u, o), hdr = 8; const type = ascii(u, o + 4, 4);
    if(size === 1){ size = Number(new DataView(u.buffer, u.byteOffset, u.byteLength).getBigUint64(o + 8)); hdr = 16; } else if(size === 0) size = u.length - o;
    if(size < hdr || o + size > u.length) return { status: "unchecked", detail: "estructura de cajas no válida" };
    const excluded = ex.some(e => e.type === type && e.data.every(d => d && d.value instanceof Uint8Array && d.value.every((v, k) => u[o + Number(d.offset) + k] === v)));
    if(!excluded){ const off = new Uint8Array(8); new DataView(off.buffer).setBigUint64(0, BigInt(o)); parts.push(off, u.subarray(o, o + size)); total += 8 + size; }
    o += size;
  }
  const buf = new Uint8Array(total); let at = 0; for(const p of parts){ buf.set(p, at); at += p.length; }
  const digest = new Uint8Array(await crypto.subtle.digest(name, buf)), want = a.hash;
  const same = digest.length === want.length && digest.every((v, i) => v === want[i]);
  return same ? { status: "match", detail: `${name} de las cajas del archivo` } : { status: "mismatch", detail: "el archivo se ha modificado después de firmarse (o la firma es de otro archivo)" };
}

/** Lee las credenciales de contenido de los bytes de un archivo. null si no lleva ninguna. */
export async function readC2pa(u8){
  const f = findC2pa(u8);
  if(!f) return null;
  const manifests = [];
  let note = "";
  for(const root of f.roots){
    // JPEG/ISO: caja jumb completa; PNG/WebP: lo mismo (el trozo contiene la caja)
    const top = boxesOf(root, 0, root.length).find(b => b.type === "jumb");
    if(!top){ note = "Hay un bloque C2PA que no se pudo interpretar."; continue; }
    const store = superbox(root, top);
    if(!store) continue;
    const mans = store.label === "c2pa" ? store.children : [store];
    mans.forEach((m, i) => manifests.push(manifestInfo(m, i === mans.length - 1)));
  }
  if(!manifests.length) return { container: f.container, manifests: [], note: note || "Hay un bloque C2PA pero no contiene ningún manifiesto legible." };
  const active = manifests.find(m => m.active) || manifests[manifests.length - 1];
  active.hash = active.hashBmff && !active.hashAssertion ? await checkBmffHash(u8, active.hashBmff, active.claim.alg) : await checkDataHash(u8, active.hashAssertion, active.claim.alg);
  for(const m of manifests){
    if(m._raw) m.verify = await verifySignature(m._raw);
    delete m._raw; delete m.hashAssertion; delete m.hashBmff;
  }
  return { container: f.container, manifests, active: active.label, note };
}
