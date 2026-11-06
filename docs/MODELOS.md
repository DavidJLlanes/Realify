# Registro de modelos de IA

Cada modelo que usa Realify está aquí: para qué sirve, cuánto pesa, con qué licencia, de dónde sale y su huella `sha256`.
Es la fuente que mira la tarea F16.7 del [plan](PLAN_EDITOR_IA_LOCAL.md) si algún día Premium pasa a ser de pago.
El catálogo ejecutable está en [`js/ai/models/`](../js/ai/models/) (una subcarpeta por familia); los pesos incluidos en la web,
en [`assets/models/`](../assets/models/). Las atribuciones completas están en [`js/vendor/ATTRIBUTIONS.md`](../js/vendor/ATTRIBUTIONS.md).

## Reglas

- **Se usa el modelo de más calidad que pueda ejecutar un móvil de gama media (medido), con cualquier licencia** (decisión del titular, 5 nov 2026).
  Los de uso **no comercial** llevan `noncommercial: true` en el catálogo y aparecen aquí con **no** en «Uso comercial»;
  si algún día se cobra Premium, hay que sustituirlos.
- **Dónde viven**: hasta ~30 MB, en `assets/models` (hoy hay otros más grandes, anteriores al plan); los más grandes, en Hugging Face con la
  revisión (`HF_REV`, en `js/ai/models/base.js`) y el `sha256` fijados. Los modelos sólo se descargan al usarlos, avisando antes del tamaño,
  y se guardan en IndexedDB.
- **Al añadir un modelo**: una línea en esta tabla (con la huella: `node tools/models/sha256.mjs <archivo>`), su entrada en el archivo de su
  familia en `js/ai/models/`, su atribución en `ATTRIBUTIONS.md` y, si no es comercial, `noncommercial: true`.

## Modelos en uso (39 del catálogo + Zero-DCE++)

«Datos» = licencia de los datos de entrenamiento. **«no revisada»** significa que todavía no se ha comprobado y hay que hacerlo antes de
cobrar Premium; los únicos con restricción conocida están marcados. «Móvil» indica cómo se usa hoy; la medición en móviles reales de gama
media se hace en F15.1 (vídeo) y F14.1 (LLM) y al incorporar cada modelo nuevo.

