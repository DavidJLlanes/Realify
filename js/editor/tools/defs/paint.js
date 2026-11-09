/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Herramientas de pincel: pincel, borrador, difuminar, exposición, dodge/burn y pincel de historial.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { SYMMETRY_MODES, TEXTURES, COLOR_MODES, professionalSegmentBounds, paintProfessionalSegment, smoothBrushPoint } from "../brushes.js";
import { setOverlay, scheduleCompose, beginScratch, ensureScratchRect, endScratch, discardScratch } from "../../render/compositor.js";
import { getMaskTarget, beginMaskStroke, applyMaskStroke, paintMaskDab } from "../../layers/masks.js";
import { doc, activeLayer } from "../../../core/doc.js";
import { beginPixels, expandPendingPixels, commitPixels, abortPixels } from "../../../core/history.js";
import { emit } from "../../../core/bus.js";
import "../paint.js";
import "../../../core/toast.js";
import "../../../core/snapshots.js";
import { svg, state, drawBrushCursor, requirePaintable, grayLevel, pressureScale } from "./shared.js";
import { stampGradient } from "./dab.js";
export { exposeTool, spongeTool, dodgeburnTool, historyBrushTool, smudgeTool, addDodgeBurnLayer } from "./retoque.js";
export { stampGradient, spacedSteps } from "./dab.js";

export const brushTool = {
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
        // Negro oculta, blanco revela, gris a medias (ver beginMaskStroke)
        this._mask=beginMaskStroke(l.mask,grayLevel(state.color));
        this._carry=paintProfessionalSegment(this._mask.ctx,p,p,{event:e,color:"#ffffff",size:state.size,hardness:state.hardness,opacity:state.opacity,velocity:0,carry:0,doc,seed:this._seed});
        applyMaskStroke(this._mask,dirty);
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
      if(l && getMaskTarget() === l.id && l.mask && this._mask){
        expandPendingPixels(dirty);
        this._carry=paintProfessionalSegment(this._mask.ctx,this._last,smooth,{event:e,color:"#ffffff",size:state.size,hardness:state.hardness,opacity:state.opacity,velocity,carry:this._carry,doc,seed:this._seed++});
        applyMaskStroke(this._mask,dirty);
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
      this._last = null;this._raw=null;this._smooth=null;this._carry=0;this._mask=null;
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
      this._last = null;this._raw=null;this._smooth=null;this._carry=0;this._mask=null;
      const l = activeLayer();
      if(l && getMaskTarget() === l.id && l.mask){ abortPixels(); return; }
      discardScratch();
      abortPixels();
    }
  };

export const eraserTool = {
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
  };

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

/* Segundo color del pincel de degradado: el «otro» de la pareja
   frontal/fondo respecto al que se está usando. */
function brushColor2(){ return state.color === state.fg ? state.bg : state.fg; }
