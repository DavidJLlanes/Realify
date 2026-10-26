/* Prueba de humo de Realify (solo lectura sobre la web que se prueba).
     PW_CORE=<carpeta con playwright-core> node smoke.mjs --root <web> --label <nombre> [--modules modules.copia.json] [--out baseline]
   Sirve la web en local, la abre en Chromium sin ventana y registra: huella de comandos/herramientas/menús,
   resultado de una secuencia de comandos sobre una imagen fija, apertura de cada diálogo y plugin,
   recorrido de herramientas, capturas de pantalla (escritorio y móvil) y métricas de arranque en frío. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { serve } from "./lib/server.mjs";
import { commandCandidates } from "./lib/scan.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg("root", ""));
const LABEL = arg("label", "web");
const MODS = JSON.parse(fs.readFileSync(path.resolve(here, arg("modules", "modules.copia.json")), "utf8"));
const OUT = path.resolve(here, arg("out", "baseline"));
const PERF_RUNS = +arg("perf", 3);
/* Las dependencias de desarrollo (npm install en la raíz del proyecto) están en ../../node_modules; PW_CORE permite usar otra carpeta. */
process.env.PW_CORE ||= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { chromium } = createRequire(path.join(process.env.PW_CORE, "x.js"))("playwright-core");
/* Navegador: CHROME_EXE, o el Chromium de esta máquina si existe, o el que instala «npx playwright install chromium». */
const LOCAL_CHROME = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe");
const CHROME = process.env.CHROME_EXE || (LOCAL_CHROME && fs.existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const IMAGE = path.join(ROOT, "assets", "og-image-1200x630.png");


/* Archivos de prueba para los formatos que usan librerías de terceros (UTIF, ag-psd). Se fabrican aquí, byte a byte. */
const pixelOf = (x, y) => [(x * 4) & 255, (y * 5) & 255, ((x + y) * 2) & 255];
function makeTiff(w, h) {
  const n = 10, ifdLen = 2 + n * 12 + 4, bpsAt = 8 + ifdLen, dataAt = bpsAt + 6;
  const b = Buffer.alloc(dataAt + w * h * 3);
  b.write("II", 0, "latin1"); b.writeUInt16LE(42, 2); b.writeUInt32LE(8, 4);
  b.writeUInt16LE(n, 8);
  const ent = (i, tag, type, count, value) => { const o = 10 + i * 12; b.writeUInt16LE(tag, o); b.writeUInt16LE(type, o + 2); b.writeUInt32LE(count, o + 4); if (type === 3 && count === 1) b.writeUInt16LE(value, o + 8); else b.writeUInt32LE(value, o + 8); };
  ent(0, 256, 4, 1, w); ent(1, 257, 4, 1, h); ent(2, 258, 3, 3, bpsAt); ent(3, 259, 3, 1, 1); ent(4, 262, 3, 1, 2);
  ent(5, 273, 4, 1, dataAt); ent(6, 277, 3, 1, 3); ent(7, 278, 4, 1, h); ent(8, 279, 4, 1, w * h * 3); ent(9, 284, 3, 1, 1);
  for (let i = 0; i < 3; i++) b.writeUInt16LE(8, bpsAt + i * 2);
  let o = dataAt; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (const v of pixelOf(x, y)) b[o++] = v;
  return b;
}
function makePsd(w, h) {
  const head = Buffer.alloc(26 + 12 + 2);
  head.write("8BPS", 0, "latin1"); head.writeUInt16BE(1, 4); head.writeUInt16BE(3, 12); head.writeUInt32BE(h, 14); head.writeUInt32BE(w, 18); head.writeUInt16BE(8, 22); head.writeUInt16BE(3, 24);
  /* longitudes de «datos de modo de color», «recursos de imagen» y «capas y máscaras» = 0, y compresión 0 (sin comprimir) */
  const planes = Buffer.alloc(w * h * 3);
  for (let c = 0; c < 3; c++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) planes[c * w * h + y * w + x] = pixelOf(x, y)[c];
  return Buffer.concat([head, planes]);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = buf => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
const norm = s => String(s).replace(/127\.0\.0\.1:\d+/g, "HOST").replace(/\s+/g, " ").trim().slice(0, 300);
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

const { server, port } = await serve(ROOT);
const BASE = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}), headless: true,
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--disable-background-timer-throttling", "--force-color-profile=srgb"]
});
fs.mkdirSync(path.join(OUT, "screens"), { recursive: true });

