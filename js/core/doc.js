/* ═══════════════════════════════════════════════════════════════
   DOCUMENTO Y CAPAS
   Un documento es un tamaño y una pila de capas. Cada capa tiene su
   propio lienzo del tamaño del documento: gasta más memoria que
   recortar al contenido, pero hace que pintar, borrar y componer
   sean triviales, y en un editor de fotos las capas suelen ocupar
   el lienzo entero de todas formas.
   ═══════════════════════════════════════════════════════════════ */

import { remapHi, hiCoversCanvas } from "./hisrc.js";
import { emit } from "./bus.js";
import { drawWithBlend } from "../editor/blend.js";

let seq = 0;

export const doc = {
  open: false,
  w: 0, h: 0,
  /* Espacio de color de trabajo: "srgb" o "display-p3" si la foto tiene
     colores fuera de sRGB y el navegador sabe trabajar en P3 (ver
     core/colorspace.js). */
  colorSpace: "srgb",
  name: "Sin título",
  layers: [],        // de abajo (índice 0) a arriba
  activeId: null,
  /* Metadatos de origen: de dónde salió y a qué tamaño, para poder
     avisar cuando se exporta más grande que el original. */
  source: null,
  /* Campos de metadatos escritos a mano para la exportación (io/metaedit.js): título, descripción, autor, copyright, palabras clave, fecha, lat/lon. */
  metaEdit: null,
  /* Selección activa: null significa «todo el documento vale», el
     caso normal. Cuando hay una, es { mask, w, h }: una máscara de un
     byte por píxel a la resolución exacta del documento. Se limpia al
     cambiar de tamaño o recortar, porque sus coordenadas dejarían de
     tener sentido. */
  selection: null,
  /* Guías arrastradas desde las reglas: posiciones en coordenadas de
     documento, no de pantalla. */
  guides: { h: [], v: [] }
};

