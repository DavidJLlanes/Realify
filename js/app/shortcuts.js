/* ═══════════════════════════════════════════════════════════════
   APP · atajos de teclado: combinaciones, letras de herramienta, tamaño y opacidad del pincel, flechas
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { bind } from "../core/commands.js";
import { anyDialogOpen } from "../ui/kit/dialog.js";
import { TOOLS, setTool, resetColors, swapColors, current, state as toolState } from "../editor/tools/tools.js";
import { renderOptions } from "../ui/optionsbar.js";

/* ═══ atajos ═══ */
bind("mod+o", "file.open");

bind("mod+n", "file.new");

bind("mod+s", "file.saveProject");

bind("mod+alt+s", "file.export");

bind("mod+shift+s", "file.exportPng");

bind("mod+z", "edit.undo");

bind("mod+shift+z", "edit.redo");

bind("mod+y", "edit.redo");

bind("mod+c", "edit.copy");

bind("mod+x", "edit.cut");

bind("mod+v", "edit.paste");

// Las dos teclas de borrar: Supr en un teclado completo, Retroceso en
// los portátiles sin bloque numérico y en los Mac.
bind("delete", "edit.clear");

bind("backspace", "edit.clear");

bind("mod+shift+n", "layer.add");

bind("mod+j", "layer.duplicate");

bind("mod+e", "layer.mergeDown");

bind("mod+shift+e", "layer.mergeVisible");

bind("mod+g", "layer.group");

bind("mod+shift+g", "layer.ungroup");

bind("mod+0", "view.fit");

bind("mod+1", "view.zoom100");

bind("mod+shift+1", "view.compare100");

bind("mod++", "view.zoomIn");

bind("mod+-", "view.zoomOut");

bind("mod+r", "image.resize");

bind("mod+l", "adj.levels");

bind("mod+m", "adj.curves");

bind("mod+u", "adj.hsl");

bind("mod+i", "adj.invert");

bind("mod+shift+u", "adj.grayscale");

bind("tab", "view.panels");

bind("mod+a", "sel.all");

bind("mod+d", "sel.none");

bind("mod+shift+i", "sel.invert");

/* Ctrl/⌘+T abre casi siempre una pestaña del NAVEGADOR antes de que la
   página llegue a verlo, así que en la práctica el atajo fiable —y el
   que ya sigue el resto de herramientas de esta aplicación, una letra
   suelta sin modificador— es «F» (T ya era de Texto). Ver el
   manejador de teclas de herramienta, más abajo. Este bind queda para
   quien tenga la app instalada o use un navegador que sí lo deje pasar. */
bind("mod+t", "transform.start");

bind("escape", "tool.cancelPending");

// Intro, con la Pluma activa, aparca abierto el subtrazado en curso —
// no lo cierra: para eso, clic sobre su primera ancla—. En cualquier
// otro momento no hace nada (el comando se desactiva solo).
bind("enter", "pen.close");

// Intro confirma también el recorte, la Transformación libre y la
// Perspectiva, como en cualquier editor: cada comando sólo está activo
// con su herramienta, así que no se pisan entre sí ni con la Pluma.
bind("enter", "crop.apply");

bind("enter", "transform.apply");

bind("enter", "perspective.apply");

// Sin letra suelta libre (ver el comentario en tools.js): Ctrl+Mayús+D,
// como el resto de comandos con combinación en vez de tecla sola.
bind("mod+shift+d", "dodgeburn.start");

bind("mod+shift+h", "historyBrush.start");

/* Teclas de herramienta, como en cualquier editor */
addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  const t = TOOLS.find(x => x.key === e.key.toLowerCase());
  if(t){ e.preventDefault(); setTool(t.id); }
});

/* D/X del color frontal/fondo, como en Photoshop. Letra suelta, así
   que las mismas guardas que las teclas de herramienta de arriba. */
addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  if(e.key === "d"){ e.preventDefault(); resetColors(); }
  else if(e.key === "x"){ e.preventDefault(); swapColors(); }
});

/* Tamaño y dureza del pincel con [ ] y Mayús+[ Mayús+], igual que en
   Photoshop. Sólo actúan si la herramienta activa de verdad tiene esa
   opción (el Pincel, el Borrador, Clonar…), para no hacer nada raro
   con herramientas como Mover donde esas teclas no significan nada. */
addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key !== "[" && e.key !== "]") return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  const dir = e.key === "]" ? 1 : -1;
  const opt = e.shiftKey
    ? current.options?.find(o => o.key === "hardness")
    : current.options?.find(o => o.key === "size");
  if(!opt) return;
  e.preventDefault();
  const step = e.shiftKey ? 10 : 2;
  const v = Math.max(opt.min, Math.min(opt.max, toolState[opt.key] + dir * step));
  toolState[opt.key] = v;
  renderOptions();
});

/* Opacidad de la herramienta con un dígito, igual que en Photoshop:
   "5" pone 50%, "0" pone 100%, y dos dígitos seguidos y rápidos
   (p.ej. "2" luego "5") forman 25. Sólo si la herramienta activa
   tiene opacidad entre sus opciones. */
let opacityBuffer = "";

let opacityTimer = null;

addEventListener("keydown", e => {
  if(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if(!/^[0-9]$/.test(e.key)) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  const opt = current.options?.find(o => o.key === "opacity");
  if(!opt) return;
  e.preventDefault();
  clearTimeout(opacityTimer);
  const apply = value => {
    toolState.opacity = Math.max(opt.min, Math.min(opt.max, value === 0 ? 100 : value));
    renderOptions();
  };
  if(opacityBuffer){
    // Segundo dígito a tiempo: "2" + "5" = 25.
    apply(+(opacityBuffer + e.key));
    opacityBuffer = "";
    return;
  }
  apply(+e.key * 10);
  opacityBuffer = e.key;
  opacityTimer = setTimeout(() => { opacityBuffer = ""; }, 600);
});

/* Flechas con la herramienta Mover: 1 píxel, o 10 con Alt, como en
   Photoshop. Aparte del atajo de arriba porque aquí SÍ hace falta
   Alt (para el paso largo) y no cambia de herramienta. */
const NUDGE = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };

addEventListener("keydown", e => {
  if(current.id !== "move" || !NUDGE[e.key]) return;
  if(e.ctrlKey || e.metaKey || e.shiftKey) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if(anyDialogOpen()) return;
  e.preventDefault();
  const step = e.altKey ? 10 : 1;
  const [dx, dy] = NUDGE[e.key];
  current.nudge(dx * step, dy * step);
});
