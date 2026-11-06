# Editor de vídeo de Realify · arquitectura (F15.0)

> **Estado: APROBADO por el titular el 6 nov 2026** (carpetas y contratos; el proyecto guarda sólo la huella de los vídeos; alcance «editor sencillo pero escalable»; límites a medir en F15.1).
> Norma de origen: sección 4.8 y Fase 15 de `docs/PLAN_EDITOR_IA_LOCAL.md`.

## 1. Qué es y qué no es
Un editor de vídeo 👑 que corre **entero en el dispositivo** (WebCodecs, workers, GPU cuando haga falta) y aplica al vídeo lo que Realify ya hace con fotos:
cadena de sensor (grano, óptica, compresión), color, estilos de cámara y, más adelante, segmentación por fotograma. Corte, orden de clips, velocidad, audio y exportación MP4/WebM.
**No es** un editor profesional de postproducción (sin multicámara, sin transiciones complejas, sin efectos 3D). Sin servidor, sin cuenta, sin subir nada.

## 2. Aislamiento (se comprueba con herramientas)
- Todo el código en `plugins/video/`; estilos en `plugins/video/css/`; pruebas en `tests/video/`; esta guía en `docs/VIDEO.md`.
- **Puerta de entrada única:** `plugins/video/index.js`, sólo con `import()` desde `js/app/commands/video.js`.
- **Puerta de salida única:** `plugins/video/bridge/`. Es lo único del módulo que importa de fuera (`js/core`, `js/ui/kit`, `js/ai`, motores de color y de sensor). Si el resto de la app cambia, se arregla el puente.
- `node tools/verify/aislamiento.mjs` (dentro de `npm run verify`) falla si algo de fuera importa el módulo de forma estática, o si algo de dentro importa de fuera sin pasar por `bridge/`. Además se cumple `layers.mjs` (plugins = capa 4).
- **Carga diferida total:** nada de vídeo se descarga ni se ejecuta hasta abrir el editor. Librerías pesadas (OpenCV.js, muxers) con `ensureVendor`.

## 3. Carpetas
```
plugins/video/
├─ README.md       qué es, cómo se ejecuta y se prueba
├─ index.js        puerta de entrada (≤ 40 líneas): openVideo()
├─ manifest.js     DATOS: comandos video.*, menú, ayuda, SCHEMA_VERSION
├─ bridge/         ÚNICO contacto con el resto de Realify (reexporta lo prestado)
├─ project/        modelo del proyecto + versión + migraciones (sin DOM)
├─ timeline/       operaciones puras sobre la línea de tiempo, con deshacer (sin DOM)
├─ media/          decoders/ y encoders/ con registro de códecs (WebCodecs, respaldo)
├─ render/         motor de fotogramas: cadena de efectos, caché, previsualización, render completo (sin DOM)
├─ effects/        un efecto por carpeta con su manifiesto; se registran solos
├─ audio/          pista de audio, volumen, sincronía
├─ export/         MP4/WebM y presets por red social (registro)
├─ workers/        decodificar, procesar y codificar fuera del hilo principal
├─ ui/             editor a pantalla completa (armazón común vía bridge), paneles, menú contextual
└─ css/            estilos propios
```
Tamaño de archivo como en el resto del plan (objetivo ≤ 250 líneas, tope 400; `index.js` ≤ 40) y cabecera `═` en español en cada archivo.

## 4. Formato del proyecto (`project/`)
Un proyecto es JSON puro, sin DOM, con versión:
```jsonc
{
  "schemaVersion": 1,
  "id": "p_…", "name": "Mi vídeo", "creado": 1730000000000, "modificado": 1730000000000,
  "salida": { "ancho": 1080, "alto": 1920, "fps": 30 },
  "medios": { "m1": { "nombre": "clip.mp4", "tipo": "video|audio|imagen", "duracion": 12.4, "ancho": 1920, "alto": 1080, "fps": 29.97, "huella": "tam|fecha|nombre" } },
  "pistas": [
    { "id": "v1", "tipo": "video", "clips": [
      { "id": "c1", "medio": "m1", "inicio": 0, "dentro": 2.0, "fuera": 8.5, "velocidad": 1,
        "efectos": [ { "id": "e1", "efecto": "sensor", "version": 1, "params": { "grano": 40 }, "activo": true } ] } ] },
    { "id": "a1", "tipo": "audio", "clips": [ … ], "volumen": 1 }
  ]
}
```
- El JSON del proyecto lleva sólo la huella y los metadatos de cada medio. Desde la v319 el editor además autoguarda en IndexedDB (`project/guardado.js`) el proyecto y una copia de cada vídeo importado, y lo recupera al abrirse; «Nuevo» lo borra. Exportar/importar como `.realify-video.json` sigue sin hacerse (los medios se volverían a elegir).
- **Migraciones:** `project/migrar.js` aplica `migraciones[n → n+1]` en cadena. Un proyecto con versión mayor que la conocida se abre en sólo lectura con aviso. Toda migración tiene prueba con un archivo de ejemplo de la versión anterior (`tests/video/fixtures/`).
- **Tiempo** en segundos (número), con fotograma = `round(t * fps)` al renderizar; nunca se acumulan errores de coma flotante en el proyecto.

