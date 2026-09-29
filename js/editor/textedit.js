/* ═══════════════════════════════════════════════════════════════
   EDICIÓN EN EL LIENZO
   Un <textarea> transparente colocado justo encima del texto, con la
   misma tipografía y el mismo tamaño escalados al zoom. El usuario
   ve lo que escribe donde va a quedar, en lugar de en un cuadro de
   diálogo aparte que obliga a imaginárselo.
   ═══════════════════════════════════════════════════════════════ */

import { view, panBy } from "./view.js";
import { followKeyboard } from "../ui/keyboard.js";
import { doc } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { renderTextLayer, fontString, isText } from "./text.js";
import { record } from "../core/history.js";

const stage = document.getElementById("stage");
let editor = null, editing = null, before = null, created = false;
let refocus = null;
let stopKb = null, kbShift = 0;   // teclado del móvil (ver startEdit)

export const isEditing = () => !!editing;

/* ¿Se puede calcar el texto con un <textarea>? Sí mientras sea texto
   recto: entonces se escribe sobre el render DE VERDAD —con su
   contorno, su sombra, su fondo y su color— y el cuadro sólo aporta el
   cursor y la selección, con las letras transparentes. En círculo, en
   trazado, deformado, justificado, con sangrías o con kerning manual
   la disposición del lienzo no la puede reproducir un cuadro de texto:
   ahí se tapa la capa y se escribe en el cuadro, como siempre. */
function liveRender(t){
  const boxed = Number.isFinite(t.boxW) && t.boxW > 0;
  if(t.circle || (t.path && t.path.p0) || (t.warp && t.warp.kind && t.warp.amount)) return false;
  if(t.kerning && Object.keys(t.kerning).length) return false;
  if(boxed && (t.align === "justify" || t.indentFirst || t.indentLeft || t.indentRight)) return false;
  return true;
}
export const editingLayer = () => editing;

/* Posición del cursor dentro del cuadro de edición, o null si no se
   está editando. La usa el kerning manual: sólo tiene sentido con un
   cursor de verdad (sin nada seleccionado) puesto entre dos letras
   concretas, el mismo criterio que usa el panel de carácter de
   cualquier maquetador serio. */
export function cursorPos(){
  if(!editor || !editing) return null;
  return { start: editor.selectionStart, end: editor.selectionEnd };
}

/* Devuelve el cursor al cuadro de edición conservando la selección:
   lo usa la barra de opciones después de tocar un mando, para que lo
   siguiente que se teclee siga yendo al texto. */
export function focusEditor(){ if(refocus) refocus(); }

/* `isNew` distingue «acabo de crear esta capa con un clic» de «vuelvo
   a abrir una que ya existía»: sólo la primera se descarta si se
   termina sin escribir nada. */
