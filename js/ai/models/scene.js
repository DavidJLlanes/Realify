/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · ESCENA (antiguos de TensorFlow.js)
   Lente (MobileNet), cielo (DeepLab ADE20K) y personas (BodyPix), convertidos a ONNX.
   ═══════════════════════════════════════════════════════════════ */

import { LOCAL } from "./base.js";

export const SCENE = {
  /* ── Antiguos modelos de TensorFlow.js, convertidos a ONNX con tf2onnx
        (mismos pesos, sin TF.js): viajan con la web y funcionan sin
        conexión. Apache-2.0 (tfjs-models de Google). ──
     · lens: MobileNet v1 0,25 (ImageNet), entrada 1×224×224×3 en -1…1,
       salida 1×1000 (softmax). Adaptive Photo Lens.
     · sky: DeepLab v3 MobileNetV2 (ADE20K), entrada 1×H×W×3 uint8 con
       H, W ≤ 513 (el grafo rellena hasta 513), salida los «logits»
       1×151×129×129 (cortado antes del ArgMax: da la probabilidad, no
       sólo la clase). Cielo = clase 3.
     · person: BodyPix MobileNetV1 0,75 (stride 16), entrada 1×H×W×3 en
       -1…1 con H, W = 16k + 1; salida float_segments (sigmoide = persona). */
  lens:     { url: LOCAL + "mobilenet/mobilenet_v1_025.onnx", size: 1890852,
              label: "MobileNet v1", license: "Apache-2.0" },
  sky:      { url: LOCAL + "deeplab-ade20k/deeplab_ade20k.onnx", size: 9245870,
              label: "DeepLab v3 (ADE20K)", license: "Apache-2.0" },
  person:   { url: LOCAL + "bodypix/bodypix_mnv1_075.onnx", size: 5220333,
              label: "BodyPix", license: "Apache-2.0" },
};
