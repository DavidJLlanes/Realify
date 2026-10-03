# Marcos — `frames/`

Plugin de marcos para Realify.

- **120 marcos**: 10 categorías × 12 variantes.
- Interfaz a pantalla completa siguiendo el patrón de `socialmediapost/`:
  tres zonas en escritorio y controles inferiores compactos en móvil.
- Render vectorial/procedural: no depende de una API ni de imágenes externas.
- Los marcos son **marcos exteriores reales**: al aplicarlos, Realify amplía el
  lienzo y conserva la fotografía completa en el centro. El render del marco se
  recorta a la corona exterior y no puede tapar píxeles de la imagen.
- El marco queda en **una capa raster independiente**, por encima del resto.
- Deshacer/restaurar un marco recupera también el tamaño anterior del documento,
  la selección y las guías.
- Las variantes usan geometrías, materiales, patrones, texturas y acabados
  diferenciados; no son simples recoloraciones del mismo marco.
- La capa fotográfica original no se rasteriza de nuevo por aplicar el marco.

## Categorías

Minimalistas, Clásicos, Paspartú, Película, Instantánea, Vintage,
Geométricos, Decorativos, Color y Festivos.

## Fuente externa investigada

`cyanidecupcake/openclipart-svg` contiene miles de SVG de OpenClipart,
incluida la carpeta `svg/borders/`, y está publicado bajo CC0-1.0.
No se integra el repositorio completo porque ocupa varios GB y contiene
duplicados/desorganización. La arquitectura del plugin permite añadir
posteriormente una selección curada de SVG como presets locales.
