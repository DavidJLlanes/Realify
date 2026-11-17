/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «basic»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const basicTopic = { id:"basic", title:"Realify Basic (la app sencilla)",
    desc:"Una app aparte, solo para fotos: ajustar, estilos y recortar con una interfaz limpia, y pasar la foto de una app a otra.",
    html:`
      <h3>Realify Basic</h3>
      <p>Una app instalable <b>aparte</b>, solo para fotos, en <b>realify.es/basic/</b>. Es la forma rápida de retocar una foto sin las
        muchas opciones de Realify: la foto ocupa toda la pantalla y los mandos son de cristal translúcido encima. Funciona igual en
        móvil y en escritorio, siempre en calidad <b>Premium 👑</b> (sin interruptor) y no sube nada a ningún sitio.</p>
      <ul>
        <li><b>Abrir.</b> Elige una foto (también HEIC, TIFF, RAW, PSD…), arrástrala a la ventana o pégala. <b>Cancelar</b> la cierra y
          <b>OK</b> guarda una copia (en el móvil, con la hoja de compartir). Un toque en la foto oculta las barras; pellizco, rueda o
          doble toque hacen zoom (también para alejar por debajo del tamaño de la pantalla; el doble toque la vuelve a ajustar).</li>
        <li><b>Ajustar.</b> <b>Auto</b> y 15 ajustes con una regla: Exposición, Brillantez, Luces altas, Sombras, Contraste, Brillo,
          Punto negro, Saturación, Intensidad, Temperatura, Tinte, Nitidez, Definición, Reducir ruido y Viñeta. El anillo de cada
          ajuste muestra su valor; doble toque o doble clic en el ajuste, o en la regla, lo pone a 0.</li>
        <li><b>Estilos.</b> Los más de 150 estilos prediseñados de Realify en una fila deslizante, con su miniatura (hecha con tu foto) y
          su nombre. Al elegir uno aparece la <b>intensidad</b>. Los ajustes de Ajustar trabajan encima del estilo.</li>
        <li><b>Recortar.</b> Arrastra el marco por sus asas; <b>Girar</b> 90°, <b>Voltear</b>, <b>Proporción</b> (libre, original, 1:1,
          4:3, 3:2, 16:9, 3:4, 2:3, 9:16, Post y Historia de Instagram) y las reglas <b>Enderezar</b>, <b>Vertical</b> y <b>Horizontal</b>.</li>
        <li><b>Sin pérdida.</b> La foto original no se toca: deshacer y rehacer guardan solo los valores, y la copia se calcula siempre
          desde el original a resolución completa.</li>
        <li id="basic-traspaso"><b>Pasar la foto de una app a otra.</b> En Realify: <b>Archivo → Abrir en Realify Basic…</b> (y en el cajón
          «Herramientas» del móvil). En Basic: menú <b>···</b> → <b>Abrir en Realify Pro</b>. La foto llega con la edición aplicada, como PNG sin
          pérdida. <b>Cambiar a Realify Pro / Cambiar a Realify Basic</b> solo abre la otra app. En el iPhone, con las dos apps
          instaladas, no se puede abrir una app desde la otra: cada una tiene su propio almacenamiento, así que la foto viaja cifrada por realify.es y llega sola al abrir la otra
          app desde su icono (espera a que termine «Enviando la foto…»). La primera vez la app que envía enseña un código de 6 cifras y la
          otra lo pide: se escribe una vez y quedan emparejadas. La foto se borra del servidor al entregarla. Si la otra app no pide el código
          (por ejemplo, si cambiaste de red), emparéjalas a mano: en Basic, menú <b>···</b> → <b>Emparejar con Realify Pro</b>; en Realify,
          <b>Archivo → Emparejar con Realify Basic…</b>. Una enseña el código y la otra lo escribe.</li>
        <li><b>Atajos (escritorio).</b> <b>Ctrl/⌘+Z</b> deshace, <b>Mayús+Z</b> rehace, <b>O</b> abre y <b>S</b> guarda.</li>
      </ul>`
};
