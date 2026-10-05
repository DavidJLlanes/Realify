/* Prueba del empaquetador HEIC (js/io/heif.js): con un HEIC real generado por libheif (pillow-heif, sólo para la prueba), se saca su
   hvcC y su fotograma HEVC, se reempaquetan con nuestro escritor (recto, recortado con `clap`, y pasando por Annex B) y se
   decodifican de nuevo con libheif: deben dar los MISMOS píxeles. Uso: node tests/heic.mjs   (necesita python3 con pillow-heif y numpy) */
import { execFileSync } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { writeHeic, annexBToHevc, hevcLevel } from "../js/io/heif.js";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heic-")), py = (code, ...a) => execFileSync("python3", ["-c", code, ...a], { encoding: "utf8" });
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
py(`
import sys, numpy as np, pillow_heif
from PIL import Image
pillow_heif.register_heif_opener()
w,h=320,240
a=np.zeros((h,w,3),np.uint8); a[...,0]=np.linspace(0,255,w); a[...,1]=np.linspace(0,255,h)[:,None]; a[...,2]=((np.arange(w)//16+np.arange(h)[:,None]//16)%2)*200
Image.fromarray(a).save(sys.argv[1]+'/ref.heic', format='HEIF', quality=90)`, dir);
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
if(process.env.HEIC_DUMP){ fs.writeFileSync(path.join(process.env.HEIC_DUMP, "sample.bin"), sample); fs.writeFileSync(path.join(process.env.HEIC_DUMP, "hvcc.bin"), hvcc); }
console.log("colr de la referencia:", JSON.stringify(refColr));
console.log(`HEIC de referencia: ${W}×${H}, hvcC ${hvcc.length} B, fotograma ${sample.length} B, nivel previsto ${hevcLevel(W, H)}`);

