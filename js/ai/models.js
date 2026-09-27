/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO DE MODELOS
   Modelos ONNX publicados por el proyecto ImageToolbox (T8RIN,
   Apache-2.0) en Hugging Face, con los mismos tamaños de entrada y la
   misma preparación de píxeles que usa esa app (ver
   lib/neural-tools y feature/ai-tools en su repositorio).

   · `local`: el archivo viaja con la app (assets/models) y funciona
     sin conexión desde la primera vez.
   · `remote`: se descarga de Hugging Face sólo cuando alguien lo pide
     y se guarda en IndexedDB para las siguientes veces (ver worker.js).
     La CSP de nginx (server/nginx-realify.conf.example) permite
     huggingface.co y *.hf.co SÓLO para esto: se bajan pesos, la imagen
     del usuario nunca sale del equipo. Antes de la primera descarga se
     pide permiso (ver confirmDownload en runtime.js).
   ═══════════════════════════════════════════════════════════════ */

const HF = "https://huggingface.co/T8RIN/ImageToolbox-models/resolve/main/";
const LOCAL = new URL("../../assets/models/", import.meta.url).href;

export const MODELS = {
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
  isnet:    { url: HF + "isnet-general-use.onnx",         size: 178647984, input: 1024,
              label: "ISNet", license: "Apache-2.0" },

  /* ── Relleno: imagen 1×3×512×512 en 0-1 + máscara 1×1×512×512 ── */
  lama:     { url: HF + "onnx/inpaint/lama/LaMa_512.onnx", size: 208044816, input: 512,
              label: "LaMa", license: "Apache-2.0" },

  /* ── Restauración por teselas, entrada dinámica múltiplo de 8.
        FBCNN lleva además `qf_input` (1×1): 0 = suave, 1 = máximo,
        equivale a 1 − calidad JPEG/100. ── */
  scunet:   { url: HF + "onnx/enhance/scunet/scunet_color-PSNR.onnx", size: 91264256,
              tile: 256, tileGpu: 512, minSide: 256, label: "SCUNet", license: "Apache-2.0" },
  fbcnn:    { url: HF + "onnx/enhance/fbcnn/fbcnn_color_fp16.onnx",   size: 143910675,
              tile: 512, minSide: 0, label: "FBCNN", license: "Apache-2.0" }
};

export const mb = bytes => Math.round(bytes / 1e6) + " MB";
