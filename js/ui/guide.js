/* La guía. Es documentación larga y sólo la abre quien la pide, así
   que se carga bajo demanda y no pesa en el arranque.

   Índice + subpáginas, no un único scroll interminable: cada tema
   abre su propio contenido en el mismo hueco del diálogo, así que lo
   que se ve en pantalla es siempre corto aunque el conjunto no lo
   sea. «Realify» —el bloque más largo, con diferencia— es a su vez
   un índice con sus propias subpáginas, en vez de un tema más.

   Al añadir una función nueva a la app, el sitio para documentarla es
   aquí: un tema nuevo en TOPICS (o una entrada nueva dentro de un
   tema ya existente), nunca dejarla sin guía. */

import { dialog } from "./dialog.js";

const INTRO = `
  <p class="lead">Una fotografía no es una imagen limpia: es una imagen que ha
    atravesado un objetivo, un sensor y un procesador, y cada uno deja huellas
    medibles. Un generador de imágenes produce el resultado directamente, sin
    recorrer ese camino, y por eso le faltan todas esas huellas a la vez.
    Esta herramienta reproduce el recorrido físico, paso a paso y en el orden
    correcto.</p>

  <p>El botón <b>?</b> junto al nombre de la herramienta activa, en la barra de
    opciones, abre esta misma guía directamente en su explicación —sin tener que
    buscarla aquí a mano—.</p>

  <div class="callout">
    <p><b>Uso responsable.</b> Esta herramienta añade artefactos de captura y
      escribe metadatos EXIF. Eso es legítimo para investigación sobre robustez
      de detectores, para trabajo artístico que mezcla síntesis y fotografía,
      para privacidad sobre tu propio flujo de trabajo y para probar tus propias
      defensas. No lo es para presentar una imagen sintética como prueba, como
      documento, como noticia o como registro de un hecho que no ocurrió, ni
      para atribuirla a una persona o un equipo que no son los tuyos. La
      diferencia no está en la técnica, está en lo que afirmas con el
      resultado.</p>
  </div>`;

