# Unir imágenes

Plugin a pantalla completa (escritorio y móvil) para unir fotos en fila, columna o cuadrícula. Las panorámicas
tienen su propio plugin (`plugins/panorama/`). El resultado va a
una capa nueva (en una pestaña nueva si no mide lo mismo que el documento).

| Archivo | Qué hace |
|---|---|
| `index.js` | Entrada: abre el editor y crea la capa con el resultado. |
| `ui.js` | Ventana (sobre `js/ui/kit/fsshell.js`) y la unión (fila, columna, cuadrícula). |

## Unión

Fila, columna o cuadrícula de 2, 3 o 4 columnas; igualar tamaños o alinear al
inicio, centro o final; proporción de las celdas y foto entera o llenando;
separación, margen, esquinas redondeadas y fondo de color o transparente.
