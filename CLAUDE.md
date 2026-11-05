# Realify · normas del proyecto

Editor de imágenes PWA (JavaScript con módulos ES, sin compilación) que se publica
en realify.es. **El despliegue lo hace el titular a mano con `git` en el VPS**: el flujo
`deploy.yml` de GitHub Actions está desactivado, así que subir a `main` no publica nada por sí solo.

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
- **Plan vigente**: ampliar Realify a editor completo con IA local sigue `docs/PLAN_EDITOR_IA_LOCAL.md` (fases 0 a 16).
  Leerlo al empezar, hacer la fase que toque y marcar `[x]` con la versión al terminar cada tarea. Normas de ese trabajo:
  sección «Plan: editor completo con IA local», más abajo.
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
  guardan en IndexedDB.
- **Modelos: el de más calidad que pueda ejecutar un móvil de gama media (medido), sea cual sea su licencia**
  (decisión del titular, 5 nov 2026). Se aceptan también las licencias de uso NO comercial. Cada modelo queda anotado en
  `docs/MODELOS.md` y, si es no comercial, con `noncommercial: true` en el catálogo. Si algún día se cobra Premium, hay que
  sustituir los marcados. Ya no hace falta pedir permiso para cada uno; las excepciones de abajo siguen anotadas como historial.
- **Excepción aceptada por el usuario**: «Retoque de cara» y «Seleccionar por
  texto» (pelo, ojos, labios, orejas, cuello, gafas, sombrero) usan BiSeNet
  (`assets/models/faceparsing/`, entrenado con CelebAMask-HQ, uso NO comercial;
  `noncommercial: true` en js/ai/models.js). El usuario no hace uso comercial. Si algún
  día se cobra Premium, hay que quitarlo o sustituirlo (también del vocabulario del texto).
- Excepción aceptada por el usuario: Zero-DCE++ (CC BY-NC, uso NO comercial) para iluminar fotos oscuras con IA. Si se cobra Premium, quitarlo o sustituirlo.
- Excepción aceptada por el usuario: UltraSharp V2 Lite (CC BY-NC-SA 4.0, uso NO comercial) como modelo de máximo detalle de «Ampliar con IA», en Premium 👑 (se elige entre él y Real-ESRGAN). El usuario no cobra y es responsable de su uso; la licencia real está en el README.

## Plan: editor completo con IA local
Sigue `docs/PLAN_EDITOR_IA_LOCAL.md`. Las fases se hacen en orden: la 0 (cimientos) y la 1 (menús y cajón) van antes de
cualquier función nueva.
- **Una carpeta por función**: `js/features/<familia>/<función>/` con `README.md`, `manifest.js`, `index.js`, `ui.js`,
  `controller.js`, `analysis.js`, `engine.js` y `params.js` (plantilla en la sección 4.2 del plan). El motor de píxeles es puro
  (sin DOM) y la interfaz no calcula píxeles. Lo común va en `<familia>/shared/` o en `js/features/ai-kit/`: no se copian helpers.
- **Tamaño de archivo**: objetivo ≤ 250 líneas, tope 400; `index.js` ≤ 40. Si un archivo crece, se divide por etapas (con
  `splitter.mjs`). Cada archivo lleva su cabecera con el banner `═` en español (qué hace, entradas y salidas, límites).
- **El manifiesto manda**: el menú de escritorio, el cajón del móvil, la lista ☰ y el registro de comandos salen del
  `manifest.js` de cada función. No se escriben entradas a mano en `js/ui/menu/` ni en `ITEMS` del cajón para lo nuevo.
- **Menú «Inteligencia Artificial»**: submenús de un solo nivel (sección 5 del plan) y, en el cajón, una fila de chips con los
  mismos submenús y en el mismo orden. Un submenú sin funciones listas no se muestra. **Las pestañas «Básicos» y
  «Automáticos» del cajón no se tocan** (lo vigila `tests/ia/cajon-basicos-auto.mjs`).
  Cada función también aparece en sus pestañas afines (campo `tabs` del manifiesto, tabla de la sección 5.2) y en «Todos».
- **Interfaces (sección 4.7 del plan)**: función simple (≤ 4 mandos globales) → interfaz simple como las existentes; muchas opciones →
  editor a pantalla completa del estilo del collage con zoom, en móvil y escritorio. La cara tiene su propio editor con zoom en la
  cara (`plugins/face-editor/`). **No duplicar código**: los mandos salen de `params` con `js/ui/kit/params-panel.js`, los editores se
  montan sobre `js/ui/kit/ai-editor/` (que usa `fsshell`) y las funciones no importan `fsshell` ni `dialog` (solo declaran su panel).
- **Editor de vídeo (sección 4.8 del plan, MUY IMPORTANTE)**: código propio y aislado en `plugins/video/` (puerta única `index.js`, contacto
  con el resto sólo por `plugins/video/bridge/`, comprobado con `tools/verify/aislamiento.mjs`), menú **«Vídeo» exclusivo** en
  escritorio y móvil (no es un submenú de IA) y arquitectura profesional y escalable (registros de efectos y códecs, proyecto con
  versión, motor sin DOM). Antes de programarlo, `docs/VIDEO.md` aprobado por el titular (F15.0).
- **Modelos**: se anotan en `docs/MODELOS.md` (propósito, tamaño, licencia de pesos y de datos, origen, `sha256`). Hasta ~30 MB
  van en `assets/models`; los más grandes, en Hugging Face con la revisión (`HF_REV`) y el `sha256` fijados. El catálogo
  se reparte por familia en `js/ai/models/` y las tareas del worker en `js/ai/tasks/`.
- **Pruebas**: `tests/ia/<familia>/`, además de `calidad-herramienta` y `npm run verify`.

## Límites
- **Unmark** (eliminación de marcas de agua) **sí se puede mejorar** (decisión del titular, 5 nov 2026); el alcance de cada
  mejora se define con él antes de empezar.
- **Editor de cuerpo**: sólo deforma y ajusta luz y color; nunca genera piel ni ropa. Perfiles adulto (hombre, mujer) e infantil
  (niño, niña): el infantil no tiene mandos de pecho, caderas, glúteos ni definición muscular y usa rangos reducidos; si las
  proporciones sugieren un menor, se parte del perfil infantil. Ningún modelo estima la edad ni el sexo: el perfil lo elige la persona.

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
