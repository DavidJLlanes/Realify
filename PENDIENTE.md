# Pendiente

Ideas acordadas para más adelante (no hechas todavía). Criterio que manda en todo:
**máxima calidad de los resultados**. Nunca se cambia calidad por memoria o velocidad: nada
de cuantizar modelos a INT8/Q4 (con GFPGAN, INT8 bajó a 27 dB), seguir con fp16/fp32 y
resolver la memoria procesando por bloques.

Índice:
1. Hoja de ruta de calidad de imagen (orden de prioridad)
2. Alta precisión: estado y fases
3. Visión clásica, apilado y profundidad (OpenCV.js, Depth Anything)
4. Formatos, metadatos y exportación
5. Infraestructura (sin efecto directo en la calidad)
6. Descartado y por qué
7. Informe de errores en Ayuda

Origen de las secciones 1, 3, 4, 5 y 6: auditoría técnica externa (octubre de 2026,
«Informe_Auditoria_Tecnica_Realify.pdf») revisada contra el estado real del código; se han
quitado sus propuestas que empeoran la calidad.

## 1. Hoja de ruta de calidad de imagen (orden de prioridad)

Ordenada por cuánto mejora los píxeles que entrega Realify. Licencias: los modelos de IA
nuevos deben permitir uso comercial (normas del proyecto), aunque el código de Realify sea
PolyForm Noncommercial.

1. **Procesado en alta precisión en todo el documento (16 bits o coma flotante).** Hoy cada
   capa y cada ajuste se guarda en 8 bits: al apilar ajustes se pierden niveles (bandas en
   cielos y degradados, sombras empastadas). Coste muy alto; por fases. Ver sección 2.
2. **Gestión de color con perfiles ICC (Display P3, Adobe RGB).** Las fotos de iPhone y
   muchos Android vienen en P3: leer el perfil, trabajar en espacio amplio y exportar con
   el perfil incrustado. Hoy todos los lienzos se crean con `colorSpace: "srgb"`
   explícito; comprobar qué se pierde al abrir. Coste medio. **Empezar por aquí.**
3. **IA a resolución completa por bloques en todos los modelos.** Ampliar y colorear ya
   van por bloques; la profundidad (518 px), las máscaras de cielo y persona y la cara de
   GFPGAN se calculan a baja resolución y se amplían. Bloques con solape configurable y
   fundido, tamaño según memoria del dispositivo, backend y modelo. Coste medio.
   **Empezar por aquí (junto con el 2).** Aplica también a restauración, deblur y
   cualquier modelo imagen-a-imagen nuevo.
4. **Exportación de alta profundidad**: PNG y TIFF de 16 bits, AVIF 10/12 bits, JPEG XL
   (fotografía, HDR, alta profundidad) y OpenEXR (valores HDR de escena sin comprimir el
   rango; encaja con el pipeline Premium en coma flotante y Rec.2020). Cargar cada códec
   sólo al usarlo. Depende de la sección 2.
5. **Apilado de fotos**: reducción de ruido por varias tomas (image stacking) y focus
   stacking, con alineación subpíxel. Ver sección 3.
6. **Corrección de lente con perfiles reales** (distorsión, viñeteo y aberración por
   modelo de objetivo). Vigilar la licencia de la base de datos de perfiles.
7. **Selección por texto** («persona», «cielo», «pelo», «coche rojo»): máscaras más
   precisas para ajustes locales. Modelos grandes: revisar licencia (uso comercial) y
   tamaño; integrarlos en el motor ONNX común (ver sección 6 sobre Transformers.js).
8. **Seleccionar / enmascarar por profundidad.** Ver sección 3.
9. **Exportar HEIC** (libheif). Ver sección 4.
10. **Mejoras PSD y PSB.** Ver sección 4.
11. **EXIF/IPTC/XMP/ICC y privacidad de metadatos.** Ver sección 4.
12. **PDF profesional, miniaturas con Pica, respaldo WASM con Photon**: no mejoran el
    resultado; secciones 4 y 5.

## 2. Alta precisión: estado y fases (punto 1 de la hoja de ruta)

### Ya hecho
- **Exportación**: el paso final (remuestreo y codificación) se hace en RGB lineal Float32
  con tramado a 8 bits (`js/core/high-precision-next.js`, usado por `js/io/export.js` y
  `js/io/professional-export.js`). Limitado a 8 MP; por encima, motor compatible.
- **Revelador RAW Premium** (`raw/premium/`): coma flotante de principio a fin y
  exportación TIFF de 16 bits.
- **Filtro Realify Premium** (`js/filters/camera/`): texturas RGBA32F/RGBA16F en GPU y
  tramado de salida.
