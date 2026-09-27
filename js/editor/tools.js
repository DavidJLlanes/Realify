/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS
   Cada herramienta declara su icono, sus opciones y qué hace con el
   puntero. La barra de opciones se construye sola a partir de la
   declaración, así que añadir una herramienta nueva no obliga a
   tocar la interfaz.
   ═══════════════════════════════════════════════════════════════ */

import { emit, on } from "../core/bus.js";
import { doc, activeLayer, cropDoc, addLayer } from "../core/doc.js";
import { flatten } from "./layertree.js";
import { beginPixels, expandPendingPixels, commitPixels, cancelPixels, abortPixels, record, recordLayers } from "../core/history.js";
import { view, toImage, zoomAt, zoomToRect, fit } from "./view.js";
import { beginScratch, ensureScratchRect, endScratch, discardScratch, scratchCtx, scratchView,
         setOverlay, scheduleCompose, scheduleOverlay, pickColor,
         compose, canvasEl } from "./compositor.js";
import { toast } from "../ui/toast.js";
import { createTextLayer, isText, updateText, textBounds, renderTextLayer, alignTextPatch,
         pointInText, FONTS } from "./text.js";
import { hitHandle, beginBoxDrag, boxDragTo, endBoxDrag,
         drawTextBox } from "./textbox.js";
import { startEdit, endEdit, isEditing, editingLayer, cursorPos as textCursorPos,
         place as placeEditor, focusEditor } from "./textedit.js";
import { charStyleAttrs, paraStyleAttrs, charStyles, paraStyles } from "./textstyles.js";
import { hexToRgb, floodFill, drawGradient, drawShape,
         dodgeBurn, makeSmudge, cloneStamp, healSpot } from "./paint.js";
import { perspBegin, perspEnd, perspRestore, perspPreview, perspRecompute,
         perspDown, perspMove, perspUp, perspCancel, perspApply, perspReset,
         perspFill, perspClearGuides, perspSync, drawPerspOverlay,
         persp, perspHasChange } from "./perspectool.js";
import { xform, xformBegin, xformEnd, xformRestore, xformDown, xformMove, xformUp,
         xformCancel, xformApply, xformResetAll, xformFlip, xformSync,
         xformHandleAt, xformWarpHandleAt, xformCursorFor, drawXformOverlay,
         xformReadout, xformArmed, xformHasChange } from "./transformtool.js";
import { maskFromRect, maskFromEllipse, maskFromPolygon, maskFromWand,
         commitSelection, boundsOf } from "./selection.js";
import { moveContentAware } from "./contentmove.js";
import { penBegin, penEnd, penDown, penMove, penUp, penCancel, penUndoPoint,
         penFinishOpen, penToSelection, penToMask, penArmed, penHasPath,
         drawPenOverlay } from "./pentool.js";
import { brushSourceLayerFor } from "../core/snapshots.js";
import { getMaskTarget, paintMaskDab, cloneMask, paintMaskGradient } from "./masks.js";
import { snapValue, snapCandidatesX, snapCandidatesY, snapRange,
         gridStep, snapToGridEnabled } from "./rulers.js";
import { makeGrid, resetGrid, isIdentityGrid, applyStroke, relaxGrid, renderLiquify } from "./liquify.js";
import { COARSE } from "../core/device.js";
import { contentBounds, otherLayersEdgeCandidates } from "./align.js";
import { isFillLayer, isShapeLayer, addShapeLayer, renderShapeLayer,
         setShapeParams, previewShapeParams } from "./layercontent.js";
import { paintProfessionalSegment, professionalSegmentBounds, smoothBrushPoint,
         brushConfig, setBrushOption, symmetryAxes, SYMMETRY_MODES, TEXTURES, COLOR_MODES } from "./brushes.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

/* Capa activa lista para pintar sobre ella a mano, o null con el aviso
   ya mostrado: ni bloqueada, ni una capa de relleno o de forma —esas
   regeneran su lienzo entero desde sus propios parámetros en cuanto
   cambian, así que un trazo encima desaparecería sin explicación en
   cuanto se tocara el panel de Propiedades—. Comparten este guardián
   todas las herramientas que escriben píxeles directamente: pincel,
   borrador, clonar, eliminar manchas, exponer, emborronar, licuar,
   pincel de historial, bote de pintura, degradado (sobre la capa, no
   sobre su máscara) y mover según el contenido. */
