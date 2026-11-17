# Realify Basic

App instalable aparte, sólo para fotos, con edición básica y una interfaz limpia y transparente (la foto a pantalla
completa y los mandos de cristal encima). Vive en `realify.es/basic/` y comparte origen, iconos, almacenamiento y motor de
píxeles con Realify. Plan y decisiones: [`docs/PLAN_BASIC.md`](../docs/PLAN_BASIC.md).

## Estado
F0: esqueleto instalable y vacío (manifiesto, service worker, página y estilos base).

## Estructura
```
basic/
├─ index.html · manifest.webmanifest · sw.js
├─ css/   tokens.css · shell.css
└─ js/    main.js · app/pwa.js
```
Crecerá según las fases del plan (`app/`, `engine/`, `ui/`, `tabs/`).

## Normas
- **Capas**: `basic/` está por encima de todo `js/` y `plugins/`; puede importarlos, pero nada de `js/` ni de `plugins/`
  importa de `basic/` (`node tools/verify/layers.mjs`).
- **Versión**: el contador de compilación es el de Realify. Al subirlo hay que cambiar también `VERSION` en `basic/sw.js` y
  el `?v=` de `basic/index.html`.
- **Service worker**: el de Basic (alcance `/basic/`) sólo borra cachés `realify-basic-*`, y el de Realify sólo `realify-v*`.
- Siempre calidad Premium, sin interruptor. Archivos ≤ 250 líneas, banner `═` en español, sin código duplicado.
