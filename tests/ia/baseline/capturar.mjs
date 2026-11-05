/* ═══════════════════════════════════════════════════════════════
   LÍNEA BASE · captura de las huellas del menú IA y del cajón
   Uso:  node tests/ia/baseline/capturar.mjs          (escribe menu-ia.json y cajon.json en esta carpeta)
   Se ejecuta UNA vez, antes de empezar a cambiar nada (F0.1). Las pruebas posteriores comparan contra estos archivos.
   Si un cambio de estructura es intencionado (p. ej. la Fase 1), se regenera revisando la diferencia a mano.
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrir } from "../lib/navegador.mjs";
import { menuIA, cajon } from "../lib/huellas.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const esc = await abrir("escritorio");
fs.writeFileSync(path.join(aqui, "menu-ia.json"), JSON.stringify(await menuIA(esc.page), null, 1) + "\n");
await esc.cerrar();
const mov = await abrir("movil");
fs.writeFileSync(path.join(aqui, "cajon.json"), JSON.stringify(await cajon(mov.page), null, 1) + "\n");
await mov.cerrar();
console.log("Línea base escrita en", aqui);
