/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Herramienta de texto y sus estilos.
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { FONTS, isText, updateText, createTextLayer, renderTextLayer, pointInText } from "../../text/text.js";
import { isEditing, cursorPos as textCursorPos, startEdit } from "../../text/textedit.js";
import { activeLayer, doc } from "../../../core/doc.js";
import { charStyles, paraStyles } from "../../text/textstyles.js";
import { setOverlay, scheduleOverlay } from "../../render/compositor.js";
import { hitHandle, beginBoxDrag, boxDragTo, endBoxDrag, drawTextBox } from "../../text/textbox.js";
import { offset, drawPx, nearest, grabDoc } from "../grab.js";
import { view } from "../../../core/view.js";
import { toast } from "../../../core/toast.js";
import { record } from "../../../core/history.js";
import { emit } from "../../../core/bus.js";
import { svg, state, HANDLE } from "./shared.js";
import { current } from "../tool-current.js";

export const textTool = {
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
          if(ph){ this._mode = "pathedit"; this._pathHandle = ph; this._editLayer = l;
                  this._off = { x: l.text.path[ph][0] - p.x, y: l.text.path[ph][1] - p.y }; return; }
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
        const q = offset(p, this._off);
        np[this._pathHandle] = [q.x, q.y];
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
  };

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
  const hs = drawPx(HANDLE) / view.zoom;
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
  const i = nearest(p, [path.p0, path.p1, path.p2], grabDoc(view.zoom, HANDLE));
  return i < 0 ? null : "p" + i;
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

export function noteStyleChange(layer){
  if(isEditing()) return;
  if(!styleBurst || styleBurst.layer !== layer){
    flushStyleBurst();
    styleBurst = { layer, before: { ...layer.text } };
  }
  clearTimeout(styleTimer);
  styleTimer = setTimeout(flushStyleBurst, 600);
}

export function flushStyleBurst(){
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
