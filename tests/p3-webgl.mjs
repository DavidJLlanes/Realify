/* Prueba del motor WebGL del filtro Cámara en un documento Display P3 (v249): un color de gama amplia (P3 puro) debe pasar por la GPU
   sin recortarse a sRGB. Etapa neutra (viñeteo a 0) sobre un lienzo P3; el centro debe salir igual que entró. En sRGB, igual.
   Uso: node tests/p3-webgl.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), page = await b.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), CS = await import("/js/core/colorspace.js"), E = await import("/js/filters/camera/engine.js"), CH = await import("/js/filters/camera/chain.js");
  const out = { p3: CS.p3Supported(), gl: E.available() };
  if(!out.gl) return out;
  const stagesFor = () => { const s = {}; for(const st of CH.CHAIN){ s[st.id] = { on: st.id === "vignette", p: Object.fromEntries(st.params.map(p => [p.k, st.id === "vignette" ? (p.k === "amt" || p.k === "desat" ? 0 : p.v) : p.v])) }; } return s; };
  for(const modo of ["srgb", "display-p3"]){
    D.newDoc(32, 32, { name: modo }); D.doc.colorSpace = modo;
    const src = document.createElement("canvas"); src.width = src.height = 32; const sx = src.getContext("2d");
    // P3 puro: sólo se distingue de sRGB si el lienzo es P3 (en sRGB el mismo valor se queda en la gama sRGB)
    const id = sx.createImageData(32, 32, { colorSpace: sx.getContextAttributes().colorSpace }); for(let i = 0; i < id.data.length; i += 4){ id.data[i] = 255; id.data[i + 1] = 40; id.data[i + 2] = 20; id.data[i + 3] = 255; }
    sx.putImageData(id, 0, 0);
    const dst = document.createElement("canvas"); dst.width = dst.height = 32; const dx = dst.getContext("2d");
    E.setSource(src); E.renderTo(dx, stagesFor(), { dose: 1, stable: true });
    const a = sx.getImageData(16, 16, 1, 1).data, c = dx.getImageData(16, 16, 1, 1).data;
    // lo que habría salido recortando a sRGB: leer el mismo píxel P3 como sRGB
    const asSrgb = sx.getImageData(16, 16, 1, 1, { colorSpace: "srgb" }).data;
    // Filtro Vintage (otro motor WebGL), con todos los mandos a 0
    try{ const V = await import("/vintagefilter/engine.js"), S = await import("/vintagefilter/state.js"); const vg = new V.VintageGL(); const st = S.normalize({});
      for(const c of S.CONTROLS) st[c.key] = 0; const r = await vg.renderFull(src, st); const vc = r.getContext("2d").getImageData(16, 16, 1, 1).data;
      out[modo + "_vintage"] = { entrada: [...a], salida: [...vc], dif: Math.max(...[0, 1, 2].map(k => Math.abs(a[k] - vc[k]))), espacioGL: vg.space }; }catch(e){ out[modo + "_vintage"] = { error: String(e.message || e) }; }
    out[modo] = { espacioSrc: sx.getContextAttributes().colorSpace, espacioGL: E.glColorSpace?.(), entrada: [...a], salida: [...c], comoSrgb: [...asSrgb], dif: Math.max(...[0, 1, 2].map(k => Math.abs(a[k] - c[k]))) };
  }
  return out;
});
console.log(JSON.stringify(res));
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
if(!res.p3 || !res.gl) console.log("Sin P3 o sin WebGL2 en este Chromium: prueba omitida");
else{
  chk(res.srgb.dif <= 2, "sRGB: el centro debe salir igual (" + res.srgb.dif + ")");
  chk(res["display-p3"].espacioGL === "display-p3", "el contexto GL no pasó a Display P3");
  chk(res["display-p3"].dif <= 2, "P3: el centro debe salir igual (" + res["display-p3"].dif + ")");
}
if(res.p3 && res.gl){ for(const m of ["srgb", "display-p3"]){ const v = res[m + "_vintage"]; if(!v || v.error){ console.log("Vintage " + m + ": " + (v && v.error)); continue; } chk(v.dif <= 6, "Vintage " + m + ": el centro debe salir ~igual (" + v.dif + ")"); } chk(res["display-p3_vintage"]?.espacioGL === "display-p3", "Vintage: GL en P3"); }
chk(!errs.length, "errores de página: " + errs.join("|"));
await b.close(); srv.close(); console.log(bad ? "p3-webgl: FALLO" : "p3-webgl: OK"); process.exit(bad ? 1 : 0);
