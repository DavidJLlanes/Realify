# Scripts de migración (registro de la reorganización)

Cada fase de la reorganización de Realify se hizo con un script, para que los movimientos fueran mecánicos y
comprobables, no a mano. Quedan aquí como **registro histórico**: no hace falta ejecutarlos de nuevo.

| Script | Qué hizo |
|---|---|
| `phase1.mjs` | Copió la versión de partida (`Realify - copia`) con la nueva estructura de carpetas (plugins, server, docs, design…) y reescribió todas las referencias. **Borra el destino antes de copiar**: se niega a ejecutarse si el proyecto ya existe (necesita `--force`). |
| `phase2-edits.mjs` | Rompió los 2 ciclos de imports moviendo código tal cual a módulos nuevos (`adjust-types.js`, `rng.js`). Idempotente. |
| `phase2.mjs` | Reorganizó `js/` por capas y responsabilidades (139 archivos movidos) y reescribió las referencias. |
| `phase3-tools.mjs` | `editor/tools/tools.js` (3.648 líneas) → un archivo por familia de herramientas en `tools/defs/`; la herramienta activa y `setTool` pasan a `tool-current.js`. |
| `phase3-main.mjs` | `main.js` (1.493 líneas) → `js/app/`: el `registerAll` de 870 líneas en un archivo por dominio, atajos, barra de herramientas, gestos y barra de estado. |
| `phase3-guide.mjs` | `ui/help/guide.js` (2.107 líneas) → un archivo por tema de ayuda en `topics/`. |
| `phase3-auto.mjs` | Divide por bloques independientes 7 archivos grandes (ajustes, transformar, HDR, metadatos, filtros básicos, herramientas fotográficas, compositor en coma flotante). |
| `phase5-vendor.mjs` | `heic2any`, `UTIF` y `ag-psd` (2,3 MB) dejan de ser `<script>` de `index.html`: `js/core/vendor.js` las carga la primera vez que se abre o exporta un HEIC, TIFF/DNG o PSD/PSB. |
| `phase4-dedupe.mjs` | 15 funciones puras de cuerpo idéntico (`clamp255` ×19, `clamp01` ×14, `esc` ×21 en dos variantes, `hash32`, `linearToSrgb255`…), 99 copias en 72 archivos, pasan a `js/core/util/`. Se excluyen las que tocan el DOM o dependen de constantes del archivo. |
| `lib/splitter.mjs`, `lib/autoplan.mjs` | Divisor de módulos basado en AST: copia el texto de las sentencias tal cual, calcula los imports y exports necesarios y se niega si el reparto crea ciclos o asigna una variable de módulo desde otro archivo. |
| `lib/mover.mjs` | El mover reutilizable: mueve archivos y reescribe imports, `import()`, `new URL(…, import.meta.url)`, rutas escritas como texto, `url()` de CSS, enlaces de HTML/Markdown y menciones en comentarios. Calcula todo en memoria antes de escribir. |

Para mover archivos en el futuro basta con una tabla `ruta antigua → ruta nueva` y `applyMoves(root, tabla)`.

Las tablas de movimientos de cada fase están en `tools/verify/moves.phase1.json` y `moves.phase2.json`; la herramienta
`tools/verify/compare.mjs` las encadena para comparar con la versión de partida.

## Lo que NO es mover texto

Todo lo de la fase 3 copia el texto original sin cambios, con una sola excepción: en `tools.js` la herramienta activa y
`setTool` pasan a `tool-current.js`, que recibe la lista de herramientas con `registerTools(TOOLS)` (en `setTool`,
`TOOLS.find` es ahora `toolList.find`). Sin eso, las herramientas de recorte (que llaman a `setTool`) y el registro que
las reúne tendrían que importarse mutuamente.

## Archivos grandes que se dejan como están

Los que son una sola función enorme (`openPostEditor`, 1.055 líneas; `renderLayers`, 487) o un bloque conexo
(`styleengine.js`, `unmark/ui.js`, `tooldrawer.js`, `export.js`…) no se pueden repartir sin reescribir su interior, que ya
no sería «mover código». Quedan documentados aquí.

## Probado y descartado en la fase 5

- **Precarga de módulos** (`<link rel="modulepreload">` de los 174 módulos de arranque): con HTTP/2 y red 4G simulada solo
  ganaba un 7 % en tener la app lista y **triplicaba el tiempo hasta el primer pintado** (352 → 1.084 ms), porque compite con
  el CSS por el ancho de banda. Descartada.
- **CSS de plugins bajo demanda**: `post.css` (clases `sp-*`) y `vintage.css` (`vf-*`) las usan otros plugins, el shell de
  plugins y el editor de curvas, así que no se pueden diferir; los que sí (`stickers`, `memes`) suman 15 KB. Sin ganancia
  que compense el riesgo.
- **Medir con HTTP/1.1** daba una falsa imagen: con 6 conexiones y la latencia pagada por cada archivo, una web de muchos módulos
  parecía un 40 % más lenta. Producción usa HTTP/2 (nginx): `tools/verify/perf.mjs` mide con HTTP/2 (VERIFY_CERT_DIR).
