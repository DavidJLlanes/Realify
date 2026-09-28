/* ═══════════════════════════════════════════════════════════════
   CAJÓN DE HERRAMIENTAS (sólo móvil)
   Sustituye a la fila de iconos que había encima de la barra
   inferior. Una fila deslizante de 27 iconos sin nombre obligaba a
   reconocer cada herramienta por su dibujo, y los ajustes y filtros
   —el grueso de la app— ni siquiera estaban en ella: vivían enterrados
   en el menú de texto. Aquí todo está junto, con icono y nombre, y
   ordenado por lo que se quiere conseguir (mejorar, corregir, dar
   estilo…) en vez de por cómo está hecho por dentro, que es el modelo
   de Snapseed.

   No cambia NADA de cómo se comporta cada herramienta: cada entrada
   ejecuta el mismo comando del menú (`run`) o activa la misma
   herramienta (`setTool`) que ya existían. Sólo cambia el camino.
   ═══════════════════════════════════════════════════════════════ */

import { run, enabled } from "./commands.js";
import { on } from "../core/bus.js";
import { doc } from "../core/doc.js";
import { TOOLS, current, setTool } from "../editor/tools.js";
import { haptic } from "../core/device.js";
import { MENUS } from "./menu.js";
import { ICONS } from "./tooldrawer-icons.js";
import { matchScore, searchable } from "../core/search.js";

const CATS = [
  ["basicos",   "Básicos"],
  ["todos",     "Todos"],
  ["mejorar",   "Mejorar"],
  ["corregir",  "Corregir"],
  ["color",     "Color"],
  ["estilo",    "Estilo"],
  ["efectos",   "Efectos"],
  ["retoque",   "Retoque"],
  ["ia",        "IA"],
  ["seleccion", "Selección"],
  ["pintar",    "Pintar"],
  ["analizar",  "Analizar"]
];

/* «Básicos»: lo que más usa la gente al editar una foto, en el orden en
   que suele hacerse (encuadrar, luz, color, detalle, estilo, retoque y
   extras). Es la pestaña con la que se abre el cajón la primera vez,
   para que la app no parezca abrumadora; el resto sigue en «Todos» y en
   las demás pestañas. Cada clave es el `cmd` o el `tool` de su entrada
   de ITEMS («auto» para Automático). */
const BASICS = [
  "auto",
  "crop", "image.rotR",
  "adj.brightness", "adj.exposure", "adj.shadowsHighlights",
  "adj.whiteBalance", "adj.vibrance", "adj.hsl",
  "filter.sharpen",
  "filter.looks", "filter.vintage", "adj.grayscale", "filter.vignette",
  "heal", "image.removeBackground",
  "text", "layer.stickers", "layer.meme", "file.socialPost"
];

/* Cada entrada: `cmd` (comando registrado) o `tool` (herramienta de
   TOOLS), `label` corto —cabe en dos líneas de una cuarta parte del
   ancho sin partir palabras—, `ic` (icono Lucide de
   tooldrawer-icons.js; si falta, se usa el de la herramienta o el del
   menú) y `cat` (una o varias pestañas, separadas por espacios). */
