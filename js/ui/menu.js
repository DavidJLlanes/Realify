/* ═══════════════════════════════════════════════════════════════
   BARRA DE MENÚS
   En escritorio, menús desplegables clásicos. En móvil, la barra se
   pliega en un solo botón ☰ y los menús se apilan en una única lista
   a lo ancho, porque un submenú flotante en una pantalla estrecha es
   imposible de acertar con el pulgar.
   ═══════════════════════════════════════════════════════════════ */

import { run, enabled, labelFor } from "./commands.js";
import { ICONS } from "./tooldrawer-icons.js";

/* Icono opcional delante del texto de una entrada: un SVG en línea,
   que hereda el color del texto. Sólo lo usan las entradas a las que
   una marca visual les añade algo; el resto siguen siendo texto. */
/* `icon`: SVG completo propio; `ic`: nombre de un icono del cajón de
   herramientas (ui/tooldrawer-icons.js), el mismo que en el móvil. */
const iconHtml = it => it.icon ? `<span class="mi" aria-hidden="true">${it.icon}</span>`
  : it.ic && ICONS[it.ic] ? `<span class="mi" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[it.ic]}</svg></span>` : "";

export const MENUS = [
  { label:"Archivo", items:[
    { cmd:"file.open",     label:"Abrir imagen…" },
    { cmd:"file.openFiles", label:"Abrir RAW, PSD, TIFF o SVG…", help:"Abre estos formatos desde el explorador de archivos. En Android, «Abrir imagen» va directo a la galería, donde no suelen aparecer." },
    { cmd:"file.openStack",label:"Cargar archivos en pila…" },
    { cmd:"file.openProject", label:"Abrir proyecto…" },
    { cmd:"file.saveProject", label:"Guardar proyecto…" },
    { cmd:"file.new",      label:"Documento nuevo…" },
    { cmd:"file.socialPost", label:"Collage / History / Post…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
      help:"Collages, publicaciones e historias para redes: 40 diseños de collage, formatos de Instagram, TikTok, Facebook, X, YouTube, LinkedIn, Pinterest y más, proporciones verticales y horizontales, y la pantalla de los móviles más conocidos. Crea el resultado en una pestaña nueva." },
    { cmd:"filter.frames", label:"Marcos…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10" rx=".5"/><path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2"/></svg>',
      help:"120 marcos en 10 categorías, con grosor y colores ajustables. Se añade como una capa independiente para no degradar la imagen original ni perder su origen de 16 bits." },
    { sep:true },
    { cmd:"file.export",   label:"Exportar…" },
    { cmd:"file.exportAs", label:"Exportar como…" },
    { cmd:"file.exportPng",label:"Exportar PNG rápido" },
    { cmd:"file.exportGif", ic:"film", label:"Exportar GIF animado…",
      help:"Cada capa visible es un fotograma (sola o acumulada): duración, bucle, ida y vuelta, tamaño y colores." },
    { cmd:"file.contactSheet", ic:"contact-sheet", label:"Hoja de contactos…",
      help:"Pantalla completa: muchas fotos en páginas A4, A3, Carta o 10 × 15 con columnas, márgenes, título y nombre de cada foto. Crea un PDF de varias páginas o capas nuevas." },
    { cmd:"file.socialPreview", label:"Prueba para redes sociales…" },
    { sep:true },
    { cmd:"file.startBatch", ic:"layers-plus", label:"Editar en lote (abrir varias fotos)…",
      help:"Abre varias fotos, cada una en su pestaña: edita una y copia su edición a las demás con «Aplicar esta edición a otras fotos»." },
    { cmd:"file.batchEdit", ic:"layers-2", label:"Aplicar esta edición a otras fotos…",
      help:"Copia las capas de ajuste, filtros, textos y marcas de agua de la foto abierta a otras pestañas o fotos de la galería, con vista previa e igualado de exposición. Resultado en sus pestañas (capas reeditables) o en un ZIP." },
    { cmd:"actions.open", ic:"clapperboard",  label:"Acciones (grabar y repetir)…",
      help:"Graba una secuencia de ajustes, filtros y comandos con sus valores y repítela en cualquier foto o en muchas a la vez (ZIP). Se pueden exportar e importar." },
    { cmd:"file.revert",   label:"Restaurar al estado original…", help:"Descarta capas, ediciones e historial y vuelve al archivo tal como se abrió." },
    { sep:true },
    { cmd:"file.close",    label:"Cerrar documento" },
    { cmd:"file.closeAll", ic:"close-all", label:"Cerrar todas las fotos", help:"Cierra de una vez todas las fotos abiertas (con una sola confirmación)." }
  ]},
  { label:"Editar", items:[
    { cmd:"edit.undo", label:"Deshacer" },
    { cmd:"edit.redo", label:"Rehacer" },
    { sep:true },
    { cmd:"edit.copy",  label:"Copiar" },
    { cmd:"edit.cut",   label:"Cortar" },
    { cmd:"edit.paste", label:"Pegar" },
    { cmd:"edit.clear", label:"Borrar selección" },
    { sep:true },
    { cmd:"edit.levels",       label:"Niveles de historial…" },
    { cmd:"edit.clearHistory", label:"Vaciar historial" },
    { sep:true },
    { cmd:"snapshot.add", label:"Nueva instantánea…",
      help:"Guarda una copia completa y con nombre del documento —«antes del retoque»—, en el panel Historial, para volver a ella sin deshacer paso a paso." },
    { cmd:"historyBrush.start", label:"Pincel de historial (Ctrl+Mayús+H)",
      help:"Pinta píxeles de la instantánea marcada como origen (círculo, en el panel Historial) sobre la capa activa." },
    { sep:true },
    { label:"Pinceles especiales", submenu:[
      { cmd:"brush.symmetric", label:"Pincel simétrico",
        icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18" stroke-dasharray="2 2"/><path d="M8 7c-2 1-3 3-3 5s1 4 3 5"/><path d="M16 7c2 1 3 3 3 5s-1 4-3 5"/></svg>',
        help:"Pinta a la vez a los dos lados de un eje vertical, horizontal o diagonal, en cuatro cuadrantes o en radial (caleidoscopio)." },
      { cmd:"brush.textured", label:"Pincel con textura",
        icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c4 0 5-3 7-6l6-8"/><circle cx="6" cy="9" r=".6" fill="currentColor"/><circle cx="9" cy="5" r=".6" fill="currentColor"/><circle cx="4" cy="14" r=".6" fill="currentColor"/><circle cx="14" cy="17" r=".6" fill="currentColor"/><circle cx="18" cy="13" r=".6" fill="currentColor"/></svg>',
        help:"Texturas procedurales dentro del trazo: grano, papel, lienzo, cristales, rayones, esponja o ruido fino." },
      { cmd:"brush.gradient", label:"Pincel de degradado",
        icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c3-8 6-10 16-12"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2" fill="currentColor"/></svg>',
        help:"Dibuja degradados a mano alzada: el color va del frontal al de fondo (o recorre el arcoíris) a lo largo del trazo." },
      { cmd:"brush.settings", label:"Ajustes de pincel…" }
    ]}
  ]},
  { label:"Imagen", items:[
    { cmd:"image.resize",  label:"Tamaño de imagen…" },
    { cmd:"image.canvasSize", label:"Tamaño de lienzo…" },
    { cmd:"image.contentAwareScale", label:"Escala según contenido…" },
    { cmd:"image.crop",    label:"Recortar" },
    { cmd:"filter.perspective", label:"Corregir perspectiva…" },
    { sep:true },
    { cmd:"image.rotL",    label:"Girar 90° a la izquierda" },
    { cmd:"image.rotR",    label:"Girar 90° a la derecha" },
    { cmd:"image.rot180",  label:"Girar 180°" },
    { cmd:"image.autoStraighten", ic:"ruler", label:"Enderezar automáticamente…",
      help:"Busca las líneas rectas de la foto (horizonte, edificios, marcos), propone el ángulo para ponerlas a nivel y te deja afinarlo antes de aplicar. Sin esquinas vacías." },
    { sep:true },
    { cmd:"image.flipH",   label:"Voltear en horizontal" },
    { cmd:"image.flipV",   label:"Voltear en vertical" },
    { sep:true },
    { cmd:"image.hdr", label:"Fusión HDR…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="14" height="12" rx="2"/><path d="M6 4h12a2 2 0 0 1 2 2v9"/><path d="M9 1.5h11a2.5 2.5 0 0 1 2.5 2.5v8" opacity=".55"/><path d="M5.5 16l3-4 2 2.5 1.5-1.5 2 3"/></svg>',
      help:"Fusiona de 2 a 11 fotos de la misma escena con distinta exposición (horquillado detectado solo por EXIF o brillo): alineación, antifantasmas, fusión de exposición y mapeo tonal con estilos tipo Photomatix. Admite RAW y las fotos que ya tienes abiertas. El resultado se abre como una foto nueva." },
    { cmd:"image.beforeAfter", label:"Antes y después…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20"/><path d="M3 20l6-7 3 3"/></svg>',
      help:"Pantalla completa: imagen de comparación para compartir con el original y tu edición (dividida, diagonal, lado a lado o arriba y abajo), con etiquetas y formatos de redes. Crea una capa nueva en otra pestaña." },
    { cmd:"image.merge", label:"Unir imágenes…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="8" height="12" rx="1.5"/><rect x="14" y="6" width="8" height="12" rx="1.5"/><path d="M10 12h4"/><path d="m12.5 10.5 1.5 1.5-1.5 1.5"/></svg>',
      help:"Panorámica (alinea y funde fotos solapadas, iguala la exposición y recorta los bordes) o unión en fila, columna o cuadrícula con separación, margen, esquinas y fondo. Crea una capa nueva." },
    { cmd:"image.docscan", ic:"scan", label:"Escanear documento Premium 👑…", premium:true,
      help:"Encuentra el papel, la pizarra o el cuadro de la foto (OpenCV, se descarga una vez), deja afinar las cuatro esquinas, deduce la proporción real y lo endereza a resolución completa. Foto nueva." },
    { cmd:"image.sharpness", ic:"focus", label:"Análisis de nitidez…",
      help:"Mapa de enfoque de la imagen (capa nueva: rojo y amarillo = lo más nítido) y, de varias tomas parecidas, cuál salió más nítida, con nota de 0 a 100, para abrir la mejor." },
    { cmd:"image.stack", ic:"stack-photos", label:"Apilar fotos Premium 👑…", premium:true,
      help:"Varias tomas de la misma escena, hechas a pulso: se alinean con precisión subpíxel (OpenCV, se descarga una vez, 11 MB) y se combinan para reducir el ruido (rechazando lo que se mueve) o para ampliar el enfoque. Foto nueva a resolución completa." },
    { sep:true },
    { cmd:"image.slice", label:"Cortar en partes…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18" stroke-dasharray="3 2"/></svg>',
      help:"Pantalla completa: corta la imagen en filas y columnas, en trozos de tamaño fijo, en un carrusel panorámico, en la cuadrícula del perfil de Instagram o con cortes a mano, y guarda cada trozo en una capa nueva, en su propia pestaña, en un ZIP o suelto." },
    { cmd:"image.shapeCrop", label:"Recortar en forma…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
      help:"Pantalla completa: recorta la foto con una de unas 60 formas (círculo, polígonos y estrellas configurables, corazón, flores, nube, bocadillos, engranaje, anillo, marco, flechas…) que se mueve, escala y gira sobre la imagen, con borde suave y contorno. Recorta sólo la capa activa: crea una capa con la forma y transparencia fuera y oculta las demás, lista para guardar en PNG, WebP o AVIF." },
  ]},
  { label:"Selección", items:[
    { cmd:"sel.all",     label:"Seleccionar todo" },
    { cmd:"sel.none",    label:"Deseleccionar" },
    { cmd:"sel.invert",  label:"Invertir selección" },
    { sep:true },
    { cmd:"pen.start",   label:"Pluma (A)",
      help:"Trazados Bézier a mano: clic pone un ancla de esquina, clic y arrastre la vuelve curva con tiradores. Clic sobre la primera ancla cierra el trazado." },
    { cmd:"pen.close",       label:"Cerrar/aparcar el trazado en curso" },
    { cmd:"pen.toSelection", label:"Trazado → Selección" },
    { cmd:"pen.toMask",      label:"Trazado → Máscara de capa" },
    { sep:true },
    { cmd:"sel.feather", label:"Difuminar…" },
    { cmd:"sel.refineEdge", label:"Refinar borde…",
      help:"Pelo, pelaje, bordes semitransparentes: un filtro guiado por el color de la foto engancha el borde a las transiciones reales en vez de difuminarlo a ciegas." },
    { cmd:"sel.fillContent", label:"Rellenar según el contenido…" },
    { cmd:"sel.contentAwareMove", label:"Mover según el contenido",
      help:"Arrastra lo seleccionado a otro sitio: el hueco que deja se rellena solo, con el mismo motor que «Rellenar según el contenido»." },
    { cmd:"sel.rangeMask", label:"Máscaras de luminosidad y color…",
      help:"Luces, medios y sombras en cinco niveles cada uno, más una máscara por color, con vista previa y salida directa a máscara de capa." }
  ]},
  { label:"Capa", items:[
    { cmd:"layer.add",       label:"Nueva capa" },
    { cmd:"layer.duplicate", label:"Duplicar capa" },
    { cmd:"layer.remove",    label:"Eliminar capa" },
    { sep:true },
    { cmd:"layer.up",        label:"Subir" },
    { cmd:"layer.down",      label:"Bajar" },
    { cmd:"transform.start", label:"Transformación libre (F)",
      help:"Tiradores en el lienzo para escalar, rotar, sesgar o deformar la capa activa, con vista previa en directo." },
    { cmd:"layer.transform", label:"Transformar capa… (deslizadores)" },
    { cmd:"layer.convertSmart", label:"Convertir en objeto inteligente",
      help:"Guarda el original íntegro: reescalar o rotar después con Transformación libre siempre remuestrea desde ahí, así que nunca pierde nitidez por hacerlo varias veces." },
    { cmd:"layer.rasterizeSmart", label:"Rasterizar objeto inteligente",
      help:"Vuelve a ser una capa normal: se puede pintar directamente, pero deja de recordar el original." },
    { cmd:"layer.rasterizeFillShape", label:"Rasterizar capa",
      help:"Convierte una capa de relleno o de forma en una capa normal, con sus píxeles actuales: hace falta para poder pintar directamente encima." },
    { sep:true },
    { cmd:"layer.group",   label:"Agrupar capas (Ctrl+G)",
      help:"Mete las capas seleccionadas en un grupo nuevo: una carpeta plegable con su propia opacidad, modo de fusión y máscara." },
    { cmd:"layer.ungroup", label:"Desagrupar (Ctrl+Mayús+G)" },
    { cmd:"layer.styles",  label:"Estilos de capa…",
      help:"Sombra paralela, resplandor exterior, trazo y superposición de degradado, reeditables en cualquier momento." },
    { cmd:"layer.blendIf", label:"Fusionar si…",
      help:"Mezcla por brillo sin pintar ninguna máscara: dos deslizadores —esta capa y la de debajo— con partición Alt para una rampa suave en vez de un corte duro." },
    { sep:true },
    { label:"Texto", submenu:[
      { cmd:"layer.text",     label:"Nueva capa de texto" },
      { cmd:"layer.editText", label:"Editar texto" },
      { cmd:"layer.rasterizeText", label:"Rasterizar texto" }
    ]},
    { label:"Capa de ajuste", submenu:[
      { cmd:"layer.addAdjust",  label:"Nueva capa de ajuste…" },
      { cmd:"layer.editAdjust", label:"Editar capa de ajuste…" }
    ]},
    { label:"Capa de relleno", submenu:[
      { cmd:"layer.addFillColor",    label:"Color sólido" },
      { cmd:"layer.addFillGradient", label:"Degradado" },
      { cmd:"layer.addFillPattern",  label:"Motivo…",
        help:"Pide una imagen y la deja repetida en mosaico, con escala y rotación ajustables después en el panel de Propiedades." }
    ]},
    { label:"Alinear y distribuir", submenu:[
      { cmd:"layer.alignLeft",    label:"Alinear a la izquierda" },
      { cmd:"layer.alignCenterH",  label:"Centrar horizontalmente" },
      { cmd:"layer.alignRight",    label:"Alinear a la derecha" },
      { cmd:"layer.alignTop",      label:"Alinear arriba" },
      { cmd:"layer.alignCenterV",  label:"Centrar verticalmente" },
      { cmd:"layer.alignBottom",   label:"Alinear abajo" },
      { sep:true },
      { cmd:"layer.distributeH",   label:"Distribuir horizontalmente" },
      { cmd:"layer.distributeV",   label:"Distribuir verticalmente" }
    ]},
    { label:"Combinar", submenu:[
      { cmd:"layer.mergeDown", label:"Combinar con la de abajo" },
      { cmd:"layer.mergeVisible", label:"Combinar visibles" },
      { cmd:"layer.flatten",   label:"Acoplar imagen" }
    ]},
    { label:"Máscara de capa", submenu:[
      { cmd:"layer.maskReveal",  label:"Descubrir todo" },
      { cmd:"layer.maskHide",    label:"Ocultar todo" },
      { cmd:"layer.maskFromSel", label:"Descubrir selección" },
      { cmd:"layer.maskFromSelInvert", label:"Ocultar selección" },
      { cmd:"layer.gradientMask", label:"Degradada lineal o radial…" },
      { sep:true },
      { cmd:"layer.maskEdit",    label:"Pintar máscara" },
      { cmd:"layer.maskInvert",  label:"Invertir máscara" },
      { cmd:"layer.maskToggle",  label:"Activar o desactivar máscara" },
      { sep:true },
      { cmd:"layer.maskLevels",     label:"Niveles de la máscara…" },
      { cmd:"layer.maskCurves",     label:"Curvas de la máscara…" },
      { cmd:"layer.maskBlur",       label:"Suavizar máscara…" },
      { cmd:"layer.maskProperties", label:"Propiedades de la máscara…" },
      { cmd:"layer.maskText", label:"Por texto Premium 👑…" },
      { cmd:"layer.maskDepth", label:"Por profundidad Premium 👑…",
        help:"La IA calcula la distancia de cada punto y pone como máscara de la capa (de imagen o de ajuste) la zona que elijas: primer plano, plano medio, fondo o un intervalo. Sirve para ajustes locales por distancia." },
      { cmd:"layer.maskRefineEdge", label:"Refinar borde…",
        help:"Pelo, pelaje, bordes semitransparentes: un filtro guiado por el color de la foto engancha el alfa a las transiciones reales en vez de difuminarlo a ciegas." },
      { sep:true },
      { cmd:"layer.maskApply",   label:"Aplicar máscara" },
      { cmd:"layer.maskRemove",  label:"Eliminar máscara" }
    ]},
    { sep:true },
    { cmd:"layer.stickers",  label:"Añadir stickers…",
      help:"Más de 1.500 emojis en 3D, color, plano o alto contraste: colócalos, escálalos y gíralos sobre la foto. Cada sticker queda en su propia capa." },
    { cmd:"layer.watermark", label:"Añadir marca de agua…" }
  ]},
  { label:"Ajustes", items:[
    // Todos los ajustes automáticos juntos (como la pestaña «Automáticos» del cajón)
    { label:"Automáticos", ic:"wand-sparkles", submenu:[
      { cmd:"adj.autoEnhance",        ic:"wand-sparkles", label:"Mejora automática" },
      { cmd:"adj.autoEnhancePremium", ic:"wand-sparkles", label:"Mejora automática Premium 👑" },
      { sep:true },
      { cmd:"adj.autoToneColor",      ic:"wand",          label:"Tono / Color automático…",
        help:"Con interruptor Premium 👑 en el propio ajuste." },
      { cmd:"adj.autoToneColorPremium", ic:"wand",       label:"Tono / Color automático Premium 👑…" },
      { cmd:"adj.auto",               ic:"contrast",      label:"Contraste automático" },
      { cmd:"adj.autoPremium",        ic:"contrast",      label:"Contraste automático Premium 👑" },
      { cmd:"adj.autoLevels",         ic:"chart-column",  label:"Niveles automáticos" },
      { cmd:"adj.autoLevelsPremium",  ic:"chart-column",  label:"Niveles automáticos Premium 👑" },
      { sep:true },
      { cmd:"adj.lowLight",           ic:"lightbulb",     label:"Iluminar foto oscura…",
        help:"Abre las sombras según la luz de cada zona, sin quemar lo que ya estaba bien iluminado. Con interruptor Premium 👑 en el propio ajuste." },
      { cmd:"adj.lowLightPremium",    ic:"lightbulb",     label:"Iluminar foto oscura Premium 👑…" }
    ]},
    { sep:true },
    { cmd:"adj.brightness", label:"Brillo y contraste…" },
    { cmd:"adj.exposure",   label:"Exposición…" },
    { cmd:"adj.levels",     label:"Niveles…" },
    { cmd:"adj.curves",     label:"Curvas…",
      help:"RGB, rojo, verde, azul y luminosidad, todas visibles a la vez; vista R · G · B simultánea, curva de luminosidad y de color vinculables y 25 estilos (S clásica, cine, mate…)." },
    { cmd:"adj.toneBand",   label:"Tonos del histograma…",
      help:"Ajusta sólo una franja de tonos (negros, sombras, medios, luces o blancos) eligiéndola en el histograma." },
    { cmd:"adj.shadowsHighlights", label:"Sombras / Iluminaciones…" },
    { cmd:"adj.whiteBalance", label:"Balance de blancos…" },
    { cmd:"adj.tone",       label:"Tonos (blancos/luces/sombras/negros)…" },
    { cmd:"adj.hsl",        label:"Tono y saturación…" },
    { cmd:"adj.vibrance",   label:"Vibrance…" },
    { label:"Color avanzado", submenu:[
      { cmd:"adj.colorGrading",   label:"Gradación de color…" },
      { cmd:"adj.splitToning",    label:"Virado dividido…" },
      { cmd:"adj.photoFilter",    label:"Filtro fotográfico…" },
      { cmd:"adj.rangeHsl",       label:"Tono y saturación por rangos…" },
      { cmd:"adj.replaceColor",   label:"Reemplazar color…" },
      { cmd:"adj.matchColor",     label:"Igualar color…" },
      { cmd:"adj.labCurves",      label:"Curvas Lab / luminosidad…" },
      { sep:true },
      { cmd:"adj.colorBands",     label:"Color por canales…" },
      { cmd:"adj.colorBalance",   label:"Equilibrio de color…" },
      { cmd:"adj.selectiveColor", label:"Corrección selectiva…" },
      { cmd:"adj.channelMixer",   label:"Mezclador de canales…" },
      { cmd:"adj.gradientMap",    label:"Mapa de degradado…" }
    ]},
    { label:"Tono avanzado", submenu:[
      { cmd:"adj.dehaze",          label:"Quitar neblina…" },
      { cmd:"adj.hdrTone",         label:"Tono HDR…" },
      { cmd:"adj.tonalContrast",   label:"Contraste tonal…" },
      { cmd:"adj.clahe",           label:"Contraste local (CLAHE)…" },
      { cmd:"adj.clahePremium",    label:"Contraste local (CLAHE) Premium 👑…" },
      { cmd:"adj.graduatedFilter", label:"Densidad neutra graduada / radial…" }
    ]},
    { label:"Mapa tonal y gráfico", submenu:[
      { cmd:"adj.threshold",  label:"Umbral…" },
      { cmd:"adj.posterize",  label:"Posterizar…" },
      { cmd:"adj.equalize",   label:"Ecualizar…" },
      { cmd:"adj.desaturate", label:"Desaturar…" }
    ]},
    { sep:true },
    { cmd:"adj.grayscale",  label:"Blanco y negro" },
    { cmd:"adj.invert",     label:"Invertir" }
  ]},
  { label:"Filtro", items:[
    { label:"Especiales", submenu:[
    { cmd:"filter.photoDevelop", label:"Revelado fotográfico…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5h16v11H4z"/><path d="M7 4.5h10M8 11h8M8 15h5"/><circle cx="17" cy="15" r="1.5"/></svg>',
      help:"Abre el revelador no destructivo sobre la capa activa. Sus parámetros, porcentaje de filtro, máscara y opacidad se guardan por separado." },
    { cmd:"file.socialPost", label:"Collage / History / Post…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
      help:"Collages, publicaciones e historias para redes: 40 diseños de collage, formatos de Instagram, TikTok, Facebook, X, YouTube, LinkedIn, Pinterest y más, proporciones verticales y horizontales, y la pantalla de los móviles más conocidos. Crea el resultado en una pestaña nueva." },
    { cmd:"layer.meme", label:"Crear meme…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6.5 6.5h11M6.5 17.5h11"/><circle cx="12" cy="12" r="3.2"/><path d="M10.6 12.6c.4.5.9.7 1.4.7s1-.2 1.4-.7"/><path d="M10.8 11.1h.01M13.2 11.1h.01"/></svg>',
      help:"Creador de memes a pantalla completa: 26 diseños (clásico, fondo negro arriba y abajo, comparación, expectativa vs. realidad, periódico, chat, «Se busca», historias 9:16…), 29 tipografías, 26 estilos de texto, contornos, sombras, neón, relieve 3D, bocadillos y efectos de imagen." },
    { cmd:"filter.vintage", label:"Filtro Vintage…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 8h18M3 16h18"/><path d="M6 5v3M10 5v3M14 5v3M18 5v3M6 16v3M10 16v3M14 16v3M18 16v3" opacity=".6"/><circle cx="12" cy="12" r="1.6"/></svg>',
      help:"Da aspecto antiguo a la foto: virados, películas clásicas, grano, fugas de luz, polvo, bordes y ópticas de época. Crea una capa de filtro reeditable." },
    { cmd:"filter.looks",   label:"Estilos…",
      help:"160 acabados de un clic en 16 categorías —retrato, paisaje, cine, películas, urbano, comida, moda, redes sociales, blanco y negro, noche, pastel, duotonos, vintage…— con buscador e intensidad.",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.6 0 3.9 3.2 6.2 5.3 6.2 1.4 0 1.6-.9 1.6-1.6 0-.9-.6-1.4-.6-2.3 0-1.1.9-1.9 2.1-1.9h1.8c3.1 0 5.3-2 5.3-4.6 0-2.1-3-3.4-7-3.4z"/><circle cx="7.8" cy="10.2" r="1" fill="currentColor" stroke="none"/><circle cx="10.8" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="7.2" r="1" fill="currentColor" stroke="none"/></svg>' },
    { cmd:"filter.lut",     label:"Tabla de color (LUT)…", help:"Carga un archivo .cube de etalonaje y lo aplica en una capa nueva." }
    ]},
    { label:"Desenfoques", submenu:[
      { cmd:"filter.blur",         label:"Desenfoque gaussiano…" },
      { cmd:"filter.blurGallery",  label:"Galería de desenfoque…" },
      { cmd:"filter.utilityBlur",  label:"Caja / forma / promedio / inteligente…" },
      { cmd:"filter.motionBlur",   label:"Desenfoque de movimiento…" },
      { cmd:"filter.lensBlur",     label:"Desenfoque de lente…" },
      { cmd:"filter.radialBlur",   label:"Desenfoque radial / zoom…" },
      { cmd:"filter.surfaceBlur",  label:"Desenfoque de superficie…" }
    ]},
    { label:"Enfoque y restauración", submenu:[
      { cmd:"filter.sharpen",          label:"Enfocar…" },
      { cmd:"filter.advancedSharpen",  label:"Máscara de enfoque / estabilizador…" },
      { cmd:"filter.selectiveSharpen", label:"Enfoque selectivo…" },
      { cmd:"filter.smartSharpen",     label:"Nitidez inteligente…" },
      { cmd:"filter.highPass",         label:"Paso alto…" },
      { cmd:"filter.restoration",      label:"Mediana / polvo / destramar…" }
    ]},
    { label:"Fotografía y detalle", submenu:[
      { cmd:"filter.lensCorrection", label:"Corrección de lente…" },
      { cmd:"filter.lensProfile", label:"Corrección de lente por perfil Premium 👑…" },
      { cmd:"filter.portrait", label:"Retoque de retrato…" },
      { cmd:"filter.freqsep",  label:"Separación de frecuencias…",
        help:"Separa color/luz y textura en dos capas —«Baja» y «Alta», en Luz lineal— para retocar tono de piel sin perder detalle, o corregir una marca sin manchar el color." },
      { cmd:"dodgeburn.start", label:"Dodge & Burn, gris 50 % (Ctrl+Mayús+D)",
        help:"Pinta blanco o negro sobre una capa gris en modo Superponer: aclara u oscurece por zona sin tocar ni un píxel de la foto original." },
      { cmd:"dodgeburn.viewGray", label:"Dodge & Burn: ver la capa gris",
        help:"Muestra en tiempo real la capa gris al 50 % tal cual, para ver dónde se ha aclarado y oscurecido." },
      { cmd:"filter.clarity", label:"Detalle y estructura…" },
      { cmd:"filter.vignette", label:"Viñeteado…" }
    ]},
    { label:"Ruido", submenu:[
      { cmd:"filter.denoise", label:"Reducción de ruido…" },
      { cmd:"filter.channelDenoise", label:"Reducción de ruido por canal…" },
      { cmd:"filter.noise", label:"Añadir ruido…" }
    ]},
    { label:"Pixelizar", submenu:[
      { cmd:"filter.pixelate", label:"Mosaico / cristalizar / puntillismo / semitono…" }
    ]},
    { label:"Estilizar", submenu:[
      { cmd:"filter.stylize", label:"Relieve / hallar bordes…" },
      { cmd:"filter.stylizeEffects", label:"Resplandor / solarizar / viento / óleo…" }
    ]},
    { label:"Artísticos", submenu:[
      { cmd:"filter.artisticGallery", label:"Galería de filtros artísticos…" }
    ]},
    { label:"Interpretar", submenu:[
      { cmd:"filter.renderEffects", label:"Nubes / fibras / destello / iluminación…" }
    ]},
    { label:"Textura", submenu:[
      { cmd:"filter.textureEffects", label:"Texturizador / grano / azulejos / craquelado…" },
      { cmd:"filter.offsetMorphology", label:"Desplazamiento / mínimo / máximo…" }
    ]},
    { label:"Otros", submenu:[
      { cmd:"filter.customConvolution", label:"Convolución personalizada 5×5…" }
    ]},
    { label:"Distorsión y geometría", submenu:[
      { cmd:"filter.distort",           label:"Esferizar / coordenadas polares…" },
      { cmd:"filter.classicDistort",    label:"Distorsionar clásico…" },
      { cmd:"filter.adaptiveWideAngle", label:"Gran angular adaptable…" },
      { cmd:"filter.puppetWarp",        label:"Deformación de posición libre…" },
      { cmd:"filter.perspective",       label:"Perspectiva…" },
      { cmd:"filter.liquify",           label:"Licuar" }
    ]},
    { label:"Corrección local", submenu:[
      { cmd:"filter.spot",  label:"Pincel corrector" },
      { cmd:"filter.patch", label:"Parche / tampón de clonar" }
    ]}
  ]},
  { label:"Inteligencia Artificial", items:[
    /* Todas las herramientas de IA juntas, ordenadas por lo que hacen. El
       cajón del móvil (pestaña «Inteligencia Artificial») toma de aquí el
       orden y los títulos de sección, así que los dos coinciden siempre.
       Las funciones de IA nuevas son sólo Premium 👑 (ver CLAUDE.md). */
    { header:"IA avanzada local" },
    { cmd:"ai.advancedLocal", ic:"wand-sparkles", label:"IA avanzada local…",
      help:"Módulo fullscreen para la nueva IA CUDA/PyTorch de Realify. En la Fase 1 muestra la foto y detecta Realify AI Local, GPU NVIDIA, CUDA y VRAM; los modelos se activarán por fases." },
    { sep:true },
    { header:"Seleccionar" },
    { cmd:"ai.tapSelect", ic:"mouse-pointer-click", label:"Selección con un toque Premium 👑…", premium:true,
      help:"Toca un objeto y la IA (Segment Anything) lo selecciona entero; toca más para añadir o quitar partes. Borde afinado a la resolución de la foto." },
    { cmd:"sel.subject", ic:"user-round", label:"Seleccionar sujeto",
      help:"Detecta a la persona con IA (BodyPix); si no encuentra a nadie, cae al fondo por color conectado a los bordes." },
    { cmd:"sel.sky", ic:"cloud",     label:"Seleccionar cielo",
      help:"Detecta el cielo con IA (DeepLab/ADE20K)." },
    { cmd:"ai.textSelect", ic:"text-select", label:"Seleccionar por texto Premium 👑…", premium:true,
      help:"Escribe lo que quieres seleccionar —«persona», «cielo», «coche rojo», «césped sin personas»— y sale una selección o la máscara de la capa. Reconoce 150 tipos de cosas (nombres y sinónimos en español) y colores; el borde se ajusta a la foto. Todo en tu equipo." },
    { cmd:"ai.depthSelect", ic:"mountain-snow", label:"Seleccionar por profundidad Premium 👑…", premium:true,
      help:"La IA calcula la distancia de cada punto: elige primer plano, plano medio, fondo o un intervalo (toca la imagen para elegir una distancia) y deja una selección o la máscara de una capa, con el borde ajustado a la foto." },
    { sep:true },
    { header:"Borrar y rellenar" },
    { cmd:"ai.magicErase", ic:"eraser", label:"Borrador mágico Premium 👑…", premium:true,
      help:"Toca lo que quieras quitar (personas, cables, objetos): la IA lo selecciona y LaMa rellena el hueco. El resultado va a una capa nueva." },
    { cmd:"image.removeBackground", ic:"image-minus", label:"Eliminar fondo…" },
    { cmd:"ai.expand", ic:"expand", label:"Expandir con IA…",
      help:"Agranda el lienzo (a un formato o con márgenes) y la IA (LaMa) rellena los bordes nuevos. El resultado se abre en una pestaña nueva." },
    { cmd:"sky.replace", ic:"cloud-sun", label:"Reemplazar cielo…",
      help:"Detecta el cielo con IA (DeepLab/ADE20K) y lo sustituye por un color, un degradado o una foto propia, en una capa nueva con su propia máscara." },
    { sep:true },
    { header:"Caras" },
    { cmd:"ai.faceBlur", ic:"scan-face", label:"Difuminar caras Premium 👑…", premium:true,
      help:"Encuentra las caras (YuNet) y las difumina, pixela o tapa para proteger la privacidad; toca una para excluirla. Capa nueva." },
    { cmd:"ai.faceRetouch", ic:"sparkles", label:"Retoque de cara Premium 👑…", premium:true,
      help:"La IA separa piel, ojos, dientes y labios en cada cara: suaviza la piel conservando la textura, da luz a los ojos, blanquea los dientes y ajusta el color de los labios. Capa nueva." },
    { cmd:"ai.faceRestore", ic:"user-round", label:"Restaurar caras Premium 👑…", premium:true,
      help:"Reconstruye caras borrosas, pequeñas, antiguas o muy comprimidas con IA (GFPGAN), conservando el color de piel y el grano de la foto; toca una para excluirla. Capa nueva. La primera vez descarga el modelo (170 MB)." },
    { cmd:"ai.redEye", ic:"scan-eye", label:"Ojos rojos Premium 👑", premium:true,
      help:"Encuentra los ojos y les quita el rojo del flash sin tocar el reflejo. Capa nueva." },
    { sep:true },
    { header:"Encuadre" },
    { cmd:"ai.smartCrop", ic:"scan", label:"Recorte inteligente para redes Premium 👑…", premium:true,
      help:"Elige el formato (Instagram, historias, YouTube, Pinterest…) y la IA propone el mejor encuadre: conserva el sujeto y las caras, no corta cabezas y deja el sujeto en los tercios. Arrastra para afinarlo."},
    { cmd:"ai.faceCrop", ic:"frame", label:"Recorte de retrato Premium 👑", premium:true,
      help:"Abre Recortar con el marco encuadrado en la cara (ojos en el tercio superior, cabeza y hombros)." },
    { sep:true },
    { header:"Profundidad" },
    { cmd:"ai.depthBlur", ic:"aperture", label:"Desenfoque por profundidad Premium 👑…", premium:true,
      help:"La IA (Depth Anything) calcula la distancia de cada punto: toca donde enfocar y lo demás se desenfoca según su distancia, sin halos y con bokeh en las luces. Capa nueva." },
    { cmd:"ai.depthFog", ic:"cloud-fog", label:"Niebla por distancia Premium 👑…", premium:true,
      help:"Añade bruma que crece con la distancia, del color de lo más lejano de la foto (o blanca, cálida, fría). Capa nueva." },
    { cmd:"ai.depthLight", ic:"sunset", label:"Luz por profundidad Premium 👑…", premium:true,
      help:"Aclara lo cercano y oscurece lo lejano (o al revés) según la distancia, con punto de giro y transición suaves y sin recortar las luces. Capa nueva." },
    { cmd:"ai.depthPlanes", ic:"layers-plus", label:"Separar planos Premium 👑…", premium:true,
      help:"Reparte la foto en 2, 3 o 4 planos por distancia y crea una capa por plano con su máscara, para retocarlos por separado." },
    { cmd:"ai.photo3d", ic:"move-3d", label:"Foto 3D Premium 👑…", premium:true,
      help:"Anima la foto con paralaje (lo cercano se mueve más que lo lejano) y la guarda como GIF." },
    { sep:true },
    { header:"Mejorar y restaurar" },
    { cmd:"ai.upscale", ic:"scaling", label:"Ampliar con IA…",
      help:"Amplía ×2 o ×4 recuperando detalle (Real-ESRGAN, SPAN, UltraSharp). Se procesa en tu equipo; el resultado se abre en una pestaña nueva." },
    { cmd:"filter.aiDenoise", ic:"denoise-ai", label:"Reducción de ruido con IA…",
      help:"SCUNet (modelo de ImageToolbox): quita el ruido real de cámara conservando el detalle. La primera vez descarga el modelo (91 MB)." },
    { cmd:"filter.aiDejpeg", ic:"file-image", label:"Quitar artefactos JPEG con IA…",
      help:"FBCNN (modelo de ImageToolbox): elimina bloques y halos de compresión. La primera vez descarga el modelo (144 MB)." },
    { cmd:"ai.lowLight", ic:"lightbulb", label:"Iluminar con IA Premium 👑…", premium:true,
      help:"Para fotos oscuras o a contraluz: la IA (Zero-DCE++) decide cuánto levantar cada zona y cada color, sin halos, limpiando el ruido que aparece en las sombras. Automático: una foto bien expuesta no cambia. Capa que se reabre." },
    { cmd:"ai.colorize", ic:"colorize", label:"Colorear con IA…",
      help:"Da color a fotos en blanco y negro (SpongeColor, Colorizer, DDColor) manteniendo la nitidez original. Crea una capa nueva." },
    { cmd:"filter.lens",    label:"Adaptive Photo Lens…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/><path d="M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5"/></svg>',
      help:"Reconoce el tipo de foto con un modelo local y aplica el revelado que le va" },
    { sep:true },
    { header:"Para imágenes de IA" },
    { cmd:"filter.camera",  label:"Realify…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><circle cx="12" cy="13" r="3.5"/><path d="M17 10.5h.01"/></svg>',
      help:"Simula óptica, sensor y compresión de una cámara. Abre un panel con controles avanzados; con interruptor Premium 👑 en la propia ventana." },
    { cmd:"filter.cameraPremium", label:"Realify Premium 👑…", premium:true,
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><circle cx="12" cy="13" r="3.5"/><path d="M17 10.5h.01"/></svg>',
      help:"Realify con el motor Premium: cadena en coma flotante de 32 bits, luces que no viran, color en OKLab con mapeo de gama y tramado." },
    { cmd:"filter.purepixel", label:"PurePixel…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16M4 9h16M4 15h16" opacity=".55"/><path d="M9 9h6v6H9z" fill="currentColor" stroke="none" opacity=".85"/></svg>',
      help:"Aplica cambios sutiles a los píxeles de la capa activa. Función experimental." },
    { cmd:"filter.unmark",  label:"Unmark…",
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 15.5h4.5M16.5 13v5" opacity=".9"/><path d="M4 20 20 4"/></svg>',
      help:"Elimina la marca visible del generador, perturba las marcas invisibles de los píxeles y limpia la procedencia del archivo (C2PA, XMP, EXIF). Panel por secciones con vista previa." },
    { cmd:"an.metrics", ic:"gauge",   label:"Plausibilidad…" },
    { cmd:"an.forensics", ic:"microscope", label:"Segunda opinión…" },
    { cmd:"an.strip", ic:"shield-check",     label:"Limpiar metadatos de un archivo…" }
  ]},
  { label:"Análisis", items:[
    { cmd:"an.palette", ic:"palette", label:"Paleta de colores…",
      help:"Los colores dominantes de la imagen: tocar uno lo copia y lo pone como color frontal; se puede crear como capa, descargar o copiar." },
    { cmd:"an.eyedropper", ic:"pipette", label:"Cuentagotas de pantalla",
      help:"Coge un color de cualquier parte de la pantalla, fuera de la imagen también (Chrome y Edge de escritorio)." },
    { sep:true },
    { cmd:"an.spectrum",  label:"Espectro de frecuencia…" },
    { cmd:"view.histogram", label:"Histograma interactivo",
      help:"Panel con el histograma RGB en vivo: toca una zona para ajustar sólo esos tonos." },
    { cmd:"view.smartGrid", label:"Composición: cuadrícula inteligente…",
      help:"Analiza sujeto, horizonte y rostros y dibuja tercios, proporción áurea, espiral y diagonales adaptadas; propone recorte y enderezado." },
    { sep:true },
    { cmd:"an.exif",      label:"Metadatos EXIF…", help:"Permite revisar o escribir datos de cámara en exportaciones JPEG." },
  ]},
  { label:"Ver", items:[
    { cmd:"view.fit",     label:"Ajustar a la ventana" },
    { cmd:"view.zoom100", label:"Tamaño real" },
    { cmd:"view.zoomIn",  label:"Acercar" },
    { cmd:"view.zoomOut", label:"Alejar" },
    { sep:true },
    { cmd:"view.compare", label:"Comparar antes/después" },
    { cmd:"view.compare100", label:"Comparar al 100 %" },
    { sep:true },
    { cmd:"view.panels",  label:"Mostrar u ocultar paneles" },
    { sep:true },
    { cmd:"view.rulers",      label:"Mostrar reglas" },
    { cmd:"view.guides",      label:"Mostrar guías" },
    { cmd:"view.guidesClear", ic:"guides-clear", label:"Borrar guías", help:"Quita todas las guías (se puede deshacer). Para quitar una sola: doble clic o doble toque sobre ella, o arrástrala a su regla." },
    { sep:true },
    { cmd:"view.grid",        label:"Mostrar cuadrícula" },
    { cmd:"view.gridSnap",    label:"Ajustar a la cuadrícula" },
    { cmd:"view.gridConfig",  label:"Configurar cuadrícula…" },
    { cmd:"view.smartGrid",   label:"Cuadrícula inteligente…" },
    { cmd:"view.smartGridToggle", label:"Mostrar u ocultar la cuadrícula inteligente" },
    { sep:true },
    { cmd:"view.histogram",   label:"Histograma" }
  ]},
  { label:"Ayuda", items:[
    { cmd:"help.guide",   label:"Guía…" },
    { cmd:"help.diag",    label:"Diagnóstico…" },
    { sep:true },
    { cmd:"help.update", ic:"refresh-cw", label:"Buscar actualización…" },
    { cmd:"help.install", label:"Instalar como app…" },
    { sep:true },
    { cmd:"help.legal",    label:"Aviso legal…" },
    { cmd:"help.privacy",  label:"Política de privacidad…" },
    { cmd:"help.cookies",  label:"Política de cookies…" },
    { sep:true },
    { cmd:"help.about",   label:"Acerca de…" }
  ]}
];

const roots = document.getElementById("menuRoots");
let openPop = null, openRoot = null;
/* Submenú («Máscara de capa», «Combinar»…): un segundo `.menu-pop`
   flotante, anclado al botón que lo abrió en vez de a la barra. Vive
   aparte de `openPop` porque un menú de escritorio sólo tiene un
   nivel de anidamiento —no hace falta una pila— y así el cierre por
   clic fuera o por Escape puede tratar «el menú» como los dos
   lienzos que son sin complicarse. */
let subPop = null, subAnchor = null;

function closeSub(){
  if(subPop){ subPop.remove(); subPop = null; }
  subAnchor = null;
}

function closeMenu(){
  closeSub();
  if(openPop){ openPop.remove(); openPop = null; }
  if(openRoot){ openRoot.classList.remove("open"); openRoot = null; }
}

/* Despliega `items` a la derecha del botón `anchor` (a la izquierda si
   no cabe). Lo usan tanto el menú de la barra como el contextual, así
   que no depende de `enabled()`/`run()` para las entradas sin `cmd`:
   cada una decide con su propio `onCmd` si es un comando registrado o
   un `onClick` suelto (ver `submenuRow`, más abajo). */
function buildSubPop(items, anchor, onCmd){
  closeSub();
  const sub = document.createElement("div");
  sub.className = "menu-pop menu-sub";
  sub.setAttribute("role", "menu");
  for(const it of items){
    if(it.sep){
      const s = document.createElement("div");
      s.className = "menu-sep";
      sub.appendChild(s);
      continue;
    }
    sub.appendChild(submenuRow(it, onCmd));
  }
  document.body.appendChild(sub);
  const r = anchor.getBoundingClientRect();
  sub.style.top = r.top + "px";
  sub.style.left = r.right + "px";
  const sr = sub.getBoundingClientRect();
  if(sr.right > innerWidth - 8) sub.style.left = Math.max(4, r.left - sr.width) + "px";
  if(sr.bottom > innerHeight - 8) sub.style.top = Math.max(4, innerHeight - sr.height - 8) + "px";
  subPop = sub;
  subAnchor = anchor;
  return sub;
}

function submenuRow(it, onCmd){
  const b = document.createElement("button");
  b.className = "menu-item";
  b.setAttribute("role", "menuitem");
  if(it.cmd){
    b.disabled = !enabled(it.cmd);
    if(it.help) b.title = it.help;
    const k = labelFor(it.cmd);
    b.innerHTML = iconHtml(it) + `<span>${it.label}</span>` + (k ? `<span class="k">${k}</span>` : "");
    b.addEventListener("click", () => onCmd(it));
  } else {
    b.disabled = !!it.disabled;
    b.innerHTML = `<span>${it.label}</span>`;
    b.addEventListener("click", () => onCmd(it));
  }
  return b;
}

/* Fila «con flecha» que abre un submenú al pasar el ratón o al tocar,
   en vez de ejecutar nada por sí misma. */
function submenuParentRow(it, onCmd){
  const b = document.createElement("button");
  b.className = "menu-item menu-item-parent";
  b.setAttribute("role", "menuitem");
  b.setAttribute("aria-haspopup", "true");
  b.innerHTML = iconHtml(it) + `<span>${it.label}</span><span class="submenu-arrow" aria-hidden="true">›</span>`;
  let hoverTimer = null;
  const open = () => { clearTimeout(hoverTimer); buildSubPop(it.submenu, b, onCmd); };
  b.addEventListener("mouseenter", () => {
    if(subAnchor === b) return;
    hoverTimer = setTimeout(open, 40);
  });
  b.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
  b.addEventListener("click", e => { e.stopPropagation(); open(); });
  return b;
}

/* Menú contextual suelto, anclado a un punto (x, y) en vez de a un
   botón de la barra: lo que hace falta para un clic derecho sobre
   algo del lienzo o de un panel. Comparte `openPop`/`closeMenu` con
   los menús de la barra, así que Escape y el clic fuera —ya
   enganchados en `initMenu()`— también lo cierran a él sin más. Cada
   entrada trae su propio `onClick`, no un `cmd` global, porque estos
   menús suelen actuar sobre "la cosa concreta bajo el clic" y no
   sobre `activeLayer()` a secas. */
export function openContextMenu(items, x, y){
  closeMenu();
  const pop = document.createElement("div");
  pop.className = "menu-pop";
  pop.setAttribute("role", "menu");

  for(const it of items){
    if(it.sep){
      const s = document.createElement("div");
      s.className = "menu-sep";
      pop.appendChild(s);
      continue;
    }
    const b = document.createElement("button");
    b.className = "menu-item";
    b.setAttribute("role", "menuitem");
    b.disabled = !!it.disabled;
    b.innerHTML = `<span>${it.label}</span>`;
    b.addEventListener("click", () => { closeMenu(); it.onClick(); });
    pop.appendChild(b);
  }

  document.body.appendChild(pop);
  pop.style.left = x + "px";
  pop.style.top = y + "px";
  const pr = pop.getBoundingClientRect();
  if(pr.right > innerWidth - 8) pop.style.left = Math.max(4, innerWidth - pr.width - 8) + "px";
  if(pr.bottom > innerHeight - 8) pop.style.top = Math.max(4, innerHeight - pr.height - 8) + "px";
  openPop = pop;
  return pop;
}

function buildPop(menu, anchor, fullWidth){
  closeMenu();
  const pop = document.createElement("div");
  pop.className = "menu-pop";
  pop.setAttribute("role", "menu");

  const runAndClose = it => { closeMenu(); run(it.cmd); };

  for(const it of menu.items){
    if(it.sep){
      const s = document.createElement("div");
      s.className = "menu-sep";
      pop.appendChild(s);
      continue;
    }
    if(it.header){
      // Título de sección (p. ej. en «Inteligencia Artificial»)
      const h = document.createElement("div");
      h.className = "menu-head";
      h.textContent = it.header;
      pop.appendChild(h);
      continue;
    }
    if(it.submenu){
      pop.appendChild(submenuParentRow(it, runAndClose));
      continue;
    }
    const b = document.createElement("button");
    b.className = "menu-item";
    b.setAttribute("role", "menuitem");
    b.disabled = !enabled(it.cmd);
    if(it.help){ b.title = it.help; b.dataset.help = it.help; }
    const k = labelFor(it.cmd);
    b.innerHTML = iconHtml(it) + `<span>${it.label}</span>` + (k ? `<span class="k">${k}</span>` : "");
    b.addEventListener("click", () => runAndClose(it));
    pop.appendChild(b);
  }

  // Pasar el ratón a otra fila del mismo nivel cierra el submenú que
  // hubiera abierto una anterior — el mismo comportamiento de
  // cualquier barra de menús de escritorio.
  pop.addEventListener("mouseover", e => {
    const row = e.target.closest(".menu-item");
    if(row && row !== subAnchor && !row.classList.contains("menu-item-parent")) closeSub();
  });

  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  if(fullWidth){
    pop.style.top = r.bottom + 2 + "px";
  } else {
    pop.style.left = r.left + "px";
    pop.style.top  = r.bottom + "px";
    // Que no se salga por la derecha
    const pr = pop.getBoundingClientRect();
    if(pr.right > innerWidth - 8) pop.style.left = (innerWidth - pr.width - 8) + "px";
  }
  openPop = pop;
  return pop;
}

export function initMenu(){
  roots.innerHTML = "";
  MENUS.forEach(m => {
    const b = document.createElement("button");
    b.className = "menu-root";
    b.textContent = m.label;
    b.addEventListener("click", e => {
      e.stopPropagation();
      if(openRoot === b){ closeMenu(); return; }
      buildPop(m, b, false);
      b.classList.add("open");
      openRoot = b;
    });
    // Al tener uno abierto, pasar por encima de otro lo cambia, como
    // en cualquier barra de menús de escritorio.
    b.addEventListener("mouseenter", () => {
      if(openRoot && openRoot !== b){
        buildPop(m, b, false);
        b.classList.add("open");
        openRoot = b;
      }
    });
    roots.appendChild(b);
  });

  // Menú único para móvil
  const mBtn = document.getElementById("mMenu");
  mBtn.addEventListener("click", e => { e.stopPropagation(); openMobileMenu(mBtn); });

  document.addEventListener("click", e => {
    if(subPop && subPop.contains(e.target)) return;
    if(openPop && !openPop.contains(e.target)) closeMenu();
  });
  addEventListener("keydown", e => { if(e.key === "Escape") closeMenu(); });
  // Sólo un cambio de ANCHO cierra el menú (girar el móvil, cambiar de
  // ventana): el teclado en pantalla, al aparecer, sólo cambia el
  // alto —y en algunos Android eso también dispara `resize`—, y no
  // hay motivo para cerrar un menú que se sigue viendo perfectamente.
  let lastW = innerWidth;
  addEventListener("resize", () => {
    if(innerWidth === lastW) return;
    lastW = innerWidth;
    closeMenu();
  });
}

/* Menú único de móvil: los 9 menús de escritorio aplanados en una
   lista de 100+ ítems son imposibles de recorrer con el pulgar sin
   un buscador. El campo filtra por texto (insensible a mayúsculas y
   acentos) y cada `header` de sección sólo se queda si le sobrevive
   algún ítem debajo — así un término concreto ("recortar") no deja
   el título suelto de "Imagen" sin nada útil que mostrar. */
function norm(s){
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function buildPopMobile(menu, anchor){
  closeMenu();
  const pop = document.createElement("div");
  pop.className = "menu-pop menu-pop-mobile";

  const searchWrap = document.createElement("div");
  searchWrap.className = "menu-search";
  searchWrap.innerHTML = `<input type="search" placeholder="Buscar en el menú…" aria-label="Buscar en el menú">`;
  pop.appendChild(searchWrap);
  const search = searchWrap.querySelector("input");

  const list = document.createElement("div");
  list.className = "menu-list";
  pop.appendChild(list);

  const rows = [];
  for(const it of menu.items){
    if(it.sep){
      const s = document.createElement("div"); s.className = "menu-sep";
      list.appendChild(s); rows.push({ el:s, header:false, sep:true, text:"" });
      continue;
    }
    if(it.header){
      const h = document.createElement("div");
      h.className = "section-label";
      h.style.padding = "6px 10px 2px";
      h.textContent = it.header;
      list.appendChild(h);
      rows.push({ el:h, header:true, text:"" });
      continue;
    }
    const b = document.createElement("button");
    b.className = "menu-item";
    b.disabled = !enabled(it.cmd);
    const k = labelFor(it.cmd);
    b.innerHTML = iconHtml(it) + `<span>${it.label}</span>` + (k ? `<span class="k">${k}</span>` : "");
    if(it.help) b.title = it.help;
    b.addEventListener("click", () => { closeMenu(); run(it.cmd); });
    list.appendChild(b);
    rows.push({ el:b, header:false, text:norm(it.label) });
  }

  const setRowHidden = (row, hide) => row.el.classList.toggle("menu-row-hidden", hide);

  function filter(){
    const q = norm(search.value.trim());
    let lastHeaderVisible = null, anyAfterHeader = false;
    for(const row of rows){
      if(row.header){
        if(lastHeaderVisible) setRowHidden(lastHeaderVisible, !anyAfterHeader);
        lastHeaderVisible = row; anyAfterHeader = false;
        continue;
      }
      if(row.sep){ setRowHidden(row, !!q); continue; }
      const show = !q || row.text.includes(q);
      setRowHidden(row, !show);
      if(show) anyAfterHeader = true;
    }
    if(lastHeaderVisible) setRowHidden(lastHeaderVisible, !anyAfterHeader);
  }
  search.addEventListener("input", filter);
  search.addEventListener("click", e => e.stopPropagation());

  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  if(r.top > innerHeight / 2){
    pop.style.bottom = Math.max(6, innerHeight - r.top + 2) + "px";
  } else {
    pop.style.top = r.bottom + 2 + "px";
  }
  openPop = pop;
  /* El buscador NO recibe el foco al abrir: en un móvil eso levanta
     el teclado en el acto —tapando media pantalla y, en Chrome para
     Android, disparando un `resize` de la ventana que el propio
     `closeMenu` de más abajo interpretaba como "cambió el tamaño,
     cierra el menú", así que el menú se abría y se cerraba solo en
     el mismo gesto. El usuario que quiera buscar toca el campo él
     mismo; quien sólo quería un ítem visible lo ve entero de un
     vistazo, sin que nada tape la lista. */
  return pop;
}

/* Extraído del handler de `#mMenu` para poder abrir el mismo menú
   desde otro botón (`#mobilebarMenu`, alcanzable con el pulgar) sin
   duplicar la lógica de aplanado. */
/* En el menú de la barra un submenú («Máscara de capa», «Combinar»…)
   es un desplegable aparte; en la lista única y con buscador del
   móvil no hay sitio para un segundo nivel, así que sus entradas se
   incrustan sueltas, con el nombre del grupo delante para que
   «aplicar» siga encontrando «Máscara de capa: Aplicar máscara» sin
   perder de dónde sale. */
function flattenForMobile(items){
  const out = [];
  for(const it of items){
    if(it.submenu){
      for(const sub of it.submenu){
        if(sub.sep) continue;
        out.push({ ...sub, label: it.label + ": " + sub.label });
      }
      continue;
    }
    out.push(it);
  }
  return out;
}

export function openMobileMenu(anchor){
  if(openRoot === anchor){ closeMenu(); return; }
  const all = { items: [] };
  MENUS.forEach((m, i) => {
    if(i) all.items.push({ sep:true });
    all.items.push({ header: m.label });
    /* `desktopOnly`: herramientas que en un móvil no son viables (p. ej.
       la reducción de ruido con IA: 91 MB de modelo y minutos de CPU
       sin WebGPU); en escritorio siguen en su menú de siempre. */
    all.items.push(...flattenForMobile(m.items.filter(x => !x.sep))
      .filter(x => !x.desktopOnly));
  });
  buildPopMobile(all, anchor);
  anchor.classList.add("open");
  openRoot = anchor;
}
