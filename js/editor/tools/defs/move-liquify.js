/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS · Mover, Licuar y Mover según contenido (comparten el aviso «selfCommit»).
   Parte de js/editor/tools/tools.js (el registro de herramientas, que las reúne en TOOLS y reexporta su API).
   ═══════════════════════════════════════════════════════════════ */

import { setOverlay, scheduleOverlay, scheduleCompose } from "../../render/compositor.js";
import { activeLayer, doc } from "../../../core/doc.js";
import { toast } from "../../../core/toast.js";
import { isFillLayer, isShapeLayer } from "../../layers/layercontent.js";
import { isText, updateText, textBounds } from "../../text/text.js";
import { contentBounds, otherLayersEdgeCandidates } from "../../align.js";
import { beginPixels, record, cancelPixels, commitPixels, abortPixels } from "../../../core/history.js";
import { snapToGridEnabled, gridStep, snapCandidatesX, snapCandidatesY, snapRange } from "../rulers.js";
import { view } from "../../../core/view.js";
import { emit, on } from "../../../core/bus.js";
import { boundsOf } from "../../selection/selection.js";
import { moveContentAware } from "../contentmove.js";
import { makeGrid, renderLiquify, applyStroke, relaxGrid, isIdentityGrid, resetGrid } from "../liquify.js";
import { COARSE } from "../../../core/device.js";
import { svg, requirePaintable, drawSnapLines, state, cursorPos } from "./shared.js";
import { current, setTool } from "../tool-current.js";
import { invalidateCompareBaseline } from "./navigation.js";