## 5. Línea de tiempo (`timeline/`)
Funciones **puras** `(proyecto, args) → proyecto nuevo` (inmutables): `dividir`, `recortar`, `mover`, `eliminar`, `duplicar`, `cambiarVelocidad`, `ponerEfecto`, `quitarEfecto`, `ajustarEfecto`, `zoom` (vista). El **deshacer** guarda instantáneas estructurales (compartiendo lo que no cambia), con límite de pasos. Todo se prueba en Node con casos límite (cortes en el borde, solapes, clips de 1 fotograma).

## 6. Contratos
### 6.1 Efecto (`effects/<id>/`)
```js
// manifest.js (datos)
export default { id: "sensor", version: 1, nombre: "Sensor de Realify", premium: true, tipo: "fotograma",
  params: [ { key: "grano", label: "Grano", type: "range", min: 0, max: 100, def: 40 } ],
  carga: () => import("./efecto.js") };
// efecto.js
export function crear(){ return {
  prepare(ctx){},                       // una vez por clip: recursos, modelos, tablas (ctx = { ancho, alto, fps, gpu })
  process(frame, params, t){ return frame; }, // por fotograma; frame = lienzo (canvas/OffscreenCanvas); devuelve un lienzo; los efectos de píxeles leen y escriben con su propio motor puro
  dispose(){} }; }
```
El motor no conoce ningún efecto concreto: los descubre por sus manifiestos. `tipo: "temporal"` permite efectos que ven fotogramas vecinos (suavizado temporal, estabilización) declarando `ventana: n`.
### 6.2 Decodificador y codificador (`media/decoders|encoders/`)
```js
{ id: "webcodecs-h264", soporta: async (info) => bool, crear: async (info, opciones) => ({ siguiente(): Promise<Frame|null>, buscar(t), cerrar() }) }  // decoder
{ id: "webcodecs-h264", soporta: async (cfg) => bool, crear: async (cfg) => ({ anadir(frame, t), cerrar(): Promise<Blob> }) }                     // encoder
```
El registro prueba en orden de prioridad (`WebCodecs` con aceleración → `WebCodecs` software → respaldo WASM si existe) con `isConfigSupported`. Si ninguno sirve, el editor lo dice con claridad y propone un formato que sí (nunca falla en silencio).
### 6.3 Preset de exportación (`export/presets/`)
`{ id, nombre, contenedor: "mp4|webm", codec, ancho, alto, fps, bitrate, audio }` (Instagram Reel, Historia, TikTok, YouTube 1080p, WhatsApp, Web ligera…). Añadir uno es añadir un archivo.

## 7. Motor de render (`render/`)
- **Sin DOM:** recibe fotogramas y devuelve fotogramas; se ejecuta en Node (pruebas con fotogramas sintéticos) y en un worker.
- **Cadena:** para el instante `t`: elegir clip(s) → decodificar fotograma (caché LRU de N fotogramas) → efectos del clip en orden → composición en la pista → salida.
- **Previsualización:** a baja resolución (lado largo configurable, por defecto 480 px) y reproducción a la velocidad que dé el dispositivo (salta fotogramas, nunca se desincroniza del audio). «Aplicar al clip completo» renderiza a resolución de salida.
- **Memoria:** los `VideoFrame` se cierran siempre (`close()`) en cuanto se usan; el motor cuenta los abiertos y las pruebas fallan si hay fugas.
- **Cancelación y progreso** en todas las tareas largas (mismo patrón `aiSession` que las funciones de IA).

## 8. Workers (`workers/`)
Tres roles, mensajes tipados y versionados: `decodificar` (medios → fotogramas), `procesar` (efectos), `codificar` (fotogramas → archivo). Se transfieren `VideoFrame`/`ImageBitmap`/`ArrayBuffer` sin copiar. El hilo principal sólo pinta y recibe progreso. Si `OffscreenCanvas`/WebGPU no están, se degrada a CPU con aviso.

