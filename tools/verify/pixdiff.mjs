/* Compara dos capturas PNG píxel a píxel (usa el Chromium de Playwright para decodificarlas).
     PW_CORE=<carpeta con playwright-core> node pixdiff.mjs <a.png> <b.png>
   Muestra cuántos píxeles difieren y la mayor diferencia de canal (0-255). Una diferencia de 1-2 niveles en pocos
   píxeles es ruido de suavizado de bordes, no un cambio visible. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error("uso: node pixdiff.mjs <a.png> <b.png>"); process.exit(2); }
/* Las dependencias de desarrollo (npm install en la raíz del proyecto) están en ../../node_modules; PW_CORE permite usar otra carpeta. */
process.env.PW_CORE ||= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { chromium } = createRequire(path.join(process.env.PW_CORE, "x.js"))("playwright-core");
/* Navegador: CHROME_EXE, o el Chromium de esta máquina si existe, o el que instala «npx playwright install chromium». */
const LOCAL_CHROME = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe");
const CHROME = process.env.CHROME_EXE || (LOCAL_CHROME && fs.existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), headless: true });
const page = await browser.newPage();
const url = f => "data:image/png;base64," + fs.readFileSync(f).toString("base64");
const r = await page.evaluate(async ([ua, ub]) => {
  const load = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const [A, B] = await Promise.all([load(ua), load(ub)]);
  if (A.width !== B.width || A.height !== B.height) return { sizeDiffers: true, a: [A.width, A.height], b: [B.width, B.height] };
  const px = i => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
  const da = px(A), db = px(B);
  let n = 0, max = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    if (d) { n++; if (d > max) max = d; }
  }
  return { w: A.width, h: A.height, differing: n, total: A.width * A.height, maxChannelDiff: max };
}, [url(a), url(b)]);
await browser.close();
console.log(r.sizeDiffers ? `TAMAÑO DISTINTO ${r.a} ≠ ${r.b}` : `${r.differing} de ${r.total} píxeles distintos (${(100 * r.differing / r.total).toFixed(4)} %) · mayor diferencia de canal: ${r.maxChannelDiff}`);
process.exit(r.sizeDiffers || r.differing ? 1 : 0);
