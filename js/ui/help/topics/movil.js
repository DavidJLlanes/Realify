/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «movil»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const movilTopic = { id:"movil", title:"Uso en el móvil",
    desc:"El cajón de herramientas con buscador, la hoja de paneles y los editores a pantalla completa.",
    html:`
      <h3>Uso en el móvil</h3>
      <ul>
        <li><b>Abrir fotos.</b> En Android, «Abrir» va directo a la <b>galería</b>; en iPhone,
          a la fototeca. Los RAW, PSD, TIFF y SVG no suelen salir en la galería: ábrelos con
          <b>Archivo › Abrir RAW, PSD, TIFF o SVG…</b> (o el enlace de la pantalla de inicio), que
          abre el explorador de archivos. En la Fusión HDR, el «+» ofrece Galería o Archivos.</li>
        <li><b>Barra inferior.</b> Abrir, Capas (la hoja de paneles), Exportar, Deshacer,
          Rehacer, Comparar y el Menú con todos los menús de escritorio en una lista.</li>
        <li><b>Cajón de herramientas.</b> Se abre en <b>Básicos</b>: lo que más se usa
          para editar una foto (recortar, luz, color, nitidez, estilos, quitamanchas,
          texto, stickers…), en el orden en que suele hacerse. Los dos primeros, resaltados,
          son la mejora de un toque: <b>Automático</b> (Tono / Color automático en modo color) y
          <b>Auto Premium 👑</b>, que con el diagnóstico de los automáticos equilibra el blanco en
          luz lineal, fija el negro y el blanco, abre las sombras de un contraluz y recupera las
          luces con detalle (Sombras / Iluminaciones Premium), corrige la exposición sólo si hace
          falta, sube el color apagado sin tocar la piel ni el color intenso, y ajusta el
          contraste sólo si la foto está plana. Los dos quedan como
          capa de filtro (también en Ajustes › Automáticos). La segunda pestaña,
          <b>Automáticos</b>, reúne todos los ajustes de un toque: Automático, Auto Premium 👑,
          Tono y color, Tono y color Premium 👑, Contraste, Contraste Premium 👑, Niveles, Niveles Premium 👑, Iluminar foto oscura e Iluminar Premium 👑; en el menú (escritorio y móvil) son el submenú <b>Ajustes › Automáticos</b>. En <b>Todos</b> y en las
          demás categorías (Inteligencia Artificial, Mejorar, Corregir, Color, Estilo, Filtros —los looks de un toque: Artísticos, Blanco y negro, Estilizar, Estilos, Filtro fotográfico, Filtro Vintage, Realify, Tabla de color y Texturas—, Efectos, Retoque,
          Selección, Pintar, Creativo —editores a pantalla completa que crean algo nuevo: Collage / Post, Memes, Panorámica, Fusión HDR, Unir fotos, Cortar en partes, Recortar en forma, Revelado RAW, Stickers, Marcos, Hoja de contactos, GIF animado y Foto 3D—, Capas, Analizar) están todas las herramientas, ajustes y filtros, en
          orden alfabético. El <b>buscador</b> filtra en tiempo real dentro de la
          categoría abierta (en Básicos, en todo), sin importar tildes ni pequeñas
          erratas. Mientras escribes, el cajón sube y se apoya encima del teclado para que
          veas los resultados; la tecla <b>Buscar</b> cierra el teclado y deja los resultados
          a pantalla completa. Al cerrar el teclado o elegir una herramienta vuelve a su
          tamaño normal. Desliza a los lados para cambiar de categoría. Los diálogos en los que
          se escribe (las medidas de «Documento nuevo», un nombre…) también suben encima del
          teclado mientras escribes, igual que los editores a pantalla completa (Memes, Collage,
          Cámara…); con la herramienta Texto, la imagen sube lo justo para ver lo que escribes.</li>
        <li><b>Menú del móvil con buscador.</b> El botón <b>Menú</b> de la barra inferior lista todas las
          funciones con un buscador. Al escribir, el menú se apoya justo encima del teclado y usa todo
          el alto libre (iPhone y Android, cualquier tamaño de pantalla); la tecla «Buscar» cierra el
          teclado y deja los resultados a la vista.</li>
        <li><b>Zoom con el dedo.</b> Con la imagen ampliada, un dedo la desplaza con las herramientas
          que no pintan; con las que pintan o seleccionan (Pincel, Borrador, Clonar, Quitamanchas,
          Lazo, Degradado…) un dedo sigue pintando o seleccionando, y son <b>dos dedos</b> los que
          amplían y mueven la imagen.</li>
        <li><b>Móvil en vertical.</b> Realify está pensado para usarse en el móvil en vertical;
          si giras el teléfono aparece un aviso (la versión de escritorio es para ordenador).
          «Seguir en horizontal» lo oculta hasta que cierres la pestaña. En tabletas y
          ordenadores no sale.</li>
        <li><b>Capas a pantalla completa.</b> «Capas» se abre a pantalla completa, como el revelado
          RAW: la imagen lo más grande posible (con dos dedos se amplía y se mueve; tocarla no
          pinta nada), arriba cerrar, nueva capa, duplicar, eliminar, deshacer y rehacer, y abajo
          (a la derecha con el móvil en horizontal) la opacidad, la fusión y la lista, de la que se
          ven dos capas a la vez: desliza para ver el resto. El botón <b>fx</b> o <b>adj</b> de una
          capa abre su editor encima, sin cerrar Capas. El Histograma (menú Ver) y Propiedades se
          abren en esta misma pantalla, con ‹ para volver a Capas.</li>
        <li><b>Editores a pantalla completa</b> (Realify, Filtro Vintage, memes, stickers,
          collage): la imagen primero, y abajo un desplegable para elegir el ajuste y un
          deslizador con botones − y + de tamaño cómodo para el pulgar. Dos dedos hacen
          zoom y giran donde tiene sentido.</li>
        <li><b>Tiradores y pestañas.</b> Con el dedo, los tiradores de recortar, transformar,
          perspectiva, texto y formas son más grandes y se agarran con mucho margen (ver
          <a data-go="mover#tool-handles">Tiradores</a>). Con varias fotos abiertas, el botón
          del final de la barra de pestañas las cierra todas.</li>
        <li><b>Pinceles.</b> La barra de opciones lleva el color frontal y de fondo al
          principio; la simetría, la textura y el color del pincel están en la misma
          barra.</li>
      </ul>` };