async function open(kind) {
  const ctx = await browser.newContext(kind === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" }
    : { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("realify.onboarded.v1", "1"); localStorage.setItem("realify.landscapeOk", "1"); localStorage.setItem("realify.compatSeen", "1"); localStorage.setItem("realify.cookieConsent", "1"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = new Set();
  page.on("console", m => { if (m.type() === "error") errors.add("console: " + norm(m.text())); });
  page.on("pageerror", e => errors.add("pageerror: " + norm(e.message)));
  page.on("requestfailed", r => errors.add("requestfailed: " + norm(r.url()) + " " + (r.failure()?.errorText || "")));
  page.on("response", r => { if (r.status() >= 400) errors.add(`http ${r.status()}: ` + norm(r.url())); });
  return { ctx, page, errors };
}

async function coldStart(kind) {
  const { ctx, page, errors } = await open(kind);
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__realifyReady === true, null, { timeout: 90000 });
  const readyMs = Date.now() - t0;
  const res = await page.evaluate(() => {
    const e = performance.getEntriesByType("resource");
    const by = t => e.filter(x => x.name.split("?")[0].endsWith(t));
    const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);
    const js = e.filter(x => /\.m?js(\?|$)/.test(x.name)), css = by(".css");
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByType("paint").find(p => p.name === "first-contentful-paint");
    return { requests: e.length, jsRequests: js.length, cssRequests: css.length, jsBytes: sum(js, "decodedBodySize"), cssBytes: sum(css, "decodedBodySize"),
             transferBytes: sum(e, "transferSize"), domContentLoaded: Math.round(nav.domContentLoadedEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null };
  });
  return { ctx, page, errors, perf: { readyMs, ...res } };
}

async function shot(page, name) {
  await sleep(2800);   // deja que se apaguen los avisos temporales
  const buf = await page.screenshot({ animations: "disabled" });
  fs.writeFileSync(path.join(OUT, "screens", `${LABEL}-${name}.png`), buf);
  return sha(buf);
}

const mod = k => "/" + MODS[k];
async function until(page, fn, arg, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await page.evaluate(fn, arg).catch(() => false)) return true; await sleep(120); }
  return false;
}
const docState = (page, docPath) => page.evaluate(async p => {
  const { doc } = await import(p);
  if (!doc.open) return { open: false };
  const l = doc.layers.find(x => x.id === doc.activeId);
  let hash = null;
  if (l) {
    const d = l.canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, l.canvas.width, l.canvas.height).data;
    const h = await crypto.subtle.digest("SHA-256", d.buffer);
    hash = [...new Uint8Array(h)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let selSum = 0;
  if (doc.selection && doc.selection.mask) { const m = doc.selection.mask; for (let i = 0; i < m.length; i += 7) selSum += m[i]; }
  return { open: true, w: doc.w, h: doc.h, layers: doc.layers.length, active: l?.name || null, activeType: l?.type || null, hash, selection: !!doc.selection, selSum };
}, docPath);

async function runCmd(page, id, errors) {
  const before = errors.size;
  await page.evaluate(async ([p, id]) => { (await import(p)).run(id); }, [mod("commands"), id]);
  await sleep(250);
  let prev = JSON.stringify(await docState(page, mod("doc"))), stable = 0;
  for (let i = 0; i < 25 && stable < 2; i++) {
    await sleep(160);
    const cur = JSON.stringify(await docState(page, mod("doc")));
    if (cur === prev) stable++; else { stable = 0; prev = cur; }
  }
  const closed = await closeAll(page);   // p. ej. «Blanco y negro» abre un diálogo: se cierra sin aplicar
  const final = JSON.parse(JSON.stringify(JSON.parse(prev)));
  return { id, ...final, opensDialog: closed !== "none", newErrors: [...errors].slice(before) };
}

/* Un diálogo o plugin abierto es cualquier elemento nuevo, de posición fija, colgado directamente de <body>.
   (Cada plugin usa su propia clase: fsp, cv-editor, rf-editor, vf-editor, raw-developer, fr-root, mm-editor…) */
const IGNORE = "toast|update-bar|ai-busy|cookiebar|tool-flyout|sheetVeil|compositor";
const overlayProbe = `(() => {
  const ig = new RegExp("${IGNORE}", "i");
  return [...document.body.children].filter(e => !window.__b0.has(e) && !ig.test((e.className || "") + " " + (e.id || "")) &&
    ["fixed", "absolute"].includes(getComputedStyle(e).position) && e.tagName !== "SCRIPT");
})()`;
const markBaseline = page => page.evaluate(() => { window.__b0 = new Set(document.body.children); });
const hasOverlay = page => page.evaluate(`${overlayProbe}.length > 0`);

async function closeAll(page) {
  if (!(await hasOverlay(page))) return "none";
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape"); await sleep(300);
    if (!(await hasOverlay(page))) return "escape";
  }
  await page.evaluate(`(() => { const b = ${overlayProbe}.map(e => e.querySelector('.fsp-close, .fsp-cancel, [data-close], [aria-label="Cancelar"], [aria-label="Cerrar"], .modal-foot button')).find(Boolean); if (b) b.click(); })()`);
  await sleep(400);
  if (!(await hasOverlay(page))) return "button";
  await page.evaluate(`${overlayProbe}.forEach(e => e.remove())`);
  return "forced";
}