| Id | Propósito | Tamaño | Licencia de los pesos | Datos | Origen | sha256 | Uso comercial | Notas |
|---|---|---|---|---|---|---|---|---|
| `u2netp` | Eliminar fondo, selección y matting rápido | 4,6 MB | Apache-2.0 | no revisada | U²-Net portátil (Xuebin Qin et al.); en `assets/models/u2netp/` | `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` | sí | incluido en la web |
| `modnet` | Eliminar fondo en retratos | 26 MB | Apache-2.0 | no revisada | ImageToolbox (T8RIN) en Hugging Face | pendiente (F0.7) | sí | remoto |
| `isnet` | Eliminar fondo de alta resolución (1024) | 179 MB | Apache-2.0 | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | sí | remoto, con aviso de tamaño |
| `lama` | Relleno de huecos (borrador mágico, expandir) | 208 MB | Apache-2.0 | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | sí | remoto, con aviso de tamaño |
| `span_x2` | Ampliar ×2 (SPAN) | 1,7 MB | ver OpenModelDB | no revisada | OpenModelDB vía ImageToolbox | pendiente (F0.7) | por revisar | remoto |
| `esrgan_x4` | Ampliar ×4 (Real-ESRGAN v3) | 2,6 MB | BSD-3-Clause | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | sí | remoto |
| `anime_x4` | Ampliar ×4 ilustración | 5,2 MB | BSD-3-Clause | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | sí | remoto |
| `sharp_x4` | Ampliar ×4 de máximo detalle (UltraSharp V2 Lite) | 16 MB | CC BY-NC-SA 4.0 | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | **no** | `noncommercial: true`; excepción aceptada por el titular |
| `sponge` | Colorear (SpongeColor Lite) | 10 MB | ver OpenModelDB | no revisada | OpenModelDB vía ImageToolbox | pendiente (F0.7) | por revisar | remoto |
| `colorizer` | Colorear (Colorizer V2) | 33 MB | ver OpenModelDB | no revisada | OpenModelDB vía ImageToolbox | pendiente (F0.7) | por revisar | remoto |
| `ddcolor` | Colorear (DDColor Tiny) | 221 MB | Apache-2.0 | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | sí | remoto, con aviso de tamaño |
| `scunet` | Reducción de ruido con IA | 91 MB | Apache-2.0 | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | sí | remoto |
| `fbcnn` | Quitar artefactos JPEG con IA | 144 MB | Apache-2.0 | no revisada | ImageToolbox en Hugging Face | pendiente (F0.7) | sí | remoto, con aviso de tamaño |
| `sam_enc` | Segment Anything: codificador (MobileSAM) | 28 MB | Apache-2.0 | no revisada | Zhang et al.; exportación del paquete @geti-ui/smart-tools 1.6.0; en `assets/models/mobilesam/` | `37326714456ecfae9dada1c9ca4aaf314e7190da7b2e0f18763666c3b8db6ed8` | sí | en la web, se guarda en IndexedDB al usarlo |
| `sam_dec` | Segment Anything: decodificador de máscaras | 17 MB | Apache-2.0 | no revisada | Meta AI (SAM ViT-H); misma exportación | `4f76a687fe128badbce801c68f0f1775da829f46f80b5357cbf134dae8ae1b68` | sí | ídem |
| `yunet` | Detección de caras y 5 puntos | 0,2 MB | MIT | no revisada | OpenCV Zoo (Shiqi Yu et al.); `assets/models/yunet/` | `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` | sí | incluido en la web |
| `faceparse` | Zonas de la cara: pelo, ojos, labios, orejas, cuello, gafas, sombrero (BiSeNet) | 53 MB | MIT (código y pesos) | **CelebAMask-HQ: sólo investigación no comercial** | yakhyo/face-parsing; `assets/models/faceparsing/` | `0d9bd318e46987c3bdbfacae9e2c0f461cae1c6ac6ea6d43bbe541a91727e33f` | **no** | `noncommercial: true`; excepción aceptada por el titular |
| `depth` | Profundidad relativa (Depth Anything V2 Small, fp16) | 50 MB | Apache-2.0 | no revisada | Lihe Yang et al.; exportación de fabio-sim/Depth-Anything-ONNX convertida a fp16; `assets/models/depthanything/` | `a1f336f197bd039509154f5b61c0ed61c2b326d3eb928193daddf1dfc22052e3` | sí | se guarda en IndexedDB al usarlo |
| `clipseg` | Selección por descripción libre (CLIPSeg rd64-refined, fp16) | 273 MB | Apache-2.0 | no revisada | CIDAS (Lüddecke y Ecker); conversión de Xenova en Hugging Face | pendiente (F0.7) | sí | remoto, sólo CPU por defecto, con aviso de tamaño |
| `gfpgan_enc` | Restaurar caras: codificador (GFPGAN 1.4, fp16) | 112 MB | Apache-2.0 | no revisada | Xintao Wang et al. (Tencent ARC); facefusion/facefusion-assets; dos trozos `.part0` y `.part1` | 7b399ba019131f2908069f531d5892c4a62ee232785ad59d970efa17de024f81 (unidos) · part0 bc60e651… · part1 6eefb079… | sí | se guarda en IndexedDB al usarlo |
| `gfpgan_dec` | Restaurar caras: generador | 58 MB | Apache-2.0 | no revisada | ídem | `450e306765b1db00e5033288d2513e053c833bb49e6d2272aa13bf800f78a1cb` | sí | ídem |
| `lens` | Clasificador de la lente (MobileNet v1 0,25) | 1,9 MB | Apache-2.0 | ImageNet (no revisada) | tfjs-models (Google) convertido con tf2onnx; `assets/models/mobilenet/` | `9448ba7016704c0c2f5e26cec2ecad0ebd1b97cbfa70a61e73906ae3c37354da` | sí | incluido |
| `sky` | Cielo y 150 clases más (DeepLab v3 ADE20K) | 9,2 MB | Apache-2.0 | ADE20K (no revisada) | tfjs-models convertido con tf2onnx; `assets/models/deeplab-ade20k/` | `79faffc49de400c6df20e8fda5115d20ef13fe3d8b661153b884d5677a84832e` | sí | incluido |
| `person` | Personas (BodyPix MobileNetV1 0,75) | 5,2 MB | Apache-2.0 | no revisada | tfjs-models convertido con tf2onnx; `assets/models/bodypix/` | `e6eddaa8825e32a2b9f605de8188a73ec79ccc423f86977b9c96dbb0f9112695` | sí | incluido |
| `zerodce (aparte)` | Iluminar fotos oscuras (Zero-DCE++) | 0,04 MB | CC BY-NC 4.0 | no revisada | Chongyi Li et al. (TPAMI 2021); `assets/models/zerodce/zerodce_pp.bin`; no está en `js/ai/models/` (lo carga `js/ai/zerodce.js`) | `621274928a1c991aa6cd55487811c0123acda50aa064155b4440085c05cb6466` | **no** | excepción aceptada por el titular |
| `facelm` | Puntos de la cara (478) | 4,9 MB | Apache-2.0 | no revisada | MediaPipe Face Landmarker (`face_landmarker.task`, Google; `face_landmarks_detector.tflite` convertido a ONNX con tf2onnx, opset 17); en `assets/models/people/` | `2403895bbf7797cd3014ed6f195ee83c4c939381e186d27aa237b4d288f61df2` | sí | validado con una foto real (nariz de la malla = nariz de la pose) |
| `handdet` | Detector de manos (palma) | 4,6 MB | Apache-2.0 | no revisada | MediaPipe Hand Landmarker (`hand_detector.tflite` → ONNX); en `assets/models/people/` | `eb62da01b7c27bb021ebbec3f612df551af77b525c0219b4ed02eb79c671f756` | sí | **sin validar con una mano real** (el decodificador de anclas es el estándar de MediaPipe) |
| `handlm` | 21 puntos de la mano | 10,9 MB | Apache-2.0 | no revisada | MediaPipe Hand Landmarker (`hand_landmarks_detector.tflite` → ONNX); en `assets/models/people/` | `8130649ed54bbe8f4530cf8c0df05b4dcb046c10c184905c22a6e26e7b875f9e` | sí | **sin validar con una mano real** |
| `pose` | Pose del cuerpo, 17 puntos COCO (RTMPose-m, Body7) | 27 MB | Apache-2.0 | Body7 (COCO, AIC, CrowdPose, MPII, sub-JHMDB, Halpe, PoseTrack18): por revisar | OpenMMLab (`rtmpose-m_simcc-body7_pt-body7_420e-256x192`, ONNX del SDK); pesos pasados a fp16 con cálculo fp32 (`tools/models/pesos-fp16.py`); en `assets/models/people/` | `fa1e31010ae80ac7fdffbdff1654d02d1b9edee98fe58ee1a0d664596552087c` | por revisar | fp16 vs fp32: < 0,5 px de diferencia; 0,04 s en CPU |
| `humanparse` | Partes del cuerpo y ropa (18 clases) | 55 MB | MIT | ATR (Look into Person): por revisar | `mattmdjaga/segformer_b2_clothes` (Hugging Face), ONNX exportado a 512×512; pesos a fp16 con cálculo fp32; en `assets/models/people/` | `9d5f033f70ac6cff33113ed05699bc2e26eaed8d01cdcd1841d19bdab73195e4` | **no** (por precaución) | `noncommercial: true` hasta revisar hasta revisar los datos; fp16 vs fp32: 99,98 % de píxeles iguales |
| `qwen15` | Asistente: interpreta la orden y devuelve el plan JSON (F14.1) | 1,22 GB (q4f16) | Apache-2.0 | no revisada | `onnx-community/Qwen2.5-1.5B-Instruct` en Hugging Face (commit fijado `9f9c976052bfb08a20793f0c3013563dc095c966`); tokenizador y config en `assets/models/qwen2.5-1.5b/` | `19dec9f63488016185ba997d5e4492b5ac5b4f7ef1abb45243a91de958838dcd` | sí | remoto, con aviso de tamaño; pendiente de integrar y medir en móvil |
| `whisper_enc` | Voz: codificador de Whisper tiny (dictado al asistente, subtítulos; F14.4) | 10 MB | MIT | no revisada | `onnx-community/whisper-tiny-ONNX` (commit `ea7c447ab3780e36818661384dea74a8e6b82fc6`), `encoder_model_quantized.onnx`; en `assets/models/whisper-tiny/` | `959c5e7f2a915cf52c274343ffe2b5a54ccbc68af34166e9bfa2a43fcea87425` | sí | incluido en la web; pendiente de integrar |
| `whisper_dec` | Voz: decodificador de Whisper tiny (merged, con memoria) | 110 MB | MIT | no revisada | `onnx-community/whisper-tiny-ONNX` (commit fijado `ea7c447ab3780e36818661384dea74a8e6b82fc6`), `decoder_model_merged_quantized.onnx` | `49f1546333cf31f05ffd57f7d46597fef0fdfe527991432b725461f13141a435` | sí | remoto, con aviso de tamaño; pendiente de integrar y medir |
| `clip_vision` | Buscar fotos por texto: codificador de imagen CLIP ViT-B/32 | 89 MB | MIT | no revisada | `Xenova/clip-vit-base-patch32` en Hugging Face (commit fijado `6b7c523703ae26e39be4b03774966f8571c7f523`), `onnx/vision_model_quantized.onnx` | `583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299` | sí | remoto, con aviso de tamaño; pendiente de integrar y medir |
| `clip_text` | Buscar fotos por texto: codificador de texto CLIP ViT-B/32 | 65 MB | MIT | no revisada | `Xenova/clip-vit-base-patch32` en Hugging Face (commit fijado `6b7c523703ae26e39be4b03774966f8571c7f523`), `onnx/text_model_quantized.onnx` | `73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a` | sí | remoto, con aviso de tamaño; usa el tokenizador CLIP que ya lleva la web |
| `florence_vision` | Describir fotos: codificador de visión de Florence-2 base | 94 MB | MIT | no revisada | `onnx-community/Florence-2-base` en Hugging Face (commit fijado `d59e079711c57174f29265539fb4cc9f0f335916`), `onnx/vision_encoder_quantized.onnx` | `56351a93ecfb61a0384dc63c130cc5bdeea8de1a85f172e109821c7cc956be5a` | sí | remoto, con aviso de tamaño; pendiente de integrar y medir en móvil |
| `florence_embed` | Describir fotos: incrustaciones de texto de Florence-2 base | 39 MB | MIT | no revisada | `onnx-community/Florence-2-base` en Hugging Face (commit fijado `d59e079711c57174f29265539fb4cc9f0f335916`), `onnx/embed_tokens_quantized.onnx` | `8818c58a214e53bf7e22c48bb4674c2fa3112b9539c3ce4075a2eac797b1ef74` | sí | remoto, con aviso de tamaño; pendiente de integrar y medir en móvil |
| `florence_enc` | Describir fotos: codificador de Florence-2 base | 44 MB | MIT | no revisada | `onnx-community/Florence-2-base` en Hugging Face (commit fijado `d59e079711c57174f29265539fb4cc9f0f335916`), `onnx/encoder_model_quantized.onnx` | `a0459867dc116e8e49f53073e368e45c21169d0b0dd7dc350abed06926e0d835` | sí | remoto, con aviso de tamaño; pendiente de integrar y medir en móvil |
| `florence_dec` | Describir fotos: decodificador «merged» de Florence-2 base | 98 MB | MIT | no revisada | `onnx-community/Florence-2-base` en Hugging Face (commit fijado `d59e079711c57174f29265539fb4cc9f0f335916`), `onnx/decoder_model_merged_quantized.onnx` | `7ffecf4dd98784308878fd52a7f95ed64f5ed025b4785f6f105450be8fe2be04` | sí | remoto, con aviso de tamaño; pendiente de integrar y medir en móvil |
| `depth_base` | Profundidad de más calidad (Depth Anything V2 Base, fp16) | 195 MB | CC-BY-NC-4.0 (**no comercial**) | no revisada | `onnx-community/depth-anything-v2-base` en Hugging Face (commit `d13a228`, hash largo por fijar), `onnx/model_fp16.onnx` | `822e6c12f36cd46753dcf229ce87199310533de2d533a527756b8ef30a76d158` | **no** | remoto, con aviso de tamaño; sustituto previsto: el Small (Apache-2.0); pendiente de integrar |

