# Decodificadores incluidos

- `ag-psd.js`: ag-psd, copyright Agamnentzar y colaboradores, licencia MIT.
- `utif.js`: UTIF.js, Photopea/Ivan Kuckir, licencia MIT.
- `heic2any.min.js`: heic2any, Alex Corvi, licencia MIT.

Se distribuyen localmente para que la importación se ejecute en el dispositivo y siga funcionando sin conexión.

# Motor y modelos de IA

- `ort/`: ONNX Runtime Web 1.30.0 (compilación WebGPU + WebAssembly), copyright Microsoft Corporation, licencia MIT.
- Modelos ONNX publicados por el proyecto ImageToolbox (T8RIN, licencia Apache-2.0) en https://huggingface.co/T8RIN/ImageToolbox-models. La preparación de cada modelo (tamaños de entrada, teselas, rangos) sigue el código de ImageToolbox.
  - `assets/models/u2netp/u2netp.onnx` (incluido): U²-Net portátil, Xuebin Qin et al., licencia Apache-2.0.
  - Descargados bajo demanda y guardados en IndexedDB: MODNet (Apache-2.0), ISNet general-use (Apache-2.0), LaMa (Apache-2.0), SCUNet (Apache-2.0) y FBCNN (Apache-2.0).
