/* PSD: texto editable, objeto inteligente, «Fusionar si» y ajustes (exposición, blanco y negro, tono, brillo). Uso: node tests/psd-extras.mjs <carpeta> */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), out = process.argv[2] || "/tmp";
let chromium; for(const s of ["playwright","/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".wasm":"application/wasm", ".png":"image/png" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type":T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(), page = await b.newPage(); const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const D = await import("/js/core/doc.js"), F = await import("/js/io/professional-formats.js"), C = await import("/js/io/compatibility.js"), S = await import("/js/editor/smartobject.js"), X = await import("/js/editor/text.js");
  D.newDoc(300, 200, { name:"t" });
  const bg = D.addLayer({ name:"Fondo" }); bg.ctx.fillStyle = "#808080"; bg.ctx.fillRect(0, 0, 300, 200);
  const sm = D.addLayer({ name:"Objeto" }); sm.ctx.fillStyle = "#ff8800"; sm.ctx.fillRect(40, 40, 80, 50); S.convertToSmart(sm);
  sm.smartTransform = { mode:"free", sx:1.2, sy:0.8, angle:0.5, skewX:0.1, skewY:0, tx:30, ty:10, flipH:false, flipV:false };     // con giro, escala y sesgo
  const sm2 = D.addLayer({ name:"Objeto volteado" }); sm2.ctx.fillStyle = "#22aa55"; sm2.ctx.fillRect(200, 100, 60, 40); S.convertToSmart(sm2);
  sm2.smartTransform = { mode:"free", sx:1, sy:1.5, angle:-0.3, skewX:0, skewY:0, tx:-20, ty:5, flipH:false, flipV:true };
  const bc = D.addLayer({ name:"FusionCanal" }); bc.ctx.fillStyle = "#cc3366"; bc.ctx.fillRect(10, 120, 80, 60);
  bc.blendIf = { thisLayer:{ blackMin:0, blackMax:0, whiteMin:255, whiteMax:255 }, underlying:{ blackMin:0, blackMax:0, whiteMin:255, whiteMax:255 }, channels:{ g:{ thisLayer:{ blackMin:10, blackMax:30, whiteMin:200, whiteMax:230 }, underlying:{ blackMin:0, blackMax:0, whiteMin:255, whiteMax:255 } }, b:{ thisLayer:{ blackMin:0, blackMax:0, whiteMin:255, whiteMax:255 }, underlying:{ blackMin:5, blackMax:5, whiteMin:250, whiteMax:250 } } } };
  const bi = D.addLayer({ name:"Fusion" }); bi.ctx.fillStyle = "#00aaff"; bi.ctx.fillRect(150, 50, 100, 80); bi.blendIf = { thisLayer:{ blackMin:20, blackMax:40, whiteMin:220, whiteMax:240 }, underlying:{ blackMin:0, blackMax:0, whiteMin:255, whiteMax:255 } };
  const tl = D.addLayer({ name:"Texto", type:"text" }); tl.text = { ...X.defaultText(), content:"Hola Realify", x:150, y:150, size:30, color:"#ff0000", align:"center" }; X.renderTextLayer(tl);
  const tb = D.addLayer({ name:"Parrafo", type:"text" }); tb.text = { ...X.defaultText(), content:"Texto de párrafo largo que se ajusta al marco", x:200, y:60, size:16, color:"#003366", align:"left", boxW:120, boxH:60, angle:20, weight:700, italic:true, font:"Georgia, 'Times New Roman', 'Noto Serif', serif", tracking:1, lineHeight:1.4, strokeWidth:1, strokeColor:"#ffffff" }; X.renderTextLayer(tb);
  const tc = D.addLayer({ name:"Circular", type:"text" }); tc.text = { ...X.defaultText(), content:"En círculo", circle:true, x:100, y:100, size:20 }; X.renderTextLayer(tc);
  const mk = (n, t, p) => { const l = D.addLayer({ name:n, type:"adjust" }); l.adjustType = t; l.adjustParams = p; return l; };
  mk("Exposición", "exposure", { ev:1.5 }); mk("BN", "gray", {}); mk("Tono", "hsl", { hue:30, sat:20, light:-10, colorize:false }); mk("BC", "bc", { brightness:10, contrast:20 }); mk("WB", "wb", { temp:30, tint:-10 });
  const smart = await F.smartLinked();
  const u8 = new Uint8Array(await F.layeredPsd(1, { smart }).arrayBuffer());
  let s = ""; for(let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192));
  const P = await import("/js/core/high-precision-safe.js?v=4");
  const pr = await P.renderPrecisionAdjustmentStack(D.doc.w, D.doc.h, { bits16:true, alpha:false, background:"#ffffff", layersOnly:false, srgb:false });
  const u16 = new Uint8Array(await F.layeredPsd(1, { hi:{ composite:pr.data16 }, smart }).arrayBuffer());
  let s16 = ""; for(let i = 0; i < u16.length; i += 8192) s16 += String.fromCharCode(...u16.subarray(i, i + 8192));
  await C.openPsd(new File([u16], "t16.psd"));
  const re16 = D.doc.layers.map(l => l.name + ":" + (l.adjustType || l.type) + (l.smart ? ":smart" : "") + (l.blendIf ? ":bi" : "") + (l.hiSrc ? ":16" : ""));
  await C.openPsd(new File([u8], "t.psd"));
  const re = D.doc.layers.map(l => ({ n:l.name, t:l.type, adj:l.adjustType, smart:l.smart, box:l.smartBox, st:l.smartTransform, bi:l.blendIf, text:l.text && l.text.content, size:l.text && l.text.size, tx:l.text && { boxW:l.text.boxW, boxH:l.text.boxH, angle:l.text.angle, weight:l.text.weight, italic:l.text.italic, font:l.text.font, tracking:l.text.tracking, lh:l.text.lineHeight, sw:l.text.strokeWidth }, ptype:l.type }));
  return { psd:btoa(s), psd16:btoa(s16), re16, re, smartN:smart.size };
});
fs.writeFileSync(path.join(out, "extras.psd"), Buffer.from(res.psd, "base64")); fs.writeFileSync(path.join(out, "extras16.psd"), Buffer.from(res.psd16, "base64"));
ok16: { const j = res.re16.join(" "); if(!/Objeto:raster:smart/.test(j) || !/Fusion:raster:bi:16/.test(j) || !/Texto:text/.test(j) || !/Exposición:exposure/.test(j)){ console.log("FALLO: 16 bits al reabrir", j); process.exitCode = 1; } }
const R = Object.fromEntries(res.re.map(x => [x.n, x])), ok = (c, m) => { if(!c){ console.log("FALLO:", m); process.exitCode = 1; } };
ok(res.smartN === 2, "objetos inteligentes preparados " + res.smartN);
ok(R["Objeto"]?.smart && R["Objeto"].box && Math.abs(R["Objeto"].box.w - 80) <= 1, "objeto inteligente al reabrir " + JSON.stringify(R["Objeto"]));
ok(R["Fusion"]?.bi?.thisLayer.blackMax === 40 && R["Fusion"].bi.thisLayer.whiteMin === 220, "Fusionar si al reabrir " + JSON.stringify(R["Fusion"]?.bi));
const near = (a, b, e) => Math.abs(a - b) <= e;
{ const o = R["Objeto"]?.st; ok(o && near(o.angle, 0.5, 0.01) && near(o.sx, 1.2, 0.01) && near(o.sy, 0.8, 0.01) && near(o.skewX, 0.1, 0.01) && !o.flipV, "objeto con giro/escala/sesgo " + JSON.stringify(o)); }
{ const o = R["Objeto volteado"]?.st; ok(o && near(o.angle, -0.3, 0.01) && near(o.sy, 1.5, 0.01) && o.flipV, "objeto con giro y volteo " + JSON.stringify(o)); }
{ const c = R["FusionCanal"]?.bi; ok(c && c.channels && c.channels.g.thisLayer.blackMax === 30 && c.channels.g.thisLayer.whiteMin === 200 && c.channels.b.underlying.blackMin === 5 && !c.channels.r, "Fusionar si por canal " + JSON.stringify(c)); }
{ const t = R["Parrafo"]; ok(t && t.t === "text" && t.tx.boxW === 120 && t.tx.boxH === 60 && near(t.tx.angle, 20, 0.2) && t.tx.weight === 700 && t.tx.italic && /Georgia/.test(t.tx.font) && near(t.tx.tracking, 1, 0.3) && near(t.tx.lh, 1.4, 0.05) && t.tx.sw >= 1, "texto de párrafo " + JSON.stringify(t)); }
ok(R["WB"]?.adj === "wb", "balance de blancos de vuelta como wb " + JSON.stringify(R["WB"]));
ok(R["Circular"]?.t !== "text", "texto en círculo se queda rasterizado");
ok(R["Texto"]?.t === "text" && R["Texto"].text === "Hola Realify" && R["Texto"].size === 30, "texto al reabrir " + JSON.stringify(R["Texto"]));
ok(R["Exposición"]?.adj === "exposure" && R["BN"]?.adj === "gray" && R["Tono"]?.adj === "hsl" && R["BC"]?.adj === "bc", "ajustes al reabrir " + JSON.stringify(res.re.map(x => x.adj)));
console.log("reabierto:", JSON.stringify(res.re.map(x => x.n + ":" + (x.adj || x.t))));
console.log("errores de página:", errs.length ? errs : "ninguno");
await b.close(); srv.close();
