/* [heic10] Prueba del HEIC de 10 bits (js/io/heic.js, js/io/heif.js): con un HEIC real generado por libheif (pillow-heif, sólo para la prueba), se saca su
   hvcC y su fotograma HEVC, se reempaquetan con nuestro escritor (recto, recortado con `clap`, y pasando por Annex B) y se
   decodifican de nuevo con libheif: deben dar los MISMOS píxeles. Uso: node tests/heic10.mjs   (necesita python3 con pillow-heif y numpy) */
import { execFileSync } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { writeHeic, annexBToHevc, hevcLevel } from "../js/io/heif.js";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heic-")), py = (code, ...a) => execFileSync("python3", ["-c", code, ...a], { encoding: "utf8" });
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
py(`
import sys, numpy as np, pillow_heif
from PIL import Image
pillow_heif.register_heif_opener()
w,h=64,48
a=np.zeros((h,w,3),np.uint16); a[...,0]=np.linspace(0,65535,w); a[...,1]=np.linspace(0,65535,h)[:,None]; a[...,2]=((np.arange(w)//8+np.arange(h)[:,None]//8)%2)*40000
hf=pillow_heif.from_bytes(mode='RGB;16',size=(w,h),data=a.tobytes()); hf.save(sys.argv[1]+'/ref.heic', quality=90, bit_depth=10)`, dir);
const ref = new Uint8Array(fs.readFileSync(path.join(dir, "ref.heic")));
const dv = new DataView(ref.buffer), u32 = o => dv.getUint32(o), tag = o => String.fromCharCode(...ref.subarray(o, o + 4));
function boxes(start, end){ const out = []; for(let o = start; o + 8 <= end;){ let size = u32(o), hdr = 8; if(size === 1){ size = Number(dv.getBigUint64(o + 8)); hdr = 16; } out.push({ type: tag(o + 4), start: o, body: o + hdr, end: o + size }); o += size; } return out; }
const top = boxes(0, ref.length), meta = top.find(b => b.type === "meta"), mb = boxes(meta.body + 4, meta.end);
const ipco = boxes(mb.find(b => b.type === "iprp").body, mb.find(b => b.type === "iprp").end).find(b => b.type === "ipco"), props = boxes(ipco.body, ipco.end);
const hvcP = props.find(b => b.type === "hvcC"), ispe = props.find(b => b.type === "ispe");
const colP = props.find(b => b.type === "colr"), refColr = colP && tag(colP.body) === "nclx" ? { primaries: dv.getUint16(colP.body + 4), transfer: dv.getUint16(colP.body + 6), matrix: dv.getUint16(colP.body + 8), fullRange: !!(ref[colP.body + 10] & 0x80) } : undefined;
const hvcc = ref.slice(hvcP.body, hvcP.end), W = u32(ispe.body + 4), H = u32(ispe.body + 8);
// iloc v0/1/2 genérico: primer ítem con tipo hvc1
const iloc = mb.find(b => b.type === "iloc"), ver = ref[iloc.body], sz = ref[iloc.body + 4], osz = sz >> 4, lsz = sz & 15, bsz = ref[iloc.body + 5] >> 4;
let p = iloc.body + 6; const cnt = ver < 2 ? dv.getUint16(p) : u32(p); p += ver < 2 ? 2 : 4;
const rd = (o, n) => n === 0 ? 0 : n === 4 ? u32(o) : Number(dv.getBigUint64(o));
const items = [];
for(let i = 0; i < cnt; i++){ const id = dv.getUint16(p); p += 2; if(ver === 1 || ver === 2) p += 2; p += 2; const base = rd(p, bsz); p += bsz; const ec = dv.getUint16(p); p += 2; const ex = []; for(let e = 0; e < ec; e++){ ex.push({ off: base + rd(p, osz), len: rd(p + osz, lsz) }); p += osz + lsz; } items.push({ id, ex }); }
const pitm = u32(mb.find(b => b.type === "pitm").body + 4) >>> 16, it = items.find(x => x.id === pitm) || items[0];
const sample = ref.slice(it.ex[0].off, it.ex[0].off + it.ex[0].len);