const decode = (name, bytes) => { fs.writeFileSync(path.join(dir, name), bytes);
  return JSON.parse(py(`
import sys, json, hashlib, numpy as np, pillow_heif
from PIL import Image
pillow_heif.register_heif_opener()
im=Image.open(sys.argv[1]).convert('RGB'); a=np.asarray(im)
print(json.dumps({'w':im.width,'h':im.height,'sha':hashlib.sha1(a.tobytes()).hexdigest(),'mean':a.reshape(-1,3).mean(0).round(2).tolist()}))`, path.join(dir, name))); };
const base = decode("ref.heic", ref);
// 1) reempaquetado recto: mismos píxeles
const a = decode("a.heic", writeHeic({ sample, hvcc, width: W, height: H, colr: refColr }));
chk(a.w === W && a.h === H && a.sha === base.sha, `reempaquetado recto: ${JSON.stringify(a)} vs ${JSON.stringify(base)}`);
// 2) recortado con clap: tamaño visible menor y mismos píxeles en la parte visible
const c = decode("c.heic", writeHeic({ sample, hvcc, width: W - 3, height: H - 1, codedWidth: W, codedHeight: H, colr: refColr }));
chk(c.w === W - 3 && c.h === H - 1, `recorte clap: ${c.w}×${c.h}`);
const cropSha = py(`
import sys, hashlib, numpy as np, pillow_heif
from PIL import Image
pillow_heif.register_heif_opener()
a=np.asarray(Image.open(sys.argv[1]).convert('RGB'))[:int(sys.argv[2]),:int(sys.argv[3])]; print(hashlib.sha1(a.tobytes()).hexdigest())`, path.join(dir, "ref.heic"), String(H - 1), String(W - 3)).trim();
chk(c.sha === cropSha, "el recorte con clap debe dar la esquina superior izquierda de la imagen");
// 3) Annex B → hvcC + muestra: se deshace el formato y se vuelve a construir
const ps = []; { let o = 5 + 18 + 1; }  // (no se usa)
function arrays(h){ let o = 23, n = h[22], out = []; for(let i = 0; i < n; i++){ const t = h[o] & 63, k = (h[o + 1] << 8) | h[o + 2]; o += 3; for(let j = 0; j < k; j++){ const l = (h[o] << 8) | h[o + 1]; out.push({ t, nal: h.slice(o + 2, o + 2 + l) }); o += 2 + l; } } return out; }
const sc = Uint8Array.of(0, 0, 0, 1), parts = [];
for(const { nal } of arrays(hvcc)){ parts.push(sc, nal); }
for(let o = 0; o < sample.length;){ const l = (sample[o] << 24 | sample[o + 1] << 16 | sample[o + 2] << 8 | sample[o + 3]) >>> 0; parts.push(sc, sample.subarray(o + 4, o + 4 + l)); o += 4 + l; }
const annex = new Uint8Array(parts.reduce((n, x) => n + x.length, 0)); { let o = 0; for(const x of parts){ annex.set(x, o); o += x.length; } }
const r = annexBToHevc(annex);
chk(Buffer.compare(Buffer.from(r.sample), Buffer.from(sample)) === 0, "Annex B → muestra con longitudes: debe ser idéntica");
const hx = x => Buffer.from(x).toString("hex");
// perfil (1), compatibilidad (4) y nivel (1): idénticos; las banderas de restricción las copiamos del SPS (libheif las deja a 0)
chk(hx(r.hvcc.subarray(0, 6)) === hx(hvcc.subarray(0, 6)) && r.hvcc[12] === hvcc[12], `Annex B → hvcC: perfil, compatibilidad y nivel (${hx(r.hvcc.subarray(0, 13))} vs ${hx(hvcc.subarray(0, 13))})`);
const A = arrays(r.hvcc), B = arrays(hvcc).filter(x => x.t >= 32 && x.t <= 34);
chk(A.length === B.length && A.every((x, i) => x.t === B[i].t && hx(x.nal) === hx(B[i].nal)), `Annex B → hvcC: VPS/SPS/PPS idénticos (${A.map(x => x.t)} vs ${B.map(x => x.t)})`);
const d = decode("d.heic", writeHeic({ sample: r.sample, hvcc: r.hvcc, width: W, height: H, colr: refColr }));
chk(d.sha === base.sha, "el HEIC hecho desde Annex B se decodifica igual");
// 4) colr con ICC y estructura mínima
const e = writeHeic({ sample, hvcc, width: W, height: H, colr: { icc: Uint8Array.from({ length: 32 }, (_, i) => i) } });
chk(Buffer.from(e).includes(Buffer.from("prof")), "colr 'prof' con ICC");
chk(decode("e.heic", e).w === W, "HEIC con colr prof se decodifica");
// niveles
chk(hevcLevel(1920, 1080) === 123 && hevcLevel(3000, 2500) === 153 && hevcLevel(4000, 3000) === 183 && hevcLevel(8000, 6000) === 186 && hevcLevel(20000, 10000) === 0, "niveles HEVC");
// 5) RGB → I420 (BT.709, rango limitado) → RGB: ida y vuelta sobre una imagen suave y sobre una de contornos nítidos
{
  const { rgbaToI420 } = await import("../js/io/heic.js");
  const w = 64, h = 48, mk = f => { const a = new Uint8ClampedArray(w * h * 4); for(let j = 0; j < h; j++) for(let i = 0; i < w; i++){ const [r, g, b] = f(i, j); a.set([r, g, b, 255], (j * w + i) * 4); } return a; };
  const back = (yuv, cw, ch, i, j) => { const Y = (yuv[j * cw + i] - 16) / 219, ci = (j >> 1) * (cw >> 1) + (i >> 1), Cb = (yuv[cw * ch + ci] - 128) / 224, Cr = (yuv[cw * ch + (cw >> 1) * (ch >> 1) + ci] - 128) / 224;
    return [Y + 2 * (1 - 0.2126) * Cr, Y - (2 * 0.0722 * (1 - 0.0722) * Cb + 2 * 0.2126 * (1 - 0.2126) * Cr) / 0.7152, Y + 2 * (1 - 0.0722) * Cb].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)); };
  for(const [name, f, tol] of [["suave", (i, j) => [i * 2, j * 3, 128 + (i >> 1)], 3], ["gris", (i, j) => [(i * 4) | 0, (i * 4) | 0, (i * 4) | 0], 2]]){
    const px = mk(f), yuv = rgbaToI420(px, w, h, w, h); let worst = 0;
    for(let j = 0; j < h; j++) for(let i = 0; i < w; i++){ const o = back(yuv, w, h, i, j); for(let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(o[k] - px[(j * w + i) * 4 + k])); }
    chk(worst <= tol, `ida y vuelta RGB↔YUV (${name}): error máximo ${worst} > ${tol}`);
  }
  const odd = rgbaToI420(mk(() => [10, 20, 30]), w, h, 66, 50);
  chk(odd.length === 66 * 50 + 2 * 33 * 25, "I420 con relleno a tamaño par: tamaño del búfer");
  chk(rgbaToI420(mk(() => [0, 0, 0]), w, h, w, h)[0] === 16 && rgbaToI420(mk(() => [255, 255, 255]), w, h, w, h)[0] === 235, "negro = 16 y blanco = 235 (rango limitado)");
}
// 6) Flujo completo en el navegador con un VideoEncoder simulado que devuelve el HEVC real de la referencia
let chromium; for(const m of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(m)); break; }catch{} }
if(chromium){
  const http = await import("node:http"), root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(new URL(q.url, "http://x").pathname)); if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(200, { "Content-Type": "text/html" }); r.end("<html></html>"); return; } r.writeHead(200, { "Content-Type": "text/javascript" }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const b = await chromium.launch(), page = await b.newPage(), errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index-vacio.html`);
  const res = await page.evaluate(async ({ sample, hvcc, W, H, odd }) => {
    const S = new Uint8Array(sample), HV = new Uint8Array(hvcc), log = { cfgs: [], frames: [] };
    window.VideoFrame = class { constructor(data, init){ this.data = data; this.init = init; log.frames.push({ len: data.length, init }); } close(){} };
    window.VideoEncoder = class { static async isConfigSupported(c){ return { supported: !!c.codec && /^hvc1\.1\.6\.L\d+\.B0$/.test(c.codec) }; } constructor(o){ this.o = o; } configure(c){ log.cfgs.push(c); } encode(f, o){ log.key = o?.keyFrame; } async flush(){ this.o.output({ byteLength: S.length, copyTo: x => x.set(S) }, { decoderConfig: { description: HV } }); } close(){} };
    const { encodeHeic, heicSupported } = await import("/js/io/heic.js");
    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#808080"; x.fillRect(0, 0, w, h); return c; };
    const out = { supported: await heicSupported() };
    const blob = await encodeHeic(mk(W, H), { quality: .9 });
    out.type = blob.type; out.bytes = Array.from(new Uint8Array(await blob.arrayBuffer())); out.cfg = log.cfgs[0]; out.frame = log.frames[0]; out.key = log.key;
    log.cfgs.length = 0; log.frames.length = 0;
    const blob2 = await encodeHeic(mk(odd[0], odd[1]), { quality: .5 });
    out.oddCfg = log.cfgs[0]; out.oddBytes = Array.from(new Uint8Array(await blob2.arrayBuffer()));
    return out;
  }, { sample: Array.from(sample), hvcc: Array.from(hvcc), W, H, odd: [W + 1, H + 1] });
  chk(res.supported === true, "heicSupported con el codificador simulado");
  chk(res.type === "image/heic" && res.key === true, "Blob image/heic y fotograma clave");
  chk(res.cfg.codec === "hvc1.1.6.L93.B0" && res.cfg.width === W && res.cfg.height === H && res.cfg.hevc?.format === "hevc" && res.cfg.latencyMode === "quality", "configuración del codificador " + JSON.stringify(res.cfg));
  chk(res.frame.len === W * H * 3 / 2 && res.frame.init.format === "I420" && res.frame.init.colorSpace.matrix === "bt709" && res.frame.init.colorSpace.fullRange === false && res.frame.init.colorSpace.primaries === "bt709", "fotograma I420 BT.709 de rango limitado");
  chk(res.cfg.bitrate > W * H * 0.25 && res.cfg.bitrate < W * H * 3, "tasa de bits razonable " + res.cfg.bitrate);
  fs.writeFileSync(path.join(dir, "n.heic"), Uint8Array.from(res.bytes));
  const dn = JSON.parse(py(`
import sys, json, pillow_heif
from PIL import Image
pillow_heif.register_heif_opener()
im=Image.open(sys.argv[1]); print(json.dumps({'w':im.width,'h':im.height}))`, path.join(dir, "n.heic")));
  chk(dn.w === W && dn.h === H, "el HEIC del flujo completo se abre con libheif: " + JSON.stringify(dn));
  chk(res.oddCfg.width === W + 2 && res.oddCfg.height === H + 2, "tamaño impar: se codifica a tamaño par " + res.oddCfg.width + "×" + res.oddCfg.height);
  chk(Buffer.from(res.oddBytes).includes(Buffer.from("clap")), "tamaño impar: lleva recorte clap");
  chk(errs.length === 0, "errores de página " + errs);
  await b.close(); srv.close();
}
console.log(bad ? "heic: FALLO" : "heic: OK"); process.exit(bad ? 1 : 0);