export function startEdit(layer, selectAll, isNew = selectAll){
  if(!isText(layer)) return;
  if(editing) endEdit();
  editing = layer;
  created = !!isNew;
  before = { ...layer.text };

  const t = layer.text;
  editor = document.createElement("textarea");
  editor.className = "text-edit";
  editor.value = t.content;
  editor.spellcheck = false;
  stage.appendChild(editor);

  place();
  /* Teclado del móvil: si el cuadro en el que se escribe queda debajo
     del teclado, la imagen sube lo justo para verlo; al cerrarse el
     teclado vuelve a donde estaba. */
  kbShift = 0;
  stopKb = followKeyboard(stage, kb => {
    if(!editor) return;
    if(kb){
      const r = editor.getBoundingClientRect(), limit = innerHeight - kb - 12;
      if(r.bottom > limit){
        const dy = Math.min(r.bottom - limit, Math.max(0, r.top - 60));
        if(dy > 0){ kbShift += dy; panBy(0, -dy); }
      }
    } else if(kbShift){ panBy(0, kbShift); kbShift = 0; }
  });

  /* El foco NO se pide dentro del gesto que abre el editor. Cuando
     esto se llama desde un `pointerdown`, el navegador todavía tiene
     que terminar de repartir el foco de ese clic, y se lo lleva al
     lienzo: el textarea recién creado lo pierde al instante y su
     propio `blur` lo cierra. El resultado era que pinchar con la
     herramienta de texto no dejaba escribir nada. Pidiéndolo en el
     fotograma siguiente, ese reparto ya ha ocurrido y el foco se
     queda donde debe. */
  const focus = () => {
    if(!editor || editing !== layer) return;
    editor.focus({ preventScroll: true });
    if(selectAll) editor.select();
    else editor.setSelectionRange(editor.value.length, editor.value.length);
  };
  focus();
  requestAnimationFrame(focus);
  requestAnimationFrame(() => emit("text:cursor"));
  refocus = () => {
    if(!editor || editing !== layer) return;
    const at = editor.selectionStart, to = editor.selectionEnd;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(at, to);
  };

  /* La capa se tapa mientras se escribe —el textarea ya la enseña, y
     verla dos veces con un píxel de desfase queda fatal—, pero con una
     marca de trabajo en vez de su interruptor de visibilidad. El
     barrido previo es la red de seguridad: si una edición anterior
     murió sin cerrarse, su marca se limpia aquí en vez de dejar esa
     capa invisible para el resto de la sesión. */
  for(const other of doc.layers) delete other.__editing;
  if(!liveRender(t)) layer.__editing = true;
  emit("doc:change");

  editor.addEventListener("input", () => {
    t.content = editor.value;
    // Con el render a la vista, se redibuja letra a letra según se teclea
    // (y si la configuración cambió a un modo que no se puede calcar, se
    // vuelve a tapar la capa).
    const live = liveRender(t);
    if(live){ delete layer.__editing; renderTextLayer(layer); }
    else layer.__editing = true;
    autosize();
    emit("doc:change");
    emit("text:cursor");
  });
  editor.addEventListener("keydown", e => {
    e.stopPropagation();               // que no se disparen los atajos de herramienta
    if(e.key === "Escape"){ e.preventDefault(); cancelEdit(); }
    if(e.key === "Enter" && (e.ctrlKey || e.metaKey)){ e.preventDefault(); endEdit(); }
  });
  /* El campo de kerning de la barra de opciones necesita saber en qué
     hueco está el cursor cada vez que se mueve, no sólo al teclear. */
  editor.addEventListener("keyup", () => emit("text:cursor"));
  editor.addEventListener("click", () => emit("text:cursor"));
  editor.addEventListener("select", () => emit("text:cursor"));
  /* Un blur dentro del mismo gesto que abrió el editor no es el
     usuario dando por terminada la edición: es el clic de apertura
     repartiendo el foco. Sólo cierran los blur posteriores —tocar otro
     control, cambiar de herramienta—; tocar el lienzo ya lo confirma
     aparte, desde el `pointerdown` de main.js. */
  const openedAt = performance.now();
  editor.addEventListener("blur", () => {
    if(!editing) return;
    if(performance.now() - openedAt < 300) return;
    endEdit();
  });
}

function autosize(){
  if(!editor || !editing) return;
  const t = editing.text;
  // En un párrafo el alto lo manda el marco, no lo escrito: crecer con
  // el contenido desharía justo lo que el marco define.
  if(Number.isFinite(t.boxW) && t.boxW > 0){ place(); return; }
  editor.style.height = "auto";
  editor.style.height = editor.scrollHeight + "px";
  place(true);
}

/* Coloca y escala el cuadro para que coincida con el texto real.

   El ancho se ajusta a lo escrito más un margen para seguir
   escribiendo. Antes era el 60 % del ancho del documento, fijo: un
   rectángulo enorme que tapaba la imagen alrededor y, con el borde
   punteado marcando ese tamaño inventado, daba la impresión de que la
   capa de texto ocupaba mucho más de lo que ocupa.

   La vertical se apoya en el mismo reparto de interlineado que usa
   `layoutText` para dibujar, que a su vez es el del navegador; por eso
   las letras del textarea caen justo encima de las ya pintadas. */