function requirePaintable(){
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
     lista de verdad vive en editor/textstyles.js. */
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
const BRUSH_KEYS = { brushSymmetry: "symmetry", brushSymmetryCount: "symmetryCount", brushTexture: "texture",
  brushTextureDepth: "textureDepth", brushTextureScale: "textureScale", brushColorMode: "colorMode",
  brushGradientLength: "gradientLength" };
/** Pone un ajuste del pincel desde un comando (menú, cajón móvil). */
export function setBrushMode(key, value){
  state[key] = value;
  if(BRUSH_KEYS[key]) setBrushOption(BRUSH_KEYS[key], value);
}

/* «state.color» no guarda nada por sí mismo: es una ventana al color
   activo (frontal o fondo) según qué botón del ratón esté pintando
   ahora mismo. Así, Pincel, Bote de pintura y Cuentagotas seleccionan
   frontal/fondo solos, sin que cada uno tenga que saber que existen
   dos colores —leen y escriben «state.color» exactamente igual que
   antes de que el frontal/fondo existiera—. Formas y Degradado, en
   cambio, usan sus propias claves (fillColor, strokeColor, gradFrom,
   gradTo): sus colores tienen un rol fijo (relleno/borde, desde/hasta)
   y no deben cambiar sólo porque se pinte con el botón derecho. */
let activeColorSlot = "fg";
export function setActiveColorSlot(slot){ activeColorSlot = slot === "bg" ? "bg" : "fg"; }
export function getActiveColorSlot(){ return activeColorSlot; }
export function swapColors(){
  const t = state.fg; state.fg = state.bg; state.bg = t;
  emit("color:change");
}
export function resetColors(){
  state.fg = "#ffffff"; state.bg = "#000000";
  emit("color:change");
}
Object.defineProperty(state, "color", {
  enumerable: true,
  get(){ return state[activeColorSlot]; },
  set(v){ state[activeColorSlot] = v; emit("color:change"); }
});

/* Nivel de gris (0-255) de un color: lo que de verdad guarda una
   máscara en su canal alfa cuando se pinta con él. Misma fórmula de
   luminancia que ya usa el ajuste de Tonos, para que un mismo color
   se vea igual de claro en un sitio que en otro. */
function grayLevel(hex){
  const [r, g, b] = hexToRgb(hex);
  return Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
}

/* ═══ definición de herramientas ═══ */
export const TOOLS = [
  {
    id:"move", name:"Mover", key:"v",
    icon: svg('<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>'),
    cursor:"move",
    options:[],
    activate(){ setOverlay(drawMoveSnapOverlay); },
    deactivate(){ setOverlay(null); this._snapX = null; this._snapY = null; },
    down(p, e){
      const l = activeLayer();
      if(!l) return;
      if(l.locked){ toast("La capa está bloqueada"); return; }
      /* Arrastrar píxeles de una capa de relleno o de forma los
         desalinearía de `fill`/`shape` —la próxima vez que se tocara
         un mando del panel de Propiedades, volverían a dibujarse en su
         sitio de ANTES del arrastre, como si nunca se hubieran
         movido—. Una forma se reposiciona arrastrándola con la propia
         herramienta Formas (U); un relleno no tiene «sitio» que mover. */
      if(isFillLayer(l) || isShapeLayer(l)){
        toast(isShapeLayer(l)
          ? `Arrastra «${l.name}» con la herramienta Formas (U), no con Mover.`
          : `«${l.name}» rellena todo el lienzo: no hay nada que mover.`, "err");
        return;
      }
      /* Un texto en trazado no se coloca por `x`/`y` —esos dos sólo
         sirven de ancla para el cuadro de edición—, sino por los tres
         puntos de `text.path`: arrastrarlo con Mover cambiaría esa
         ancla sin tocar la curva, y las letras (que sí siguen la
         curva) se quedarían quietas mientras el cursor se aleja. Se
         mueve arrastrando sus propias asas con la herramienta Texto. */
      if(isText(l) && l.text.path){
        toast(`Arrastra las asas de «${l.name}» con la herramienta Texto (T), no con Mover.`, "err");
        return;
      }
      const box = contentBounds(l);
      if(!box){ toast("La capa está vacía"); return; }
      /* Cada arrastre empieza SIEMPRE en cero. Antes no se
         reiniciaban y un clic sin mover volvía a aplicar el
         desplazamiento del arrastre anterior, descuadrando el búfer
         respecto a lo dibujado. */
      this._dx = 0; this._dy = 0;
      this._box = box;
      this._snapX = null; this._snapY = null;
      /* Los bordes y centros de las DEMÁS capas, calculados una sola
         vez al empezar el arrastre —recorrer el canal alfa de cada
         capa en cada fotograma de un arrastre sería tirar el tiempo—.
         Si otra capa se mueve o cambia mientras tanto, no se entera
         hasta el siguiente arrastre, que es un precio razonable por
         no recalcular sesenta veces por segundo. */
      this._layerCand = otherLayersEdgeCandidates(doc.layers, l.id);
      /* Una capa de texto se mueve cambiando sus coordenadas, no sus
         píxeles: si se desplazaran los píxeles, el primer retoque del
         texto lo volvería a dibujar en su sitio de origen y saltaría
         de vuelta. */
      this._text = isText(l) ? { x: l.text.x, y: l.text.y } : null;
      if(!this._text){
        if(!moveBufFor(l)) return;
        beginPixels("Mover capa", l);
      }
      this._from = p;
    },
    move(p){
      if(!this._from) return;
      const l = activeLayer();
      if(!l) return;
      let rdx = Math.round(p.x - this._from.x);
      let rdy = Math.round(p.y - this._from.y);

      /* Guías inteligentes, como en Photoshop: el contenido que se
         arrastra se ajusta contra los bordes y el centro del
         documento, contra cualquier guía puesta a mano, contra los
         bordes y centros de otras capas y contra la cuadrícula si
         está activo su ajuste —probando los dos bordes Y el centro
         del propio contenido, no sólo el centro—, en cuanto cualquiera
         de ellos cae dentro de tolerancia en pantalla. */
      const box = this._box;
      const guides = { h: doc.guides.h, v: doc.guides.v };
      const gStep = snapToGridEnabled() ? gridStep() : 0;
      const candX = snapCandidatesX(doc.w, guides, this._layerCand.x);
      const candY = snapCandidatesY(doc.h, guides, this._layerCand.y);
      const sx = snapRange(box.x + rdx, box.x + box.w + rdx, candX, 6, view.zoom, gStep);
      const sy = snapRange(box.y + rdy, box.y + box.h + rdy, candY, 6, view.zoom, gStep);
      rdx = Math.round(rdx + sx.offset);
      rdy = Math.round(rdy + sy.offset);
      this._snapX = sx.at;
      this._snapY = sy.at;

      if(this._text){
        const c = clampMove(this._box, doc.w, doc.h, rdx, rdy);
        this._dx = c.dx; this._dy = c.dy;
        updateText(l, { x: this._text.x + c.dx, y: this._text.y + c.dy });
      } else {
        this._dx = rdx; this._dy = rdy;
        moveDraw(l, rdx, rdy);
        l.thumbDirty = true;
      }
      scheduleOverlay();
      scheduleCompose();
    },
    up(){
      if(!this._from) return;
      const l = activeLayer();
      const from = this._text;
      const dx = this._dx || 0, dy = this._dy || 0;
      this._from = null; this._dx = 0; this._dy = 0;
      this._box = null; this._text = null;
      this._snapX = null; this._snapY = null;
      scheduleOverlay();
      if(!l) return;

      if(from){
        if(!dx && !dy) return;                 // un clic no es un paso de historial
        const to = { x: from.x + dx, y: from.y + dy };
        updateText(l, to);
        record("Mover texto",
          () => updateText(l, { x: from.x, y: from.y }),
          () => updateText(l, to));
        emit("doc:structure");
        return;
      }

      if(!dx && !dy){ cancelPixels(); return; }
      const applied = moveDraw(l, dx, dy);
      if(applied && moveBuf && moveBuf.layerId === l.id){
        moveBuf.dx = applied.dx; moveBuf.dy = applied.dy;
      }
      selfCommit = "move";
      commitPixels();
      selfCommit = null;
      emit("doc:structure");
    },
    cancel(){
      if(!this._from) return;
      const l = activeLayer();
      const from = this._text;
      this._from = null; this._dx = 0; this._dy = 0;
      this._box = null; this._text = null;
      this._snapX = null; this._snapY = null;
      scheduleOverlay();
      if(from){ if(l) updateText(l, { x: from.x, y: from.y }); return; }
      moveDraw(l, 0, 0);       // vuelve a como estaba antes de este arrastre
      abortPixels();
    },
    /* Flechas del teclado: un paso de 1 píxel (10 con Alt), como en
       Photoshop. Sin guías inteligentes ni arrastre de por medio —sólo
       un desplazamiento exacto—, así que no reutiliza down/move/up
       (que sí ajustan a guías) sino que aplica el movimiento directo y
       lo registra como un único paso de historial. */
    nudge(dx, dy){
      if(this._from) return;          // no interferir con un arrastre en curso
      const l = activeLayer();
      if(!l) return;
      if(l.locked){ toast("La capa está bloqueada"); return; }
      if(isText(l)){
        const from = { x: l.text.x, y: l.text.y };
        const to = { x: from.x + dx, y: from.y + dy };
        updateText(l, to);
        record("Mover texto",
          () => updateText(l, from),
          () => updateText(l, to));
        emit("doc:structure");
        return;
      }
      if(!contentBounds(l)) return;    // capa vacía
      if(!moveBufFor(l)) return;
      beginPixels("Mover capa", l);
      const applied = moveDraw(l, dx, dy);
      if(applied && moveBuf && moveBuf.layerId === l.id){
        moveBuf.dx = applied.dx; moveBuf.dy = applied.dy;
      }
      l.thumbDirty = true;
      selfCommit = "move";
      commitPixels();
      selfCommit = null;
      emit("doc:structure");
    }
  },

  {
    id:"pan", name:"Mano", key:"h",
    icon: svg('<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
    cursor:"grab",
    pan:true,
    options:[]
  },

  {
    id:"zoom", name:"Zoom", key:"z",
    icon: svg('<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>'),
    cursor:"zoom-in",
    options:[
      {type:"button", label:"Ajustar", cmd:"view.fit"},
      {type:"button", label:"100 %", cmd:"view.zoom100"}
    ],
    activate(){ setOverlay(drawZoomOverlay); },
    deactivate(){ setOverlay(null); this._from = null; this._rect = null; },
    down(p, e){
      this._from = p;
      this._alt = e.altKey;
      this._rect = { x: p.x, y: p.y, w: 0, h: 0 };
    },
    move(p){
      if(!this._from) return;
      this._rect = normRect(this._from, p);
      scheduleOverlay();
    },
    up(e){
      if(!this._from) return;
      const r = this._rect;
      /* Un arrastre de verdad —más de unos pocos píxeles EN PANTALLA,
         para que el umbral no dependa del zoom actual— encuadra esa
         zona; un simple clic hace el zoom fijo de toda la vida,
         centrado en el punto y con Alt para alejar. */
      if(r && Math.max(r.w, r.h) * view.zoom > 6) zoomToRect(r);
      else zoomAt(view.zoom * (this._alt ? 1/1.6 : 1.6), e.clientX, e.clientY);
      this._from = null; this._rect = null;
      scheduleOverlay();
    },
    cancel(){ this._from = null; this._rect = null; scheduleOverlay(); }
  },

  {
    id:"crop", name:"Recortar", key:"c",
    icon: svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
    cursor:"crosshair",
    options:[
      {type:"select", key:"cropRatio", label:"Proporción", rerender:true, items:[
        ["free","Libre"],["orig","Original"],["1:1","1:1"],["4:3","4:3"],
        ["3:2","3:2"],["16:9","16:9"],["9:16","9:16"],["2:3","2:3"],
        ["custom","A medida…"]
      ]},
      {type:"number", key:"cropW", label:"", min:1, max:9999, width:52,
       showIf:() => state.cropRatio === "custom"},
      {type:"static", label:":", showIf:() => state.cropRatio === "custom"},
      {type:"number", key:"cropH", label:"", min:1, max:9999, width:52,
       showIf:() => state.cropRatio === "custom"},
      {type:"button", label:"⇄", title:"Girar la proporción", cmd:"crop.swap",
       showIf:() => state.cropRatio === "custom"},
      {type:"select", key:"cropGuide", label:"Guía", items:[
        ["thirds","Tercios"],["golden","Áurea"],["none","Ninguna"]
      ]},
      {type:"button", label:"Aplicar", cmd:"crop.apply", primary:true},
      {type:"button", label:"Cancelar", cmd:"crop.cancel"}
    ],
    activate(){
      state.cropRect = { x: 0, y: 0, w: doc.w, h: doc.h };
      setOverlay(drawCropOverlay);
    },
    /* Mismo criterio que Transformación libre y Perspectiva: cambiar
       de herramienta con un marco de recorte ya movido lo aplica en
       vez de descartarlo; sin tocar el marco (sigue siendo el lienzo
       entero) no hay nada que aplicar y se cierra sin dejar rastro. */
    deactivate(){
      const r = state.cropRect;
      const untouched = !r || (Math.round(r.x) === 0 && Math.round(r.y) === 0 &&
                                Math.round(r.w) === doc.w && Math.round(r.h) === doc.h);
      if(!forceDiscard && !untouched) applyCrop();
      state.cropRect = null;
      setOverlay(null);
    },
    down(p){
      const r = state.cropRect;
      const h = cropHandleAt(p);
      this._mode = h || (inRect(p, r) ? "move" : "new");
      this._from = p;
      this._start = { ...r };
      if(this._mode === "new"){
        state.cropRect = { x: p.x, y: p.y, w: 1, h: 1 };
        this._mode = "se";
        this._start = { ...state.cropRect };
      }
    },
    move(p){
      if(!this._mode) return;
      resizeCrop(this._mode, p, this._from, this._start);
      scheduleOverlay();
    },
    up(){ this._mode = null; }
  },

  {
    id:"brush", name:"Pincel", key:"b",
    icon: svg('<path d="m14.622 17.897-10.68-2.913"/><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"/><path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"/>'),
    cursor:"none",
    /* Botón derecho = pintar con el color de fondo, izquierdo = con el
       frontal (ver setActiveColorSlot, cableado en main.js). */
    rightClick:true,
    options:[
      {type:"color", key:"color", label:"Color"},
      {type:"range", key:"size", label:"Tamaño", min:1, max:400, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"opacity", label:"Opacidad", min:1, max:100, unit:"%"},
      {type:"select", key:"brushSymmetry", label:"Simetría", items: SYMMETRY_MODES, rerender:true,
       title:"Pinta a la vez en los dos lados de un eje (o en N radios)"},
      {type:"range", key:"brushSymmetryCount", label:"Radios", min:2, max:16, unit:"",
       showIf: () => state.brushSymmetry === "radial"},
      {type:"select", key:"brushTexture", label:"Textura", items: TEXTURES, rerender:true},
      {type:"range", key:"brushTextureDepth", label:"Relieve", min:0, max:100, unit:"%",
       showIf: () => state.brushTexture !== "none"},
      {type:"range", key:"brushTextureScale", label:"Escala", min:25, max:400, unit:"%",
       showIf: () => state.brushTexture !== "none"},
      {type:"select", key:"brushColorMode", label:"Color", items: COLOR_MODES, rerender:true},
      {type:"range", key:"brushGradientLength", label:"Longitud", min:20, max:4000, unit:"px",
       showIf: () => state.brushColorMode !== "solid"},
      {type:"button", label:"Pinceles…", cmd:"brush.settings", title:"Puntas, dinámica, flujo, dispersión y simetría"}
    ],
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      this._last=p;this._raw=p;this._smooth=p;this._lastTime=performance.now();this._carry=0;this._seed=(Date.now()&0x7fffffff);
      if(getMaskTarget() === l.id && l.mask){
        const dirty=professionalSegmentBounds(p,p,state.size,doc);
        beginPixels("Pintar máscara", l, true, {sparse:true,rect:dirty});
        const g=grayLevel(state.color),color=`rgb(${g},${g},${g})`;
        this._carry=paintProfessionalSegment(l.mask.ctx,p,p,{event:e,color,size:state.size,hardness:state.hardness,opacity:state.opacity,velocity:0,carry:0,doc,seed:this._seed});
        l.thumbDirty = true;
        scheduleCompose({rect:dirty,layer:l,transient:true});
        return;
      }
      const dirty=professionalSegmentBounds(p,p,state.size,doc);
      beginPixels("Pincel", l, false, {sparse:true,rect:dirty});
      const c = beginScratch(l, { alpha: 1, sparse:true, rect:dirty });
      this._carry=paintProfessionalSegment(c,p,p,{event:e,color:state.color,color2:brushColor2(),size:state.size,hardness:state.hardness,opacity:state.opacity,velocity:0,carry:0,doc,seed:this._seed});
      scheduleCompose({rect:dirty,transient:true});
    },
    move(p, e){
      if(!this._last) return;
      const now=performance.now(),dt=Math.max(1,now-this._lastTime),smooth=smoothBrushPoint(this._smooth,p),velocity=Math.hypot(p.x-this._raw.x,p.y-this._raw.y)/dt;
      this._raw=p;this._smooth=smooth;this._lastTime=now;
      const l = activeLayer();
      const dirty=professionalSegmentBounds(this._last,smooth,state.size,doc);
      if(l && getMaskTarget() === l.id && l.mask){
        const g=grayLevel(state.color),color=`rgb(${g},${g},${g})`;
        expandPendingPixels(dirty);
        this._carry=paintProfessionalSegment(l.mask.ctx,this._last,smooth,{event:e,color,size:state.size,hardness:state.hardness,opacity:state.opacity,velocity,carry:this._carry,doc,seed:this._seed++});
        this._last=smooth;
        l.thumbDirty = true;
        scheduleCompose({rect:dirty,layer:l,transient:true});
        return;
      }
      expandPendingPixels(dirty);
      this._carry=paintProfessionalSegment(ensureScratchRect(dirty),this._last,smooth,{event:e,color:state.color,color2:brushColor2(),size:state.size,hardness:state.hardness,opacity:state.opacity,velocity,carry:this._carry,doc,seed:this._seed++});
      this._last=smooth;
      scheduleCompose({rect:dirty,transient:true});
    },
    up(){
      if(!this._last) return;
      this._last = null;this._raw=null;this._smooth=null;this._carry=0;
      const l = activeLayer();
      if(l && getMaskTarget() === l.id && l.mask){
        commitPixels();
        emit("doc:structure");
        return;
      }
      endScratch(activeLayer());
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._last) return;
      this._last = null;this._raw=null;this._smooth=null;this._carry=0;
      const l = activeLayer();
      if(l && getMaskTarget() === l.id && l.mask){ abortPixels(); return; }
      discardScratch();
      abortPixels();
    }
  },

  {
    id:"eraser", name:"Borrador", key:"e",
    icon: svg('<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>'),
    cursor:"none",
    options:[
      {type:"range", key:"size", label:"Tamaño", min:1, max:400, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"opacity", label:"Opacidad", min:1, max:100, unit:"%"}
    ],
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      if(getMaskTarget() === l.id && l.mask){
        /* El Borrador sobre una máscara siempre pinta con el color de
           fondo, use el botón que use: es la herramienta que oculta,
           así que no tiene sentido que el derecho alterne a nada
           —para revelar con el botón derecho ya está el Pincel—. */
        beginPixels("Borrar máscara", l, true);
        this._last = p;
        paintMaskDab(l.mask.ctx, p, p, state.size/2 * pressureScale(e),
                     state.hardness, state.opacity / 100, grayLevel(state.bg));
        l.thumbDirty = true;
        scheduleCompose();
        return;
      }
      beginPixels("Borrador", l);
      this._last = p;
      eraseDab(l.ctx, p, p, pressureScale(e));
      scheduleCompose();
    },
    move(p, e){
      if(!this._last) return;
      const l = activeLayer();
      if(l && getMaskTarget() === l.id && l.mask){
        paintMaskDab(l.mask.ctx, this._last, p, state.size/2 * pressureScale(e),
                     state.hardness, state.opacity / 100, grayLevel(state.bg));
        this._last = p;
        l.thumbDirty = true;
        scheduleCompose();
        return;
      }
      eraseDab(activeLayer().ctx, this._last, p, pressureScale(e));
      this._last = p;
      scheduleCompose();
    },
    up(){
      if(!this._last) return;
      this._last = null;
      const l = activeLayer();
      if(l) l.thumbDirty = true;
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._last) return;
      this._last = null;
      abortPixels();
    }
  },

  {
    id:"text", name:"Texto", key:"t",
    icon: svg('<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>'),
    cursor:"text",
    options:[
      {type:"select", key:"fontFamily", label:"Fuente", items:FONTS},
      {type:"number", key:"fontSize", label:"Tama\u00f1o", min:4, max:900, unit:"px", width:62},
      {type:"toggle", key:"bold", label:"B", title:"Negrita", bold:true},
      {type:"toggle", key:"italic", label:"I", title:"Cursiva", italic:true},
      {type:"color", key:"textColor", label:"Color"},
      {type:"segment", key:"align", label:"", items:[
        ["left","\u2630","Izquierda"],["center","\u2637","Centrado"],["right","\u2635","Derecha"],
        ["justify","\u2261","Justificado (s\u00f3lo con marco)"]
      ]},
      {type:"number", key:"textAngle", label:"Giro", min:-180, max:180, unit:"°", width:56},
      {type:"toggle", key:"textBoxed", label:"Marco", rerender:true,
       title:"Texto de párrafo: las líneas se reajustan dentro de un marco de ancho fijo"},
      {type:"number", key:"textBoxW", label:"Ancho", min:20, max:20000, unit:"px", width:62,
       showIf:() => state.textBoxed},
      {type:"number", key:"textBoxH", label:"Alto", min:20, max:20000, unit:"px", width:62,
       showIf:() => state.textBoxed},
      {type:"number", key:"indentFirst", label:"Sangría 1ª línea", min:-2000, max:2000, unit:"px", width:60,
       showIf:() => state.textBoxed},
      {type:"number", key:"indentLeft", label:"Sangría izq.", min:0, max:2000, unit:"px", width:56,
       showIf:() => state.textBoxed},
      {type:"number", key:"indentRight", label:"Sangría der.", min:0, max:2000, unit:"px", width:56,
       showIf:() => state.textBoxed},
      {type:"number", key:"lineHeight", label:"Interlineado", min:50, max:300, unit:"%", width:58},
      {type:"number", key:"tracking", label:"Espaciado", min:-40, max:200, unit:"px", width:54},
      {type:"number", key:"textKerning", label:"Kerning", min:-200, max:400, unit:"px", width:56,
       showIf:() => isEditing() && textCursorPos() && textCursorPos().start === textCursorPos().end},
      {type:"number", key:"strokeWidth", label:"Contorno", min:0, max:40, unit:"px", width:50},
      {type:"color", key:"strokeColor", label:""},
      {type:"toggle", key:"shadow", label:"Sombra", rerender:true, title:"Sombra paralela"},
      {type:"color",  key:"shadowColor", label:"", showIf:() => state.shadow},
      {type:"number", key:"shadowX", label:"X", min:-200, max:200, unit:"px", width:52,
       showIf:() => state.shadow},
      {type:"number", key:"shadowY", label:"Y", min:-200, max:200, unit:"px", width:52,
       showIf:() => state.shadow},
      {type:"number", key:"shadowBlur", label:"Desenf.", min:0, max:200, unit:"px", width:54,
       showIf:() => state.shadow},
      {type:"number", key:"shadowAlpha", label:"Opac.", min:0, max:100, unit:"%", width:52,
       showIf:() => state.shadow},
      {type:"toggle", key:"allCaps", label:"MAY", title:"Mostrar en mayúsculas (no cambia lo escrito)"},
      {type:"toggle", key:"textLigatures", label:"Lig", title:"Ligaduras OpenType (fi, fl…): apagarlas fuerza letra a letra"},
      {type:"toggle", key:"textSmallCaps", label:"Vers", title:"Versalitas OpenType"},
      {type:"toggle", key:"textBg", label:"Fondo", rerender:true, title:"Caja de color detrás del texto"},
      {type:"color", key:"textBgColor", label:"", showIf:() => state.textBg},
      {type:"number", key:"textBgOpacity", label:"Opac.", min:0, max:100, unit:"%", width:50,
       showIf:() => state.textBg},
      {type:"number", key:"textBgPadding", label:"Margen", min:0, max:200, unit:"px", width:54,
       showIf:() => state.textBg},
      {type:"number", key:"textBgRadius", label:"Radio", min:0, max:200, unit:"px", width:54,
       showIf:() => state.textBg},
      {type:"toggle", key:"textCircle", label:"Círculo", rerender:true, title:"Repartir el texto sobre un círculo"},
      {type:"number", key:"textCircleRadius", label:"Radio", min:10, max:2000, unit:"px", width:62,
       showIf:() => state.textCircle},
      {type:"number", key:"textCircleDistance", label:"Separación", min:-40, max:200, unit:"px", width:58,
       showIf:() => state.textCircle},
      {type:"number", key:"textCircleSkew", label:"Inclinación", min:-90, max:90, unit:"°", width:58,
       showIf:() => state.textCircle},
      {type:"toggle", key:"textCircleFlip", label:"Invertir", title:"Escribir por dentro del arco, de derecha a izquierda",
       showIf:() => state.textCircle},
      {type:"select", key:"textWarpKind", label:"Deformar", rerender:true, items:[
        ["none","Ninguna"],["arc","Arco"],["flag","Bandera"],["fish","Pez"]
      ]},
      {type:"number", key:"textWarpAmount", label:"Fuerza", min:-100, max:100, unit:"%", width:56,
       showIf:() => state.textWarpKind !== "none"},
      {type:"toggle", key:"textPathMode", label:"Trazado", rerender:true,
       title:"Arrastra sobre el lienzo para trazar una curva y escribir el texto sobre ella"},
      {type:"button", label:"Quitar trazado", cmd:"text.removePath",
       showIf:() => { const l = activeLayer(); return isText(l) && !!l.text.path; }},
      {type:"select", key:"charStyle", label:"Estilo carácter", items:() =>
        [["","—"], ...charStyles.map(s => [s.name, s.name])]},
      {type:"button", label:"Guardar", cmd:"text.saveCharStyle"},
      {type:"select", key:"paraStyle", label:"Estilo párrafo", items:() =>
        [["","—"], ...paraStyles.map(s => [s.name, s.name])]},
      {type:"button", label:"Guardar", cmd:"text.saveParaStyle"}
    ],
    activate(){ setOverlay(drawTextToolOverlay); },
    deactivate(){ setOverlay(null); this._mode = null; this._rect = null; this._newPath = null; },

    /* Un mismo botón hace ahora seis cosas según dónde caiga y si se
       arrastra o no, que es lo que espera cualquiera que venga de un
       editor serio:
         · sobre un tirador de marco  → escalar, girar o ajustar el marco
         · sobre un asa de trazado    → mover ese punto de la curva
         · sobre un texto             → clic edita, arrastre mueve la capa
         · en hueco, con «Trazado»    → arrastre traza una curva nueva
         · en hueco, clic             → texto de punto
         · en hueco, arrastre         → marco de párrafo del tamaño arrastrado
       Clic y arrastre no se deciden aquí sino al soltar: hasta que el
       puntero no recorre unos píxeles no se sabe cuál de los dos era. */
    down(p, e){
      const l = activeLayer();
      this._start = p;
      this._moved = false;
      this._rect = null;

      if(isText(l) && !isEditing()){
        const h = hitHandle(l, p);
        if(h && beginBoxDrag(l, h, p)){ this._mode = "box"; return; }
        if(l.text.path){
          const ph = textPathHandleAt(p, l.text.path);
          if(ph){ this._mode = "pathedit"; this._pathHandle = ph; this._editLayer = l; return; }
        }
      }

      const hit = textAt(p);
      if(hit){
        this._mode = "text";
        this._target = hit;
        if(hit !== l){ setActiveLayerId(hit.id); pullTextStyle(hit); }
        this._from = { x: hit.text.x, y: hit.text.y };
        scheduleOverlay();
        return;
      }

      if(state.textPathMode){
        this._mode = "newpath";
        this._newPath = { p0:[p.x, p.y], p1:[p.x, p.y], p2:[p.x, p.y] };
        return;
      }
      this._mode = "new";
    },

    move(p, e){
      if(this._mode === "box"){ boxDragTo(p, e.shiftKey); scheduleOverlay(); return; }
      if(this._mode === "pathedit"){
        const l = this._editLayer;
        if(!l || !l.text.path) return;
        const np = { p0:[...l.text.path.p0], p1:[...l.text.path.p1], p2:[...l.text.path.p2] };
        np[this._pathHandle] = [p.x, p.y];
        noteStyleChange(l);
        updateText(l, { path: np });
        scheduleOverlay();
        return;
      }
      if(this._mode === "newpath"){
        if(!this._newPath) return;
        const p0 = this._newPath.p0;
        this._newPath = { p0, p1:[(p0[0] + p.x) / 2, (p0[1] + p.y) / 2], p2:[p.x, p.y] };
        scheduleOverlay();
        return;
      }
      if(!this._start) return;
      const dx = p.x - this._start.x, dy = p.y - this._start.y;
      if(!this._moved && Math.hypot(dx, dy) * view.zoom > 4) this._moved = true;
      if(!this._moved) return;

      if(this._mode === "text" && this._target && !this._target.locked){
        updateText(this._target, { x: Math.round(this._from.x + dx),
                                   y: Math.round(this._from.y + dy) });
        scheduleOverlay();
      } else if(this._mode === "new"){
        this._rect = { x: Math.min(this._start.x, p.x), y: Math.min(this._start.y, p.y),
                       w: Math.abs(dx), h: Math.abs(dy) };
        scheduleOverlay();
      }
    },

    up(e){
      const mode = this._mode, moved = this._moved, rect = this._rect;
      const start = this._start, newPath = this._newPath;
      this._mode = null; this._rect = null; this._start = null; this._newPath = null;

      if(mode === "pathedit"){
        this._editLayer = null; this._pathHandle = null;
        scheduleOverlay();
        return;
      }

      if(mode === "newpath"){
        if(newPath){
          const dist = Math.hypot(newPath.p2[0] - newPath.p0[0], newPath.p2[1] - newPath.p0[1]);
          if(dist > 20){
            const mx = (newPath.p0[0] + newPath.p2[0]) / 2, my = (newPath.p0[1] + newPath.p2[1]) / 2;
            const l = createTextLayer({ x: mx, y: my });
            pushTextStyle(l);
            updateText(l, { path: newPath });
            startEdit(l, true);
          } else {
            toast("Arrastra para trazar el texto sobre una curva");
          }
        }
        scheduleOverlay();
        return;
      }

      if(mode === "box"){
        endBoxDrag();
        // El marco y el cuerpo los acaba de cambiar el arrastre, no la
        // barra: hay que traer esos valores de vuelta a los mandos o el
        // siguiente ajuste los pisaría con los de antes.
        const l = activeLayer();
        if(isText(l)) pullTextStyle(l);
        scheduleOverlay();
        return;
      }

      if(mode === "text"){
        const l = this._target;
        if(!moved){ startEdit(l, false); return; }
        const from = this._from, to = { x: l.text.x, y: l.text.y };
        if(from.x !== to.x || from.y !== to.y){
          record("Mover texto",
            () => { updateText(l, from); emit("doc:structure"); },
            () => { updateText(l, to);   emit("doc:structure"); });
        }
        scheduleOverlay();
        return;
      }

      if(mode === "new"){
        // Un marco de menos de un renglón de alto no es un marco: es un
        // clic con pulso, y lo que se quería era un texto suelto.
        const box = moved && rect && rect.w > state.fontSize * 0.8
                                  && rect.h > state.fontSize * 0.6 ? rect : null;
        const at = box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : start;
        const l = createTextLayer(at || { x: doc.w / 2, y: doc.h / 2 });
        pushTextStyle(l);
        if(box){
          updateText(l, { boxW: Math.round(box.w), boxH: Math.round(box.h) });
          pullTextStyle(l);      // que los mandos reflejen el marco dibujado
        }
        startEdit(l, true);
        scheduleOverlay();
      }
    },
    cancel(){
      if(this._mode === "pathedit" && this._editLayer){
        // Deshace lo que la ráfaga en curso ya haya aplicado en vivo,
        // igual que un Cancelar de cualquier otro arrastre de esta app.
        if(styleBurst && styleBurst.layer === this._editLayer){
          clearTimeout(styleTimer); styleTimer = null;
          Object.assign(this._editLayer.text, styleBurst.before);
          renderTextLayer(this._editLayer);
          styleBurst = null;
          emit("doc:change");
        }
        this._mode = null; this._editLayer = null; this._pathHandle = null;
        scheduleOverlay();
        return;
      }
      this._mode = null; this._rect = null; this._start = null; this._newPath = null;
      scheduleOverlay();
    }
  },

  {
    id:"fill", name:"Bote de pintura", key:"g",
    icon: svg('<path d="M11 7 6 2"/><path d="M18.992 12H2.041"/><path d="M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595"/><path d="m8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33"/>'),
    cursor:"crosshair",
    rightClick:true,
    options:[
      {type:"color", key:"color", label:"Color"},
      {type:"range", key:"tolerance", label:"Tolerancia", min:0, max:120},
      {type:"range", key:"opacity", label:"Opacidad", min:1, max:100, unit:"%"},
      {type:"toggle", key:"contiguous", label:"Contiguo",
       title:"Sólo la mancha bajo el cursor; apagado, toda la imagen"}
    ],
    down(p){
      const l = requirePaintable();
      if(!l) return;
      if(p.x < 0 || p.y < 0 || p.x >= doc.w || p.y >= doc.h) return;
      beginPixels("Rellenar", l);
      const img = l.ctx.getImageData(0, 0, doc.w, doc.h);
      const hit = floodFill(img, p.x, p.y, hexToRgb(state.color),
                            state.tolerance, state.contiguous);
      if(!hit){ cancelPixelsSafe(); toast("Nada que rellenar ah\u00ed"); return; }
      if(state.opacity >= 100){
        l.ctx.putImageData(img, 0, 0);
      } else {
        // Con opacidad, el relleno va en una capa aparte y se funde
        const t = document.createElement("canvas");
        t.width = doc.w; t.height = doc.h;
        t.getContext("2d").putImageData(img, 0, 0);
        l.ctx.save();
        l.ctx.globalAlpha = state.opacity / 100;
        l.ctx.drawImage(t, 0, 0);
        l.ctx.restore();
      }
      l.thumbDirty = true;
      commitPixels();
      emit("doc:structure");
      scheduleCompose();
    }
  },

  {
    id:"gradient", name:"Degradado", key:"n",
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18M3 11h18M3 7h18" opacity=".45"/>'),
    cursor:"crosshair",
    options:[
      {type:"select", key:"gradKind", label:"Tipo", items:[
        ["linear","Lineal"],["radial","Radial"],["transparent","A transparente"]
      ]},
      {type:"color", key:"gradFrom", label:"Desde"},
      {type:"color", key:"gradTo", label:"Hasta"},
      {type:"range", key:"opacity", label:"Opacidad", min:1, max:100, unit:"%"}
    ],
    down(p){
      const l = requirePaintable();
      if(!l) return;
      if(getMaskTarget() === l.id && l.mask){
        // Igual mecanismo que Pincel/Borrador sobre la m\u00e1scara
        // (beginPixels con useMask), s\u00f3lo que aqu\u00ed adem\u00e1s hace falta
        // una copia aparte del estado de partida: cada fotograma del
        // arrastre repinta el degradado entero desde cero sobre esa
        // copia, no sobre lo que qued\u00f3 del fotograma anterior.
        beginPixels("Degradado en m\u00e1scara", l, true);
        this._maskBackup = cloneMask(l.mask);
        this._from = p;
        return;
      }
      beginPixels("Degradado", l);
      this._from = p;
      beginScratch(l);
    },
    _gradRedraw(to){
      const l = activeLayer();
      if(l && getMaskTarget() === l.id && l.mask && this._maskBackup){
        paintMaskGradient(l.mask, this._maskBackup, state.gradKind, this._from, to,
                           grayLevel(state.gradFrom), grayLevel(state.gradTo), state.opacity / 100);
        l.thumbDirty = true;
        scheduleCompose();
        return;
      }
      const c = scratchCtx();
      c.clearRect(0, 0, doc.w, doc.h);
      drawGradient(c, state.gradKind, this._from, to,
                   state.gradFrom, state.gradTo, state.opacity / 100);
      scheduleCompose();
    },
    move(p){
      if(!this._from) return;
      // A diferencia de un trazo de pincel, el degradado no tiene
      // memoria de posiciones intermedias: se recalcula entero desde
      // `_from` hasta el punto actual en cada fotograma, así que
      // colapsar varios eventos en uno solo (quedándose con el más
      // reciente) no deja huecos ni pierde nada del gesto — a
      // diferencia de Licuar, aquí no hace falta separar "estado" de
      // "redibujado": todo el trabajo es el redibujado. `up()` fuerza
      // un último redibujado síncrono con el punto exacto de soltar,
      // para no perder ese tramo final si quedaba un RAF pendiente.
      this._gradTo = p;
      if(this._gradPend) return;
      this._gradPend = true;
      requestAnimationFrame(() => {
        if(!this._gradPend) return;   // ya se forzó desde up()
        this._gradPend = false;
        if(!this._from) return;
        this._gradRedraw(this._gradTo);
      });
    },
    up(){
      if(!this._from) return;
      if(this._gradPend){ this._gradPend = false; this._gradRedraw(this._gradTo); }
      this._from = null;
      const l = activeLayer();
      if(l && getMaskTarget() === l.id && l.mask){
        this._maskBackup = null;
        commitPixels();
        emit("doc:structure");
        return;
      }
      endScratch(activeLayer());
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._from) return;
      this._from = null;
      this._gradPend = false;
      const l = activeLayer();
      if(l && getMaskTarget() === l.id && l.mask){
        this._maskBackup = null;
        abortPixels();
        scheduleCompose();
        return;
      }
      discardScratch();
      abortPixels();
    }
  },

  {
    id:"shape", name:"Formas", key:"u",
    icon: svg('<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>'),
    cursor:"crosshair",
    options:[
      {type:"select", key:"shapeKind", label:"Forma", rerender:true, items:[
        ["rect","Rect\u00e1ngulo"],["ellipse","Elipse"],["polygon","Polígono"],["star","Estrella"],["line","L\u00ednea"]
      ]},
      {type:"color", key:"fillColor", label:"Relleno"},
      {type:"toggle", key:"shapeFill", label:"R", title:"Rellenar"},
      {type:"color", key:"strokeColor", label:"Borde"},
      {type:"toggle", key:"shapeStroke", label:"B", title:"Trazar el borde"},
      {type:"number", key:"lineWidth", label:"Grosor", min:1, max:200, unit:"px", width:54},
      {type:"number", key:"shapeRadius", label:"Radio", min:0, max:999, unit:"px", width:54,
       showIf:() => state.shapeKind === "rect"},
      {type:"number", key:"shapeSides", label:"Lados", min:3, max:20, width:48,
       showIf:() => state.shapeKind === "polygon" || state.shapeKind === "star"},
      {type:"number", key:"shapeInner", label:"Interior", min:5, max:95, unit:"%", width:48,
       showIf:() => state.shapeKind === "star"},
      {type:"toggle", key:"shapeShadow", label:"Sombra", title:"Añadir sombra editable",
       showIf:() => state.shapeKind !== "line"},
      {type:"range", key:"opacity", label:"Opacidad", min:1, max:100, unit:"%",
       showIf:() => state.shapeKind === "line"}
    ],
    /* Rect\u00e1ngulo y elipse crean una CAPA de forma \u2014vectorial, editable
       despu\u00e9s: si la capa activa ya es una forma del mismo tipo y el
       clic cae dentro o sobre una de sus asas, este mismo down() la
       EDITA en vez de dibujar una nueva encima. L\u00ednea, en cambio, sigue
       pintando p\u00edxeles fijos en la capa activa como siempre \u2014no hay
       \u00abcapa de l\u00ednea\u00bb en este primer alcance\u2014. */
    activate(){ setOverlay(drawShapeToolOverlay); },
    deactivate(){ setOverlay(null); this._mode = null; this._newRect = null; this._editLayer = null; },
    down(p, e){
      if(state.shapeKind === "line"){
        const l = requirePaintable();
        if(!l) return;
        beginPixels("Forma", l);
        this._from = p;
        beginScratch(l);
        return;
      }
      const active = activeLayer();
      if(active && isShapeLayer(active) && active.shape.kind === state.shapeKind){
        const s = active.shape;
        const onRadius = shapeRadiusHandleAt(p, s);
        const onHandle = shapeHandleAt(p, s);
        if(onRadius || onHandle || inRect(p, s)){
          if(active.locked){ toast("La capa est\u00e1 bloqueada"); return; }
          this._mode = onRadius ? "radius" : (onHandle || "move");
          this._editLayer = active;
          this._editBefore = JSON.parse(JSON.stringify(s));
          this._from = p;
          return;
        }
      }
      this._mode = "new";
      this._from = p;
      this._newRect = { x:p.x, y:p.y, w:0, h:0 };
      scheduleOverlay();
    },
    move(p, e){
      if(state.shapeKind === "line"){
        if(!this._from) return;
        const c = scratchCtx();
        c.clearRect(0, 0, doc.w, doc.h);
        drawShape(c, "line", this._from, p, {
          fill: state.fillColor, stroke: state.strokeColor, lineWidth: state.lineWidth,
          fillOn: state.shapeFill, strokeOn: state.shapeStroke,
          opacity: state.opacity / 100, shift: e && e.shiftKey
        });
        scheduleCompose();
        return;
      }
      if(this._mode === "new"){
        let x = Math.min(this._from.x, p.x), y = Math.min(this._from.y, p.y);
        let w = Math.abs(p.x - this._from.x), h = Math.abs(p.y - this._from.y);
        if(e && e.shiftKey){
          const sMax = Math.max(w, h);
          if(p.x < this._from.x) x = this._from.x - sMax;
          if(p.y < this._from.y) y = this._from.y - sMax;
          w = h = sMax;
        }
        this._newRect = { x, y, w, h };
        scheduleOverlay();
        return;
      }
      if(this._mode && this._editLayer){
        previewShapeParams(this._editLayer, resizeShape(this._mode, p, this._from, this._editBefore));
        scheduleOverlay();
      }
    },
    up(){
      if(state.shapeKind === "line"){
        if(!this._from) return;
        this._from = null;
        endScratch(activeLayer());
        commitPixels();
        emit("doc:structure");
        return;
      }
      if(this._mode === "new"){
        const r = this._newRect;
        this._mode = null; this._newRect = null;
        if(r && r.w >= 2 && r.h >= 2){
          const l = addShapeLayer(state.shapeKind, {
            x:r.x, y:r.y, w:r.w, h:r.h,
            fillColor: state.fillColor, strokeColor: state.strokeColor
          });
          l.shape.radius = state.shapeKind === "rect" ? (state.shapeRadius || 0) : 0;
          l.shape.sides = state.shapeSides || 5;
          l.shape.inner = state.shapeInner || 50;
          l.shape.fill.on = !!state.shapeFill;
          l.shape.stroke.on = !!state.shapeStroke;
          l.shape.stroke.width = state.lineWidth;
          l.shape.shadow.on = !!state.shapeShadow;
          renderShapeLayer(l);
          emit("doc:change"); emit("doc:structure");
        }
        scheduleOverlay();
        return;
      }
      if(this._mode && this._editLayer){
        setShapeParams(this._editLayer, this._editBefore, this._editLayer.shape);
      }
      this._mode = null; this._editLayer = null; this._editBefore = null;
      scheduleOverlay();
    },
    cancel(){
      if(state.shapeKind === "line"){
        if(!this._from) return;
        this._from = null;
        discardScratch();
        abortPixels();
        return;
      }
      if(this._mode === "new"){ this._mode = null; this._newRect = null; scheduleOverlay(); return; }
      if(this._mode && this._editLayer && this._editBefore) previewShapeParams(this._editLayer, this._editBefore);
      this._mode = null; this._editLayer = null; this._editBefore = null;
      scheduleOverlay();
    }
  },

  {
    id:"clone", name:"Clonar", key:"s",
    icon: svg('<path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/><path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"/><path d="M5 22h14"/>'),
    cursor:"none",
    options:[
      {type:"range", key:"size", label:"Tama\u00f1o", min:1, max:400, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"opacity", label:"Opacidad", min:1, max:100, unit:"%"},
      {type:"button", label:"Fijar origen", cmd:"clone.pickSource",
       title:"El próximo toque o clic fija el punto de origen (lo mismo que Alt+clic)"},
      {type:"button", label:"Olvidar origen", cmd:"clone.reset"}
    ],
    activate(){ setOverlay(drawCloneCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      /* Alt fija el origen; sin origen no hay nada que clonar, y es la
         confusión más habitual con esta herramienta en cualquier
         editor, así que se dice en voz alta. */
      /* En una pantalla táctil no hay tecla Alt: ahí el origen se fija
         con el botón «Fijar origen» de la barra de opciones o, si aún
         no hay ninguno, con el primer toque. Sin esto, Clonar (y
         «Parche», que abre esta misma herramienta) no tenían forma de
         usarse en un móvil. */
      const touch = e && e.pointerType && e.pointerType !== "mouse";
      if((e && e.altKey) || state.clonePick || (touch && !state.cloneSrc)){
        state.cloneSrc = { x: p.x, y: p.y };
        state.cloneOffset = null;
        state.clonePick = false;
        toast(touch ? "Origen fijado. Ahora pinta con el dedo donde quieras copiarlo."
                    : "Origen fijado. Ahora pinta donde quieras copiarlo.");
        return;
      }
      if(!state.cloneSrc){
        toast("Mant\u00e9n Alt y haz clic (o pulsa «Fijar origen») para fijar el origen primero");
        return;
      }
      if(!state.cloneOffset)
        state.cloneOffset = { x: p.x - state.cloneSrc.x, y: p.y - state.cloneSrc.y };
      beginPixels("Clonar", l);
      this._snap = document.createElement("canvas");
      this._snap.width = doc.w; this._snap.height = doc.h;
      this._snap.getContext("2d").drawImage(l.canvas, 0, 0);
      this._last = p;
      this.stamp(p, pressureScale(e));
    },
    stamp(p, scale){
      const l = activeLayer();
      const off = state.cloneOffset;
      cloneStamp(l.ctx, this._snap, p.x - off.x, p.y - off.y, p.x, p.y,
                 state.size / 2 * (scale || 1), state.hardness, state.opacity / 100);
      l.thumbDirty = true;
    },
    move(p, e){
      if(!this._last) return;
      const scale = pressureScale(e);
      const step = Math.max(1, state.size * 0.12);
      const dist = Math.hypot(p.x - this._last.x, p.y - this._last.y);
      const n = Math.max(1, Math.ceil(dist / step));
      for(let i = 1; i <= n; i++){
        const t = i / n;
        this.stamp({ x: this._last.x + (p.x - this._last.x) * t,
                     y: this._last.y + (p.y - this._last.y) * t }, scale);
      }
      this._last = p;
      scheduleCompose();
    },
    up(){
      if(!this._last) return;
      this._last = null; this._snap = null;
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._last) return;
      this._last = null; this._snap = null;
      abortPixels();
    }
  },

  {
    id:"expose", name:"Exponer", key:"o",
    icon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M3 12h1"/><path d="M20 12h1"/><path d="m18.364 5.636-.707.707"/><path d="m6.343 17.657-.707.707"/><path d="m5.636 5.636.707.707"/><path d="m17.657 17.657.707.707"/>'),
    cursor:"none",
    options:[
      {type:"segment", key:"exposeMode", items:[
        ["dodge","\u2600","Sobreexponer: aclarar"],
        ["burn","\u25D0","Subexponer: oscurecer"],
        ["spongeSat","S+","Esponja: saturar"],
        ["spongeDesat","S−","Esponja: desaturar"]
      ]},
      {type:"select", key:"exposeRange", label:"Zona", items:[
        ["shadows","Sombras"],["mid","Medios"],["highlights","Luces"]
      ]},
      {type:"range", key:"size", label:"Tama\u00f1o", min:1, max:400, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"strength", label:"Fuerza", min:1, max:100, unit:"%"}
    ],
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      const label=state.exposeMode === "dodge" ? "Sobreexponer" : state.exposeMode === "burn" ? "Subexponer" : "Esponja";
      beginPixels(label, l);
      this._last = p;
      this._carry = 0;
      dodgeBurn(l.ctx, p.x, p.y, state.size/2 * pressureScale(e), state.hardness,
                state.strength, state.exposeMode, state.exposeRange);
      scheduleCompose();
    },
    move(p, e){
      if(!this._last) return;
      const l = activeLayer();
      const scale = pressureScale(e);
      const step = Math.max(1, state.size * 0.2);
      const { points, carry } = spacedSteps(this._last.x, this._last.y, p.x, p.y, step, this._carry);
      for(const pt of points){
        dodgeBurn(l.ctx, pt.x, pt.y, state.size/2 * scale, state.hardness,
                  state.strength, state.exposeMode, state.exposeRange);
      }
      this._carry = carry;
      this._last = p;
      l.thumbDirty = true;
      scheduleCompose();
    },
    up(){
      if(!this._last) return;
      this._last = null;
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._last) return;
      this._last = null;
      abortPixels();
    }
  },

  {
    // Sin tecla suelta propia: las 26 letras ya están repartidas entre
    // el resto de herramientas (más A de Pluma) y D/X quedan
    // reservadas para restablecer/intercambiar los colores frontal y
    // fondo — asignarle "d" haría las dos cosas a la vez sin que
    // ninguna se pueda evitar. Se activa desde el menú Filtro o con
    // Ctrl+Mayús+D.
    id:"dodgeburn", name:"Dodge & Burn (gris 50%)",
    icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'),
    cursor:"none",
    options:[
      {type:"segment", key:"dbMode", items:[
        ["dodge","☀","Aclarar (dodge)"],
        ["burn","◐","Oscurecer (burn)"]
      ]},
      {type:"range", key:"size", label:"Tamaño", min:1, max:400, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"strength", label:"Exposición", min:1, max:100, unit:"%"},
      {type:"toggle", key:"dbShowGray", label:"Ver gris 50 %",
       title:"Muestra la capa gris tal cual, en tiempo real, para ver dónde has aclarado y oscurecido"},
      {type:"button", label:"Nueva capa gris", cmd:"dodgeburn.newLayer"}
    ],
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      let l = ensureDodgeBurnLayer();
      if(!l || l.locked){ toast("La capa está bloqueada"); return; }
      beginPixels(state.dbMode === "dodge" ? "Dodge" : "Burn", l);
      const c = beginScratch(l, { alpha: state.strength / 100 });
      this._last = p;
      dbDab(c, p, p, state.dbMode === "dodge" ? "#ffffff" : "#000000", pressureScale(e));
    },
    move(p, e){
      if(!this._last) return;
      dbDab(scratchCtx(), this._last, p, state.dbMode === "dodge" ? "#ffffff" : "#000000", pressureScale(e));
      this._last = p;
      scheduleCompose();
      if(state.dbShowGray) scheduleOverlay();
    },
    up(){
      if(!this._last) return;
      this._last = null;
      endScratch(activeLayer());
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._last) return;
      this._last = null;
      discardScratch();
      abortPixels();
    }
  },

  {
    // Sin tecla suelta propia, por el mismo motivo que Dodge & Burn
    // (arriba): las 26 letras ya están repartidas. Ctrl+Mayús+H, o el
    // panel Historial.
    id:"historyBrush", name:"Pincel de historial",
    icon: svg('<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9l6 3"/><path d="M20 3v4h-4"/>'),
    cursor:"none",
    options:[
      {type:"range", key:"size", label:"Tamaño", min:1, max:400, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"opacity", label:"Opacidad", min:1, max:100, unit:"%"}
    ],
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      const src = brushSourceLayerFor(l.id);
      if(!src){
        toast("Elige antes una instantánea como origen, en el panel Historial", "err");
        return;
      }
      if(src.canvas.width !== l.canvas.width || src.canvas.height !== l.canvas.height){
        toast("La instantánea de origen es de otro tamaño de documento: vuelve a ella o elige otra", "err");
        return;
      }
      beginPixels("Pincel de historial", l);
      const c = beginScratch(l, { alpha: state.opacity / 100 });
      this._last = p;
      this._src = src.canvas;
      historyDab(c, p, p, this._src, pressureScale(e));
    },
    move(p, e){
      if(!this._last || !this._src) return;
      historyDab(scratchCtx(), this._last, p, this._src, pressureScale(e));
      this._last = p;
      scheduleCompose();
    },
    up(){
      if(!this._last) return;
      this._last = null; this._src = null;
      endScratch(activeLayer());
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._last) return;
      this._last = null; this._src = null;
      discardScratch();
      abortPixels();
    }
  },

  {
    id:"smudge", name:"Emborronar", key:"r",
    icon: svg('<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>'),
    cursor:"none",
    options:[
      {type:"range", key:"size", label:"Tama\u00f1o", min:2, max:300, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"strength", label:"Fuerza", min:1, max:100, unit:"%"}
    ],
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      beginPixels("Emborronar", l);
      /* El radio queda fijo para todo el trazo: el buffer que arrastra
         el color tiene ese tama\u00f1o desde el primer instante, y
         cambiarlo a mitad de camino romper\u00eda la continuidad. */
      this._sm = makeSmudge(l.ctx, state.size/2 * pressureScale(e), state.hardness, state.strength);
      this._sm.step(p.x, p.y);
      this._last = p;
    },
    move(p){
      if(!this._sm) return;
      const l = activeLayer();
      const step = Math.max(1, state.size * 0.14);
      const dist = Math.hypot(p.x - this._last.x, p.y - this._last.y);
      const n = Math.max(1, Math.ceil(dist / step));
      for(let i = 1; i <= n; i++){
        const t = i / n;
        this._sm.step(this._last.x + (p.x - this._last.x) * t,
                      this._last.y + (p.y - this._last.y) * t);
      }
      this._last = p;
      l.thumbDirty = true;
      scheduleCompose();
    },
    up(){
      if(!this._sm) return;
      this._sm = null; this._last = null;
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._sm) return;
      this._sm = null; this._last = null;
      abortPixels();
    }
  },

  {
    id:"transform", name:"Transformación libre", key:"f",
    icon: svg('<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="2.5 2.5"/><path d="M4 4 8 8M20 4l-4 4M4 20l4-4M20 20l-4-4"/>'),
    cursor:"default",
    options:[
      {type:"segment", key:"xfMode", label:"Modo", rerender:true, items:[
        ["free","Libre","Escala, gira, sesga y mueve con tiradores"],
        ["warp","Deformar","Rejilla de puntos que se arrastran uno a uno"]
      ]},
      {type:"number", key:"xfW", label:"Ancho", min:1, max:1000, unit:"%", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"number", key:"xfH", label:"Alto", min:1, max:1000, unit:"%", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"toggle", key:"xfProportional", label:"⛓", title:"Ancho y alto proporcionales (o mantén Mayús al arrastrar una esquina)",
       showIf:() => state.xfMode === "free"},
      {type:"number", key:"xfAngle", label:"Ángulo", min:-180, max:180, unit:"°", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"number", key:"xfSkewX", label:"Sesgo H", min:-85, max:85, unit:"°", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"number", key:"xfSkewY", label:"Sesgo V", min:-85, max:85, unit:"°", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"button", label:"Voltear H", cmd:"transform.flipH", showIf:() => state.xfMode === "free"},
      {type:"button", label:"Voltear V", cmd:"transform.flipV", showIf:() => state.xfMode === "free"},
      {type:"static", label:"Arrastra un punto de la rejilla para doblar la capa; arrastra dentro para moverla entera.",
       showIf:() => state.xfMode === "warp"},
      {type:"button", label:"Restablecer", cmd:"transform.reset"},
      {type:"button", label:"Aplicar", cmd:"transform.apply", primary:true},
      {type:"button", label:"Cancelar", cmd:"transform.cancel"}
    ],
    activate(){
      xformBegin();
      if(!xformArmed()) return;
      syncXformFields();
      setOverlay(drawXformOverlay);
      scheduleOverlay();
    },
    /* Cambiar de herramienta a media transformación no debe tirarla:
       eso es justo lo que hacía antes de este cambio, y es la manera
       más fácil de perder un arrastre entero sin querer con un solo
       clic en otro icono. Como al terminar de verdad («Aplicar») lo
       normal es seguir con Mover para ver el resultado, tocar
       cualquier otra herramienta se comporta igual que Aplicar; sólo
       Cancelar (o Esc) descarta de verdad. Sin cambios de por medio
       —abrir la herramienta y cambiar de opinión sin tocar nada— sigue
       sin dejar rastro en el historial: xformApply() ya se niega en
       silencio salvo que haya algo real que confirmar. */
    deactivate(){
      if(!forceDiscard && xformHasChange()) xformApply();
      else { xformRestore(); xformEnd(); }
      setOverlay(null);
      scheduleCompose();
    },
    down(p, e){ xformDown(p, e); },
    move(p, e){ xformMove(p, e); syncXformFields(); },
    up(){ xformUp(); },
    cancel(){ xformCancel(); }
  },

  {
    id:"perspective", name:"Perspectiva", key:"p",
    icon: svg('<path d="M3 5 16 2l5 4-2 15-17 2Z"/><path d="M3 5 21 6M8 22 16 2" opacity=".5"/>'),
    cursor:"crosshair",
    options:[
      {type:"segment", key:"perspMode", label:"Modo", rerender:true, items:[
        ["guides","Guías","Traza sobre la foto lo que debería estar recto"],
        ["corners","Esquinas","Arrastra las cuatro esquinas"],
        ["edges","Bordes","Estira un lado entero"],
        ["adjust","Ajustes","Trapecio, giro y escala con deslizadores"]
      ]},
      /* Sin esta pista el modo Guías no se descubre solo: la barra
         enseña un botón de borrar guías que aún no existen y el lienzo
         no tiene tiradores, así que no hay nada que invite a trazar. */
      {type:"static", label:"Traza sobre lo que debería estar recto: el horizonte, un canto vertical. Toca una guía para borrarla.",
       showIf:() => state.perspMode === "guides"},
      {type:"button", label:"Borrar guías", cmd:"perspective.clear",
       showIf:() => state.perspMode === "guides"},
      {type:"range", key:"perspVert", label:"Vertical", min:-100, max:100,
       showIf:() => state.perspMode === "adjust"},
      {type:"range", key:"perspHorz", label:"Horizontal", min:-100, max:100,
       showIf:() => state.perspMode === "adjust"},
      {type:"range", key:"perspRot", label:"Giro", min:-45, max:45, unit:"°",
       showIf:() => state.perspMode === "adjust"},
      {type:"range", key:"perspScale", label:"Escala", min:20, max:300, unit:"%",
       showIf:() => state.perspMode === "adjust"},
      {type:"toggle", key:"perspGrid", label:"Rejilla",
       title:"Rejilla de referencia recta contra la que comparar"},
      {type:"button", label:"Rellenar", cmd:"perspective.fill",
       title:"Amplía lo justo para tapar las cuñas transparentes"},
      {type:"button", label:"Restablecer", cmd:"perspective.reset"},
      {type:"button", label:"Aplicar", cmd:"perspective.apply", primary:true},
      {type:"button", label:"Cancelar", cmd:"perspective.cancel"}
    ],
    activate(){
      perspBegin();
      syncPersp();
      setOverlay(drawPerspOverlay);
      scheduleOverlay();
    },
    /* Mismo criterio que en Transformación libre: cambiar de
       herramienta a medio enderezar aplica la corrección en vez de
       tirarla; perspApply() ya no hace nada si el cuadrilátero sigue
       siendo el original. */
    deactivate(){
      if(!forceDiscard && perspHasChange()) perspApply();
      else { perspRestore(); perspEnd(); }
      setOverlay(null);
      scheduleCompose();
    },
    down(p){ perspDown(p); },
    move(p){ perspMove(p); },
    up(){ perspUp(); },
    cancel(){ perspCancel(); }
  },

  {
    id:"heal", name:"Eliminar manchas", key:"j",
    icon: svg('<path d="M10 10.01h.01"/><path d="M10 14.01h.01"/><path d="M14 10.01h.01"/><path d="M14 14.01h.01"/><path d="M18 6v12"/><path d="M6 6v12"/><rect x="2" y="6" width="20" height="12" rx="2"/>'),
    cursor:"none",
    options:[
      {type:"range", key:"size", label:"Tamaño", min:3, max:300, unit:"px"},
      {type:"segment", key:"healSample", label:"Muestra", items:[
        ["layer", "Capa", "Sólo la capa activa"],
        ["all",   "Todas", "Todas las capas visibles, compuestas —el trazo se sigue pintando en la capa activa"]
      ]}
    ],
    // Compuesto una sola vez al empezar el trazo, no en cada
    // `move()`: recomponer el documento entero a cada movimiento del
    // pincel sería tirar tiempo, y cambiar otra capa a media
    // pincelada es un caso raro que puede esperar al siguiente trazo.
    _sampleCtx(){
      if(state.healSample !== "all") return null;
      if(!this._sampleCanvas) this._sampleCanvas = flatten(null, doc.layers, doc.w, doc.h);
      return this._sampleCanvas.getContext("2d", { willReadFrequently: true });
    },
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      beginPixels("Eliminar manchas", l);
      this._last = p;
      this._sampleCanvas = null;   // recompón la composición para este trazo nuevo
      healSpot(l.ctx, p.x, p.y, state.size/2 * pressureScale(e), this._sampleCtx());
      l.thumbDirty = true;
      scheduleCompose();
    },
    move(p, e){
      if(!this._last) return;
      const l = activeLayer();
      const scale = pressureScale(e);
      const step = Math.max(1, state.size * 0.3);
      const dist = Math.hypot(p.x - this._last.x, p.y - this._last.y);
      const n = Math.max(1, Math.ceil(dist / step));
      const sampleCtx = this._sampleCtx();
      for(let i = 1; i <= n; i++){
        const t = i / n;
        healSpot(l.ctx,
          this._last.x + (p.x - this._last.x) * t,
          this._last.y + (p.y - this._last.y) * t,
          state.size/2 * scale, sampleCtx);
      }
      this._last = p;
      l.thumbDirty = true;
      scheduleCompose();
    },
    up(){
      if(!this._last) return;
      this._last = null;
      commitPixels();
      emit("doc:structure");
    },
    cancel(){
      if(!this._last) return;
      this._last = null;
      abortPixels();
    }
  },

  {
    /* Sin letra propia: la X es la de intercambiar colores frontal y de
       fondo (main.js), como en Photoshop, y con las dos a la vez una
       sola pulsación cambiaba de herramienta Y daba la vuelta a los
       colores. Se llega desde Selección > Mover según el contenido. */
    id:"camove", name:"Mover según el contenido",
    icon: svg('<path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20" stroke-dasharray="2.5 2.5"/>'),
    cursor:"move",
    options:[],
    // El propio arrastre no toca la capa —sólo un dibujo aparte en el
    // overlay, encima del lienzo—: la capa real se mueve de una vez,
    // ya con el hueco relleno, al soltar. Así un arrastre que se
    // cancela a medias (Esc, o soltar fuera del lienzo) no deja nada
    // que deshacer.
    activate(){ setOverlay(drawCAMoveOverlay); },
    deactivate(){ setOverlay(null); this._cam = null; },
    down(p){
      if(!doc.selection){ toast("Selecciona primero lo que quieras mover"); return; }
      const l = requirePaintable();
      if(!l) return;
      const bounds = boundsOf(doc.selection.mask, doc.w, doc.h);
      if(!bounds){ toast("La selección está vacía"); return; }
      const mx = Math.round(p.x), my = Math.round(p.y);
      if(mx < 0 || my < 0 || mx >= doc.w || my >= doc.h || doc.selection.mask[my*doc.w+mx] < 20){
        toast("Arrastra desde dentro de la selección"); return;
      }

      // Vista previa: sólo el contenido seleccionado, con su propia
      // máscara como alfa, para que el overlay muestre la pieza suelta
      // tal como quedaría —no un rectángulo entero—.
      const float = document.createElement("canvas");
      float.width = bounds.w; float.height = bounds.h;
      const fx = float.getContext("2d");
      fx.drawImage(l.canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
      const fImg = fx.getImageData(0, 0, bounds.w, bounds.h);
      for(let y = 0; y < bounds.h; y++) for(let x = 0; x < bounds.w; x++){
        fImg.data[(y*bounds.w+x)*4+3] = doc.selection.mask[(bounds.y+y)*doc.w + (bounds.x+x)];
      }
      fx.putImageData(fImg, 0, 0);

      this._cam = { layer:l, bounds, from:p, dx:0, dy:0, float };
    },
    move(p){
      if(!this._cam) return;
      this._cam.dx = Math.round(p.x - this._cam.from.x);
      this._cam.dy = Math.round(p.y - this._cam.from.y);
      scheduleOverlay();
    },
    up(){
      if(!this._cam) return;
      const cam = this._cam;
      this._cam = null;
      scheduleOverlay();
      if(!cam.dx && !cam.dy) return;   // un clic sin arrastre no mueve nada
      moveContentAware(cam.layer, doc.selection.mask, cam.bounds, cam.dx, cam.dy);
    },
    cancel(){ this._cam = null; scheduleOverlay(); }
  },

  {
    id:"select-rect", name:"Selección rectangular", key:"m",
    icon: svg('<rect x="3" y="4" width="18" height="16" rx="1" stroke-dasharray="3 2.5"/>'),
    cursor:"crosshair",
    options:[
      {type:"button", label:"Difuminar…", cmd:"sel.feather"},
      {type:"button", label:"Invertir", cmd:"sel.invert"},
      {type:"button", label:"Deseleccionar", cmd:"sel.none"}
    ],
    activate(){ setOverlay(drawSelectionOverlay); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      this._layerCand = otherLayersEdgeCandidates(doc.layers, null);
      this._start = snapSelectionPoint(p, this._layerCand);
      this._rect = { x:this._start.x, y:this._start.y, w:0, h:0 };
      this._mode = selModifier(e);
    },
    move(p){
      if(!this._start) return;
      const sp = snapSelectionPoint(p, this._layerCand);
      this._rect = normRect(this._start, sp);
      this._snapX = sp.snapX; this._snapY = sp.snapY;
      scheduleOverlay();
    },
    up(){
      if(!this._start) return;
      const r = this._rect;
      commitSelection(maskFromRect(doc.w, doc.h, r.x, r.y, r.w, r.h), this._mode);
      this._start = null; this._rect = null; this._snapX = null; this._snapY = null;
      scheduleOverlay();
    },
    cancel(){ this._start = null; this._rect = null; this._snapX = null; this._snapY = null; scheduleOverlay(); }
  },

  {
    id:"select-ellipse", name:"Selección elíptica", key:"k",
    icon: svg('<ellipse cx="12" cy="12" rx="9" ry="7" stroke-dasharray="3 2.5"/>'),
    cursor:"crosshair",
    options:[
      {type:"button", label:"Difuminar…", cmd:"sel.feather"},
      {type:"button", label:"Invertir", cmd:"sel.invert"},
      {type:"button", label:"Deseleccionar", cmd:"sel.none"}
    ],
    activate(){ setOverlay(drawSelectionOverlay); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      this._layerCand = otherLayersEdgeCandidates(doc.layers, null);
      this._start = snapSelectionPoint(p, this._layerCand);
      this._rect = { x:this._start.x, y:this._start.y, w:0, h:0 };
      this._mode = selModifier(e);
    },
    move(p){
      if(!this._start) return;
      const sp = snapSelectionPoint(p, this._layerCand);
      this._rect = normRect(this._start, sp);
      this._snapX = sp.snapX; this._snapY = sp.snapY;
      scheduleOverlay();
    },
    up(){
      if(!this._start) return;
      const r = this._rect;
      commitSelection(maskFromEllipse(doc.w, doc.h, r.x + r.w/2, r.y + r.h/2, r.w/2, r.h/2), this._mode);
      this._start = null; this._rect = null; this._snapX = null; this._snapY = null;
      scheduleOverlay();
    },
    cancel(){ this._start = null; this._rect = null; this._snapX = null; this._snapY = null; scheduleOverlay(); }
  },

  {
    id:"select-lasso", name:"Lazo", key:"l",
    icon: svg('<path d="M6 14c-2 0-3-2-2-4 1-3 4-6 8-6s7 2 7 5-3 4-6 4c-3 0-4 1-4 3s2 3 4 2" stroke-dasharray="3 2.5"/>'),
    cursor:"crosshair",
    options:[
      {type:"button", label:"Difuminar…", cmd:"sel.feather"},
      {type:"button", label:"Invertir", cmd:"sel.invert"},
      {type:"button", label:"Deseleccionar", cmd:"sel.none"}
    ],
    activate(){ setOverlay(drawSelectionOverlay); },
    deactivate(){ setOverlay(null); },
    down(p, e){ this._pts = [p]; this._mode = selModifier(e); },
    move(p){
      if(!this._pts) return;
      const last = this._pts[this._pts.length - 1];
      // No merece la pena guardar un punto por cada evento del ratón:
      // uno cada pocos píxeles ya describe el trazo igual de bien y
      // el polígono no se dispara a miles de vértices.
      if(Math.hypot(p.x - last.x, p.y - last.y) < 2.5 / view.zoom) return;
      this._pts.push(p);
      scheduleOverlay();
    },
    up(){
      if(!this._pts) return;
      commitSelection(maskFromPolygon(doc.w, doc.h, this._pts), this._mode);
      this._pts = null;
      scheduleOverlay();
    },
    cancel(){ this._pts = null; scheduleOverlay(); }
  },

  {
    id:"select-wand", name:"Varita mágica", key:"w",
    icon: svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>'),
    cursor:"crosshair",
    options:[
      {type:"range", key:"tolerance", label:"Tolerancia", min:0, max:120},
      {type:"toggle", key:"contiguous", label:"Contiguo",
       title:"Sólo la mancha bajo el cursor; apagado, todo el color parecido de la capa"},
      {type:"button", label:"Difuminar…", cmd:"sel.feather"},
      {type:"button", label:"Invertir", cmd:"sel.invert"},
      {type:"button", label:"Deseleccionar", cmd:"sel.none"}
    ],
    activate(){ setOverlay(drawSelectionOverlay); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = activeLayer();
      if(!l || p.x < 0 || p.y < 0 || p.x >= doc.w || p.y >= doc.h) return;
      const img = l.ctx.getImageData(0, 0, doc.w, doc.h);
      const mask = maskFromWand(img, p.x, p.y, state.tolerance, state.contiguous);
      commitSelection(mask, selModifier(e));
    }
  },

  {
    id:"pen", name:"Pluma", key:"a",
    icon: svg('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
    cursor:"crosshair",
    options:[
      {type:"button", label:"Cerrar trazado", cmd:"pen.close"},
      {type:"button", label:"Selección", cmd:"pen.toSelection", primary:true},
      {type:"button", label:"Máscara", cmd:"pen.toMask"},
      {type:"button", label:"Deshacer último punto", cmd:"pen.undoPoint"},
      {type:"button", label:"Cancelar", cmd:"pen.cancel"}
    ],
    activate(){ penBegin(); setOverlay(drawPenOverlay); },
    deactivate(){ penEnd(); setOverlay(null); },
    down(p, e){ penDown(p, e); },
    move(p, e){ penMove(p, e); },
    up(){ penUp(); },
    cancel(){ penCancel(); }
  },

  {
    id:"picker", name:"Cuentagotas", key:"i",
    icon: svg('<path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/><path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"/><path d="m2 22 .414-.414"/>'),
    cursor:"crosshair",
    /* Con el botón derecho, toma el color para el fondo en vez del
       frontal: igual que en Photoshop. */
    rightClick:true,
    options:[{type:"color", key:"color", label:"Color"}],
    down(p){
      const c = pickColor(p.x, p.y);
      if(!c || c.a === 0) return;
      state.color = "#" + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, "0")).join("");
      emit("tool:options");
      toast("Color " + state.color);
    }
  },

  {
    /* En Q, no en X: X queda libre para el atajo de intercambiar
       frontal/fondo (ver swapColors en main.js), igual que en
       Photoshop. */
    id:"liquify", name:"Licuar", key:"q",
    icon: svg('<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>'),
    cursor:"none",
    options:[
      {type:"segment", key:"liqMode", items:[
        ["push","↝","Empujar: arrastra en la dirección del gesto"],
        ["pinch","◐","Fruncir: encoge hacia el centro del pincel"],
        ["bloat","◑","Hinchar: expande desde el centro del pincel"],
        ["twirl","⟲","Remolino: gira alrededor del centro del pincel"]
      ]},
      {type:"range", key:"liqSize", label:"Tamaño", min:10, max:600, unit:"px"},
      {type:"range", key:"liqStrength", label:"Fuerza", min:1, max:100, unit:"%"},
      {type:"range", key:"liqVolume", label:"Conservar volumen", min:0, max:100, unit:"%"},
      {type:"button", label:"Restablecer", cmd:"liquify.reset"}
    ],
    activate(){ setOverlay(drawLiquifyCursor); },
    deactivate(){ setOverlay(null); liqSessionEnd(); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      liqSessionBegin(l);
      this._backup = liqGridSnapshot();
      this._last = p;
      beginPixels("Licuar", l);
    },
    move(p, e){
      if(!this._last) return;
      const l = activeLayer();
      liqSessionStroke(l, this._last, p);   // barato: en todos los eventos, sin perder ninguno
      this._last = p;
      l.thumbDirty = true;
      if(liqPend) return;
      liqPend = true;
      requestAnimationFrame(() => {         // caro: colapsado, como mucho una vez por fotograma
        liqPend = false;
        liqRedraw(l, false);
        scheduleCompose();
      });
    },
    up(){
      if(!this._last) return;
      this._last = null; this._backup = null;
      const l = activeLayer();
      // Redibujado final a resolución completa: el de arrastre pudo
      // haber sido sobre un proxy reducido, y lo que se guarda en el
      // historial no debe perder nitidez por eso.
      liqRedraw(l, true);
      l.thumbDirty = true;
      selfCommit = "liquify";
      commitPixels();
      selfCommit = null;
      emit("doc:structure");
      scheduleCompose();
    },
    cancel(){
      if(!this._last) return;
      this._last = null;
      liqSessionRestore(activeLayer(), this._backup);
      this._backup = null;
      abortPixels();
    }
  },

  {
    id:"compare", name:"Comparar", key:"y",
    icon: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>'),
    cursor:"ew-resize",
    options:[
      {type:"static", label:"Arrastra la línea: a la izquierda el original, a la derecha tu edición"},
      {type:"button", label:"Centrar", cmd:"compare.center"}
    ],
    activate(){
      if(doc.open && !cmpOriginal) cmpCapture();
      cmpActive = true;
      setOverlay(drawCompareOverlay);
      compose();
    },
    deactivate(){
      /* Apagar el flag ANTES de recomponer es lo que importa: al
         cambiar de herramienta, `setTool` llama a este `deactivate()`
         todavía con la comparación activa (reasigna `current` justo
         DESPUÉS). Si aquí se recompusiera con el flag encendido, ese
         último repintado seguiría recortando por la mitad, y como
         nada vuelve a recompensar tras el cambio, la división se
         quedaba pegada en pantalla con la herramienta Mover ya
         seleccionada -exactamente el fallo que cazó la prueba. */
      cmpActive = false;
      setOverlay(null);
      compose();
    },
    down(p){
      if(!doc.open) return;
      this._dragging = true;
      state.cmpSplit = Math.max(0, Math.min(1, p.x / doc.w));
      compose();
    },
    move(p){
      if(!this._dragging) return;
      state.cmpSplit = Math.max(0, Math.min(1, p.x / doc.w));
      compose();
    },
    up(){ this._dragging = false; },
    cancel(){ this._dragging = false; }
  }
];

