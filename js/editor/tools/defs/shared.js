/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Piezas que usan varias familias de herramientas: icono, estado compartido y ayudas de pincel y selección.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { activeLayer, doc } from "../../../core/doc.js";
import { toast } from "../../../core/toast.js";
import { getMaskTarget } from "../../layers/masks.js";
import { isFillLayer, isShapeLayer } from "../../layers/layercontent.js";
import { FONTS } from "../../text/text.js";
import { brushConfig, symmetryAxes } from "../brushes.js";
import { hexToRgb } from "../paint.js";
import { view } from "../../../core/view.js";
import { scheduleOverlay, scratchView } from "../../render/compositor.js";
import { current } from "../tool-current.js";

export const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

/* Capa activa lista para pintar sobre ella a mano, o null con el aviso
   ya mostrado: ni bloqueada, ni una capa de relleno o de forma —esas
   regeneran su lienzo entero desde sus propios parámetros en cuanto
   cambian, así que un trazo encima desaparecería sin explicación en
   cuanto se tocara el panel de Propiedades—. Comparten este guardián
   todas las herramientas que escriben píxeles directamente: pincel,
   borrador, clonar, eliminar manchas, exponer, emborronar, licuar,
   pincel de historial, bote de pintura, degradado (sobre la capa, no
   sobre su máscara) y mover según el contenido. */
export function requirePaintable(){
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return null; }
  if(l.locked){ toast("La capa está bloqueada"); return null; }
  // Su máscara sí es de verdad pintable a mano pase lo que pase con
  // el tipo de la capa: el bloqueo de abajo es sólo para su lienzo
  // propio, el que se regenera solo.
  const paintingMask = getMaskTarget() === l.id && !!l.mask;
  if(!paintingMask && (isFillLayer(l) || isShapeLayer(l))){
    toast(`«${l.name}» se genera desde sus propios parámetros: cámbialos en el panel de Propiedades, o «Rasterizar capa» (menú Capa) para pintar encima directamente.`, "err");
    return null;
  }
  return l;
}