const ITEMS = [
  { auto:true, label:"Automático", ic:"wand-sparkles", cat:"mejorar" },

  /* ── Ajustes ── */
  { cmd:"adj.brightness",        label:"Brillo y contraste",   ic:"sun-medium",            cat:"mejorar" },
  { cmd:"adj.exposure",          label:"Exposición",           ic:"aperture",              cat:"mejorar" },
  { cmd:"adj.levels",            label:"Niveles",              ic:"chart-no-axes-column",  cat:"mejorar" },
  { cmd:"adj.curves",            label:"Curvas",               ic:"spline",                cat:"mejorar color" },
  { cmd:"adj.toneBand",          label:"Tonos del histograma", ic:"chart-area",            cat:"mejorar" },
  { cmd:"adj.shadowsHighlights", label:"Sombras y luces",      ic:"sun-moon",              cat:"mejorar" },
  { cmd:"adj.whiteBalance",      label:"Balance de blancos",   ic:"thermometer",           cat:"mejorar color corregir" },
  { cmd:"adj.tone",              label:"Tonos",                ic:"sliders-horizontal",    cat:"mejorar" },
  { cmd:"adj.hsl",               label:"Tono y saturación",    ic:"droplets",              cat:"mejorar color" },
  { cmd:"adj.vibrance",          label:"Intensidad",           ic:"rainbow",               cat:"mejorar color" },
  { cmd:"adj.dehaze",            label:"Quitar neblina",       ic:"cloud-fog",             cat:"mejorar corregir" },
  { cmd:"adj.hdrTone",           label:"Tono HDR",             ic:"mountain-snow",         cat:"mejorar estilo" },
  { cmd:"adj.tonalContrast",     label:"Contraste tonal",      ic:"circle-gauge",          cat:"mejorar" },
  { cmd:"adj.graduatedFilter",   label:"Graduado y radial",    ic:"sunset",                cat:"mejorar" },
  { cmd:"adj.autoToneColor",     label:"Tono y color auto.",   ic:"wand",                  cat:"mejorar color" },
  { cmd:"adj.auto",              label:"Contraste auto.",      ic:"contrast",              cat:"mejorar" },
  { cmd:"adj.autoLevels",        label:"Niveles auto.",        ic:"chart-column",          cat:"mejorar" },
  { cmd:"adj.colorGrading",      label:"Gradación de color",   ic:"palette",               cat:"color estilo" },
  { cmd:"adj.splitToning",       label:"Virado dividido",      ic:"blend",                 cat:"color estilo" },
  { cmd:"adj.photoFilter",       label:"Filtro fotográfico",   ic:"funnel",                cat:"color estilo" },
  { cmd:"adj.rangeHsl",          label:"Color por rangos",     ic:"swatch-book",           cat:"color" },
  { cmd:"adj.replaceColor",      label:"Reemplazar color",     ic:"replace-all",           cat:"color" },
  { cmd:"adj.matchColor",        label:"Igualar color",        ic:"git-compare",           cat:"color" },
  { cmd:"adj.labCurves",         label:"Curvas Lab",           ic:"chart-spline",          cat:"color" },
  { cmd:"adj.colorBands",        label:"Color por canales",    ic:"layers-2",              cat:"color" },
  { cmd:"adj.colorBalance",      label:"Equilibrio de color",  ic:"scale",                 cat:"color corregir" },
  { cmd:"adj.selectiveColor",    label:"Corrección selectiva", ic:"pipette",               cat:"color" },
  { cmd:"adj.channelMixer",      label:"Mezclador de canales", ic:"sliders-vertical",      cat:"color" },
  { cmd:"adj.gradientMap",       label:"Mapa de degradado",    ic:"paint-roller",          cat:"color estilo" },
  { cmd:"adj.threshold",         label:"Umbral",               ic:"binary",                cat:"color estilo" },
  { cmd:"adj.posterize",         label:"Posterizar",           ic:"layers",                cat:"color estilo" },
  { cmd:"adj.equalize",          label:"Ecualizar",            ic:"chart-area",            cat:"color mejorar" },
  { cmd:"adj.desaturate",        label:"Desaturar",            ic:"droplet-off",           cat:"color" },
  { cmd:"adj.grayscale",         label:"Blanco y negro",       ic:"eclipse",               cat:"color estilo" },
  { cmd:"adj.invert",            label:"Invertir",             ic:"circle-slash-2",        cat:"color" },

  /* ── Filtro: especiales ── */
  { cmd:"filter.camera",    label:"Realify",          cat:"estilo ia" },
  { cmd:"filter.photoDevelop", label:"Revelado fotográfico", ic:"sliders-horizontal", cat:"mejorar color" },
  { cmd:"filter.vintage",   label:"Filtro Vintage",   ic:"camera",             cat:"estilo efectos" },
  { cmd:"filter.purepixel", label:"PurePixel",        cat:"ia" },
  { cmd:"filter.unmark",    label:"Unmark",           cat:"ia corregir" },
  { cmd:"filter.looks",     label:"Estilos",          cat:"estilo" },
  { cmd:"filter.lens",      label:"Photo Lens",       cat:"ia mejorar" },
  { cmd:"filter.lut",       label:"Tabla de color",   ic:"clapperboard",       cat:"estilo color" },

  /* ── Filtro: desenfoques ── */
  { cmd:"filter.blur",        label:"Desenfoque",          ic:"droplet",             cat:"efectos" },
  { cmd:"filter.blurGallery", label:"Galería de desenfoque", ic:"circle-dashed",     cat:"efectos" },
  { cmd:"filter.utilityBlur", label:"Otros desenfoques",   ic:"square-dashed-bottom", cat:"efectos" },
  { cmd:"filter.motionBlur",  label:"Movimiento",          ic:"wind",                cat:"efectos" },
  { cmd:"filter.lensBlur",    label:"Desenfoque de lente", ic:"circle-dot",          cat:"efectos" },
  { cmd:"filter.radialBlur",  label:"Radial y zoom",       ic:"orbit",               cat:"efectos" },
  { cmd:"filter.surfaceBlur", label:"Superficie",          ic:"waves-horizontal",    cat:"efectos retoque" },

  /* ── Filtro: enfoque y restauración ── */
  { cmd:"filter.sharpen",          label:"Enfocar",           ic:"focus",        cat:"mejorar" },
  { cmd:"filter.advancedSharpen",  label:"Máscara de enfoque", ic:"scan",        cat:"mejorar" },
  { cmd:"filter.selectiveSharpen", label:"Enfoque selectivo", ic:"scan-eye",     cat:"mejorar" },
  { cmd:"filter.smartSharpen",     label:"Nitidez inteligente", ic:"crosshair",  cat:"mejorar" },
  { cmd:"filter.highPass",         label:"Paso alto",         ic:"activity",     cat:"mejorar efectos" },
  { cmd:"filter.restoration",      label:"Restauración",      ic:"broom-sparkles", cat:"corregir retoque" },

  /* ── Filtro: fotografía, detalle y ruido ── */
  { cmd:"filter.lensCorrection", label:"Corregir lente",   ic:"glasses",        cat:"corregir" },
  { cmd:"filter.portrait",       label:"Retrato",          ic:"scan-face",      cat:"retoque" },
  { cmd:"filter.freqsep",        label:"Separar frecuencias", ic:"split",       cat:"retoque" },
  { cmd:"dodgeburn.start",       label:"Dodge & Burn",     tool:"dodgeburn",    cat:"retoque" },
  { cmd:"dodgeburn.viewGray",    label:"D&B: ver gris",    ic:"eclipse",        cat:"retoque" },
  { cmd:"filter.clarity",        label:"Detalle",          ic:"gem",            cat:"mejorar" },
  { cmd:"filter.vignette",       label:"Viñeteado",        ic:"circle-dot-dashed", cat:"estilo" },
  { cmd:"filter.denoise",        label:"Reducir ruido",    ic:"audio-waveform", cat:"corregir mejorar" },
  { cmd:"filter.aiDejpeg",       label:"Quitar JPEG con IA", ic:"file-image",   cat:"corregir ia" },
  { cmd:"filter.channelDenoise", label:"Ruido por canal",  ic:"signal",         cat:"corregir" },
  { cmd:"filter.noise",          label:"Añadir ruido",     ic:"grip",           cat:"estilo efectos" },

  /* ── Filtro: estilo y textura ── */
  { cmd:"filter.pixelate",         label:"Pixelizar",        ic:"grid-2x2",     cat:"efectos" },
  { cmd:"filter.stylize",          label:"Relieve y bordes", ic:"shapes",       cat:"efectos" },
  { cmd:"filter.stylizeEffects",   label:"Estilizar",        ic:"flame",        cat:"efectos estilo" },
  { cmd:"filter.artisticGallery",  label:"Artísticos",       ic:"brush",        cat:"estilo efectos" },
  { cmd:"filter.renderEffects",    label:"Nubes y luces",    ic:"lightbulb",    cat:"efectos" },
  { cmd:"filter.textureEffects",   label:"Texturas",         ic:"brick-wall",   cat:"estilo efectos" },
  { cmd:"filter.offsetMorphology", label:"Desplazar y mín./máx.", ic:"move-3d", cat:"efectos" },
  { cmd:"filter.customConvolution", label:"Convolución",     ic:"grid-3x3",     cat:"efectos" },

  /* ── Filtro: distorsión y geometría ── */
  { cmd:"filter.distort",           label:"Esferizar",        ic:"globe",        cat:"efectos" },
  { cmd:"filter.classicDistort",    label:"Distorsionar",     ic:"tornado",      cat:"efectos" },
  { cmd:"filter.adaptiveWideAngle", label:"Gran angular",     ic:"expand",       cat:"corregir" },
  { cmd:"filter.puppetWarp",        label:"Deformación libre", ic:"map-pin",     cat:"efectos retoque" },
  { cmd:"filter.perspective",       label:"Corregir perspectiva", ic:"frame",    cat:"corregir" },
  { cmd:"filter.liquify",           label:"Licuar",           tool:"liquify",    cat:"retoque efectos" },
  { cmd:"filter.spot",              label:"Pincel corrector", ic:"bandage",      cat:"retoque corregir" },
  { cmd:"filter.patch",             label:"Parche",           ic:"stamp",        cat:"retoque" },

  /* ── Imagen ── */
  { cmd:"image.rotL",   label:"Girar a la izquierda", ic:"rotate-ccw-square", cat:"corregir" },
  { cmd:"image.rotR",   label:"Girar a la derecha",   ic:"rotate-cw-square",  cat:"corregir" },
  { cmd:"image.flipH",  label:"Voltear horizontal",   ic:"move-horizontal",   cat:"corregir" },
  { cmd:"image.flipV",  label:"Voltear vertical",     ic:"move-vertical",     cat:"corregir" },
  { cmd:"image.resize", label:"Tamaño de imagen",     ic:"scaling",           cat:"corregir" },
  { cmd:"image.canvasSize", label:"Tamaño de lienzo", ic:"maximize-2",        cat:"corregir" },
  { cmd:"image.contentAwareScale", label:"Escala por contenido", ic:"shrink",  cat:"corregir" },
  { cmd:"image.hdr",       label:"Fusión HDR",          ic:"hdr",               cat:"mejorar estilo" },
  { cmd:"image.merge",     label:"Unir imágenes",       ic:"merge-images",      cat:"corregir estilo" },
  { cmd:"image.slice",     label:"Cortar en partes",    ic:"layout-grid",       cat:"corregir estilo" },
  { cmd:"image.shapeCrop", label:"Recortar en forma",   ic:"shapes",            cat:"corregir estilo" },
  { cmd:"image.removeBackground", label:"Eliminar fondo", ic:"image-minus",   cat:"ia retoque" },
  { cmd:"sky.replace",  label:"Reemplazar cielo",     ic:"cloud-sun",         cat:"ia estilo" },

  /* ── Herramientas de la antigua fila ── */
  { tool:"crop",        label:"Recortar",      cat:"corregir" },
  { tool:"transform",   label:"Transformar",   cat:"corregir" },
  { tool:"perspective", label:"Perspectiva",   cat:"corregir" },
  { tool:"heal",        label:"Quitamanchas",  cat:"retoque" },
  { tool:"clone",       label:"Clonar",        cat:"retoque" },
  { tool:"camove",      label:"Mover por contenido", cat:"retoque" },
  { tool:"expose",      label:"Exponer",       cat:"retoque" },
  { tool:"smudge",      label:"Emborronar",    cat:"retoque pintar" },
  { cmd:"sel.fillContent", label:"Rellenar por contenido", ic:"sparkles", cat:"retoque" },

  { tool:"move",           label:"Mover",       cat:"seleccion" },
  { tool:"select-rect",    label:"Rectángulo",  cat:"seleccion" },
  { tool:"select-ellipse", label:"Elipse",      cat:"seleccion" },
  { tool:"select-lasso",   label:"Lazo",        cat:"seleccion" },
  { tool:"select-wand",    label:"Varita mágica", cat:"seleccion" },
  { tool:"pen",            label:"Pluma",       cat:"seleccion" },
  { cmd:"sel.subject",   label:"Seleccionar sujeto", ic:"user-round",        cat:"seleccion ia" },
  { cmd:"sel.sky",       label:"Seleccionar cielo",  ic:"cloud",             cat:"seleccion ia" },
  { cmd:"sel.all",       label:"Seleccionar todo",   ic:"square-dashed",     cat:"seleccion" },
  { cmd:"sel.invert",    label:"Invertir selección", ic:"refresh-ccw-dot",   cat:"seleccion" },
  { cmd:"sel.none",      label:"Deseleccionar",      ic:"square-dashed-x",   cat:"seleccion" },
  { cmd:"sel.feather",   label:"Difuminar",          ic:"feather",           cat:"seleccion" },
  { cmd:"sel.refineEdge", label:"Refinar borde",     ic:"scissors",          cat:"seleccion" },
  { cmd:"sel.rangeMask", label:"Máscaras de luz",    ic:"sun-snow",          cat:"seleccion" },

  { tool:"brush",        label:"Pincel",       cat:"pintar" },
  { cmd:"brush.symmetric", label:"Pincel simétrico",   ic:"flip-horizontal-2", cat:"pintar" },
  { cmd:"brush.textured",  label:"Pincel con textura", ic:"spray-can",         cat:"pintar" },
  { cmd:"brush.gradient",  label:"Pincel degradado",   ic:"rainbow",           cat:"pintar" },
  { tool:"eraser",       label:"Borrador",     cat:"pintar" },
  { tool:"fill",         label:"Bote de pintura", cat:"pintar" },
  { tool:"gradient",     label:"Degradado",    cat:"pintar" },
  { tool:"shape",        label:"Formas",       cat:"pintar" },
  { tool:"text",         label:"Texto",        cat:"pintar" },
  { tool:"historyBrush", label:"Pincel de historial", cat:"pintar retoque" },
  { tool:"picker",       label:"Cuentagotas",  cat:"pintar" },
  { cmd:"layer.meme",      label:"Crear meme",     ic:"sticker",   cat:"pintar estilo" },
  { cmd:"file.socialPost", label:"Collage / Post", ic:"layout-dashboard", cat:"pintar estilo" },
  { cmd:"image.beforeAfter", label:"Antes y después", ic:"before-after", cat:"estilo analizar" },
  { cmd:"file.contactSheet", label:"Hoja de contactos", ic:"layout-grid", cat:"estilo" },
  { cmd:"file.exportGif",   label:"GIF animado",      ic:"film",        cat:"estilo efectos" },
  { cmd:"layer.stickers",  label:"Stickers",       ic:"sparkles",  cat:"pintar estilo" },
  { cmd:"layer.watermark", label:"Marca de agua",  ic:"copyright", cat:"pintar" },
  { cmd:"layer.styles",    label:"Estilos de capa", ic:"layers-plus", cat:"pintar estilo" },

  { tool:"compare",      label:"Comparar",     cat:"analizar" },
  { tool:"zoom",         label:"Zoom",         cat:"analizar" },
  { tool:"pan",          label:"Mano",         cat:"analizar" },
  { cmd:"an.metrics",    label:"Plausibilidad",    ic:"gauge",        cat:"analizar" },
  { cmd:"an.forensics",  label:"Segunda opinión",  ic:"microscope",   cat:"analizar" },
  { cmd:"an.spectrum",   label:"Espectro",         ic:"radar",        cat:"analizar" },
  { cmd:"view.histogram", label:"Histograma",       ic:"chart-column", cat:"analizar mejorar" },
  { cmd:"view.smartGrid", label:"Cuadrícula inteligente", ic:"grid-3x3", cat:"analizar corregir" },
  { cmd:"an.palette",    label:"Paleta de colores", ic:"palette",     cat:"analizar color" },
  { cmd:"an.eyedropper", label:"Cuentagotas de pantalla", ic:"pipette", cat:"analizar color" },
  { cmd:"an.exif",       label:"Metadatos EXIF",   ic:"tags",         cat:"analizar" },
  { cmd:"an.strip",      label:"Limpiar metadatos", ic:"shield-check", cat:"analizar ia" }
];