export function place(keepHeight){
  if(!editor || !editing) return;
  const t = editing.text;
  const z = view.zoom;
  const lines = String(t.content || " ").split("\n");
  const lh = t.size * t.lineHeight;
  const boxed = Number.isFinite(t.boxW) && t.boxW > 0;

  /* En un párrafo el cuadro ES el marco: mismo ancho, mismo alto y el
     navegador reajustando las líneas igual que hace el dibujo. En
     texto de punto se ciñe a lo escrito, con holgura para seguir
     tecleando. */
  let w, h, left, top;
  if(boxed){
    w = t.boxW;
    h = Number.isFinite(t.boxH) ? t.boxH : lh * Math.max(1, lines.length);
    left = t.x - w / 2;
    top  = t.y - h / 2;
  } else {
    h = lh * Math.max(1, lines.length);
    const measured = measureWidth(t, lines);
    w = Math.max(t.size * 2.5, measured + t.size * 1.2);
    // En círculo el texto no es una línea recta que se pueda calcar,
    // así que el cuadro se centra en el centro del círculo y sirve
    // sólo para escribir el contenido.
    left = t.circle             ? t.x - w / 2
         : t.align === "center" ? t.x - w / 2
         : t.align === "right"  ? t.x - w
         : t.x;
    top  = t.y - h / 2;
  }

  editor.style.left   = (view.x + left * z) + "px";
  editor.style.top    = (view.y + top * z) + "px";
  editor.style.width  = (w * z) + "px";
  editor.style.font   = fontString(t);
  editor.style.fontSize = (t.size * z) + "px";
  editor.style.lineHeight = String(t.lineHeight);
  editor.style.color  = t.color;
  editor.style.textAlign = t.circle ? "center" : t.align;
  editor.style.letterSpacing = (t.tracking * z) + "px";
  editor.style.textTransform = t.allCaps ? "uppercase" : "none";
  editor.style.fontVariantCaps = t.smallCaps ? "small-caps" : "normal";
  // Letras invisibles sobre el render real (ver liveRender), o visibles
  // cuando la capa se tapa.
  const live = liveRender(t);
  editor.classList.toggle("text-edit-live", live);
  if(live) delete editing.__editing; else editing.__editing = true;
  // Los renglones se parten solos dentro del marco, igual que al
  // dibujar; en texto de punto sólo salta de línea donde haya un Intro.
  editor.style.whiteSpace = boxed ? "pre-wrap" : "pre";
  editor.style.overflow = boxed ? "auto" : "hidden";

  /* El giro se aplica al cuadro alrededor del mismo ancla que usa el
     dibujo, expresado en coordenadas del propio cuadro. */
  if(t.angle){
    editor.style.transformOrigin = `${(t.x - left) * z}px ${(t.y - top) * z}px`;
    editor.style.transform = `rotate(${t.angle}deg)`;
  } else {
    editor.style.transform = "";
    editor.style.transformOrigin = "";
  }

  /* `letter-spacing` de CSS añade el espaciado también DETRÁS de la
     última letra, cosa que el lienzo no hace: con texto centrado o a la
     derecha, lo escrito quedaba corrido respecto al render. Se amplía
     el cuadro por la derecha en esa misma cantidad para compensarlo. */
  if(!boxed && t.tracking > 0 && t.align !== "left" && t.align !== "justify" && !t.circle){
    editor.style.width = ((w + t.tracking) * z) + "px";
  }

  if(!keepHeight || boxed) editor.style.height = (h * z) + "px";
}

/* Ancho del texto a escala del documento, midiendo con la misma
   tipografía con la que se va a dibujar. */
