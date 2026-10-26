/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «archivo»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const archivoTopic = { id:"archivo", title:"Archivo y documentos",
    desc:"Abrir, guardar, exportar (TIFF, PSD, AVIF, JPEG XL, OpenEXR, PDF, GIF), hoja de contactos y lotes.",
    html:`
      <h3>Archivo</h3>
      <ul>
        <li><b>Abrir imagen / Abrir proyecto / Guardar proyecto.</b> Un proyecto
          guarda todas las capas, máscaras e historial tal cual, para seguir editando
          otro día; una imagen abierta directamente empieza como una sola capa. Si la foto trae
          colores de <b>gama amplia</b> (Display P3, como las de iPhone y muchos Android) y el
          navegador lo permite, el documento trabaja en <b>Display P3</b> para no perder esos rojos,
          verdes y naranjas intensos; se avisa al abrirla. Los filtros de GPU (Cámara y Vintage) también trabajan en P3. En un documento P3 los colores de pintura («#rrggbb» del frontal, texto, formas…) son los
          números del propio lienzo: el cuentagotas y el pincel dan el mismo color y se alcanza toda la gama P3 (la muestra se ve en P3). Al revelar un RAW con <b>Premium 👑</b> puedes elegir <b>Color › Espacio de color › Display P3</b>: el documento se abre en P3 con sus 16 bits. También sin Premium (el revelado de siempre pasa de Rec.2020 a P3 sin recortar a sRGB, sin 16 bits). Si trae <b>más de 8 bits por canal</b>
          (PNG o TIFF de 16 bits, AVIF de 10 o 12 bits, o un RAW abierto desde el revelador con
          Premium), la capa de fondo guarda esos bits («· 16 bits por canal» al abrir) y Exportar
          los usa con «Alta precisión», ya marcada: sin bandas en cielos y sombras aunque apliques
          ajustes fuertes. Donde pintes o retoques, cuenta lo que hay en la capa. Los ajustes de color
          —Brillo y contraste, Niveles, Curvas, Balance de blancos, Tono y saturación, Exposición,
          Color por canales, Mezclador de canales y Vibrance— calculan a partir de esos 16 bits
          y la capa de filtro que crean <b>conserva sus 16 bits</b> («· 16 bits conservados»): una
          escala estrecha de grises estirada con Niveles no sale a escalones al exportar. Lo mismo
          hacen los <b>filtros</b> —desenfoques, enfoques, ruido, Detalle y estructura, Viñeteado,
          Reducción de ruido, PurePixel…— y los <b>Estilos</b> y las <b>Tablas de color</b>: el cambio
          se suma a los 16 bits de la capa de origen. Los filtros que mueven o sustituyen la imagen
          (distorsiones, pixelar, artísticos…) siguen en 8 bits. El <b>desenfoque gaussiano, Enfocar y
          Añadir ruido</b> se calculan directamente sobre los 16 bits. <b>Realify 👑</b>, el <b>Filtro Vintage</b> y
          el <b>Revelado fotográfico 👑</b> también devuelven 16 bits. Los 16 bits <b>sobreviven a
          girar, voltear, recortar, ampliar el lienzo, redimensionar, corregir la perspectiva y enderezar</b> (y a
          deshacer y rehacer), a <b>duplicar la capa</b>, a <b>guardar el proyecto</b> (.realify, y lo que se
          guarda antes de actualizar la app) y al <b>autoguardado periódico</b>.</li>
        <li><b>Documento nuevo… / Collage / History / Post…</b> Un lienzo vacío a medida, o una
          composición para redes creada en su propia pestaña (ver su tema).</li>
        <li id="file-alpha"><b>Transparencia al guardar.</b> Lo que se guarda en un formato sin capas
          (JPEG, PNG, WebP, AVIF, TIFF, PDF, GIF) es el <b>acoplado de las capas visibles</b>: lo que ves. Si
          hay zonas transparentes, PNG, WebP, AVIF, TIFF y GIF las <b>conservan</b> (casilla «Conservar la
          transparencia», marcada por defecto, en Exportar, Exportar como, lotes, acciones y Cortar
          en partes); JPEG y PDF no admiten transparencia y esas zonas se rellenan con el
          <b>color de fondo</b> que elijas (blanco por defecto). Con transparencia, Exportar propone
          PNG de entrada. Para conservar todos los mandos de las capas, usa Guardar proyecto.</li>
        <li><b>Exportar… / Exportar PNG rápido.</b> El primero deja elegir formato (JPEG,
          PNG, WebP, <b>AVIF</b> —más ligero a igual calidad; también de <b>10 o 12 bits</b>—, <b>JPEG XL</b>
          (con o sin pérdidas), <b>OpenEXR</b> (luz lineal de 16 bits en coma flotante, para vídeo y 3D),
          <b>TIFF</b> sin pérdidas a 8 bits, <b>HEIC</b> —sólo si este dispositivo trae un codificador
          HEVC (Safari en iPhone, iPad y Mac; Chrome o Edge con codificador por hardware): lo codifica el propio
          dispositivo, a 8 bits —o a <b>10 bits</b> desde los 16 bits del motor si trae HEVC Main 10— y con
          los metadatos que pidas (EXIF y XMP); si no aparece en la lista, usa AVIF—,
          <b>PNG 16 bits</b> o <b>TIFF 16 bits</b> —máxima calidad— o <b>PDF</b>, con tamaño de página y
          margen), calidad y metadatos EXIF. En AVIF, JPEG XL, JPEG y WebP el diálogo muestra el
          <b>peso aproximado y la calidad estimada</b> antes de exportar; en AVIF y JPEG XL, calidad 100
          = sin pérdidas. AVIF profundo admite hasta 24 megapíxeles y JPEG XL hasta 16 (8 y 6 en móvil). También
          puedes abrir archivos <b>.jxl</b>. Con <b>«Alta precisión al exportar»</b> (y siempre en
          16 bits) las capas, las capas de ajuste, los modos de fusión, los <b>estilos de capa</b> y
          <b>Fusionar si</b> se recalculan en coma flotante: apilar varios ajustes ya no deja bandas
          en cielos y degradados, y al cambiar el tamaño se promedia en luz lineal. <b>La vista
          previa también</b>: si el documento tiene capas de ajuste, una foto de 16 bits, Fusionar
          si o modos de fusión «a mano», se compone en la GPU en coma flotante (WebGL2) y se pasa a 8
          bits sólo al mostrarla, con un tramado imperceptible; si el equipo no puede, o el documento
          usa estilos de capa, un trazo en curso o es muy grande, se compone en 8 bits como siempre
          (Ayuda › Diagnóstico dice si está activo). <b>«Tramado a 8 bits»</b> añade un ruido
          imperceptible que reparte los tonos intermedios al guardar en 8 bits. El segundo
          entrega un PNG sin preguntar nada. En documentos Display P3 aparece <b>Color</b>:
          <b>Display P3</b> (JPEG, PNG, WebP, TIFF y 16 bits, con su perfil incrustado) o <b>sRGB</b> para la
          máxima compatibilidad; JPEG XL, PDF y «Limpio para web» se guardan
          siempre en sRGB. <b>Metadatos</b> (JPEG, PNG y WebP, con la foto abierta desde un archivo): por
          defecto <b>ninguno</b>, como siempre. Puedes volver a escribir, desde el archivo original y filtrado,
          <b>autor y copyright</b>, la <b>fecha</b>, la <b>cámara</b> y el objetivo, la <b>ubicación GPS</b> y la
          <b>descripción</b> (título, palabras clave), por separado o con los atajos «Sólo autor y copyright», «Los del
          original, sin ubicación» y «Todos». Nunca se copian la miniatura incrustada (enseña la foto sin recortar), las
          notas del fabricante ni la orientación; los números de serie, sólo con «Todos». «Limpio para web» no lleva
          ninguno.</li>
        <li><b>Exportar como…</b> También permite un <b>PSD</b> para Photoshop con grupos, capas,
          <b>máscaras reales</b>, sombra, resplandor, trazo y degradado como <b>efectos de capa</b>, los
          27 modos de fusión, el recorte, el <b>texto editable</b> (de punto o de párrafo, con giro, fuente por su nombre PostScript, tamaño, color, interlineado, tracking y contorno; el texto en
          círculo y el de caja de fondo se rasterizan), los <b>objetos inteligentes</b> (también girados, escalados y sesgados; con malla se rasterizan; el
          original va dentro como PNG enlazado), el <b>«Fusionar si»</b> de gris y por canal y las capas de ajuste <b>Invertir, Niveles, Curvas,
          Exposición y Blanco y negro</b> editables (Tono y saturación, Brillo y contraste y Balance de blancos salen como ajustes de Photoshop pero sólo
          aproximados; Balance de blancos lo reconoce Realify al volver a abrirlo).
          Lo que no se traduce se rasteriza y una copia oculta «Vista final · referencia» enseña el aspecto de Realify.
          Al abrir, esos textos, objetos, ajustes y «Fusionar si» vuelven a ser lo que eran. <b>PSB</b> es lo mismo para documentos
          enormes (hasta 300 000 px por lado) y <b>PSD/PSB de 16 bits</b> guarda las <b>capas con sus 16 bits reales</b> y
          el compuesto del motor de precisión; los PSD de 16 bits se abren <b>conservando los 16 bits</b>. «Copiar metadatos»
          escribe XMP y EXIF en el PSD. Guarda un <code>.realify</code> para reeditar en Realify.
          Los PSD/PSB llevan perfil sRGB; el TIFF de 8 bits no. Realify abre también <code>.psb</code>.</li>
        <li id="file-pdf"><b>Exportar PDF…</b> PDF para imprimir o enviar: el documento y las imágenes que añadas, en una
          o varias páginas (A5, A4, A3, Carta, Legal o el tamaño de la imagen), con márgenes, <b>sangrado</b>,
          1 a 9 imágenes por página, portada, numeración, metadatos y <b>resolución objetivo</b> en ppp. Una foto JPEG
          que ya cabe en esa resolución se incrusta sin volver a comprimirla. Además: <b>una página por capa</b>, <b>reordenar o quitar</b>
          las imágenes añadidas (▲ ▼ ✕), <b>color de fondo</b> para las imágenes con transparencia, <b>marcas de recorte</b> (con
          sangrado), <b>fuente propia</b> (TTF/OTF) para portada, numeración y pies, y <b>PDF/X</b> con imágenes CMYK, intención
          de salida (FOGRA39, SWOP/CGATS TR 001 o FOGRA29), TrimBox/BleedBox. Con <b>Perfil ICC</b> (el «.icc» de tu imprenta) las imágenes se convierten
          con él (intento colorimétrico relativo, sin compensación del punto negro) y el perfil se incrusta como intención de salida; sin perfil, el CMYK
          es una conversión matemática. No está validado con un preflight profesional; PDF/X necesita una fuente propia para el texto.</li>
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
      </ul>` };
