/* ═══════════════════════════════════════════════════════════════
   APP · gestos sobre el lienzo: trazos, pellizco, redimensionar el pincel, autodesplazamiento y doble clic
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { on, emit } from "../core/bus.js";
import { current, setTool, state as toolState, setActiveColorSlot, setCursorPos } from "../editor/tools/tools.js";
import { scheduleCompose } from "../editor/render/compositor.js";
import { edgeAutoScroll, panBy, toImage, handleDoubleTap, handlePointerDown, handlePointerMove, handlePointerUp } from "../core/view.js";
import { doc, activeLayer } from "../core/doc.js";
import { isText } from "../editor/text/text.js";
import { startEdit, isEditing, endEdit } from "../editor/text/textedit.js";
import { run } from "../core/commands.js";
import { stage } from "./dom.js";
import { updatePos } from "./statusbar.js";

/* ═══ gestos sobre el lienzo ═══ */
let drawing = false;

let brushResize = null;

/* Si un segundo dedo llega para pellizcar o panear mientras había un
   trazo a medias, ese trazo se cancela primero: sin esto se queda un
   punto de pintura pegado en pantalla o una capa a medio mover, que es
   justo el «el zoom con dos dedos funciona mal» que se nota al tacto.
   La vista es quien detecta la transición de un dedo a dos, así que
   avisa por el bus y aquí se limpia lo que hiciera falta. */
on("view:gesturestart", () => {
  if(!drawing) return;
  try{
    if(current.cancel) current.cancel();
    else if(current.up) current.up();
  }catch(err){ console.error("[gesto]", err); }
  drawing = false;
  stopAutoScroll();
  emit("doc:structure");
  scheduleCompose();
});

/* Autodesplazamiento cerca del borde mientras se dibuja: con un lápiz
   o el dedo, acercarse al límite del lienzo desplaza la vista sola en
   esa dirección, para no tener que soltar y volver a agarrar. Sólo
   tiene sentido con las herramientas tipo pincel (cursor «none»); con
   mover o recortar cambiar la vista a la vez que se arrastra confunde
   más de lo que ayuda. */
let autoScrollReq = null, lastClientPos = null;

function stopAutoScroll(){
  lastClientPos = null;
  if(autoScrollReq){ cancelAnimationFrame(autoScrollReq); autoScrollReq = null; }
}

function autoScrollTick(){
  autoScrollReq = null;
  if(!drawing || !lastClientPos) return;
  const d = edgeAutoScroll(lastClientPos.x, lastClientPos.y);
  if(!d) return;   // se reactiva solo en el próximo pointermove si vuelve a acercarse
  panBy(d.dx, d.dy);
  const p = toImage(lastClientPos.x, lastClientPos.y);
  if(current.move) current.move(p, lastClientPos.e);
  autoScrollReq = requestAnimationFrame(autoScrollTick);
}

stage.addEventListener("dblclick", e => {
  // Doble clic sobre un texto lo reabre, venga de la herramienta que venga
  if(!doc.open) return;
  const l = activeLayer();
  if(isText(l)){ setTool("text"); startEdit(l, true, false); return; }
  // Mismo atajo que el doble clic en el icono de la barra de
  // herramientas (Mano → ajustar, Lupa → 100 %, Mover → centrar), para
  // quien lo prueba directamente en el lienzo en vez de en el icono.
  const cmd = current.id === "pan"  ? "view.fit"
            : current.id === "zoom" ? "view.zoom100"
            : current.id === "move" ? "layer.centerContent"
            : null;
  if(cmd) run(cmd);
});

// El menú contextual del navegador no aporta nada sobre el lienzo, y
// taparía justo el gesto que ahora tiene su propio significado: botón
// derecho = pintar con el color de fondo.
stage.addEventListener("contextmenu", e => e.preventDefault());

stage.addEventListener("pointerdown", e => {
  if(!doc.open) return;
  // Controles de verdad flotando sobre el lienzo (píldora de zoom, el
  // textarea de edición de texto, el FAB de comparar…): tocarlos debe
  // comportarse como el control que son, no arrancar un trazo de la
  // herramienta activa debajo. Sin este corte, `stage.setPointerCapture`
  // más abajo secuestra el puntero y el click nativo del botón nunca
  // llega a dispararse.
  if(e.target.closest("button, input, select, textarea, a")) return;
  // Photoshop: Alt + botón derecho y arrastrar. Horizontal cambia el
  // diámetro; vertical, la dureza. Todas las herramientas que declaran
  // una opción `size` comparten state.size, por lo que el mismo gesto
  // sirve para pincel, borrador, clonar, correctores y similares.
  if(e.altKey && e.button === 2 && current.options?.some(o => o.key === "size")){
    e.preventDefault();
    brushResize = { x:e.clientX, y:e.clientY, size:toolState.size, hardness:toolState.hardness };
    stage.setPointerCapture(e.pointerId);
    return;
  }
  // Con un texto en edición, tocar fuera lo confirma
  if(isEditing() && !e.target.closest(".text-edit")) endEdit();
  if(handleDoubleTap(e)) return;
  if(handlePointerDown(e)) return;      // la vista se ha quedado el gesto
  if(e.button === 2 && !current.rightClick) return;
  if(e.button !== 0 && e.button !== 2) return;
  setActiveColorSlot(e.button === 2 ? "bg" : "fg");
  const p = toImage(e.clientX, e.clientY);
  if(current.down){
    drawing = true;
    stage.setPointerCapture(e.pointerId);
    current.down(p, e);
    scheduleCompose();
  }
});

stage.addEventListener("pointermove", e => {
  if(!doc.open) return;
  if(brushResize){
    e.preventDefault();
    toolState.size = Math.max(1, Math.min(400, Math.round(brushResize.size + e.clientX - brushResize.x)));
    toolState.hardness = Math.max(0, Math.min(100, Math.round(brushResize.hardness - (e.clientY - brushResize.y) / 2)));
    for(const [key, value] of [["size", toolState.size], ["hardness", toolState.hardness]]){
      const input = document.querySelector(`#optsbar input[data-option-key="${key}"]`);
      if(input){ input.value = value; const label = input.parentElement.querySelector(".mono"); if(label) label.textContent = value + (key === "size" ? "px" : "%"); }
      emit("tool:paramchange", key);
    }
    return;
  }
  const p = toImage(e.clientX, e.clientY);
  updatePos(p);
  if(current.cursor === "none") setCursorPos(p);
  if(handlePointerMove(e)) return;
  if(drawing && current.move) current.move(p, e);
  if(drawing && current.cursor === "none"){
    lastClientPos = { x: e.clientX, y: e.clientY, e };
    if(!autoScrollReq) autoScrollReq = requestAnimationFrame(autoScrollTick);
  }
});

const endStroke = e => {
  if(brushResize){ brushResize = null; return; }
  stopAutoScroll();
  // El botón derecho vale sólo para el trazo que lo usó: suelto el
  // ratón, «state.color» vuelve a mirar al frontal, que es el que
  // muestra el resto de la interfaz (el swatch de la barra de
  // opciones, el picker de color…).
  setActiveColorSlot("fg");
  if(handlePointerUp(e)) return;
  if(drawing && current.up){ current.up(e); }
  drawing = false;
};

stage.addEventListener("pointerup", endStroke);

stage.addEventListener("pointercancel", endStroke);

stage.addEventListener("pointerleave", e => {
  if(current.cursor === "none") setCursorPos(null);
});
