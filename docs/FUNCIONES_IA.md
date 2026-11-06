# Funciones de IA nuevas (generado)

> Generado por `node tools/docs/funciones-ia.mjs` a partir de los manifiestos (`js/ui/menu/ia/manifests.js`). No se edita a mano.
> Todas son **Premium 👑** (de momento sin pago), se ejecutan en el dispositivo y sus modelos se descargan al usarlas, avisando del tamaño.
> Los modelos y sus licencias están en [MODELOS.md](MODELOS.md).

**48 funciones** en **13 submenús** del menú «Inteligencia Artificial».

## Seleccionar (2)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Seleccionar partes | Elige una parte de la persona —pelo, cara, piel, ropa, brazos, piernas, zapatos…— y la IA (SegFormer + pose) la selecciona o la deja como máscara de la capa. Reconoce varias personas. Todo en tu equipo. | ventana simple | ia, seleccion |
| Pincel inteligente con IA | Pinta sobre un objeto y la selección se ajusta a sus bordes (MobileSAM). Puedes añadir o quitar; el resultado es la selección activa. | ventana simple | ia, seleccion |

## Borrar y rellenar (1)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Borrado ligero con IA | Pinta sobre lo que sobra y se rellena en una capa nueva; el original queda intacto. Pensado para el móvil. | ventana simple | ia, retoque |

## Retrato (13)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Arrugas | Atenúa las arrugas de la frente, el entrecejo, las patas de gallo, los surcos y el cuello sin borrar la textura de la piel: detecta cada surco con un filtro de crestas y reinyecta los poros. En el editor de cara, capa nueva con «mezcla». | editor de cara | ia, retoque |
| Ojeras y bolsas | Iguala la luz y el tono de la zona bajo los ojos con el de la mejilla, sin borrar la textura de la piel. En el editor de cara, capa nueva con «mezcla». | editor de cara | ia, retoque |
| Brillos de la piel | Detecta las zonas brillantes de la piel (frente, nariz, mejillas) y las atenúa sin apagar el reflejo de los ojos. En el editor de cara, capa nueva con «mezcla». | editor de cara | ia, retoque |
| Textura de piel | Añade poros y grano fino sólo donde la piel es demasiado lisa (típico de las imágenes de IA); la piel que ya tiene textura no cambia. En el editor de cara, capa nueva con «mezcla». | editor de cara | ia, retoque |
| Imperfecciones y tono | Rellena granos y manchas pequeñas con la piel de alrededor y uniforma las rojeces por zonas, sin tocar la luz ni la textura. En el editor de cara, capa nueva con «mezcla». | editor de cara | ia, retoque |
| Luz en la cara | Cambia la luz de la cara: dirección, altura, intensidad y suavidad, sobre la forma real de la cara (profundidad + elipsoide), en luz lineal y respetando el color de la piel. Capa nueva con «mezcla». | editor de cara | ia, retoque |
| Ojos | Da luz y detalle al iris sin quemar el reflejo, cambia el color del iris sin teñir la pupila y aclara el blanco del ojo. Capa nueva con «mezcla». | editor de cara | ia, retoque |
| Labios y cejas | Labios: más o menos color y definición. Cejas: oscurecer, dar color y rellenar los huecos. Capa nueva con «mezcla». | editor de cara | ia, retoque |
| Dientes | Blanquea los dientes por zonas, conservando el brillo: no toca encías, lengua ni labios. Capa nueva con «mezcla». | editor de cara | ia, retoque |
| Cabello | Cambia el color del pelo (tono y saturación en OKLab, conservando sombras y mechones), su luz y su brillo, y le da volumen suave. Capa nueva con «mezcla». | editor de cara | ia, retoque |
| Pelos sueltos | Quita los pelos sueltos que cruzan el fondo junto a la cabeza: los detecta como líneas finas y los rellena con el fondo. No toca el peinado. Capa nueva con «mezcla». | editor de cara | ia, retoque |
| Reflejos en gafas | Atenúa los brillos y reflejos de los cristales de las gafas, sin tocar los ojos ni la montura. Capa nueva con «mezcla». | editor de cara | ia, retoque |
| Forma de la cara | Retoca la forma de la cara con cambios pequeños y naturales: mandíbula, mentón, anchura, nariz, tamaño de los ojos y grosor de los labios, deformando sin pliegues a partir de los 478 puntos de la cara. El perfil infantil usa un rango reducido. Capa nueva con «mezcla». | editor de cara | ia, retoque |

