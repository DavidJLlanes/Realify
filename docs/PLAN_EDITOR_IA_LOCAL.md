# Plan de acción · Realify como editor completo con IA local

> **Documento vivo.** Se tacha (`[x]`) lo hecho con su versión, igual que en [`PENDIENTE.md`](PENDIENTE.md).
> Redactado el 5 nov 2026 sobre la v298 (release 1.0.0) y actualizado ese mismo día con las decisiones del titular (licencias,
> Unmark, restricciones del editor de cuerpo). **Este documento no contiene cambios de código**: es solo el plan.

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho (con la versión, p. ej. `[x] F3.2 … (v312)`).

**Contenido:** 1 Objetivo · 2 Reglas que mandan · 3 Decisiones · 4 Arquitectura del código · 5 Menús IA y cajón del móvil ·
6 Mapa de funciones → fase · 7 Fases 0 a 16 · 8 Modelos y licencias · 9 Criterios de «hecho» · 10 Riesgos · 11 Fuera de este plan ·
12 Registro de avance.

---

## 1. Objetivo

Ampliar Realify, hoy centrado en «humanizar imágenes de IA», hasta un **editor fotográfico completo y privado**: retrato,
cuerpo, ropa, escena, restauración, estilo, lotes, asistente y vídeo. Todo se ejecuta en el dispositivo (móvil incluido):
la imagen del usuario nunca sale del equipo y los modelos se descargan solo cuando se usan.

Principio técnico: **la IA entiende la imagen** (máscaras, puntos del cuerpo y de la cara, profundidad) y **los efectos los
aplican motores propios** en coma flotante y luz lineal. Solo se genera contenido donde ya se hace hoy (rellenar huecos con
LaMa) o donde una función lo necesita de forma explícita y acotada.

La simulación de cámara de Realify sigue siendo la seña de identidad: el resto de herramientas se construyen alrededor.

---

## 2. Reglas que mandan

Salen de [`CLAUDE.md`](../CLAUDE.md) y del encargo. Si una tarea choca con una regla, manda la regla y se pregunta.

| Regla | Qué implica en este plan |
|---|---|
| Responder y documentar en español | Textos de interfaz, guía, comentarios de cabecera y este plan |
| **Móvil y escritorio siempre** | Cada función se prueba y se entrega en los dos modos, con el diseño actual de cada uno |
| Funciones de IA nuevas **solo Premium 👑**, sin versión básica ni interruptor | Todo lo nuevo usa el procesado de alta calidad («el bueno y el mejor»); en menú y cajón llevan «Premium 👑» y la corona. De momento sin pago |
| Modelos: bajo demanda, avisando del tamaño, guardados en IndexedDB | Se reutiliza `confirmDownload` de `js/ai/runtime.js` |
| Modelos: **el de más calidad que pueda ejecutar un móvil de gama media, con cualquier licencia** | Decisión del titular (5 nov 2026): se aceptan también los de uso no comercial; se anotan en `docs/MODELOS.md` con `noncommercial: true`, y hay que sustituirlos si algún día se cobra Premium |
| **Interfaces: simple o pantalla completa estilo collage** (decisión del titular, 5 nov 2026) | Pocas opciones → interfaz simple como las que ya hay; muchas opciones → editor a pantalla completa con zoom (armazón de `fsshell`, como el collage), en móvil y escritorio. Un solo código para los dos tipos: sección 4.7 |
| Vista previa de la imagen prioritaria; interfaz **mínima** en móvil | Pocas filas, sin miniaturas aparte, sin textos de ayuda que quiten sitio |
| Desplegables siempre cerrados; el teclado no tapa lo que se escribe | Se usa `js/ui/kit/keyboard.js` |
| Resultados a **capa nueva** siempre que se pueda (con «mezcla» %) | `markMixLayer`; las funciones que cambian el tamaño abren pestaña nueva |
| Comando nuevo → `js/app/commands/<dominio>.js`; nada en `js/main.js` | Ver 4.5 |
| Capas del código (`node tools/verify/layers.mjs`) | `js/features/` (capa 2) no importa de `plugins/` (capa 4); los plugins se cargan con `import()` |
| Librerías pesadas bajo demanda (`ensureVendor`), nunca en `index.html` | LLM, voz y vídeo |
| **Unmark sí se puede mejorar** (decisión del titular, 5 nov 2026) | Tarea F11.7; el alcance se define con él antes de empezar |
| Versionado: contador de compilación (siempre) + semver (según el cambio); actualizar `CHANGELOG.md`, la guía y los README | Parte de «hecho» en cada fase |
| Tras tocar una herramienta: `node tests/calidad-herramienta.mjs <comando>` en móvil y escritorio; no publicar con FALLO | Parte de «hecho» |
| Subir a `main` solo cuando el usuario lo pida | El despliegue lo hace el titular a mano con `git` en el VPS (el flujo de GitHub Actions está desactivado) |
| **No tocar** las pestañas **Básicos** y **Automáticos** del cajón | Prueba de regresión desde la Fase 0 (F0.2) |

---

## 3. Decisiones

**Tomadas**

- **Premium siempre.** No hay interruptor ni modo básico en nada de lo nuevo (regla de `CLAUDE.md`).
- **Una carpeta por función**, con la misma plantilla, y un **manifiesto** por función como única fuente de verdad del menú de
  escritorio, el cajón del móvil, la lista del menú ☰ del móvil y el registro de comandos (4.2 y 4.5).
- **Archivos pequeños.** Objetivo ≤ 250 líneas, tope 400. Hoy la mediana del proyecto es de 153 líneas y solo el 10 % pasa de 449.
- **Primero el esqueleto.** La Fase 1 deja listos los submenús y el cajón; las fases siguientes solo añaden entradas.
- **Modelos: el mejor que pueda ejecutar un móvil de gama media** (medido en un dispositivo real), con cualquier licencia, también
  las de uso no comercial (D2, resuelta el 5 nov 2026). Cada modelo se anota en `docs/MODELOS.md`.
- **Seguridad del editor de cuerpo** (Fase 6, **confirmada por el titular el 5 nov 2026**): solo deformación geométrica y de luz o color, nunca síntesis de piel ni de
  ropa; perfiles adulto (hombre, mujer) e infantil (niño, niña) con mandos distintos; el perfil infantil no incluye mandos de
  pecho, caderas ni glúteos y usa rangos reducidos; si las proporciones sugieren un menor, el perfil infantil es el de partida.
  No se usa ningún modelo que estime edad o sexo: el perfil lo elige la persona.
- **Interfaces** (decisión del titular, 5 nov 2026): la **cara tiene su propio editor a pantalla completa que hace zoom en la cara**
  (`plugins/face-editor/`); el cuerpo tiene el suyo (`plugins/body-editor/`). En general, una función con **muchas opciones** usa un editor
  a pantalla completa del estilo del collage (`plugins/social-post`: zoom con rueda, pellizco y doble clic, barra superior, panel
  lateral en escritorio y un mando cada vez en móvil), y una función **simple** usa una interfaz simple como las que ya hay
  (`dialog()` / `runAdjust`). **Prioridad absoluta: no duplicar código** (4.7).

**Decisiones del titular (D1 a D6, resueltas el 5 nov 2026)**

- [x] D1 · ¿Dónde viven los modelos nuevos? **Hasta ~30 MB dentro del repositorio (`assets/models`); los más grandes en Hugging Face
      con la revisión (`HF_REV`) y el `sha256` fijados** (5 nov 2026). `assets/models` ya pesa 326 MB.
- [x] D2 · ¿Se aceptan modelos de uso no comercial? **Sí**: se elige lo mejor que pueda ejecutar un móvil, con cualquier licencia (5 nov 2026)
- [x] D3 · ¿Se añaden las funciones nuevas también a otras pestañas del cajón? **Sí: a «Inteligencia Artificial» y a las pestañas
      afines de cada una** (tabla en 5.2); nunca a Básicos ni Automáticos (5 nov 2026)
- [x] D4 · LLM del asistente: **Qwen2.5 1,5B Instruct** (Apache-2.0). Si en la medición del F14.1 no cabe o va demasiado lento en un
      móvil de gama media, se baja a la de 0,5B y se anota aquí (5 nov 2026)
- [x] D5 · Límites del vídeo: **se miden primero**; no se fijan números hasta terminar el estudio F15.1, con móviles reales (5 nov 2026)
- [x] D6 · Presentación: **«editor completo con IA local»** como mensaje principal, con la simulación de cámara de Realify como sello
      propio. Los textos los redacta Claude en la Fase 16 (F16.1) y el titular los aprueba (5 nov 2026)

---

## 4. Arquitectura del código

### 4.1 Árbol de carpetas (todo lo nuevo, en archivos y carpetas nuevos)

