/* Prueba del tokenizador CLIP de js/ai/cliptokenizer.js contra la referencia (tokenizers de Hugging Face con el tokenizer.json del modelo).
   Uso: node tests/cliptokenizer.mjs <carpeta-con-tokenizer.json>   (por defecto /tmp/clipseg) */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import { createTokenizer } from "../js/ai/cliptokenizer.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), ref = process.argv[2] || "/tmp/clipseg";
const tok = createTokenizer(JSON.parse(fs.readFileSync(path.join(root, "assets/models/clipseg/vocab.json"), "utf8")), fs.readFileSync(path.join(root, "assets/models/clipseg/merges.txt"), "utf8"));
const cases = ["an airplane", "a photo of a red cup!", "un avión rojo", "The Sky, 2 dogs", "  Muchos   espacios\ty\nsaltos ", "ÁÉÍÓÚ ñandú niño", "it's we're they'll I'd", "🙂 emoji 日本語 mixed", "coche rojo y una taza azul con un dibujo",
  "a very long prompt ".repeat(30), "", "x", "1234567890", "café con leche, por favor.", "<|startoftext|>raw<|endoftext|>"];
const expected = JSON.parse(execFileSync("python3", ["-c", `
import json,sys
from tokenizers import Tokenizer
t=Tokenizer.from_file(sys.argv[1]+'/tokenizer.json')
print(json.dumps([t.encode(c).ids[:77] if len(t.encode(c).ids)<=77 else t.encode(c).ids[:76]+[49407] for c in json.loads(sys.argv[2])]))`, ref, JSON.stringify(cases)], { encoding: "utf8" }));
let bad = 0;
cases.forEach((c, i) => { const got = tok.encode(c); if(JSON.stringify(got) !== JSON.stringify(expected[i])){ bad++; console.log("FALLO:", JSON.stringify(c.slice(0, 40)), "\n  esperado", expected[i].slice(0, 12), "\n  obtenido", got.slice(0, 12)); } });
const p = tok.pad("an airplane"); if(p.ids.length !== 77 || p.mask.slice(0, 5).join() !== "1,1,1,1,0" || p.ids[10] !== 49407){ bad++; console.log("FALLO: pad"); }
console.log(bad ? "cliptokenizer: FALLO" : `cliptokenizer: OK (${cases.length} frases idénticas a la referencia)`); process.exit(bad ? 1 : 0);
