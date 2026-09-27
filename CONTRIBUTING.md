# Guía de contribución

¡Gracias por tu interés en mejorar [Realify](https://realify.es)! Esta guía
explica cómo informar de errores, proponer mejoras y enviar cambios.

Al participar aceptas el [código de conducta](CODE_OF_CONDUCT.md).

## Índice

- [Informar de un error](#informar-de-un-error)
- [Proponer una mejora](#proponer-una-mejora)
- [Preparar el entorno](#preparar-el-entorno)
- [Estructura del código](#estructura-del-código)
- [Estilo de código](#estilo-de-código)
- [Principios del proyecto](#principios-del-proyecto)
- [Enviar un pull request](#enviar-un-pull-request)
- [Mensajes de commit](#mensajes-de-commit)

## Informar de un error

1. Comprueba que ocurre en la última versión de [realify.es](https://realify.es)
   (recarga con Ctrl+F5 para saltarte la caché).
2. Busca en los [issues](https://github.com/DavidJLlanes/Realify/issues) por si
   ya está informado.
3. Abre un issue con la plantilla **Informar de un error** e incluye el
   resultado de **Ayuda › Diagnóstico…**.

Los problemas de seguridad **no** se publican en issues: sigue la
[política de seguridad](SECURITY.md).

## Proponer una mejora

Abre un issue con la plantilla **Proponer una mejora**. Explica el problema que
resuelve antes que la solución: ayuda a encontrar la mejor forma de hacerlo.

## Preparar el entorno

Realify es un sitio estático sin dependencias ni paso de compilación. Solo
necesitas Git, un navegador actual y cualquier servidor HTTP estático.

```bash
git clone https://github.com/DavidJLlanes/Realify.git
cd Realify
python -m http.server 8080
```

Abre `http://localhost:8080`.

> **Nota:** la app usa módulos ES, Web Workers y un service worker, así que no
> funciona abriendo `index.html` directamente con `file://`.

Mientras desarrollas, activa en las herramientas del navegador
**Application › Service workers › Update on reload** (o «Bypass for network»)
para ver siempre la última versión de los archivos.

## Estructura del código

| Carpeta | Contenido |
|---|---|
| `js/core/` | Documento, historial, instantáneas, bus de eventos y utilidades |
| `js/editor/` | Herramientas, capas, máscaras, selección, texto y ajustes |
| `js/filters/` | Filtros y filtros especiales |
| `js/ai/`, `js/features/` | Modelos de IA y funciones que los usan |
| `js/io/` | Abrir, exportar, proyectos y lotes |
| `js/ui/` | Menús, paneles, diálogos, guía e interfaz móvil |
| `raw/`, `vintagefilter/`, `memes/`, `socialmediapost/`, `stickers/` | Módulos autónomos a pantalla completa, cada uno con su README |
| `js/vendor/`, `raw/vendor/` | Librerías de terceros (no se modifican) |

Los comandos de los menús se registran en `js/ui/commands.js` y los menús se
definen en `js/ui/menu.js`. Los filtros reeditables se registran en
`js/editor/filterregistry.js`.

## Estilo de código

- **JavaScript moderno sin compilar**: módulos ES (`import` / `export`), sin
  frameworks ni dependencias de npm.
- **Sangría de 2 espacios**, finales de línea LF y UTF-8 (ver
  [`.editorconfig`](.editorconfig)).
- **Comentarios en español**, explicando el *porqué* de cada decisión, no solo
  el *qué*. Cada archivo empieza con un bloque de cabecera que describe su
  papel.
- **Interfaz en español**, con textos claros y sin tecnicismos innecesarios.
- Trabajo pesado **fuera del hilo principal**: GPU (WebGL2/WebGPU) o Web
  Workers, siempre con alternativa en CPU.
- Mismo resultado en vista previa y exportación: ambas usan el mismo código.

## Principios del proyecto

1. **Privacidad**: ninguna imagen sale del navegador. Solo se descargan
   recursos (modelos, tipografías con permiso), nunca se suben datos del
   usuario.
2. **Funciona sin conexión** una vez cargada.
3. **Escritorio y móvil** son igual de importantes: prueba ambos.
4. **Todo se puede deshacer**, y los filtros quedan en capas reeditables
   siempre que sea posible.
5. **Sin compilación**: lo que está en el repositorio es lo que se sirve.

## Enviar un pull request

1. Haz un fork y crea una rama desde `main`:
   ```bash
   git checkout -b mejora/nombre-descriptivo
   ```
2. Haz cambios pequeños y centrados en un solo objetivo.
3. Prueba en al menos un navegador de escritorio y uno móvil.
4. Si cambian archivos servidos, sube `VERSION` en `sw.js` y el `?v=` de
   `js/main.js` en `index.html`.
5. Actualiza la documentación afectada y añade una entrada en
   [CHANGELOG.md](CHANGELOG.md), en la sección «Sin publicar».
6. Abre el pull request y completa la plantilla.

## Mensajes de commit

En español, en imperativo y con una primera línea breve (≤ 72 caracteres):

```
Añadir exportación AVIF
Corregir máscara al aplicar el Filtro Vintage
Mejorar rendimiento del revelado RAW en móvil
```

Si hace falta, añade un cuerpo separado por una línea en blanco explicando el
motivo del cambio.
