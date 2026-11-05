/* ═══════════════════════════════════════════════════════════════
   PRUEBA · las pestañas «Básicos» y «Automáticos» del cajón no se tocan
   Compara el orden y el contenido de esas dos pestañas, y que sean las dos primeras, con la línea base
   (tests/ia/baseline/cajon.json). Se ejecuta en todas las fases del plan.
   Uso: node tests/ia/cajon-basicos-auto.mjs
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrir } from "./lib/navegador.mjs";
import { cajon } from "./lib/huellas.mjs";

const base = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "baseline", "cajon.json"), "utf8"));
const m = await abrir("movil");
const ahora = await cajon(m.page);
await m.cerrar();

let fallos = 0;
const comprobar = (ok, msg) => { if (!ok) { fallos++; console.log("FALLO:", msg); } };
comprobar(JSON.stringify(ahora.pestanas.slice(0, 2)) === JSON.stringify(base.pestanas.slice(0, 2)), "Básicos y Automáticos ya no son las dos primeras pestañas");
for (const id of ["basicos", "auto"]) {
  const a = JSON.stringify(ahora.contenido[id]), b = JSON.stringify(base.contenido[id]);
  comprobar(a === b, `la pestaña «${id}» ha cambiado respecto a la línea base`);
  if (a !== b) {
    const x = ahora.contenido[id], y = base.contenido[id];
    const i = x.findIndex((e, k) => JSON.stringify(e) !== JSON.stringify(y[k]));
    console.log(`   primera diferencia en la posición ${i}: ahora ${JSON.stringify(x[i])} · antes ${JSON.stringify(y[i])}`);
  }
}
comprobar(m.errs.length === 0, "errores de página: " + m.errs.join("; "));
console.log(fallos ? "cajón Básicos/Automáticos: FALLO" : "cajón Básicos/Automáticos: OK");
process.exit(fallos ? 1 : 0);
