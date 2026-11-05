/* ═════════════════════════════════════════════════
   PRUEBA CON FOTOS REALES Y MODELOS REALES · Pincel inteligente (MobileSAM)
   Abre una foto de la carpeta REALIFY_FOTOS (por defecto /tmp/claude-0/fotos), pinta un trazo sobre un objeto y comprueba que la
   selección resultante cubre el objeto sin desbordarse. Uso: REALIFY_FOTOS=carpeta node tests/ia/reales/sam.mjs [foto.jpg x y x2 y2]
   (coordenadas relativas 0-1 del trazo). Sin la carpeta o sin la foto, se salta.
   ═════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { abrir } from "../lib/navegador.mjs";

const dir = process.env.REALIFY_FOTOS || "/tmp/claude-0/fotos", [foto = "dog.jpg", ax = "0.5", ay = "0.6", bx = "0.5", by = "0.75"] = process.argv.slice(2);
if (!fs.existsSync(path.join(dir, foto))) { console.log("sam (real): sin foto, se salta"); process.exit(0); }
const m = await abrir("escritorio"); let fallos = 0; const ok = (c, t) => { if (!c) { fallos++; console.log("FALLO:", t); } };
const url = "data:image/jpeg;base64," + fs.readFileSync(path.join(dir, foto)).toString("base64");
await m.page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const D = await import("/js/core/doc.js"); D.newDoc(img.naturalWidth, img.naturalHeight, { name: "real", fill: "#fff" }); D.doc.layers[0].ctx.drawImage(img, 0, 0); }, url);
await m.page.evaluate(async () => { const C = await import("/js/core/commands.js"); window.__p = C.run("ai.smartBrush"); });
await m.page.waitForSelector(".sam-tool", { timeout: 30000 });
const t0 = Date.now();
await m.page.waitForFunction(() => !/Analizando/.test(document.querySelector(".sam-tool")?.textContent || "Analizando"), null, { timeout: 240000 }).catch(() => ok(false, "SAM no terminó de analizar"));
console.log("análisis:", ((Date.now() - t0) / 1000).toFixed(1), "s");
const box = await m.page.evaluate(() => { const c = document.querySelector(".sam-tool canvas"); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await m.page.screenshot({ path: "/tmp/claude-0/sam-antes.png" });
const P = (fx, fy) => [box.x + box.w * fx, box.y + box.h * fy];
const [x0, y0] = P(+ax, +ay), [x1, y1] = P(+bx, +by);
await m.page.mouse.move(x0, y0); await m.page.mouse.down();
for (let i = 1; i <= 8; i++) await m.page.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8);
await m.page.mouse.up();
await m.page.waitForFunction(() => { const b = [...document.querySelectorAll(".sam-tool button")].find(x => /Seleccionar/.test(x.textContent)); return b && !b.disabled; }, null, { timeout: 120000 }).catch(() => ok(false, "no se calculó la máscara"));
await m.page.screenshot({ path: "/tmp/claude-0/sam-mascara.png" });
await m.page.evaluate(() => [...document.querySelectorAll(".sam-tool button")].find(x => /Seleccionar/.test(x.textContent)).click());
await m.page.waitForSelector(".sam-tool", { state: "detached", timeout: 120000 }).catch(() => ok(false, "la ventana no se cerró"));
const r = await m.page.evaluate(async () => { const S = await import("/js/editor/selection/selection.js"), D = await import("/js/core/doc.js"); const b = S.boundsOf ? S.boundsOf(D.doc.selection) : null; return { hay: !!D.doc.selection, b, w: D.doc.w, h: D.doc.h }; });
console.log("selección:", JSON.stringify(r));
ok(r.hay, "no hay selección");
ok(m.errs.length === 0, "errores: " + m.errs.join("; "));
await m.cerrar(); console.log(fallos ? "sam (real): FALLO" : "sam (real): OK"); process.exit(fallos ? 1 : 0);
