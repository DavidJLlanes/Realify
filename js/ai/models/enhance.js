/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · MEJORAR Y RESTAURAR
   Superresolución, colorear y restauración por teselas (SCUNet, FBCNN).
   Los modelos de uso no comercial llevan `noncommercial: true` (ver docs/MODELOS.md).
   ═══════════════════════════════════════════════════════════════ */

import { HF, LOCAL } from "./base.js";

export const ENHANCE = {
  /* ── Ampliar (superresolución) por teselas: entrada RGB 0-1 de tamaño
        libre, salida `scale` veces mayor. Los .ort (formato optimizado
        de ONNX Runtime) se cargan igual que los .onnx. ── */
  span_x2:    { url: HF + "upscalers/2xLiveActionV1_SPAN_490000.onnx", size: 1654748, scale: 2, tile: 256,
                label: "SPAN ×2", license: "ver OpenModelDB" },
  esrgan_x4:  { url: HF + "onnx/enhance/upscale/RealESRGAN-x4v3.ort", size: 2621440, scale: 4, tile: 192,
                label: "Real-ESRGAN ×4 v3", license: "BSD-3-Clause" },
  anime_x4:   { url: HF + "onnx/enhance/upscale/RealESRGAN_x4plus_anime_4B32F.ort", size: 5241720, scale: 4, tile: 160,
                label: "Real-ESRGAN ×4 ilustración", license: "BSD-3-Clause" },
  sharp_x4:   { url: HF + "onnx/enhance/upscale/x4-UltraSharpV2_Lite_fp16_op17.ort", size: 16055408, scale: 4, tile: 128,
                label: "UltraSharp ×4 V2 Lite", license: "CC BY-NC-SA 4.0", noncommercial: true },

  /* ── Colorear: los «1x» devuelven la foto en color al mismo tamaño;
        DDColor recibe 512×512 (la luminancia en RGB) y devuelve los
        canales a y b de Lab. En los dos casos sólo se usa el COLOR del
        resultado, aplicado a la luminancia original a tamaño completo. ── */
  sponge:     { url: HF + "onnx/enhance/other-models/1x-SpongeColor-Lite-fp16.onnx", size: 10112988, tile: 512, work: 768,
                label: "SpongeColor Lite", license: "ver OpenModelDB", colorize: "rgb" },
  colorizer:  { url: HF + "onnx/enhance/other-models/1x_ColorizerV2_22000G-fp16.onnx", size: 33456842, tile: 512, work: 768,
                label: "Colorizer V2", license: "ver OpenModelDB", colorize: "rgb" },
  ddcolor:    { url: HF + "onnx/enhance/other-models/ddcolor_paper_tiny.ort", size: 220853232, input: 512,
                label: "DDColor Tiny", license: "Apache-2.0", colorize: "ab" },

  /* ── Restauración por teselas, entrada dinámica múltiplo de 8.
        FBCNN lleva además `qf_input` (1×1): 0 = suave, 1 = máximo,
        equivale a 1 − calidad JPEG/100. ── */
  scunet:   { url: HF + "onnx/enhance/scunet/scunet_color-PSNR.onnx", size: 91264256,
              tile: 256, tileGpu: 512, minSide: 256, label: "SCUNet", license: "Apache-2.0" },
  fbcnn:    { url: HF + "onnx/enhance/fbcnn/fbcnn_color_fp16.onnx",   size: 143910675,
              tile: 512, minSide: 0, label: "FBCNN", license: "Apache-2.0" },

  /* ── Quitar desenfoque: NAFNet GoPro width32 (megvii-research, MIT), exportado a ONNX con tools/models/exportar-nafnet.py y con
        los pesos grandes en fp16 (tools/models/pesos-fp16.py; 98 dB de diferencia con el original). Entrada RGB 0-1
        [1,3,alto,ancho] con alto y ancho MÚLTIPLOS DE 16 (la app rellena el borde de cada tesela); salida igual. Incluido en la web. ── */
  nafnet:   { url: LOCAL + "nafnet/nafnet_gopro_w32_fp16.onnx", size: 34961419,
              sha256: "2650545a4831f6468399fcb400e8ab7d7e560c1742c11111dc3691c48c8108fb",
              tile: 256, multiple: 16, label: "NAFNet (quitar desenfoque)", license: "MIT" }
};
