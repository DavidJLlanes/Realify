/* ═════════════════════════════════════════════════
   PRUEBA CON FOTOS REALES Y MODELOS REALES · funciones de diálogo simple
   Para cada (comando, foto) de la carpeta REALIFY_FOTOS (por defecto /tmp/claude-0/fotos): abre la foto, ejecuta la función, acepta el aviso
   de descarga del modelo (se sirve en local), pulsa el botón principal y mide si salió una capa nueva y cuánto cambió respecto a la foto.
   Guarda capturas en REALIFY_SALIDA (por defecto /tmp/claude-0/reales). Uso: node tests/ia/reales/funciones.mjs [cmd[:foto] …]
   ═════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { abrir } from "../lib/navegador.mjs";

const dir = process.env.REALIFY_FOTOS || "/tmp/claude-0/fotos", sal = process.env.REALIFY_SALIDA || "/tmp/claude-0/reales";
fs.mkdirSync(sal, { recursive: true });
const POR_DEFECTO = ["ai.skyEnhance:building.jpg", "ai.dehaze:building.jpg", "ai.categoryBoost:building.jpg:tipo=follaje", "ai.categoryBoost:building.jpg:tipo=cielo", "ai.categoryBoost:building.jpg:tipo=edificios", "ai.depthChroma:home.jpg", "ai.depthRelight:home.jpg", "ai.harmonize:zidane.jpg",
  "ai.textPlacement:zidane.jpg", "ai.skinTexture:zidane.jpg", "ai.skinEven:zidane.jpg", "ai.aiArtifacts:bus.jpg", "ai.smoothZones:building.jpg", "ai.zonedWhiteBalance:building.jpg"];
const lista = process.argv.length > 2 ? process.argv.slice(2) : POR_DEFECTO;
let fallos = 0; const resumen = [];

for (const par of lista) {
  const [cmd, foto, extra] = par.split(":"), f = path.join(dir, foto);
  if (!fs.existsSync(f)) { console.log(par, "· sin foto, se salta"); continue; }
  const m = await abrir("escritorio"), t0 = Date.now();
  try {
    await m.page.evaluate(() => setInterval(() => { const b = [...document.querySelectorAll(".modal button")].find(x => x.textContent.trim() === "Descargar"); if (b) b.click(); }, 300));
    await m.page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "real", fill: "#fff" }); D.doc.layers[0].ctx.drawImage(img, 0, 0); }, "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64"));
    const n = await m.page.evaluate(async () => (await import("/js/core/doc.js")).doc.layers.length);
    await m.page.evaluate(async c => { const C = await import("/js/core/commands.js"); window.__p = Promise.resolve(C.run(c)).catch(e => { window.__err = String(e && e.message || e); }); }, cmd);
    await m.page.waitForSelector(".modal", { timeout: 60000 });
    if (extra) { const [k, v] = extra.split("="); await m.page.selectOption(`.modal select:has(option[value="${v}"])`, v); }
    const boton = await m.page.evaluate(() => [...document.querySelectorAll(".modal-foot button")].map(b => b.textContent.trim()));
    await m.page.click(".modal-foot button.primary");
    const fin = await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"); for (let i = 0; i < 6000; i++) { if (D.doc.layers.length > n) return "capa"; if (document.querySelector(".modal .metric")) return "informe"; if (window.__err) return "error: " + window.__err; const tt = document.getElementById("toast")?.textContent || ""; if (/No se pudo|Error|error/.test(tt)) return "error: " + tt; if (/No he encontrado|No hay /.test(tt)) return "aviso: " + tt; await new Promise(r => setTimeout(r, 100)); } return "tiempo"; }, n);
    await m.page.waitForTimeout(500);
    const r = await m.page.evaluate(async n => { const D = await import("/js/core/doc.js"), L = D.doc.layers, W = D.doc.w, H = D.doc.h;
      if (L.length <= n) return { texto: document.querySelector(".modal-body")?.innerText?.slice(0, 600) || "" };
      const a = L[L.length - 1], base = L[0].ctx.getImageData(0, 0, W, H).data, x = a.ctx.getImageData(0, 0, W, H).data; let dif = 0, cub = 0, k = 0;
      for (let i = 0; i < x.length; i += 16) { k++; if (x[i + 3] > 20) { cub++; dif += Math.abs(x[i] - base[i]) + Math.abs(x[i + 1] - base[i + 1]) + Math.abs(x[i + 2] - base[i + 2]); } }
      return { capa: a.name, cobertura: +(cub / k).toFixed(3), difMedia: +(dif / Math.max(1, cub) / 3).toFixed(2) }; }, n);
    const seg = ((Date.now() - t0) / 1000).toFixed(0);
    await m.page.screenshot({ path: path.join(sal, cmd.replace("ai.", "") + (extra ? "-" + extra.split("=")[1] : "") + "-" + foto.replace(".jpg", "") + ".png") });
    const linea = `${cmd} · ${foto} · ${fin} · ${seg}s · ${JSON.stringify(r)}`; console.log(linea); resumen.push(linea);
    if (fin === "tiempo" || fin.startsWith("error")) fallos++;
    if (m.errs.length) { console.log("  errores de página:", m.errs.slice(0, 3).join(" | ").slice(0, 400)); fallos++; }
  } catch (e) { console.log(par, "· FALLO:", String(e.message).split("\n")[0]); fallos++; }
  await m.cerrar();
}
console.log(fallos ? "reales: FALLO" : "reales: OK"); process.exit(fallos ? 1 : 0);
