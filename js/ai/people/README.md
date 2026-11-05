# js/ai/people · análisis de personas

API única para saber quién hay en la foto y dónde está cada parte (Fase 2 del plan).

| Archivo | Qué hace |
|---|---|
| `analyze.js` | `analyze(canvas, {quality, signal})` → `{ personas }`; los modelos se enchufan con `registerProvider(kind, run)` |
| `assemble.js` | (puro) reparte caras, puntos, manos, pose y partes entre personas |
| `proportions.js` | (puro) razones geométricas desde la pose (formato COCO de 17 puntos) |
| `cache.js` | caché por revisión del documento; las herramientas comparten una pasada |
| `profiles.js` | (datos) perfiles hombre, mujer, niño y niña: mandos, rangos y presets. El infantil no tiene pecho, caderas, glúteos ni definición |

Prueba: `node tests/ia/personas.mjs`. Estado: con solo YuNet devuelve caras y cajas; faltan los modelos de la Fase 2 (F2.1–F2.3).
