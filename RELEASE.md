# Flujo obligatorio de publicación de Realify

Este flujo es obligatorio para cualquier cambio que deba llegar a producción.

## Fuente de verdad

La versión pública de Realify vive en cuatro sitios que deben coincidir:

- `VERSION`
- `version.json`
- `sw.js` → `const VERSION = "realify-vNNN"`
- `index.html`
  - `js/boot-guard.js?v=NNN`
  - `js/main.js?v=NNN`

## Regla de publicación

1. Se realizan los cambios de código.
2. Antes de publicar, se incrementa la versión numérica.
3. Se sincronizan los cuatro puntos anteriores.
4. Se hace push a `main`.
5. GitHub Actions valida que la versión esté sincronizada y sea superior a la anterior.
6. Sólo entonces se actualiza el VPS mediante `git reset --hard origin/main`.
7. El workflow consulta `https://realify.es/version.json` y comprueba que producción devuelve la versión esperada.

Si hay cambios de aplicación pero no se incrementa `VERSION`, el workflow falla y no publica.

Los cambios únicamente administrativos/documentales pueden entrar en `main` sin crear una nueva versión y no provocan despliegue.

## Caché

Cada release incrementa también:

- el nombre de la caché del Service Worker;
- el query string de `main.js`;
- el query string de `boot-guard.js`.

Esto fuerza al navegador a reconocer la nueva release y evita depender de una recarga manual con Ctrl+F5.

## Versión actual

Realify v250.
