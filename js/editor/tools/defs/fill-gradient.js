/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Relleno y degradado.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../../../core/doc.js";
import { beginPixels, commitPixels, abortPixels, cancelPixels } from "../../../core/history.js";
import { floodFill, hexToRgb, drawGradient } from "../paint.js";
import { toast } from "../../../core/toast.js";
import { emit } from "../../../core/bus.js";
import { scheduleCompose, beginScratch, scratchCtx, endScratch, discardScratch } from "../../render/compositor.js";
import { getMaskTarget, cloneMask, paintMaskGradient } from "../../layers/masks.js";
import { svg, requirePaintable, state, grayLevel } from "./shared.js";

export const fillTool = {
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
  };

export const gradientTool = {
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
  };

/* El bote de pintura abre una entrada de historial antes de saber si
   va a pintar algo; si no pinta, hay que cerrarla sin dejar un paso
   vacío en la lista. */
function cancelPixelsSafe(){
  try{ cancelPixels(); }catch(e){}
}
