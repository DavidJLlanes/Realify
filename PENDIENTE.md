# Pendiente

Trabajo acordado para más adelante, organizado en **fases numeradas** que se hacen en orden.
Cada fase es corta y se publica sola. Al terminar una tarea se marca `[x]` con la versión
(p. ej. `[x] … (v199)`); al terminar una fase, se marca como hecha en su título.

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

## Resumen de lo pendiente (actualizado en la v244, 5 oct 2026)
Las fases 1 a 20 están hechas o evaluadas; lo que sigue son los restos de cada una (el detalle está en su fase).

**Depende del titular**
- [x] Receptor de informes de error instalado en el VPS (fase 18, 5 oct 2026): servicio `informe` activo, nginx con
      `/api/informe` (snippet `realify-informe.conf` y `limit_req`) y prueba pública `{"ok": true}`; los informes llegan a
      `djl@djl.red` (el correo se entrega en local en el mismo servidor, así que SPF/DKIM/DMARC de realify.es sólo harían
      falta si algún día se envían a otro proveedor). Falta probarlo una vez desde Ayuda › Informar de un error…
- [ ] Permitir `huggingface.co` en el entorno de desarrollo (Network access › Custom › Allowed domains) para poder hacer el
      vocabulario abierto de «Seleccionar por texto» con CLIPSeg (fase 20).

**Bloqueado**
- [ ] Exportar HEIC (fase 16): no hay codificador HEVC en WASM con licencia/patentes aceptables. AVIF lo cubre.

**Fase 20 · cabos sueltos**
- [ ] Vocabulario abierto de «Seleccionar por texto» (CLIPSeg; ver arriba).
- [ ] Ajustes sin migrar a coma flotante: Sombras y luces, Tono, Banda tonal, Color selectivo, Equilibrio de color, Mapa de
      degradado, Blanco y negro, los de `applyDirect` y los modos Premium con motor propio.
- [ ] Capas con origen de 16 bits recortado o desplazado.
- [ ] CLAHE Premium: la vista previa difiere de lo aplicado.
- [ ] Límite de memoria con imágenes de 12 y 24 MP.

**Color y exportación (fases 2 y 6)**
- [ ] WebP con perfil P3 y TIFF de 8 bits con perfil.
- [ ] Herramientas WebGL en P3 (hoy recortan a sRGB).
- [ ] «Abrir en Realify» desde el revelador RAW en P3.

**IA (fases 3, 5 y 10)**
- [ ] Eliminar fondo (U²-Net, MODNet, ISNet) también por bloques o con refinado.
- [ ] Máscara por profundidad como capa de ajuste «viva».

**RAW (fase 4)**
- [ ] Revelado RAW sin Premium (motor GPU de 8 bits) y RAW en Display P3.

**Fotos, apilado y lente (fases 7, 8 y 9)**
- [ ] Usar la alineación subpíxel en Fusión HDR y Unir imágenes.
- [ ] Apilar RAW directamente; ordenar las tomas por nitidez y usar el análisis de nitidez para elegir la referencia.
- [ ] Documentos: mejora del fondo (aclarar el papel, blanco y negro) y varias páginas.
- [ ] Perspectiva automática con diagonales y puntos de fuga horizontales.
- [ ] Lente: móviles y cámaras sin objetivo en la base, modelos «acm» y viñeteo ACM, recorte del propio archivo; aplicarlo a RAW
      antes del revelado y en lote.

**16 bits, precisión y rendimiento (fases 11 a 14)**
- [ ] Realify (simulación de captura), Filtro Vintage y Revelado fotográfico siguen con salida de 8 bits.
- [ ] Coma flotante «de verdad» (no por delta) para desenfoque, enfoque y ruido.
- [ ] Estilos de capa y trazo en curso (pincel, borrador) en la vista previa de GPU.
- [ ] WebGPU como alternativa; caché de texturas por capa; documentos grandes por mosaicos.
- [ ] Redimensionar con 16 bits; perspectiva, enderezar y otras operaciones que remuestrean capas siguen soltando los 16 bits.
- [ ] El autoguardado periódico no lleva los 16 bits.
- [ ] Capas y máscaras en 16 bits/float propios.
- [ ] Procesado «lazy» por bloques inspirado en libvips.

