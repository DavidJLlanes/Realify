# Registro de cambios

Todos los cambios relevantes de [Realify](https://realify.es) se documentan en
este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Realify se publica de forma continua en [realify.es](https://realify.es), por lo
que las entradas se agrupan por fecha.

## [Sin publicar]

### Marcos
- **Marcos exteriores reales**: aplicar un marco amplía el lienzo y mantiene toda la fotografía intacta en el centro; el dibujo del marco queda recortado a la corona exterior y no puede superponerse sobre la imagen.
- **120 presets revisados**: las variantes se diferencian ahora por geometría, material, patrón, textura y acabado, no sólo por color o grosor.
- **Previsualización fiel**: las miniaturas y la vista previa muestran el espacio exterior que añadirá el marco antes de aplicarlo.
- **Deshacer/rehacer completo**: al quitar o recuperar un marco también se restaura el tamaño del documento, las guías y la selección.

### Capas, gestos y rendimiento
- **Capas**: doble clic en el nombre o clic derecho en la fila para renombrarla (con deshacer/rehacer). En escritorio siguen funcionando Ctrl/Cmd+clic y Mayús+clic; el botón de selección múltiple añade un modo táctil para marcar capas con toques y agruparlas desde la cabecera.
- **Combinar con la de abajo** ahora respeta la máscara de la capa superior y la composición alfa de los modos personalizados. Se evita combinar sobre capas inferiores cuyo estado (visibilidad, opacidad, fusión, máscara o efectos) haría que el resultado cambiase de aspecto.
- **Pinceles y herramientas de retoque**: Alt + botón derecho y arrastrar horizontal cambia el tamaño; arrastrar vertical ajusta dureza, al estilo Photoshop.
- **Ventanas**: el arrastre de la cabecera funciona también al salir de ella y sigue el modo de escritorio/móvil de la interfaz, no el tipo físico del dispositivo. Reemplazar cielo usa el mismo diálogo movible que el resto.
- **Iluminar con IA Premium**: se sustituyó la ordenación de millones de muestras para estimar el punto negro por un histograma de precisión fina. Reduce el trabajo y la memoria en imágenes grandes; el cálculo final sigue siendo a resolución completa.

### Máscaras de capa: pintar en negro ya oculta
- **El Pincel no ocultaba nada al pintar la máscara**: pintaba gris opaco y la máscara guarda
  la visibilidad en su canal alfa, así que el negro seguía «viéndose». Ahora el trazo se
  pinta aparte (punta, dureza, opacidad y dinámica de siempre) y su cobertura lleva la
  máscara hacia el gris elegido: negro oculta, blanco muestra, gris a medias; repasar dentro
  del mismo trazo no pasa de la opacidad elegida. Mismo arreglo para «Suprimir» con la
  máscara elegida.
- **Alt+clic en la miniatura de la máscara** enseña sólo la máscara y ahora también pinta
  sobre ella (antes sólo cambiaba la vista y se pintaba la imagen). Cambiar de capa o tocar
  la miniatura de la imagen vuelve a la vista normal.
- **Móvil**: un segundo toque sobre la máscara ya elegida abre su menú (ver y pintar sólo la
  máscara, volver a pintar la imagen, activar, aplicar, eliminar); en el ordenador el mismo
  menú sale con clic derecho, y Propiedades de la máscara trae el botón «Ver máscara».
- Propiedades de la máscara ya no deshace lo pintado con el panel abierto al mover Densidad
  o Desvanecer.

### Entrada de alta profundidad: los bits de la foto llegan a la exportación
- **La capa de fondo guarda los bits reales de la foto** cuando trae más de 8 por canal
  (`js/core/hisrc.js`); el lienzo sigue siendo de 8 bits y la exportación en coma flotante
  decide píxel a píxel: donde el lienzo sigue igual que el original usa sus 16 bits; donde
  se ha pintado, clonado o filtrado, lo que hay en la capa (deshacer lo devuelve al original).
- **Abrir en Realify desde el revelador RAW** (Premium): el revelado llega con sus 16 bits por
  canal, con el mismo tramado de siempre en el lienzo.
- **PNG y TIFF de 16 bits** (RGB, RGBA y gris; TIFF sin comprimir, LZW, Deflate, intel y
  motorola) con un lector propio (`js/io/hidepth.js`), y **AVIF de 10 y 12 bits** con el
  decodificador libavif + dav1d de jSquash (Apache-2.0 y BSD, 1,2 MB, sólo se carga para esos
  archivos). Los bits se aceptan sólo si coinciden con lo que decodifica el navegador, que
  aplica el perfil de color del archivo.
- Resultado medido con una foto oscura de 16 bits y +2,5 EV de exposición en una capa de
  ajuste: error medio de 0,001 niveles frente al cálculo ideal (0,69 partiendo de 8 bits, que
  es lo que se ve como bandas); en las sombras, 7 827 niveles distintos frente a 31.
- **Exportar** marca de entrada «Alta precisión» y «Tramado a 8 bits» cuando la foto trae
  más de 8 bits, y lo explica.
- Tope de memoria: hasta 12 MP en móviles y 32 MP en ordenador (6 bytes por píxel).

### IA a resolución completa por bloques
- **Motor común de bloques** (`js/ai/tiles.js`): bloques que se solapan, fundido con pesos
  suaves (nunca en el borde de la foto), número de bloques según el motor (más con GPU).
- **Profundidad** (Desenfoque por profundidad, Niebla por distancia, Foto 3D): además de la
  pasada global a 518 px, la foto a más resolución se parte en bloques; cada bloque se ajusta
  por mínimos cuadrados a la escala del mapa global y se funden sin costuras. Las formas
  grandes salen del mapa global y el detalle de los bloques: ahora aparecen los hilos de una
  red, las cruces de un puente o las farolas, que a 518 px se perdían.
- **Máscaras de cielo y de persona** (Seleccionar cielo, Reemplazar cielo, Seleccionar
  sujeto): la pasada global decide dónde hay cielo o persona y los bloques, con hasta 4 veces
  más detalle, afinan sólo la franja dudosa del borde (un bloque sin contexto no puede
  confundir una pared azul con cielo).
- **Caras a su resolución real**: en Restaurar caras, si la cara es mayor que los 512 px de
  GFPGAN, se le devuelve el detalle de la foto por encima de esa resolución (antes quedaba más
  blanda que el original). En Retoque de cara, las zonas (piel, ojos, labios) se ajustan con
  un filtro guiado a los bordes reales a la resolución de la foto.
- **Progreso y cancelar uniformes**: las operaciones de varias pasadas muestran un solo aviso
  con «bloque i de n» y un Cancelar que para la operación entera (antes el aviso parpadeaba
  en cada pasada y cancelar sólo paraba la pasada en curso).
- **Detección real de la GPU**: con WebGPU en el navegador pero sin una GPU utilizable, el
  motor pasaba a la CPU sin avisar y se elegían tamaños de bloque de GPU; ahora se comprueba
  que hay adaptador antes de usarla.

### Enfoque avanzado / estabilizador: sin pixelar y con deconvolución real
- **La vista previa ya no se queda pixelada**: se calculaba sobre una copia de 0,4 MP
  ampliada y así seguía hasta pulsar Aplicar. Ahora la copia reducida sólo se ve mientras se
  mueve un mando; al soltarlo se calcula a resolución completa, en el diálogo y en el panel
  de Propiedades, en móvil y escritorio.
- **Todo el cálculo va en workers**, repartido por franjas entre los núcleos del equipo
  (resultado idéntico al de una sola pasada): la interfaz no se congela con fotos grandes.
- **Motor nuevo en coma flotante sobre la luminancia** (`js/filters/sharpen-engine.js`): el
  detalle se suma por igual a R, G y B, así que el enfoque ya no tiñe los bordes ni realza el
  ruido de color.
  - **Deconvolución de foco**: antes era la máscara de enfoque multiplicada por 1,45; ahora es
    deconvolución de verdad (Van Cittert con PSF gaussiana).
  - **Estabilizador de movimiento**: antes la foto movida quedaba peor (−2 dB); ahora es una
    deconvolución Landweber con PSF en línea (+2,3 dB con el ángulo correcto).
  - **Reducir halos** limita de verdad lo que el resultado se pasa de sus vecinos (antes
    apenas actuaba).
  - **Umbral** con transición suave, **Proteger bordes** calculado sobre la luminancia y la
    franja de 1 px del borde de la imagen ahora también se enfoca.
- La prueba `tests/calidad-herramienta.mjs` mueve el deslizador del diálogo abierto (antes
  podía mover el de opacidad del panel Capas).

### Color de gama amplia: fotos Display P3 sin perder saturación
- **Diagnóstico**: las fotos de iPhone y de muchos Android vienen en Display P3. Todos los
  lienzos eran sRGB, así que al abrirlas el navegador recortaba los colores fuera de sRGB
  (un rojo P3 puro quedaba en 234, 51, 35 en lugar de 255, 0, 0) y al exportar se guardaban
  ya recortados y sin perfil.
- **Al abrir**, se compara la foto decodificada en P3 y en sRGB: si una parte apreciable no
  cabe en sRGB y el navegador sabe trabajar en P3, el documento entero pasa a **Display P3**
  (`js/core/colorspace.js`): capas, vista, herramientas y ajustes trabajan con los números P3.
  Se avisa al abrir. Las fotos sRGB no cambian en absoluto.
- **Al exportar**, nueva opción **Color** en documentos P3 (móvil y escritorio):
  **Display P3** con el perfil incrustado en JPEG (APP2), PNG (iCCP), PNG 16 bits (iCCP) y
  TIFF 16 bits (etiqueta 34675), o **sRGB** para la máxima compatibilidad (también en el
  motor de alta precisión, con la conversión en luz lineal). WebP, AVIF, TIFF de 8 bits, GIF,
  PDF, PSD y «Limpio para web» se guardan en sRGB, convertidos correctamente.
- Perfil ICC «Display P3» propio (`js/core/icc.js`), verificado con LittleCMS.
- El proyecto `.realify` y las pestañas recuerdan el espacio de color de cada documento.
- Límites conocidos: las herramientas que usan la GPU (WebGL) recortan a la gama sRGB; el
  color de pintura sigue siendo sRGB (el cuentagotas convierte bien, pero recorta los colores
  fuera de sRGB); «Abrir en Realify» desde el revelador RAW
  sigue en sRGB (fase 4).

### Exportación sin bandas: capas y ajustes en coma flotante, PNG y TIFF de 16 bits
- **Alta precisión al exportar** recalcula ahora todo el documento en coma flotante
  (`js/core/precision-stack.js`): capas, capas de ajuste (las diez), los 27 modos de fusión,
  opacidad, máscaras, recortes y grupos, sin redondear a 8 bits entre capa y capa. Antes cada
  capa de ajuste partía del resultado ya redondeado de la anterior: con una pila que comprime y
  vuelve a estirar los tonos, un degradado quedaba en 40 niveles con saltos de 9 (bandas); ahora
  conserva sus 197 niveles con saltos de 1. Verificado contra el compositor de siempre: misma
  imagen salvo ese redondeo (diferencia media de 0,05 a 0,6 niveles).
- Curvas, Niveles, Balance de blancos y Exposición exponen su fórmula continua
  (`curveFunction`, `levelFunction`, `wbGains`, `exposureFunction`); las tablas de 8 bits de
  siempre salen de esas mismas funciones (2100 tablas comparadas: idénticas).
- **Sin el límite de 8 MP**: se trabaja por franjas y se guarda en 16 bits por canal; hasta
  32 MP en ordenador y 16 MP en móvil. Al reducir, cada píxel promedia en luz lineal la zona
  que cubre; al ampliar, bilineal. La interfaz sigue respondiendo mientras se exporta.
- **Nuevos formatos: PNG 16 bits y TIFF 16 bits (máxima calidad)** en Exportar (móvil y
  escritorio), siempre con alta precisión; PNG con etiqueta sRGB y transparencia; TIFF RGB o
  RGBA.
- Con estilos de capa o «Fusionar si» (aún no reproducidos en coma flotante) se parte del
  compuesto normal y sólo el remuestreo y la salida son de alta precisión; el motivo se indica.

### Documentos legales: cambios sin previo aviso
- Aviso legal, Política de privacidad y Política de cookies indican que el titular puede
  modificarlos (y la aplicación) en cualquier momento y sin previo aviso, que los cambios se
  reflejan siempre en esos documentos y se aplican desde su publicación. Cada uno muestra la
  fecha de su última actualización.

### Licencia: uso libre de la web
- El código pasa a la licencia PolyForm Noncommercial 1.0.0. El Aviso legal de la app y el
  README aclaran que esa limitación es para el código: usar la aplicación en realify.es está
  permitido para cualquier fin, también profesional o comercial.

### Móvil: el zoom con dos dedos falla con Capas abiertas
- Con Capas abiertas (y con la herramienta Mano), tocar la imagen sólo desplaza y amplía, y el
  doble toque alterna entre ajustar y 100 %. Los dos dedos de un pellizco se apoyan casi a la vez,
  así que el segundo contaba como doble toque: la imagen saltaba a 100 % y el pellizco no llegaba
  a empezar. Ahora un toque con otro dedo apoyado nunca es doble toque.
- El doble toque para «ajustar» con Capas abiertas encaja la imagen en el hueco libre (antes
  usaba toda la pantalla y dejaba parte de la foto bajo los mandos).

### Ajustes y filtros: la imagen ya no queda pixelada
- En fotos grandes, **58 herramientas** dejaban la capa pixelada al aplicarlas (revisión
  automática de los 90 ajustes y filtros, en móvil y escritorio): casi todos los Ajustes
  (Tono / Color automático, Tono y saturación, Vibrance, Curvas, Niveles, Exposición…) y muchos
  filtros (Enfocar, Enfoque inteligente, Paso alto, desenfoques, Distorsionar, Estilizar…). El
  cálculo al aplicar sí era a resolución completa, pero el panel de Propiedades, al montar los
  mandos de la capa nueva, la repintaba con la vista previa reducida (~630 px ampliados), y así
  se veía y se exportaba hasta cambiar de capa. Ahora la capa conserva el resultado completo.
- Al dejar de mover un mando, la imagen se recalcula a resolución completa si el cálculo es
  rápido: en los ajustes, en el diálogo y en el panel de Propiedades; en los filtros pesados,
  sólo en el panel (en el diálogo ya lo hace Aplicar). Mientras se mueve se ve la copia rápida.
- Restauración de escaneados (Mediana, Polvo y rascaduras): la mediana se calcula con un
  histograma deslizante, con idéntico resultado; con una foto de 6 MP pasa de más de medio
  minuto con la app congelada a unos 3 segundos.

### Política de privacidad: registros del servidor web
- Nueva sección «Registros del servidor web»: qué se anota (IP, fecha y hora, archivo pedido,
  resultado, página de origen y navegador), para qué (sólo seguridad y diagnóstico de fallos;
  nada de analítica ni perfiles), base jurídica (interés legítimo, art. 6.1.f y considerando 49
  del RGPD), conservación (14 días, borrado automático), quién lo ve (sólo el responsable; el
  proveedor del servidor como encargado) y el registro de errores.
- Corregidos el resumen y «Tus derechos», que decían que no se guardaba ningún dato personal en
  servidores propios: ahora explican cómo ejercer los derechos sobre esos registros.

### La app no arrancaba con algunos bloqueadores de avisos de cookies (Firefox)
- Los filtros de «avisos de cookies» de algunos bloqueadores (uBlock Origin con EasyList
  Cookie o Annoyances, «I don't care about cookies»…) bloqueaban el archivo `cookiebar.js` por
  el nombre. Como se importaba al arrancar, sin él no arrancaba nada («No se pudo cargar
  main.js»). Confirmado con los registros del servidor: fue el único archivo que no se pidió.
- El archivo se llama ahora `prefsnote.js` y se carga aparte y sin bloquear: si un bloqueador lo
  quita, la app funciona igual, sólo que sin la barra informativa (la política sigue en Ayuda ›
  Cookies). Revisados los demás archivos de arranque: ninguno tiene nombres de ese tipo.

### Desenfoque por profundidad y Niebla por distancia: ya no se cierran al aplicar
- Al aplicar con una foto grande del móvil (12 MP o más) la pestaña se quedaba sin memoria
  (unos 2 GB en matrices a tamaño completo) y el navegador cerraba la foto sin aplicar nada.
- Ahora la profundidad, el desenfoque y la niebla se calculan a una resolución de trabajo
  (1600 px de lado largo en móvil, 2400 en ordenador) y se componen con la foto ORIGINAL a su
  tamaño real, por franjas y en luz lineal: lo enfocado queda exactamente como el original y
  el grano se añade a tamaño real. Las capas de desenfoque se suman una a una en vez de
  guardarse las seis a la vez. Más rápido (unos 3 s con 12 MP) y el resultado coincide mejor
  con la vista previa.

### Restaurar caras en iPhone (memoria)
- GFPGAN va ahora partido en dos mitades (codificador y generador, fp16; resultado idéntico al
  modelo entero): en móviles se carga una, se ejecuta, se suelta y luego la otra. El pico de
  memoria baja de ~1 GB a ~600 MB. Mismos 170 MB de descarga; el modelo entero antiguo se borra
  del navegador.
- La descarga de modelos ya no tiene el archivo tres veces en memoria a la vez (trozos, Blob y
  copia): cada trozo se copia a un único búfer.

### Foto 3D: guardar bien en cada sistema
- iPhone/iPad: en dos pasos («Crear GIF» y, cuando está listo, «Guardar»), porque Safari sólo
  abre la hoja del sistema justo tras un toque; allí «Guardar imagen» la deja en Fotos.
- Android: se descarga (Descargas, se ve en la galería). Ordenador: se descarga.

### Porcentaje de aplicación en las capas de IA
- Las herramientas de IA que dejan una capa del mismo tamaño que la foto tienen ahora el
  deslizador de **porcentaje de aplicación** de la capa («mezcla»), como los filtros: Difuminar
  caras, Retoque de cara, Restaurar caras, Ojos rojos, Borrador mágico, Desenfoque por
  profundidad, Niebla por distancia, Colorear con IA, Reemplazar cielo, Reducción de ruido con
  IA y Quitar artefactos JPEG con IA. 100 % = el resultado de la IA, 0 % = el original; no se
  vuelve a ejecutar la IA (instantáneo). En los parches con transparencia (caras, ojos…) se
  escala su intensidad, así se funde bien con lo que haya debajo aunque se apilen varias capas.
- Las que cambian el tamaño de la imagen (Ampliar, Expandir) no lo llevan.

### Cajón del móvil: pestañas a la primera
- A veces había que tocar dos veces una pestaña del cajón (Básicos → Estilo…): si la fila de
  pestañas aún se deslizaba por la inercia de un gesto anterior, el navegador usaba el toque
  para frenarla y no pulsaba. Ahora la pestaña se activa al levantar el dedo si apenas se ha
  movido, aunque la fila estuviera en movimiento; sin el «click» posterior, que al cambiar el
  cajón de alto podía caer en el velo y cerrarlo.
- La pestaña activa se centra desplazando sólo la fila (antes `scrollIntoView`, que en iPhone
  podía mover la página unos píxeles y desviar el siguiente toque).

### Caché y versiones (la app no arrancaba en algunos Firefox)
- Causa: los módulos ES se importan sin «?v=» y `.htaccess` daba 30 días de caché a JS y CSS;
  un navegador podía mezclar un `main.js` nuevo con módulos viejos («does not provide an export
  named…») y la app no arrancaba.
- `.htaccess`: HTML, JS, CSS, JSON y manifiesto con `Cache-Control: no-cache` (revalidar
  siempre, un 304 si no cambió); `sw.js` nunca desde caché. Imágenes, fuentes y modelos siguen
  con caché larga. (El ejemplo de nginx ya lo hacía con `expires -1`; anotado.)
- **Autorreparación** en el vigilante de arranque: si la app no arranca por un error de módulos
  (o no arranca sin más), una vez por sesión borra el service worker y la caché de la app,
  vuelve a pedir todos los módulos y hojas de estilo saltándose la caché y recarga. Si ni así,
  el panel con «Copiar diagnóstico».
- El service worker precachea `main.js?v=N`, la misma URL que carga `index.html`.

### Compatibilidad (Firefox y otros)
- **Aviso automático** al arrancar (móvil y escritorio) si el navegador bloquea o altera la
  lectura del lienzo (protección contra huellas de Firefox en modo estricto,
  resistFingerprinting, LibreWolf, Mullvad…), si no hay WebGL2 o si no deja guardar datos:
  una barra explica qué pasa y cómo arreglarlo, con pasos propios para Firefox.
- **Vigilante de arranque** (`js/boot-guard.js`, script clásico que se carga antes que la app):
  recoge los errores desde el primer momento y, si la app no arranca, muestra un panel con el
  error y «Copiar diagnóstico». El mismo botón está en Ayuda › Diagnóstico.
- El registro del service worker ya no puede lanzar un error en ventanas privadas o con el
  service worker desactivado.

### Iluminar con IA, automático
- **Iluminar con IA Premium 👑** mide la exposición antes de aclarar: busca sobre la foto
  reducida cuánto de la curva de Zero-DCE++ hace falta para llevar la mediana de la luz a un
  nivel natural (≈ 45 %). Una foto ya bien expuesta no cambia (antes subía su luz media de 117
  a 142); una algo oscura se aclara un poco y una muy oscura recibe la curva entera.
  «Intensidad» sigue graduándolo (100 % = automático).

### Realify Premium 👑
- El filtro **Realify** tiene modo Premium con los mismos mandos: interruptor con la corona
  en su barra (móvil: junto a ✕; escritorio: junto a Aplicar) y entrada «Realify Premium 👑»
  en el menú Inteligencia Artificial y en el cajón. Bueno: toda la cadena en coma flotante de
  32 bits (antes 16) y luces con hombro suave que conserva la proporción entre canales. Mejor:
  tinte y saturación en OKLab con mapeo de gama por croma (sin virar ni recortar colores) y
  tramado triangular al pasar a 8 bits. Se guarda en la capa de filtro, entra en
  deshacer/rehacer y se usa también al recalcular sin ventana. Apagado, idéntico a antes.

### Corrección de carga
- La guía de exportación vuelve a inicializarse sin interrumpir el arranque
  de la aplicación.

### Exportación profesional
- Exportar y Exportar como incorporan TIFF RGBA sin pérdidas de 8 bits.
  Exportar como añade PSD con grupos y capas rasterizadas; el compuesto mantiene
  la imagen final y una capa de referencia oculta si hay ajustes. El proyecto
  `.realify` conserva todos los parámetros reeditables.

### Realify en escritorio
- Cada una de las 31 etapas muestra un pequeño chevrón para abrir o cerrar sus
  mandos, con su estado accesible por teclado. El botón «S» de aislamiento
  muestra un icono de ojo; el selector móvil conserva su disposición.

### Recorte
- El selector de proporciones incorpora formatos numéricos para redes sociales,
  pantallas de móviles y monitores de PC, agrupados por uso. Se pueden girar los
  formatos fijos con ⇄; «A medida» conserva los campos de ancho y alto.

### Previsualización de cielos
- Las miniaturas de Poly Haven y las anteriores mantienen el mismo tamaño en
  Reemplazar cielo. En móviles, la fila adapta el ancho de las tarjetas al
  espacio disponible sin que los textos largos ensanchen las nuevas.

### Biblioteca ampliada
- Reemplazar cielo ofrece ahora 101 opciones: 82 fotografías CC0 de Poly Haven,
  16 cielos procedurales anteriores y 3 nuevos generados para Realify. Incluye
  búsqueda y filtros por momento del día y condiciones del cielo, con procedencia
  visible en cada miniatura. Las imágenes están alojadas en la propia web.
- Los diálogos se pueden arrastrar en un escritorio con la ventana estrecha;
  el gesto de cerrar la hoja en el diseño móvil conserva su comportamiento.

### Añadido
- **Biblioteca de cielos** en Reemplazar cielo (móvil y escritorio): 16 cielos CC0 generados
  para Realify (`assets/skies/`, con su generador): despejado, azul intenso, cúmulos, nubes
  dispersas, cirros, nublado, tormenta, dramático, atardeceres dorado y rosa, puesta con nubes,
  amanecer, hora azul, crepúsculo, noche estrellada y noche con luna. Miniaturas en rejilla
  (escritorio) o en una fila deslizable (móvil). El horizonte del cielo se coloca sobre el
  detectado y «Posición» lo ajusta.

### Cambiado
- **Sin TensorFlow.js**: BodyPix (Seleccionar sujeto), DeepLab ADE20K (Seleccionar y Reemplazar
  cielo) y MobileNet (Adaptive Photo Lens) se han convertido a ONNX con tf2onnx (mismos pesos)
  y corren en el worker de IA común con ONNX Runtime (WebGPU o WebAssembly). Fuera
  `tf.min.js`, BodyPix y DeepLab (≈ 2 MB de JavaScript) y sus dos workers.
- Cielo: DeepLab da ahora la probabilidad (no sólo la clase) y el borde de la máscara se ajusta
  a la foto con un filtro guiado: sin escalones ni halo del cielo antiguo al reemplazarlo.

- **Iluminar con IA Premium 👑** (Inteligencia Artificial › Mejorar y restaurar y cajón), con
  Zero-DCE++ (42 KB, se ejecuta en JavaScript, sin descarga aparte). La red estima a 320 px una
  curva de luz por punto y canal; los mapas se amplían con filtro guiado (sin halos) y las curvas
  se aplican en coma flotante; después, punto negro, limpieza del ruido de luz y de color de las
  sombras según lo aclarado, y tramado. Intensidad de 0 a 150 %. Capa de filtro que se reabre.
  Licencia CC BY-NC 4.0 (uso no comercial), aceptada mientras Premium sea gratuito.
- **Restaurar caras Premium 👑** (Inteligencia Artificial › Caras y cajón), con GFPGAN v1.4
  (Apache 2.0, convertido a fp16: 170 MB en dos trozos servidos por la web, descargados al
  usarlo con aviso y guardados unidos en IndexedDB). Cada cara (YuNet) se alinea a la plantilla
  FFHQ con sus cinco puntos, se restaura a 512 px y se pega en luz lineal con borde suave;
  si es pequeña, se filtra antes de reducirla; conserva el color de piel y el grano de la foto.
  Todas las caras en una sola pasada del modelo; toca una para excluirla; intensidad. Capa nueva.
- El worker de IA admite modelos partidos en trozos (`parts`), para alojar en GitHub archivos
  de más de 100 MB.

- **Profundidad Premium 👑** (Inteligencia Artificial › Profundidad y cajón), con Depth Anything
  V2 Small (Apache 2.0, convertido a fp16: 50 MB servidos por la web, descargados al usarlo con
  aviso y guardados en IndexedDB). El mapa se amplía y se ajusta a los bordes de la foto con un
  filtro guiado:
  - **Desenfoque por profundidad**: toca dónde enfocar (por defecto, el sujeto que sobresale del
    fondo); 6 capas de desenfoque en luz lineal con convolución normalizada (sin halos),
    bokeh en las luces intensas y el grano original devuelto. Capa nueva.
  - **Niebla por distancia**: densidad, inicio y color (automático, blanca, cálida, fría), en
    luz lineal y tramada. Capa nueva.
  - **Foto 3D**: paralaje en círculo, lateral o acercándose, con los huecos rellenos con el
    fondo; se guarda como GIF (30 fotogramas, 720 px).
- **Iluminar foto oscura** (Ajustes › Automáticos y cajón), con versión Premium 👑: mapa de
  iluminación tipo LIME/Retinex con cantidad automática; Premium en luz lineal conservando la
  proporción de canales, mapa con filtro guiado, punto negro recuperado, ruido de color de las
  sombras limpiado y tramado. Capa de filtro que se reabre.
- **Enderezar automáticamente** (menú Imagen y cajón › Corregir): mide todas las líneas casi
  horizontales y casi verticales (nitidez de la proyección a 1024 px, cada 0,1°, afinado con
  parábola), exige que las dos familias coincidan o que una domine con claridad y que haya
  tramos rectos continuos (no texturas); si no está claro, no propone nada. Vista previa con
  cuadrícula y deslizador para afinar antes de aplicar; sin esquinas vacías.
- **Recorte inteligente para redes Premium 👑** (Inteligencia Artificial › Encuadre): 7 formatos
  (Instagram 1:1 y 4:5, historias 9:16, YouTube/X 16:9, Facebook/LinkedIn 1,91:1, Pinterest 2:3,
  retrato 3:4); mapa de importancia con U²-Net y YuNet; gana el recorte que conserva más, no
  corta caras ni el sujeto, deja el sujeto en los tercios y es el mayor posible. Se arrastra
  para afinar.

### Cambiado
- Inteligencia Artificial: nueva sección **Encuadre** (Recorte inteligente y Recorte de retrato).

### Añadido
- **Caras Premium 👑** (Inteligencia Artificial › Caras y su pestaña del cajón), con YuNet
  (OpenCV Zoo, MIT, 232 KB, incluido en la web). Las caras se buscan en la imagen visible; en
  Premium, a dos escalas (640 px y teselas a 1280 px) para encontrar también las pequeñas:
  - **Difuminar caras**: óvalo ajustado a cada cara (toca una para excluirla), desenfoque,
    pixelado o relleno con intensidad; el desenfoque, en luz lineal sobre un pixelado previo y
    con ruido, no se puede revertir. Capa nueva.
  - **Retoque de cara**: BiSeNet (face parsing) separa piel, ojos, dientes y labios con bordes
    suaves; zona + intensidad: piel suavizada respetando bordes y con textura (luz lineal),
    ojos con más luz y detalle, dientes sin amarillo, labios con más o menos color (OKLab).
    Capa nueva. Modelo de 53 MB servido por la web y guardado en IndexedDB; entrenado con
    datos de uso no comercial (anotado para retirarlo si Premium pasa a ser de pago).
  - **Ojos rojos**: sólo el rojo conectado con la pupila, corregido en luz lineal sin tocar el
    reflejo. Capa nueva.
  - **Recorte de retrato**: abre Recortar con el marco encuadrado en la cara (ojos en el
    tercio superior, cabeza y hombros; 4:5 si el formato era libre).

### Añadido
- **Selección con un toque Premium 👑** (menú Inteligencia Artificial › Seleccionar y su
  pestaña del cajón): toca un objeto y la IA (Segment Anything: MobileSAM + decodificador de
  SAM) lo selecciona entero; más toques añaden partes y «Quitar» (o Alt / Mayús + clic)
  las excluye; deshacer y rehacer por puntos. Procesado Premium al aplicar: máscara de la IA
  ampliada con suavidad a la resolución de la foto, sin manchas sueltas ni agujeros pequeños
  y con el borde ajustado a los contornos reales (filtro guiado).
- **Borrador mágico Premium 👑** (Inteligencia Artificial › Borrar y rellenar): toca lo que
  quieras quitar y LaMa rellena el hueco en una capa nueva; la zona se agranda para llevarse
  el halo, la costura se funde en luz lineal y se devuelve el grano de la foto al relleno.
- **Base para modelos de IA**: los modelos grandes servidos por la propia web (SAM, 45 MB)
  también avisan del tamaño antes de bajarse y se guardan en IndexedDB; los que trabajan
  juntos se piden con un solo aviso y conviven en memoria. **Ayuda › Diagnóstico** muestra si
  hay WebGPU y los modelos descargados, con lo que ocupan y un botón para borrarlos.

### Cambiado
- **Menú y pestaña «Inteligencia Artificial» ordenados por finalidad**: Seleccionar, Borrar y
  rellenar, Mejorar y restaurar, y Para imágenes de IA. El cajón toma del menú el orden y los
  títulos, así que coinciden siempre en móvil y escritorio.

### Cambiado
- **Menú «Inteligencia Artificial»** (escritorio, tras Filtro; también en el menú del móvil) y
  **pestaña «Inteligencia Artificial»** en el cajón del móvil (la tercera, tras Básicos y
  Automáticos). Reúnen todas las herramientas de IA, en dos secciones:
  - **Herramientas con IA:** Eliminar fondo, Ampliar, Colorear y Expandir con IA, Reemplazar
    cielo, Seleccionar sujeto y cielo, Reducción de ruido con IA, Quitar artefactos JPEG con IA
    y Adaptive Photo Lens.
  - **Para imágenes de IA:** Realify, PurePixel, Unmark, Plausibilidad, Segunda opinión y
    Limpiar metadatos.

  Salen de Imagen, Selección, Filtro (Especiales y Ruido) y Análisis, y de las demás pestañas
  del cajón (siguen en «Todos» y en el buscador).
- La barra de menús de escritorio se aprieta un poco por debajo de 1100 px de ancho para que
  los once menús quepan.

### Mejorado
- **Los ajustes automáticos diagnostican la foto antes de corregirla** (nuevo
  `js/editor/autoanalysis.js`, común a Contraste, Niveles, Tono / Color y Mejora automática,
  normales y Premium 👑):
  - Dominante de color estimada con los bordes (gray-edge) y con grises iterativos, mezclados
    según la confianza. Verde/magenta y azul frío se corrigen casi del todo, el cálido sólo en
    parte, y mucho menos si la escena está dominada por un color intenso.
  - Negro y blanco sin estirar lo ya quemado, sin tomar brillos aislados como «blanco» y con
    la ganancia limitada (ruido); un fondo blanco teñido sí se neutraliza.
  - Exposición corregida sólo si está claramente mal (mediana fuera de L* 38-62); las escenas
    claras u oscuras a propósito se respetan.
  - Colores extremos («buscar colores oscuros y claros») y medios neutros por canal, sólo
    cuando esos extremos son casi grises (medido tras quitar la dominante general).
  - **Mejora automática Premium**: además fija negro y blanco, abre sombras de contraluz y
    recupera luces con detalle (Sombras / Iluminaciones Premium), no oscurece fondos blancos y
    protege la piel al subir el color.
  - En pruebas con 13 fotos degradadas (dominantes, subexpuestas, niebla…), el resultado desde
    la foto estropeada se parece mucho más al de la foto buena. Mejora automática Premium en
    subexpuestas: ΔE 10,4 → 1,6; con niebla: 5,8 → 3,7. Tono / Color en subexpuestas
    con dominante fría: 4,97 → 2,76. Y las fotos buenas se tocan menos: Niveles 5,8 → 4,7; Mejora automática
    5,9 → 5,3.

- **«Tono y color auto. Premium 👑»** en el cajón del móvil (pestañas Automáticos, Mejorar y
  Color, con corona) y **«Tono / Color automático Premium 👑…»** en Ajustes › Automáticos
  (escritorio y móvil): abre Tono / Color automático con el interruptor Premium ya encendido.
- **Submenú Ajustes › Automáticos** (primero de Ajustes, igual en escritorio y móvil, con iconos):
  reúne los siete ajustes automáticos, que antes estaban repartidos entre «Tono avanzado» y el
  final de Ajustes: Mejora automática (y Premium 👑), Tono / Color automático, Contraste
  automático (y Premium 👑) y Niveles automáticos (y Premium 👑).
- **Contraste automático Premium 👑** (menú Ajustes › Automáticos y cajón
  del móvil, en «Automáticos» y «Mejorar», con corona): el mismo recorte del 0,2 % de la
  luminancia, pero aplicado como Niveles maestros Premium: estira la intensidad de cada color en
  coma flotante, sin sobresaturar ni cambiar el tono, con gama y tramado. Queda como capa de
  Niveles reeditable.
- **Tono / Color automático Premium 👑** (interruptor en el propio ajuste, mismos mandos): en
  modo Tono el estiramiento y los medios van a la intensidad de cada color (un naranja ya no se
  quema a 248/89/0); en modo Color cada canal se sigue estirando por separado. «Ajustar colores
  neutros» mide los grises ya ajustados en luz lineal y corrige con una ganancia por canal
  (balance de blancos, 75 %, con topes) en vez de sumar un desplazamiento que teñía los negros.
- Curvas (escritorio): «Automático» va en su propia fila y «Restablecer canal» y «Restablecer
  todo» ya no salen cortados.

- **Pestaña «Automáticos» en el cajón de herramientas** (móvil), la segunda tras «Básicos»: reúne
  todos los ajustes automáticos (Automático, Auto Premium 👑, Tono y color auto., Contraste auto.,
  Niveles auto. y Niveles auto. Premium 👑), que siguen también en «Mejorar».
- **Curvas y Niveles Premium 👑** (`js/editor/tonepremium.js`): coma flotante sin los redondeos
  intermedios de las tablas de 8 bits; la curva o los niveles MAESTROS (RGB) se aplican a la
  intensidad de cada color y no canal a canal, así que una curva en S ya no cambia el tono (de
  2-4° en el modo normal a 0-0,2°) ni sobresatura; curva de Luminosidad en luz lineal; mapeo de
  gama y tramado. Los de cada canal siguen siendo canal a canal. Vista previa con tabla de 33³
  colores; el resultado final, exacto.
- **Automáticos**: el botón «Automático» de Niveles en Premium mide los colores más oscuros y
  más claros de la foto (el 0,1 % de cada extremo) y ajusta los tres canales y los medios de una
  vez (neutraliza dominantes; una foto azulada pasa de 98/110/143 a 110/113/118 de media). Nuevo
  **«Niveles automáticos Premium 👑»** (menú Ajustes, junto a «Niveles automáticos», y cajón del móvil, con
  corona): lo mismo de un toque, como capa de Niveles reeditable. **Curvas** gana un botón
  **«Automático»** («Auto» en el móvil): negro, blanco y medios; en Premium también neutraliza
  las dominantes por canal.
- En Curvas el interruptor Premium va arriba a la izquierda, junto a ✕; en Niveles, a la
  izquierda de Cancelar/Aplicar.

### Añadido
- **Sombras / Iluminaciones Premium 👑** (con Radio y Tono): el entorno de cada píxel se mide
  con un filtro guiado sobre L* que no cruza los bordes, así que una silueta oscura contra un
  cielo claro ya no queda con una banda oscura arriba y una neblina abajo, como en el modo
  normal; radio relativo al tamaño de la imagen (la vista previa reducida y el resultado final
  coinciden); la corrección va a la base y la textura se conserva y refuerza hasta un 35 % donde
  se abren sombras o se recuperan luces; transiciones en S; color en luz lineal con mapeo de
  gama y tramado. En el móvil, el interruptor a la izquierda de Cancelar/Aplicar.

### Cambiado
- **Brillo y contraste Premium, rehecho**: el anterior se distinguía poco del normal y, cuando
  se notaba, parecía artificial (textura realzada, aspecto «HDR»). Ahora la curva se aplica a la
  intensidad de cada color (media de potencias de R, G y B) en vez de a la luminancia, y los tres
  canales se escalan por igual: los colores intensos no se desaturan al aclararse y el cielo
  sigue azul donde el modo normal lo lleva casi a blanco. La textura sólo se recupera en parte
  (la mitad de lo que la curva aplanaría, nunca más que la original, base de filtro guiado ancho)
  y nada al bajar el contraste; los bordes duros quedan limpios (±2 niveles).

### Añadido
- **Auto Premium 👑** en el cajón de herramientas del móvil (y en Ajustes › Tono avanzado ›
  «Mejora automática Premium»): mejora de un toque con los motores Premium. Balance de blancos
  en luz lineal estimado con los píxeles casi neutros (o «shades of gray»), corregido al 75 % y
  con topes para no borrar una luz cálida buscada; color con más croma cuanto más apagado (sin
  tocar los colores ya intensos), en OKLab con mapeo de gama y tramado; y luz con Brillo y
  contraste Premium a partir de los percentiles de L*. Los valores medidos se guardan en su capa
  de filtro («auto-premium»), así que volver a calcularla da el mismo resultado.

### Cambiado
- **Cajón de herramientas (móvil)**: se quita el botón grande «Automático» de la cabecera. En su
  lugar, «Automático» y el nuevo «Auto Premium» (dorado y con la corona) van primero en la
  rejilla y resaltados: fondo y borde de color e icono dentro de un círculo. «Mejora automática»
  también en Ajustes › Tono avanzado, para que el menú sea el mismo en móvil y escritorio.

### Añadido
- **Brillo y contraste Premium 👑**: la curva se aplica a la base de la imagen (filtro guiado
  rápido, que suaviza sin cruzar bordes) y la textura se conserva con al menos su amplitud
  original. Con contraste +80 la textura de las luces quedaba al 59 % en el modo normal; en
  Premium se conserva entera (con brillo +60, del 57 % al 100 %). Sin halos apreciables (2-4
  niveles en el píxel pegado a un borde duro) y −100 sigue dejando la imagen plana. El resto,
  como el motor normal: tono conservado, mapeo de gama en OKLab y tramado.
- **Equilibrio de color Premium 👑**: zonas por luminosidad percibida (OKLab), cada mando empuja
  hacia su primario en el plano de color de OKLab (calibrado para empujar lo mismo que el modo
  normal), «Conservar la luminosidad» exacta (±0,002 en L), negros sin manchar, mapeo de gama y
  tramado.
- Motor de color Premium común para los ajustes que transforman cada color por separado
  (`js/editor/premiumcolor.js`, lo usan Tono y saturación y Equilibrio de color). En ambos
  ajustes el interruptor va, en el móvil, a la izquierda de Cancelar/Aplicar.

### Cambiado
- **Interruptor Premium 👑 en el móvil**: ya no ocupa una fila propia. Va en la barra del botón
  de aplicar, alineado a la izquierda, siempre con la palabra «Premium» junto a la corona e
  idéntico (mismo tamaño y estilo) en todos los plugins: en Tono y saturación, a la izquierda de
  Cancelar/Aplicar; en la Fusión HDR y el revelador RAW, arriba a la izquierda junto a ✕. Las
  hojas de ajuste compactas del móvil ocupan menos alto (Tono y saturación: de 227 a 195 px),
  para que la imagen tenga más sitio. En escritorio no cambia nada (`dockPremium` en
  `js/ui/premium.js`).

### Añadido
- **Tono y saturación Premium 👑**: interruptor con corona en el ajuste. Mismos mandos, motor
  en OKLCh, luz lineal y coma flotante: al girar el tono se conserva la luminosidad percibida
  (en el modo normal un amarillo girado a azul pasaba de 0,58 a 0,11 de luminancia; en Premium
  se queda en 0,57), la saturación trabaja sobre el croma, Luminosidad apaga el color al
  acercarse al blanco o al negro, Colorear conserva la luminosidad de cada píxel, mapeo de
  gama sin recortar canales y tramado al volver a 8 bits. Vista previa en vivo con una tabla de
  33³ colores interpolada en luz lineal; el resultado final se calcula color a color
  (`js/editor/hslpremium.js`). Apagado, el ajuste es idéntico al de siempre.

### Corregido
- **Los desplegables ya no aparecen abiertos al abrir un ajuste en el iPhone**: el diálogo
  daba el foco a su primer mando y, en iOS, enfocar un desplegable lo despliega (pasaba en Tono
  y saturación y en cualquier ajuste con desplegable). En pantallas táctiles el foco va ahora a
  la propia ventana; los desplegables aparecen siempre cerrados.

### Corregido
- **Balance de blancos sin miniatura**: se quita la vista previa que abría la herramienta (y su
  capa de ajuste). Actúa sobre la imagen abierta en tiempo real con la misma interfaz mínima
  que los demás ajustes (en el móvil, un desplegable Temperatura/Tinte y su deslizador), y el
  **Cuentagotas** se usa tocando directamente la imagen abierta.
- **Más sitios donde el teclado del móvil tapaba lo que escribías**: revisados todos los campos
  de texto. Estaban tapados el texto de **Memes**, los textos de **Collage / History / Post**,
  las semillas de **Cámara** (Realify), los campos del grupo Motor del **revelador RAW** y el
  cuadro de la herramienta **Texto** cuando está en la parte de abajo de la foto. Ahora los
  editores a pantalla completa terminan donde empieza el teclado (su pie queda a la vista) y,
  con la herramienta Texto, la imagen sube lo justo para ver el cuadro y vuelve al cerrar el
  teclado (`js/ui/keyboard.js › installKeyboardFit`).

### Añadido
- **Diálogos usables con el teclado del móvil**: al escribir en un diálogo (las medidas de
  «Documento nuevo», un nombre, un número…), la hoja sube y se apoya encima del teclado en vez
  de quedar tapada, y el campo activo se mantiene a la vista; al cerrar el teclado vuelve a su
  sitio. Mismo arreglo que el buscador del cajón de herramientas, ahora compartido
  (`js/ui/keyboard.js`).
- **Cuentagotas de punto blanco** en todo lo que tiene balance de blancos: tocas algo que deba
  ser blanco o gris y la temperatura y el tinte se calculan para dejarlo exactamente neutro.
  - **Revelador RAW / Revelado fotográfico** (normal y Premium 👑): botón sobre la vista
    previa; lee la foto en luz lineal antes de revelar, en el espacio donde se aplica el
    balance (Rec.2020 en Premium) y, si la dominante no cabe en los mandos, elige también el
    preajuste de balance más cercano.
  - **Balance de blancos** (plugin) y su **capa de ajuste**: botón «Cuentagotas» visible (antes
    había que saber que se podía tocar la miniatura), media de 5×5 píxeles en vez de uno, marca
    en el punto elegido y cálculo exacto (antes quedaba casi, pero no del todo, gris). La capa
    lee lo que hay debajo de ella.
  - **Fusión HDR** (normal y Premium): Color › «Cuentagotas de balance de blancos»; se lee la
    imagen mapeada antes del acabado.
- **Buscador del cajón de herramientas usable con el teclado del móvil**: al escribir, el cajón
  sube y se apoya encima del teclado (antes el teclado tapaba los resultados); la tecla
  «Buscar» cierra el teclado y deja los resultados a pantalla completa; al cerrar el teclado o
  elegir una herramienta, el cajón vuelve a su tamaño normal. Android e iPhone.
- **Barra de grabación de acciones flotante**: se arrastra por el asa ⠿ o por el texto a
  cualquier sitio de la pantalla (ratón o dedo) para dejar libre la barra superior; recuerda la
  posición y no se sale de la pantalla al girar el móvil o cambiar el tamaño de la ventana.

### Corregido
- **Actualizaciones que no llegaban**: tras publicar, el móvil podía seguir usando durante horas
  archivos antiguos (p. ej. los del Filtro Vintage) guardados en la caché del navegador. El
  service worker ahora pregunta siempre al servidor si hay versión nueva antes de usar la copia
  guardada (sin conexión sigue funcionando igual).
- **Filtro Vintage · hoja de marcos**: todas las miniaturas del mismo tamaño y alineadas en su
  rejilla (antes algunas se salían de la tarjeta en el móvil), nombres de dos líneas como
  máximo, miniaturas más nítidas en pantallas de alta densidad y el selector de categoría
  sigue al desplazamiento.

### Añadido
- **Filtro Vintage: 119 marcos y 113 estilos nuevos**. Nuevo desplegable **Marco** (escritorio y
  móvil) que abre una hoja con la miniatura de cada marco sobre la propia foto, en 10 categorías:
  instantáneas, película (35 mm, 120, súper 8, diapositivas, limados), papel antiguo (barbado,
  festoneado, albúmina, gabinete, paspartús), marcos de cuadro (dorados, plata, maderas, laca,
  art déco), postales y sellos, viñetas y formas (óvalos, camafeo, cerradura, corazón…),
  pantallas y visores (televisor, VHS, videocámara, telémetro…), desgaste (quemado, agua,
  grunge, moho), decorativos (encaje, greca, neón, azulejo…) y álbum (esquinas, washi, clip).
  «Anchura del marco» en el grupo Bordes. 215 estilos en 19 categorías; 11 categorías nuevas
  (laboratorio, cine clásico, viajes y postales, retratos antiguos, instantáneas, álbum de
  familia, noir, pop y psicodelia, tecnología retro, galería y museo, papel y archivo) y 87
  estilos que ya traen su marco (`vintagefilter/frames.js`).
- **Aviso de móvil en horizontal**: en un teléfono (Android o iPhone) girado, un aviso explica
  que Realify está optimizado para el móvil en vertical y que la versión de escritorio es para
  ordenador. Desaparece al volver a vertical; «Seguir en horizontal» lo oculta hasta cerrar la
  pestaña. No sale en tabletas ni ordenadores (`js/ui/landscape.js`).
- **Borrar guías más fácil**: doble clic o doble toque sobre una guía la borra (antes sólo
  arrastrándola hasta la estrecha franja de la regla, incómodo con el dedo). «Borrar guías»
  también en el cajón de Herramientas del móvil, con su icono. Tocar una guía sin moverla ya
  no deja un paso vacío en el historial.
- **Fusión HDR Premium 👑**: interruptor con corona en la ventana del HDR, mismos mandos y
  estilos. Curva de respuesta de la cámara estimada del horquillado (Robertson + polinomio
  suave, o sRGB si no mejora), RAW fusionados en luz lineal Rec.2020 con su nivel de recorte,
  fusión de máxima verosimilitud (menos ruido y sin el sesgo de las sombras profundas),
  alineación con fracción de píxel (Lucas–Kanade), antifantasmas por zonas que también ve el
  color, tono y color en OKLab con tramado, y exportación a **TIFF 16 bits** y radiancia
  **.hdr**. Apagado, el HDR sale idéntico al de antes. Pruebas en `hdr/tests/premium.mjs`.
- **Revelado RAW Premium 👑**: interruptor con corona en el revelador (también en Revelado
  fotográfico). Mismo revelador y mismos mandos, motor de alta calidad: Rec.2020 sin recortar
  colores, demosaico DHT, luz lineal real en coma flotante, sombras/altas luces/claridad con
  filtros guiados sin halos, curva fílmica que lleva las luces al blanco sin quemarlas, ruido de
  color guiado, color en OKLab con ajuste de gama que conserva el tono, tramado, reducción en
  luz lineal con enfoque de salida y **TIFF de 16 bits**. Vista previa en GPU con la misma
  matemática que el resultado (ΔE < 0,4). Apagado, el revelador queda exactamente como antes.
  Componentes reutilizables de corona e interruptor Premium (`js/ui/premium.js`); aún sin pago.
- **Capas a pantalla completa en el móvil** (cualquier orientación): la imagen lo más grande
  posible, barra superior con cerrar, nueva, duplicar, eliminar, deshacer y rehacer, y una
  lista que deja ver dos capas y se desplaza. Tocar la imagen sólo la mueve o amplía. El botón
  fx/adj abre su editor encima sin cerrar Capas. Ya no se vuelve transparente la hoja al
  mover un deslizador. En escritorio no cambia nada.
- **Android: «Abrir» va directo a la galería** (el selector pide sólo imágenes; con
  extensiones añadidas, Android mostraba «Cámara / Archivos»). Nuevo **Archivo › Abrir RAW,
  PSD, TIFF o SVG…** (y enlace en la pantalla de inicio) para esos formatos, que no salen en
  la galería. En la Fusión HDR, el «+» ofrece Galería o Archivos.
- **Transparencia al guardar, en toda la web**: casilla «Conservar la transparencia» y color
  de fondo en Exportar, Exportar como, Editar en lote, Acciones y Cortar en partes
  (`js/io/alpha.js`). Se guarda el acoplado de las capas visibles; PNG, WebP, AVIF y GIF
  conservan la transparencia y JPEG/PDF rellenan con el color elegido. Con transparencia,
  Exportar propone PNG.
- **Recortar en forma** recorta sólo la capa activa, oculta las demás capas y avisa de cómo
  guardar con transparencia (con botón para exportar).
- **Fusión HDR, máximo de 11 fotos con aviso**: si se eligen más, un diálogo deja escoger
  cuáles (contador «9 de 11», no deja pasar del límite) antes de abrir ninguna; con 11 el
  botón de añadir lo indica y explica cómo liberar sitio. Las fotos con otra proporción
  u orientación se descartan de una en una, con aviso, sin rechazar las demás.
- **Fusión HDR con RAW**: revelar la primera y aplicar los mismos ajustes a todas,
  revelar una a una en el revelador RAW o usar su JPEG incrustado; la exposición sale
  de los metadatos del RAW.
- **Fusión HDR con las fotos abiertas**: elige, con miniaturas, las pestañas abiertas
  y entran tal como las estás editando.
- **Fusión HDR**: ordenar las fotos arrastrándolas (ratón, o mantener pulsado con el
  dedo); la exposición sigue al orden. EV contados desde la foto normal (−2 / 0 / +2).
- **Fusión HDR**: «Foto elegida» es el primer grupo (escritorio y móvil), con la
  exposición en tercios de paso, botones − / + y **Pasos entre fotos** para todo el
  horquillado de golpe; grupos ordenados según el flujo de trabajo y tira de fotos
  más cómoda en el móvil.
- **Guía actualizada** con todo lo nuevo: tiradores, cerrar todas las fotos, editar
  en lote, antes y después, hoja de contactos, GIF, AVIF y PDF, acciones, paleta,
  cuentagotas de pantalla y zoom con el efecto abierto.
- **Tiradores más fáciles de agarrar**, sobre todo con el dedo (`js/editor/grab.js`):
  zona de agarre mayor en táctil y lápiz, tiradores más grandes, gana el más cercano
  cuando se solapan y no saltan bajo el dedo al cogerlos. En Recortar, Transformar,
  Deformar, Perspectiva, formas, marco y trazado del texto, pluma, guías, Formas,
  Cortar y Galería de desenfoque.
- **Cerrar todas las fotos**: en Archivo, en Herramientas y en la barra de pestañas;
  una sola confirmación.
- **Fusión HDR** (`hdr/`): hasta 11 fotos, horquillado detectado solo, alineación,
  antifantasmas, fusión de exposición y mapeo tonal con 17 estilos.
- **Unir imágenes** (`unir/`): panorámica automática y unión en fila, columna o
  cuadrícula.
- **Cortar en partes** (`cortar/`) y **Recortar en forma** (`formas/`, ~60 formas)
  a pantalla completa, sustituyen a «Dividir en trozos» y al diálogo anterior.
- **Antes y después** (`comparar/`) y **Hoja de contactos** (`hojacontactos/`).
- Exportar en **AVIF** y **PDF**; **GIF animado** a partir de las capas.
- **Paleta de colores** y **cuentagotas de pantalla**.
- **Acciones**: grabar y repetir secuencias de comandos, también en lote.
- **Editar en lote / Aplicar esta edición a otras fotos** (`lote/`): edita una
  foto y copia su edición (ajustes, filtros, textos, marcas de agua) a otras
  pestañas o fotos de la galería, con vista previa, **igualado de exposición**
  y resultado en sus pestañas (capas reeditables) o en un ZIP.
- Capa de ajuste **Exposición** (en pasos EV).
- IA: **ampliar** ×2/×4, **colorear** y **expandir** el lienzo.
- Zoom y desplazamiento de la imagen mientras se aplica cualquier efecto.
- Aviso visible con botón Cancelar mientras trabaja la IA; si un modelo pesado
  agota la memoria y la página se recarga, la imagen se recupera.

### Cambiado
- **Brillo y contraste de precisión** (filtro y capa de ajuste): cálculo en coma flotante
  sobre la luminosidad percibida (L*) en lugar de una tabla de 8 bits canal a canal. El
  contraste es una curva en S alrededor del gris medio que fija el negro y el blanco (antes
  una recta que, a +50, ya recortaba las luces por encima de 215 y las sombras por debajo
  de 40); el brillo mueve los medios tonos sin recortar. El color se escala en luz lineal y,
  si no cabe, se reduce el croma en OKLab: el tono se desvía 0,2° de media (antes 5–9°, y
  hasta 70°). Los ajustes guardados siguen valiendo (mismos −100..100).
  Además: **tramado** fino y fijo al volver a 8 bits (disuelve las bandas en cielos y
  degradados), **pivote automático** sobre la luminosidad media de la foto (el contraste
  ya no oscurece las fotos oscuras ni aclara las claras; opción «Gris medio»), mando de
  **Protección de luces y sombras** y casilla **Usar heredado** con el cálculo antiguo.
- **Eliminar fondo** crea una capa nueva con el recorte y oculta la original.

### Eliminado
- «Procesar carpeta» (y el botón «Abrir lote» del inicio): sólo aplicaba el
  filtro Realify con variaciones; lo sustituye «Editar en lote».

### Corregido
- Escritorio: en los menús de herramientas agrupadas de la barra izquierda (mantener pulsado o
  clic derecho) los iconos y nombres salían centrados; ahora van alineados a la izquierda.
- **Revelador RAW, luz lineal real**: el motor (LibRaw-Wasm) entrega los datos con la curva
  BT.709 aunque se le pida lineal, y el revelado los trataba como lineales: todo salía más
  claro y los ajustes de exposición, balance y tono trabajaban sobre valores equivocados.
  Ahora se deshace esa curva exactamente, en la vista previa, el resultado y el balance
  automático (con +0,3 EV de exposición base, como las cámaras): el gris medio queda en
  ~130/255, igual que en Premium. Los RAW revelados antes se verán algo más oscuros.
- Aviso de versión nueva: con el service worker bloqueado (navegación privada, políticas de
  empresa) lanzaba un error a los 5 s y cada 30 minutos. Era lo que hacía fallar la prueba
  `raw/tests/editor-transition.mjs`, que ahora pasa.
- Revelador RAW: en el menú del motor, «Rec.2020» y «DCI-P3» estaban intercambiados; la
  cabecera mostraba «[object Object]» en lugar del objetivo.
- «Editar en lote» (pantalla de inicio) necesitaba dos pulsaciones en el móvil: el selector
  de fotos se abría después de descargar el código del lote y el navegador ya no lo
  permitía. Ahora se abre en el mismo toque; igual en Cortar y Recortar en forma sin
  documento, en Acciones en lote e importar acciones, y al añadir fotos en el HDR.
- Exportar en JPEG una imagen con zonas transparentes las volvía negras; ahora se rellenan
  con el color de fondo elegido (blanco por defecto).
- Fusión HDR con horquillados largos (hasta 11 fotos, ±5 EV): la alineación fallaba en
  las tomas extremas (hasta 43 px de error, y el resultado salía muy recortado). Ahora
  combina tres métodos y dos criterios: error máximo de 2 px en las pruebas. Menos
  memoria al cargar muchas fotos, progreso «Alineando · k de n» y, en el móvil, copia
  de seguridad de las fotos abiertas por si la página se cierra.
- Los diálogos y avisos quedaban detrás de los editores a pantalla completa (HDR,
  Unir, Cortar, Formas…).
- Fusión HDR: el resultado se abre siempre como una foto nueva (pestaña propia,
  historial vacío). Si la imagen abierta era del horquillado, antes se añadía como capa
  encima y Comparar enseñaba la foto original en vez del HDR.
- Comparar: tras crear un HDR (o cualquier resultado que se abre en una pestaña
  nueva) el «antes» salía vacío, y al cambiar de pestaña se perdía y pasaba a ser la
  propia edición. Ahora cada pestaña guarda su «antes». Al cerrar la foto con Comparar
  activo, la comparación se quedaba pintada sobre la pantalla de inicio.
- Fusión HDR: con − / + la foto elegida saltaba de sitio en la lista; el EXIF sin
  diafragma ya no obliga a estimar la exposición por el brillo.
- Fusión HDR: la exposición de una foto no se veía hasta soltar el deslizador; ahora
  cambia en tiempo real. Se lee el EXIF de HEIC, PNG y WebP, y la estimación sin EXIF
  iguala los pasos del horquillado.
- Transformar: al estirar una esquina rápido, la esquina opuesta se movía y el
  tirador se quedaba atrás; con la capa ya movida, escalar la hacía saltar.
- ISNet recibía la imagen sin normalizar y devolvía máscaras casi uniformes.
- Rasterizar un texto mientras se editaba dejaba un error al cerrar la edición.
- El despliegue reintenta la conexión SSH si el servidor la corta.

### Añadido
- **Aviso de versión nueva**: al volver a la app (y cada 30 minutos) se
  comprueba si hay una versión publicada; si la hay, una barra ofrece
  «Actualizar», que guarda todas las pestañas abiertas, recarga y las reabre.

### Cambiado
- **Tipografías sin Google**: todo el catálogo de Google Fonts (1908 familias)
  se sirve desde el propio sitio, en `/fonts/`. El navegador ya no se conecta
  con Google, desaparece el aviso de permiso y las fuentes funcionan sin
  conexión. La herramienta Texto tiene un buscador con vista previa
  («Más fuentes (buscar entre 1900)…»).

### Añadido
- Documentación del repositorio: guía de contribución, código de conducta,
  política de seguridad, plantillas de issues y pull requests, y este registro
  de cambios.

## 2026-09-27

### Añadido
- **Collage / History / Post**: collages, publicaciones e historias para redes
  sociales, con 40 diseños, formatos de más de 29 redes, proporciones y
  pantallas de móviles, zonas seguras, diseño «Libre» y 28 formas para las
  fotos.
- **Creador de memes**: 26 diseños, segunda foto, efectos de imagen y textos
  con 29 tipografías y 26 estilos rápidos.
- **Stickers**: 1.595 emojis de Fluent Emoji en cuatro estilos, con tonos de
  piel y búsqueda en español e inglés.
- **Filtro Vintage avanzado**: 41 parámetros en 7 grupos y 102 estilos.
- **Estilos**: 160 looks en 16 categorías, con buscador y miniaturas.
- **Curvas** con canal de luminosidad, vista R · G · B y 25 estilos.
- **Tonos del histograma** e **histograma interactivo** en el panel lateral.
- **Cuadrícula inteligente** con detección de sujeto, horizonte y rostros, y
  propuesta de recorte.
- **Pinceles especiales**: simétrico, con textura y de degradado.
- **Dividir en trozos** (carrusel e Instagram) y **recortar en forma**.
- Remuestreo Lanczos 3, Mitchell y Catmull-Rom.
- Tramado opcional a 8 bits al exportar.
- README con todas las funcionalidades de la web.

### Cambiado
- **Revelado RAW**: flujo lineal de 16 bits, nuevo modelo tonal y controles
  mejorados.
- Filtros con alternativa en CPU cuando falla la GPU.

### Corregido
- Correcciones en varios filtros.
