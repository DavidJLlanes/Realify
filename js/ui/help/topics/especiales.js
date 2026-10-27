/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «especiales»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const especialesTopic = { id:"especiales", title:"Filtros especiales",
    desc:"Realify, revelado, Collage / History / Post, memes, Filtro Vintage, Cámaras, Efectos LUT, Estilos, Unmark, LUT…",
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
          archivo), con zoom real hasta 1:1, comparación, histograma y espectro. En escritorio,
          el chevrón de cada etapa despliega sus mandos y el ojo aísla su efecto en la vista previa. Con el
          interruptor <b>Premium 👑</b> de la barra superior (en el móvil, junto a ✕; también «Realify
          Premium 👑» en el menú y el cajón) usa el motor de alta calidad con los mismos mandos: toda la
          cadena en coma flotante de 32 bits, luces que se comprimen sin virar de color, tinte y
          saturación en OKLab con mapeo de gama (los colores intensos no se recortan) y tramado al
          pasar a 8 bits (sin escalones en cielos y degradados). Apagado, queda igual que siempre.
          Detalle en el tema «Realify · simulación de captura».</li>
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
        <li id="sp-frames"><b>Marcos…</b> 138 modelos en 12 categorías. <b>Básicos</b>
          incluye Liso, con un único color; <b>De autor</b> reúne 16 diseños como kintsugi,
          vitral, origami, constelación y holográfico. Diamond y Heart dibujan sus motivos
          en los cuatro lados. Todos los modelos respetan los colores elegidos; los de un
          solo color muestran únicamente el mando principal. Elige modelo, anchura y
          colores en escritorio o móvil;
          los ajustes se conservan al cambiar de modo. La vista previa muestra el marco
          completo y los mandos se adaptan al área visible del navegador. Amplía con la
          rueda del ratón o separando dos dedos y arrastra para recorrer la imagen.
          <b>Encajar</b> devuelve la vista completa; el doble clic también restablece el zoom.
          El zoom no modifica el resultado. Aplicar amplía el lienzo y añade una capa exterior sin tapar la foto;
          deshacer recupera también el tamaño anterior.</li>
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
        <li id="sp-camaras"><b>Cámaras…</b> Galería a pantalla completa con <b>150 cámaras</b> de todas las épocas, en
          <b>19 familias</b>: procesos del siglo XIX (daguerrotipo, ferrotipo, cianotipo…), cámaras de
          cajón y fuelle, película en color y en blanco y negro, instantáneas, cámaras de juguete,
          compactas analógicas y digitales de CCD, móviles y webcams, vídeo y vigilancia, ópticas
          especiales, cine y fotogramas, científica y técnica (rayos X, térmica, microscopio…), espía
          y acción, prensa e impresión (offset, fotocopia, fax…), pantallas y capturas, digitalización
          de época, lentes y accesorios y luz y clima. Cada miniatura es <b>tu propia foto</b> con esa cámara, calculada en la GPU. En
          el escritorio, buscador, desplegable «Ir a una familia» e intensidad a la derecha; en el
          móvil, un desplegable de familia, otro de cámara (abre una hoja con miniaturas) y la
          intensidad. El dado ⚄ cambia dónde caen el polvo, los arañazos, las fugas de luz y el
          ruido de cinta; «Fecha del sello» se cambia en las cámaras que la llevan. Con el
          interruptor <b>Premium 👑</b> la luz se calcula en luz lineal (resplandores, flash y
          desenfoques más naturales), con hombro suave en las luces y tramado de salida. Queda
          como capa de filtro reeditable (botón fx). Se abre desde Filtro › Especiales › Cámaras…,
          Filtro › «Filtros (como en el móvil)» y, en el móvil, desde la pestaña Filtros del cajón
          «Herramientas».</li>
        <li id="sp-luts"><b>Efectos LUT…</b> Galería a pantalla completa con <b>226 efectos de color</b> (tablas LUT .cube
          de 3D) en siete <b>familias</b>: negativo en color, diapositiva, instantánea, blanco y negro,
          copia de cine, digital clásico y looks creativos. Cada efecto tiene un nombre de dos palabras
          que describe su aspecto (por ejemplo «Ámbar vivo» o «Duro profundo»). Cada miniatura es
          <b>tu propia foto</b> con ese efecto, calculada en la GPU; las tablas se descargan sólo cuando su
          miniatura entra en pantalla. En el escritorio, buscador, desplegable «Ir a una familia» e
          intensidad a la derecha; en el móvil, un desplegable de familia, otro de efecto (abre una hoja con
          miniaturas) y la intensidad. Con el interruptor <b>Premium 👑</b> se usa interpolación
          tetraédrica en coma flotante de 32 bits (no tiñe los grises) y tramado de salida. Queda como capa de
          filtro reeditable (botón fx). Se abre desde Filtro › Especiales › Efectos LUT…, Filtro › «Filtros
          (como en el móvil)» y, en el móvil, desde la pestaña Filtros del cajón «Herramientas». Para cargar
          tu propio archivo .cube, usa «Tabla de color (LUT)…».</li>
        <li><b>PurePixel…</b> Suaviza residuos finos de luminancia y color y añade textura
          controlada; experimental, no garantiza nada frente a un detector.</li>
        <li><b>Unmark…</b> Tres secciones en un panel: <i>marcas visibles</i> (detecta el
          logotipo o rótulo del generador —o usa la zona conocida de cada servicio, una
          región manual o la selección— y lo rellena con estructura + textura de
          alrededor), <i>marcas invisibles</i> (rompe los soportes donde se esconden:
          transformación geométrica subpíxel, remuestreo, ondículas DWT-DCT, coeficientes
          DCT, suavizado y reenfoque, ruido, bits bajos, limpieza espectral y
          recompresión JPEG) y <i>procedencia</i> (lee lo que declara el archivo —C2PA, XMP con
          «trainedAlgorithmicMedia», EXIF, prompts— y decide qué metadatos salen al
          exportar). Ninguna etapa garantiza nada frente a un detector concreto: mídelo.</li>
        <li id="sp-looks"><b>Estilos…</b> 160 acabados de un clic en 16 categorías: básicos, retrato,
          paisaje, cine, películas, urbano, comida, moda y editorial, redes sociales, blanco
          y negro, noche, estaciones, suaves y pastel, dramáticos, duotonos y creativos y
          vintage. Filtra por categoría o escribe en el buscador; cada miniatura muestra tu
          propia foto con ese estilo, y la intensidad se regula después. Se abre a pantalla
          completa (móvil y escritorio) con vista previa en tiempo real, Antes/Después y
          deshacer; el resultado va a una capa nueva editable con el botón fx. Incluye
          138 estilos convertidos de acciones de Photoshop (Matte, Retro VR, destellos de luz,
          bokeh, marcos, glitch…), calculados en coma flotante sin perder calidad. Los
          45 destellos de luz y los 5 bokeh usan las imágenes originales a 4000 px, que se
          descargan sólo al elegir el estilo.</li>
        <li><b>Adaptive Photo Lens…</b> Reconoce el tipo de foto con un modelo local
          (retrato, paisaje, comida…) y aplica el revelado que le va.</li>
        <li><b>Tabla de color (LUT)…</b> Carga un archivo <code>.cube</code> de etalonaje
          —el formato de cine y revelado— y lo aplica en una capa nueva.</li>
      </ul>` };
