/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Herramientas de pincel: pincel, borrador, difuminar, exposición, dodge/burn y pincel de historial.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { SYMMETRY_MODES, TEXTURES, COLOR_MODES, professionalSegmentBounds, paintProfessionalSegment, smoothBrushPoint } from "../brushes.js";
import { setOverlay, scheduleCompose, beginScratch, ensureScratchRect, endScratch, discardScratch, scratchCtx, scheduleOverlay } from "../../render/compositor.js";
import { getMaskTarget, beginMaskStroke, applyMaskStroke, paintMaskDab } from "../../layers/masks.js";
import { doc, activeLayer, addLayer } from "../../../core/doc.js";
import { beginPixels, expandPendingPixels, commitPixels, abortPixels, recordLayers } from "../../../core/history.js";
import { emit } from "../../../core/bus.js";
import { dodgeBurn, makeSmudge } from "../paint.js";
import { toast } from "../../../core/toast.js";
import { brushSourceLayerFor } from "../../../core/snapshots.js";
import { svg, state, drawBrushCursor, requirePaintable, grayLevel, pressureScale } from "./shared.js";

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

export const exposeTool = {
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
  };

export const dodgeburnTool = {
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
  };

export const historyBrushTool = {
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
  };

export const smudgeTool = {
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
  };

/* ═══ pincel ═══
   Un pincel de verdad no es un círculo duro: tiene un borde con
   caída. Se consigue con un degradado radial cuyo punto de parada
   depende de la dureza. Y para que el trazo sea continuo aunque el
   ratón dé saltos, se interpolan sellos entre la posición anterior y
   la nueva, separados una fracción del diámetro. */
export function stampGradient(ctx, x, y, r, color, hardness){
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

/* Segundo color del pincel de degradado: el «otro» de la pareja
   frontal/fondo respecto al que se está usando. */
function brushColor2(){ return state.color === state.fg ? state.bg : state.fg; }