const TOPICS = [
  { id:"novedades", title:"Novedades",
    desc:"Lo último que se ha añadido, con enlace directo a su explicación.",
    html:`
      <h3>Novedades</h3>
      <ul class="guide-news">
        <li><a data-go="mover#tool-handles">Tiradores más fáciles de agarrar</a>, sobre todo con el
          dedo: más grandes, se coge siempre el más cercano y no saltan bajo el dedo.</li>
        <li><a data-go="archivo#file-closeall">Cerrar todas las fotos</a> de una vez (Archivo, Herramientas
          y un botón en la barra de pestañas).</li>
        <li><a data-go="archivo#file-batch">Editar en lote</a>: edita una foto y copia su edición a las
          demás, igualando la exposición.</li>
        <li><a data-go="imagen#img-beforeafter">Antes y después</a>, <a data-go="archivo#file-contactsheet">Hoja
          de contactos</a>, <a data-go="archivo#file-gif">GIF animado</a> y
          <a data-go="archivo#file-actions">Acciones</a> para grabar y repetir pasos.</li>
        <li><a data-go="vistas#an-palette">Paleta de colores</a> y <a data-go="vistas#an-eyedropper">cuentagotas
          de pantalla</a> (menú Análisis).</li>
        <li><a data-go="filtros#flt-zoom">Zoom con el efecto abierto</a>: acerca la imagen para juzgar un
          enfoque o un filtro sin que se cancele.</li>
        <li><a data-go="especiales#sp-collage">Collage / History / Post</a>: collages,
          publicaciones e historias con 41 diseños (incluido «Libre»), formatos de todas las
          redes y de los móviles más conocidos, y fotos dentro de 28 formas.</li>
        <li><a data-go="imagen#img-hdr">Fusión HDR</a>, <a data-go="imagen#img-merge">Unir imágenes</a>,
          <a data-go="imagen#img-slice">Cortar en partes</a> y <a data-go="imagen#img-shapecrop">Recortar en
          forma</a>, a pantalla completa en el menú Imagen.</li>
        <li><a data-go="imagen#img-ai">Ampliar, colorear y expandir con IA</a>; exportar en AVIF, PDF y GIF
          animado; <b>Acciones</b> para grabar y repetir pasos (Archivo › Acciones…).</li>
        <li><a data-go="vistas#view-histogram">Histograma interactivo</a> y <a data-go="ajustes#adj-toneband">Tonos
          del histograma</a>: toca una zona y ajusta sólo esos tonos.</li>
        <li><a data-go="ajustes#adj-curves">Curvas</a> con luminosidad, las curvas de todos los
          canales a la vez, vista R · G · B y 25 estilos.</li>
        <li><a data-go="vistas#view-smartgrid">Cuadrícula inteligente</a>: sujeto, horizonte y rostros
          detectados, tercios, proporción áurea, espiral… y recorte propuesto.</li>
        <li><a data-go="pintura#tool-brush-special">Pinceles especiales</a>: simétrico (también en
          diagonal), con textura procedural y de degradado a mano alzada.</li>
        <li><a data-go="pintura#tool-dodgeburn">Dodge &amp; Burn</a> con vista de la capa gris en
          tiempo real.</li>
        <li><a data-go="especiales#sp-looks">Estilos</a>: 160 acabados en 16 categorías, con buscador.</li>
        <li><a data-go="especiales#sp-vintage">Filtro Vintage</a>: 215 estilos en 19 categorías y
          119 marcos con miniatura.</li>
        <li><a data-go="ajustes#adj-rangehsl">Color por rangos</a> rehecho como mezclador HSL de
          ocho rangos, y Curvas Lab y Desplazamiento / mínimo / máximo corregidos.</li>
        <li><a data-go="otras#tool-text">Texto</a> con unas 1900 tipografías libres (con buscador) y alineación que no mueve el bloque.</li>
        <li><a data-go="especiales#sp-meme">Creador de memes</a>, <a data-go="capas">stickers</a>
          y <a data-go="especiales#sp-realify">Realify</a> a pantalla completa.</li>
        <li><a data-go="movil">Móvil</a>: cajón de herramientas con buscador y editores pensados para
          el pulgar.</li>
      </ul>` },

  { id:"pintura", title:"Pintura y retoque",
    desc:"Pincel (simétrico, con textura, de degradado), clonar, manchas, Exponer, Dodge &amp; Burn, licuar…",
    html:`
      <h3>Herramientas de pintura y retoque</h3>
      <ul>
        <li id="tool-brush"><b>Pincel (B).</b> Pinta con el color, tamaño, dureza y opacidad del panel.
          «Pinceles…» abre las puntas —incluidas imágenes y archivos ABR—, flujo,
          espaciado, dispersión, ángulo, suavizado, simetría y las dinámicas por presión,
          velocidad o dirección. Si la capa activa tiene una máscara seleccionada como
          destino, pinta en la máscara en vez de en el color.</li>
        <li id="tool-brush-special"><b>Pinceles especiales</b> (barra de opciones del Pincel, o menú
          Editar › Pinceles especiales). Tres modos que se combinan entre sí:
          <ul>
            <li><b>Simetría.</b> Pinta a la vez al otro lado de un eje: vertical (izquierda ↔
              derecha), horizontal (arriba ↕ abajo), ambos ejes (cuatro cuadrantes), cualquiera
              de las dos diagonales —la diagonal real del documento, de esquina a esquina—,
              las dos a la vez o radial (caleidoscopio, de 2 a 16 radios). Los ejes se ven
              como líneas azules discontinuas mientras el Pincel está activo.</li>
            <li><b>Textura.</b> El trazo lleva dentro una textura procedural —grano, papel,
              lienzo, cristales, rayones, esponja o ruido fino— fija al documento, como la de
              un papel de verdad: no «viaja» con cada toque. «Relieve» decide cuánto se nota
              y «Escala», su tamaño.</li>
            <li><b>Color: degradado o arcoíris.</b> Dibuja degradados a mano alzada: el color
              va del frontal al de fondo según la distancia pintada (o recorre el arcoíris).
              «Longitud» es cuántos píxeles de trazo tarda en completarse; en «Pinceles…» se
              elige si va y vuelve, se repite o se queda en el último color.</li>
          </ul></li>
        <li id="tool-eraser"><b>Borrador (E).</b> Igual que el Pincel pero deja transparencia en vez de
          color; sobre una máscara, la oscurece.</li>
        <li id="tool-clone"><b>Clonar (S).</b> Copia píxeles de un punto a otro. Mantén <kbd>Alt</kbd> y
          haz clic para fijar el origen antes de pintar: es el paso que más se olvida.</li>
        <li id="tool-heal"><b>Eliminar manchas (J).</b> No necesita origen: busca solo el parche de
          alrededor que mejor encaja y tapa la mancha con él. Para manchas pequeñas y
          aisladas, más rápido que Clonar. «Muestra» decide de dónde busca y copia
          textura: sólo la capa activa, o todas las capas visibles compuestas —para
          retocar en una capa nueva y vacía por encima, sin tocar el original—; el
          trazo, en los dos casos, se sigue pintando sólo en la capa activa.</li>
        <li id="tool-expose"><b>Exponer (O).</b> Aclara (sobreexponer) u oscurece (subexponer) por
          zona —sombras, medios o luces—, como tapar y reservar en el laboratorio.
          Toca los píxeles directamente; para lo mismo pero SIN tocarlos, ver
          «Dodge & Burn» más abajo.</li>
        <li id="tool-dodgeburn"><b>Dodge & Burn, gris 50 %</b> (Ctrl+Mayús+D, o menú Filtro). El aclarado y
          oscurecido no destructivo de cualquier retoque serio: la primera pincelada crea
          una capa gris al 50 % en modo Superponer —un gris exacto no cambia nada de lo
          que hay debajo, así que empieza totalmente transparente al ojo— y pintar blanco
          o negro encima aclara u oscurece esa zona sin tocar ni un píxel de la foto
          original, semanas después incluida: se puede seguir retocando, o borrar la capa
          entera y volver a empezar. «Aclarar»/«Oscurecer» decide el color con el que se
          pinta, no lo elige la paleta; Tamaño y Dureza son los mismos que el resto de
          pinceles (funcionan con <kbd>[</kbd> <kbd>]</kbd>), Exposición es la fuerza de
          cada pincelada. «Nueva capa gris» empieza una capa aparte para una segunda pasada
          sin mezclarla con la primera. <b>«Ver gris 50 %»</b> (también en Filtro › Fotografía
          y detalle) enseña la capa gris tal cual, en tiempo real mientras pintas, para ver
          exactamente dónde se ha aclarado y oscurecido; vuelve a pulsarlo para la vista
          normal.</li>
        <li id="tool-smudge"><b>Emborronar (R).</b> Arrastra y mezcla el color existente, como pasar un
          dedo sobre pintura fresca. Para suavizar transiciones, no para limpiar manchas.</li>
        <li id="tool-liquify"><b>Licuar (Q).</b> Empuja, frunce, hincha o remolinea una zona con un
          pincel; «conservar volumen» evita que lo empujado adelgace demasiado.
          «Restablecer» devuelve la capa a como estaba antes de licuar nada.</li>
        <li id="tool-historyBrush"><b>Pincel de historial</b> (Ctrl+Mayús+H, o menú Editar). Pinta píxeles de
          una instantánea (ver «Instantáneas») sobre la capa activa, con el
          mismo halo suave de dureza que cualquier otro pincel: para traer de vuelta
          SÓLO una zona de un estado anterior —un ojo que salió mejor en la primera
          pasada, por ejemplo— sin deshacer todo lo demás. Antes de usarlo hace falta
          marcar una instantánea como origen (el círculo de su fila, en el panel
          Historial); si la capa activa no existía todavía cuando se tomó esa
          instantánea, avisa en vez de pintar cualquier cosa.</li>
      </ul>` },

  { id:"instantaneas", title:"Instantáneas",
    desc:"Copias completas del documento, con nombre, para volver de un solo paso.",
    html:`
      <h3>Instantáneas</h3>
      <p>El historial de deshacer (<kbd>Ctrl+Z</kbd>) es una cinta que se recorre paso a
        paso y que, para no comerse toda la memoria, va soltando las capturas más
        antiguas con el tiempo. Una instantánea es otra cosa: una copia COMPLETA del
        documento —todas las capas, con sus píxeles y máscaras—, con el nombre que le
        pongas («antes del retoque»), que no se suelta sola nunca —sólo si la borras a
        propósito—. Volver a ella es un único paso de deshacer, no cuarenta.</p>
      <ul>
        <li><b>Nueva instantánea…</b> (el icono junto a Deshacer/Rehacer, en el panel
          Historial, o menú Editar). Pide un nombre y guarda el estado actual.</li>
        <li><b>Volver a una instantánea.</b> Clic sobre su nombre, en el panel
          Historial. Las capas creadas después de tomarla desaparecen; las que había
          antes vuelven a como estaban entonces.</li>
        <li><b>Renombrar / Eliminar.</b> Doble clic sobre el nombre para renombrarla;
          la ✕ de su fila la borra. Borrar una instantánea no afecta al historial de
          deshacer normal.</li>
        <li><b>Origen del Pincel de historial.</b> El círculo a la izquierda de cada
          fila: clic para marcar esa instantánea como la que usa el pincel de arriba.</li>
      </ul>` },

  { id:"seleccion", title:"Selección",
    desc:"Formas, lazo, pluma, relleno según contenido, sujeto/cielo por IA, refinar borde.",
    html:`
      <h3>Selección</h3>
      <p>El contorno de cualquier selección se marca con la misma raya discontinua
        animada de cualquier editor, y se sigue viendo aunque cambies de herramienta
        para pintar dentro de ella.</p>
      <ul>
        <li id="tool-select-rect"><b>Selección rectangular (M) / elíptica (K).</b> Arrastra para acotar una
          zona regular; las esquinas se ajustan solas a los bordes y el centro del
          documento, a cualquier guía, a los bordes y centros de otras capas y a la
          cuadrícula, igual que la herramienta Mover (ver «Mover, recortar y
          transformar»).</li>
        <li id="tool-select-lasso"><b>Lazo (L).</b> Traza un contorno a mano alzada, como con un ratón sobre
          papel.</li>
        <li id="tool-select-wand"><b>Varita mágica (W).</b> Selecciona por color: «Tolerancia» controla cuánto
          puede variar el color y seguir contando, y «Contiguo» limita la selección a la
          mancha conectada bajo el cursor (si se apaga, coge todo el color parecido de la
          capa, esté donde esté).</li>
        <li id="tool-pen"><b>Pluma (A).</b> Trazados Bézier de verdad, para un contorno preciso que el
          lazo a mano alzada no puede dar. Clic pone un ancla de esquina (segmento recto);
          clic y <b>arrastre</b> la convierte en una ancla curva con dos tiradores
          simétricos —<kbd>Alt</kbd> mientras se arrastra un tirador suelto rompe esa
          simetría, para una curva que cambia de dirección en ese punto—. Clic sobre la
          primera ancla del trazado en curso lo cierra; con «Cerrar trazado» (o
          <kbd>Intro</kbd>) se aparca abierto sin unir el final con el principio. Mientras
          se dibuja, cualquier ancla o tirador ya puesto se puede volver a arrastrar para
          corregirlo, y «Deshacer último punto» quita sólo el último clic sin tocar el
          historial de la app. Se pueden trazar varios subtrazados sueltos antes de
          convertir —para un donut o una selección con un agujero, por ejemplo—: «Trazado →
          Selección» y «Trazado → Máscara de capa» los combinan todos de una vez, con
          el mismo antialiasing suave del propio lienzo en las curvas.</li>
        <li><b>Difuminar…, Invertir, Deseleccionar.</b> Disponibles con cualquier
          herramienta de selección: difuminar suaviza el borde (útil antes de copiar o
          aplicar un ajuste sólo a esa zona), invertir cambia dentro por fuera.</li>
        <li><b>Rellenar según el contenido…</b> (menú Selección). Síntesis de verdad
          —PatchMatch—, no una única traslación: cada trozo del hueco busca su propio
          origen, así que una textura irregular (hierba, agua, una multitud) no sale
          «estampada» en bloque. El diálogo deja pintar el <b>área de muestreo</b> —en
          verde, de dónde se puede tomar la muestra; arrastra para quitar una zona (un
          objeto que no convenga ver clonado) y Alt+arrastre o clic derecho para
          devolverla—, y «Adaptar rotación»/«Adaptar escala» dejan que la búsqueda gire
          o achique el origen para encajar mejor en el hueco.</li>
        <li id="tool-camove"><b>Mover según el contenido</b> (menú Selección). Arrastra lo seleccionado a otro sitio
          del lienzo: el hueco que deja se rellena solo, con el mismo PatchMatch de
          arriba, en el mismo gesto —sin tener que cortar, pegar y rellenar el hueco a
          mano por separado—. La selección se mueve con el contenido, y todo es un
          único paso de historial.</li>
        <li><b>Máscaras de luminosidad y color…</b> El panel de cualquier plugin de
          retoque de paisaje serio: quince botones —Luces, Medios y Sombras, cinco
          niveles cada uno—, con miniatura propia para comparar de un vistazo antes de
          elegir. El nivel 1 es la zona tonal entera (toda luz, todo medio o toda
          sombra); cada nivel siguiente ESTRECHA el anterior multiplicándolo por sí
          mismo —la misma aritmética de cualquier tutorial de la técnica—, hasta el 5,
          que sólo deja lo más puro de esa zona. «Por color» hace lo mismo a partir de
          un matiz y una tolerancia, en vez de un tono. Elegir cualquiera de las
          dieciséis lo muestra al instante como selección sobre el lienzo; «Suavizar» e
          «Invertir» afinan esa selección antes de decidir nada. «Aplicar como
          selección» se queda ahí; «Aplicar como máscara de capa» la lleva directamente
          a la máscara de la capa activa —creándola si no tenía, sustituyendo su
          contenido si ya tenía una—, sin pasar por ningún archivo aparte.</li>
        <li><b>Seleccionar sujeto.</b> Segmentación real, por píxel, con un modelo de IA
          que se ejecuta en el propio equipo (BodyPix, con ONNX Runtime) —nada sale de la foto—: detecta a
          la persona sin depender de que el fondo sea de un color uniforme. Si no
          encuentra a nadie con confianza suficiente, cae automáticamente al mismo
          heurístico de color de «Eliminar fondo», así que sigue funcionando con objetos
          o productos sobre un fondo liso.</li>
        <li><b>Seleccionar cielo.</b> Igual de local, con otro modelo (DeepLab, entrenado
          sobre ADE20K): reconoce el cielo por lo que ES —no por ser azul o blanco—, así
          que no confunde una pared o una tela del mismo color. Sin cielo en la foto, avisa
          en vez de forzar una selección que no pega con nada.</li>
        <li><b>Refinar borde…</b> Lo que hace falta para que una selección de pelo o
          pelaje no quede con un halo del color del fondo pegado alrededor: un filtro
          guiado por el propio color de la foto que engancha el alfa a las transiciones
          reales en vez de difuminarlo a ciegas, así que puede recuperar un mechón suelto
          que el detector original ni siquiera había visto. «Radio de detección» decide
          hasta dónde buscar detalle fino alrededor del contorno actual; «Contraste»
          endurece esa transición ya recuperada; «Suavizar» lima el dentado que quede sin
          deshacer el detalle fino; «Desplazar borde» expande o contrae la selección de
          verdad (dilatación/erosión), no sólo sube o baja el alfa; «Descontaminar color»
          quita el cerco del color de fondo que queda mezclado en los píxeles a medio
          camino —cambia el color, así que el resultado va siempre a una capa nueva, con
          la de partida intacta debajo—. La vista previa se puede comprobar sobre
          transparencia, blanco o negro, para juzgar el borde sin que el color del fondo
          real distraiga. Disponible sobre la selección activa (menú Selección) y sobre
          la máscara de cualquier capa (panel de Propiedades o menú Capa › Máscara de
          capa).</li>
      </ul>` },

  { id:"mover", title:"Mover, recortar y transformar",
    desc:"Mover con guías inteligentes, recortar con guías de composición, perspectiva.",
    html:`
      <h3>Mover, recortar y transformar</h3>
      <ul>
        <li id="tool-handles"><b>Tiradores.</b> Los cuadraditos y puntos de Recortar,
          Transformación libre, Deformar, Perspectiva, las formas, el marco y la curva del
          texto, la pluma, las guías y los editores a pantalla completa (Recortar en forma,
          Cortar en partes, Galería de desenfoque) se adaptan a lo que usas: con el
          <b>dedo</b> la zona para agarrarlos es mucho más grande (un círculo del tamaño de la yema)
          y se dibujan mayores; con lápiz, algo más; con ratón, como siempre. Si dos
          tiradores quedan muy juntos (un marco pequeño en pantalla), se coge el
          <b>más cercano</b>. Un borde se agarra con margen por fuera pero sólo un poco
          por dentro, así que un recorte pequeño se sigue pudiendo mover arrastrando desde
          su interior. Y al coger un tirador un poco desviado <b>no salta</b> bajo el
          dedo: se mueve con esa misma distancia, sin tapar lo que estás ajustando.</li>
        <li id="tool-move"><b>Mover (V).</b> Arrastra el contenido de la capa activa (o el cuadro de un
          texto): sus dos bordes y su centro —no sólo el centro— se ajustan solos en
          cuanto caen cerca de los bordes o el centro del documento, de una guía puesta a
          mano, del borde o centro de cualquier otra capa, o de la cuadrícula (con
          «Ajustar a la cuadrícula» activo). Las flechas del teclado la desplazan 1
          píxel, y <kbd>Alt</kbd> + flecha, 10 píxeles, sin tocar el ratón.</li>
        <li id="tool-crop"><b>Recortar (C).</b> Arrastra el marco o elige una proporción fija (1:1,
          16:9…) en el panel de opciones. «Guía» superpone una ayuda de
          composición sobre el marco mientras se ajusta: «Tercios» (la retícula clásica)
          o «Áurea» (las mismas dos líneas por eje, pero a la proporción del rectángulo
          áureo en vez de a un tercio exacto). Con el marco ya movido, cambiar a
          cualquier otra herramienta <b>aplica el recorte</b> en vez de perderlo —el
          mismo criterio que «Aplicar»—; sólo <b>Cancelar</b> o <b>Esc</b> lo descartan
          de verdad. Sin tocar el marco no hay nada que aplicar, así que salir sin
          querer no deja rastro en el historial.</li>
        <li><b>Reglas, guías y cuadrícula (menú Ver).</b> Arrastra desde cualquier regla
          para soltar una guía; se puede volver a arrastrar. Para quitar una, arrástrala
          de vuelta a su regla o haz <b>doble clic o doble toque</b> sobre ella; <b>Ver › Borrar
          guías</b> (también en Herramientas del móvil) las quita todas. Todo se puede deshacer. Las herramientas de selección
          (rectangular, elíptica) también enganchan sus esquinas a guías, bordes, centros
          de otras capas y a la cuadrícula, igual que Mover. «Mostrar cuadrícula» pinta
          una retícula configurable —«Configurar cuadrícula…» fija el espaciado entre
          líneas mayores y cuántas líneas menores caben en cada celda—, y «Ajustar a la
          cuadrícula» es el interruptor aparte que decide si esa cuadrícula, aparte de
          verse, también atrae al arrastrar.</li>
        <li id="tool-transform"><b>Transformación libre (F).</b> Arrastra directamente sobre el lienzo
          para escalar (esquinas o bordes), rotar (el anillo justo fuera de cada
          esquina), inclinar y mover, con vista previa en vivo; <kbd>Mayús</kbd>
          mantiene la proporción o engancha la rotación a múltiplos de 15°,
          <kbd>Alt</kbd> escala desde el centro en vez de desde la esquina opuesta.
          El botón <b>Deformar</b> cambia a una malla de puntos de control para
          curvar libremente en vez de sólo escalar/rotar/inclinar. <b>Intro</b>
          o el botón «Aplicar» confirma, <b>Esc</b> (o «Cancelar») descarta la
          transformación sin tocar la capa. Cambiar a cualquier OTRA herramienta con
          algo ya arrastrado, en cambio, la <b>aplica</b> en vez de perderla —Esc
          sigue siendo la única vía para tirarla de verdad—; sin tocar nada no hay
          ninguna transformación que aplicar, así que salir de la herramienta sin
          querer no deja rastro. «Restablecer» vuelve al cuadro inicial sin salir
          de la herramienta.
          Distinta de «Transformar capa…» (menú Capa), que hace lo mismo con
          deslizadores y valores exactos en vez de arrastrando a mano.
          «Convertir en objeto inteligente» (menú Capa), antes de transformar,
          guarda el original íntegro aparte: cada ajuste posterior —encoger al
          30 % y volver al 100 % después, las veces que haga falta— remuestrea
          siempre desde ESE original, así que no se va perdiendo nitidez por el
          camino como en una capa normal. Pintar directamente sobre una capa
          así la vuelve a convertir en normal sin avisar más que con un aviso
          en pantalla; «Rasterizar objeto inteligente» hace lo mismo a
          propósito.</li>
        <li id="tool-perspective"><b>Perspectiva (P).</b> Corrige el trapecio de una foto en cuatro modos:
          Guías (traza sobre lo que debería estar recto y lo endereza), Esquinas
          (arrastra cada vértice), Bordes (estira un lado entero) o Ajustes
          (deslizadores de trapecio, giro y escala). «Rellenar» amplía la imagen lo justo
          para tapar las cuñas transparentes que deja corregir la perspectiva. Mismo
          criterio que Transformación libre: cambiar de herramienta con una corrección
          ya trazada la aplica; <b>Esc</b> o «Cancelar» la descartan de verdad.</li>
      </ul>` },

  { id:"imagen", title:"Imagen (menú Imagen)",
    desc:"Tamaño, lienzo, HDR, unir, cortar en partes, recortar en forma, antes y después, IA, fondo, cielo.",
    html:`
      <h3>Imagen (menú Imagen)</h3>
      <ul>
        <li><b>Tamaño de imagen…</b> (<kbd>Ctrl</kbd>+<kbd>R</kbd>). Cambia las
          dimensiones en píxeles o en porcentaje. Elige el <b>remuestreo</b>: Lanczos 3
          (máxima nitidez, el recomendado para reducir), Mitchell (equilibrado),
          Catmull-Rom (nítido), bilineal (suave) o el del navegador (rápido). Los de calidad
          se calculan en segundo plano, sin bloquear la página. Las máscaras de capa se
          reescalan con la imagen.</li>
        <li><b>Tamaño de lienzo…</b> Amplía o recorta el lienzo sin reescalar el contenido,
          eligiendo hacia dónde crece.</li>
        <li><b>Escala según contenido…</b> Cambia la proporción de la foto quitando o
          añadiendo píxeles de las zonas con menos detalle, para que el sujeto no se
          deforme.</li>
        <li><b>Recortar y Corregir perspectiva.</b> Ver «Mover, recortar y
          transformar».</li>
        <li><b>Girar 90° / 180° y Voltear.</b> Afectan a todo el documento, máscaras
          incluidas.</li>
        <li id="img-straighten"><b>Enderezar automáticamente…</b> Busca TODAS las líneas rectas de la
          foto —horizonte, cornisas, ventanas, marcos, el borde de una mesa— y propone el ángulo
          que las pone a nivel (hasta ±10°, con precisión de décimas). Se abre una vista previa con
          cuadrícula y un deslizador para afinarlo antes de aplicar; si no hay líneas claras (o la
          perspectiva confunde), no se inventa nada y lo ajustas a mano. Gira todas las capas sin
          dejar esquinas vacías, en un solo paso de deshacer.</li>
        <li id="img-hdr"><b>Fusión HDR…</b> Pantalla completa. Añade de 2 a 11 fotos de la misma
          escena con distinta exposición (o una sola, para un HDR simulado): del dispositivo
          —JPEG, HEIC, <b>RAW</b>…— o <b>las fotos que ya tienes abiertas</b>, tal como las estás
          editando. Con RAW eliges <b>revelar la primera y aplicar lo mismo a todas</b> (mismo
          balance de blancos, lo recomendado), <b>revelar una a una</b> en el revelador RAW o
          <b>usar el JPEG</b> que llevan dentro. La app detecta el
          horquillado (por EXIF —también de HEIC, PNG y WebP— o por el brillo) y las alinea. Si
          alguna exposición no es la correcta, el primer grupo, <b>Foto elegida</b>, sirve para
          corregirla: toca la foto y mueve su exposición (en tercios de paso, con − / + para
          afinar; la vista cambia mientras arrastras), o elige los <b>Pasos entre fotos</b> de tu
          horquillado (por ejemplo, 2 EV) y se ponen todas a la vez. Los EV se cuentan desde la
          foto normal (−2 / 0 / +2). Si el orden de las fotos no es el bueno, <b>arrástralas</b>
          (con el ratón, o mantén pulsada una con el dedo) de la más oscura a la más clara: la
          exposición sigue al orden. Los grupos siguen el orden
          del trabajo: Foto elegida, Fusión de las fotos (alinear, recortar bordes y
          <b>antifantasmas</b> si algo se mueve entre tomas), Estilo (17, en miniatura), Método
          (detalles realzados, fusión de exposición, compresor de tonos o fotográfico) con sus
          mandos, y al final Tono, Color y Detalle. El resultado se abre como una <b>foto nueva</b>, en su
          propia pestaña y con el historial vacío: Comparar muestra el HDR recién creado como
          «antes».
          <br><b>HDR Premium (👑)</b>: el interruptor con la corona de la barra superior cambia al
          motor de alta calidad con los mismos mandos y estilos. Estima la <b>curva de respuesta de
          tu cámara</b> con el propio horquillado (o, con RAW y Premium activado <i>antes</i> de
          añadirlos, fusiona los <b>datos lineales del sensor</b>), pesa cada foto por su ruido
          (menos ruido en las sombras), alinea con fracción de píxel, detecta el movimiento por zonas
          y también por el color, y trabaja el tono y el color en OKLab sin cambiar el tono de los
          colores. Añade <b>TIFF 16 bits</b> y la <b>radiancia .hdr</b> (32 bits) para seguir en otro
          programa. Apagado, el HDR es exactamente el de siempre.</li>
        <li id="img-merge"><b>Unir imágenes…</b> Pantalla completa. <b>Panorámica</b>: fotos
          solapadas (un tercio, más o menos) en el orden en que se hicieron; se alinean, se
          iguala la exposición, se funden las uniones y se recortan los bordes. <b>Unión</b>:
          en fila, columna o cuadrícula, con separación, margen, esquinas y fondo.</li>
        <li id="img-slice"><b>Cortar en partes…</b> Pantalla completa. Cuadrícula, tamaño fijo,
          <b>carrusel</b> (2 a 10 publicaciones seguidas), <b>perfil de Instagram</b> (numerado en
          el orden de subida) o <b>cortes a mano</b> (toca para añadir, arrastra para mover).
          En carrusel e Instagram, arrastra para mover el encuadre. Cada trozo va a una capa
          nueva, a su propia pestaña, a un ZIP o suelto.</li>
        <li id="img-shapecrop"><b>Recortar en forma…</b> Pantalla completa, con unas 60 formas
          (polígonos y estrellas configurables, corazón, flores, nube, bocadillos, engranaje,
          anillo, marco, flechas, puzle…). Arrastra la forma para moverla, una esquina para
          escalarla y el asa de arriba para girarla; borde suave, contorno e inversión. Recorta
          <b>sólo la capa activa</b>: crea encima una capa con la forma y transparencia alrededor y
          <b>oculta todas las demás capas</b> (no las borra), para que lo que se guarde sea la forma
          sobre transparente. Un aviso lo explica al aplicar y ofrece exportar directamente; para
          conservar la transparencia, guarda en PNG, WebP o AVIF. Deshacer lo devuelve todo como
          estaba.</li>
        <li id="img-beforeafter"><b>Antes y después…</b> Pantalla completa. Una imagen para compartir
          con el original y tu edición: <b>dividida</b> (arrastra o toca para mover la línea, con
          tirador opcional en el centro), <b>diagonal</b>, lado a lado o arriba y abajo, con
          etiquetas, grosor y color de la línea, separación y formatos de redes. Se puede
          elegir otra foto como «antes». El resultado va a una capa nueva en otra pestaña.</li>
        <li id="img-ai"><b>Ampliar con IA…</b> ×2 o ×4 recuperando detalle (el resultado se abre en
          otra pestaña). <b>Colorear con IA…</b> da color a fotos en blanco y negro en una capa
          nueva. <b>Expandir con IA…</b> agranda el lienzo a un formato o con márgenes y rellena
          lo nuevo. Los modelos se descargan una vez y trabajan en tu equipo.</li>
        <li><b>Eliminar fondo…</b> Cuatro métodos: tres modelos de IA que funcionan en tu
          propio equipo —rápido (U²-Net), retratos (MODNet) y máxima calidad (ISNet)— y
          «Color de los bordes», el de siempre para fondos lisos. El recorte va a una
          <b>capa nueva</b> con el fondo transparente y la original se oculta, sin borrarla.
          Los modelos se descargan una vez y quedan guardados en el navegador.</li>
        <li id="sky-replace"><b>Reemplazar cielo…</b> Detecta el cielo con IA (el mismo modelo que
          «Seleccionar cielo»), ajusta el borde a los contornos reales de la foto (sin halo
          del cielo antiguo) y deja el reemplazo en una capa nueva con su propia máscara,
          encima de la original intacta. Eliges: <b>Biblioteca</b> (16 cielos listos:
          despejados, con nubes, cirros, nublado, tormenta, atardeceres, amanecer, hora
          azul, crepúsculo y noche; en el móvil, en una fila que se desliza), una foto
          <b>Propia</b>, un <b>Degradado</b> o un <b>Color</b>. Los cielos de foto se colocan con
          su horizonte sobre el horizonte detectado; <b>Posición</b> los sube o los baja y
          «Desvanecer borde» suaviza el corte.</li>
      </ul>` },

  { id:"otras", title:"Otras herramientas",
    desc:"Bote de pintura, degradado, formas, texto, cuentagotas, mano, zoom, comparar.",
    html:`
      <h3>Otras herramientas</h3>
      <ul>
        <li id="tool-fill"><b>Bote de pintura (G).</b> Rellena la zona de color parecido bajo el
          cursor, con la misma tolerancia y el mismo «Contiguo» que la Varita mágica.</li>
        <li id="tool-gradient"><b>Degradado (N).</b> Lineal, radial o a transparente, arrastrando de un
          punto a otro con los dos colores del panel.</li>
        <li id="tool-shape"><b>Formas (U).</b> Rectángulo y elipse crean una <b>capa de
          forma</b> —vectorial, editable después, con relleno y borde independientes—;
          mantén <kbd>Mayús</kbd> mientras arrastras para una forma regular (cuadrado,
          círculo). Con esa capa activa y la herramienta todavía en Formas, arrastrar
          dentro de ella la mueve, una de sus ocho asas la redimensiona, y un noveno
          tirador azul en el borde superior ajusta el <b>radio de esquina</b> —también
          disponible, con relleno, borde y grosor, en el panel de Propiedades—. Línea es
          la excepción: sigue pintando píxeles fijos en la capa activa, como el resto de
          la barra, porque una línea no encaja en «relleno + borde de un contorno
          cerrado». «Rasterizar capa» (menú Capa) convierte cualquier forma en píxeles
          normales cuando ya no haga falta seguir editándola —o cuando de verdad haga
          falta pintar encima a mano—.</li>
        <li id="tool-text"><b>Texto (T).</b> Coloca una capa de texto editable; «Rasterizar texto»
          (menú Capa) la convierte en píxeles normales cuando ya no hace falta
          seguir editándola. Al cambiar la alineación, el bloque se queda en su sitio y
          sólo se realinean las líneas entre sí. Además de las fuentes del sistema, la
          lista trae más de setenta <b>tipografías libres</b> y, en «Más fuentes (buscar
          entre 1900)…», todo el catálogo de Google Fonts, con vista previa de cada una.
          Se sirven desde el propio Realify, sin conectarse con Google, y cada fuente se
          descarga sólo cuando se usa. Además del cuerpo, la fuente, el color, la sombra, el
          contorno, el círculo y el fondo de siempre, la barra de opciones trae:
          <ul>
            <li><b>Justificado</b>, cuarta opción junto a Izquierda/Centrado/Derecha
              —sólo con «Marco» puesto—: todas las líneas menos la última se
              estiran hasta llenar el ancho del marco repartiendo el espacio extra
              entre las palabras, como en cualquier maquetador.</li>
            <li><b>Sangrías</b> de primera línea, izquierda y derecha, también sólo
              con marco: la de primera línea puede ser negativa (sangría francesa).</li>
            <li><b>Kerning manual.</b> Con el cursor de edición puesto entre dos
              letras concretas (sin nada seleccionado) aparece un campo «Kerning»
              que añade o quita espacio justo en ese hueco; se guarda por posición,
              así que sobrevive a que el párrafo se reajuste de línea.</li>
            <li><b>Lig / Vers.</b> Ligaduras OpenType (fi, fl…) encendidas por
              defecto —apagarlas fuerza el dibujo letra a letra, sin combinar
              nada—, y versalitas reales del navegador, no mayúsculas encogidas
              a mano.</li>
            <li><b>Deformar: Arco, Bandera, Pez.</b> Dobla el bloque de texto entero
              —todas sus líneas a la vez, como una sola curva continua— según la
              fuerza elegida, positiva o negativa. Es una aproximación honesta al
              «Deformar texto» de los editores de referencia, no un calco
              pixel a pixel de su malla.</li>
            <li><b>Trazado.</b> Con este interruptor encendido, arrastrar sobre un
              hueco del lienzo traza una curva (una Bézier cuadrática: inicio,
              control, fin) y crea un texto que corre sobre ella, centrado si es
              corto o desbordando el final si es largo. Con esa capa activa y la
              herramienta Texto puesta, sus tres asas —naranjas los extremos, azul
              el punto de control— se pueden volver a arrastrar en cualquier
              momento para redibujar la curva; «Quitar trazado» la suelta y
              vuelve a dejar el texto en su ancla normal. Un texto en trazado se
              mueve arrastrando sus propias asas, no con la herramienta Mover.</li>
            <li><b>Estilos de carácter y de párrafo.</b> Un «sello» con nombre que
              guarda de un lado fuente/cuerpo/color/trazado/ligaduras/versalitas y
              del otro alineación/interlineado/sangrías (guardados aparte a
              propósito, para poder mezclar un estilo de carácter con cualquier
              estilo de párrafo); el botón «Guardar» junto a cada desplegable
              guarda los valores de la capa activa con el nombre que se pida, y
              elegir un estilo ya guardado en el desplegable lo aplica al momento
              sobre la capa activa. No son un enlace en vivo: aplicar uno copia sus
              valores una vez, editables después sin desligar nada.</li>
          </ul></li>
        <li id="tool-picker"><b>Cuentagotas (I).</b> Toma el color exacto de cualquier píxel visible y lo
          deja listo como color activo.</li>
        <li id="tool-pan"><b>Mano (H) / Zoom (Z).</b> Paneo y acercamiento; doble clic en Mano ajusta
          a la ventana, doble clic en Zoom vuelve al 100 %.</li>
        <li id="tool-compare"><b>Comparar (Y).</b> Arrastra la línea para ver el original a la izquierda y
          tu edición a la derecha, en el mismo lienzo.</li>
      </ul>` },

  { id:"ajustes", title:"Ajustes (menú Ajustes)",
    desc:"Niveles, curvas (con estilos y luminosidad), tonos del histograma, color por rangos, Lab, HDR, B/N…",
    html:`
      <h3>Ajustes (menú Ajustes)</h3>
      <ul>
        <li><b>Brillo y contraste.</b> El control más directo: sube o baja la luz
          general y separa claros de oscuros. Trabaja en coma flotante sobre la
          luminosidad percibida: el brillo mueve los medios tonos sin tocar el negro ni
          el blanco, el contraste es una curva en S suave alrededor del gris medio, nada
          se quema ni se empasta y los colores conservan su tono. <i>Protección</i> decide
          cuánto se suavizan los extremos (al bajarla, el contraste aprieta más);
          <i>Pivote</i> en automático gira sobre la luminosidad media de la foto, así
          que el contraste no la oscurece ni la aclara; «Usar heredado» recupera el
          cálculo antiguo. Con <b>Premium 👑</b> los colores conservan su saturación al
          aclararse (el cielo sigue azul en vez de palidecer hacia el blanco) y, donde la curva
          aplana las luces y las sombras, se recupera parte de la textura (nubes, piel, hierba)
          sin aspecto «HDR».</li>
        <li><b>Exposición.</b> Simula lo que hace una cámara: multiplica la luz en
          espacio lineal (un paso completo dobla o parte por dos la luz de toda la
          foto por igual), con Desplazamiento para un empujón fijo —más visible en
          sombras— y Gamma para curvar el resultado.</li>
        <li><b>Niveles.</b> Fija el punto negro, el blanco y el gris medio a partir del
          histograma; es lo primero que conviene tocar en una foto plana. Cada canal
          (RGB, Rojo, Verde, Azul) guarda sus propios valores por separado —cambiar de
          canal en el desplegable no pierde lo ya ajustado en el anterior—, y el
          maestro RGB se aplica encima de los tres, igual que en Curvas. Con <b>Premium 👑</b>
          todo se calcula en coma flotante, el maestro RGB ya no cambia el tono ni sobresatura
          (se aplica a la intensidad de cada color, no canal a canal) y <b>Automático</b> busca
          los colores más oscuros y más claros de la foto para neutralizar las dominantes y
          ajusta los medios. «Niveles automáticos Premium 👑» (Ajustes › Automáticos y cajón) hace lo mismo de
          un toque y deja una capa de Niveles que puedes afinar.</li>
        <li id="adj-curves"><b>Curvas</b> (<kbd>Ctrl</kbd>+<kbd>M</kbd>). Control punto a punto de toda
          la gama tonal. Clic añade un punto, arrastrar lo mueve, clic derecho o doble clic
          lo quita. <b>Automático</b> (o «Auto» en el móvil) calcula una curva para la foto:
          negro, blanco y medios; con <b>Premium 👑</b> también neutraliza las dominantes. En
          Premium la curva RGB no cambia el tono ni sobresatura y todo va en coma flotante.
          <ul>
            <li><b>Cinco curvas:</b> RGB (color), Rojo, Verde, Azul y <b>Luminosidad</b>. La
              de luminosidad cambia sólo el brillo, sin tocar tono ni saturación: una curva
              en S en RGB satura; en Luminosidad, no.</li>
            <li><b>Todas a la vez.</b> Mientras editas una, las demás se ven en tenue en su
              color, y con RGB los tres histogramas se superponen. «R · G · B a la vez»
              muestra los tres canales en tres paneles simultáneos.</li>
            <li><b>Vincular luminosidad y color.</b> Las dos curvas pasan a ser una sola
              —edites la que edites, la otra la sigue— y «Reparto color ↔ luminosidad»
              decide cuánto se aplica como color y cuánto como luminosidad.</li>
            <li><b>Estilos.</b> 25 curvas listas con miniatura: S suave, clásica y fuerte,
              desvanecido, mate de película, cine turquesa y naranja, proceso cruzado,
              vintage, clave alta y baja, solarizar, negativo… «Guardar estilo…» guarda la
              tuya en el navegador (clic derecho sobre uno propio para borrarlo).</li>
          </ul></li>
        <li id="adj-toneband"><b>Tonos del histograma…</b> Ajusta SÓLO una franja de tonos: toca
          el histograma del diálogo (o una de las zonas Negros, Sombras, Medios, Luces,
          Blancos) para elegirla, arrastra para moverla y usa la rueda para ensancharla.
          Brillo, contraste, saturación y calidez afectan sólo a esa franja, con bordes
          suaves. «Ver zona afectada» enseña en gris qué píxeles entran (desmárcalo antes
          de aplicar). Se abre también tocando una zona del panel Histograma.</li>
        <li><b>Sombras / Iluminaciones.</b> Distinto de Tonos: aquí cada píxel se
          corrige según el brillo MEDIO de su alrededor, no el suyo propio, así que un
          contraluz se abre sin aplanar el resto de la foto y un ojo oscuro en una cara
          iluminada no se trata como sombra. Radio decide el tamaño de ese entorno;
          Tono, lo ancha que es la transición. Con <b>Premium 👑</b> el entorno se mide sin
          cruzar los bordes (no aparece un halo alrededor de una silueta contra el cielo), el
          radio es relativo a la foto (la vista previa y el resultado coinciden), la textura de
          lo que se recupera no queda plana y los colores no se recortan.</li>
        <li><b>Balance de blancos.</b> Corrige un dominante de color (una foto
          demasiado azul o demasiado naranja) para que el blanco se vea blanco. Actúa sobre la
          imagen abierta en tiempo real. Con el <b>Cuentagotas</b> tocas en la propia imagen
          algo que deba ser blanco o gris (una pared, una camisa, una nube) y calcula la
          temperatura y el tinte que lo dejan neutro. La capa de ajuste «Balance de blancos»
          tiene el mismo cuentagotas, que lee lo que hay debajo de ella.</li>
        <li><b>Tonos (blancos/luces/sombras/negros).</b> Cuatro mandos por zona
          tonal, más simple que Curvas cuando sólo hace falta aclarar sombras o
          recuperar luces.</li>
        <li><b>Tono y saturación.</b> Matiz, saturación y luminosidad de toda la
          imagen; «Colorear» la tiñe entera de un solo tono. Con el interruptor
          <b>Premium 👑</b> trabaja en OKLCh (espacio perceptual) en luz lineal y coma flotante:
          girar el tono conserva la luminosidad de cada color, la saturación 0 da un gris de
          la misma luminosidad, los colores que se salen de la gama pierden croma en vez de
          torcerse y el resultado lleva tramado para que no aparezcan bandas.</li>
        <li><b>Vibrance.</b> Sube la saturación de los colores apagados más que la de
          los que ya son vivos —y protege un poco los tonos de piel—, distinto de la
          saturación llana de Tono y saturación.</li>
        <li><b>Color avanzado (submenú).</b>
          <ul>
            <li><b>Gradación de color.</b> Tres ruedas —sombras, medios y luces— con mezcla
              y equilibrio, como en un revelador de cine.</li>
            <li><b>Virado dividido.</b> Un tono para las sombras y otro para las luces, con
              su saturación y el equilibrio entre ambos.</li>
            <li><b>Filtro fotográfico.</b> Cálido, frío, sepia, verde o un color libre, con
              densidad y «Conservar luminosidad».</li>
            <li id="adj-rangehsl"><b>Tono y saturación por rangos</b> («Color por rangos» en el
              móvil). Un mezclador HSL de ocho rangos —rojos, naranjas, amarillos, verdes,
              aguamarinas, azules, púrpuras y magentas— con tono, saturación y luminancia
              propios. Los grises, blancos y negros no pertenecen a ningún rango, así que
              no cambian. Con el <b>cuentagotas</b>, toca un color de la miniatura y se elige
              su rango; «Ampliar» y «Estrechar» ajustan su anchura desde la foto.</li>
            <li><b>Reemplazar color.</b> Elige un tono en la miniatura y cámbialo por otro,
              con tolerancia, saturación y luminosidad.</li>
            <li><b>Igualar color.</b> Copia el color y la luz de otra capa o de otra imagen
              (estadística en Lab), con intensidad regulable.</li>
            <li><b>Curvas Lab / luminosidad.</b> Curvas sobre L (luminosidad), a
              (verde/magenta) y b (azul/amarillo), independientes del color RGB.</li>
            <li><b>Color por canales.</b> El HSL de un revelador serio: rojos,
              amarillos, verdes, cianes, azules y magentas, cada uno con su propio
              matiz, saturación y luminosidad, más un maestro para toda la foto.</li>
            <li><b>Equilibrio de color.</b> Cian-Rojo, Magenta-Verde y Amarillo-Azul
              por separado en Sombras, Medios e Iluminaciones, con «Conservar la
              luminosidad» para que el tinte no aclare ni oscurezca la foto de paso. Con
              <b>Premium 👑</b> las zonas siguen la luminosidad percibida, cada mando empuja el
              color hacia su primario en OKLab (sin torcer el tono), la luminosidad se
              conserva exactamente y hay mapeo de gama y tramado.</li>
            <li><b>Corrección selectiva.</b> Cian/Magenta/Amarillo/Negro por rango de
              color —seis de matiz más Blancos/Neutros/Negros por brillo—, en método
              relativo: subir una tinta nunca «quema» de golpe un color ya muy puro.</li>
            <li><b>Mezclador de canales.</b> Cada canal de salida se compone con el
              tanto por ciento que se quiera de los tres de entrada; con Monocromo,
              una sola mezcla se reparte a los tres, como un filtro de cámara real.</li>
            <li><b>Mapa de degradado.</b> Sustituye cada píxel por un punto de un
              degradado de dos colores según su propia luminosidad; la base de
              cualquier viraje de color.</li>
          </ul>
        </li>
        <li><b>Tono y luz avanzados (submenú).</b> <i>Quitar neblina</i> (recupera contraste y
          color en fotos veladas, o añade niebla en negativo), <i>Tono HDR</i> (comprime el
          rango y realza el detalle local), <i>Contraste tonal</i> (micro, medio y
          macrocontraste por separado), <i>Densidad neutra graduada / radial</i> (exposición,
          contraste y temperatura sólo en una parte de la foto). <i>Tono / Color
          automático</i> está, con los demás automáticos, en <b>Ajustes › Automáticos</b> (también como «Tono / Color automático Premium 👑», que lo abre con el interruptor ya encendido); tiene interruptor <b>Premium 👑</b>: con los mismos mandos, el
          estiramiento y los medios se aplican a la intensidad de cada color (el tono y la
          saturación no cambian) y «Ajustar colores neutros» corrige la dominante como un
          balance de blancos en luz lineal, sin teñir los negros; con mapeo de gama y tramado.</li>
        <li><b>Umbral, Posterizar, Ecualizar, Desaturar.</b> Blanco y negro puro por un
          corte, reducir a pocos niveles, repartir el histograma y quitar color en
          parte o del todo.</li>
        <li><b>Blanco y negro.</b> Modo manual (mezcla de canales a mano) o
          automático, con dieciocho estilos con nombre propio y miniatura, cada uno
          inspirado en una manera distinta de revelar en blanco y negro —de un
          filtro rojo clásico a una simulación de infrarrojo o un cartel de alto
          contraste sin grano—.</li>
        <li><b>Invertir.</b> Un solo clic, sin panel.</li>
        <li id="adj-auto"><b>Ajustes automáticos</b> (Ajustes › Automáticos). Antes de corregir,
          <b>diagnostican</b> la foto como lo haría un retocador:
          <ul>
            <li><b>Dominante de color</b>: se estima el color de la luz con los bordes (casi
              siempre neutros, y no se dejan engañar por una pared naranja enorme) y con los
              píxeles grises que aparecen al ir corrigiendo, y se mezclan según la confianza.
              Verde/magenta y azul frío se corrigen casi del todo; un tono cálido, sólo en parte
              (la luz del atardecer o de interior es parte de la foto); si la escena está
              dominada por un color intenso (atardecer, bosque), mucho menos.</li>
            <li><b>Luces y sombras</b>: punto negro y blanco sin estirar lo que ya está quemado,
              sin tomar un brillo aislado (sol, reflejo) como «blanco» y con la ganancia limitada
              para no subir el ruido.</li>
            <li><b>Exposición</b>: sólo se corrige si está claramente mal; una escena clara u
              oscura a propósito (nieve, fondo blanco, noche) se respeta.</li>
            <li><b>Colores extremos</b>: el color más oscuro y el más claro neutralizan sombras y
              luces sólo si son casi grises; una lámpara amarilla o un mar azul no se «corrigen».</li>
          </ul>
          <b>Contraste automático</b> corrige sólo la luz (negro, blanco y medios), sin tocar el
          color. <b>Niveles automáticos</b> corrige además el color: negro y blanco de cada canal
          y medios neutros. <b>Tono / Color automático</b> hace lo mismo con mandos (modo, recorte,
          medios, neutros) y equilibra los neutros como un balance de blancos en luz lineal. Las
          versiones <b>Premium 👑</b> usan el mismo diagnóstico con el motor Premium: coma flotante,
          la luz aplicada a la intensidad de cada color (sin sobresaturar ni cambiar el tono),
          mapeo de gama y tramado. Contraste y Niveles Premium quedan como capa de Niveles que
          puedes reabrir para afinarla.</li>
        <li id="adj-lowlight"><b>Iluminar foto oscura</b> (Ajustes › Automáticos y cajón). Para fotos
          subexpuestas o de interior: calcula cuánta luz llega a cada zona y levanta cada una según
          la suya, así las sombras se abren y lo que ya estaba bien iluminado apenas cambia (en una
          foto bien expuesta no hace nada). La cantidad es automática; <b>Intensidad</b> la gradúa
          (60 % = automático). Con <b>Premium 👑</b> se hace en luz lineal sin virar los colores, con
          el mapa de luz ajustado a los bordes (sin halos), el negro devuelto a su sitio para que
          no quede lavado, el ruido de color de las sombras limpiado y tramado. Queda como capa
          que puedes reabrir.</li>
      </ul>` },

  { id:"ia", title:"Inteligencia Artificial (menú)",
    desc:"Selección con un toque, Borrador mágico, caras y profundidad 👑, fondo, ampliar, colorear, expandir, cielo, ruido, Realify, Unmark…",
    html:`
      <h3>Inteligencia Artificial (menú Inteligencia Artificial)</h3>
      <p>Todas las herramientas de IA están juntas en este menú (tras Filtro) y, en el móvil,
        en la pestaña <b>Inteligencia Artificial</b> del cajón (la tercera, tras Básicos y
        Automáticos), con las mismas secciones y en el mismo orden:</p>
      <ul>
        <li><b>Seleccionar:</b> Selección con un toque 👑, Seleccionar sujeto y Seleccionar cielo.</li>
        <li><b>Borrar y rellenar:</b> Borrador mágico 👑, Eliminar fondo, Expandir con IA y
          Reemplazar cielo.</li>
        <li><b>Caras:</b> Difuminar caras 👑, Retoque de cara 👑, Restaurar caras 👑 y Ojos rojos 👑.</li>
        <li><b>Encuadre:</b> Recorte inteligente para redes 👑 y Recorte de retrato 👑.</li>
        <li><b>Profundidad:</b> Desenfoque por profundidad 👑, Niebla por distancia 👑 y Foto 3D 👑.</li>
        <li><b>Mejorar y restaurar:</b> Ampliar con IA, Reducción de ruido con IA, Quitar
          artefactos JPEG con IA, Iluminar con IA 👑, Colorear con IA y Adaptive Photo Lens.</li>
        <li><b>Para imágenes de IA</b> (trabajan con imágenes generadas por IA): Realify,
          PurePixel, Unmark, Plausibilidad, Segunda opinión y Limpiar metadatos.</li>
      </ul>
      <p>Los modelos funcionan en tu equipo (WebGPU si el navegador la tiene; si no, en la CPU)
        y los grandes se descargan la primera vez, avisando antes del tamaño; en
        <b>Ayuda › Diagnóstico</b> ves los que tienes guardados y puedes borrarlos.</p>
      <p id="ia-premium"><b>Funciones de IA Premium 👑.</b> Las nuevas funciones de IA son Premium:
        siempre usan el procesado de más calidad, sin versión básica.</p>
      <ul>
        <li id="ia-tapselect"><b>Selección con un toque 👑.</b> Toca un objeto y la IA (Segment Anything:
          MobileSAM + el decodificador de SAM) lo selecciona entero; cada toque más añade partes y
          con <b>Quitar</b> (o Alt / Mayús + clic) excluyes lo que no quieras. Deshacer y rehacer van
          por puntos. La primera vez analiza la foto unos segundos; después cada toque es casi
          inmediato. Al aplicar, el borde se afina a la resolución completa de la foto: la
          máscara de la IA se amplía con suavidad, se quitan manchas sueltas y agujeros pequeños y
          el borde se ajusta a los contornos reales con un filtro guiado. Queda como selección
          activa.</li>
        <li id="ia-magicerase"><b>Borrador mágico 👑.</b> Igual, pero para quitar: toca a la persona, el
          cable o el objeto y la IA LaMa rellena el hueco con lo que habría detrás. La zona se
          agranda un poco para llevarse el halo del objeto, la costura se funde en luz lineal y
          se devuelve al relleno el grano de la foto. El resultado va a una <b>capa nueva</b>; la
          foto original queda intacta.</li>
        <li id="ia-smartcrop"><b>Recorte inteligente para redes 👑.</b> Eliges el formato (Instagram cuadrado o
          vertical, historias/Reels/TikTok, YouTube/X, Facebook/LinkedIn, Pinterest, retrato) y la
          IA propone el mejor encuadre: un mapa de lo importante con el sujeto (U²-Net) y las caras
          (YuNet, que pesan más), y entre todos los recortes posibles el que conserva más, no corta
          caras ni el sujeto por el borde, deja el sujeto en los tercios y es lo más grande posible.
          Arrastra el marco para afinarlo y pulsa Recortar.</li>
        <li id="ia-faces"><b>Caras 👑.</b> Las tres herramientas encuentran las caras con YuNet (incluido en la
          web, funciona sin conexión) en lo que se ve de la imagen; en Premium la foto se analiza
          a dos escalas para encontrar también las caras pequeñas de un grupo.
          <b>Difuminar caras</b> las marca con un óvalo (toca una para excluirla o volver a
          incluirla) y las difumina, pixela o tapa con la intensidad que elijas, en una capa nueva;
          el desenfoque se hace en luz lineal sobre un pixelado previo y con algo de ruido, así no
          se puede «desenfocar al revés». <b>Retoque de cara</b>: la IA (BiSeNet) separa en cada
          cara la piel, los ojos, los dientes y los labios con bordes suaves; eliges la zona y su
          intensidad: la piel se suaviza respetando los bordes y conservando textura (en luz
          lineal), los ojos ganan luz y detalle, los dientes pierden el amarillo (sólo lo claro
          de la boca) y los labios ganan o pierden color sin cambiar de tono; capa nueva (la
          primera vez descarga el modelo, 53 MB). <b>Restaurar caras</b>: para caras borrosas,
          pequeñas, de fotos antiguas o muy comprimidas; la IA (GFPGAN) reconstruye cada cara
          —alineada por sus ojos, nariz y boca— y se devuelve a la foto con un borde suave, con el
          color de piel y el grano originales para que no parezca pegada; toca una cara para
          excluirla y gradúa la <b>Intensidad</b>; capa nueva (la primera vez descarga el modelo,
          170 MB). <b>Ojos rojos</b> busca en cada ojo sólo el rojo
          conectado con la pupila y se lo quita en luz lineal, sin tocar el reflejo, en una capa
          nueva. <b>Recorte de retrato</b> abre Recortar con el marco ya encuadrado (ojos en el
          tercio superior, cabeza y hombros; 4:5 si el formato era libre): ajústalo y pulsa
          Aplicar.</li>
        <li id="ia-lowlight"><b>Iluminar con IA 👑.</b> Para fotos oscuras o a contraluz: la IA
          (Zero-DCE++, diminuta, funciona sin descargas) decide cuánto levantar cada zona y cada color
          con una curva de luz propia, sin inventar nada. Las curvas se ajustan a los bordes de la
          foto (sin halos), el negro vuelve a su sitio y se limpia el ruido de luz y de color que
          aparece en las sombras. <b>Intensidad</b> de 0 a 150 %. Queda como capa que puedes
          reabrir. (Sin IA, «Iluminar foto oscura» en Ajustes › Automáticos hace algo parecido con
          un método clásico.)</li>
        <li id="ia-depth"><b>Profundidad 👑.</b> La IA (Depth Anything V2) calcula lo cerca o lejos que
          está cada punto de la foto y ajusta ese mapa a los bordes reales de la imagen (la
          primera vez descarga el modelo, 50 MB). <b>Desenfoque por profundidad</b>: toca donde
          quieres enfocar (de entrada, el sujeto que sobresale del fondo); lo que está más cerca o
          más lejos se desenfoca según su distancia, como con un objetivo luminoso. Mandos:
          Desenfoque y Zona nítida. Se hace por capas de distancia en luz lineal sin que lo
          nítido se derrame sobre el fondo (sin halos alrededor de las personas), las luces
          intensas se abren en «bokeh» y se devuelve el grano de la foto; capa nueva.
          <b>Niebla por distancia</b>: bruma que crece con la distancia (Densidad, Empieza a,
          Color: automático —el de lo más lejano—, blanca, cálida o fría), tramada para que no
          haga escalones en el cielo; capa nueva. <b>Foto 3D</b>: anima la foto con paralaje (lo
          cercano se mueve más que lo lejano) en círculo, de lado o acercándose, rellenando lo
          que se destapa con el fondo, y la guarda como <b>GIF</b>.</li>
      </ul>` },

  { id:"filtros", title:"Filtros (menú Filtro)",
    desc:"Desenfoques, enfoque, ruido con IA, retoque de retrato, frecuencias, texturas, distorsión…",
    html:`
      <h3>Filtros (menú Filtro)</h3>
      <ul>
        <li><b>Especiales.</b> Realify, Revelado fotográfico, Collage, memes, Filtro Vintage,
          PurePixel, Unmark, Estilos, Adaptive Photo Lens y Tabla de color: ver el tema
          «Filtros especiales», en el índice.</li>
        <li><b>Todo filtro deja su resultado en una capa nueva</b> reeditable (insignia «fx»);
          ver «Capas de filtro» en el tema Capas.</li>
        <li id="flt-zoom"><b>Zoom con el efecto abierto.</b> Con cualquier filtro o ajuste abierto
          puedes acercar y mover la imagen —rueda del ratón o pellizco con dos dedos sobre
          el lienzo— para juzgar de cerca un enfoque, un ruido o un borde, sin que el efecto
          se cancele ni se pierdan sus valores.</li>
        <li><b>Desenfoque gaussiano / Enfocar / Enfoque selectivo.</b> Suavizar,
          endurecer o endurecer sólo el detalle fino sin tocar las zonas planas.</li>
        <li><b>Desenfoques (submenú).</b> Gaussiano, galería de desenfoque (campo, iris,
          inclinación), caja/forma/promedio/inteligente, movimiento, lente (con forma del
          diafragma), radial/zoom y de superficie (suaviza sin cruzar bordes).</li>
        <li><b>Reducción de ruido.</b> Aplana el grano conservando los bordes, para
          fotos con ISO alto o muy comprimidas. Con IA (en el propio equipo):
          <i>Reducción de ruido con IA</i> (SCUNet, quita ruido real de cámara conservando
          el detalle; en el móvil avisa antes, porque el modelo es grande y puede tardar) y <i>Quitar artefactos JPEG con IA</i> (FBCNN,
          elimina bloques y halos de compresión). La primera vez descargan su modelo y lo
          guardan en el navegador.</li>
        <li><b>Corrección de lente.</b> Distorsión, aberración cromática y viñeteo,
          en tiempo real mientras mueves los deslizadores.</li>
        <li><b>Retoque de retrato.</b> Suaviza la piel respetando poros y bordes, con
          brillo controlado; no es un filtro de belleza agresivo.</li>
        <li><b>Separación de frecuencias…</b> El otro pilar del retoque de piel serio,
          junto a Dodge &amp; Burn. Deja dos capas nuevas encima de la activa (que se apaga,
          no se borra): «Baja frecuencia» —un desenfoque de la propia foto: color y luz,
          sin textura— y «Alta frecuencia» —lo que ese desenfoque se dejó fuera: la
          textura, en modo Luz lineal—. Cualquier retoque de color o de tono hecho en la
          capa de Baja (un pincel suave, un parche, Niveles…) iguala la piel sin difuminar
          ni un poro; cualquier retoque hecho en la de Alta (Clonar, Eliminar manchas…)
          corrige una marca o una arruga sin manchar el color de alrededor. El radio del
          diálogo decide la frontera entre las dos.</li>
        <li><b>Desenfoque de movimiento.</b> Arrastre direccional, para simular
          cámara o sujeto en movimiento.</li>
        <li><b>Detalle y estructura.</b> Realza la textura media (piedra, tela, follaje)
          sin el halo agresivo de un enfoque normal.</li>
        <li><b>Añadir ruido.</b> Grano deliberado, útil para igualar el aspecto de dos
          fuentes distintas o disimular un degradado con bandas.</li>
        <li><b>Viñeteado.</b> Oscurece las esquinas para llevar el ojo al centro, en
          negro, blanco o un color libre. «Redondez» controla la forma: al 100 % es
          un círculo perfecto; bajarla lo va ajustando a la proporción del lienzo,
          hasta tocar el borde medio en vez de sólo las esquinas —útil en panorámicas
          y en retratos muy verticales, donde un círculo puro sale descentrado—.</li>
        <li><b>Textura › Desplazamiento / mínimo / máximo…</b> Desplaza la imagen con
          envoltura sin costuras (para crear mosaicos que se repiten), o contrae
          (<i>Mínimo</i>) o expande (<i>Máximo</i>) las zonas claras con el radio elegido.</li>
        <li><b>Pixelizar, Estilizar, Artísticos, Interpretar, Textura, Distorsión.</b>
          Mosaico, cristalizar, semitono; relieve y bordes; resplandor, solarizar, viento,
          óleo; galería artística; nubes, fibras, destellos e iluminación; texturizador,
          grano, azulejos y craquelado; esferizar, coordenadas polares, gran angular
          adaptable, deformación libre y licuar.</li>
        <li><b>Pincel corrector / Parche / Licuar.</b> Los mismos «Eliminar manchas»,
          «Clonar» y «Licuar» de la barra de herramientas, accesibles también desde
          este menú.</li>
      </ul>` },

  { id:"propiedades", title:"Panel de propiedades",
    desc:"El panel contextual bajo Capas: mandos en vivo, sin diálogos, sin abrir nada.",
    html:`
      <h3>Panel de propiedades</h3>
      <ul>
        <li><b>Contextual, siempre a la vista.</b> Debajo del panel de Capas: en vez de
          abrir un diálogo modal, muestra los mandos de lo que tengas seleccionado ahí
          mismo, en vivo. Cambia solo según la capa activa —o se apila con varias
          secciones a la vez si hace falta, por ejemplo Texto y Máscara juntas en la
          misma capa—.</li>
        <li><b>Capa de ajuste.</b> Sus mandos completos (Brillo/contraste, Niveles,
          Curvas…), exactamente igual que al reabrirla desde el panel de Capas, pero sin
          diálogo: cada arrastre se ve al instante en el lienzo.</li>
        <li><b>Capa de texto.</b> Fuente (incluida «Cargar fuente desde archivo…»),
          tamaño e interlineado. El contenido en sí se sigue editando con doble clic en
          el lienzo, como siempre; esto es para tocar su aspecto sin entrar a escribir.</li>
        <li><b>Capa con máscara.</b> Densidad (dosifica el efecto entero de la máscara) y
          Desvanecer (difumina sus bordes), más «Seleccionar sujeto» y «Seleccionar
          cielo» —la misma detección del menú Inteligencia Artificial—, útiles
          para repetir el intento sobre la máscara ya puesta si el primero no convenció.</li>
        <li><b>Capa fx (filtro reeditable).</b> Los parámetros del filtro, inline, con la
          misma vista previa en baja resolución mientras se arrastra y a resolución
          completa al soltar que ya tenía su diálogo. Un puñado de filtros sin mandos que
          editar —Invertir, Niveles automáticos, Contraste automático— o con un esqueleto
          propio —Tabla de color, Looks, Unmark— todavía sólo se editan en su propio
          diálogo; ahí el panel ofrece un botón para abrirlo en vez de intentar
          montarlo.</li>
        <li><b>Un solo paso de historial por sesión.</b> Mientras la capa siga
          seleccionada, tocar sus mandos no llena el historial de pasos sueltos: se
          confirma como uno solo al pasar a otra capa, el mismo criterio que ya usaban
          los diálogos con su botón Aplicar.</li>
      </ul>` },

  { id:"capas", title:"Capas (menú Capa)",
    desc:"Capas de ajuste, capas de filtro encadenables, alinear/distribuir, grupos, máscaras.",
    html:`
      <h3>Capas (menú Capa)</h3>
      <ul>
        <li><b>Nueva capa, Duplicar, Eliminar, Subir, Bajar.</b> La gestión básica de la
          pila; el orden en el panel de Capas es el orden en el que se dibujan.</li>
        <li><b>Capa de ajuste…</b> Un Brillo/contraste, Niveles, Curvas… que vive en su
          propia capa y se puede reeditar o apagar después, en vez de aplicarse
          directamente y quedar fijo. Casi todos los ajustes de este menú ya crean su
          capa nueva por defecto.</li>
        <li><b>Capa de relleno.</b> <i>Color sólido</i>, <i>Degradado</i> (con ángulo
          para lineal, o radial desde el centro) o <i>Motivo</i> —pide una imagen y la
          deja repetida en mosaico, con escala, rotación y desplazamiento propios—.
          Ocupa el lienzo entero y se reedita en cualquier momento desde el panel de
          Propiedades: cambiar el color o el degradado nunca «cuece» nada en píxeles
          fijos. Distinta de una capa de ajuste en que sí tiene contenido propio que
          componer, no sólo un efecto sobre lo de abajo.</li>
        <li><b>Formas.</b> Ver «Formas (U)», en Herramientas.</li>
        <li><b>Capas de filtro (insignia «fx»).</b> Todo filtro y ajuste deja su
          resultado en una capa nueva encima del original y guarda dentro con qué
          valores se hizo. Con esa capa de filtro activa, aplicar OTRO filtro no
          apila una tercera capa: se ENCADENA sobre la misma (la insignia pasa a
          «fx·2», «fx·3»…) y aparece como una fila más debajo del nombre, con su
          propio interruptor, su porcentaje y botones para subirla, bajarla o
          quitarla de la cadena — «desenfoque → nitidez → viñeta» son tres filas
          en una sola capa, cada una recalculable u opcional sin tocar las demás.
          <b>Doble clic en «fx»</b> lleva sus mandos completos al panel de
          Propiedades mientras la capa lleve un solo filtro; en cuanto hay una
          cadena, el ajuste fino se hace desde sus filas, no desde ningún panel.
          El deslizador de <b>aplicación</b> de cada entrada no es la
          opacidad —que funde el resultado con lo de abajo—, sino que vuelve a
          calcular ESE filtro con sus mandos escalados a ese porcentaje (un
          desenfoque de radio 10 al 50 % es un desenfoque de radio 5); sólo
          escalan los mandos de intensidad, posiciones o elecciones se quedan
          como estaban. Mientras arrastras se calcula en baja resolución; al
          soltar, a resolución completa y con paso de historial.</li>
        <li><b>Alinear y Distribuir.</b> Con varias capas seleccionadas en el panel,
          las alinea (a un borde, al centro) o reparte el espacio entre ellas por
          igual.</li>
        <li><b>Combinar con la de abajo / Combinar visibles / Acoplar imagen.</b> Van
          fundiendo capas: la primera sólo dos, la segunda todas las visibles, la
          tercera el documento entero en una sola capa.</li>
        <li><b>Transformar capa…</b> Escala, rotación y dos inclinaciones (X, Y),
          más volteo horizontal/vertical, con valores exactos en vez de arrastrar a
          mano; distinta de la herramienta Mover (V), que sólo desplaza.</li>
        <li><b>Agrupar capas</b> (<kbd>Ctrl</kbd>+<kbd>G</kbd>) / <b>Desagrupar</b>
          (<kbd>Ctrl</kbd>+<kbd>Mayús</kbd>+<kbd>G</kbd>). Mete las capas marcadas
          en el panel (o la activa, si no hay ninguna marcada) en un grupo nuevo:
          una carpeta plegable con su propia opacidad, modo de fusión y máscara,
          que se pliega o despliega con la flecha de su fila —plegarlo sólo afecta
          al panel, el lienzo sigue mostrando su contenido igual—. Un grupo se
          puede agrupar dentro de otro grupo, y «Subir»/«Bajar» lo mueven entero,
          con todo su contenido, en vez de sólo la cabecera.</li>
        <li><b>Recortar a la capa de abajo.</b> <kbd>Alt</kbd>+clic en la miniatura
          de una capa la recorta a la forma (el canal alfa) de la capa —o
          grupo— no recortada más próxima por debajo, en su mismo nivel; vuelve a
          <kbd>Alt</kbd>+clic para quitarlo. Varias capas seguidas pueden
          recortarse a la misma base, encadenadas. Distinto de una máscara: aquí
          la forma la pone otra capa, no un trazo pintado a mano.</li>
        <li><b>Estilos de capa…</b> Sombra paralela, resplandor exterior, trazo y
          superposición de degradado, en cualquier capa o grupo, siempre
          reeditables —se recalculan a partir de los píxeles actuales, nunca se
          «cuecen» dentro de ellos—. El trazo y el resplandor siempre quedan por
          fuera del contorno de la capa, nunca por dentro ni centrados.</li>
        <li><b>Fusión (panel de Capas).</b> Los 27 modos de cualquier editor serio,
          agrupados igual que ahí: Oscurecer, Aclarar, Contraste, Comparar y
          Componente, más Normal y Disolver sueltos. La mayoría los entiende el
          propio navegador de forma nativa; los que no —Quemar lineal, Color más
          oscuro/más claro, Luz intensa, Luz suave puntual, Mezcla fuerte, Restar,
          Dividir y el propio Disolver— se calculan aquí píxel a píxel, con el mismo
          resultado que en cualquier otro editor.</li>
        <li><b>Fusionar si…</b> La vía más rápida para mezclar dos capas por brillo
          sin pintar ninguna máscara a mano: dos franjas negro→blanco, «Esta capa» y
          «Capa subyacente», cada una con su punto negro y su punto blanco. Bajar el
          punto negro de «Esta capa» oculta sus zonas oscuras y deja ver lo de abajo
          en su lugar; subir el punto blanco de «Capa subyacente» hace que las luces
          de lo que hay debajo se abran paso ATRAVESANDO esta capa. Por defecto cada
          punto es un corte duro —abajo de negro o encima de blanco, invisible del
          todo—; mantener <kbd>Alt</kbd> nada más EMPEZAR a arrastrar lo parte en dos
          mitades independientes, con una rampa suave entre ambas en vez de un borde
          serrado justo donde el tono cruza el umbral. Doble clic en una franja, o el
          botón «Quitar», la devuelve a su rango completo. No aplica a un grupo ni a
          una capa de ajuste, que no tienen un lienzo propio con el que medir «esta
          capa» antes de componer nada.</li>
        <li><b>Máscaras</b> (descubrir/ocultar todo, desde la selección normal o
          invertida, invertir, activar/desactivar, aplicar, eliminar, degradada).
          Ocultan parte de una capa sin borrar ningún píxel: lo que la máscara pinta
          en negro desaparece, lo que deja en blanco se ve, y los grises quedan a
          medias. «Aplicar» la funde de verdad con la capa. Una máscara tiene sus
          propios <b>Niveles…</b> y <b>Curvas…</b> —los mismos atajos <kbd>Ctrl</kbd>+<kbd>L</kbd>
          y <kbd>Ctrl</kbd>+<kbd>M</kbd> se redirigen a la máscara en vez de a la
          imagen en cuanto su miniatura está seleccionada como destino—, además de
          <b>Suavizar máscara…</b> (desenfoque) y <b>Propiedades…</b> (densidad y
          desvanecido, sin repintar nada a mano).</li>
        <li><b>Máscara degradada…</b> Crea una máscara ya rellena con un degradado
          lineal o radial en vez de partir de blanco u ocultar todo; con opción de
          invertir el sentido y ajustar el tamaño, para transiciones suaves sin tener
          que pintarlas con el Degradado a mano.</li>
        <li><b>Nueva capa de texto, Editar texto, Rasterizar texto.</b> Ver «Texto»,
          en «Otras herramientas».</li>
        <li><b>Añadir stickers…</b> Más de 1.500 emojis en 3D, color, plano o alto contraste
          (y seis tonos de piel), con buscador y categorías, a pantalla completa: colócalos,
          escálalos y gíralos sobre la foto. Cada sticker queda en su propia capa y todo
          funciona sin conexión.</li>
        <li><b>Crear meme…</b> Ver «Filtros especiales».</li>
        <li><b>Añadir marca de agua…</b> Coloca un texto o logo semitransparente
          repetido o en una esquina, en una capa aparte.</li>
      </ul>` },

  { id:"archivo", title:"Archivo y documentos",
    desc:"Abrir, guardar, exportar (AVIF, PDF, GIF), hoja de contactos, lotes, acciones, cerrar todas.",
    html:`
      <h3>Archivo</h3>
      <ul>
        <li><b>Abrir imagen / Abrir proyecto / Guardar proyecto.</b> Un proyecto
          guarda todas las capas, máscaras e historial tal cual, para seguir editando
          otro día; una imagen abierta directamente empieza como una sola capa.</li>
        <li><b>Documento nuevo… / Collage / History / Post…</b> Un lienzo vacío a medida, o una
          composición para redes creada en su propia pestaña (ver su tema).</li>
        <li id="file-alpha"><b>Transparencia al guardar.</b> Lo que se guarda en un formato sin capas
          (JPEG, PNG, WebP, AVIF, PDF, GIF) es el <b>acoplado de las capas visibles</b>: lo que ves. Si
          hay zonas transparentes, PNG, WebP, AVIF y GIF las <b>conservan</b> (casilla «Conservar la
          transparencia», marcada por defecto, en Exportar, Exportar como, lotes, acciones y Cortar
          en partes); JPEG y PDF no admiten transparencia y esas zonas se rellenan con el
          <b>color de fondo</b> que elijas (blanco por defecto). Con transparencia, Exportar propone
          PNG de entrada. Para guardar las capas por separado, usa Guardar proyecto.</li>
        <li><b>Exportar… / Exportar PNG rápido.</b> El primero deja elegir formato (JPEG,
          PNG, WebP, <b>AVIF</b> —más ligero a igual calidad— o <b>PDF</b>, con tamaño de página y
          margen), calidad y metadatos EXIF, y <b>«Tramado a 8 bits»</b>: añade un ruido
          imperceptible que evita las bandas en cielos y degradados suaves. El segundo
          entrega un PNG sin preguntar nada.</li>
        <li id="file-gif"><b>Exportar GIF animado…</b> Cada capa visible es un fotograma, sola o
          sumada a las de debajo: duración de cada fotograma, bucle, ida y vuelta, tamaño y
          número de colores.</li>
        <li id="file-contactsheet"><b>Hoja de contactos…</b> Pantalla completa. Muchas fotos
          ordenadas en páginas A4, A3, Carta o 10 × 15, con columnas, márgenes, título y el
          nombre de cada foto. Sale como <b>PDF</b> de varias páginas o como capas nuevas.</li>
        <li><b>Prueba para redes sociales…</b> Muestra cómo queda la imagen tras la
          recompresión que aplican Instagram, WhatsApp, Facebook o X, antes de
          publicarla de verdad.</li>
        <li id="file-batch"><b>Editar en lote…</b> y <b>Aplicar esta edición a otras fotos…</b> Abre varias
          fotos (cada una en su pestaña), edita una como siempre y copia su edición —capas
          de ajuste, filtros, textos, marcas de agua, con su opacidad y fusión— a las demás
          o a fotos de la galería. Vista previa de todas, <b>igualar exposición</b> con la de
          referencia y resultado en sus pestañas (capas reeditables) o en un ZIP. No se
          copian máscaras, pinceladas ni recortes.</li>
        <li id="file-actions"><b>Acciones (grabar y repetir)…</b> Pulsa <b>Grabar</b>, usa ajustes,
          filtros y comandos como siempre y detén la grabación: queda guardada con sus
          valores. Después se repite con un toque en cualquier foto, o en muchas a la vez
          (resultado en un ZIP). Se pueden renombrar, borrar, exportar e importar. No se
          graban los trazos de pincel ni los gestos sobre la imagen. La barra «Grabando» es
          flotante: arrástrala por el asa ⠿ (o por el texto) a donde no estorbe, por ejemplo
          para llegar a la barra superior; recuerda dónde la dejaste.</li>
        <li id="file-closeall"><b>Cerrar documento / Cerrar todas las fotos.</b> El primero cierra
          la foto activa; el segundo, todas las abiertas de una vez, con una sola
          confirmación. «Cerrar todas» también está en Herramientas (móvil) y como botón al
          final de la barra de pestañas cuando hay más de una foto abierta. Lo que no hayas
          exportado o guardado como proyecto se pierde.</li>
        <li><b>Restaurar al estado original…</b> Descarta capas, ediciones e historial
          y vuelve exactamente al archivo tal como se abrió. No se puede deshacer.</li>
      </ul>

      <h3>Varios documentos a la vez</h3>
      <p>Abrir imagen, Documento nuevo, Abrir proyecto y soltar un archivo sobre el
        lienzo suman siempre un documento nuevo, nunca sustituyen el que ya hubiera
        abierto — igual que en cualquier editor con pestañas. Con dos documentos o
        más, aparece una fila de pestañas bajo el menú: miniatura, nombre y una cruz
        para cerrar, tocar una para pasar a ella. Con uno solo, la fila desaparece y
        no ocupa sitio.</p>
      <ul>
        <li><b>Abrir varias imágenes a la vez.</b> El selector de archivos y arrastrar
          y soltar admiten elegir más de una: cada una abre en su propia pestaña, en
          el orden en que se eligieron.</li>
        <li><b>Con Mayús</b>, soltar una o varias imágenes sobre el lienzo las coloca
          como capas nuevas del documento que ya está abierto, en vez de abrir
          pestañas — el mismo atajo de siempre para montar varias fotos juntas.</li>
        <li><b>Copiar, cortar y pegar</b> funcionan entre pestañas sin nada especial
          que hacer: copia (o corta) en una, cambia a la otra, pega — el portapapeles
          no pertenece a ningún documento en concreto.</li>
        <li><b>Llevar una capa a otro documento.</b> Arrastra su fila en el panel de
          Capas hasta la pestaña de destino, o haz clic derecho sobre la fila (fuera
          de la miniatura de máscara) y elige «Copiar capa a…». En los dos casos se
          copia, respetando la proporción si los documentos no miden lo mismo, y la
          vista pasa a mostrar el documento de destino.</li>
        <li><b>Alt+1</b> a <b>Alt+9</b> saltan directamente a esa pestaña por su
          posición. <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Tab</kbd> y
          <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>W</kbd> quedan reservados por el propio
          navegador para sus pestañas y nunca llegan a la página, así que aquí no
          hacen nada: para cerrar un documento, la cruz de su pestaña o «Archivo →
          Cerrar documento»; para cerrarlos todos, el botón «Cerrar todas» de la
          barra de pestañas o «Archivo → Cerrar todas las fotos».</li>
      </ul>` },

  { id:"realify", title:"Realify · simulación de captura",
    desc:"La simulación de cámara completa: 31 etapas, EXIF, análisis de plausibilidad.",
    sub: [
      { id:"orden", title:"El orden importa",
        desc:"Por qué el orden de las 31 etapas cambia el resultado, y qué bloque es cada una.",
        html:`
          <h3>El orden importa</h3>
          <p>Las etapas están en el orden en que la luz las encuentra —o, en las cuatro
            primeras y las cuatro últimas, en el orden en que se limpia lo que un
            generador deja y se codifica lo que una cámara entrega—. Mover una cambia el
            resultado, y no de forma sutil: el grano añadido antes del mosaico de Bayer
            se demosaica junto con la imagen y sale correlacionado entre canales, igual
            que en una cámara. Añadido después, sale independiente por canal, y eso se
            mide. Son <b>31 etapas</b> en total, agrupadas en siete bloques; la última no
            toca ni un píxel.</p>
          <ul>
            <li><b>1–4 · Antes de la óptica.</b> Rompe la microestructura propia del
              generador: rejilla de <i>upsampling</i>, picos espectrales, la forma
              general del espectro.</li>
            <li><b>5–12 · Óptica.</b> Lo que hace el objetivo antes de tocar el sensor,
              más la halación (rebote dentro del propio sensor).</li>
            <li><b>13–17 · Sensor.</b> Mosaico de color, sus dos firmas de ruido fijo y
              el ruido de cada disparo.</li>
            <li><b>18–22 · Procesador de la cámara.</b> Recorte, balance, curva,
              reducción de ruido y el residuo que deja detrás.</li>
            <li><b>23–25 · Superficie física.</b> Marcas de manejo, relieve, deformación
              anti-huella.</li>
            <li><b>26–30 · Archivo.</b> Croma, rastros de cuantización, limpieza final
              del espectro y códec.</li>
            <li><b>31 · Metadatos.</b> Deja el EXIF coherente con todo lo anterior.</li>
          </ul>` },

      { id:"etapas1", title:"Etapas 1–12 · Antes del sensor",
        desc:"Rejilla del generador, objetivo, profundidad de campo, aberración, halación, destello.",
        html:`
          <h3>Etapas 1–12 · Antes del sensor</h3>
          <h4>Antes de la óptica — romper la retícula del generador</h4>
          <ul>
            <li><b>Remuestreo con antialias.</b> Reduce la resolución interna y
              reconstruye con Lanczos: rompe correlaciones entre píxeles vecinos.</li>
            <li><b>Residuos multiescala (ondículas).</b> Atenúa detalle fino y medio con
              una descomposición à trous, protegiendo los contornos reales.</li>
            <li><b>Eliminar patrones de upsampling.</b> Filtro peine contra el tablero de
              ajedrez que deja una convolución traspuesta: picos exactos cada 2 y 4 px.</li>
            <li><b>Distribución de energía espectral.</b> Aplica el desenfoque óptico de
              una cámara real (vintage, DSLR, móvil o high-res) sobre el espectro
              entero, no sólo sobre la rejilla.</li>
          </ul>
          <h4>Óptica</h4>
          <ul>
            <li><b>Distorsión del objetivo.</b> Barril en gran angular, cojín en tele;
              las líneas rectas de un render salen perfectamente rectas.</li>
            <li><b>Profundidad de campo.</b> Desenfoca fuera del punto de foco, con
              discos de bokeh en las altas luces. En modo <b>Física</b> no se ajusta a
              ojo: el desenfoque se calcula con la fórmula real del círculo de confusión
              a partir del número f, la focal, la distancia de enfoque y el recorte del
              sensor, así que cambiar cualquiera de esos cuatro valores lo cambia
              exactamente como lo haría un objetivo real.</li>
            <li><b>Trepidación de cámara.</b> Arrastre lineal, zoom radial o
              microtemblor, más el cizallado de un obturador progresivo.</li>
            <li><b>Aberración cromática.</b> Separación de canales radial y creciente
              con el cuadrado del radio —esa geometría concreta es la clave—, más
              <i>fringing</i> púrpura en bordes de alto contraste.</li>
            <li><b>Nitidez de campo.</b> Peor resolución hacia la esquina, con
              astigmatismo (el desenfoque se alarga en una dirección, no es redondo).</li>
            <li><b>Viñeteo.</b> Caída de luz por ley del coseno a la cuarta, con
              desaturación aparte y forma ajustable de círculo a elipse (redondez).</li>
            <li><b>Halación.</b> Las luces atraviesan la capa fotosensible y rebotan en
              el respaldo del sensor, con dominante roja. Pirámide de tres niveles para
              la cola larga: un solo desenfoque deja un aura pegada al borde.</li>
            <li><b>Destello de lente.</b> Fantasmas, halo anamórfico y puntas de
              difracción sobre las luces muy intensas —geometría de cristal físico que
              ningún render tiene detrás.</li>
          </ul>` },

      { id:"etapas2", title:"Etapas 13–22 · Sensor y procesador",
        desc:"Mosaico Bayer, PRNU, ruido de disparo, recorte, balance, gradación, reducción de ruido.",
        html:`
          <h3>Etapas 13–22 · Sensor y procesador</h3>
          <h4>Sensor</h4>
          <ul>
            <li><b>Mosaico Bayer.</b> Muestreo RGGB y demosaico bilineal, «malo» a
              propósito: sus artefactos —cremallera, falso color— son los de una cámara.</li>
            <li><b>Patrón de filtro Bayer (CFA).</b> La periodicidad de rejilla 2×2 que
              un demosaico real deja detrás incluso reconstruyendo bien, fija por
              cámara: es la firma que la estimación forense de CFA usa para verificar un
              sensor real.</li>
            <li><b>Ruido PRNU.</b> La sensibilidad de cada fotodiodo varía un poco por
              imperfecciones de fabricación del silicio: multiplicativo, invisible en
              negro absoluto y FIJO —la misma cámara lo repite en todas sus fotos—.</li>
            <li><b>Ruido de sensor.</b> El de disparo crece con la <b>raíz de la
              señal</b>; el de lectura es casi constante, así que las sombras quedan con
              peor relación señal-ruido de forma natural, y «Más ruido en sombras» puede
              exagerar aún más esa asimetría. El grano se agrupa en cúmulos
              correlacionados, no píxel a píxel: el ruido blanco puro se reconoce al
              400&nbsp;%.</li>
            <li><b>Polvo del sensor.</b> Motas semitransparentes en las mismas
              posiciones en cada disparo de esa cámara.</li>
          </ul>
          <h4>Procesador de la cámara</h4>
          <ul>
            <li><b>Recorte y nivel de negro.</b> Cada canal satura a un nivel distinto,
              así que lo quemado vira en vez de quedar blanco puro; el negro tampoco es
              cero.</li>
            <li><b>Balance y curva.</b> Balance de blancos imperfecto y curva de
              contraste de fabricante. <b>Siempre se ejecuta</b>, aunque esté apagada:
              es donde se codifica de luz lineal a sRGB.</li>
            <li><b>Gradación por zonas.</b> Tinte independiente para sombras y luces, el
              look de cine que un balance de blancos global no reproduce.</li>
            <li><b>Reducción de ruido y enfoque.</b> Aplasta las sombras planas
              respetando contornos y añade enfoque con halos: ese contraste entre
              textura aplastada y bordes nítidos es la firma de un móvil.</li>
            <li><b>Residuos de ruido de cámara digital.</b> Lo que un denoiser real deja
              detrás sin limpiar del todo: textura de colas pesadas (no gaussiana),
              concentrada donde hay detalle —el denoiser es más tímido ahí— y aleatoria
              en cada disparo, al contrario que el PRNU.</li>
          </ul>` },

      { id:"etapas3", title:"Etapas 23–31 · Superficie, archivo y metadatos",
        desc:"Marcas de manejo, croma, compresión JPEG real, y el EXIF que casa con la óptica.",
        html:`
          <h3>Etapas 23–31 · Superficie, archivo y metadatos</h3>
          <h4>Superficie física</h4>
          <ul>
            <li><b>Rasguños y pelos de superficie.</b> Marcas de manejo de una copia
              impresa o un escáner, casi al azar.</li>
            <li><b>Microrrelieve de superficie.</b> Relieve real de la fibra del papel,
              visible sólo con la luz casi de refilón —gira con el ángulo que se le dé—.</li>
            <li><b>Micro-deformación.</b> Menos de dos píxeles de desplazamiento con
              ruido suave; no se ve, pero descorrelaciona la rejilla del generador sin
              tocar el contenido.</li>
          </ul>
          <h4>Archivo</h4>
          <ul>
            <li><b>Submuestreo de croma.</b> El color se guarda a media resolución y
              sangra sobre los bordes. El códec vuelve a hacerlo por su cuenta, así que
              esto se acumula.</li>
            <li><b>Rastros de la tubería JPEG.</b> Aproxima en la vista previa lo que la
              compresión real hace más abajo, sin verse: blockiness en los límites de
              8×8 y ringing (efecto Gibbs) pegado a bordes de contraste fuerte.</li>
            <li><b>Eliminar patrones periódicos.</b> La versión general del filtro peine
              de arriba: analiza el espectro completo por bloques y atenúa cualquier
              pico que sobresalga del fondo de su propio anillo, sea cual sea su paso.</li>
            <li><b>Normalizar pendiente espectral.</b> Distinto de lo anterior: no
              ataca picos, sino la <i>forma global</i> de la caída de energía con la
              frecuencia, para que siga la ley de potencia suave de una foto real.</li>
            <li><b>Compresión JPEG.</b> Codifica y decodifica de verdad con el códec del
              navegador, varias generaciones si hace falta. Bloques de 8×8 reales, no
              simulados. Es la única etapa de píxeles que no se ve en la vista previa
              —una compresión real no es cosa de recalcular en cada deslizador—.</li>
          </ul>
          <h4>Metadatos</h4>
          <ul>
            <li><b>EXIF coherente con la óptica.</b> No toca un píxel: puntúa cada
              cuerpo y objetivo de la base de datos EXIF por cuánto encajan sus rasgos
              físicos reales —focal, apertura máxima, tamaño de sensor, resolución— con
              lo que esta cadena tiene activado, y deja marcado el que mejor casa en el
              panel de metadatos. Cierra el hueco entre «qué distorsión se aplicó de
              verdad» y «qué objetivo dice el EXIF que la tomó».</li>
          </ul>` },

      { id:"mandos", title:"Los mandos que no son etapas",
        desc:"Semilla, cámara, Variar, Ajuste recomendado, dosis, aislar y diferencia.",
        html:`
          <h3>Los mandos que no son etapas</h3>
          <ul>
            <li><b>Semilla.</b> Fija el ruido de ESTE disparo: grano, micro-deformación,
              rasguños… Dos exportaciones con la misma semilla y los mismos ajustes son
              idénticas, y eso es una firma: usa «Nueva» o «Variar» entre imágenes.</li>
            <li><b>Cámara.</b> Fija el patrón FIJO del sensor —PRNU y patrón CFA—, que en
              una cámara real es idéntico en todas sus fotos. Mantenla igual en todo un
              lote y compartirán esa huella entre sí; cámbiala y es como haber usado otro
              cuerpo. Distinta de la Semilla a propósito: el grano cambia foto a foto, la
              huella del sensor no.</li>
            <li><b>Variar.</b> Desvía cada valor activo un 9 % y sortea semilla. Veinte
              salidas con la misma configuración comparten firma; ésta es la cura.</li>
            <li><b>Ajuste recomendado.</b> Mide ruido, detalle, recorte de luces y
              sombras, dominante de color, bloques JPEG ya presentes, rejillas y la
              pendiente del espectro sobre la imagen de origen, y propone un punto de
              partida coherente con lo que encuentra —menos grano si ya hay ruido, más
              si no, filtro peine sólo si hay una rejilla que quitar—. Explica lo medido
              junto al botón: no hay que aceptarlo a ciegas.</li>
            <li><b>Dosis manual.</b> Multiplica lo que hay en el panel al renderizar, sin
              mover los deslizadores. El 100 % devuelve exactamente tu selección.</li>
            <li><b>Aislar (S).</b> Apaga temporalmente todo lo demás para ver qué hace una
              etapa sola.</li>
            <li><b>Diferencia.</b> Muestra sólo lo que ha cambiado, amplificado. Si un
              efecto es sutil, es la única forma de saber si actúa débilmente o no actúa.</li>
          </ul>` },

      { id:"espectro", title:"El espectro",
        desc:"La rejilla periódica que delata un modelo de difusión, y cómo comprobar que desaparece.",
        html:`
          <h3>El espectro</h3>
          <p>Los modelos de difusión dejan una <b>rejilla periódica</b> en el espectro de
            frecuencia, herencia de las capas de sobremuestreo. Es el indicio más usado
            por los detectores. Ábrelo desde el panel del filtro (junto al histograma):
            si ves puntos regulares fuera del centro en «Origen» y no en «Salida», las
            cuatro etapas del bloque «antes de la óptica» —remuestreo, ondículas,
            eliminar upsampling, distribución espectral— y las dos de limpieza final del
            bloque «archivo» —eliminar patrones periódicos, normalizar pendiente
            espectral— están cumpliendo. El recorte es central y de 256 px sin escalar,
            porque escalar promediaría justo las frecuencias donde vive la rejilla.</p>` },

      { id:"exif", title:"Metadatos EXIF",
        desc:"Qué metadatos escribe la exportación, y qué deja deliberadamente sin escribir.",
        html:`
          <h3>Metadatos EXIF</h3>
          <p>La cadena exporta sin metadatos por defecto. El panel EXIF escribe una
            cabecera coherente: cuerpo, objetivo, y una exposición que <b>cuadra consigo
            misma</b>. El modo automático no sortea números sueltos, sino que fija un valor
            de exposición para la escena y deriva de él la velocidad a partir de la
            apertura y el ISO, de modo que el triángulo de exposición sea físicamente
            posible. Un f/16 a 1/2000 e ISO 100 en un retrato de interior es una
            contradicción que se detecta con una línea de código.</p>
          <p>Las coordenadas traen las 52 capitales de provincia con su altitud real, y
            se desplazan unos metros en cada exportación: un GPS nunca devuelve dos
            lecturas idénticas, y veinte fotos con la misma coordenada al microgrado son
            una constante que delata el lote. Ojo con una cosa: <b>casi ninguna réflex
            Canon lleva GPS integrado</b> —la 6D, la 6D Mark II, la 5D Mark IV y la 7D
            Mark II sí; una 600D no—. Eso no invalida el dato, porque geoetiquetar en el
            revelado es práctica normal, pero entonces la etiqueta <code>Software</code>
            debería estar puesta, que es justo lo que la cuenta.</p>
          <p>Lo que la herramienta <b>no</b> escribe es el <code>MakerNote</code>, el bloque
            propietario del fabricante. Es enorme, distinto en cada modelo, y falsificarlo
            de forma convincente es otro problema. Su ausencia es normal en un archivo
            que ha pasado por software de revelado, y es coherente con la etiqueta
            <code>Software</code>. Conviene saberlo: el EXIF resultante dice «cuerpo Canon,
            procesado en software», no «original intacto de cámara».</p>` },

      { id:"analisis", title:"Análisis y segunda opinión",
        desc:"El espejo que mide lo que la cadena fabrica, y tres algoritmos forenses independientes.",
        html:`
          <h3>Análisis de plausibilidad</h3>
          <p>El panel de análisis mide en la salida los mismos cinco rasgos que miran los
            detectores. No es un detector y no da garantías: es un espejo, para ver si la
            cadena está haciendo lo que crees. Una puntuación alta significa que los
            indicios <i>que esta herramienta sabe medir</i> están en su sitio, no que la
            imagen sea indistinguible de una fotografía.</p>
          <div class="callout">
            <p><b>Ojo con la circularidad.</b> Ese panel mide justo los cinco rasgos que la
              cadena fabrica, así que por construcción te va a dar la razón. Si subes el
              ruido de sensor, la barra del ruido sube: eso no es una comprobación, es un
              eco. Un 90/100 no dice «esto pasa por una foto», dice «hice lo que me
              pediste».</p>
          </div>

          <h3>Segunda opinión</h3>
          <p>Por eso hay un segundo panel con tres algoritmos forenses publicados,
            implementados a partir de la descripción del método y no de lo que hace la
            cadena. No saben nada de ella y pueden llevarle la contraria.</p>
          <ul>
            <li><b>Correlación CFA</b> (Popescu y Farid, 2005). Una imagen que ha pasado por
              un sensor con filtro de color tiene dos tercios de sus muestras interpoladas,
              y como el mosaico se repite cada dos píxeles, el residuo de predicción sale
              con periodicidad 2×2. Es el contrapunto real a la etapa 6.</li>
            <li><b>Nivel de error (ELA)</b>. Recomprime y mide cuánto cambia cada zona. Una
              imagen con un historial homogéneo cambia parejo en todas partes. El mapa dice
              más de un vistazo que el número: bultos claros donde el historial difiere.</li>
            <li><b>Peine de cuantización</b>. Cada codificación JPEG deja huecos periódicos
              en el histograma. Se busca esa raya en el espectro del histograma, por canal
              y no sobre la luminancia, porque al mezclar los canales con pesos no enteros
              el peine se difumina. Además del sí o el no, dice el paso aproximado.</li>
          </ul>
          <p>Cuando los dos paneles coinciden, la señal vale algo. Cuando el primero va alto
            y el segundo bajo, es que la cadena está haciendo ruido sin dejar la estructura
            que ese ruido debería tener.</p>` }
    ] },

  { id:"especiales", title:"Filtros especiales",
    desc:"Realify, revelado, Collage / History / Post, memes, Filtro Vintage, Estilos, Unmark, LUT…",
    html:`
      <h3>Filtros especiales (Filtro › Especiales)</h3>
      <p>Realify, PurePixel, Unmark y Adaptive Photo Lens están ahora en el menú
        <b>Inteligencia Artificial</b> (y en esa pestaña del cajón del móvil).</p>
      <p>Los más grandes se abren a <b>pantalla completa</b> con la misma estructura:
        Cancelar, deshacer y rehacer propios y Aplicar arriba; en escritorio, columnas a los
        lados de la vista previa; en el móvil, la imagen ocupa la pantalla y los mandos son
        un desplegable y un deslizador con botones − y + abajo.</p>
      <ul>
        <li id="sp-realify"><b>Realify…</b> La simulación de cámara completa (31 etapas, de la óptica al
          archivo), con zoom real hasta 1:1, comparación, histograma y espectro. Detalle en
          el tema «Realify · simulación de captura».</li>
        <li><b>Revelado fotográfico…</b> El revelador no destructivo de la capa activa;
          parámetros, porcentaje, máscara y opacidad se guardan aparte.</li>
        <li id="sp-wbpick"><b>Cuentagotas de balance de blancos (revelador RAW).</b> El botón con el
          cuentagotas, junto a «Encajar» sobre la foto: púlsalo y toca un punto que deba ser
          blanco o gris neutro. Ajusta Temperatura y Matiz para dejarlo neutro, leyendo la foto
          en luz lineal antes de revelar (también en modo Premium 👑, en su espacio Rec.2020); si
          la dominante es muy fuerte, cambia además al preajuste de balance más cercano
          (Tungsteno, Sombra…). En la Fusión HDR está en Color › «Cuentagotas de balance de
          blancos».</li>
        <li id="sp-premium"><b>Revelado Premium (👑).</b> En el revelador RAW (y en el Revelado
          fotográfico), el interruptor con la <b>corona</b> de la barra superior cambia al motor de
          alta calidad con los mismos mandos: en un RAW vuelve a revelar en <b>Rec.2020</b> (los
          colores intensos ya no se recortan) con el demosaico <b>DHT</b>, y todo se calcula en
          coma flotante y luz lineal. Sombras, altas luces y claridad trabajan sin halos; la curva
          fílmica lleva las luces al blanco sin quemarlas; el ruido de color se limpia sin
          desteñir; los colores conservan su tono. Aparece <b>TIFF 16 bits</b> para guardar el
          revelado completo a 16 bits por canal, y al abrirlo en Realify se reduce en luz lineal
          con enfoque de salida. Apágalo y el revelador vuelve a ser exactamente el de antes. El
          interruptor se recuerda en este navegador.</li>
        <li id="sp-collage"><b>Collage / History / Post…</b> Ver su propio tema en el índice.</li>
        <li id="sp-meme"><b>Crear meme…</b> 26 diseños —clásico, barras negras o blancas arriba y abajo,
          comparación, expectativa vs. realidad, periódico, chat, «Se busca», cómic,
          historias 9:16…—. Los diseños de dos imágenes admiten una <b>segunda foto</b>:
          ábrela desde el panel o pégala con <kbd>Ctrl</kbd>+<kbd>V</kbd>. Textos con 29
          tipografías, 26 estilos rápidos, contornos, sombras, neón, relieve 3D,
          bocadillos y curvatura; toca un texto para elegirlo, arrástralo, usa su esquina
          para escalar y girar y doble clic para escribir. Si el diseño lo necesita, el
          lienzo se amplía; cada elemento queda en su capa.</li>
        <li id="sp-vintage"><b>Filtro Vintage…</b> 42 modificadores en siete grupos (virados, color,
          tono, luz y película, daños, bordes, óptica) y <b>215 estilos</b> en 19 categorías:
          décadas, películas en color, blanco y negro, procesos antiguos, cámaras y ópticas,
          creativos, estaciones, laboratorio, cine clásico, viajes y postales, retratos
          antiguos, instantáneas, álbum de familia, noir, pop y psicodelia, tecnología retro,
          galería y museo, y papel y archivo (muchos ya traen su marco). El desplegable
          <b>Marco</b> abre <b>119 marcos</b> en diez categorías (instantáneas, película,
          papel antiguo, marcos de cuadro, postales y sellos, viñetas y formas, pantallas,
          desgaste, decorativos y álbum), cada uno con su miniatura sobre tu foto; en el
          móvil la hoja sube desde abajo. «Anchura del marco» (grupo Bordes) lo ensancha.
          El dado da una variación nueva del polvo, los arañazos, las fugas de luz y las
          texturas del marco. Queda como capa reeditable.</li>
        <li><b>PurePixel…</b> Suaviza residuos finos de luminancia y color y añade textura
          controlada; experimental, no garantiza nada frente a un detector.</li>
        <li><b>Unmark…</b> Tres secciones en un panel: <i>marcas visibles</i> (detecta el
          logotipo o rótulo del generador —o usa la zona conocida de cada servicio, una
          región manual o la selección— y lo rellena con estructura + textura de
          alrededor), <i>marcas invisibles</i> (rompe los soportes donde se esconden:
          transformación geométrica subpíxel, remuestreo, ondículas DWT-DCT, coeficientes
          DCT, suavizado y reenfoque, ruido, bits bajos, limpieza espectral y
          recompresión JPEG; y, si configuras tu propio servidor, regeneración por
          difusión) y <i>procedencia</i> (lee lo que declara el archivo —C2PA, XMP con
          «trainedAlgorithmicMedia», EXIF, prompts— y decide qué metadatos salen al
          exportar). Ninguna etapa garantiza nada frente a un detector concreto: mídelo.</li>
        <li id="sp-looks"><b>Estilos…</b> 160 acabados de un clic en 16 categorías: básicos, retrato,
          paisaje, cine, películas, urbano, comida, moda y editorial, redes sociales, blanco
          y negro, noche, estaciones, suaves y pastel, dramáticos, duotonos y creativos y
          vintage. Filtra por categoría o escribe en el buscador; cada miniatura muestra tu
          propia foto con ese estilo, y la intensidad se regula después.</li>
        <li><b>Adaptive Photo Lens…</b> Reconoce el tipo de foto con un modelo local
          (retrato, paisaje, comida…) y aplica el revelado que le va.</li>
        <li><b>Tabla de color (LUT)…</b> Carga un archivo <code>.cube</code> de etalonaje
          —el formato de cine y revelado— y lo aplica en una capa nueva.</li>
      </ul>` },

  { id:"collage", title:"Collage / History / Post",
    desc:"Collages, publicaciones e historias: formatos de redes y móviles, 41 diseños, formas, textos.",
    html:`
      <h3>Collage / History / Post</h3>
      <p>En <b>Archivo</b> o en <b>Filtro › Especiales</b> (y en el cajón del móvil). Funciona
        también sin documento abierto; si hay uno, su imagen entra como primera foto. Al
        pulsar <b>Aplicar</b>, la composición se crea como <b>documento nuevo en otra
        pestaña</b>, con una capa «Fondo», una por foto y una por texto: el documento de
        partida no se toca.</p>
      <ul>
        <li><b>Formato.</b> Redes sociales (29 medidas: Instagram, TikTok, Facebook, X,
          Threads, LinkedIn, YouTube, Pinterest, WhatsApp, Snapchat, Telegram, Twitch,
          Bluesky, Reddit), 15 proporciones (de 1:1 a 4:1), la pantalla de 27 móviles
          conocidos o medidas a mano. Todo en vertical u horizontal con un botón, y con
          resolución del 50 al 200 %.</li>
        <li><b>Zonas seguras.</b> En historias se marca lo que tapa la interfaz de la app;
          en los móviles, la barra de estado, las esquinas y la cámara frontal. Sólo se
          ven en el editor.</li>
        <li><b>Diseños.</b> 40 composiciones de 1 a 16 fotos (cuadrículas, grande +
          pequeñas, mosaico, molinete, diagonales, triángulos, esparcidas…) y
          <b>«Libre»</b>: cada foto es una pieza que se arrastra donde quieras, se escala y
          gira con el tirador de su esquina (o con dos dedos) y se trae delante, se manda
          detrás o se duplica. Con <kbd>Alt</kbd> o <kbd>Mayús</kbd>, arrastrar encuadra la
          foto dentro de su pieza.</li>
        <li><b>Fotos.</b> Añádelas con «Abrir fotos», pegándolas (<kbd>Ctrl</kbd>+<kbd>V</kbd>)
          o soltando archivos. Arrastra una miniatura de la bandeja a un hueco, o toca un
          hueco y luego la foto. En cada hueco: arrastrar encuadra, la rueda o dos dedos
          hacen zoom, y soltar una foto sobre otro hueco las intercambia; girar, voltear
          y centrar están en el panel.</li>
        <li><b>Formas.</b> Las fotos pueden ir dentro de 28 formas —círculo, elipse,
          polígonos de 3 a 10 lados, estrellas de 4 a 10 puntas, corazón, flor, gota,
          escudo, cruz, luna, sello, nube, bocadillo…—, para todas a la vez o cada una la
          suya.</li>
        <li><b>Composición y fondo.</b> Espaciado, margen, esquinas redondeadas, marco y
          sombra de las fotos; fondo de color, degradado, la propia foto difuminada o
          transparente.</li>
        <li><b>Textos.</b> El mismo motor del creador de memes: tipografías, estilos
          rápidos, contornos, sombras, neón, relieve…</li>
      </ul>` },

  { id:"vistas", title:"Ver y análisis visual",
    desc:"Histograma interactivo, cuadrícula inteligente, reglas, guías, comparar, paleta, cuentagotas.",
    html:`
      <h3>Ver y análisis visual</h3>
      <ul>
        <li id="view-histogram"><b>Histograma</b> (Ver o Análisis › Histograma interactivo; panel
          lateral). El histograma RGB de la composición, al día con cada cambio y dividido
          en cinco zonas: Negros, Sombras, Medios, Luces y Blancos. Al pasar por encima
          dice cuánta imagen cae en cada zona y cuánto hay de negro y blanco puro; al
          <b>tocar una zona</b> se abre «Tonos del histograma» con esa franja elegida para
          ajustar sólo esos tonos.</li>
        <li id="view-smartgrid"><b>Cuadrícula inteligente…</b> Guías de composición calculadas a
          partir del contenido:
          <ul>
            <li><b>Sujeto principal</b> (la zona que más destaca, o la cara si la hay), con su
              caja y una flecha al punto fuerte de los tercios más cercano.</li>
            <li><b>Horizonte</b> detectado, cuánto está inclinado y «Enderezar horizonte»,
              que gira la foto lo justo y la amplía para no dejar esquinas vacías.</li>
            <li><b>Rostros</b> y la línea de los ojos (que conviene en el tercio superior).
              Si el navegador no trae detección de caras, se estiman por el tono de piel y
              se marcan como «estimado».</li>
            <li>Guías clásicas: tercios, proporción áurea, <b>espiral áurea orientada hacia
              el sujeto</b>, diagonales y triángulos áureos, centro y simetría.</li>
          </ul>
          El diálogo resume el análisis en palabras y ofrece «Recortar para encuadrar», que
          abre Recortar con el marco ya puesto donde lleva el sujeto a su punto fuerte.
          «Mostrar u ocultar la cuadrícula inteligente» la enciende y apaga sin diálogo.</li>
        <li><b>Reglas, guías y cuadrícula.</b> Arrastra desde una regla para sacar una guía;
          la cuadrícula se configura en tamaño y subdivisiones, y «Ajustar a la cuadrícula»
          hace que lo que mueves se enganche a ella.</li>
        <li><b>Comparar antes/después</b> (también al 100 %) y <b>Mostrar u ocultar
          paneles</b> (<kbd>Tab</kbd>).</li>
        <li id="an-palette"><b>Paleta de colores…</b> (menú Análisis). Los colores dominantes de la
          imagen: tocar uno copia su código y lo pone como color frontal. La paleta se puede
          crear como capa, descargar o copiar.</li>
        <li id="an-eyedropper"><b>Cuentagotas de pantalla</b> (menú Análisis). Coge un color de
          cualquier parte de la pantalla, también fuera de la imagen. Sólo en Chrome y Edge de
          escritorio, que son los navegadores que lo permiten.</li>
      </ul>` },

  { id:"movil", title:"Uso en el móvil",
    desc:"El cajón de herramientas con buscador, la hoja de paneles y los editores a pantalla completa.",
    html:`
      <h3>Uso en el móvil</h3>
      <ul>
        <li><b>Abrir fotos.</b> En Android, «Abrir» va directo a la <b>galería</b>; en iPhone,
          a la fototeca. Los RAW, PSD, TIFF y SVG no suelen salir en la galería: ábrelos con
          <b>Archivo › Abrir RAW, PSD, TIFF o SVG…</b> (o el enlace de la pantalla de inicio), que
          abre el explorador de archivos. En la Fusión HDR, el «+» ofrece Galería o Archivos.</li>
        <li><b>Barra inferior.</b> Abrir, Capas (la hoja de paneles), Exportar, Deshacer,
          Rehacer, Comparar y el Menú con todos los menús de escritorio en una lista.</li>
        <li><b>Cajón de herramientas.</b> Se abre en <b>Básicos</b>: lo que más se usa
          para editar una foto (recortar, luz, color, nitidez, estilos, quitamanchas,
          texto, stickers…), en el orden en que suele hacerse. Los dos primeros, resaltados,
          son la mejora de un toque: <b>Automático</b> (Tono / Color automático en modo color) y
          <b>Auto Premium 👑</b>, que con el diagnóstico de los automáticos equilibra el blanco en
          luz lineal, fija el negro y el blanco, abre las sombras de un contraluz y recupera las
          luces con detalle (Sombras / Iluminaciones Premium), corrige la exposición sólo si hace
          falta, sube el color apagado sin tocar la piel ni el color intenso, y ajusta el
          contraste sólo si la foto está plana. Los dos quedan como
          capa de filtro (también en Ajustes › Automáticos). La segunda pestaña,
          <b>Automáticos</b>, reúne todos los ajustes de un toque: Automático, Auto Premium 👑,
          Tono y color, Tono y color Premium 👑, Contraste, Contraste Premium 👑, Niveles, Niveles Premium 👑, Iluminar foto oscura e Iluminar Premium 👑; en el menú (escritorio y móvil) son el submenú <b>Ajustes › Automáticos</b>. En <b>Todos</b> y en las
          demás categorías (Inteligencia Artificial, Mejorar, Corregir, Color, Estilo, Efectos, Retoque,
          Selección, Pintar, Analizar) están todas las herramientas, ajustes y filtros, en
          orden alfabético. El <b>buscador</b> filtra en tiempo real dentro de la
          categoría abierta (en Básicos, en todo), sin importar tildes ni pequeñas
          erratas. Mientras escribes, el cajón sube y se apoya encima del teclado para que
          veas los resultados; la tecla <b>Buscar</b> cierra el teclado y deja los resultados
          a pantalla completa. Al cerrar el teclado o elegir una herramienta vuelve a su
          tamaño normal. Desliza a los lados para cambiar de categoría. Los diálogos en los que
          se escribe (las medidas de «Documento nuevo», un nombre…) también suben encima del
          teclado mientras escribes, igual que los editores a pantalla completa (Memes, Collage,
          Cámara…); con la herramienta Texto, la imagen sube lo justo para ver lo que escribes.</li>
        <li><b>Móvil en vertical.</b> Realify está pensado para usarse en el móvil en vertical;
          si giras el teléfono aparece un aviso (la versión de escritorio es para ordenador).
          «Seguir en horizontal» lo oculta hasta que cierres la pestaña. En tabletas y
          ordenadores no sale.</li>
        <li><b>Capas a pantalla completa.</b> «Capas» se abre a pantalla completa, como el revelado
          RAW: la imagen lo más grande posible (con dos dedos se amplía y se mueve; tocarla no
          pinta nada), arriba cerrar, nueva capa, duplicar, eliminar, deshacer y rehacer, y abajo
          (a la derecha con el móvil en horizontal) la opacidad, la fusión y la lista, de la que se
          ven dos capas a la vez: desliza para ver el resto. El botón <b>fx</b> o <b>adj</b> de una
          capa abre su editor encima, sin cerrar Capas. El Histograma (menú Ver) y Propiedades se
          abren en esta misma pantalla, con ‹ para volver a Capas.</li>
        <li><b>Editores a pantalla completa</b> (Realify, Filtro Vintage, memes, stickers,
          collage): la imagen primero, y abajo un desplegable para elegir el ajuste y un
          deslizador con botones − y + de tamaño cómodo para el pulgar. Dos dedos hacen
          zoom y giran donde tiene sentido.</li>
        <li><b>Tiradores y pestañas.</b> Con el dedo, los tiradores de recortar, transformar,
          perspectiva, texto y formas son más grandes y se agarran con mucho margen (ver
          <a data-go="mover#tool-handles">Tiradores</a>). Con varias fotos abiertas, el botón
          del final de la barra de pestañas las cierra todas.</li>
        <li><b>Pinceles.</b> La barra de opciones lleva el color frontal y de fondo al
          principio; la simetría, la textura y el color del pincel están en la misma
          barra.</li>
      </ul>` },

  { id:"diagnostico", title:"Diagnóstico",
    desc:"Comprueba WebGL2, shaders y las funciones del navegador que usa la app.",
    html:`
      <h3>Diagnóstico</h3>
      <p>Si algo se ve raro o no responde, esto comprueba una por una las piezas
        de las que depende la página: WebGL2, la precisión del buffer, la
        compilación de cada shader por separado, y las funciones del navegador
        que usan la exportación y el análisis.</p>` },

  { id:"atajos", title:"Atajos de teclado",
    desc:"Todo el teclado que no sea la letra de cada herramienta.",
    html:`
      <h3>Atajos</h3>
      <p>Las teclas de herramienta (Pincel, Mover, Recortar…) están en la letra que
        acompaña a cada una en su propio tema, no aquí: esto es todo lo demás.</p>
      <ul>
        <li><kbd>Espacio</kbd> (mantener) paneo temporal, con cualquier herramienta
          activa</li>
        <li><kbd>D</kbd> restablece frontal/fondo a blanco y negro · <kbd>X</kbd>
          los intercambia</li>
        <li><kbd>[</kbd> <kbd>]</kbd> tamaño de pincel · <kbd>Mayús</kbd>+<kbd>[</kbd>/<kbd>]</kbd>
          dureza —sólo con una herramienta que tenga esas opciones—</li>
        <li>Un dígito (<kbd>0</kbd>–<kbd>9</kbd>) pone la opacidad de la herramienta
          activa; dos seguidos componen el número (<kbd>2</kbd> luego <kbd>5</kbd> → 25 %)</li>
        <li>Con Mover activo, las flechas desplazan 1 px; <kbd>Alt</kbd>+flecha, 10 px</li>
        <li><kbd>Ctrl+Z</kbd> deshacer · <kbd>Ctrl+Mayús+Z</kbd> o <kbd>Ctrl+Y</kbd> rehacer</li>
        <li><kbd>Ctrl+Mayús+D</kbd> Dodge &amp; Burn · <kbd>Ctrl+Mayús+H</kbd> Pincel de historial</li>
        <li><kbd>Ctrl+O</kbd> abrir · <kbd>Ctrl+N</kbd> documento nuevo</li>
        <li><kbd>Ctrl+S</kbd> guardar proyecto · <kbd>Ctrl+Alt+S</kbd> exportar ·
          <kbd>Ctrl+Mayús+S</kbd> exportar PNG rápido</li>
        <li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+X</kbd> / <kbd>Ctrl+V</kbd> copiar, cortar, pegar</li>
        <li><kbd>Ctrl+R</kbd> tamaño de imagen</li>
        <li><kbd>Ctrl+Mayús+N</kbd> nueva capa · <kbd>Ctrl+J</kbd> duplicar capa</li>
        <li><kbd>Ctrl+G</kbd> agrupar capas · <kbd>Ctrl+Mayús+G</kbd> desagrupar</li>
        <li><kbd>Ctrl+E</kbd> combinar hacia abajo · <kbd>Ctrl+Mayús+E</kbd> combinar visibles</li>
        <li><kbd>Ctrl+A</kbd> seleccionar todo · <kbd>Ctrl+D</kbd> deseleccionar ·
          <kbd>Ctrl+Mayús+I</kbd> invertir selección</li>
        <li><kbd>Ctrl+L</kbd> Niveles · <kbd>Ctrl+M</kbd> Curvas —de la máscara en vez
          de la imagen si su miniatura está seleccionada como destino—</li>
        <li><kbd>Ctrl+U</kbd> Tono y saturación · <kbd>Ctrl+I</kbd> Invertir ·
          <kbd>Ctrl+Mayús+U</kbd> Blanco y negro</li>
        <li><kbd>Ctrl+0</kbd> ajustar el zoom a la ventana · <kbd>Ctrl+1</kbd> zoom 100 %
          · <kbd>Ctrl</kbd>+<kbd>+</kbd>/<kbd>-</kbd> acercar/alejar</li>
        <li><kbd>Ctrl+Mayús+1</kbd> comparar antes/después al 100 % de golpe</li>
        <li><kbd>Tab</kbd> mostrar/ocultar los paneles</li>
        <li>En los editores a pantalla completa: <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Mayús+Z</kbd>
          deshacen y rehacen dentro del propio editor, <kbd>Esc</kbd> cancela, <kbd>Supr</kbd>
          borra el elemento elegido y las flechas lo mueven</li>
        <li>La rueda del ratón hace zoom aunque haya un diálogo abierto: el panel se
          puede arrastrar a un lado por su cabecera, y la rueda funciona sobre el
          lienzo que quede visible alrededor —nunca sobre la propia tarjeta, donde
          sigue haciendo scroll normal—.</li>
      </ul>` }
];

