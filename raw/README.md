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
El cuentagotas de punto blanco (botón sobre la vista previa) promedia un
pequeño entorno del proxy de la vista previa en luz lineal —en Rec.2020 si el
modo Premium está activo— y resuelve `tone.js › wbFromNeutral`, la inversa
exacta de `wbGains`; si hace falta más de ±100, `wbPickNeutral` prueba los
demás preajustes y se queda con el que menos corrección necesita.

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

## Revelado Premium (`premium/`)

Un interruptor con corona en la barra superior cambia de motor sin cambiar los
mandos. Apagado, el revelador es exactamente el de siempre. Encendido:

- **Motor LibRaw**: salida Rec.2020 (`outputColor` 8; la etiqueta del menú del
  motor estaba cambiada con DCI-P3 y se ha corregido), demosaico **DHT**
  (`userQual` 11) y un paso de margen para las altas luces (`expShift` 0,5, que el
  revelado devuelve). Si se han cambiado a mano la calidad de interpolación o la
  exposición del motor, se respetan.
- **Luz lineal de verdad** (en los dos modos): LibRaw-Wasm ignora `gamm` y entrega
  siempre la curva BT.709 de dcraw (0,18 lineal sale como 0,409). Antes el revelado
  la trataba como si fuera lineal, y todo salía más claro y con los tonos medios
  desplazados; ahora `source.js › linearReader` la invierte con la misma fórmula de
  `gamma_curve()` para la vista previa, el resultado y el balance automático, con
  una exposición base de +0,3 EV: el gris medio sale a ~130/255 en ambos modos.
- **Flujo de escena en coma flotante** (`core.js` describe cada paso): balance,
  viñeteado de lente en luz lineal, ruido de luminosidad con filtro guiado fino,
  ruido de color con filtro guiado sobre R/Y y B/Y, exposición sin techo, neblina
  por canal mínimo guiado, tono local sobre una base de **filtro guiado rápido**
  (mapas de 512 px, iguales para vista previa y resultado), curva fílmica
  logarítmica con hombro suave, saturación/intensidad/tono en **OKLab** y ajuste
  de gama a sRGB reduciendo sólo el croma.
- **Salida**: tramado a 8 bits; al abrir en Realify, reducción por área en luz
  lineal y enfoque de salida proporcional a la reducción; botón **TIFF 16 bits**
  (RGB, sin compresión, resolución completa).
- **GPU y CPU**: `gpu.js` (WebGL2 con `EXT_color_buffer_float`) reproduce `cpu.js`.
  Sin texturas flotantes, la vista previa también se calcula en el worker.

`tests/premium.mjs` genera un DNG en color (`tests/dng-color-fixture.js`) y
comprueba: Rec.2020 exacto, GPU frente a CPU (ΔE OKLab ×100: medio < 0,05, máximo
< 1; medido ≈ 0,35), curva monótona, conservación del tono de un verde fuera de
sRGB (el revelado de siempre lo desvía unos 12°), franjas sin costuras, reducción
y TIFF de 16 bits. Medido con esta escena sintética: DHT da +7 dB de PSNR en bordes
de color frente a AHD con un tiempo similar.

Límites honestos: no hay perfiles de objetivo (Lensfun) ni reducción de ruido con
IA; el editor sigue trabajando en 8 bits por canal después de abrir el revelado.
