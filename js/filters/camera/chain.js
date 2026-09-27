/* ══════════════════════════════════════════════════════════════
   ESQUEMA DE LA CADENA
   El orden de este array es el orden de ejecución, y ese orden es
   deliberado: reproduce el recorrido físico de la luz hasta el
   archivo. Mover una etapa cambia el resultado.
   ══════════════════════════════════════════════════════════════ */

export const CHAIN = [
  {
    id:"resample", name:"Remuestreo con antialias", on:false,
    note:"Reduce la resolución interna y reconstruye al tamaño original con interpolación Lanczos. Modifica las frecuencias finas y las correlaciones entre píxeles; puede perder detalle. Su efecto sobre un detector concreto requiere medición.",
    params:[
      {k:"amt", label:"Reducción interna", v:24},
      {k:"mix", label:"Mezcla", v:75}
    ]
  },
  {
    id:"wavelet", name:"Residuos multiescala (ondículas)", on:false,
    note:"Descomposición à trous B3 en dos escalas con umbral suave. Atenúa residuos pequeños y conserva los contornos fuertes. Actúa sobre la textura que también analizan métodos espectrales y de ruido; no ejecuta un detector ni calcula una probabilidad de IA.",
    params:[
      {k:"fine", label:"Reducción de detalle fino", v:24},
      {k:"coarse", label:"Reducción de detalle medio", v:12},
      {k:"edge", label:"Protección de contornos", v:75, mode:"keep"}
    ]
  },
  {
    id:"upsamp", name:"Eliminar patrones de upsampling", on:false,
    note:"Los generadores que reconstruyen la imagen con convolución traspuesta, pixel-shuffle o vecino-más-cercano dejan una periodicidad regular en la textura —el clásico patrón de tablero de ajedrez—, con energía sistemática cada 2, 4 u 8 píxeles según cuántos saltos de escalado haya en cascada. Un filtro peine mide esa periodicidad exacta a dos escalas y la atenúa, protegiendo los contornos reales para no aplastarlos con el resto del patrón.",
    params:[
      {k:"amt",  label:"Patrón fino (cada 2 px)", v:0},
      {k:"amt2", label:"Patrón medio (cada 4 px)", v:0},
      {k:"edge", label:"Protección de contornos", v:70, mode:"keep"}
    ]
  },
  {
    id:"spectral", name:"Distribución de energía espectral", on:false,
    note:"Simula la respuesta en frecuencias de diferentes cámaras: las antiguas tienen antialiasing agresivo (mucho pasa-bajos), mientras que las modernas high-res preservan más detalle fino. Un generador produce energía uniforme irreal; aplicar la distribución de una cámara real añade la compresión de frecuencias que ese sensor introduciría. Se elige un perfil de cámara o se ajusta manualmente con el radio del filtro Gaussiano.",
    params:[
      {k:"profile", label:"Perfil de cámara", type:"choice", mode:"keep", v:"dslr",
       options:[
         {v:"vintage", label:"Vintage (pasa-bajos suave)"},
         {v:"dslr", label:"DSLR profesional (equilibrado)"},
         {v:"mobile", label:"Smartphone (antialiasing fuerte)"},
         {v:"hires", label:"High-res moderno (minimal filtrado)"},
         {v:"manual", label:"Manual"}
       ]},
      {k:"radius", label:"Radio de desenfoque manual", v:8, mode:"keep"}
    ]
  },
  {
    id:"distort", name:"Distorsión del objetivo", on:true,
    note:"Barril en gran angular, cojín en tele. Un zoom económico deforma varios puntos porcentuales y la cámara sólo lo corrige en parte. Las líneas rectas de un render salen perfectamente rectas.",
    params:[
      {k:"amt",  label:"Cantidad (barril / cojín)", v:22, min:-100},
      {k:"edge", label:"Caída en el borde", v:34, mode:"keep"}
    ]
  },
  {
    id:"dof", name:"Profundidad de campo", on:false,
    note:"Sólo el punto de enfoque queda nítido; el resto se desenfoca con la forma circular del diafragma, y las altas luces fuera de foco se abren en discos de bokeh. Un render generado suele estar igual de nítido en cualquier plano. En modo «Física», el desenfoque no se ajusta a mano: se calcula con la fórmula estándar del círculo de confusión a partir del número f, la focal, la distancia de enfoque y el recorte del sensor, así que cambiar cualquiera de esos cuatro valores cambia la cantidad de desenfoque exactamente como lo haría un objetivo real —abrir el diafragma o alargar la focal siempre difumina más, nunca menos—.",
    params:[
      {k:"mode",   label:"Modo", type:"choice", mode:"keep", v:"manual",
       options:[
         {v:"manual",   label:"Manual"},
         {v:"physical", label:"Física (círculo de confusión)"}
       ]},
      {k:"amt",     label:"Apertura (desenfoque, modo manual)", v:32},
      {k:"fstop",   label:"Número f (modo física)",             v:30, mode:"keep"},
      {k:"focal",   label:"Focal (modo física)",                v:29, mode:"keep"},
      {k:"distance",label:"Distancia de enfoque (modo física)", v:41, mode:"keep"},
      {k:"crop",    label:"Recorte del sensor (modo física)",   v:0,  mode:"keep"},
      {k:"focusX", label:"Foco horizontal",       v:50, mode:"keep"},
      {k:"focusY", label:"Foco vertical",         v:50, mode:"keep"},
      {k:"radius", label:"Radio de nitidez",      v:22, mode:"keep"},
      {k:"bokeh",  label:"Brillo del bokeh",      v:45}
    ]
  },
  {
    id:"motion", name:"Trepidación de cámara", on:false,
    note:"Desplazamiento de la cámara durante el tiempo de exposición, en una de tres formas: lineal (una dirección y distancia constantes), zoom radial (el arrastre de accionar el zoom durante el disparo) o trepidación de pulso (microsacudidas en direcciones casi al azar, el temblor de una mano sin apoyo). El obturador progresivo se suma aparte: cada fila del sensor se lee un instante después que la de encima, así que un sujeto en movimiento sale ligeramente cizallado. Ninguna imagen generada reproduce esta consistencia geométrica.",
    params:[
      {k:"kind",  label:"Tipo de arrastre", type:"choice", mode:"keep", v:"linear",
       options:[
         {v:"linear", label:"Lineal"},
         {v:"zoom",   label:"Zoom radial"},
         {v:"tremor", label:"Trepidación de pulso"}
       ]},
      {k:"amt",     label:"Distancia",                          v:18},
      {k:"angle",   label:"Ángulo (modo lineal)",                v:20, min:-180, mode:"keep"},
      {k:"zoomX",   label:"Centro del zoom · X",                 v:50, mode:"keep"},
      {k:"zoomY",   label:"Centro del zoom · Y",                 v:50, mode:"keep"},
      {k:"rolling", label:"Obturador progresivo (rolling shutter)", v:0}
    ]
  },
  {
    id:"ca", name:"Aberración cromática", on:true,
    note:"Simula un aumento distinto para rojo y azul, con separación creciente hacia el borde y fringing en zonas contrastadas. Este efecto visual no demuestra un origen fotográfico.",
    params:[
      {k:"lat",    label:"Lateral", v:30},
      {k:"fringe", label:"Fringing púrpura", v:26}
    ]
  },
  {
    id:"soft", name:"Nitidez de campo", on:true,
    note:"Simula pérdida de nitidez hacia las esquinas y desenfoque radial o tangencial. La distribución de nitidez también depende del contenido y puede aparecer en imágenes generadas.",
    params:[
      {k:"amt",   label:"Caída en esquinas", v:34},
      {k:"start", label:"Radio de inicio",   v:44, mode:"keep"},
      {k:"astig", label:"Astigmatismo",      v:30, min:-100, mode:"keep"}
    ]
  },
  {
    id:"vignette", name:"Viñeteo", on:true,
    note:"Simula caída de luz hacia las esquinas, con desaturación opcional para ajustar el aspecto. Su intensidad depende del objetivo y de las correcciones de cámara; no es una señal exclusiva de fotografía.",
    params:[
      {k:"amt",   label:"Intensidad",  v:38},
      {k:"ext",   label:"Extensión",   v:46, mode:"keep"},
      {k:"desat", label:"Desaturación", v:34}
    ]
  },
  {
    id:"halation", name:"Halación", on:true,
    note:"Las altas luces sangran hacia las sombras con dominante roja, al rebotar la luz en el respaldo del sensor.",
    params:[
      {k:"str",   label:"Intensidad",   v:34},
      {k:"thr",   label:"Umbral",       v:62, mode:"inv"},
      {k:"rad",   label:"Radio",        v:38, mode:"keep"},
      {k:"tint",  label:"Tinte rojo",   v:74, mode:"keep"}
    ]
  },
  {
    id:"flare", name:"Destello de lente", on:false,
    note:"Reflejos internos entre las superficies del objetivo, sobre las luces muy intensas: fantasmas alineados con el centro óptico, un halo alargado tipo anamórfico y las puntas de difracción que deja el borde del diafragma. Ninguna imagen generada tiene cristal físico detrás por el que rebote nada, así que esta geometría —centrada en el encuadre, no en el punto brillante— no aparece nunca por accidente en un render.",
    params:[
      {k:"thr",    label:"Umbral",              v:78, mode:"inv"},
      {k:"ghosts", label:"Fantasmas",           v:36},
      {k:"streak", label:"Halo / estela",       v:30},
      {k:"spikes", label:"Puntas de difracción", v:26},
      {k:"tint",   label:"Tinte cálido",        v:40, mode:"keep"}
    ]
  },
  {
    id:"bayer", name:"Mosaico Bayer", on:true,
    note:"Simula muestreo RGGB y reconstrucción bilineal, que pueden introducir cremallera y falso color en detalle fino. Un patrón CFA añadido no autentica una captura de cámara.",
    params:[
      {k:"amt", label:"Mezcla", v:70}
    ]
  },
  {
    id:"cfa", name:"Patrón de filtro Bayer (CFA)", on:false,
    note:"Un demosaico real, por bueno que sea, nunca borra del todo la periodicidad de rejilla 2×2 del filtro de color que había debajo: cada una de las cuatro posiciones RGGB queda con una ganancia ligeramente distinta y consistente en toda la imagen, correlación que el análisis forense de estimación de CFA usa para verificar que una foto salió de un sensor real. Es una propiedad física del filtro, así que va fija por cámara, no por disparo —al contrario que «Mosaico Bayer», que simula el error de reconstrucción, no esta firma residual—. Un patrón sintético: no reproduce la periodicidad exacta de un sensor identificable.",
    params:[
      {k:"amt",   label:"Intensidad de la rejilla", v:0},
      {k:"color", label:"Variación entre canales",  v:60, mode:"keep"}
    ]
  },
  {
    id:"prnu", name:"Ruido PRNU (respuesta fija del sensor)", on:false,
    note:"Photo Response Non-Uniformity: cada fotodiodo del sensor tiene una sensibilidad ligeramente distinta por imperfecciones microscópicas de fabricación del silicio, así que amplifica la luz que recibe un poco más o un poco menos que sus vecinos. A diferencia del ruido de disparo o de lectura —aleatorios en cada exposición—, éste es multiplicativo, proporcional a la señal (invisible en negro absoluto) y FIJO: la misma cámara lo repite en todas sus fotos, y por eso en la práctica forense se extrae promediando muchas imágenes de un mismo sensor. Aquí va atado a la semilla de cámara, no a la de disparo, para reproducir justo esa persistencia. Un patrón sintético: no reproduce la huella identificable de un sensor real.",
    params:[
      {k:"amt",   label:"Intensidad del grano fijo", v:0},
      {k:"scale", label:"Escala del patrón",         v:35, mode:"keep"},
      {k:"wafer", label:"Gradiente de oblea",        v:0}
    ]
  },
  {
    id:"sensor", name:"Ruido de sensor", on:true,
    note:"Ruido de disparo proporcional a √señal, lectura, grano correlacionado y variaciones de respuesta por píxel y columna. El patrón es sintético: no reproduce la huella PRNU de una cámara identificable. El ruido de disparo ya crece con la raíz de la señal y el de lectura es constante, así que las sombras salen con peor relación señal-ruido de forma natural; «Más ruido en sombras» va más allá y da un control directo sobre esa asimetría, para cuando haga falta exagerarla —el aspecto de levantar sombras en el revelado, donde el ruido que ya estaba ahí, oculto, se hace visible—.",
    params:[
      {k:"shot",  label:"Ruido de disparo", v:26},
      {k:"read",  label:"Ruido de lectura", v:14},
      {k:"size",  label:"Tamaño de grano",  v:32, mode:"keep"},
      {k:"blue",  label:"Exceso en azul",   v:45, mode:"keep"},
      {k:"chr",   label:"Ruido de color",   v:20},
      {k:"band",  label:"Bandeado de fila", v:8},
      {k:"hot",   label:"Píxeles muertos",  v:6},
      {k:"response", label:"Variación de respuesta por píxel", v:0},
      {k:"column", label:"Ruido de columna", v:0},
      {k:"shadow", label:"Más ruido en sombras", v:0}
    ]
  },
  {
    id:"dust", name:"Polvo del sensor", on:false,
    note:"Motas posadas en el filtro delante del sensor: manchas suaves y semitransparentes, en las mismas posiciones en cada disparo de esa cámara concreta. Ninguna imagen generada las tiene, porque no hay sensor detrás.",
    params:[
      {k:"amt",  label:"Cantidad",         v:35},
      {k:"size", label:"Tamaño medio",     v:40, mode:"keep"},
      {k:"soft", label:"Suavidad del borde", v:55, mode:"keep"}
    ]
  },
  {
    id:"clip", name:"Recorte y nivel de negro", on:true,
    note:"Cada canal satura a un nivel distinto, así que las zonas quemadas viran en vez de quedar blancas.",
    params:[
      {k:"black", label:"Offset de negro", v:14},
      {k:"skew",  label:"Desfase de canal", v:40},
      {k:"ceil",  label:"Techo",           v:50, mode:"inv"}
    ]
  },
  {
    id:"tone", name:"Balance y curva", on:true,
    note:"Balance de blancos imperfecto y curva de contraste al estilo de fabricante. Esta etapa siempre codifica a sRGB, aunque esté apagada.",
    params:[
      {k:"temp", label:"Temperatura", v:-14, min:-100},
      {k:"tint", label:"Tinte verde/magenta", v:9, min:-100},
      {k:"exp",  label:"Exposición", v:6, min:-100},
      {k:"scur", label:"Curva en S", v:30},
      {k:"sat",  label:"Saturación", v:-12, min:-100}
    ]
  },
  {
    id:"grade", name:"Gradación por zonas", on:false,
    note:"Tinte independiente para sombras y luces, el control de look cinematográfico que ningún balance de blancos global reproduce: una escena real casi nunca tiene el mismo color en sus sombras que en sus altas luces.",
    params:[
      {k:"shR", label:"Sombras · rojo/cian",     v:50, mode:"keep"},
      {k:"shB", label:"Sombras · azul/amarillo", v:50, mode:"keep"},
      {k:"hiR", label:"Luces · rojo/cian",       v:58, mode:"keep"},
      {k:"hiB", label:"Luces · azul/amarillo",   v:45, mode:"keep"},
      {k:"amt", label:"Intensidad",              v:35}
    ]
  },
  {
    id:"detail", name:"Reducción de ruido y enfoque", on:true,
    note:"Emborronado plastificado en las zonas planas de las sombras, respetando los contornos, más halos de enfoque y un contraste local sobre la media de un entorno amplio —una aproximación de CLAHE, con la ganancia recortada donde la desviación ya es grande para no disparar el ruido—. Ese contraste entre textura aplastada y bordes nítidos es la firma del procesado de un móvil.",
    params:[
      {k:"smear", label:"Emborronado en sombras", v:44},
      {k:"edge",  label:"Respeto al borde",      v:52, mode:"keep"},
      {k:"sharp", label:"Enfoque",               v:38},
      {k:"rad",   label:"Radio del halo",        v:46, mode:"keep"},
      {k:"local", label:"Contraste local (CLAHE)", v:0}
    ]
  },
  {
    id:"residual", name:"Residuos de ruido de cámara digital", on:false,
    note:"El procesado interno de cualquier cámara —demosaico, reducción de ruido no lineal, realce de bordes— nunca deja la imagen limpia del todo: queda una textura residual con distribución de colas pesadas (grumos, no ruido suave uniforme), más presente donde hay detalle fino —el denoiser del ISP es menos agresivo ahí, para no borrar información real— y casi ausente en zonas completamente lisas, donde ese mismo denoiser sí actúa a fondo. Es aleatorio en cada disparo, a diferencia del PRNU. Un generador no tiene ningún pipeline físico detrás dejando este residuo concreto.",
    params:[
      {k:"amt",    label:"Intensidad",              v:0},
      {k:"detail", label:"Concentración en detalle", v:65},
      {k:"scale",  label:"Escala del grano",         v:35, mode:"keep"}
    ]
  },
  {
    id:"scratches", name:"Rasguños y pelos de superficie", on:false,
    note:"Marcas físicas finas y alargadas, orientadas casi al azar, como las que deja el manejo de una copia impresa o el paso por un escáner. Ningún archivo generado directamente en digital las arrastra.",
    params:[
      {k:"amt",   label:"Cantidad",  v:30},
      {k:"length",label:"Longitud",  v:55, mode:"keep"},
      {k:"width", label:"Grosor",    v:25, mode:"keep"}
    ]
  },
  {
    id:"relief", name:"Microrrelieve de superficie", on:false,
    note:"Relieve muy fino de la superficie física —la fibra del papel, el grano de una copia—, visible sólo porque la luz le llega casi de refilón: es tridimensional de verdad, no una textura pintada encima, y por eso gira con el ángulo de luz que se le dé. Ningún archivo generado directamente en digital tiene una superficie física que iluminar.",
    params:[
      {k:"amt",   label:"Intensidad",   v:22},
      {k:"scale", label:"Escala",       v:40, mode:"keep"},
      {k:"angle", label:"Ángulo de luz", v:35, min:-180, mode:"keep"}
    ]
  },
  {
    id:"warp", name:"Micro-deformación", on:true,
    note:"Desplazamiento subpíxel variable que modifica la textura y las correlaciones locales. Su visibilidad depende de la imagen y de la amplitud; no garantiza eliminar las huellas de un generador.",
    params:[
      {k:"amp",  label:"Amplitud", v:26},
      {k:"freq", label:"Escala",   v:44, mode:"keep"}
    ]
  },
  {
    id:"chroma", name:"Submuestreo de croma", on:true,
    note:"El color se guarda a la mitad de resolución y sangra por encima de los bordes. El códec de la etapa siguiente vuelve a hacerlo por su cuenta, así que esto se acumula: por eso el valor por defecto es moderado.",
    params:[
      {k:"amt", label:"Mezcla", v:55}
    ]
  },
  {
    id:"jpegtrace", name:"Rastros de la tubería JPEG", on:false,
    note:"La compresión JPEG real —abajo— se aplica en CPU sólo al aplicar el filtro y no se ve mientras se ajustan los mandos. Esta etapa aproxima en la vista previa los dos rastros visuales de la cuantización DCT por bloques de 8×8: un escalón sutil de brillo en el límite entre bloques —la componente DC dominando zonas lisas, cuantizada bloque a bloque—, y el «ringing» u oscilación de Gibbs que aparece pegada a bordes de alto contraste cuando se trunca la expansión en frecuencias altas. Es una aproximación visual, no la compresión real.",
    params:[
      {k:"block", label:"Blockiness (límites 8×8)", v:0},
      {k:"ring",  label:"Ringing en bordes",         v:0}
    ]
  },
  {
    id:"periodic", name:"Eliminar patrones periódicos (espectro)", on:false,
    cpu:true,
    note:"«Eliminar patrones de upsampling» ataca una firma concreta —picos exactos cada 2 y 4 píxeles—; esta etapa es su versión general. Analiza el espectro de Fourier de la luminancia por bloques solapados y atenúa cualquier bin que sobresalga muy por encima de la mediana de su propio anillo radial, el nivel que una imagen natural produciría de fondo a esa misma distancia de la componente continua: el espectro de una foto real decae suavemente con la frecuencia, y una rejilla artificial rompe esa suavidad con un pico aislado, sea cual sea su origen o su paso. Se protege un radio mínimo alrededor de la continua, donde vive la iluminación general y no ninguna rejilla. Es CPU y no se ve en la vista previa: una FFT 2D por cada bloque de la imagen no es cosa de recalcular en cada movimiento de un deslizador, y puede tardar unos segundos al aplicar el filtro sobre imágenes grandes.",
    params:[
      {k:"amt",    label:"Intensidad de atenuación", v:0},
      {k:"thresh", label:"Sensibilidad (picos vs fondo)", v:45, mode:"keep"},
      {k:"guard",  label:"Protección de baja frecuencia", v:20, mode:"keep"}
    ]
  },
  {
    id:"hfslope", name:"Normalizar pendiente espectral", on:false,
    cpu:true,
    note:"«Eliminar patrones periódicos» sólo ataca picos aislados; esto es distinto: la energía total de cada banda de alta frecuencia, sin ningún pico que destaque, puede seguir siendo más o menos abundante de lo que un sensor real produciría —una fotografía sigue de forma bastante fiel una ley de potencia, la energía decayendo suavemente con la frecuencia, y una imagen generada puede desviarse de esa pendiente de forma difusa en toda la banda—. Se mide el exponente de esa caída sobre un recorte central grande y se reescala cada bloque para acercarlo al de una foto real, anclando la corrección en una frecuencia intermedia para no tocar el brillo ni el contraste general, sólo cómo se reparte el detalle entre frecuencias bajas y altas. Es CPU y no se ve en la vista previa, por la misma razón que «Eliminar patrones periódicos»: mide sobre toda la imagen antes de aplicar nada.",
    params:[
      {k:"amt",    label:"Intensidad de la corrección", v:0},
      {k:"target", label:"Pendiente objetivo",          v:43, mode:"keep"},
      {k:"guard",  label:"Protección de baja frecuencia", v:20, mode:"keep"}
    ]
  },
  {
    id:"jpeg", name:"Compresión JPEG", on:true,
    cpu:true,
    note:"Codifica y decodifica con el códec JPEG del navegador al aplicar el filtro, también en lotes. No aparece en la vista previa. Repetir compresiones puede añadir señales forenses de doble compresión; no garantiza evitarlas. La exportación JPEG añade la codificación del archivo final.",
    params:[
      {k:"q",    label:"Calidad",     v:82, mode:"inv"},
      {k:"gens", label:"Generaciones", v:12}
    ]
  },
  {
    id:"exifmatch", name:"EXIF coherente con la óptica", on:false,
    cpu:true,
    note:"El panel de metadatos EXIF vive aparte y nada obliga a que el cuerpo y objetivo que declara tengan algo que ver con la distorsión, el ruido o el viñeteo que de verdad se aplicaron aquí: un archivo con fuerte barril de gran angular y un EXIF de teleobjetivo de 85 mm es una contradicción que cualquier lector de metadatos delata. Esta etapa, al aplicar el filtro, puntúa cada combinación de cuerpo y objetivo de la base de datos por cuánto encajan sus rasgos físicos reales —focal, apertura máxima, tamaño de sensor, resolución— con lo que la cadena tiene activado, y deja seleccionada la que mejor casa. No toca un solo píxel: sólo cambia qué cuerpo y objetivo quedan marcados en el panel EXIF, y activa la incrustación de metadatos si estaba apagada.",
    params:[]
  }
];


export const CHAIN_BY_ID = Object.fromEntries(CHAIN.map(s => [s.id, s]));

/* Estado por defecto de todas las etapas, tal y como lo declara CHAIN. */
export function defaultStages(){
  const o = {};
  for(const s of CHAIN){
    o[s.id] = { on: s.on, p: Object.fromEntries(s.params.map(x => [x.k, x.v])) };
  }
  return o;
}