/* ═══ selección ═══
   Cuatro herramientas, un único formato de salida: una máscara que se
   combina con la que hubiera. El modificador se lee UNA vez, al
   pulsar, y se queda fijo durante todo el arrastre —soltar Mayús a
   mitad de gesto no debe cambiar de opinión sobre qué se está
   haciendo—. */
function selModifier(e){
  if(!e) return "new";
  if(e.shiftKey && e.altKey) return "intersect";
  if(e.shiftKey) return "add";
  if(e.altKey) return "subtract";
  return "new";
}

function normRect(a, b){
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/* Ajusta la esquina que se está dibujando —de una selección nueva,
   punto suelto, no un rango ya hecho— contra guías, bordes y centro
   del documento, bordes y centros de otras capas, y la cuadrícula si
   su ajuste está activo. Se llama con el mismo `layerCand` los dos
   veces del gesto —al fijar la esquina de partida y en cada
   movimiento—, cacheado una sola vez al empezar el arrastre. */
function snapSelectionPoint(p, layerCand){
  const guides = { h: doc.guides.h, v: doc.guides.v };
  const gStep = snapToGridEnabled() ? gridStep() : 0;
  const x = snapValue(p.x, snapCandidatesX(doc.w, guides, layerCand.x), 6, view.zoom, gStep);
  const y = snapValue(p.y, snapCandidatesY(doc.h, guides, layerCand.y), 6, view.zoom, gStep);
  return { x, y, snapX: x !== p.x ? x : null, snapY: y !== p.y ? y : null };
}

/* La superposición de la selección tiene dos capas: el tinte de lo ya
   confirmado (`doc.selection`, si hay) y el contorno de lo que se esté
   arrastrando ahora mismo, que todavía no se ha combinado con nada.
   El tinte se cachea por referencia de máscara —`combineMask` y compañía
   siempre devuelven un array nuevo en vez de mutar el de antes—, así
   que mientras el usuario no confirme un cambio no hay que
   reconstruir el lienzo de color en cada fotograma. */
let tintCache = { mask: null, canvas: null };
function tintFor(sel){
  if(tintCache.mask === sel.mask) return tintCache.canvas;
  const c = document.createElement("canvas");
  c.width = sel.w; c.height = sel.h;
  const cx = c.getContext("2d");
  const img = cx.createImageData(sel.w, sel.h);
  for(let i = 0, p = 0; i < sel.mask.length; i++, p += 4){
    img.data[p] = 74; img.data[p+1] = 169; img.data[p+2] = 245;
    img.data[p+3] = Math.round(sel.mask[i] * 0.35);
  }
  cx.putImageData(img, 0, 0);
  tintCache = { mask: sel.mask, canvas: c };
  return c;
}

function drawSelectionOverlay(ctx){
  const px = 1 / view.zoom;
  if(doc.selection){
    ctx.drawImage(tintFor(doc.selection), 0, 0);
  }
  const t = current;
  const live = t.id === "select-rect" || t.id === "select-ellipse" ? t._rect
             : t.id === "select-lasso" ? t._pts
             : null;
  if(!live) return;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = px;
  ctx.setLineDash([5*px, 4*px]);
  ctx.beginPath();
  if(t.id === "select-rect"){
    ctx.rect(live.x, live.y, live.w, live.h);
  } else if(t.id === "select-ellipse"){
    ctx.ellipse(live.x + live.w/2, live.y + live.h/2,
                Math.max(0.01, live.w/2), Math.max(0.01, live.h/2), 0, 0, 6.2832);
  } else if(t.id === "select-lasso" && live.length > 1){
    ctx.moveTo(live[0].x, live[0].y);
    for(let i = 1; i < live.length; i++) ctx.lineTo(live[i].x, live[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if(t.id === "select-rect" || t.id === "select-ellipse") drawSnapLines(ctx, t._snapX, t._snapY);
}

/* Rectángulo de encuadre mientras se arrastra con la Lupa: mismo
   trazo de marcha de hormigas que la selección, sin el tinte, porque
   aquí no se está marcando nada del documento. */
function drawZoomOverlay(ctx){
  const t = current;
  if(t.id !== "zoom" || !t._rect) return;
  const r = t._rect;
  if(r.w < 1 || r.h < 1) return;
  const px = 1 / view.zoom;
  ctx.strokeStyle = "#e8a33d";
  ctx.lineWidth = px;
  ctx.setLineDash([5*px, 4*px]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
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
function drawSnapLines(ctx, snapX, snapY){
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

function drawMoveSnapOverlay(ctx){
  const t = current;
  if(t.id !== "move") return;
  drawSnapLines(ctx, t._snapX, t._snapY);
}

/* La pieza suelta de «Mover según el contenido», siguiendo el
   arrastre: sólo un dibujo por encima del lienzo, la capa real no se
   toca hasta soltar (ver la propia herramienta, más arriba). */
function drawCAMoveOverlay(ctx){
  const t = current;
  if(t.id !== "camove" || !t._cam) return;
  const cam = t._cam;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.drawImage(cam.float, cam.bounds.x + cam.dx, cam.bounds.y + cam.dy);
  ctx.restore();
  const px = 1 / view.zoom;
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = px;
  ctx.setLineDash([4*px, 3*px]);
  ctx.strokeRect(cam.bounds.x + cam.dx + 0.5, cam.bounds.y + cam.dy + 0.5, cam.bounds.w, cam.bounds.h);
  ctx.setLineDash([]);
}

/* ═══ pincel ═══
   Un pincel de verdad no es un círculo duro: tiene un borde con
   caída. Se consigue con un degradado radial cuyo punto de parada
   depende de la dureza. Y para que el trazo sea continuo aunque el
   ratón dé saltos, se interpolan sellos entre la posición anterior y
   la nueva, separados una fracción del diámetro. */
function stampGradient(ctx, x, y, r, color, hardness){
  const inner = Math.max(0, Math.min(0.98, hardness / 100));
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.length === 7 ? color + "00" : color);
  return g;
}

/* Reparte puntos a lo largo de un segmento con un paso FIJO,
   arrastrando entre llamadas lo que sobre del segmento anterior —el
   mecanismo de «espaciado» de cualquier motor de pinceles—.

   Imprescindible para un efecto que se ACUMULA en cada pasada, como
   aclarar/oscurecer, a diferencia de repintar un color opaco, que es
   indiferente a cuántas veces se repita encima. Sin arrastrar el
   sobrante, cada llamada independiente redondeaba hacia arriba a «al
   menos un punto» sobre SU tramo, así que un trazo lento —que dispara
   muchos más eventos de movimiento sobre la misma distancia física
   que uno rápido— acababa aplicando muchos más puntos, y por tanto un
   efecto mucho más fuerte, sin que la velocidad del gesto tuviera que
   ver nada con el resultado que se busca. */
export function spacedSteps(x0, y0, x1, y1, step, carry = 0){
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const points = [];
  if(dist > 0){
    const ux = dx / dist, uy = dy / dist;
    let avail = carry + dist, along = -carry;
    while(avail >= step){
      along += step;
      points.push({ x: x0 + ux * along, y: y0 + uy * along });
      avail -= step;
    }
    carry = avail;
  }
  return { points, carry };
}

/* Un lápiz o una pantalla que mida presión de verdad manda valores
   que se mueven; un ratón o la mayoría de pantallas táctiles sin
   presión mandan siempre 0 o exactamente 0.5, así que esos dos valores
   se tratan como «no hay dato» y no escalan nada. */
function pressureScale(e){
  if(!e || typeof e.pressure !== "number") return 1;
  const pr = e.pressure;
  if(pr <= 0 || pr === 0.5) return 1;
  return 0.35 + 0.65 * Math.min(1, pr);
}

function strokeDab(ctx, a, b, scale){
  const r = state.size / 2 * (scale || 1);
  const step = Math.max(1, r * 0.18);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / step));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for(let i = 0; i <= n; i++){
    const t = n === 0 ? 0 : i / n;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.fillStyle = state.hardness >= 99
      ? state.color
      : stampGradient(ctx, x, y, r, state.color, state.hardness);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

function eraseDab(ctx, a, b, scale){
  const r = state.size / 2 * (scale || 1);
  const step = Math.max(1, r * 0.18);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / step));
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = state.opacity / 100;
  for(let i = 0; i <= n; i++){
    const t = n === 0 ? 0 : i / n;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.fillStyle = state.hardness >= 99
      ? "#000"
      : stampGradient(ctx, x, y, r, "#000000", state.hardness);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

/* Igual que strokeDab, pero con el color fijo que le toque (blanco
   para aclarar, negro para oscurecer) en vez de leerlo de state.color:
   Dodge & Burn no elige color, lo decide el modo. */
function dbDab(ctx, a, b, color, scale){
  const r = state.size / 2 * (scale || 1);
  const step = Math.max(1, r * 0.18);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / step));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for(let i = 0; i <= n; i++){
    const t = n === 0 ? 0 : i / n;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.fillStyle = state.hardness >= 99 ? color : stampGradient(ctx, x, y, r, color, state.hardness);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

/* Capa gris 50 % en modo Superponer: el punto de partida clásico del
   retoque no destructivo — pintar blanco o negro encima la aclara o
   la oscurece sin tocar ni un píxel de las capas de debajo, y sigue
   pudiendo retocarse (o borrarse) semanas después sin haber perdido
   nada del original. Si la capa activa YA es una de éstas, se seguirá
   pintando sobre ella; si no, se crea una nueva encima. */
function ensureDodgeBurnLayer(){
  const l = activeLayer();
  if(l && l.dodgeBurn) return l;
  return addDodgeBurnLayer();
}

export function addDodgeBurnLayer(){
  if(!doc.open) return null;
  return recordLayers("Nueva capa Dodge & Burn", () => {
    const l = addLayer({ name: "Dodge & Burn" });
    l.ctx.fillStyle = "#808080";
    l.ctx.fillRect(0, 0, doc.w, doc.h);
    l.blend = "overlay";
    l.dodgeBurn = true;
    l.thumbDirty = true;
    emit("doc:structure"); emit("doc:change");
    return l;
  });
}

/* Estampa un recorte de `srcCanvas` —la capa correspondiente dentro
   de la instantánea origen— con el mismo halo suave de dureza que
   cualquier otro pincel, en vez de un color sólido: es lo que
   convierte «pintar» en «traer de vuelta un trozo de un estado
   anterior». Sólo se recorta y compone el cuadrado que rodea al
   propio tirador, no la capa entera, para que una pincelada larga no
   cueste recomponer toda la imagen en cada punto. */
function stampFromSource(ctx, srcCanvas, x, y, r, hardness){
  const pad = 2;
  const x0 = Math.max(0, Math.floor(x - r - pad)), y0 = Math.max(0, Math.floor(y - r - pad));
  const x1 = Math.min(srcCanvas.width, Math.ceil(x + r + pad)), y1 = Math.min(srcCanvas.height, Math.ceil(y + r + pad));
  const w = x1 - x0, h = y1 - y0;
  if(w <= 0 || h <= 0) return;
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext("2d");
  tctx.drawImage(srcCanvas, x0, y0, w, h, 0, 0, w, h);
  tctx.globalCompositeOperation = "destination-in";
  const inner = Math.max(0, Math.min(0.98, hardness / 100));
  const g = tctx.createRadialGradient(x - x0, y - y0, r * inner, x - x0, y - y0, r);
  g.addColorStop(0, "#fff");
  g.addColorStop(1, "rgba(255,255,255,0)");
  tctx.fillStyle = g;
  tctx.fillRect(0, 0, w, h);
  ctx.drawImage(tmp, x0, y0);
}

function historyDab(ctx, a, b, srcCanvas, scale){
  const r = state.size / 2 * (scale || 1);
  const step = Math.max(1, r * 0.18);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / step));
  for(let i = 0; i <= n; i++){
    const t = n === 0 ? 0 : i / n;
    stampFromSource(ctx, srcCanvas, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r, state.hardness);
  }
}

/* Contorno del pincel: se dibuja en el compositor para que escale
   con el zoom y se vea el tamaño real que va a pintar. */
let cursorPos = null;
export function setCursorPos(p){ cursorPos = p; scheduleOverlay(); }
export const getCursorPos = () => cursorPos;

/* Segundo color del pincel de degradado: el «otro» de la pareja
   frontal/fondo respecto al que se está usando. */
function brushColor2(){ return state.color === state.fg ? state.bg : state.fg; }

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

function drawBrushCursor(ctx){
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

/* Con el tampón conviene ver de dónde se está copiando, no sólo
   dónde se pinta: si no, uno arrastra sin saber qué se trae. */
function drawCloneCursor(ctx){
  drawBrushCursor(ctx);
  if(!state.cloneSrc) return;
  const px = 1 / view.zoom;
  const src = state.cloneOffset && cursorPos
    ? { x: cursorPos.x - state.cloneOffset.x, y: cursorPos.y - state.cloneOffset.y }
    : state.cloneSrc;
  ctx.strokeStyle = "rgba(232,163,61,.9)";
  ctx.lineWidth = px;
  ctx.setLineDash([4 * px, 3 * px]);
  ctx.beginPath();
  ctx.arc(src.x, src.y, state.size / 2, 0, 6.2832);
  ctx.stroke();
  ctx.setLineDash([]);
  const c = 6 * px;
  ctx.beginPath();
  ctx.moveTo(src.x - c, src.y); ctx.lineTo(src.x + c, src.y);
  ctx.moveTo(src.x, src.y - c); ctx.lineTo(src.x, src.y + c);
  ctx.stroke();
}

/* El bote de pintura abre una entrada de historial antes de saber si
   va a pintar algo; si no pinta, hay que cerrarla sin dejar un paso
   vacío en la lista. */
function cancelPixelsSafe(){
  try{ cancelPixels(); }catch(e){}
}

export function resetClone(){
  state.cloneSrc = null;
  state.cloneOffset = null;
  state.clonePick = false;
  toast("Origen de clonado olvidado");
}
export function pickCloneSource(){
  state.clonePick = true;
  toast("Toca o haz clic en el punto que quieres copiar");
}

/* ═══ mover ═══
   Cada capa mide exactamente lo que el documento, así que lo que se
   arrastra más allá de su borde se recorta al dibujarlo: es cómo
   funciona `drawImage` sobre un lienzo de tamaño fijo, y sin más
   significaría que empujar una foto hacia un lado y soltar BORRA para
   siempre lo que quedó fuera.

   Agrandar el lienzo de la capa no es opción —obligaría a que cada
   herramienta, filtro y ajuste supiera trabajar con capas mayores que
   el documento y desplazadas de su origen—. Lo que se hace en su
   lugar son dos cosas que juntas cierran el agujero:

   1. Un BÚFER con el contenido de la capa (sólo su caja ajustada, no
      el lienzo entero: ni un byte de más) que se conserva mientras
      nada ajeno toque esa capa. La capa se REDIBUJA siempre desde ese
      búfer, nunca desde lo que quedó dibujado la vez anterior, así
      que empujar hacia fuera y traer de vuelta —en el mismo arrastre
      o en otro más tarde— devuelve exactamente los mismos píxeles.

   2. Un TOPE: el desplazamiento se recorta para que siempre quede un
      trozo del contenido dentro del lienzo. Como la caja no puede
      salir entera, nunca se llega al caso de «la capa desapareció y
      no hay forma de agarrarla»; y como el tope se aplica al
      desplazamiento TOTAL acumulado, tampoco se escapa a base de
      arrastres pequeños encadenados.

   Lo que sigue teniendo límite: si entre medias se pinta, se aplica
   un filtro o se deshace algo, el búfer se descarta y lo que en ese
   momento estuviera fuera del lienzo sí queda recortado de verdad.
   Eso es inherente a que la capa mida lo que el documento. */

/* Cuánto contenido tiene que seguir dentro del lienzo, por eje. */
export function moveKeep(size){
  return Math.max(1, Math.min(size, Math.max(24, Math.round(size * 0.12))));
}

/* Recorta un desplazamiento para que la caja `b` —en coordenadas de
   documento, sin mover— no pueda salir entera del lienzo. Pura, para
   poder comprobar la geometría con números sueltos. */
export function clampMove(b, docW, docH, dx, dy){
  const kx = moveKeep(b.w), ky = moveKeep(b.h);
  // El borde derecho no baja de kx; el izquierdo no pasa de docW-kx.
  let minDx = kx - b.x - b.w, maxDx = docW - kx - b.x;
  let minDy = ky - b.y - b.h, maxDy = docH - ky - b.y;
  // Contenido más ancho que el propio lienzo: el rango se cruza y la
  // única posición coherente es la del medio.
  if(minDx > maxDx){ const m = (minDx + maxDx) / 2; minDx = maxDx = m; }
  if(minDy > maxDy){ const m = (minDy + maxDy) / 2; minDy = maxDy = m; }
  return {
    dx: Math.round(Math.min(maxDx, Math.max(minDx, dx))),
    dy: Math.round(Math.min(maxDy, Math.max(minDy, dy)))
  };
}

let moveBuf = null;          // { layerId, buf, x, y, w, h, dx, dy }

/* ── invalidación de las memorias de sesión ──────────────────────
   Mover y Licuar guardan cada uno una copia de los píxeles de la capa
   de antes de empezar, y REDIBUJAN la capa desde esa copia en cada
   gesto. Eso las obliga a enterarse de cualquier cambio que venga por
   otro camino —otra herramienta, un filtro, deshacer, rehacer—: si no,
   siguen partiendo de una foto vieja y resucitan lo que el usuario
   acababa de deshacer.

   `selfCommit` dice cuál de las dos está publicando SU propio paso en
   ese instante, que es el único caso en que la memoria correspondiente
   sigue siendo válida. Nótese que un commit de Mover sí invalida la
   sesión de Licuar (y al revés): los dos cambian píxeles de la capa.
   Se enciende y se apaga alrededor del commit en vez de dejar que lo
   consuma el oyente: si `commitPixels()` no llegara a publicar nada,
   una marca encendida se quedaría esperando y se tragaría el siguiente
   cambio ajeno, que es justo el que hay que escuchar. */
let selfCommit = null;       // "move" | "liquify" | null

on("history:change", () => {
  if(selfCommit !== "move")    moveBuf = null;
  if(selfCommit !== "liquify") liqSession = null;
});
on("doc:resize", () => { moveBuf = null; liqSession = null; });

/* Al cerrar el documento estas copias se quedaban en memoria sujetando
   un lienzo entero de un documento que ya no existe. */
on("doc:structure", () => {
  if(doc.open) return;
  moveBuf = null; liqSession = null; invalidateCompareBaseline();
});

function moveBufFor(layer){
  if(moveBuf && moveBuf.layerId === layer.id) return moveBuf;
  const b = contentBounds(layer);
  if(!b) return null;                       // capa vacía: no hay nada que mover
  const buf = document.createElement("canvas");
  buf.width = b.w; buf.height = b.h;
  buf.getContext("2d").drawImage(layer.canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  moveBuf = { layerId: layer.id, buf, x: b.x, y: b.y, w: b.w, h: b.h, dx: 0, dy: 0 };
  return moveBuf;
}

/* Redibuja la capa entera desde el búfer, con el desplazamiento total
   (lo ya confirmado más lo del arrastre en curso) recortado por el
   tope. Devuelve el desplazamiento que de verdad se ha aplicado. */
function moveDraw(layer, pdx, pdy){
  const m = moveBuf;
  if(!m || !layer || m.layerId !== layer.id) return null;
  const c = clampMove(m, doc.w, doc.h, m.dx + pdx, m.dy + pdy);
  layer.ctx.save();
  layer.ctx.globalCompositeOperation = "copy";
  layer.ctx.clearRect(0, 0, doc.w, doc.h);
  layer.ctx.drawImage(m.buf, m.x + c.dx, m.y + c.dy);
  layer.ctx.restore();
  return c;
}

/* Doble clic en el icono de Mover: centra el contenido de la capa
   activa en el lienzo, la convención de Photoshop para «traer de
   vuelta» algo que se ha arrastrado fuera de sitio, en vez de tener
   que ir corrigiendo el arrastre a ojo. Con una capa de texto se
   cambian sus coordenadas, igual que hace la propia herramienta. */
export function centerActiveLayerContent(){
  const l = activeLayer();
  if(!l) return;
  if(l.locked){ toast("La capa está bloqueada"); return; }
  if(isFillLayer(l) || isShapeLayer(l)){
    toast(isShapeLayer(l) ? `Arrastra «${l.name}» con la herramienta Formas (U) en vez de centrarla.`
                           : `«${l.name}» rellena todo el lienzo: no hay nada que centrar.`, "err");
    return;
  }

  if(isText(l)){
    const b = textBounds(l);
    if(!b) return;
    const from = { x: l.text.x, y: l.text.y };
    const to = {
      x: from.x + Math.round((doc.w - b.w) / 2 - b.x),
      y: from.y + Math.round((doc.h - b.h) / 2 - b.y)
    };
    if(to.x === from.x && to.y === from.y) return;
    updateText(l, to);
    record("Centrar capa",
      () => updateText(l, from),
      () => updateText(l, to));
    emit("doc:structure");
    return;
  }

  const box = contentBounds(l);
  if(!box){ toast("La capa está vacía"); return; }
  const dx = Math.round((doc.w - box.w) / 2) - box.x;
  const dy = Math.round((doc.h - box.h) / 2) - box.y;
  if(!dx && !dy) return;

  beginPixels("Centrar capa", l);
  moveBuf = null;                 // fuerza un búfer fresco desde `box`, no uno viejo
  if(!moveBufFor(l)){ cancelPixels(); return; }
  moveDraw(l, dx, dy);
  l.thumbDirty = true;
  selfCommit = "move";
  commitPixels();
  selfCommit = null;
  moveBuf = null;
  scheduleCompose();
  emit("doc:structure");
}

/* ═══ licuar ═══
   Una única rejilla de control por sesión (mientras la herramienta se
   queda activa en la misma capa), a resolución fija: cada trazo la
   deforma un poco más y cada fotograma se redibuja la capa entera
   desde la imagen ORIGINAL —tomada al empezar la sesión— siguiendo la
   rejilla tal como está en ese momento. Redibujar siempre desde el
   original evita que sucesivos trazos emborronen la imagen
   reinterpolando una interpolación anterior.

   El redibujo es la parte cara: cada celda de la rejilla son dos
   `ctx.clip()+drawImage()`, de las operaciones más caras del canvas
   2D, así que con 26×26 celdas son 1352 pares por fotograma. Dos
   recortes, independientes entre sí:
   · La ACTUALIZACIÓN de la rejilla (qué tanto se ha empujado/fruncido
     cada punto) ocurre en TODOS los `pointermove`, sin perder ni uno:
     es barata —sólo toca los puntos cercanos al pincel— y perder un
     evento perdería precisión real del trazo.
   · El REDIBUJADO —volver a pintar la imagen entera siguiendo la
     rejilla— se colapsa con `requestAnimationFrame`: como mucho una
     vez por fotograma, con el estado MÁS RECIENTE de la rejilla,
     nunca uno por evento.
   En `pointer:coarse` además el redibujado de arrastre se hace sobre
   un canvas de trabajo reducido (mismo límite que Perspectiva) en vez
   de a resolución completa del documento: son los píxeles de DESTINO
   los que dominan el coste de `ctx.clip()`, no sólo el origen. Al
   soltar el trazo se repite un redibujado final a resolución
   completa, para que el resultado guardado no pierda nitidez. */
const LIQ_COLS = 26, LIQ_ROWS = 26;
const LIQ_PROXY_MAX = 640;

let liqSession = null;   // { layerId, original, grid, proxy, proxyScale, preview }
let liqPend = false;

function liqSessionBegin(layer){
  if(liqSession && liqSession.layerId === layer.id) return;
  const original = document.createElement("canvas");
  original.width = layer.canvas.width; original.height = layer.canvas.height;
  original.getContext("2d").drawImage(layer.canvas, 0, 0);
  const grid = makeGrid(LIQ_COLS, LIQ_ROWS, doc.w, doc.h);

  let proxy = null, proxyScale = 1, preview = null;
  if(COARSE){
    const k = Math.min(1, LIQ_PROXY_MAX / Math.max(doc.w, doc.h));
    if(k < 1){
      proxy = document.createElement("canvas");
      proxy.width  = Math.max(1, Math.round(doc.w * k));
      proxy.height = Math.max(1, Math.round(doc.h * k));
      const px = proxy.getContext("2d");
      px.imageSmoothingQuality = "high";
      px.drawImage(original, 0, 0, proxy.width, proxy.height);
      proxyScale = k;
      preview = document.createElement("canvas");
      preview.width = proxy.width; preview.height = proxy.height;
    }
  }
  liqSession = { layerId: layer.id, original, grid, proxy, proxyScale, preview };
}

function liqGridSnapshot(){
  return liqSession ? Float64Array.from(liqSession.grid.cur) : null;
}

/* `full=false` (durante el arrastre, sólo si hay proxy) dibuja en el
   canvas reducido y lo escala de una sola vez sobre la capa real —un
   único `drawImage`, barato, en vez de 1352 recortes a tamaño
   completo—. `full=true` (al soltar, al restablecer, al cancelar)
   redibuja directamente a resolución completa. */
function liqRedraw(layer, full = true){
  if(!liqSession || liqSession.layerId !== layer.id) return;
  const { original, grid, proxy, proxyScale, preview } = liqSession;
  if(!full && proxy){
    renderLiquify(preview.getContext("2d"), proxy, grid, preview.width, preview.height, proxyScale);
    const x = layer.ctx;
    x.save();
    x.clearRect(0, 0, doc.w, doc.h);
    x.imageSmoothingQuality = "high";
    x.drawImage(preview, 0, 0, doc.w, doc.h);
    x.restore();
  } else {
    renderLiquify(layer.ctx, original, grid, doc.w, doc.h);
  }
}

function liqSessionStroke(layer, from, to){
  if(!liqSession || liqSession.layerId !== layer.id) return;
  const radius = Math.max(1, state.liqSize / 2);
  const strength = Math.max(0, Math.min(1, state.liqStrength / 100));
  const mode = state.liqMode;
  const amountAt = mode === "push"
    ? (f, t2, tt, n) => ({ x: (to.x - from.x) * strength / n, y: (to.y - from.y) * strength / n })
    : mode === "twirl"
    ? () => 0.22 * strength
    : () => 0.16 * strength;   // pinch / bloat
  applyStroke(liqSession.grid, mode, from, to, radius, amountAt);
  // Se relaja un poco en cada segmento del trazo, no todo de golpe: el
  // efecto se acumula solo con el propio gesto de arrastrar, que ya
  // llama a esto muchas veces por segundo.
  relaxGrid(liqSession.grid, Math.max(0, Math.min(1, state.liqVolume / 100)) * 0.22);
  // El redibujado (caro) se colapsa aparte, en el handler `move()`.
}

function liqSessionRestore(layer, backup){
  if(!liqSession || !layer || liqSession.layerId !== layer.id || !backup) return;
  liqSession.grid.cur.set(backup);
  liqRedraw(layer, true);
}

function liqSessionEnd(){ liqSession = null; liqPend = false; }

export function resetLiquify(){
  const l = activeLayer();
  if(!liqSession || !l || liqSession.layerId !== l.id) return;
  if(isIdentityGrid(liqSession.grid)) return;
  beginPixels("Restablecer licuado", l);
  resetGrid(liqSession.grid);
  liqRedraw(l, true);
  l.thumbDirty = true;
  selfCommit = "liquify";
  commitPixels();
  selfCommit = null;
  emit("doc:structure");
  scheduleCompose();
}

function drawLiquifyCursor(ctx){
  if(!cursorPos) return;
  const r = state.liqSize / 2;
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = 1 / view.zoom;
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, r, 0, 6.2832); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, r + 1 / view.zoom, 0, 6.2832); ctx.stroke();
  // Un punto en el centro: en fruncir/hinchar/remolino todo gira en
  // torno a él y conviene verlo exactamente, no solo el contorno.
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, 2 / view.zoom, 0, 6.2832); ctx.fill();
}

/* ═══ comparar ═══
   Una única instantánea de cómo se veía el documento nada más
   abrirlo, capturada una sola vez —al recibir «doc:new»— y nunca
   vuelta a tocar: lo que importa aquí es comparar con el ORIGINAL,
   no con el estado de hace un momento. Si el lienzo cambia de tamaño
   después (recortar, redimensionar), la instantánea se sigue
   dibujando estirada al tamaño actual con el mismo criterio que ya
   usa `resizeDoc` para cada capa, en vez de intentar adivinar qué
   parte de la instantánea corresponde a qué parte del recorte. */
let cmpOriginal = null;   // <canvas> o null si aún no hay documento
let cmpActive = false;    // aparte de qué herramienta esté activa: ver nota en deactivate()

function cmpCapture(){
  invalidateCompareBaseline();
  if(!doc.open) return;
  // Comparison is a display preview, not an export. In tiled mode
  // canvasEl() creates a full-size composite; copying that doubled the
  // memory spike immediately after accepting a large RAW.
  const scale = Math.min(1, Math.sqrt((COARSE ? 1_000_000 : 4_000_000) / (doc.w * doc.h)));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(doc.w * scale));
  c.height = Math.max(1, Math.round(doc.h * scale));
  const layer = doc.layers.length === 1 ? doc.layers[0] : null;
  if(layer && layer.visible && layer.opacity === 1 && layer.type === 'raster' && !layer.mask && !layer.styles){
    c.getContext("2d").drawImage(layer.canvas, 0, 0, c.width, c.height);
  }else{
    const flat = flatten();
    c.getContext("2d").drawImage(flat, 0, 0, c.width, c.height);
    flat.width = flat.height = 1;
  }
  cmpOriginal = c;
}

/* Al cambiar a otro documento (core/documents.js), el «antes» de
   Comparar tiene que dejar de ser el de la pestaña que se acaba de
   abandonar: activarlo con `!cmpOriginal` de más abajo volverá a
   capturarlo sobre lo que se esté viendo ahora en cuanto haga falta. */
export function invalidateCompareBaseline(){ if(cmpOriginal)cmpOriginal.width=cmpOriginal.height=1;cmpOriginal = null; }
on("doc:new", cmpCapture);

/* Comparison is drawn into the viewport overlay. Request its refresh
   after composition without allocating or altering the export canvas. */
on("compositor:done", () => {
  if(cmpActive) cmpApply();
});

function cmpApply(){
  // The viewport-sized overlay works with both tiled and normal views.
  // Never flatten the document on every comparison/zoom frame.
  scheduleOverlay();
}

export function centerCompare(){
  state.cmpSplit = 0.5;
  if(cmpActive) compose();
}

function drawCompareOverlay(ctx){
  if(!doc.open) return;
  const x = doc.w * state.cmpSplit;
  if(cmpOriginal && cmpActive && x > 0){
    ctx.save();ctx.beginPath();ctx.rect(0,0,x,doc.h);ctx.clip();
    ctx.drawImage(cmpOriginal,0,0,cmpOriginal.width,cmpOriginal.height,0,0,doc.w,doc.h);
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = 2 / view.zoom;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, doc.h); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.55)";
  ctx.lineWidth = 1 / view.zoom;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, doc.h); ctx.stroke();

  // Tirador central con dos flechitas, para que se note que se arrastra.
  const midY = doc.h / 2, r = 14 / view.zoom, a = 5 / view.zoom;
  ctx.fillStyle = "rgba(20,20,24,.85)";
  ctx.beginPath(); ctx.arc(x, midY, r, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 1.5 / view.zoom;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.beginPath();
  ctx.moveTo(x - a * 1.6, midY); ctx.lineTo(x - a * 0.4, midY - a); ctx.lineTo(x - a * 0.4, midY + a);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + a * 1.6, midY); ctx.lineTo(x + a * 0.4, midY - a); ctx.lineTo(x + a * 0.4, midY + a);
  ctx.fill();
  ctx.restore();
}