```
js/
├─ ai/
│  ├─ models.js                    (existe) pasa a fachada que reexporta
│  ├─ models/                      NUEVO · catálogo por familia: segmentation, people, faces, depth, enhance, inpaint, language, audio
│  ├─ worker.js                    (existe) pasa a despachador de mensajes (≈100 líneas)
│  ├─ tasks/                       NUEVO · una tarea del worker por archivo (matte, inpaint, upscale, pose, landmarks, hands, humanparse, deblur, clip, llm, whisper…)
│  └─ people/                      NUEVO · API única de análisis de personas (Fase 2)
├─ features/
│  ├─ ai-kit/                      NUEVO · piezas comunes de las funciones de IA (Fase 0)
│  ├─ portrait/                    NUEVO · retrato: una subcarpeta por función + shared/
│  ├─ relight/                     NUEVO · normales a partir de la profundidad y luz direccional (Fase 4)
│  ├─ warp/                        NUEVO · motor de deformación (Fase 5)
│  ├─ body/                        NUEVO · motor y perfiles del editor de cuerpo (Fase 6)
│  ├─ clothing/                    NUEVO · ropa y tejidos (Fase 7)
│  ├─ scene/                       NUEVO · escena, cielo y color (Fase 8)
│  ├─ restore/                     NUEVO · desenfoque, polvo, moiré (Fase 9)
│  ├─ objects/                     NUEVO · pincel inteligente, borrado ligero, texto sin tapar (Fase 10)
│  ├─ authenticity/                NUEVO · realismo y autenticidad (Fase 11)
│  ├─ style/                       NUEVO · color por referencia, estilos de cámara, presets (Fase 12)
│  ├─ library/                     NUEVO · lotes, búsqueda, etiquetas (motor de la Fase 13)
│  └─ assistant/                   NUEVO · asistente (Fase 14)
├─ app/commands/
│  ├─ ai.js                        (existe) fachada: sus 19 comandos + importa ai/*.js
│  └─ ai/                          NUEVO · un archivo por familia (portrait, body, clothing, scene, restore, objects, authenticity, style, library, assistant)
├─ ui/kit/                          (capa «kit»: la pueden importar los motores y los plugins)
│  ├─ params-panel.js              NUEVO · pinta los mandos de cualquier función a partir de su `params` (Fase 0)
│  └─ ai-editor/                   NUEVO · armazón común de los editores a pantalla completa, sobre `fsshell` (Fase 0)
└─ ui/
   ├─ menu/ia/                     NUEVO · árbol declarativo del menú IA (un archivo por submenú)
   └─ help/topics/ia-*.js          NUEVO · un tema de guía por familia
plugins/
├─ face-editor/                    NUEVO · editor de cara a pantalla completa con zoom en la cara (Fase 3; crece en 4 y 6)
├─ body-editor/                    NUEVO · pantalla completa del editor de cuerpo (Fase 6)
├─ clothing-editor/                NUEVO · editor de ropa y tejidos a pantalla completa (Fase 7)
├─ culling/                        NUEVO · selección rápida de lotes (Fase 13)
└─ video/                          NUEVO · editor de vídeo (Fase 15)
tests/ia/                          NUEVO · pruebas por familia + baseline + fixtures
tools/models/                      NUEVO · conversión, cuantización y sumas de comprobación de modelos
tools/scaffold/                    NUEVO · generador de funciones nuevas
docs/MODELOS.md                    NUEVO · registro de modelos y licencias
```

Capas: los motores (`js/features/*`, `js/ai/*`) son capa 2; los plugins (`plugins/*`), capa 4; los comandos (`js/app/commands/*`),
capa 5, que cargan todo con `import()`.

### 4.2 Plantilla de función (una carpeta por función)

```
js/features/<familia>/<función>/
├─ README.md       qué hace, modelos, parámetros, límites, cómo probarla (≤ 40 líneas)
├─ manifest.js     DATOS: cmd, nombre del menú, nombre corto del cajón, icono, ayuda, submenú, params (rangos), ui ("simple" | "editor" + grupo), load()
├─ index.js        fachada: export async function open<Nombre>() (≤ 40 líneas, solo conecta)
├─ ui.js           SOLO declara el panel de mandos (a partir de `params`) y la vista previa; no monta ventanas propias (4.7); sin cálculo de píxeles
├─ controller.js   flujo: analizar → previsualizar → aplicar → capa nueva (≤ 250)
├─ analysis.js     llamadas a modelos y máscaras (usa ai-kit)
├─ engine.js       cálculo de píxeles PURO (sin DOM; se prueba en Node)
└─ params.js       valores por defecto y rangos, si no caben en el manifiesto
```

Reglas: una responsabilidad por archivo; el motor no conoce la interfaz ni el DOM; la interfaz no calcula píxeles; si un archivo
pasa de 300 líneas se divide por etapas (`engine/etapa-1-….js`). Cabecera de cada archivo con el banner `═` en español: qué hace,
entradas y salidas, decisiones y límites. Nombres en minúsculas con guiones. Lo que usan varias funciones de una familia va en
`<familia>/shared/`; lo que usan varias familias, en `js/features/ai-kit/`.

### 4.3 `js/features/ai-kit/` (se extrae en la Fase 0 sin cambiar comportamiento)

Hoy `facetools.js` y `depthtools.js` repiten helpers como `toNewLayer`. El kit los reúne:
`visible-image.js` (imagen compuesta visible), `new-layer.js` (capa nueva + deshacer + «mezcla»), `session.js` (sesión de IA con
progreso y cancelar), `masks.js` (pluma, unión, resta, borde refinado), `preview.js` (vista previa reducida y aplicación a
resolución completa por bloques), `float.js` (luz lineal, OKLab, tramado), `model-gate.js` (aviso de descarga y errores de memoria).

### 4.4 Procesado Premium común («el bueno y el mejor»)

Cada función documenta en su `README.md` qué hace en cada nivel, como ya hacen `faces.js` y `zerodce.js`:

- **Bueno:** análisis a baja resolución, máscaras ajustadas a la foto, efecto en coma flotante y luz lineal.
- **Mejor:** análisis a más resolución o por bloques, borde refinado a resolución completa, color en OKLab con mapeo de gama,
  tramado y respeto del grano original.

Se parte de lo ya existente: `js/editor/render/floatfilter.js`, `js/ai/tiles.js`, `refineedge-math.js`, `js/core/colorspace.js`.

### 4.5 Un manifiesto, cuatro salidas

`manifest.js` es solo datos más un `load: () => import("./index.js")` (la ruta literal permite que `static-check` la compruebe).
De él salen, sin escribir nada a mano dos veces:

1. la entrada del **menú de escritorio** (submenú y orden);
2. la entrada del **cajón del móvil** (pestaña «Inteligencia Artificial» y su sub-pestaña);
3. la entrada de la lista **☰ del móvil**;
4. el **comando** (`js/app/commands/ai/<familia>.js` lo registra con `registerAll`).

El campo `ui` del manifiesto dice cómo se abre: `"simple"` (diálogo) o `{ editor: "face", group: "ojos" }` (el editor a pantalla
completa, abierto en ese grupo). Además deja preparado el esquema de parámetros (`params`) que usará el asistente de la Fase 14 para ejecutar acciones sin código libre.

### 4.6 Pruebas

`tests/ia/<familia>/<función>.mjs` (motor en Node puro + interfaz con Playwright), `tests/ia/baseline/` (huellas), `tests/ia/fixtures/`
(imágenes sintéticas o CC0 con su autoría anotada). Además, siempre `node tests/calidad-herramienta.mjs <comando>`.

### 4.7 Interfaces: simple o pantalla completa (sin duplicar código)

**Regla de elección** (la decide el manifiesto de cada función, campo `ui`):

| Criterio | Interfaz |
|---|---|
| Hasta 4 mandos globales, el efecto se ve en la propia imagen, sin señalar zonas ni personas | **Simple**: como las que ya hay (`dialog()` / `runAdjust`, con el interruptor de aplicar y la vista previa de la imagen) |
| Más de 4 mandos, varias personas o zonas, puntos que arrastrar, zoom para ver el detalle, antes/después | **Editor a pantalla completa**, del estilo del collage: armazón `fsshell` (barra superior, deshacer/rehacer, zoom con rueda, pellizco, doble clic y Ctrl + / − / 0, desplazar arrastrando), panel lateral en escritorio y un mando cada vez en móvil |
| Una función simple que gane mandos o necesite señalar zonas | Pasa a editor cambiando una línea del manifiesto, sin tocar su motor |

**Tres piezas comunes, escritas una vez** (Fase 0):

1. `js/ui/kit/params-panel.js`: pinta deslizadores, interruptores, chips y selectores **a partir del `params` del manifiesto**. Lo usan
   el diálogo simple y el editor. Es el único sitio donde se dibuja un mando de las funciones nuevas.
2. `js/ui/kit/ai-editor/`: el armazón común de los editores sobre `createShell` de `fsshell` (no se reescribe zoom ni barra). Añade lo
   que comparten: selector de persona o cara, **zoom automático a un objetivo** (`zoomTo(caja)`), chips de grupo, antes/después,
   deshacer por función, interruptor Premium con `dockPremium`, capa de resultado nueva con «mezcla» (`ai-kit/new-layer.js`) y
   vista previa por bloques (`ai-kit/preview.js`).