**Metadatos (fase 15)**
- [ ] Metadatos al exportar en AVIF, JPEG XL, TIFF y PDF (hoy JPEG, PNG y WebP).
- [ ] Copiar MakerNote e IPTC en PNG/WebP; XMP extendido de JPEG; metadatos de originales no JPEG.
- [ ] Editar los metadatos antes de exportar.
- [ ] Mostrar la procedencia C2PA en el inspector.

**PSD/PSB y PDF (fases 16 y 17)**
- [ ] PSD: objetos inteligentes, texto nativo editable, resto de capas de ajuste (brillo, tono, balance de color…), «Fusionar si»,
      capas de 16 bits con capas, metadatos XMP/EXIF, abrir PSD de 16 bits conservando los 16 bits, más opciones de estilos.
- [ ] PDF: una página por capa/artboard, PDF/X (CMYK e intención de salida), marcas de recorte dibujadas, fuentes propias en la
      portada, fondo a elegir para imágenes con transparencia en JPEG, ordenar/quitar las imágenes añadidas.

**Evaluado y descartado**
- Pica y Photon (fase 19), cuantizar modelos a INT8/Q4, Fabric.js/TOAST UI como editor completo, Transformers.js como segundo motor,
  image-js como sustituto del pipeline y libvips completo (ver «Descartado y por qué»).

## Reglas que mandan en todas las fases

1. **⚠️ Máxima prioridad: ningún efecto puede pixelar la imagen.** Mantener la calidad está
   por encima de todo. En la v194, 58 de las 90 herramientas de Ajustes y Filtro dejaban la
   capa pixelada (corregido en la v195). En todo efecto, ajuste, filtro, función de IA o
   plugin, nuevo o modificado:
   - El resultado se calcula siempre a **resolución completa**. La vista previa reducida
     sólo vale mientras se mueve un mando; nunca puede quedarse en la capa, en el resultado
     aplicado ni en la exportación.
   - Al soltar un mando, recalcular a resolución completa si el cálculo es rápido
     (`runAdjust` en `js/editor/adjust.js` y `runFilter` en `js/filters/basic.js`).
   - Al montar los mandos de una capa (panel de Propiedades) no repintarla con la vista
     previa: ya tiene el resultado bueno.
   - Lo que se calcule a menor resolución (profundidad, máscaras, desenfoques) se compone
     con la foto original a tamaño real (como Desenfoque por profundidad, v192).
   - Nunca reducir la imagen al abrirla ni al exportarla salvo que el usuario lo pida.
2. **Comprobar cada herramienta que se modifique, una a una** (no todas):
   `node tests/calidad-herramienta.mjs <comando>` (el de su entrada de menú, p. ej.
   `adj.hsl`). Prueba en móvil y escritorio con una imagen de detalle fino de 3000 × 2000.
   Resultado APTO / APTO* (aviso) / FALLO; **no publicar con FALLO**.
3. **Nunca cambiar calidad por memoria o velocidad**: nada de cuantizar modelos a INT8/Q4
   (con GFPGAN, INT8 bajó a 27 dB); fp16/fp32 y la memoria se resuelve por bloques.
4. **Licencias**: los modelos de IA y bibliotecas nuevos deben permitir uso comercial
   (normas del proyecto), aunque el código de Realify sea PolyForm Noncommercial. LGPL y
   MPL sólo como módulos separados y sin modificar.

Origen: auditoría técnica externa (octubre de 2026, «Informe_Auditoria_Tecnica_Realify.pdf»)
revisada contra el código real, más lo hablado en las sesiones. Se han quitado las
propuestas que empeoran la calidad (ver «Descartado»).

