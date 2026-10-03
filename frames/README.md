# Marcos — `frames/`

Plugin de marcos para Realify.

- **120 marcos**: 10 categorías × 12 variantes.
- Interfaz a pantalla completa siguiendo el patrón de `socialmediapost/`:
  tres zonas en escritorio y controles inferiores compactos en móvil.
- Render vectorial/procedural: no depende de una API ni de imágenes externas.
- El marco se crea como **una capa raster independiente** encima del documento.
  La capa fotográfica original no se toca, por lo que si conserva `hiSrc`
  (RAW, PNG/TIFF de 16 bits, AVIF de 10/12 bits), el compositor de alta
  precisión puede seguir exportándola a 16 bits.
- Los presets externos futuros pueden añadirse sin cambiar la UI.

## Categorías

Minimalistas, Clásicos, Paspartú, Película, Instantánea, Vintage,
Geométricos, Decorativos, Color y Festivos.

## Fuente externa investigada

`cyanidecupcake/openclipart-svg` contiene miles de SVG de OpenClipart,
incluida la carpeta `svg/borders/`, y está publicado bajo CC0-1.0.
No se integra el repositorio completo porque ocupa varios GB y contiene
duplicados/desorganización. La arquitectura de este plugin permite añadir
una selección curada de esos SVG como presets locales en una iteración futura.
