/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Recortar, Transformación libre y Perspectiva.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { doc, cropDoc } from "../../../core/doc.js";
import { setOverlay, scheduleOverlay, scheduleCompose } from "../../render/compositor.js";
import { rectHandleOffset, offset, rectHandleAt, grabDoc, drawPx } from "../grab.js";
import { xformBegin, xformArmed, drawXformOverlay, xformHasChange, xformApply, xformRestore, xformEnd, xformDown, xformMove, xformUp, xformCancel, xformReadout } from "../transformtool.js";
import { perspBegin, drawPerspOverlay, perspHasChange, perspApply, perspRestore, perspEnd, perspDown, perspMove, perspUp, perspCancel, perspSync } from "../perspectool.js";
import { view, fit } from "../../../core/view.js";
import { snapValue, snapCandidatesX, snapCandidatesY } from "../rulers.js";
import { toast } from "../../../core/toast.js";
import { record } from "../../../core/history.js";
import { emit } from "../../../core/bus.js";
import { svg, state, inRect, HANDLE } from "./shared.js";
import { forceDiscard, setTool } from "../tool-current.js";

export const cropTool = {
    id:"crop", name:"Recortar", key:"c",
    icon: svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
    cursor:"crosshair",
    options:[
      {type:"select", key:"cropRatio", label:"Proporción", rerender:true, items:[
        ["free","Libre"],["orig","Original"],
        {group:"Clásicas",items:[
          ["1:1","1:1 · cuadrado"],["4:3","4:3 · foto / monitor"],
          ["3:2","3:2 · fotografía / portátil"],["16:9","16:9 · vídeo / pantalla"],
          ["9:16","9:16 · historia / vídeo vertical"],["2:3","2:3 · Pinterest / foto"]
        ]},
        {group:"Redes sociales",items:[
          ["4:5","4:5 · Instagram vertical"],["3:4","3:4 · publicación vertical"],
          ["191:100","1,91:1 · enlace horizontal"],["5:4","5:4 · publicación horizontal"],
          ["2:1","2:1 · cabecera / X"],["3:1","3:1 · portada / banner"],
          ["4:1","4:1 · banner panorámico"]
        ]},
        {group:"Móviles (ancho:alto)",items:[
          ["9:18","9:18 · pantalla clásica"],["9:19","9:19 · pantalla alta"],
          ["18:39","9:19,5 · pantalla alta"],["9:20","9:20 · pantalla actual"],
          ["18:41","9:20,5 · pantalla larga"],["9:21","9:21 · pantalla larga"],
          ["9:22","9:22 · pantalla extralarga"],
          ["1179:2556","1179:2556 · iPhone 16"],
          ["1320:2868","1320:2868 · iPhone 17 Pro Max"],
          ["1080:2340","1080:2340 · Galaxy S25"],
          ["1080:2424","1080:2424 · Pixel 9"]
        ]},
        {group:"Pantallas de PC",items:[
          ["16:10","16:10 · portátil"],["17:9","17:9 · cine digital"],
          ["21:9","21:9 · ultrapanorámica"],["32:9","32:9 · superultrapanorámica"]
        ]},
        ["custom","Personalizada…"]
      ]},
      {type:"number", key:"cropW", label:"", min:1, max:Number.MAX_SAFE_INTEGER, width:112,
       showIf:() => state.cropRatio === "custom"},
      {type:"static", label:":", showIf:() => state.cropRatio === "custom"},
      {type:"number", key:"cropH", label:"", min:1, max:Number.MAX_SAFE_INTEGER, width:112,
       showIf:() => state.cropRatio === "custom"},
      {type:"button", label:"⇄", title:"Girar la proporción", cmd:"crop.swap",
       showIf:() => state.cropRatio !== "free" && state.cropRatio !== "orig"},
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
      this._off = h ? rectHandleOffset(h, r, p) : null;
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
      resizeCrop(this._mode, offset(p, this._off), this._from, this._start);
      scheduleOverlay();
    },
    up(){ this._mode = null; }
  };