### Modelos de personas (Fase 2, v302)

Medidos en CPU (WASM) con una foto real de 512×512: SegFormer 2,4 s, RTMPose 0,04 s, malla de cara 0,02 s. **Falta medir en un móvil de gama media
(F2.8)**; con WebGPU deben ir bastante más rápido. Descartado: YOLOX-m (101 MB) como detector de personas: la caja de cada persona sale
de la cara y se afina con la propia pose. Los originales (`face_landmarker.task`, `hand_landmarker.task`, los zip de OpenMMLab y el ONNX de
SegFormer en fp32) no se guardan en el repositorio; se reproducen con `tools/models/convertir-personas.py`.

## Modelos de uso no comercial y su sustituto previsto (F16.7)

Si algún día Premium pasa a ser de pago, estos modelos hay que **quitarlos o sustituirlos** antes de cobrar (en el catálogo llevan `noncommercial: true`,
salvo Zero-DCE++, que se carga aparte). Los sustitutos son una **propuesta** sin medir ni auditar:

| Modelo | Función | Restricción | Sustituto previsto |
|---|---|---|---|
| `sharp_x4` (UltraSharp V2 Lite) | Ampliar con IA, máximo detalle | Pesos CC BY-NC-SA 4.0 | `esrgan_x4` (Real-ESRGAN, BSD-3-Clause), que ya está en el catálogo y es la opción básica de Ampliar |
| `faceparse` (BiSeNet) | Seleccionar por texto (pelo, ojos, labios…), Retoque de cara | Datos CelebAMask-HQ de investigación no comercial | Zonas de ojos, labios y cejas por los 478 puntos de `facelm` (Apache-2.0); pelo, cuello y gafas por `humanparse` una vez revisada su licencia, o un modelo de partes de la cara entrenado con datos permisivos (por buscar) |
| `humanparse` (SegFormer ATR) | Seleccionar partes, Editor de cuerpo, Ropa | Datos de entrenamiento por revisar (por precaución) | Si la revisión de ATR no lo permite: un modelo de segmentación de personas con datos de licencia comercial (por buscar) y la pose `pose` (Apache-2.0) para las extremidades |
| Zero-DCE++ | Iluminar con IA | Pesos CC BY-NC 4.0 | El algoritmo clásico «Iluminar foto oscura» (`adj.lowLight`, sin modelo), que ya existe |
| `depth_base` (Depth Anything V2 Base) | Profundidad de más calidad | Pesos CC-BY-NC-4.0 | `depth` (Depth Anything V2 Small, Apache-2.0), que ya viaja con la web |
| `span_x2`, `sponge`, `colorizer` | Ampliar ×2 y colorear | Licencia **por revisar** en OpenModelDB | `esrgan_x4` para ampliar y `ddcolor` (Apache-2.0) para colorear |

Además, **antes de cobrar** hay que revisar la columna «Datos» de todos los modelos (hoy «no revisada») y calcular el `sha256` de los remotos.

## Pendiente de este registro

- Calcular el `sha256` de los modelos remotos y fijar `HF_REV` (F0.7); hasta entonces `HF_REV = "main"` y el modelo se acepta sin huella.
- Revisar la licencia de los **datos de entrenamiento** de cada modelo (columna «Datos») antes de cobrar Premium.
- Los modelos candidatos que **no se han podido incorporar** (Qwen2.5 para el asistente, Whisper tiny para la voz, CLIP, captioning, MI-GAN, NAFNet, Depth Anything Base: Hugging Face no es accesible desde el entorno de desarrollo) se añadirán aquí **cuando se incorporen**,
  con su medición en móvil. La lista de candidatos está en la sección 8 del plan.