3. Las funciones **no montan ventanas**: su `ui.js` exporta el panel (sus mandos y su vista previa). El host (diálogo simple o
   editor) lo monta. El mismo panel sirve en los dos hosts.

**Cada editor es solo configuración** (≈ 100 líneas): qué objetivo hace zoom, qué grupos tiene y qué funciones van en cada grupo.
No contiene motor ni mandos propios.

| Editor | Carpeta | Zoom y objetivo | Grupos (cada uno es una o más funciones) |
|---|---|---|---|
| **Cara** | `plugins/face-editor/` | **Zoom en la cara elegida** (caja y puntos de F2); selector si hay varias | Piel (arrugas, ojeras, brillos, textura, imperfecciones) · Ojos · Labios y cejas · Dientes · Pelo · Gafas · Luz · Forma |
| **Cuerpo** | `plugins/body-editor/` | Persona entera; zoom a la parte tocada (hombros, cintura, piernas…) | Silueta · Cabeza y cuello · Torso · Brazos · Piernas · Postura · Definición · Piel del cuerpo |
| **Ropa y tejidos** | `plugins/clothing-editor/` | La prenda o zona tocada | Planchar arrugas · Color · Textura · Telas y fondos |
| Existentes reutilizados | `plugins/cameras`, `plugins/social-post`… | — | No se tocan; los nuevos usan su mismo armazón |

**Interfaz de cada familia**

| Familia | Fase | Interfaz |
|---|---|---|
| Piel, ojos, boca, pelo, gafas, luz y forma de la cara | 3, 4, 6 | **Editor de cara** (las entradas del menú son accesos directos al grupo) |
| Cuerpo | 6 | **Editor de cuerpo** |
| Ropa y tejidos | 7 | **Editor de ropa** |
| Escena, cielo y color (mejorar cielo, neblina, luces, balance por zonas…) | 8 | Simple (los mandos globales se ven en la imagen); «Realzar por tipo» y «Balance por zonas» pasan a editor si superan el límite |
| Restaurar y limpiar (desenfoque, polvo, moiré) | 9 | Simple |
| Pincel inteligente y borrado ligero | 10 | Herramientas del lienzo (como las que ya hay) |
| Texto sin tapar, informe de realismo, etiquetas, texto alternativo, búsqueda | 10, 11, 13 | Simple |
| Estilo desde una foto, estilos de cámara | 12 | Editor a pantalla completa (dos imágenes y zonas), con el armazón común |
| Selección rápida de lotes | 13 | Editor a pantalla completa (`plugins/culling/`) |
| Asistente | 14 | Simple (panel de texto) |
| Vídeo | 15 | Editor a pantalla completa (`plugins/video/`) |

**Reglas para no duplicar** (las vigila la revisión de cada fase y `tests/ia/interfaces.mjs`):

- Ninguna función importa `fsshell` ni `dialog` directamente: solo el host lo hace.
- Ningún editor ni función dibuja un deslizador a mano: todos usan `params-panel.js`.
- Si dos editores necesitan lo mismo (selector de persona, zoom a objetivo, comparar), se añade al armazón `ai-editor/`, no al editor.
- Los estilos van en `css/fsplugin.css` (ya existe) y, si hace falta, en un solo `css/ai-editor.css`; nada de CSS por función.
- Móvil y escritorio comparten el mismo código del editor; solo cambia la disposición (la decide `fsshell`).

---

## 5. Menús IA y cajón del móvil

### 5.1 Árbol final del menú «Inteligencia Artificial» (escritorio: un solo nivel de submenús)

El menú de escritorio solo admite **un nivel** de submenú, así que el árbol es: submenús → entradas (con `header` de sección dentro
del submenú cuando haga falta). Un submenú sin entradas listas **no se muestra**.

| # | Submenú | Entradas que ya existen | Entradas nuevas (comando propuesto · fase) |
|---|---|---|---|
| 1 | **Seleccionar** | Selección con un toque 👑, Seleccionar sujeto, Seleccionar cielo, Seleccionar por texto 👑, Seleccionar por profundidad 👑 | Seleccionar partes `ai.partsSelect` (F2) · Pincel inteligente `ai.smartBrush` (F10) |
| 2 | **Borrar y rellenar** | Borrador mágico 👑, Eliminar fondo, Expandir con IA | Borrado ligero (móvil) `ai.quickErase` (F10) |
| 3 | **Retrato** | Difuminar caras 👑, Retoque de cara 👑, Restaurar caras 👑, Ojos rojos 👑 | Arrugas `ai.skinWrinkles`, Ojeras y bolsas `ai.darkCircles`, Brillos de la piel `ai.skinShine`, Textura de piel `ai.skinTexture`, Imperfecciones y tono `ai.skinEven` (F3) · Ojos `ai.eyes`, Labios y cejas `ai.lipsBrows`, Dientes `ai.teeth`, Cabello `ai.hair`, Pelos sueltos `ai.flyawayHair`, Reflejos en gafas `ai.glassesGlare`, Luz en la cara `ai.faceRelight`, Mirada y ojos cerrados `ai.eyeGaze` (F4) · Forma de la cara `ai.faceShape` (F6) |
| 4 | **Cuerpo** | — | Editor de cuerpo `ai.bodyEditor`, Silueta y proporciones `ai.bodyShape`, Postura `ai.bodyPosture`, Definición y tono `ai.bodyTone`, Piel del cuerpo `ai.bodySkin` (F6) |
| 5 | **Ropa y tejidos** | — | Planchar arrugas de ropa `ai.clothesWrinkles`, Cambiar color de prendas `ai.recolorClothes`, Arrugas de telas y fondos `ai.fabricWrinkles`, Textura de tejido `ai.fabricTexture` (F7) |
| 6 | **Escena y cielo** | Reemplazar cielo (pasa aquí desde «Borrar y rellenar»), Adaptive Photo Lens (pasa aquí desde «Mejorar») | Mejorar cielo `ai.skyEnhance`, Quitar neblina con IA `ai.dehaze`, Realzar por tipo `ai.categoryBoost`, Balance de blancos por zonas `ai.zonedWhiteBalance`, Recuperar luces `ai.highlightRecovery`, Unificar iluminación `ai.harmonize` (F8) |
| 7 | **Profundidad** | Desenfoque por profundidad 👑, Niebla por distancia 👑, Luz por profundidad 👑, Separar planos 👑, Foto 3D 👑 | Aberración por distancia `ai.depthChroma`, Luz direccional `ai.depthRelight` (F8) |
| 8 | **Mejorar y restaurar** | Ampliar con IA, Reducción de ruido con IA, Quitar artefactos JPEG con IA, Iluminar con IA 👑, Colorear con IA | Quitar desenfoque `ai.deblur`, Polvo y motas `ai.dustSpots`, Moiré y bandas `ai.moire` (F9) |
| 9 | **Encuadre y composición** | Recorte inteligente para redes 👑, Recorte de retrato 👑 | Texto sin tapar sujetos `ai.textPlacement` (F10) |
| 10 | **Color y estilos** | — | Estilo desde una foto `ai.styleFromReference`, Estilos de cámara `ai.cameraPacks`, Mis estilos `ai.myStyles` (F12) |
| 11 | **Lote y biblioteca** | — | Selección rápida `ai.culling`, Buscar fotos por texto `ai.searchPhotos`, Etiquetas y nombres `ai.autoTags`, Texto alternativo `ai.altText` (F13) |
| 12 | **Asistente** | — | Pídeselo a Realify `ai.assistant` (F14) |
| 13 | **Vídeo** | — | Editor de vídeo `ai.videoEditor` (F15) |
| 14 | **Realismo y autenticidad** (antes «Para imágenes de IA») | Realify, Realify Premium 👑, PurePixel, Unmark, Plausibilidad, Segunda opinión, Limpiar metadatos | Zonas demasiado lisas `ai.smoothZones`, Manos y dientes sospechosos `ai.aiArtifacts`, Informe de realismo `ai.photoReport` (F11) |

Las entradas de **Retrato** (piel, ojos, labios, dientes, pelo, gafas, luz, forma) y de **Cuerpo** y **Ropa y tejidos** son **accesos
directos al mismo editor, abierto en su grupo** (4.7); cada una conserva su comando propio, su sitio en el menú y en el cajón.

Orden en el menú, con separadores entre grupos: *(Seleccionar, Borrar y rellenar)* · *(Retrato, Cuerpo, Ropa y tejidos)* ·
*(Escena y cielo, Profundidad, Mejorar y restaurar, Encuadre y composición, Color y estilos)* · *(Lote y biblioteca, Asistente, Vídeo)* ·
*(Realismo y autenticidad)*. Dentro de cada submenú, primero lo existente (sin cambiar su `cmd`, su etiqueta ni su ayuda) y después lo nuevo.

### 5.2 Cajón del móvil