---

## Fase 1 · Exportación sin bandas ✅ (v199)
- [x] `renderPrecisionAdjustmentStack` implementada (motor en `js/core/precision-stack.js`):
      capas, las 10 capas de ajuste, los 27 modos de fusión, máscaras, recortes y grupos en
      coma flotante; verificado contra el compositor normal. (v199)
- [x] Sin límite de 8 MP: por franjas, almacén de 16 bits; 32 MP en ordenador, 16 MP en
      móvil; reducción por áreas en luz lineal. (v199)
- [x] Exportar PNG y TIFF de 16 bits desde el editor (móvil y escritorio). (v199)

## Fase 2 · Color de gama amplia (ICC / Display P3) ✅ (v200)
Las fotos de iPhone y de muchos Android vienen en P3; hasta la v199 todos los lienzos eran sRGB.
- [x] Diagnóstico: el navegador recortaba a sRGB al abrir (rojo P3 puro → 234, 51, 35) y se
      exportaba recortado y sin perfil. Adobe RGB: el navegador lo convierte al decodificar
      y se trabaja en P3, que abarca casi toda su gama (salvo algunos verdes y cianes). (v200)
- [x] Detectar al abrir los colores fuera de sRGB y trabajar en Display P3 si el navegador
      lo permite (`js/core/colorspace.js`); proyecto y pestañas guardan el espacio. (v200)
- [x] Exportar con el perfil incrustado: JPEG, PNG, PNG 16 y TIFF 16 en P3, o sRGB a
      elección; el resto se convierte a sRGB. (v200)
- [x] AVIF con etiqueta P3 (fase 6, v229).
- [ ] Pendiente: WebP con perfil P3 y TIFF de 8 bits con perfil.
- [ ] Pendiente: herramientas WebGL en P3 (hoy recortan a sRGB; con la fase 13) y color de
      pintura en P3 (selector y cuentagotas fuera de sRGB).
- [ ] Pendiente: «Abrir en Realify» desde el revelador RAW en P3 (con la fase 4).

## Fase 3 · IA a resolución completa por bloques ✅ (v202)
Ampliar y colorear ya iban por bloques; el resto se calculaba reducido y se ampliaba.
- [x] Motor común de bloques (`js/ai/tiles.js`): solape, fundido con pesos, número de bloques
      según el motor (GPU o no). Ampliar, colorear y restaurar siguen con su troceado. (v202)
- [x] Profundidad por bloques alineados al mapa global; máscaras de cielo y persona por
      bloques en la franja dudosa del borde. (v202)
- [x] Caras (GFPGAN, retoque) a la resolución real del rostro. (v202)
- [x] Cancelar tareas de IA de varias pasadas y progreso uniforme (`aiSession`). (v202)
- [ ] Pendiente: Eliminar fondo (U²-Net, MODNet, ISNet) también por bloques o con refinado
      de borde a resolución completa.

## Fase 4 · Entrada de alta profundidad ✅ (v203)
- [x] «Abrir en Realify» desde el revelador RAW (Premium) sin bajar a 8 bits: la capa guarda
      los 16 bits del revelado. (v203)
- [x] Conservar los 16 bits de TIFF y PNG, y los 10/12 bits de AVIF, como origen de la capa
      base (`js/core/hisrc.js`, `js/io/hidepth.js`); la exportación en coma flotante los usa
      píxel a píxel donde la capa no se ha tocado. (v203)
- [ ] Pendiente: revelado RAW sin Premium (motor GPU de 8 bits) y RAW en Display P3.
- [ ] Pendiente: guardar el origen de 16 bits en el proyecto `.realify` y conservarlo al
      recortar o girar (hoy se descarta); el documento entero en 16 bits es la fase 14.

