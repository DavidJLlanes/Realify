/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · FLORENCE-2 BASE (describir fotos)
   Cuatro ONNX cuantizados a 8 bits de onnx-community/Florence-2-base (Microsoft, MIT): codificador de visión, tabla de
   incrustaciones de texto, codificador y decodificador «merged» (con memoria de atención). Unos 275 MB en total, todo remoto:
   se descarga al usarlo, avisando del tamaño. Flujo: imagen (pixel_values) → vision_encoder → image_features (768);
   la orden en texto → embed_tokens → inputs_embeds; se unen y pasan por encoder_model; el decodificador genera el texto
   (vocabulario de 51 289). El tokenizador y las configuraciones irán en assets/models/florence2-base/.
   ═══════════════════════════════════════════════════════════════ */

const REV = "d59e079711c57174f29265539fb4cc9f0f335916";
const BASE = "https://huggingface.co/onnx-community/Florence-2-base/resolve/" + REV + "/onnx/";

export const FLORENCE = {
  florence_vision: {
    url: BASE + "vision_encoder_quantized.onnx", size: 93788276, rev: REV,
    sha256: "56351a93ecfb61a0384dc63c130cc5bdeea8de1a85f172e109821c7cc956be5a",
    label: "Florence-2 base · visión (int8)", license: "MIT"
  },
  florence_embed: {
    url: BASE + "embed_tokens_quantized.onnx", size: 39390496, rev: REV,
    sha256: "8818c58a214e53bf7e22c48bb4674c2fa3112b9539c3ce4075a2eac797b1ef74",
    label: "Florence-2 base · incrustaciones (int8)", license: "MIT"
  },
  florence_enc: {
    url: BASE + "encoder_model_quantized.onnx", size: 43651493, rev: REV,
    sha256: "a0459867dc116e8e49f53073e368e45c21169d0b0dd7dc350abed06926e0d835",
    label: "Florence-2 base · codificador (int8)", license: "MIT"
  },
  florence_dec: {
    url: BASE + "decoder_model_merged_quantized.onnx", size: 98177854, rev: REV,
    sha256: "7ffecf4dd98784308878fd52a7f95ed64f5ed025b4785f6f105450be8fe2be04",
    label: "Florence-2 base · decodificador (int8)", license: "MIT"
  }
};