/* ═══ definición de herramientas ═══ */
export const moveTool = {
    id:"move", name:"Mover", key:"v",
    icon: svg('<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>'),
    cursor:"move",
    options:[],
    activate(){ setOverlay(drawMoveSnapOverlay); },
    deactivate(){ setOverlay(null); this._snapX = null; this._snapY = null; },
    down(p, e){
      const l = activeLayer();
      if(!l) return;
      if(l.locked){ toast("La capa está bloqueada"); return; }
      /* Arrastrar píxeles de una capa de relleno o de forma los
         desalinearía de `fill`/`shape` —la próxima vez que se tocara
         un mando del panel de Propiedades, volverían a dibujarse en su
         sitio de ANTES del arrastre, como si nunca se hubieran
         movido—. Una forma se reposiciona arrastrándola con la propia
         herramienta Formas (U); un relleno no tiene «sitio» que mover. */
      if(isFillLayer(l) || isShapeLayer(l)){
        toast(isShapeLayer(l)
          ? `Arrastra «${l.name}» con la herramienta Formas (U), no con Mover.`
          : `«${l.name}» rellena todo el lienzo: no hay nada que mover.`, "err");
        return;
      }
      /* Un texto en trazado no se coloca por `x`/`y` —esos dos sólo
         sirven de ancla para el cuadro de edición—, sino por los tres
         puntos de `text.path`: arrastrarlo con Mover cambiaría esa
         ancla sin tocar la curva, y las letras (que sí siguen la
         curva) se quedarían quietas mientras el cursor se aleja. Se
         mueve arrastrando sus propias asas con la herramienta Texto. */
      if(isText(l) && l.text.path){
        toast(`Arrastra las asas de «${l.name}» con la herramienta Texto (T), no con Mover.`, "err");
        return;
      }
      const box = contentBounds(l);
      if(!box){ toast("La capa está vacía"); return; }
      /* Cada arrastre empieza SIEMPRE en cero. Antes no se
         reiniciaban y un clic sin mover volvía a aplicar el
         desplazamiento del arrastre anterior, descuadrando el búfer
         respecto a lo dibujado. */
      this._dx = 0; this._dy = 0;
      this._box = box;
      this._snapX = null; this._snapY = null;
      /* Los bordes y centros de las DEMÁS capas, calculados una sola
         vez al empezar el arrastre —recorrer el canal alfa de cada
         capa en cada fotograma de un arrastre sería tirar el tiempo—.
         Si otra capa se mueve o cambia mientras tanto, no se entera
         hasta el siguiente arrastre, que es un precio razonable por
         no recalcular sesenta veces por segundo. */
      this._layerCand = otherLayersEdgeCandidates(doc.layers, l.id);
      /* Una capa de texto se mueve cambiando sus coordenadas, no sus
         píxeles: si se desplazaran los píxeles, el primer retoque del
         texto lo volvería a dibujar en su sitio de origen y saltaría
         de vuelta. */
      this._text = isText(l) ? { x: l.text.x, y: l.text.y } : null;
      if(!this._text){
        if(!moveBufFor(l)) return;
        beginPixels("Mover capa", l);
      }
      this._from = p;
    },
    move(p){
      if(!this._from) return;
      const l = activeLayer();
      if(!l) return;
      let rdx = Math.round(p.x - this._from.x);
      let rdy = Math.round(p.y - this._from.y);

      /* Guías inteligentes, como en Photoshop: el contenido que se
         arrastra se ajusta contra los bordes y el centro del
         documento, contra cualquier guía puesta a mano, contra los
         bordes y centros de otras capas y contra la cuadrícula si
         está activo su ajuste —probando los dos bordes Y el centro
         del propio contenido, no sólo el centro—, en cuanto cualquiera
         de ellos cae dentro de tolerancia en pantalla. */
      const box = this._box;
      const guides = { h: doc.guides.h, v: doc.guides.v };
      const gStep = snapToGridEnabled() ? gridStep() : 0;
      const candX = snapCandidatesX(doc.w, guides, this._layerCand.x);
      const candY = snapCandidatesY(doc.h, guides, this._layerCand.y);
      const sx = snapRange(box.x + rdx, box.x + box.w + rdx, candX, 6, view.zoom, gStep);
      const sy = snapRange(box.y + rdy, box.y + box.h + rdy, candY, 6, view.zoom, gStep);
      rdx = Math.round(rdx + sx.offset);
      rdy = Math.round(rdy + sy.offset);
      this._snapX = sx.at;
      this._snapY = sy.at;

      if(this._text){
        const c = clampMove(this._box, doc.w, doc.h, rdx, rdy);
        this._dx = c.dx; this._dy = c.dy;
        updateText(l, { x: this._text.x + c.dx, y: this._text.y + c.dy });
      } else {
        this._dx = rdx; this._dy = rdy;
        moveDraw(l, rdx, rdy);
        l.thumbDirty = true;
      }
      scheduleOverlay();
      scheduleCompose();
    },
    up(){
      if(!this._from) return;
      const l = activeLayer();
      const from = this._text;
      const dx = this._dx || 0, dy = this._dy || 0;
      this._from = null; this._dx = 0; this._dy = 0;
      this._box = null; this._text = null;
      this._snapX = null; this._snapY = null;
      scheduleOverlay();
      if(!l) return;

      if(from){
        if(!dx && !dy) return;                 // un clic no es un paso de historial
        const to = { x: from.x + dx, y: from.y + dy };
        updateText(l, to);
        record("Mover texto",
          () => updateText(l, { x: from.x, y: from.y }),
          () => updateText(l, to));
        emit("doc:structure");
        return;
      }

      if(!dx && !dy){ cancelPixels(); return; }
      const applied = moveDraw(l, dx, dy);
      if(applied && moveBuf && moveBuf.layerId === l.id){
        moveBuf.dx = applied.dx; moveBuf.dy = applied.dy;
      }
      selfCommit = "move";
      commitPixels();
      selfCommit = null;
      emit("doc:structure");
    },
    cancel(){
      if(!this._from) return;
      const l = activeLayer();
      const from = this._text;
      this._from = null; this._dx = 0; this._dy = 0;
      this._box = null; this._text = null;
      this._snapX = null; this._snapY = null;
      scheduleOverlay();
      if(from){ if(l) updateText(l, { x: from.x, y: from.y }); return; }
      moveDraw(l, 0, 0);       // vuelve a como estaba antes de este arrastre
      abortPixels();
    },
    /* Flechas del teclado: un paso de 1 píxel (10 con Alt), como en
       Photoshop. Sin guías inteligentes ni arrastre de por medio —sólo
       un desplazamiento exacto—, así que no reutiliza down/move/up
       (que sí ajustan a guías) sino que aplica el movimiento directo y
       lo registra como un único paso de historial. */
    nudge(dx, dy){
      if(this._from) return;          // no interferir con un arrastre en curso
      const l = activeLayer();
      if(!l) return;
      if(l.locked){ toast("La capa está bloqueada"); return; }
      if(isText(l)){
        const from = { x: l.text.x, y: l.text.y };
        const to = { x: from.x + dx, y: from.y + dy };
        updateText(l, to);
        record("Mover texto",
          () => updateText(l, from),
          () => updateText(l, to));
        emit("doc:structure");
        return;
      }
      if(!contentBounds(l)) return;    // capa vacía
      if(!moveBufFor(l)) return;
      beginPixels("Mover capa", l);
      const applied = moveDraw(l, dx, dy);
      if(applied && moveBuf && moveBuf.layerId === l.id){
        moveBuf.dx = applied.dx; moveBuf.dy = applied.dy;
      }
      l.thumbDirty = true;
      selfCommit = "move";
      commitPixels();
      selfCommit = null;
      emit("doc:structure");
    }
  };