const KEY = "realify.drawer.cat";
const svgWrap = inner =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

/* Iconos que ya existen en el menú (Realify, PurePixel, Unmark…): se
   reutilizan tal cual para que el mismo filtro tenga el mismo dibujo
   en todas partes. */
const menuIcons = new Map();
(function collect(items){
  for(const it of items){
    if(it.submenu) collect(it.submenu);
    else if(it.items) collect(it.items);
    else if(it.cmd && it.icon) menuIcons.set(it.cmd, it.icon);
  }
})(MENUS);

function iconFor(it){
  if(it.ic && ICONS[it.ic]) return svgWrap(ICONS[it.ic]);
  if(it.tool){
    const t = TOOLS.find(x => x.id === it.tool);
    if(t) return t.icon;
  }
  if(it.cmd && menuIcons.has(it.cmd)) return menuIcons.get(it.cmd);
  return svgWrap(ICONS["sparkle"] || "");
}

const isEnabled = it =>
  it.auto ? doc.open : it.cmd ? enabled(it.cmd) : doc.open;

/* Aviso en consola —nunca en pantalla— si algún comando de los menús
   Ajustes o Filtro no tiene sitio en el cajón: así un filtro nuevo
   añadido al menú no se queda sin forma de llegar a él en móvil sin
   que nadie se entere. */
