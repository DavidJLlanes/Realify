/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · VOZ (Whisper tiny, F14.4)
   Dictado de la orden al asistente y subtítulos del editor de vídeo. Whisper tiny multilingüe (OpenAI, MIT) en ONNX
   cuantizado a 8 bits, de onnx-community/whisper-tiny-ONNX. El codificador (10 MB) viaja con la web; el decodificador
   «merged» (110 MB, con memoria de atención incluida) se descarga al usarlo, avisando antes. El tokenizador y las
   configuraciones están en assets/models/whisper-tiny/.
   Entrada del codificador: input_features [1, 80, 3000] (log-mel de 30 s a 16 kHz). Salida: last_hidden_state [1, 1500, 384].
   ═══════════════════════════════════════════════════════════════ */

import { LOCAL } from "./base.js";

const REV = "ea7c447ab3780e36818661384dea74a8e6b82fc6";

export const VOZ = {
  whisper_enc: {
    url: LOCAL + "whisper-tiny/encoder_model_quantized.onnx", size: 10072851,
    sha256: "959c5e7f2a915cf52c274343ffe2b5a54ccbc68af34166e9bfa2a43fcea87425",
    label: "Whisper tiny · codificador (int8)", license: "MIT"
  },
  whisper_dec: {
    url: "https://huggingface.co/onnx-community/whisper-tiny-ONNX/resolve/" + REV + "/onnx/decoder_model_merged_quantized.onnx",
    size: 109684097, rev: REV,
    sha256: "49f1546333cf31f05ffd57f7d46597fef0fdfe527991432b725461f13141a435",
    label: "Whisper tiny · decodificador (int8)", license: "MIT"
  }
};
