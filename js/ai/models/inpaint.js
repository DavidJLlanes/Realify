/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · RELLENO
   Relleno de huecos (LaMa, 512×512).
   ═══════════════════════════════════════════════════════════════ */

import { HF } from "./base.js";

export const INPAINT = {
  /* ── Relleno: imagen 1×3×512×512 en 0-1 + máscara 1×1×512×512 ── */
  lama:     { url: HF + "onnx/inpaint/lama/LaMa_512.onnx", size: 208044816, input: 512,
              label: "LaMa", license: "Apache-2.0" },
};
