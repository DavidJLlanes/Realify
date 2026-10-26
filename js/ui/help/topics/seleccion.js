/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «seleccion»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const seleccionTopic = { id:"seleccion", title:"Selección",
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
        <li id="sel-text"><b>Seleccionar por texto Premium 👑.</b> Escribe lo que quieres —«persona»,
          «cielo», «coche rojo», «césped sin personas», «árboles y montañas»— y sale una selección (o la
          máscara de la capa), editable como cualquier otra. Reconoce <b>150 tipos de cosas</b> (con nombres y
          sinónimos en español: pared, edificio, cielo, árbol, césped, persona, coche, mesa, silla, agua,
          montaña, flor, bicicleta, semáforo…) y <b>colores</b> (rojo, azul, verde, blanco, negro…) que
          dejan sólo los píxeles de ese color dentro de la cosa. «Sin X» resta. Se calcula en tu equipo,
          por bloques, con el borde ajustado a los contornos de la foto. También entiende <b>partes de la
          cara</b>: pelo, cara, piel, ojos, cejas, nariz, boca, labios, orejas, cuello, gafas y sombrero
          («pelo», «ojos y labios»; descarga una vez el modelo BiSeNet, de uso no comercial). Lo que no esté en
          esas categorías se busca con <b>IA de descripción libre</b> (CLIPSeg: «una taza azul con un dibujo»,
          «el logo», «la bufanda roja»; descarga una vez 273 MB, avisando antes; va mejor con palabras corrientes
          o en inglés; los objetos pequeños —un semáforo, una señal— se buscan aparte con mosaicos más finos si no se ven claros a la
          primera, algo más lento). Se encuentra también en Capa ›
          Máscara de capa › «Por texto».</li>
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
      </ul>` };
