/* FASE 3 · ui/menu.js (977 líneas) → los datos de los menús (MENUS, 549 líneas, sin dependencias) pasan a ui/menu/data.js.
   menu.js conserva el código que construye y muestra los menús y reexporta MENUS (la API no cambia).
     node tools/migrate/phase3-menu.mjs [--dry]            (necesita PW_CORE con acorn) */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { splitFile } from "./lib/splitter.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!/realify - mejorado$/i.test(root.replace(/\\/g, "/"))) throw new Error("Debe ejecutarse sobre «Realify - Mejorado»");
if (fs.existsSync(path.join(root, "js/ui/menu/data.js"))) { console.log("menu.js: ya dividido"); process.exit(0); }

const res = splitFile(root, "js/ui/menu.js", [{
  file: "menu/data.js", names: ["MENUS"],
  header: "/* ═══════════════════════════════════════════════════════════════\n   MENÚS · estructura de los menús (Archivo, Editar, Imagen, Capa, Selección, Filtro, Ajustes…)\n   Datos puros: cada entrada es un comando (cmd) con su texto. Parte de js/ui/menu.js, que los reexporta y construye\n   los menús del escritorio y del móvil.\n   ═══════════════════════════════════════════════════════════════ */"
}], { dry: process.argv.includes("--dry") });
for (const f of res.files) console.log(`  ${f.file.padEnd(34)} ${f.lines} líneas`);
