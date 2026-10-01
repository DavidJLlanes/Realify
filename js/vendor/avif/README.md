# Codificador y decodificador AVIF

`avif_enc.js` y `avif_enc.wasm` (versión de un solo hilo) del paquete
[`@jsquash/avif`](https://github.com/jamsinclair/jSquash) 2.1.1, que a su vez
empaqueta el códec de [Squoosh](https://github.com/GoogleChromeLabs/squoosh)
(libavif + libaom). Licencia **Apache-2.0** (© Google Inc. y colaboradores).

Se carga sólo al exportar en AVIF (js/io/formats.js), porque los navegadores
no saben codificar AVIF con `canvas.toBlob`.

## Decodificador (fase 4)

`avif_dec.js` y `avif_dec.wasm` del mismo paquete `@jsquash/avif` 2.1.1
(libavif 1.0.1 + dav1d, licencias Apache-2.0 y BSD-2-Clause). Se carga sólo al
abrir un AVIF de 10 o 12 bits (js/io/hidepth.js), para conservar esos bits como
origen de la capa base: el navegador los decodifica siempre a 8 bits.