function checkCoverage(){
  const have = new Set(ITEMS.map(i => i.cmd).filter(Boolean));
  const missing = [];
  const walk = items => { for(const it of items){
    if(it.submenu) walk(it.submenu);
    else if(it.cmd && !it.desktopOnly && !have.has(it.cmd)) missing.push(it.cmd);
  } };
  for(const m of MENUS) if(m.label === "Ajustes" || m.label === "Filtro") walk(m.items);
  if(missing.length) console.warn("[cajón] comandos sin entrada:", missing.join(", "));
}

let drawer, veil, tabsEl, gridEl, searchEl, emptyEl, handle, cat = "basicos", openState = false, query = "";

/* Texto en el que busca el buscador: el nombre corto del cajón y, si
   el comando está en un menú con otro nombre, también ése. */
const menuLabels = new Map();
(function collectLabels(items){
  for(const it of items){
    if(it.submenu) collectLabels(it.submenu);
    else if(it.items) collectLabels(it.items);
    else if(it.cmd && it.label) menuLabels.set(it.cmd, it.label.replace(/…|\(.*?\)/g, ""));
  }
})(MENUS);
const haystack = new Map();
const searchTextOf = it => {
  if(!haystack.has(it)) haystack.set(it, searchable(`${it.label} ${(it.cmd && menuLabels.get(it.cmd)) || ""}`));
  return haystack.get(it);
};

