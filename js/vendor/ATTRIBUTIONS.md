# Decodificadores incluidos

- `ag-psd.js`: ag-psd, copyright Agamnentzar y colaboradores, licencia MIT. Parche de Realify en el escritor de Niveles (`levl`): 29 registros en el orden de la especificación, como escribe Photoshop.
- `pdf-lib/`: pdf-lib 1.17.1, © Andrew Dillon, licencia MIT (incluye `LICENSE`); sin modificar. Se carga sólo al exportar un PDF.
- `utif.js`: UTIF.js, Photopea/Ivan Kuckir, licencia MIT.
- `heic2any.min.js`: heic2any, Alex Corvi, licencia MIT.
- `exifreader/exif-reader.js`: ExifReader 4.46.0, Mattias Wallander, licencia **MPL-2.0** (texto en `exifreader/LICENSE`), **sin modificar** (el archivo es el de `dist/` del paquete npm, con su comentario final tal cual). Lee EXIF, IPTC, XMP, ICC, MPF, Photoshop y notas del fabricante en el Inspector de metadatos; se carga sólo al abrirlo o al exportar conservando metadatos del original. El código fuente completo está en https://github.com/mattiasw/ExifReader.

Se distribuyen localmente para que la importación se ejecute en el dispositivo y siga funcionando sin conexión.

# Motor y modelos de IA

- `ort/`: ONNX Runtime Web 1.30.0 (compilación WebGPU + WebAssembly), copyright Microsoft Corporation, licencia MIT.
- Modelos ONNX publicados por el proyecto ImageToolbox (T8RIN, licencia Apache-2.0) en https://huggingface.co/T8RIN/ImageToolbox-models. La preparación de cada modelo (tamaños de entrada, teselas, rangos) sigue el código de ImageToolbox.
  - `assets/models/u2netp/u2netp.onnx` (incluido): U²-Net portátil, Xuebin Qin et al., licencia Apache-2.0.
- `assets/models/bodypix/bodypix_mnv1_075.onnx`, `assets/models/deeplab-ade20k/deeplab_ade20k.onnx` y `assets/models/mobilenet/mobilenet_v1_025.onnx` (incluidos): BodyPix (MobileNetV1 0,75), DeepLab v3 ADE20K (MobileNetV2) y MobileNet v1 0,25 de tfjs-models (Google, Apache-2.0), convertidos de TensorFlow.js a ONNX con tf2onnx (mismos pesos; DeepLab cortado antes del ArgMax para dar probabilidades). Los usan Seleccionar sujeto, Seleccionar cielo, Reemplazar cielo y Adaptive Photo Lens. TensorFlow.js ya no se incluye.
- `assets/skies/` (incluido): biblioteca de 101 cielos. 82 fotografías adaptadas de los HDRI de Poly Haven (CC0 1.0; la URL de cada recurso original está en `assets/skies/catalog.json`) y 19 cielos generados para Realify (16 con `assets/skies/generate.py` y 3 más), dedicados a CC0 1.0. Ver `assets/skies/README.md`.
  - Descargados bajo demanda y guardados en IndexedDB: MODNet (Apache-2.0), ISNet general-use (Apache-2.0), LaMa (Apache-2.0), SCUNet (Apache-2.0) y FBCNN (Apache-2.0).
