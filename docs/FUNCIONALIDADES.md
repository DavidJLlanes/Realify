# Realify · referencia de funciones

Todo lo que hace Realify, sección por sección. La ficha del proyecto (qué es, novedades, estructura del código, pruebas,
despliegue, tecnología y licencia) está en el [README](../README.md).

## Cómo se calculan las combinaciones

El número de arriba es un recuento, no una estimación. Cuenta como **un efecto** cada opción que cambia el aspecto
de la foto de forma distinta —un preajuste, un modo de un filtro o una herramienta— y no los deslizadores.

| Grupo | Efectos |
|---|--:|
| Estilos (160 integrados + 151 de acciones de Photoshop) | 311 |
| Efectos LUT | 226 |
| Filtro Vintage | 214 |
| Cámaras | 150 |
| Adaptive Photo Lens (revelado por categoría de foto) | 92 |
| Modos de filtros (desenfoques, distorsiones, artísticos, texturas, pixelado…) | 63 |
| Ajustes de color y tono | 38 |
| Otros filtros (enfoque, ruido, corrección de lente, licuar, parche…) | 26 |
| Curvas (estilos) | 24 |
| Realify (preajustes de cámara) | 18 |
| Recetas de blanco y negro | 18 |
| IA que cambia la imagen (colorear, reducir ruido, restaurar caras, niebla por distancia…) | 15 |
| **Total** | **1.195** |

Los efectos se apilan como capas (cada filtro crea la suya, reordenable), así que se cuentan **secuencias de
efectos distintos donde el orden importa**: con `N = 1.195`, 3 efectos dan `N · (N−1) · (N−2) = 1.702.208.190`.
Si no se tuviera en cuenta el orden, serían 283.701.365 con 3 efectos.

Lo que **no** se cuenta: los deslizadores de cada efecto, el interruptor Premium, la intensidad de cada capa, los
138 marcos, las máscaras ni los modos de fusión; sumarlos multiplicaría la cifra. Tampoco se afirma que todas las
combinaciones den un resultado visualmente distinto: es el número de configuraciones distintas que se pueden montar.

## 1. Archivos: abrir, guardar y exportar