console.log(`HEIC de 10 bits de referencia: ${W}×${H}, hvcC ${hvcc.length} B (bitDepth luma ${(hvcc[17] & 7) + 8}), fotograma ${sample.length} B`);
chk((hvcc[17] & 7) + 8 === 10, "la referencia es de 10 bits");
const decode = (name, bytes) => { fs.writeFileSync(path.join(dir, name), bytes);
  return JSON.parse(py(`
import sys, json, hashlib, pillow_heif
r=pillow_heif.open_heif(sys.argv[1], convert_hdr_to_8bit=False)
print(json.dumps({'w':r.size[0],'h':r.size[1],'bits':r.info.get('bit_depth'),'sha':hashlib.sha1(r.data).hexdigest(),'exif':len(r.info.get('exif') or b''),'xmp':len(r.info.get('xmp') or b'')}))`, path.join(dir, name))); };
const base = decode("ref.heic", ref);
chk(base.bits === 10, "libheif ve la referencia como 10 bits " + JSON.stringify(base));
// 1) reempaquetado de 10 bits: mismos datos y 10 bits
// (la referencia se codifica a 64×64 y se recorta con clap a 64×48: el tamaño visible es el de la caja `clap`)
const VH = base.h, a = decode("a.heic", writeHeic({ sample, hvcc, width: W, height: VH, codedWidth: W, codedHeight: H, bitDepth: 10, colr: refColr }));
chk(a.w === W && a.h === VH && a.sha === base.sha && a.bits === 10, `reempaquetado de 10 bits: ${JSON.stringify(a)} vs ${JSON.stringify(base)}`);
const full = decode("full.heic", writeHeic({ sample, hvcc, width: W, height: H, bitDepth: 10, colr: { primaries: 12, transfer: 13, matrix: 1, fullRange: false } }));   // = lo que escribe el flujo completo (Display P3, BT.709)
chk(full.w === W && full.h === H && full.bits === 10, "reempaquetado de 10 bits sin recorte " + JSON.stringify(full));
const raw = Buffer.from(writeHeic({ sample, hvcc, width: W, height: H, bitDepth: 10, colr: refColr })), pix = raw.indexOf("pixi");
chk(pix > 0 && raw[pix + 8] === 3 && raw[pix + 9] === 10 && raw[pix + 10] === 10 && raw[pix + 11] === 10, "la caja pixi declara 10 bits por canal");
// 2) códec Main 10 y nivel; conversión RGB16 → I010
const { rgba16ToI010 } = await import("../js/io/heic.js");
{
  const w = 16, h = 8, mk = f => { const d = new Uint16Array(w * h * 4); for(let j = 0; j < h; j++) for(let i = 0; i < w; i++){ const [r, g, b] = f(i, j); d.set([r, g, b, 65535], (j * w + i) * 4); } return d; };
  const blk = rgba16ToI010(mk(() => [0, 0, 0]), 4, w, h, w, h), wht = rgba16ToI010(mk(() => [65535, 65535, 65535]), 4, w, h, w, h), red = rgba16ToI010(mk(() => [65535, 0, 0]), 4, w, h, w, h);
  chk(blk[0] === 64 && wht[0] === 940 && blk[w * h] === 512, "negro = 64 y blanco = 940 (rango limitado de 10 bits), croma neutro 512");
  chk(red[0] === Math.round(64 + 876 * 0.2126) && red[w * h + 0] === Math.round(512 + 896 * (-0.2126 / (2 * (1 - 0.0722)))) && red[w * h + (w >> 1) * (h >> 1)] === 960, "rojo puro: Y de BT.709, Cb y Cr (960 = máximo)");
  const gray = rgba16ToI010(mk(i => [i * 4000, i * 4000, i * 4000]), 4, w, h, w, h); let mono = true; for(let i = 1; i < w; i++) if(gray[i] < gray[i - 1]) mono = false;
  chk(mono && gray[w - 1] > 800, "una rampa de gris da una Y creciente");
  const odd = rgba16ToI010(mk(() => [100, 200, 300]), 4, w, h, w + 2, h + 2);
  chk(odd.length === (w + 2) * (h + 2) + 2 * ((w + 2) >> 1) * ((h + 2) >> 1), "I010 con relleno a tamaño par: tamaño del búfer");
}
// 3) flujo completo con un VideoEncoder simulado que devuelve el HEVC de 10 bits real de la referencia (y metadatos EXIF/XMP en el HEIC)
let chromium; for(const m of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(m)); break; }catch{} }
if(chromium){
  const http = await import("node:http"), root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(new URL(q.url, "http://x").pathname)); if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(200, { "Content-Type": "text/html" }); r.end("<!doctype html><title>x</title>"); return; } const T = { ".js": "text/javascript", ".html": "text/html" }; r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index-vacio.html`);
  const res = await page.evaluate(async ({ sample, hvcc, W, H }) => {
    const S = new Uint8Array(sample), HV = new Uint8Array(hvcc), log = { cfgs: [], frames: [] };
    window.VideoFrame = class { constructor(data, init){ if(init.format === "I420P10") throw new Error("formato no admitido aquí"); this.data = data; this.init = init; log.frames.push({ len: data.length, bytes: data.byteLength, init }); } close(){} };      // I420P10 falla a propósito: se prueba el segundo nombre del formato, I010
    window.VideoEncoder = class { static async isConfigSupported(c){ return { supported: !!c.codec && /^hvc1\.2\.4\.L\d+\.B0$/.test(c.codec) }; } constructor(o){ this.o = o; }
      configure(c){ log.cfgs.push(c); } encode(f, o){ log.key = o.keyFrame; this.f = f; } async flush(){ this.o.output({ byteLength: S.length, copyTo: d => d.set(S) }, { decoderConfig: { description: HV } }); } close(){} };
    const H_ = await import("/js/io/heic.js"), M = await import("/js/io/metadata.js"), W_ = await import("/js/exif/writer.js");
    const out = { s8: await H_.heicSupported(), s10: await H_.heicSupported(10) };
    const data = new Uint16Array(W * H * 4); for(let i = 0; i < W * H; i++){ data[i * 4] = (i % W) * 1000; data[i * 4 + 1] = 30000; data[i * 4 + 2] = 5000; data[i * 4 + 3] = 65535; }
    const blob = await H_.encodeHeicDeep({ data, channels: 4, width: W, height: H }, { quality: .9, space: "display-p3" });
    out.type = blob.type; out.cfg = log.cfgs[0]; out.frame = log.frames[0]; out.key = log.key; out.bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    const exif = W_.buildTIFF([W_.eAscii(0x010F, "TestCam"), W_.eAscii(0x013B, "Ana HEIC")], [W_.eAscii(0x9003, "2020:01:02 03:04:05")], [], {});
    const withMeta = await M.embedMetadata(blob, { exif, xmp: '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Ana XMP</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>' });
    out.meta = Array.from(new Uint8Array(await withMeta.arrayBuffer())); out.metaChanged = withMeta !== blob;
    return out;
  }, { sample: Array.from(sample), hvcc: Array.from(hvcc), W, H });
  chk(res.s8 === false && res.s10 === true, "heicSupported(8) falso y (10) cierto con el codificador simulado de Main 10");
  chk(res.type === "image/heic" && res.key === true, "Blob image/heic y fotograma clave");
  chk(/^hvc1\.2\.4\.L93\.B0$/.test(res.cfg.codec) && res.cfg.width === W && res.cfg.height === H && res.cfg.hevc?.format === "hevc", "configuración Main 10 " + JSON.stringify(res.cfg));
  chk(res.frame.init.format === "I010" && res.frame.len === W * H * 3 / 2 && res.frame.bytes === W * H * 3 && res.frame.init.colorSpace.primaries === "smpte432" && res.frame.init.colorSpace.matrix === "bt709", "fotograma I010 de 10 bits con primarios P3 " + JSON.stringify(res.frame));
  const dn = decode("n.heic", Uint8Array.from(res.bytes));
  chk(dn.w === W && dn.h === H && dn.bits === 10 && dn.sha === full.sha, "el HEIC del flujo completo es de 10 bits y se decodifica igual " + JSON.stringify(dn));
  const dm = decode("m.heic", Uint8Array.from(res.meta));
  chk(res.metaChanged && dm.sha === full.sha && dm.bits === 10 && dm.exif > 20 && dm.xmp > 50, "HEIC con EXIF y XMP: la imagen intacta y los metadatos leídos por libheif " + JSON.stringify(dm));
  chk(errs.length === 0, "errores de página " + errs);
  await b.close(); srv.close();
}
console.log(bad ? "heic10: FALLO" : "heic10: OK"); process.exit(bad ? 1 : 0);
