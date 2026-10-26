/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «filtros»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const filtrosTopic = { id:"filtros", title:"Filtros (menú Filtro)",
    desc:"Desenfoques, enfoque, ruido con IA, retoque de retrato, frecuencias, texturas, distorsión…",
    html:`
      <h3>Filtros (menú Filtro)</h3>
      <ul>
        <li><b>Especiales.</b> Realify, Revelado fotográfico, Collage, memes, Filtro Vintage, Cámaras, Efectos LUT,
          PurePixel, Unmark, Estilos, Adaptive Photo Lens y Tabla de color: ver el tema
          «Filtros especiales», en el índice.</li>
        <li><b>Filtros y Creativo (como en el móvil).</b> Dos submenús al principio con las mismas
          opciones que las pestañas Filtros y Creativo del cajón «Herramientas» del móvil. Las
          opciones siguen también en sus menús de siempre.</li>
        <li><b>Todo filtro deja su resultado en una capa nueva</b> reeditable (insignia «fx»);
          ver «Capas de filtro» en el tema Capas.</li>
        <li id="flt-zoom"><b>Zoom con el efecto abierto.</b> Con cualquier filtro o ajuste abierto
          puedes acercar y mover la imagen —rueda del ratón o pellizco con dos dedos sobre
          el lienzo— para juzgar de cerca un enfoque, un ruido o un borde, sin que el efecto
          se cancele ni se pierdan sus valores.</li>
        <li><b>Desenfoque gaussiano / Enfocar / Enfoque selectivo.</b> Suavizar,
          endurecer o endurecer sólo el detalle fino sin tocar las zonas planas. Con una imagen de 16 bits, también Desenfoque de superficie, Reducción de ruido por canal, Nitidez inteligente y Desenfoque de lente se calculan sobre los 16 bits.</li>
        <li><b>Máscara de enfoque / estabilizador.</b> Tres métodos sobre la luminancia
          (sin bordes de color): <b>máscara de enfoque</b>, <b>deconvolución de foco</b> para
          fotos algo desenfocadas y <b>estabilizador de movimiento</b> para fotos movidas
          (elige el <b>ángulo</b> del trazo y su largo con <b>Radio</b>). <b>Reducir halos</b>
          evita los bordes claros u oscuros alrededor de los contornos. Mientras mueves un
          mando ves una copia rápida; al soltarlo, el resultado a resolución completa.</li>
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
          en tiempo real mientras mueves los deslizadores. <b>Corrección de lente por perfil Premium 👑</b> (mismo menú): lee de la foto la cámara, el
          objetivo, la distancia focal y el diafragma (EXIF), busca el objetivo en la base de Lensfun
          (unos 1 500 objetivos) y corrige con sus calibraciones reales: distorsión, aberración
          cromática y viñeteo (en luz lineal), con un único remuestreo bicúbico a resolución completa
          y, si quieres, zoom para no dejar bordes vacíos. Si no la reconoce, escribe el objetivo
          en el cuadro (se sugieren los de la base). Resultado en una capa nueva. La base (1,7 MB)
          se descarga la primera vez. Móviles y cámaras que no están en la base: <b>perfil propio</b> (Nuevo / editar…, Importar…, Exportar), con el modelo «acm» (radial + tangencial de Adobe, radio 1 en la esquina); se guarda en el navegador y se aplica solo a las fotos de esa cámara. <b>Foto recortada</b> indica qué parte del ancho original conserva el propio archivo. <b>Corrección de lente automática Premium 👑</b> (mismo menú y cajón «Herramientas») corrige sin diálogo con el perfil de la cámara o el objetivo que dice el EXIF: sirve en «Acciones» y en lote. En el revelador RAW, <b>Óptica › Lente por perfil</b> corrige sobre los datos lineales antes del revelado.</li>
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
        <li><b>Viñeteado.</b> Oscurece (o aclara, o tiñe) las esquinas para llevar el ojo al
          centro, en negro, blanco o un color libre. «Cantidad» es lo que se cierra en las
          esquinas; «Zona clara», hasta dónde no se toca nada; «Pluma», lo suave de la
          transición (más pluma = más suave, sin anillo visible); «Opacidad» rebaja todo el
          efecto. «Redondez» controla la forma: al 100 % es un círculo; bajarla lo ajusta
          a la proporción del lienzo —útil en panorámicas y retratos muy verticales—. No
          pinta sobre las zonas transparentes de la capa.</li>
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
      </ul>` };
