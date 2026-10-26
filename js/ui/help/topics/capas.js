/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «capas»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const capasTopic = { id:"capas", title:"Capas (menú Capa)",
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
          tercera el documento entero en una sola capa. La primera aplica la máscara
          de la capa superior. Si la inferior tiene máscara, efectos, opacidad o una
          fusión especial que cambiaría el resultado, avisa y no altera las capas.</li>
        <li><b>Transformar capa…</b> Escala, rotación y dos inclinaciones (X, Y),
          más volteo horizontal/vertical, con valores exactos en vez de arrastrar a
          mano; la capa se ve transformada en directo mientras mueves los deslizadores
          y «Cancelar» la deja como estaba. Distinta de la herramienta Mover (V), que
          sólo desplaza.</li>
        <li><b>Agrupar capas</b> (<kbd>Ctrl</kbd>+<kbd>G</kbd>) / <b>Desagrupar</b>
          (<kbd>Ctrl</kbd>+<kbd>Mayús</kbd>+<kbd>G</kbd>). Mete las capas marcadas
          en el panel (o la activa, si no hay ninguna marcada) en un grupo nuevo:
          una carpeta plegable con su propia opacidad, modo de fusión y máscara,
          que se pliega o despliega con la flecha de su fila —plegarlo sólo afecta
          al panel, el lienzo sigue mostrando su contenido igual—. Un grupo se
          puede agrupar dentro de otro grupo, y «Subir»/«Bajar» lo mueven entero,
          con todo su contenido, en vez de sólo la cabecera. Para marcar varias en
          móvil, activa ☷ en la cabecera de Capas y toca cada fila; pulsa el botón
          otra vez para salir del modo.</li>
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
          «Capa subyacente», cada una con su punto negro y su punto blanco. Las pestañas
          <b>Gris · Rojo · Verde · Azul</b> eligen si el corte es por luminosidad o por un canal suelto
          (se combinan: la capa se ve donde se cumplen todos). Bajar el
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
          desvanecido, sin repintar nada a mano). <b>Pintarla:</b> toca su miniatura (queda
          enmarcada) y pinta con el Pincel en negro para ocultar, en blanco para mostrar o en
          gris para dejarla a medias; el Borrador y el Degradado también trabajan sobre ella.
          <b>Ver y pintar sólo la máscara:</b> en el ordenador, <kbd>Alt</kbd>+clic en su
          miniatura (o clic derecho › «Ver y pintar sólo la máscara»; también el botón «Ver
          máscara» de Propiedades); en el móvil, un segundo toque sobre la máscara ya elegida
          abre su menú con esa opción. Repite el gesto para volver a la vista normal.</li>
        <li><b>Máscara degradada…</b> Crea una máscara ya rellena con un degradado
          lineal o radial en vez de partir de blanco u ocultar todo; con opción de
          invertir el sentido y ajustar el tamaño, para transiciones suaves sin tener
          que pintarlas con el Degradado a mano.</li>
        <li><b>Nueva capa de texto, Editar texto, Rasterizar texto.</b> Ver «Texto»,
          en «Otras herramientas».</li>
        <li><b>Añadir stickers…</b> Más de 1.500 emojis en 3D, color, plano o alto contraste
          (y seis tonos de piel), con buscador y categorías, a pantalla completa: colócalos,
          escálalos y gíralos sobre la foto. Cada sticker queda en su propia capa y todo
          funciona sin conexión. Si cierras sin aplicar (Cancelar, ✕ o Esc), los stickers
          colocados se conservan mientras el documento siga abierto y vuelven al abrir el
          editor; al aplicar se convierten en capas. El selector de tono de piel sólo
          actúa en manos y personas, y se desactiva («Sin tonos») en alto contraste o
          cuando ningún sticker de la lista lo tiene. El alto contraste se muestra sobre
          fondo blanco y nace con un borde de pegatina para verse sobre fotos oscuras.
          El botón 🗑 quita todos los stickers pendientes (se puede deshacer).</li>
        <li><b>Crear meme…</b> Ver «Filtros especiales».</li>
        <li><b>Añadir marca de agua…</b> Coloca un texto o logo semitransparente
          repetido o en una esquina, en una capa aparte.</li>
      </ul>` };
