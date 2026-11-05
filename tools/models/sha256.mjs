/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS DE MODELOS · sha256 de uno o varios archivos
   Calcula la huella que se anota en docs/MODELOS.md y en el campo `sha256` del catálogo (js/ai/models/).
   Uso:  node tools/models/sha256.mjs <archivo> [<archivo>…]        (si se pasan dos o más trozos con --unir, calcula la del conjunto)
         node tools/models/sha256.mjs --unir trozo0 trozo1           (modelos partidos, como GFPGAN)
   Salida: «<sha256>  <archivo>»
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const unir = args.includes("--unir"), files = args.filter(a => a !== "--unir");
if (!files.length) { console.error("uso: node tools/models/sha256.mjs [--unir] <archivo>…"); process.exit(2); }
const hash = list => new Promise((res, rej) => {
  const h = crypto.createHash("sha256");
  (function next(i) {
    if (i === list.length) return res(h.digest("hex"));
    fs.createReadStream(list[i]).on("data", d => h.update(d)).on("end", () => next(i + 1)).on("error", rej);
  })(0);
});
if (unir) console.log(await hash(files) + "  " + files.join(" + "));
else for (const f of files) console.log(await hash([f]) + "  " + f);
