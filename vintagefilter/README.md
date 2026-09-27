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
| `state.js` | Los 40 modificadores (0-100) en 7 grupos, `seed` y `date` |
| `presets.js` | 26 ajustes predefinidos, con nombres genéricos (sin marcas) |
| `engine.js` | Motor WebGL2: un único shader con todos los efectos, para la vista previa y el resultado final (por teselas) |
| `overlays.js` | Polvo, arañazos, manchas, grietas, marcas de instantánea, bordes y sello de fecha, dibujados con Canvas 2D a partir de la semilla |
| `ui.js` | Ventana: escritorio con pestañas y deslizadores; móvil con dos desplegables y un deslizador |
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

## Límites

Necesita WebGL2. Sin él la ventana no se abre y se muestra un aviso; no hay
ruta en la CPU. La posición de la luz para los destellos de lente se estima
automáticamente con la zona más brillante de la foto.
