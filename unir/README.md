# Unir imágenes

Plugin a pantalla completa (escritorio y móvil) con dos modos. El resultado va a
una capa nueva (en una pestaña nueva si no mide lo mismo que el documento).

| Archivo | Qué hace |
|---|---|
| `index.js` | Entrada: abre el editor y crea la capa con el resultado. |
| `ui.js` | Ventana (sobre `js/ui/fsshell.js`) y la unión simple (fila, columna, cuadrícula). |
| `worker.js` | Panorámica fuera del hilo de la interfaz. |
| `engine.js` | Proyección cilíndrica, búsqueda del solape, ganancias, mezcla y recorte. |

## Panorámica

1. Todas las fotos al mismo alto (o ancho, si es vertical).
2. Proyección **cilíndrica** con el campo de visión de cada foto (o plana, para
   escaneos y planos).
3. Posición de cada foto respecto a la anterior: búsqueda completa en el nivel
   más pequeño de una pirámide (solape del 8 al 92 %, en los dos sentidos) y
   refinado nivel a nivel, maximizando la **correlación normalizada de los
   gradientes** del logaritmo de la luminancia —insensible a la diferencia de
   exposición y a las zonas lisas—. La primera pareja decide si es horizontal o
   vertical.
4. **Igualar exposición**: ganancia de cada foto por el brillo de las zonas
   solapadas.
5. Mezcla con transición suave (peso por distancia al borde) y **recorte** al
   mayor rectángulo sin huecos.

## Unión

Fila, columna o cuadrícula de 2, 3 o 4 columnas; igualar tamaños o alinear al
inicio, centro o final; proporción de las celdas y foto entera o llenando;
separación, margen, esquinas redondeadas y fondo de color o transparente.
