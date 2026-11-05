/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · CARAS
   Detección (YuNet), zonas de la cara (BiSeNet, no comercial) y restauración (GFPGAN).
   ═══════════════════════════════════════════════════════════════ */

import { LOCAL } from "./base.js";

export const FACES = {
  /* ── Caras: YuNet 2023mar (OpenCV Zoo, Shiqi Yu et al., MIT), 232 KB,
        incluido en la web. Entrada BGR 0-255 de tamaño libre (múltiplo
        de 32); cajas y 5 puntos de la cara. ── */
  yunet:    { url: LOCAL + "yunet/face_detection_yunet_2023mar.onnx", size: 232589, premium: true,
              label: "YuNet (caras)", license: "MIT" },

  /* ── Zonas de la cara: BiSeNet ResNet-18 (yakhyo/face-parsing, código
        MIT). OJO: entrenado con CelebAMask-HQ, cuyo uso es sólo para
        investigación no comercial: si algún día Premium es de pago, hay
        que quitarlo o sustituirlo (ver CLAUDE.md y ATTRIBUTIONS.md). Lo
        usan Retoque de cara y Seleccionar por texto (pelo, ojos, labios…). ── */
  faceparse: { url: LOCAL + "faceparsing/resnet18.onnx", size: 53205364, store: true, premium: true, noncommercial: true,
               label: "BiSeNet (zonas de la cara)", license: "MIT (datos CelebAMask-HQ: no comercial)" },

  /* ── Restaurar caras: GFPGAN v1.4 (Apache-2.0), float16. Entrada y
        salida 1×3×512×512 RGB en -1…1 con la cara alineada a la plantilla
        FFHQ. 170 MB en dos trozos (GitHub no admite archivos de más de
        100 MB): el worker los une y guarda el modelo entero en IndexedDB. ── */
  /* Partido en dos mitades (codificador y decodificador) para que en un
     móvil quepa cada una sola en memoria; ver faceRestore en worker.js.
     Mismo grupo: una sola descarga y un solo aviso (170 MB en total). */
  gfpgan_enc: { url: LOCAL + "gfpgan/gfpgan_enc_fp16.onnx", size: 112420987, store: true, premium: true, group: "gfpgan",
              parts: [LOCAL + "gfpgan/gfpgan_enc_fp16.part0", LOCAL + "gfpgan/gfpgan_enc_fp16.part1"],
              label: "GFPGAN 1.4 · codificador", license: "Apache-2.0" },
  gfpgan_dec: { url: LOCAL + "gfpgan/gfpgan_dec_fp16.onnx", size: 57870819, store: true, premium: true, group: "gfpgan",
              label: "GFPGAN 1.4 · generador", license: "Apache-2.0" },
};
