/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · MODELO DE LENGUAJE (asistente, F14.1)
   Qwen2.5 1,5B Instruct cuantizado (q4f16, ONNX): interpreta la orden escrita o dictada y devuelve el plan JSON que valida
   js/features/assistant/engine/validar.js. Los pesos son remotos (Hugging Face, onnx-community); el tokenizador y las
   configuraciones viajan con la web en assets/models/qwen2.5-1.5b/.
   Límites: 1,22 GB; sólo se descarga al usarlo, avisando antes. El `sha256` es el de model_q4f16.onnx (comprobado por
   js/ai/engine/model-store.js). La URL está fijada al commit `rev` (revisión inmutable).
   ═══════════════════════════════════════════════════════════════ */

import { LOCAL } from "./base.js";

export const LLM = {
  qwen15: {
    url: "https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct/resolve/9f9c976052bfb08a20793f0c3013563dc095c966/onnx/model_q4f16.onnx",
    size: 1220000000,
    sha256: "19dec9f63488016185ba997d5e4492b5ac5b4f7ef1abb45243a91de958838dcd",
    rev: "9f9c976052bfb08a20793f0c3013563dc095c966",
    local: { dir: LOCAL + "qwen2.5-1.5b/", files: ["tokenizer.json", "tokenizer_config.json", "config.json", "generation_config.json"] },
    label: "Qwen2.5 1,5B Instruct (q4f16)", license: "Apache-2.0", llm: true
  }
};