let mctx = null;
function measureWidth(t, lines){
  if(!mctx) mctx = document.createElement("canvas").getContext("2d");
  mctx.font = fontString(t);
  let w = 0;
  for(const line of lines){
    const n = [...line].length;
    const lw = mctx.measureText(line).width + (t.tracking || 0) * Math.max(0, n - 1);
    if(lw > w) w = lw;
  }
  return w;
}

export function endEdit(){
  if(!editing) return;
  const layer = editing, prev = before, wasNew = created;
  editing = null; before = null; created = false; refocus = null;
  stopKb?.(); stopKb = null;
  if(kbShift){ panBy(0, kbShift); kbShift = 0; }

  const val = editor ? editor.value : layer.text.content;
  if(editor){ editor.remove(); editor = null; }

  delete layer.__editing;

  /* Si la capa dejó de ser de texto mientras se escribía (se rasterizó),
     ya no hay texto que guardar. */
  if(!isText(layer)){ emit("doc:change"); return; }

  /* Una capa que se queda sin una sola letra no es una capa: es el
     rastro de haber pinchado sin querer. Se descarta, como hace
     cualquier editor, en vez de dejar una capa vacía en la pila. */
  if(wasNew && !String(val).length){ dropLayer(layer); return; }

  layer.text.content = val;
  layer.name = String(val).split("\n")[0].slice(0, 22) || "Texto";
  renderTextLayer(layer);

  const after = { ...layer.text };

  if(wasNew){
    /* Un texto recién creado se deshace entero, quitando la capa.
       `addLayer` no anota nada por su cuenta, así que sin esto
       deshacer dejaba la capa puesta con el texto de muestra. */
    const at = doc.layers.indexOf(layer);
    record("Añadir texto",
      () => dropLayer(layer),
      () => {
        if(doc.layers.indexOf(layer) < 0) doc.layers.splice(Math.min(at, doc.layers.length), 0, layer);
        Object.assign(layer.text, after);
        renderTextLayer(layer);
        doc.activeId = layer.id;
        emit("doc:active"); emit("doc:structure"); emit("doc:change");
      });
  } else if(prev && Object.keys(after).some(k => after[k] !== prev[k])){
    /* Se compara el objeto entero, no sólo el contenido: durante la
       edición se puede haber cambiado el cuerpo, el color o la sombra
       desde la barra, y ese paso también tiene que poder deshacerse. */
    record("Editar texto",
      () => { Object.assign(layer.text, prev);  renderTextLayer(layer); emit("doc:structure"); emit("doc:change"); },
      () => { Object.assign(layer.text, after); renderTextLayer(layer); emit("doc:structure"); emit("doc:change"); });
  }
  emit("doc:structure");
  emit("doc:change");
}

/* Saca una capa de la pila y deja activa la de al lado. */
function dropLayer(layer){
  const i = doc.layers.indexOf(layer);
  if(i < 0) return;
  doc.layers.splice(i, 1);
  if(doc.activeId === layer.id){
    const next = doc.layers[Math.min(i, doc.layers.length - 1)];
    doc.activeId = next ? next.id : null;
    emit("doc:active");
  }
  emit("doc:structure");
  emit("doc:change");
}

export function cancelEdit(){
  if(!editing) return;
  const layer = editing, prev = before, wasNew = created;
  editing = null; before = null; created = false; refocus = null;
  if(editor){ editor.remove(); editor = null; }
  delete layer.__editing;

  // Escape sobre una capa recién creada la descarta entera: no se
  // llegó a aceptar nada de ella.
  if(wasNew){ dropLayer(layer); return; }

  if(prev) Object.assign(layer.text, prev);
  renderTextLayer(layer);
  emit("doc:structure");
  emit("doc:change");
}

/* Al mover o hacer zoom hay que recolocar el cuadro */
import { on } from "../core/bus.js";
on("view:change", () => place(true));