- `assets/models/mobilesam/` (servidos por la propia web, descargados bajo demanda y guardados en IndexedDB): codificador de MobileSAM (Zhang et al., Apache-2.0) y decodificador de Segment Anything ViT-H (Meta AI, Apache-2.0), en las exportaciones ONNX del paquete npm @geti-ui/smart-tools 1.6.0 (Intel Geti, Apache-2.0). Ver su LICENSE.txt. Los usan Selección con un toque y Borrador mágico (Premium).
- `assets/models/yunet/face_detection_yunet_2023mar.onnx` (incluido, 232 KB): YuNet, detector de caras del OpenCV Zoo (Shiqi Yu et al.), licencia MIT. Lo usan Difuminar caras, Ojos rojos y Recorte de retrato (Premium).
- `assets/models/depthanything/depth_anything_v2_small_fp16.onnx` (servido por la web, 50 MB, se descarga al usarlo): Depth Anything V2 Small (Lihe Yang et al., TikTok/HKU), licencia Apache 2.0, convertido a fp16 desde la exportación ONNX de fabio-sim/Depth-Anything-ONNX. Lo usan Desenfoque por profundidad, Niebla por distancia y Foto 3D (Premium).
- `assets/models/gfpgan/gfpgan_enc_fp16.part0`, `.part1` y `gfpgan_dec_fp16.onnx` (servidos por la web, 170 MB en total, se descargan al usarlo; el modelo va partido en codificador y generador para que quepa en la memoria del móvil): GFPGAN v1.4 (Xintao Wang et al., Tencent ARC), licencia Apache 2.0, convertido a fp16 desde la exportación ONNX de facefusion/facefusion-assets. Lo usa Restaurar caras (Premium).
- `assets/models/zerodce/zerodce_pp.bin` (incluido, 42 KB): pesos de Zero-DCE++ (Chongyi Li, Chunle Guo, Chen Change Loy, TPAMI 2021), licencia **CC BY-NC 4.0 (uso no comercial)**, aceptada por el propietario mientras Premium sea gratuito; si se cobra, hay que quitarlo o sustituirlo. Lo usa Iluminar con IA (Premium).
- `assets/models/faceparsing/resnet18.onnx` (servido por la propia web, descargado bajo demanda y guardado en IndexedDB): BiSeNet ResNet-18 de face parsing (yakhyo/face-parsing, código y pesos MIT). **Entrenado con CelebAMask-HQ, de uso sólo para investigación no comercial**: se usa en Retoque de cara y en Seleccionar por texto (pelo y partes de la cara; Premium gratuito) y habrá que quitarlo o sustituirlo si Premium pasa a ser de pago. Ver su LICENSE.txt.
- `CLIPSeg` (modelo, NO incluido: se descarga de Hugging Face sólo al usar «Seleccionar por texto» con una descripción libre y se guarda en IndexedDB): CLIPSeg rd64-refined (CIDAS, Timo Lüddecke y Alexander Ecker; Apache-2.0), en la conversión a ONNX float16 de Xenova (273 MB). `assets/models/clipseg/` lleva sólo el vocabulario del tokenizador de CLIP (MIT, © OpenAI; ver su LICENSE.txt).

# Codificadores de exportación

- `avif/`: codificador AVIF de Squoosh (libavif + libaom) empaquetado por @jsquash/avif 2.1.1, copyright Google Inc. y colaboradores, licencia Apache-2.0. Se carga sólo al exportar en AVIF. Incluye también su decodificador (libavif + dav1d, Apache-2.0 y BSD-2-Clause), que sólo se carga al abrir un AVIF de 10 o 12 bits.
- `gifenc/`: gifenc 1.0.3, copyright Matt DesLauriers, licencia MIT. GIF animados.
- El PDF lo genera `js/io/formats.js` sin bibliotecas (una imagen JPEG por página).
- `js/filters/unmark/` (código propio): adapta conceptos y heurísticas de [wiltodelta/remove-ai-watermarks](https://github.com/wiltodelta/remove-ai-watermarks), licencia Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0); ver la nota de procedencia al principio de cada archivo.
- `jxl/`: codificador y decodificador de JPEG XL (libjxl, BSD-3-Clause, © los autores de libjxl) empaquetados por @jsquash/jxl 1.3.0 (Apache-2.0, © Google Inc. y colaboradores; versión de un solo hilo). Sólo se cargan al exportar o abrir un JPEG XL.
- `opencv/`: OpenCV.js 4.12.0 (WebAssembly de OpenCV, © los colaboradores de OpenCV, licencia Apache-2.0) empaquetado por `@techstark/opencv-js` 4.12.0-release.1. Se descarga sólo al usar el apilado de fotos. Incluye `LICENSE-Apache-2.0.txt`.
- `assets/lensdb/lensfun.json` (no está en js/vendor): adaptación a JSON de la base de datos de objetivos de Lensfun (https://lensfun.github.io/), © los colaboradores de Lensfun, licencia CC BY-SA 3.0; la adaptación se comparte con la misma licencia (ver `assets/lensdb/LICENSE.md`). Las fórmulas se han reimplementado; no se incluye código de la biblioteca (LGPL-3.0).