- Las dos primeras pestañas, **Básicos** y **Automáticos**, no se tocan: ni su orden, ni su contenido, ni `BASICS`, ni el
  orden de `CATS`. Ninguna entrada nueva lleva `basicos` ni `auto`.
- La pestaña **Inteligencia Artificial** gana una **segunda fila de chips** con los mismos 14 submenús, en el mismo orden, más
  «Todo». Cada chip filtra la cuadrícula; los títulos de sección (`td-sec`) son los de las secciones del submenú. El chip activo se
  recuerda. Con algo escrito en el buscador se busca en todos los chips, como hoy.
- **Pestañas afines (D3).** Cada función nueva aparece también en las pestañas que le corresponden, indicadas en el campo `tabs`
  de su manifiesto, y siempre en «Todos». Las entradas que ya existen **conservan** las pestañas que tienen hoy.

  | Submenú | Pestañas afines (además de «Inteligencia Artificial») |
  |---|---|
  | Seleccionar | Selección |
  | Borrar y rellenar | Retoque |
  | Retrato, Cuerpo, Ropa y tejidos | Retoque |
  | Escena y cielo | Mejorar; Color (balance de blancos, realzar por tipo, unificar iluminación) |
  | Profundidad | Efectos |
  | Mejorar y restaurar | Mejorar; Corregir (desenfoque, polvo, moiré) |
  | Encuadre y composición | Corregir |
  | Color y estilos | Estilo; Color |
  | Lote y biblioteca | Analizar |
  | Asistente | — (solo IA y Todos) |
  | Vídeo | Creativo |
  | Realismo y autenticidad | Analizar (informe y zonas lisas) |

- El deslizamiento lateral entre pestañas sigue igual; la fila de chips se desliza sola, sin cambiar de pestaña.
- `iaOrder` pasa a recorrer también los submenús; `checkCoverage` avisa en consola si un comando del menú IA no tiene entrada.

### 5.3 Menú ☰ del móvil

`flattenForMobile` hoy antepone el nombre del grupo a cada entrada («Grupo: Entrada»). Con 14 submenús eso daría etiquetas largas:
el submenú IA se aplana con **un título de sección por submenú** (`flattenAsHeader: true`) y sus entradas debajo, con el buscador
funcionando igual.

### 5.4 Cambios en el código del menú (mínimos y localizados)

- `buildSubPop` / `submenuRow` (`js/ui/menu.js`): admitir `header` dentro de un submenú, desplazamiento si el submenú es más alto que la
  pantalla y navegación por teclado.
- `js/ui/menu/data.js` solo importa `IA_MENU` desde `js/ui/menu/ia/index.js`; el resto de menús no se toca.
- `js/ui/tooldrawer.js`: las entradas de IA de `ITEMS` pasan a salir de los manifiestos; el resto de `ITEMS` no cambia.

---

## 6. Mapa de funciones → fase

Origen: **E** = revisión de Evoto · **M** = modelos de IA en móvil · **I** = ideas de IA local · **R** = retoques extra ·
**A** = ampliar el enfoque · **H** = pedido de hoy.

| # | Función | Origen | Estado hoy | Fase |
|---|---|---|---|---|
| 1 | Retoque de piel por zonas que conserva textura | I | Parcial («Retoque de cara», «Retoque de retrato», «Separación de frecuencias») | F3 |
| 2 | **Eliminación de arrugas** de cara, cuello y manos | H | No | F3 |
| 3 | Ojeras y bolsas | I, R | No | F3 |
| 4 | Brillos y reflejos de la piel | R | No | F3 |
| 5 | Textura de piel realista (poros y grano en zonas lisas) | E, I | No | F3 |
| 6 | Imperfecciones, acné, manchas y tono uniforme | E | Parcial (Pincel corrector manual) | F3 |
| 7 | Dientes más blancos y ojos más vivos | R | Sí, dentro de «Retoque de cara» | F4 (afinar) |
| 8 | Labios y cejas | R | Labios sí; cejas no | F4 |
| 9 | Reflejos en gafas | I, R | No | F4 |
| 10 | Pelos sueltos | E, I | No | F4 |
| 11 | Cabello: color, volumen, brillo | R | No | F4 |
| 12 | Ojos rojos | R | Sí | — |
| 13 | Ojos cerrados y mirada | I | No | F4 (investigación) |
| 14 | Luz en la cara (relighting facial) | R | No | F4 |
| 15 | Restaurar y difuminar caras | — | Sí | — |
| 16 | **Editor de cuerpo completo: hombre, mujer, niño y niña** (altura, cabeza, cuello, hombros, pecho, cintura, caderas, glúteos, brazos, manos, piernas, pies) | H, I | No (hay «Licuar» y «Deformación de posición libre» manuales) | F5 + F6 |
| 17 | Postura | H | No | F6 |
| 18 | Definición muscular y tono | H, R | No | F6 |
| 19 | Piel del cuerpo (suavizar, uniformar, bronceado) | H | No | F6 |
| 20 | Forma de la cara (mandíbula, mentón, nariz, ojos, labios) | H | No | F6 |
| 21 | **Planchar arrugas de ropa** | R, H | No | F7 |
| 22 | Cambiar color de prendas | R | No | F7 |
| 23 | Arrugas de telas y fondos (sábanas, cortinas) | H | No | F7 |
| 24 | Textura de tejido coherente | R | No | F7 |
| 25 | Adaptive Photo Lens (escena y presets) | I | Sí | — |
| 26 | Color Match por foto de referencia | E, I | Parcial («Igualar color…») | F12 |
| 27 | Corrección automática de horizonte y perspectiva | I | Sí | — |
| 28 | Balance de blancos por zona | I | No | F8 |
| 29 | Recuperación de luces | I | Parcial («Sombras / Iluminaciones…», «Tono HDR…») | F8 |
| 30 | Reducción de ruido y poca luz | M | Sí | — |
| 31 | Superresolución | M | Sí («Ampliar con IA») | — |
| 32 | Mejorar cielo y sustituirlo | R | Sustituir sí; mejorar no | F8 |
| 33 | Quitar neblina (con profundidad) | R | Parcial («Quitar neblina…» clásico) | F8 |
| 34 | Realzar agua, follaje, cielo y piel por máscaras | R | No (el modelo ADE20K ya distingue 150 clases) | F8 |
| 35 | Unificar iluminación entre sujeto y fondo | R | No | F8 |
| 36 | Aberración cromática y neblina que crecen con la distancia | M | Niebla sí; aberración no | F8 |
| 37 | Luz direccional con relieve (normales desde la profundidad) | R | No | F8 |
| 38 | Polvo y motas del sensor | R | Parcial («Mediana / polvo…», «Pincel corrector») | F9 |
| 39 | Moiré y bandas | R | No | F9 |
| 40 | Quitar desenfoque de movimiento y de enfoque | R | Parcial (nitidez clásica) | F9 |
| 41 | Limpiar ruido antes de añadir el grano de sensor | R | Parcial | F9 / F11 |
| 42 | Corrección de lente y viñeteado automática | R | Sí | — |
| 43 | Segmentación de piel y de personas | M | Sí (BodyPix, MODNet, BiSeNet) | F2 (mejorar con partes del cuerpo) |
| 44 | Puntos de la cara (landmarks) | M | Parcial (YuNet: 5 puntos) | F2 |
| 45 | Mapa de profundidad y bokeh | M | Sí | — |
| 46 | Recorte de fondo | M | Sí | — |
| 47 | Selección inteligente / pincel inteligente | I | Selección con un toque sí; pincel no | F10 |
| 48 | Borrado de objetos (LaMa) y versión ligera para móvil | I | LaMa sí; ligero no | F10 |
| 49 | Reencuadre automático y sugerencias de recorte | I | Sí («Recorte inteligente») | F10 (varias propuestas) |
| 50 | Colocar texto o marcas de agua sin tapar sujetos | I | No | F10 |
| 51 | Detectar zonas «demasiado lisas» y proponer grano, poros o trama | R | No | F11 |
| 52 | Manos y dientes raros de IA (avisar) | R | No | F11 |
| 53 | Puntuación de «aspecto IA» antes y después | M | Parcial («Plausibilidad», «Segunda opinión») | F11 |
| 54 | Informe por imagen (nitidez, ruido, rango dinámico, metadatos) | I, A | Parcial (Análisis de nitidez, Histograma, Inspector de metadatos) | F11 |
| 55 | Antes y después comparable con puntuación de realismo | R | Parcial («Comparar antes/después») | F11 |
| 56 | Presets guardables, exportables y compartibles | E, A | Parcial (Acciones, Estilos, LUT) | F12 |
| 57 | Packs de estilos de cámara (película, móvil, réflex) | A | Parcial («Cámaras…», «Filtro Vintage…», «Estilos…») | F12 |
| 58 | Ajustes sugeridos por «estilo objetivo» | I | No | F12 |
| 59 | Selección rápida de lotes (borrosas, ojos cerrados, duplicados, nitidez, composición) | E, I | Parcial («Análisis de nitidez», «Apilar fotos») | F13 |
| 60 | Búsqueda de fotos por texto (CLIP local) | I | No | F13 |
| 61 | Etiquetas y nombres de archivo automáticos | I | No | F13 |
| 62 | Texto alternativo (accesibilidad) | I | No | F13 |
| 63 | Exportación por lotes lista para redes | E, A | Parcial («Editar en lote», «Prueba para redes sociales») | F13 |
| 64 | Aplicar una edición a todo el lote | E | Sí | — |
| 65 | Asistente por texto o voz con un modelo pequeño | I | No | F14 |
| 66 | Vídeo: efectos de sensor y color, segmentación, estabilización | I, A | No | F15 |
| 67 | PWA instalable y sin conexión | E | Sí | F16 (comprobar modelos sin conexión) |
| 68 | EXIF realista | A | Parcial en Realify (coincidencia de EXIF) | F11 |
| 69 | Limpieza de marcas de IA (mejoras de Unmark) | A | Existe (Unmark) | F11 |
| 70 | Galería con enlace de entrega y sincronización entre dispositivos | E | No | Fuera (11) |

