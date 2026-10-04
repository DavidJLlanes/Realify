# JPEG XL

`jxl_enc.js` / `jxl_enc.wasm` y `jxl_dec.js` / `jxl_dec.wasm` (versión de un solo hilo)
del paquete [`@jsquash/jxl`](https://github.com/jamsinclair/jSquash) 1.3.0, que empaqueta
[libjxl](https://github.com/libjxl/libjxl) (BSD-3-Clause) con el envoltorio de Squoosh
(Apache-2.0, © Google Inc. y colaboradores). Licencia del paquete en
`LICENSE-jsquash-Apache-2.0.txt`.

Se cargan sólo al exportar un JPEG XL o al abrir un `.jxl` (js/io/codecs.js, js/io/open.js).
No se usan las versiones multihilo: necesitan `SharedArrayBuffer` y, por tanto, una página
aislada entre orígenes (COOP/COEP) que la web no tiene.

El codificador sólo admite 8 bits por canal (RGBA).
