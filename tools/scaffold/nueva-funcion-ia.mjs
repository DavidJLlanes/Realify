/* ═══════════════════════════════════════════════════════════════
   GENERADOR DE FUNCIONES DE IA (Fase 0 del plan, F0.8; plantilla en 4.2 del plan)
   Crea la carpeta de una función nueva con la plantilla acordada y su prueba, para que todas nazcan con la misma forma:
     js/features/<familia>/<función>/  README.md · manifest.js · index.js · ui.js · controller.js · analysis.js · engine.js · params.js
     tests/ia/<familia>/<función>.mjs  (el motor se prueba en Node, sin navegador)
   No toca ningún archivo existente. El menú, el cajón, ☰ y el comando salen solos del manifiesto (Fase 1):
   el generador imprime la línea que hay que añadir a js/ui/menu/ia/manifests.js.
   Uso:
     node tools/scaffold/nueva-funcion-ia.mjs --familia portrait --nombre skin-wrinkles --cmd ai.skinWrinkles \
          --etiqueta "Arrugas" --corto "Arrugas" --submenu retrato --ui face:piel [--icono sparkles] [--raiz <ruta>] [--dry]
   --ui: «simple» (diálogo) o «<editor>:<grupo>» (editor a pantalla completa abierto en ese grupo; ver 4.7 del plan)
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const A = process.argv.slice(2);
const val = f => { const i = A.indexOf(f); return i >= 0 ? A[i + 1] : null; };
const dry = A.includes("--dry");
const aqui = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(val("--raiz") || path.join(aqui, "..", ".."));
const familia = val("--familia"), nombre = val("--nombre"), cmd = val("--cmd"), etiqueta = val("--etiqueta"), corto = val("--corto") || etiqueta;
const submenu = val("--submenu"), ui = val("--ui") || "simple", icono = val("--icono") || "sparkles";

const falta = [["--familia", familia], ["--nombre", nombre], ["--cmd", cmd], ["--etiqueta", etiqueta], ["--submenu", submenu]].filter(([, v]) => !v).map(([k]) => k);
if (falta.length) { console.error("Faltan: " + falta.join(", ") + "\nVer la cabecera de este archivo para el uso."); process.exit(2); }
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(familia) || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(nombre)) { console.error("familia y nombre van en minúsculas con guiones (p. ej. skin-wrinkles)."); process.exit(2); }
if (!/^ai\.[a-z][A-Za-z0-9]*$/.test(cmd)) { console.error("El comando tiene la forma ai.nombreEnCamello (p. ej. ai.skinWrinkles)."); process.exit(2); }
if (!(ui === "simple" || /^[a-z]+:[a-z0-9-]+$/.test(ui))) { console.error("--ui: «simple» o «editor:grupo» (p. ej. face:piel)."); process.exit(2); }

const pascal = nombre.split("-").map(s => s[0].toUpperCase() + s.slice(1)).join("");
const uiObj = ui === "simple" ? '"simple"' : `{ editor: "${ui.split(":")[0]}", group: "${ui.split(":")[1]}" }`;
const L = "   ═══════════════════════════════════════════════════════════════";
const cab = (titulo, ...ls) => `/*${L.slice(2)}\n   ${titulo}\n${ls.map(l => "   " + l).join("\n")}\n${L} */\n`;
const carpeta = path.join(root, "js", "features", familia, nombre);
const prueba = path.join(root, "tests", "ia", familia, nombre + ".mjs");
const rutaRel = (d, a) => path.relative(path.dirname(d), a).split(path.sep).join("/");

const files = {
  "README.md": `# ${etiqueta} · \`${cmd}\`

Qué hace: _(una frase)_.

- **Menú:** Inteligencia Artificial › ${submenu} › ${etiqueta} · **Interfaz:** ${ui === "simple" ? "simple (diálogo)" : "editor " + ui.replace(":", ", grupo ")}
- **Modelos:** _(ninguno | id del catálogo, ver docs/MODELOS.md)_
- **Procesado Premium («el bueno y el mejor»):**
  - Bueno: _(…)_
  - Mejor: _(…)_
