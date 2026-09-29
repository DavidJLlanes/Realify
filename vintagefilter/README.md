# Filtro Vintage

Módulo autónomo, con la misma estructura que el revelador RAW (`raw/`): abre una
ventana a pantalla completa sobre la capa activa y, al aplicar, crea una capa de
filtro reeditable (`vintage` en `js/editor/filterregistry.js`). Se abre desde
**Filtro › Especiales › Filtro Vintage…** y, en móvil, desde el cajón
**Herramientas**.

## Archivos

| Archivo | Papel |
|---|---|
| `index.js` | Entrada: `openVintageFilter()` y `renderVintageFilter()` para el registro de filtros |
| `state.js` | Los 42 modificadores (0-100) en 7 grupos, `seed`, `date` y `frame` |
| `presets.js` | 215 ajustes predefinidos en 19 categorías, con nombres genéricos (sin marcas); los que llevan `frame` incluyen su marco |
| `frames.js` | 119 marcos en 10 categorías (`FRAMES`, `FRAME_CATS`, `drawFrame`) dibujados con Canvas 2D |
| `engine.js` | Motor WebGL2: un único shader con todos los efectos, para la vista previa y el resultado final (por teselas) |
| `overlays.js` | Polvo, arañazos, manchas, grietas, marcas de instantánea, bordes y sello de fecha, dibujados con Canvas 2D a partir de la semilla |
| `ui.js` | Ventana: escritorio con pestañas y deslizadores; móvil con dos desplegables, el botón «Marco» y un deslizador. Hoja de marcos con miniaturas |
| `vintage.css` | Mismo diseño y medidas que `raw/raw.css` |

## Coherencia vista previa / resultado

Todos los efectos espaciales se calculan en coordenadas de la imagen completa,
no de la vista previa. Los elementos aleatorios salen de `seed`: la misma
semilla da el mismo polvo, las mismas fugas y los mismos arañazos al arrastrar,
al aplicar y al reabrir la capa. El botón ⚄ genera una variación nueva.

Los efectos difusos (destello, halación, pérdida de foco periférica) usan
versiones de 640 px de la imagen entera, comunes a la vista previa y a cada
tesela. Los que muestrean lejos del píxel (espiral, coma, trepidación,
distorsión) reciben un margen de vecindad por tesela.

## Marcos

`state.frame` guarda el id del marco (`""` = ninguno) y `frameWidth` (0-100, grupo
Bordes) lo ensancha hasta ×2,2. Cada marco es una función
`draw(ctx, W, H, u, R)` que pinta en coordenadas de la imagen completa (`u` = 4 %
del lado corto, `R` = aleatorio de la semilla), como el resto de `overlays.js`,
sobre la capa «paint» que el shader compone al final: los virados no tiñen el
marco. El marco cubre los bordes de la foto; el tamaño del documento no cambia.

Las miniaturas de la hoja se dibujan con el mismo `drawFrame` sobre la foto
reducida (unos 168 px), sólo cuando entran en pantalla, y se guardan mientras no
cambien la semilla ni la anchura.

Para añadir uno: una entrada `F(id, categoría, nombre, dibujo)` en `FRAMES`
(las familias `instant`, `mat`, `molding`, `film`, `slide`, `edged`, `rough` y
`border` cubren la mayoría). No se pueden usar modos `destination-*`: la capa
«paint» es compartida con los demás elementos dibujados.

## Límites

Necesita WebGL2. Sin él la ventana no se abre y se muestra un aviso; no hay
ruta en la CPU. La posición de la luz para los destellos de lente se estima
automáticamente con la zona más brillante de la foto.
