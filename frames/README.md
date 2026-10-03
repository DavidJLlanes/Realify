# Marcos — `frames/`

Plugin de marcos para Realify.

- **138 marcos** en 12 categorías: los 120 originales, un marco liso,
  Heart geométrico y 16 diseños de autor.
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

Básicos, Minimalistas, Clásicos, Paspartú, Película, Instantánea, Vintage,
Geométricos, Decorativos, Color, Festivos y De autor.

## Nuevos modelos y ajustes

- Liso: una corona de color uniforme, sin textura ni color secundario.
- Diamond y Heart: motivos vectoriales simétricos repartidos en los cuatro
  lados. Los corazones decorativos y festivos también usan curvas, sin glifos.
- De autor: Aurora boreal, Prisma facetado, Eclipse de metal, Porcelana kintsugi,
  Atlas topográfico, Arcadas art déco, Vitral de joyería, Pliegues de origami,
  Constelación, Seda moiré, Ondas de nácar, Circuito luminoso, Lámina holográfica,
  Mármol azul, Herbario grabado y Abanico art déco.
- Anchura y colores editables en escritorio y móvil, sincronizados al cambiar
  de tamaño de pantalla. Liso muestra sólo el color principal.
- `geometry.js` comparte trazados y distribuye motivos en los cuatro lados.
  `artistic.js` dibuja los nuevos materiales y patrones. Los diseños aleatorios
  usan semillas fijas para que previsualización y resultado sean reproducibles.

Comprobación del editor: `node tests/calidad-herramienta.mjs filter.frames`.

Regresión específica: `node frames/test-marcos.mjs`. Recorre los 138 modelos
con orientación horizontal/vertical y tres anchuras (828 renders), comprueba
recorte, reproducibilidad, motivos en los cuatro lados, color uniforme,
sincronización entre modos y conservación exacta de la foto a resolución completa.
El comprobador general de calidad también marca «detalle bajo» en el plugin
original: compara la capa de marco, sin fotografía, con el detalle de la foto.
La regresión específica verifica por separado los píxeles de ambas capas.