/* ═══ recorte ═══ */
const HANDLE = 9;
function inRect(p, r){ return p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h; }

function cropHandleAt(p){
  const r = state.cropRect;
  if(!r) return null;
  const t = HANDLE / view.zoom;
  const L = Math.abs(p.x - r.x) < t, R = Math.abs(p.x - (r.x + r.w)) < t;
  const T = Math.abs(p.y - r.y) < t, B = Math.abs(p.y - (r.y + r.h)) < t;
  const inY = p.y > r.y - t && p.y < r.y + r.h + t;
  const inX = p.x > r.x - t && p.x < r.x + r.w + t;
  if(L && T) return "nw"; if(R && T) return "ne";
  if(L && B) return "sw"; if(R && B) return "se";
  if(L && inY) return "w"; if(R && inY) return "e";
  if(T && inX) return "n"; if(B && inX) return "s";
  return null;
}

function ratioValue(){
  const v = state.cropRatio;
  if(v === "free") return null;
  if(v === "orig") return doc.w / doc.h;
  if(v === "custom"){
    const a = +state.cropW, b = +state.cropH;
    // Mientras el campo está vacío o a medio teclear, sin proporción:
    // forzar una relación absurda haría saltar el rectángulo.
    if(!(a > 0) || !(b > 0)) return null;
    return a / b;
  }
  const [a, b] = v.split(":").map(Number);
  return a / b;
}

