# Realify · IA avanzada — hoja de ruta permanente

> Documento maestro del proyecto. Debe consultarse antes de modificar cualquier parte de IA avanzada.

## Regla de estructura

Todo lo que pertenezca a estas ocho fases vive dentro de **`/advanced-ai/`**.

No crear código, modelos, scripts de instalación, adaptadores cloud, workers ni documentación de este proyecto fuera de esa carpeta, salvo los puntos mínimos de integración con Realify (comando, menú/cajón y versionado de la app).

Estructura canónica:

```text
advanced-ai/
├─ ROADMAP.md
├─ README.md
├─ index.js
├─ ui/
├─ client/
├─ local-service/
├─ engines/
├─ models/
├─ workers/
└─ cloud/
```

Los pesos de modelos estarán siempre bajo `advanced-ai/models/`, separados por motor y versión. No se mezclarán con `assets/models/` existentes de Realify.

## Flujo final objetivo

```text
Realify
  ↓
IA avanzada fullscreen
  ↓
detección de Realify AI Local
  ↓
GPU NVIDIA + CUDA disponibles
  ↓
ModelManager
  ↓
motor necesario
  ↓
resultado
  ↓
previsualización / antes-después
  ↓
Aplicar como capa + historial
```

En una fase posterior:

```text
motor local no disponible
  ↓
GPU cloud de pago por uso
```

## Fase 1 — Base del módulo y motor local ✅

Objetivo: construir la infraestructura sin ejecutar todavía modelos pesados.

- Carpeta única `advanced-ai/`.
- Interfaz fullscreen integrada en Realify.
- Previsualización de la fotografía abierta.
- Área de ajustes fotográficos.
- Caja de prompt.
- Estado del motor local.
- Cliente HTTP hacia `127.0.0.1`.
- Servicio local mínimo Python/PyTorch.
- Detección CUDA, GPU y VRAM.
- Preparar carpetas de modelos y motores.
- Sin alterar la imagen al pulsar controles todavía.
- Sin descargar modelos todavía.

Criterio de finalización: Realify abre el módulo, muestra la foto y puede decir de forma fiable si Realify AI Local está disponible y qué GPU/CUDA tiene.

## Fase 2 — Upscale CUDA ✅

- Real-ESRGAN x2plus y x4plus oficiales.
- ModelManager y registro central de modelos.
- Descarga bajo demanda desde las releases oficiales.
- Verificación exacta por tamaño + SHA-256 antes de cargar cada peso.
- Tiling solapado para controlar VRAM.
- Progreso real por bloques y cancelación entre bloques.
- Realify recompone RGB16 cuando la pila permite alta precisión y lo envía como datos crudos al servicio local.
- Fallback a PNG/canvas sólo cuando la composición de alta precisión no esté disponible.
- El resultado vuelve como RGB16 y se previsualiza con canvas de 8 bits sin perder el origen de 16 bits.
- Al aplicar, el resultado abre un documento nuevo y se asocia como `hiSrc` de 16 bits cuando cabe en los límites profesionales de Realify.
- ×2 usa RealESRGAN_x2plus oficial; ×4 usa RealESRGAN_x4plus oficial.
- Los temporales y pesos descargados siguen dentro de `advanced-ai/` y están excluidos de Git.

## Fase 3 — Denoise / Deblur

- NAFNet o modelo final elegido.
- Reducción de ruido.
- Deblur.
- Control de intensidad.
- Tiling.
- Gestión de VRAM.
- Integración con antes/después e historial.

## Fase 4 — Prompt → ajustes de Realify

- Modelo lingüístico local pequeño.
- Convertir lenguaje natural a acciones estructuradas.
- Exposición, contraste, luces, sombras, blancos, negros, color, claridad, etc.
- Validación estricta del esquema de acciones.
- Ningún comando arbitrario.

## Fase 5 — Segmentación y máscaras

- SAM/SAM2 o alternativa final.
- Sujeto, objetos, fondo y selecciones.
- Máscaras editables.
- Refinado manual.
- Base para edición generativa localizada.

## Fase 6 — Edición generativa

- Modelo generativo final (objetivo inicial: familia FLUX adecuada a licencia/hardware).
- Inpainting / image editing.
- Cambiar cielo, fondo, pelo, ropa y escenario.
- Añadir objetos.
- Mantener zonas protegidas.

## Fase 7 — Identidad y control avanzado

- Preservación de identidad.
- Referencia visual.
- Profundidad / bordes / pose cuando proceda.
- Cambios complejos de escena.
- Integración de sombras, luz y perspectiva.
- Variaciones y refinado.

## Fase 8 — GPU cloud de pago por uso

- Adaptador cloud dentro de `advanced-ai/cloud/`.
- Nunca exponer claves en el navegador.
- Backend seguro.
- Créditos/coste por operación.
- Fallback cuando el motor local no exista o no cumpla requisitos.
- Límites de tiempo y coste.

## Principios que no se deben romper

1. La fotografía original no se degrada para alimentar la interfaz.
2. Las previsualizaciones reducidas nunca sustituyen silenciosamente el resultado de resolución completa.
3. Los modelos se cargan bajo demanda, no al arrancar Realify.
4. Un modelo pesado debe poder liberarse de VRAM antes de cargar otro.
5. El navegador nunca ejecutará comandos arbitrarios recibidos de un prompt.
6. El servicio local escucha únicamente en loopback.
7. La API local valida origen, tipo, tamaño y parámetros.
8. Las operaciones largas deben tener progreso y cancelación.
9. El resultado se integra con capas e historial de Realify.
10. Antes de añadir un modelo se revisan licencia, tamaño, VRAM y compatibilidad.
