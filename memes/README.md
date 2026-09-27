# Creador de memes

Editor a pantalla completa con la misma estructura que Stickers, el Filtro
Vintage y el revelador RAW. Se abre desde **Filtro › Especiales › Crear meme…** y, en
móvil, desde **Herramientas › Crear meme**. Sustituye al diálogo antiguo de
creación de memes, que se ha eliminado.

## Qué se puede hacer

- **26 diseños**: Clásico; Negro arriba y abajo; Blanco arriba y abajo; Barra
  negra arriba; Barra negra abajo; Moderno (barra blanca arriba); Pie de foto;
  Desmotivador; Texto al lado; Comparación No / Sí; Expectativa vs. realidad;
  Polaroid; Película; Última hora; Publicación de red social; Chat de
  mensajería; Cómic (bocadillo); Viñeta de cómic; Cita; Póster; Póster de
  película; Portada de periódico; Se busca; Cuadrado difuminado; Historia
  vertical 9:16 y Libre. Los que ponen barras o marcos fuera de la foto amplían el
  lienzo al aplicar; la foto nunca se reescala.
- **Marco**: color y tamaño.
- **Efecto de imagen**: frito, blanco y negro, sepia, viñeta, alto contraste,
  colores vivos, desvaído, desenfocado, pixelado, negativo y JPEG destrozado,
  con intensidad.
- **Textos ilimitados**, cada uno con: 29 tipografías de Google Fonts, tamaño,
  negrita, cursiva, mayúsculas, alineación, interlineado y espaciado; relleno
  sólido o degradado; contorno y contorno exterior; sombra (dirección,
  difuminado, color, opacidad); brillo/neón; glitch RGB; relieve 3D; fondo
  (rectángulo, redondeado, píldora, bocadillo, pensamiento, subrayador);
  ancho de caja, curvatura, rotación y opacidad.
- **26 estilos rápidos**: meme clásico, Impact, neón, retro 3D, cómic,
  bocadillo, oro, fuego, hielo, pegatina, glitch, máquina de escribir,
  rotulador, titular, terror, arcade…

## Resultado

Al aplicar se crea, en un único paso de historial:

- «Meme · marco», debajo de todo (fondo, barras y filetes del diseño);
- «Meme · efecto de imagen», si hay efecto;
- «Meme · degradado», si el diseño lo tiene;
- una capa por texto.

## Archivos

| Archivo | Papel |
|---|---|
| `index.js` | Entrada, ampliación del lienzo y creación de capas |
| `designs.js`, `designs-more.js` | Los 26 diseños: lienzo, posición de la foto, marco y textos iniciales |
| `model.js` | Propiedades del texto, su descripción para la interfaz y los estilos rápidos |
| `text.js` | Dibujo del texto (vista previa y resultado usan la misma función) |
| `effects.js` | Efectos de imagen |
| `fonts.js` | Tipografías de Google Fonts |
| `ui.js`, `memes.css` | Ventana |

Las tipografías se cargan de Google Fonts sólo al abrir el creador; sin conexión
se usa la alternativa de cada una. La CSP ya permite `fonts.googleapis.com` y
`fonts.gstatic.com`.
