/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «pintura»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const pinturaTopic = { id:"pintura", title:"Pintura y retoque",
    desc:"Pincel (simétrico, con textura, de degradado), clonar, manchas, Exponer, Dodge &amp; Burn, licuar…",
    html:`
      <h3>Herramientas de pintura y retoque</h3>
      <ul>
        <li id="tool-brush"><b>Pincel (B).</b> Pinta con el color, tamaño, dureza y opacidad del panel.
          «Pinceles…» abre las puntas —incluidas imágenes y archivos ABR—, flujo,
          espaciado, dispersión, ángulo, suavizado, simetría y las dinámicas por presión,
          velocidad o dirección. En escritorio, <kbd>Alt</kbd>+botón derecho y arrastrar
          horizontal cambia el tamaño; vertical cambia la dureza, como en Photoshop.
          El gesto vale también para borrador, clonar y herramientas de retoque compatibles.
          Si la capa activa tiene una máscara seleccionada como
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
      </ul>` };
