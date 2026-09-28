# Cortar en partes

Plugin a pantalla completa (escritorio y móvil) que sustituye a «Dividir en
trozos». Corta la imagen abierta (todas las capas combinadas) o, sin documento,
una foto que se elige.

| Archivo | Qué hace |
|---|---|
| `index.js` | Entrada y guardado de los trozos. |
| `ui.js` | Ventana (sobre `js/ui/fsshell.js`) con los cortes dibujados encima. |
| `plan.js` | Rectángulos de cada modo y numeración. |

## Modos

- **Cuadrícula**: filas × columnas (hasta 20 × 20).
- **Tamaño fijo**: trozos de ancho × alto en píxeles.
- **Carrusel**: de 2 a 10 publicaciones seguidas con la proporción elegida
  (1:1, 4:5, 3:4, 2:3, 9:16, 16:9, 4:3, 3:2). Arrastrando se mueve el encuadre.
- **Instagram**: la cuadrícula del perfil (3 columnas, 1:1 o 3:4), numerada en
  el orden de subida. Arrastrando se mueve el encuadre.
- **A mano**: tocar la imagen añade un corte vertical u horizontal; los cortes
  se arrastran, se sacan de la imagen para quitarlos o se reparten por igual.

## Resultado

Cada trozo en una **capa nueva** en su sitio (un solo paso de deshacer), en su
propia **pestaña**, en un **ZIP** o como **archivos sueltos** (PNG, JPEG o WebP).
