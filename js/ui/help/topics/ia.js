/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «ia»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const iaTopic = { id:"ia", title:"Inteligencia Artificial (menú)",
    desc:"Selección con un toque, Borrador mágico, caras y profundidad 👑, fondo, ampliar, colorear, expandir, cielo, ruido, Realify, Unmark…",
    html:`
      <h3>Inteligencia Artificial (menú Inteligencia Artificial)</h3>
      <p>Todas las herramientas de IA están juntas en este menú (tras Filtro), agrupadas en <b>submenús</b>. En el móvil
        están en la pestaña <b>Inteligencia Artificial</b> del cajón (la tercera, tras Básicos y Automáticos), que tiene una
        segunda fila de <b>chips</b> con los mismos submenús, en el mismo orden (el chip elegido se recuerda; al buscar se
        busca en todos). En el menú ☰ aparecen igual, con un título por submenú. Un submenú sin herramientas listas no se
        muestra:</p>
      <ul>
        <li><b>Seleccionar:</b> Selección con un toque 👑, Seleccionar sujeto, Seleccionar cielo, Seleccionar por texto 👑,
          Seleccionar por profundidad 👑 y Seleccionar partes 👑.</li>
        <li><b>Borrar y rellenar:</b> Borrador mágico 👑, Eliminar fondo y Expandir con IA.</li>
        <li><b>Retrato:</b> Difuminar caras 👑, Retoque de cara 👑, Restaurar caras 👑, Ojos rojos 👑, Arrugas 👑, Ojeras y bolsas 👑, Brillos de la piel 👑, Textura de piel 👑, Imperfecciones y tono 👑, Luz en la cara 👑, Ojos 👑, Labios y cejas 👑, Dientes 👑, Cabello 👑, Pelos sueltos 👑, Reflejos en gafas 👑 y Forma de la cara 👑.</li>
        <li><b>Cuerpo:</b> Editor de cuerpo 👑, Silueta y proporciones 👑, Postura 👑, Definición y tono 👑 y Piel del cuerpo 👑.</li>
        <li><b>Escena y cielo:</b> Reemplazar cielo y Adaptive Photo Lens.</li>
        <li><b>Profundidad:</b> Desenfoque por profundidad 👑, Niebla por distancia 👑, Luz por profundidad 👑, Separar planos 👑 y Foto 3D 👑.</li>
        <li><b>Mejorar y restaurar:</b> Ampliar con IA, Reducción de ruido con IA, Quitar
          artefactos JPEG con IA, Iluminar con IA 👑 y Colorear con IA.</li>
        <li><b>Encuadre y composición:</b> Recorte inteligente para redes 👑 y Recorte de retrato 👑.</li>
        <li><b>Realismo y autenticidad</b> (trabajan con imágenes generadas por IA): Realify, Realify Premium 👑,
          PurePixel, Unmark, Plausibilidad, Segunda opinión y Limpiar metadatos.</li>
      </ul>
      <p>Irán llegando más submenús (Ropa y tejidos, Color y estilos, Lote y biblioteca, Asistente) a medida que
        tengan herramientas.</p>
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
        <li id="ia-parts"><b>Seleccionar partes 👑</b> (Inteligencia Artificial › Seleccionar, y en la pestaña Selección del
          cajón). Elige una parte de la persona —pelo, cara, piel, ropa (toda, de arriba, pantalón, falda, vestido), cinturón,
          zapatos, brazos, piernas, gafas, sombrero, bolso, bufanda o la persona entera— y la IA la deja como <b>selección</b> o como
          <b>máscara de la capa activa</b>. Si hay varias personas, eliges una o todas; «Suavidad del borde» ajusta la transición.
          Usa RTMPose (pose) y SegFormer (partes); la primera vez descarga los modelos (unos 82 MB en total) y todo se hace en tu
          equipo. No separa cuello ni orejas: para eso, «Seleccionar por texto».</li>
        <li id="ia-piel"><b>Retoque de piel 👑</b> (Inteligencia Artificial › Retrato, y en la pestaña Retoque del cajón):
          <b>Arrugas</b>, <b>Ojeras y bolsas</b>, <b>Brillos de la piel</b>, <b>Textura de piel</b> e <b>Imperfecciones y tono</b>.
          Cada una abre el <b>editor de cara</b> a pantalla completa, con zoom en la cara (si hay varias, eliges cuál arriba), con los
          mandos de las cinco en grupos: sube el que quieras y la vista previa cambia al momento («Antes» compara). Todo conserva la
          textura real de la piel; ojos, cejas y labios no se tocan. Al aplicar, el resultado va a una <b>capa nueva</b> con «mezcla»
          (porcentaje de aplicación). <i>Textura de piel</i> es ideal para imágenes de IA demasiado lisas: sólo añade poros donde faltan.</li>
        <li id="ia-retrato2"><b>Retoque de cara II 👑</b> (Inteligencia Artificial › Retrato): <b>Luz en la cara</b>, <b>Ojos</b>, <b>Labios y cejas</b>,
          <b>Dientes</b>, <b>Cabello</b>, <b>Pelos sueltos</b>, <b>Reflejos en gafas</b> y <b>Forma de la cara</b> (mandíbula, mentón, anchura, nariz, tamaño de los ojos y grosor de los labios, con cambios pequeños). Usan el mismo editor de cara que el retoque de piel:
          cada función abre su grupo, pero puedes saltar a cualquier otro y todo se aplica junto en una capa nueva. La luz descarga un
          modelo de profundidad la primera vez. Los cambios son sutiles a propósito para que la cara siga pareciendo real.</li>
        <li id="ia-cuerpo"><b>Editor de cuerpo 👑</b> (Inteligencia Artificial › Cuerpo, y en la pestaña Retoque del cajón): <b>Editor de cuerpo</b>,
          <b>Silueta y proporciones</b>, <b>Postura</b>, <b>Definición y tono</b> y <b>Piel del cuerpo</b>. Todas abren el mismo editor a pantalla completa, con zoom
          en la persona (si hay varias, eliges cuál arriba). Eliges el <b>perfil</b> (hombre, mujer, niño o niña): el perfil infantil sólo tiene los mandos que
          le corresponden (altura, proporciones, hombros, brazos, piernas y postura, con rangos reducidos) y no tiene pecho, caderas, glúteos ni definición.
          Si las proporciones sugieren un menor, el editor parte del perfil infantil. Deforma sin pliegues, deja quieto el fondo lejano y cada persona va a su
          <b>capa nueva</b> (transparente donde no cambia, con «mezcla»). Necesita ver los hombros: en un retrato a medio cuerpo funcionan la cabeza, el cuello,
          los hombros, el torso alto y los brazos. «Definición» sólo realza la luz y la sombra que ya hay: no genera piel ni músculos.</li>
        <li id="ia-ropa"><b>Ropa y tejidos 👑</b> (Inteligencia Artificial › Ropa y tejidos, y en la pestaña Retoque del cajón): <b>Planchar arrugas de ropa</b>,
          <b>Arrugas de telas y fondos</b>, <b>Cambiar color de prendas</b> y <b>Textura de tejido</b>. Las cuatro abren el mismo editor a pantalla completa, con zoom
          en la prenda y los grupos Planchar, Color, Textura y Telas y fondos. <i>Planchar</i> aplana el sombreado de los pliegues y conserva la trama del tejido; las rayas
          y los estampados no se tocan porque se distinguen de una arruga por el cambio de <i>color</i>. <i>Color</i> gira el tono en OKLab conservando sombras y brillos; con el
          «Tinte» también se colorea una prenda blanca, gris o negra. <i>Textura</i> realza o apaga la trama y rellena las zonas que quedaron demasiado lisas. En
          <i>Telas y fondos</i> tocas una sábana, cortina o mantel (con «Ajustar el borde con IA» se apoya en Segment Anything) y puedes sumar o quitar zonas con más
          toques. El resultado va a <b>una capa nueva</b> con transparencia: sólo cambia la tela.</li>
        <li id="ia-escena"><b>Escena, cielo y color 👑</b> (Inteligencia Artificial › Escena y cielo, y en las pestañas Mejorar y Color del cajón): <b>Mejorar cielo</b> (realce,
          relleno azul de los cielos apagados conservando las nubes y luz del primer plano), <b>Quitar neblina con IA</b> (usa la distancia de cada punto), <b>Realzar por tipo</b> (agua,
          follaje, cielo, edificios o piel), <b>Balance de blancos por zonas</b> (luz mezclada), <b>Recuperar luces</b> (canales quemados) y <b>Unificar iluminación</b> (acerca el sujeto
          al color y la luz del fondo). En Profundidad: <b>Aberración por distancia</b> y <b>Luz direccional con relieve</b>. Todas son diálogos simples con pocos mandos y el resultado
          va a una capa nueva con «mezcla». «Reemplazar cielo» y «Adaptive Photo Lens» siguen en este mismo submenú.</li>
        <li id="ia-restaurar"><b>Restaurar y limpiar 👑</b> (Inteligencia Artificial › Mejorar y restaurar, y en las pestañas Mejorar y Corregir del cajón): <b>Quitar desenfoque</b>
          (movimiento o fuera de foco; mide el ángulo y el tamaño en tu foto o los pones tú, y frena los halos), <b>Polvo y motas del sensor</b> (detecta manchas pequeñas y oscuras
          sobre zonas lisas y las rellena con su entorno) y <b>Moiré y bandas</b> (busca picos periódicos en el espectro y los atenúa). Además, <i>Reducción de ruido</i> tiene
          ahora «Limpiar para Realify»: mide el ruido de la foto y lo quita con un filtro guiado antes de añadir el grano propio de sensor. No usan modelos: son algoritmos propios en luz lineal.</li>
        <li id="ia-composicion"><b>Objetos y composición 👑</b>: <b>Pincel inteligente</b> (Inteligencia Artificial › Seleccionar): pintas por encima de un objeto y la selección se pega a sus bordes;
          «Quitar» excluye partes. <b>Borrado ligero</b> (Borrar y rellenar): pintas lo que sobra y se rellena en una capa nueva. <b>Texto en zona libre</b> (Encuadre y composición):
          escribes el texto y Realify lo coloca donde menos molesta (lejos del sujeto, las caras y las zonas con mucha textura), claro u oscuro según el fondo. Además, <i>Recorte inteligente</i>
          ofrece hasta tres propuestas de encuadre.</li>
        <li id="ia-realismo-ia"><b>Realismo y autenticidad 👑</b> (Inteligencia Artificial › Realismo y autenticidad): <b>Zonas demasiado lisas</b> busca los cielos, pieles y fondos sin textura
          de sensor y añade grano sólo ahí (o te los muestra en rojo); <b>Manos y dientes sospechosos</b> te avisa de proporciones raras en los dedos o en la fila de dientes (sólo avisa,
          no corrige, y puede equivocarse con manos de perfil o tapadas); <b>Informe de realismo</b> mide nitidez, ruido, rango dinámico, recortes, zonas lisas y metadatos, y se guarda en PDF o JSON.
          En <i>Plausibilidad</i>, «Marcar como antes» guarda la puntuación para ver «antes → ahora» después de aplicar un cambio.</li>
        <li id="ia-estilos-ia"><b>Estilos y color por referencia 👑</b> (Inteligencia Artificial › Color y estilos): <b>Estilo desde una foto de referencia</b> elige otra foto y lleva el color y el tono de la tuya hacia los suyos,
          por zonas (cielo, personas, resto); «Sugerir ajustes» sólo te dice cuánto subir o bajar exposición, contraste, calidez y saturación. <b>Packs de cámara</b> reúne las cámaras de Película, Móvil y Réflex en un
          selector y las aplica como capa de filtro reeditable (se copian a otras fotos con «Aplicar esta edición a otras fotos»). <b>Mis estilos</b> guarda una referencia como estilo, lo aplica a esta foto o a todas
          las abiertas, y lo guarda o importa como archivo para pasarlo a otra persona.</li>
        <li id="ia-assistant"><b>Asistente de edición 👑</b> (Inteligencia Artificial › Asistente). Escribe lo que quieres, por ejemplo «más cálida y con grano de película»,
          «muy luminosa y con contraste» o «quita la neblina y mejora el cielo». Te enseña el plan paso a paso y, si aceptas, lo aplica: los ajustes quedan en capas de ajuste que puedes retocar, y
          todo se puede deshacer. Sólo usa herramientas de Realify; no ejecuta nada más. Por ahora entiende frases sencillas en español.</li>
        <li id="ia-library"><b>Lote y biblioteca 👑</b> (Inteligencia Artificial › Lote y biblioteca). <b>Selección rápida</b>: añade varias fotos y la IA
          puntúa nitidez, ojos cerrados y composición, agrupa las repetidas y marca cuál es la mejor; toca una foto para descartarla o recuperarla y abre las elegidas en pestañas.
          <b>Buscar fotos</b>: indexa tus fotos en este dispositivo (sólo guarda lo que la IA ve y una miniatura) y búscalas con una frase como «perro en la playa» o «de noche».
          <b>Etiquetas y nombre</b> propone etiquetas en español y un nombre de archivo con una plantilla ({fecha}, {etiqueta}, {color}, {n}…). <b>Texto alternativo</b> escribe una descripción
          corta o larga para lectores de pantalla y la copia. En «Aplicar esta edición a otras fotos», el ZIP admite plantilla de nombre y formatos para redes.</li>
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
