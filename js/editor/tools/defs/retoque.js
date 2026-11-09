/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS DE RETOQUE · exponer, esponja, quemar/aclarar, dedo y pincel de historia
   Objetos de herramienta del lienzo (se añaden a TOOLS en tools.js). Entradas: eventos del puntero. Salida: píxeles de la capa activa.
   ═══════════════════════════════════════════════════════════════ */

import { svg, drawBrushCursor, requirePaintable, state, pressureScale } from "./shared.js";
import { setOverlay, scheduleCompose, beginScratch, scratchCtx, scheduleOverlay, endScratch, discardScratch } from "../../render/compositor.js";
import { beginPixels, commitPixels, abortPixels, recordLayers } from "../../../core/history.js";
import { dodgeBurn, sponge, makeSmudge } from "../paint.js";
import { activeLayer, doc, addLayer } from "../../../core/doc.js";
import { emit } from "../../../core/bus.js";
import { toast } from "../../../core/toast.js";
import { brushSourceLayerFor } from "../../../core/snapshots.js";
import { spacedSteps, stampGradient } from "./dab.js";

export const exposeTool = {
    id:"expose", name:"Exponer", key:"o",
    icon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M3 12h1"/><path d="M20 12h1"/><path d="m18.364 5.636-.707.707"/><path d="m6.343 17.657-.707.707"/><path d="m5.636 5.636.707.707"/><path d="m17.657 17.657.707.707"/>'),
    cursor:"none",
    options:[
      {type:"segment", key:"exposeMode", items:[
        ["dodge","\u2600","Sobreexponer: aclarar"],
        ["burn","\u25D0","Subexponer: oscurecer"]
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

export const spongeTool = {
    // Sin tecla propia (todas las letras están repartidas): se elige en la barra lateral.
    id:"sponge", name:"Esponja (desaturar / saturar)",
    icon: svg('<path d="M5 14c0-3 2-5 5-5h4c3 0 5 2 5 5v1a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><circle cx="9" cy="14" r=".8" fill="currentColor"/><circle cx="13" cy="15" r=".8" fill="currentColor"/><circle cx="16" cy="13" r=".8" fill="currentColor"/><path d="M12 3v3"/>'),
    cursor:"none",
    options:[
      {type:"segment", key:"spongeMode", items:[
        ["desat","−","Desaturar: quita color donde pintes"],
        ["sat","+","Saturar: da color donde pintes"]
      ]},
      {type:"range", key:"size", label:"Tamaño", min:1, max:400, unit:"px"},
      {type:"range", key:"hardness", label:"Dureza", min:0, max:100, unit:"%"},
      {type:"range", key:"strength", label:"Fuerza", min:1, max:100, unit:"%"}
    ],
    activate(){ setOverlay(drawBrushCursor); },
    deactivate(){ setOverlay(null); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      beginPixels(state.spongeMode === "sat" ? "Esponja: saturar" : "Esponja: desaturar", l);
      this._last = p; this._carry = 0;
      sponge(l.ctx, p.x, p.y, state.size / 2 * pressureScale(e), state.hardness, state.strength * 0.5, state.spongeMode);
      scheduleCompose();
    },
    move(p, e){
      if(!this._last) return;
      const l = activeLayer(), scale = pressureScale(e), step = Math.max(1, state.size * 0.2);
      const { points, carry } = spacedSteps(this._last.x, this._last.y, p.x, p.y, step, this._carry);
      for(const pt of points) sponge(l.ctx, pt.x, pt.y, state.size / 2 * scale, state.hardness, state.strength * 0.5, state.spongeMode);
      this._carry = carry; this._last = p; l.thumbDirty = true; scheduleCompose();
    },
    up(){ if(!this._last) return; this._last = null; commitPixels(); emit("doc:structure"); },
    cancel(){ if(!this._last) return; this._last = null; abortPixels(); }
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