export const state = {
  size: 24,
  hardness: 70,
  opacity: 100,
  healSample: "layer",
  cropRect: null,
  cropRatio: "free",
  cropW: 16,
  cropH: 9,
  cropGuide: "thirds",
  /* Ajustes de texto: son los que se aplican al crear uno nuevo y
     los que edita la barra cuando hay una capa de texto activa. */
  fontFamily: FONTS[0][0],
  fontSize: 64,
  bold: false,
  italic: false,
  textColor: "#ffffff",
  align: "left",
  lineHeight: 125,
  tracking: 0,
  strokeWidth: 0,
  strokeColor: "#000000",
  shadow: false,
  allCaps: false,
  shadowColor: "#000000",
  shadowX: 2,
  shadowY: 3,
  shadowBlur: 8,
  shadowAlpha: 55,
  textBg: false,
  textBgColor: "#000000",
  textBgOpacity: 70,
  textBgPadding: 14,
  textBgRadius: 8,
  /* Giro y marco de párrafo. `textBoxed` apagado = texto de punto. */
  textAngle: 0,
  textBoxed: false,
  textBoxW: 600,
  textBoxH: 200,
  /* Texto repartido sobre un círculo. La separación va en píxeles de
     arco, como el espaciado del texto recto. */
  textCircle: false,
  textCircleRadius: 160,
  textCircleDistance: 0,
  textCircleSkew: 0,
  textCircleFlip: false,
  /* Sangrías de párrafo (sólo con marco puesto) y kerning manual —éste
     último no se guarda aquí de verdad, «textKerning» sólo refleja el
     valor en el hueco donde esté el cursor ahora mismo dentro del
     cuadro de edición; escribirlo lo manda derecho a
     `layer.text.kerning`, ver on("tool:paramchange") más abajo—. */
  textIndentFirst: 0,
  textIndentLeft: 0,
  textIndentRight: 0,
  textKerning: 0,
  /* OpenType. */
  textLigatures: true,
  textSmallCaps: false,
  /* Deformación con nombre (Arco/Bandera/Pez) y texto en trazado
     —«textPathMode» sólo activa el modo de ARRASTRAR una curva nueva
     con esta misma herramienta; una vez puesta, se edita con sus tres
     asas mientras la capa siga activa, igual que una forma—. */
  textWarpKind: "none",
  textWarpAmount: 50,
  textPathMode: false,
  /* Estilos de carácter y de párrafo: el nombre elegido en cada
     desplegable, sólo para saber cuál aplicar o sobrescribir — la
     lista de verdad vive en editor/text/textstyles.js. */
  charStyle: "",
  paraStyle: "",
  /* Relleno, degradado, formas, clonar, exponer y emborronar.
     gradFrom/gradTo y fillColor son colores de rol fijo (no siguen al
     frontal/fondo activo, a diferencia de «color»: ver más abajo). */
  gradFrom: "#ffffff",
  gradTo: "#000000",
  fillColor: "#ffffff",
  tolerance: 24,
  contiguous: true,
  gradKind: "linear",
  shapeKind: "rect",
  shapeFill: true,
  shapeStroke: false,
  shapeSides: 5,
  shapeInner: 50,
  shapeShadow: false,
  lineWidth: 4,
  cloneSrc: null,
  cloneOffset: null,
  exposeMode: "dodge",
  exposeRange: "mid",
  strength: 50,
  /* Dodge & Burn no destructivo: pinta blanco o negro puro sobre una
     capa gris al 50 % en modo Superponer (ver ensureDodgeBurnLayer).
     Comparte tamaño, dureza y fuerza con el resto de pinceles a
     propósito —es el mismo concepto, sólo que el color no se elige,
     lo decide el modo—, así que [ ] (tamaño) y Mayús+[ ] (dureza)
     también le sirven. */
  dbMode: "dodge",
  /* Transformación libre (igual que perspectiva: viven aquí porque es
     de donde los lee la barra de opciones; el módulo los recoge con
     xformSync). xfW/xfH/xfAngle/xfSkewX/xfSkewY son de sólo lectura
     desde la barra —se repintan tras cada gesto— salvo que el usuario
     teclee directamente en el campo. */
  xfMode: "free",
  xfProportional: false,
  xfW: 100, xfH: 100, xfAngle: 0, xfSkewX: 0, xfSkewY: 0,
  /* Perspectiva (los valores viven aquí porque es de donde los lee la
     barra de opciones; el módulo los recoge con perspSync) */
  perspMode: "guides",
  perspGrid: true,
  perspVert: 0,
  perspHorz: 0,
  perspRot: 0,
  perspScale: 100,
  /* Licuar */
  liqMode: "push",
  liqSize: 90,
  liqStrength: 50,
  liqVolume: 45,
  /* Comparar: fracción (0..1) de la anchura del documento donde cae
     la línea divisoria. A la izquierda, el original; a la derecha,
     el resultado actual. */
  cmpSplit: 0.5,
  /* Frontal y fondo, como en Photoshop: dos colores guardados a la
     vez, con el frontal para el botón izquierdo y el fondo para el
     derecho (ver setActiveColorSlot, cableado en main.js). El blanco
     como frontal por defecto mantiene el comportamiento de siempre
     del Pincel; el negro de fondo, el del Borrador sobre una máscara. */
  fg: "#ffffff",
  bg: "#000000",
  /* Pincel: simetría, textura procedural y color a lo largo del trazo.
     Viven en brushes.js (brushConfig, que se guarda en el navegador);
     aquí sólo una copia para la barra de opciones, que se sincroniza
     en on("tool:paramchange"). */
  brushSymmetry: brushConfig.symmetry,
  brushSymmetryCount: brushConfig.symmetryCount,
  brushTexture: brushConfig.texture,
  brushTextureDepth: brushConfig.textureDepth,
  brushTextureScale: brushConfig.textureScale,
  brushColorMode: brushConfig.colorMode,
  brushGradientLength: brushConfig.gradientLength,
  /* Dodge & Burn: ver la capa gris al 50 % tal cual, en vivo */
  dbShowGray: false
};

/* Nivel de gris (0-255) de un color: lo que de verdad guarda una
   máscara en su canal alfa cuando se pinta con él. Misma fórmula de
   luminancia que ya usa el ajuste de Tonos, para que un mismo color
   se vea igual de claro en un sitio que en otro. */