/* Al cambiar la proporción, el rectángulo se reencaja conservando el
   centro, que al cambiar de formato desconcierta mucho menos que
   anclar una esquina. */
export function reflowCrop(){
  const r = state.cropRect;
  const ar = ratioValue();
  if(!r || !ar) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  let w = r.w, h = w / ar;
  if(h > doc.h){ h = doc.h; w = h * ar; }
  if(w > doc.w){ w = doc.w; h = w / ar; }
  state.cropRect = {
    w, h,
    x: Math.max(0, Math.min(doc.w - w, cx - w / 2)),
    y: Math.max(0, Math.min(doc.h - h, cy - h / 2))
  };
  scheduleOverlay();
}

function resizeCrop(mode, p, from, start){
  const r = state.cropRect;
  const ar = ratioValue();
  if(mode === "move"){
    r.x = Math.max(0, Math.min(doc.w - start.w, start.x + (p.x - from.x)));
    r.y = Math.max(0, Math.min(doc.h - start.h, start.y + (p.y - from.y)));
    return;
  }
  // Ajuste a guías y a los bordes/centro del documento: arrastrar una
  // asa de recorte cerca de una guía se pega a ella, para encajar el
  // recorte con precisión sin tener que acertar el píxel a ojo.
  const guides = { h: doc.guides.h, v: doc.guides.v };
  p = {
    x: snapValue(p.x, snapCandidatesX(doc.w, guides), 6, view.zoom),
    y: snapValue(p.y, snapCandidatesY(doc.h, guides), 6, view.zoom)
  };
  let { x, y, w, h } = start;
  if(mode.includes("e")) w = p.x - x;
  if(mode.includes("s")) h = p.y - y;
  if(mode.includes("w")){ w = (x + w) - p.x; x = p.x; }
  if(mode.includes("n")){ h = (y + h) - p.y; y = p.y; }
  w = Math.max(8, w); h = Math.max(8, h);
  if(ar){
    if(mode === "n" || mode === "s") w = h * ar;
    else h = w / ar;
  }
  // No dejar que se salga del lienzo
  x = Math.max(0, Math.min(x, doc.w - 8));
  y = Math.max(0, Math.min(y, doc.h - 8));
  w = Math.min(w, doc.w - x);
  h = Math.min(h, doc.h - y);
  state.cropRect = { x, y, w, h };
}