/* Dónde vive la explicación de cada herramienta de la barra: el tema
   y el id exacto del <li> al que saltar y resaltar —así el «?» de la
   barra de opciones lleva derecho a la frase que explica ESA
   herramienta, no sólo a la página entera del tema—. Dos herramientas
   que comparten un mismo párrafo (Mano/Zoom, Selección
   rectangular/elíptica) comparten también el mismo anchor. Añadir una
   herramienta nueva a TOOLS (editor/tools.js) sin añadirla aquí deja
   su «?» sin sitio a donde ir —cae al índice general en vez de a su
   explicación—, así que ambas listas deben crecer juntas. */
const TOOL_LINKS = {
  move: ["mover", "tool-move"], crop: ["mover", "tool-crop"],
  transform: ["mover", "tool-transform"], perspective: ["mover", "tool-perspective"],
  brush: ["pintura", "tool-brush"], eraser: ["pintura", "tool-eraser"],
  clone: ["pintura", "tool-clone"], heal: ["pintura", "tool-heal"],
  expose: ["pintura", "tool-expose"], dodgeburn: ["pintura", "tool-dodgeburn"],
  smudge: ["pintura", "tool-smudge"], liquify: ["pintura", "tool-liquify"],
  historyBrush: ["pintura", "tool-historyBrush"],
  "select-rect": ["seleccion", "tool-select-rect"], "select-ellipse": ["seleccion", "tool-select-rect"],
  "select-lasso": ["seleccion", "tool-select-lasso"], "select-wand": ["seleccion", "tool-select-wand"],
  pen: ["seleccion", "tool-pen"], camove: ["seleccion", "tool-camove"],
  fill: ["otras", "tool-fill"], gradient: ["otras", "tool-gradient"], shape: ["otras", "tool-shape"],
  text: ["otras", "tool-text"], picker: ["otras", "tool-picker"],
  pan: ["otras", "tool-pan"], zoom: ["otras", "tool-pan"], compare: ["otras", "tool-compare"]
};