## Cuerpo (5)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Editor de cuerpo | Abre el editor de cuerpo: silueta, proporciones, cabeza y cuello, torso, brazos, piernas, postura, definición y piel, con zoom en la persona. Eliges el perfil (hombre, mujer, niño o niña) y cada persona va a su propia capa. | editor de cuerpo | ia, retoque |
| Silueta y proporciones | Cambia la silueta y las proporciones: delgado o ancho, altura, piernas y torso, hombros, cintura, caderas, brazos y piernas. Deforma sin pliegues, protege el fondo lejano y deja cada persona en su capa. | editor de cuerpo | ia, retoque |
| Postura | Endereza la postura: erguir la espalda, cuello adelantado y hombros caídos. Cambios pequeños y naturales, con el perfil de la persona. | editor de cuerpo | ia, retoque |
| Definición y tono | Realza la definición del cuerpo adulto: relieve de luz y sombra y musculatura por zonas, sin generar piel. No existe para el perfil infantil. | editor de cuerpo | ia, retoque |
| Piel del cuerpo | Piel del cuerpo: suavizar, uniformar el color y bronceado (adultos); el perfil infantil solo tiene «uniformar». | editor de cuerpo | ia, retoque |

## Ropa y tejidos (4)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Planchar arrugas de ropa | Plancha las arrugas de la ropa: aplana el sombreado de los pliegues y conserva la trama del tejido, las rayas y los estampados. | editor a pantalla completa | ia, retoque |
| Arrugas de telas y fondos | Plancha las arrugas de sábanas, cortinas, manteles o fondos de tela: tocas la tela y se alisa sin perder su trama. | editor a pantalla completa | ia, retoque |
| Cambiar color de prendas | Cambia el color de una prenda en OKLab conservando sus sombras, brillos y pliegues; las prendas blancas, grises o negras se tiñen con el tinte. | editor a pantalla completa | ia, retoque |
| Textura de tejido | Realza, apaga o devuelve la trama del tejido y rellena las zonas que quedaron demasiado lisas tras planchar o recolorear. | editor a pantalla completa | ia, retoque |

## Escena y cielo (6)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Mejorar cielo | Realza el cielo (contraste y saturación), rellena de azul los cielos apagados conservando las nubes y ajusta la luz del primer plano. | ventana simple | ia, mejorar |
| Quitar neblina con IA | Quita la neblina usando la distancia de cada punto (mapa de profundidad) además del canal oscuro, sin halos en los bordes. | ventana simple | ia, mejorar |
| Realzar por tipo | Realza por tipo de cosa —agua, follaje, cielo, edificios o piel— con la receta de cada una: saturación y detalle sólo donde toca. | ventana simple | ia, mejorar, color |
| Balance de blancos por zonas | Estima el iluminante de cada zona de la foto y lo corrige por separado: sirve con luz mezclada (ventana fría y lámpara cálida). | ventana simple | ia, color |
| Recuperar luces | Reconstruye los canales quemados: toma el color de los vecinos sanos y comprime el exceso con un hombro suave. | ventana simple | ia, mejorar |
| Unificar iluminación | Acerca el color y la luz del sujeto a los del fondo que lo rodea, para que parezca hecho en la misma escena. | ventana simple | ia, color |

## Profundidad (2)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Aberración por distancia | Aberración cromática que crece con la distancia, como un objetivo que se resiente en lo lejano. | ventana simple | ia, efectos |
| Luz direccional con relieve | Luz direccional con relieve: saca las normales del mapa de profundidad y ilumina la escena desde donde elijas. | ventana simple | ia, efectos |

