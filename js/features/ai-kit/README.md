# `js/features/ai-kit/` · piezas comunes de las funciones de IA

Aquí vive lo que usan varias funciones de IA. **Nada de esto se copia en cada función**: se importa.

| Archivo | Qué ofrece |
|---|---|
| `visible-image.js` | `visibleImage()`: la imagen compuesta que se ve, en un lienzo legible |
| `new-layer.js` | `toNewLayer(canvas, nombre)`: resultado en capa nueva con «mezcla» y un paso de deshacer |
| `float.js` | `DEC` (sRGB → luz lineal), `enc`, `hash`. Después: OKLab y tramado |
| `preview.js` | `PREVIEW`, `WORK()`, `scaled()`: vista previa y resolución de trabajo |
| `session.js` | `aiSession`, `withHeavyGuard`, `runModel` (de `js/ai/runtime.js`) |
| `model-gate.js` | `isModelCached`, `sizeNote`, `crashedBefore` |

Se añadirán cuando la primera función los necesite (no antes): `masks.js` (pluma, unión, resta, borde refinado) y el resto de
`float.js`. Reglas: sin DOM salvo `visible-image`, `new-layer` y `preview`; ≤ 250 líneas por archivo; ver `docs/PLAN_EDITOR_IA_LOCAL.md` (4.3).
