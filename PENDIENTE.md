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
   alto (núcleo del editor): planificarlo aparte y por fases.
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
