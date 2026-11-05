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

## Modelos en uso (24 del catálogo + Zero-DCE++)

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

## Pendiente de este registro

- Calcular el `sha256` de los modelos remotos y fijar `HF_REV` (F0.7); hasta entonces `HF_REV = "main"` y el modelo se acepta sin huella.
- Revisar la licencia de los **datos de entrenamiento** de cada modelo (columna «Datos») antes de cobrar Premium.
- Los modelos candidatos de las fases siguientes (pose, landmarks, MI-GAN, NAFNet, CLIP, Qwen2.5…) se añaden aquí **cuando se incorporan**,
  con su medición en móvil. La lista de candidatos está en la sección 8 del plan.
