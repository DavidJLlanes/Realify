/* FASE 5 · librerías de terceros bajo demanda.
   heic2any, UTIF y ag-psd (2,3 MB, el 41 % de lo que se transfiere al arrancar) dejan de ser <script> de index.html y
   pasan a cargarse con js/core/vendor.js la primera vez que se abre o exporta un HEIC, un TIFF/DNG o un PSD/PSB.
   Cada punto de entrada espera a que estén cargadas y conserva su comprobación y su mensaje de error actuales.
   También se quitan del precaché del service worker (no hay por qué descargarlas al instalar la app a quien nunca usa
   esos formatos; se cachean al usarlas, como el resto).
     node tools/migrate/phase5-vendor.mjs            Idempotente. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
const P = p => path.join(root, p);
if (!fs.existsSync(P("js/core/vendor.js"))) throw new Error("Falta js/core/vendor.js");

function edit(file, pairs) {
  let s = fs.readFileSync(P(file), "utf8"), n = 0;
  for (const [a, b] of pairs) {
    if (b !== "" ? s.includes(b) : !s.includes(a)) continue;      // ya aplicado (si b es vacío, «aplicado» = a ya no está)
    if (!s.includes(a)) throw new Error(`${file}: no encuentro\n${a.slice(0, 140)}`);
    s = s.replace(a, () => b); n++;
  }
  if (n) fs.writeFileSync(P(file), s);
  console.log(`${file}: ${n ? n + " cambio(s)" : "ya aplicado"}`);
}

/* 1 · puntos de entrada ──────────────────────────────────────── */
edit("js/io/formats/compatibility.js", [
  ['import { hiToCanvas8 } from "../../core/hisrc.js";\n', 'import { hiToCanvas8 } from "../../core/hisrc.js";\nimport { vendorReady } from "../../core/vendor.js";\n'],
  ['async function decodeHeic(file){\n  if(typeof globalThis.heic2any', 'async function decodeHeic(file){\n  await vendorReady("heic2any");\n  if(typeof globalThis.heic2any'],
  ['if(e==="tif"||e==="tiff"||e==="dng")return decodeTiff(await file.arrayBuffer());', 'if(e==="tif"||e==="tiff"||e==="dng"){await vendorReady("utif");return decodeTiff(await file.arrayBuffer());}'],
  ['if((e==="psd"||e==="psb")){const p=parsePsd(', 'if((e==="psd"||e==="psb")){await vendorReady("agpsd");const p=parsePsd('],
  ['export async function openPsd(file){\n  const buf=', 'export async function openPsd(file){\n  await vendorReady("agpsd");\n  const buf=']
]);
edit("js/io/formats/hidepth.js", [
  ['*/\n\nconst ext = f =>', '*/\n\nimport { vendorReady } from "../../core/vendor.js";\n\nconst ext = f =>'],
  ['if(kind === "tiff") return decodeTiff16(buf);', 'if(kind === "tiff"){ await vendorReady("utif"); return decodeTiff16(buf); }']
]);
edit("js/io/export/professional-export.js", [
  ['import { highPrecisionAvailableFor, renderHighPrecisionCanvas, renderPrecisionAdjustmentStack } from "../precision/high-precision-safe.js', 'import { vendorReady } from "../../core/vendor.js";\nimport { highPrecisionAvailableFor, renderHighPrecisionCanvas, renderPrecisionAdjustmentStack } from "../precision/high-precision-safe.js'],
  ['  const PF=await import("../formats/professional-formats.js");\n  return PF.layeredPsd(scale,', '  const PF=await import("../formats/professional-formats.js");\n  await vendorReady("agpsd");\n  return PF.layeredPsd(scale,']
]);
edit("js/ui/kit/fsshell.js", [
  ['import { dockPremium } from "./premium.js";\n', 'import { dockPremium } from "./premium.js";\nimport { vendorReady } from "../../core/vendor.js";\n'],
  ['if(!tiff && !loaded && isHeic(blob) && typeof globalThis.heic2any === "function"){', 'if(!tiff && !loaded && isHeic(blob) && await vendorReady("heic2any") && typeof globalThis.heic2any === "function"){']
]);
edit("plugins/social-post/ui.js", [
  ['import { toast } from "../../js/core/toast.js";\n', 'import { toast } from "../../js/core/toast.js";\nimport { vendorReady } from "../../js/core/vendor.js";\n'],
  ['if(!loaded && isHeic(blob) && typeof globalThis.heic2any === "function"){', 'if(!loaded && isHeic(blob) && await vendorReady("heic2any") && typeof globalThis.heic2any === "function"){']
]);

/* 2 · index.html: fuera los tres <script> clásicos ───────────── */
edit("index.html", [
  ['<script src="js/vendor/ag-psd.js"></script>\n<script src="js/vendor/utif.js"></script>\n<script src="js/vendor/heic2any.min.js"></script>\n', '']
]);

/* 3 · service worker: fuera del precaché ─────────────────────── */
edit("sw.js", [
  ['  "./js/core/viewport-lock.js"\n  ,"./js/vendor/ag-psd.js"\n  ,"./js/vendor/utif.js"\n  ,"./js/vendor/heic2any.min.js"\n];', '  "./js/core/viewport-lock.js"\n];']
]);
