# Revelador RAW local

Este directorio es un módulo autónomo: recibe un archivo RAW o una capa raster,
mantiene sus ajustes separados y entrega un resultado al editor sólo al aceptar.

## Motor de RAW

`vendor/libraw-wasm` contiene la distribución 1.6.0 de
[LibRaw-Wasm](https://github.com/ybouane/LibRaw-Wasm). Ejecuta LibRaw dentro de
un Web Worker y no transmite el archivo fuera del navegador. LibRaw se distribuye
bajo LGPL-2.1 o CDDL-1.0; para esta integración se conserva el aviso de la
licencia dual en `NOTICES.md`. La envoltura JavaScript de LibRaw-Wasm tiene
licencia ISC.

La cobertura depende del modelo de cámara y de la compilación de LibRaw. Si el
motor no puede desempaquetar un RAW concreto, la aplicación muestra el error y
no usa su JPEG incrustado como sustituto de un revelado.

## Límites honestos de esta primera integración

La conversión inicial usa el demosaicing, orientación, matriz de cámara y
balance de blancos de LibRaw. LibRaw entrega ahora RGB lineal de 16 bits, con
reconstrucción de altas luces activada. `source.js` conserva ese buffer sin
convertirlo a un lienzo de 8 bits. La previsualización usa una copia flotante
reducida; el worker aplica los ajustes al original de 16 bits antes de entregar
un lienzo sRGB de 8 bits al editor actual. Esto no equivale a exportar TIFF de
16 bits ni a recuperar información que el sensor o el decodificador hayan
recortado. No se incluye una base de perfiles de lente.

## Modelo tonal y controles (versión 2)

`tone.js` genera una curva de ganancia flotante de 4096 entradas compartida por
GPU y CPU. El contraste usa una sigmoide en luminosidad perceptual con gris
medio estable. Sombras y altas luces tienen máscaras suaves y amplias y el
signo convencional: positivo aclara, negativo oscurece. Blancos y negros
actúan más cerca de los extremos. La curva conserva el orden de luminosidad
incluso combinando los seis controles tonales a sus valores extremos.
Los ajustes de luminosidad mantienen la proporción RGB; la saturación y el tono
incluyen compresión de cromaticidad para evitar el recorte independiente de
canales. El balance automático estima una corrección de gris medio acotada;
las opciones de iluminación son correcciones relativas al balance inicial.

Enfoque, textura y claridad trabajan sobre el detalle de luminosidad, con
umbral y límite de halo. La reducción de ruido de luminosidad y de color están
separadas y protegen bordes mediante el contraste local. La corrección de
aberración cromática permite desplazar radialmente rojo y azul en ambos sentidos.
Estos son algoritmos propios; no son los algoritmos propietarios de Adobe.

Cada deslizador tiene botones de un paso −/+, doble clic y doble toque para
volver a cero, además de las teclas Suprimir/Retroceso. Los cambios se pueden
deshacer. Temperatura es ahora relativa (−100 a +100, cero neutro), no kelvin;
los ajustes anteriores con temperatura absoluta se convierten al abrirlos.

Referencias de diseño: [curvas sigmoidales y conservación de tono en darktable](https://docs.darktable.org/usermanual/stable/en/module-reference/processing-modules/sigmoid/)
y [salida lineal de 16 bits en LibRaw](https://www.libraw.org/node/1198).

## Previsualización y rendimiento

`preview.js` conserva una copia reducida al área visible, con un presupuesto de
1,4 MP en escritorio y 0,65 MP en móvil. `gpu-preview.js` reutiliza texturas y
dos programas WebGL2 para tono y detalle. Durante un arrastre actualiza
uniformes y, si cambian los ajustes tonales, la pequeña tabla de ganancia,
una vez por fotograma. Conserva el último estado solicitado.
El histograma usa una muestra de 128 × 80 píxeles después de 160 ms sin cambios;
no se calcula cuando está oculto en móvil. El zoom de presentación no recalcula
el revelado.

La textura WebGL usa una única conversión de origen superior a framebuffer
inferior. La ruta RAW ya no invierte una segunda vez el eje vertical; esa doble
inversión era la causa de la orientación incorrecta que podía hacer que una
fotografía apareciera girada 180° en el revelador.

Si no hay WebGL2 o se pierde el contexto, se usa `render-worker.js` con una
previsualización de 0,18 MP y una sola operación en curso. Los resultados
obsoletos se descartan. Al aceptar, otro worker procesa la resolución original
con el mismo modelo de ajustes; reducir la vista previa no reduce la imagen
entregada al editor. Cancelar termina los workers y libera las texturas.
El desenfoque de detalle usa sumas deslizantes, de coste lineal en los píxeles.

`tests/rendering.mjs` comprueba en Chromium la correspondencia GPU/CPU, la
agrupación de eventos, la alternativa sin GPU, la interfaz móvil y la exportación
de una imagen sintética de 24 MP mientras la interfaz mantiene su temporizador.
También prueba las 64 combinaciones extremas de tono, decodifica un DNG Bayer
generado por `tests/dng-fixture.js` con el LibRaw incluido, comprueba la precisión
de 16 bits, ejercita todos los botones/deslizadores y envía dos toques nativos
en un contexto móvil con pantalla táctil.
Se ejecuta con Node y `RAW_PLAYWRIGHT` apuntando al `index.mjs` de Playwright;
`RAW_BROWSER` permite seleccionar el ejecutable Chromium (Edge por defecto).
Las medidas corresponden al equipo de prueba, no garantizan una tasa de
fotogramas fija en todos los dispositivos.
