# OpenCV.js

- Versión: 4.12.0 (compilación WebAssembly de OpenCV en un solo archivo, empaquetada por
  `@techstark/opencv-js` 4.12.0-release.1).
- Licencia: Apache-2.0 (`LICENSE-Apache-2.0.txt`): uso comercial permitido.
- Tamaño: ~10,9 MB. Sólo se descarga al usar una herramienta que lo necesita
  (apilar fotos), avisando antes; ver `js/cv/opencv.js`.
- Nota: `cv` es «thenable»; nunca hay que hacer `await cv` (no termina).
- La 5.0.0 empaquetada no instancia el WASM en Chromium («unknown type form»): por eso 4.12.