/* ───────── escritorio ───────── */
const result = { label: LABEL, root: ROOT, generated: new Date().toISOString() };
const perfRuns = [];
const first = await coldStart("desktop");
perfRuns.push(first.perf);
await first.ctx.close().catch(() => {});
for (let i = 1; i < PERF_RUNS; i++) { const c = await coldStart("desktop"); perfRuns.push(c.perf); await c.ctx.close(); }

const D = await coldStart("desktop");
const { page, errors } = D;
const desktop = { loadErrors: [...errors].sort() };
desktop.perf = { runs: perfRuns, medianReadyMs: median(perfRuns.map(r => r.readyMs)), medianTransferBytes: median(perfRuns.map(r => r.transferBytes)) };

const cands = commandCandidates(ROOT);
desktop.vendorAtStart = await page.evaluate(() => ({ heic2any: typeof globalThis.heic2any, UTIF: typeof globalThis.UTIF, agPsd: typeof globalThis.agPsd }));
desktop.fingerprint = await page.evaluate(async ([m, cands]) => {
  const cmds = await import(m.commands), tools = await import(m.tools), menu = await import(m.menu);
  return {
    commands: cands.filter(id => cmds.get(id)).sort(),
    tools: tools.TOOLS.map(t => ({ id: t.id, name: t.name, key: t.key || null, hasDown: typeof t.down === "function" })),
    menus: JSON.parse(JSON.stringify(menu.MENUS))
  };
}, [{ commands: mod("commands"), tools: mod("tools"), menu: mod("menu") }, cands]);
desktop.fingerprint.menuHash = sha(JSON.stringify(desktop.fingerprint.menus));
desktop.screens = { welcome: await shot(page, "desktop-welcome") };

await page.setInputFiles("#filePicker", IMAGE);
desktop.opened = await until(page, async p => (await import(p)).doc.open, mod("doc"), 30000);
await sleep(600);
desktop.afterOpen = await docState(page, mod("doc"));
desktop.screens.withImage = await shot(page, "desktop-image");
await markBaseline(page);