/* ── edición en el lienzo de una capa de forma ya creada ─────────
   Mismas ocho asas que Recortar (arriba), pero sobre `layer.shape` en
   vez de `state.cropRect`, más una novena propia de un rectángulo: el
   radio de esquina, como un tirador aparte sobre el borde superior a
   la distancia que representa el radio actual —arrastrarlo a la
   derecha lo agranda, a la izquierda lo achica, sin salirse nunca de
   0..mitad del lado corto—. */
function shapeHandleAt(p, s){
  const t = HANDLE / view.zoom;
  const L = Math.abs(p.x - s.x) < t, R = Math.abs(p.x - (s.x + s.w)) < t;
  const T = Math.abs(p.y - s.y) < t, B = Math.abs(p.y - (s.y + s.h)) < t;
  const inY = p.y > s.y - t && p.y < s.y + s.h + t;
  const inX = p.x > s.x - t && p.x < s.x + s.w + t;
  if(L && T) return "nw"; if(R && T) return "ne";
  if(L && B) return "sw"; if(R && B) return "se";
  if(L && inY) return "w"; if(R && inY) return "e";
  if(T && inX) return "n"; if(B && inX) return "s";
  return null;
}

function shapeRadiusHandleX(s){
  return s.x + Math.max(0, Math.min(s.radius || 0, Math.min(s.w, s.h) / 2));
}
function shapeRadiusHandleAt(p, s){
  if(s.kind !== "rect") return false;
  const t = HANDLE / view.zoom;
  return Math.abs(p.x - shapeRadiusHandleX(s)) < t && Math.abs(p.y - s.y) < t;
}

