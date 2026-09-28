# Codificador AVIF

`avif_enc.js` y `avif_enc.wasm` (versión de un solo hilo) del paquete
[`@jsquash/avif`](https://github.com/jamsinclair/jSquash) 2.1.1, que a su vez
empaqueta el códec de [Squoosh](https://github.com/GoogleChromeLabs/squoosh)
(libavif + libaom). Licencia **Apache-2.0** (© Google Inc. y colaboradores).

Se carga sólo al exportar en AVIF (js/io/formats.js), porque los navegadores
no saben codificar AVIF con `canvas.toBlob`.