export function makeLayer(opts = {}){
  const c = opts.canvas || document.createElement("canvas");
  if(!opts.canvas){
    c.width  = opts.w || doc.w || 1;
    c.height = opts.h || doc.h || 1;
  }
  return {
    id: ++seq,
    name: opts.name || "Capa " + seq,
    canvas: c,
    ctx: c.getContext("2d", { willReadFrequently: true, colorSpace:"srgb" }),
    visible: true,
    opacity: 1,
    blend: "source-over",
    /* Fusionar si (ver editor/blendif.js): null cuando no tiene ningún
       efecto —el caso normal—, o { thisLayer, underlying } con el
       punto negro/blanco (y su posible partición Alt) de cada lado.
       Decide, píxel a píxel además de la opacidad y la máscara, si esta
       capa se ve ahí según su propio brillo o el de lo que tiene
       debajo. No aplica a un grupo ni a una capa de ajuste. */
    blendIf: null,
    locked: false,
    /* Filtros no destructivos aplicados a esta capa, en orden: cada
       entrada es { id, name, params, amount, enabled }. Se recalculan
       todos, en cadena, sobre lo que haya en la capa de debajo cada
       vez que cualquiera de ellos cambia — ver editor/filterchain.js.
       Apagar uno (enabled:false) lo salta sin borrarlo, para poder
       comparar con y sin él sin perder sus parámetros. */
    filters: [],
    /* Máscara de capa: null si no tiene. Cuando existe es un lienzo
       aparte del tamaño de la capa cuyo canal alfa es la cantidad que
       se deja ver —opaco del todo por defecto, para no ocultar nada
       al añadirla—. Ver editor/masks.js para cómo se pinta y compone.
       Si maskRef apunta a otra capa (vinculada), esta capa usa la máscara
       de esa otra; cambios en una afectan a ambas. */
    mask: null,
    maskRef: null,     // ID de la capa cuya máscara se comparte (o null)
    maskEnabled: true,
    /* «raster» es una capa de píxeles normales; «text» ya existe en
       el resto del código; «adjust» es una capa de ajuste no
       destructivo (ver editor/adjustlayers.js): no tiene contenido
       propio, cambia lo que hay debajo; «group» es un grupo de capas
       (ver editor/layertree.js y editor/groups.js): tampoco pinta
       nada por sí mismo, compone lo que tenga dentro en un lienzo
       aparte y ese resultado es lo que se trata como su contenido;
       «fill» y «shape» (ver editor/layercontent.js) SÍ tienen lienzo
       propio como una capa raster normal —el compositor no las
       distingue de una en absoluto—, sólo que ese lienzo se vuelve a
       generar entero desde `fill`/`shape` cada vez que cambian sus
       parámetros, nunca se pinta a mano encima. */
    type: opts.type || "raster",
    /* Sólo para type:"fill": { kind:"color"|"gradient"|"pattern", ... }.
       Ver editor/layercontent.js para la forma exacta de cada kind y
       renderFillLayer(), que es quien la convierte en los píxeles de
       `canvas`. */
    fill: null,
    /* Sólo para type:"shape": { kind:"rect"|"ellipse", x,y,w,h, radius,
       fill:{on,color}, stroke:{on,color,width} }, todo en coordenadas
       de documento. Ver editor/layercontent.js#renderShapeLayer. */
    shape: null,
    /* Grupo al que pertenece esta capa (su id), o null en el nivel
       superior. Un grupo puede a su vez tener groupId si está
       anidado dentro de otro. */
    groupId: opts.groupId ?? null,
    /* Sólo para type:"group" — plegado en el panel de capas. */
    collapsed: false,
    /* «Recortar a la capa de abajo»: esta capa sólo se ve donde la
       capa (o grupo) no recortada más próxima por debajo, en su mismo
       nivel, tiene algo de alfa. Ver editor/layertree.js. */
    clipped: false,
    /* Sombra paralela, resplandor exterior, trazo y superposición de
       degradado — null cuando ninguno está activo. Ver
       editor/layerstyles.js. */
    styles: null,
    /* Marca una capa como la gris 50% de un Dodge & Burn no
       destructivo (ver editor/tools.js#ensureDodgeBurnLayer): sólo
       decide sobre qué capa sigue pintando esa herramienta al
       reactivarse, no cambia nada de cómo se compone. */
    dodgeBurn: false,
    /* Objeto inteligente: `smart` lo activa desde «Convertir en objeto
       inteligente» (editor/transformtool.js). `smartSource` es el
       lienzo original íntegro, a la resolución que tenía al
       convertirse, que ninguna transformación posterior vuelve a
       tocar; `smartTransform` son los parámetros acumulados (mismo
       modelo que la Transformación libre) que se le aplican para
       obtener `canvas`; `smartBox` es el rectángulo de referencia
       sobre el que esos parámetros se miden, fijo mientras la capa
       sea inteligente. Reescalar o rotar una y otra vez siempre
       remuestrea desde `smartSource`, nunca desde el resultado ya
       reescalado de la vez anterior — es la diferencia entre perder
       nitidez en cada ajuste o no perderla nunca. */
    smart: false,
    smartSource: null,
    smartTransform: null,
    smartBox: null,
    /* SVG importado: se conserva el XML original además de la vista
       rasterizada para que siga siendo una capa vectorial recuperable. */
    svgSource: opts.svgSource || null,
    thumbDirty: true,
    thumb: ""
  };
}

export function newDoc(w, h, opts = {}){
  // Antes de crear ninguna capa: sus lienzos nacen en este espacio
  doc.colorSpace = opts.colorSpace === "display-p3" ? "display-p3" : "srgb";
  doc.w = Math.max(1, Math.round(w));
  doc.h = Math.max(1, Math.round(h));
  doc.name = opts.name || "Sin título";
  doc.source = opts.source || null;
  doc.metaEdit = null;
  doc.layers = [];
  doc.activeId = null;
  doc.open = true;
  doc.selection = null;
  doc.guides = { h: [], v: [] };

  /* Un RAW revelado ya llega como un canvas completo. Adoptarlo evita
     duplicar temporalmente 100–200 MB al crear el documento móvil
     (canvas del revelador + copia de la capa + compositor). */
  const adoptedImage = opts.adoptImage && opts.image instanceof HTMLCanvasElement ? opts.image : null;
  const base = makeLayer({ name: opts.layerName || "Fondo", canvas: adoptedImage });
  if(opts.fill){
    base.ctx.fillStyle = opts.fill;
    base.ctx.fillRect(0, 0, doc.w, doc.h);
  }
  if(opts.image && !adoptedImage){
    base.ctx.drawImage(opts.image, 0, 0, doc.w, doc.h);
  }
  doc.layers.push(base);
  doc.activeId = base.id;

  emit("doc:new");
  emit("doc:structure");
  emit("doc:change");
  return base;
}

