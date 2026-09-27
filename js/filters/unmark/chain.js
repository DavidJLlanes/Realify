/* ══════════════════════════════════════════════════════════════
   UNMARK · ESQUEMA DE LA CADENA

   PROVENIENCIA: Basado en https://github.com/wiltodelta/remove-ai-watermarks
   Las etapas de detección, relleno y perturbación están inspiradas en
   el proyecto de referencia mencionado, con adaptaciones para una
   ejecución completamente local.

   Tres secciones que atacan tres cosas distintas que un generador
   deja en el archivo, en el orden en que conviene tratarlas:

   · MARCAS VISIBLES: el logotipo o el rótulo pintado sobre la
     imagen. Se localiza (detección automática, zona conocida del
     generador, región manual o selección) y se rellena con el
     contenido de alrededor.
   · MARCAS INVISIBLES: la firma escondida en los propios píxeles
     (DWT-DCT, SynthID, Stable Signature, Tree-Ring…). Se rompe el
     soporte estadístico en el que vive —rejilla de bloques, coeficientes
     de frecuencia, bits bajos, alineación geométrica— mediante
     perturbaciones locales.
   · PROCEDENCIA: lo que el archivo declara de sí mismo (C2PA, XMP,
     IPTC, EXIF, comentarios con el prompt). Vive fuera de los
     píxeles y se decide al exportar.

   El orden del array es el orden de ejecución. Las etapas `cpu`
   son lentas y no entran en la vista previa en vivo, como en Realify.
   ══════════════════════════════════════════════════════════════ */

import { VENDORS } from "./vendors.js";

const VENDOR_OPTIONS = VENDORS.map(v => ({ v: v.id, label: v.label }));

export const SECTIONS = [
  { id:"visible", name:"Marcas visibles",
    note:"Logotipos y rótulos pintados sobre la imagen. Se localizan y se rellenan con lo que hay alrededor: una zona pequeña sale invisible; una grande sobre textura compleja se nota y conviene revisarla." },
  { id:"invisible", name:"Marcas invisibles",
    note:"Firmas escondidas en los píxeles. Cada etapa rompe un soporte distinto; juntas cubren los métodos habituales. Ninguna garantiza nada frente a un detector concreto: hay que medirlo." },
  { id:"provenance", name:"Procedencia y metadatos",
    note:"Lo que el archivo declara de su origen: credenciales C2PA, XMP con «trainedAlgorithmicMedia», EXIF, prompts en texto. Va aparte de los píxeles y se resuelve al exportar." }
];

