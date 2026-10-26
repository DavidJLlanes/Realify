/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «mover»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const moverTopic = { id:"mover", title:"Mover, recortar y transformar",
    desc:"Mover con guías inteligentes, recortar con guías de composición, perspectiva.",
    html:`
      <h3>Mover, recortar y transformar</h3>
      <ul>
        <li id="tool-handles"><b>Tiradores.</b> Los cuadraditos y puntos de Recortar,
          Transformación libre, Deformar, Perspectiva, las formas, el marco y la curva del
          texto, la pluma, las guías y los editores a pantalla completa (Recortar en forma,
          Cortar en partes, Galería de desenfoque) se adaptan a lo que usas: con el
          <b>dedo</b> la zona para agarrarlos es mucho más grande (un círculo del tamaño de la yema)
          y se dibujan mayores; con lápiz, algo más; con ratón, como siempre. Si dos
          tiradores quedan muy juntos (un marco pequeño en pantalla), se coge el
          <b>más cercano</b>. Un borde se agarra con margen por fuera pero sólo un poco
          por dentro, así que un recorte pequeño se sigue pudiendo mover arrastrando desde
          su interior. Y al coger un tirador un poco desviado <b>no salta</b> bajo el
          dedo: se mueve con esa misma distancia, sin tapar lo que estás ajustando.</li>
        <li id="tool-move"><b>Mover (V).</b> Arrastra el contenido de la capa activa (o el cuadro de un
          texto): sus dos bordes y su centro —no sólo el centro— se ajustan solos en
          cuanto caen cerca de los bordes o el centro del documento, de una guía puesta a
          mano, del borde o centro de cualquier otra capa, o de la cuadrícula (con
          «Ajustar a la cuadrícula» activo). Las flechas del teclado la desplazan 1
          píxel, y <kbd>Alt</kbd> + flecha, 10 píxeles, sin tocar el ratón.</li>
        <li id="tool-crop"><b>Recortar (C).</b> Arrastra el marco o elige una proporción
          numérica en el panel de opciones: fotos, publicaciones de redes, pantallas
          de móviles o monitores de PC. El botón ⇄ cambia entre vertical y horizontal;
          «Personalizada…» permite escribir ancho:alto. Las proporciones fijan el encuadre,
          no cambian por sí solas la resolución de salida. «Guía» superpone una ayuda de
          composición sobre el marco mientras se ajusta: «Tercios» (la retícula clásica)
          o «Áurea» (las mismas dos líneas por eje, pero a la proporción del rectángulo
          áureo en vez de a un tercio exacto). Con el marco ya movido, cambiar a
          cualquier otra herramienta <b>aplica el recorte</b> en vez de perderlo —el
          mismo criterio que «Aplicar»—; sólo <b>Cancelar</b> o <b>Esc</b> lo descartan
          de verdad. Sin tocar el marco no hay nada que aplicar, así que salir sin
          querer no deja rastro en el historial.</li>
        <li><b>Reglas, guías y cuadrícula (menú Ver).</b> Arrastra desde cualquier regla
          para soltar una guía; se puede volver a arrastrar. Para quitar una, arrástrala
          de vuelta a su regla o haz <b>doble clic o doble toque</b> sobre ella; <b>Ver › Borrar
          guías</b> (también en Herramientas del móvil) las quita todas. Todo se puede deshacer. Las herramientas de selección
          (rectangular, elíptica) también enganchan sus esquinas a guías, bordes, centros
          de otras capas y a la cuadrícula, igual que Mover. «Mostrar cuadrícula» pinta
          una retícula configurable —«Configurar cuadrícula…» fija el espaciado entre
          líneas mayores y cuántas líneas menores caben en cada celda—, y «Ajustar a la
          cuadrícula» es el interruptor aparte que decide si esa cuadrícula, aparte de
          verse, también atrae al arrastrar.</li>
        <li id="tool-transform"><b>Transformación libre (F).</b> Arrastra directamente sobre el lienzo
          para escalar (esquinas o bordes), rotar (el tirador redondo con flecha que
          sale por encima del borde superior, o el anillo justo fuera de cada
          esquina; se engancha a 0°, 45°, 90°… al acercarte), inclinar y mover, con
          vista previa en vivo. En la barra de opciones, <b>Ángulo</b> da el giro exacto
          y <b>↺ 90°</b> / <b>↻ 90°</b> giran la capa un cuarto de vuelta; <kbd>Mayús</kbd>
          mantiene la proporción o engancha la rotación a múltiplos de 15°,
          <kbd>Alt</kbd> escala desde el centro en vez de desde la esquina opuesta.
          El botón <b>Deformar</b> cambia a una malla de puntos de control para
          curvar libremente en vez de sólo escalar/rotar/inclinar. <b>Intro</b>
          o el botón «Aplicar» confirma, <b>Esc</b> (o «Cancelar») descarta la
          transformación sin tocar la capa. Cambiar a cualquier OTRA herramienta con
          algo ya arrastrado, en cambio, la <b>aplica</b> en vez de perderla —Esc
          sigue siendo la única vía para tirarla de verdad—; sin tocar nada no hay
          ninguna transformación que aplicar, así que salir de la herramienta sin
          querer no deja rastro. «Restablecer» vuelve al cuadro inicial sin salir
          de la herramienta.
          Distinta de «Transformar capa…» (menú Capa), que hace lo mismo con
          deslizadores y valores exactos en vez de arrastrando a mano.
          «Convertir en objeto inteligente» (menú Capa), antes de transformar,
          guarda el original íntegro aparte: cada ajuste posterior —encoger al
          30 % y volver al 100 % después, las veces que haga falta— remuestrea
          siempre desde ESE original, así que no se va perdiendo nitidez por el
          camino como en una capa normal. Pintar directamente sobre una capa
          así la vuelve a convertir en normal sin avisar más que con un aviso
          en pantalla; «Rasterizar objeto inteligente» hace lo mismo a
          propósito.</li>
        <li id="tool-perspective"><b>Perspectiva (P).</b> Corrige el trapecio de una foto en cuatro modos:
          Guías (traza sobre lo que debería estar recto y lo endereza), Esquinas
          (arrastra cada vértice), Bordes (estira un lado entero) o Ajustes
          (deslizadores de trapecio, giro y escala). «Rellenar» amplía la imagen lo justo
          para tapar las cuñas transparentes que deja corregir la perspectiva. Mismo
          criterio que Transformación libre: cambiar de herramienta con una corrección
          ya trazada la aplica; <b>Esc</b> o «Cancelar» la descartan de verdad. En el modo Guías, <b>Automático 👑</b> busca solo las líneas casi verticales (y las horizontales
          ya casi rectas) con OpenCV y las pone como guías; luego puedes arrastrarlas o borrarlas. Si es una <b>fachada vista de lado</b>, sus horizontales y diagonales convergen en un punto de fuga: se detecta esa familia (≥ 3 líneas coherentes) y se usa para ponerla de frente.</li>
      </ul>` };