---

## 7. Fases

Cada fase se publica sola (como en `PENDIENTE.md`) y termina cuando cumple los criterios de la sección 9. Versiones propuestas
(semver; el contador de compilación sube siempre): F1 → 1.1.0, F3 → 1.2.0, F6 → 1.3.0, F7–F8 → 1.4.0, F9–F11 → 1.5.0, F12–F13 → 1.6.0,
F14 → 1.7.0, F15 → 1.8.0, F16 → 2.0.0.

### Fase P · Plan (esta tarea)
- [x] P.1 Revisión del repositorio en solo lectura (normas, menús, cajón, modelos, motores, pruebas).
- [x] P.2 Redacción de este plan y subida a una rama del repositorio.
- [x] P.3 Revisión del plan por el titular y resolución de las decisiones abiertas: D1 a D6, restricciones del editor de cuerpo y
      Unmark (5 nov 2026).
- [x] P.4 Plan en `main` (5 nov 2026).

### Fase 0 · Cimientos (sin funciones nuevas visibles)
Objetivo: dejar el terreno ordenado para que todo lo nuevo nazca bien organizado. Para el usuario no cambia nada.

- [ ] F0.1 `npm run verify` en verde y guardar en `tests/ia/baseline/` las huellas del menú IA y del cajón (incluidas Básicos y Automáticos).
- [ ] F0.2 Prueba `tests/ia/cajon-basicos-auto.mjs`: compara orden y contenido de **Básicos** y **Automáticos** con la línea base; se ejecuta en todas las fases.
- [ ] F0.3 Dividir `js/ai/worker.js` (798 líneas) en despachador + `js/ai/tasks/<tarea>.js` con `tools/migrate/lib/splitter.mjs`;
      comprobar con `units-equal.mjs`, `lint-refs.mjs` y las pruebas de IA existentes (`tests/clipseg.mjs`, `tests/restaurar-caras.mjs`, `tests/depth-viva.mjs`, `tests/matte.mjs`).
- [ ] F0.4 Dividir `js/ai/models.js` en `js/ai/models/<familia>.js` + fachada con la misma API (`MODELS`, `mb`).
- [ ] F0.5 Crear `js/features/ai-kit/` (4.3) y dejar `facetools.js` y `depthtools.js` usándolo sin cambiar su comportamiento.
- [ ] F0.6 `docs/MODELOS.md`: registro de los 24 modelos del catálogo y Zero-DCE++ (propósito, tamaño, licencia de pesos y de datos, origen, `sha256`, uso comercial, apto para móvil).
- [ ] F0.7 `tools/models/`: scripts documentados para convertir y cuantizar a ONNX y calcular `sha256`; fijar la revisión (`HF_REV`) para los modelos nuevos.
- [ ] F0.8 Plantilla de función (4.2) y generador `tools/scaffold/nueva-funcion-ia.mjs` (crea carpeta, manifiesto, prueba y entrada de comando).
- [ ] F0.9 `tools/verify/file-size.mjs`: avisa de archivos nuevos de más de 300 líneas (aviso, no bloquea; no toca los archivos antiguos).
- [ ] F0.10 `tests/ia/README.md` y `tests/ia/fixtures/` (imágenes sintéticas o CC0 con su autoría).
- [ ] F0.12 `js/ui/kit/params-panel.js`: pinta los mandos desde el `params` del manifiesto (deslizador, interruptor, chips, selector cerrado); lo usarán el diálogo simple y los editores. Prueba en Playwright, móvil y escritorio.
- [ ] F0.13 `js/ui/kit/ai-editor/`: armazón común de los editores sobre `createShell` (selector de persona o cara, `zoomTo(caja)`, chips de grupo, antes/después, deshacer por función, `dockPremium`, capa nueva con «mezcla»). No reescribe el zoom de `fsshell`. Prueba con un editor de ejemplo.
- [ ] F0.14 `tests/ia/interfaces.mjs`: ninguna función importa `fsshell` ni `dialog` directamente; ningún mando dibujado a mano; el campo `ui` de cada manifiesto es válido.
- [x] F0.11 Decisiones D1, D2 y D3 resueltas (5 nov 2026).

Hecho cuando: `npm run verify` verde, huellas de comandos y píxeles idénticas a la línea base, cero cambios visibles.

### Fase 1 · Menú IA con submenús y cajón del móvil
Objetivo: dejar los 14 submenús y el cajón listos, con todo lo existente ya colocado. Aún no hay funciones nuevas.
Depende de: F0.

- [ ] F1.1 Esquema del manifiesto y cargador `js/ui/menu/ia/index.js` + un archivo por submenú (`seleccionar.js`, `borrar.js`, `retrato.js`…).
- [ ] F1.2 Migrar las ~40 entradas actuales del menú IA a los manifiestos con **el mismo `cmd`, etiqueta y ayuda** (solo cambian de sitio).
- [ ] F1.3 Escritorio: `buildSubPop` con `header`, desplazamiento y teclado; los submenús vacíos no se muestran.
- [ ] F1.4 Móvil ☰: aplanado con un título por submenú (`flattenAsHeader`).
- [ ] F1.5 Cajón: fila de chips en la pestaña IA, `iaOrder` recursivo, memoria del chip, buscador global y campo `tabs` del manifiesto (pestañas afines, 5.2); **sin tocar Básicos ni Automáticos**.
- [ ] F1.6 Registro de comandos a partir de los manifiestos (`js/app/commands/ai/…` con fachada en `ai.js`).
- [ ] F1.7 Regenerar la huella de menús del `smoke` revisándola a mano (el cambio de estructura es intencionado).
- [ ] F1.8 Prueba `tests/ia/menu-ia.mjs`: cada comando IA aparece **una sola vez** en el menú, en el cajón (IA) y en ☰, en el mismo orden, en móvil y escritorio, y en las pestañas afines que dice su manifiesto; `cajon-basicos-auto` sigue en verde.
- [ ] F1.9 Guía: actualizar `js/ui/help/topics/ia.js` con los submenús; `CHANGELOG.md`.

Hecho cuando: nada de lo existente cambia de comportamiento, y las dos vistas muestran el mismo árbol.

### Fase 2 · Análisis de personas (base del retrato y del cuerpo)
Objetivo: una API única que diga quién hay en la foto y dónde está cada parte.
Depende de: F0.
Criterio de elección: el modelo de mayor calidad que corra en un móvil de gama media, medido; la licencia no descarta (D2).
Modelos candidatos: puntos de la cara (MediaPipe Face Landmarker), manos (MediaPipe Hand Landmarker), pose del cuerpo (RTMPose, MoveNet o BlazePose), partes del cuerpo y ropa (SegFormer o SCHP; licencia de los datos por revisar). Ver sección 8.

- [ ] F2.1 Medir los candidatos en un móvil de gama media (calidad, tiempo, memoria), registrar su licencia (pesos **y** datos) en
      `docs/MODELOS.md` y elegir el mejor que quepa.
- [ ] F2.2 Convertir a ONNX y probar WebGPU y WASM (`tools/models/`); anotar tamaños reales.
- [ ] F2.3 Tareas del worker: `tasks/landmarks.js`, `tasks/hands.js`, `tasks/pose.js`, `tasks/humanparse.js`.
- [ ] F2.4 `js/ai/people/analyze.js`: devuelve por persona `{ caja, cara (puntos), manos, pose, partes (máscaras), proporciones }`; Bueno = una pasada; Mejor = teselas para personas pequeñas y borde refinado.
- [ ] F2.5 `js/ai/people/cache.js`: caché por revisión del documento para que varias herramientas reutilicen el análisis.
- [ ] F2.6 `js/ai/people/profiles.js`: definición de los perfiles hombre, mujer, niño y niña (mandos, rangos, proporciones de referencia) — solo datos.
- [ ] F2.7 Nueva entrada «Seleccionar partes» `ai.partsSelect` (piel, pelo, ropa, brazos, piernas…) que produce selección o máscara de capa.
- [ ] F2.8 Pruebas con imágenes de varias personas, poses, tamaños y fondos; medir memoria y tiempo en un móvil de gama media.

