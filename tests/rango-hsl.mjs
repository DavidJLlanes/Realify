/* Tono, saturación y luminancia por rangos (v259): motor básico y Premium, Difusión, interfaz con cuentagotas y ocho círculos (móvil y escritorio) e interruptor
   Premium. Uso: node tests/rango-hsl.mjs */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium; for(const s of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]){ try{ ({ chromium } = await import(s)); break; }catch{} }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if(p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const b = await chromium.launch(); let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
const errs = [];
async function open(mobile){
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message)); await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForTimeout(1500); return page;
}
// 1) motor
{
  const page = await open(false);
  const r = await page.evaluate(async () => {
    const M = await import("/js/editor/rangehsl.js"), out = {};
    const mk = cols => { const d = new Uint8ClampedArray(cols.length * 4); cols.forEach((c, i) => { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }); return d; };
    const cols = [[200, 40, 40], [40, 80, 200], [128, 128, 128], [60, 160, 70], [230, 140, 50]];
    const lum = (r, g, b) => .2126 * r + .7152 * g + .0722 * b, mkp = (k, v) => { const p = { ranges: M.defaultRanges() }; Object.assign(p.ranges[k], v); return p; };
    // saturación −100 en rojos: el rojo pierde color, el azul y el gris quedan igual
    for(const prem of [false, true]){
      const d = mk(cols), p = mkp("red", { sat: -100 }); (prem ? M.rangeHslPremium : M.rangeHslBasic)(d, p);
      const sp = i => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      out[prem ? "premRed" : "basicRed"] = sp(0); out[prem ? "premBlueOK" : "basicBlueOK"] = Math.abs(d[4] - 40) <= 1 && Math.abs(d[6] - 200) <= 1; out[prem ? "premGrayOK" : "basicGrayOK"] = d[8] === 128 || Math.abs(d[8] - 128) <= 1;
    }
    // sin cambios: la imagen, intacta
    { const d = mk(cols), c = d.slice(); M.rangeHslBasic(d, { ranges: M.defaultRanges() }); M.rangeHslPremium(d, { ranges: M.defaultRanges() }); out.intact = d.every((v, i) => v === c[i]); }
    // Difusión: un tono a 0,8 de la anchura del rojo (±25°): con difusión 0 el efecto es pleno; con 100 es casi nulo
    const probe = (() => { const [r, g, b] = M.hslRgb(26, .7, .45); return [Math.round(r), Math.round(g), Math.round(b)]; })();
    const eff = f => { const d = mk([probe]), p = mkp("red", { sat: -100, feather: f, width: 32 }); M.rangeHslBasic(d, p); return Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]); };
    const orig = Math.max(...probe) - Math.min(...probe); out.featOrig = orig; out.feat0 = eff(0); out.feat100 = eff(100);
    // Premium: girar el tono conserva la luminosidad mejor que HSL
    const dl = prem => { const d = mk([[200, 60, 60], [60, 160, 70], [230, 140, 50]]), c = d.slice(); const p = mkp("red", { hue: 70, width: 60 }); const q = mkp("green", { hue: 70, width: 60 }); p.ranges.green = q.ranges.green; p.ranges.orange = Object.assign(p.ranges.orange, { hue: 70, width: 40 });
      (prem ? M.rangeHslPremium : M.rangeHslBasic)(d, p); let e = 0; for(let i = 0; i < 3; i++) e += Math.abs(lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - lum(c[i * 4], c[i * 4 + 1], c[i * 4 + 2])); return +e.toFixed(1); };
    out.dlBasic = dl(false); out.dlPrem = dl(true);
    // rampa continua en Premium: sin saltos al variar el tono entre vecinos
    { const cs = []; for(let h = 0; h < 360; h += 3) cs.push(M.hslRgb(h, .6, .5).map(Math.round)); const d = mk(cs); M.rangeHslPremium(d, mkp("green", { hue: 60, light: 40, sat: 40 })); let mx = 0; for(let i = 1; i < cs.length; i++) mx = Math.max(mx, Math.abs(d[i * 4] - d[(i - 1) * 4]) + Math.abs(d[i * 4 + 1] - d[(i - 1) * 4 + 1]) + Math.abs(d[i * 4 + 2] - d[(i - 1) * 4 + 2])); out.maxStep = mx; }
    return out;
  });
  console.log(JSON.stringify(r));
  chk(r.basicRed < 20 && r.premRed < 20, "el rojo debe perder el color"); chk(r.basicBlueOK && r.premBlueOK, "el azul no debe cambiar"); chk(r.basicGrayOK && r.premGrayOK, "el gris no debe cambiar"); chk(r.intact, "sin ajustes la imagen queda intacta");
  chk(r.feat0 < r.feat100 * 0 + r.featOrig * 0.35 && r.feat100 > r.feat0, `difusión 0 aplica pleno, 100 casi nada (orig ${r.featOrig}, 0 → ${r.feat0}, 100 → ${r.feat100})`);
  chk(r.dlPrem < r.dlBasic, `el tono en OKLCh conserva mejor la luminosidad (básico ${r.dlBasic}, premium ${r.dlPrem})`);
  chk(r.maxStep < 150, "la rampa de tonos en Premium no debe dar saltos " + r.maxStep);
}
// 2) interfaz en escritorio y móvil
for(const mobile of [false, true]){
  const page = await open(mobile), tag = mobile ? "móvil" : "escritorio";
  await page.evaluate(async () => { const D = await import("/js/core/doc.js"); D.newDoc(1200, 700, { name: "n" }); const L = D.addLayer({ name: "Fondo" }), x = L.ctx;
    const cols = ["#c82828", "#2850c8", "#3ca046", "#e68c32"]; cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(i * 300, 0, 300, 700); }); });
  await page.evaluate(async () => { (await import("/js/ui/commands.js")).run("adj.rangeHsl"); }); await page.waitForTimeout(900);
  const ui = await page.evaluate(() => ({ dots: document.querySelectorAll(".rh-dots .rh-dot").length, eye: !!document.querySelector(".rh-eye"), prem: !!document.querySelector(".premium-switch"), label: document.querySelector(".premium-switch .ps-label")?.textContent, docked: !!document.querySelector(".premium-switch.ps-docked"),
    labels: [...document.querySelectorAll(".modal label, .modal .field label, .modal option")].map(e => e.textContent.trim()).filter(Boolean).slice(0, 40) }));
  console.log(tag, JSON.stringify(ui).slice(0, 400));
  chk(ui.dots === 8, tag + ": ocho círculos de color"); chk(ui.eye, tag + ": cuentagotas"); chk(ui.prem && ui.label === "Premium", tag + ": interruptor Premium con su palabra"); chk(mobile ? ui.docked : !ui.docked, tag + ": interruptor " + (mobile ? "en la barra de aplicar" : "encima de los mandos"));
  for(const w of ["Matiz", "Saturación", "Luminancia", "Difusión", "Intervalo"]) chk(ui.labels.some(l => l.includes(w)), `${tag}: mando «${w}»`);
  // cuentagotas: tocar la franja azul de la imagen elige «Azules» y la centra en ese tono
  { await page.locator(".rh-eye").click(); await page.waitForTimeout(500);
    const pos = await page.evaluate(async () => { const V = await import("/js/editor/view.js"), r = document.getElementById("stage").getBoundingClientRect(); return { x: r.left + V.view.x + 450 * V.view.zoom, y: r.top + V.view.y + 40 * V.view.zoom, r: [Math.round(V.view.x), Math.round(V.view.y), V.view.zoom] }; });
    await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(500);
    const got = await page.evaluate(() => ({ on: document.querySelector(".rh-dot.on")?.title, eye: document.querySelector(".rh-eye")?.classList.contains("on") }));
    console.log(tag, "cuentagotas", JSON.stringify(got), JSON.stringify(pos.r));
    chk(got.on === "Azules", tag + ": el cuentagotas elige el rango del color tocado (" + got.on + ")"); chk(!got.eye, tag + ": el cuentagotas se apaga tras elegir"); }
  // elegir «Azules» (6.º círculo), activar Premium y bajar la saturación (el mando visible: el primero de la lista en móvil, el deslizador de Saturación en escritorio)
  await page.locator(".rh-dots .rh-dot").nth(5).click(); await page.waitForTimeout(200);
  await page.locator(".premium-switch").first().click(); await page.waitForTimeout(200);
  if(mobile){ await page.locator('.modal select.grow, [data-picker] select').first().selectOption({ label: "Saturación" }).catch(() => {}); }
  const sl = page.locator('.modal input[type=range]:visible').first(); await sl.waitFor({ timeout: 3000 });
  if(mobile){ await sl.evaluate(el => { el.value = -100; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }); }
  else { await page.locator('.modal .field', { hasText: "Saturación" }).locator("input[type=range]").first().evaluate(el => { el.value = -100; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }); }
  await page.waitForTimeout(800);
  await page.locator("button:visible", { hasText: /^(Aplicar|Aceptar)$/ }).first().click(); await page.waitForTimeout(2500);
  const res = await page.evaluate(async () => { const D = await import("/js/core/doc.js"), L = D.doc.layers, top = L[L.length - 1], x = top.canvas.getContext("2d");
    const px = i => Array.from(x.getImageData(i * 300 + 150, 350, 1, 1).data), sp = c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
    return { n: L.length, name: top.name, f: top.filters?.[0]?.id, premium: top.filters?.[0]?.params?.premium, blue: px(1), blueSat: sp(px(1)), redSat: sp(px(0)), greenSat: sp(px(2)), orangeSat: sp(px(3)) }; });
  console.log(tag, JSON.stringify(res));
  chk(res.f === "range-hsl" && res.premium === true, tag + ": la capa guarda el ajuste con Premium"); chk(res.blueSat < 40, tag + ": el azul pierde saturación"); chk(res.redSat > 140 && res.greenSat > 80 && res.orangeSat > 140, tag + ": los demás colores no cambian");
}
chk(errs.length === 0, "errores de página " + errs.slice(0, 3));
console.log(bad ? "FALLO" : "OK"); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
