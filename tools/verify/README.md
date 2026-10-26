# Verificación de la reorganización

Herramientas **de desarrollo** (no se despliegan funciones nuevas en la web). Solo leen el proyecto que analizan.

## Qué comprueba

| Herramienta | Qué hace | Tiempo |
|---|---|---|
| `static-check.mjs` | Todas las referencias (import, import(), `new URL(..., import.meta.url)`, rutas escritas como texto, `url()` de CSS, HTML, manifest) apuntan a un archivo real; ciclos de imports; exports de cada módulo; ids de comando candidatos; claves de `localStorage` e IndexedDB; dependencias entre carpetas. | segundos |
| `smoke.mjs` | Abre la web en Chromium sin ventana (escritorio y móvil): huella de comandos, herramientas y menús; secuencia de ~20 comandos sobre una imagen fija con hash de píxeles; 19 gestos de dibujo y selección con el ratón y 34 atajos de teclado (también con hash de píxeles); apertura y cierre de ~55 diálogos y plugins; recorrido de todas las herramientas; capturas de pantalla; errores de consola; métricas de arranque en frío. | ~2 min |
| `compare.mjs` | Compara dos resultados (de `smoke` o de `static`, con la cadena de tablas de movimientos) y dice si son equivalentes. | segundos |
| `layers.mjs` | Comprueba la regla de capas: ningún módulo importa de forma estática algo de una capa superior (ver README principal, «Capas del código»). Falla si se rompe. | segundos |
| `pixdiff.mjs` | Compara dos capturas PNG píxel a píxel. | segundos |
| `perf.mjs` | Arranque con red limitada (latencia y ancho de banda), compresión gzip y **HTTP/2** (como producción): tiempo hasta app lista, FCP, peticiones y bytes. Perfiles `wifi`, `4g`, `3g`. Necesita `VERIFY_CERT_DIR` (carpeta con `key.pem` y `cert.pem` autofirmados) para HTTP/2. | ~1 min |
| `lint-refs.mjs` | ESLint con solo reglas de corrección (`no-undef`, `no-import-assign`…): detecta imports que faltan o variables de módulo asignadas desde otro módulo, **también en funciones que ninguna prueba ejecuta**. Con `--vs` muestra solo lo nuevo respecto a la versión de partida. | ~1 min |
| `docs-links.mjs` | Comprueba los enlaces de los archivos Markdown (archivos y anclas). | segundos |
| `units-equal.mjs` | Comprueba que al dividir un módulo no se perdió, duplicó ni alteró ninguna sentencia (ignora solo el `export ` añadido y las rutas relativas). | segundos |

## Uso

```bash
# Playwright-core se instala fuera del proyecto; PW_CORE es la carpeta que contiene su node_modules
export PW_CORE="<ruta>/pw"

node static-check.mjs "<web>" baseline/static.<etiqueta>.json
node smoke.mjs --root "<web>" --label <etiqueta> [--modules modules.<etiqueta>.json]
```

`modules.<etiqueta>.json` indica dónde está, en esa versión de la web, cada módulo que la prueba importa en
el navegador (`doc`, `commands`, `tools`, `menu`). Cuando se mueven archivos hay que actualizarlo.

## Línea base

`baseline/` contiene lo medido sobre **Realify - copia** (la versión de partida):

- `static.copia.json`, `smoke.copia.json`, `lint.copia.json` (versión de partida) y los de la última fase (estado actual)
- `screens/`: capturas de pantalla de referencia.

Cada fase de la reorganización debe producir resultados equivalentes: mismos ids de comando, mismas herramientas
y menús, mismos hashes de píxeles tras cada comando, mismos diálogos abiertos y ningún error nuevo.

## Límites

La prueba de humo no recorre cada filtro ni cada ajuste: cubre un representante por grupo y todas las
herramientas. El resto se apoya en que los movimientos de archivos los hace un script (no a mano) y en la
comprobación estática exhaustiva de rutas.

## Tras mover archivos

```bash
node tools/verify/static-check.mjs . tools/verify/baseline/static.nueva.json
node tools/verify/compare.mjs static tools/verify/baseline/static.copia.json tools/verify/baseline/static.nueva.json moves.phase1.json,moves.phase2.json
node tools/verify/layers.mjs
PW_CORE=<dir con eslint> node tools/verify/lint-refs.mjs . tools/verify/baseline/lint.nueva.json --vs tools/verify/baseline/lint.copia.json
node tools/verify/smoke.mjs --root . --label nueva --modules modules.fase2.json
node tools/verify/compare.mjs smoke tools/verify/baseline/smoke.copia.json tools/verify/baseline/smoke.nueva.json
```
