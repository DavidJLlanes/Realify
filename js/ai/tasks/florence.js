/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · FLORENCE-2 (describir una foto)
   Cadena completa dentro del worker: visión (768×768) → incrustaciones de la orden → codificador → decodificador «merged» con memoria de atención,
   generando el texto en inglés palabra a palabra (voraz, con «no repetir trigramas» y el primer símbolo forzado a <s>, como la configuración oficial).
   Entradas: rgba 768×768, prompt (orden en texto, p. ej. «What does the image describe?») y maxTokens. Salida: { text, ids }.
   Límites: sin búsqueda en haz (3 haces en la oficial): algo más corto y menos pulido a cambio de ir ~3× más rápido en un móvil.
   Los cuatro modelos son de la familia «florence» del catálogo: se piden y se avisan juntos.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { MODELS } from "../models.js";
import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { createByteBPE } from "../engine/bytebpe.js";

const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225], S = 768, HEADS = 12, DIM = 64, START = 2, BOS = 0, EOS = 2, NOREPEAT = 3;
let tokenizer = null;
const cargarTokenizador = async () => tokenizer || (tokenizer = fetch(new URL("../../../assets/models/florence2-base/tokenizer.json", import.meta.url)).then(r => r.json()).then(createByteBPE));

const i64 = (a, dims) => new ort.Tensor("int64", BigInt64Array.from(a, BigInt), dims);
const f32 = (a, dims) => new ort.Tensor("float32", a, dims);
const correr = async (id, feeds) => { await getSession(id, MODELS[id]); return runSession(id, MODELS[id], feeds); };

/** Impide repetir un trigrama: ids que cerrarían un grupo de `n` ya visto. */
export function prohibidos(salida, n = NOREPEAT){
  if(salida.length < n - 1) return new Set();
  const previo = salida.slice(salida.length - (n - 1)).join(","), vedados = new Set();
  for(let i = 0; i + n <= salida.length; i++) if(salida.slice(i, i + n - 1).join(",") === previo) vedados.add(salida[i + n - 1]);
  return vedados;
}

export async function florence({ rgba, prompt = "What does the image describe?", maxTokens = 60 }){
  const tk = await cargarTokenizador(), n = S * S, px = new Float32Array(3 * n);
  for(let p = 0, i = 0; p < n; p++, i += 4) for(let c = 0; c < 3; c++) px[c * n + p] = (rgba[i + c] / 255 - MEAN[c]) / STD[c];
  post({ type:"stage", model:"florence_vision", stage:"run" });
  const feat = (await correr("florence_vision", { pixel_values: f32(px, [1, 3, S, S]) })).image_features;
  const ids = tk.encode(prompt), texto = (await correr("florence_embed", { input_ids: i64(ids, [1, ids.length]) })).inputs_embeds;
  const juntos = new Float32Array(feat.data.length + texto.data.length); juntos.set(feat.data); juntos.set(texto.data, feat.data.length);
  const largo = feat.dims[1] + texto.dims[1], mask = new Array(largo).fill(1);
  const enc = (await correr("florence_enc", { attention_mask: i64(mask, [1, largo]), inputs_embeds: f32(juntos, [1, largo, 768]) })).last_hidden_state;

  const dec = await getSession("florence_dec", MODELS.florence_dec), pasados = dec.session.inputNames.filter(nm => nm.startsWith("past_key_values"));
  const past = {}; for(const nm of pasados) past[nm] = f32(new Float32Array(0), [1, HEADS, 0, DIM]);
  const salida = [START]; let usaCache = false;
  for(let paso = 0; paso < maxTokens + 1; paso++){
    const emb = (await correr("florence_embed", { input_ids: i64([salida[salida.length - 1]], [1, 1]) })).inputs_embeds;
    const r = await correr("florence_dec", { encoder_attention_mask: i64(mask, [1, largo]), encoder_hidden_states: enc, inputs_embeds: emb,
      use_cache_branch: new ort.Tensor("bool", [usaCache], [1]), ...past });
    for(const nm of pasados){ const pr = "present." + nm.slice("past_key_values.".length); if(!usaCache || nm.includes(".decoder.")) past[nm] = r[pr]; }
    usaCache = true;
    let sig;
    if(paso === 0) sig = BOS;                                        // forced_bos_token_id
    else{
      const lg = r.logits.data, V = lg.length, vet = prohibidos(salida);
      let mejor = -Infinity; sig = EOS;
      for(let v = 0; v < V; v++) if(lg[v] > mejor && !vet.has(v)){ mejor = lg[v]; sig = v; }
    }
    salida.push(sig);
    if(sig === EOS) break;
  }
  return { text: tk.decode(salida), ids: salida };
}
