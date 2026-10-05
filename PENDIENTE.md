# Pendiente

Trabajo acordado para más adelante, organizado en **fases numeradas** que se hacen en orden.
Cada fase es corta y se publica sola. Al terminar una tarea se marca `[x]` con la versión
(p. ej. `[x] … (v199)`); al terminar una fase, se marca como hecha en su título.

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

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
- [ ] (→ fase 20) «Pelo» y partes de la cara: sólo con BiSeNet (uso no comercial, excepción aceptada sólo para
      Retoque de cara) — decidir si se amplía la excepción.

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

## Fase 15 · Metadatos y privacidad
ExifReader (MPL-2.0, sin modificar). Revisar antes qué hace ya el módulo EXIF actual.
- [ ] Leer EXIF, IPTC, XMP, ICC, MPF, Photoshop, MakerNotes y miniaturas en el inspector.
- [ ] Al exportar: quitar GPS, conservar copyright, conservar o quitar fecha y cámara,
      limpiar todo, conservar el perfil ICC.

## Fase 16 · HEIC, PSD y PSB
- [ ] Exportar HEIC con libheif (LGPL: módulo WASM separado y sin modificar).
- [ ] PSD (ag-psd ya integrado): completar grupos, máscaras, modos de fusión, metadatos,
      efectos de capa y objetos inteligentes; escritura de 16 bits si es posible.
- [ ] PSB (documentos grandes), extendiendo la infraestructura PSD propia.

## Fase 17 · PDF profesional
pdf-lib (MIT).
- [ ] Multipágina, A4/A3/Carta, márgenes, sangrado, resolución objetivo, portada y
      numeración; varias imágenes por página; fuentes y metadatos.
- [ ] Imágenes a la resolución objetivo sin recomprimir de más.

## Fase 18 · Informe de errores en Ayuda
- [ ] Diagnóstico: anotar qué archivo no se pudo cargar y con qué código (la
      autorreparación de `js/boot-guard.js` ya pide todos los módulos uno a uno).
- [ ] Entrada «Informar de un error» en Ayuda (móvil y escritorio): qué ha pasado, correo
      opcional y casilla «Adjuntar diagnóstico»; nunca la foto salvo que se pida.
- [ ] En el VPS: `/api/informe` en nginx → script corto → `sendmail` de Postfix.
      Destinatario fijo, `limit_req`, tamaño máximo, campo trampa, cabeceras limpias,
      correo del usuario sólo en `Reply-To`; SPF y DKIM en realify.es. Añadir la sección
      correspondiente a la Política de privacidad.
- [ ] Opcional: ofrecer «¿Enviar informe?» si la app no arranca (siempre preguntando).

## Fase 19 · Extras de infraestructura
No mejoran el resultado; sólo si sobra tiempo.
- [ ] Pica para miniaturas de interfaz (capas, cielos, LUT, filtros, stickers, marcos);
      nunca para el remuestreo final.
- [ ] Photon (Rust/WASM) como respaldo de CPU sin WebGPU/WebGL2, sólo si las pruebas dan
      el mismo resultado y mejor tiempo.

## Fase 20 · Cabos sueltos de las fases 10 y 11
- [ ] **Selección por texto con vocabulario abierto** («una taza azul», «el logo»): CLIPSeg u otro
      modelo; necesita acceso a Hugging Face (ver fase 10).
- [ ] «Pelo» y partes de la cara: BiSeNet (uso no comercial); decidir si se amplía la excepción.
- [ ] **Ajustes sin migrar a coma flotante**: Sombras y luces, Tono, Banda tonal, Color selectivo,
      Equilibrio de color, Mapa de degradado, Blanco y negro, los que usan `applyDirect` y los modos
      Premium con motor propio.
- [ ] Capas con origen de 16 bits recortado o desplazado (hoy sólo si cubre todo el lienzo).
- [ ] CLAHE Premium: la vista previa difiere de lo aplicado (aviso del test de calidad); hallar la causa.
- [ ] Verificar el límite de memoria con imágenes de 24 MP (`codecMaxPixels()` 24e6/8e6): sólo se
      probó con tamaños pequeños; repetir con 12 y 24 MP.

---

## Descartado y por qué
- **Cuantizar modelos a INT8/Q4**: empeora la calidad.
- **Fabric.js, TOAST UI Image Editor u otro editor completo**: crearían un segundo modelo de
  capas y lienzo; Realify ya supera su alcance.
- **Transformers.js como segundo motor de inferencia**: sólo para experimentar con un modelo
  concreto; lo que se adopte va al motor ONNX común.
- **image-js como sustituto del pipeline** (sí como fuente de algoritmos concretos) y
  **libvips completo en el navegador** (inspira la fase 14, no se integra).
