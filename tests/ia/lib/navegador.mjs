/* ═══════════════════════════════════════════════════════════════
   PRUEBAS IA · NAVEGADOR COMÚN
   Sirve la web en local y abre Chromium sin ventana en modo móvil o escritorio. Lo usan todas las pruebas de
   tests/ia/ para no repetir el servidor ni la carga de Playwright.
   Entradas: la variable CHROME_EXE (opcional) con la ruta de Chromium.
   Salidas:  abrir(tipo) → { page, errs, cerrar }  ·  tipo: "movil" | "escritorio".
   Límites:  no hace falta red; el service worker se bloquea.
   ═══════════════════════════════════════════════════════════════ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

async function cargarPlaywright() {
  for (const s of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { return (await import(s)).chromium; } catch { /* siguiente */ }
  }
  throw new Error("No se encuentra Playwright (npm ci o PLAYWRIGHT_MODULE).");
}

function servir() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(RAIZ, p);
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => srv.listen(0, "127.0.0.1", () => res(srv)));
}

export async function abrir(tipo = "escritorio") {
  const chromium = await cargarPlaywright();
  const srv = await servir();
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXE ? { executablePath: process.env.CHROME_EXE } : {}) });
  const ctx = await browser.newContext(tipo === "movil"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" }
    : { viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForTimeout(1500);
  return { page, errs, cerrar: async () => { await browser.close(); srv.close(); } };
}

/** Documento de prueba mínimo, por si la función lo necesita. */
export async function documentoDePrueba(page, w = 300, h = 200) {
  await page.evaluate(async ([w, h]) => {
    const D = await import("/js/core/doc.js");
    D.newDoc(w, h, { name: "prueba" });
    const l = D.addLayer({ name: "Fondo" });
    l.ctx.fillStyle = "#2a7"; l.ctx.fillRect(0, 0, w, h);
  }, [w, h]);
}
