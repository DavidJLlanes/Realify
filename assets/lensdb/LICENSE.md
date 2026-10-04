# Base de datos de objetivos

`lensfun.json` es una adaptación (conversión a JSON compacto, hecha con
`tools/build-lensdb.mjs`) de la base de datos de objetivos y cámaras de
**Lensfun** (https://lensfun.github.io/, https://github.com/lensfun/lensfun,
carpeta `data/db`), © los colaboradores de Lensfun.

Licencia de los datos: **Creative Commons Atribución-CompartirIgual 3.0**
(CC BY-SA 3.0): https://creativecommons.org/licenses/by-sa/3.0/

- Se permite el uso comercial.
- Hay que **atribuir** a Lensfun (este archivo y la ventana «Acerca de» lo hacen).
- Las adaptaciones de la base —este JSON incluido— se comparten **bajo la misma
  licencia** (CC BY-SA 3.0).
- El código de Realify sólo lee estos datos y no queda afectado por la licencia de la base.

Las fórmulas de corrección (distorsión, aberración cromática y viñeteo) se han
reimplementado desde su documentación y comportamiento; no se incluye código de
la biblioteca Lensfun (LGPL-3.0).
