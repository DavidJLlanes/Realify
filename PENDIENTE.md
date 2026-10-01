# Pendiente

Ideas acordadas para más adelante (no hechas todavía).

## Hoja de ruta de calidad de imagen (prioridad: máxima calidad de resultados)

Ordenada por cuánto mejora los píxeles que entrega Realify, no por comodidad ni
rendimiento. Origen: auditoría técnica externa (octubre de 2026) revisada contra el
estado real del código. Regla general: **nunca cambiar calidad por memoria**; nada de
cuantizar modelos a INT8/Q4 (con GFPGAN, INT8 bajó a 27 dB), seguir con fp16/fp32 y
resolver la memoria con procesado por bloques.

1. **Procesado en alta precisión en todo el documento (16 bits o coma flotante).**
   Hoy cada capa y cada ajuste se guarda en 8 bits: al apilar ajustes se pierden niveles
   (bandas en cielos y degradados, sombras empastadas). El modo Premium calcula en coma
   flotante pero vuelve a 8 bits en cada capa. Es la mayor pérdida sistemática; coste muy
   alto (núcleo del editor): planificarlo aparte y por fases. Detalle en
   «Alta precisión: estado y fases», más abajo.
2. **Gestión de color con perfiles ICC (Display P3, Adobe RGB).** Las fotos de iPhone y
   muchos Android vienen en P3: leer el perfil, trabajar en espacio amplio y exportar con
   el perfil incrustado (canvas `colorSpace: "display-p3"` donde exista). Comprobar
   primero qué hace hoy Realify al abrir y exportar. Coste medio. **Empezar por aquí.**
3. **IA a resolución completa por bloques en todos los modelos.** Ampliar y colorear ya
   van por bloques; la profundidad (518 px), las máscaras de cielo y persona y la cara de
   GFPGAN se calculan a baja resolución y se amplían. Por bloques con solape y fundido,
   bordes y detalle fino más precisos; tamaño de bloque según memoria del dispositivo.
   Coste medio. **Empezar por aquí (junto con el 2).**
4. **Exportación de alta profundidad**: AVIF 10/12 bits, JPEG XL, PNG y TIFF de 16 bits,
   OpenEXR, cargados sólo al usarlos. Conserva lo ganado con 1 y 2 hasta el archivo final
   (depende del 1).
5. **Apilado de fotos**: reducción de ruido por varias tomas y focus stacking, con
   alineación subpíxel (OpenCV.js bajo demanda, Apache-2.0, ~8-10 MB, como motor
   Premium). Mejora también la alineación de HDR y panorámicas.
6. **Corrección de lente con perfiles reales** (distorsión, viñeteo y aberración por
   modelo de objetivo). Vigilar la licencia de la base de datos de perfiles.
7. **Selección por texto** («cielo», «pelo», «coche rojo»): máscaras más precisas para
   ajustes locales. Modelos grandes: revisar licencias (uso comercial) y tamaño.
8. **Seleccionar / enmascarar por profundidad** (primer plano, plano medio, fondo o
   intervalo), reutilizando Depth Anything V2.
9. **Exportar HEIC** (libheif, LGPL: como módulo WASM separado y sin modificar).
10. **Mejoras PSD/PSB** (Realify ya usa ag-psd: completar grupos, máscaras, efectos).
11. **EXIF/IPTC/XMP y privacidad** (ExifReader, MPL-2.0): quitar GPS, conservar
    copyright, limpiar metadatos. Revisar antes qué hace ya el módulo EXIF actual.
12. **PDF profesional, Pica para miniaturas, Photon como respaldo WASM**: no mejoran el
    resultado; sólo si sobra tiempo.

Útil pero sin efecto en la calidad: poder cancelar tareas de IA y gestión más fina de
sesiones y memoria (el motor común ya existe en `js/ai/worker.js`: WebGPU→WASM,
IndexedDB, descarga bajo demanda, grupos de sesión, modelos partidos).

No integrar: Fabric.js, TOAST UI Image Editor ni otro editor completo; Transformers.js
sólo si un modelo concreto lo exige (evitar dos motores de inferencia).

Licencias: los modelos de IA nuevos deben permitir uso comercial (normas del proyecto),
aunque el código de Realify sea PolyForm Noncommercial.

## Alta precisión: estado y fases (punto 1 de la hoja de ruta)

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

## Informe de errores en Ayuda (con Postfix del VPS)

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