| Función | Qué hace |
|---|---|
| **Abrir imagen** | Diez familias explícitas: JPEG, PNG, WebP, BMP, SVG, TIFF, HEIC, HEIF, JPEG XL, PSD y PSB (con capas, máscaras y efectos). PNG y TIFF de 16 bits, AVIF de 10/12 bits y el RAW revelado con Premium conservan sus bits en la capa base para la exportación en coma flotante (`js/core/hisrc.js`, `js/io/formats/hidepth.js`). Las fotos con colores de gama amplia (Display P3) se detectan y el documento trabaja en P3 si el navegador lo permite. Se reconocen además 40 extensiones RAW que se envían al revelador; otros `image/*` dependen del navegador. También se puede arrastrar y soltar o pegar desde el portapapeles. |
| **Cargar archivos en pila** | Abre varias imágenes como capas de un mismo documento. |
| **Documento nuevo** | Lienzo vacío del tamaño elegido. |
| **Collage / History / Post** | Composiciones para redes creadas como documento nuevo (ver [módulos especiales](#collage--history--post--pluginssocial-post)). |
| **Varios documentos** | Cada documento se abre en su propia pestaña. |
| **Abrir / Guardar proyecto** | Guarda el documento completo (capas, máscaras, capas de ajuste y de filtro, textos) para seguir editándolo más tarde. |
| **Exportar / Exportar como** | Sin capas: JPEG, PNG, WebP, AVIF, **AVIF de 10/12 bits**, **HEIC** (con el codificador HEVC del propio dispositivo vía WebCodecs y un empaquetador HEIF propio, `js/io/formats/heic.js` y `js/io/formats/heif.js`; sólo donde existe: Safari en Apple, Chrome/Edge con hardware), **JPEG XL**, **OpenEXR** (luz lineal, half, ZIP; escritor propio en `js/io/formats/exr.js`), PDF, **TIFF RGBA sin pérdidas (8 bits por canal)** y **PNG / TIFF de 16 bits por canal**. **Alta precisión al exportar**: capas, capas de ajuste y modos de fusión recompuestos en coma flotante por franjas (sin bandas al apilar ajustes) y remuestreo en RGB lineal, hasta 32 MP en ordenador y 16 MP en móvil (`js/io/precision/precision-stack.js`). **Color de gama amplia**: las fotos Display P3 se editan en P3 (`js/core/colorspace.js`) y se exportan con su perfil ICC incrustado en JPEG, PNG y PNG/TIFF de 16 bits (`js/core/icc.js`, `js/io/formats/icc-embed.js`) y en AVIF/EXR con su etiqueta de color (`colr/nclx`, cromaticidades), o convertidas a sRGB a elección. Exportar como también genera **PSD / PSB** (`js/io/formats/professional-formats.js`: capas, grupos, máscaras reales, efectos de capa, 27 modos de fusión, capas de ajuste Invertir/Niveles/Curvas, recorte, sRGB y 72 ppp; PSB hasta 300 000 px) y **PSD / PSB de 16 bits** de la imagen final (escritor propio `js/io/formats/psd16.js`). Los ajustes, máscaras, textos y filtros nativos sólo siguen reeditables en el proyecto `.realify`; PSD guarda una vista compuesta exacta y una referencia oculta si hay ajustes. TIFF de 8 bits y PSD no incrustan un perfil ICC (se guardan en sRGB). Gestor de códecs WASM bajo demanda (`js/io/formats/codecs.js`, JPEG XL y AVIF de jSquash, Apache-2.0) con **peso y calidad estimados** (PSNR) antes de exportar. Límites medidos de memoria: AVIF 24 MP, JPEG XL 16 MP (8 y 6 MP en móvil). En documentos Display P3, JPEG, PNG, **WebP**, **TIFF** (8 y 16 bits), AVIF, HEIC y EXR conservan P3 con su perfil o etiqueta; el filtro Cámara, el Filtro Vintage y el revelador RAW Premium trabajan también en P3. Calidad, escalas y estimación de peso donde procede; perfiles para web e impresión y tramado opcional. |
| **Exportar PNG rápido** | Descarga inmediata en PNG. |
| **Prueba para redes sociales** | Muestra cómo quedará la imagen tras la recompresión típica de las redes. |
| **Exportar GIF animado** | Cada capa visible es un fotograma (sola o acumulada): duración, bucle, ida y vuelta, tamaño y número de colores. |
| **Exportar PDF** | PDF profesional con pdf-lib (`js/io/export/pdfpro.js`, `js/io/export/pdfexport.js`): varias páginas, A5/A4/A3/Carta/Legal o tamaño de la imagen, márgenes, sangrado (TrimBox/BleedBox), 1–9 imágenes por página, portada, numeración, metadatos y resolución objetivo; los JPEG que ya caben se incrustan sin recomprimir. Desde la v254: una página por capa, reordenar/quitar imágenes, fondo para transparencias, marcas de recorte, fuente propia (fontkit) y **PDF/X** (OutputIntent, CMYK matemático sin perfil ICC, no validado con preflight). |
| **Hoja de contactos** | Pantalla completa: hasta 200 fotos en páginas A4, A3, A5, Carta, Oficio o 10 × 15 con columnas, márgenes, título y nombre de cada foto. PDF de varias páginas o capas (`plugins/contact-sheet/`). |
| **Editar en lote / Aplicar esta edición a otras fotos** | Edita una foto y copia su edición (capas de ajuste, filtros, textos, marcas de agua) a otras pestañas o fotos de la galería, con vista previa e **igualado de exposición**. Resultado en sus pestañas, con capas reeditables, o en un ZIP (`plugins/batch/`). |
| **Acciones** | Graba una secuencia de ajustes, filtros y comandos con los valores de sus diálogos y repítela en la foto abierta o en lote (ZIP en JPEG, PNG, WebP o AVIF). Se exportan e importan en JSON. |
| **Restaurar al estado original** | Descarta capas, ediciones e historial y vuelve al archivo tal como se abrió. |

Formatos RAW admitidos (vía LibRaw): `3fr ari arw bay cap cr2 cr3 crw dcr dcs
dng drf eip erf fff gpr iiq k25 kdc mdc mef mos mrw nef nrw obm orf pef ptx pxn
r3d raf raw rwl rw2 rwz sr2 srf srw x3f`.

## 2. Edición e historial

- Deshacer y rehacer ilimitados, con niveles de historial configurables.
- Copiar, cortar, pegar y borrar la selección.
- **Instantáneas**: copias completas y con nombre del documento («antes del
  retoque») para volver a ellas sin deshacer paso a paso.
- **Pincel de historial**: pinta sobre la capa activa píxeles de una
  instantánea.

## 3. Herramientas

| Herramienta | Atajo | | Herramienta | Atajo |
|---|---|---|---|---|
| Mover | V | | Clonar | S |
| Mano | H | | Eliminar manchas | J |
| Zoom | Z | | Mover según el contenido | — |
| Recortar | C | | Exponer (sobre/subexponer) | O |
| Pincel | B | | Dodge & Burn (gris 50 %) | Ctrl+Mayús+D |
| Borrador | E | | Emborronar | R |
| Bote de pintura | G | | Licuar | Q |
| Degradado | N | | Transformación libre | F |
| Formas | U | | Perspectiva | P |
| Texto | T | | Pincel de historial | Ctrl+Mayús+H |
| Selección rectangular | M | | Pluma (trazados) | A |
| Selección elíptica | K | | Cuentagotas | I |
| Lazo | L | | Comparar antes/después | Y |
| Varita mágica | W | | | |

Los pinceles tienen tamaño, dureza, opacidad, flujo, espaciado y dispersión.
Mover ajusta a los bordes y centros de las demás capas.
Como en Photoshop, **Alt + botón derecho y arrastrar** cambia el tamaño (horizontal) y la dureza (vertical) de pinceles y herramientas de retoque compatibles.

**Dinámicas del pincel**: la presión, velocidad e inclinación del stylus (o
emuladas con el ratón) pueden aplicarse a:
- Tamaño del pincel
- Opacidad
- Flujo
- Dispersión

Biblioteca de puntas: estándar, desde imagen, desde capa o archivos `.abr`.

**Pinceles especiales** (barra del Pincel o **Editar › Pinceles especiales**):

- **Simétrico**: eje vertical, horizontal, ambos, cualquiera de las dos
  diagonales (la diagonal real del documento), las dos a la vez o radial de 2 a
  16 radios, con los ejes visibles como guía.
- **Con textura**: grano, papel, lienzo, cristales, rayones, esponja o ruido
  fino, generados de forma procedural y fijos al documento, con relieve y
  escala.
- **De degradado**: el color recorre del frontal al de fondo (o el arcoíris) a
  lo largo del trazo, con longitud y repetición configurables.

**Dodge & Burn** con «Ver gris 50 %»: muestra la capa gris de retoque en
tiempo real mientras se pinta.

## 4. Imagen

- Tamaño de imagen con remuestreo **Lanczos 3, Mitchell, Catmull-Rom**,
  bilineal o del navegador (en segundo plano) y tamaño de lienzo.
- **Escala según el contenido**: redimensiona la imagen sin distorsionar objetos
  importantes. Analiza bordes y detalle, da más espacio a columnas con bordes y
  protege al sujeto. No destructivo: las capas se adaptan de forma inteligente.
  Las máscaras de capa se reescalan, giran y recortan con la imagen.
- Recortar y **corregir perspectiva**. **Perspectiva automática** (botón «Automático 👑»
  de Perspectiva, `js/cv/lines.js`): Hough probabilista + RANSAC de punto de fuga para
  poner las guías solas.
- **Enderezar automáticamente**: busca todas las líneas rectas de la
  foto, propone el ángulo y deja afinarlo con vista previa antes de aplicar.
- Girar 90°/180° y voltear en horizontal o vertical.
- **Fusión HDR** (pantalla completa, `plugins/hdr/`): de 1 a 11 fotos con el
  horquillado detectado por EXIF o por el brillo, alineación, antifantasmas,
  mapa de radiancia o fusión de exposición y mapeo tonal (detalles realzados,
  compresor de tonos, fotográfico) con 17 estilos en miniatura. Se abre como foto nueva.
  Modo **Premium 👑**: curva de respuesta de la cámara estimada (Robertson), RAW en
  luz lineal, fusión de máxima verosimilitud, alineación subpíxel (Lucas–Kanade),
  antifantasmas por zonas, color en OKLab, TIFF de 16 bits y radiancia `.hdr`.
- **Unir imágenes** (pantalla completa, `plugins/merge/`): unión en fila, columna o
  cuadrícula. Detalles en [`plugins/merge/README.md`](.././plugins/merge/README.md).
- **Panorámica** (pantalla completa, `plugins/panorama/`): se une en el dispositivo
  con OpenCV.js (puntos ORB + RANSAC, focal y giro de cada foto, orden automático,
  proyección cilíndrica o esférica, exposición igualada y costuras sin fantasmas,
  recorte). Premium 👑: más resolución y remuestreo Lanczos. Respaldo opcional en
  el servidor, con confirmación.
- **Apilar fotos Premium 👑** (`js/features/stack.js`, `js/cv/`): de 2 a 16 tomas de la
  misma escena, alineadas con precisión subpíxel con OpenCV.js (puntos ORB + RANSAC +
  afinado ECC, flujo óptico opcional; OpenCV 4.12, Apache-2.0, 11 MB, sólo al usarlo) y
  combinadas por franjas en luz lineal: reducir ruido con rechazo de movimiento (el ruido
  baja en √N) o ampliar el enfoque (la toma más nítida en cada punto). Admite RAW (se
  revelan con el motor Premium) y elige como referencia la toma más nítida. Foto nueva a
  resolución completa. La misma alineación sirve en la Fusión HDR («Alineación precisa»,
  homografías ORB + ECC) y en la Panorámica (`plugins/panorama/rotation.js`).
- **Escanear documento Premium 👑** (`js/features/docscan.js`, `js/cv/docquad.js`,
  `js/cv/docclean.js`): detección del cuadrilátero del papel con OpenCV (Canny y Otsu),
  esquinas editables, proporción real por el método de Zhang y He, homografía Lanczos a
  resolución completa, acabado (papel aclarado, gris, blanco y negro de texto) y varias
  páginas en un PDF.
- **Corrección de lente por perfil Premium 👑** (`js/features/lenscorrect.js`, `js/lens/`): EXIF →
  objetivo de la base de Lensfun (`assets/lensdb/lensfun.json`, CC BY-SA 3.0, construida con
  `tools/build-lensdb.mjs`) → distorsión (poly3, poly5, ptlens), aberración cromática (lineal,
  poly3) y viñeteo (pa) a resolución completa, un solo remuestreo bicúbico. Fórmulas
  reimplementadas y comprobadas contra Lensfun (menos de 1 px). Perfiles propios (modelo «acm»
  radial + tangencial de Adobe, `js/lens/userprofiles.js`) para móviles y cámaras fuera de la
  base, recorte del propio archivo, corrección automática (`filter.lensAuto`, para Acciones y
  lote) y, en el revelador RAW, corrección sobre los datos lineales antes del revelado
  (`plugins/raw/lens.js`).
- **Contraste local (CLAHE)** (`js/editor/adjust/clahe.js`, `clahe-math.js`): normal y Premium (OKLab,
  1024 niveles, croma que acompaña a la luz, tramado).
- **Análisis de nitidez**: ver [sección 14](#14-análisis-y-metadatos).
- **Cortar en partes** (pantalla completa, `plugins/slice/`): cuadrícula, tamaño fijo,
  carrusel, perfil de Instagram (orden de subida) o cortes a mano. Cada trozo en
  una capa nueva, en su pestaña, en un ZIP o suelto.
- **Recortar en forma** (pantalla completa, `plugins/shape-crop/`): unas 60 formas
  (polígonos de 3 a 24 lados, estrellas de 3 a 30 puntas, corazón, flores,
  nube, bocadillos, engranaje, anillo, marco, flechas, puzle…) que se mueven,
  escalan y giran sobre la foto, con borde suave y contorno. Capa nueva con
  transparencia.
- **Antes y después** (pantalla completa, `plugins/compare/`): imagen de comparación
  dividida, diagonal, lado a lado o apilada, con etiquetas y formatos de redes.
- **Ajustes de la imagen con IA**: «Reemplazar cielo», «Eliminar fondo», «Ampliar»,
  «Colorear», «Expandir», «Recorte inteligente» y el resto de funciones de IA están en la
  [sección 12](#12-inteligencia-artificial-local).

## 5. Selección y máscaras

**Selección**
- Todo, ninguna e invertir.
- **Seleccionar sujeto** (IA, BodyPix) y **seleccionar cielo** (IA).
- **Selección con un toque 👑** (MobileSAM + SAM) y **seleccionar por texto 👑** o **por
  profundidad 👑**: ver [sección 12](#12-inteligencia-artificial-local).
- Pluma: trazados que se convierten en selección o en máscara de capa.
- Difuminar y **refinar borde** (pelo y bordes finos).
- **Rellenar según el contenido** (PatchMatch o LaMa con IA) y **mover según
  el contenido**.
- **Máscaras de luminosidad y color**.

**Máscaras de capa**
- Descubrir u ocultar todo o la selección, degradado lineal o radial y pintar
  la máscara.
- Invertir, activar/desactivar, niveles, curvas, suavizado y propiedades
  (densidad y difuminado).
- Aplicar o eliminar la máscara.

## 6. Capas

- Nueva, duplicar, eliminar, subir y bajar.
- **Grupos** (Ctrl+G / Ctrl+Mayús+G).
- **Modos de fusión**, opacidad y **Fusionar si** (blend-if por luminosidad y, desde la v256, por canal rojo, verde y azul, también en el compositor de coma flotante y en la GPU).
- **Estilos de capa**: sombra, contorno, resplandor, bisel, superposición…
- **Objetos inteligentes**: transformaciones y filtros sin perder calidad;
  rasterizar cuando haga falta.
- **Capas de ajuste** (reeditables) y **capas de filtro** (el filtro se guarda
  en la capa y se puede reabrir).
- **Capas de relleno**: color sólido, degradado y motivo.
- **Alinear y distribuir** capas.
- Combinar con la de abajo, combinar visibles y acoplar imagen.
- Renombrar con doble clic en el nombre o desde el menú contextual; selección múltiple con Ctrl/Cmd o Mayús en escritorio y con el botón de selección en móvil. Las capas marcadas se pueden agrupar.
- **Añadir stickers** y **añadir marca de agua**.

## 7. Texto

- Capas de texto editables: fuente (del sistema y **las ~1900 tipografías libres
  del catálogo de Google Fonts**, alojadas en `/fonts/`, con buscador), tamaño, color,
  interlineado, espaciado, kerning, ligaduras, mayúsculas y versalitas.
- Estilos de carácter y de párrafo, alineación y sangrías.
- Cuadros de texto y **texto en trazado**.
- Rasterizar texto.

## 8. Ajustes de color y tono

Todos se pueden aplicar directamente o como capa de ajuste.

**Básicos**: brillo y contraste, exposición, niveles, curvas, sombras e
iluminaciones, balance de blancos, tonos (blancos/luces/sombras/negros), tono y
saturación, vibrance.

**Curvas**: RGB, rojo, verde, azul y **luminosidad** (cambia el brillo sin
tocar el color). Todas las curvas se ven a la vez y hay una vista R · G · B
en tres paneles simultáneos. Las curvas de luminosidad y color se pueden
**vincular** y repartir su efecto. Incluye **25 estilos** con miniatura (S
clásica, cine, mate, proceso cruzado, clave alta…) y estilos propios guardados
en el navegador.

**Tonos del histograma**: ajusta solo una franja de tonos (negros, sombras,
medios, luces o blancos) eligiéndola en el histograma; brillo, contraste,
saturación y calidez con bordes suaves.

**Color avanzado**: gradación de color, virado dividido, filtro fotográfico,
**tono y saturación por rangos** (mezclador de ocho rangos con círculos de color,
cuentagotas, **Difusión** e **Intervalo**, y modo Premium 👑 en OKLCh; no afecta a grises),
reemplazar color, igualar color, curvas Lab y de luminosidad, color por canales,
equilibrio de color, corrección selectiva, mezclador de canales y mapa de degradado.

**Automáticos** (primer submenú de Ajustes): mejora automática, tono/color,
contraste y niveles automáticos e **Iluminar foto oscura** (abre las sombras
según la luz de cada zona, tipo LIME/Retinex), cada uno con su versión Premium 👑. Antes de
corregir diagnostican la foto (dominante de color con confianza, luces ya
quemadas, brillos aislados, exposición fuera de rango, colores extremos
neutros) y respetan lo que es intencionado: la luz cálida, una escena de un
solo color, un fondo blanco o una foto nocturna.

**Tono avanzado**: quitar neblina, tono HDR, contraste tonal y densidad neutra
graduada o radial.

**Mapa tonal**: umbral, posterizar, ecualizar, desaturar, blanco y negro (con
recetas) e invertir.

## 9. Filtros

| Grupo | Filtros |
|---|---|
| **Desenfoques** | Gaussiano, galería de desenfoque, caja/forma/promedio/inteligente, movimiento, lente, radial/zoom y superficie. |
| **Enfoque y restauración** | Enfocar, máscara de enfoque/estabilizador (luminancia en coma flotante; deconvolución de foco Van Cittert y de movimiento Landweber, en workers por franjas), enfoque selectivo, nitidez inteligente, paso alto y mediana/polvo/destramar. |
| **Fotografía y detalle** | Corrección de lente, retoque de retrato, **separación de frecuencias**, Dodge & Burn, detalle y estructura, viñeteado. |
| **Ruido** | **Reducción de ruido con IA** (denoise, detección automática de nivel), reducción normal, por canal, **quitar artefactos JPEG con IA** y añadir ruido. |
| **Pixelizar** | Mosaico, cristalizar, puntillismo y semitono. |
| **Estilizar** | Relieve, hallar bordes, resplandor, solarizar, viento y óleo. |
| **Artísticos** | Galería de filtros artísticos. |
| **Interpretar** | Nubes, fibras, destello e iluminación. |
| **Textura** | Texturizador, grano, azulejos, craquelado, desplazamiento, mínimo y máximo. |
| **Distorsión y geometría** | Esferizar, coordenadas polares, distorsiones clásicas, gran angular adaptable, deformación de posición libre, perspectiva y **licuar**. |
| **Corrección local** | Pincel corrector, parche y tampón de clonar. |
| **Otros** | Convolución personalizada 5×5. |

Los filtros se procesan en GPU (WebGL2 y, si está disponible, WebGPU), con
alternativa en CPU y Web Workers: si la GPU da un error, el filtro se calcula
en CPU en lugar de devolver una imagen vacía. Todos dejan su resultado en una
capa de filtro reeditable.

## 10. Calidad de color y precisión

Estas funciones trabajan con más bits y en coma flotante que la versión de 8 bits.
Se usan siempre que el documento tiene origen de 16 bits (PNG, TIFF, RAW revelado o
AVIF de 10/12 bits); sin ese origen, todo sigue como siempre.

- **Ajustes en coma flotante** (`js/editor/render/floatadjust.js`, opción `float` de `runAdjust`): los ajustes
  de color puro (Brillo y contraste, Niveles, Curvas, Balance de blancos, Tono y saturación, Exposición, Color por
  canales, Mezclador, Vibrance) calculan en coma flotante desde el origen de 16 bits de la capa y la capa de
  filtro conserva sus 16 bits (el lienzo de 8 bits es su redondeo tramado).
- **Filtros en coma flotante** (`js/editor/render/floatfilter.js`, opción `float` de `runFilter` y del diálogo en vivo
  de `photo-tools`): los filtros locales (desenfoques, enfoques, ruido, Detalle y estructura, Viñeteado,
  Reducción de ruido, Enfoque selectivo, Retoque de retrato, PurePixel…) suman su cambio a los 16 bits del origen
  («delta»), y los Estilos y las Tablas de color calculan en coma flotante a través de una rejilla RGB
  («color»). Los filtros que mueven o sustituyen la imagen siguen en 8 bits.
- **Filtros avanzados en coma flotante de verdad** (`js/editor/render/floatspatial.js`, desde la v257): Desenfoque de
  superficie, Reducción de ruido por canal, Nitidez inteligente y Desenfoque de lente, y el desenfoque gaussiano,
  Enfocar y Añadir ruido, se calculan sobre los 16 bits con las mismas fórmulas que la versión de 8 bits.
- **Vista previa en coma flotante en GPU** (`js/editor/render/floatcompositor.js`, fase 13): el mismo árbol de capas
  que el compositor de 8 bits se recompone en WebGL2 con texturas RGBA32F/RGBA16F —opacidad, 28 modos de
  fusión, máscaras, recorte, grupos, Fusionar si y capas de ajuste (rejilla RGB de 86³ o curvas de 4096
  puntos)— con las fórmulas de `io/precision/precision-stack.js`, que es la referencia en las pruebas (diferencia
  máxima 0,03 niveles en 32 bits y 0,4 en 16 bits). Las capas con origen de 16 bits muestran esos bits (misma
  regla de `core/hisrc.js`, comprobada en la GPU) y el paso a 8 bits lleva el tramado de la exportación.
  Sólo se usa si compensa (ajustes, 16 bits, Fusionar si o modos «a mano») y todo está soportado. Admite
  **estilos de capa** (sombra, resplandor, trazo y degradado), **trazo en curso**, **caché de texturas por
  capa** (`js/core/canvasrev.js`: un contador de revisión por lienzo, que sube en cada escritura del contexto 2D,
  evita resubir las capas que no cambian) y **composición por teselas** (`floatTuning.tile`, 1024 px; los
  acumuladores sólo miden una tesela, el límite lo pone un presupuesto de texturas: hasta 40 MP en escritorio).
  Documentos Display P3 también (se comprueba una vez que el navegador conserva el P3 por la GPU).
- **16 bits en más sitios** (v252): el autoguardado lleva los 16 bits (caché por los datos de la capa);
  Redimensionar (`resampleHi`: Lanczos/Mitchell/Catmull-Rom/bilineal en coma flotante en el worker), Perspectiva y
  Enderezar (`warpHiToQuad`: inversa de la proyectiva, bilineal en 16 bits) los conservan; **Realify 👑**
  (`engine.renderHi`: cadena RGBA32F sobre los 16 bits), el **Filtro Vintage** (teselas RGBA32F) y el **Revelado
  fotográfico 👑** (ráster de 16 bits en el motor Premium) devuelven 16 bits.
- **Exportación en coma flotante con estilos de capa y Fusionar si** (`io/precision/precision-stack.js`): la sombra,
  el resplandor y el trazo se dibujan aparte (láminas de 8 bits de colores sólidos), la capa va encima en
  coma flotante y el degradado y Fusionar si se evalúan sin redondear; ya no se parte del aplanado de 8 bits.
- **Los 16 bits sobreviven al documento** (`js/core/hisrc.js`, fase 14): girar, voltear, recortar y ampliar el lienzo
  mueven el origen de 16 bits con el lienzo (y lo vuelven a tramar en su sitio), con deshacer y rehacer sin copias en
  el historial; los proyectos `.realify` y el guardado antes de actualizar lo guardan como PNG de 16 bits; duplicar
  capa lo conserva. Exportar tras girar y recortar da los mismos 16 bits que la foto original, bit a bit.
- **Color Display P3 de punta a punta** (desde la v249, `js/core/colorspace.js`): los documentos P3 se
  editan, pintan y exportan en P3. Desde la v257 también los colores de pintura («#rrggbb» y `rgb()`) se leen
  en P3, así que el cuentagotas y el pincel dan el mismo color y se alcanza toda la gama P3.
- **Ajustes de color por rangos en Premium** y **Contraste local** tienen su propio modo de precisión (ver
  [sección 11](#11-modo-premium)).

## 11. Modo Premium

**Premium 👑** es el interruptor con corona que aparece en los plugins y ajustes que lo admiten.
Es el **modo de procesado de más calidad**; apagado, la herramienta queda exactamente igual que antes.

Qué cambia al encenderlo:
- **Luz lineal y coma flotante** de 32 bits en el cálculo, en lugar de 8 bits.
- **Espacios perceptuales** (OKLab, OKLCh) para tono, saturación y contraste, sin desplazamientos de color.
- **Mapeo de gama** controlado y **tramado** a 8 bits al final.
- **GPU** cuando compensa, con la misma matemática que la CPU.
- En las funciones de IA: el **modelo de más calidad**, **refinado de bordes** y resolución completa.

Funciones que sólo existen en Premium (no tienen versión básica), marcadas con 👑 en el menú y en el cajón:
- Procesado: Apilar fotos y Escanear documento.
- IA: Ampliar con IA con Real-ESRGAN ×4 y UltraSharp (elegibles, con Premium), Selección con un toque, Borrador mágico, Seleccionar por texto, Seleccionar por profundidad,
  Difuminar caras, Retoque de cara, Restaurar caras, Ojos rojos, Recorte inteligente para redes,
  Recorte de retrato, Desenfoque por profundidad, Niebla por distancia, Luz por profundidad, Separar
  planos, Foto 3D e Iluminar con IA.

Otras herramientas tienen versión básica y una versión Premium 👑 junto a ella (por ejemplo, Corrección de
lente, Perspectiva automática, Realify, Revelado fotográfico, Fusión HDR, Mejora automática o Contraste local).

**Sin pago por ahora**: cualquiera puede usar las funciones 👑. El distintivo indica el procesado de más
calidad, no un cobro.

Las funciones de IA nuevas siguen esta regla: se descargan sólo al usarlas (avisando antes del tamaño),
se guardan en el navegador (IndexedDB) y su licencia permite el uso comercial, salvo las excepciones
indicadas en la [sección 23](../README.md#23-licencias).

## 12. Inteligencia artificial local

Todos los modelos se ejecutan en el navegador con **ONNX Runtime Web** (WebGPU si está disponible, WebAssembly
si no). La imagen nunca sale del equipo.

Los modelos son de dos tipos:
- **Incluidos**: viajan con la web (`assets/models/`) y funcionan sin conexión desde el primer uso.
- **Bajo demanda**: se descargan de Hugging Face la primera vez que se usan, previa confirmación con su
  tamaño, y se guardan en IndexedDB para las siguientes veces. Es la única conexión externa para pesos de modelos.

| Función | Menú | Modelo(s) | Tamaño | Licencia | Premium 👑 |
|---|---|---|---|---|---|
| Seleccionar sujeto | Selección | BodyPix (MobileNet v1) | incluido (5 MB) | Apache-2.0 | No |
| Seleccionar cielo | Selección | DeepLab v3 · ADE20K | incluido (9 MB) | Apache-2.0 | No |
| Selección con un toque | Selección | MobileSAM (codificador y decodificador de SAM) | incluido (45 MB) | Apache-2.0 | Sí |
| Seleccionar por texto | Máscaras / Selección | DeepLab (categorías ADE20K) + CLIPSeg (descripción libre) + BiSeNet (cara) | DeepLab y BiSeNet incluidos; CLIPSeg 273 MB bajo demanda | Apache-2.0 · BiSeNet (uso no comercial) | Sí |
| Seleccionar por profundidad | Máscaras | Depth Anything V2 Small | incluido (50 MB) | Apache-2.0 | Sí |
| Eliminar fondo | Inteligencia Artificial | U²-Net portátil (incluido) · MODNet retrato (26 MB) · ISNet máxima calidad (179 MB) | 5–179 MB | Apache-2.0 | No |
| Borrador mágico · Expandir con IA · Rellenar con IA | Inteligencia Artificial / Selección | LaMa | 208 MB bajo demanda | Apache-2.0 | Sólo el Borrador mágico |
| Ampliar con IA ×2/×4 | Inteligencia Artificial | Premium 👑: Real-ESRGAN ×4 v3 (2,6 MB) y UltraSharp V2 Lite (16 MB), a elegir. Básico: SPAN ×2 (1,7 MB) y Real-ESRGAN anime ×4 (5,2 MB) | 2–16 MB bajo demanda | Real-ESRGAN: BSD-3-Clause · UltraSharp: CC BY-NC-SA 4.0 · SPAN: ver OpenModelDB | Real-ESRGAN y UltraSharp |
| Colorear con IA | Inteligencia Artificial | SpongeColor Lite · Colorizer V2 · DDColor Tiny | 10–221 MB bajo demanda | Ver nota | No |
| Reducción de ruido con IA | Filtro › Ruido | SCUNet (color) | 91 MB bajo demanda | Apache-2.0 | No |
| Quitar artefactos JPEG con IA | Filtro › Ruido | FBCNN (color) | 144 MB bajo demanda | Apache-2.0 | No |
| Iluminar foto oscura | Ajustes › Automáticos | Algoritmo clásico (sin modelo) | — | — | Tiene versión 👑 |
| Iluminar con IA | Inteligencia Artificial › Mejorar | Zero-DCE++ | incluido (42 KB) | CC BY-NC 4.0 (no comercial) | Sí |
| Retoque de cara · Retoque de piel, ojos, dientes y labios | Inteligencia Artificial › Caras | YuNet + BiSeNet (zonas de la cara) | YuNet 0,2 MB · BiSeNet 53 MB incluidos | MIT · datos CelebAMask-HQ (no comercial) | Sí |
| Difuminar caras · Ojos rojos · Recorte de retrato | Inteligencia Artificial › Caras | YuNet | incluido (0,2 MB) | MIT | Sí |
| Restaurar caras | Inteligencia Artificial › Caras | GFPGAN 1.4 | incluido (170 MB) | Apache-2.0 | Sí |
| Desenfoque, niebla, luz y separación por profundidad · Foto 3D | Inteligencia Artificial › Profundidad | Depth Anything V2 Small | incluido (50 MB) | Apache-2.0 | Sí |
| Recorte inteligente para redes | Inteligencia Artificial › Encuadre | YuNet + detección de sujeto y cielo | incluido | MIT · Apache-2.0 | Sí |
| Adaptive Photo Lens | Inteligencia Artificial | MobileNet v1 (clasificación en 92 tipos) | incluido (1,9 MB) | Apache-2.0 | No |
| Reemplazar cielo | Inteligencia Artificial | DeepLab v3 · ADE20K (detección del cielo) | incluido | Apache-2.0 | No |
| Apilar, Escanear documento, Perspectiva automática, Corrección de lente | Imagen | OpenCV.js (no es IA, visión clásica) | 11 MB bajo demanda | Apache-2.0 | Sí |

Las licencias de cada modelo están en `js/ai/models.js`; las restricciones de uso no comercial se resumen en la
[sección 23](../README.md#23-licencias).

**Eliminar fondo y segmentación**: el resultado va a una capa nueva y la original se oculta. Se puede usar
también por color de los bordes, sin IA.

**Reemplazar cielo**: detecta el cielo (DeepLab/ADE20K) y lo sustituye por un cielo de la **biblioteca**
(101 cielos: 82 fotografías CC0 de Poly Haven y 19 cielos generados; búsqueda y filtros por hora y tiempo), una
foto propia, un degradado o un color, en una capa con su máscara ajustada a los bordes de la foto (sin halo).
El horizonte del cielo nuevo se coloca sobre el detectado; «Posición» lo sube o lo baja. Detalles en
[`assets/skies/README.md`](../assets/skies/README.md).

**Seleccionar por texto** (`js/features/textselect.js`, `js/ai/textclasses.js`): una frase («coche rojo», «césped
sin personas») → selección o máscara de capa. Usa el DeepLab ADE20K que ya viaja con la web (150 categorías,
vocabulario y sinónimos en español, colores por HSV), por bloques y con borde ajustado por filtro guiado; sin
descargas. Lo que no esté en esas categorías se busca con **CLIPSeg** (descripción libre; modelo fp16 de 273 MB que
se baja una vez de Hugging Face; tokenizador CLIP propio `js/ai/cliptokenizer.js`, diccionario ES→EN
`js/ai/es2en.js`). Objetos pequeños: si la foto entera no los ve claro, se buscan en nueve mosaicos. Además
entiende **pelo, cara, ojos, labios, orejas, cuello, gafas y sombrero** con BiSeNet (`faceparsing`, uso no
comercial; se descarga una vez). Vocabulario cerrado.

**Selección con un toque y Borrador mágico** (Segment Anything: MobileSAM + decodificador de SAM): tocas un objeto
y lo selecciona entero, con borde afinado a la resolución de la foto. El borrador lo quita y LaMa rellena el hueco
en una capa nueva, con costura en luz lineal y el grano de la foto.

**Caras** (`js/features/facetools.js`, YuNet incluido): **Difuminar caras** (desenfoque irreversible, pixelado o
relleno, cara a cara), **Retoque de cara** (piel, ojos, dientes y labios por separado, con BiSeNet), **Restaurar
caras** (GFPGAN: reconstruye caras borrosas, antiguas o comprimidas. Desde la v258 sólo sustituye el óvalo de la
cara, con borde suave; fondo, pelo y orejas quedan como en la foto), **Ojos rojos** automático y **Recorte de
retrato** (Recortar con el marco ya encuadrado en la cara).

**Recorte inteligente para redes**: el mejor encuadre para cada formato de red social según el sujeto y las
caras, sin cortar cabezas.

**Iluminar con IA** (Zero-DCE++): estima una curva de luz por zona y color para fotos oscuras, con mapas ajustados a
los bordes y limpieza del ruido de las sombras.

**Profundidad** (Depth Anything V2 Small, Apache 2.0): **Desenfoque por profundidad** (toca dónde enfocar; por capas
de distancia, sin halos y con bokeh en las luces), **Niebla por distancia**, **Foto 3D** (animación con paralaje
guardada como GIF), **Seleccionar por profundidad** (primer plano, plano medio, fondo o intervalo; como selección o
como máscara de cualquier capa, también de ajuste), **Luz por profundidad** y **Separar planos** (una capa por plano
con su máscara acumulativa). La profundidad se calcula a resolución completa por bloques (`js/ai/tiles.js`).

**Ampliar con IA** ×2 o ×4: en Premium 👑 se elige entre Real-ESRGAN ×4 y UltraSharp (máximo detalle); en el modo básico, SPAN ×2 y Real-ESRGAN para ilustraciones. Y **Colorear con IA** (el color se aplica a la luminancia original a tamaño completo).
**Expandir con IA** usa LaMa para rellenar los bordes nuevos del lienzo.

## 13. Módulos especiales

Se abren desde **Filtro › Especiales** (y en móvil desde el cajón de
herramientas); Realify, PurePixel, Unmark y Adaptive Photo Lens, desde el menú
**Inteligencia Artificial** (pestaña del mismo nombre en el cajón). Cada uno es un editor a pantalla completa con vista previa.

### Revelado fotográfico (RAW) — `plugins/raw/`
Revelador RAW local basado en LibRaw (WebAssembly). Trabaja en RGB lineal de
16 bits con vista previa por GPU. Exposición, contraste, altas luces, sombras,
blancos, negros, temperatura, tinte, balance automático, vibrance, saturación,
enfoque, textura, claridad, reducción de ruido de luminosidad y de color, y
corrección de aberración cromática. También se puede usar sobre cualquier capa
raster. El interruptor **Premium** (corona) cambia a un motor de alta calidad
—Rec.2020, demosaico DHT, luz lineal en coma flotante, filtros guiados sin halos,
curva fílmica, color en OKLab, TIFF de 16 bits— con la misma matemática en GPU
(vista previa) y CPU (resultado). Detalles en [`plugins/raw/README.md`](.././plugins/raw/README.md).

### Realify — `js/filters/camera/`
Simulación de cámara en 31 etapas (óptica, sensor, procesador, archivo y
metadatos) con presets, recomendaciones según la imagen y ajuste a partir de los
datos EXIF. Editor a pantalla completa con zoom real hasta 1:1, comparación,
histograma y espectro. Interruptor **Premium 👑** (y entrada «Realify Premium 👑»):
los mismos mandos con la cadena en coma flotante de 32 bits, luces con hombro que
conserva el tono, tinte y saturación en OKLab con mapeo de gama y tramado a 8 bits.

### Marcos — `plugins/frames/`
**138 marcos en 12 categorías**, con un marco Liso de color único y 16 diseños
de autor: kintsugi, vitral, origami, constelación, holográfico y otros. Diamond y
Heart utilizan motivos vectoriales en los cuatro lados. Anchura y colores
editables en todos los marcos, tanto en móvil como en escritorio. La vista
previa y los mandos se adaptan al área visible del navegador. Zoom con rueda o
pellizco, arrastre para recorrer la imagen y «Encajar» para verla completa. El marco amplía el
lienzo, conserva la fotografía y se añade en una capa independiente; deshacer
recupera el tamaño anterior. Detalles en [`plugins/frames/README.md`](.././plugins/frames/README.md).

### Filtro Vintage — `plugins/vintage/`
42 parámetros en 7 grupos (virados, color —con blanco y negro ortocromático y
pancromático—, tono, luz y película, daños, bordes y óptica), **215 estilos** en
19 categorías (décadas, cine clásico, laboratorio, retratos antiguos,
instantáneas, álbum de familia, noir, pop, tecnología retro, galería y museo…) y
un desplegable de **119 marcos** en 10 categorías con miniatura sobre la propia
foto (hoja desde abajo en el móvil). Semilla reproducible y capa de filtro
reeditable. Detalles en [`plugins/vintage/README.md`](.././plugins/vintage/README.md).

### Cámaras — `plugins/cameras/`
Galería a pantalla completa (mismo armazón que el collage y Estilos) de **cámaras de todas las épocas**,
organizadas en familias —procesos del siglo XIX, cajón y fuelle, película en color y en blanco y negro,
instantáneas, juguete, compactas analógicas y digitales de CCD, móviles y webcams, vídeo y vigilancia, ópticas
especiales—, con **miniaturas en vivo** de la propia foto calculadas en la GPU. 61 modificadores, **150 cámaras en 19 familias** y un motor
WebGL2 propio; con el modo **Premium 👑**, luz lineal, hombro suave en las luces y tramado de salida. Semilla
reproducible y capa de filtro reeditable. Detalles en [`plugins/cameras/README.md`](.././plugins/cameras/README.md).

### Efectos LUT — `plugins/lut/`
Galería a pantalla completa (mismo armazón que Cámaras y Estilos) de **226 efectos de color** en siete familias
—negativo en color, diapositiva, instantánea, blanco y negro, copia de cine, digital clásico y looks creativos—,
con **miniaturas en vivo** de la propia foto calculadas en la GPU. Cada efecto es un `.cube` 3D de `plugins/lut/files/`
con nombre descriptivo de dos palabras como máximo. Motor WebGL2 propio con textura 3D; con el modo **Premium 👑**,
interpolación tetraédrica en coma flotante y tramado de salida. Capa de filtro reeditable. Detalles en
[`plugins/lut/README.md`](.././plugins/lut/README.md).

### Estilos y LUT
- **Estilos** (pantalla completa, `js/filters/looks/looksfs.js`): **160 estilos integrados** en 16 categorías
  (básicos, retrato, paisaje, cine, películas, urbano, comida, moda y editorial, redes sociales, blanco y negro,
  noche, estaciones, suaves y pastel, dramáticos, duotonos y creativos, vintage), más **151 estilos por capas**
  convertidos de acciones de Photoshop (`.atn`): 44 de *Matte* y 107 de *Retro y destellos*, con 50 destellos y
  bokeh con sus texturas originales a 4000 px (se descargan sólo al elegirlos). Buscador, categorías, miniatura
  sobre la propia foto, intensidad regulable, Antes/Después y resultado en **capa nueva editable**
  (`js/filters/looks/styleengine.js`, `tools/atn/`). Curvas por canal, saturación, virado partido y duotonos reales.
- **Tabla de color (LUT)**: carga archivos `.cube` y los aplica en una capa.

### Adaptive Photo Lens — `js/filters/lens/`
Un modelo local clasifica la foto entre 92 tipos (retrato, paisaje, comida,
noche…) y propone un revelado adecuado, con intensidad y siete ajustes
editables. El resultado va a una capa reeditable.

### PurePixel — `js/filters/purepixel/`
Procesado de píxeles y exportación en PNG sin metadatos.

### Unmark — `js/filters/unmark/`
Detección y relleno de marcas de agua, y limpieza de marcas invisibles. Todo se hace en local.

### Crear meme — `plugins/memes/`
26 diseños (clásico, desmotivador, comparación, cómic, póster, periódico,
historia 9:16…), segunda foto en los diseños que la admiten, marco, 11 efectos
de imagen y textos ilimitados con 29 tipografías y 26 estilos rápidos (neón,
3D, glitch, fuego…). Detalles en [`plugins/memes/README.md`](.././plugins/memes/README.md).

### Collage / History / Post — `plugins/social-post/`
También en **Archivo › Collage / History / Post…**, incluso sin documento
abierto.
- **Formatos**: 29 de redes sociales (Instagram, TikTok, Facebook, X, Threads,
  LinkedIn, YouTube, Pinterest, WhatsApp…), 15 proporciones, 27 pantallas de
  móviles y tamaño personalizado.
- **Zonas seguras** de historias y de pantallas de móvil.
- **40 diseños de collage** de 1 a 16 fotos, con espaciado, márgenes,
  esquinas, marcos, sombras y fondo (color, degradado, foto difuminada o
  transparente).
- **Diseño «Libre»**: cada foto se coloca donde se quiera y se escala, gira,
  duplica y ordena con tirador, dos dedos o el panel.
- **28 formas** para las fotos (círculo, elipse, polígonos de 3 a 10 lados,
  estrellas de 4 a 10 puntas, corazón, flor, gota, escudo, cruz, luna, sello,
  nube, bocadillo…), para todas o por foto.
- Fotos desde archivo, portapapeles o arrastrando; bandeja con arrastrar a un
  hueco, encuadre, zoom e intercambio entre huecos.
- Textos con el mismo motor del creador de memes.
- El resultado se abre como documento nuevo, con cada foto y texto en su capa.

Detalles en [`plugins/social-post/README.md`](.././plugins/social-post/README.md).

### Stickers — `plugins/stickers/`
Desde **Capa › Añadir stickers…**. 1.595 emojis de Fluent Emoji en cuatro
estilos (3D, color, plano y alto contraste), con tonos de piel y búsqueda en
español e inglés. Cada sticker queda en su propia capa. Si se cierra sin
aplicar, los stickers colocados se conservan mientras el documento siga abierto.
Detalles en
[`plugins/stickers/README.md`](.././plugins/stickers/README.md).

### Otros módulos a pantalla completa
- **Cortar en partes** (`plugins/slice/`), **Recortar en forma** (`plugins/shape-crop/`), **Antes y después** (`plugins/compare/`),
  **Hoja de contactos** (`plugins/contact-sheet/`), **Editar en lote** (`plugins/batch/`) y **Unir imágenes** (`plugins/merge/`):
  ver sus README y las [secciones 1 y 4](#4-imagen).

## 14. Análisis y metadatos

- **Plausibilidad** y **Segunda opinión**: métricas y pruebas forenses sobre
  la imagen compuesta.
- **Espectro de frecuencia** (FFT).
- **Histograma interactivo** (panel lateral): histograma RGB en vivo dividido
  en negros, sombras, medios, luces y blancos; al tocar una zona se ajustan
  solo esos tonos.
- **Cuadrícula inteligente**: detecta el sujeto, el horizonte y los rostros, y
  dibuja tercios, proporción áurea, espiral áurea orientada hacia el sujeto y
  diagonales. Propone un recorte que lleva el sujeto a un punto fuerte y
  endereza el horizonte.
- **Paleta de colores**: los colores dominantes de la imagen para copiar,
  usar como color frontal, descargar o crear como capa.
- **Cuentagotas de pantalla**: coge un color de cualquier parte de la pantalla
  (Chrome y Edge de escritorio).
- **Análisis de nitidez** (`js/features/sharpness.js`): mapa de enfoque a resolución completa en
  una capa nueva y ranking de tomas con nota 0-100 (varianza del Laplaciano en los bloques más
  nítidos, a 1024 px).
- **Metadatos y privacidad** (`js/exif/inspector.js`, `js/io/meta/metadata.js`): el inspector enseña todo lo que lleva el
  archivo original (EXIF, GPS, IPTC, XMP, ICC, MPF, Photoshop, notas del fabricante, miniatura) con un resumen de datos
  personales, leído con ExifReader (MPL-2.0, sin modificar). Al exportar JPEG, PNG o WebP se pueden volver a escribir, desde el
  original y por lista blanca, autor y copyright, fecha, cámara, GPS y descripción (nunca la miniatura, las notas del fabricante ni
  la orientación). «Limpiar metadatos» puede quitar sólo la ubicación y los números de serie sin recomprimir.
- **Metadatos en más formatos** (desde la v253, `js/io/meta/metacontainers.js`: AVIF, JPEG XL, TIFF y PDF; HEIC desde la v257). La
  **nota del fabricante** (MakerNote) se copia en el mismo desplazamiento que tenía; el **IPTC** va en PNG y, como XMP,
  en WebP/AVIF/JXL/TIFF/PDF; **XMP extendido** de JPEG (lectura y escritura, MD5 de Adobe); **Editar metadatos**
  (`js/io/meta/metaedit.js`: campos que mandan sobre el original, guardados en el proyecto) y metadatos en el lote y en las
  Acciones (`js/io/meta/batchmeta.js`).
- **Credenciales de contenido C2PA** (desde la v255, `js/exif/c2pa.js`, `js/exif/c2pasign.js`): el inspector lee las
  credenciales de JPEG, WebP, AVIF, HEIC y JPEG XL, **verifica la firma COSE y la cadena de certificados**
  (WebCrypto; no consulta la lista de confianza ni la revocación), muestra las miniaturas firmadas y comprueba el hash.
  **Firmar…** al exportar genera un manifiesto nuevo con tu certificado y clave en JPEG, PNG, AVIF y HEIC.

## 15. Vista

- Ajustar a la ventana, tamaño real, acercar y alejar.
- **Comparar antes/después** y comparar al 100 %.
- Mostrar u ocultar paneles.
- Reglas, guías, cuadrícula configurable y ajuste a la cuadrícula.
- **Cuadrícula inteligente** y **histograma interactivo** en el panel lateral (ver
  [sección 14](#14-análisis-y-metadatos)).

## 16. App, privacidad y ayuda

- **PWA instalable** (Ayuda › Instalar como app) con service worker para
  funcionar sin conexión. Comprueba versiones al arrancar, volver a la app y
  recuperar conexión, y cada minuto mientras está visible. «Actualizar» guarda
  y recupera los documentos abiertos; «Luego» aplaza el aviso. La detección
  funciona aunque el service worker no cambie al reanudar la app.
- **Guía** interactiva con **buscador** (sin tildes, varias palabras, salta al
  párrafo exacto), página de **novedades** y ayuda directa de cada herramienta
  (botón «?» de la barra de opciones); asistente de bienvenida.
- **Diagnóstico** del navegador y del equipo, e **Informar de un error** (`js/ui/help/bugreport.js`, receptor opcional en `server/informe/`).
- Aviso legal, política de privacidad y de cookies.
- Los modelos de IA se ejecutan en local (ONNX Runtime, con WebGPU o
  WebAssembly). Los modelos grandes (Hugging Face) se descargan la
  primera vez que se usan y quedan en el navegador; la imagen nunca sale del
  equipo.
- **Tipografías** servidas desde el propio sitio (`/fonts/`): el navegador no
  se conecta con Google ni con otros terceros para usarlas.
