# Stickers

Editor de stickers a pantalla completa, con la misma estructura que el Filtro
Vintage (`plugins/vintage/`) y el revelador RAW (`plugins/raw/`). Se abre desde
**Capa › Añadir stickers…** y, en móvil, desde el cajón **Herramientas**. Al
aplicar, cada sticker queda en su propia capa, y todas se deshacen en un solo
paso.

## Biblioteca

`emoji/` contiene los 1.595 emojis de
[Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (Microsoft, licencia
MIT, ver `emoji/LICENSE`) en cuatro estilos:

| Archivo | Estilo |
|---|---|
| `3d.png` | 3D (PNG de 256 px: se ve blando si se amplía mucho) |
| `color.svg` | Color (vectorial) |
| `flat.svg` | Plano (vectorial) |
| `hc.svg` | Alto contraste (vectorial, sin tonos de piel) |

Los que tienen tonos de piel añaden `-light`, `-medium-light`, `-medium`,
`-medium-dark` y `-dark` (por ejemplo `3d-dark.png`).

`emoji/index.json` guarda el nombre y las palabras clave en español (anotaciones
CLDR de Unicode) y en inglés, el grupo y si hay tonos. Para regenerar la
biblioteca con una versión nueva del repositorio:

```
python tools/build_index.py fluentui-emoji-main.zip annotations.json annotationsDerived.json
```

con el zip del repositorio y los dos `annotations.json` de `es` de
[cldr-json](https://github.com/unicode-org/cldr-json).

## Archivos

| Archivo | Papel |
|---|---|
| `index.js` | Entrada: `openStickers()`; crea las capas al aplicar y guarda los pendientes por documento |
| `catalog.js` | Índice, rutas, búsqueda y carga de imágenes (los SVG se rasterizan al tamaño necesario) |
| `render.js` | Composición de un sticker: giro, volteo, borde de pegatina y sombra |
| `ui.js` | Ventana: catálogo, escenario con gestos y propiedades |
| `stickers.css` | Mismo diseño y medidas que el Filtro Vintage |

## Gestos

Tocar o hacer clic en un sticker lo elige; arrastrarlo lo mueve; el tirador azul
de la esquina lo escala y gira; con dos dedos se pellizca y se gira. En
escritorio, la rueda escala (con Mayús gira), las flechas lo desplazan,
Ctrl+D duplica y Supr elimina.

## Stickers pendientes

Al cerrar con Cancelar, ✕ o Esc los stickers colocados no se pierden: `index.js`
los guarda **en memoria**, ligados a la pestaña (documento), y vuelven al abrir el
editor en ese documento. Al aplicar se convierten en capas y el estado se borra;
al cerrar la pestaña también. Si la imagen cambia de tamaño con la misma
proporción, se reescalan; si cambia de forma (recorte, giro) se descartan avisando.
Las capas ya creadas son capas normales y no se tocan. No se usa `localStorage`:
las coordenadas son de esa imagen concreta y no hay nada que recuperar tras
recargar la página.

## Tono de piel y alto contraste

El tono sólo existe en 3D, color y plano, y sólo en manos y personas (`t: 1` en
`emoji/index.json`). El desplegable se desactiva («Sin tonos») en alto contraste
o cuando nada de lo que se ve lo admite, con una línea que lo explica. El alto
contraste son siluetas negras: se muestran sobre fondo blanco y los nuevos nacen
con un borde de pegatina.

La búsqueda (`js/core/search.js`, compartida con el cajón de Herramientas)
ignora acentos, encuentra palabras en cualquier posición y tolera erratas.
