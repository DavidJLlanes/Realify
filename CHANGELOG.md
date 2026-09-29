# Registro de cambios

Todos los cambios relevantes de [Realify](https://realify.es) se documentan en
este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Realify se publica de forma continua en [realify.es](https://realify.es), por lo
que las entradas se agrupan por fecha.

## [Sin publicar]

### Añadido
- **Fusión HDR Premium 👑**: interruptor con corona en la ventana del HDR, mismos mandos y
  estilos. Curva de respuesta de la cámara estimada del horquillado (Robertson + polinomio
  suave, o sRGB si no mejora), RAW fusionados en luz lineal Rec.2020 con su nivel de recorte,
  fusión de máxima verosimilitud (menos ruido y sin el sesgo de las sombras profundas),
  alineación con fracción de píxel (Lucas–Kanade), antifantasmas por zonas que también ve el
  color, tono y color en OKLab con tramado, y exportación a **TIFF 16 bits** y radiancia
  **.hdr**. Apagado, el HDR sale idéntico al de antes. Pruebas en `hdr/tests/premium.mjs`.
- **Revelado RAW Premium 👑**: interruptor con corona en el revelador (también en Revelado
  fotográfico). Mismo revelador y mismos mandos, motor de alta calidad: Rec.2020 sin recortar
  colores, demosaico DHT, luz lineal real en coma flotante, sombras/altas luces/claridad con
  filtros guiados sin halos, curva fílmica que lleva las luces al blanco sin quemarlas, ruido de
  color guiado, color en OKLab con ajuste de gama que conserva el tono, tramado, reducción en
  luz lineal con enfoque de salida y **TIFF de 16 bits**. Vista previa en GPU con la misma
  matemática que el resultado (ΔE < 0,4). Apagado, el revelador queda exactamente como antes.
  Componentes reutilizables de corona e interruptor Premium (`js/ui/premium.js`); aún sin pago.
- **Capas a pantalla completa en el móvil** (cualquier orientación): la imagen lo más grande
  posible, barra superior con cerrar, nueva, duplicar, eliminar, deshacer y rehacer, y una
  lista que deja ver dos capas y se desplaza. Tocar la imagen sólo la mueve o amplía. El botón
  fx/adj abre su editor encima sin cerrar Capas. Ya no se vuelve transparente la hoja al
  mover un deslizador. En escritorio no cambia nada.
- **Android: «Abrir» va directo a la galería** (el selector pide sólo imágenes; con
  extensiones añadidas, Android mostraba «Cámara / Archivos»). Nuevo **Archivo › Abrir RAW,
  PSD, TIFF o SVG…** (y enlace en la pantalla de inicio) para esos formatos, que no salen en
  la galería. En la Fusión HDR, el «+» ofrece Galería o Archivos.
- **Transparencia al guardar, en toda la web**: casilla «Conservar la transparencia» y color
  de fondo en Exportar, Exportar como, Editar en lote, Acciones y Cortar en partes
  (`js/io/alpha.js`). Se guarda el acoplado de las capas visibles; PNG, WebP, AVIF y GIF
  conservan la transparencia y JPEG/PDF rellenan con el color elegido. Con transparencia,
  Exportar propone PNG.
- **Recortar en forma** recorta sólo la capa activa, oculta las demás capas y avisa de cómo
  guardar con transparencia (con botón para exportar).
- **Fusión HDR, máximo de 11 fotos con aviso**: si se eligen más, un diálogo deja escoger
  cuáles (contador «9 de 11», no deja pasar del límite) antes de abrir ninguna; con 11 el
  botón de añadir lo indica y explica cómo liberar sitio. Las fotos con otra proporción
  u orientación se descartan de una en una, con aviso, sin rechazar las demás.
- **Fusión HDR con RAW**: revelar la primera y aplicar los mismos ajustes a todas,
  revelar una a una en el revelador RAW o usar su JPEG incrustado; la exposición sale
  de los metadatos del RAW.
- **Fusión HDR con las fotos abiertas**: elige, con miniaturas, las pestañas abiertas
  y entran tal como las estás editando.
- **Fusión HDR**: ordenar las fotos arrastrándolas (ratón, o mantener pulsado con el
  dedo); la exposición sigue al orden. EV contados desde la foto normal (−2 / 0 / +2).
- **Fusión HDR**: «Foto elegida» es el primer grupo (escritorio y móvil), con la
  exposición en tercios de paso, botones − / + y **Pasos entre fotos** para todo el
  horquillado de golpe; grupos ordenados según el flujo de trabajo y tira de fotos
  más cómoda en el móvil.
- **Guía actualizada** con todo lo nuevo: tiradores, cerrar todas las fotos, editar
  en lote, antes y después, hoja de contactos, GIF, AVIF y PDF, acciones, paleta,
  cuentagotas de pantalla y zoom con el efecto abierto.
- **Tiradores más fáciles de agarrar**, sobre todo con el dedo (`js/editor/grab.js`):
  zona de agarre mayor en táctil y lápiz, tiradores más grandes, gana el más cercano
  cuando se solapan y no saltan bajo el dedo al cogerlos. En Recortar, Transformar,
  Deformar, Perspectiva, formas, marco y trazado del texto, pluma, guías, Formas,
  Cortar y Galería de desenfoque.
- **Cerrar todas las fotos**: en Archivo, en Herramientas y en la barra de pestañas;
  una sola confirmación.
- **Fusión HDR** (`hdr/`): hasta 11 fotos, horquillado detectado solo, alineación,
  antifantasmas, fusión de exposición y mapeo tonal con 17 estilos.
- **Unir imágenes** (`unir/`): panorámica automática y unión en fila, columna o
  cuadrícula.
- **Cortar en partes** (`cortar/`) y **Recortar en forma** (`formas/`, ~60 formas)
  a pantalla completa, sustituyen a «Dividir en trozos» y al diálogo anterior.
- **Antes y después** (`comparar/`) y **Hoja de contactos** (`hojacontactos/`).
- Exportar en **AVIF** y **PDF**; **GIF animado** a partir de las capas.
- **Paleta de colores** y **cuentagotas de pantalla**.
- **Acciones**: grabar y repetir secuencias de comandos, también en lote.
- **Editar en lote / Aplicar esta edición a otras fotos** (`lote/`): edita una
  foto y copia su edición (ajustes, filtros, textos, marcas de agua) a otras
  pestañas o fotos de la galería, con vista previa, **igualado de exposición**
  y resultado en sus pestañas (capas reeditables) o en un ZIP.
- Capa de ajuste **Exposición** (en pasos EV).
- IA: **ampliar** ×2/×4, **colorear** y **expandir** el lienzo.
- Zoom y desplazamiento de la imagen mientras se aplica cualquier efecto.
- Aviso visible con botón Cancelar mientras trabaja la IA; si un modelo pesado
  agota la memoria y la página se recarga, la imagen se recupera.

### Cambiado
- **Brillo y contraste de precisión** (filtro y capa de ajuste): cálculo en coma flotante
  sobre la luminosidad percibida (L*) en lugar de una tabla de 8 bits canal a canal. El
  contraste es una curva en S alrededor del gris medio que fija el negro y el blanco (antes
  una recta que, a +50, ya recortaba las luces por encima de 215 y las sombras por debajo
  de 40); el brillo mueve los medios tonos sin recortar. El color se escala en luz lineal y,
  si no cabe, se reduce el croma en OKLab: el tono se desvía 0,2° de media (antes 5–9°, y
  hasta 70°). Los ajustes guardados siguen valiendo (mismos −100..100).
  Además: **tramado** fino y fijo al volver a 8 bits (disuelve las bandas en cielos y
  degradados), **pivote automático** sobre la luminosidad media de la foto (el contraste
  ya no oscurece las fotos oscuras ni aclara las claras; opción «Gris medio»), mando de
  **Protección de luces y sombras** y casilla **Usar heredado** con el cálculo antiguo.
- **Eliminar fondo** crea una capa nueva con el recorte y oculta la original.

### Eliminado
- «Procesar carpeta» (y el botón «Abrir lote» del inicio): sólo aplicaba el
  filtro Realify con variaciones; lo sustituye «Editar en lote».

### Corregido
- **Revelador RAW, luz lineal real**: el motor (LibRaw-Wasm) entrega los datos con la curva
  BT.709 aunque se le pida lineal, y el revelado los trataba como lineales: todo salía más
  claro y los ajustes de exposición, balance y tono trabajaban sobre valores equivocados.
  Ahora se deshace esa curva exactamente, en la vista previa, el resultado y el balance
  automático (con +0,3 EV de exposición base, como las cámaras): el gris medio queda en
  ~130/255, igual que en Premium. Los RAW revelados antes se verán algo más oscuros.
- Aviso de versión nueva: con el service worker bloqueado (navegación privada, políticas de
  empresa) lanzaba un error a los 5 s y cada 30 minutos. Era lo que hacía fallar la prueba
  `raw/tests/editor-transition.mjs`, que ahora pasa.
- Revelador RAW: en el menú del motor, «Rec.2020» y «DCI-P3» estaban intercambiados; la
  cabecera mostraba «[object Object]» en lugar del objetivo.
- «Editar en lote» (pantalla de inicio) necesitaba dos pulsaciones en el móvil: el selector
  de fotos se abría después de descargar el código del lote y el navegador ya no lo
  permitía. Ahora se abre en el mismo toque; igual en Cortar y Recortar en forma sin
  documento, en Acciones en lote e importar acciones, y al añadir fotos en el HDR.
- Exportar en JPEG una imagen con zonas transparentes las volvía negras; ahora se rellenan
  con el color de fondo elegido (blanco por defecto).
- Fusión HDR con horquillados largos (hasta 11 fotos, ±5 EV): la alineación fallaba en
  las tomas extremas (hasta 43 px de error, y el resultado salía muy recortado). Ahora
  combina tres métodos y dos criterios: error máximo de 2 px en las pruebas. Menos
  memoria al cargar muchas fotos, progreso «Alineando · k de n» y, en el móvil, copia
  de seguridad de las fotos abiertas por si la página se cierra.
- Los diálogos y avisos quedaban detrás de los editores a pantalla completa (HDR,
  Unir, Cortar, Formas…).
- Fusión HDR: el resultado se abre siempre como una foto nueva (pestaña propia,
  historial vacío). Si la imagen abierta era del horquillado, antes se añadía como capa
  encima y Comparar enseñaba la foto original en vez del HDR.
- Comparar: tras crear un HDR (o cualquier resultado que se abre en una pestaña
  nueva) el «antes» salía vacío, y al cambiar de pestaña se perdía y pasaba a ser la
  propia edición. Ahora cada pestaña guarda su «antes». Al cerrar la foto con Comparar
  activo, la comparación se quedaba pintada sobre la pantalla de inicio.
- Fusión HDR: con − / + la foto elegida saltaba de sitio en la lista; el EXIF sin
  diafragma ya no obliga a estimar la exposición por el brillo.
- Fusión HDR: la exposición de una foto no se veía hasta soltar el deslizador; ahora
  cambia en tiempo real. Se lee el EXIF de HEIC, PNG y WebP, y la estimación sin EXIF
  iguala los pasos del horquillado.
- Transformar: al estirar una esquina rápido, la esquina opuesta se movía y el
  tirador se quedaba atrás; con la capa ya movida, escalar la hacía saltar.
- ISNet recibía la imagen sin normalizar y devolvía máscaras casi uniformes.
- Rasterizar un texto mientras se editaba dejaba un error al cerrar la edición.
- El despliegue reintenta la conexión SSH si el servidor la corta.

### Añadido
- **Aviso de versión nueva**: al volver a la app (y cada 30 minutos) se
  comprueba si hay una versión publicada; si la hay, una barra ofrece
  «Actualizar», que guarda todas las pestañas abiertas, recarga y las reabre.

### Cambiado
- **Tipografías sin Google**: todo el catálogo de Google Fonts (1908 familias)
  se sirve desde el propio sitio, en `/fonts/`. El navegador ya no se conecta
  con Google, desaparece el aviso de permiso y las fuentes funcionan sin
  conexión. La herramienta Texto tiene un buscador con vista previa
  («Más fuentes (buscar entre 1900)…»).

### Añadido
- Documentación del repositorio: guía de contribución, código de conducta,
  política de seguridad, plantillas de issues y pull requests, y este registro
  de cambios.

## 2026-09-27

### Añadido
- **Collage / History / Post**: collages, publicaciones e historias para redes
  sociales, con 40 diseños, formatos de más de 29 redes, proporciones y
  pantallas de móviles, zonas seguras, diseño «Libre» y 28 formas para las
  fotos.
- **Creador de memes**: 26 diseños, segunda foto, efectos de imagen y textos
  con 29 tipografías y 26 estilos rápidos.
- **Stickers**: 1.595 emojis de Fluent Emoji en cuatro estilos, con tonos de
  piel y búsqueda en español e inglés.
- **Filtro Vintage avanzado**: 41 parámetros en 7 grupos y 102 estilos.
- **Estilos**: 160 looks en 16 categorías, con buscador y miniaturas.
- **Curvas** con canal de luminosidad, vista R · G · B y 25 estilos.
- **Tonos del histograma** e **histograma interactivo** en el panel lateral.
- **Cuadrícula inteligente** con detección de sujeto, horizonte y rostros, y
  propuesta de recorte.
- **Pinceles especiales**: simétrico, con textura y de degradado.
- **Dividir en trozos** (carrusel e Instagram) y **recortar en forma**.
- Remuestreo Lanczos 3, Mitchell y Catmull-Rom.
- Tramado opcional a 8 bits al exportar.
- README con todas las funcionalidades de la web.

### Cambiado
- **Revelado RAW**: flujo lineal de 16 bits, nuevo modelo tonal y controles
  mejorados.
- Filtros con alternativa en CPU cuando falla la GPU.

### Corregido
- Correcciones en varios filtros.