- **Herramientas Premium** (Tono/Color, Niveles, profundidad, Iluminar…): calculan en
  coma flotante y luz lineal, con tramado al escribir el resultado.

### Falta (de más a menos beneficio)
1. **Pila de ajustes y fusión en 8 bits.** Cada capa de ajuste trabaja sobre el
   resultado ya cuantizado de la anterior. `renderPrecisionAdjustmentStack` existe pero
   devuelve siempre `null`: implementarla para que al exportar la pila de ajustes y los
   modos de fusión se recalculen en Float32 desde las capas de píxeles. Mayor beneficio
   con coste moderado.
2. **Entrada de 16 bits perdida.** «Abrir en Realify» desde el revelador RAW, TIFF y PNG
   de 16 bits y AVIF de 10 bits se convierten a 8 bits al entrar: conservar una fuente de
   alta precisión para la capa base.
3. **Salida de alta profundidad desde el editor**: PNG y TIFF de 16 bits (luego AVIF
   10/12 bits, JPEG XL, OpenEXR; ver punto 4 de la hoja de ruta). Hoy sólo el revelador
   RAW exporta TIFF de 16 bits.
4. **Límite de 8 MP** del motor Float32 de exportación: procesar por franjas o bloques
   para fotos de 12–48 MP sin agotar memoria.
5. **Ajustes y filtros (~90) leen y escriben Uint8**: interfaz en coma flotante y
   migración por fases (primero los ajustes, que son tablas y curvas).
6. **Compositor de la vista previa** (Canvas 2D, 8 bits): pasar a GPU en coma flotante
   (WebGL2 RGBA16F o WebGPU). Mejora lo que se ve al editar; el archivo final ya mejora
   con 1, 2 y 4.
7. **Capas, máscaras, historial y proyectos en 16 bits/float.** Lo más costoso: ×2–×4 de
   memoria (12 MP: ~48 MB por capa → 96–192 MB); en móvil exige trabajar por bloques.
8. **PSD en 8 bits por canal** (ag-psd escribe 16 bits con limitaciones).

### Fases
- **Fase 1**: implementar `renderPrecisionAdjustmentStack` (1), quitar el límite de 8 MP
  (4) y exportar PNG/TIFF de 16 bits (3). Exportaciones sin bandas aunque se apilen
  ajustes, sin rehacer el núcleo. **Empezar por aquí.**
- **Fase 2**: conservar los 16 bits de RAW/TIFF/PNG al abrir (2).
- **Fase 3**: compositor GPU en coma flotante para la vista previa (6).
- **Fases 4–5**: migrar filtros a coma flotante (5) y capas en alta precisión (7, 8).

## 3. Visión clásica, apilado y profundidad

### OpenCV.js como motor especializado (Premium)
Apache-2.0, ~8–10 MB: cargar sólo bajo demanda. No sustituye lo que ya funciona (HDR,
Unir imágenes, Perspectiva propios); se usa donde mejore el resultado o evite
reimplementar algoritmos complejos:
- Alineación HDR y de panorámicas más precisa: homografías, registro subpíxel, optical
  flow (fantasmas en HDR con movimiento).
- **Image stacking** (reducción de ruido con varias tomas) y **focus stacking**.
- Corrección de perspectiva y detección de horizonte automáticas.
- CLAHE (contraste local adaptativo), morfología, detección de bordes y contornos.
- Análisis de nitidez (elegir la mejor toma, mapas de enfoque).
- Detección automática de documentos (recorte y enderezado).

### Profundidad (Depth Anything V2 ya integrado)
Ya hecho: Desenfoque por profundidad, Niebla por distancia y Foto 3D. Pendiente:
- **Seleccionar por profundidad**: primer plano, plano medio, fondo o intervalo manual,
  como máscara editable.
- **Máscaras por distancia** para cualquier ajuste local.
- **Iluminación dependiente de la profundidad** y **separación de planos** en capas.
- Calcular la profundidad a resolución completa por bloques (sección 1, punto 3).

## 4. Formatos, metadatos y exportación

### Formatos
- **Gestor de códecs WASM** (filosofía de Squoosh, que ya se usa para AVIF): cada
  codificador se carga sólo al elegir el formato; estimación de peso y calidad antes de
  exportar (AVIF/WebP).
- **HEIC/HEIF**: exportar HEIC con libheif (interesa sobre todo en móviles). LGPL: módulo
  WASM separado y sin modificar; revisar las obligaciones de las bibliotecas enlazadas.
- **JPEG XL** y **OpenEXR** (sección 1, punto 4).
- **PSD**: Realify ya usa ag-psd; comparar capacidades y completar grupos, máscaras,
  modos de fusión, metadatos, efectos de capa y objetos inteligentes. ag-psd tiene
  límites con PSB y escritura de 16 bits.