/* Cada pestaña en orden alfabético —como Snapseed: así se encuentra
   algo por su nombre—, salvo «Automático», que se queda el primero
   allí donde aparece. Con algo escrito en el buscador, sólo lo que
   coincide DENTRO de la pestaña activa: primero lo que contiene las
   palabras tal cual y después lo que se les parece (erratas). */
const byLabel = (a, b) => a.label.localeCompare(b.label, "es");
const keyOf = it => it.auto ? "auto" : it.cmd || it.tool;
function itemsFor(c){
  /* Básicos va en su orden propio; con algo escrito en el buscador se
     busca en todo, porque quien busca algo concreto no tiene por qué
     saber que no es «básico». */
  if(c === "basicos" && !query.trim()) return BASICS.map(k => ITEMS.find(i => keyOf(i) === k)).filter(Boolean);
  if(c === "basicos") c = "todos";
  const list = c === "todos" ? ITEMS.slice() : ITEMS.filter(i => i.cat.split(" ").includes(c));
  const auto = list.filter(i => i.auto), rest = list.filter(i => !i.auto).sort(byLabel);
  if(!query.trim()) return [...auto, ...rest];
  const scored = [...auto, ...rest].map(it => [it, matchScore(query, searchTextOf(it))]).filter(([, s]) => s > 0);
  return [...scored.filter(([, s]) => s === 2), ...scored.filter(([, s]) => s === 1)].map(([it]) => it);
}