## 9. Efectos previstos (registro)
1. **Cadena de sensor de Realify** (grano, óptica, compresión) reutilizando los motores puros de `js/filters/camera` vía `bridge/`.
2. **Color:** exposición, contraste, saturación, balance de blancos, LUT.
3. **Estilos de cámara** (paquetes de `plugins/cameras`).
4. **Segmentación por fotograma** (MODNet o equivalente) con suavizado temporal.
5. **Estabilización ligera** (traslación por correlación de perfiles, motor puro propio; sustituye a OpenCV.js por peso, ver F15.6).
Cada uno es una carpeta con manifiesto; el motor no cambia al añadir otro.

## 10. Audio y exportación
`audio/` decodifica la pista (WebAudio/`AudioDecoder`), aplica volumen y recorte con la misma línea de tiempo y la mezcla se codifica con `AudioEncoder` (AAC u Opus según contenedor). `export/` multiplexa MP4 (H.264+AAC) o WebM (VP9/AV1+Opus) con el códec que dé el dispositivo; presets por red. Sin códec disponible → aviso claro y alternativa.

## 11. Interfaz y menú
- Editor **a pantalla completa** montado sobre el armazón común (`fsshell`/`ai-editor`) **sólo a través de `bridge/`**: móvil y escritorio, con línea de tiempo táctil (arrastrar para mover, pellizcar para zoom, doble toque para dividir), vista previa prioritaria y el interruptor Premium 👑 con las mismas reglas que el resto.
- Menú **«Vídeo»** exclusivo: barra de escritorio (junto a «Inteligencia Artificial»), sección propia de ☰ y pestaña propia al final del cajón del móvil; mismo contenido y mismo orden. Se declara en `js/ui/menu/video.js` (datos) y los comandos `video.*` viven en `js/app/commands/video.js` (sólo `import()`). El hueco ya existe y está oculto hasta que haya entradas (F1.10). Básicos y Automáticos no se tocan.

## 12. Límites y rendimiento (se miden antes de fijar, D5)
**No se fijan números todavía.** F15.1 mide con WebCodecs: memoria y tiempo por fotograma a 720p/1080p/4K, en escritorio y en móviles reales de gama media, y entonces se anotan en el plan la duración y la resolución máximas de entrada y de salida, y los avisos que da el editor al superarlas. Principio: **mejor negarse con un mensaje claro que colgar el móvil.**

## 13. Pruebas (`tests/video/`)
- Node: proyecto, migraciones y línea de tiempo (incluidos casos límite), registro de efectos/códecs, motor de render con fotogramas sintéticos, fugas de `VideoFrame`.
- Navegador (móvil y escritorio): abrir el editor, importar un clip sintético generado con WebCodecs, cortar, aplicar un efecto, exportar y volver a decodificar el resultado para comprobar duración y tamaño.
- `aislamiento.mjs`, `layers.mjs`, `file-size.mjs` y medición de rendimiento en `npm run verify`.

## 14. Riesgos y respuesta
| Riesgo | Respuesta |
|---|---|
| El dispositivo no tiene códec o WebCodecs | Registro con respaldo y mensaje claro; probar `isConfigSupported` antes de prometer nada |
| Móvil sin memoria | Límites medidos (F15.1), previsualización pequeña, cerrar fotogramas, cancelación |
| Desincronía audio-vídeo | El audio manda el reloj; el vídeo salta fotogramas |
| El módulo contamina el resto | `aislamiento.mjs` + `bridge/` único |
| Proyectos antiguos dejan de abrir | `schemaVersion` + migraciones con fixtures |
| Segmentación/estabilización pesan | Cargan sólo al usar el efecto; son opcionales |

## 15. Fases (resumen de F15)
F15.0 esta arquitectura y el esqueleto → **aprobación** · F15.1 estudio y límites · F15.2 proyecto y línea de tiempo · F15.3 medios y workers · F15.4 render y editor · F15.5 efectos · F15.6 segmentación y estabilización · F15.7 audio y exportación · F15.8 menú y comandos · F15.9 guía, changelog, pruebas, rendimiento.

## 16. Qué necesito que apruebes
1. La estructura de carpetas y los contratos (secciones 3 y 6).
2. El formato de proyecto: medios **no** incluidos, sólo huellas (sección 4).
3. El alcance de la sección 1 (no es un editor de postproducción).
4. Que los límites se fijen midiendo en F15.1 (sección 12), y que para esa medición en móviles reales necesitaré tu ayuda (anotado en `docs/PENDIENTE_TITULAR.md`).
