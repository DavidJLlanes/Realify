/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «video»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const videoTopic = { id:"video", title:"Vídeo (editor)",
    desc:"Línea de tiempo, recortar y dividir, velocidad y volumen, efectos (sensor de Realify, color, cámaras, fondo con IA, estabilizar) y exportar para redes…",
    html:`
      <h3>Vídeo (menú Vídeo)</h3>
      <p>Un editor de vídeo sencillo que funciona <b>en tu dispositivo</b>: los vídeos no se suben a ningún sitio. Está en el
        menú <b>Vídeo</b> (barra de escritorio, ☰ y última pestaña del cajón del móvil, con el mismo contenido y orden).
        No necesita tener una foto abierta.</p>
      <ul>
        <li id="video-editor"><b>Editor de vídeo…</b> abre una pantalla completa con la <b>vista previa</b> arriba y la
          <b>línea de tiempo</b> debajo. <b>＋ Vídeo</b> (o <b>Importar vídeo…</b> del menú) añade uno o varios vídeos. Toca un clip para
          elegirlo; arrástralo para moverlo (se imanta a los bordes de otros clips); toca o arrastra en la regla para mover
          el cabezal; <b>✂</b> divide el clip en el cabezal; <b>🗑</b> lo borra; <b>−</b> y <b>＋</b> alejan y acercan la línea.
          Deshacer y rehacer están arriba. En el escritorio: <b>Espacio</b> reproduce, <b>S</b> divide, <b>Supr</b> borra y
          <b>← →</b> avanzan un fotograma.</li>
        <li id="video-clip"><b>Clip:</b> velocidad (0,25× a 4×; cambia también el tono) y volumen (0 a 200 %). Con el clip elegido
          está también <b>Efectos</b>.</li>
        <li id="video-efectos"><b>Efectos 👑</b> (todos Premium, de momento gratis): <b>Sensor de Realify</b> (ruido y óptica en cada
          fotograma, vivos entre fotogramas), <b>Color</b> (exposición, contraste, saturación, temperatura y tinte),
          <b>Estilo de cámara</b> (VHS, película, CCD…), <b>Fondo con IA</b> (recorta a la persona y desenfoca, oscurece, pasa a
          gris o pone un color al fondo; descarga el modelo la primera vez y avisa del tamaño) y <b>Estabilizar</b> (calma el
          temblor por desplazamiento y recorta un poco los bordes; no corrige giros). Se pueden apilar varios por clip.</li>
        <li id="video-salida"><b>Salida:</b> el formato (9:16, 16:9, 1:1), un <b>preset</b> para redes (Instagram Reel, Historia, TikTok,
          YouTube 1080p, WhatsApp, Web ligera WebM), MP4 o WebM y «Con sonido». <b>Exportar</b> genera el archivo y lo descarga.</li>
      </ul>
      <p>Límites: para que el móvil no se cuelgue, el proyecto tiene una duración máxima (hoy 3 minutos en móvil y 10 en escritorio)
        y la salida no pasa de 1920 px de lado; si algo no cabe, el editor lo dice con un mensaje claro. El códec de sonido y de vídeo
        lo elige el dispositivo (MP4 con AAC u Opus; WebM con Opus o Vorbis). El proyecto se guarda solo en este dispositivo (con copia de tus vídeos) y se recupera al volver a abrir el editor; «Nuevo» lo borra.</p>
      <p>La vista previa trabaja a baja resolución y puede saltar fotogramas en móviles modestos; la exportación siempre es completa.</p>`
};
