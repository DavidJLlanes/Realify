/* ═══════════════════════════════════════════════════════════════
   VERIFICACIÓN · CONTADOR DE COMPILACIÓN COHERENTE
   El aviso «Hay una versión nueva» compara el ?v= de main.js en index.html con version.json: si no coinciden, sale SIEMPRE
   y «Actualizar» no lo quita (pasó en la 365). Aquí se comprueba que el contador sea el mismo en todos los sitios.
   Entradas: ninguna (lee la raíz del proyecto). Salidas: código 1 y la lista de discrepancias si algo no cuadra.
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const leer = f => fs.readFileSync(path.join(RAIZ, f), "utf8");
const v = JSON.parse(leer("version.json"));
const n = String(v.version), mal = [];
const igual = (donde, valor) => { if (String(valor) !== n) mal.push(`${donde}: ${valor} (version.json dice ${n})`); };

igual("VERSION", leer("VERSION").trim());
igual("version.json build", String(v.build).replace(/^v/, ""));
igual("sw.js", (/realify-v(\d+)/.exec(leer("sw.js")) || [])[1]);
igual("basic/sw.js", (/realify-basic-v(\d+)/.exec(leer("basic/sw.js")) || [])[1]);
for (const f of ["index.html", "basic/index.html"])
  for (const m of leer(f).matchAll(/\?v=(\d+)/g)) igual(f, m[1]);
const pub = JSON.parse(leer("package.json")).version, lock = JSON.parse(leer("package-lock.json")).version;
if (pub !== v.release || lock !== v.release) mal.push(`versión pública: version.json ${v.release} · package.json ${pub} · package-lock.json ${lock}`);

if (mal.length) { console.log("CONTADOR INCOHERENTE:\n  " + mal.join("\n  ")); process.exit(1); }
console.log(`CONTADOR OK: compilación ${n} y versión ${v.release} en todos los sitios.`);