- **PSB** (documentos grandes de Photoshop): extender gradualmente la infraestructura PSD
  propia; coste alto.

### Metadatos (ExifReader, MPL-2.0: usar como módulo sin modificar)
- Leer EXIF, IPTC, XMP, ICC, MPF, metadatos de Photoshop, MakerNotes y miniaturas
  incrustadas en el inspector de imagen. Revisar antes qué hace ya el módulo EXIF actual.
- Controles de privacidad al exportar: quitar GPS, conservar copyright, conservar o quitar
  fecha y cámara, limpiar todos los metadatos y **conservar el perfil ICC** cuando el
  formato lo permita (enlaza con la sección 1, punto 2).

### PDF profesional (pdf-lib, MIT)
- Documentos multipágina, A4/A3/Carta, márgenes, sangrado, resolución objetivo, portada,
  numeración, varias imágenes por página, fuentes y metadatos; importar/copiar páginas.
- Exportar siempre las imágenes a la resolución objetivo sin recomprimir de más.

## 5. Infraestructura (sin efecto directo en la calidad)

El motor común de IA ya existe (`js/ai/worker.js`: WebGPU→WASM, caché en IndexedDB,
descarga bajo demanda con aviso de tamaño, grupos de sesión que se liberan, modelos
partidos, fp16). Falta:
- **Cancelar** tareas de IA y progreso uniforme en todas.
- Límites de memoria por dispositivo y liberación de tensores más fina (al servicio del
  procesado por bloques, nunca bajando la precisión).
- **Pipeline «lazy» por bloques inspirado en libvips**: representar la edición como un
  grafo de operaciones y calcular sólo los bloques necesarios para la vista o la
  exportación. Es la evolución más potente para imágenes enormes y edición no
  destructiva, y la más costosa; encaja con las fases 4–5 de la sección 2.
- **Pica** para miniaturas de interfaz (capas, cielos, LUT, filtros, estilos, stickers,
  marcos): nunca para el remuestreo final, que ya es de mayor calidad.
- **Photon (Rust/WASM)** como respaldo de CPU cuando no haya WebGPU/WebGL2
  (convoluciones, Sobel, desenfoque, enfoque, tramado). Jerarquía WebGPU → WebGL2 → WASM →
  JavaScript. Sólo si las pruebas demuestran el mismo resultado y mejor tiempo.
- **image-js** sólo como fuente de algoritmos concretos.

## 6. Descartado y por qué

- **Cuantizar modelos a INT8/Q4** («política de cuantización» del informe): empeora la
  calidad. Seguir con fp16/fp32.
- **Fabric.js, TOAST UI Image Editor u otro editor completo**: crearían un segundo modelo
  de capas y lienzo; Realify ya supera su alcance.
- **Transformers.js como segundo motor de inferencia**: sólo para experimentar con un
  modelo concreto (segmentación, profundidad, clasificación, detección de objetos); lo que
  se adopte va al motor ONNX común.
- **image-js como sustituto del pipeline**, y **libvips completo en el navegador**
  (inspira la arquitectura de la sección 5, no se integra).

## 7. Informe de errores en Ayuda (con Postfix del VPS)

- Entrada «Informar de un error» en el menú Ayuda (móvil y escritorio): qué ha pasado,
  correo opcional para responder y casilla «Adjuntar diagnóstico» (`__realifyDiag`). Sin la
  foto salvo que se pida expresamente.
- En el VPS: ruta `/api/informe` en nginx → script corto (PHP-FPM, Python o Node, según lo
  que haya) → `sendmail` de Postfix.
- Seguridad: destinatario fijo en el servidor, `limit_req` por IP, tamaño máximo, campo
  trampa contra bots, sin saltos de línea en asunto/cabeceras, correo del usuario sólo en
  `Reply-To` y validado. SPF y DKIM en realify.es para no caer en spam.
- Opcional: si la app no arranca o salta un error grave, ofrecer «¿Enviar informe?» con el
  diagnóstico relleno (siempre preguntando).

### Mejora del diagnóstico: qué archivo no se pudo cargar

Cuando Firefox (u otro navegador) no arranca con «No se pudo cargar: js/main.js?v=…», el
diagnóstico no dice cuál de los módulos falló. La autorreparación de `js/boot-guard.js` ya pide
todos los módulos uno a uno (`refreshModules`): anotar los que no devuelven 200 (URL + código
HTTP, o «bloqueado / error de red» si el `fetch` falla) y añadirlos a `__realifyDiag`. Así el
informe diría directamente, por ejemplo, «falla /js/xxx.js con 503» o «bloqueado».
