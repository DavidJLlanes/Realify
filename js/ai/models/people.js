/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · PERSONAS
   Puntos de la cara (MediaPipe), manos (MediaPipe), pose (RTMPose) y partes del cuerpo y ropa (SegFormer).
   Todos van en assets/models/people/ (ONNX); cómo se convirtieron y sus licencias, en docs/MODELOS.md.
   ═══════════════════════════════════════════════════════════════ */

import { LOCAL } from "./base.js";

const P = LOCAL + "people/";

export const PEOPLE = {
  /* ── Puntos de la cara: MediaPipe Face Landmarker (Apache-2.0), `face_landmarks_detector` convertido de TFLite a ONNX con
        tf2onnx. Entrada 1×256×256×3 en 0…1 (RGB), salida 478 puntos (x, y en píxeles de la entrada, z) y un valor de presencia. ── */
  facelm:   { url: P + "face_landmarks_detector.onnx", size: 4921000, premium: true,
              label: "MediaPipe · puntos de la cara", license: "Apache-2.0" },
  /* ── Manos: MediaPipe Hand Landmarker (Apache-2.0). `handdet` (detector de palma, 1×192×192×3 en 0…1; 2016 anclas × 18) y
        `handlm` (1×224×224×3 en 0…1; 21 puntos x, y, z en píxeles, presencia y lado). ── */
  handdet:  { url: P + "hand_detector.onnx", size: 4589377, premium: true,
              label: "MediaPipe · detector de manos", license: "Apache-2.0" },
  handlm:   { url: P + "hand_landmarks_detector.onnx", size: 10903210, premium: true,
              label: "MediaPipe · puntos de la mano", license: "Apache-2.0" },
  /* ── Pose: RTMPose-m (cuerpo, 17 puntos COCO; OpenMMLab, Apache-2.0) entrenado con Body7; pesos en fp16 con cálculo en fp32.
        Entrada 1×3×256×192 normalizada (media 123,675/116,28/103,53 · desv. 58,395/57,12/57,375), salida SimCC: simcc_x (384)
        y simcc_y (512) por punto (posición = índice / 2). ── */
  pose:     { url: P + "rtmpose_m_body7_fp16.onnx", size: 27211227, store: true, premium: true,
              label: "RTMPose-m (pose)", license: "Apache-2.0 (datos Body7: COCO, AIC, CrowdPose, MPII… por revisar)" },
  /* ── Partes del cuerpo y ropa: SegFormer-B2 «clothes» (mattmdjaga/segformer_b2_clothes, MIT; datos ATR: por revisar), 18
        clases (fondo, sombrero, pelo, gafas, ropa de arriba, falda, pantalón, vestido, cinturón, zapatos, cara, piernas, brazos,
        bolso, bufanda). Pesos en fp16 con cálculo en fp32. Entrada 1×3×512×512 (ImageNet), salida 1×18×128×128. ── */
  humanparse: { url: P + "segformer_b2_clothes_fp16.onnx", size: 55455085, store: true, premium: true, noncommercial: true,
                label: "SegFormer-B2 (partes y ropa)", license: "MIT (datos ATR: licencia por revisar; se marca no comercial por precaución)" }
};
