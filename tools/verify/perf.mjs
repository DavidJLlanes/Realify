/* Medida de arranque con una red limitada (latencia y ancho de banda) y compresión gzip, como en producción.
     PW_CORE=<dir con playwright-core> node perf.mjs --root <web> --label <nombre> [--profile 4g|3g|wifi] [--runs 3]
   Cada ejecución usa un contexto nuevo (sin caché) y sin service worker. Mide:
     · tiempo hasta que la app está lista (window.__realifyReady)
     · tiempo hasta el primer contenido pintado (FCP)
     · peticiones y bytes transferidos hasta ese momento, y cuántos son de JS/CSS
   Con VERIFY_CERT_DIR (carpeta con key.pem y cert.pem) se mide por HTTP/2, como en producción; sin ella, HTTP/1.1.
   Los perfiles son aproximaciones: «wifi» 20 ms · 30 Mbps, «4g» 80 ms · 9 Mbps, «3g» 200 ms · 1,6 Mbps. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { serve } from "./lib/server.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg("root", "")), LABEL = arg("label", "web"), RUNS = +arg("runs", 3), PROFILE = arg("profile", "4g");
const PROFILES = { wifi: [20, 30e6 / 8], "4g": [80, 9e6 / 8], "3g": [200, 1.6e6 / 8] };
const [latency, bps] = PROFILES[PROFILE] || PROFILES["4g"];
/* Las dependencias de desarrollo (npm install en la raíz del proyecto) están en ../../node_modules; PW_CORE permite usar otra carpeta. */
process.env.PW_CORE ||= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { chromium } = createRequire(path.join(process.env.PW_CORE, "x.js"))("playwright-core");
/* Navegador: CHROME_EXE, o el Chromium de esta máquina si existe, o el que instala «npx playwright install chromium». */
const LOCAL_CHROME = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe");
const CHROME = process.env.CHROME_EXE || (LOCAL_CHROME && fs.existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

const INDEX = arg("index", null);
const { server, port, scheme } = await serve(ROOT, { index: INDEX });
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), headless: true, args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader"] });
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const runs = [];
for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("realify.onboarded.v1", "1"); localStorage.setItem("realify.landscapeOk", "1"); localStorage.setItem("realify.compatSeen", "1"); localStorage.setItem("realify.cookieConsent", "1"); } catch {} });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency, downloadThroughput: bps, uploadThroughput: bps });
  const t0 = Date.now();
  await page.goto(`${scheme}://127.0.0.1:${port}/`, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__realifyReady === true, null, { timeout: 180000, polling: 50 });
  const ready = Date.now() - t0;
  const m = await page.evaluate(() => {
    const e = performance.getEntriesByType("resource"), fcp = performance.getEntriesByType("paint").find(p => p.name === "first-contentful-paint");
    const js = e.filter(x => /\.m?js(\?|$)/.test(x.name)), css = e.filter(x => /\.css(\?|$)/.test(x.name));
    const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);
    return { fcp: fcp ? Math.round(fcp.startTime) : null, requests: e.length, jsRequests: js.length, cssRequests: css.length, transferKB: Math.round(sum(e, "transferSize") / 1024), jsDecodedKB: Math.round(sum(js, "decodedBodySize") / 1024) };
  });
  runs.push({ ready, ...m });
  await ctx.close();
}
await browser.close(); server.close();
const out = { label: LABEL, profile: PROFILE, protocol: scheme === "https" ? "h2" : "http/1.1", latencyMs: latency, mbps: +(bps * 8 / 1e6).toFixed(1), runs, medianReadyMs: median(runs.map(r => r.ready)), medianFcpMs: median(runs.map(r => r.fcp ?? 0)), last: runs[runs.length - 1] };
fs.mkdirSync(path.join(here, "baseline"), { recursive: true });
fs.writeFileSync(path.join(here, "baseline", `perf.${LABEL}.${PROFILE}.json`), JSON.stringify(out, null, 1));
console.log(`[${LABEL} · ${PROFILE} ${latency} ms/${out.mbps} Mbps · ${out.protocol}] listo en ${out.medianReadyMs} ms (FCP ${out.medianFcpMs} ms) · ${out.last.requests} peticiones (${out.last.jsRequests} JS, ${out.last.cssRequests} CSS) · ${out.last.transferKB} KB transferidos · ${out.last.jsDecodedKB} KB de JS`);
