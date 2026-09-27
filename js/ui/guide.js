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
  { id:"pintura", title:"Pintura y retoque",
    desc:"Pincel, clonar, eliminar manchas, Exponer, Dodge &amp; Burn, licuar, pincel de historial.",
    html:`
      <h3>Herramientas de pintura y retoque</h3>
      <ul>
        <li id="tool-brush"><b>Pincel (B).</b> Pinta con el color, tamaño, dureza y opacidad del panel.
          «Pinceles…» abre las puntas —incluidas imágenes y archivos ABR—, flujo,
          espaciado, dispersión, ángulo, suavizado, simetría y las dinámicas por presión,
          velocidad o dirección. Si la capa activa tiene una máscara seleccionada como
          destino, pinta en la máscara en vez de en el color.</li>
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
          sin mezclarla con la primera.</li>
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
          que se ejecuta en el propio equipo (BodyPix) —nada sale de la foto—: detecta a
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
          para soltar una guía; se puede volver a arrastrar o borrar sobre la marcha
          igual que en cualquier editor de imagen. Las herramientas de selección
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
    desc:"Tamaño de lienzo, eliminar fondo, reemplazar cielo.",
    html:`
      <h3>Imagen (menú Imagen)</h3>
      <ul>
        <li><b>Tamaño de imagen…</b> (<kbd>Ctrl</kbd>+<kbd>R</kbd>). Cambia las
          dimensiones del lienzo, en píxeles o en porcentaje, con remuestreo de
          calidad; distinto de Recortar, que quita parte de la imagen en vez de
          reescalarla entera.</li>
        <li><b>Eliminar fondo…</b> Detecta el color conectado a los bordes de la
          capa y lo convierte en una máscara editable —no borra píxeles de forma
          irreversible—, con «Tolerancia» (cuánto puede variar el color y seguir
          contando como fondo) y «Suavizar borde». Funciona mejor con fondos
          razonablemente uniformes; pide una capa sin máscara ya puesta.</li>
        <li><b>Reemplazar cielo…</b> Detecta el cielo con IA (el mismo modelo que
          «Seleccionar cielo») y deja el reemplazo —color liso, degradado o una foto
          propia, con «Desvanecer borde» para que el corte no se note— en una capa
          nueva con su propia máscara, encima de la original intacta.</li>
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
          seguir editándola. Además del cuerpo, la fuente, el color, la sombra, el
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
    desc:"Brillo/contraste, niveles, curvas, balance de blancos, color avanzado, B/N.",
    html:`
      <h3>Ajustes (menú Ajustes)</h3>
      <ul>
        <li><b>Brillo y contraste.</b> El control más directo: sube o baja la luz
          general y separa claros de oscuros.</li>
        <li><b>Exposición.</b> Simula lo que hace una cámara: multiplica la luz en
          espacio lineal (un paso completo dobla o parte por dos la luz de toda la
          foto por igual), con Desplazamiento para un empujón fijo —más visible en
          sombras— y Gamma para curvar el resultado.</li>
        <li><b>Niveles.</b> Fija el punto negro, el blanco y el gris medio a partir del
          histograma; es lo primero que conviene tocar en una foto plana. Cada canal
          (RGB, Rojo, Verde, Azul) guarda sus propios valores por separado —cambiar de
          canal en el desplegable no pierde lo ya ajustado en el anterior—, y el
          maestro RGB se aplica encima de los tres, igual que en Curvas.</li>
        <li><b>Curvas.</b> Como Niveles pero con control punto a punto de toda la
          gama tonal, para correcciones que un simple negro/blanco/gris no resuelve.</li>
        <li><b>Sombras / Iluminaciones.</b> Distinto de Tonos: aquí cada píxel se
          corrige según el brillo MEDIO de su alrededor, no el suyo propio, así que un
          contraluz se abre sin aplanar el resto de la foto y un ojo oscuro en una cara
          iluminada no se trata como sombra. Radio decide el tamaño de ese entorno;
          Tono, lo ancha que es la transición.</li>
        <li><b>Balance de blancos.</b> Corrige un dominante de color (una foto
          demasiado azul o demasiado naranja) para que el blanco se vea blanco.</li>
        <li><b>Tonos (blancos/luces/sombras/negros).</b> Cuatro mandos por zona
          tonal, más simple que Curvas cuando sólo hace falta aclarar sombras o
          recuperar luces.</li>
        <li><b>Tono y saturación.</b> Matiz, saturación y luminosidad de toda la
          imagen; «Colorear» la tiñe entera de un solo tono.</li>
        <li><b>Vibrance.</b> Sube la saturación de los colores apagados más que la de
          los que ya son vivos —y protege un poco los tonos de piel—, distinto de la
          saturación llana de Tono y saturación.</li>
        <li><b>Color avanzado (submenú).</b>
          <ul>
            <li><b>Color por canales.</b> El HSL de un revelador serio: rojos,
              amarillos, verdes, cianes, azules y magentas, cada uno con su propio
              matiz, saturación y luminosidad, más un maestro para toda la foto.</li>
            <li><b>Equilibrio de color.</b> Cian-Rojo, Magenta-Verde y Amarillo-Azul
              por separado en Sombras, Medios e Iluminaciones, con «Conservar la
              luminosidad» para que el tinte no aclare ni oscurezca la foto de paso.</li>
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
        <li><b>Blanco y negro.</b> Modo manual (mezcla de canales a mano) o
          automático, con dieciocho estilos con nombre propio y miniatura, cada uno
          inspirado en una manera distinta de revelar en blanco y negro —de un
          filtro rojo clásico a una simulación de infrarrojo o un cartel de alto
          contraste sin grano—.</li>
        <li><b>Invertir, Contraste automático, Niveles automáticos.</b> Un solo clic,
          sin panel: invierte los colores, o estira el contraste/los niveles hasta los
          percentiles 0,2 % más oscuro y más claro del histograma de la propia imagen
          —«Contraste automático» mira sólo el brillo y deja el balance de color
          intacto; «Niveles automáticos» estira cada canal R, G y B por separado, así
          que además neutraliza una dominante de color—. Cuanto más plana o con más
          neblina esté la foto, más se nota: es justo el caso para el que existen.</li>
      </ul>` },

  { id:"filtros", title:"Filtros (menú Filtro)",
    desc:"Realify, PurePixel, Unmark, estilos, LUT, desenfoque, retoque, viñeteado…",
    html:`
      <h3>Filtros (menú Filtro)</h3>
      <ul>
        <li><b>Realify.</b> La simulación de cámara completa: ver el tema «Realify ·
          simulación de captura», en el índice.</li>
        <li><b>PurePixel.</b> Suaviza residuos finos de luminancia y color y añade
          textura controlada; experimental, no garantiza nada frente a un detector.</li>
        <li><b>Unmark.</b> Tres secciones en un panel: <i>marcas visibles</i> (detecta el
          logotipo o rótulo del generador —o usa la zona conocida de cada servicio, una
          región manual o la selección— y lo rellena con estructura + textura de
          alrededor), <i>marcas invisibles</i> (rompe los soportes donde se esconden:
          transformación geométrica subpíxel, remuestreo, ondículas DWT-DCT, coeficientes
          DCT, suavizado y reenfoque, ruido, bits bajos, limpieza espectral y
          recompresión JPEG; y, si configuras tu propio servidor, regeneración por
          difusión) y <i>procedencia</i> (lee lo que declara el archivo —C2PA, XMP con
          «trainedAlgorithmicMedia», EXIF, prompts— y decide qué metadatos salen al
          exportar). Con dosis, presets, semilla, «Ajuste recomendado» y vista previa
          con las zonas marcadas. Ninguna etapa garantiza nada frente a un detector
          concreto: mídelo.</li>
        <li><b>Estilos.</b> Treinta acabados de un clic (vintage, película, look de
          laboratorio…), con miniatura para comparar antes de aplicar.</li>
        <li><b>Tabla de color (LUT).</b> Carga un archivo <code>.cube</code> de
          etalonaje —el mismo formato que usan cine y revelado— y lo aplica en una capa
          nueva.</li>
        <li><b>Desenfoque gaussiano / Enfocar / Enfoque selectivo.</b> Suavizar,
          endurecer o endurecer sólo el detalle fino sin tocar las zonas planas.</li>
        <li><b>Reducción de ruido.</b> Aplana el grano conservando los bordes, para
          fotos con ISO alto o muy comprimidas.</li>
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
          cielo» —la misma detección por IA del menú Selección—, útiles
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
        <li><b>Crear meme…</b> Añade el texto superior e inferior en mayúsculas con
          borde negro, al estilo clásico de meme.</li>
        <li><b>Añadir marca de agua…</b> Coloca un texto o logo semitransparente
          repetido o en una esquina, en una capa aparte.</li>
      </ul>` },

  { id:"archivo", title:"Archivo y documentos",
    desc:"Abrir, guardar, exportar, procesar por lotes, varios documentos a la vez.",
    html:`
      <h3>Archivo</h3>
      <ul>
        <li><b>Abrir imagen / Abrir proyecto / Guardar proyecto.</b> Un proyecto
          guarda todas las capas, máscaras e historial tal cual, para seguir editando
          otro día; una imagen abierta directamente empieza como una sola capa.</li>
        <li><b>Exportar… / Exportar PNG rápido.</b> El primero deja elegir formato,
          calidad y metadatos EXIF; el segundo entrega un PNG sin preguntar nada.</li>
        <li><b>Prueba para redes sociales…</b> Muestra cómo queda la imagen tras la
          recompresión que aplican Instagram, WhatsApp, Facebook o X, antes de
          publicarla de verdad.</li>
        <li><b>Procesar carpeta…</b> Aplica los mismos ajustes a muchas imágenes de
          una vez; ver «Lotes», dentro de «Realify · simulación de captura».</li>
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
          Cerrar documento».</li>
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
            que ese ruido debería tener.</p>` },

      { id:"lotes", title:"Lotes",
        desc:"Procesar una carpeta entera, con variación automática entre archivos.",
        html:`
          <h3>Lotes</h3>
          <p>«Procesar carpeta» aplica la cadena entera a todas las imágenes que
            selecciones. Con «Variar cada una», cada archivo sale con sus parámetros
            desviados y su propia semilla: veinte salidas idénticas en configuración
            comparten firma, y eso es exactamente lo que se quiere evitar. Las fechas EXIF
            del lote caen a minutos unas de otras, como una sesión real, en vez de
            repartidas por tres años.</p>
          <p>Por defecto se entrega todo en un ZIP. La alternativa —una descarga por
            archivo— obliga a esperar entre una y otra porque el navegador estrangula las
            descargas seguidas, y con cien imágenes son casi veinte segundos de pura
            espera. Si el lote pasa de 1,5 GB se cambia solo a descargas sueltas, porque el
            ZIP se construye en memoria.</p>` }
    ] },

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

function indexRow(go, title, desc){
  return `<button class="guide-row" data-go="${go}">
    <span class="guide-row-title">${title}</span>
    <span class="guide-row-desc">${desc}</span>
  </button>`;
}

function renderIndex(){
  return INTRO + `<div class="guide-index">` +
    TOPICS.map(t => indexRow(t.id, t.title, t.desc)).join("") +
    `</div>`;
}

function renderTopic(t){
  if(t.sub){
    return `<button class="guide-back" data-back="index">← Índice</button>
      <h3 style="margin-top:0">${t.title}</h3>
      <div class="guide-index">${t.sub.map(s => indexRow(t.id + "/" + s.id, s.title, s.desc)).join("")}</div>`;
  }
  return `<button class="guide-back" data-back="index">← Índice</button>` + t.html;
}

function renderSub(t, s){
  return `<button class="guide-back" data-back="${t.id}">← ${t.title}</button>` + s.html;
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
    if(go){ nav(go.dataset.go); return; }
    const back = e.target.closest("[data-back]");
    if(back) nav(back.dataset.back);
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
