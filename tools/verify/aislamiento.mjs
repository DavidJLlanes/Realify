/* ═══════════════════════════════════════════════════════════════
   AISLAMIENTO DE MÓDULOS (Fase 0 del plan de IA, F0.15; norma 4.8 del plan)
   Un módulo aislado (hoy: el editor de vídeo, plugins/video/) tiene UNA puerta de entrada y UN puente de salida:
     · Hacia dentro: nada de fuera lo importa de forma estática; sólo se carga con import() y sólo su puerta
       (plugins/video/index.js), y sólo desde los archivos de la lista `cargadores` (los comandos del módulo).
     · Hacia fuera: el módulo sólo importa código de fuera desde su carpeta bridge/ (la capa anticorrupción); el resto del
       módulo importa del propio módulo o de bridge/.
   Las pruebas y herramientas del propio módulo (`propios`: tests/video/, tools/video/) pueden importarlo de forma estática.
   Falla (código 1) si se rompe alguna regla. Si la carpeta del módulo aún no existe, pasa sin más.
   Uso:  node tools/verify/aislamiento.mjs [<raíz>]
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walk, rel, stripQuery } from "./lib/scan.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, "..", ".."));

/* Para añadir otro módulo aislado en el futuro, basta una entrada nueva. */
const AISLADOS = [
  { nombre: "editor de vídeo", dir: "plugins/video", propios: ["tests/video/", "tools/video/"], puerta: "plugins/video/index.js", puente: "plugins/video/bridge/", cargadores: ["js/app/commands/video.js"] }
];

const IMP = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|(?<![\w.])import\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[;\s])import\s*['"]([^'"]+)['"]/g;
const files = walk(root, { exts: new Set([".js", ".mjs"]) }).map(f => rel(root, f)).filter(r => !r.startsWith("js/vendor/"));
const fileSet = new Set(files);
const dentro = (f, dir) => f === dir || f.startsWith(dir + "/");

let fallos = 0;
const mal = m => { fallos++; console.log("FALLO: " + m); };
for (const mod of AISLADOS) {
  if (!fs.existsSync(path.join(root, mod.dir))) { console.log(`${mod.nombre}: todavía no existe (${mod.dir}); nada que comprobar`); continue; }
  let revisados = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    let m; IMP.lastIndex = 0;
    while ((m = IMP.exec(src))) {
      const spec = m[1] || m[2] || m[3];
      if (!spec || !spec.startsWith(".")) continue;
      const to = rel(root, path.resolve(path.dirname(path.join(root, f)), stripQuery(spec)));
      if (!fileSet.has(to)) continue;
      const dinamico = !!m[2];
      if (dentro(f, mod.dir)) {
        revisados++;
        if (!dentro(to, mod.dir) && !f.startsWith(mod.puente)) mal(`${f} importa ${to} (fuera de ${mod.dir}) sin pasar por ${mod.puente}`);
      } else if (dentro(to, mod.dir) && !(mod.propios || []).some(q => f.startsWith(q))) {
        if (!dinamico) mal(`${f} importa de forma estática ${to}: el ${mod.nombre} sólo se carga con import()`);
        else if (to !== mod.puerta) mal(`${f} carga ${to}: sólo se puede cargar la puerta (${mod.puerta})`);
        else if (!mod.cargadores.includes(f)) mal(`${f} carga la puerta del ${mod.nombre}: sólo pueden ${mod.cargadores.join(", ")}`);
      }
    }
  }
  console.log(`${mod.nombre}: ${revisados} importaciones internas revisadas`);
}
console.log(fallos ? "AISLAMIENTO: FALLO" : "AISLAMIENTO OK");
process.exit(fallos ? 1 : 0);
