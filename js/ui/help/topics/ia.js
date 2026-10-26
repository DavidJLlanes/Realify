/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «ia»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const iaTopic = { id:"ia", title:"Inteligencia Artificial (menú)",
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
        <li><b>Profundidad:</b> Desenfoque por profundidad 👑, Niebla por distancia 👑, Luz por profundidad 👑, Separar planos 👑 y Foto 3D 👑 (y Seleccionar por profundidad 👑 en «Seleccionar»).</li>
        <li><b>Mejorar y restaurar:</b> Ampliar con IA, Reducción de ruido con IA, Quitar
          artefactos JPEG con IA, Iluminar con IA 👑, Colorear con IA y Adaptive Photo Lens.</li>
        <li><b>Para imágenes de IA</b> (trabajan con imágenes generadas por IA): Realify,
          PurePixel, Unmark, Plausibilidad, Segunda opinión y Limpiar metadatos.</li>
      </ul>
      <p><b>Resolución completa.</b> Los modelos trabajan a un tamaño fijo (unos 512 px). En
        fotos grandes, la profundidad y las máscaras de cielo y de persona se calculan además
        <b>por bloques</b>: una pasada de la foto entera da la escena y los bloques, a más
        resolución, el detalle fino (ramas, pelo, farolas, cables) sin costuras. En las caras
        mayores que el modelo se conserva la nitidez real de la foto. Mientras trabaja verás
        «bloque 3 de 9» y un botón <b>Cancelar</b> que para toda la operación.</p>
      <p>Los modelos funcionan en tu equipo (WebGPU si el navegador la tiene; si no, en la CPU)
        y los grandes se descargan la primera vez, avisando antes del tamaño; en
        <b>Ayuda › Diagnóstico</b> ves los que tienes guardados y puedes borrarlos.</p>
      <p id="ia-mezcla"><b>Porcentaje de aplicación.</b> Las herramientas de IA que dejan una capa del
        mismo tamaño que la foto (caras, borrador mágico, profundidad, colorear, cielo, ruido y JPEG con
        IA…) llevan en su fila del panel de capas el deslizador «mezcla»: 100 % es el resultado de la IA
        y 0 % la foto original, sin volver a ejecutar la IA. Las que cambian el tamaño (Ampliar,
        Expandir) no lo llevan.</p>
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
          aparece en las sombras. Es <b>automático</b>: mide la exposición y usa sólo la parte de
          la curva que hace falta para que la luz media llegue a un nivel natural; una foto que ya
          está bien expuesta no cambia. <b>Intensidad</b> lo gradúa de 0 a 150 % (100 % = automático). Queda como capa que puedes
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
          que se destapa con el fondo, y la guarda como <b>GIF</b>: en el iPhone, «Crear GIF» y luego
          «Guardar» (en la hoja del sistema, «Guardar imagen» la deja en Fotos); en Android y en el
          ordenador se descarga.</li>
        <li id="ia-depth-tools"><b>Seleccionar por profundidad 👑</b> (Inteligencia Artificial › Seleccionar, y
          Capa › Máscara de capa › Por profundidad). Elige el <b>primer plano</b>, el <b>plano medio</b>,
          el <b>fondo</b> (tercios de la foto por cantidad de píxeles) o un <b>intervalo manual</b>
          Desde–Hasta (0 % = lo más cercano); también puedes <b>tocar la imagen</b> para elegir la
          distancia de ese punto. <b>Suavidad</b> difumina el paso entre zonas e <b>Invertir</b> elige
          lo contrario. «Ver» alterna la selección sobre la foto y el mapa de profundidad. El resultado
          es una <b>selección</b> o la <b>máscara de la capa</b> (de imagen o de ajuste: así haces un
          ajuste local según la distancia); se calcula a tamaño real, con el borde ajustado a la
          foto, y es un solo paso de historial. En las propiedades de una máscara, el botón
          «Por profundidad 👑» hace lo mismo sobre esa capa. Esa máscara es <b>viva</b>: recuerda
          cómo se hizo y, si cambias la foto que hay debajo (o la apagas y vuelves a encenderla), se
          <b>recalcula sola</b> tras un momento sin tocar nada; en las propiedades de la máscara puedes
          quitar «mantener al día», pulsar «Actualizar ahora» o «Dejar fija». Se guarda en el proyecto.</li>
        <li><b>Luz por profundidad 👑.</b> Sube o baja la luz según la distancia: <b>Lo cercano</b> y
          <b>Lo lejano</b> en pasos EV, <b>Punto de giro</b> (toca la imagen para ponerlo) y
          <b>Transición</b>. Se aplica en luz lineal con un hombro suave, así que las luces no se
          recortan de golpe ni cambia el tono; capa nueva.</li>
        <li><b>Separar planos 👑.</b> Reparte la foto en 2, 3 o 4 planos y crea una capa por plano
          con su máscara (acumulativa: cada capa se ve en su plano y en los más cercanos, y la de
          atrás va sin máscara), para retocar el primer plano y el fondo por separado. Con las capas
          sin tocar, la foto queda igual que la original. Un solo paso de historial.</li>
      </ul>` };
