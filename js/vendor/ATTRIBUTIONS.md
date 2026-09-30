# Decodificadores incluidos

- `ag-psd.js`: ag-psd, copyright Agamnentzar y colaboradores, licencia MIT.
- `utif.js`: UTIF.js, Photopea/Ivan Kuckir, licencia MIT.
- `heic2any.min.js`: heic2any, Alex Corvi, licencia MIT.

Se distribuyen localmente para que la importación se ejecute en el dispositivo y siga funcionando sin conexión.

# Motor y modelos de IA

- `ort/`: ONNX Runtime Web 1.30.0 (compilación WebGPU + WebAssembly), copyright Microsoft Corporation, licencia MIT.
- Modelos ONNX publicados por el proyecto ImageToolbox (T8RIN, licencia Apache-2.0) en https://huggingface.co/T8RIN/ImageToolbox-models. La preparación de cada modelo (tamaños de entrada, teselas, rangos) sigue el código de ImageToolbox.
  - `assets/models/u2netp/u2netp.onnx` (incluido): U²-Net portátil, Xuebin Qin et al., licencia Apache-2.0.
- `assets/models/bodypix/bodypix_mnv1_075.onnx`, `assets/models/deeplab-ade20k/deeplab_ade20k.onnx` y `assets/models/mobilenet/mobilenet_v1_025.onnx` (incluidos): BodyPix (MobileNetV1 0,75), DeepLab v3 ADE20K (MobileNetV2) y MobileNet v1 0,25 de tfjs-models (Google, Apache-2.0), convertidos de TensorFlow.js a ONNX con tf2onnx (mismos pesos; DeepLab cortado antes del ArgMax para dar probabilidades). Los usan Seleccionar sujeto, Seleccionar cielo, Reemplazar cielo y Adaptive Photo Lens. TensorFlow.js ya no se incluye.
- `assets/skies/` (incluido): biblioteca de 16 cielos generados para Realify con `assets/skies/generate.py` (modelo de cielo y nubes procedurales, sin fotos de terceros), CC0 1.0.
  - Descargados bajo demanda y guardados en IndexedDB: MODNet (Apache-2.0), ISNet general-use (Apache-2.0), LaMa (Apache-2.0), SCUNet (Apache-2.0) y FBCNN (Apache-2.0).
- `assets/models/mobilesam/` (servidos por la propia web, descargados bajo demanda y guardados en IndexedDB): codificador de MobileSAM (Zhang et al., Apache-2.0) y decodificador de Segment Anything ViT-H (Meta AI, Apache-2.0), en las exportaciones ONNX del paquete npm @geti-ui/smart-tools 1.6.0 (Intel Geti, Apache-2.0). Ver su LICENSE.txt. Los usan Selección con un toque y Borrador mágico (Premium).
- `assets/models/yunet/face_detection_yunet_2023mar.onnx` (incluido, 232 KB): YuNet, detector de caras del OpenCV Zoo (Shiqi Yu et al.), licencia MIT. Lo usan Difuminar caras, Ojos rojos y Recorte de retrato (Premium).
- `assets/models/depthanything/depth_anything_v2_small_fp16.onnx` (servido por la web, 50 MB, se descarga al usarlo): Depth Anything V2 Small (Lihe Yang et al., TikTok/HKU), licencia Apache 2.0, convertido a fp16 desde la exportación ONNX de fabio-sim/Depth-Anything-ONNX. Lo usan Desenfoque por profundidad, Niebla por distancia y Foto 3D (Premium).
- `assets/models/gfpgan/gfpgan_1.4_fp16.part0` y `.part1` (servidos por la web, 170 MB en total, se descargan al usarlo y se unen): GFPGAN v1.4 (Xintao Wang et al., Tencent ARC), licencia Apache 2.0, convertido a fp16 desde la exportación ONNX de facefusion/facefusion-assets. Lo usa Restaurar caras (Premium).
- `assets/models/zerodce/zerodce_pp.bin` (incluido, 42 KB): pesos de Zero-DCE++ (Chongyi Li, Chunle Guo, Chen Change Loy, TPAMI 2021), licencia **CC BY-NC 4.0 (uso no comercial)**, aceptada por el propietario mientras Premium sea gratuito; si se cobra, hay que quitarlo o sustituirlo. Lo usa Iluminar con IA (Premium).
- `assets/models/faceparsing/resnet18.onnx` (servido por la propia web, descargado bajo demanda y guardado en IndexedDB): BiSeNet ResNet-18 de face parsing (yakhyo/face-parsing, código y pesos MIT). **Entrenado con CelebAMask-HQ, de uso sólo para investigación no comercial**: se usa en Retoque de cara (Premium gratuito) y habrá que quitarlo o sustituirlo si Premium pasa a ser de pago. Ver su LICENSE.txt.

# Codificadores de exportación

- `avif/`: codificador AVIF de Squoosh (libavif + libaom) empaquetado por @jsquash/avif 2.1.1, copyright Google Inc. y colaboradores, licencia Apache-2.0. Se carga sólo al exportar en AVIF.
- `gifenc/`: gifenc 1.0.3, copyright Matt DesLauriers, licencia MIT. GIF animados.
- El PDF lo genera `js/io/formats.js` sin bibliotecas (una imagen JPEG por página).