- **Parámetros:** ver \`params.js\` y \`manifest.js\`.
- **Límites:** _(…)_
- **Cómo probarla:** \`node tests/ia/${familia}/${nombre}.mjs\` (motor, Node) y \`node tests/calidad-herramienta.mjs ${cmd}\` (móvil y escritorio).
`,
  "manifest.js": cab(`${etiqueta.toUpperCase()} · MANIFIESTO`, "Sólo DATOS: de aquí salen el menú de escritorio, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).", "`ui`: \"simple\" o { editor, group }. `params`: el esquema de parámetros (js/ui/kit/params-panel.js).") + `
import { PARAMS } from "./params.js";

export default {
  cmd: "${cmd}",
  label: "${etiqueta}…",
  short: "${corto}",
  icon: "${icono}",
  help: "_(texto de ayuda del menú)_",
  submenu: "${submenu}",
  tabs: [],                         // pestañas afines del cajón (5.2 del plan); nunca basicos ni auto
  premium: true,                    // las funciones de IA nuevas son sólo Premium 👑, sin interruptor
  ui: ${uiObj},
  params: PARAMS,
  load: () => import("./index.js")
};
`,
  "index.js": cab(`${etiqueta.toUpperCase()} · FACHADA`, "Sólo conecta (≤ 40 líneas): abre la función.", "Entradas: ninguna. Salida: promesa que se resuelve al terminar.") + `
export async function open${pascal}(){
  const { ejecutar } = await import("./controller.js");
  return ejecutar();
}
`,
  "ui.js": cab(`${etiqueta.toUpperCase()} · INTERFAZ`, "Declara el panel de mandos de la función a partir de `params`; NO monta ventanas ni importa fsshell ni dialog (lo hace el host, 4.7 del plan).", "Entradas: contexto del host. Salida: la configuración del panel.") + `
import { PARAMS } from "./params.js";

export const panel = () => ({ params: PARAMS });
`,
  "controller.js": cab(`${etiqueta.toUpperCase()} · FLUJO`, "Analizar → previsualizar → aplicar → capa nueva (≤ 250 líneas).", "Usa js/features/ai-kit/ (imagen visible, sesión de IA, capa nueva).") + `
export async function ejecutar(){
  throw new Error("${cmd}: sin implementar");
}
`,
  "analysis.js": cab(`${etiqueta.toUpperCase()} · ANÁLISIS`, "Llamadas a modelos y máscaras (usa ai-kit). Aquí se detecta; no se cambian píxeles.", "Entradas: imagen y parámetros. Salida: máscaras y mapas.") + `
export async function analizar(/* imagen, params */){
  return {};
}
`,
  "engine.js": cab(`${etiqueta.toUpperCase()} · MOTOR`, "Cálculo de píxeles PURO: sin DOM, se prueba en Node.", "Entradas: píxeles RGBA, ancho, alto, análisis y parámetros. Salida: píxeles RGBA nuevos.") + `
export function procesar(rgba /*, w, h, analisis, params */){
  return new Uint8ClampedArray(rgba);       // esqueleto: sin cambios
}
`,
  "params.js": cab(`${etiqueta.toUpperCase()} · PARÁMETROS`, "Valores por defecto y rangos (esquema de js/ui/kit/params-panel.js).", "Cada parámetro: { key, label, type, min, max, step, def, unit, group?, only?, ranges? }.") + `
export const PARAMS = [
  { key: "intensidad", label: "Intensidad", type: "range", min: 0, max: 100, step: 1, def: 50, unit: " %" }
];
`
};
const test = cab(`PRUEBA · ${cmd}`, "Motor en Node puro (sin navegador). Para la interfaz en móvil y escritorio: node tests/calidad-herramienta.mjs " + cmd, `Uso: node tests/ia/${familia}/${nombre}.mjs`) + `
import { procesar } from "${rutaRel(prueba, path.join(carpeta, "engine.js"))}";
import { defaultsOf } from "${rutaRel(prueba, path.join(root, "js", "ui", "kit", "params-panel.js"))}";
import { PARAMS } from "${rutaRel(prueba, path.join(carpeta, "params.js"))}";

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const px = new Uint8ClampedArray([10, 20, 30, 255, 200, 150, 100, 255]);
const out = procesar(px, 2, 1, {}, defaultsOf(PARAMS));
ok(out.length === px.length, "el motor conserva el tamaño");
ok(out !== px, "el motor no modifica el original");
console.log("${cmd}: " + (fallos ? "FALLO" : "OK"));
process.exit(fallos ? 1 : 0);
`;

if (fs.existsSync(carpeta)) { console.error("Ya existe " + path.relative(root, carpeta)); process.exit(1); }
console.log((dry ? "Simulación. Se crearía:" : "Creado:") + "\n  " + path.relative(root, carpeta) + "/  (" + Object.keys(files).join(", ") + ")\n  " + path.relative(root, prueba));
if (!dry) {
  fs.mkdirSync(carpeta, { recursive: true });
  for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(carpeta, f), t);
  fs.mkdirSync(path.dirname(prueba), { recursive: true });
  fs.writeFileSync(prueba, test);
}
console.log(`\nSiguiente paso: añade en js/ui/menu/ia/manifests.js\n  import m${pascal} from "../../../features/${familia}/${nombre}/manifest.js";\ny mete m${pascal} en la lista MANIFESTS. El menú, el cajón, ☰ y el comando salen solos.`);