function renderTabs(){
  tabsEl.innerHTML = "";
  for(const [id, label] of CATS){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "td-tab" + (id === cat ? " on" : "");
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", id === cat ? "true" : "false");
    b.textContent = label;
    b.addEventListener("click", () => setCat(id));
    tabsEl.appendChild(b);
  }
  tabsEl.querySelector(".on")?.scrollIntoView({ block:"nearest", inline:"center" });
}

function renderGrid(){
  gridEl.innerHTML = "";
  const items = itemsFor(cat);
  emptyEl.hidden = items.length > 0;
  if(!items.length){
    const label = CATS.find(c => c[0] === cat)?.[1] || "";
    emptyEl.textContent = cat === "todos" || cat === "basicos" ? `Nada coincide con «${query.trim()}».`
      : `Nada coincide con «${query.trim()}» en ${label}.`;
  }
  for(const it of items){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "td-item" + (it.auto ? " td-auto" : "");
    b.disabled = !isEnabled(it);
    if(it.tool && !it.cmd && current && current.id === it.tool) b.classList.add("on");
    b.innerHTML = `<span class="td-ic" aria-hidden="true">${iconFor(it)}</span><span class="td-label">${it.label}</span>`;
    b.addEventListener("click", () => activate(it));
    gridEl.appendChild(b);
  }
  gridEl.scrollTop = 0;
}

