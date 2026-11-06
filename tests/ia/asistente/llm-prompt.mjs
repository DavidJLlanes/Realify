/* ═════════════════════════════════════════════════
   PRUEBA · aviso y lectura del plan de Qwen (F14.1, motor puro, sin modelo)
   El modelo real (1,2 GB) no se puede bajar en el entorno de desarrollo: se comprueba todo lo demás —aviso con las herramientas, plantilla de chat,
   lectura de JSON dentro de texto con ruido y validación contra el esquema— con respuestas de ejemplo, y el tokenizador de Qwen contra ids oficiales.
   Uso: node tests/ia/asistente/llm-prompt.mjs
   ═════════════════════════════════════════════════ */
import fs from "node:fs";
import { construirEsquema } from "../../../js/features/assistant/engine/esquema.js";
import { construirMensajes, leerPlan } from "../../../js/features/assistant/engine/prompt.js";
import { validarPlan } from "../../../js/features/assistant/engine/validar.js";
import { plantilla } from "../../../js/ai/tasks/llm.js";
import { createByteBPE } from "../../../js/ai/engine/bytebpe.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const esq = construirEsquema([]), msgs = construirMensajes(esq, "más cálida y con grano");
ok(msgs[0].role === "system" && /- wb: Calidez y tinte \[temp -100\.\.100/.test(msgs[0].content), "el aviso no lista las herramientas con rango");
ok(msgs[1].content === "más cálida y con grano", "mensaje del usuario");
ok(plantilla(msgs).endsWith("<|im_start|>assistant\n") && plantilla(msgs).startsWith("<|im_start|>system\n"), "plantilla de chat");
const p1 = leerPlan('Claro:\n```json\n{"pasos":[{"herramienta":"wb","valores":{"temp":500}},{"herramienta":"hackear","valores":{}}]}\n```');
ok(p1 && p1.pasos.length === 2, "no lee el JSON entre texto");
const v = validarPlan(p1, esq);
ok(v.pasos.length === 1 && v.pasos[0].valores.temp === 100 && v.rechazados.length === 1, "la validación no recorta/rechaza: " + JSON.stringify(v));
ok(leerPlan("no tengo plan") === null && leerPlan('{"x":1}') === null && leerPlan('{"pasos":[') === null, "debe devolver null si no hay plan");
ok(leerPlan('{"pasos":[{"herramienta":"gray","valores":{"a":"}"}}]}')?.pasos.length === 1, "llaves dentro de cadenas");
const tk = createByteBPE(JSON.parse(fs.readFileSync("assets/models/qwen2.5-1.5b/tokenizer.json", "utf8")));
const ids = tk.encode("<|im_start|>user\nhazla más cálida, con grano; quita la neblina (un poco) 123<|im_end|>\n", { especiales: false });
ok(ids.slice(0, 3).join() === "151644,872,198" && ids.at(-2) === 151645 && ids.includes(220) , "tokenizador de Qwen: " + ids.join());
console.log("aviso:", msgs[0].content.length, "caracteres,", tk.encode(plantilla(msgs), { especiales: false }).length, "tokens");
console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
