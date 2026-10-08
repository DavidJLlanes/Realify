<div align="center">

<a href="https://realify.es">
  <img src="assets/og-image-1200x630.png" alt="Realify — editor de imágenes en el navegador" width="100%">
</a>

# Realify

**Editor de imágenes profesional que funciona en el navegador. Sin instalación, sin cuenta y sin subir tus fotos a ningún servidor.**

[![Web](https://img.shields.io/badge/web-realify.es-f5b82e?style=for-the-badge&logo=googlechrome&logoColor=white)](https://realify.es)
[![Licencia no comercial](https://img.shields.io/badge/licencia-PolyForm%20Noncommercial-3b82f6?style=for-the-badge)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-instalable-5a0fc8?style=for-the-badge&logo=pwa&logoColor=white)](https://realify.es)

![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-f7df1e?logo=javascript&logoColor=black)
![WebGL2](https://img.shields.io/badge/GPU-WebGL2_·_WebGPU-990000?logo=webgl&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-LibRaw_·_ONNX-654ff0?logo=webassembly&logoColor=white)
![Sin dependencias](https://img.shields.io/badge/build-sin_compilación-2ea44f)
![Privacidad](https://img.shields.io/badge/procesado-100%25_local-2ea44f)

### [🚀 Abrir Realify en realify.es](https://realify.es)

[Características](#características-destacadas) ·
[Novedades](#novedades-recientes) ·
[Funcionalidades](#índice) ·
[IA local](#12-inteligencia-artificial-local) ·
[Desarrollo local](#19-despliegue) ·
[Contribuir](CONTRIBUTING.md) ·
[Registro de cambios](CHANGELOG.md)

</div>

---

## Qué es Realify

Realify es un editor de imágenes completo que funciona en el navegador. Todo el
procesado —capas, filtros, revelado RAW, modelos de IA— ocurre en el equipo del
usuario: **las imágenes no se suben a ningún servidor**. Se instala como app
(PWA) y funciona sin conexión.

La versión pública está en **[realify.es](https://realify.es)**. Este documento
describe la versión **261** (ver la [lista de cambios](CHANGELOG.md)).

## Características destacadas

<table>
<tr>
<td width="50%" valign="top">

### 🎨 Edición por capas
Capas, grupos, máscaras, modos de fusión, estilos de capa, objetos
inteligentes y capas de ajuste y de filtro reeditables.

</td>
<td width="50%" valign="top">

### 📷 Revelado RAW de 16 bits
Más de 40 formatos RAW con LibRaw en WebAssembly, flujo lineal de 16 bits y
vista previa por GPU. Modo **Premium 👑**: Rec.2020, demosaico DHT, flujo de
escena en coma flotante, tono local sin halos y exportación TIFF de 16 bits.

</td>
</tr>
<tr>
<td valign="top">

### 🤖 IA local
Seleccionar sujeto, cielo y objetos por texto, eliminar fondo, rellenar y
expandir según el contenido, ampliar ×2/×4, colorear, reducir ruido, retocar
caras y estimar profundidad, sin enviar la imagen a nadie.

</td>
<td valign="top">

### ⚡ Aceleración por GPU
Filtros en WebGL2 y WebGPU, con alternativa en CPU y Web Workers para que
nunca falle un resultado.

</td>
</tr>
<tr>
<td valign="top">

### ✨ Creatividad
Fusión HDR de hasta 11 fotos, panorámicas, 160 estilos integrados más 151 estilos
por capas convertidos de acciones de Photoshop, 215 estilos vintage, 119 marcos,
LUT `.cube`, recortes en ~60 formas, memes, stickers, collages y publicaciones
para más de 29 formatos de redes sociales.

</td>
<td valign="top">

### 📱 Escritorio y móvil
Menús clásicos en escritorio; en móvil, un cajón de herramientas pensado para
el pulgar. Instalable y disponible sin conexión.

</td>
</tr>
</table>

### Principios

- **Sin instalación ni cuenta**: basta con abrir [realify.es](https://realify.es).
- **Privado por diseño**: el procesado es local; los modelos de IA se
  descargan, las imágenes nunca se suben.
- **Escritorio y móvil**: menús clásicos en escritorio; en móvil, barra
  inferior y un cajón de herramientas ordenado por objetivo (básicos,
  automáticos, mejorar, corregir, color, estilo…) con buscador tolerante a tildes y erratas. Los
  editores grandes se abren a pantalla completa, con la imagen primero y
  mandos pensados para el pulgar.
- **Sin dependencias ni compilación**: HTML, CSS y JavaScript con módulos ES.

## Novedades recientes

Resumen de las últimas versiones. El detalle completo está en el
[registro de cambios](CHANGELOG.md).

| Versión | Novedad |
|---|---|
| **v261** | **Destellos de luz y bokeh** con sus texturas originales a 4000 px (50 en total), en modo Trama y como capa editable. |
| **v260** | **Estilos a pantalla completa** con buscador, Antes/Después y resultado en capa nueva. 138 estilos nuevos convertidos de acciones de Photoshop (`.atn`), con un motor de recetas por capas (151 en la versión actual). |
| **v259** | **Color por rangos**: cuentagotas y ocho círculos de color, control de **Difusión** del intervalo y modo Premium en OKLCh. |
| **v258** | **Restaurar caras** sustituye sólo el óvalo del rostro, sin tocar fondo, pelo ni orejas. Combinar capas acepta resultados de filtros e IA. |
| **v257** | **Color Display P3** en la pintura, **HEIC de 10 bits**, selección por texto de objetos pequeños y metadatos EXIF y XMP en OpenEXR. |
| **v256** | **«Fusionar si» por canal** (rojo, verde y azul) y PSD con texto y objetos inteligentes con giro, escala y sesgo. |
| **v255** | **Credenciales de contenido C2PA**: verificación de la firma en el inspector y «Firmar…» al exportar. |
| **v254** | **PDF profesional** con PDF/X, sangrado, marcas de corte, una página por capa, y PSD/PSB. |

## Índice

1. [Archivos: abrir, guardar y exportar](#1-archivos-abrir-guardar-y-exportar)
2. [Edición e historial](#2-edición-e-historial)
3. [Herramientas](#3-herramientas)
4. [Imagen](#4-imagen)
5. [Selección y máscaras](#5-selección-y-máscaras)
6. [Capas](#6-capas)
7. [Texto](#7-texto)
8. [Ajustes de color y tono](#8-ajustes-de-color-y-tono)
9. [Filtros](#9-filtros)
10. [Calidad de color y precisión](#10-calidad-de-color-y-precisión)
11. [Modo Premium](#11-modo-premium)
12. [Inteligencia artificial local](#12-inteligencia-artificial-local)
13. [Módulos especiales](#13-módulos-especiales)
14. [Análisis y metadatos](#14-análisis-y-metadatos)
15. [Vista](#15-vista)
16. [App, privacidad y ayuda](#16-app-privacidad-y-ayuda)
17. [Estructura del proyecto](#17-estructura-del-proyecto)
18. [Pruebas](#18-pruebas)
19. [Despliegue](#19-despliegue)
20. [Tecnología](#20-tecnología)
21. [Compatibilidad](#21-compatibilidad)
22. [Contribuir](#22-contribuir)
23. [Licencias](#23-licencias)

---

## 1. Archivos: abrir, guardar y exportar

| Función | Qué hace |
|---|---|
| **Abrir imagen** | Diez familias explícitas: JPEG, PNG, WebP, BMP, SVG, TIFF, HEIC, HEIF, JPEG XL, PSD y PSB (con capas, máscaras y efectos). PNG y TIFF de 16 bits, AVIF de 10/12 bits y el RAW revelado con Premium conservan sus bits en la capa base para la exportación en coma flotante (`js/core/hisrc.js`, `js/io/hidepth.js`). Las fotos con colores de gama amplia (Display P3) se detectan y el documento trabaja en P3 si el navegador lo permite. Se reconocen además 40 extensiones RAW que se envían al revelador; otros `image/*` dependen del navegador. También se puede arrastrar y soltar o pegar desde el portapapeles. |
| **Cargar archivos en pila** | Abre varias imágenes como capas de un mismo documento. |
| **Documento nuevo** | Lienzo vacío del tamaño elegido. |
| **Collage / History / Post** | Composiciones para redes creadas como documento nuevo (ver [módulos especiales](#collage--history--post--socialmediapost)). |
| **Varios documentos** | Cada documento se abre en su propia pestaña. |
| **Abrir / Guardar proyecto** | Guarda el documento completo (capas, máscaras, capas de ajuste y de filtro, textos) para seguir editándolo más tarde. |
| **Exportar / Exportar como** | Sin capas: JPEG, PNG, WebP, AVIF, **AVIF de 10/12 bits**, **HEIC** (con el codificador HEVC del propio dispositivo vía WebCodecs y un empaquetador HEIF propio, `js/io/heic.js` y `js/io/heif.js`; sólo donde existe: Safari en Apple, Chrome/Edge con hardware), **JPEG XL**, **OpenEXR** (luz lineal, half, ZIP; escritor propio en `js/io/exr.js`), PDF, **TIFF RGBA sin pérdidas (8 bits por canal)** y **PNG / TIFF de 16 bits por canal**. **Alta precisión al exportar**: capas, capas de ajuste y modos de fusión recompuestos en coma flotante por franjas (sin bandas al apilar ajustes) y remuestreo en RGB lineal, hasta 32 MP en ordenador y 16 MP en móvil (`js/core/precision-stack.js`). **Color de gama amplia**: las fotos Display P3 se editan en P3 (`js/core/colorspace.js`) y se exportan con su perfil ICC incrustado en JPEG, PNG y PNG/TIFF de 16 bits (`js/core/icc.js`, `js/io/icc-embed.js`) y en AVIF/EXR con su etiqueta de color (`colr/nclx`, cromaticidades), o convertidas a sRGB a elección. Exportar como también genera **PSD / PSB** (`js/io/professional-formats.js`: capas, grupos, máscaras reales, efectos de capa, 27 modos de fusión, capas de ajuste Invertir/Niveles/Curvas, recorte, sRGB y 72 ppp; PSB hasta 300 000 px) y **PSD / PSB de 16 bits** de la imagen final (escritor propio `js/io/psd16.js`). Los ajustes, máscaras, textos y filtros nativos sólo siguen reeditables en el proyecto `.realify`; PSD guarda una vista compuesta exacta y una referencia oculta si hay ajustes. TIFF de 8 bits y PSD no incrustan un perfil ICC (se guardan en sRGB). Gestor de códecs WASM bajo demanda (`js/io/codecs.js`, JPEG XL y AVIF de jSquash, Apache-2.0) con **peso y calidad estimados** (PSNR) antes de exportar. Límites medidos de memoria: AVIF 24 MP, JPEG XL 16 MP (8 y 6 MP en móvil). En documentos Display P3, JPEG, PNG, **WebP**, **TIFF** (8 y 16 bits), AVIF, HEIC y EXR conservan P3 con su perfil o etiqueta; el filtro Cámara, el Filtro Vintage y el revelador RAW Premium trabajan también en P3. Calidad, escalas y estimación de peso donde procede; perfiles para web e impresión y tramado opcional. |
| **Exportar PNG rápido** | Descarga inmediata en PNG. |
| **Prueba para redes sociales** | Muestra cómo quedará la imagen tras la recompresión típica de las redes. |
| **Exportar GIF animado** | Cada capa visible es un fotograma (sola o acumulada): duración, bucle, ida y vuelta, tamaño y número de colores. |
| **Exportar PDF** | PDF profesional con pdf-lib (`js/io/pdfpro.js`, `js/io/pdfexport.js`): varias páginas, A5/A4/A3/Carta/Legal o tamaño de la imagen, márgenes, sangrado (TrimBox/BleedBox), 1–9 imágenes por página, portada, numeración, metadatos y resolución objetivo; los JPEG que ya caben se incrustan sin recomprimir. Desde la v254: una página por capa, reordenar/quitar imágenes, fondo para transparencias, marcas de recorte, fuente propia (fontkit) y **PDF/X** (OutputIntent, CMYK matemático sin perfil ICC, no validado con preflight). |
| **Hoja de contactos** | Pantalla completa: hasta 200 fotos en páginas A4, A3, A5, Carta, Oficio o 10 × 15 con columnas, márgenes, título y nombre de cada foto. PDF de varias páginas o capas (`hojacontactos/`). |
| **Editar en lote / Aplicar esta edición a otras fotos** | Edita una foto y copia su edición (capas de ajuste, filtros, textos, marcas de agua) a otras pestañas o fotos de la galería, con vista previa e **igualado de exposición**. Resultado en sus pestañas, con capas reeditables, o en un ZIP (`lote/`). |
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
- **Fusión HDR** (pantalla completa, `hdr/`): de 1 a 11 fotos con el
  horquillado detectado por EXIF o por el brillo, alineación, antifantasmas,
  mapa de radiancia o fusión de exposición y mapeo tonal (detalles realzados,
  compresor de tonos, fotográfico) con 17 estilos en miniatura. Se abre como foto nueva.
  Modo **Premium 👑**: curva de respuesta de la cámara estimada (Robertson), RAW en
  luz lineal, fusión de máxima verosimilitud, alineación subpíxel (Lucas–Kanade),
  antifantasmas por zonas, color en OKLab, TIFF de 16 bits y radiancia `.hdr`.
- **Unir imágenes** (pantalla completa, `unir/`): panorámica automática
  (proyección cilíndrica, solape por correlación de gradientes, exposición
  igualada, costuras suaves y recorte) o unión en fila, columna o cuadrícula.
  Detalles en [`unir/README.md`](unir/README.md).
- **Apilar fotos Premium 👑** (`js/features/stack.js`, `js/cv/`): de 2 a 16 tomas de la
  misma escena, alineadas con precisión subpíxel con OpenCV.js (puntos ORB + RANSAC +
  afinado ECC, flujo óptico opcional; OpenCV 4.12, Apache-2.0, 11 MB, sólo al usarlo) y
  combinadas por franjas en luz lineal: reducir ruido con rechazo de movimiento (el ruido
  baja en √N) o ampliar el enfoque (la toma más nítida en cada punto). Admite RAW (se
  revelan con el motor Premium) y elige como referencia la toma más nítida. Foto nueva a
  resolución completa. La misma alineación sirve en la Fusión HDR («Alineación precisa»,
  homografías ORB + ECC) y en Unir imágenes (proyección «Precisa», `unir/precise.js`).
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
  (`raw/lens.js`).
- **Contraste local (CLAHE)** (`js/editor/clahe.js`, `clahe-math.js`): normal y Premium (OKLab,
  1024 niveles, croma que acompaña a la luz, tramado).
- **Análisis de nitidez**: ver [sección 14](#14-análisis-y-metadatos).
- **Cortar en partes** (pantalla completa, `cortar/`): cuadrícula, tamaño fijo,
  carrusel, perfil de Instagram (orden de subida) o cortes a mano. Cada trozo en
  una capa nueva, en su pestaña, en un ZIP o suelto.
- **Recortar en forma** (pantalla completa, `formas/`): unas 60 formas
  (polígonos de 3 a 24 lados, estrellas de 3 a 30 puntas, corazón, flores,
  nube, bocadillos, engranaje, anillo, marco, flechas, puzle…) que se mueven,
  escalan y giran sobre la foto, con borde suave y contorno. Capa nueva con
  transparencia.
- **Antes y después** (pantalla completa, `comparar/`): imagen de comparación
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

- **Ajustes en coma flotante** (`js/editor/floatadjust.js`, opción `float` de `runAdjust`): los ajustes
  de color puro (Brillo y contraste, Niveles, Curvas, Balance de blancos, Tono y saturación, Exposición, Color por
  canales, Mezclador, Vibrance) calculan en coma flotante desde el origen de 16 bits de la capa y la capa de
  filtro conserva sus 16 bits (el lienzo de 8 bits es su redondeo tramado).
- **Filtros en coma flotante** (`js/editor/floatfilter.js`, opción `float` de `runFilter` y del diálogo en vivo
  de `photo-tools`): los filtros locales (desenfoques, enfoques, ruido, Detalle y estructura, Viñeteado,
  Reducción de ruido, Enfoque selectivo, Retoque de retrato, PurePixel…) suman su cambio a los 16 bits del origen
  («delta»), y los Estilos y las Tablas de color calculan en coma flotante a través de una rejilla RGB
  («color»). Los filtros que mueven o sustituyen la imagen siguen en 8 bits.
- **Filtros avanzados en coma flotante de verdad** (`js/editor/floatspatial.js`, desde la v257): Desenfoque de
  superficie, Reducción de ruido por canal, Nitidez inteligente y Desenfoque de lente, y el desenfoque gaussiano,
  Enfocar y Añadir ruido, se calculan sobre los 16 bits con las mismas fórmulas que la versión de 8 bits.
- **Vista previa en coma flotante en GPU** (`js/gpu/floatcompositor.js`, fase 13): el mismo árbol de capas
  que el compositor de 8 bits se recompone en WebGL2 con texturas RGBA32F/RGBA16F —opacidad, 28 modos de
  fusión, máscaras, recorte, grupos, Fusionar si y capas de ajuste (rejilla RGB de 86³ o curvas de 4096
  puntos)— con las fórmulas de `core/precision-stack.js`, que es la referencia en las pruebas (diferencia
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
- **Exportación en coma flotante con estilos de capa y Fusionar si** (`core/precision-stack.js`): la sombra,
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
indicadas en la [sección 23](#23-licencias).

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
| IA avanzada local (CUDA) | Inteligencia Artificial | Real-ESRGAN, NAFNet, SAM 2.1, FLUX.1 Fill, PuLID, IP-Adapter, ControlNet, Depth Anything V2 Large, Qwen3 (en el PC del usuario, ver abajo) | Según el modelo | Apache-2.0, MIT, BSD-3 · FLUX dev (**no comercial**) | — |

Las licencias de cada modelo están en `js/ai/models.js`; las restricciones de uso no comercial se resumen en la
[sección 23](#23-licencias).

**Eliminar fondo y segmentación**: el resultado va a una capa nueva y la original se oculta. Se puede usar
también por color de los bordes, sin IA.

**Reemplazar cielo**: detecta el cielo (DeepLab/ADE20K) y lo sustituye por un cielo de la **biblioteca**
(101 cielos: 82 fotografías CC0 de Poly Haven y 19 cielos generados; búsqueda y filtros por hora y tiempo), una
foto propia, un degradado o un color, en una capa con su máscara ajustada a los bordes de la foto (sin halo).
El horizonte del cielo nuevo se coloca sobre el detectado; «Posición» lo sube o lo baja. Detalles en
[`assets/skies/README.md`](assets/skies/README.md).

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

**IA avanzada local (CUDA)** (menú Inteligencia Artificial › IA avanzada local): para quien tenga una GPU NVIDIA
en Windows, un servicio local en `127.0.0.1` ejecuta modelos más pesados (Real-ESRGAN, NAFNet, SAM2.1, FLUX Fill,
PuLID, IP-Adapter, ControlNet, Depth Anything V2 Large…). Es un proyecto aparte, en
[`advanced-ai/`](advanced-ai/README.md); la web sólo lo usa si el servicio está instalado y en marcha.

## 13. Módulos especiales

Se abren desde **Filtro › Especiales** (y en móvil desde el cajón de
herramientas); Realify, PurePixel, Unmark y Adaptive Photo Lens, desde el menú
**Inteligencia Artificial** (pestaña del mismo nombre en el cajón). Cada uno es un editor a pantalla completa con vista previa.

### Revelado fotográfico (RAW) — `raw/`
Revelador RAW local basado en LibRaw (WebAssembly). Trabaja en RGB lineal de
16 bits con vista previa por GPU. Exposición, contraste, altas luces, sombras,
blancos, negros, temperatura, tinte, balance automático, vibrance, saturación,
enfoque, textura, claridad, reducción de ruido de luminosidad y de color, y
corrección de aberración cromática. También se puede usar sobre cualquier capa
raster. El interruptor **Premium** (corona) cambia a un motor de alta calidad
—Rec.2020, demosaico DHT, luz lineal en coma flotante, filtros guiados sin halos,
curva fílmica, color en OKLab, TIFF de 16 bits— con la misma matemática en GPU
(vista previa) y CPU (resultado). Detalles en [`raw/README.md`](raw/README.md).

### Realify — `js/filters/camera/`
Simulación de cámara en 31 etapas (óptica, sensor, procesador, archivo y
metadatos) con presets, recomendaciones según la imagen y ajuste a partir de los
datos EXIF. Editor a pantalla completa con zoom real hasta 1:1, comparación,
histograma y espectro. Interruptor **Premium 👑** (y entrada «Realify Premium 👑»):
los mismos mandos con la cadena en coma flotante de 32 bits, luces con hombro que
conserva el tono, tinte y saturación en OKLab con mapeo de gama y tramado a 8 bits.

### Marcos — `frames/`
**138 marcos en 12 categorías**, con un marco Liso de color único y 16 diseños
de autor: kintsugi, vitral, origami, constelación, holográfico y otros. Diamond y
Heart utilizan motivos vectoriales en los cuatro lados. Anchura y colores
editables en todos los marcos, tanto en móvil como en escritorio. La vista
previa y los mandos se adaptan al área visible del navegador. Zoom con rueda o
pellizco, arrastre para recorrer la imagen y «Encajar» para verla completa. El marco amplía el
lienzo, conserva la fotografía y se añade en una capa independiente; deshacer
recupera el tamaño anterior. Detalles en [`frames/README.md`](frames/README.md).

### Filtro Vintage — `vintagefilter/`
42 parámetros en 7 grupos (virados, color —con blanco y negro ortocromático y
pancromático—, tono, luz y película, daños, bordes y óptica), **215 estilos** en
19 categorías (décadas, cine clásico, laboratorio, retratos antiguos,
instantáneas, álbum de familia, noir, pop, tecnología retro, galería y museo…) y
un desplegable de **119 marcos** en 10 categorías con miniatura sobre la propia
foto (hoja desde abajo en el móvil). Semilla reproducible y capa de filtro
reeditable. Detalles en [`vintagefilter/README.md`](vintagefilter/README.md).

### Estilos y LUT
- **Estilos** (pantalla completa, `js/filters/looksfs.js`): **160 estilos integrados** en 16 categorías
  (básicos, retrato, paisaje, cine, películas, urbano, comida, moda y editorial, redes sociales, blanco y negro,
  noche, estaciones, suaves y pastel, dramáticos, duotonos y creativos, vintage), más **151 estilos por capas**
  convertidos de acciones de Photoshop (`.atn`): 44 de *Matte* y 107 de *Retro y destellos*, con 50 destellos y
  bokeh con sus texturas originales a 4000 px (se descargan sólo al elegirlos). Buscador, categorías, miniatura
  sobre la propia foto, intensidad regulable, Antes/Después y resultado en **capa nueva editable**
  (`js/filters/styleengine.js`, `tools/atn/`). Curvas por canal, saturación, virado partido y duotonos reales.
- **Tabla de color (LUT)**: carga archivos `.cube` y los aplica en una capa.

### Adaptive Photo Lens — `js/filters/lens/`
Un modelo local clasifica la foto entre 92 tipos (retrato, paisaje, comida,
noche…) y propone un revelado adecuado, con intensidad y siete ajustes
editables. El resultado va a una capa reeditable.

### PurePixel — `js/filters/purepixel/`
Procesado de píxeles y exportación en PNG sin metadatos.

### Unmark — `js/filters/unmark/`
Detección y relleno de marcas de agua. Admite un servidor propio opcional
(`server/unmark/`); sin él, todo se hace en local.

### Crear meme — `memes/`
26 diseños (clásico, desmotivador, comparación, cómic, póster, periódico,
historia 9:16…), segunda foto en los diseños que la admiten, marco, 11 efectos
de imagen y textos ilimitados con 29 tipografías y 26 estilos rápidos (neón,
3D, glitch, fuego…). Detalles en [`memes/README.md`](memes/README.md).

### Collage / History / Post — `socialmediapost/`
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

Detalles en [`socialmediapost/README.md`](socialmediapost/README.md).

### Stickers — `stickers/`
Desde **Capa › Añadir stickers…**. 1.595 emojis de Fluent Emoji en cuatro
estilos (3D, color, plano y alto contraste), con tonos de piel y búsqueda en
español e inglés. Cada sticker queda en su propia capa. Detalles en
[`stickers/README.md`](stickers/README.md).

### Otros módulos a pantalla completa
- **Cortar en partes** (`cortar/`), **Recortar en forma** (`formas/`), **Antes y después** (`comparar/`),
  **Hoja de contactos** (`hojacontactos/`), **Editar en lote** (`lote/`) y **Unir imágenes** (`unir/`):
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
- **Metadatos y privacidad** (`js/exif/inspector.js`, `js/io/metadata.js`): el inspector enseña todo lo que lleva el
  archivo original (EXIF, GPS, IPTC, XMP, ICC, MPF, Photoshop, notas del fabricante, miniatura) con un resumen de datos
  personales, leído con ExifReader (MPL-2.0, sin modificar). Al exportar JPEG, PNG o WebP se pueden volver a escribir, desde el
  original y por lista blanca, autor y copyright, fecha, cámara, GPS y descripción (nunca la miniatura, las notas del fabricante ni
  la orientación). «Limpiar metadatos» puede quitar sólo la ubicación y los números de serie sin recomprimir.
- **Metadatos en más formatos** (desde la v253, `js/io/metacontainers.js`: AVIF, JPEG XL, TIFF y PDF; HEIC desde la v257). La
  **nota del fabricante** (MakerNote) se copia en el mismo desplazamiento que tenía; el **IPTC** va en PNG y, como XMP,
  en WebP/AVIF/JXL/TIFF/PDF; **XMP extendido** de JPEG (lectura y escritura, MD5 de Adobe); **Editar metadatos**
  (`js/io/metaedit.js`: campos que mandan sobre el original, guardados en el proyecto) y metadatos en el lote y en las
  Acciones (`js/io/batchmeta.js`).
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
- **Diagnóstico** del navegador y del equipo, e **Informar de un error** (`js/ui/bugreport.js`, receptor opcional en `server/informe/`).
- Aviso legal, política de privacidad y de cookies.
- Los modelos de IA se ejecutan en local (ONNX Runtime, con WebGPU o
  WebAssembly). Los modelos grandes (Hugging Face) se descargan la
  primera vez que se usan y quedan en el navegador; la imagen nunca sale del
  equipo.
- **Tipografías** servidas desde el propio sitio (`/fonts/`): el navegador no
  se conecta con Google ni con otros terceros para usarlas.

## 17. Estructura del proyecto

```
index.html              Página principal
sw.js                   Service worker (red primero, caché de respaldo)
manifest.webmanifest    Manifiesto de la PWA
version.json            Número de versión publicado
.htaccess               Cabeceras, compresión y caché para Apache
css/                    Estilos: tokens, base, layout y móvil
js/
  main.js               Arranque
  core/                 Documento, historial, instantáneas, bus de eventos, dispositivo, búsqueda, formas, color P3, ICC
  editor/               Herramientas, pinceles, capas, máscaras, selección, texto, ajustes,
                        curvas, tonos del histograma, color por rangos, CLAHE, cuadrícula inteligente
  filters/              Filtros y filtros especiales (camera, lens, lut, purepixel, unmark, estilos…)
  features/             Sujeto, cielo, IA (texto, caras, profundidad, escáner, apilado), herramientas
                        fotográficas, paleta y acciones
  ai/                   Catálogo de modelos, carga y ejecución (ONNX), teselas, SAM, CLIPSeg, Zero-DCE++
  analysis/             Métricas, forense y FFT
  cv/                   OpenCV bajo demanda: alineación subpíxel, apilado, escáner de documentos, líneas
  exif/                 Lectura y escritura de EXIF, inspector, C2PA
  gpu/                  Compositor en coma flotante (WebGL2 / WebGPU)
  io/                   Abrir, exportar (AVIF, HEIC, JPEG XL, OpenEXR, PSD, PDF, GIF), códecs, proyectos, lotes y ZIP
  lens/                 Corrección de lente (Lensfun y perfiles propios)
  ui/                   Menús, paneles, diálogos, ventana común de plugins (fsshell), guía y cajón móvil
  vendor/               Librerías de terceros (ver js/vendor/ATTRIBUTIONS.md)
raw/                    Revelador RAW (LibRaw-Wasm)
vintagefilter/          Filtro Vintage
memes/                  Creador de memes
socialmediapost/        Collage / Historia / Post
stickers/               Stickers (Fluent Emoji)
hdr/                    Fusión HDR
unir/                   Unir imágenes (panorámica y unión)
cortar/                 Cortar en partes
formas/                 Recortar en forma
comparar/               Antes y después
hojacontactos/          Hoja de contactos
lote/                   Aplicar una edición a varias fotos
frames/                 Marcos
assets/                 Modelos de IA (models/), estilos (estilos/), cielos (skies/), perfiles de lente (lensdb/) e iconos
fonts/                  Tipografías libres (catálogo de Google Fonts), servidas desde el sitio
tools/                  Herramientas de desarrollo: conversor de acciones .atn, base de datos de lentes
tests/                  Pruebas automáticas (ver la sección 18)
server/                 Configuración de nginx, servidor opcional para Unmark (FastAPI) y receptor de informes de error (`informe/`)
advanced-ai/            Proyecto aparte: servicio local con CUDA para IA avanzada (no forma parte de la web)
.github/workflows/      Despliegue automático en realify.es
```

## 18. Pruebas

Las pruebas están en `tests/` y en algunas carpetas de herramientas. Se ejecutan con Node.js; la cabecera de cada
archivo indica su uso. La mayoría sirve el propio repositorio y necesita **Playwright con Chromium**.

```bash
node tests/calidad-herramienta.mjs adj.hsl     # calidad de una herramienta, en móvil y escritorio
node tests/rango-hsl.mjs                       # una prueba concreta
node frames/test-marcos.mjs                    # regresión de los marcos
```

- **Calidad de herramienta** (`tests/calidad-herramienta.mjs <comando>`): ejecuta el comando de menú de la herramienta
  modificada sobre una imagen de detalle fino de 3000 × 2000 px, en móvil y en escritorio, y comprueba que el resultado
  tiene el tamaño del documento, coincide con el cálculo a resolución completa y no lanza errores. Termina con
  `APTO`, `APTO*` o `FALLO`. Una herramienta con `FALLO` no se publica.
- Algunos scripts `*_check.py` validan los archivos generados con bibliotecas de referencia (por ejemplo,
  c2pa-python o pillow-heif).

## 19. Despliegue

Es un sitio estático: basta con servir los archivos con cualquier servidor web.

- **Producción ([realify.es](https://realify.es))**: nginx. Cada push a `main`
  se publica automáticamente con GitHub Actions; ver [DEPLOY.md](DEPLOY.md).
- **nginx**: la configuración de cabeceras de seguridad, compresión, caché y
  bloqueo de archivos internos está en
  [`server/nginx-realify.conf.example`](server/nginx-realify.conf.example).
- **Apache**: el `.htaccess` hace lo mismo (nginx lo ignora).
- Hace falta **HTTPS** para el service worker y la instalación como app.
- Al cambiar archivos de la app, sube `VERSION` en `sw.js`, el `?v=` de
  `js/main.js` en `index.html` y el número de `version.json` para que los usuarios reciban la versión nueva.

Para probarlo en local, sirve la carpeta con cualquier servidor estático:

```bash
python -m http.server 8080
```

y abre `http://localhost:8080`.

## 20. Tecnología

| Área | Tecnología |
|---|---|
| Interfaz | HTML5, CSS con tokens de diseño, JavaScript con módulos ES (sin framework ni compilación) |
| Gráficos | Canvas 2D, **WebGL2** y **WebGPU**, con alternativa en CPU; compositor en coma flotante de 32 y 16 bits |
| Concurrencia | Web Workers y OffscreenCanvas |
| RAW | [LibRaw](https://www.libraw.org/) vía [LibRaw-Wasm](https://github.com/ybouane/LibRaw-Wasm) |
| IA | [ONNX Runtime Web](https://onnxruntime.ai/) (BodyPix, DeepLab, MobileNet, U²-Net, MODNet, ISNet, LaMa, SCUNet, FBCNN, MobileSAM + SAM, YuNet, BiSeNet, Depth Anything V2, GFPGAN, Zero-DCE++, CLIPSeg, SPAN, Real-ESRGAN, UltraSharp, SpongeColor, Colorizer, DDColor); profundidad y máscaras a resolución completa por bloques (`js/ai/tiles.js`) |
| Visión | [OpenCV.js](https://docs.opencv.org/) (alineación, apilado, escáner de documentos, líneas), base de lentes [Lensfun](https://lensfun.github.io/) |
| Formatos | [ag-psd](https://github.com/Agamnentzar/ag-psd), [UTIF.js](https://github.com/photopea/UTIF.js), [heic2any](https://github.com/alexcorvi/heic2any), [pdf-lib](https://pdf-lib.js.org/) y fontkit, [ExifReader](https://github.com/mattiasw/ExifReader), jSquash (AVIF y JPEG XL) |
| App | Service worker, Web App Manifest, IndexedDB |

Las licencias y atribuciones de cada librería están en `js/vendor/ATTRIBUTIONS.md`.

## 21. Compatibilidad

Realify funciona en las versiones actuales de Chrome, Edge, Firefox y Safari,
en escritorio y en móvil.

| Requisito | Uso |
|---|---|
| **WebGL2** | Imprescindible: filtros, revelado RAW y Filtro Vintage |
| **Módulos ES y Web Workers** | Imprescindibles: carga de la app y procesado en segundo plano |
| **WebGPU** | Opcional: acelera algunos modelos de IA; sin él se usa WebAssembly |
| **HTTPS** | Necesario para el service worker y la instalación como app |
| **HEVC (WebCodecs)** | Opcional: exportar HEIC y HEIC de 10 bits sólo donde el dispositivo tiene codificador |

## 22. Contribuir

Las contribuciones son bienvenidas. Antes de empezar, lee la
[guía de contribución](CONTRIBUTING.md) y el
[código de conducta](CODE_OF_CONDUCT.md).

- 🐞 ¿Has encontrado un error? [Abre un issue](../../issues/new?template=bug_report.yml).
- 💡 ¿Tienes una idea? [Propón una mejora](../../issues/new?template=feature_request.yml).
- 🔒 ¿Es un problema de seguridad? Sigue la [política de seguridad](SECURITY.md).

Los cambios de cada versión se recogen en el [CHANGELOG](CHANGELOG.md). Antes de
proponer un cambio en una herramienta, pasa su [prueba de calidad](#18-pruebas).

## 23. Licencias

El código propio de Realify se distribuye bajo la [PolyForm Noncommercial License 1.0.0](LICENSE).

**Realify puede usarse, estudiarse, modificarse y redistribuirse únicamente para fines no comerciales.** Cualquier uso con finalidad económica o comercial requiere autorización expresa del titular de los derechos.

Sin autorización expresa, no está permitido, entre otros usos:

- vender Realify o una versión modificada;
- cobrar por el acceso a una copia, fork o adaptación de Realify;
- integrar el código de Realify en un producto, aplicación o servicio comercial;
- ofrecer Realify o una adaptación como SaaS o servicio de pago;
- monetizar una copia o adaptación mediante publicidad, suscripciones, licencias u otros ingresos;
- revender o redistribuir comercialmente Realify bajo otra marca.

**El uso de la aplicación publicada en [realify.es](https://realify.es) está permitido para cualquier fin, también profesional o comercial** (por ejemplo, editar fotos propias o de clientes y usar el resultado libremente). Este permiso adicional del titular cubre sólo el uso de la web oficial; la licencia no comercial se aplica al código fuente y a sus copias o adaptaciones.

**Modelos de IA con licencia no comercial.** Realify es gratuito y no cobra por su uso. Estos modelos sólo
permiten el uso no comercial. Se incluyen con su licencia real, y **el usuario es responsable de cumplir la licencia
de cada modelo que utilice**:

| Modelo | Función | Licencia real | Fuente de la comprobación |
|---|---|---|---|
| BiSeNet (ResNet-18, `faceparsing`) | Seleccionar por texto (pelo, ojos, labios…) y Retoque de cara | Código y pesos: **MIT**. Los datos de entrenamiento CelebAMask-HQ son de **uso no comercial** | `assets/models/faceparsing/LICENSE.txt` y repositorio de origen |
| Zero-DCE++ | Iluminar con IA | **CC BY-NC 4.0** (Atribución-NoComercial 4.0 Internacional) | `assets/models/zerodce/LICENSE.txt` |
| UltraSharp V2 Lite (×4) | Ampliar con IA, Premium 👑 | **CC BY-NC-SA 4.0** (Atribución-NoComercial-CompartirIgual 4.0 Internacional) | Ficha del modelo en Hugging Face (Kim2091/UltraSharpV2) |
| FLUX.1 Fill dev y FLUX ControlNet Union Pro 2.0 | IA avanzada local (CUDA) | Licencia FLUX dev: **no comercial** | `advanced-ai/models/registry.json` |

Otros modelos con licencia permisiva:

| Modelo | Función | Licencia real | Fuente de la comprobación |
|---|---|---|---|
| Real-ESRGAN (×4 v3 y anime ×4) | Ampliar con IA | BSD-3-Clause | Repositorio xinntao/Real-ESRGAN |
| CLIPSeg (pesos fp16) | Seleccionar por texto | Apache-2.0 (pesos); código MIT | Ficha CIDAS/clipseg-rd64-refined y repositorio timojl/clipseg |
| Resto de modelos de la tabla de la sección 12 (Depth Anything V2, MobileSAM/SAM, LaMa, ISNet, U²-Net, MODNet, DDColor, SCUNet, FBCNN, GFPGAN, BodyPix, DeepLab, MobileNet, YuNet, etc.) | Varias | Apache-2.0 o MIT según el catálogo `js/ai/models.js` | El catálogo; no lo he comprobado modelo a modelo |

**Sin comprobar:** SPAN ×2, SpongeColor Lite y Colorizer V2 se publican en OpenModelDB con la licencia que indique
cada ficha. No he podido consultarla desde aquí; hay que revisarla antes de distribuir la aplicación.


Los componentes de terceros conservan sus propias licencias y no quedan relicenciados por esta licencia:

- LibRaw-Wasm (ISC) y LibRaw (LGPL-2.1 / CDDL-1.0): ver `raw/NOTICES.md`.
- Fluent Emoji (MIT): ver `stickers/emoji/LICENSE`.
- Lensfun (CC BY-SA 3.0) para la base de lentes: ver `assets/lensdb/`.
- Poly Haven (CC0 1.0) para los cielos de `assets/skies/`.
- Resto de librerías: ver `js/vendor/ATTRIBUTIONS.md`.

Para solicitar autorización para un uso comercial de Realify, es necesario obtener una licencia o permiso independiente del titular de los derechos.

---

<div align="center">

**[realify.es](https://realify.es)** · Hecho con ❤️

</div>
