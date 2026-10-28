/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «imagen»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const imagenTopic = { id:"imagen", title:"Imagen (menú Imagen)",
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
        <li id="img-merge"><b>Unir imágenes…</b> Pantalla completa. Une las fotos
          en fila, columna o cuadrícula, con separación, margen, esquinas y fondo. Las panorámicas
          tienen su propia herramienta (<b>Panorámica…</b>): las fotos solapadas (un tercio, más o
          menos) se unen <b>en tu dispositivo</b>, sin subirlas a ningún servidor, en cualquier
          orden; se calcula la posición de cada una, se iguala la exposición, se funden las
          uniones y se recortan los bordes. Pulsa <b>Calcular vista previa</b> para ver cómo encajan
          (la primera vez tarda unos segundos) y retoca con los ajustes: <b>proyección</b>
          (cilíndrica, esférica, Mercator, plana, estereográfica u ojo de pez),
          <b>horizonte</b> (nivelar solo, rumbo, inclinación y giro), <b>mezcla</b>, lente,
          exposición y <b>recorte</b> manual. Si una unión sale mal, marca a mano el mismo detalle en
          dos fotos (<b>Puntos de control…</b>) y, si se cuela gente o un coche, píntalos en
          <b>Máscaras…</b> para no usarlos (o para que salgan de una sola foto). Hasta 15 fotos se
          ordenan solas; con más, se respeta el orden de la lista y se avisa. Las opciones se recuerdan.
          La primera vez descarga OpenCV (11 MB). Si falla,
          puedes elegir probar con el servidor.</li>
        <li id="img-stack"><b>Apilar fotos Premium 👑…</b> Varias tomas de la misma escena, hechas
          a pulso (del dispositivo o de las abiertas, de 2 a 16). Se <b>alinean con precisión
          subpíxel</b> aunque se hayan girado o movido y se combinan: <b>Reducir ruido</b> (media en
          luz lineal; el ruido baja en √N y lo que se mueve —gente, hojas— se quita solo) o
          <b>Ampliar el enfoque</b> (en cada punto gana la toma más nítida: macro y paisaje).
          «Corregir movimiento fino» añade flujo óptico para lo que el giro y el desplazamiento no
          explican. La primera vez se descarga OpenCV (11 MB, una sola vez). El resultado se abre
          como una foto nueva, a la resolución completa que admite el editor. También acepta <b>archivos RAW</b> directamente (se revelan con el motor Premium) y, con «Referencia: la toma más nítida», mide la nitidez de cada toma (el RAW, a media resolución), las ordena de más a menos nítida y alinea todas a la mejor.</li>
        <li id="img-sharp"><b>Análisis de nitidez…</b> <b>Mapa de enfoque</b> de la imagen: una capa
          nueva, a resolución completa, que colorea lo nítido (azul, verde, amarillo, rojo = lo más
          nítido). <b>Mejor toma</b>: de varias fotos parecidas (del dispositivo o abiertas) las ordena de
          más a menos nítida con una nota de 0 a 100 y abre la mejor.</li>
        <li id="img-docscan"><b>Escanear documento Premium 👑…</b> Encuentra el papel, la pizarra o el
          cuadro de la foto (OpenCV, se descarga una vez), deja arrastrar las cuatro esquinas, deduce la
          proporción real del papel desde la perspectiva (o la fija a A4 / Carta) y lo endereza a
          resolución completa. <b>Acabado</b>: «Aclarar el papel» (quita sombras y el degradado de luz y deja el papel liso y blanco), escala de grises limpia o blanco y negro de texto. <b>Varias páginas</b>: añade más fotos (cada documento se detecta y endereza solo) y el resultado es un PDF con una página por foto. Foto nueva.</li>
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
          otra pestaña). Con Premium 👑 se elige entre Real-ESRGAN ×4 y UltraSharp (máximo detalle). <b>Colorear con IA…</b> da color a fotos en blanco y negro en una capa
          nueva. <b>Expandir con IA…</b> agranda el lienzo a un formato o con márgenes y rellena
          lo nuevo. Los modelos se descargan una vez y trabajan en tu equipo.</li>
        <li><b>Eliminar fondo…</b> Cuatro métodos: tres modelos de IA que funcionan en tu
          propio equipo —rápido (U²-Net), retratos (MODNet) y máxima calidad (ISNet)— y
          «Color de los bordes», el de siempre para fondos lisos. El recorte va a una
          <b>capa nueva</b> con el fondo transparente y la original se oculta, sin borrarla.
          Los modelos se descargan una vez y quedan guardados en el navegador. El borde del recorte
          se <b>refina a la resolución de la foto</b> (filtro guiado por la luminosidad real alrededor
          del contorno: pelo y pelusa siguen la imagen, no la rejilla del modelo).</li>
        <li id="sky-replace"><b>Reemplazar cielo…</b> Detecta el cielo con IA (el mismo modelo que
          «Seleccionar cielo»), ajusta el borde a los contornos reales de la foto (sin halo
          del cielo antiguo) y deja el reemplazo en una capa nueva con su propia máscara,
          encima de la original intacta. Eliges: <b>Biblioteca</b> (101 cielos,
          con fotografías CC0 de Poly Haven y cielos generados, filtros por hora y tiempo
          y búsqueda; en el móvil, en una fila que se desliza), una foto
          <b>Propia</b>, un <b>Degradado</b> o un <b>Color</b>. Los cielos de foto se colocan con
          su horizonte sobre el horizonte detectado; <b>Posición</b> los sube o los baja y
          «Desvanecer borde» suaviza el corte.</li>
      </ul>` };
