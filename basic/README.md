# Realify Basic

App instalable aparte, sólo para fotos, con edición básica y una interfaz limpia y transparente (la foto a pantalla
completa y los mandos de cristal encima). Vive en `realify.es/basic/` y comparte origen, iconos, almacenamiento y motor de
píxeles con Realify. Plan y decisiones: [`docs/PLAN_BASIC.md`](../docs/PLAN_BASIC.md).

## Estado
F0 (esqueleto), F1 (interfaz base) y F2 (pestaña Ajustar: 15 ajustes + Auto, edición no destructiva con motor Premium).

## Estructura
```
basic/
├─ index.html · manifest.webmanifest · sw.js
├─ css/   tokens.css · shell.css (colocación) · controls.css (aspecto de los mandos)
└─ js/
   ├─ main.js                         arranque: sólo conecta piezas
   ├─ app/     store · session (original + receta + historial) · render (vista previa y final) · files · device · pwa
   ├─ engine/  pipeline (etapas y caché) · color · tono · detalle · vineta · auto · neutra      (sin DOM)
   ├─ ui/      viewport · gestos · topbar · tabbar · panel · ruler · strip · menu · bienvenida · aviso · atajos · icons · dom
   └─ tabs/    index.js (tabla de pestañas) · adjust/{params,panel}.js   (Estilos y Recortar llegan en F4 y F3)
```

## Normas
- **Capas**: `basic/` está por encima de todo `js/` y `plugins/`; puede importarlos, pero nada de `js/` ni de `plugins/`
  importa de `basic/` (`node tools/verify/layers.mjs`).
- **Versión**: el contador de compilación es el de Realify. Al subirlo hay que cambiar también `VERSION` en `basic/sw.js` y
  el `?v=` de `basic/index.html`.
- **Service worker**: el de Basic (alcance `/basic/`) sólo borra cachés `realify-basic-*`, y el de Realify sólo `realify-v*`.
- Siempre calidad Premium, sin interruptor. Archivos ≤ 250 líneas, banner `═` en español, sin código duplicado.
