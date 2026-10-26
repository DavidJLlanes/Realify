/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «ajustes»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const ajustesTopic = { id:"ajustes", title:"Ajustes (menú Ajustes)",
    desc:"Niveles, curvas (con estilos y luminosidad), tonos del histograma, color por rangos, Lab, HDR, B/N…",
    html:`
      <h3>Ajustes (menú Ajustes)</h3>
      <ul>
        <li><b>Brillo y contraste.</b> El control más directo: sube o baja la luz
          general y separa claros de oscuros. Trabaja en coma flotante sobre la
          luminosidad percibida: el brillo mueve los medios tonos sin tocar el negro ni
          el blanco, el contraste es una curva en S suave alrededor del gris medio, nada
          se quema ni se empasta y los colores conservan su tono. <i>Protección</i> decide
          cuánto se suavizan los extremos (al bajarla, el contraste aprieta más);
          <i>Pivote</i> en automático gira sobre la luminosidad media de la foto, así
          que el contraste no la oscurece ni la aclara; «Usar heredado» recupera el
          cálculo antiguo. Con <b>Premium 👑</b> los colores conservan su saturación al
          aclararse (el cielo sigue azul en vez de palidecer hacia el blanco) y, donde la curva
          aplana las luces y las sombras, se recupera parte de la textura (nubes, piel, hierba)
          sin aspecto «HDR».</li>
        <li><b>Exposición.</b> Simula lo que hace una cámara: multiplica la luz en
          espacio lineal (un paso completo dobla o parte por dos la luz de toda la
          foto por igual), con Desplazamiento para un empujón fijo —más visible en
          sombras— y Gamma para curvar el resultado.</li>
        <li><b>Niveles.</b> Fija el punto negro, el blanco y el gris medio a partir del
          histograma; es lo primero que conviene tocar en una foto plana. Cada canal
          (RGB, Rojo, Verde, Azul) guarda sus propios valores por separado —cambiar de
          canal en el desplegable no pierde lo ya ajustado en el anterior—, y el
          maestro RGB se aplica encima de los tres, igual que en Curvas. Con <b>Premium 👑</b>
          todo se calcula en coma flotante, el maestro RGB ya no cambia el tono ni sobresatura
          (se aplica a la intensidad de cada color, no canal a canal) y <b>Automático</b> busca
          los colores más oscuros y más claros de la foto para neutralizar las dominantes y
          ajusta los medios. «Niveles automáticos Premium 👑» (Ajustes › Automáticos y cajón) hace lo mismo de
          un toque y deja una capa de Niveles que puedes afinar.</li>
        <li id="adj-curves"><b>Curvas</b> (<kbd>Ctrl</kbd>+<kbd>M</kbd>). Control punto a punto de toda
          la gama tonal. Clic añade un punto, arrastrar lo mueve, clic derecho o doble clic
          lo quita. <b>Automático</b> (o «Auto» en el móvil) calcula una curva para la foto:
          negro, blanco y medios; con <b>Premium 👑</b> también neutraliza las dominantes. En
          Premium la curva RGB no cambia el tono ni sobresatura y todo va en coma flotante.
          <ul>
            <li><b>Cinco curvas:</b> RGB (color), Rojo, Verde, Azul y <b>Luminosidad</b>. La
              de luminosidad cambia sólo el brillo, sin tocar tono ni saturación: una curva
              en S en RGB satura; en Luminosidad, no.</li>
            <li><b>Todas a la vez.</b> Mientras editas una, las demás se ven en tenue en su
              color, y con RGB los tres histogramas se superponen. «R · G · B a la vez»
              muestra los tres canales en tres paneles simultáneos.</li>
            <li><b>Vincular luminosidad y color.</b> Las dos curvas pasan a ser una sola
              —edites la que edites, la otra la sigue— y «Reparto color ↔ luminosidad»
              decide cuánto se aplica como color y cuánto como luminosidad.</li>
            <li><b>Estilos.</b> 25 curvas listas con miniatura: S suave, clásica y fuerte,
              desvanecido, mate de película, cine turquesa y naranja, proceso cruzado,
              vintage, clave alta y baja, solarizar, negativo… «Guardar estilo…» guarda la
              tuya en el navegador (clic derecho sobre uno propio para borrarlo).</li>
          </ul></li>
        <li id="adj-toneband"><b>Tonos del histograma…</b> Ajusta SÓLO una franja de tonos: toca
          el histograma del diálogo (o una de las zonas Negros, Sombras, Medios, Luces,
          Blancos) para elegirla, arrastra para moverla y usa la rueda para ensancharla.
          Brillo, contraste, saturación y calidez afectan sólo a esa franja, con bordes
          suaves. «Ver zona afectada» enseña en gris qué píxeles entran (desmárcalo antes
          de aplicar). Se abre también tocando una zona del panel Histograma.</li>
        <li><b>Sombras / Iluminaciones.</b> Distinto de Tonos: aquí cada píxel se
          corrige según el brillo MEDIO de su alrededor, no el suyo propio, así que un
          contraluz se abre sin aplanar el resto de la foto y un ojo oscuro en una cara
          iluminada no se trata como sombra. Radio decide el tamaño de ese entorno;
          Tono, lo ancha que es la transición. Con <b>Premium 👑</b> el entorno se mide sin
          cruzar los bordes (no aparece un halo alrededor de una silueta contra el cielo), el
          radio es relativo a la foto (la vista previa y el resultado coinciden), la textura de
          lo que se recupera no queda plana y los colores no se recortan.</li>
        <li><b>Balance de blancos.</b> Corrige un dominante de color (una foto
          demasiado azul o demasiado naranja) para que el blanco se vea blanco. Actúa sobre la
          imagen abierta en tiempo real. Con el <b>Cuentagotas</b> tocas en la propia imagen
          algo que deba ser blanco o gris (una pared, una camisa, una nube) y calcula la
          temperatura y el tinte que lo dejan neutro. La capa de ajuste «Balance de blancos»
          tiene el mismo cuentagotas, que lee lo que hay debajo de ella.</li>
        <li><b>Tonos (blancos/luces/sombras/negros).</b> Cuatro mandos por zona
          tonal, más simple que Curvas cuando sólo hace falta aclarar sombras o
          recuperar luces.</li>
        <li><b>Tono y saturación.</b> Matiz, saturación y luminosidad de toda la
          imagen; «Colorear» la tiñe entera de un solo tono. Con el interruptor
          <b>Premium 👑</b> trabaja en OKLCh (espacio perceptual) en luz lineal y coma flotante:
          girar el tono conserva la luminosidad de cada color, la saturación 0 da un gris de
          la misma luminosidad, los colores que se salen de la gama pierden croma en vez de
          torcerse y el resultado lleva tramado para que no aparezcan bandas.</li>
        <li><b>Vibrance.</b> Sube la saturación de los colores apagados más que la de
          los que ya son vivos —y protege un poco los tonos de piel—, distinto de la
          saturación llana de Tono y saturación.</li>
        <li><b>Color avanzado (submenú).</b>
          <ul>
            <li><b>Gradación de color.</b> Tres ruedas —sombras, medios y luces— con mezcla
              y equilibrio, como en un revelador de cine.</li>
            <li><b>Virado dividido.</b> Un tono para las sombras y otro para las luces, con
              su saturación y el equilibrio entre ambos.</li>
            <li><b>Filtro fotográfico.</b> Cálido, frío, sepia, verde o un color libre, con
              densidad y «Conservar luminosidad».</li>
            <li id="adj-rangehsl"><b>Tono y saturación por rangos</b> («Color por rangos» en el
              móvil). Un mezclador HSL de ocho rangos —rojos, naranjas, amarillos, verdes,
              aguamarinas, azules, púrpuras y magentas— con <b>matiz, saturación y luminancia</b>
              propios. Se elige el color tocando uno de los <b>ocho círculos</b>; con el
              <b>cuentagotas</b> (a su izquierda) tocas un color de la propia foto y se elige su
              rango, centrado en ese tono. <b>Intervalo</b> es cuántos grados de tono abarca el
              rango y <b>Difusión</b> cuánto de ese intervalo cae suavemente (100&nbsp;% = caída
              suave en todo el intervalo; 0&nbsp;% = borde duro). Los grises, blancos y negros no
              pertenecen a ningún rango, así que no cambian. Con <b>Premium 👑</b> el mismo
              ajuste se calcula en OKLCh y luz lineal: girar el tono conserva la luminosidad,
              la saturación actúa sobre el croma, hay mapeo de gama y tramado (sin bandas).</li>
            <li><b>Reemplazar color.</b> Elige un tono en la miniatura y cámbialo por otro,
              con tolerancia, saturación y luminosidad.</li>
            <li><b>Igualar color.</b> Copia el color y la luz de otra capa o de otra imagen
              (estadística en Lab), con intensidad regulable.</li>
            <li><b>Curvas Lab / luminosidad.</b> Curvas sobre L (luminosidad), a
              (verde/magenta) y b (azul/amarillo), independientes del color RGB.</li>
            <li><b>Color por canales.</b> El HSL de un revelador serio: rojos,
              amarillos, verdes, cianes, azules y magentas, cada uno con su propio
              matiz, saturación y luminosidad, más un maestro para toda la foto.</li>
            <li><b>Equilibrio de color.</b> Cian-Rojo, Magenta-Verde y Amarillo-Azul
              por separado en Sombras, Medios e Iluminaciones, con «Conservar la
              luminosidad» para que el tinte no aclare ni oscurezca la foto de paso. Con
              <b>Premium 👑</b> las zonas siguen la luminosidad percibida, cada mando empuja el
              color hacia su primario en OKLab (sin torcer el tono), la luminosidad se
              conserva exactamente y hay mapeo de gama y tramado.</li>
            <li><b>Corrección selectiva.</b> Cian/Magenta/Amarillo/Negro por rango de
              color —seis de matiz más Blancos/Neutros/Negros por brillo—, en método
              relativo: subir una tinta nunca «quema» de golpe un color ya muy puro.</li>
            <li><b>Mezclador de canales.</b> Cada canal de salida se compone con el
              tanto por ciento que se quiera de los tres de entrada; con Monocromo,
              una sola mezcla se reparte a los tres, como un filtro de cámara real.</li>
            <li><b>Mapa de degradado.</b> Sustituye cada píxel por un punto de un
              degradado de dos colores según su propia luminosidad; la base de
              cualquier viraje de color.</li>
          </ul>
        </li>
        <li><b>Tono y luz avanzados (submenú).</b> <i>Quitar neblina</i> (recupera contraste y
          color en fotos veladas, o añade niebla en negativo), <i>Tono HDR</i> (comprime el
          rango y realza el detalle local), <i>Contraste tonal</i> (micro, medio y
          macrocontraste por separado), <i>Contraste local (CLAHE)</i> (ecualización adaptativa por
          zonas con límite de contraste; con «Premium 👑» trabaja en la luminosidad percibida OKLab,
          con el color acompañando a la luz y tramado), <i>Densidad neutra graduada / radial</i> (exposición,
          contraste y temperatura sólo en una parte de la foto). <i>Tono / Color
          automático</i> está, con los demás automáticos, en <b>Ajustes › Automáticos</b> (también como «Tono / Color automático Premium 👑», que lo abre con el interruptor ya encendido); tiene interruptor <b>Premium 👑</b>: con los mismos mandos, el
          estiramiento y los medios se aplican a la intensidad de cada color (el tono y la
          saturación no cambian) y «Ajustar colores neutros» corrige la dominante como un
          balance de blancos en luz lineal, sin teñir los negros; con mapeo de gama y tramado.</li>
        <li><b>Umbral, Posterizar, Ecualizar, Desaturar.</b> Blanco y negro puro por un
          corte, reducir a pocos niveles, repartir el histograma y quitar color en
          parte o del todo.</li>
        <li><b>Blanco y negro.</b> Modo manual (mezcla de canales a mano) o
          automático, con dieciocho estilos con nombre propio y miniatura, cada uno
          inspirado en una manera distinta de revelar en blanco y negro —de un
          filtro rojo clásico a una simulación de infrarrojo o un cartel de alto
          contraste sin grano—.</li>
        <li><b>Invertir.</b> Un solo clic, sin panel.</li>
        <li id="adj-auto"><b>Ajustes automáticos</b> (Ajustes › Automáticos). Antes de corregir,
          <b>diagnostican</b> la foto como lo haría un retocador:
          <ul>
            <li><b>Dominante de color</b>: se estima el color de la luz con los bordes (casi
              siempre neutros, y no se dejan engañar por una pared naranja enorme) y con los
              píxeles grises que aparecen al ir corrigiendo, y se mezclan según la confianza.
              Verde/magenta y azul frío se corrigen casi del todo; un tono cálido, sólo en parte
              (la luz del atardecer o de interior es parte de la foto); si la escena está
              dominada por un color intenso (atardecer, bosque), mucho menos.</li>
            <li><b>Luces y sombras</b>: punto negro y blanco sin estirar lo que ya está quemado,
              sin tomar un brillo aislado (sol, reflejo) como «blanco» y con la ganancia limitada
              para no subir el ruido.</li>
            <li><b>Exposición</b>: sólo se corrige si está claramente mal; una escena clara u
              oscura a propósito (nieve, fondo blanco, noche) se respeta.</li>
            <li><b>Colores extremos</b>: el color más oscuro y el más claro neutralizan sombras y
              luces sólo si son casi grises; una lámpara amarilla o un mar azul no se «corrigen».</li>
          </ul>
          <b>Contraste automático</b> corrige sólo la luz (negro, blanco y medios), sin tocar el
          color. <b>Niveles automáticos</b> corrige además el color: negro y blanco de cada canal
          y medios neutros. <b>Tono / Color automático</b> hace lo mismo con mandos (modo, recorte,
          medios, neutros) y equilibra los neutros como un balance de blancos en luz lineal. Las
          versiones <b>Premium 👑</b> usan el mismo diagnóstico con el motor Premium: coma flotante,
          la luz aplicada a la intensidad de cada color (sin sobresaturar ni cambiar el tono),
          mapeo de gama y tramado. Contraste y Niveles Premium quedan como capa de Niveles que
          puedes reabrir para afinarla.</li>
        <li id="adj-lowlight"><b>Iluminar foto oscura</b> (Ajustes › Automáticos y cajón). Para fotos
          subexpuestas o de interior: calcula cuánta luz llega a cada zona y levanta cada una según
          la suya, así las sombras se abren y lo que ya estaba bien iluminado apenas cambia (en una
          foto bien expuesta no hace nada). La cantidad es automática; <b>Intensidad</b> la gradúa
          (60 % = automático). Con <b>Premium 👑</b> se hace en luz lineal sin virar los colores, con
          el mapa de luz ajustado a los bordes (sin halos), el negro devuelto a su sitio para que
          no quede lavado, el ruido de color de las sombras limpiado y tramado. Queda como capa
          que puedes reabrir.</li>
      </ul>` };
