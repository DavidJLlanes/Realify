/* Ayudante de tests/icc_cmyk_check.py: convierte sRGB → CMYK con js/io/icccmyk.js. Uso: node tests/icc-cmyk.mjs perfil.icc entrada.rgb salida.cmyk */
import fs from "node:fs";
import { cmykConverter } from "../js/io/icccmyk.js";
const [prof, inp, out] = process.argv.slice(2);
const conv = cmykConverter(new Uint8Array(fs.readFileSync(prof)), { intent: 1 }), rgb = fs.readFileSync(inp), n = rgb.length / 3, rgba = new Uint8Array(n * 4);
for(let i = 0; i < n; i++){ rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1]; rgba[i * 4 + 2] = rgb[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
fs.writeFileSync(out, conv.apply(rgba)); console.log("perfil:", conv.desc, "·", n, "colores");