## Fase 5 · Profundidad como herramienta ✅ (v228)
Reutiliza Depth Anything V2 (ya estaban Desenfoque por profundidad, Niebla y Foto 3D).
- [x] Seleccionar por profundidad: primer plano, plano medio, fondo o intervalo manual,
      como selección o como máscara editable (`js/features/depthzones.js`). (v228)
- [x] Máscaras por distancia para cualquier ajuste local: Capa › Máscara de capa › Por
      profundidad y botón en las propiedades de la máscara, en capas de imagen y de ajuste. (v228)
- [x] Iluminación dependiente de la profundidad (Luz por profundidad) y separación de planos
      en capas (`js/features/depthlight.js`). (v228)
- [ ] Pendiente: máscara por profundidad como capa de ajuste «viva» (que se recalcule al
      cambiar la foto de debajo); hoy la máscara se calcula una vez.

## Fase 6 · Formatos modernos de alta calidad ✅ (v229)
- [x] Gestor de códecs WASM (cada uno se carga al elegir el formato) con estimación de
      peso y calidad antes de exportar. (v229)
- [x] AVIF de 10/12 bits, con etiqueta de color sRGB / Display P3 (también en el de 8 bits). (v229)
- [x] JPEG XL (exportar y abrir). Sólo 8 bits por límite del códec. (v229)
- [x] OpenEXR (luz lineal, half, ZIP, cromaticidades; escritor propio). (v229)
- Queda: JPEG XL de más de 8 bits; etiqueta P3 en WebP (el formato no la admite sin ICC).

## Fase 7 · Apilado de fotos (OpenCV.js, parte 1) ✅ (v230, con pendientes)
OpenCV.js (Apache-2.0, ~8–10 MB) sólo bajo demanda y como motor Premium; no sustituye lo
que ya funciona.
- [x] Carga bajo demanda de OpenCV.js (4.12; la 5.0.0 empaquetada no arranca en Chromium). (v230)
- [x] Alineación subpíxel (homografía ORB+RANSAC+ECC, flujo óptico opcional), también con
      movimiento. En Apilar fotos. (v230)
- [x] Reducción de ruido con varias tomas (image stacking). (v230)
- [x] Focus stacking. (v230) Mezcla por pesos de nitidez; queda la mezcla por pirámides
      laplacianas para zonas con halos.
- [ ] Usar esta alineación en Fusión HDR y Unir imágenes (hoy siguen con su propia
      alineación por traslación).
- [ ] Apilar RAW directamente y ordenar las tomas por nitidez para elegir la referencia.

## Fase 8 · Visión clásica (OpenCV.js, parte 2) ✅ (v231, con pendientes)
- [x] Corrección de perspectiva y detección de horizonte automáticas (botón Automático de
      Perspectiva; el horizonte ya lo hacía Enderezar automáticamente). (v231)
- [x] CLAHE (contraste local adaptativo), normal y Premium. (v231)
- [x] Análisis de nitidez (mapa de enfoque, mejor toma). (v231)
- [x] Detección y enderezado automático de documentos. (v231)
- [ ] Usar el análisis de nitidez para elegir la referencia en Apilar fotos.
- [ ] Documentos: mejora opcional del fondo (aclarar el papel, blanco y negro) y varias páginas.
- [ ] Perspectiva automática con líneas diagonales y puntos de fuga horizontales (fachadas vistas de lado).

## Fase 9 · Corrección de lente con perfiles reales ✅ (v233)
- [x] Base de perfiles por objetivo (distorsión, viñeteo y aberración): Lensfun, CC BY-SA 3.0
      (uso comercial permitido; hay que atribuir y compartir igual la base derivada, que va
      aparte del código: `assets/lensdb/`). (v233)
- [x] Aplicación automática según los datos EXIF de cámara y objetivo. (v233)
- [ ] Móviles y cámaras sin objetivo en la base (iPhone, Pixel…): sus perfiles no están en Lensfun;
      habría que medirlos o aceptar perfiles aportados por el usuario.
