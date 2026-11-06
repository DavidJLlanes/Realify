/* ═══════════════════════════════════════════════════════════════
   DOCS · GENERA docs/FUNCIONES_IA.md DESDE LOS MANIFIESTOS
   La lista de funciones de IA nuevas (por submenú, con su descripción, pestañas del cajón e interfaz) sale de js/ui/menu/ia/manifests.js: así nunca se desactualiza.
   Uso: node tools/docs/funciones-ia.mjs   ·   Salida: docs/FUNCIONES_IA.md (se sobrescribe). Límite: sólo las funciones con manifiesto; las anteriores al plan están en FUNCIONALIDADES.md, sección 12.
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import { MANIFESTS } from "../../js/ui/menu/ia/manifests.js";
import { IA_SUBMENUS } from "../../js/ui/menu/ia/index.js";

const nombre = new Map(IA_SUBMENUS.map(s => [s.id, s.label])), orden = IA_SUBMENUS.map(s => s.id), por = {};
for (const m of MANIFESTS) (por[m.submenu] = por[m.submenu] || []).push(m);
const ui = m => m.ui?.editor === "face" ? "editor de cara" : m.ui?.editor === "body" ? "editor de cuerpo" : m.ui?.editor ? "editor a pantalla completa" : m.ui?.kind === "report" ? "informe" : "ventana simple";
const limpia = s => String(s || "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
let md = `# Funciones de IA nuevas (generado)

> Generado por \`node tools/docs/funciones-ia.mjs\` a partir de los manifiestos (\`js/ui/menu/ia/manifests.js\`). No se edita a mano.
> Todas son **Premium 👑** (de momento sin pago), se ejecutan en el dispositivo y sus modelos se descargan al usarlas, avisando del tamaño.
> Los modelos y sus licencias están en [MODELOS.md](MODELOS.md).

**${MANIFESTS.length} funciones** en **${Object.keys(por).length} submenús** del menú «Inteligencia Artificial».\n`;
for (const id of orden) {
  const fs_ = por[id]; if (!fs_) continue;
  md += `\n## ${nombre.get(id)} (${fs_.length})\n\n| Función | Qué hace | Interfaz | Pestañas del cajón |\n|---|---|---|---|\n`;
  for (const m of fs_) md += `| ${limpia(m.label).replace("…", "")} | ${limpia(m.help)} | ${ui(m)} | ${["ia", ...(m.tabs || [])].join(", ")} |\n`;
}
fs.writeFileSync("docs/FUNCIONES_IA.md", md); console.log("docs/FUNCIONES_IA.md:", MANIFESTS.length, "funciones");
