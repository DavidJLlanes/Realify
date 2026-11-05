# `tests/ia/` · pruebas del plan «editor completo con IA local»

Todo lo nuevo del plan ([`docs/PLAN_EDITOR_IA_LOCAL.md`](../../docs/PLAN_EDITOR_IA_LOCAL.md)) se prueba aquí, además de
`node tests/calidad-herramienta.mjs <comando>` (móvil y escritorio) y `npm run verify`.

## Cómo se ejecutan

Playwright con Chromium. Si Chromium no está en la ruta por defecto: `CHROME_EXE=<ruta al ejecutable>`.
`REALIFY_RAIZ=<carpeta>` hace que una prueba use otra copia del proyecto (p. ej. la anterior a un cambio, para comparar huellas).

```
npm run test:ia                      las pruebas de abajo, de una vez
node tests/ia/<prueba>.mjs           una sola
```

## Qué hay

| Archivo | Qué comprueba | Navegador |
|---|---|---|
| `cajon-basicos-auto.mjs` | Las pestañas **Básicos** y **Automáticos** del cajón no cambian (orden y contenido) respecto a la línea base | sí (móvil) |
| `baseline/` | Línea base: `menu-ia.json` (menú IA) y `cajon.json` (todas las pestañas). `node tests/ia/baseline/capturar.mjs` la regenera; sólo si un cambio de estructura es intencionado y revisado a mano (Fase 1) | sí |
| `params-panel.mjs` | Esquema de parámetros: defaults, perfiles, rangos, validación, secciones (incluye la regla de seguridad infantil) | no |
| `interfaces.mjs` | Reglas de 4.7: las funciones no importan `fsshell` ni `dialog`, no dibujan mandos a mano, su `ui` y `params` son válidos | no |
| `ai-kit.mjs` | Piezas comunes de `js/features/ai-kit/` y que `depthtools.js` conserva su API | sí |
| `ai-editor.mjs` | Armazón de editores: objetivos, grupos, zoom, perfiles, deshacer, un mando cada vez en el móvil, panel simple | sí (móvil y escritorio) |
| `worker-tareas.mjs` | Tareas del worker con modelos locales; da una huella para comparar antes y después de tocar `js/ai/` | sí |
| `lib/` | `navegador.mjs` (servidor y Chromium móvil o escritorio) y `huellas.mjs` (lectura del menú y del cajón) | — |
| `fixtures/` | Imágenes sintéticas (`generar.mjs`), ver `AUTORIA.md` | — |

Las pruebas de cada función nueva van en `tests/ia/<familia>/<función>.mjs` (las crea `tools/scaffold/nueva-funcion-ia.mjs`).
El motor de píxeles se prueba en Node puro; la interfaz, en móvil y escritorio.

## Reglas

- Una prueba falla con código de salida 1 y dice qué comparó (no sólo «FALLO»).
- Sin red: los modelos con aviso de descarga se dejan fuera, porque esperan a que alguien acepte el aviso.
- Las imágenes de prueba son sintéticas o CC0 y llevan su autoría en `fixtures/AUTORIA.md`.