Hecho cuando: el análisis funciona en móvil y escritorio, con cancelación y sin pasar de la memoria disponible.

### Fase 3 · Retrato I: piel y arrugas 👑
Objetivo: retoque de piel de calidad profesional que conserva la textura real.
Depende de: F1, F2.
Técnica (sin modelo nuevo salvo F2): zonas de la cara por puntos y partes; separación de frecuencias con filtro guiado en luz lineal;
detección de surcos con filtros de crestas (Hessiano o Frangi) limitada a cada zona; se atenúa la amplitud de baja y media frecuencia
del surco y se **reinyecta la textura fina** (poros).

- [ ] F3.0 **`plugins/face-editor/`** (editor de cara a pantalla completa, sobre `ai-editor/` de F0.13): zoom automático a la cara elegida, selector si hay varias, grupo «Piel» ahora; los demás grupos se añaden en F4 y F6. Solo configuración, sin mandos propios.
- [ ] F3.1 `js/features/portrait/shared/`: máscaras de piel por zonas (frente, entrecejo, contorno de ojos, surcos nasogenianos, comisuras, cuello, manos) y separación de frecuencias en coma flotante.
- [ ] F3.2 **`ai.skinWrinkles` · Arrugas**: frente, entrecejo, patas de gallo, surcos, cuello y manos; mandos: intensidad global, conservar textura, zonas.
- [ ] F3.3 `ai.darkCircles` · Ojeras y bolsas: igualar tono y luz sin borrar la textura.
- [ ] F3.4 `ai.skinShine` · Brillos de la piel: detectar zonas brillantes y atenuarlas sin apagar el reflejo de los ojos.
- [ ] F3.5 `ai.skinTexture` · Textura de piel: añadir poros y grano fino solo donde la piel es demasiado lisa (pieza clave de Realify).
- [ ] F3.6 `ai.skinEven` · Imperfecciones y tono: acné, manchas, rojeces; uniformar el tono por zonas.
- [ ] F3.7 Menús, cajón y ☰ (las 5 entradas, cada una abre el editor de cara en el grupo «Piel»; su `ui.js` solo declara el panel) y comandos; guía `ia-retrato.js`.
- [ ] F3.8 Pruebas: motor en Node (la atenuación no baja de un umbral de textura), `calidad-herramienta` por comando, móvil y escritorio, zoom a la cara, varias caras.

Hecho cuando: un retrato de IA muy liso gana textura y uno real pierde arrugas sin verse plástico, con el resultado en capa nueva con «mezcla».

### Fase 4 · Retrato II: ojos, boca, pelo, gafas y luz 👑
Depende de: F2, F3.

- [ ] F4.1 `js/features/relight/`: normales a partir de la profundidad (Depth Anything V2 Small), luz direccional (Lambert + suavizado) mezclada en luz lineal. Sin modelo generativo.
- [ ] F4.2 `ai.faceRelight` · Luz en la cara: dirección, altura, intensidad, suavidad; respeta el color de la piel.
- [ ] F4.3 `ai.eyes` · Ojos: luz, color del iris, tamaño sutil (con deformación de F5 cuando esté).
- [ ] F4.4 `ai.lipsBrows` · Labios y cejas: color, definición, relleno de huecos en cejas.
- [ ] F4.5 `ai.teeth` · Dientes: blanqueado por zonas con landmarks, conservando el brillo (afina el de «Retoque de cara»).
- [ ] F4.6 `ai.hair` · Cabello: color en OKLab, brillo, volumen suave (máscara de pelo de BiSeNet + matting).
- [ ] F4.7 `ai.flyawayHair` · Pelos sueltos: detectar líneas finas sobre el fondo y rellenar con LaMa o MI-GAN.
- [ ] F4.8 `ai.glassesGlare` · Reflejos en gafas: detectar brillos especulares dentro de la máscara de las gafas y atenuarlos.
- [ ] F4.9 `ai.eyeGaze` · Mirada y ojos cerrados: **investigación acotada** (viabilidad en móvil y calidad). Si no cumple, se descarta y se anota aquí.
- [ ] F4.10 Grupos Ojos, Labios y cejas, Dientes, Pelo, Gafas y Luz en `plugins/face-editor/` (cada función aporta su panel; el editor no cambia). Menús, cajón, ☰, guía, pruebas.

Hecho cuando: cada función es utilizable en móvil sin pasar de la memoria y con resultado en capa nueva.

### Fase 5 · Motor de deformación
Objetivo: un motor de deformación reutilizable por el editor de cuerpo, la forma de la cara y los ajustes finos.
Depende de: F2.

- [ ] F5.1 `js/features/warp/`: campo de deformación por mínimos cuadrados móviles (MLS) con restricciones (puntos fijos, zonas protegidas, líneas rectas).
- [ ] F5.2 Control de plegados: el determinante del jacobiano debe ser > 0 en todo el campo; si no, se reduce la amplitud y se avisa.
- [ ] F5.3 Render por GPU (WebGL/WebGPU) con remuestreo bicúbico en coma flotante y respaldo en CPU en un worker.
- [ ] F5.4 Compensación del fondo: al estrechar el cuerpo se descubre fondo; rellenar con LaMa (escritorio) o MI-GAN (móvil), y conservar las líneas rectas del fondo cerca del contorno.
- [ ] F5.5 Reutilizar lo que ya hay (`js/editor/tools/liquify.js`, `filter.puppetWarp`) solo como referencia; no se modifican.
- [ ] F5.6 Pruebas en Node del campo (invertibilidad, ausencia de plegados, conservación del área protegida).

Hecho cuando: una deformación de prueba no pliega, no mueve las zonas protegidas y se aplica a resolución completa.

### Fase 6 · Cuerpo y forma de la cara 👑 (editor de cuerpo)
Objetivo: modificar todos los aspectos corporales de una persona, hombre, mujer, niño o niña.
Depende de: F2, F4.1, F5.

**Perfiles y mandos** (definidos en `js/ai/people/profiles.js`; el editor solo los pinta)

| Grupo | Mandos | Hombre / Mujer | Niño / Niña |
|---|---|---|---|
| Silueta | delgado ↔ ancho, altura, proporción piernas/torso | sí | solo altura y proporción de extremidades; silueta con rango reducido |
| Cabeza y cuello | tamaño de la cabeza, largo y grosor del cuello | sí | sí |
| Torso | hombros (ancho y caída), pecho, cintura, abdomen, espalda | sí | solo hombros y postura |
| Caderas y glúteos | caderas, glúteos | sí | **no existen** |
| Brazos | largo, grosor (brazo y antebrazo), muñecas, manos | sí | sí |
| Piernas | largo, grosor (muslo y pantorrilla), rodillas, tobillos, pies | sí | sí (rango reducido) |
| Postura | erguir espalda, cuello adelantado, hombros | sí | sí |
| Definición | musculatura por zonas, tono (luz y sombra con relieve) | sí | **no existe** |
| Piel del cuerpo | suavizar, uniformar, bronceado | sí | solo uniformar |
| Cara | **se hace en el editor de cara** (grupo «Forma»): mandíbula, mentón, nariz, ojos, labios (por puntos de F2) | sí | rango reducido |

Presets por perfil: «Equilibrar proporciones», «Más alto», «Esbelto», «Atlético» (adultos); «Más alto» y «Postura» (infantil).

- [ ] F6.1 `js/features/body/engine/`: de los sliders a un campo de deformación (usa F5), con simetría opcional y protección de cara y manos.
- [ ] F6.2 `js/features/body/definition/`: musculatura y tono con normales (F4.1) y máscaras de partes; **sin generar piel**.
- [ ] F6.3 `plugins/body-editor/` (sobre `ai-editor/` de F0.13, a pantalla completa como el collage, con zoom); selector de persona (varias), chips de grupo, un mando visible a la vez en móvil, puntos arrastrables sobre las articulaciones, antes/después, deshacer. Interfaz mínima (regla del móvil).
- [ ] F6.4 Selector de perfil (hombre, mujer, niño, niña); si las proporciones sugieren un menor, el perfil de partida es el infantil.
- [ ] F6.5 `ai.bodyEditor`, `ai.bodyShape`, `ai.bodyPosture`, `ai.bodyTone`, `ai.bodySkin` (los cuatro últimos son accesos directos que abren el mismo editor en su grupo).
- [ ] F6.6 `ai.faceShape` · Forma de la cara (en «Retrato»): grupo «Forma» del **editor de cara** (`plugins/face-editor/`, con zoom en la cara), no del editor de cuerpo; usa el motor de deformación (F5) y el rango reducido del perfil infantil.
- [ ] F6.7 Salida en capa nueva reabrible con máscara; varias personas = varias capas.
- [ ] F6.8 Menús, cajón, ☰, guía `ia-cuerpo.js`, pruebas (engine en Node, interfaz en móvil y escritorio, rangos por perfil).
- [ ] F6.9 Prueba de seguridad: en el perfil infantil no se puede alcanzar ningún mando de pecho, caderas ni glúteos, ni por interfaz ni por parámetros.

