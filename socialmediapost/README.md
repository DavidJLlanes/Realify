# Collage / History / Post

Editor a pantalla completa para crear collages, publicaciones de redes sociales,
historias y fondos de pantalla. Sigue el diseño de Memes, Stickers, Filtro Vintage
y el revelador RAW. En escritorio tiene tres columnas. En móvil la composición ocupa
la pantalla y los ajustes van en desplegables mínimos con un deslizador.

## Dónde está

- **Archivo › Collage / History / Post…**: funciona también sin documento abierto.
- **Filtro › Especiales › Collage / History / Post…**
- Móvil: **Herramientas › Pintar / Estilo › Collage / Post**.

Si hay un documento abierto, su imagen (todas las capas combinadas) entra como
primera foto. Al pulsar **Aplicar**, el resultado se abre como un **documento nuevo
en otra pestaña**, del tamaño del formato elegido. Tiene estas capas:

- «Fondo»
- una capa «Foto N» por cada hueco ocupado, ya recortada, con su marco y su sombra
- una capa por cada texto

El documento de partida no se modifica.

## Qué hace

- **Formatos**, todos en vertical u horizontal con un botón:
  - **Redes sociales** (29): Instagram (4:5, 1:1, 3:4, 1,91:1, historia y Reels),
    TikTok, Facebook, X, Threads, LinkedIn, YouTube (miniatura, Shorts, banner),
    Pinterest, WhatsApp, Snapchat, Telegram, Twitch, Bluesky y Reddit.
  - **Proporciones** (15): de 1:1 a 4:1, pasando por 4:3, 3:2, A4 (√2), 16:9,
    19,5:9, 21:9, etc.
  - **Móviles** (27): la resolución nativa de pantalla de los modelos más vendidos
    y conocidos. Incluye iPhone 17 Pro Max … SE, Galaxy S25 Ultra/S25/A5x/Z Flip/
    Z Fold, Pixel 10/9, Xiaomi 15, Redmi Note, OnePlus 13, OPPO Find X8, Motorola
    Edge, Huawei Pura y Honor.
  - **Personalizado**: ancho y alto a mano (16–8192 px).
  - **Resolución**: del 50 al 200 %.
- **Zonas seguras** (solo en la vista, no salen en el resultado):
  - Historias: marcan lo que tapa la interfaz de Instagram, TikTok y similares.
  - Móviles: marcan la barra de estado, las esquinas redondeadas y la cámara
    frontal (isla, muesca o perforación).
- **40 diseños de collage**:
  - Una foto, con espacio para texto o tipo polaroid
  - Círculo y foto dentro de foto
  - De 2 a 16 fotos: columnas, filas, grande + pequeñas, mosaico y molinete
  - Diagonales y triángulos
  - Fotos esparcidas y giradas
- **Composición**: espaciado, margen, esquinas redondeadas, forma circular, marco de
  cada foto y sombra.
- **Fondo**: color, degradado, la propia foto difuminada (con oscurecido) o
  transparente.
- **Fotos**:
  - Añadir: abrir varias a la vez, pegar (Ctrl+V o botón) o soltar archivos.
  - Colocar: arrastrar desde la bandeja a un hueco, o tocar un hueco y luego la foto.
  - En cada hueco: zoom con la rueda, dos dedos o el deslizador; encuadre
    arrastrando; girar, voltear y centrar.
  - Intercambiar: soltar una foto sobre otro hueco.
- **Textos**: el mismo motor del creador de memes. Incluye 29 tipografías (Google
  Fonts solo con permiso), 26 estilos rápidos, contornos, sombras, neón, relieve 3D,
  fondos y curvatura.
- Deshacer y rehacer propios, además de atajos: Ctrl+Z, Ctrl+Shift+Z, Supr,
  flechas y Esc.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `formats.js` | Formatos, orientación, proporción legible y zonas seguras |
| `layouts.js` | Diseños como polígonos convexos en coordenadas unitarias; separación entre huecos y miniaturas SVG |
| `render.js` | Fondo y fotos en su hueco. Lo usan la vista previa y el resultado |
| `ui.js` | La ventana (escritorio y móvil), los gestos y el historial |
| `index.js` | Entrada y creación del documento nuevo en su pestaña |
| `post.css` | Estilos. `index.js` también los carga por su cuenta si faltan |

Reutiliza `memes/model.js`, `memes/text.js` y `memes/fonts.js` para los textos.

## Procedencia y licencias

Se estudiaron estos repositorios. No se ha copiado código de ninguno: todos son
React/TypeScript y aquí todo es JavaScript sin dependencias.

| Repositorio | Licencia | Qué se tomó |
|---|---|---|
| [heyimjames/tela](https://github.com/heyimjames/tela) | MIT | Lista de formatos de anuncio y redes; la idea de los diseños como función del ancho y el alto, para que valgan en cualquier proporción |
| [joeseesun/poster-studio](https://github.com/joeseesun/poster-studio) | MIT | Selector de tamaños de lienzo |
| [HeyPortal/open-scrl](https://github.com/HeyPortal/open-scrl) | MIT | Exportación a lienzo 2D por capas |
| [Shuaa-Technology/social-post-maker](https://github.com/Shuaa-Technology/social-post-maker) | MIT | Plantillas de publicación con texto sobre la foto |
| [getopenpost/openpost](https://github.com/getopenpost/openpost) | AGPL-3.0 | Solo ideas: no se ha usado nada de su código |
| [sammwyy/StoryMaker](https://github.com/sammwyy/StoryMaker) | Sin licencia | Solo ideas: historia 9:16 con textos encima |
| [brayschurman/instacollage](https://github.com/brayschurman/instacollage) | Sin licencia | Solo ideas: cuadrículas de collage |
| [LoreVazquez/Insta-Collage](https://github.com/LoreVazquez/Insta-Collage) | Sin licencia | Solo ideas: plantillas de collage |

Las medidas de redes y pantallas son datos públicos: guías de cada plataforma y
fichas técnicas de los fabricantes.

Copyright de los proyectos MIT citados: sus autores. La licencia MIT permite
reutilizar con atribución, que es la de esta tabla.
