/* ═══════════════════════════════════════════════════════════════
   GUÍA · tema «realify»
   Datos de la ventana de ayuda (js/ui/help/guide.js); topics/index.js reúne todos los temas.
   ═══════════════════════════════════════════════════════════════ */

export const realifyTopic = { id:"realify", title:"Realify · simulación de captura",
    desc:"La simulación de cámara completa: 31 etapas, motor Premium 👑, EXIF, análisis de plausibilidad.",
    sub: [
      { id:"orden", title:"El orden importa",
        desc:"Por qué el orden de las 31 etapas cambia el resultado, y qué bloque es cada una.",
        html:`
          <h3>El orden importa</h3>
          <p>Las etapas están en el orden en que la luz las encuentra —o, en las cuatro
            primeras y las cuatro últimas, en el orden en que se limpia lo que un
            generador deja y se codifica lo que una cámara entrega—. Mover una cambia el
            resultado, y no de forma sutil: el grano añadido antes del mosaico de Bayer
            se demosaica junto con la imagen y sale correlacionado entre canales, igual
            que en una cámara. Añadido después, sale independiente por canal, y eso se
            mide. Son <b>31 etapas</b> en total, agrupadas en siete bloques; la última no
            toca ni un píxel.</p>
          <ul>
            <li><b>1–4 · Antes de la óptica.</b> Rompe la microestructura propia del
              generador: rejilla de <i>upsampling</i>, picos espectrales, la forma
              general del espectro.</li>
            <li><b>5–12 · Óptica.</b> Lo que hace el objetivo antes de tocar el sensor,
              más la halación (rebote dentro del propio sensor).</li>
            <li><b>13–17 · Sensor.</b> Mosaico de color, sus dos firmas de ruido fijo y
              el ruido de cada disparo.</li>
            <li><b>18–22 · Procesador de la cámara.</b> Recorte, balance, curva,
              reducción de ruido y el residuo que deja detrás.</li>
            <li><b>23–25 · Superficie física.</b> Marcas de manejo, relieve, deformación
              anti-huella.</li>
            <li><b>26–30 · Archivo.</b> Croma, rastros de cuantización, limpieza final
              del espectro y códec.</li>
            <li><b>31 · Metadatos.</b> Deja el EXIF coherente con todo lo anterior.</li>
          </ul>` },

      { id:"etapas1", title:"Etapas 1–12 · Antes del sensor",
        desc:"Rejilla del generador, objetivo, profundidad de campo, aberración, halación, destello.",
        html:`
          <h3>Etapas 1–12 · Antes del sensor</h3>
          <h4>Antes de la óptica — romper la retícula del generador</h4>
          <ul>
            <li><b>Remuestreo con antialias.</b> Reduce la resolución interna y
              reconstruye con Lanczos: rompe correlaciones entre píxeles vecinos.</li>
            <li><b>Residuos multiescala (ondículas).</b> Atenúa detalle fino y medio con
              una descomposición à trous, protegiendo los contornos reales.</li>
            <li><b>Eliminar patrones de upsampling.</b> Filtro peine contra el tablero de
              ajedrez que deja una convolución traspuesta: picos exactos cada 2 y 4 px.</li>
            <li><b>Distribución de energía espectral.</b> Aplica el desenfoque óptico de
              una cámara real (vintage, DSLR, móvil o high-res) sobre el espectro
              entero, no sólo sobre la rejilla.</li>
          </ul>
          <h4>Óptica</h4>
          <ul>
            <li><b>Distorsión del objetivo.</b> Barril en gran angular, cojín en tele;
              las líneas rectas de un render salen perfectamente rectas.</li>
            <li><b>Profundidad de campo.</b> Desenfoca fuera del punto de foco, con
              discos de bokeh en las altas luces. En modo <b>Física</b> no se ajusta a
              ojo: el desenfoque se calcula con la fórmula real del círculo de confusión
              a partir del número f, la focal, la distancia de enfoque y el recorte del
              sensor, así que cambiar cualquiera de esos cuatro valores lo cambia
              exactamente como lo haría un objetivo real.</li>
            <li><b>Trepidación de cámara.</b> Arrastre lineal, zoom radial o
              microtemblor, más el cizallado de un obturador progresivo.</li>
            <li><b>Aberración cromática.</b> Separación de canales radial y creciente
              con el cuadrado del radio —esa geometría concreta es la clave—, más
              <i>fringing</i> púrpura en bordes de alto contraste.</li>
            <li><b>Nitidez de campo.</b> Peor resolución hacia la esquina, con
              astigmatismo (el desenfoque se alarga en una dirección, no es redondo).</li>
            <li><b>Viñeteo.</b> Caída de luz por ley del coseno a la cuarta, con
              desaturación aparte y forma ajustable de círculo a elipse (redondez).</li>
            <li><b>Halación.</b> Las luces atraviesan la capa fotosensible y rebotan en
              el respaldo del sensor, con dominante roja. Pirámide de tres niveles para
              la cola larga: un solo desenfoque deja un aura pegada al borde.</li>
            <li><b>Destello de lente.</b> Fantasmas, halo anamórfico y puntas de
              difracción sobre las luces muy intensas —geometría de cristal físico que
              ningún render tiene detrás.</li>
          </ul>` },

      { id:"etapas2", title:"Etapas 13–22 · Sensor y procesador",
        desc:"Mosaico Bayer, PRNU, ruido de disparo, recorte, balance, gradación, reducción de ruido.",
        html:`
          <h3>Etapas 13–22 · Sensor y procesador</h3>
          <h4>Sensor</h4>
          <ul>
            <li><b>Mosaico Bayer.</b> Muestreo RGGB y demosaico bilineal, «malo» a
              propósito: sus artefactos —cremallera, falso color— son los de una cámara.</li>
            <li><b>Patrón de filtro Bayer (CFA).</b> La periodicidad de rejilla 2×2 que
              un demosaico real deja detrás incluso reconstruyendo bien, fija por
              cámara: es la firma que la estimación forense de CFA usa para verificar un
              sensor real.</li>
            <li><b>Ruido PRNU.</b> La sensibilidad de cada fotodiodo varía un poco por
              imperfecciones de fabricación del silicio: multiplicativo, invisible en
              negro absoluto y FIJO —la misma cámara lo repite en todas sus fotos—.</li>
            <li><b>Ruido de sensor.</b> El de disparo crece con la <b>raíz de la
              señal</b>; el de lectura es casi constante, así que las sombras quedan con
              peor relación señal-ruido de forma natural, y «Más ruido en sombras» puede
              exagerar aún más esa asimetría. El grano se agrupa en cúmulos
              correlacionados, no píxel a píxel: el ruido blanco puro se reconoce al
              400&nbsp;%.</li>
            <li><b>Polvo del sensor.</b> Motas semitransparentes en las mismas
              posiciones en cada disparo de esa cámara.</li>
          </ul>
          <h4>Procesador de la cámara</h4>
          <ul>
            <li><b>Recorte y nivel de negro.</b> Cada canal satura a un nivel distinto,
              así que lo quemado vira en vez de quedar blanco puro; el negro tampoco es
              cero.</li>
            <li><b>Balance y curva.</b> Balance de blancos imperfecto y curva de
              contraste de fabricante. <b>Siempre se ejecuta</b>, aunque esté apagada:
              es donde se codifica de luz lineal a sRGB.</li>
            <li><b>Gradación por zonas.</b> Tinte independiente para sombras y luces, el
              look de cine que un balance de blancos global no reproduce.</li>
            <li><b>Reducción de ruido y enfoque.</b> Aplasta las sombras planas
              respetando contornos y añade enfoque con halos: ese contraste entre
              textura aplastada y bordes nítidos es la firma de un móvil.</li>
            <li><b>Residuos de ruido de cámara digital.</b> Lo que un denoiser real deja
              detrás sin limpiar del todo: textura de colas pesadas (no gaussiana),
              concentrada donde hay detalle —el denoiser es más tímido ahí— y aleatoria
              en cada disparo, al contrario que el PRNU.</li>
          </ul>` },

      { id:"etapas3", title:"Etapas 23–31 · Superficie, archivo y metadatos",
        desc:"Marcas de manejo, croma, compresión JPEG real, y el EXIF que casa con la óptica.",
        html:`
          <h3>Etapas 23–31 · Superficie, archivo y metadatos</h3>
          <h4>Superficie física</h4>
          <ul>
            <li><b>Rasguños y pelos de superficie.</b> Marcas de manejo de una copia
              impresa o un escáner, casi al azar.</li>
            <li><b>Microrrelieve de superficie.</b> Relieve real de la fibra del papel,
              visible sólo con la luz casi de refilón —gira con el ángulo que se le dé—.</li>
            <li><b>Micro-deformación.</b> Menos de dos píxeles de desplazamiento con
              ruido suave; no se ve, pero descorrelaciona la rejilla del generador sin
              tocar el contenido.</li>
          </ul>
          <h4>Archivo</h4>
          <ul>
            <li><b>Submuestreo de croma.</b> El color se guarda a media resolución y
              sangra sobre los bordes. El códec vuelve a hacerlo por su cuenta, así que
              esto se acumula.</li>
            <li><b>Rastros de la tubería JPEG.</b> Aproxima en la vista previa lo que la
              compresión real hace más abajo, sin verse: blockiness en los límites de
              8×8 y ringing (efecto Gibbs) pegado a bordes de contraste fuerte.</li>
            <li><b>Eliminar patrones periódicos.</b> La versión general del filtro peine
              de arriba: analiza el espectro completo por bloques y atenúa cualquier
              pico que sobresalga del fondo de su propio anillo, sea cual sea su paso.</li>
            <li><b>Normalizar pendiente espectral.</b> Distinto de lo anterior: no
              ataca picos, sino la <i>forma global</i> de la caída de energía con la
              frecuencia, para que siga la ley de potencia suave de una foto real.</li>
            <li><b>Compresión JPEG.</b> Codifica y decodifica de verdad con el códec del
              navegador, varias generaciones si hace falta. Bloques de 8×8 reales, no
              simulados. Es la única etapa de píxeles que no se ve en la vista previa
              —una compresión real no es cosa de recalcular en cada deslizador—.</li>
          </ul>
          <h4>Metadatos</h4>
          <ul>
            <li><b>EXIF coherente con la óptica.</b> No toca un píxel: puntúa cada
              cuerpo y objetivo de la base de datos EXIF por cuánto encajan sus rasgos
              físicos reales —focal, apertura máxima, tamaño de sensor, resolución— con
              lo que esta cadena tiene activado, y deja marcado el que mejor casa en el
              panel de metadatos. Cierra el hueco entre «qué distorsión se aplicó de
              verdad» y «qué objetivo dice el EXIF que la tomó».</li>
          </ul>` },

      { id:"mandos", title:"Los mandos que no son etapas",
        desc:"Semilla, cámara, Variar, Ajuste recomendado, dosis, aislar y diferencia.",
        html:`
          <h3>Los mandos que no son etapas</h3>
          <ul>
            <li><b>Semilla.</b> Fija el ruido de ESTE disparo: grano, micro-deformación,
              rasguños… Dos exportaciones con la misma semilla y los mismos ajustes son
              idénticas, y eso es una firma: usa «Nueva» o «Variar» entre imágenes.</li>
            <li><b>Cámara.</b> Fija el patrón FIJO del sensor —PRNU y patrón CFA—, que en
              una cámara real es idéntico en todas sus fotos. Mantenla igual en todo un
              lote y compartirán esa huella entre sí; cámbiala y es como haber usado otro
              cuerpo. Distinta de la Semilla a propósito: el grano cambia foto a foto, la
              huella del sensor no.</li>
            <li><b>Variar.</b> Desvía cada valor activo un 9 % y sortea semilla. Veinte
              salidas con la misma configuración comparten firma; ésta es la cura.</li>
            <li><b>Ajuste recomendado.</b> Mide ruido, detalle, recorte de luces y
              sombras, dominante de color, bloques JPEG ya presentes, rejillas y la
              pendiente del espectro sobre la imagen de origen, y propone un punto de
              partida coherente con lo que encuentra —menos grano si ya hay ruido, más
              si no, filtro peine sólo si hay una rejilla que quitar—. Explica lo medido
              junto al botón: no hay que aceptarlo a ciegas.</li>
            <li><b>Dosis manual.</b> Multiplica lo que hay en el panel al renderizar, sin
              mover los deslizadores. El 100 % devuelve exactamente tu selección.</li>
            <li><b>Aislar (S).</b> Apaga temporalmente todo lo demás para ver qué hace una
              etapa sola.</li>
            <li><b>Diferencia.</b> Muestra sólo lo que ha cambiado, amplificado. Si un
              efecto es sutil, es la única forma de saber si actúa débilmente o no actúa.</li>
          </ul>` },

      { id:"espectro", title:"El espectro",
        desc:"La rejilla periódica que delata un modelo de difusión, y cómo comprobar que desaparece.",
        html:`
          <h3>El espectro</h3>
          <p>Los modelos de difusión dejan una <b>rejilla periódica</b> en el espectro de
            frecuencia, herencia de las capas de sobremuestreo. Es el indicio más usado
            por los detectores. Ábrelo desde el panel del filtro (junto al histograma):
            si ves puntos regulares fuera del centro en «Origen» y no en «Salida», las
            cuatro etapas del bloque «antes de la óptica» —remuestreo, ondículas,
            eliminar upsampling, distribución espectral— y las dos de limpieza final del
            bloque «archivo» —eliminar patrones periódicos, normalizar pendiente
            espectral— están cumpliendo. El recorte es central y de 256 px sin escalar,
            porque escalar promediaría justo las frecuencias donde vive la rejilla.</p>` },

      { id:"exif", title:"Metadatos EXIF",
        desc:"Qué metadatos escribe la exportación, y qué deja deliberadamente sin escribir.",
        html:`
          <h3>Inspector de metadatos</h3>
          <p><b>Análisis › Inspector de metadatos…</b> enseña todo lo que lleva escrito el archivo original de la foto
            abierta (o de otro que elijas): EXIF, ubicación GPS, IPTC, XMP, perfil de color, MPF, Photoshop, notas del
            fabricante y la miniatura incrustada. Arriba, un resumen de lo que revela de quien la hizo —dónde, cuándo,
            con qué cámara, números de serie, autor— con los datos personales marcados. Se lee en tu equipo con
            ExifReader (MPL-2.0). <b>Limpiar metadatos de un archivo…</b> quita los metadatos de un JPEG o PNG sin
            recomprimir: <b>Todo</b>, o <b>sólo la ubicación y los números de serie</b> (conserva fecha, cámara, autor,
            descripción y orientación; sin miniatura ni notas del fabricante), y con o sin perfil ICC.</p>
          <h3>Metadatos al exportar y credenciales C2PA</h3>
          <p>En <b>Exportar…</b>, «Metadatos» vuelve a escribir (desde el archivo original, por lista blanca) autor, fecha, cámara, ubicación y
            descripción en <b>JPEG, PNG, WebP, AVIF, JPEG XL, TIFF y PDF</b>. «Todos los del original» incluye la ubicación, los números de serie y
            las <b>notas del fabricante</b> (también hay una casilla propia en «Personalizado»): se copian en el mismo sitio donde estaban. El IPTC
            viaja en JPEG, en PNG (perfil «Raw profile type iptc») y, traducido a XMP, en los demás formatos; los XMP de más de 64 KB se parten en
            «XMP extendido». <b>Editar…</b> (o <b>Análisis › Editar metadatos al exportar…</b>) deja escribir o cambiar título, descripción, autor,
            copyright, palabras clave, fecha y ubicación: abre con lo que trae el original, manda sobre él y se guarda en el proyecto; con una foto que no
            viene de un archivo sirve igual. Si vacías un campo que venía relleno con lo del original, se <b>quita</b> del archivo
            exportado. La nota del fabricante también va en AVIF, JPEG XL y TIFF (en TIFF sólo de Canon y Nikon: hay que reubicarla), y se lee el IPTC de PNG,
            TIFF y RAW. En el <b>lote</b> y las <b>Acciones en lote</b> (ZIP) cada foto conserva sus metadatos sin ubicación y se le pueden aplicar tus campos; en
            «Exportar PDF…» puede llevar el XMP del original. El inspector enseña además las <b>credenciales de contenido (C2PA)</b> si las hay (JPEG, PNG,
            WebP, JPEG XL, AVIF y HEIC): quién generó o editó el archivo, las acciones declaradas (y si dice que lo hizo una IA), la miniatura firmada y tres
            comprobaciones: la <b>firma</b> del manifiesto, la <b>cadena de certificados</b> (cada uno firmado por el siguiente) y que los datos
            sigan siendo los firmados (hash de datos o BMFF). No comprueba que el emisor esté en la lista de confianza de C2PA ni la revocación.
            <b>Firmar…</b> (en Exportar, para JPEG, PNG, AVIF y HEIC) escribe un manifiesto nuevo firmado con tu certificado (cadena PEM) y tu clave
            (PKCS#8); la clave sólo vive en la memoria de la pestaña, y el resultado se comprueba antes de entregarlo. Las credenciales que trajera el
            original no se conservan.</p>
          <h3>Metadatos EXIF (escribir)</h3>
          <p>La cadena exporta sin metadatos por defecto. El panel EXIF escribe una
            cabecera coherente: cuerpo, objetivo, y una exposición que <b>cuadra consigo
            misma</b>. El modo automático no sortea números sueltos, sino que fija un valor
            de exposición para la escena y deriva de él la velocidad a partir de la
            apertura y el ISO, de modo que el triángulo de exposición sea físicamente
            posible. Un f/16 a 1/2000 e ISO 100 en un retrato de interior es una
            contradicción que se detecta con una línea de código.</p>
          <p>Las coordenadas traen las 52 capitales de provincia con su altitud real, y
            se desplazan unos metros en cada exportación: un GPS nunca devuelve dos
            lecturas idénticas, y veinte fotos con la misma coordenada al microgrado son
            una constante que delata el lote. Ojo con una cosa: <b>casi ninguna réflex
            Canon lleva GPS integrado</b> —la 6D, la 6D Mark II, la 5D Mark IV y la 7D
            Mark II sí; una 600D no—. Eso no invalida el dato, porque geoetiquetar en el
            revelado es práctica normal, pero entonces la etiqueta <code>Software</code>
            debería estar puesta, que es justo lo que la cuenta.</p>
          <p>Lo que la herramienta <b>no</b> escribe es el <code>MakerNote</code>, el bloque
            propietario del fabricante. Es enorme, distinto en cada modelo, y falsificarlo
            de forma convincente es otro problema. Su ausencia es normal en un archivo
            que ha pasado por software de revelado, y es coherente con la etiqueta
            <code>Software</code>. Conviene saberlo: el EXIF resultante dice «cuerpo Canon,
            procesado en software», no «original intacto de cámara».</p>` },

      { id:"analisis", title:"Análisis y segunda opinión",
        desc:"El espejo que mide lo que la cadena fabrica, y tres algoritmos forenses independientes.",
        html:`
          <h3>Análisis de plausibilidad</h3>
          <p>El panel de análisis mide en la salida los mismos cinco rasgos que miran los
            detectores. No es un detector y no da garantías: es un espejo, para ver si la
            cadena está haciendo lo que crees. Una puntuación alta significa que los
            indicios <i>que esta herramienta sabe medir</i> están en su sitio, no que la
            imagen sea indistinguible de una fotografía.</p>
          <div class="callout">
            <p><b>Ojo con la circularidad.</b> Ese panel mide justo los cinco rasgos que la
              cadena fabrica, así que por construcción te va a dar la razón. Si subes el
              ruido de sensor, la barra del ruido sube: eso no es una comprobación, es un
              eco. Un 90/100 no dice «esto pasa por una foto», dice «hice lo que me
              pediste».</p>
          </div>

          <h3>Segunda opinión</h3>
          <p>Por eso hay un segundo panel con tres algoritmos forenses publicados,
            implementados a partir de la descripción del método y no de lo que hace la
            cadena. No saben nada de ella y pueden llevarle la contraria.</p>
          <ul>
            <li><b>Correlación CFA</b> (Popescu y Farid, 2005). Una imagen que ha pasado por
              un sensor con filtro de color tiene dos tercios de sus muestras interpoladas,
              y como el mosaico se repite cada dos píxeles, el residuo de predicción sale
              con periodicidad 2×2. Es el contrapunto real a la etapa 6.</li>
            <li><b>Nivel de error (ELA)</b>. Recomprime y mide cuánto cambia cada zona. Una
              imagen con un historial homogéneo cambia parejo en todas partes. El mapa dice
              más de un vistazo que el número: bultos claros donde el historial difiere.</li>
            <li><b>Peine de cuantización</b>. Cada codificación JPEG deja huecos periódicos
              en el histograma. Se busca esa raya en el espectro del histograma, por canal
              y no sobre la luminancia, porque al mezclar los canales con pesos no enteros
              el peine se difumina. Además del sí o el no, dice el paso aproximado.</li>
          </ul>
          <p>Cuando los dos paneles coinciden, la señal vale algo. Cuando el primero va alto
            y el segundo bajo, es que la cadena está haciendo ruido sin dejar la estructura
            que ese ruido debería tener.</p>` }
    ] };
