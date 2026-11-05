# Motor de deformación (`js/features/warp/`)

Motor reutilizable por el editor de cuerpo (Fase 6), la forma de la cara y los ajustes finos. No tiene interfaz propia.

| Archivo | Qué hace |
|---|---|
| `field.js` | Campo de desplazamiento en rejilla (mapa «hacia atrás»: la salida toma el color de `x + d(x)`), muestreo bilineal, inverso por puntos fijos. |
| `mls.js` | Campo por mínimos cuadrados móviles (similitud, rígida o afín) con puntos fijos, anclas de borde, zonas protegidas (campo exactamente cero) y rectas. |
| `jacobian.js` | Determinante del jacobiano por celda; `limitar` reduce la amplitud hasta que no haya plegados e indica que lo ha hecho. |
| `render-cpu.js` | Bicúbico Catmull-Rom en luz lineal, alfa premultiplicado, fila a fila (respaldo y worker). |
| `render-gpu.js` | Mismo cálculo en WebGL2 (imagen SRGB8_ALPHA8, campo RG32F). Devuelve `null` si no hay WebGL2 o no cabe la textura. |
| `fondo.js`, `lama.js` | Zona que deja libre un cuerpo al estrecharse y relleno con LaMa (función inyectable). |
| `lineas.js` | Rectas del fondo (Hough con gradiente) que cruzan el hueco, vueltas a trazar tras el relleno. |
| `index.js` | Puerta única: `deformar(lienzo, campo)` prueba GPU, luego worker de CPU y por último CPU en el hilo principal. |

Uso típico: `campoMLS(W, H, manos, { fijos, protegida, rectas })` → `limitar(campo)` → `deformar(lienzo, campo)`.
Las referencias `js/editor/tools/liquify.js` y `filter.puppetWarp` no se tocan.

Pruebas: `tests/ia/warp/campo.mjs` (Node) y `tests/ia/warp/render.mjs` (navegador, GPU frente a CPU).
Pendiente: MI-GAN para móvil (no está en el catálogo; se usa LaMa).