function findTopic(id){ return TOPICS.find(t => t.id === id); }

/* ── Búsqueda en toda la guía ────────────────────────────────────
   Cada entrada (<li> o <p>) de cada tema es un resultado posible. Se
   busca sin tildes, sin mayúsculas y con todas las palabras (en
   cualquier orden); un resultado lleva a su tema y resalta el párrafo
   exacto. Las entradas sin id reciben uno automático, el mismo al
   pintar el tema y al indexarlo. */
const fold = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function withIds(html, prefix){
  let n = 0;
  return html.replace(/<(li|p)(\s[^>]*)?>/g, (m, tag, attrs = "") => /\sid=/.test(attrs) ? m : `<${tag} id="${prefix}-${++n}"${attrs}>`);
}
let searchIndex = null;
function buildIndex(){
  if(searchIndex) return searchIndex;
  searchIndex = [];
  const add = (path, title, html) => {
    const d = document.createElement("div");
    d.innerHTML = withIds(html, path.replace("/", "-"));
    for(const el of d.querySelectorAll("li, p")){
      // Un <li> con sublista: su propio texto sin el de los hijos repetido
      const own = el.cloneNode(true); own.querySelectorAll("ul, li").forEach(x => x.remove());
      const text = (own.textContent || "").replace(/\s+/g, " ").trim();
      if(text.length < 12) continue;
      // Se busca en todo su texto (sublistas incluidas); se enseña el suyo propio
      const all = (el.textContent || "").replace(/\s+/g, " ").trim();
      const head = (el.querySelector(":scope > b, :scope > a")?.textContent || text.slice(0, 60)).replace(/\s+/g, " ").replace(/[.:]\s*$/, "").trim();
      searchIndex.push({ path, anchor: el.id, topic: title, head, text, key: fold(all) });
    }
  };
  for(const t of TOPICS){
    if(t.sub) for(const s of t.sub) add(t.id + "/" + s.id, t.title + " › " + s.title, s.html);
    else add(t.id, t.title, t.html);
  }
  return searchIndex;
}
const escapeHtml = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function renderResults(q){
  const words = fold(q).split(/\s+/).filter(Boolean);
  if(!words.length) return "";
  const hits = buildIndex().filter(e => words.every(w => e.key.includes(w)))
    .map(e => ({ e, score: words.reduce((s, w) => s + (fold(e.head).includes(w) ? 3 : 0) + (fold(e.topic).includes(w) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score).slice(0, 40);
  if(!hits.length) return `<p class="guide-empty">Nada coincide con «${escapeHtml(q)}». Prueba con otra palabra.</p>`;
  const snippet = (text) => {
    const k = fold(text), i = Math.max(0, k.indexOf(words[0]) - 50);
    let out = escapeHtml((i ? "…" : "") + text.slice(i, i + 170) + (text.length > i + 170 ? "…" : ""));
    return out;
  };
  return `<div class="guide-index">${hits.map(({ e }) => `<button class="guide-row" data-go="${e.path}#${e.anchor}">
    <span class="guide-row-title">${escapeHtml(e.head)} <small>· ${escapeHtml(e.topic)}</small></span>
    <span class="guide-row-desc">${snippet(e.text)}</span></button>`).join("")}</div>`;
}

function indexRow(go, title, desc){
  return `<button class="guide-row" data-go="${go}">
    <span class="guide-row-title">${title}</span>
    <span class="guide-row-desc">${desc}</span>
  </button>`;
}

function renderIndex(){
  return `<input type="search" class="guide-search" placeholder="Buscar en la guía (p. ej. «curvas», «trozos», «simetría»)…" aria-label="Buscar en la guía">
    <div class="guide-results"></div>
    <div class="guide-home">` + INTRO + `<div class="guide-index">` +
    TOPICS.map(t => indexRow(t.id, t.title, t.desc)).join("") +
    `</div></div>`;
}

function renderTopic(t){
  if(t.sub){
    return `<button class="guide-back" data-back="index">← Índice</button>
      <h3 style="margin-top:0">${t.title}</h3>
      <div class="guide-index">${t.sub.map(s => indexRow(t.id + "/" + s.id, s.title, s.desc)).join("")}</div>`;
  }
  return `<button class="guide-back" data-back="index">← Índice</button>` + withIds(t.html, t.id);
}

function renderSub(t, s){
  return `<button class="guide-back" data-back="${t.id}">← ${t.title}</button>` + withIds(s.html, t.id + "-" + s.id);
}

/* `startPath`/`startAnchor` dejan abrir la guía YA en un tema
   concreto —y, con `startAnchor`, saltar y resaltar un <li> exacto
   dentro de él— en vez de siempre en el índice: es lo que usa el «?»
   de la barra de opciones (ver openGuideForTool más abajo), pero
   sirve para cualquier enlace directo a una explicación puntual. */
export function openGuide(startPath, startAnchor){
  const wrap = document.createElement("div");
  wrap.className = "guide";

  const nav = (path, anchor) => {
    let html;
    if(path === "index"){
      html = renderIndex();
    } else {
      const [tid, sid] = path.split("/");
      const t = findTopic(tid);
      html = !t ? renderIndex()
           : sid && t.sub ? (t.sub.find(s => s.id === sid) ? renderSub(t, t.sub.find(s => s.id === sid)) : renderIndex())
           : renderTopic(t);
    }
    wrap.innerHTML = html;
    wrap.closest(".modal-body")?.scrollTo(0, 0);
    if(!anchor) return;
    // Un frame para que el nuevo contenido ya esté en el DOM antes de
    // medir dónde desplazarse.
    requestAnimationFrame(() => {
      const el = wrap.querySelector("#" + anchor);
      if(!el) return;
      el.scrollIntoView({ block:"center", behavior:"smooth" });
      el.classList.add("guide-hit");
      setTimeout(() => el.classList.remove("guide-hit"), 1600);
    });
  };

  wrap.addEventListener("click", e => {
    const go = e.target.closest("[data-go]");
    if(go){
      e.preventDefault();
      const [path, anchor] = go.dataset.go.split("#");
      nav(path, anchor);
      return;
    }
    const back = e.target.closest("[data-back]");
    if(back) nav(back.dataset.back);
  });

  // Buscador del índice: en cuanto hay texto, los resultados sustituyen
  // a la portada; al vaciarlo, vuelve el índice de temas.
  wrap.addEventListener("input", e => {
    if(!e.target.matches(".guide-search")) return;
    const q = e.target.value;
    wrap.querySelector(".guide-results").innerHTML = renderResults(q);
    wrap.querySelector(".guide-home").hidden = !!q.trim();
  });
  wrap.addEventListener("keydown", e => {
    if(e.key === "Enter" && e.target.matches(".guide-search")){
      const first = wrap.querySelector(".guide-results [data-go]");
      if(first){ e.preventDefault(); first.click(); }
    }
  });

  nav(startPath || "index", startAnchor);

  return dialog({
    title: "Guía",
    wide: true,
    body: wrap,
    buttons: [{ label:"Cerrar", primary:true }]
  });
}

/* Abre la guía derecho en la explicación de una herramienta de la
   barra —el «?» de la barra de opciones (ui/optionsbar.js) llama a
   esto con el id de la herramienta activa—. Sin entrada en
   TOOL_LINKS (una herramienta nueva que aún no se ha documentado ahí)
   cae al índice general en vez de fallar. */
export function openGuideForTool(toolId){
  const link = TOOL_LINKS[toolId];
  return openGuide(link ? link[0] : "index", link ? link[1] : undefined);
}
