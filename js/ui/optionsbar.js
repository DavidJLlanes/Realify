/* La barra de opciones se genera a partir de lo que declara la
   herramienta activa. Añadir un control nuevo a una herramienta es
   añadir una línea a su array de opciones, no tocar la interfaz. */

import { on, emit } from "../core/bus.js";
import { current, state, toolChosen } from "../editor/tools.js";
import { loadFontFile, FONTS, FONT_SEPARATOR } from "../editor/text.js";
import { chooseFontValue, GOOGLE_OTHER, MORE_FONTS_LABEL, googleFontItems } from "../editor/gfonts.js";
import { toast } from "./toast.js";
import { stepper } from "./stepper.js";
import { openGuide, openGuideForTool } from "./guide.js";
import { openColorPopover } from "./colorswatch.js";

const LOAD_FONT = "__load_font__";

const bar = document.getElementById("optsbar");

/* Herramientas que pintan con el frontal/fondo (`state.color`): en
   móvil llevan el selector compacto al principio de la barra, porque
   el widget de siempre vive en la fila de herramientas, que en
   vertical ya no se muestra. En escritorio el CSS lo oculta. */
const SWATCH_TOOLS = new Set(["brush", "eraser", "fill", "picker"]);

function paintSwatch(btn){
  btn.querySelector(".osw-fg").style.background = state.fg;
  btn.querySelector(".osw-bg").style.background = state.bg;
}
on("color:change", () => { const b = bar.querySelector(".opts-swatch"); if(b) paintSwatch(b); });

export function renderOptions(){
  const t = current;
  bar.innerHTML = "";
  if(!t) return;

  const name = document.createElement("span");
  name.className = "tool-name";
  name.textContent = t.name;
  bar.appendChild(name);

  /* «?» a la ayuda de ESTA herramienta, justo después del nombre y
     antes de sus propios mandos —lo que pide un usuario que no sabe
     qué hace un icono es la explicación de ESE icono, no tener que
     abrir la guía entera y buscarla—. Va en su propio botón, no
     colgado del nombre, para que siga siendo un objetivo táctil
     cómodo aparte; visible también en móvil, donde el nombre se
     oculta por espacio pero la pregunta de «¿qué hace esto?» es si
     acaso más frecuente. */
  const help = document.createElement("button");
  help.className = "icon ghost tool-help";
  help.textContent = "?";
  /* Sin herramienta elegida a mano (la de partida, o la vuelta
     automática a «Mover»), la pregunta no es sobre «Mover»: se abre la
     guía general. */
  const picked = toolChosen();
  help.title = picked ? `Ayuda: ${t.name}` : "Ayuda";
  help.setAttribute("aria-label", picked ? `Ayuda sobre la herramienta ${t.name}` : "Ayuda general");
  help.addEventListener("click", () => picked ? openGuideForTool(t.id) : openGuide());
  bar.appendChild(help);

  if(SWATCH_TOOLS.has(t.id)){
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "opts-swatch";
    sw.title = "Colores frontal y de fondo";
    sw.setAttribute("aria-label", "Colores frontal y de fondo");
    sw.innerHTML = '<i class="osw-bg"></i><i class="osw-fg"></i>';
    paintSwatch(sw);
    sw.addEventListener("click", e => { e.stopPropagation(); openColorPopover(sw); });
    bar.appendChild(sw);
  }

  for(const o of (t.options || [])){
    // Controles que sólo tienen sentido en cierto estado
    if(o.showIf && !o.showIf()) continue;
    bar.appendChild(buildControl(o));
  }

  const spring = document.createElement("div");
  spring.className = "spring";
  bar.appendChild(spring);

  // Pequeña entrada al cambiar de herramienta: la animación en sí
  // sólo existe dentro de `mobile.css`, así que en escritorio esta
  // clase no tiene ningún efecto visual.
  bar.classList.remove("opts-in");
  void bar.offsetWidth; // reinicia la animación si ya tenía la clase
  bar.classList.add("opts-in");
}

