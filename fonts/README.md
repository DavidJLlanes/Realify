# Tipografías

Todo el catálogo de [Google Fonts](https://fonts.google.com) (1908 familias),
alojado aquí para que Realify **no se conecte con Google** al usar una fuente.
Lo carga `js/editor/gfonts.js`, que registra cada familia con la API FontFace
sólo cuando se usa: el navegador descarga únicamente el peso que dibuja.

| Archivo | Contenido |
|---|---|
| `catalog.json` | Índice: familia (`f`), carpeta (`id`), categoría (`c`), pesos (`w`) y, en las no latinas, alfabeto (`sc`) y trozos por rango de caracteres (`s`) |
| `<id>/<id>-<peso>.woff2` | Alfabeto latino, normal (400) y negrita (700) si existe |
| `<id>/<id>-<peso>-<n>.woff2` | Familias sin letras latinas (coreano, jemer, emoji…), troceadas por rangos |
| `LICENSES.json` | Licencia y aviso de copyright de cada familia |
| `OFL.txt`, `APACHE-2.0.txt`, `UFL.txt` | Textos de las licencias |

## Licencias

Las fuentes **no** son de Realify: cada una conserva la licencia y el copyright
de sus autores (ver `LICENSES.json`). Se distribuyen bajo la
[SIL Open Font License 1.1](OFL.txt) (la gran mayoría), la
[Apache License 2.0](APACHE-2.0.txt) o la [Ubuntu Font Licence 1.0](UFL.txt), que
permiten redistribuirlas y usarlas libremente. Las familias sin licencia indicada
en `LICENSES.json` se publican en Google Fonts con alguna de esas tres.

## Actualizar

Se generaron con los metadatos del paquete npm `google-font-metadata`
(catálogo, categorías y licencias) y la API CSS de Google Fonts para localizar
cada archivo `woff2`, descargado una sola vez. Para añadir familias nuevas basta
con repetir el proceso y regenerar `catalog.json`.
