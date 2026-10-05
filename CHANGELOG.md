# Registro de cambios

Todos los cambios relevantes de [Realify](https://realify.es) se documentan en
este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Realify se publica de forma continua en [realify.es](https://realify.es), por lo
que las entradas se agrupan por fecha.

## [Sin publicar]

### v250 · IA y RAW: eliminar fondo refinado, máscara por profundidad viva y RAW normal en P3
- **Eliminar fondo con el borde a resolución completa** (`js/ai/matte.js`): tras la pasada global del modelo (U²-Net, MODNet, ISNet) el borde se refina con
  un filtro guiado por la luminosidad de la foto en una franja alrededor del contorno; lo de lejos del borde no se toca (sin halos). Medido con U²-Net
  real (`tests/matte.mjs`, fotos de 2000 px): el sujeto no cambia (IoU 0,99) y el contorno sigue mucho mejor los bordes de la foto (correlación del
  gradiente 0,18 → 0,34, 0,07 → 0,15, 0,33 → 0,53). **Por bloques** se probó (bloques del tamaño del modelo a mayor resolución, sólo en la franja dudosa):
  no mejora —el modelo da bordes igual de blandos con más resolución— y tarda el triple, así que queda como opción apagada.
- **Máscara por profundidad «viva»** (`js/features/depthlive.js`): la capa recuerda cómo se hizo (zona, intervalo, suavidad, invertir) y, si cambia lo que
  hay debajo (una capa de ajuste se evalúa sin ella; una de imagen, con su máscara apagada), se recalcula sola tras 1,5 s sin tocar nada, sin entradas de
  historial. Las zonas «primer plano / medio / fondo» se vuelven a repartir con la foto nueva. En las propiedades de la máscara: «mantener al día»,
  «Actualizar ahora» y «Dejar fija». Se guarda en el proyecto. Poner otra máscara por otro camino la suelta.
- **Revelado RAW sin Premium en Display P3**: el mando **Color › Espacio de color** ya vale también sin Premium: LibRaw entrega Rec.2020 (sin recortar a
  sRGB) y el revelado de siempre lo pasa a P3 en la vista previa (GPU y CPU) y en el resultado; el documento se abre en P3. Aproximado (las ponderaciones de
  luminosidad siguen siendo las de sRGB) y sin los 16 bits de Premium.
- Pruebas nuevas: `tests/matte.mjs`, `tests/depth-viva.mjs` (con Depth Anything real: sin cambios no recalcula; con cambios sí; proyecto; suelta) y
  `tests/raw-p3.mjs` ampliada a los cuatro casos (Premium/normal × sRGB/P3, con comprobación de colores).

### v249 · Display P3 de punta a punta (color y exportación)
- **WebP y TIFF de 8 bits con perfil Display P3**: en un documento P3 ya no se convierten a sRGB al exportar; llevan su perfil ICC incrustado
  (WebP: contenedor VP8X + fragmento ICCP, `webpWithIcc` en `js/io/icc-embed.js`, que completa el perfil si el navegador no lo pone;
  TIFF: escritor propio de 8 bits que comparte código con el de 16, etiqueta 34675). También en «Exportar como». Quien pide sRGB lo sigue teniendo.
- **Filtros WebGL en P3**: el filtro **Cámara** y el **Filtro Vintage** subían la foto a la GPU y la devolvían recortada a sRGB (un rojo P3 puro
  salía 255,0,0 en vez de 255,40,20). Ahora el contexto de la GPU sube y devuelve en el espacio del documento. Antes y después comprobado con
  `tests/p3-webgl.mjs` (el centro de la imagen sale idéntico; sin el arreglo, diferencia de 40 niveles).
- **«Abrir en Realify» desde el revelador RAW en P3**: nuevo mando **Color › Espacio de color 👑 (sRGB / Display P3)** en el revelado RAW con Premium.
  En P3 el revelado cambia sólo lo necesario: la matriz Rec.2020 → pantalla y el mapeo de gama de OKLab apuntan a la gama P3 (la curva es la de sRGB),
  en la vista previa de la GPU, en la de la CPU y en el resultado final; el documento nace en Display P3 con los 16 bits conservados (el lienzo es
  su redondeo) y el TIFF de 16 bits del revelador lleva el perfil. Sólo en RAW (el revelado fotográfico de una capa sigue en el espacio del
  documento) y sólo si el navegador admite lienzos P3. Por defecto sigue siendo sRGB.
- Pruebas nuevas: `tests/p3-formatos.mjs`, `tests/p3-webgl.mjs`, `raw/tests/premium-p3.mjs` (GPU ≡ CPU en P3, verde de Rec.2020 con más croma que
  en sRGB y mismo tono, colores dentro de sRGB iguales) y `tests/raw-p3.mjs` (de punta a punta con un DNG sintético: documento y lienzo P3, 16 bits, invariante).

### v248 · Fase 20: cabos sueltos
- **Coma flotante en el resto de ajustes**: Sombras y luces, Tono, Banda tonal, Color selectivo, Equilibrio de color, Mapa de degradado,
  Blanco y negro, Niveles/Contraste automáticos, Invertir, Mejora automática, CLAHE, Iluminar foto oscura (clásico e IA) y los ajustes avanzados
  de color (gradación, viraje, filtro fotográfico, curvas Lab, rangos HSL, reemplazar color, desaturar, quitar neblina, HDR, ecualizar…) conservan
  los 16 bits. `runAdjust` y `applyDirect` aceptan `float` (`true` = color puro, función, o `"delta"` = el cambio del resultado de 8 bits se suma a los 16 bits).
- **Origen de 16 bits parcial**: una capa cuyo origen cubre sólo un rectángulo (recortado o desplazado) se calcula en 16 bits dentro y en 8 fuera, y el
  guardado de proyecto lo conserva. Girar o recortar aún lo descartan.
- **CLAHE Premium**: la vista previa ya se refina a resolución completa en fotos grandes (antes quedaba la copia reducida ampliada) y es más rápido.
- **Límite de memoria medido** con 12, 16, 20 y 24 MP: AVIF aguanta 24 MP; **JPEG XL se aborta a 24 MP**, así que su límite baja a 16 MP (6 en móvil).
- Pruebas nuevas: `tests/float-ajustes.mjs`, `tests/hi-parcial.mjs`, `tests/codec-memoria.mjs`.

### v247 · «Informar de un error» también en el cajón del móvil
- **Informar de un error** (con icono de bicho) tiene ahora su entrada en el cajón «Herramientas» del móvil (pestañas «Todos» y «Analizar»,
  y encuentra al buscar «informar» o «error»), además de Ayuda › Informar de un error… (menú de móvil y de escritorio, con el mismo icono).
  Se había quedado sólo en el menú. Comprobado en móvil con la prueba nueva `tests/cajon-movil.mjs`: Exportar PDF, Inspector de metadatos,
  Seleccionar por texto, Limpiar metadatos e Informar de un error están en el cajón con icono y en el menú.

### v246 · Selección por descripción libre con CLIPSeg (fase 20)
- **Seleccionar por texto** (y Capa › Máscara de capa › «Por texto») ya no se limita a las 150 categorías: lo que no esté en el vocabulario
  («una taza azul con un dibujo», «el logo», «la bufanda roja») se busca con **CLIPSeg** (IA de descripción libre, Apache-2.0). Se mezcla con lo
  de siempre en la misma frase: «coche y una taza azul», «persona sin taza». El modelo (**float16, 273 MB**; la versión cuantizada se descarta
  por calidad) se descarga de Hugging Face **sólo la primera vez que se usa**, avisando antes, y se guarda en el navegador; la foto no sale del equipo.
- Cómo se calcula: texto → inglés con un diccionario de unas 580 palabras y expresiones corrientes (CLIP casi sólo entiende inglés; lo que no está pasa tal cual)
  → tokenizador de CLIP propio (`js/ai/cliptokenizer.js`, idéntico a la referencia de Hugging Face) → modelo en la CPU (WebAssembly) sobre la foto entera
  y, si es grande, sobre 2×2 mosaicos con solape; se promedian con ventana suave y la máscara, a resolución completa, pasa por el mismo ajuste de borde
  con filtro guiado. Si el modelo no ve lo descrito, avisa en vez de seleccionar algo al azar.
- Límites: la máscara de CLIPSeg es blanda (352 px por vista), así que los objetos muy pequeños o muy parecidos entre sí pueden fallar; con el
  inglés va mejor que con el español. Una descripción es siempre positiva: «sin X» funciona porque se calcula X aparte y se resta.
- Pruebas nuevas: `tests/cliptokenizer.mjs` (15 frases idénticas a la referencia) y `tests/clipseg.mjs` (**con el modelo real** sobre fotos: «a red bus» y
  «autobús rojo» (traducido) dan el mismo autobús, a la derecha y a media altura (3,8 % de la foto); «el cielo», arriba (27 %); «un pez», en el centro; y
  «a banana», que no está, no da nada). En la CPU del entorno de pruebas (sin GPU) tarda unos 20–30 s por foto grande (carga del modelo + 5 vistas) y 8 s
  en una foto pequeña; es lo que cuesta correr 273 MB de modelo en WebAssembly. La prueba sirve el modelo desde un servidor local: Playwright no aguanta
  entregar 273 MB con `route.fulfill` (el navegador muere), problema del arnés y no de la web.

### v245 · Exportar HEIC (fase 16)
- **HEIC** en Exportar… y Exportar como…, **sólo donde el dispositivo trae un codificador HEVC** (Safari en iPhone, iPad y Mac; Chrome o
  Edge con codificador por hardware): la opción aparece sola tras comprobarlo; si no, no sale y queda AVIF. No hay ningún codificador
  en la web (x265 es GPL, incompatible con la licencia de Realify, y HEVC tiene patentes): el HEVC lo pone el sistema del usuario
  mediante WebCodecs (`VideoEncoder`, `hvc1`) y Realify sólo lo empaqueta (`js/io/heic.js`, `js/io/heif.js`).
- Empaquetador HEIF propio: `ftyp`/`meta`/`mdat` con `hvcC`, `ispe`, `clap` (tamaños impares), `colr` (sRGB o Display P3) y `pixi`;
  acepta la salida en formato HEVC y también Annex B (construye el `hvcC` desde VPS/SPS/PPS). La conversión RGB→YUV (4:2:0,
  BT.709 de rango limitado) es nuestra, para que la etiqueta de color sea exacta. 8 bits y sin metadatos (privacidad); calidad
  0–100 → tasa de bits por píxel; niveles HEVC 3.1 a 6.2 según el tamaño (hasta ~140 MP).
- Prueba nueva `tests/heic.mjs`: con un HEIC real de libheif (sólo para la prueba) se reempaqueta su flujo recto, recortado con `clap`,
  vía Annex B y con ICC, y se comprueba que libheif lo decodifica con los **mismos píxeles**; ida y vuelta de color RGB↔YUV; y el
  flujo completo en el navegador con un `VideoEncoder` simulado (configuración, fotograma, tamaño impar). **No se ha podido probar la
  codificación real**: el Chromium del entorno de desarrollo no trae codificador HEVC; hay que probarla en un iPhone, Mac o Windows.

### v244 · Pelo y partes de la cara en «Seleccionar por texto» (fase 20)
- **Seleccionar por texto** (y Capa › Máscara de capa › «Por texto») entiende ahora **pelo, cara, piel, ojos, cejas, nariz, boca,
  labios, orejas, cuello, gafas y sombrero** («pelo», «ojos y labios», «cuello sin orejas»…). Usa BiSeNet (zonas de la
  cara) con YuNet para encontrar las caras: los rasgos pequeños se calculan con la cara ampliada y el pelo, orejas, cuello y
  sombrero con margen alrededor; sirve con varias caras, y el borde se ajusta a los contornos de la foto con el mismo filtro
  guiado de siempre. Se descarga el modelo una sola vez (53 MB), avisando antes.
- **Excepción de licencia ampliada** (decisión del titular, que no hace uso comercial): BiSeNet (entrenado con CelebAMask-HQ, uso
  no comercial) ya no sólo sirve al Retoque de cara, también a esta función. Si algún día se cobra Premium hay que quitarlo o
  sustituirlo de las dos (anotado en `CLAUDE.md`, `models.js` y `ATTRIBUTIONS.md`).
- Prueba nueva `tests/textoparte.mjs <foto-con-cara>`: pelo sobre la frente, ojos pequeños dentro de la cara, labios en el tercio
  inferior, orejas y cuello bajo los labios.
- El vocabulario abierto (CLIPSeg) sigue pendiente: el entorno de desarrollo no puede descargar de Hugging Face.

### v243 · Informe de errores en Ayuda (fase 18)
- **Ayuda › Informar de un error…** (`js/ui/bugreport.js`; en móvil, en el mismo menú Ayuda): qué ha pasado, correo
  opcional (sólo para responderte), **«Adjuntar diagnóstico»** (marcada, con vista previa del texto exacto, sin el nombre del
  archivo) y **«Adjuntar una copia reducida de la imagen»** (desmarcada; nunca el original). Nada se envía sin pulsar
  «Enviar informe»; si no hay conexión o hay demasiados envíos, avisa y ofrece «Copiar informe».
- **Panel «Realify no ha podido arrancar»**: nuevo botón «Enviar informe» que pregunta antes y manda sólo el diagnóstico.
- **Diagnóstico**: el vigilante de arranque anota ahora qué archivo falla y con qué código (`Archivo /js/x.js: HTTP 404`,
  tipo MIME erróneo o sin respuesta) y conserva esos errores tras la autorreparación («Errores antes de la autorreparación»).
- **Servidor** (`server/informe/`, para el VPS; ver su README): receptor `/api/informe` de sólo biblioteca estándar que
  reenvía con el `sendmail` de Postfix; destinatario y asunto fijos, correo del usuario sólo en `Reply-To`, tamaño
  máximo, campo trampa, 5 informes/hora por IP + `limit_req` de nginx, imagen sólo si es un JPEG real; con servicio
  systemd, bloque de nginx y guía de SPF, DKIM y DMARC de realify.es. **Hay que instalarlo en el VPS** para que el envío
  funcione; hasta entonces el diálogo avisa de que no se pudo enviar y deja copiar el informe.
- El servicio ya trae `INFORME_TO=djl@djl.red` como destinatario de los informes.
- **Política de privacidad**: nueva sección «Informes de error (sólo si tú los envías)».
- Pruebas nuevas: `tests/informe.mjs` (diálogo en móvil y escritorio, panel de arranque, 429) y
  `tests/informe_servidor.py` (receptor con sendmail falso: inyección de cabeceras, trampa, límites, imagen falsa).

### v242 · PDF profesional (fase 17)
- **Archivo › Exportar PDF…** (`js/io/pdfexport.js`, motor en `js/io/pdfpro.js`; también en el cajón «Herramientas» del móvil)
  con **pdf-lib** (MIT, `js/vendor/pdf-lib`, sin modificar, se carga sólo al usarlo): el documento y las imágenes que se
  añadan, en **varias páginas**, A5/A4/A3/Carta/Legal o el tamaño de la imagen, vertical/horizontal/automática,
  **márgenes** y **sangrado** (MediaBox, BleedBox y TrimBox), **1, 2, 4, 6 o 9 imágenes por página** con el nombre
  bajo cada una, **portada** (título y fecha), **numeración**, **metadatos** (título, autor, asunto, palabras clave) y
  **resolución objetivo** (96–600 ppp). Calidad JPEG o PNG sin pérdidas.
- **Sin recomprimir de más**: una foto JPEG que ya cabe en la resolución objetivo se incrusta tal cual (si no lleva giro EXIF
  ni un perfil distinto de sRGB); si hay que reducirla se remuestrea una sola vez y se codifica una sola vez.
- Prueba nueva `tests/pdf.mjs` + `tests/pdf_check.py` (PyMuPDF): páginas, tamaños, sangrado, metadatos, numeración,
  reducción a ppp y JPEG original intacto. El «PDF» de Exportar y de Exportar como sigue siendo el rápido de una página.

### v241 · HEIC, PSD y PSB (fase 16)
- **PSD de capas completo** (Exportar como… › PSD): las capas ya no llevan la máscara y los estilos «horneados». Ahora
  se guardan **máscaras de capa reales** (también las vinculadas y las desactivadas), los **efectos de capa** de Realify
  como efectos de Photoshop (sombra, resplandor exterior, trazo y degradado), los **27 modos de fusión** (antes 12),
  el recorte, los grupos con su propia máscara y efectos, y las **capas de ajuste Invertir, Niveles y Curvas** como
  capas de ajuste nativas. Resolución de 72 ppp y perfil sRGB incrustado. Lo que no tiene equivalente fiel (texto,
  objetos inteligentes, «Fusionar si», el resto de ajustes) va rasterizado y una copia oculta «Vista final · referencia»
  enseña el aspecto de Realify.
- **PSB** (PSD para documentos enormes, hasta 300 000 px por lado): exportar (PSD llega a 30 000 px) y **abrir `.psb`**.
- **PSD y PSB de 16 bits** (`js/io/psd16.js`, escritor propio): la imagen final del motor de precisión sin pasar por los
  8 bits del lienzo, sin comprimir, con perfil sRGB o Display P3 y canal alfa si hay transparencia (sin capas).
- **Abrir PSD/PSB**: los 27 modos de fusión (el mapa anterior usaba nombres que ag-psd no emite y varios modos caían a
  «normal»), las máscaras se leen bien (antes se perdían: Photoshop las guarda en gris y Realify en el alfa), máscara
  desactivada, efectos de capa → estilos de Realify y capas de ajuste Invertir/Niveles/Curvas → capas de ajuste.
- Parche en el escritor de Niveles de ag-psd (`levl`): 29 registros en el orden de la especificación; antes escribía 63 y
  con verde/azul cambiados, y psd-tools no lo leía.
- **HEIC**: la exportación sigue bloqueada (no hay codificador HEVC en WASM con licencia compatible: libheif-js sólo
  decodifica, x265 es GPL y con patentes). Se mantiene AVIF, que da la misma calidad con menos peso.
- Prueba nueva `tests/psd.mjs` + `tests/psd_check.py` (psd-tools): PSD, PSB, ×2 y 16 bits, relectura con ag-psd y reapertura.

### v240 · Metadatos y privacidad (fase 15)
- **Inspector de metadatos** (Análisis › Inspector de metadatos…, `js/exif/inspector.js`; también en el cajón «Herramientas»
  del móvil): todo lo que lleva el archivo original de la foto abierta, o de otro que se elija —EXIF, ubicación GPS, IPTC,
  XMP, perfil ICC, MPF, Photoshop, notas del fabricante y miniatura— con un resumen de lo que revela (ubicación, fecha,
  cámara, autor, números de serie, miniatura incrustada) y los datos personales marcados. Copiar todo como texto.
  La lectura la hace **ExifReader 4.46.0 (MPL-2.0, sin modificar**, `js/vendor/exifreader`), cargado sólo al usarlo.
- **Metadatos al exportar** (diálogo Exportar, JPEG, PNG y WebP; `js/io/metadata.js`): por defecto, ninguno (como siempre).
  Se pueden volver a escribir, desde el original y filtrados, autor y copyright, fecha, cámara y objetivo, ubicación GPS y
  descripción/palabras clave, por separado o con atajos («Sólo autor y copyright», «Los del original, sin ubicación»,
  «Todos»). Lista blanca: el EXIF se reescribe etiqueta a etiqueta (original big o little endian), IPTC y XMP se construyen
  de nuevo con los campos permitidos. **Nunca** se copian la miniatura incrustada (enseña el original sin recortar), las notas
  del fabricante ni la orientación; los números de serie, sólo con «Todos». Las medidas EXIF son las del archivo exportado.
  Con el panel EXIF activo mandan sus datos; «Limpio para web» no lleva ninguno. El perfil de color del documento se
  incrusta como siempre (no se copia el del original: los píxeles ya están convertidos).
- **Limpiar metadatos de un archivo**: nueva opción «Sólo ubicación y números de serie» (sin recomprimir; los datos de imagen
  quedan idénticos): conserva fecha, cámara, autor, descripción y orientación.
- Comprobado con un JPEG de prueba con EXIF (big endian), GPS, miniatura, notas del fabricante, IPTC y XMP: los archivos
  exportados en JPEG, PNG y WebP abren en Pillow/piexif y ExifReader con exactamente lo que permite cada atajo (sin GPS, sin
  miniatura, sin MakerNote, sin orientación, medidas del archivo); EXIF little endian también.

### v239 · Los 16 bits sobreviven al documento (fase 14)
- **Girar, voltear, recortar y ampliar el lienzo conservan los 16 bits** de la foto (RAW revelado, PNG/TIFF de 16 bits,
  AVIF de 10/12): el origen de 16 bits se mueve con el lienzo (`remapHi` en `core/hisrc.js`) y se vuelve a tramar en su
  sitio nuevo en los píxeles sin tocar; lo pintado a mano se respeta. Antes cualquier recorte o giro los tiraba y la
  exportación en 16 bits salía de un lienzo de 8.
- **Deshacer y rehacer los recolocan** sin guardar copias de 6 bytes por píxel en el historial (giros y volteos se
  deshacen con la permutación inversa); recortar guarda el origen entero. **Redimensionar** y reducir el lienzo
  siguen soltándolos (cambian los píxeles), pero deshacer los devuelve.
- **Proyectos `.realify` y «guardar antes de actualizar» guardan los 16 bits** de las capas (PNG de 16 bits dentro
  del proyecto, hasta 24 MP) y los recuperan al abrir. El autoguardado periódico no los lleva (pesan mucho para repetirlo
  cada pocos segundos). Los proyectos antiguos se abren igual; los nuevos se abren en versiones anteriores sin los 16 bits.
- **Duplicar capa** conserva el origen de 16 bits.
- Comprobado con una foto de 16 bits: tras girar a la derecha y recortar, el PNG de 16 bits exportado coincide
  **bit a bit** con el original (150 000 valores, diferencia 0); lienzo, origen y deshacer/rehacer coherentes en todos los
  casos, con y sin tramado.

### v238 · Vista previa en coma flotante en GPU (fase 13)
- **Compositor de coma flotante en GPU** (`js/gpu/floatcompositor.js`): el árbol de capas se recompone en WebGL2
  con texturas RGBA32F (RGBA16F si el equipo no puede dibujar en 32) y sólo se pasa a 8 bits al mostrarlo, con
  el mismo tramado que la exportación. Cubre opacidad, los 28 modos de fusión, máscaras, recorte, grupos,
  «Fusionar si» y capas de ajuste (curvas de 4096 puntos para Niveles, Curvas, Exposición y Balance de blancos;
  rejilla RGB de 86³ para el resto). Las capas con origen de 16 bits muestran esos bits (la regla de
  `core/hisrc.js` se comprueba en la GPU). Documentos Display P3 incluidos, tras una comprobación única de que el
  navegador conserva el P3 por la GPU.
- **Cuándo se usa**: sólo si compensa (capas de ajuste, origen de 16 bits, «Fusionar si» o modos de fusión «a
  mano») y todo está soportado; con estilos de capa, un trazo en curso, documentos muy grandes (mosaicos) o sin
  WebGL2 de coma flotante, sigue el compositor de 8 bits, sin cambios. Ayuda › Diagnóstico dice si está activo.
- **Contrastado con la exportación en CPU** (`core/precision-stack.js`): 29 modos de fusión, 8 tipos de ajuste,
  máscara, recorte, grupo y Fusionar si dan una diferencia máxima de 0,03 niveles en 32 bits y de 0,4 en 16 bits.
- **Exportación en coma flotante con estilos de capa y «Fusionar si»**: ya no se parte del aplanado de 8 bits.
  Sombra, resplandor y trazo se dibujan aparte a tamaño completo y la capa va encima en coma flotante; el
  degradado y «Fusionar si» se evalúan sin redondear (diferencia con el aplanado de 8 bits: media 0,3–0,5 niveles).
- **Aviso de versión nueva más a prueba de fallos** (`js/pwa.js`, `js/pwa-updates.js`):
  - El aviso **Actualizar / Luego sale siempre primero**; la actualización automática va detrás y, si guardar lo abierto
    se atasca (IndexedDB bloqueado por otra pestaña, documento enorme) o falla, el aviso ya está a la vista (antes la
    espera podía quedarse sin aviso ni recarga). Tope de 12 s; el botón vuelve a «Actualizar».
  - Un **service worker nuevo encontrado** cuenta como señal de versión nueva: consulta `version.json` y, si no responde,
    avisa igualmente.
  - Ya no se fía de `navigator.onLine` (en algunos equipos dice «sin conexión» con red y bloqueaba la consulta).
  - **Registro de lo ocurrido** (comprobaciones, avisos, actualizaciones automáticas) en Ayuda › Diagnóstico y en el
    informe copiable, también en `localStorage`: si un aviso no llega, se ve por qué.
  - Carga del servidor: una consulta de ~50 bytes cada 2 min por pestaña visible (antes 1 min) y las del arranque,
    juntas, se reducen a una.
- **Disolver** usa ahora aritmética entera exacta (`Math.imul`) en el compositor de 8 bits, en el de exportación y
  en WebGPU, igual que la GPU nueva: el patrón es el mismo en la vista, en la exportación y en la GPU.

### v237 · Filtros en coma flotante (fase 12)
- **Motor común para filtros** (`js/editor/floatfilter.js`) y opción `float` en `runFilter` y en el diálogo en
  vivo de photo-tools, que convive con el camino de 8 bits: sólo actúa si la capa trae origen de 16 bits que
  cubre el lienzo, y la capa de filtro nueva conserva sus 16 bits (aviso «· 16 bits conservados»).
  - **«delta»** para filtros locales: el cambio que produce el filtro (en niveles de 8 bits) se suma a los 16 bits
    del origen; donde no toca un píxel se conservan sus 16 bits exactos.
  - **«color»** para lo que sólo mira el color de cada píxel: se evalúa en una rejilla RGB y se interpola.
- **Con «delta»**: Desenfoque gaussiano, Enfocar, Desenfoque de movimiento, Detalle y estructura, Viñeteado, Añadir
  ruido, Desenfoque de lente, radial y de superficie, Reducción de ruido por canal, Nitidez inteligente, Galería de
  desenfoque, Desenfoques clásicos, Restauración de escaneados, Enfoque avanzado, Textura y grano, Convolución
  personalizada, Reducción de ruido, Enfoque selectivo, Retoque de retrato y PurePixel.
- **Con «color»**: Estilos (looks) y Tabla de color (LUT), que ya pasaban por `runAdjust`.
- **Añadir ruido** usa ahora una semilla guardada en los parámetros: el mismo ruido al reeditar y al recalcular el
  porcentaje de aplicación (antes salía distinto cada vez y la prueba de calidad lo daba por FALLO).
- No se migran los filtros que mueven la imagen o la sustituyen (distorsiones, pixelar, paso alto, artísticos, IA…).
- Medido con un degradado de 16 bits muy suave: 1 000–1 200 valores distintos por fila tras el filtro
  (la misma capa sin origen de 16 bits: 13); el lienzo de 8 bits coincide con el redondeo de los 16 bits (≤ 0,5 niveles).
  Estilos y LUT: diferencia media con el camino de 8 bits ≤ 0,3 niveles.

### v236 · Ajustes en coma flotante (fase 11)
- **Interfaz de coma flotante en `runAdjust`** (`float`, `js/editor/floatadjust.js`) que convive con la de
  8 bits: un ajuste de color puro, aplicado a una capa con origen de 16 bits (RAW revelado, PNG/TIFF
  de 16 bits, AVIF de 10/12 bits), calcula en coma flotante desde esos 16 bits y la capa de filtro nueva
  los conserva; el lienzo de 8 bits es su redondeo con el mismo tramado que el origen. Si no cuadra
  (otro tamaño, memoria, función no numérica) se usa el camino de 8 bits de siempre.
- **Migrados**: Brillo y contraste, Niveles, Curvas, Balance de blancos, Tono y saturación, Exposición,
  Color por canales, Mezclador de canales y Vibrance (los modos Premium de estos tienen su propio
  motor). Medido con un degradado de 16 bits muy suave y Exposición +2 EV: 1 200 valores distintos
  por fila al exportar en PNG de 16 bits (antes, 13: bandas).
- Prueba de calidad en escritorio y móvil: APTO en Exposición, Niveles y Vibrance (fotos de 8 bits, camino
  de siempre sin cambios).

### v235 · Avisos de versión más robustos
- **Segundo camino de aviso, sin `version.json`**: el service worker nuevo avisa a las páginas abiertas
  al activarse y la app se actualiza (o enseña el banner) aunque la consulta de `version.json` falle.
- **Ayuda › Buscar actualización…**: consulta en el momento y dice la versión de esta copia y la última
  publicada («al día», «hay una nueva: Actualizar ahora» o por qué no se pudo consultar).
- **Estado a la vista**: Ayuda › Diagnóstico incluye ahora la versión cargada, la última conocida, cuándo
  se comprobó, el error si lo hubo y si el service worker controla la página.
- La consulta se reintenta una vez si falla (red lenta al despertar la app) y una petición congelada
  al suspender la app en iOS ya no bloquea las siguientes.
- Comprobado con service worker real y cabeceras como las de nginx: un cliente v227 abierto ve el banner
  al volver al primer plano y, al pulsar Actualizar, carga la versión actual; con `version.json` caído, la
  versión nueva se detecta igualmente por el service worker.

### v234 · Seleccionar por texto (fase 10)
- **Seleccionar por texto Premium 👑** (Selección, y Capa › Máscara de capa › «Por texto»): se escribe
  qué seleccionar —«persona», «cielo», «coche rojo», «césped sin personas», «árboles y montañas»— y
  sale una selección o la máscara de la capa. Reconoce las 150 categorías de ADE20K del modelo
  DeepLab que ya viaja con la web (nombres y sinónimos en español, plurales, grupos como
  «vehículos» o «muebles»), colores (rojo, naranja, amarillo, verde, azul, morado, rosa, marrón,
  blanco, negro, gris) y «sin X» para restar. Por bloques como «Seleccionar cielo» y con el borde ajustado
  a la foto por filtro guiado. Todo en el equipo, sin descargar nada.
- Medido con el modelo real: en una foto de fútbol, «persona» 14 % y «césped» 19 % de la imagen, y
  «césped sin persona» deja fuera al jugador; «césped azul» no encuentra nada.
- **Límite**: vocabulario cerrado (esas 150 categorías); no entiende descripciones libres. Un modelo de
  vocabulario abierto exigiría descargarlo de Hugging Face (ver PENDIENTE).

### v233 · Corrección de lente con perfiles reales (fase 9)
- **Corrección de lente por perfil Premium 👑** (Filtro): lee la cámara, el objetivo, la focal y el
  diafragma de los datos EXIF (JPEG, TIFF/DNG, HEIC, PNG, WebP), identifica el objetivo en la base de
  Lensfun (1 478 objetivos, 1 022 cámaras) y aplica sus calibraciones: **distorsión** (poly3, poly5,
  ptlens), **aberración cromática** (lineal, poly3) y **viñeteo** (en luz lineal, con tramado), a
  resolución completa y con un solo remuestreo bicúbico (Catmull-Rom). Zoom automático opcional
  para no dejar bordes vacíos. Si no reconoce el objetivo, se escribe a mano con sugerencias.
  Resultado en una capa nueva.
- **Comprobado contra Lensfun**: geometría y aberración cromática a 0,25 px (focales calibradas) y
  menos de 1 px entre calibraciones, viñeteo a ±1 nivel; una foto con distorsión sintética recupera
  la posición de sus 297 líneas de cuadrícula.
- **Licencia de los datos**: la base de Lensfun es CC BY-SA 3.0 (uso comercial permitido, con atribución
  y compartiendo igual las adaptaciones): `assets/lensdb/lensfun.json` se distribuye con esa
  licencia y su aviso (`assets/lensdb/LICENSE.md`, `js/vendor/ATTRIBUTIONS.md`). El código de
  Realify no queda afectado.

### v232 · Actualización automática al abrir o volver a la app
- **Se actualiza sola de nuevo**: al abrir la web o la app, o al volver a ponerla en primer plano,
  si `version.json` anuncia una versión más nueva que la cargada, Realify guarda lo abierto, se
  recarga y lo recupera («Realify actualizado · tu documento se ha recuperado»). Antes (desde
  la v227) sólo salía un aviso con Luego / Actualizar.
- Sigue saliendo el aviso, sin recargar solo, si hay un diálogo o una herramienta a pantalla
  completa abiertos, si lo abierto no se puede guardar, o si ya se intentó para esa versión hace
  menos de 3 minutos (para no entrar en bucle si el servidor sirviese una copia vieja).
- Prueba `tests/pwa-actualizaciones.mjs` adaptada: actualización automática, sin bucle, registro
  tardío, mismo worker y reconexión.

### v231 · Visión clásica con OpenCV (fase 8)
- **Perspectiva automática 👑**: botón «Automático» en el modo Guías de Perspectiva. Hough
  probabilista + RANSAC de punto de fuga eligen hasta 3 guías por familia. Con una fachada
  sintética con verticales a 9°, 2,3° y −5° quedan a 0,00°. Las horizontales sólo cuentan si ya
  están casi rectas (en una fachada vista de lado convergen de verdad).
- **Contraste local (CLAHE)** (Ajustes › Tono avanzado), normal y Premium 👑: ecualización adaptativa con
  límite de contraste e interpolación entre mosaicos. Premium: luminosidad OKLab en coma
  flotante (1024 niveles), el croma acompaña a la luz con mapeo de gama, tramado. Resultado en
  capa nueva, a tamaño completo.
- **Análisis de nitidez** (Imagen): mapa de enfoque a resolución completa en una capa nueva y
  ranking de tomas con nota 0-100 para abrir la mejor (en una prueba, 77 y 69 las nítidas frente a
  36 y 35 las desenfocadas).
- **Escanear documento 👑** (Imagen): detecta el papel con OpenCV, esquinas arrastrables, proporción
  real deducida de la perspectiva (con una cámara sintética recupera 0,707 de un A4) o A4 / Carta, y
  lo endereza a resolución completa. Foto nueva.

### v230 · Apilado de fotos con OpenCV (fase 7)
- **Apilar fotos Premium 👑** (Imagen › Apilar fotos…): de 2 a 16 tomas de la misma escena
  hechas a pulso, alineadas con **precisión subpíxel** y combinadas. **Reducir ruido**: media
  en luz lineal con rechazo de lo que se mueve (cada toma se compara con la mediana de las
  demás, con el ruido medido en la propia pila); el ruido baja en √N. **Ampliar el enfoque**:
  en cada punto gana la toma más nítida, con transiciones suaves. Foto nueva a la resolución
  completa que admite el editor, por franjas.
- **Alineación** (`js/cv/align.js`): puntos ORB + homografía robusta (RANSAC) + afinado ECC; con
  fotos sintéticas giradas ±1,5°, con escala, perspectiva y ruido, el error medio es de 0,15–0,4 px.
  Opción «Corregir movimiento fino» con flujo óptico (Farnebäck). La foto se resamplea una sola
  vez (Lanczos); con trípode (casi sin movimiento) no se toca ni un píxel.
- **OpenCV.js 4.12** (Apache-2.0, 11 MB) en `js/vendor/opencv/`, sólo se descarga al usarlo, avisando
  antes (`js/cv/opencv.js`).
- Medido con 6 tomas con ruido σ = 10: PSNR 28,0 → 36,0 dB y el objeto móvil desaparece; con 4
  tomas con bandas desenfocadas distintas, 28–33 dB → 43–46 dB.

### v229 · Formatos modernos de alta calidad (fase 6)
- **AVIF de 10 y 12 bits** al exportar: salen de los 16 bits del motor de alta precisión
  (sin redondear antes a 8 bits), con tramado de ±½ nivel y calidad 100 = sin pérdidas
  (4:4:4). Etiqueta de color `colr/nclx` correcta (sRGB o **Display P3**); el AVIF normal de
  8 bits también la lleva ahora (antes no decía en qué espacio estaba).
- **JPEG XL** (`.jxl`): exportar con pérdidas o sin ellas (calidad 100) y **abrir** archivos
  `.jxl` (el del navegador si lo tiene; si no, un decodificador propio). Códec jSquash/libjxl
  (Apache-2.0) en `js/vendor/jxl/`, cargado sólo al usarlo. En 8 bits (límite del códec);
  el decodificador WASM puede diferir ±1 nivel en archivos sin pérdidas.
- **OpenEXR** (`.exr`): escritor propio sin dependencias, en luz **lineal**, HALF (16 bits en
  coma flotante), compresión ZIP, alfa asociado y atributo `chromaticities` (sRGB o
  Display P3). Se escribe por bloques de 16 líneas: nunca está la foto entera en coma
  flotante en memoria. Verificado leyéndolo con OpenEXR.
- **Gestor de códecs** (`js/io/codecs.js`): cada códec WASM se carga al elegir el formato y
  en el diálogo Exportar aparece el **peso aproximado y la calidad estimada** (PSNR en
  palabras: excelente, muy buena, buena…) para AVIF, JPEG XL, JPEG y WebP. Se estima codificando
  recortes representativos de la foto (elegidos por nivel de detalle) y extrapolando; desvío
  medio de ~10 %.
- Límite por memoria: AVIF profundo y JPEG XL admiten hasta 24 MP en ordenador y 8 MP en móvil
  o equipos con poca memoria, con un aviso claro si se supera.

### v228 · Profundidad como herramienta (fase 5)
- **Seleccionar por profundidad 👑** (Inteligencia Artificial › Seleccionar): primer plano,
  plano medio, fondo (tercios por cantidad de píxeles, siempre dan algo útil) o intervalo
  manual; tocar la imagen elige la distancia de ese punto; suavidad e invertir. Ver sobre la
  foto o el mapa de profundidad. Resultado como **selección** o como **máscara de capa**.
  Se calcula a tamaño real: la distancia, guiada por los bordes de la foto, se interpola por
  píxel antes de aplicar la zona (el contorno no sale a escalones).
- **Máscaras por distancia para cualquier ajuste local**: Capa › Máscara de capa › «Por
  profundidad…» y el botón «Por profundidad 👑» de las propiedades de la máscara, en capas de
  imagen y de ajuste, en un solo paso de historial (`setMaskFromArray` en `js/editor/masks.js`).
- **Luz por profundidad 👑**: luz distinta para lo cercano y lo lejano en pasos EV, con
  punto de giro (se toca en la imagen) y transición suave; luz lineal con hombro suave (no
  recorta las luces y conserva el tono) y tramado. Capa nueva.
- **Separar planos 👑**: 2, 3 o 4 planos en capas con máscaras acumulativas y transiciones que
  suman 1; recompuestas dan la foto original (diferencia máxima de 2 niveles de 255).
- Matemática sin DOM en `js/ai/depthmath.js`.

### v227 · Aviso de actualización en la app instalada
- La detección compara la versión de `main.js` cargada con `version.json`, también cuando la app reanuda una sesión con el mismo service worker o éste falla.
- Comprueba al arrancar, volver a primer plano, recuperar conexión y cada minuto mientras está visible. El registro funciona aunque el módulo se inicie después de `load`.
- Conserva el botón «Actualizar», el guardado y la recuperación de documentos; no recarga automáticamente una sesión abierta y respeta «Luego».
- El service worker consulta el manifiesto en la red y no almacena sus consultas ni devuelve versiones obsoletas sin conexión.
- Regresión de navegador y app instalada: suspensión/reanudación, registro tardío, reconexión, manifiesto inválido, primera instalación y botón Actualizar. Comprobado también con un service worker real.
- VERSION, version.json, caché y URLs de carga sincronizados en v227, pendiente de publicación.

### v226 · Zoom en Marcos
- Zoom con rueda del ratón o pellizco de dos dedos, centrado en el punto del gesto; admite desplazamiento al arrastrar la imagen ampliada.
- «Encajar» devuelve la imagen completa al área de vista previa; doble clic también restablece el zoom.
- La vista previa aumenta su resolución al ampliar, hasta la resolución de la foto con un límite de 8 MP / 4096 px para contener la memoria.
- El zoom afecta únicamente a la vista; Aplicar conserva los píxeles, dimensiones y anchura de marco elegida.
- Regresión de rueda, punto bajo el cursor, pellizco, arrastre y encajar en escritorio, móvil y tableta. Versionado sincronizado en v226, pendiente de publicación.

### v225 · Colores y controles de Marcos
- Todos los marcos utilizan los colores elegidos; se eliminan las paletas fijas que ignoraban los mandos, incluido Color · Electric.
- Los modelos minimalistas de un solo color ocultan el mando secundario sin efecto.
- El editor sigue el área visible del navegador al cambiar sus barras o selectores nativos; al elegir una opción se retira el foco del selector.
- Pruebas de los 138 modelos: cada color visible cambia los píxeles; Electric respeta ambos colores en móvil y escritorio. Se comprueban los mandos dentro de un área visible reducida y la conservación de la foto.
- VERSION, version.json, caché y URLs de carga sincronizados en v225, pendiente de publicación.

### v224 · Marcos
- **138 modelos en 12 categorías**: marco Liso de color único, Heart geométrico y 16 diseños de autor (kintsugi, vitral, origami, constelación, holográfico y otros).
- **Diamond y corazones corregidos**: motivos vectoriales simétricos distribuidos en los cuatro lados, sin depender de caracteres de una fuente.
- **Ajustes en móvil y escritorio**: anchura y colores sincronizados al cambiar de modo; Liso muestra un único color.
- **Vista previa completa**: encaja el marco entero en el espacio disponible sin deformarlo ni cortar el borde inferior.
- **Comprobaciones específicas**: 828 renders, recorte exterior, reproducibilidad, color uniforme, conservación exacta de la fotografía y deshacer/rehacer en ambos modos.
- **Versión v224** sincronizada en `VERSION`, `version.json`, caché y URLs de carga.

### Marcos
- **Marcos exteriores reales**: aplicar un marco amplía el lienzo y mantiene toda la fotografía intacta en el centro; el dibujo del marco queda recortado a la corona exterior y no puede superponerse sobre la imagen.
- **120 presets revisados**: las variantes se diferencian ahora por geometría, material, patrón, textura y acabado, no sólo por color o grosor.
- **Previsualización fiel**: las miniaturas y la vista previa muestran el espacio exterior que añadirá el marco antes de aplicarlo.
- **Deshacer/rehacer completo**: al quitar o recuperar un marco también se restaura el tamaño del documento, las guías y la selección.

### Capas, gestos y rendimiento
- **Capas**: doble clic en el nombre o clic derecho en la fila para renombrarla (con deshacer/rehacer). En escritorio siguen funcionando Ctrl/Cmd+clic y Mayús+clic; el botón de selección múltiple añade un modo táctil para marcar capas con toques y agruparlas desde la cabecera.
- **Combinar con la de abajo** ahora respeta la máscara de la capa superior y la composición alfa de los modos personalizados. Se evita combinar sobre capas inferiores cuyo estado (visibilidad, opacidad, fusión, máscara o efectos) haría que el resultado cambiase de aspecto.
- **Pinceles y herramientas de retoque**: Alt + botón derecho y arrastrar horizontal cambia el tamaño; arrastrar vertical ajusta dureza, al estilo Photoshop.
- **Ventanas**: el arrastre de la cabecera funciona también al salir de ella y sigue el modo de escritorio/móvil de la interfaz, no el tipo físico del dispositivo. Reemplazar cielo usa el mismo diálogo movible que el resto.
- **Iluminar con IA Premium**: se sustituyó la ordenación de millones de muestras para estimar el punto negro por un histograma de precisión fina. Reduce el trabajo y la memoria en imágenes grandes; el cálculo final sigue siendo a resolución completa.

### Máscaras de capa: pintar en negro ya oculta
- **El Pincel no ocultaba nada al pintar la máscara**: pintaba gris opaco y la máscara guarda
  la visibilidad en su canal alfa, así que el negro seguía «viéndose». Ahora el trazo se
  pinta aparte (punta, dureza, opacidad y dinámica de siempre) y su cobertura lleva la
  máscara hacia el gris elegido: negro oculta, blanco muestra, gris a medias; repasar dentro
  del mismo trazo no pasa de la opacidad elegida. Mismo arreglo para «Suprimir» con la
  máscara elegida.
- **Alt+clic en la miniatura de la máscara** enseña sólo la máscara y ahora también pinta
  sobre ella (antes sólo cambiaba la vista y se pintaba la imagen). Cambiar de capa o tocar
  la miniatura de la imagen vuelve a la vista normal.
- **Móvil**: un segundo toque sobre la máscara ya elegida abre su menú (ver y pintar sólo la
  máscara, volver a pintar la imagen, activar, aplicar, eliminar); en el ordenador el mismo
  menú sale con clic derecho, y Propiedades de la máscara trae el botón «Ver máscara».
- Propiedades de la máscara ya no deshace lo pintado con el panel abierto al mover Densidad
  o Desvanecer.

### Entrada de alta profundidad: los bits de la foto llegan a la exportación
- **La capa de fondo guarda los bits reales de la foto** cuando trae más de 8 por canal
  (`js/core/hisrc.js`); el lienzo sigue siendo de 8 bits y la exportación en coma flotante
  decide píxel a píxel: donde el lienzo sigue igual que el original usa sus 16 bits; donde
  se ha pintado, clonado o filtrado, lo que hay en la capa (deshacer lo devuelve al original).
- **Abrir en Realify desde el revelador RAW** (Premium): el revelado llega con sus 16 bits por
  canal, con el mismo tramado de siempre en el lienzo.
- **PNG y TIFF de 16 bits** (RGB, RGBA y gris; TIFF sin comprimir, LZW, Deflate, intel y
  motorola) con un lector propio (`js/io/hidepth.js`), y **AVIF de 10 y 12 bits** con el
  decodificador libavif + dav1d de jSquash (Apache-2.0 y BSD, 1,2 MB, sólo se carga para esos
  archivos). Los bits se aceptan sólo si coinciden con lo que decodifica el navegador, que
  aplica el perfil de color del archivo.
- Resultado medido con una foto oscura de 16 bits y +2,5 EV de exposición en una capa de
  ajuste: error medio de 0,001 niveles frente al cálculo ideal (0,69 partiendo de 8 bits, que
  es lo que se ve como bandas); en las sombras, 7 827 niveles distintos frente a 31.
- **Exportar** marca de entrada «Alta precisión» y «Tramado a 8 bits» cuando la foto trae
  más de 8 bits, y lo explica.
- Tope de memoria: hasta 12 MP en móviles y 32 MP en ordenador (6 bytes por píxel).

### IA a resolución completa por bloques
- **Motor común de bloques** (`js/ai/tiles.js`): bloques que se solapan, fundido con pesos
  suaves (nunca en el borde de la foto), número de bloques según el motor (más con GPU).
- **Profundidad** (Desenfoque por profundidad, Niebla por distancia, Foto 3D): además de la
  pasada global a 518 px, la foto a más resolución se parte en bloques; cada bloque se ajusta
  por mínimos cuadrados a la escala del mapa global y se funden sin costuras. Las formas
  grandes salen del mapa global y el detalle de los bloques: ahora aparecen los hilos de una
  red, las cruces de un puente o las farolas, que a 518 px se perdían.
- **Máscaras de cielo y de persona** (Seleccionar cielo, Reemplazar cielo, Seleccionar
  sujeto): la pasada global decide dónde hay cielo o persona y los bloques, con hasta 4 veces
  más detalle, afinan sólo la franja dudosa del borde (un bloque sin contexto no puede
  confundir una pared azul con cielo).
- **Caras a su resolución real**: en Restaurar caras, si la cara es mayor que los 512 px de
  GFPGAN, se le devuelve el detalle de la foto por encima de esa resolución (antes quedaba más
  blanda que el original). En Retoque de cara, las zonas (piel, ojos, labios) se ajustan con
  un filtro guiado a los bordes reales a la resolución de la foto.
- **Progreso y cancelar uniformes**: las operaciones de varias pasadas muestran un solo aviso
  con «bloque i de n» y un Cancelar que para la operación entera (antes el aviso parpadeaba
  en cada pasada y cancelar sólo paraba la pasada en curso).
- **Detección real de la GPU**: con WebGPU en el navegador pero sin una GPU utilizable, el
  motor pasaba a la CPU sin avisar y se elegían tamaños de bloque de GPU; ahora se comprueba
  que hay adaptador antes de usarla.

### Enfoque avanzado / estabilizador: sin pixelar y con deconvolución real
- **La vista previa ya no se queda pixelada**: se calculaba sobre una copia de 0,4 MP
  ampliada y así seguía hasta pulsar Aplicar. Ahora la copia reducida sólo se ve mientras se
  mueve un mando; al soltarlo se calcula a resolución completa, en el diálogo y en el panel
  de Propiedades, en móvil y escritorio.
- **Todo el cálculo va en workers**, repartido por franjas entre los núcleos del equipo
  (resultado idéntico al de una sola pasada): la interfaz no se congela con fotos grandes.
- **Motor nuevo en coma flotante sobre la luminancia** (`js/filters/sharpen-engine.js`): el
  detalle se suma por igual a R, G y B, así que el enfoque ya no tiñe los bordes ni realza el
  ruido de color.
  - **Deconvolución de foco**: antes era la máscara de enfoque multiplicada por 1,45; ahora es
    deconvolución de verdad (Van Cittert con PSF gaussiana).
  - **Estabilizador de movimiento**: antes la foto movida quedaba peor (−2 dB); ahora es una
    deconvolución Landweber con PSF en línea (+2,3 dB con el ángulo correcto).
  - **Reducir halos** limita de verdad lo que el resultado se pasa de sus vecinos (antes
    apenas actuaba).
  - **Umbral** con transición suave, **Proteger bordes** calculado sobre la luminancia y la
    franja de 1 px del borde de la imagen ahora también se enfoca.
- La prueba `tests/calidad-herramienta.mjs` mueve el deslizador del diálogo abierto (antes
  podía mover el de opacidad del panel Capas).

### Color de gama amplia: fotos Display P3 sin perder saturación
- **Diagnóstico**: las fotos de iPhone y de muchos Android vienen en Display P3. Todos los
  lienzos eran sRGB, así que al abrirlas el navegador recortaba los colores fuera de sRGB
  (un rojo P3 puro quedaba en 234, 51, 35 en lugar de 255, 0, 0) y al exportar se guardaban
  ya recortados y sin perfil.
- **Al abrir**, se compara la foto decodificada en P3 y en sRGB: si una parte apreciable no
  cabe en sRGB y el navegador sabe trabajar en P3, el documento entero pasa a **Display P3**
  (`js/core/colorspace.js`): capas, vista, herramientas y ajustes trabajan con los números P3.
  Se avisa al abrir. Las fotos sRGB no cambian en absoluto.
- **Al exportar**, nueva opción **Color** en documentos P3 (móvil y escritorio):
  **Display P3** con el perfil incrustado en JPEG (APP2), PNG (iCCP), PNG 16 bits (iCCP) y
  TIFF 16 bits (etiqueta 34675), o **sRGB** para la máxima compatibilidad (también en el
  motor de alta precisión, con la conversión en luz lineal). WebP, AVIF, TIFF de 8 bits, GIF,
  PDF, PSD y «Limpio para web» se guardan en sRGB, convertidos correctamente.
- Perfil ICC «Display P3» propio (`js/core/icc.js`), verificado con LittleCMS.
- El proyecto `.realify` y las pestañas recuerdan el espacio de color de cada documento.
- Límites conocidos: las herramientas que usan la GPU (WebGL) recortan a la gama sRGB; el
  color de pintura sigue siendo sRGB (el cuentagotas convierte bien, pero recorta los colores
  fuera de sRGB); «Abrir en Realify» desde el revelador RAW
  sigue en sRGB (fase 4).

### Exportación sin bandas: capas y ajustes en coma flotante, PNG y TIFF de 16 bits
- **Alta precisión al exportar** recalcula ahora todo el documento en coma flotante
  (`js/core/precision-stack.js`): capas, capas de ajuste (las diez), los 27 modos de fusión,
  opacidad, máscaras, recortes y grupos, sin redondear a 8 bits entre capa y capa. Antes cada
  capa de ajuste partía del resultado ya redondeado de la anterior: con una pila que comprime y
  vuelve a estirar los tonos, un degradado quedaba en 40 niveles con saltos de 9 (bandas); ahora
  conserva sus 197 niveles con saltos de 1. Verificado contra el compositor de siempre: misma
  imagen salvo ese redondeo (diferencia media de 0,05 a 0,6 niveles).
- Curvas, Niveles, Balance de blancos y Exposición exponen su fórmula continua
  (`curveFunction`, `levelFunction`, `wbGains`, `exposureFunction`); las tablas de 8 bits de
  siempre salen de esas mismas funciones (2100 tablas comparadas: idénticas).
- **Sin el límite de 8 MP**: se trabaja por franjas y se guarda en 16 bits por canal; hasta
  32 MP en ordenador y 16 MP en móvil. Al reducir, cada píxel promedia en luz lineal la zona
  que cubre; al ampliar, bilineal. La interfaz sigue respondiendo mientras se exporta.
- **Nuevos formatos: PNG 16 bits y TIFF 16 bits (máxima calidad)** en Exportar (móvil y
  escritorio), siempre con alta precisión; PNG con etiqueta sRGB y transparencia; TIFF RGB o
  RGBA.
- Con estilos de capa o «Fusionar si» (aún no reproducidos en coma flotante) se parte del
  compuesto normal y sólo el remuestreo y la salida son de alta precisión; el motivo se indica.

### Documentos legales: cambios sin previo aviso
- Aviso legal, Política de privacidad y Política de cookies indican que el titular puede
  modificarlos (y la aplicación) en cualquier momento y sin previo aviso, que los cambios se
  reflejan siempre en esos documentos y se aplican desde su publicación. Cada uno muestra la
  fecha de su última actualización.

### Licencia: uso libre de la web
- El código pasa a la licencia PolyForm Noncommercial 1.0.0. El Aviso legal de la app y el
  README aclaran que esa limitación es para el código: usar la aplicación en realify.es está
  permitido para cualquier fin, también profesional o comercial.

### Móvil: el zoom con dos dedos falla con Capas abiertas
- Con Capas abiertas (y con la herramienta Mano), tocar la imagen sólo desplaza y amplía, y el
  doble toque alterna entre ajustar y 100 %. Los dos dedos de un pellizco se apoyan casi a la vez,
  así que el segundo contaba como doble toque: la imagen saltaba a 100 % y el pellizco no llegaba
  a empezar. Ahora un toque con otro dedo apoyado nunca es doble toque.
- El doble toque para «ajustar» con Capas abiertas encaja la imagen en el hueco libre (antes
  usaba toda la pantalla y dejaba parte de la foto bajo los mandos).

### Ajustes y filtros: la imagen ya no queda pixelada
- En fotos grandes, **58 herramientas** dejaban la capa pixelada al aplicarlas (revisión
  automática de los 90 ajustes y filtros, en móvil y escritorio): casi todos los Ajustes
  (Tono / Color automático, Tono y saturación, Vibrance, Curvas, Niveles, Exposición…) y muchos
  filtros (Enfocar, Enfoque inteligente, Paso alto, desenfoques, Distorsionar, Estilizar…). El
  cálculo al aplicar sí era a resolución completa, pero el panel de Propiedades, al montar los
  mandos de la capa nueva, la repintaba con la vista previa reducida (~630 px ampliados), y así
  se veía y se exportaba hasta cambiar de capa. Ahora la capa conserva el resultado completo.
- Al dejar de mover un mando, la imagen se recalcula a resolución completa si el cálculo es
  rápido: en los ajustes, en el diálogo y en el panel de Propiedades; en los filtros pesados,
  sólo en el panel (en el diálogo ya lo hace Aplicar). Mientras se mueve se ve la copia rápida.
- Restauración de escaneados (Mediana, Polvo y rascaduras): la mediana se calcula con un
  histograma deslizante, con idéntico resultado; con una foto de 6 MP pasa de más de medio
  minuto con la app congelada a unos 3 segundos.

### Política de privacidad: registros del servidor web
- Nueva sección «Registros del servidor web»: qué se anota (IP, fecha y hora, archivo pedido,
  resultado, página de origen y navegador), para qué (sólo seguridad y diagnóstico de fallos;
  nada de analítica ni perfiles), base jurídica (interés legítimo, art. 6.1.f y considerando 49
  del RGPD), conservación (14 días, borrado automático), quién lo ve (sólo el responsable; el
  proveedor del servidor como encargado) y el registro de errores.
- Corregidos el resumen y «Tus derechos», que decían que no se guardaba ningún dato personal en
  servidores propios: ahora explican cómo ejercer los derechos sobre esos registros.

### La app no arrancaba con algunos bloqueadores de avisos de cookies (Firefox)
- Los filtros de «avisos de cookies» de algunos bloqueadores (uBlock Origin con EasyList
  Cookie o Annoyances, «I don't care about cookies»…) bloqueaban el archivo `cookiebar.js` por
  el nombre. Como se importaba al arrancar, sin él no arrancaba nada («No se pudo cargar
  main.js»). Confirmado con los registros del servidor: fue el único archivo que no se pidió.
- El archivo se llama ahora `prefsnote.js` y se carga aparte y sin bloquear: si un bloqueador lo
  quita, la app funciona igual, sólo que sin la barra informativa (la política sigue en Ayuda ›
  Cookies). Revisados los demás archivos de arranque: ninguno tiene nombres de ese tipo.

### Desenfoque por profundidad y Niebla por distancia: ya no se cierran al aplicar
- Al aplicar con una foto grande del móvil (12 MP o más) la pestaña se quedaba sin memoria
  (unos 2 GB en matrices a tamaño completo) y el navegador cerraba la foto sin aplicar nada.
- Ahora la profundidad, el desenfoque y la niebla se calculan a una resolución de trabajo
  (1600 px de lado largo en móvil, 2400 en ordenador) y se componen con la foto ORIGINAL a su
  tamaño real, por franjas y en luz lineal: lo enfocado queda exactamente como el original y
  el grano se añade a tamaño real. Las capas de desenfoque se suman una a una en vez de
  guardarse las seis a la vez. Más rápido (unos 3 s con 12 MP) y el resultado coincide mejor
  con la vista previa.

### Restaurar caras en iPhone (memoria)
- GFPGAN va ahora partido en dos mitades (codificador y generador, fp16; resultado idéntico al
  modelo entero): en móviles se carga una, se ejecuta, se suelta y luego la otra. El pico de
  memoria baja de ~1 GB a ~600 MB. Mismos 170 MB de descarga; el modelo entero antiguo se borra
  del navegador.
- La descarga de modelos ya no tiene el archivo tres veces en memoria a la vez (trozos, Blob y
  copia): cada trozo se copia a un único búfer.

### Foto 3D: guardar bien en cada sistema
- iPhone/iPad: en dos pasos («Crear GIF» y, cuando está listo, «Guardar»), porque Safari sólo
  abre la hoja del sistema justo tras un toque; allí «Guardar imagen» la deja en Fotos.
- Android: se descarga (Descargas, se ve en la galería). Ordenador: se descarga.

### Porcentaje de aplicación en las capas de IA
- Las herramientas de IA que dejan una capa del mismo tamaño que la foto tienen ahora el
  deslizador de **porcentaje de aplicación** de la capa («mezcla»), como los filtros: Difuminar
  caras, Retoque de cara, Restaurar caras, Ojos rojos, Borrador mágico, Desenfoque por
  profundidad, Niebla por distancia, Colorear con IA, Reemplazar cielo, Reducción de ruido con
  IA y Quitar artefactos JPEG con IA. 100 % = el resultado de la IA, 0 % = el original; no se
  vuelve a ejecutar la IA (instantáneo). En los parches con transparencia (caras, ojos…) se
  escala su intensidad, así se funde bien con lo que haya debajo aunque se apilen varias capas.
- Las que cambian el tamaño de la imagen (Ampliar, Expandir) no lo llevan.

### Cajón del móvil: pestañas a la primera
- A veces había que tocar dos veces una pestaña del cajón (Básicos → Estilo…): si la fila de
  pestañas aún se deslizaba por la inercia de un gesto anterior, el navegador usaba el toque
  para frenarla y no pulsaba. Ahora la pestaña se activa al levantar el dedo si apenas se ha
  movido, aunque la fila estuviera en movimiento; sin el «click» posterior, que al cambiar el
  cajón de alto podía caer en el velo y cerrarlo.
- La pestaña activa se centra desplazando sólo la fila (antes `scrollIntoView`, que en iPhone
  podía mover la página unos píxeles y desviar el siguiente toque).

### Caché y versiones (la app no arrancaba en algunos Firefox)
- Causa: los módulos ES se importan sin «?v=» y `.htaccess` daba 30 días de caché a JS y CSS;
  un navegador podía mezclar un `main.js` nuevo con módulos viejos («does not provide an export
  named…») y la app no arrancaba.
- `.htaccess`: HTML, JS, CSS, JSON y manifiesto con `Cache-Control: no-cache` (revalidar
  siempre, un 304 si no cambió); `sw.js` nunca desde caché. Imágenes, fuentes y modelos siguen
  con caché larga. (El ejemplo de nginx ya lo hacía con `expires -1`; anotado.)
- **Autorreparación** en el vigilante de arranque: si la app no arranca por un error de módulos
  (o no arranca sin más), una vez por sesión borra el service worker y la caché de la app,
  vuelve a pedir todos los módulos y hojas de estilo saltándose la caché y recarga. Si ni así,
  el panel con «Copiar diagnóstico».
- El service worker precachea `main.js?v=N`, la misma URL que carga `index.html`.

### Compatibilidad (Firefox y otros)
- **Aviso automático** al arrancar (móvil y escritorio) si el navegador bloquea o altera la
  lectura del lienzo (protección contra huellas de Firefox en modo estricto,
  resistFingerprinting, LibreWolf, Mullvad…), si no hay WebGL2 o si no deja guardar datos:
  una barra explica qué pasa y cómo arreglarlo, con pasos propios para Firefox.
- **Vigilante de arranque** (`js/boot-guard.js`, script clásico que se carga antes que la app):
  recoge los errores desde el primer momento y, si la app no arranca, muestra un panel con el
  error y «Copiar diagnóstico». El mismo botón está en Ayuda › Diagnóstico.
- El registro del service worker ya no puede lanzar un error en ventanas privadas o con el
  service worker desactivado.

### Iluminar con IA, automático
- **Iluminar con IA Premium 👑** mide la exposición antes de aclarar: busca sobre la foto
  reducida cuánto de la curva de Zero-DCE++ hace falta para llevar la mediana de la luz a un
  nivel natural (≈ 45 %). Una foto ya bien expuesta no cambia (antes subía su luz media de 117
  a 142); una algo oscura se aclara un poco y una muy oscura recibe la curva entera.
  «Intensidad» sigue graduándolo (100 % = automático).

### Realify Premium 👑
- El filtro **Realify** tiene modo Premium con los mismos mandos: interruptor con la corona
  en su barra (móvil: junto a ✕; escritorio: junto a Aplicar) y entrada «Realify Premium 👑»
  en el menú Inteligencia Artificial y en el cajón. Bueno: toda la cadena en coma flotante de
  32 bits (antes 16) y luces con hombro suave que conserva la proporción entre canales. Mejor:
  tinte y saturación en OKLab con mapeo de gama por croma (sin virar ni recortar colores) y
  tramado triangular al pasar a 8 bits. Se guarda en la capa de filtro, entra en
  deshacer/rehacer y se usa también al recalcular sin ventana. Apagado, idéntico a antes.

### Corrección de carga
- La guía de exportación vuelve a inicializarse sin interrumpir el arranque
  de la aplicación.

### Exportación profesional
- Exportar y Exportar como incorporan TIFF RGBA sin pérdidas de 8 bits.
  Exportar como añade PSD con grupos y capas rasterizadas; el compuesto mantiene
  la imagen final y una capa de referencia oculta si hay ajustes. El proyecto
  `.realify` conserva todos los parámetros reeditables.

### Realify en escritorio
- Cada una de las 31 etapas muestra un pequeño chevrón para abrir o cerrar sus
  mandos, con su estado accesible por teclado. El botón «S» de aislamiento
  muestra un icono de ojo; el selector móvil conserva su disposición.

### Recorte
- El selector de proporciones incorpora formatos numéricos para redes sociales,
  pantallas de móviles y monitores de PC, agrupados por uso. Se pueden girar los
  formatos fijos con ⇄; «A medida» conserva los campos de ancho y alto.

### Previsualización de cielos
- Las miniaturas de Poly Haven y las anteriores mantienen el mismo tamaño en
  Reemplazar cielo. En móviles, la fila adapta el ancho de las tarjetas al
  espacio disponible sin que los textos largos ensanchen las nuevas.

### Biblioteca ampliada
- Reemplazar cielo ofrece ahora 101 opciones: 82 fotografías CC0 de Poly Haven,
  16 cielos procedurales anteriores y 3 nuevos generados para Realify. Incluye
  búsqueda y filtros por momento del día y condiciones del cielo, con procedencia
  visible en cada miniatura. Las imágenes están alojadas en la propia web.
- Los diálogos se pueden arrastrar en un escritorio con la ventana estrecha;
  el gesto de cerrar la hoja en el diseño móvil conserva su comportamiento.

### Añadido
- **Biblioteca de cielos** en Reemplazar cielo (móvil y escritorio): 16 cielos CC0 generados
  para Realify (`assets/skies/`, con su generador): despejado, azul intenso, cúmulos, nubes
  dispersas, cirros, nublado, tormenta, dramático, atardeceres dorado y rosa, puesta con nubes,
  amanecer, hora azul, crepúsculo, noche estrellada y noche con luna. Miniaturas en rejilla
  (escritorio) o en una fila deslizable (móvil). El horizonte del cielo se coloca sobre el
  detectado y «Posición» lo ajusta.

### Cambiado
- **Sin TensorFlow.js**: BodyPix (Seleccionar sujeto), DeepLab ADE20K (Seleccionar y Reemplazar
  cielo) y MobileNet (Adaptive Photo Lens) se han convertido a ONNX con tf2onnx (mismos pesos)
  y corren en el worker de IA común con ONNX Runtime (WebGPU o WebAssembly). Fuera
  `tf.min.js`, BodyPix y DeepLab (≈ 2 MB de JavaScript) y sus dos workers.
- Cielo: DeepLab da ahora la probabilidad (no sólo la clase) y el borde de la máscara se ajusta
  a la foto con un filtro guiado: sin escalones ni halo del cielo antiguo al reemplazarlo.

- **Iluminar con IA Premium 👑** (Inteligencia Artificial › Mejorar y restaurar y cajón), con
  Zero-DCE++ (42 KB, se ejecuta en JavaScript, sin descarga aparte). La red estima a 320 px una
  curva de luz por punto y canal; los mapas se amplían con filtro guiado (sin halos) y las curvas
  se aplican en coma flotante; después, punto negro, limpieza del ruido de luz y de color de las
  sombras según lo aclarado, y tramado. Intensidad de 0 a 150 %. Capa de filtro que se reabre.
  Licencia CC BY-NC 4.0 (uso no comercial), aceptada mientras Premium sea gratuito.
- **Restaurar caras Premium 👑** (Inteligencia Artificial › Caras y cajón), con GFPGAN v1.4
  (Apache 2.0, convertido a fp16: 170 MB en dos trozos servidos por la web, descargados al
  usarlo con aviso y guardados unidos en IndexedDB). Cada cara (YuNet) se alinea a la plantilla
  FFHQ con sus cinco puntos, se restaura a 512 px y se pega en luz lineal con borde suave;
  si es pequeña, se filtra antes de reducirla; conserva el color de piel y el grano de la foto.
  Todas las caras en una sola pasada del modelo; toca una para excluirla; intensidad. Capa nueva.
- El worker de IA admite modelos partidos en trozos (`parts`), para alojar en GitHub archivos
  de más de 100 MB.

- **Profundidad Premium 👑** (Inteligencia Artificial › Profundidad y cajón), con Depth Anything
  V2 Small (Apache 2.0, convertido a fp16: 50 MB servidos por la web, descargados al usarlo con
  aviso y guardados en IndexedDB). El mapa se amplía y se ajusta a los bordes de la foto con un
  filtro guiado:
  - **Desenfoque por profundidad**: toca dónde enfocar (por defecto, el sujeto que sobresale del
    fondo); 6 capas de desenfoque en luz lineal con convolución normalizada (sin halos),
    bokeh en las luces intensas y el grano original devuelto. Capa nueva.
  - **Niebla por distancia**: densidad, inicio y color (automático, blanca, cálida, fría), en
    luz lineal y tramada. Capa nueva.
  - **Foto 3D**: paralaje en círculo, lateral o acercándose, con los huecos rellenos con el
    fondo; se guarda como GIF (30 fotogramas, 720 px).
- **Iluminar foto oscura** (Ajustes › Automáticos y cajón), con versión Premium 👑: mapa de
  iluminación tipo LIME/Retinex con cantidad automática; Premium en luz lineal conservando la
  proporción de canales, mapa con filtro guiado, punto negro recuperado, ruido de color de las
  sombras limpiado y tramado. Capa de filtro que se reabre.
- **Enderezar automáticamente** (menú Imagen y cajón › Corregir): mide todas las líneas casi
  horizontales y casi verticales (nitidez de la proyección a 1024 px, cada 0,1°, afinado con
  parábola), exige que las dos familias coincidan o que una domine con claridad y que haya
  tramos rectos continuos (no texturas); si no está claro, no propone nada. Vista previa con
  cuadrícula y deslizador para afinar antes de aplicar; sin esquinas vacías.
- **Recorte inteligente para redes Premium 👑** (Inteligencia Artificial › Encuadre): 7 formatos
  (Instagram 1:1 y 4:5, historias 9:16, YouTube/X 16:9, Facebook/LinkedIn 1,91:1, Pinterest 2:3,
  retrato 3:4); mapa de importancia con U²-Net y YuNet; gana el recorte que conserva más, no
  corta caras ni el sujeto, deja el sujeto en los tercios y es el mayor posible. Se arrastra
  para afinar.

### Cambiado
- Inteligencia Artificial: nueva sección **Encuadre** (Recorte inteligente y Recorte de retrato).

### Añadido
- **Caras Premium 👑** (Inteligencia Artificial › Caras y su pestaña del cajón), con YuNet
  (OpenCV Zoo, MIT, 232 KB, incluido en la web). Las caras se buscan en la imagen visible; en
  Premium, a dos escalas (640 px y teselas a 1280 px) para encontrar también las pequeñas:
  - **Difuminar caras**: óvalo ajustado a cada cara (toca una para excluirla), desenfoque,
    pixelado o relleno con intensidad; el desenfoque, en luz lineal sobre un pixelado previo y
    con ruido, no se puede revertir. Capa nueva.
  - **Retoque de cara**: BiSeNet (face parsing) separa piel, ojos, dientes y labios con bordes
    suaves; zona + intensidad: piel suavizada respetando bordes y con textura (luz lineal),
    ojos con más luz y detalle, dientes sin amarillo, labios con más o menos color (OKLab).
    Capa nueva. Modelo de 53 MB servido por la web y guardado en IndexedDB; entrenado con
    datos de uso no comercial (anotado para retirarlo si Premium pasa a ser de pago).
  - **Ojos rojos**: sólo el rojo conectado con la pupila, corregido en luz lineal sin tocar el
    reflejo. Capa nueva.
  - **Recorte de retrato**: abre Recortar con el marco encuadrado en la cara (ojos en el
    tercio superior, cabeza y hombros; 4:5 si el formato era libre).

### Añadido
- **Selección con un toque Premium 👑** (menú Inteligencia Artificial › Seleccionar y su
  pestaña del cajón): toca un objeto y la IA (Segment Anything: MobileSAM + decodificador de
  SAM) lo selecciona entero; más toques añaden partes y «Quitar» (o Alt / Mayús + clic)
  las excluye; deshacer y rehacer por puntos. Procesado Premium al aplicar: máscara de la IA
  ampliada con suavidad a la resolución de la foto, sin manchas sueltas ni agujeros pequeños
  y con el borde ajustado a los contornos reales (filtro guiado).
- **Borrador mágico Premium 👑** (Inteligencia Artificial › Borrar y rellenar): toca lo que
  quieras quitar y LaMa rellena el hueco en una capa nueva; la zona se agranda para llevarse
  el halo, la costura se funde en luz lineal y se devuelve el grano de la foto al relleno.
- **Base para modelos de IA**: los modelos grandes servidos por la propia web (SAM, 45 MB)
  también avisan del tamaño antes de bajarse y se guardan en IndexedDB; los que trabajan
  juntos se piden con un solo aviso y conviven en memoria. **Ayuda › Diagnóstico** muestra si
  hay WebGPU y los modelos descargados, con lo que ocupan y un botón para borrarlos.

### Cambiado
- **Menú y pestaña «Inteligencia Artificial» ordenados por finalidad**: Seleccionar, Borrar y
  rellenar, Mejorar y restaurar, y Para imágenes de IA. El cajón toma del menú el orden y los
  títulos, así que coinciden siempre en móvil y escritorio.

### Cambiado
- **Menú «Inteligencia Artificial»** (escritorio, tras Filtro; también en el menú del móvil) y
  **pestaña «Inteligencia Artificial»** en el cajón del móvil (la tercera, tras Básicos y
  Automáticos). Reúnen todas las herramientas de IA, en dos secciones:
  - **Herramientas con IA:** Eliminar fondo, Ampliar, Colorear y Expandir con IA, Reemplazar
    cielo, Seleccionar sujeto y cielo, Reducción de ruido con IA, Quitar artefactos JPEG con IA
    y Adaptive Photo Lens.
  - **Para imágenes de IA:** Realify, PurePixel, Unmark, Plausibilidad, Segunda opinión y
    Limpiar metadatos.

  Salen de Imagen, Selección, Filtro (Especiales y Ruido) y Análisis, y de las demás pestañas
  del cajón (siguen en «Todos» y en el buscador).
- La barra de menús de escritorio se aprieta un poco por debajo de 1100 px de ancho para que
  los once menús quepan.

### Mejorado
- **Los ajustes automáticos diagnostican la foto antes de corregirla** (nuevo
  `js/editor/autoanalysis.js`, común a Contraste, Niveles, Tono / Color y Mejora automática,
  normales y Premium 👑):
  - Dominante de color estimada con los bordes (gray-edge) y con grises iterativos, mezclados
    según la confianza. Verde/magenta y azul frío se corrigen casi del todo, el cálido sólo en
    parte, y mucho menos si la escena está dominada por un color intenso.
  - Negro y blanco sin estirar lo ya quemado, sin tomar brillos aislados como «blanco» y con
    la ganancia limitada (ruido); un fondo blanco teñido sí se neutraliza.
  - Exposición corregida sólo si está claramente mal (mediana fuera de L* 38-62); las escenas
    claras u oscuras a propósito se respetan.
  - Colores extremos («buscar colores oscuros y claros») y medios neutros por canal, sólo
    cuando esos extremos son casi grises (medido tras quitar la dominante general).
  - **Mejora automática Premium**: además fija negro y blanco, abre sombras de contraluz y
    recupera luces con detalle (Sombras / Iluminaciones Premium), no oscurece fondos blancos y
    protege la piel al subir el color.
  - En pruebas con 13 fotos degradadas (dominantes, subexpuestas, niebla…), el resultado desde
    la foto estropeada se parece mucho más al de la foto buena. Mejora automática Premium en
    subexpuestas: ΔE 10,4 → 1,6; con niebla: 5,8 → 3,7. Tono / Color en subexpuestas
    con dominante fría: 4,97 → 2,76. Y las fotos buenas se tocan menos: Niveles 5,8 → 4,7; Mejora automática
    5,9 → 5,3.

- **«Tono y color auto. Premium 👑»** en el cajón del móvil (pestañas Automáticos, Mejorar y
  Color, con corona) y **«Tono / Color automático Premium 👑…»** en Ajustes › Automáticos
  (escritorio y móvil): abre Tono / Color automático con el interruptor Premium ya encendido.
- **Submenú Ajustes › Automáticos** (primero de Ajustes, igual en escritorio y móvil, con iconos):
  reúne los siete ajustes automáticos, que antes estaban repartidos entre «Tono avanzado» y el
  final de Ajustes: Mejora automática (y Premium 👑), Tono / Color automático, Contraste
  automático (y Premium 👑) y Niveles automáticos (y Premium 👑).
- **Contraste automático Premium 👑** (menú Ajustes › Automáticos y cajón
  del móvil, en «Automáticos» y «Mejorar», con corona): el mismo recorte del 0,2 % de la
  luminancia, pero aplicado como Niveles maestros Premium: estira la intensidad de cada color en
  coma flotante, sin sobresaturar ni cambiar el tono, con gama y tramado. Queda como capa de
  Niveles reeditable.
- **Tono / Color automático Premium 👑** (interruptor en el propio ajuste, mismos mandos): en
  modo Tono el estiramiento y los medios van a la intensidad de cada color (un naranja ya no se
  quema a 248/89/0); en modo Color cada canal se sigue estirando por separado. «Ajustar colores
  neutros» mide los grises ya ajustados en luz lineal y corrige con una ganancia por canal
  (balance de blancos, 75 %, con topes) en vez de sumar un desplazamiento que teñía los negros.
- Curvas (escritorio): «Automático» va en su propia fila y «Restablecer canal» y «Restablecer
  todo» ya no salen cortados.

- **Pestaña «Automáticos» en el cajón de herramientas** (móvil), la segunda tras «Básicos»: reúne
  todos los ajustes automáticos (Automático, Auto Premium 👑, Tono y color auto., Contraste auto.,
  Niveles auto. y Niveles auto. Premium 👑), que siguen también en «Mejorar».
- **Curvas y Niveles Premium 👑** (`js/editor/tonepremium.js`): coma flotante sin los redondeos
  intermedios de las tablas de 8 bits; la curva o los niveles MAESTROS (RGB) se aplican a la
  intensidad de cada color y no canal a canal, así que una curva en S ya no cambia el tono (de
  2-4° en el modo normal a 0-0,2°) ni sobresatura; curva de Luminosidad en luz lineal; mapeo de
  gama y tramado. Los de cada canal siguen siendo canal a canal. Vista previa con tabla de 33³
  colores; el resultado final, exacto.
- **Automáticos**: el botón «Automático» de Niveles en Premium mide los colores más oscuros y
  más claros de la foto (el 0,1 % de cada extremo) y ajusta los tres canales y los medios de una
  vez (neutraliza dominantes; una foto azulada pasa de 98/110/143 a 110/113/118 de media). Nuevo
  **«Niveles automáticos Premium 👑»** (menú Ajustes, junto a «Niveles automáticos», y cajón del móvil, con
  corona): lo mismo de un toque, como capa de Niveles reeditable. **Curvas** gana un botón
  **«Automático»** («Auto» en el móvil): negro, blanco y medios; en Premium también neutraliza
  las dominantes por canal.
- En Curvas el interruptor Premium va arriba a la izquierda, junto a ✕; en Niveles, a la
  izquierda de Cancelar/Aplicar.

### Añadido
- **Sombras / Iluminaciones Premium 👑** (con Radio y Tono): el entorno de cada píxel se mide
  con un filtro guiado sobre L* que no cruza los bordes, así que una silueta oscura contra un
  cielo claro ya no queda con una banda oscura arriba y una neblina abajo, como en el modo
  normal; radio relativo al tamaño de la imagen (la vista previa reducida y el resultado final
  coinciden); la corrección va a la base y la textura se conserva y refuerza hasta un 35 % donde
  se abren sombras o se recuperan luces; transiciones en S; color en luz lineal con mapeo de
  gama y tramado. En el móvil, el interruptor a la izquierda de Cancelar/Aplicar.

### Cambiado
- **Brillo y contraste Premium, rehecho**: el anterior se distinguía poco del normal y, cuando
  se notaba, parecía artificial (textura realzada, aspecto «HDR»). Ahora la curva se aplica a la
  intensidad de cada color (media de potencias de R, G y B) en vez de a la luminancia, y los tres
  canales se escalan por igual: los colores intensos no se desaturan al aclararse y el cielo
  sigue azul donde el modo normal lo lleva casi a blanco. La textura sólo se recupera en parte
  (la mitad de lo que la curva aplanaría, nunca más que la original, base de filtro guiado ancho)
  y nada al bajar el contraste; los bordes duros quedan limpios (±2 niveles).

### Añadido
- **Auto Premium 👑** en el cajón de herramientas del móvil (y en Ajustes › Tono avanzado ›
  «Mejora automática Premium»): mejora de un toque con los motores Premium. Balance de blancos
  en luz lineal estimado con los píxeles casi neutros (o «shades of gray»), corregido al 75 % y
  con topes para no borrar una luz cálida buscada; color con más croma cuanto más apagado (sin
  tocar los colores ya intensos), en OKLab con mapeo de gama y tramado; y luz con Brillo y
  contraste Premium a partir de los percentiles de L*. Los valores medidos se guardan en su capa
  de filtro («auto-premium»), así que volver a calcularla da el mismo resultado.

### Cambiado
- **Cajón de herramientas (móvil)**: se quita el botón grande «Automático» de la cabecera. En su
  lugar, «Automático» y el nuevo «Auto Premium» (dorado y con la corona) van primero en la
  rejilla y resaltados: fondo y borde de color e icono dentro de un círculo. «Mejora automática»
  también en Ajustes › Tono avanzado, para que el menú sea el mismo en móvil y escritorio.

### Añadido
- **Brillo y contraste Premium 👑**: la curva se aplica a la base de la imagen (filtro guiado
  rápido, que suaviza sin cruzar bordes) y la textura se conserva con al menos su amplitud
  original. Con contraste +80 la textura de las luces quedaba al 59 % en el modo normal; en
  Premium se conserva entera (con brillo +60, del 57 % al 100 %). Sin halos apreciables (2-4
  niveles en el píxel pegado a un borde duro) y −100 sigue dejando la imagen plana. El resto,
  como el motor normal: tono conservado, mapeo de gama en OKLab y tramado.
- **Equilibrio de color Premium 👑**: zonas por luminosidad percibida (OKLab), cada mando empuja
  hacia su primario en el plano de color de OKLab (calibrado para empujar lo mismo que el modo
  normal), «Conservar la luminosidad» exacta (±0,002 en L), negros sin manchar, mapeo de gama y
  tramado.
- Motor de color Premium común para los ajustes que transforman cada color por separado
  (`js/editor/premiumcolor.js`, lo usan Tono y saturación y Equilibrio de color). En ambos
  ajustes el interruptor va, en el móvil, a la izquierda de Cancelar/Aplicar.

### Cambiado
- **Interruptor Premium 👑 en el móvil**: ya no ocupa una fila propia. Va en la barra del botón
  de aplicar, alineado a la izquierda, siempre con la palabra «Premium» junto a la corona e
  idéntico (mismo tamaño y estilo) en todos los plugins: en Tono y saturación, a la izquierda de
  Cancelar/Aplicar; en la Fusión HDR y el revelador RAW, arriba a la izquierda junto a ✕. Las
  hojas de ajuste compactas del móvil ocupan menos alto (Tono y saturación: de 227 a 195 px),
  para que la imagen tenga más sitio. En escritorio no cambia nada (`dockPremium` en
  `js/ui/premium.js`).

### Añadido
- **Tono y saturación Premium 👑**: interruptor con corona en el ajuste. Mismos mandos, motor
  en OKLCh, luz lineal y coma flotante: al girar el tono se conserva la luminosidad percibida
  (en el modo normal un amarillo girado a azul pasaba de 0,58 a 0,11 de luminancia; en Premium
  se queda en 0,57), la saturación trabaja sobre el croma, Luminosidad apaga el color al
  acercarse al blanco o al negro, Colorear conserva la luminosidad de cada píxel, mapeo de
  gama sin recortar canales y tramado al volver a 8 bits. Vista previa en vivo con una tabla de
  33³ colores interpolada en luz lineal; el resultado final se calcula color a color
  (`js/editor/hslpremium.js`). Apagado, el ajuste es idéntico al de siempre.

### Corregido
- **Los desplegables ya no aparecen abiertos al abrir un ajuste en el iPhone**: el diálogo
  daba el foco a su primer mando y, en iOS, enfocar un desplegable lo despliega (pasaba en Tono
  y saturación y en cualquier ajuste con desplegable). En pantallas táctiles el foco va ahora a
  la propia ventana; los desplegables aparecen siempre cerrados.

### Corregido
- **Balance de blancos sin miniatura**: se quita la vista previa que abría la herramienta (y su
  capa de ajuste). Actúa sobre la imagen abierta en tiempo real con la misma interfaz mínima
  que los demás ajustes (en el móvil, un desplegable Temperatura/Tinte y su deslizador), y el
  **Cuentagotas** se usa tocando directamente la imagen abierta.
- **Más sitios donde el teclado del móvil tapaba lo que escribías**: revisados todos los campos
  de texto. Estaban tapados el texto de **Memes**, los textos de **Collage / History / Post**,
  las semillas de **Cámara** (Realify), los campos del grupo Motor del **revelador RAW** y el
  cuadro de la herramienta **Texto** cuando está en la parte de abajo de la foto. Ahora los
  editores a pantalla completa terminan donde empieza el teclado (su pie queda a la vista) y,
  con la herramienta Texto, la imagen sube lo justo para ver el cuadro y vuelve al cerrar el
  teclado (`js/ui/keyboard.js › installKeyboardFit`).

### Añadido
- **Diálogos usables con el teclado del móvil**: al escribir en un diálogo (las medidas de
  «Documento nuevo», un nombre, un número…), la hoja sube y se apoya encima del teclado en vez
  de quedar tapada, y el campo activo se mantiene a la vista; al cerrar el teclado vuelve a su
  sitio. Mismo arreglo que el buscador del cajón de herramientas, ahora compartido
  (`js/ui/keyboard.js`).
- **Cuentagotas de punto blanco** en todo lo que tiene balance de blancos: tocas algo que deba
  ser blanco o gris y la temperatura y el tinte se calculan para dejarlo exactamente neutro.
  - **Revelador RAW / Revelado fotográfico** (normal y Premium 👑): botón sobre la vista
    previa; lee la foto en luz lineal antes de revelar, en el espacio donde se aplica el
    balance (Rec.2020 en Premium) y, si la dominante no cabe en los mandos, elige también el
    preajuste de balance más cercano.
  - **Balance de blancos** (plugin) y su **capa de ajuste**: botón «Cuentagotas» visible (antes
    había que saber que se podía tocar la miniatura), media de 5×5 píxeles en vez de uno, marca
    en el punto elegido y cálculo exacto (antes quedaba casi, pero no del todo, gris). La capa
    lee lo que hay debajo de ella.
  - **Fusión HDR** (normal y Premium): Color › «Cuentagotas de balance de blancos»; se lee la
    imagen mapeada antes del acabado.
- **Buscador del cajón de herramientas usable con el teclado del móvil**: al escribir, el cajón
  sube y se apoya encima del teclado (antes el teclado tapaba los resultados); la tecla
  «Buscar» cierra el teclado y deja los resultados a pantalla completa; al cerrar el teclado o
  elegir una herramienta, el cajón vuelve a su tamaño normal. Android e iPhone.
- **Barra de grabación de acciones flotante**: se arrastra por el asa ⠿ o por el texto a
  cualquier sitio de la pantalla (ratón o dedo) para dejar libre la barra superior; recuerda la
  posición y no se sale de la pantalla al girar el móvil o cambiar el tamaño de la ventana.

### Corregido
- **Actualizaciones que no llegaban**: tras publicar, el móvil podía seguir usando durante horas
  archivos antiguos (p. ej. los del Filtro Vintage) guardados en la caché del navegador. El
  service worker ahora pregunta siempre al servidor si hay versión nueva antes de usar la copia
  guardada (sin conexión sigue funcionando igual).
- **Filtro Vintage · hoja de marcos**: todas las miniaturas del mismo tamaño y alineadas en su
  rejilla (antes algunas se salían de la tarjeta en el móvil), nombres de dos líneas como
  máximo, miniaturas más nítidas en pantallas de alta densidad y el selector de categoría
  sigue al desplazamiento.

### Añadido
- **Filtro Vintage: 119 marcos y 113 estilos nuevos**. Nuevo desplegable **Marco** (escritorio y
  móvil) que abre una hoja con la miniatura de cada marco sobre la propia foto, en 10 categorías:
  instantáneas, película (35 mm, 120, súper 8, diapositivas, limados), papel antiguo (barbado,
  festoneado, albúmina, gabinete, paspartús), marcos de cuadro (dorados, plata, maderas, laca,
  art déco), postales y sellos, viñetas y formas (óvalos, camafeo, cerradura, corazón…),
  pantallas y visores (televisor, VHS, videocámara, telémetro…), desgaste (quemado, agua,
  grunge, moho), decorativos (encaje, greca, neón, azulejo…) y álbum (esquinas, washi, clip).
  «Anchura del marco» en el grupo Bordes. 215 estilos en 19 categorías; 11 categorías nuevas
  (laboratorio, cine clásico, viajes y postales, retratos antiguos, instantáneas, álbum de
  familia, noir, pop y psicodelia, tecnología retro, galería y museo, papel y archivo) y 87
  estilos que ya traen su marco (`vintagefilter/frames.js`).
- **Aviso de móvil en horizontal**: en un teléfono (Android o iPhone) girado, un aviso explica
  que Realify está optimizado para el móvil en vertical y que la versión de escritorio es para
  ordenador. Desaparece al volver a vertical; «Seguir en horizontal» lo oculta hasta cerrar la
  pestaña. No sale en tabletas ni ordenadores (`js/ui/landscape.js`).
- **Borrar guías más fácil**: doble clic o doble toque sobre una guía la borra (antes sólo
  arrastrándola hasta la estrecha franja de la regla, incómodo con el dedo). «Borrar guías»
  también en el cajón de Herramientas del móvil, con su icono. Tocar una guía sin moverla ya
  no deja un paso vacío en el historial.
- **Fusión HDR Premium 👑**: interruptor con corona en la ventana del HDR, mismos mandos y
  estilos. Curva de respuesta de la cámara estimada del horquillado (Robertson + polinomio
  suave, o sRGB si no mejora), RAW fusionados en luz lineal Rec.2020 con su nivel de recorte,
  fusión de máxima verosimilitud (menos ruido y sin el sesgo de las sombras profundas),
  alineación con fracción de píxel (Lucas–Kanade), antifantasmas por zonas que también ve el
  color, tono y color en OKLab con tramado, y exportación a **TIFF 16 bits** y radiancia
  **.hdr**. Apagado, el HDR sale idéntico al de antes. Pruebas en `hdr/tests/premium.mjs`.
- **Revelado RAW Premium 👑**: interruptor con corona en el revelador (también en Revelado
  fotográfico). Mismo revelador y mismos mandos, motor de alta calidad: Rec.2020 sin recortar
  colores, demosaico DHT, luz lineal real en coma flotante, sombras/altas luces/claridad con
  filtros guiados sin halos, curva fílmica que lleva las luces al blanco sin quemarlas, ruido de
  color guiado, color en OKLab con ajuste de gama que conserva el tono, tramado, reducción en
  luz lineal con enfoque de salida y **TIFF de 16 bits**. Vista previa en GPU con la misma
  matemática que el resultado (ΔE < 0,4). Apagado, el revelador queda exactamente como antes.
  Componentes reutilizables de corona e interruptor Premium (`js/ui/premium.js`); aún sin pago.
- **Capas a pantalla completa en el móvil** (cualquier orientación): la imagen lo más grande
  posible, barra superior con cerrar, nueva, duplicar, eliminar, deshacer y rehacer, y una
  lista que deja ver dos capas y se desplaza. Tocar la imagen sólo la mueve o amplía. El botón
  fx/adj abre su editor encima sin cerrar Capas. Ya no se vuelve transparente la hoja al
  mover un deslizador. En escritorio no cambia nada.
- **Android: «Abrir» va directo a la galería** (el selector pide sólo imágenes; con
  extensiones añadidas, Android mostraba «Cámara / Archivos»). Nuevo **Archivo › Abrir RAW,
  PSD, TIFF o SVG…** (y enlace en la pantalla de inicio) para esos formatos, que no salen en
  la galería. En la Fusión HDR, el «+» ofrece Galería o Archivos.
- **Transparencia al guardar, en toda la web**: casilla «Conservar la transparencia» y color
  de fondo en Exportar, Exportar como, Editar en lote, Acciones y Cortar en partes
  (`js/io/alpha.js`). Se guarda el acoplado de las capas visibles; PNG, WebP, AVIF y GIF
  conservan la transparencia y JPEG/PDF rellenan con el color elegido. Con transparencia,
  Exportar propone PNG.
- **Recortar en forma** recorta sólo la capa activa, oculta las demás capas y avisa de cómo
  guardar con transparencia (con botón para exportar).
- **Fusión HDR, máximo de 11 fotos con aviso**: si se eligen más, un diálogo deja escoger
  cuáles (contador «9 de 11», no deja pasar del límite) antes de abrir ninguna; con 11 el
  botón de añadir lo indica y explica cómo liberar sitio. Las fotos con otra proporción
  u orientación se descartan de una en una, con aviso, sin rechazar las demás.
- **Fusión HDR con RAW**: revelar la primera y aplicar los mismos ajustes a todas,
  revelar una a una en el revelador RAW o usar su JPEG incrustado; la exposición sale
  de los metadatos del RAW.
- **Fusión HDR con las fotos abiertas**: elige, con miniaturas, las pestañas abiertas
  y entran tal como las estás editando.
- **Fusión HDR**: ordenar las fotos arrastrándolas (ratón, o mantener pulsado con el
  dedo); la exposición sigue al orden. EV contados desde la foto normal (−2 / 0 / +2).
- **Fusión HDR**: «Foto elegida» es el primer grupo (escritorio y móvil), con la
  exposición en tercios de paso, botones − / + y **Pasos entre fotos** para todo el
  horquillado de golpe; grupos ordenados según el flujo de trabajo y tira de fotos
  más cómoda en el móvil.
- **Guía actualizada** con todo lo nuevo: tiradores, cerrar todas las fotos, editar
  en lote, antes y después, hoja de contactos, GIF, AVIF y PDF, acciones, paleta,
  cuentagotas de pantalla y zoom con el efecto abierto.
- **Tiradores más fáciles de agarrar**, sobre todo con el dedo (`js/editor/grab.js`):
  zona de agarre mayor en táctil y lápiz, tiradores más grandes, gana el más cercano
  cuando se solapan y no saltan bajo el dedo al cogerlos. En Recortar, Transformar,
  Deformar, Perspectiva, formas, marco y trazado del texto, pluma, guías, Formas,
  Cortar y Galería de desenfoque.
- **Cerrar todas las fotos**: en Archivo, en Herramientas y en la barra de pestañas;
  una sola confirmación.
- **Fusión HDR** (`hdr/`): hasta 11 fotos, horquillado detectado solo, alineación,
  antifantasmas, fusión de exposición y mapeo tonal con 17 estilos.
- **Unir imágenes** (`unir/`): panorámica automática y unión en fila, columna o
  cuadrícula.
- **Cortar en partes** (`cortar/`) y **Recortar en forma** (`formas/`, ~60 formas)
  a pantalla completa, sustituyen a «Dividir en trozos» y al diálogo anterior.
- **Antes y después** (`comparar/`) y **Hoja de contactos** (`hojacontactos/`).
- Exportar en **AVIF** y **PDF**; **GIF animado** a partir de las capas.
- **Paleta de colores** y **cuentagotas de pantalla**.
- **Acciones**: grabar y repetir secuencias de comandos, también en lote.
- **Editar en lote / Aplicar esta edición a otras fotos** (`lote/`): edita una
  foto y copia su edición (ajustes, filtros, textos, marcas de agua) a otras
  pestañas o fotos de la galería, con vista previa, **igualado de exposición**
  y resultado en sus pestañas (capas reeditables) o en un ZIP.
- Capa de ajuste **Exposición** (en pasos EV).
- IA: **ampliar** ×2/×4, **colorear** y **expandir** el lienzo.
- Zoom y desplazamiento de la imagen mientras se aplica cualquier efecto.
- Aviso visible con botón Cancelar mientras trabaja la IA; si un modelo pesado
  agota la memoria y la página se recarga, la imagen se recupera.

### Cambiado
- **Brillo y contraste de precisión** (filtro y capa de ajuste): cálculo en coma flotante
  sobre la luminosidad percibida (L*) en lugar de una tabla de 8 bits canal a canal. El
  contraste es una curva en S alrededor del gris medio que fija el negro y el blanco (antes
  una recta que, a +50, ya recortaba las luces por encima de 215 y las sombras por debajo
  de 40); el brillo mueve los medios tonos sin recortar. El color se escala en luz lineal y,
  si no cabe, se reduce el croma en OKLab: el tono se desvía 0,2° de media (antes 5–9°, y
  hasta 70°). Los ajustes guardados siguen valiendo (mismos −100..100).
  Además: **tramado** fino y fijo al volver a 8 bits (disuelve las bandas en cielos y
  degradados), **pivote automático** sobre la luminosidad media de la foto (el contraste
  ya no oscurece las fotos oscuras ni aclara las claras; opción «Gris medio»), mando de
  **Protección de luces y sombras** y casilla **Usar heredado** con el cálculo antiguo.
- **Eliminar fondo** crea una capa nueva con el recorte y oculta la original.

### Eliminado
- «Procesar carpeta» (y el botón «Abrir lote» del inicio): sólo aplicaba el
  filtro Realify con variaciones; lo sustituye «Editar en lote».

### Corregido
- Escritorio: en los menús de herramientas agrupadas de la barra izquierda (mantener pulsado o
  clic derecho) los iconos y nombres salían centrados; ahora van alineados a la izquierda.
- **Revelador RAW, luz lineal real**: el motor (LibRaw-Wasm) entrega los datos con la curva
  BT.709 aunque se le pida lineal, y el revelado los trataba como lineales: todo salía más
  claro y los ajustes de exposición, balance y tono trabajaban sobre valores equivocados.
  Ahora se deshace esa curva exactamente, en la vista previa, el resultado y el balance
  automático (con +0,3 EV de exposición base, como las cámaras): el gris medio queda en
  ~130/255, igual que en Premium. Los RAW revelados antes se verán algo más oscuros.
- Aviso de versión nueva: con el service worker bloqueado (navegación privada, políticas de
  empresa) lanzaba un error a los 5 s y cada 30 minutos. Era lo que hacía fallar la prueba
  `raw/tests/editor-transition.mjs`, que ahora pasa.
- Revelador RAW: en el menú del motor, «Rec.2020» y «DCI-P3» estaban intercambiados; la
  cabecera mostraba «[object Object]» en lugar del objetivo.
- «Editar en lote» (pantalla de inicio) necesitaba dos pulsaciones en el móvil: el selector
  de fotos se abría después de descargar el código del lote y el navegador ya no lo
  permitía. Ahora se abre en el mismo toque; igual en Cortar y Recortar en forma sin
  documento, en Acciones en lote e importar acciones, y al añadir fotos en el HDR.
- Exportar en JPEG una imagen con zonas transparentes las volvía negras; ahora se rellenan
  con el color de fondo elegido (blanco por defecto).
- Fusión HDR con horquillados largos (hasta 11 fotos, ±5 EV): la alineación fallaba en
  las tomas extremas (hasta 43 px de error, y el resultado salía muy recortado). Ahora
  combina tres métodos y dos criterios: error máximo de 2 px en las pruebas. Menos
  memoria al cargar muchas fotos, progreso «Alineando · k de n» y, en el móvil, copia
  de seguridad de las fotos abiertas por si la página se cierra.
- Los diálogos y avisos quedaban detrás de los editores a pantalla completa (HDR,
  Unir, Cortar, Formas…).
- Fusión HDR: el resultado se abre siempre como una foto nueva (pestaña propia,
  historial vacío). Si la imagen abierta era del horquillado, antes se añadía como capa
  encima y Comparar enseñaba la foto original en vez del HDR.
- Comparar: tras crear un HDR (o cualquier resultado que se abre en una pestaña
  nueva) el «antes» salía vacío, y al cambiar de pestaña se perdía y pasaba a ser la
  propia edición. Ahora cada pestaña guarda su «antes». Al cerrar la foto con Comparar
  activo, la comparación se quedaba pintada sobre la pantalla de inicio.
- Fusión HDR: con − / + la foto elegida saltaba de sitio en la lista; el EXIF sin
  diafragma ya no obliga a estimar la exposición por el brillo.
- Fusión HDR: la exposición de una foto no se veía hasta soltar el deslizador; ahora
  cambia en tiempo real. Se lee el EXIF de HEIC, PNG y WebP, y la estimación sin EXIF
  iguala los pasos del horquillado.
- Transformar: al estirar una esquina rápido, la esquina opuesta se movía y el
  tirador se quedaba atrás; con la capa ya movida, escalar la hacía saltar.
- ISNet recibía la imagen sin normalizar y devolvía máscaras casi uniformes.
- Rasterizar un texto mientras se editaba dejaba un error al cerrar la edición.
- El despliegue reintenta la conexión SSH si el servidor la corta.

### Añadido
- **Aviso de versión nueva**: al volver a la app (y cada 30 minutos) se
  comprueba si hay una versión publicada; si la hay, una barra ofrece
  «Actualizar», que guarda todas las pestañas abiertas, recarga y las reabre.

### Cambiado
- **Tipografías sin Google**: todo el catálogo de Google Fonts (1908 familias)
  se sirve desde el propio sitio, en `/fonts/`. El navegador ya no se conecta
  con Google, desaparece el aviso de permiso y las fuentes funcionan sin
  conexión. La herramienta Texto tiene un buscador con vista previa
  («Más fuentes (buscar entre 1900)…»).

### Añadido
- Documentación del repositorio: guía de contribución, código de conducta,
  política de seguridad, plantillas de issues y pull requests, y este registro
  de cambios.

## 2026-09-27

### Añadido
- **Collage / History / Post**: collages, publicaciones e historias para redes
  sociales, con 40 diseños, formatos de más de 29 redes, proporciones y
  pantallas de móviles, zonas seguras, diseño «Libre» y 28 formas para las
  fotos.
- **Creador de memes**: 26 diseños, segunda foto, efectos de imagen y textos
  con 29 tipografías y 26 estilos rápidos.
- **Stickers**: 1.595 emojis de Fluent Emoji en cuatro estilos, con tonos de
  piel y búsqueda en español e inglés.
- **Filtro Vintage avanzado**: 41 parámetros en 7 grupos y 102 estilos.
- **Estilos**: 160 looks en 16 categorías, con buscador y miniaturas.
- **Curvas** con canal de luminosidad, vista R · G · B y 25 estilos.
- **Tonos del histograma** e **histograma interactivo** en el panel lateral.
- **Cuadrícula inteligente** con detección de sujeto, horizonte y rostros, y
  propuesta de recorte.
- **Pinceles especiales**: simétrico, con textura y de degradado.
- **Dividir en trozos** (carrusel e Instagram) y **recortar en forma**.
- Remuestreo Lanczos 3, Mitchell y Catmull-Rom.
- Tramado opcional a 8 bits al exportar.
- README con todas las funcionalidades de la web.

### Cambiado
- **Revelado RAW**: flujo lineal de 16 bits, nuevo modelo tonal y controles
  mejorados.
- Filtros con alternativa en CPU cuando falla la GPU.

### Corregido
- Correcciones en varios filtros.