function setCat(id){
  if(id === cat) return;
  cat = id;
  try{ localStorage.setItem(KEY, id); }catch{}
  haptic(4);
  renderTabs();
  renderGrid();
}

function activate(it){
  closeDrawer();
  if(it.auto){ run("adj.autoEnhance"); return; }
  if(it.cmd){ run(it.cmd); return; }
  if(it.tool) setTool(it.tool);
}

export function openDrawer(){
  if(openState || !doc.open) return;
  openState = true;
  haptic(6);
  // Cada vez que se abre, el buscador empieza vacío.
  query = ""; searchEl.value = "";
  renderTabs();
  renderGrid();
  drawer.style.transform = "";
  drawer.classList.add("open");
  veil.classList.add("on");
  drawer.setAttribute("aria-hidden", "false");
  handle.setAttribute("aria-expanded", "true");
}

export function closeDrawer(){
  if(!openState) return;
  openState = false;
  drawer.style.transform = "";
  drawer.classList.remove("open");
  veil.classList.remove("on");
  drawer.setAttribute("aria-hidden", "true");
  handle.setAttribute("aria-expanded", "false");
}

/* Arrastrar el asa del cajón hacia abajo lo cierra, igual que la hoja
   de capas y los diálogos: el mismo gesto en toda la app. */