export function grayLevel(hex){
  const [r, g, b] = hexToRgb(hex);
  return Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
}

export function normRect(a, b){
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/* Guía inteligente: la línea magenta que marca contra qué se acaba de
   encajar el centro del contenido (borde, centro del documento o una
   guía puesta a mano), igual que Photoshop mientras se arrastra una
   capa. Cruza toda la pantalla, no sólo el documento, porque el
   contenido puede haberse arrastrado parcialmente fuera del lienzo. */
/* La línea magenta que marca contra qué se acaba de encajar —un
   borde, un centro o una guía puesta a mano—, igual que Photoshop
   mientras se arrastra una capa o se dibuja una selección. Cruza toda
   la pantalla, no sólo el documento, porque lo que se arrastra puede
   haberse salido parcialmente del lienzo. Compartida entre «Mover» y
   las herramientas de selección: es el mismo dibujo, sólo cambia
   quién decidió `snapX`/`snapY`. */
export function drawSnapLines(ctx, snapX, snapY){
  if(snapX == null && snapY == null) return;
  const px = 1 / view.zoom;
  const span = Math.max(doc.w, doc.h) * 3 + 4000;
  ctx.strokeStyle = "#ff4fd8";
  ctx.lineWidth = px;
  ctx.beginPath();
  if(snapX != null){ ctx.moveTo(snapX, -span); ctx.lineTo(snapX, span); }
  if(snapY != null){ ctx.moveTo(-span, snapY); ctx.lineTo(span, snapY); }
  ctx.stroke();
}

/* Un lápiz o una pantalla que mida presión de verdad manda valores
   que se mueven; un ratón o la mayoría de pantallas táctiles sin
   presión mandan siempre 0 o exactamente 0.5, así que esos dos valores
   se tratan como «no hay dato» y no escalan nada. */
export function pressureScale(e){
  if(!e || typeof e.pressure !== "number") return 1;
  const pr = e.pressure;
  if(pr <= 0 || pr === 0.5) return 1;
  return 0.35 + 0.65 * Math.min(1, pr);
}

/* Contorno del pincel: se dibuja en el compositor para que escale
   con el zoom y se vea el tamaño real que va a pintar. */
export let cursorPos = null;

export function setCursorPos(p){ cursorPos = p; scheduleOverlay(); }

/* Ejes de simetría del Pincel, a trazos, mientras está activa. */
function drawSymmetryAxes(ctx){
  if(current?.id !== "brush" || brushConfig.symmetry === "none" || !doc.open) return;
  const px = 1 / view.zoom;
  ctx.save();
  ctx.lineWidth = px * 1.2;
  ctx.setLineDash([6 * px, 5 * px]);
  for(const [x0, y0, x1, y1] of symmetryAxes(doc)){
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.moveTo(x0 + px, y0 + px); ctx.lineTo(x1 + px, y1 + px); ctx.stroke();
    ctx.strokeStyle = "rgba(103,148,255,.95)"; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
}

/* Dodge & Burn: con «Ver gris 50 %» la capa gris se dibuja encima tal
   cual (en modo Normal), para ver en tiempo real dónde se ha aclarado
   y oscurecido; se refresca con cada toque. */
function drawDodgeBurnGray(ctx){
  if(current?.id !== "dodgeburn" || !state.dbShowGray) return;
  const l = activeLayer();
  if(!l || !l.dodgeBurn) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(l.canvas, 0, 0);
  const s = scratchView();
  if(s){ ctx.globalAlpha = s.alpha; ctx.drawImage(s.canvas, s.x, s.y); }
  ctx.restore();
}

export function drawBrushCursor(ctx){
  drawDodgeBurnGray(ctx);
  drawSymmetryAxes(ctx);
  if(!cursorPos) return;
  const r = state.size / 2;
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = 1 / view.zoom;
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, r, 0, 6.2832); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, r + 1 / view.zoom, 0, 6.2832); ctx.stroke();
}

/* ═══ recorte ═══ */
export const HANDLE = 9;

export function inRect(p, r){ return p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h; }
