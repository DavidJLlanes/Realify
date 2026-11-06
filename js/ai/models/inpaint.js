/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · RELLENO
   Relleno de huecos: LaMa (512×512, remoto) y MI-GAN (pipeline completo, 28 MB, incluido en la web).
   ═══════════════════════════════════════════════════════════════ */

import { HF, LOCAL } from "./base.js";

export const INPAINT = {
  /* ── Relleno: imagen 1×3×512×512 en 0-1 + máscara 1×1×512×512 ── */
  lama:     { url: HF + "onnx/inpaint/lama/LaMa_512.onnx", size: 208044816, input: 512,
              label: "LaMa", license: "Apache-2.0" },

  /* ── MI-GAN 512 (Places2), MIT: el pipeline ONNX oficial de Picsart AI Research. Entradas: image uint8 [1,3,alto,ancho] (RGB) y
        mask uint8 [1,1,alto,ancho] (255 = conservar, 0 = rellenar, binaria); salida: result uint8 [1,3,alto,ancho]. Recorta alrededor de
        la máscara, reescala a 512, normaliza, rellena, devuelve al tamaño original y mezcla con la imagen: no hay que preprocesar.
        Acepta cualquier resolución; con huecos grandes en fotos grandes rinde mejor a trazos pequeños. Más ligero que LaMa. ── */
  migan:    { url: LOCAL + "migan/migan_pipeline_v2.onnx", size: 28079181,
              sha256: "6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b",
              label: "MI-GAN (relleno ligero)", license: "MIT" },
};
