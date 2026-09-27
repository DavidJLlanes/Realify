# Realify

Editor de imágenes completo que funciona en el navegador. Todo el procesado
—capas, filtros, revelado RAW, modelos de IA— ocurre en el equipo del usuario:
las imágenes no se suben a ningún servidor. Se instala como app (PWA) y
funciona sin conexión.

- **Sin instalación ni cuenta**: basta con abrir la web.
- **Escritorio y móvil**: menús clásicos en escritorio; en móvil, barra
  inferior y un cajón de herramientas ordenado por objetivo (mejorar,
  corregir, color, estilo…).
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
16. [Licencias](#16-licencias)

---

## 1. Archivos: abrir, guardar y exportar

| Función | Qué hace |
|---|---|
| **Abrir imagen** | JPEG, PNG, WebP, BMP, SVG, TIFF, HEIC/HEIF y PSD (con capas). Los archivos RAW se envían al revelador RAW. También se puede arrastrar y soltar o pegar desde el portapapeles. |
| **Cargar archivos en pila** | Abre varias imágenes como capas de un mismo documento. |
| **Documento nuevo** | Lienzo vacío del tamaño elegido. |
| **Varios documentos** | Cada documento se abre en su propia pestaña. |
| **Abrir / Guardar proyecto** | Guarda el documento completo (capas, máscaras, capas de ajuste y de filtro, textos) para seguir editándolo más tarde. |
| **Exportar / Exportar como** | JPEG, PNG y WebP, con calidad, tamaño máximo y estimación de peso. Perfiles listos: web optimizada, Instagram, YouTube, marketplace, correo, fondo de pantalla e impresión. |
| **Exportar PNG rápido** | Descarga inmediata en PNG. |
| **Prueba para redes sociales** | Muestra cómo quedará la imagen tras la recompresión típica de las redes. |
| **Procesar carpeta** | Aplica el filtro Realify a muchas imágenes a la vez y las entrega en un ZIP. |
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

Los pinceles tienen tamaño, dureza, opacidad, flujo, espaciado y biblioteca de
puntas. Mover ajusta a los bordes y centros de las demás capas.

## 4. Imagen

- Tamaño de imagen (con remuestreo de calidad), tamaño de lienzo y **escala
  según el contenido**.
- Recortar y **corregir perspectiva**.
- Girar 90°/180° y voltear en horizontal o vertical.
- **Eliminar fondo** con IA local.
- **Reemplazar cielo**: detecta el cielo (DeepLab/ADE20K) y lo sustituye por
  un color, un degradado o una foto propia, en una capa con su máscara.

## 5. Selección y máscaras

**Selección**
- Todo, ninguna e invertir.
- **Seleccionar sujeto** (IA, BodyPix) y **seleccionar cielo** (IA).
- Pluma: trazados que se convierten en selección o en máscara de capa.
- Difuminar y **refinar borde** (pelo y bordes finos).
- **Rellenar según el contenido** y **mover según el contenido** (PatchMatch).
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

- Capas de texto editables: fuente (incluidas Google Fonts), tamaño, color,
  interlineado, espaciado, kerning, ligaduras, mayúsculas y versalitas.
- Estilos de carácter y de párrafo, alineación y sangrías.
- Cuadros de texto y **texto en trazado**.
- Rasterizar texto.

## 8. Ajustes de color y tono

Todos se pueden aplicar directamente o como capa de ajuste.

**Básicos**: brillo y contraste, exposición, niveles, curvas, sombras e
iluminaciones, balance de blancos, tonos (blancos/luces/sombras/negros), tono y
saturación, vibrance.

**Color avanzado**: gradación de color, virado dividido, filtro fotográfico,
tono y saturación por rangos, reemplazar color, igualar color, curvas Lab y de
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
| **Ruido** | Reducción de ruido (normal, por canal y **con IA**), **quitar artefactos JPEG con IA** y añadir ruido. |
| **Pixelizar** | Mosaico, cristalizar, puntillismo y semitono. |
| **Estilizar** | Relieve, hallar bordes, resplandor, solarizar, viento y óleo. |
| **Artísticos** | Galería de filtros artísticos. |
| **Interpretar** | Nubes, fibras, destello e iluminación. |
| **Textura** | Texturizador, grano, azulejos, craquelado, desplazamiento, mínimo y máximo. |
| **Distorsión y geometría** | Esferizar, coordenadas polares, distorsiones clásicas, gran angular adaptable, deformación de posición libre, perspectiva y **licuar**. |
| **Corrección local** | Pincel corrector, parche y tampón de clonar. |
| **Otros** | Convolución personalizada 5×5. |

Los filtros se procesan en GPU (WebGL2 y, si está disponible, WebGPU), con
alternativa en CPU y Web Workers.

## 10. Módulos especiales

Se abren desde **Filtro › Especiales** (y en móvil desde el cajón de
herramientas). Cada uno es un editor a pantalla completa con vista previa.

### Revelado fotográfico (RAW) — `raw/`
Revelador RAW local basado en LibRaw (WebAssembly). Trabaja en RGB lineal de
16 bits con vista previa por GPU. Exposición, contraste, altas luces, sombras,
blancos, negros, temperatura, tinte, balance automático, vibrance, saturación,
enfoque, textura, claridad, reducción de ruido de luminosidad y de color, y
corrección de aberración cromática. También se puede usar sobre cualquier capa
raster. Detalles en [`raw/README.md`](raw/README.md).

### Realify — `js/filters/camera/`
Simulación de cámara: ruido de sensor, respuesta de óptica y compresión, con
presets, recomendaciones según la imagen y ajuste a partir de los datos EXIF.

### Filtro Vintage — `vintagefilter/`
40 parámetros en 7 grupos y 26 presets: grano, fugas de luz, polvo, arañazos,
halación, destellos, bordes, sello de fecha… Semilla reproducible y capa de
filtro reeditable. Detalles en [`vintagefilter/README.md`](vintagefilter/README.md).

### Estilos y LUT
- **Estilos**: looks de color predefinidos.
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

### Collage / Historia / Post — `socialmediapost/`
También en **Archivo › Collage / History / Post…**, incluso sin documento
abierto.
- **Formatos**: 29 de redes sociales (Instagram, TikTok, Facebook, X, Threads,
  LinkedIn, YouTube, Pinterest, WhatsApp…), 15 proporciones, 27 pantallas de
  móviles y tamaño personalizado.
- **Zonas seguras** de historias y de pantallas de móvil.
- **40 diseños de collage** de 1 a 16 fotos, con espaciado, márgenes,
  esquinas, marcos, sombras y fondo (color, degradado o foto difuminada).
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
- **Metadatos EXIF**: revisar y escribir datos de cámara en exportaciones JPEG.
- **Limpiar metadatos de un archivo** sin abrirlo en el editor.

## 12. Vista

- Ajustar a la ventana, tamaño real, acercar y alejar.
- **Comparar antes/después** y comparar al 100 %.
- Mostrar u ocultar paneles.
- Reglas, guías, cuadrícula configurable y ajuste a la cuadrícula.

## 13. App, privacidad y ayuda

- **PWA instalable** (Ayuda › Instalar como app) con service worker para
  funcionar sin conexión.
- **Guía** interactiva y asistente de bienvenida.
- **Diagnóstico** del navegador y del equipo.
- Aviso legal, política de privacidad y de cookies.
- Los modelos de IA se ejecutan en local (TensorFlow.js y ONNX Runtime). Los
  modelos grandes se descargan la primera vez que se usan; la imagen nunca
  sale del equipo.

## 14. Estructura del proyecto

```
index.html              Página principal
sw.js                   Service worker (red primero, caché de respaldo)
manifest.webmanifest    Manifiesto de la PWA
.htaccess               Cabeceras de seguridad (CSP), compresión y caché
css/                    Estilos: tokens, base, layout y móvil
js/
  main.js               Arranque
  core/                 Documento, historial, instantáneas, bus de eventos, dispositivo
  editor/               Herramientas, capas, máscaras, selección, texto, ajustes
  filters/              Filtros y filtros especiales (camera, lens, lut, purepixel, unmark…)
  features/             Sujeto, cielo y herramientas fotográficas
  ai/                   Carga y ejecución de modelos de IA
  analysis/             Métricas, forense y FFT
  exif/                 Lectura y escritura de EXIF
  io/                   Abrir, exportar, proyectos, lotes y ZIP
  ui/                   Menús, paneles, diálogos, guía y barra móvil
  vendor/               Librerías de terceros
raw/                    Revelador RAW (LibRaw-Wasm)
vintagefilter/          Filtro Vintage
memes/                  Creador de memes
socialmediapost/        Collage / Historia / Post
stickers/               Stickers (Fluent Emoji)
assets/                 Iconos, imágenes y modelos de IA
server/                 Servidor opcional para Unmark (FastAPI)
```

## 15. Despliegue

Es un sitio estático: basta con subir los archivos a cualquier servidor web.

- El `.htaccess` está pensado para Apache (CSP, compresión y caché).
- Hace falta **HTTPS** para el service worker y la instalación como app.
- En cada despliegue, sube `VERSION` en `sw.js` y el `?v=` de `js/main.js` en
  `index.html` para que los usuarios reciban la versión nueva.

Para probarlo en local, sirve la carpeta con cualquier servidor estático:

```bash
python -m http.server 8080
```

y abre `http://localhost:8080`.

## 16. Licencias

Código de Realify bajo licencia [MIT](LICENSE). Los componentes de terceros
conservan sus licencias:

- LibRaw-Wasm (ISC) y LibRaw (LGPL-2.1 / CDDL-1.0): ver `raw/NOTICES.md`.
- Fluent Emoji (MIT): ver `stickers/emoji/LICENSE`.
- Resto de librerías: ver `js/vendor/ATTRIBUTIONS.md`.