export function closeDoc(){
  doc.open = false;
  doc.layers = [];
  doc.activeId = null;
  doc.w = doc.h = 0;
  doc.source = null;
  doc.selection = null;
  doc.guides = { h: [], v: [] };
  emit("doc:structure");
  emit("doc:change");
}

export const activeLayer = () => doc.layers.find(l => l.id === doc.activeId) || null;
export const layerIndex  = id => doc.layers.findIndex(l => l.id === id);

export function setActive(id){
  if(doc.activeId === id) return;
  doc.activeId = id;
  emit("doc:active");
}

export function addLayer(opts = {}){
  const l = makeLayer(opts);
  const at = opts.above === undefined ? layerIndex(doc.activeId) + 1 : opts.above;
  doc.layers.splice(Math.max(0, at), 0, l);
  doc.activeId = l.id;
  emit("doc:structure");
  emit("doc:change");
  return l;
}

export function duplicateLayer(id = doc.activeId){
  const src = doc.layers.find(l => l.id === id);
  if(!src) return null;
  const l = makeLayer({ name: src.name + " copia", type: src.type });
  l.ctx.drawImage(src.canvas, 0, 0);
  l.opacity = src.opacity;
  l.blend = src.blend;
  l.blendIf = src.blendIf ? JSON.parse(JSON.stringify(src.blendIf)) : null;
  l.groupId = src.groupId;
  l.clipped = src.clipped;
  l.styles = src.styles ? JSON.parse(JSON.stringify(src.styles)) : null;
  l.filters = src.filters.map(f => ({ ...f, params: { ...f.params } }));
  l.smart = src.smart;
  l.dodgeBurn = src.dodgeBurn;
  // Los 16 bits (core/hisrc.js): el lienzo copiado es idéntico, así que el origen sigue valiendo. Los datos no se
  // modifican nunca en su sitio (cada operación crea los suyos), por eso se comparten.
  if(src.hiSrc) l.hiSrc = { ...src.hiSrc };
  // El patrón de una capa de relleno guarda un <canvas> aparte (la
  // imagen cargada) que JSON.parse/stringify no puede clonar: se copia
  // a mano, igual que smartSource más abajo. Color y degradado son
  // datos sueltos y clonan bien con el resto de `fill`.
  if(src.fill){
    l.fill = JSON.parse(JSON.stringify(src.fill, (k, v) => k === "patternImg" ? undefined : v));
    if(src.fill.patternImg){
      const c = document.createElement("canvas");
      c.width = src.fill.patternImg.width; c.height = src.fill.patternImg.height;
      c.getContext("2d").drawImage(src.fill.patternImg, 0, 0);
      l.fill.patternImg = c;
    }
  }
  l.shape = src.shape ? JSON.parse(JSON.stringify(src.shape)) : null;
  l.svgSource = src.svgSource || null;
  l.smartTransform = src.smartTransform ? JSON.parse(JSON.stringify(src.smartTransform)) : null;
  l.smartBox = src.smartBox ? { ...src.smartBox } : null;
  if(src.smart && src.smartSource){
    const c = document.createElement("canvas");
    c.width = src.smartSource.width; c.height = src.smartSource.height;
    c.getContext("2d").drawImage(src.smartSource, 0, 0);
    l.smartSource = c;
  }
  doc.layers.splice(layerIndex(id) + 1, 0, l);
  doc.activeId = l.id;
  emit("doc:structure");
  emit("doc:change");
  return l;
}

export function removeLayer(id = doc.activeId){
  if(doc.layers.length <= 1) return false;   // siempre queda una
  const i = layerIndex(id);
  if(i < 0) return false;
  doc.layers.splice(i, 1);
  // Si lo que se ha borrado era un grupo por una vía genérica (no la
  // de editor/groups.js, que ya se ocupa de sus miembros), que éstos
  // no se queden huérfanos apuntando a un id que ya no existe: sin
  // esto desaparecerían de la composición sin ningún aviso, porque
  // dejarían de ser de nivel superior sin llegar a colgar de nada.
  for(const l of doc.layers) if(l.groupId === id) l.groupId = null;
  doc.activeId = (doc.layers[i] || doc.layers[i - 1]).id;
  emit("doc:structure");
  emit("doc:change");
  return true;
}

export function moveLayer(id, delta){
  const i = layerIndex(id);
  const j = i + delta;
  if(i < 0 || j < 0 || j >= doc.layers.length) return false;
  const [l] = doc.layers.splice(i, 1);
  doc.layers.splice(j, 0, l);
  emit("doc:structure");
  emit("doc:change");
  return true;
}