- [ ] Modelos de distorsión «acm» y viñeteo ACM; recorte del propio archivo (fotos ya recortadas).
- [ ] Aplicarlo a archivos RAW antes del revelado y en lote.

## Fase 10 · Selección por texto ✅ en parte (v234)
- [x] Selección por texto con vocabulario CERRADO: las 150 categorías de ADE20K del DeepLab que ya
      viaja con la web (Apache-2.0), con sinónimos en español, colores y «sin X». (v234)
- [x] Máscara editable resultante, a resolución completa (por bloques, fase 3, y borde guiado). (v234)
- [ ] (→ fase 20) **Vocabulario abierto** («una taza azul», «el pelo», «el logo»): hace falta un modelo tipo CLIPSeg
      o Grounding-DINO + SAM. No se pudo hacer: el entorno de desarrollo no llega a Hugging Face
      (proxy 403), así que no se puede descargar ni probar un modelo. Cuando haya acceso:
      CLIPSeg-rd64-refined en ONNX cuantizado (~150 MB, licencia Apache-2.0 a verificar) en el
      worker de IA, con tokenizador CLIP (vocabulario BPE), bajo demanda y avisando del tamaño.
- [x] «Pelo» y partes de la cara con BiSeNet (pelo, cara, piel, ojos, cejas, nariz, boca, labios, orejas, cuello, gafas,
      sombrero): el titular amplía la excepción de uso no comercial a esta función (no hace uso comercial). (v244)

## Fase 11 · Ajustes en coma flotante ✅ en parte (v236)
Los ajustes y filtros de 8 bits pierden los bits extra de las fotos de 16 bits.
- [x] Interfaz de cálculo en coma flotante para `runAdjust` (`float`, convive con la actual): sólo actúa si la
      capa trae origen de 16 bits que cubre el lienzo; la capa de filtro conserva sus 16 bits. (v236)
- [x] Migrados los ajustes de color puro: Brillo y contraste, Niveles, Curvas, Balance de blancos, Tono y
      saturación, Exposición, Color por canales, Mezclador de canales y Vibrance. (v236)
- [ ] (→ fase 20) Resto de ajustes (Sombras y luces, Tono, Banda tonal, Color selectivo, Equilibrio de color, Mapa de
      degradado, Blanco y negro, los que usan `applyDirect`) y los modos Premium con su propio motor.
- [ ] (→ fase 20) Capas con origen de 16 bits recortado o desplazado (hoy sólo cuando cubre todo el lienzo).

## Fase 12 · Filtros en coma flotante ✅ en parte (v237)
- [x] Motor común (`js/editor/floatfilter.js`) y opción `float` en `runFilter` y en el diálogo en vivo de
      photo-tools: «color» (rejilla RGB + interpolación, para lo que sólo mira el color) y «delta» (el cambio de
      un filtro local se suma a los 16 bits del origen). El lienzo de 8 bits es el redondeo tramado de los 16. (v237)
- [x] Con «delta»: Desenfoque gaussiano, Enfocar, Movimiento, Detalle y estructura, Viñeteado, Añadir ruido, Lente,
      Radial, De superficie, Ruido por canal, Nitidez inteligente, Galería de desenfoque, Desenfoques clásicos,
      Restauración, Enfoque avanzado, Textura y grano, Convolución, Reducción de ruido, Enfoque selectivo, Retoque de
      retrato y PurePixel. Con «color» (por `runAdjust`): Estilos (looks) y Tabla de color (LUT). (v237)
- [x] No se migran a propósito los filtros que mueven la imagen (distorsiones, desplazar, pixelar, gran angular,
      deformación) o la sustituyen (paso alto, estilizar, artísticos, interpretar, IA): sus 16 bits no significan nada.
