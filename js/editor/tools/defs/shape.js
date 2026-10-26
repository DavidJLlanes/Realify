/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Herramienta de formas.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { setOverlay, beginScratch, scheduleOverlay, scratchCtx, scheduleCompose, endScratch, discardScratch } from "../../render/compositor.js";
import { beginPixels, commitPixels, abortPixels } from "../../../core/history.js";
import { activeLayer, doc } from "../../../core/doc.js";
import { isShapeLayer, previewShapeParams, addShapeLayer, renderShapeLayer, setShapeParams } from "../../layers/layercontent.js";
import { toast } from "../../../core/toast.js";
import { rectHandleOffset, offset, rectHandleAt, grabDoc, drawPx } from "../grab.js";
import { drawShape } from "../paint.js";
import { emit } from "../../../core/bus.js";
import { view } from "../../../core/view.js";
import { svg, state, requirePaintable, inRect, HANDLE } from "./shared.js";
import { current } from "../tool-current.js";

export const shapeTool = {
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
          this._off = onRadius ? { x: shapeRadiusHandleX(s) - p.x, y: 0 }
                    : onHandle ? rectHandleOffset(onHandle, s, p) : null;
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
        previewShapeParams(this._editLayer, resizeShape(this._mode, offset(p, this._off), this._from, this._editBefore));
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
  };

/* ── edición en el lienzo de una capa de forma ya creada ─────────
   Mismas ocho asas que Recortar (arriba), pero sobre `layer.shape` en
   vez de `state.cropRect`, más una novena propia de un rectángulo: el
   radio de esquina, como un tirador aparte sobre el borde superior a
   la distancia que representa el radio actual —arrastrarlo a la
   derecha lo agranda, a la izquierda lo achica, sin salirse nunca de
   0..mitad del lado corto—. */
function shapeHandleAt(p, s){
  return rectHandleAt(p, s, grabDoc(view.zoom, HANDLE));
}

function shapeRadiusHandleX(s){
  return s.x + Math.max(0, Math.min(s.radius || 0, Math.min(s.w, s.h) / 2));
}

function shapeRadiusHandleAt(p, s){
  if(s.kind !== "rect") return false;
  const t = grabDoc(view.zoom, HANDLE);
  return Math.hypot(p.x - shapeRadiusHandleX(s), p.y - s.y) < t;
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

  const hs = drawPx(HANDLE) / view.zoom;
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