export function mergeDown(id = doc.activeId){
  const i = layerIndex(id);
  if(i <= 0) return false;
  const top = doc.layers[i], bottom = doc.layers[i - 1];
  // Un grupo y una capa de ajuste no contienen píxeles propios. Pintar
  // su lienzo vacío sobre la de abajo los borraba y daba un falso éxito.
  if(!top || !bottom || top.type === "group" || top.type === "adjust" || bottom.type === "group" || bottom.type === "adjust") return false;
  // La máscara forma parte de lo que se ve, no del lienzo base. Al
  // combinarla hay que aplicarla antes de retirar la capa superior;
  // `maskRef` permite que la máscara esté compartida desde otra capa.
  let source = top.canvas;
  const mask = top.maskRef ? doc.layers.find(l => l.id === top.maskRef)?.mask : top.mask;
  if(mask && top.maskEnabled){
    source = document.createElement("canvas");
    source.width = top.canvas.width; source.height = top.canvas.height;
    const x = source.getContext("2d", { colorSpace:"srgb" });
    x.drawImage(top.canvas, 0, 0);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(mask.canvas, 0, 0, source.width, source.height);
    x.globalCompositeOperation = "source-over";
  }
  // `drawWithBlend` (no `ctx.globalCompositeOperation` directo) porque
  // no todos los modos de fusión de esta app son nativos del lienzo
  // —«luz lineal» no lo es—, y ese caso el navegador lo ignora en
  // silencio en vez de avisar.
  if(top.visible && top.opacity > 0) drawWithBlend(bottom.ctx, source, top.blend, top.opacity, bottom.canvas.width, bottom.canvas.height);
  bottom.thumbDirty = true;
  /* La de abajo recibe píxeles nuevos: si era el resultado de un filtro, su anotación ya no describe lo que contiene (un recálculo lo borraría). */
  if(bottom.filters?.length){ bottom.filters = []; bottom._fxFull = null; }
  doc.layers.splice(i, 1);
  doc.activeId = bottom.id;
  emit("doc:structure");
  emit("doc:change");
  return true;
}

/* Redimensiona el documento entero, capa por capa. */
export function resizeDoc(w, h, smooth = true){
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if(w === doc.w && h === doc.h) return;
  const kx = w / doc.w, ky = h / doc.h;
  for(const l of doc.layers){
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    // Mismas opciones que en makeLayer desde el PRIMER getContext: las
    // de una llamada posterior se ignoran, y la capa se quedaba sin
    // willReadFrequently para el resto de la sesión.
    const t = tmp.getContext("2d", { willReadFrequently: true, colorSpace:"srgb" });
    t.imageSmoothingEnabled = smooth;
    t.imageSmoothingQuality = "high";
    t.drawImage(l.canvas, 0, 0, w, h);
    l.canvas = tmp;
    l.ctx = tmp.getContext("2d", { willReadFrequently: true, colorSpace:"srgb" });
    l.thumbDirty = true;
    // Un objeto inteligente guarda su original a la resolución que
    // tenía al convertirse: si el documento entero cambia de tamaño,
    // ese original —y la caja y la traslación con las que se mide su
    // transformación, ambas en píxeles— tienen que escalar en la
    // misma proporción, o dejarían de corresponderse con el lienzo
    // nuevo la próxima vez que se abra Transformación libre.
    if(l.smart && l.smartSource){
      const src = document.createElement("canvas");
      src.width = Math.max(1, Math.round(l.smartSource.width * kx));
      src.height = Math.max(1, Math.round(l.smartSource.height * ky));
      const sx2 = src.getContext("2d", { colorSpace:"srgb" });
      sx2.imageSmoothingEnabled = smooth;
      sx2.imageSmoothingQuality = "high";
      sx2.drawImage(l.smartSource, 0, 0, src.width, src.height);
      l.smartSource = src;
      if(l.smartBox){
        l.smartBox = { x: l.smartBox.x * kx, y: l.smartBox.y * ky,
                        w: l.smartBox.w * kx, h: l.smartBox.h * ky };
      }
      if(l.smartTransform){
        l.smartTransform = { ...l.smartTransform,
          tx: l.smartTransform.tx * kx, ty: l.smartTransform.ty * ky };
      }
    }
    // Una capa de forma (editor/layercontent.js) guarda su rectángulo
    // en coordenadas de documento: si no se escalara igual que el
    // lienzo, la próxima vez que se tocara un mando en el panel de
    // Propiedades se volvería a dibujar en el tamaño y sitio VIEJOS
    // sobre el lienzo nuevo, deshaciendo el redimensionado de un
    // plumazo. El píxel ya remuestreado de arriba es, mientras tanto,
    // la misma aproximación que ya acepta un objeto inteligente entre
    // un ajuste y el siguiente.
    if(l.type === "shape" && l.shape){
      l.shape = { ...l.shape,
        x: l.shape.x * kx, y: l.shape.y * ky,
        w: l.shape.w * kx, h: l.shape.h * ky,
        radius: (l.shape.radius || 0) * (kx + ky) / 2 };
    }
  }
  doc.w = w; doc.h = h;
  doc.selection = null;   // sus coordenadas ya no encajarían
  emit("doc:resize");
  emit("doc:change");
}