- [ ] Realify (simulación de captura), Filtro Vintage y Revelado fotográfico siguen con salida de 8 bits: sus
      motores son shaders de WebGL; hace falta salida RGBA16F/float y su lectura (ver fase 13).
- [ ] Cálculo en coma flotante «de verdad» (no por delta) para el desenfoque, el enfoque y el ruido, que hoy
      parten del filtro nativo de 8 bits del lienzo.

## Fase 13 · Compositor de la vista previa en GPU de coma flotante ✅ en parte (v238)
- [x] Fusión de capas, opacidad, 28 modos de fusión, máscaras, recorte, grupos, Fusionar si y capas de ajuste en
      WebGL2 con RGBA32F/RGBA16F (`js/gpu/floatcompositor.js`); contrastado con el motor de exportación en CPU
      (máx. 0,03 niveles en 32 bits, 0,4 en 16 bits). Capas con origen de 16 bits y documentos Display P3 incluidos. (v238)
- [x] Tramado al mostrar en pantalla (el mismo de la exportación). (v238)
- [x] Estilos de capa y «Fusionar si» en el motor de coma flotante de exportación: ya no se parte del aplanado de
      8 bits (`collectStyleShapes` en `layertree.js`, `applyStylesBand` en `precision-stack.js`). (v238)
- [ ] Estilos de capa (sombra, resplandor, trazo, degradado) en la vista previa de GPU: hoy, con estilos, el
      documento se compone en 8 bits. Las láminas de 8 bits de `collectStyleShapes` ya valen como entrada.
- [ ] Trazo en curso (pincel, borrador) en la GPU: hoy mientras se pinta se compone en 8 bits.
- [ ] WebGPU como alternativa (los modos «a mano» ya tienen su versión en `webgpu.js`).
- [ ] Caché de texturas por capa (hoy se suben las capas en cada composición); documentos grandes por mosaicos
      (≥ 18 MP en escritorio, ≥ 8 MP en móvil) siguen en 8 bits.

## Fase 14 · Documento en alta precisión ✅ en parte (v239)
Lo más costoso: ×2–×4 de memoria (12 MP: ~48 MB por capa → 96–192 MB).
- [x] Los 16 bits de origen viajan con el lienzo al girar, voltear, recortar y ampliar el lienzo, con deshacer y rehacer
      (`remapHi`, `hiCoversCanvas` en `core/hisrc.js`; `transformAll` en `imageops.js`, `cropDoc`). (v239)
- [x] Proyectos `.realify` y guardado antes de actualizar con los 16 bits (PNG de 16 bits dentro del proyecto). (v239)
- [x] Duplicar capa conserva el origen de 16 bits. (v239)
- [ ] Redimensionar con 16 bits: remuestreo en 16 bits/float con el método elegido (hoy se sueltan; el lienzo de 8 bits
      se remuestrea en el worker y el origen no corresponde). Requiere versiones en coma flotante de los núcleos de
      `resample.js` y volver a tramar el lienzo desde el resultado.
- [ ] El autoguardado periódico no lleva los 16 bits: recuperarlo tras un cierre brusco deja la foto en 8 bits.
- [ ] Capas y máscaras en 16 bits/float PROPIOS (hoy sólo la capa de fondo, o la de un filtro, lleva origen de 16 bits;
      pintar, clonar o pegar trabajan sobre 8 bits), por bloques en el móvil.
- [ ] Perspectiva, enderezar y otras operaciones que remuestrean capas siguen soltando los 16 bits.
- [ ] Procesado «lazy» por bloques inspirado en libvips: la edición como grafo de operaciones y cálculo sólo de los
      bloques necesarios para la vista o la exportación.

## Fase 15 · Metadatos y privacidad ✅ en parte (v240)
ExifReader (MPL-2.0, sin modificar).
- [x] Inspector: EXIF, IPTC, XMP, ICC, MPF, Photoshop, MakerNotes y miniatura, con resumen de datos personales. (v240)
- [x] Al exportar JPEG, PNG y WebP: conservar autor/copyright, fecha, cámara, GPS y descripción por separado, o limpiar todo;
      el perfil ICC del documento se incrusta como siempre. (v240)
