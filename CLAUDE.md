# Realify · normas del proyecto

Editor de imágenes PWA (JavaScript con módulos ES, sin compilación) que se publica
en realify.es con GitHub Actions al subir a `main`.

## Trabajo
- Responder siempre en **español**.
- Desarrollar en la rama de trabajo; subir a `main` sólo cuando el usuario lo pida
  («Sube a main y publica»). No crear PR salvo que se pida.
- **Versionado**: la versión pública es semver (`1.0.0`, `1.0.1`, `1.1.0`…) y está en `version.json` (`release`),
  `package.json` y `package-lock.json`. Además hay un **contador de compilación entero** (298, 299…, sólo sube) que la
  app usa para detectar actualizaciones: `VERSION`, `version.json` (`version`/`build`), `sw.js` y `main.js?v=` en
  `index.html`. En cada versión se suben los dos (el contador siempre; la pública según el cambio) y se
  actualizan `docs/CHANGELOG.md`, la guía (`js/ui/help/guide.js`) y los README afectados.
- Ante la duda, preguntar.
- Al modificar una herramienta, comprobar sólo esa con `node tests/calidad-herramienta.mjs <comando>` (móvil y escritorio); no publicar con FALLO.

## Móvil y escritorio
- **Todo cambio se hace en las dos versiones, móvil y escritorio**, respetando el
  diseño actual de cada modo (p. ej. lo que va al cajón «Herramientas» del móvil
  va también al menú de escritorio; un ajuste de interfaz se revisa en ambos).
  Probar siempre los dos modos antes de dar algo por terminado.

## Interfaz (móvil)
- **La vista previa de la imagen es prioritaria.** Las interfaces de los plugins
  deben ser siempre **mínimas**: pocas filas, sin miniaturas ni vistas previas
  aparte si el ajuste puede verse en la propia imagen, sin textos de ayuda que
  quiten sitio.
- **Interruptor Premium 👑**: en el móvil va en la **misma barra que el botón de
  aplicar/aceptar, alineado a la izquierda** (junto a ✕ en los editores a
  pantalla completa; a la izquierda de Cancelar/Aplicar en los ajustes), sin
  fila propia. Usar `dockPremium` (`js/ui/kit/premium.js`), `addAction` de
  `fsshell` o `footStart` de `dialog()`/`runAdjust`.
- El interruptor lleva **siempre la palabra «Premium» junto a la corona** y es
  **idéntico en todos los plugins** (mismo componente `premiumSwitch`, mismo
  tamaño y estilo; nunca ocultar `.ps-label`).
- Los desplegables deben aparecer **siempre cerrados** (no dar el foco a un
  `<select>` al abrir: en iOS se despliega).
- El teclado del móvil nunca debe tapar lo que se escribe (`js/ui/kit/keyboard.js`).
- El menú es idéntico en móvil y escritorio. Cada función nueva lleva su entrada
  de menú y su entrada en el cajón «Herramientas» del móvil, con icono.
- Los resultados van a una capa nueva cuando se pueda.

## Modo Premium
Premium = aplicar SIEMPRE los dos modos de procesado de calidad, **el bueno y el
mejor**, ambos superiores al básico (en las funciones de IA también: modelo de
más calidad + refinado de bordes, resolución completa, luz lineal, tramado…).
«Activa el modo premium en X» = mismos mandos con un motor de más calidad (luz
lineal, coma flotante, espacios perceptuales como OKLab, mapeo de gama, tramado,
GPU si hace falta) tras el interruptor con corona; apagado, el plugin queda
exactamente igual que antes.

### Funciones nuevas de IA
- **Todas las funciones de IA nuevas son sólo Premium 👑**, sin versión básica ni
  interruptor: siempre usan el procesado Premium (el bueno y el mejor). En el menú
  y en el cajón llevan «Premium 👑» / la corona.
- **De momento sin pago**: cualquiera puede usarlas.
- Sus modelos sólo se descargan al usarlas (avisando antes del tamaño) y se
  guardan en IndexedDB; licencias que permitan uso comercial (MIT, Apache…).
- **Excepción aceptada por el usuario**: «Retoque de cara» y «Seleccionar por
  texto» (pelo, ojos, labios, orejas, cuello, gafas, sombrero) usan BiSeNet
  (`assets/models/faceparsing/`, entrenado con CelebAMask-HQ, uso NO comercial;
  `noncommercial: true` en js/ai/models.js). El usuario no hace uso comercial. Si algún
  día se cobra Premium, hay que quitarlo o sustituirlo (también del vocabulario del texto).
- Excepción aceptada por el usuario: Zero-DCE++ (CC BY-NC, uso NO comercial) para iluminar fotos oscuras con IA. Si se cobra Premium, quitarlo o sustituirlo.
- Excepción aceptada por el usuario: UltraSharp V2 Lite (CC BY-NC-SA 4.0, uso NO comercial) como modelo de máximo detalle de «Ampliar con IA», en Premium 👑 (se elige entre él y Real-ESRGAN). El usuario no cobra y es responsable de su uso; la licencia real está en el README.

## Límites
- No mejorar Unmark (eliminación de marcas de agua).

## Estructura del código
- **Capas** (ver README, «Capas del código»): un módulo sólo importa de su capa o de las de abajo. Comprobar con
  `node tools/verify/layers.mjs`. Para comprobar además que nada se ha roto: `tools/verify/README.md`.
- **Comando nuevo**: se registra en `js/app/commands/<dominio>.js` (file, edit, image, layer, selection, view, tools, ai,
  filter, adjust, analysis, help). No se añade nada a `js/main.js`.
- **Herramienta nueva del lienzo**: su objeto va en `js/editor/tools/defs/<familia>.js` y se añade a `TOOLS` en
  `js/editor/tools/tools.js` (el orden de `TOOLS` es el de la barra de herramientas).
- **Tema de la guía**: un archivo en `js/ui/help/topics/` y su entrada en `topics/index.js`.
- **Plugin a pantalla completa**: carpeta en `plugins/<nombre>/` (código, estilos y recursos juntos). Lo que necesiten
  también el resto de la app va en `js/`, nunca al revés (`js/` no importa de `plugins/` salvo con `import()`).
- Al mover o dividir archivos: usar `tools/migrate/lib/mover.mjs` y `splitter.mjs` (reescriben las referencias) y
  pasar `tools/verify/lint-refs.mjs` (detecta imports que faltan) y `units-equal.mjs` (no se perdió código).
- **Librerías de terceros pesadas** (más de ~100 KB y que no se usen en cada sesión): no se añaden como `<script>` en
  `index.html`; se cargan bajo demanda con `ensureVendor`/`vendorReady` de `js/core/vendor.js` justo antes de usarlas
  (así hacen HEIC, TIFF y PSD). Una librería en `index.html` retrasa el arranque de todos los usuarios.
- **Rendimiento**: medir con `tools/verify/perf.mjs` (HTTP/2 y red limitada). Con HTTP/1.1 el número de módulos distorsiona.
- **Utilidades pequeñas** (limitar un valor, escapar HTML, leer píxeles…): están en `js/core/util/`; se importan, no se copian en cada archivo.