Hecho cuando: se puede editar a una persona adulta o a un niño con resultado natural, sin plegados, con el fondo íntegro.

### Fase 7 · Ropa y tejidos 👑
Depende de: F2, F3.1.

- [ ] F7.1 `js/features/clothing/shared/`: máscara de prenda (partes de F2 + SAM para ajustar), luminancia en luz lineal.
- [ ] F7.2 `ai.clothesWrinkles` · **Planchar arrugas de ropa**: separar sombreado de pliegue y textura del tejido, aplanar el sombreado de baja y media frecuencia con filtro guiado y reinyectar la trama.
- [ ] F7.3 `ai.fabricWrinkles` · Arrugas de telas y fondos: lo mismo sobre cualquier zona elegida con un toque (sábanas, cortinas, manteles).
- [ ] F7.4 `ai.recolorClothes` · Cambiar color de prendas: tono en OKLab con conservación de sombras y brillos del tejido.
- [ ] F7.5 `ai.fabricTexture` · Textura de tejido: coherencia de trama y grano tras planchar o recolorear.
- [ ] F7.6 `plugins/clothing-editor/` (sobre `ai-editor/`; zoom a la prenda tocada; grupos Planchar, Color, Textura, Telas y fondos). Menús, cajón, ☰, guía, pruebas.

### Fase 8 · Escena, cielo y color 👑
Depende de: F1, F4.1. Interfaz: simple (4.7) salvo que una función supere los 4 mandos.

- [ ] F8.1 `ai.skyEnhance` · Mejorar cielo: realce y relleno de cielos apagados, con ajuste de luz del primer plano.
- [ ] F8.2 `ai.dehaze` · Quitar neblina con profundidad (amplía el «Quitar neblina…» clásico; el existente no cambia).
- [ ] F8.3 `ai.categoryBoost` · Realzar por tipo (agua, follaje, cielo, edificios, piel) con las 150 clases de ADE20K del modelo ya incluido.
- [ ] F8.4 `ai.zonedWhiteBalance` · Balance de blancos por zonas: estima el iluminante de cada zona.
- [ ] F8.5 `ai.highlightRecovery` · Recuperar luces: reconstruir canales recortados.
- [ ] F8.6 `ai.harmonize` · Unificar iluminación: acerca color y luz del sujeto a los del fondo.
- [ ] F8.7 `ai.depthChroma` y `ai.depthRelight`: aberración cromática que crece con la distancia y luz direccional con relieve (usa `js/features/relight/`).
- [ ] F8.8 Mover «Reemplazar cielo» y «Adaptive Photo Lens» a «Escena y cielo» (solo de sitio).
- [ ] F8.9 Menús, cajón, ☰, guía, pruebas.

### Fase 9 · Restaurar y limpiar 👑
Modelos candidatos: NAFNet (desenfoque). Resto: algoritmos clásicos.

- [ ] F9.1 `ai.deblur` · Quitar desenfoque de movimiento y de enfoque, por bloques y con refinado.
- [ ] F9.2 `ai.dustSpots` · Polvo y motas: detección automática de manchas del sensor y relleno.
- [ ] F9.3 `ai.moire` · Moiré y bandas: análisis en frecuencia (`js/analysis/fft.js`) y atenuación selectiva.
- [ ] F9.4 Modo «Limpiar para Realify» en la reducción de ruido: quita el ruido antes de añadir el grano propio de sensor.
- [ ] F9.5 Menús, cajón, ☰, guía, pruebas.

### Fase 10 · Objetos y composición 👑
Modelos candidatos: MI-GAN (relleno ligero para móvil).

- [ ] F10.1 `ai.smartBrush` · Pincel inteligente: se pinta y la selección se pega a los bordes (MobileSAM ya incluido).
- [ ] F10.2 `ai.quickErase` · Borrado ligero con MI-GAN, pensado para móvil.
- [ ] F10.3 «Recorte inteligente»: ofrecer varias propuestas de encuadre (amplía `ai.smartCrop`; el comando no cambia).
- [ ] F10.4 `ai.textPlacement` · Texto y marcas de agua sin tapar sujetos: zonas vacías por saliencia y cara.
- [ ] F10.5 Menús, cajón, ☰, guía, pruebas.

### Fase 11 · Realismo y autenticidad 👑
Objetivo: reforzar lo que hace único a Realify.

- [ ] F11.1 `ai.smoothZones` · Zonas demasiado lisas: detectar zonas sin textura creíble y proponer grano, poros o trama (enlaza con F3.5 y F7.5).
- [ ] F11.2 `ai.aiArtifacts` · Manos y dientes sospechosos: coherencia de puntos (número de dedos, proporciones, dientes) y **aviso**, no corrección automática.
- [ ] F11.3 Ampliar «Plausibilidad» con la puntuación antes/después (`js/analysis/metrics.js`).
- [ ] F11.4 `ai.photoReport` · Informe de realismo: nitidez, ruido, rango dinámico, metadatos y puntuación, exportable a PDF o JSON.
- [ ] F11.5 Antes/después comparable con la puntuación en pantalla.
- [ ] F11.6 Menús, cajón, ☰, guía, pruebas.
- [ ] F11.7 **Mejoras de Unmark** (el titular levantó el límite el 5 nov 2026). Antes de empezar se define con él el alcance:
      qué marcas, qué mejoras y cómo se mide el resultado; después se redactan aquí sus tareas.
- [ ] F11.8 Ampliar la coincidencia de EXIF de Realify (`js/filters/camera/exifmatch.js`); alcance a definir con el titular.

### Fase 12 · Estilos de cámara, color por referencia y presets 👑
Depende de: F1. Interfaz: editor a pantalla completa con el armazón común (4.7).

- [ ] F12.1 `ai.styleFromReference` · Estilo desde una foto de referencia: transferencia de color y tono en OKLab, por zonas con segmentación; mejora «Igualar color…» sin cambiar el existente.
- [ ] F12.2 `ai.cameraPacks` · Packs de estilos de cámara (película analógica, móvil, réflex) sobre `plugins/cameras`, `plugins/vintage` y `js/filters/looks`.
- [ ] F12.3 `ai.myStyles` · Guardar, importar y compartir estilos como archivo.
- [ ] F12.4 Ajustes sugeridos por «estilo objetivo» (propone valores a partir de una foto de referencia).
- [ ] F12.5 Aplicar un estilo a un lote con «Aplicar esta edición a otras fotos».
- [ ] F12.6 Menús, cajón, ☰, guía, pruebas.

### Fase 13 · Lote, biblioteca y entrega 👑
Modelos candidatos: CLIP (búsqueda y etiquetas), captioning pequeño (texto alternativo). Tokenizador de CLIP ya incluido.

- [ ] F13.1 `plugins/culling/` · Selección rápida: nitidez (`js/cv/stackmath.js`), ojos cerrados (puntos de F2), duplicados (hash perceptual + CLIP), composición (`smartGrid`); comparar 2 y 4 fotos; puntuación y descarte con un gesto.
- [ ] F13.2 `ai.searchPhotos` · Búsqueda por texto con CLIP; índice en IndexedDB; todo local.
- [ ] F13.3 `ai.autoTags` · Etiquetas y nombres de archivo con plantillas.
- [ ] F13.4 `ai.altText` · Texto alternativo para accesibilidad.
- [ ] F13.5 Exportación por lotes: plantillas de nombre y formatos para redes (amplía el ZIP actual).
- [ ] F13.6 Menús, cajón, ☰, guía, pruebas.

### Fase 14 · Asistente de edición con IA local 👑
Depende de: F1 (manifiestos con `params`). Modelo: Qwen2.5 1,5B Instruct (D4).
Diseño: el modelo **no ejecuta código**; devuelve un plan en JSON que se valida contra el esquema de `params` de los manifiestos; el usuario lo ve y lo confirma; se aplica con el motor de «Acciones».

- [ ] F14.1 Cargar Qwen2.5 1,5B bajo demanda con `ensureVendor` y WebGPU (avisando del tamaño); medir en un móvil de gama media y, si no cabe, bajar a 0,5B; respaldo claro si el dispositivo no puede.
- [ ] F14.2 Esquema de herramientas generado desde los manifiestos (comando, parámetros, rangos).
- [ ] F14.3 Interfaz mínima de texto: «hazla más cálida y con grano de película» → vista previa → aplicar.
- [ ] F14.4 Voz opcional con un modelo local (tipo Whisper tiny); sin enviar audio fuera del equipo.
- [ ] F14.5 Pruebas con un conjunto de órdenes en español; rechazo de lo que salga del esquema.
- [ ] F14.6 Menú, cajón, ☰, guía.

### Fase 15 · Vídeo 👑
Depende de: F9, F12. Es la fase más grande: se divide en sub-fases.

