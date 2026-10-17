# Efectos LUT

Galería a pantalla completa de **226 efectos de color** (tablas LUT `.cube` de 3D). Mismo armazón que Cámaras y
Estilos (`js/ui/fsshell.js`); al aplicar crea una capa de filtro reeditable (`luts` en
`js/editor/filterregistry.js`). Se abre desde **Filtro › Especiales › Efectos LUT…**, **Filtro › Filtros (como en
el móvil) › Efectos LUT…** y, en el móvil, desde la pestaña **Filtros** del cajón «Herramientas».

No sustituye a **Tabla de color (LUT)…** (`js/filters/lut/`), que sigue sirviendo para cargar cualquier `.cube`
propio.

## Archivos

| Archivo | Papel |
|---|---|
| `index.js` | Entrada: `openLuts()` y `renderLuts()` para el registro de filtros |
| `catalog.js` | `FAMILIES` y `ITEMS` (`[id, familia, nombre]`), generado al preparar los archivos |
| `engine.js` | Motor WebGL2 con textura 3D (`LutGL`) y carga de tablas con caché y 5 descargas a la vez (`loadLut`) |
| `ui.js` | Ventana: escritorio con buscador, desplegable de familia, miniaturas, intensidad; móvil con dos desplegables y hoja de miniaturas |
| `lut.css` | Complementos de `css/fsplugin.css` |
| `files/<familia>/<id>.cube` | Las tablas, con nombre descriptivo (sin marcas) |

## Familias

Negativo en color (56) · Diapositiva (24) · Instantánea (47) · Blanco y negro (65) · Copia de cine (4) ·
Digital clásico (7) · Looks creativos (23). Un total de 226 tablas únicas (se descartaron 7 idénticas a otra).

## Cómo funciona

- La tabla se sube como textura 3D con el **rojo corriendo más rápido**, luego el verde y por último el azul, que es
  el orden del `.cube`. Se comprobó contra el cálculo en CPU de `js/filters/lut/engine.js` (error medio < 0,5 sobre 255).
- **Normal**: RGBA16F con filtrado trilineal de la GPU. **Premium 👑**: RGBA32F, **interpolación tetraédrica** (sigue
  la diagonal gris sin teñirla) y tramado triangular de la salida.
- El resultado a resolución completa se calcula por teselas (una tabla no necesita vecindad).
- Las miniaturas se calculan al entrar en pantalla (escritorio) o al abrir la hoja de la familia (móvil): cada una
  descarga su tabla sólo entonces. Cada tabla de las 12 más grandes de «Looks creativos» pesa ~1 MB.
- La capa guarda `{ id, intensity, premium }`: la tabla se vuelve a descargar al reabrirla o recalcularla.

## Nombres

Cada archivo se renombró con un nombre descriptivo de **dos palabras como máximo**, sin marcas, a partir de un
análisis de la propia tabla (color dominante, saturación, contraste, negros, brillo) comparada con el resto de su
familia; así «Ámbar vivo» o «Duro profundo» dicen qué hace. Los looks creativos conservan su nombre en español
(acortado cuando hacía falta). La equivalencia con los nombres de origen **no está en la web**: está en
`C:\Proyectos\LUTs\RENOMBRADO.csv`. Para añadir una tabla: copiar el `.cube` a `files/<familia>/`, añadir su
entrada a `ITEMS` en `catalog.js` y mantener nombre único de dos palabras como máximo.

## Límites

- Sólo tablas 3D (las 226 lo son). El tamaño más habitual es 13³; 11 de 16³ y 12 de 33³.
- Sin vecindad: es un efecto de color puro (no añade grano ni viñeteado).
- No conserva el origen de 16 bits de la capa: el resultado es de 8 bits (con tramado en Premium).
- **Licencia**: las tablas proceden de una colección aportada por el propietario del proyecto (`C:\Proyectos\LUTs`) y sus archivos no declaran licencia ni autoría. Hay que confirmarlas antes de cobrar o redistribuir la web.