const SEQ = ["layer.duplicate", "adj.invert", "edit.undo", "edit.redo", "image.rotR", "image.rotL", "image.flipH", "image.flipH", "adj.grayscale",
             "edit.undo", "sel.all", "sel.invert", "sel.none", "layer.add", "layer.mergeDown", "view.zoomIn", "view.zoomOut", "view.fit",
             "edit.undo", "edit.undo", "edit.undo"];
desktop.sequence = [];
for (const id of SEQ) desktop.sequence.push(await runCmd(page, id, errors));

const DIALOGS = ["adj.brightness", "adj.levels", "adj.curves", "adj.hsl", "adj.colorBalance", "adj.exposure", "filter.blur", "filter.sharpen", "filter.noise",
  "filter.vignette", "image.resize", "image.canvasSize", "file.export", "file.exportAs", "file.new", "layer.addAdjust", "layer.styles", "snapshot.add",
  "filter.camera", "filter.lens", "filter.looks", "filter.purepixel", "filter.unmark", "filter.cameras", "filter.luts", "filter.vintage", "filter.photoDevelop",
  "filter.frames", "layer.meme", "layer.stickers", "file.socialPost", "image.hdr", "image.merge", "image.panorama", "image.slice", "image.shapeCrop",
  "image.beforeAfter", "file.contactSheet", "actions.open", "file.socialPreview", "help.guide", "help.diag", "help.about", "help.privacy", "an.metrics",
  "an.forensics", "an.spectrum", "an.exif", "an.meta", "an.palette", "view.gridConfig", "edit.levels", "image.docscan", "image.sharpness", "image.stack"];
desktop.dialogs = [];
for (const id of DIALOGS) {
  const before = errors.size;
  await closeAll(page);
  await markBaseline(page);
  await page.evaluate(async ([p, id]) => { (await import(p)).run(id); }, [mod("commands"), id]);
  const opened = await until(page, `${overlayProbe}.length > 0`, null, 12000);
  await sleep(opened ? 900 : 100);
  const info = opened ? await page.evaluate(`(() => {
    const el = ${overlayProbe}[0];
    const t = el.querySelector(".fsp-title b, .modal-head h2, .modal-head h3, .modal-head b, .modal-head, h1, h2, h3");
    return { kind: String(el.className || el.id).split(/\\s+/).filter(Boolean).join("."), title: (t?.textContent || "").trim().slice(0, 80) };
  })()`) : { kind: null, title: null };
  const closed = await closeAll(page);
  desktop.dialogs.push({ id, opened, ...info, closed, newErrors: [...errors].slice(before) });
}

desktop.toolRun = [];
for (const t of desktop.fingerprint.tools) {
  const before = errors.size;
  const cur = await page.evaluate(async ([m, id]) => { const T = await import(m); T.setTool(id); return T.current.id; }, [mod("tools"), t.id]);
  await sleep(150);
  desktop.toolRun.push({ id: t.id, current: cur, newErrors: [...errors].slice(before) });
}
await page.evaluate(async m => (await import(m)).setTool("move"), mod("tools"));