function buildControl(o){
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "7px";

  if(o.type === "static"){
    const sp = document.createElement("span");
    sp.className = "unit";
    sp.textContent = o.label;
    wrap.appendChild(sp);
    return wrap;
  }

  if(o.type === "button"){
    const b = document.createElement("button");
    b.textContent = o.label;
    if(o.title) b.title = o.title;
    if(o.primary) b.className = "primary";
    b.dataset.cmd = o.cmd;
    wrap.appendChild(b);
    return wrap;
  }

  /* Un interruptor ya lleva su texto dentro del propio botón, así que
     ponerle además una etiqueta delante lo escribía dos veces seguidas
     —«Sombra Sombra», «Fondo Fondo»—, gastando el doble de barra para
     decir lo mismo. */
  if(o.label && o.type !== "toggle"){
    const l = document.createElement("label");
    l.textContent = o.label;
    wrap.appendChild(l);
  }

  if(o.type === "range"){
    const r = document.createElement("input");
    r.type = "range";
    r.min = o.min; r.max = o.max; r.value = state[o.key];
    r.dataset.optionKey = o.key;
    const v = document.createElement("span");
    v.className = "mono";
    v.style.cssText = "min-width:38px;font-size:var(--fs-xs);color:var(--tx-dim)";
    v.textContent = state[o.key] + (o.unit || "");
    r.addEventListener("input", () => {
      state[o.key] = +r.value;
      v.textContent = r.value + (o.unit || "");
      emit("tool:paramchange", o.key);
    });
    wrap.appendChild(r);
    wrap.appendChild(v);
    return wrap;
  }

  if(o.type === "select"){
    const s = document.createElement("select");
    // Una lista fija de valores, o una función que la calcula al vuelo
    // —los estilos de carácter/párrafo, por ejemplo, cambian en cuanto
    // se guarda uno nuevo, y la barra se reconstruye entera en cada
    // tool:options—.
    const items = typeof o.items === "function" ? o.items() : o.items;
    for(const item of items){
      const group = item.group ? document.createElement("optgroup") : null;
      if(group) group.label = item.group;
      for(const [val, label] of group ? item.items : [item]){
        const op = document.createElement("option");
        op.value = val; op.textContent = label;
        if(val === FONT_SEPARATOR) op.disabled = true;
        // Ver la fuente en la propia lista ahorra el ensayo y error
        if(o.key === "fontFamily") op.style.fontFamily = val;
        (group || s).appendChild(op);
      }
      if(group) s.appendChild(group);
    }
    if(o.key === "cropRatio") s.style.maxWidth = "min(48vw,260px)";
    if(o.key === "fontFamily"){
      s.style.minWidth = "128px";
      for(const [v, l] of [[GOOGLE_OTHER, MORE_FONTS_LABEL], [LOAD_FONT, "Cargar fuente desde archivo…"]]){
        const op = document.createElement("option");
        op.value = v; op.textContent = l;
        s.appendChild(op);
      }
    }
    s.value = state[o.key];
    s.addEventListener("change", async () => {
      if(s.value === LOAD_FONT){
        s.value = state[o.key];
        const family = await pickFontFile();
        if(!family) return;
        state[o.key] = family;
        emit("tool:paramchange", o.key);
        renderOptions();
        return;
      }
      if(o.key === "fontFamily"){
        // Tipografías libres y «Más fuentes…» (buscador)
        const wanted = s.value;
        s.value = state[o.key];
        const font = await chooseFontValue(wanted);
        if(!font) return;
        if(!FONTS.some(f => f[0] === font)){
          // Una familia recién elegida en el buscador
          const item = googleFontItems().find(f => f[0] === font);
          if(item) FONTS.push(item);
        }
        state[o.key] = font;
        emit("tool:paramchange", o.key);
        renderOptions();
        return;
      }
      state[o.key] = s.value;
      emit("tool:paramchange", o.key);
      // Algunas opciones hacen aparecer o desaparecer otras
      if(o.rerender) renderOptions();
    });
    wrap.appendChild(s);
    return wrap;
  }

  if(o.type === "number"){
    const n = document.createElement("input");
    n.type = "number";
    n.min = o.min; n.max = o.max;
    n.value = state[o.key];
    if(o.width) n.style.width = o.width + "px";
    n.addEventListener("input", () => {
      const v = Math.max(o.min, Math.min(o.max, +n.value || 0));
      state[o.key] = v;
      emit("tool:paramchange", o.key);
    });
    wrap.appendChild(stepper(n));
    if(o.unit){
      const u = document.createElement("span");
      u.className = "unit";
      u.textContent = o.unit;
      wrap.appendChild(u);
    }
    return wrap;
  }

  if(o.type === "toggle"){
    const b = document.createElement("button");
    b.textContent = o.label;
    b.title = o.title || o.label;
    b.className = state[o.key] ? "on-toggle" : "";
    if(o.bold) b.style.fontWeight = "800";
    if(o.italic) b.style.fontStyle = "italic";
    b.style.minWidth = "30px";
    b.addEventListener("click", () => {
      state[o.key] = !state[o.key];
      b.className = state[o.key] ? "on-toggle" : "";
      if(o.bold) b.style.fontWeight = "800";
      if(o.italic) b.style.fontStyle = "italic";
      emit("tool:paramchange", o.key);
      // Igual que en «select» y «segment»: si este interruptor decide
      // si otros controles se ven o no (por ejemplo, el color de una
      // caja de fondo que sólo tiene sentido con la caja encendida),
      // hay que rehacer la barra para que aparezcan o desaparezcan.
      if(o.rerender) renderOptions();
    });
    wrap.appendChild(b);
    return wrap;
  }

  if(o.type === "segment"){
    const seg = document.createElement("div");
    seg.className = "seg";
    for(const [val, label, title] of o.items){
      const b = document.createElement("button");
      b.textContent = label;
      if(title) b.title = title;
      b.className = state[o.key] === val ? "on" : "";
      b.addEventListener("click", () => {
        state[o.key] = val;
        seg.querySelectorAll("button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        emit("tool:paramchange", o.key);
        // Igual que el desplegable: cambiar de modo puede hacer
        // aparecer o desaparecer otros controles de la misma barra.
        if(o.rerender) renderOptions();
      });
      seg.appendChild(b);
    }
    wrap.appendChild(seg);
    return wrap;
  }

  if(o.type === "color"){
    const btn = document.createElement("button");
    btn.style.cssText =
      "width:30px;height:22px;padding:0;border-radius:3px;position:relative;overflow:hidden";
    const sw = document.createElement("span");
    sw.style.cssText = "position:absolute;inset:2px;border-radius:2px;background:" + state[o.key];
    btn.appendChild(sw);
    const input = document.createElement("input");
    input.type = "color";
    input.value = state[o.key];
    input.style.cssText = "position:absolute;inset:0;opacity:0;cursor:pointer;padding:0;border:0";
    input.addEventListener("input", () => {
      state[o.key] = input.value;
      sw.style.background = input.value;
      emit("tool:paramchange", o.key);
    });
    btn.appendChild(input);
    wrap.appendChild(btn);
    return wrap;
  }

  return wrap;
}

/* Selector de archivo de fuente: se registra en el navegador y se
   añade a la lista; el nombre del archivo hace de nombre de familia. */
function pickFontFile(){
  return new Promise(resolve => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";
    inp.style.display = "none";
    document.body.appendChild(inp);
    const done = v => { inp.remove(); resolve(v); };
    inp.addEventListener("change", async () => {
      const f = inp.files?.[0];
      if(!f) return done(null);
      try{
        const family = await loadFontFile(f);
        toast(`Fuente cargada: ${family.replace(/'/g, "")}`, "ok");
        done(family);
      }catch(err){
        toast("No se pudo cargar la fuente: " + (err.message || "archivo no válido"), "err");
        done(null);
      }
    });
    inp.addEventListener("cancel", () => done(null));
    inp.click();
  });
}

on("tool:change", renderOptions);
on("tool:options", renderOptions);
