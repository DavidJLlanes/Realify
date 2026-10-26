/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Herramientas de vista y comparación: Mano, Lupa, Cuentagotas y Comparar antes/después.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { setOverlay, scheduleOverlay, pickColor, compose } from "../../render/compositor.js";
import { view, zoomToRect, zoomAt } from "../../../core/view.js";
import { emit, on } from "../../../core/bus.js";
import { toast } from "../../../core/toast.js";
import { isP3Doc } from "../../../core/colorspace.js";
import { doc } from "../../../core/doc.js";
import { COARSE } from "../../../core/device.js";
import { flatten } from "../../layers/layertree.js";
import { svg, normRect, state } from "./shared.js";
import { current } from "../tool-current.js";

export const panTool = {
    id:"pan", name:"Mano", key:"h",
    icon: svg('<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
    cursor:"grab",
    pan:true,
    options:[]
  };

export const zoomTool = {
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
  };

export const pickerTool = {
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
      toast("Color " + state.color + (isP3Doc() ? " (Display P3)" : ""));
    }
  };

export const compareTool = {
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
  };

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

/* ═══ comparar ═══
   Una única instantánea de cómo se veía el documento nada más
   abrirlo, capturada una sola vez —al recibir «doc:new»— y nunca
   vuelta a tocar: lo que importa aquí es comparar con el ORIGINAL,
   no con el estado de hace un momento. Si el lienzo cambia de tamaño
   después (recortar, redimensionar), la instantánea se sigue
   dibujando estirada al tamaño actual con el mismo criterio que ya
   usa `resizeDoc` para cada capa, en vez de intentar adivinar qué
   parte de la instantánea corresponde a qué parte del recorte. */
export let cmpOriginal = null;   // <canvas> o null si aún no hay documento

export let cmpActive = false;    // aparte de qué herramienta esté activa: ver nota en deactivate()

function cmpCapture(){
  // Sólo se suelta la referencia: el lienzo anterior puede seguir siendo
  // el «antes» de otra pestaña (guardado con ella, ver documents.js).
  cmpOriginal = null;
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

/* Al cambiar a otro documento (editor/documents.js), el «antes» de
   Comparar tiene que dejar de ser el de la pestaña que se acaba de
   abandonar: activarlo con `!cmpOriginal` de más abajo volverá a
   capturarlo sobre lo que se esté viendo ahora en cuanto haga falta. */
export function invalidateCompareBaseline(){ cmpOriginal = null; }

export function setCompareBaseline(c){ cmpOriginal = c || null; if(cmpActive) scheduleOverlay(); }

/* Se captura un instante DESPUÉS de «doc:new»: muchos documentos se
   crean vacíos y se pintan justo a continuación (resultado de un
   plugin, un collage, un PSD con sus capas…); capturar en el propio
   evento guardaba un «antes» transparente. */
let cmpPending = 0;

on("doc:new", () => {
  const t = ++cmpPending;
  cmpOriginal = null;
  setTimeout(() => { if(t === cmpPending && doc.open && !cmpOriginal) cmpCapture(); }, 0);
});

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
