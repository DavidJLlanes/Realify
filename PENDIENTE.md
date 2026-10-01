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
- [ ] Pendiente: AVIF y WebP con perfil o etiqueta P3 (con el códec propio, fase 6) y TIFF
      de 8 bits con perfil.
- [ ] Pendiente: herramientas WebGL en P3 (hoy recortan a sRGB; con la fase 13) y color de
      pintura en P3 (selector y cuentagotas fuera de sRGB).
- [ ] Pendiente: «Abrir en Realify» desde el revelador RAW en P3 (con la fase 4).

## Fase 3 · IA a resolución completa por bloques
Ampliar y colorear ya van por bloques; el resto se calcula reducido y se amplía.
- [ ] Motor común de bloques: solape configurable, fundido, tamaño según memoria,
      backend y modelo.
- [ ] Profundidad (hoy 518 px) y máscaras de cielo y persona por bloques.
- [ ] Caras (GFPGAN, retoque) a la resolución real del rostro.
- [ ] Cancelar tareas de IA y progreso uniforme (mismos archivos; sin efecto en calidad).

## Fase 4 · Entrada de alta profundidad
- [ ] «Abrir en Realify» desde el revelador RAW sin bajar a 8 bits.
- [ ] Conservar los 16 bits de TIFF y PNG, y los 10 bits de AVIF, como fuente de la capa
      base.

## Fase 5 · Profundidad como herramienta
Reutiliza Depth Anything V2 (ya están Desenfoque por profundidad, Niebla y Foto 3D).
- [ ] Seleccionar por profundidad: primer plano, plano medio, fondo o intervalo manual,
      como máscara editable.
- [ ] Máscaras por distancia para cualquier ajuste local.
- [ ] Iluminación dependiente de la profundidad y separación de planos en capas.

## Fase 6 · Formatos modernos de alta calidad
- [ ] Gestor de códecs WASM (cada uno se carga al elegir el formato) con estimación de
      peso y calidad antes de exportar.
- [ ] AVIF de 10/12 bits.
- [ ] JPEG XL.
- [ ] OpenEXR (valores HDR de escena; encaja con el pipeline Premium en coma flotante).

## Fase 7 · Apilado de fotos (OpenCV.js, parte 1)
OpenCV.js (Apache-2.0, ~8–10 MB) sólo bajo demanda y como motor Premium; no sustituye lo
que ya funciona.
- [ ] Carga bajo demanda de OpenCV.js.
- [ ] Alineación subpíxel (homografías, optical flow) para HDR y panorámicas, también con
      movimiento.
- [ ] Reducción de ruido con varias tomas (image stacking).
- [ ] Focus stacking.

## Fase 8 · Visión clásica (OpenCV.js, parte 2)
- [ ] Corrección de perspectiva y detección de horizonte automáticas.
- [ ] CLAHE (contraste local adaptativo).
- [ ] Análisis de nitidez (elegir la mejor toma, mapa de enfoque).
- [ ] Detección y enderezado automático de documentos.

## Fase 9 · Corrección de lente con perfiles reales
- [ ] Base de perfiles por objetivo (distorsión, viñeteo y aberración); revisar su
      licencia.
- [ ] Aplicación automática según los datos EXIF de cámara y objetivo.

## Fase 10 · Selección por texto
- [ ] Elegir modelo («persona», «cielo», «pelo», «coche rojo»…) con licencia comercial y
      tamaño razonable; integrarlo en el motor ONNX común.
- [ ] Máscara editable resultante, a resolución completa (por bloques, fase 3).

## Fase 11 · Ajustes en coma flotante
Hoy los ~90 ajustes y filtros leen y escriben píxeles de 8 bits.
- [ ] Interfaz de cálculo en coma flotante para `runAdjust` (convive con la actual).
- [ ] Migrar los ajustes (son tablas y curvas: lo más sencillo).

## Fase 12 · Filtros en coma flotante
- [ ] Migrar los filtros de `runFilter` y `photo-tools`.
- [ ] Migrar los plugins con motor propio que aún escriban 8 bits.

## Fase 13 · Compositor de la vista previa en GPU de coma flotante
- [ ] Fusión de capas, opacidad y modos de fusión en WebGL2 RGBA16F (o WebGPU).
- [ ] Tramado al mostrar en pantalla.
- [ ] Estilos de capa y «Fusionar si» también en el motor de coma flotante de exportación
      (hoy, si se usan, se parte del compuesto de 8 bits; ver fase 1).

## Fase 14 · Documento en alta precisión
Lo más costoso: ×2–×4 de memoria (12 MP: ~48 MB por capa → 96–192 MB).
- [ ] Capas y máscaras en 16 bits/float, por bloques en el móvil.
- [ ] Historial y proyectos en alta precisión.
- [ ] Procesado «lazy» por bloques inspirado en libvips: la edición como grafo de
      operaciones y cálculo sólo de los bloques necesarios para la vista o la exportación.

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

---

## Descartado y por qué
- **Cuantizar modelos a INT8/Q4**: empeora la calidad.
- **Fabric.js, TOAST UI Image Editor u otro editor completo**: crearían un segundo modelo de
  capas y lienzo; Realify ya supera su alcance.
- **Transformers.js como segundo motor de inferencia**: sólo para experimentar con un modelo
  concreto; lo que se adopte va al motor ONNX común.
- **image-js como sustituto del pipeline** (sí como fuente de algoritmos concretos) y
  **libvips completo en el navegador** (inspira la fase 14, no se integra).