export const CHAIN = [
  /* ── marcas visibles ─────────────────────────────────────── */
  {
    id:"detect", sec:"visible", name:"Detección automática", on:true,
    note:"Busca en los bordes estructuras finas, claras o muy oscuras y sin color —el aspecto de casi todo logotipo o rótulo superpuesto— que destaquen sobre el fondo de alrededor. Cada zona encontrada aparece en la lista de abajo con su puntuación y se puede descartar. Sube la sensibilidad si no encuentra una marca tenue; bájala si marca texto real de la escena.",
    params:[
      {k:"sens",    label:"Sensibilidad", v:55, mode:"keep"},
      {k:"zones",   label:"Dónde buscar", type:"choice", mode:"keep", v:"edges",
       options:[
         {v:"edges",   label:"Bordes y esquinas"},
         {v:"corners", label:"Sólo esquinas"},
         {v:"bottom",  label:"Franja inferior"},
         {v:"all",     label:"Toda la imagen"}
       ]},
      {k:"minsize", label:"Tamaño mínimo", v:20, mode:"keep"},
      {k:"maxsize", label:"Tamaño máximo", v:40, mode:"keep"}
    ]
  },
  {
    id:"vendor", sec:"visible", name:"Zona conocida del generador", on:false,
    note:"Cada generador pinta su marca siempre en el mismo sitio y a un tamaño parecido. Si sabes de dónde viene la imagen, esto marca esa zona sin depender de la detección; útil cuando la marca es tan tenue o tan integrada que el detector no la ve.",
    params:[
      {k:"vendor", label:"Generador", type:"choice", mode:"keep", v:"gemini", options:VENDOR_OPTIONS},
      {k:"pad",    label:"Margen extra", v:25, mode:"keep"}
    ]
  },
  {
    id:"region", sec:"visible", name:"Región manual", on:false,
    note:"Un rectángulo definido a mano en porcentaje del ancho y el alto. Para marcas que no están donde se esperaba o que ningún detector encuentra.",
    params:[
      {k:"x", label:"Posición horizontal", v:80, mode:"keep"},
      {k:"y", label:"Posición vertical",   v:88, mode:"keep"},
      {k:"w", label:"Ancho",               v:18, mode:"keep"},
      {k:"h", label:"Alto",                v:9,  mode:"keep"}
    ]
  },
  {
    id:"selection", sec:"visible", name:"Selección actual del documento", on:false,
    note:"Usa la selección que haya hecha en el lienzo —lazo, varita, rectángulo— como zona a rellenar. Es la forma más precisa de acotar una marca con forma irregular.",
    params:[]
  },
  {
    id:"inpaint", sec:"visible", name:"Relleno de la zona", on:true,
    note:"Cómo se rellena lo marcado. «Híbrido» resuelve primero la estructura suave del fondo por difusión y le devuelve encima la textura fina copiada de un parche vecino: es el que mejor queda casi siempre. «Difusión» sólo suaviza (cielos, degradados, fondos lisos). «Parche» copia un trozo vecino entero (texturas repetitivas). «Servidor» manda la zona a tu VPS para rellenarla con LaMa, que entiende estructuras grandes.",
    params:[
      {k:"method",  label:"Método", type:"choice", mode:"keep", v:"hybrid",
       options:[
         {v:"hybrid",    label:"Híbrido (estructura + textura)"},
         {v:"diffusion", label:"Difusión (fondos lisos)"},
         {v:"patch",     label:"Parche vecino (texturas)"},
         {v:"server",    label:"Servidor (LaMa / MI-GAN)"}
       ]},
      {k:"expand",  label:"Expandir la máscara",   v:30, mode:"keep"},
      {k:"feather", label:"Suavizado del borde",   v:40, mode:"keep"},
      {k:"texture", label:"Textura recuperada",    v:60},
      {k:"grain",   label:"Grano de acompañamiento", v:30}
    ]
  },

  /* ── marcas invisibles ───────────────────────────────────── */
  {
    id:"geometry", sec:"invisible", name:"Transformación geométrica", on:true,
    note:"Una sola pasada de remuestreo que combina microrrotación, recorte de borde, desplazamiento subpíxel y una escala ligeramente distinta en cada eje. Casi todos los detectores de marcas invisibles suponen que la rejilla de píxeles es la misma con la que se incrustó: moverla una fracción de píxel y girarla una fracción de grado deshace esa correspondencia sin que el ojo lo note.",
    params:[
      {k:"rot",   label:"Rotación",                 v:30},
      {k:"crop",  label:"Recorte de borde",         v:15},
      {k:"shift", label:"Desplazamiento subpíxel",  v:50},
      {k:"aniso", label:"Escala no uniforme",       v:20}
    ]
  },
  {
    id:"resample", sec:"invisible", name:"Remuestreo con pérdida", on:true,
    note:"Reduce la resolución interna y la reconstruye con interpolación bicúbica. Lo que se pierde es justo la banda más alta de frecuencias, donde muchas marcas guardan su energía para pasar desapercibidas. La mezcla permite devolver parte del detalle original.",
    params:[
      {k:"amt", label:"Reducción interna", v:30},
      {k:"mix", label:"Mezcla",            v:70, mode:"keep"}
    ]
  },
  {
    id:"dwt", sec:"invisible", name:"Perturbación de ondículas (DWT)", on:true,
    note:"Transformada Haar de la luminancia en uno, dos o tres niveles. La banda de aproximación se descompone además en bloques DCT de 4×4 y se sacuden sus coeficientes: es exactamente el soporte del método DWT-DCT que usan Stable Diffusion y muchos servicios para su marca invisible. Las bandas de detalle reciben una ganancia aleatoria por coeficiente, que desordena las marcas guardadas ahí.",
    params:[
      {k:"ll",     label:"Banda de aproximación (DWT-DCT)", v:40},
      {k:"hf",     label:"Bandas de detalle",               v:35},
      {k:"levels", label:"Niveles", type:"choice", mode:"keep", v:"2",
       options:[{v:"1", label:"1 nivel"}, {v:"2", label:"2 niveles"}, {v:"3", label:"3 niveles"}]}
    ]
  },
  {
    id:"dct", sec:"invisible", name:"Perturbación de coeficientes DCT", on:true,
    note:"Bloques DCT de 8×8 —o 16×16— sobre una rejilla desplazada al azar, con ruido en los coeficientes de la banda elegida, dosificado con la tabla de cuantización JPEG para quedar por debajo de lo visible. Ataca las marcas guardadas en la propia DCT y, de paso, desalinea los bloques respecto a cualquier compresión anterior.",
    params:[
      {k:"amt",   label:"Intensidad",          v:40},
      {k:"band",  label:"Banda de frecuencia", v:50, mode:"keep"},
      {k:"block", label:"Tamaño de bloque", type:"choice", mode:"keep", v:"8",
       options:[{v:"8", label:"8 × 8"}, {v:"16", label:"16 × 16"}]}
    ]
  },
  {
    id:"blursharp", sec:"invisible", name:"Suavizado y reenfoque", on:true,
    note:"Un desenfoque gaussiano leve seguido de una máscara de enfoque: la imagen recupera su nitidez aparente pero la fase de las frecuencias altas ya no es la original. Los contornos fuertes se protegen para no crear halos.",
    params:[
      {k:"blur",  label:"Suavizado",               v:30},
      {k:"sharp", label:"Reenfoque",               v:40},
      {k:"edge",  label:"Protección de contornos", v:60, mode:"keep"}
    ]
  },
  {
    id:"noise", sec:"invisible", name:"Ruido gaussiano", on:true,
    note:"Ruido aleatorio en luminancia y, aparte, en color. Es el ataque más simple y el más medido: para las marcas de vídeo de SynthID, una desviación de 0,15 sobre la escala 0–1 dejó de detectarse en las pruebas publicadas del proyecto de referencia, aunque en una foto ese nivel ya se ve. Con «Tamaño de grano» el ruido se genera a menor resolución y se amplía, así que sale correlacionado, como el grano real.",
    params:[
      {k:"lum",  label:"Luminancia",      v:30},
      {k:"chr",  label:"Color",           v:15},
      {k:"size", label:"Tamaño de grano", v:20, mode:"keep"}
    ]
  },
  {
    id:"tone", sec:"invisible", name:"Variación tonal", on:false,
    note:"Cambios pequeños de gamma, contraste, saturación y matiz. Por sí solos no quitan ninguna marca seria, pero alteran el histograma y los valores exactos de cada píxel, que es lo que rompe cualquier marca que dependa de valores absolutos.",
    params:[
      {k:"gamma",    label:"Gamma",       v:20, min:-100},
      {k:"contrast", label:"Contraste",   v:15, min:-100},
      {k:"sat",      label:"Saturación",  v:0,  min:-100},
      {k:"hue",      label:"Matiz",       v:0,  min:-100}
    ]
  },
  {
    id:"lsb", sec:"invisible", name:"Reescritura de bits bajos", on:true,
    note:"Sustituye los bits menos significativos de cada canal por valores aleatorios. Deja sin sentido cualquier marca o esteganografía guardada en el LSB, que es la más antigua y la más frágil. En una exportación JPEG se pierde de todas formas; importa si el resultado se guarda en PNG.",
    params:[
      {k:"amt",  label:"Proporción de píxeles", v:100},
      {k:"bits", label:"Bits reescritos", type:"choice", mode:"keep", v:"2",
       options:[{v:"1", label:"1 bit"}, {v:"2", label:"2 bits"}, {v:"3", label:"3 bits"}]}
    ]
  },
  {
    id:"spectral", sec:"invisible", name:"Limpieza espectral (picos periódicos)", on:false,
    cpu:true,
    note:"Analiza el espectro de Fourier por bloques solapados y atenúa cualquier pico que sobresalga muy por encima de lo que una foto produciría a esa frecuencia. Es el mismo limpiador que usa Realify; aquí sirve contra marcas incrustadas como patrones periódicos en el dominio de la frecuencia. Es CPU y no se ve en la vista previa.",
    params:[
      {k:"amt",    label:"Intensidad de atenuación",       v:40},
      {k:"thresh", label:"Sensibilidad (picos vs fondo)",  v:45, mode:"keep"},
      {k:"guard",  label:"Protección de baja frecuencia",  v:20, mode:"keep"}
    ]
  },
  {
    id:"regen", sec:"invisible", name:"Regeneración por difusión (servidor)", on:false,
    cpu:true,
    note:"La única defensa seria contra marcas que se incrustan durante la propia generación (SynthID, Tree-Ring): se vuelve a sintetizar la imagen a partir de la original con un modelo de difusión guiado por sus bordes, para que el contenido se conserve pero los píxeles sean otros. Es demasiado pesado para un navegador: se envía la imagen a TU servidor (configúralo abajo, en «Semilla y servidor»). Mientras no esté configurado, esta etapa no hace nada. La vista previa no la ejecuta sola: pulsa «Probar en el servidor».",
    params:[
      {k:"strength", label:"Fuerza de la regeneración", v:35},
      {k:"pipeline", label:"Modelo", type:"choice", mode:"keep", v:"auto",
       options:[
         {v:"auto",          label:"Automático"},
         {v:"qwen-zimage",   label:"Qwen-Image + Z-Image (caras)"},
         {v:"sdxl-zimage",   label:"SDXL + Z-Image"},
         {v:"chroma-zimage", label:"Chroma1 + Z-Image"},
         {v:"sdxl-img2img",  label:"SDXL img2img (sin el proyecto de referencia)"}
       ]},
      {k:"humanize", label:"Acabado natural (humanize)", type:"choice", mode:"keep", v:"1",
       options:[{v:"1", label:"Sí"}, {v:"0", label:"No"}]}
    ]
  },
  {
    id:"jpeg", sec:"invisible", name:"Recompresión JPEG", on:true,
    cpu:true,
    note:"Ida y vuelta real por el códec JPEG del navegador, varias generaciones, con la calidad sorteada dentro de un margen para que dos exportaciones no compartan la misma cuantización. Es la última etapa: todo lo anterior queda «fijado» por ella. No se ve en la vista previa.",
    params:[
      {k:"q",      label:"Calidad",              v:78, mode:"inv"},
      {k:"gens",   label:"Generaciones",         v:15},
      {k:"jitter", label:"Margen aleatorio de calidad", v:30, mode:"keep"}
    ]
  },

  /* ── procedencia ─────────────────────────────────────────── */
  {
    id:"policy", sec:"provenance", name:"Metadatos al exportar", on:true,
    cpu:true,
    note:"Exportar por el lienzo ya descarta todo lo que traía el archivo —C2PA, XMP, IPTC, comentarios—, porque se vuelve a codificar desde los píxeles. Lo único que puede volver a escribir metadatos es el panel EXIF de la app. «Sin metadatos» lo apaga; «EXIF de cámara» lo enciende para que el archivo salga con un cuerpo y objetivo coherentes en vez de vacío, que también llama la atención. «No tocar» respeta lo que tengas.",
    params:[
      {k:"mode", label:"Política", type:"choice", mode:"keep", v:"clean",
       options:[
         {v:"clean",  label:"Sin metadatos: ni EXIF, ni XMP, ni C2PA"},
         {v:"camera", label:"EXIF de cámara coherente (panel EXIF)"},
         {v:"keep",   label:"No tocar el panel EXIF"}
       ]}
    ]
  }
];

export const CHAIN_BY_ID = Object.fromEntries(CHAIN.map(s => [s.id, s]));
export const STAGES_OF = sec => CHAIN.filter(s => s.sec === sec);

/* Etapas que cambian píxeles dentro del worker, en su orden. */
export const WORKER_ORDER = ["geometry", "resample", "dwt", "dct", "blursharp", "noise", "tone", "lsb"];

export function defaultStages(){
  const o = {};
  for(const s of CHAIN){
    o[s.id] = { on: s.on, p: Object.fromEntries(s.params.map(x => [x.k, x.v])) };
  }
  return o;
}
