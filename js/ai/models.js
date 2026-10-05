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
  /* ISNet espera la imagen centrada en 0 (media 0,5, desviación 1) y su
     salida se estira a 0-1 con su mínimo y su máximo, igual que hace
     rembg con este mismo archivo: sin eso la máscara salía casi
     uniforme y «Eliminar fondo» parecía no hacer nada. */
  isnet:    { url: HF + "isnet-general-use.onnx",         size: 178647984, input: 1024,
              label: "ISNet", license: "Apache-2.0", norm: [0.5, 1], minmax: true },

  /* ── Relleno: imagen 1×3×512×512 en 0-1 + máscara 1×1×512×512 ── */
  lama:     { url: HF + "onnx/inpaint/lama/LaMa_512.onnx", size: 208044816, input: 512,
              label: "LaMa", license: "Apache-2.0" },

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
                label: "UltraSharp ×4 V2 Lite", license: "CC BY-NC-SA 4.0" },

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

  /* ── Profundidad: Depth Anything V2 Small (Apache-2.0), convertido a
        float16 (50 MB, 0,02 % de diferencia con el original). Viaja con la
        web, se guarda en IndexedDB y se avisa antes de bajarlo. ── */
  depth:    { url: LOCAL + "depthanything/depth_anything_v2_small_fp16.onnx", size: 49981786, store: true, premium: true,
              label: "Depth Anything V2", license: "Apache-2.0" },

  /* ── Selección por descripción libre: CLIPSeg rd64-refined (CIDAS, Apache-2.0), en la conversión a ONNX de Xenova, float16
        (273 MB; la cuantizada a INT8/Q4 empeora y no se usa). Entradas: input_ids y attention_mask (int64, 1×77, tokenizador de CLIP
        en js/ai/cliptokenizer.js), pixel_values 1×3×352×352 con media/desviación de ImageNet; salida los «logits» 352×352 (sigmoide =
        probabilidad de que el píxel sea lo descrito). Sólo se descarga al usarlo, avisando antes. CPU: el resultado con WebGPU no se
        ha podido validar. ── */
  clipseg:  { url: "https://huggingface.co/Xenova/clipseg-rd64-refined/resolve/main/onnx/model_fp16.onnx", size: 273352075, store: true, premium: true, cpu: true,
              label: "CLIPSeg (descripción libre)", license: "Apache-2.0" },

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

  scunet:   { url: HF + "onnx/enhance/scunet/scunet_color-PSNR.onnx", size: 91264256,
              tile: 256, tileGpu: 512, minSide: 256, label: "SCUNet", license: "Apache-2.0" },
  fbcnn:    { url: HF + "onnx/enhance/fbcnn/fbcnn_color_fp16.onnx",   size: 143910675,
              tile: 512, minSide: 0, label: "FBCNN", license: "Apache-2.0" }
};

export const mb = bytes => Math.round(bytes / 1e6) + " MB";
