<div align="center">

<a href="https://realify.es">
  <img src="assets/og-image-1200x630.png" alt="Realify — editor de imágenes en el navegador" width="100%">
</a>

# Realify

**Editor de imágenes profesional que funciona en el navegador. Sin instalación, sin cuenta y sin subir tus fotos a ningún servidor.**

[![Web](https://img.shields.io/badge/web-realify.es-f5b82e?style=for-the-badge&logo=googlechrome&logoColor=white)](https://realify.es)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-3b82f6?style=for-the-badge)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-instalable-5a0fc8?style=for-the-badge&logo=pwa&logoColor=white)](https://realify.es)

![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-f7df1e?logo=javascript&logoColor=black)
![WebGL2](https://img.shields.io/badge/GPU-WebGL2_·_WebGPU-990000?logo=webgl&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-LibRaw_·_ONNX-654ff0?logo=webassembly&logoColor=white)
![Sin dependencias](https://img.shields.io/badge/build-sin_compilación-2ea44f)
![Privacidad](https://img.shields.io/badge/procesado-100%25_local-2ea44f)

### [🚀 Abrir Realify en realify.es](https://realify.es)

[Características](#características-destacadas) ·
[Funcionalidades](#índice) ·
[Tecnología](#16-tecnología) ·
[Desarrollo local](#15-despliegue) ·
[Contribuir](CONTRIBUTING.md) ·
[Novedades](CHANGELOG.md)

</div>

---

## Qué es Realify

Realify es un editor de imágenes completo que funciona en el navegador. Todo el
procesado —capas, filtros, revelado RAW, modelos de IA— ocurre en el equipo del
usuario: **las imágenes no se suben a ningún servidor**. Se instala como app
(PWA) y funciona sin conexión.

La versión pública está en **[realify.es](https://realify.es)**.

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
Seleccionar sujeto y cielo, eliminar fondo, rellenar y expandir según el
contenido, ampliar ×2/×4, colorear fotos en blanco y negro y reducir ruido,
sin enviar la imagen a nadie.

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
Fusión HDR de hasta 11 fotos, panorámicas, 160 estilos, 102 estilos vintage,
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
  inferior y un cajón de herramientas ordenado por objetivo (mejorar,
  corregir, color, estilo…) con buscador tolerante a tildes y erratas. Los
  editores grandes se abren a pantalla completa, con la imagen primero y
  mandos pensados para el pulgar.
- **Sin dependencias ni compilación**: HTML, CSS y JavaScript con módulos ES.

---

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
10. [Módulos especiales](#10-módulos-especiales)
11. [Análisis y metadatos](#11-análisis-y-metadatos)
12. [Vista](#12-vista)
13. [App, privacidad y ayuda](#13-app-privacidad-y-ayuda)
14. [Estructura del proyecto](#14-estructura-del-proyecto)
15. [Despliegue](#15-despliegue)
16. [Tecnología](#16-tecnología)
17. [Compatibilidad](#17-compatibilidad)
18. [Contribuir](#18-contribuir)
19. [Licencias](#19-licencias)

---

## 1. Archivos: abrir, guardar y exportar

| Función | Qué hace |
|---|---|
| **Abrir imagen** | JPEG, PNG, WebP, BMP, SVG, TIFF, HEIC/HEIF y PSD (con capas). Los archivos RAW se envían al revelador RAW. También se puede arrastrar y soltar o pegar desde el portapapeles. |
| **Cargar archivos en pila** | Abre varias imágenes como capas de un mismo documento. |
| **Documento nuevo** | Lienzo vacío del tamaño elegido. |
| **Collage / History / Post** | Composiciones para redes creadas como documento nuevo (ver [módulos especiales](#collage--history--post--socialmediapost)). |
| **Varios documentos** | Cada documento se abre en su propia pestaña. |
| **Abrir / Guardar proyecto** | Guarda el documento completo (capas, máscaras, capas de ajuste y de filtro, textos) para seguir editándolo más tarde. |
| **Exportar / Exportar como** | JPEG, PNG, WebP, **AVIF** (mucho más ligero) y **PDF** (tamaño de página y margen), con calidad, tamaño máximo y estimación de peso. Perfiles listos: web optimizada, Instagram, YouTube, marketplace, correo, fondo de pantalla e impresión. **Tramado a 8 bits** opcional para evitar bandas en cielos y degradados. |
| **Exportar PNG rápido** | Descarga inmediata en PNG. |
| **Prueba para redes sociales** | Muestra cómo quedará la imagen tras la recompresión típica de las redes. |
| **Exportar GIF animado** | Cada capa visible es un fotograma (sola o acumulada): duración, bucle, ida y vuelta, tamaño y número de colores. |
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
- Recortar y **corregir perspectiva**.
- Girar 90°/180° y voltear en horizontal o vertical.
- **Fusión HDR** (pantalla completa, `hdr/`): de 1 a 11 fotos con el
  horquillado detectado por EXIF o por el brillo, alineación, antifantasmas,
  mapa de radiancia o fusión de exposición y mapeo tonal (detalles realzados,
  compresor de tonos, fotográfico) con 17 estilos en miniatura. Se abre como foto nueva.
- **Unir imágenes** (pantalla completa, `unir/`): panorámica automática
  (proyección cilíndrica, solape por correlación de gradientes, exposición
  igualada, costuras suaves y recorte) o unión en fila, columna o cuadrícula.
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
- **Eliminar fondo** con IA local (U²-Net rápido, MODNet para retratos, ISNet
  de máxima calidad) o por color de los bordes: el recorte va a una capa nueva
  y la original se oculta.
- **Ampliar con IA** ×2 o ×4 (Real-ESRGAN, SPAN, UltraSharp), **Colorear con
  IA** (SpongeColor, Colorizer, DDColor; el color se aplica a la luminancia
  original) y **Expandir con IA** (LaMa rellena los bordes nuevos del lienzo).
- **Reemplazar cielo**: detecta el cielo (DeepLab/ADE20K) y lo sustituye por
  un color, un degradado o una foto propia, en una capa con su máscara.

## 5. Selección y máscaras

**Selección**
- Todo, ninguna e invertir.
- **Seleccionar sujeto** (IA, BodyPix) y **seleccionar cielo** (IA).
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
- **Modos de fusión**, opacidad y **Fusionar si** (blend-if por luminosidad).
- **Estilos de capa**: sombra, contorno, resplandor, bisel, superposición…
- **Objetos inteligentes**: transformaciones y filtros sin perder calidad;
  rasterizar cuando haga falta.
- **Capas de ajuste** (reeditables) y **capas de filtro** (el filtro se guarda
  en la capa y se puede reabrir).
- **Capas de relleno**: color sólido, degradado y motivo.
- **Alinear y distribuir** capas.
- Combinar con la de abajo, combinar visibles y acoplar imagen.
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
**tono y saturación por rangos** (mezclador HSL de ocho rangos con cuentagotas;
no afecta a grises), reemplazar color, igualar color, curvas Lab y de
luminosidad, color por canales, equilibrio de color, corrección selectiva,
mezclador de canales y mapa de degradado.

**Tono avanzado**: quitar neblina, tono HDR, contraste tonal, densidad neutra
graduada o radial y tono/color automático.

**Mapa tonal**: umbral, posterizar, ecualizar, desaturar, blanco y negro (con
recetas), invertir, contraste automático y niveles automáticos.

## 9. Filtros

| Grupo | Filtros |
|---|---|
| **Desenfoques** | Gaussiano, galería de desenfoque, caja/forma/promedio/inteligente, movimiento, lente, radial/zoom y superficie. |
| **Enfoque y restauración** | Enfocar, máscara de enfoque/estabilizador, enfoque selectivo, nitidez inteligente, paso alto y mediana/polvo/destramar. |
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

## 10. Módulos especiales

Se abren desde **Filtro › Especiales** (y en móvil desde el cajón de
herramientas). Cada uno es un editor a pantalla completa con vista previa.

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
histograma y espectro.

### Filtro Vintage — `vintagefilter/`
41 parámetros en 7 grupos (virados, color —con blanco y negro ortocromático y
pancromático—, tono, luz y película, daños, bordes y óptica) y **102 estilos**
agrupados en décadas, películas en color, blanco y negro, procesos antiguos,
cámaras y ópticas, creativos y estaciones. Semilla reproducible y capa de
filtro reeditable. Detalles en [`vintagefilter/README.md`](vintagefilter/README.md).

### Estilos y LUT
- **Estilos**: **160 looks** en 16 categorías (básicos, retrato, paisaje, cine,
  películas, urbano, comida, moda y editorial, redes sociales, blanco y negro,
  noche, estaciones, suaves y pastel, dramáticos, duotonos y creativos,
  vintage), con buscador, miniatura sobre la propia foto e intensidad
  regulable. Curvas por canal, saturación, virado partido y duotonos reales.
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

## 11. Análisis y metadatos

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
- **Metadatos EXIF**: revisar y escribir datos de cámara en exportaciones JPEG.
- **Limpiar metadatos de un archivo** sin abrirlo en el editor.

## 12. Vista

- Ajustar a la ventana, tamaño real, acercar y alejar.
- **Comparar antes/después** y comparar al 100 %.
- Mostrar u ocultar paneles.
- Reglas, guías, cuadrícula configurable y ajuste a la cuadrícula.
- **Cuadrícula inteligente**: ayudas de composición que se recalculan según el
  contenido de la foto. Detecta al sujeto, el horizonte y rostros; propone un
  recorte que coloca el sujeto en un punto fuerte y endereza la línea del
  horizonte. Ver «Análisis y metadatos» para detalles.
- **Histograma interactivo** en el panel lateral (ver apartado anterior).

## 13. App, privacidad y ayuda

- **PWA instalable** (Ayuda › Instalar como app) con service worker para
  funcionar sin conexión.
- **Guía** interactiva con **buscador** (sin tildes, varias palabras, salta al
  párrafo exacto), página de **novedades** y ayuda directa de cada herramienta
  (botón «?» de la barra de opciones); asistente de bienvenida.
- **Diagnóstico** del navegador y del equipo.
- Aviso legal, política de privacidad y de cookies.
- Los modelos de IA se ejecutan en local (TensorFlow.js y ONNX Runtime, con
  WebGPU o WebAssembly). Los modelos grandes (Hugging Face) se descargan la
  primera vez que se usan y quedan en el navegador; la imagen nunca sale del
  equipo.
- **Tipografías** servidas desde el propio sitio (`/fonts/`): el navegador no
  se conecta con Google ni con otros terceros para usarlas.

## 14. Estructura del proyecto

```
index.html              Página principal
sw.js                   Service worker (red primero, caché de respaldo)
manifest.webmanifest    Manifiesto de la PWA
.htaccess               Cabeceras, compresión y caché para Apache
css/                    Estilos: tokens, base, layout y móvil
js/
  main.js               Arranque
  core/                 Documento, historial, instantáneas, bus de eventos, dispositivo, búsqueda, formas
  editor/               Herramientas, pinceles, capas, máscaras, selección, texto, ajustes,
                        curvas, tonos del histograma y cuadrícula inteligente
  filters/              Filtros y filtros especiales (camera, lens, lut, purepixel, unmark…)
  features/             Sujeto, cielo, herramientas fotográficas, IA, paleta y acciones
  ai/                   Carga y ejecución de modelos de IA
  analysis/             Métricas, forense y FFT
  exif/                 Lectura y escritura de EXIF
  io/                   Abrir, exportar (AVIF, PDF, GIF), proyectos, lotes y ZIP
  ui/                   Menús, paneles, diálogos, ventana común de plugins (fsshell), guía y cajón móvil
  vendor/               Librerías de terceros
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
assets/                 Iconos, imágenes y modelos de IA
fonts/                  Tipografías libres (catálogo completo de Google Fonts), servidas desde el sitio
server/                 Configuración de nginx y servidor opcional para Unmark (FastAPI)
.github/workflows/      Despliegue automático en realify.es
```

## 15. Despliegue

Es un sitio estático: basta con servir los archivos con cualquier servidor web.

- **Producción ([realify.es](https://realify.es))**: nginx. Cada push a `main`
  se publica automáticamente con GitHub Actions; ver [DEPLOY.md](DEPLOY.md).
- **nginx**: la configuración de cabeceras de seguridad, compresión, caché y
  bloqueo de archivos internos está en
  [`server/nginx-realify.conf.example`](server/nginx-realify.conf.example).
- **Apache**: el `.htaccess` hace lo mismo (nginx lo ignora).
- Hace falta **HTTPS** para el service worker y la instalación como app.
- Al cambiar archivos de la app, sube `VERSION` en `sw.js` y el `?v=` de
  `js/main.js` en `index.html` para que los usuarios reciban la versión nueva.

Para probarlo en local, sirve la carpeta con cualquier servidor estático:

```bash
python -m http.server 8080
```

y abre `http://localhost:8080`.

## 16. Tecnología

| Área | Tecnología |
|---|---|
| Interfaz | HTML5, CSS con tokens de diseño, JavaScript con módulos ES (sin framework ni compilación) |
| Gráficos | Canvas 2D, **WebGL2** y **WebGPU**, con alternativa en CPU |
| Concurrencia | Web Workers y OffscreenCanvas |
| RAW | [LibRaw](https://www.libraw.org/) vía [LibRaw-Wasm](https://github.com/ybouane/LibRaw-Wasm) |
| IA | [ONNX Runtime Web](https://onnxruntime.ai/) y [TensorFlow.js](https://www.tensorflow.org/js) (BodyPix, DeepLab, U²-Net, MODNet, ISNet, LaMa, SCUNet, FBCNN) |
| Formatos | [ag-psd](https://github.com/Agamnentzar/ag-psd), [UTIF.js](https://github.com/photopea/UTIF.js), [heic2any](https://github.com/alexcorvi/heic2any) |
| App | Service worker, Web App Manifest, IndexedDB |

## 17. Compatibilidad

Realify funciona en las versiones actuales de Chrome, Edge, Firefox y Safari,
en escritorio y en móvil.

| Requisito | Uso |
|---|---|
| **WebGL2** | Imprescindible: filtros, revelado RAW y Filtro Vintage |
| **Módulos ES y Web Workers** | Imprescindibles: carga de la app y procesado en segundo plano |
| **WebGPU** | Opcional: acelera algunos modelos de IA; sin él se usa WebAssembly |
| **HTTPS** | Necesario para el service worker y la instalación como app |

## 18. Contribuir

Las contribuciones son bienvenidas. Antes de empezar, lee la
[guía de contribución](CONTRIBUTING.md) y el
[código de conducta](CODE_OF_CONDUCT.md).

- 🐞 ¿Has encontrado un error? [Abre un issue](../../issues/new?template=bug_report.yml).
- 💡 ¿Tienes una idea? [Propón una mejora](../../issues/new?template=feature_request.yml).
- 🔒 ¿Es un problema de seguridad? Sigue la [política de seguridad](SECURITY.md).

Los cambios de cada versión se recogen en el [CHANGELOG](CHANGELOG.md).

## 19. Licencias

Código de Realify bajo licencia [MIT](LICENSE). Los componentes de terceros
conservan sus licencias:

- LibRaw-Wasm (ISC) y LibRaw (LGPL-2.1 / CDDL-1.0): ver `raw/NOTICES.md`.
- Fluent Emoji (MIT): ver `stickers/emoji/LICENSE`.
- Resto de librerías: ver `js/vendor/ATTRIBUTIONS.md`.

---

<div align="center">

**[realify.es](https://realify.es)** · Hecho con ❤️

</div>
