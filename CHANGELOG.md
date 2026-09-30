# Registro de cambios

Todos los cambios relevantes de [Realify](https://realify.es) se documentan en
este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Realify se publica de forma continua en [realify.es](https://realify.es), por lo
que las entradas se agrupan por fecha.

## [Sin publicar]

### Añadido
- **Contraste automático Premium 👑** (menú Ajustes, junto a «Contraste automático», y cajón
  del móvil, en «Automáticos» y «Mejorar», con corona): el mismo recorte del 0,2 % de la
  luminancia, pero aplicado como Niveles maestros Premium: estira la intensidad de cada color en
  coma flotante, sin sobresaturar ni cambiar el tono, con gama y tramado. Queda como capa de
  Niveles reeditable.
- **Tono / Color automático Premium 👑** (interruptor en el propio ajuste, mismos mandos): en
  modo Tono el estiramiento y los medios van a la intensidad de cada color (un naranja ya no se
  quema a 248/89/0); en modo Color cada canal se sigue estirando por separado. «Ajustar colores
  neutros» mide los grises ya ajustados en luz lineal y corrige con una ganancia por canal
  (balance de blancos, 75 %, con topes) en vez de sumar un desplazamiento que teñía los negros.
- Curvas (escritorio): «Automático» va en su propia fila y «Restablecer canal» y «Restablecer
  todo» ya no salen cortados.

- **Pestaña «Automáticos» en el cajón de herramientas** (móvil), la segunda tras «Básicos»: reúne
  todos los ajustes automáticos (Automático, Auto Premium 👑, Tono y color auto., Contraste auto.,
  Niveles auto. y Niveles auto. Premium 👑), que siguen también en «Mejorar».
- **Curvas y Niveles Premium 👑** (`js/editor/tonepremium.js`): coma flotante sin los redondeos
  intermedios de las tablas de 8 bits; la curva o los niveles MAESTROS (RGB) se aplican a la
  intensidad de cada color y no canal a canal, así que una curva en S ya no cambia el tono (de
  2-4° en el modo normal a 0-0,2°) ni sobresatura; curva de Luminosidad en luz lineal; mapeo de
  gama y tramado. Los de cada canal siguen siendo canal a canal. Vista previa con tabla de 33³
  colores; el resultado final, exacto.
- **Automáticos**: el botón «Automático» de Niveles en Premium mide los colores más oscuros y
  más claros de la foto (el 0,1 % de cada extremo) y ajusta los tres canales y los medios de una
  vez (neutraliza dominantes; una foto azulada pasa de 98/110/143 a 110/113/118 de media). Nuevo
  **«Niveles automáticos Premium 👑»** (menú Ajustes, junto a «Niveles automáticos», y cajón del móvil, con
  corona): lo mismo de un toque, como capa de Niveles reeditable. **Curvas** gana un botón
  **«Automático»** («Auto» en el móvil): negro, blanco y medios; en Premium también neutraliza
  las dominantes por canal.
- En Curvas el interruptor Premium va arriba a la izquierda, junto a ✕; en Niveles, a la
  izquierda de Cancelar/Aplicar.

### Añadido
- **Sombras / Iluminaciones Premium 👑** (con Radio y Tono): el entorno de cada píxel se mide
  con un filtro guiado sobre L* que no cruza los bordes, así que una silueta oscura contra un
  cielo claro ya no queda con una banda oscura arriba y una neblina abajo, como en el modo
  normal; radio relativo al tamaño de la imagen (la vista previa reducida y el resultado final
  coinciden); la corrección va a la base y la textura se conserva y refuerza hasta un 35 % donde
  se abren sombras o se recuperan luces; transiciones en S; color en luz lineal con mapeo de
  gama y tramado. En el móvil, el interruptor a la izquierda de Cancelar/Aplicar.

### Cambiado
- **Brillo y contraste Premium, rehecho**: el anterior se distinguía poco del normal y, cuando
  se notaba, parecía artificial (textura realzada, aspecto «HDR»). Ahora la curva se aplica a la
  intensidad de cada color (media de potencias de R, G y B) en vez de a la luminancia, y los tres
  canales se escalan por igual: los colores intensos no se desaturan al aclararse y el cielo
  sigue azul donde el modo normal lo lleva casi a blanco. La textura sólo se recupera en parte
  (la mitad de lo que la curva aplanaría, nunca más que la original, base de filtro guiado ancho)
  y nada al bajar el contraste; los bordes duros quedan limpios (±2 niveles).

### Añadido
- **Auto Premium 👑** en el cajón de herramientas del móvil (y en Ajustes › Tono avanzado ›
  «Mejora automática Premium»): mejora de un toque con los motores Premium. Balance de blancos
  en luz lineal estimado con los píxeles casi neutros (o «shades of gray»), corregido al 75 % y
  con topes para no borrar una luz cálida buscada; color con más croma cuanto más apagado (sin
  tocar los colores ya intensos), en OKLab con mapeo de gama y tramado; y luz con Brillo y
  contraste Premium a partir de los percentiles de L*. Los valores medidos se guardan en su capa
  de filtro («auto-premium»), así que volver a calcularla da el mismo resultado.

### Cambiado
- **Cajón de herramientas (móvil)**: se quita el botón grande «Automático» de la cabecera. En su
  lugar, «Automático» y el nuevo «Auto Premium» (dorado y con la corona) van primero en la
  rejilla y resaltados: fondo y borde de color e icono dentro de un círculo. «Mejora automática»
  también en Ajustes › Tono avanzado, para que el menú sea el mismo en móvil y escritorio.

### Añadido
- **Brillo y contraste Premium 👑**: la curva se aplica a la base de la imagen (filtro guiado
  rápido, que suaviza sin cruzar bordes) y la textura se conserva con al menos su amplitud
  original. Con contraste +80 la textura de las luces quedaba al 59 % en el modo normal; en
  Premium se conserva entera (con brillo +60, del 57 % al 100 %). Sin halos apreciables (2-4
  niveles en el píxel pegado a un borde duro) y −100 sigue dejando la imagen plana. El resto,
  como el motor normal: tono conservado, mapeo de gama en OKLab y tramado.
- **Equilibrio de color Premium 👑**: zonas por luminosidad percibida (OKLab), cada mando empuja
  hacia su primario en el plano de color de OKLab (calibrado para empujar lo mismo que el modo
  normal), «Conservar la luminosidad» exacta (±0,002 en L), negros sin manchar, mapeo de gama y
  tramado.
- Motor de color Premium común para los ajustes que transforman cada color por separado
  (`js/editor/premiumcolor.js`, lo usan Tono y saturación y Equilibrio de color). En ambos
  ajustes el interruptor va, en el móvil, a la izquierda de Cancelar/Aplicar.

### Cambiado
- **Interruptor Premium 👑 en el móvil**: ya no ocupa una fila propia. Va en la barra del botón
  de aplicar, alineado a la izquierda, siempre con la palabra «Premium» junto a la corona e
  idéntico (mismo tamaño y estilo) en todos los plugins: en Tono y saturación, a la izquierda de
  Cancelar/Aplicar; en la Fusión HDR y el revelador RAW, arriba a la izquierda junto a ✕. Las
  hojas de ajuste compactas del móvil ocupan menos alto (Tono y saturación: de 227 a 195 px),
  para que la imagen tenga más sitio. En escritorio no cambia nada (`dockPremium` en
  `js/ui/premium.js`).

### Añadido
- **Tono y saturación Premium 👑**: interruptor con corona en el ajuste. Mismos mandos, motor
  en OKLCh, luz lineal y coma flotante: al girar el tono se conserva la luminosidad percibida
  (en el modo normal un amarillo girado a azul pasaba de 0,58 a 0,11 de luminancia; en Premium
  se queda en 0,57), la saturación trabaja sobre el croma, Luminosidad apaga el color al
  acercarse al blanco o al negro, Colorear conserva la luminosidad de cada píxel, mapeo de
  gama sin recortar canales y tramado al volver a 8 bits. Vista previa en vivo con una tabla de
  33³ colores interpolada en luz lineal; el resultado final se calcula color a color
  (`js/editor/hslpremium.js`). Apagado, el ajuste es idéntico al de siempre.

### Corregido
- **Los desplegables ya no aparecen abiertos al abrir un ajuste en el iPhone**: el diálogo
  daba el foco a su primer mando y, en iOS, enfocar un desplegable lo despliega (pasaba en Tono
  y saturación y en cualquier ajuste con desplegable). En pantallas táctiles el foco va ahora a
  la propia ventana; los desplegables aparecen siempre cerrados.

### Corregido
- **Balance de blancos sin miniatura**: se quita la vista previa que abría la herramienta (y su
  capa de ajuste). Actúa sobre la imagen abierta en tiempo real con la misma interfaz mínima
  que los demás ajustes (en el móvil, un desplegable Temperatura/Tinte y su deslizador), y el
  **Cuentagotas** se usa tocando directamente la imagen abierta.
- **Más sitios donde el teclado del móvil tapaba lo que escribías**: revisados todos los campos
  de texto. Estaban tapados el texto de **Memes**, los textos de **Collage / History / Post**,
  las semillas de **Cámara** (Realify), los campos del grupo Motor del **revelador RAW** y el
  cuadro de la herramienta **Texto** cuando está en la parte de abajo de la foto. Ahora los
  editores a pantalla completa terminan donde empieza el teclado (su pie queda a la vista) y,
  con la herramienta Texto, la imagen sube lo justo para ver el cuadro y vuelve al cerrar el
  teclado (`js/ui/keyboard.js › installKeyboardFit`).

### Añadido
- **Diálogos usables con el teclado del móvil**: al escribir en un diálogo (las medidas de
  «Documento nuevo», un nombre, un número…), la hoja sube y se apoya encima del teclado en vez
  de quedar tapada, y el campo activo se mantiene a la vista; al cerrar el teclado vuelve a su
  sitio. Mismo arreglo que el buscador del cajón de herramientas, ahora compartido
  (`js/ui/keyboard.js`).
- **Cuentagotas de punto blanco** en todo lo que tiene balance de blancos: tocas algo que deba
  ser blanco o gris y la temperatura y el tinte se calculan para dejarlo exactamente neutro.
  - **Revelador RAW / Revelado fotográfico** (normal y Premium 👑): botón sobre la vista
    previa; lee la foto en luz lineal antes de revelar, en el espacio donde se aplica el
    balance (Rec.2020 en Premium) y, si la dominante no cabe en los mandos, elige también el
    preajuste de balance más cercano.
  - **Balance de blancos** (plugin) y su **capa de ajuste**: botón «Cuentagotas» visible (antes
    había que saber que se podía tocar la miniatura), media de 5×5 píxeles en vez de uno, marca
    en el punto elegido y cálculo exacto (antes quedaba casi, pero no del todo, gris). La capa
    lee lo que hay debajo de ella.
  - **Fusión HDR** (normal y Premium): Color › «Cuentagotas de balance de blancos»; se lee la
    imagen mapeada antes del acabado.
- **Buscador del cajón de herramientas usable con el teclado del móvil**: al escribir, el cajón
  sube y se apoya encima del teclado (antes el teclado tapaba los resultados); la tecla
  «Buscar» cierra el teclado y deja los resultados a pantalla completa; al cerrar el teclado o
  elegir una herramienta, el cajón vuelve a su tamaño normal. Android e iPhone.
- **Barra de grabación de acciones flotante**: se arrastra por el asa ⠿ o por el texto a
  cualquier sitio de la pantalla (ratón o dedo) para dejar libre la barra superior; recuerda la
  posición y no se sale de la pantalla al girar el móvil o cambiar el tamaño de la ventana.

### Corregido
- **Actualizaciones que no llegaban**: tras publicar, el móvil podía seguir usando durante horas
  archivos antiguos (p. ej. los del Filtro Vintage) guardados en la caché del navegador. El
  service worker ahora pregunta siempre al servidor si hay versión nueva antes de usar la copia
  guardada (sin conexión sigue funcionando igual).
- **Filtro Vintage · hoja de marcos**: todas las miniaturas del mismo tamaño y alineadas en su
  rejilla (antes algunas se salían de la tarjeta en el móvil), nombres de dos líneas como
  máximo, miniaturas más nítidas en pantallas de alta densidad y el selector de categoría
  sigue al desplazamiento.

### Añadido
- **Filtro Vintage: 119 marcos y 113 estilos nuevos**. Nuevo desplegable **Marco** (escritorio y
  móvil) que abre una hoja con la miniatura de cada marco sobre la propia foto, en 10 categorías:
  instantáneas, película (35 mm, 120, súper 8, diapositivas, limados), papel antiguo (barbado,
  festoneado, albúmina, gabinete, paspartús), marcos de cuadro (dorados, plata, maderas, laca,
  art déco), postales y sellos, viñetas y formas (óvalos, camafeo, cerradura, corazón…),
  pantallas y visores (televisor, VHS, videocámara, telémetro…), desgaste (quemado, agua,
  grunge, moho), decorativos (encaje, greca, neón, azulejo…) y álbum (esquinas, washi, clip).
  «Anchura del marco» en el grupo Bordes. 215 estilos en 19 categorías; 11 categorías nuevas
  (laboratorio, cine clásico, viajes y postales, retratos antiguos, instantáneas, álbum de
  familia, noir, pop y psicodelia, tecnología retro, galería y museo, papel y archivo) y 87
  estilos que ya traen su marco (`vintagefilter/frames.js`).
- **Aviso de móvil en horizontal**: en un teléfono (Android o iPhone) girado, un aviso explica
  que Realify está optimizado para el móvil en vertical y que la versión de escritorio es para
  ordenador. Desaparece al volver a vertical; «Seguir en horizontal» lo oculta hasta cerrar la
  pestaña. No sale en tabletas ni ordenadores (`js/ui/landscape.js`).
- **Borrar guías más fácil**: doble clic o doble toque sobre una guía la borra (antes sólo
  arrastrándola hasta la estrecha franja de la regla, incómodo con el dedo). «Borrar guías»
  también en el cajón de Herramientas del móvil, con su icono. Tocar una guía sin moverla ya
  no deja un paso vacío en el historial.
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
- Escritorio: en los menús de herramientas agrupadas de la barra izquierda (mantener pulsado o
  clic derecho) los iconos y nombres salían centrados; ahora van alineados a la izquierda.
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
