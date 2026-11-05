/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · SEGMENTACIÓN
   Eliminar fondo (U²-Net, MODNet, ISNet), Segment Anything y CLIPSeg (selección por descripción libre).
   Cada entrada es un descriptor: url, size, input, label, license y, según el modelo, norm, store, group, premium o cpu.
   ═══════════════════════════════════════════════════════════════ */

import { HF, LOCAL } from "./base.js";

export const SEGMENTATION = {
  /* ── Eliminar fondo: entrada 1×3×N×N en 0-1, salida 1×1×N×N (alfa) ── */
  u2netp:   { url: LOCAL + "u2netp/u2netp.onnx",          size: 4574861,   input: 320,
              label: "U²-Net portátil", license: "Apache-2.0" },
  modnet:   { url: HF + "modnet_portrait_matting.onnx",   size: 25888640,  input: 512,
              label: "MODNet (retrato)", license: "Apache-2.0", norm: [0.5, 0.5], cpu: true },
  /* BiRefNet (birefnet_swin_tiny) se probó y se descartó: en WebGPU
     necesita 17 buffers por shader y los navegadores dan 16 incluso en
     GPUs de gama alta, y en la CPU agota los 4 GB de WebAssembly a
     1024 px. ISNet, de la misma familia de alta resolución, cabe en las
     dos. */
  /* ISNet espera la imagen centrada en 0 (media 0,5, desviación 1) y su
     salida se estira a 0-1 con su mínimo y su máximo, igual que hace
     rembg con este mismo archivo: sin eso la máscara salía casi
     uniforme y «Eliminar fondo» parecía no hacer nada. */
  isnet:    { url: HF + "isnet-general-use.onnx",         size: 178647984, input: 1024,
              label: "ISNet", license: "Apache-2.0", norm: [0.5, 1], minmax: true },

  /* ── Segment Anything (Premium 👑): MobileSAM codifica la foto una vez
        (1×3×1024×1024) y el decodificador de SAM saca la máscara de cada
        toque en milisegundos. Viajan con la web (assets/models/mobilesam,
        Apache-2.0, ver su LICENSE.txt) pero son grandes: `store` los
        guarda en IndexedDB y se avisa antes de bajarlos, como los de
        Hugging Face; `group` permite tener los dos a la vez en memoria. ── */
  sam_enc:  { url: LOCAL + "mobilesam/mobilesam_encoder.onnx", size: 28106856, store: true, group: "sam", premium: true,
              label: "MobileSAM", license: "Apache-2.0" },
  sam_dec:  { url: LOCAL + "mobilesam/sam_decoder.onnx",       size: 16509322, store: true, group: "sam", premium: true,
              label: "SAM (máscaras)", license: "Apache-2.0" },

  /* ── Selección por descripción libre: CLIPSeg rd64-refined (CIDAS, Apache-2.0), en la conversión a ONNX de Xenova, float16
        (273 MB; la cuantizada a INT8/Q4 empeora y no se usa). Entradas: input_ids y attention_mask (int64, 1×77, tokenizador de CLIP
        en js/ai/cliptokenizer.js), pixel_values 1×3×352×352 con media/desviación de ImageNet; salida los «logits» 352×352 (sigmoide =
        probabilidad de que el píxel sea lo descrito). Sólo se descarga al usarlo, avisando antes. CPU: el resultado con WebGPU no se
        ha podido validar (no hay GPU en el entorno de pruebas); quien quiera probarlo en su dispositivo puede activar `localStorage["realify.clipsegGpu"] = "1"`
        y recargar: el modelo pasa a WebGPU y la consola del worker avisa del backend; si el resultado sale distinto, se quita. ── */
  clipseg:  { url: "https://huggingface.co/Xenova/clipseg-rd64-refined/resolve/main/onnx/model_fp16.onnx", size: 273352075, store: true, premium: true, cpu: !(() => { try{ return localStorage.getItem("realify.clipsegGpu") === "1"; }catch{ return false; } })(),
              label: "CLIPSeg (descripción libre)", license: "Apache-2.0" },
};
