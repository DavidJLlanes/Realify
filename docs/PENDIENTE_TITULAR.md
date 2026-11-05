# Pendiente del titular

Lo que **solo puede hacer David** (o decidir él). Se va completando fase a fase y se entrega al terminar todas las fases del plan
(`docs/PLAN_EDITOR_IA_LOCAL.md`). Lo que puede hacer Claude no está aquí: se hace y se anota en el CHANGELOG.

## Decisiones
- F11.7 · **Mejoras de Unmark**: qué marcas, qué mejoras y cómo se mide el resultado.
- F11.8 · **EXIF de Realify** (`js/filters/camera/exifmatch.js`): alcance de la ampliación.
- Si algún día se cobra Premium: sustituir los modelos marcados `noncommercial: true` (BiSeNet, Zero-DCE++, UltraSharp V2 Lite…).

## Dispositivos y navegadores que Claude no tiene
- Mediciones en un **móvil de gama media** (WebGPU, memoria, tiempos) de las funciones con modelos.
- `node tests/calidad-herramienta.mjs <comando>` en **Edge** (móvil y escritorio) antes de publicar.
- Despliegue manual con `git` en el VPS (el flujo de GitHub Actions está desactivado).

## Fotos reales (no se suben al repositorio)
Basta con una carpeta y `REALIFY_FOTOS=carpeta node tests/ia/reales/<prueba>.mjs`:
- Cuerpo entero (hombre, mujer, niño, niña) para el editor de cuerpo; varias personas; manos de cerca.
- Telas muy estampadas, prendas con pliegues.
- Fotos con polvo de sensor, moiré, desenfoque de movimiento.
- Imágenes generadas con manos o dientes raros (avisos de la Fase 11) y fotos reales sin esos fallos, para ajustar umbrales.

## Revisión que no puede hacer Claude
- Licencia de los **datos de entrenamiento** de cada modelo (`docs/MODELOS.md`) y confirmar el uso no comercial.
- Juicio visual: si el recoloreado, el grano, la colocación del texto y los estilos «se ven bien».
