/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · PROFUNDIDAD
   Depth Anything V2 Small (en la web) y Base (remoto, uso no comercial), en float16.
   ═══════════════════════════════════════════════════════════════ */

import { LOCAL } from "./base.js";

export const DEPTH = {
  /* ── Profundidad: Depth Anything V2 Small (Apache-2.0), convertido a
        float16 (50 MB, 0,02 % de diferencia con el original). Viaja con la
        web, se guarda en IndexedDB y se avisa antes de bajarlo. ── */
  depth:    { url: LOCAL + "depthanything/depth_anything_v2_small_fp16.onnx", size: 49981786, store: true, premium: true,
              label: "Depth Anything V2", license: "Apache-2.0" },

  /* ── Profundidad de más calidad: Depth Anything V2 Base (CC-BY-NC-4.0, NO comercial) en float16 de
        onnx-community/depth-anything-v2-base. Entrada pixel_values [1, 3, alto, ancho] (múltiplos de 14, media/desviación de
        ImageNet) y salida predicted_depth [1, alto, ancho]; entradas y salidas en float32. 195 MB remoto, con aviso de tamaño.
        La URL está fijada al commit `rev` y el sha256 protege el archivo. ── */
  depth_base: { url: "https://huggingface.co/onnx-community/depth-anything-v2-base/resolve/dd4557d492cd7b563738ac8d9ccff9094620983c/onnx/model_fp16.onnx", size: 194570657, rev: "dd4557d492cd7b563738ac8d9ccff9094620983c",
                sha256: "822e6c12f36cd46753dcf229ce87199310533de2d533a527756b8ef30a76d158", store: true, premium: true,
                label: "Depth Anything V2 Base (fp16)", license: "CC-BY-NC-4.0", noncommercial: true },
};