function resizeShape(mode, p, from, start){
  if(mode === "move"){
    return { ...start,
      x: start.x + (p.x - from.x),
      y: start.y + (p.y - from.y) };
  }
  if(mode === "radius"){
    const r = Math.max(0, Math.min(p.x - start.x, Math.min(start.w, start.h) / 2));
    return { ...start, radius: Math.round(r) };
  }
  let { x, y, w, h } = start;
  if(mode.includes("e")) w = p.x - x;
  if(mode.includes("s")) h = p.y - y;
  if(mode.includes("w")){ w = (x + w) - p.x; x = p.x; }
  if(mode.includes("n")){ h = (y + h) - p.y; y = p.y; }
  w = Math.max(4, w); h = Math.max(4, h);
  return { ...start, x, y, w, h };
}

function drawCropOverlay(ctx){
  const r = state.cropRect;
  if(!r) return;
  ctx.fillStyle = "rgba(10,12,15,.62)";
  ctx.beginPath();
  ctx.rect(0, 0, doc.w, doc.h);
  ctx.rect(r.x + r.w, r.y, -r.w, r.h);   // agujero con regla par-impar
  ctx.fill("evenodd");

  const px = 1 / view.zoom;
  ctx.strokeStyle = "#e8a33d";
  ctx.lineWidth = px;
  ctx.strokeRect(r.x, r.y, r.w, r.h);

  // Guía de composición
  if(state.cropGuide === "thirds" || state.cropGuide === "golden"){
    const fr = state.cropGuide === "golden" ? [0.382, 0.618] : [1/3, 2/3];
    ctx.strokeStyle = "rgba(232,163,61,.32)";
    ctx.beginPath();
    for(const f of fr){
      ctx.moveTo(r.x + r.w * f, r.y); ctx.lineTo(r.x + r.w * f, r.y + r.h);
      ctx.moveTo(r.x, r.y + r.h * f); ctx.lineTo(r.x + r.w, r.y + r.h * f);
    }
    ctx.stroke();
  }

  // Asas
  const s = HANDLE / view.zoom;
  ctx.fillStyle = "#e8a33d";
  for(const [hx, hy] of [[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]]){
    ctx.fillRect(r.x + r.w * hx - s / 2, r.y + r.h * hy - s / 2, s, s);
  }
}

/* Vista previa mientras se arrastra una forma nueva, y asas de edición
   sobre la capa de forma activa —del mismo tipo que la herramienta
   tiene elegido ahora mismo; con otro tipo, clic sobre ella empieza
   una forma nueva en vez de editarla, ver el down() de la
   herramienta—. Las mismas ocho asas de Recortar, más el tirador azul
   propio del radio de esquina en un rectángulo. */