/* Recorta el documento a un rectángulo dado en coordenadas de imagen. */
export function cropDoc(rect){
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const w = Math.min(doc.w - x, Math.round(rect.w));
  const h = Math.min(doc.h - y, Math.round(rect.h));
  if(w < 1 || h < 1) return;
  const oldW = doc.w, oldH = doc.h;
  for(const l of doc.layers){
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const old = l.canvas, hiCovers = l.hiSrc && hiCoversCanvas(l);
    tmp.getContext("2d", { willReadFrequently: true, colorSpace:"srgb" }).drawImage(l.canvas, x, y, w, h, 0, 0, w, h);
    l.canvas = tmp;
    l.ctx = tmp.getContext("2d", { willReadFrequently: true, colorSpace:"srgb" });
    l.thumbDirty = true;
    // Los 16 bits (core/hisrc.js) se recortan con el lienzo; el historial del recorte (tools.js) guarda el origen entero
    if(l.hiSrc){
      const moved = hiCovers ? remapHi(l, old.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, oldW, oldH).data, oldW, oldH, (nx, ny) => (ny + y) * oldW + nx + x) : null;
      if(moved) l.hiSrc = moved; else delete l.hiSrc;
    }
    // La máscara de capa es un lienzo aparte del tamaño de la capa (ver
    // editor/masks.js): se recorta con el mismo rectángulo, o quedaría
    // con las medidas viejas tapando lo que no le toca.
    if(l.mask){
      const m = document.createElement("canvas");
      m.width = w; m.height = h;
      const mx = m.getContext("2d", { willReadFrequently: true });
      mx.drawImage(l.mask.canvas, x, y, w, h, 0, 0, w, h);
      l.mask = { canvas: m, ctx: mx };
    }
    // El origen se desplaza (x, y): la caja y la traslación de un
    // objeto inteligente, medidas en las mismas coordenadas que el
    // lienzo, tienen que desplazarse igual para seguir señalando al
    // mismo sitio de verdad. El original en sí no cambia de tamaño
    // —recortar no lo reescala, sólo mueve dónde cae—.
    if(l.smart){
      if(l.smartBox) l.smartBox = { ...l.smartBox, x: l.smartBox.x - x, y: l.smartBox.y - y };
      if(l.smartTransform){
        l.smartTransform = { ...l.smartTransform, tx: l.smartTransform.tx - x, ty: l.smartTransform.ty - y };
      }
    }
    // Mismo motivo que en resizeDoc(): el origen se mueve, así que el
    // rectángulo de una capa de forma tiene que moverse con él.
    if(l.type === "shape" && l.shape){
      l.shape = { ...l.shape, x: l.shape.x - x, y: l.shape.y - y };
    }
  }
  doc.w = w; doc.h = h;
  doc.selection = null;
  emit("doc:resize");
  emit("doc:change");
}

/* Miniatura para el panel de capas. Se recalcula sólo cuando la capa
   se marcó como sucia: generarla es un drawImage y un toDataURL, y
   hacerlo en cada pincelada se nota. */
const THUMB = 48;
export function layerThumb(l){
  if(!l.thumbDirty && l.thumb) return l.thumb;
  const s = Math.min(THUMB / l.canvas.width, THUMB / l.canvas.height, 1);
  const c = document.createElement("canvas");
  c.width  = Math.max(1, Math.round(l.canvas.width  * s));
  c.height = Math.max(1, Math.round(l.canvas.height * s));
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "medium";
  x.drawImage(l.canvas, 0, 0, c.width, c.height);
  l.thumb = c.toDataURL();
  l.thumbDirty = false;
  return l.thumb;
}