## Mejorar y restaurar (3)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Quitar desenfoque | Quita el desenfoque de movimiento o de enfoque con un núcleo medido en la propia foto (o puesto a mano) y frena los halos, o con el método «IA · NAFNet» (33 MB) para el desenfoque de movimiento real. | ventana simple | ia, mejorar, corregir |
| Polvo y motas del sensor | Detecta las motas del sensor (manchas pequeñas y oscuras sobre zonas lisas) y las rellena con el color de su alrededor, sin tocar la textura. | ventana simple | ia, mejorar, corregir |
| Moiré y bandas | Quita el moiré y las bandas periódicas buscando picos en el espectro de cada bloque y atenuándolos; el color se limpia más fuerte. | ventana simple | ia, mejorar, corregir |

## Encuadre y composición (1)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Texto en zona libre con IA | Busca la zona de la foto que menos molesta (sin sujeto, caras ni texturas) y escribe ahí tu texto o marca de agua, en claro u oscuro según el fondo, en una capa nueva. | ventana simple | ia, estilo |

## Color y estilos (3)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Estilo desde una foto de referencia | Elige una foto de referencia y lleva el color y el tono de tu foto hacia los suyos, por zonas (cielo, personas, resto) y en OKLab. También puede sugerir ajustes (exposición, contraste, calidez, saturación). | ventana simple | ia, color |
| Packs de cámara | Elige un estilo de película analógica, de móvil o de réflex/óptica y se aplica como capa de filtro reeditable (con el motor de Cámaras). Al ser una capa de filtro, «Aplicar esta edición a otras fotos» la copia a un lote. | ventana simple | ia, estilo |
| Mis estilos | Guarda el color y el tono de una foto de referencia como estilo, aplícalo a esta foto o a todas las abiertas, y pásalo a otra persona o ordenador como archivo. | ventana simple | ia, estilo |

## Lote y biblioteca (4)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Selección rápida | Carga varias fotos y elige las mejores: puntúa nitidez, ojos y composición, agrupa duplicados y te deja comparar y descartar. | ventana simple | ia, analizar |
| Buscar fotos | Indexa tus fotos en este dispositivo y búscalas con una frase («perro en la playa», «de noche», «retrato en blanco y negro»). Con CLIP (153 MB, opcional) entiende el contenido de la foto. Nada sale de tu equipo. | ventana simple | ia, analizar |
| Etiquetas y nombre | La IA describe la foto con etiquetas en español (tipo, objetos, colores) y propone un nombre de archivo con una plantilla: {fecha}, {etiqueta}, {color}, {n}… | ventana simple | ia, analizar |
| Texto alternativo | Escribe en español una descripción de la foto para lectores de pantalla (corta, de hasta 125 caracteres, o larga). Se copia al portapapeles. Con el motor «Florence-2» (275 MB) enseña además lo que ve la IA, en inglés. | ventana simple | ia, analizar |

## Asistente (1)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Asistente de edición | Escribe o dicta con 🎤 (Whisper, en tu equipo) lo que quieres («más cálida y con grano», «quita la neblina y mejora el cielo»), mira el plan y aplícalo. Motor «Reglas» (sin descarga) o «IA · Qwen» (1,2 GB, WebGPU; si no puede, usa las reglas). Todo va en capas que puedes retocar o deshacer. | ventana simple | ia, mejorar |

## Realismo y autenticidad (3)

| Función | Qué hace | Interfaz | Pestañas del cajón |
|---|---|---|---|
| Zonas demasiado lisas con IA | Detecta las zonas sin textura creíble (cielos, pieles y fondos de imágenes generadas) y añade grano de sensor solo ahí. También puede mostrártelas marcadas en rojo. | ventana simple | ia, efectos |
| Manos y dientes sospechosos | Revisa las manos (proporciones, dedos, articulaciones) y los dientes (separaciones) de las personas de la foto y te avisa de lo que parece generado. Solo avisa: no corrige nada. | ventana simple | ia, analizar |
| Informe de realismo | Mide nitidez, ruido, rango dinámico, zonas lisas, metadatos y la puntuación de Plausibilidad. Se puede guardar en PDF o JSON. | ventana simple | ia, analizar |