- [ ] F15.1 Estudio de viabilidad: decodificación y codificación con WebCodecs, memoria y tiempo por fotograma en móviles reales y en escritorio; **fijar aquí los límites** de duración y resolución (D5: se miden primero) y anotarlos en este plan.
- [ ] F15.2 `plugins/video/`: línea de tiempo mínima, previsualización a baja resolución, aplicar al clip completo.
- [ ] F15.3 Efectos por fotograma: cadena de sensor de Realify, color, estilos de cámara.
- [ ] F15.4 Segmentación por fotograma (MODNet) con suavizado temporal y estabilización ligera (OpenCV.js).
- [ ] F15.5 Exportar MP4 o WebM con el códec del dispositivo.
- [ ] F15.6 Menú, cajón, ☰, guía, pruebas y medición de rendimiento.

### Fase 16 · Cierre, posicionamiento y publicación
- [ ] F16.1 Nuevo texto de presentación («editor completo con IA local», D6; borradores para aprobar) en `index.html`, `manifest.webmanifest`, README y «Acerca de».
- [ ] F16.2 `docs/FUNCIONALIDADES.md` (recuentos), README sección 12, `js/vendor/ATTRIBUTIONS.md` con cada modelo nuevo, `docs/MODELOS.md` completo.
- [ ] F16.3 Guía completa de IA por familias (`ia-*.js`) y tema de novedades.
- [ ] F16.4 Comprobar que los modelos descargados funcionan sin conexión (PWA) y que Diagnóstico muestra y borra los nuevos.
- [ ] F16.5 Medición con `tools/verify/perf.mjs`; el arranque no debe empeorar (los manifiestos son solo datos).
- [ ] F16.6 Release 2.0.0.
- [ ] F16.7 Lista de modelos no comerciales (de `docs/MODELOS.md`) con su sustituto previsto, por si algún día se cobra Premium.

---

## 8. Modelos y licencias

Criterio: **el mejor modelo que pueda ejecutar un móvil de gama media**, con cualquier licencia (D2). Todos los candidatos están
**sin medir ni auditar**: en la fase correspondiente se mide calidad, tiempo y memoria en un móvil real, y se registra la licencia de
los **pesos** y la de los **datos de entrenamiento** en `docs/MODELOS.md` (con `noncommercial: true` si procede). Ningún número de
este plan es medido. Como ya no se descartan por licencia, en cada tarea de modelos se compara también con las variantes más
grandes de la misma familia y se elige la mayor que quepa.

| Para qué | Candidato | Licencia esperada (verificar) | Notas |
|---|---|---|---|
| Pose del cuerpo | RTMPose, MoveNet, BlazePose (MediaPipe) | Apache-2.0 | Descartar YOLO-pose de Ultralytics (AGPL-3.0) |
| Puntos de la cara (478) | MediaPipe Face Landmarker | Apache-2.0 | Convertir de TFLite a ONNX |
| Manos | MediaPipe Hand Landmarker | Apache-2.0 | |
| Partes del cuerpo y ropa | SegFormer o SCHP | Código MIT o Apache; **datos por revisar** | Riesgo de datos no comerciales |
| Clases de escena (agua, follaje…) | DeepLab ADE20K (ya en el catálogo como `sky`) | Apache-2.0 | Sin modelo nuevo |
| Relleno ligero (móvil) | MI-GAN | MIT | Alternativa a LaMa (208 MB) |
| Quitar desenfoque | NAFNet | MIT | Por bloques |
| Búsqueda, etiquetas, calidad | CLIP ViT-B/32 o SigLIP | MIT / Apache-2.0 | Tokenizador de CLIP ya incluido |
| Texto alternativo | Captioning pequeño (p. ej. Florence-2 base) | MIT (a verificar) | Alternativa: etiquetas CLIP con plantillas |
| Asistente | **Qwen2.5 1,5B Instruct** (elegido, D4); 0,5B de respaldo | Apache-2.0 | Gemma tiene términos propios: revisar antes |
| Voz a texto | Whisper tiny o base | MIT | Opcional |
| Profundidad | Depth Anything V2 **Small** (ya incluido, Apache-2.0); **Base** como candidato de más calidad | Base y Large: no comercial (según recuerdo; verificar) | Se mide si Base cabe en un móvil de gama media; Large casi seguro no |
| Normales, arrugas, polvo, moiré, brillos | Sin modelo (algoritmos propios) | — | |
| Vídeo | MODNet (ya), OpenCV.js (ya), WebCodecs | — | |

Reglas: los modelos no comerciales se aceptan y se marcan (`noncommercial: true`); si algún día se cobra Premium hay que
sustituirlos (tarea de F16); los de más de ~150 MB se marcan como avanzados y avisan en el móvil; ningún modelo estima edad o sexo.
Siguen descartados por licencia de copyleft fuerte los de Ultralytics (AGPL-3.0).

---

## 9. Criterios de «hecho» (valen para cada función y cada fase)

- [ ] Funciona en **móvil y escritorio**, con el diseño propio de cada modo, y la vista previa de la imagen manda.
- [ ] Siempre Premium 👑, sin interruptor; el README de la función explica «Bueno» y «Mejor».
- [ ] Resultado en capa nueva con «mezcla» (o pestaña nueva si cambia el tamaño); un paso de deshacer.
- [ ] Entrada en el **menú de escritorio**, en el **cajón** (sub-pestaña IA) y en el **☰ del móvil**, con icono y en el mismo orden.
- [ ] Un solo manifiesto; ningún archivo nuevo de más de 300 líneas (aviso) ni de 400 (no se acepta).
- [ ] Modelo bajo demanda con aviso de tamaño, licencia registrada en `docs/MODELOS.md`.
- [ ] Cancelable y sin agotar la memoria (se probó en un móvil de gama media y con una foto de 24 MP).
- [ ] `node tests/calidad-herramienta.mjs <comando>` sin FALLO; `tests/ia/<familia>/…` y `cajon-basicos-auto` en verde.
- [ ] `npm run verify` (capas, referencias, estático, documentos, humo) en verde.
- [ ] Guía (`js/ui/help/topics/`), `CHANGELOG.md`, README afectados y contador de compilación (y semver si procede) actualizados.
- [ ] Este plan actualizado: tarea marcada con `[x]` y versión.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Memoria del móvil con modelos y fotos grandes | Análisis a baja resolución, aplicación por bloques, cancelación, protección `HEAVY` ya existente, aviso en modelos grandes |
| WebGPU irregular entre dispositivos | Respaldo en WASM probado desde F2; GPU solo donde está validada |
| Modelos de uso no comercial si algún día se cobra Premium | Marcados con `noncommercial: true` y listados en `docs/MODELOS.md`; tarea F16.7 para sustituirlos o quitarlos |
| Deformaciones del cuerpo con artefactos (líneas del fondo, plegados) | Control del jacobiano, compensación del fondo, zonas protegidas, límites por mando |
| Interfaces duplicadas o distintas entre funciones | Panel único desde `params`, dos hosts (simple y editor), `tests/ia/interfaces.mjs` (4.7) |
| Mal uso del editor de cuerpo | Reglas de seguridad de la sección 3 y prueba F6.9 |
| Peso del repositorio (`assets/models` ya 326 MB) | Modelos grandes en Hugging Face con revisión fija |
| Archivos que vuelven a crecer | `file-size.mjs` y revisión en cada fase |
| LLM poco fiable | Salida validada contra un esquema; el usuario confirma antes de aplicar |
| Vídeo demasiado pesado en móvil | Estudio previo (F15.1) y límites fijados con datos (D5) |

---

## 11. Fuera de este plan

- **Galería con enlace de entrega y sincronización entre dispositivos**: necesitan un servidor; el proyecto es local y sin servidores.
- **Estimar la edad o el sexo de una persona con un modelo**: el perfil del editor de cuerpo lo elige la persona.
- **Generar contenido nuevo del cuerpo** (piel, ropa quitada o añadida): solo se deforma y se ajusta luz y color.

---

## 12. Registro de avance

| Fase | Versión | Fecha | Notas |
|---|---|---|---|
| P · Plan | — | 5 nov 2026 | En `main`; resueltas D1 a D6, el editor de cuerpo y Unmark; interfaces definidas (4.7: editor de cara con zoom, editores a pantalla completa y simples); listo para empezar por la Fase 0 |
| 0 · Cimientos | | | |
| 1 · Menús y cajón | | | |
| 2 · Personas | | | |
| 3 · Retrato I | | | |
| 4 · Retrato II | | | |
| 5 · Deformación | | | |
| 6 · Cuerpo | | | |
| 7 · Ropa | | | |
| 8 · Escena | | | |
| 9 · Restaurar | | | |
| 10 · Objetos | | | |
| 11 · Realismo | | | |
| 12 · Estilos | | | |
| 13 · Lotes | | | |
| 14 · Asistente | | | |
| 15 · Vídeo | | | |
| 16 · Cierre | | | |