function wireGrab(grab){
  let y0 = null, dy = 0;
  grab.addEventListener("pointerdown", e => {
    y0 = e.clientY; dy = 0;
    grab.setPointerCapture(e.pointerId);
    drawer.style.transition = "none";
  });
  grab.addEventListener("pointermove", e => {
    if(y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    drawer.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if(y0 === null) return;
    y0 = null;
    drawer.style.transition = "";
    if(dy > 80) closeDrawer();
    else drawer.style.transform = "";
  };
  grab.addEventListener("pointerup", end);
  grab.addEventListener("pointercancel", end);
}

/* Deslizar a izquierda o derecha sobre la cuadrícula cambia de
   pestaña. Sólo cuenta un gesto claramente horizontal: el desplazamiento
   vertical de la lista sigue funcionando como siempre. */
function wireSwipe(){
  let x0 = 0, y0 = 0, t0 = 0;
  gridEl.addEventListener("touchstart", e => {
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  }, { passive:true });
  gridEl.addEventListener("touchend", e => {
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if(Date.now() - t0 > 600 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = CATS.findIndex(c => c[0] === cat);
    const next = CATS[i + (dx < 0 ? 1 : -1)];
    if(next) setCat(next[0]);
  }, { passive:true });
}

function syncHandle(){
  handle.hidden = !doc.open;
  if(!doc.open) closeDrawer();
}

export function initToolDrawer(){
  try{ const saved = localStorage.getItem(KEY); if(CATS.some(c => c[0] === saved)) cat = saved; }catch{}

  handle = document.getElementById("toolsHandle");
  drawer = document.createElement("section");
  drawer.id = "toolDrawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-label", "Herramientas");
  drawer.setAttribute("aria-hidden", "true");
  drawer.innerHTML = `
    <div class="td-grab" aria-hidden="true"></div>
    <div class="td-head">
      <h2>Herramientas</h2>
      <button type="button" class="td-autobtn primary">${svgWrap(ICONS["wand-sparkles"])}<span>Automático</span></button>
      <button type="button" class="td-close icon ghost" aria-label="Cerrar">${svgWrap(ICONS["x"])}</button>
    </div>
    <nav class="td-tabs" role="tablist" aria-label="Categorías"></nav>
    <div class="td-search">
      ${svgWrap('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}
      <input type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
        placeholder="Buscar herramienta o filtro" aria-label="Buscar herramienta o filtro">
    </div>
    <p class="td-empty" hidden></p>
    <div class="td-grid"></div>`;
  document.body.appendChild(drawer);

  veil = document.createElement("div");
  veil.id = "toolDrawerVeil";
  document.body.appendChild(veil);

  tabsEl = drawer.querySelector(".td-tabs");
  gridEl = drawer.querySelector(".td-grid");
  searchEl = drawer.querySelector(".td-search input");
  emptyEl = drawer.querySelector(".td-empty");
  searchEl.addEventListener("input", () => { query = searchEl.value; renderGrid(); });
  // Intro activa el primer resultado, como en un lanzador.
  searchEl.addEventListener("keydown", e => {
    if(e.key !== "Enter") return;
    const first = itemsFor(cat).find(isEnabled);
    if(first){ e.preventDefault(); searchEl.blur(); activate(first); }
  });

  handle.addEventListener("click", () => openState ? closeDrawer() : openDrawer());
  veil.addEventListener("click", closeDrawer);
  drawer.querySelector(".td-close").addEventListener("click", closeDrawer);
  drawer.querySelector(".td-autobtn").addEventListener("click", () => activate(ITEMS[0]));
  addEventListener("keydown", e => { if(e.key === "Escape") closeDrawer(); });
  wireGrab(drawer.querySelector(".td-grab"));
  wireSwipe();

  on("doc:structure", syncHandle);
  on("tool:change", () => { if(openState) renderGrid(); });
  syncHandle();
  checkCoverage();
}
