/* Prueba del PSD/PSB de capas: genera un documento con capas, máscara, estilos, modos y ajustes,
   lo exporta desde el editor (layeredPsd) y lo deja en /tmp para leerlo con psd-tools (tests/psd_check.py).
   Uso: node tests/psd.mjs <carpeta_salida> */
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
  const D = await import("/js/core/doc.js"), F = await import("/js/io/professional-formats.js");
  D.newDoc(200, 120, { name:"t" });
  const bg = D.addLayer({ name:"Fondo" }); bg.ctx.fillStyle = "#3366cc"; bg.ctx.fillRect(0, 0, 200, 120);
  const a = D.addLayer({ name:"Rojo" }); a.ctx.fillStyle = "#ff0000"; a.ctx.fillRect(20, 20, 100, 60); a.blend = "linear-burn"; a.opacity = .8;
  a.mask = { canvas:document.createElement("canvas") }; a.mask.canvas.width = 200; a.mask.canvas.height = 120;
  const mx = a.mask.canvas.getContext("2d"); mx.fillStyle = "#000"; mx.fillRect(0, 0, 100, 120);
  a.styles = { shadow:{ enabled:true, color:"#000000", opacity:75, blur:6, x:4, y:4 }, glow:{ enabled:false }, stroke:{ enabled:true, color:"#ffffff", width:3 }, gradient:{ enabled:false } };
  const c = D.addLayer({ name:"Verde" }); c.ctx.fillStyle = "#00ff00"; c.ctx.fillRect(100, 40, 60, 60); c.blend = "pin-light";
  const l = D.addLayer({ name:"Niveles", type:"adjust" }); l.adjustType = "levels"; l.adjustParams = { inLow:10, inHigh:240, gamma:1.2, outLow:0, outHigh:255, channel:"rgb" };
  const inv = D.addLayer({ name:"Invertir", type:"adjust" }); inv.adjustType = "invert"; inv.adjustParams = {}; inv.visible = false;
  const enc = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ""; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  const rd = async blob => { const p = globalThis.agPsd.readPsd(new Uint8Array(await blob.arrayBuffer()), { skipThumbnail:true }); const f = x => x.children.flatMap(c => [c, ...(c.children ? f(c) : [])]); return f(p).map(c => `${c.name}|${c.blendMode}|${!!c.mask}|${Object.keys(c.effects || {}).join("+")}|${c.adjustment?.type || ""}`); };
  const back = { psd:await rd(F.layeredPsd(1)), psb:await rd(F.layeredPsd(1, { psb:true })) };
  const P = await import("/js/core/high-precision-safe.js?v=4"), Q = await import("/js/io/psd16.js");
  const pr = await P.renderPrecisionAdjustmentStack(D.doc.w, D.doc.h, { bits16:true, alpha:false, background:"#ffffff", layersOnly:false, srgb:false });
  const p16 = pr?.data16 ? await enc(Q.psd16(pr.data16)) : null, p16b = pr?.data16 ? await enc(Q.psd16(pr.data16, { psb:true })) : null;
  const probe = pr?.data16 ? Array.from(pr.data16.data.slice(0, 3)).concat([pr.data16.channels, pr.data16.w, pr.data16.h]) : pr?.reason;
  const C = await import("/js/io/compatibility.js");
  await C.openPsd(new File([F.layeredPsd(1, { psb:true })], "t.psb"));
  const reopen = D.doc.layers.map(l => ({ n:l.name, b:l.blend, o:+l.opacity.toFixed(2), t:l.type, adj:l.adjustType, vis:l.visible, st:l.styles ? Object.entries(l.styles).filter(([, v]) => v.enabled).map(([k]) => k).join("+") : "",
    m:l.mask ? [l.mask.canvas.getContext("2d").getImageData(10, 10, 1, 1).data[3], l.mask.canvas.getContext("2d").getImageData(150, 10, 1, 1).data[3]] : null }));
  return { probe, p16, p16b, reopen, back, psd:await enc(F.layeredPsd(1)), psb:await enc(F.layeredPsd(1, { psb:true })), psd2:await enc(F.layeredPsd(2)) };
});
for(const k of ["psd", "psb", "psd2"]) fs.writeFileSync(path.join(out, `t.${k === "psd2" ? "x2.psd" : k}`), Buffer.from(res[k], "base64"));
console.log("relectura ag-psd (PSB):", res.back.psb.join(" ; "));
if(JSON.stringify(res.back.psd) !== JSON.stringify(res.back.psb)) { console.log("FALLO: PSD y PSB difieren"); process.exitCode = 1; }
const R = Object.fromEntries(res.reopen.map(x => [x.n, x]));
const ok = (c, m) => { if(!c){ console.log("FALLO:", m); process.exitCode = 1; } };
ok(R["Rojo"].b === "linear-burn" && R["Rojo"].o === .8, "Rojo modo/opacidad al reabrir");
ok(R["Rojo"].m && R["Rojo"].m[0] === 255 && R["Rojo"].m[1] === 0, "máscara de Rojo al reabrir " + JSON.stringify(R["Rojo"].m));
ok(R["Rojo"].st === "shadow+stroke", "estilos de Rojo al reabrir: " + R["Rojo"].st);
ok(R["Verde"].b === "pin-light", "modo de Verde");
ok(R["Niveles"].t === "adjust" && R["Niveles"].adj === "levels", "Niveles como ajuste");
ok(R["Invertir"].adj === "invert" && !R["Invertir"].vis, "Invertir oculto");
console.log("reabierto:", JSON.stringify(res.reopen.map(x => x.n + ":" + x.b + (x.adj ? ":" + x.adj : ""))));
console.log("16 bits (primer píxel, canales, w, h):", JSON.stringify(res.probe));
if(res.p16){ fs.writeFileSync(path.join(out, "t16.psd"), Buffer.from(res.p16, "base64")); fs.writeFileSync(path.join(out, "t16.psb"), Buffer.from(res.p16b, "base64")); }
else { console.log("FALLO: sin datos de 16 bits"); process.exitCode = 1; }
console.log("errores de página:", errs.length ? errs : "ninguno");
await b.close(); srv.close();