/* ───────── gestos sobre el lienzo, atajos de teclado y zoom ───────── */
await closeAll(page);
const box = await page.locator("#stage").boundingBox();
const CX = box.x + box.width / 2, CY = box.y + box.height / 2;
const P = (dx, dy) => ({ x: Math.round(CX + dx), y: Math.round(CY + dy) });
const mouseDrag = async pts => {
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.up();
};
const mouseClick = async p => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); };
const viewState = () => page.evaluate(async p => { const { view } = await import(p); return { zoom: +view.zoom.toFixed(4), x: Math.round(view.x), y: Math.round(view.y) }; }, mod("view"));
const settle = async () => { await sleep(250); let prev = JSON.stringify(await docState(page, mod("doc"))), n = 0; for (let i = 0; i < 20 && n < 2; i++) { await sleep(140); const c = JSON.stringify(await docState(page, mod("doc"))); if (c === prev) n++; else { n = 0; prev = c; } } };
const setTool = id => page.evaluate(async ([m, id]) => (await import(m)).setTool(id), [mod("tools"), id]);
desktop.gestures = [];
const gesture = async (name, tool, fn) => {
  const before = errors.size;
  if (tool) await setTool(tool);
  await fn();
  await settle();
  desktop.gestures.push({ name, tool, ...(await docState(page, mod("doc"))), view: await viewState(), newErrors: [...errors].slice(before) });
};
await runCmd(page, "layer.add", errors);
await gesture("pincel", "brush", () => mouseDrag([P(-200, -80), P(-120, -20), P(-40, -90), P(40, 10), P(120, -50), P(200, 60)]));
await gesture("borrador", "eraser", () => mouseDrag([P(-100, -60), P(0, -30), P(100, 0)]));
await gesture("degradado", "gradient", () => mouseDrag([P(-250, 100), P(250, 100)]));
await gesture("relleno", "fill", () => mouseClick(P(-280, 120)));
await gesture("forma", "shape", () => mouseDrag([P(-90, -50), P(90, 50)]));
await gesture("selección rectangular", "select-rect", () => mouseDrag([P(-150, -90), P(80, 70)]));
await gesture("selección elíptica", "select-ellipse", () => mouseDrag([P(-100, -60), P(120, 80)]));
await gesture("selección lazo", "select-lasso", () => mouseDrag([P(-120, -60), P(60, -80), P(120, 20), P(-40, 90), P(-120, -60)]));
await gesture("varita mágica", "select-wand", () => mouseClick(P(-300, -120)));
await runCmd(page, "sel.none", errors);
await gesture("mover capa", "move", () => mouseDrag([P(0, 0), P(60, 40)]));
await gesture("difuminar", "smudge", () => mouseDrag([P(-60, 0), P(60, 20)]));
await gesture("exposición", "expose", () => mouseDrag([P(-60, 40), P(60, 40)]));
await gesture("dodge/burn", "dodgeburn", () => mouseDrag([P(-60, -40), P(60, -40)]));
await gesture("licuar", "liquify", () => mouseDrag([P(-30, 0), P(40, 10)]));
await gesture("cuentagotas", "picker", () => mouseClick(P(-100, 0)));
await gesture("lupa (clic)", "zoom", () => mouseClick(P(0, 0)));
await gesture("mano (arrastrar)", "pan", () => mouseDrag([P(0, 0), P(-60, -30)]));
await runCmd(page, "view.fit", errors);
await gesture("texto", "text", async () => { await mouseClick(P(-150, -100)); await sleep(300); await page.keyboard.type("Hola"); await sleep(200); await page.keyboard.press("Escape"); });
await gesture("recortar", "crop", async () => { await mouseDrag([P(-200, -100), P(200, 100)]); await sleep(200); await page.keyboard.press("Enter"); });

/* atajos de teclado: letra de herramienta, deshacer/rehacer, duplicar capa, zoom con la rueda */
desktop.keys = [];
const keyStep = async (name, fn) => { const before = errors.size; await fn(); await settle(); desktop.keys.push({ name, ...(await docState(page, mod("doc"))), view: await viewState(), tool: await page.evaluate(async m => (await import(m)).current.id, mod("tools")), newErrors: [...errors].slice(before) }); };
await page.mouse.move(CX, CY);
for (const t of desktop.fingerprint.tools.filter(t => t.key)) await keyStep("tecla " + t.key, () => page.keyboard.press(t.key));
await keyStep("Ctrl+J duplicar capa", () => page.keyboard.press("Control+j"));
await keyStep("Ctrl+Z deshacer", () => page.keyboard.press("Control+z"));
await keyStep("Ctrl+Mayús+Z rehacer", () => page.keyboard.press("Control+Shift+z"));
await keyStep("Ctrl+A seleccionar todo", () => page.keyboard.press("Control+a"));
await keyStep("Ctrl+D quitar selección", () => page.keyboard.press("Control+d"));
await keyStep("Ctrl+0 ajustar", () => page.keyboard.press("Control+0"));
await keyStep("Ctrl++ acercar", () => page.keyboard.press("Control+="));
await keyStep("rueda + Ctrl acerca", async () => { await page.keyboard.down("Control"); await page.mouse.wheel(0, -300); await page.keyboard.up("Control"); });
await keyStep("corchete ] sube tamaño pincel", async () => { await setTool("brush"); await page.keyboard.press("]"); });
await keyStep("dígito 5 = opacidad 50 %", () => page.keyboard.press("5"));

