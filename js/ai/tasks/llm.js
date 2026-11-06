/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · MODELO DE LENGUAJE (Qwen2.5 1,5B Instruct, F14.1)
   Genera texto en el worker, con WebGPU si hay (si no, WebAssembly: muy lento). Aplica la plantilla de chat de Qwen (<|im_start|>rol … <|im_end|>),
   pasa el aviso entero de una vez y escribe palabra a palabra de forma voraz (sin azar: el mismo pedido da el mismo plan), con memoria de atención (KV).
   Entradas: mensajes [{ role, content }] y maxTokens. Salida: { text, ids, tokens, ms }.
   Límites: 1,2 GB de pesos; contexto práctico de unos 2 000 tokens (el aviso con la lista de herramientas ocupa ~1 000). El tokenizador sale de
   assets/models/qwen2.5-1.5b/ y el modelo remoto se baja una vez (aviso previo). Un modelo de más de 100 MB se libera al acabar cada petición.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { MODELS } from "../models.js";
import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { createByteBPE } from "../engine/bytebpe.js";
import { readFloats } from "../engine/tensors.js";

const EOS = new Set([151645, 151643]);
let tokenizer = null;
const cargar = () => tokenizer || (tokenizer = fetch(new URL("../../../assets/models/qwen2.5-1.5b/tokenizer.json", import.meta.url)).then(r => r.json()).then(createByteBPE));

/** Plantilla de chat de Qwen2.5: cada mensaje entre <|im_start|> y <|im_end|>, y se deja abierto el turno del asistente. */
export const plantilla = mensajes => mensajes.map(m => `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`).join("") + "<|im_start|>assistant\n";

const i64 = (a, dims) => new ort.Tensor("int64", BigInt64Array.from(a, BigInt), dims);

export async function llm({ id = "qwen15", mensajes, maxTokens = 300 }){
  const model = MODELS[id], tk = await cargar(), t0 = performance.now();
  const { session } = await getSession(id, model);
  const prompt = tk.encode(plantilla(mensajes), { especiales: false });
  if(prompt.length > 3000) throw new Error("el pedido es demasiado largo para el modelo");
  const pasados = session.inputNames.filter(n => n.startsWith("past_key_values")), meta = session.inputMetadata?.find?.(m => m.name === pasados[0]);
  const tipoKV = meta?.type === "float16" ? "float16" : "float32", vacio = () => new ort.Tensor(tipoKV, tipoKV === "float16" ? new Uint16Array(0) : new Float32Array(0), [1, 2, 0, 128]);
  const past = {}; for(const n of pasados) past[n] = vacio();
  const salida = []; let entrada = prompt, total = prompt.length;
  post({ type:"stage", model:id, stage:"run" });
  for(let paso = 0; paso < maxTokens; paso++){
    const base = total - entrada.length, feeds = { input_ids: i64(entrada, [1, entrada.length]), attention_mask: i64(new Array(total).fill(1), [1, total]),
      position_ids: i64(entrada.map((_, i) => base + i), [1, entrada.length]), ...past };
    const r = await runSession(id, model, feeds);
    for(const n of pasados) past[n] = r["present." + n.slice("past_key_values.".length)];
    const lg = readFloats(r.logits), V = r.logits.dims[2], o = (r.logits.dims[1] - 1) * V;
    let mejor = -Infinity, sig = 0; for(let v = 0; v < V; v++) if(lg[o + v] > mejor){ mejor = lg[o + v]; sig = v; }
    if(EOS.has(sig)) break;
    salida.push(sig); entrada = [sig]; total++;
    if(paso % 4 === 0) post({ type:"tokens", model:id, done: salida.length, total: maxTokens });
  }
  return { text: tk.decode(salida), ids: salida, tokens: salida.length, ms: Math.round(performance.now() - t0) };
}