export const camoveTool = {
    /* Sin letra propia: la X es la de intercambiar colores frontal y de
       fondo (main.js), como en Photoshop, y con las dos a la vez una
       sola pulsación cambiaba de herramienta Y daba la vuelta a los
       colores. Se llega desde Selección > Mover según el contenido. */
    id:"camove", name:"Mover según el contenido",
    icon: svg('<path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20" stroke-dasharray="2.5 2.5"/>'),
    cursor:"move",
    options:[],
    // El propio arrastre no toca la capa —sólo un dibujo aparte en el
    // overlay, encima del lienzo—: la capa real se mueve de una vez,
    // ya con el hueco relleno, al soltar. Así un arrastre que se
    // cancela a medias (Esc, o soltar fuera del lienzo) no deja nada
    // que deshacer.
    activate(){ setOverlay(drawCAMoveOverlay); },
    deactivate(){ setOverlay(null); this._cam = null; },
    down(p){
      if(!doc.selection){ toast("Selecciona primero lo que quieras mover"); return; }
      const l = requirePaintable();
      if(!l) return;
      const bounds = boundsOf(doc.selection.mask, doc.w, doc.h);
      if(!bounds){ toast("La selección está vacía"); return; }
      const mx = Math.round(p.x), my = Math.round(p.y);
      if(mx < 0 || my < 0 || mx >= doc.w || my >= doc.h || doc.selection.mask[my*doc.w+mx] < 20){
        toast("Arrastra desde dentro de la selección"); return;
      }

      // Vista previa: sólo el contenido seleccionado, con su propia
      // máscara como alfa, para que el overlay muestre la pieza suelta
      // tal como quedaría —no un rectángulo entero—.
      const float = document.createElement("canvas");
      float.width = bounds.w; float.height = bounds.h;
      const fx = float.getContext("2d");
      fx.drawImage(l.canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
      const fImg = fx.getImageData(0, 0, bounds.w, bounds.h);
      for(let y = 0; y < bounds.h; y++) for(let x = 0; x < bounds.w; x++){
        fImg.data[(y*bounds.w+x)*4+3] = doc.selection.mask[(bounds.y+y)*doc.w + (bounds.x+x)];
      }
      fx.putImageData(fImg, 0, 0);

      this._cam = { layer:l, bounds, from:p, dx:0, dy:0, float };
    },
    move(p){
      if(!this._cam) return;
      this._cam.dx = Math.round(p.x - this._cam.from.x);
      this._cam.dy = Math.round(p.y - this._cam.from.y);
      scheduleOverlay();
    },
    up(){
      if(!this._cam) return;
      const cam = this._cam;
      this._cam = null;
      scheduleOverlay();
      if(!cam.dx && !cam.dy) return;   // un clic sin arrastre no mueve nada
      moveContentAware(cam.layer, doc.selection.mask, cam.bounds, cam.dx, cam.dy);
    },
    cancel(){ this._cam = null; scheduleOverlay(); }
  };

export const liquifyTool = {
    /* En Q, no en X: X queda libre para el atajo de intercambiar
       frontal/fondo (ver swapColors en main.js), igual que en
       Photoshop. */
    id:"liquify", name:"Licuar", key:"q",
    icon: svg('<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>'),
    cursor:"none",
    options:[
      {type:"segment", key:"liqMode", items:[
        ["push","↝","Empujar: arrastra en la dirección del gesto"],
        ["pinch","◐","Fruncir: encoge hacia el centro del pincel"],
        ["bloat","◑","Hinchar: expande desde el centro del pincel"],
        ["twirl","⟲","Remolino: gira alrededor del centro del pincel"]
      ]},
      {type:"range", key:"liqSize", label:"Tamaño", min:10, max:600, unit:"px"},
      {type:"range", key:"liqStrength", label:"Fuerza", min:1, max:100, unit:"%"},
      {type:"range", key:"liqVolume", label:"Conservar volumen", min:0, max:100, unit:"%"},
      {type:"button", label:"Restablecer", cmd:"liquify.reset"}
    ],
    activate(){ setOverlay(drawLiquifyCursor); },
    deactivate(){ setOverlay(null); liqSessionEnd(); },
    down(p, e){
      const l = requirePaintable();
      if(!l) return;
      liqSessionBegin(l);
      this._backup = liqGridSnapshot();
      this._last = p;
      beginPixels("Licuar", l);
    },
    move(p, e){
      if(!this._last) return;
      const l = activeLayer();
      liqSessionStroke(l, this._last, p);   // barato: en todos los eventos, sin perder ninguno
      this._last = p;
      l.thumbDirty = true;
      if(liqPend) return;
      liqPend = true;
      requestAnimationFrame(() => {         // caro: colapsado, como mucho una vez por fotograma
        liqPend = false;
        liqRedraw(l, false);
        scheduleCompose();
      });
    },
    up(){
      if(!this._last) return;
      this._last = null; this._backup = null;
      const l = activeLayer();
      // Redibujado final a resolución completa: el de arrastre pudo
      // haber sido sobre un proxy reducido, y lo que se guarda en el
      // historial no debe perder nitidez por eso.
      liqRedraw(l, true);
      l.thumbDirty = true;
      selfCommit = "liquify";
      commitPixels();
      selfCommit = null;
      emit("doc:structure");
      scheduleCompose();
    },
    cancel(){
      if(!this._last) return;
      this._last = null;
      liqSessionRestore(activeLayer(), this._backup);
      this._backup = null;
      abortPixels();
    }
  };

function drawMoveSnapOverlay(ctx){
  const t = current;
  if(t.id !== "move") return;
  drawSnapLines(ctx, t._snapX, t._snapY);
}

/* La pieza suelta de «Mover según el contenido», siguiendo el
   arrastre: sólo un dibujo por encima del lienzo, la capa real no se
   toca hasta soltar (ver la propia herramienta, más arriba). */
function drawCAMoveOverlay(ctx){
  const t = current;
  if(t.id !== "camove" || !t._cam) return;
  const cam = t._cam;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.drawImage(cam.float, cam.bounds.x + cam.dx, cam.bounds.y + cam.dy);
  ctx.restore();
  const px = 1 / view.zoom;
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = px;
  ctx.setLineDash([4*px, 3*px]);
  ctx.strokeRect(cam.bounds.x + cam.dx + 0.5, cam.bounds.y + cam.dy + 0.5, cam.bounds.w, cam.bounds.h);
  ctx.setLineDash([]);
}

/* ═══ mover ═══
   Cada capa mide exactamente lo que el documento, así que lo que se
   arrastra más allá de su borde se recorta al dibujarlo: es cómo
   funciona `drawImage` sobre un lienzo de tamaño fijo, y sin más
   significaría que empujar una foto hacia un lado y soltar BORRA para
   siempre lo que quedó fuera.

   Agrandar el lienzo de la capa no es opción —obligaría a que cada
   herramienta, filtro y ajuste supiera trabajar con capas mayores que
   el documento y desplazadas de su origen—. Lo que se hace en su
   lugar son dos cosas que juntas cierran el agujero:

   1. Un BÚFER con el contenido de la capa (sólo su caja ajustada, no
      el lienzo entero: ni un byte de más) que se conserva mientras
      nada ajeno toque esa capa. La capa se REDIBUJA siempre desde ese
      búfer, nunca desde lo que quedó dibujado la vez anterior, así
      que empujar hacia fuera y traer de vuelta —en el mismo arrastre
      o en otro más tarde— devuelve exactamente los mismos píxeles.

   2. Un TOPE: el desplazamiento se recorta para que siempre quede un
      trozo del contenido dentro del lienzo. Como la caja no puede
      salir entera, nunca se llega al caso de «la capa desapareció y
      no hay forma de agarrarla»; y como el tope se aplica al
      desplazamiento TOTAL acumulado, tampoco se escapa a base de
      arrastres pequeños encadenados.

   Lo que sigue teniendo límite: si entre medias se pinta, se aplica
   un filtro o se deshace algo, el búfer se descarta y lo que en ese
   momento estuviera fuera del lienzo sí queda recortado de verdad.
   Eso es inherente a que la capa mida lo que el documento. */

/* Cuánto contenido tiene que seguir dentro del lienzo, por eje. */
export function moveKeep(size){
  return Math.max(1, Math.min(size, Math.max(24, Math.round(size * 0.12))));
}

/* Recorta un desplazamiento para que la caja `b` —en coordenadas de
   documento, sin mover— no pueda salir entera del lienzo. Pura, para
   poder comprobar la geometría con números sueltos. */
export function clampMove(b, docW, docH, dx, dy){
  const kx = moveKeep(b.w), ky = moveKeep(b.h);
  // El borde derecho no baja de kx; el izquierdo no pasa de docW-kx.
  let minDx = kx - b.x - b.w, maxDx = docW - kx - b.x;
  let minDy = ky - b.y - b.h, maxDy = docH - ky - b.y;
  // Contenido más ancho que el propio lienzo: el rango se cruza y la
  // única posición coherente es la del medio.
  if(minDx > maxDx){ const m = (minDx + maxDx) / 2; minDx = maxDx = m; }
  if(minDy > maxDy){ const m = (minDy + maxDy) / 2; minDy = maxDy = m; }
  return {
    dx: Math.round(Math.min(maxDx, Math.max(minDx, dx))),
    dy: Math.round(Math.min(maxDy, Math.max(minDy, dy)))
  };
}

let moveBuf = null;          // { layerId, buf, x, y, w, h, dx, dy }

/* ── invalidación de las memorias de sesión ──────────────────────
   Mover y Licuar guardan cada uno una copia de los píxeles de la capa
   de antes de empezar, y REDIBUJAN la capa desde esa copia en cada
   gesto. Eso las obliga a enterarse de cualquier cambio que venga por
   otro camino —otra herramienta, un filtro, deshacer, rehacer—: si no,
   siguen partiendo de una foto vieja y resucitan lo que el usuario
   acababa de deshacer.

   `selfCommit` dice cuál de las dos está publicando SU propio paso en
   ese instante, que es el único caso en que la memoria correspondiente
   sigue siendo válida. Nótese que un commit de Mover sí invalida la
   sesión de Licuar (y al revés): los dos cambian píxeles de la capa.
   Se enciende y se apaga alrededor del commit en vez de dejar que lo
   consuma el oyente: si `commitPixels()` no llegara a publicar nada,
   una marca encendida se quedaría esperando y se tragaría el siguiente
   cambio ajeno, que es justo el que hay que escuchar. */
let selfCommit = null;       // "move" | "liquify" | null

on("history:change", () => {
  if(selfCommit !== "move")    moveBuf = null;
  if(selfCommit !== "liquify") liqSession = null;
});

on("doc:resize", () => { moveBuf = null; liqSession = null; });

/* Al cerrar el documento estas copias se quedaban en memoria sujetando
   un lienzo entero de un documento que ya no existe. */
on("doc:structure", () => {
  if(doc.open) return;
  moveBuf = null; liqSession = null; invalidateCompareBaseline();
  // Sin documento no queda nada que comparar ni superposición que
  // mantener: se sale de Comparar y se limpia su capa (si no, la última
  // comparación se quedaba pintada sobre la pantalla de inicio).
  if(current && current.id === "compare") setTool("move");
  scheduleOverlay();
});

function moveBufFor(layer){
  if(moveBuf && moveBuf.layerId === layer.id) return moveBuf;
  const b = contentBounds(layer);
  if(!b) return null;                       // capa vacía: no hay nada que mover
  const buf = document.createElement("canvas");
  buf.width = b.w; buf.height = b.h;
  buf.getContext("2d").drawImage(layer.canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  moveBuf = { layerId: layer.id, buf, x: b.x, y: b.y, w: b.w, h: b.h, dx: 0, dy: 0 };
  return moveBuf;
}

/* Redibuja la capa entera desde el búfer, con el desplazamiento total
   (lo ya confirmado más lo del arrastre en curso) recortado por el
   tope. Devuelve el desplazamiento que de verdad se ha aplicado. */
function moveDraw(layer, pdx, pdy){
  const m = moveBuf;
  if(!m || !layer || m.layerId !== layer.id) return null;
  const c = clampMove(m, doc.w, doc.h, m.dx + pdx, m.dy + pdy);
  layer.ctx.save();
  layer.ctx.globalCompositeOperation = "copy";
  layer.ctx.clearRect(0, 0, doc.w, doc.h);
  layer.ctx.drawImage(m.buf, m.x + c.dx, m.y + c.dy);
  layer.ctx.restore();
  return c;
}

/* Doble clic en el icono de Mover: centra el contenido de la capa
   activa en el lienzo, la convención de Photoshop para «traer de
   vuelta» algo que se ha arrastrado fuera de sitio, en vez de tener
   que ir corrigiendo el arrastre a ojo. Con una capa de texto se
   cambian sus coordenadas, igual que hace la propia herramienta. */
export function centerActiveLayerContent(){
  const l = activeLayer();
  if(!l) return;
  if(l.locked){ toast("La capa está bloqueada"); return; }
  if(isFillLayer(l) || isShapeLayer(l)){
    toast(isShapeLayer(l) ? `Arrastra «${l.name}» con la herramienta Formas (U) en vez de centrarla.`
                           : `«${l.name}» rellena todo el lienzo: no hay nada que centrar.`, "err");
    return;
  }

  if(isText(l)){
    const b = textBounds(l);
    if(!b) return;
    const from = { x: l.text.x, y: l.text.y };
    const to = {
      x: from.x + Math.round((doc.w - b.w) / 2 - b.x),
      y: from.y + Math.round((doc.h - b.h) / 2 - b.y)
    };
    if(to.x === from.x && to.y === from.y) return;
    updateText(l, to);
    record("Centrar capa",
      () => updateText(l, from),
      () => updateText(l, to));
    emit("doc:structure");
    return;
  }

  const box = contentBounds(l);
  if(!box){ toast("La capa está vacía"); return; }
  const dx = Math.round((doc.w - box.w) / 2) - box.x;
  const dy = Math.round((doc.h - box.h) / 2) - box.y;
  if(!dx && !dy) return;

  beginPixels("Centrar capa", l);
  moveBuf = null;                 // fuerza un búfer fresco desde `box`, no uno viejo
  if(!moveBufFor(l)){ cancelPixels(); return; }
  moveDraw(l, dx, dy);
  l.thumbDirty = true;
  selfCommit = "move";
  commitPixels();
  selfCommit = null;
  moveBuf = null;
  scheduleCompose();
  emit("doc:structure");
}

/* ═══ licuar ═══
   Una única rejilla de control por sesión (mientras la herramienta se
   queda activa en la misma capa), a resolución fija: cada trazo la
   deforma un poco más y cada fotograma se redibuja la capa entera
   desde la imagen ORIGINAL —tomada al empezar la sesión— siguiendo la
   rejilla tal como está en ese momento. Redibujar siempre desde el
   original evita que sucesivos trazos emborronen la imagen
   reinterpolando una interpolación anterior.

   El redibujo es la parte cara: cada celda de la rejilla son dos
   `ctx.clip()+drawImage()`, de las operaciones más caras del canvas
   2D, así que con 26×26 celdas son 1352 pares por fotograma. Dos
   recortes, independientes entre sí:
   · La ACTUALIZACIÓN de la rejilla (qué tanto se ha empujado/fruncido
     cada punto) ocurre en TODOS los `pointermove`, sin perder ni uno:
     es barata —sólo toca los puntos cercanos al pincel— y perder un
     evento perdería precisión real del trazo.
   · El REDIBUJADO —volver a pintar la imagen entera siguiendo la
     rejilla— se colapsa con `requestAnimationFrame`: como mucho una
     vez por fotograma, con el estado MÁS RECIENTE de la rejilla,
     nunca uno por evento.
   En `pointer:coarse` además el redibujado de arrastre se hace sobre
   un canvas de trabajo reducido (mismo límite que Perspectiva) en vez
   de a resolución completa del documento: son los píxeles de DESTINO
   los que dominan el coste de `ctx.clip()`, no sólo el origen. Al
   soltar el trazo se repite un redibujado final a resolución
   completa, para que el resultado guardado no pierda nitidez. */
const LIQ_COLS = 26, LIQ_ROWS = 26;

const LIQ_PROXY_MAX = 640;

let liqSession = null;   // { layerId, original, grid, proxy, proxyScale, preview }

let liqPend = false;

function liqSessionBegin(layer){
  if(liqSession && liqSession.layerId === layer.id) return;
  const original = document.createElement("canvas");
  original.width = layer.canvas.width; original.height = layer.canvas.height;
  original.getContext("2d").drawImage(layer.canvas, 0, 0);
  const grid = makeGrid(LIQ_COLS, LIQ_ROWS, doc.w, doc.h);

  let proxy = null, proxyScale = 1, preview = null;
  if(COARSE){
    const k = Math.min(1, LIQ_PROXY_MAX / Math.max(doc.w, doc.h));
    if(k < 1){
      proxy = document.createElement("canvas");
      proxy.width  = Math.max(1, Math.round(doc.w * k));
      proxy.height = Math.max(1, Math.round(doc.h * k));
      const px = proxy.getContext("2d");
      px.imageSmoothingQuality = "high";
      px.drawImage(original, 0, 0, proxy.width, proxy.height);
      proxyScale = k;
      preview = document.createElement("canvas");
      preview.width = proxy.width; preview.height = proxy.height;
    }
  }
  liqSession = { layerId: layer.id, original, grid, proxy, proxyScale, preview };
}

function liqGridSnapshot(){
  return liqSession ? Float64Array.from(liqSession.grid.cur) : null;
}

/* `full=false` (durante el arrastre, sólo si hay proxy) dibuja en el
   canvas reducido y lo escala de una sola vez sobre la capa real —un
   único `drawImage`, barato, en vez de 1352 recortes a tamaño
   completo—. `full=true` (al soltar, al restablecer, al cancelar)
   redibuja directamente a resolución completa. */
function liqRedraw(layer, full = true){
  if(!liqSession || liqSession.layerId !== layer.id) return;
  const { original, grid, proxy, proxyScale, preview } = liqSession;
  if(!full && proxy){
    renderLiquify(preview.getContext("2d"), proxy, grid, preview.width, preview.height, proxyScale);
    const x = layer.ctx;
    x.save();
    x.clearRect(0, 0, doc.w, doc.h);
    x.imageSmoothingQuality = "high";
    x.drawImage(preview, 0, 0, doc.w, doc.h);
    x.restore();
  } else {
    renderLiquify(layer.ctx, original, grid, doc.w, doc.h);
  }
}

function liqSessionStroke(layer, from, to){
  if(!liqSession || liqSession.layerId !== layer.id) return;
  const radius = Math.max(1, state.liqSize / 2);
  const strength = Math.max(0, Math.min(1, state.liqStrength / 100));
  const mode = state.liqMode;
  const amountAt = mode === "push"
    ? (f, t2, tt, n) => ({ x: (to.x - from.x) * strength / n, y: (to.y - from.y) * strength / n })
    : mode === "twirl"
    ? () => 0.22 * strength
    : () => 0.16 * strength;   // pinch / bloat
  applyStroke(liqSession.grid, mode, from, to, radius, amountAt);
  // Se relaja un poco en cada segmento del trazo, no todo de golpe: el
  // efecto se acumula solo con el propio gesto de arrastrar, que ya
  // llama a esto muchas veces por segundo.
  relaxGrid(liqSession.grid, Math.max(0, Math.min(1, state.liqVolume / 100)) * 0.22);
  // El redibujado (caro) se colapsa aparte, en el handler `move()`.
}

function liqSessionRestore(layer, backup){
  if(!liqSession || !layer || liqSession.layerId !== layer.id || !backup) return;
  liqSession.grid.cur.set(backup);
  liqRedraw(layer, true);
}

function liqSessionEnd(){ liqSession = null; liqPend = false; }

export function resetLiquify(){
  const l = activeLayer();
  if(!liqSession || !l || liqSession.layerId !== l.id) return;
  if(isIdentityGrid(liqSession.grid)) return;
  beginPixels("Restablecer licuado", l);
  resetGrid(liqSession.grid);
  liqRedraw(l, true);
  l.thumbDirty = true;
  selfCommit = "liquify";
  commitPixels();
  selfCommit = null;
  emit("doc:structure");
  scheduleCompose();
}

function drawLiquifyCursor(ctx){
  if(!cursorPos) return;
  const r = state.liqSize / 2;
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = 1 / view.zoom;
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, r, 0, 6.2832); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, r + 1 / view.zoom, 0, 6.2832); ctx.stroke();
  // Un punto en el centro: en fruncir/hinchar/remolino todo gira en
  // torno a él y conviene verlo exactamente, no solo el contorno.
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, 2 / view.zoom, 0, 6.2832); ctx.fill();
}