- [x] «Limpiar metadatos»: opción de quitar sólo ubicación y números de serie, sin recomprimir. (v240)
- [ ] Metadatos al exportar en AVIF, JPEG XL, TIFF y PDF (hoy sólo JPEG, PNG y WebP).
- [ ] Copiar las notas del fabricante (MakerNote) y el IPTC en PNG/WebP; XMP extendido de JPEG; metadatos de originales
      HEIC/RAW (hoy se lee el EXIF estándar de cualquier contenedor, pero IPTC sólo de JPEG).
- [ ] Editar los metadatos (cambiar autor, copyright o descripción) antes de exportar, sin necesidad del panel EXIF.
- [ ] Mostrar en el inspector la procedencia C2PA (hoy la detecta `analysis/provenance.js` al limpiar).

## Fase 16 · HEIC, PSD y PSB ✅ en parte (v241)
- [ ] Exportar HEIC con libheif (LGPL: módulo WASM separado y sin modificar). **Bloqueado**: libheif-js sólo decodifica y no hay codificador HEVC en WASM con licencia/patentes aceptables (x265 es GPL). Alternativa vigente: AVIF.
- [x] PSD: grupos, máscaras reales, 27 modos de fusión, efectos de capa (sombra, resplandor, trazo, degradado), ajustes
      Invertir/Niveles/Curvas, 72 ppp y sRGB; importación de modos, máscaras, efectos y ajustes. (v241)
- [x] PSB (documentos grandes): exportar y abrir. (v241)
- [x] PSD/PSB de 16 bits (sólo la imagen final, escritor propio). (v241)
- [ ] Pendiente: objetos inteligentes (se rasterizan), texto nativo editable, resto de capas de ajuste (brillo, tono,
      balance de color…), «Fusionar si», capas de 16 bits con capas (hoy sólo compuesto), metadatos XMP/EXIF en el
      PSD, abrir PSD de 16 bits conservando los 16 bits (hoy ag-psd los baja a 8) y estilos de capa con más opciones.

## Fase 17 · PDF profesional ✅ en parte (v242)
pdf-lib (MIT).
- [x] Multipágina, A5/A4/A3/Carta/Legal, márgenes, sangrado, resolución objetivo, portada y numeración; varias imágenes
      por página; metadatos. (v242)
- [x] Imágenes a la resolución objetivo sin recomprimir de más (JPEG que ya cabe → tal cual). (v242)
- [ ] Pendiente: una página por capa/artboard del documento, PDF/X (perfil de salida CMYK e intención), marcas de recorte
      dibujadas, texto de la portada con más estilo y fuentes propias (hoy Helvetica), imágenes con transparencia en
      modo JPEG sobre un color de fondo a elegir, y orden/quitado de las imágenes añadidas.

## Fase 18 · Informe de errores en Ayuda ✅ en parte (v243)
- [x] Diagnóstico: anota qué archivo no se pudo cargar y con qué código (también tras la autorreparación). (v243)
- [x] Entrada «Informar de un error» en Ayuda (móvil y escritorio): qué ha pasado, correo opcional y casilla
      «Adjuntar diagnóstico»; la imagen sólo si se marca. (v243)
- [x] Receptor `/api/informe` (`server/informe/`): destinatario fijo, `limit_req`, tamaño máximo, campo trampa,
      cabeceras limpias, correo sólo en `Reply-To`; sección en la Política de privacidad. (v243)
- [x] «Enviar informe» en el panel de «no ha podido arrancar», siempre preguntando. (v243)
- [x] **Instalado en el VPS** (5 oct 2026): usuario `informe`, `informe.service` (`INFORME_TO=djl@djl.red`), nginx con
      `/api/informe`; prueba pública correcta. SPF/DKIM/DMARC opcionales (el destino es un buzón local del mismo servidor).

