/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · WHISPER TINY (voz → texto)
   Recibe el log-mel de hasta 30 s (js/ai/engine/mel.js), pasa el codificador (whisper_enc, incluido en la web) y genera el texto con el
   decodificador «merged» (whisper_dec, remoto) de forma voraz: <|startoftranscript|> <|idioma|> <|transcribe|> <|notimestamps|> y a escribir
   hasta <|endoftext|>. Se anulan los símbolos que la configuración oficial suprime y todos los especiales (no hay marcas de tiempo).
   Entradas: mel Float32 [80×3000], idioma ("es", "en"…) y maxTokens. Salida: { text, ids }.
   Límites: sólo transcribe (no traduce); un solo tramo de 30 s; la calidad de «tiny» es modesta con ruido o acentos fuertes.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { MODELS } from "../models.js";
import { getSession, runSession } from "../engine/sessions.js";
import { post } from "../engine/post.js";
import { createByteBPE } from "../engine/bytebpe.js";

export const IDIOMAS = { en: 50259, zh: 50260, de: 50261, es: 50262, ru: 50263, fr: 50265, pt: 50267, it: 50274, ca: 50270 };
const SOT = 50258, EOT = 50257, TRANSCRIBE = 50359, NOTS = 50363, HEADS = 6, DIM = 64;
let cargado = null;
const recursos = () => cargado || (cargado = Promise.all([
  fetch(new URL("../../../assets/models/whisper-tiny/tokenizer.json", import.meta.url)).then(r => r.json()).then(createByteBPE),
  fetch(new URL("../../../assets/models/whisper-tiny/generation_config.json", import.meta.url)).then(r => r.json())
]).then(([tk, gen]) => ({ tk, suprimir: new Set(gen.suppress_tokens || []), inicio: new Set(gen.begin_suppress_tokens || []) })));

const i64 = (a, dims) => new ort.Tensor("int64", BigInt64Array.from(a, BigInt), dims);

export async function whisper({ mel, lang = "es", maxTokens = 200 }){
  const { tk, suprimir, inicio } = await recursos(), idioma = IDIOMAS[lang] || IDIOMAS.es;
  const enc = await getSession("whisper_enc", MODELS.whisper_enc);
  post({ type:"stage", model:"whisper_enc", stage:"run" });
  const h = (await runSession("whisper_enc", MODELS.whisper_enc, { [enc.session.inputNames[0]]: new ort.Tensor("float32", mel, [1, 80, 3000]) })).last_hidden_state;
  const dec = await getSession("whisper_dec", MODELS.whisper_dec), pasados = dec.session.inputNames.filter(n => n.startsWith("past_key_values"));
  const past = {}; for(const n of pasados) past[n] = new ort.Tensor("float32", new Float32Array(0), [1, HEADS, 0, DIM]);
  const salida = [SOT, idioma, TRANSCRIBE, NOTS], texto = []; let entrada = salida.slice(), usaCache = false;
  for(let paso = 0; paso < maxTokens; paso++){
    const r = await runSession("whisper_dec", MODELS.whisper_dec, { input_ids: i64(entrada, [1, entrada.length]), encoder_hidden_states: h, use_cache_branch: new ort.Tensor("bool", [usaCache], [1]), ...past });
    for(const n of pasados){ const pr = "present." + n.slice("past_key_values.".length); if(!usaCache || n.includes(".decoder.")) past[n] = r[pr]; }
    usaCache = true;
    const lg = r.logits.data, V = r.logits.dims[2], o = (entrada.length - 1) * V;
    let mejor = -Infinity, sig = EOT;
    for(let v = 0; v < V; v++){
      if(suprimir.has(v) || (v > EOT && v !== EOT) || (paso === 0 && inicio.has(v))) continue;
      if(lg[o + v] > mejor){ mejor = lg[o + v]; sig = v; }
    }
    if(sig === EOT) break;
    texto.push(sig); entrada = [sig];
  }
  return { text: tk.decode(texto), ids: texto };
}
