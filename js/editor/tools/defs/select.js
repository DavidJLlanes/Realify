/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Herramientas de selección (rectángulo, elipse, lazo, varita) y Pluma.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { setOverlay, scheduleOverlay } from "../../render/compositor.js";
import { otherLayersEdgeCandidates } from "../../align.js";
import { doc, activeLayer } from "../../../core/doc.js";
import { commitSelection, maskFromRect, maskFromEllipse, maskFromPolygon, maskFromWand } from "../../selection/selection.js";
import { view } from "../../../core/view.js";
import { penBegin, drawPenOverlay, penEnd, penDown, penMove, penUp, penCancel } from "../../selection/pentool.js";
import { snapToGridEnabled, gridStep, snapValue, snapCandidatesX, snapCandidatesY } from "../rulers.js";
import { svg, normRect, state, drawSnapLines } from "./shared.js";
import { current } from "../tool-current.js";

export const selectRectTool = {
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
  };

export const selectEllipseTool = {
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
  };

export const selectLassoTool = {
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
  };

export const selectWandTool = {
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
  };

export const penTool = {
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
  };

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
