/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · PROFUNDIDAD
   Depth Anything V2 Small en float16.
   ═══════════════════════════════════════════════════════════════ */

import { LOCAL } from "./base.js";

export const DEPTH = {
  /* ── Profundidad: Depth Anything V2 Small (Apache-2.0), convertido a
        float16 (50 MB, 0,02 % de diferencia con el original). Viaja con la
        web, se guarda en IndexedDB y se avisa antes de bajarlo. ── */
  depth:    { url: LOCAL + "depthanything/depth_anything_v2_small_fp16.onnx", size: 49981786, store: true, premium: true,
              label: "Depth Anything V2", license: "Apache-2.0" },
};