/* formatos que dependen de librerías de terceros (UTIF, ag-psd): se abren desde cero, como un usuario */
desktop.vendorAtStart = desktop.vendorAtStart || null;
desktop.formats = [];
for (const [name, buf] of [["prueba.tif", makeTiff(64, 48)], ["prueba.psd", makePsd(64, 48)]]) {
  const before = errors.size;
  await page.setInputFiles("#filePicker", { name, mimeType: "application/octet-stream", buffer: buf });
  await sleep(1800); await settle();
  desktop.formats.push({ name, ...(await docState(page, mod("doc"))), newErrors: [...errors].slice(before) });
}
desktop.vendorAfter = await page.evaluate(() => ({ heic2any: typeof globalThis.heic2any, UTIF: typeof globalThis.UTIF, agPsd: typeof globalThis.agPsd }));
desktop.heicLoader = MODS.vendor ? await page.evaluate(async p => { const m = await import(p); return await m.vendorReady("heic2any") && typeof globalThis.heic2any === "function"; }, mod("vendor")) : "n/a (carga directa)";

desktop.finalErrors = [...errors].sort();
await D.ctx.close();
result.desktop = desktop;

/* ───────── móvil ───────── */
const M = await coldStart("mobile");
const mobile = { loadErrors: [...M.errors].sort(), perf: M.perf };
mobile.screens = { welcome: await shot(M.page, "mobile-welcome") };
await M.page.setInputFiles("#filePicker", IMAGE);
mobile.opened = await until(M.page, async p => (await import(p)).doc.open, mod("doc"), 30000);
await sleep(600);
mobile.screens.withImage = await shot(M.page, "mobile-image");
const handle = await M.page.$("#toolsHandle:not([hidden])");
if (handle) { await handle.click(); await sleep(700); mobile.screens.drawer = await shot(M.page, "mobile-drawer"); mobile.drawer = true; } else mobile.drawer = false;
mobile.finalErrors = [...M.errors].sort();
await M.ctx.close();
result.mobile = mobile;

await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, `smoke.${LABEL}.json`), JSON.stringify(result, null, 1));
const okDialogs = desktop.dialogs.filter(d => d.opened).length;
console.log(`[${LABEL}] arranque ${desktop.perf.medianReadyMs} ms · ${perfRuns[0].requests} peticiones · ${(perfRuns[0].jsBytes / 1024) | 0} KB JS`);
console.log(`[${LABEL}] comandos con registro: ${desktop.fingerprint.commands.length} · herramientas: ${desktop.fingerprint.tools.length} · diálogos abiertos: ${okDialogs}/${desktop.dialogs.length}`);
console.log(`[${LABEL}] formatos abiertos: ${desktop.formats.map(f => f.name + " " + f.w + "x" + f.h).join(", ")} · librerías al arrancar: ${JSON.stringify(desktop.vendorAtStart)} → después: ${JSON.stringify(desktop.vendorAfter)} · carga de heic2any: ${desktop.heicLoader}`);
console.log(`[${LABEL}] gestos: ${desktop.gestures.length} · atajos: ${desktop.keys.length}`);
console.log(`[${LABEL}] errores escritorio: ${desktop.finalErrors.length} · móvil: ${mobile.finalErrors.length}`);