export const transformTool = {
    id:"transform", name:"Transformación libre", key:"f",
    icon: svg('<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="2.5 2.5"/><path d="M4 4 8 8M20 4l-4 4M4 20l4-4M20 20l-4-4"/>'),
    cursor:"default",
    options:[
      {type:"segment", key:"xfMode", label:"Modo", rerender:true, items:[
        ["free","Libre","Escala, gira, sesga y mueve con tiradores"],
        ["warp","Deformar","Rejilla de puntos que se arrastran uno a uno"]
      ]},
      {type:"number", key:"xfAngle", label:"Ángulo", min:-180, max:180, unit:"°", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"button", label:"↺ 90°", cmd:"transform.rotL", title:"Girar 90° a la izquierda",
       showIf:() => state.xfMode === "free"},
      {type:"button", label:"↻ 90°", cmd:"transform.rotR", title:"Girar 90° a la derecha",
       showIf:() => state.xfMode === "free"},
      {type:"number", key:"xfW", label:"Ancho", min:1, max:1000, unit:"%", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"number", key:"xfH", label:"Alto", min:1, max:1000, unit:"%", width:52,
       showIf:() => state.xfMode === "free"},
      {type:"toggle", key:"xfProportional", label:"⛓", title:"Ancho y alto proporcionales (o mantén Mayús al arrastrar una esquina)",
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
  };

export const perspectiveTool = {
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
      {type:"button", label:"Automático 👑", cmd:"perspective.auto",
       title:"Premium: busca solo las líneas que deben quedar rectas (OpenCV)",
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
  };

function cropHandleAt(p){
  return rectHandleAt(p, state.cropRect, grabDoc(view.zoom, HANDLE));
}

export function ratioValue(){
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
  if(!ar){
    if(mode.includes("e")) w = p.x - x;
    if(mode.includes("s")) h = p.y - y;
    if(mode.includes("w")){ w = (x + w) - p.x; x = p.x; }
    if(mode.includes("n")){ h = (y + h) - p.y; y = p.y; }
    x = Math.max(0, Math.min(x, doc.w - 8));
    y = Math.max(0, Math.min(y, doc.h - 8));
    w = Math.max(8, Math.min(w, doc.w - x));
    h = Math.max(8, Math.min(h, doc.h - y));
    state.cropRect = { x, y, w, h };
    return;
  }

  // Resize around the opposite handle (or the center of the opposite
  // edge). Derive both dimensions from one constrained size so the
  // selected aspect ratio survives snapping and canvas-edge clamping.
  let anchorX, anchorY, sx, sy, requestedW;
  if(mode.length === 2){
    sx = mode.includes("e") ? 1 : -1;
    sy = mode.includes("s") ? 1 : -1;
    anchorX = sx > 0 ? start.x : start.x + start.w;
    anchorY = sy > 0 ? start.y : start.y + start.h;
    const dx = (p.x - anchorX) * sx;
    const dy = (p.y - anchorY) * sy;
    requestedW = Math.max(0, ar * (dx * ar + dy) / (ar * ar + 1));
  } else if(mode === "e" || mode === "w"){
    sx = mode === "e" ? 1 : -1;
    anchorX = mode === "e" ? start.x : start.x + start.w;
    anchorY = start.y + start.h / 2;
    requestedW = (p.x - anchorX) * sx;
  } else {
    sy = mode === "s" ? 1 : -1;
    anchorX = start.x + start.w / 2;
    anchorY = mode === "s" ? start.y : start.y + start.h;
    requestedW = (p.y - anchorY) * sy * ar;
  }
  const minW = Math.max(8, 8 * ar);
  let maxW;
  if(mode.length === 2){
    maxW = Math.min(sx < 0 ? anchorX : doc.w - anchorX,
                    (sy < 0 ? anchorY : doc.h - anchorY) * ar);
  } else if(mode === "e" || mode === "w"){
    maxW = Math.min(mode === "w" ? anchorX : doc.w - anchorX,
                    2 * Math.min(anchorY, doc.h - anchorY) * ar);
  } else {
    maxW = Math.min(2 * Math.min(anchorX, doc.w - anchorX),
                    (mode === "n" ? anchorY : doc.h - anchorY) * ar);
  }
  w = Math.max(Math.min(minW, maxW), Math.min(requestedW, maxW));
  h = w / ar;
  if(mode.length === 2){
    x = sx > 0 ? anchorX : anchorX - w;
    y = sy > 0 ? anchorY : anchorY - h;
  } else if(mode === "e" || mode === "w"){
    x = sx > 0 ? anchorX : anchorX - w;
    y = anchorY - h / 2;
  } else {
    x = anchorX - w / 2;
    y = sy > 0 ? anchorY : anchorY - h;
  }
  state.cropRect = { x, y, w, h };
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
  const s = drawPx(HANDLE) / view.zoom;
  ctx.fillStyle = "#e8a33d";
  for(const [hx, hy] of [[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]]){
    ctx.fillRect(r.x + r.w * hx - s / 2, r.y + r.h * hy - s / 2, s, s);
  }
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
  finishAppliedTool();
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
  return { id: l.id, c: copy(l.canvas), m: l.mask ? copy(l.mask.canvas) : null, hi: l.hiSrc };   // los 16 bits (core/hisrc.js), por referencia
}

function restoreAll(snaps, w, h){
  doc.w = w; doc.h = h;
  for(const s of snaps){
    const l = doc.layers.find(x => x.id === s.id);
    if(!l) continue;
    l.canvas.width = w; l.canvas.height = h;
    l.ctx.drawImage(s.c, 0, 0);
    if(s.hi) l.hiSrc = s.hi; else delete l.hiSrc;
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

/* Flujo común de las herramientas que tienen botón «Aplicar»:
   confirmar → salir a Mover → enseñar la foto completa. */
export function finishAppliedTool(){
  setTool("move", { auto:true });
  fit();
}

/* ═══ perspectiva ═══
   Toda la lógica vive en perspectool.js; aquí sólo queda el puente
   entre el `state` que lee la barra de opciones y el módulo, y los
   comandos que invocan sus botones. */
export function syncPersp(){
  perspSync({
    mode: state.perspMode,
    showGrid: !!state.perspGrid,
    vert: state.perspVert,
    horz: state.perspHorz,
    rot: state.perspRot,
    scale: state.perspScale
  });
}

/* ═══ Transformación libre ═══ */

/* Copia lo que hay en xform.* (ángulo en radianes, escala en tanto
   por uno) a las unidades que enseña la barra —grados, porcentaje— y
   repinta la barra entera. Se llama tras cada gesto de arrastre, NO
   desde el propio campo numérico cuando el usuario teclea en él: eso
   reconstruiría el campo a medio escribir y le quitaría el foco. */
export function syncXformFields(){
  const r = xformReadout();
  state.xfW = r.w; state.xfH = r.h;
  state.xfAngle = r.angle; state.xfSkewX = r.skewX; state.xfSkewY = r.skewY;
  emit("tool:options");
}
