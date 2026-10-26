/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Retoque: clonar y corrector.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { setOverlay, scheduleCompose } from "../../render/compositor.js";
import { toast } from "../../../core/toast.js";
import { beginPixels, commitPixels, abortPixels } from "../../../core/history.js";
import { doc, activeLayer } from "../../../core/doc.js";
import { cloneStamp, healSpot } from "../paint.js";
import { emit } from "../../../core/bus.js";
import { flatten } from "../../layers/layertree.js";
import { view } from "../../../core/view.js";
import { svg, requirePaintable, state, pressureScale, drawBrushCursor, cursorPos } from "./shared.js";

export const cloneTool = {
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
  };

export const healTool = {
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
  };

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