function drawShapeToolOverlay(ctx){
  if(current.id !== "shape") return;
  const px = 1 / view.zoom;

  if(current._newRect){
    const r = current._newRect;
    drawShape(ctx, state.shapeKind, { x:r.x, y:r.y }, { x:r.x + r.w, y:r.y + r.h }, {
      fill: state.fillColor, stroke: state.strokeColor, lineWidth: state.lineWidth,
      fillOn: state.shapeFill, strokeOn: state.shapeStroke, opacity: state.opacity / 100,
      sides: state.shapeSides, inner: state.shapeInner
    });
    ctx.save();
    ctx.strokeStyle = "rgba(232,163,61,.9)";
    ctx.lineWidth = px;
    ctx.setLineDash([5 * px, 4 * px]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    return;
  }

  const l = activeLayer();
  if(!l || !isShapeLayer(l) || l.shape.kind !== state.shapeKind) return;
  const sh = l.shape;
  ctx.save();
  ctx.strokeStyle = "#e8a33d";
  ctx.lineWidth = px;
  ctx.setLineDash([5 * px, 4 * px]);
  if(sh.kind === "rect") ctx.strokeRect(sh.x, sh.y, sh.w, sh.h);
  else {
    ctx.beginPath();
    ctx.ellipse(sh.x + sh.w / 2, sh.y + sh.h / 2, sh.w / 2, sh.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const hs = HANDLE / view.zoom;
  ctx.fillStyle = "#e8a33d";
  for(const [hx, hy] of [[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]]){
    ctx.fillRect(sh.x + sh.w * hx - hs / 2, sh.y + sh.h * hy - hs / 2, hs, hs);
  }
  if(sh.kind === "rect"){
    ctx.beginPath();
    ctx.arc(shapeRadiusHandleX(sh), sh.y, hs / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#38a4e8";
    ctx.fill();
  }
  ctx.restore();
}

export function applyCrop(){
  const r = state.cropRect;
  if(!r || !doc.open) return;
  const rect = { x: Math.round(r.x), y: Math.round(r.y),
                 w: Math.round(r.w), h: Math.round(r.h) };
  if(rect.w < 1 || rect.h < 1) return;
  // Marco sin tocar (el lienzo entero): recortar no cambiaría nada y
  // sólo dejaría un paso «Recortar» vacío en el historial.
  if(rect.x === 0 && rect.y === 0 && rect.w === doc.w && rect.h === doc.h){
    toast("Ajusta el marco antes de aplicar: ahora abarca todo el lienzo");
    return;
  }
  const before = doc.layers.map(cropSnap);
  const oldW = doc.w, oldH = doc.h;
  cropDoc(rect);
  const after = doc.layers.map(cropSnap);
  record("Recortar", () => restoreAll(before, oldW, oldH),
                     () => restoreAll(after, rect.w, rect.h));
  state.cropRect = { x: 0, y: 0, w: doc.w, h: doc.h };
  fit();
  toast(`Recortado a ${rect.w} × ${rect.h}`);
}

/* Copia de una capa para deshacer el recorte: píxeles y, si la tiene,
   su máscara, que cropDoc() recorta con ella. */
function cropSnap(l){
  const copy = src => {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    return c;
  };
  return { id: l.id, c: copy(l.canvas), m: l.mask ? copy(l.mask.canvas) : null };
}

function restoreAll(snaps, w, h){
  doc.w = w; doc.h = h;
  for(const s of snaps){
    const l = doc.layers.find(x => x.id === s.id);
    if(!l) continue;
    l.canvas.width = w; l.canvas.height = h;
    l.ctx.drawImage(s.c, 0, 0);
    // Sólo si la capa sigue teniendo máscara: quitarla después es un
    // paso de historial aparte.
    if(s.m && l.mask){
      const m = document.createElement("canvas");
      m.width = w; m.height = h;
      const mx = m.getContext("2d", { willReadFrequently: true });
      mx.drawImage(s.m, 0, 0);
      l.mask = { canvas: m, ctx: mx };
    }
    l.thumbDirty = true;
  }
  emit("doc:resize");
  emit("doc:structure");
}

/* ═══ perspectiva ═══
   Toda la lógica vive en perspectool.js; aquí sólo queda el puente
   entre el `state` que lee la barra de opciones y el módulo, y los
   comandos que invocan sus botones. */
function syncPersp(){
  perspSync({
    mode: state.perspMode,
    showGrid: !!state.perspGrid,
    vert: state.perspVert,
    horz: state.perspHorz,
    rot: state.perspRot,
    scale: state.perspScale
  });
}

export function applyPerspective(){
  if(perspApply()){
    setTool("move", { auto:true });
    resetPerspState();
  }
}

export function resetPerspective(){
  resetPerspState();
  perspReset();
  emit("tool:options");
}

export function clearPerspGuides(){ perspClearGuides(); }

/* «Rellenar» cambia la escala por su cuenta, así que hay que devolver
   el valor al estado o el deslizador se quedaría diciendo otra cosa. */
export function fillPerspFrame(){
  state.perspScale = perspFill();
  emit("tool:options");
}

function resetPerspState(){
  state.perspVert = 0; state.perspHorz = 0;
  state.perspRot = 0;  state.perspScale = 100;
}

/* ═══ Transformación libre ═══ */

/* Copia lo que hay en xform.* (ángulo en radianes, escala en tanto
   por uno) a las unidades que enseña la barra —grados, porcentaje— y
   repinta la barra entera. Se llama tras cada gesto de arrastre, NO
   desde el propio campo numérico cuando el usuario teclea en él: eso
   reconstruiría el campo a medio escribir y le quitaría el foco. */
function syncXformFields(){
  const r = xformReadout();
  state.xfW = r.w; state.xfH = r.h;
  state.xfAngle = r.angle; state.xfSkewX = r.skewX; state.xfSkewY = r.skewY;
  emit("tool:options");
}

export function applyTransform(){
  if(xformApply()) setTool("move", { auto:true });
}

export function resetTransform(){
  xformResetAll();
  syncXformFields();
}

export function flipTransform(axis){
  xformFlip(axis);
  syncXformFields();
}

/* ═══ apoyo para la herramienta de texto ═══ */

/* Capa de texto bajo el puntero, mirando de arriba abajo para que
   gane la que está visualmente encima. El margen generoso (12 px)
   facilita acertar con el dedo, y la comprobación se hace en el
   sistema sin girar del texto, así que un rótulo torcido se acierta
   igual de bien que uno recto. */
function textAt(p){
  for(let i = doc.layers.length - 1; i >= 0; i--){
    const l = doc.layers[i];
    if(!isText(l) || !l.visible) continue;
    if(pointInText(l, p, 12)) return l;
  }
  return null;
}

/* Marco de la capa de texto activa, más el rectángulo fantasma
   mientras se arrastra uno nuevo. Con el cuadro de edición abierto no
   se pinta: ahí manda el borde del propio <textarea> y dos marcos
   superpuestos sólo confunden. */
function drawTextToolOverlay(ctx){
  const t = current;
  if(t._rect){
    const px = 1 / view.zoom;
    ctx.save();
    ctx.strokeStyle = "rgba(232,163,61,.95)";
    ctx.lineWidth = px;
    ctx.setLineDash([5 * px, 4 * px]);
    ctx.strokeRect(t._rect.x, t._rect.y, t._rect.w, t._rect.h);
    ctx.restore();
  }
  if(t._newPath) drawTextPathCurve(ctx, t._newPath);
  const l = activeLayer();
  if(isText(l) && l.visible && !isEditing()){
    if(l.text.path) drawTextPathHandles(ctx, l.text.path);
    else drawTextBox(ctx, l);
  }
}

/* Sólo la curva, sin asas —para la vista previa mientras se arrastra
   una recién nacida—. */
function drawTextPathCurve(ctx, path){
  const px = 1 / view.zoom;
  ctx.save();
  ctx.strokeStyle = "rgba(232,163,61,.95)";
  ctx.lineWidth = px;
  ctx.setLineDash([5 * px, 4 * px]);
  ctx.beginPath();
  ctx.moveTo(path.p0[0], path.p0[1]);
  ctx.quadraticCurveTo(path.p1[0], path.p1[1], path.p2[0], path.p2[1]);
  ctx.stroke();
  ctx.restore();
}

/* Curva más sus tres asas —inicio, control, fin—, con la misma
   convención de color que el radio de esquina de una forma: naranja
   para los puntos que van sobre el trazo, azul para el que tira de la
   curvatura, más las dos guías al punto de control para que se vea
   qué tirador dobla hacia dónde. */
function drawTextPathHandles(ctx, path){
  drawTextPathCurve(ctx, path);
  const px = 1 / view.zoom;
  ctx.save();
  ctx.strokeStyle = "rgba(56,164,232,.55)";
  ctx.lineWidth = px;
  ctx.beginPath();
  ctx.moveTo(path.p0[0], path.p0[1]); ctx.lineTo(path.p1[0], path.p1[1]);
  ctx.moveTo(path.p2[0], path.p2[1]); ctx.lineTo(path.p1[0], path.p1[1]);
  ctx.stroke();
  const hs = HANDLE / view.zoom;
  for(const [pt, color] of [[path.p0,"#e8a33d"],[path.p1,"#38a4e8"],[path.p2,"#e8a33d"]]){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], hs / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* Distancia a cada una de las tres asas del trazado, en coordenadas
   de documento —igual criterio que `shapeHandleAt`—. */
function textPathHandleAt(p, path){
  const t = HANDLE / view.zoom;
  if(Math.hypot(p.x - path.p0[0], p.y - path.p0[1]) < t) return "p0";
  if(Math.hypot(p.x - path.p1[0], p.y - path.p1[1]) < t) return "p1";
  if(Math.hypot(p.x - path.p2[0], p.y - path.p2[1]) < t) return "p2";
  return null;
}

function setActiveLayerId(id){
  doc.activeId = id;
  emit("doc:active");
}

/* La barra de opciones y la capa hablan en unidades distintas: la
   barra usa porcentajes y booleanos, la capa peso numérico y
   fracciones. Estas dos funciones son la traducción. */
export function pushTextStyle(layer){
  if(!isText(layer)) return;
  updateText(layer, {
    font: state.fontFamily,
    size: state.fontSize,
    weight: state.bold ? 700 : 400,
    italic: state.italic,
    color: state.textColor,
    align: state.align,
    lineHeight: state.lineHeight / 100,
    tracking: state.tracking,
    strokeWidth: state.strokeWidth,
    strokeColor: state.strokeColor,
    shadow: state.shadow,
    shadowColor: state.shadowColor,
    shadowX: state.shadowX,
    shadowY: state.shadowY,
    shadowBlur: state.shadowBlur,
    shadowAlpha: state.shadowAlpha,
    allCaps: state.allCaps,
    bg: state.textBg,
    bgColor: state.textBgColor,
    bgOpacity: state.textBgOpacity,
    bgPadding: state.textBgPadding,
    bgRadius: state.textBgRadius,
    circle: state.textCircle,
    circleRadius: state.textCircleRadius,
    circleDistance: state.textCircleDistance,
    circleSkew: state.textCircleSkew,
    circleFlip: state.textCircleFlip,
    angle: state.textAngle,
    boxW: state.textBoxed ? state.textBoxW : null,
    boxH: state.textBoxed ? state.textBoxH : null,
    indentFirst: state.indentFirst,
    indentLeft: state.indentLeft,
    indentRight: state.indentRight,
    ligatures: state.textLigatures,
    smallCaps: state.textSmallCaps,
    warp: state.textWarpKind === "none" ? null : { kind: state.textWarpKind, amount: state.textWarpAmount }
  });
}

export function pullTextStyle(layer){
  if(!isText(layer)) return;
  const t = layer.text;
  state.fontFamily = t.font;
  state.fontSize = t.size;
  state.bold = t.weight >= 600;
  state.italic = t.italic;
  state.textColor = t.color;
  state.align = t.align;
  state.lineHeight = Math.round(t.lineHeight * 100);
  state.tracking = t.tracking;
  state.strokeWidth = t.strokeWidth;
  state.strokeColor = t.strokeColor;
  state.shadow = t.shadow;
  state.shadowColor = t.shadowColor ?? "#000000";
  state.shadowX = t.shadowX ?? 2;
  state.shadowY = t.shadowY ?? 3;
  state.shadowBlur = t.shadowBlur ?? 8;
  state.shadowAlpha = t.shadowAlpha ?? 55;
  state.allCaps = t.allCaps;
  state.textBg = t.bg;
  state.textBgColor = t.bgColor;
  state.textBgOpacity = t.bgOpacity;
  state.textBgPadding = t.bgPadding ?? 14;
  state.textBgRadius = t.bgRadius ?? 8;
  state.textCircle = !!t.circle;
  state.textCircleRadius = t.circleRadius ?? 160;
  state.textCircleDistance = t.circleDistance ?? 0;
  state.textCircleSkew = t.circleSkew ?? 0;
  state.textCircleFlip = !!t.circleFlip;
  state.textAngle = Math.round(t.angle || 0);
  state.textBoxed = Number.isFinite(t.boxW) && t.boxW > 0;
  if(state.textBoxed){
    state.textBoxW = Math.round(t.boxW);
    state.textBoxH = Math.round(t.boxH ?? t.boxW * 0.5);
  }
  state.indentFirst = t.indentFirst ?? 0;
  state.indentLeft = t.indentLeft ?? 0;
  state.indentRight = t.indentRight ?? 0;
  state.textLigatures = t.ligatures ?? true;
  state.textSmallCaps = !!t.smallCaps;
  state.textWarpKind = t.warp ? t.warp.kind : "none";
  state.textWarpAmount = t.warp ? t.warp.amount : 50;
  // El kerning se enseña por hueco de cursor, no por capa —ver
  // on("text:cursor")—: al cambiar de capa, sin cursor puesto, no hay
  // ningún hueco concreto que mostrar.
  state.textKerning = 0;
  emit("tool:options");
}

/* Cambiar el color, el cuerpo o la sombra de un texto ya escrito
   también se deshace. Los cambios se juntan por ráfagas: arrastrar un
   deslizador dispara decenas de avisos seguidos, y un paso de
   historial por cada uno llenaría la lista de ruido y obligaría a
   deshacer treinta veces para volver donde se estaba. Se guarda cómo
   estaba el texto al empezar la ráfaga y se cierra el paso cuando
   pasa medio segundo sin tocar nada.

   Mientras se está escribiendo no se anota nada: `endEdit` ya guarda
   de una vez todo lo que haya cambiado durante la edición. */
let styleBurst = null, styleTimer = null;

function noteStyleChange(layer){
  if(isEditing()) return;
  if(!styleBurst || styleBurst.layer !== layer){
    flushStyleBurst();
    styleBurst = { layer, before: { ...layer.text } };
  }
  clearTimeout(styleTimer);
  styleTimer = setTimeout(flushStyleBurst, 600);
}

function flushStyleBurst(){
  clearTimeout(styleTimer);
  styleTimer = null;
  const b = styleBurst;
  styleBurst = null;
  if(!b || !isText(b.layer)) return;
  const after = { ...b.layer.text };
  if(Object.keys(after).every(k => after[k] === b.before[k])) return;
  const put = st => {
    Object.assign(b.layer.text, st);
    renderTextLayer(b.layer);
    if(activeLayer() === b.layer) pullTextStyle(b.layer);
    emit("doc:change");
  };
  record("Estilo de texto", () => put(b.before), () => put(after));
}

/* Cuando se cambia una opción con una capa de texto activa, el cambio
   se aplica a esa capa al momento. Es lo que hace cualquier editor y
   evita el paso extra de «aplicar». */
on("tool:paramchange", key => {
  if(BRUSH_KEYS[key]){
    setBrushOption(BRUSH_KEYS[key], state[key]);
    scheduleOverlay();
  }
  if(key === "dbShowGray") scheduleOverlay();
  if(current.id === "crop" &&
     (key === "cropRatio" || key === "cropW" || key === "cropH")){
    reflowCrop();
  }
  if(current.id === "perspective" && key.startsWith("persp")){
    syncPersp();
    return;
  }
  if(current.id === "transform" && key.startsWith("xf")){
    // No se llama a syncXformFields() aquí: si el propio campo que se
    // acaba de teclear se reconstruyera ahora mismo, perdería el foco
    // a media cifra. La barra ya tiene el valor que el usuario quiere
    // ver —es el suyo—; sólo hace falta que el motor lo recoja.
    xformSync({
      xfMode: state.xfMode, xfProportional: state.xfProportional,
      xfW: state.xfW, xfH: state.xfH,
      xfAngle: state.xfAngle, xfSkewX: state.xfSkewX, xfSkewY: state.xfSkewY
    });
    return;
  }
  if(current.id !== "text") return;
  const l = activeLayer();
  if(!isText(l)) return;

  /* «Trazado» sólo decide qué hace el próximo arrastre en hueco: no es
     un atributo de la capa, así que no hay nada que aplicar ni que
     deshacer. */
  if(key === "textPathMode") return;

  /* El kerning manual no es un campo plano del texto sino un valor
     por hueco de cursor —ver `textKerning` en el array de opciones—,
     así que no pasa por pushTextStyle: se escribe directo en
     `layer.text.kerning`, indexado por la misma posición que usa
     `textarea.selectionStart` (y que sobrevive al reajuste de línea,
     ver wrapLine() en text.js). Cero borra la entrada entera en vez
     de dejar un cero explícito, que ensuciaría el mapa sin motivo. */
  if(key === "textKerning"){
    const cp = textCursorPos();
    if(isEditing() && cp && cp.start === cp.end){
      noteStyleChange(l);
      const kerning = { ...(l.text.kerning || {}) };
      if(state.textKerning) kerning[cp.start] = state.textKerning;
      else delete kerning[cp.start];
      updateText(l, { kerning });
      placeEditor(true);
      focusEditor();
    }
    return;
  }

  /* Un estilo de carácter o de párrafo es un «sello»: aplicarlo copia
     sus valores sobre la capa activa ahora mismo (ver textstyles.js),
     como un solo paso de historial —no una ráfaga— porque elegirlo en
     el desplegable es un gesto discreto, no un arrastre. */
  if(key === "charStyle"){
    const attrs = state.charStyle && charStyleAttrs(state.charStyle);
    if(attrs){ noteStyleChange(l); updateText(l, attrs); flushStyleBurst(); }
    return;
  }
  if(key === "paraStyle"){
    const attrs = state.paraStyle && paraStyleAttrs(state.paraStyle);
    if(attrs){ noteStyleChange(l); updateText(l, attrs); flushStyleBurst(); }
    return;
  }

  /* Al encender el marco se toma la medida de lo que el texto ocupa
     ahora mismo: pasar a párrafo no debería recolocar nada de golpe,
     sólo poner un marco alrededor de lo que ya había. */
  if(key === "textBoxed" && state.textBoxed){
    const b = textBounds(l);
    state.textBoxW = Math.max(40, Math.round(b.w) + Math.round(state.fontSize * 0.6));
    state.textBoxH = Math.max(24, Math.round(b.h) + Math.round(state.fontSize * 0.6));
  }
  noteStyleChange(l);
  /* Alinear un texto de punto no lo mueve: se recoloca su ancla para
     que el bloque se quede donde estaba (ver alignTextPatch). */
  if(key === "align") updateText(l, alignTextPatch(l, state.align));
  pushTextStyle(l);
  /* Si se está escribiendo, el cuadro de edición tiene que seguir al
     cambio —otra tipografía o otro cuerpo lo dejan descuadrado sobre
     el texto— y el foco tiene que volver al textarea, o el resto de lo
     que se teclee acaba en el control de la barra que se acaba de
     tocar. */
  if(isEditing()){ placeEditor(true); focusEditor(); }
});

on("doc:active", () => {
  // Cambiar de capa mientras se escribe cierra la edición: seguir con
  // un cuadro abierto sobre una capa que ya no es la activa es la vía
  // rápida a escribir en la capa equivocada.
  if(isEditing() && editingLayer() !== activeLayer()) endEdit();
  if(current.id !== "text") return;
  const l = activeLayer();
  if(isText(l)) pullTextStyle(l);
});

/* El campo de kerning muestra lo que YA tiene el hueco donde esté el
   cursor ahora mismo —ver textedit.js, que dispara esto en cada tecla
   y cada clic dentro del cuadro de edición—, no lo último que se haya
   tecleado en otro sitio. */
on("text:cursor", () => {
  const l = editingLayer();
  if(!isText(l)) return;
  const cp = textCursorPos();
  state.textKerning = (cp && cp.start === cp.end && l.text.kerning) ? (l.text.kerning[cp.start] || 0) : 0;
  if(current.id === "text") emit("tool:options");
});

/* ═══ herramienta activa ═══ */
export let current = TOOLS[0];

/* Sólo la usan los botones/atajo «Cancelar» de Recortar, Transformación
   libre y Perspectiva (ver tools.js más arriba y commands en main.js):
   fuerza que el deactivate() de esas tres tire de verdad el cambio
   pendiente en vez de aplicarlo, que es lo que hacen por defecto al
   cambiar a CUALQUIER otra herramienta (ver el comentario en cada
   deactivate()). */
let forceDiscard = false;
export function cancelPendingTool(){
  forceDiscard = true;
  setTool("move", { auto:true });
  forceDiscard = false;
}

/* ¿La herramienta activa la ha elegido el usuario, o es la de
   partida? Siempre hay una activa —«Mover» al arrancar y como destino
   al terminar Recortar/Perspectiva/Transformar o al cancelar—, pero
   esa no es una elección: el «?» de la barra de opciones abre en ese
   caso la guía general en vez de la ayuda de «Mover». Las vueltas
   automáticas pasan `{ auto:true }`. */
let chosen = false;
export const toolChosen = () => chosen;

export function setTool(id, { auto = false } = {}){
  const t = TOOLS.find(x => x.id === id);
  if(!t) return;
  if(t === current){
    // Elegir a mano la misma que ya estaba puesta por defecto sí
    // cuenta como elección: sólo cambia a qué ayuda lleva el «?».
    if(!auto && !chosen){ chosen = true; emit("tool:options"); }
    return;
  }
  chosen = !auto;
  if(isEditing()) endEdit();
  if(current && current.deactivate) current.deactivate();
  current = t;
  window.__panTool = !!t.pan;
  if(t.activate && doc.open) t.activate();
  emit("tool:change", t);
  emit("tool:options");
}

on("doc:new", () => {
  if(current && current.activate) current.activate();
});