## Fase 19 · Extras de infraestructura ✅ evaluada y descartada (5 oct 2026)
No mejoran el resultado; sólo si sobra tiempo. Se midieron en Chromium (3000×2000, equipo de pruebas sin GPU) y **no
compensa adoptar ninguna**:
- [x] **Pica 9.0.1** (MIT) para miniaturas de interfaz. Miniatura de 72×48 frente a una referencia de promedio por área:
      `drawImage` calidad «high» (y «medium») error medio 1,98/255 en 0,06 ms; Pica (box/hamming/lanczos2) 0,18–0,21/255 en
      68–78 ms. Es unas 10 veces más exacta pero una diferencia de 2 niveles sobre 255 no se ve en una miniatura de 48 px,
      cuesta ~1000 veces más y obliga a hacer asíncrono `layerThumb()` (hoy síncrono, usado al pintar el panel de capas).
      Descartada; las miniaturas siguen con `drawImage`. Reconsiderar sólo si aparecen miniaturas grandes con aliasing visible.
- [x] **Photon 0.3.3** (Apache-2.0, 1,9 MB de WASM) como respaldo de CPU. Desenfoque gaussiano r=10: 705 ms frente a
      240 ms del filtro nativo del lienzo (`ctx.filter`, que ya usa Realify), enfoque 452 ms, sólo la conversión
      de entrada 38 ms. Es más lento, y sus algoritmos (8 bits, sin luz lineal ni OKLab) no dan el mismo resultado que los
      motores de Realify, así que no puede ser un respaldo equivalente de las rutas GPU/CPU validadas. Descartada.
- Las dos quedan fuera de `js/vendor` (no se incorporó ninguna).

## Fase 20 · Cabos sueltos de las fases 10 y 11 ✅ en parte (v244)
- [ ] **Selección por texto con vocabulario abierto** («una taza azul», «el logo»): CLIPSeg u otro modelo.
      **Bloqueado en este entorno**: la red rechaza `huggingface.co` (403). Para hacerlo, el titular tiene que añadir ese
      dominio en Network access › Custom › Allowed domains del entorno; entonces: CLIPSeg-rd64-refined ONNX cuantizado
      (~150 MB, comprobar licencia), tokenizador CLIP (BPE) y aviso del tamaño antes de bajarlo.
- [x] «Pelo» y partes de la cara con BiSeNet; excepción no comercial ampliada. (v244)
- [ ] **Ajustes sin migrar a coma flotante**: Sombras y luces, Tono, Banda tonal, Color selectivo,
      Equilibrio de color, Mapa de degradado, Blanco y negro, los que usan `applyDirect` y los modos
      Premium con motor propio. *(pendiente)*
- [ ] Capas con origen de 16 bits recortado o desplazado (hoy sólo si cubre todo el lienzo). *(pendiente)*
- [ ] CLAHE Premium: la vista previa difiere de lo aplicado (aviso del test de calidad); hallar la causa. *(pendiente)*
- [ ] Verificar el límite de memoria con imágenes de 24 MP (`codecMaxPixels()` 24e6/8e6): sólo se
      probó con tamaños pequeños; repetir con 12 y 24 MP. *(pendiente)*

---

## Descartado y por qué
- **Cuantizar modelos a INT8/Q4**: empeora la calidad.
- **Fabric.js, TOAST UI Image Editor u otro editor completo**: crearían un segundo modelo de
  capas y lienzo; Realify ya supera su alcance.
- **Transformers.js como segundo motor de inferencia**: sólo para experimentar con un modelo
  concreto; lo que se adopte va al motor ONNX común.
- **image-js como sustituto del pipeline** (sí como fuente de algoritmos concretos) y
  **libvips completo en el navegador** (inspira la fase 14, no se integra).
