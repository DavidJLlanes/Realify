# Recortar en forma

Plugin a pantalla completa (escritorio y móvil) que sustituye al antiguo
diálogo. Recorta la imagen visible (o, sin documento, una foto que se elige)
con una forma y crea una **capa nueva** con transparencia fuera, o una pestaña
nueva recortada al contorno de la forma. El documento de partida no se toca.

| Archivo | Qué hace |
|---|---|
| `index.js` | Entrada y resultado. |
| `ui.js` | Ventana (sobre `js/ui/fsshell.js`), asas y render del recorte. |
| `shapes.js` | Catálogo de ~60 formas con contornos y agujeros (par-impar). |

## Formas

- **Básicas**: círculo, elipse, cuadrado, rectángulo, redondeado, cápsula,
  rombo, arco, semicírculo, huevo.
- **Polígonos**: polígono de 3 a 24 lados, triángulo (y rectángulo), del
  pentágono al dodecágono, paralelogramo, trapecio.
- **Estrellas**: estrella de 3 a 30 puntas con profundidad ajustable, de 4, 5,
  6, 8 y 12, destello, explosión, brillo, sol.
- **Especiales**: corazón, flores, margarita, trébol, hoja, gota, nube, luna,
  huella.
- **Símbolos**: bocadillos, cruz, aspa, flecha, chevrón, rayo, ubicación, casa,
  corona, gema, escudo, etiqueta, entrada, sello, engranaje, anillo, marco,
  pieza de puzle.

Las formas poligonales admiten esquinas redondeadas.

## Controles

Arrastrar la forma la mueve; las esquinas la escalan y el asa de arriba la gira
(con imán cada 45°). Tamaño, ancho, alto, deformar para llenar la caja, giro,
borde suave, contorno con color, invertir y fondo transparente o de color.
