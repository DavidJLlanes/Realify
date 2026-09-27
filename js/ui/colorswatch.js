/* ═══════════════════════════════════════════════════════════════
   FRONTAL / FONDO
   El widget de siempre: dos cuadrados solapados, uno para intercambiar
   y otro para restablecer a blanco y negro. Vive al final de la barra
   de herramientas y sólo dibuja lo que ya vive en tools.js —no guarda
   estado propio—, así que basta con volver a pintarlo cuando cambie
   cualquiera de los dos colores, venga el cambio de aquí, del pincel
   pintando con el botón derecho o del cuentagotas.
   ═══════════════════════════════════════════════════════════════ */

import { on, emit } from "../core/bus.js";
import { state, swapColors, resetColors } from "../editor/tools.js";
import { isMobile, haptic } from "../core/device.js";

/* Abre el popover de frontal/fondo anclado a otro botón: lo usa el
   selector compacto de la barra de opciones en móvil (optionsbar.js),
   ahora que la fila de herramientas —donde vive el widget— no se
   muestra en vertical. Se rellena al iniciar el widget. */
export let openColorPopover = () => {};

export function initColorSwatch(host){
  const wrap = document.createElement("div");
  wrap.className = "color-swatch";
  wrap.id = "colorSwatch";
  wrap.innerHTML = `
    <button type="button" class="cs-reset" aria-label="Restablecer a blanco y negro" title="Restablecer a blanco y negro"></button>
    <button type="button" class="cs-swap" aria-label="Intercambiar frontal y fondo" title="Intercambiar frontal y fondo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3v11a2 2 0 0 1-2 2H4"/><path d="m8 12-4 4 4 4"/>
        <path d="M7 21V10a2 2 0 0 1 2-2h11"/><path d="m16 12 4-4-4-4"/>
      </svg>
    </button>
    <button type="button" class="cs-bg" aria-label="Color de fondo (botón derecho)" title="Color de fondo — se pinta con el botón derecho">
      <input type="color" tabindex="-1" aria-hidden="true">
    </button>
    <button type="button" class="cs-fg" aria-label="Color frontal (botón izquierdo)" title="Color frontal — se pinta con el botón izquierdo">
      <input type="color" tabindex="-1" aria-hidden="true">
    </button>`;
  host.appendChild(wrap);

  const fgBtn = wrap.querySelector(".cs-fg"), fgInput = fgBtn.querySelector("input");
  const bgBtn = wrap.querySelector(".cs-bg"), bgInput = bgBtn.querySelector("input");

  function render(){
    fgBtn.style.background = state.fg;
    bgBtn.style.background = state.bg;
    fgInput.value = state.fg;
    bgInput.value = state.bg;
    if(pop) renderPop();
  }

  fgInput.addEventListener("input", () => { state.fg = fgInput.value; render(); });
  bgInput.addEventListener("input", () => { state.bg = bgInput.value; render(); });
  wrap.querySelector(".cs-swap").addEventListener("click", swapColors);
  wrap.querySelector(".cs-reset").addEventListener("click", resetColors);

  /* En móvil, los cuatro controles comprimidos en 46×46px son
     imposibles de acertar con el pulgar (llegan a medir 13px). En vez
     de agrandar el widget de la barra —que le robaría sitio a las
     herramientas—, se deja tal cual como *lanzador* y un solo toque
     en cualquier punto abre un popover flotante con las mismas
     acciones a tamaño de dedo, igual que el menú móvil abre una lista
     completa desde un botón compacto. */
  let pop = null, popFg = null, popBg = null, popAnchor = null;

  function closePop(){
    if(!pop) return;
    pop.remove();
    pop = null;
    document.removeEventListener("click", onOutside, true);
    removeEventListener("keydown", onKey);
  }
  function onOutside(e){
    if(pop && !pop.contains(e.target) && !launcher.contains(e.target) &&
       !(popAnchor && popAnchor.contains(e.target))) closePop();
  }
  function onKey(e){ if(e.key === "Escape") closePop(); }

  function renderPop(){
    popFg.querySelector(".cp-box").style.background = state.fg;
    popBg.querySelector(".cp-box").style.background = state.bg;
    popFg.querySelector("input").value = state.fg;
    popBg.querySelector("input").value = state.bg;
  }

  function openPop(anchor = wrap){
    if(pop){ if(anchor !== wrap) closePop(); return; }
    popAnchor = anchor;
    haptic(6);
    pop = document.createElement("div");
    pop.className = "menu-pop color-popover";
    pop.setAttribute("role", "dialog");
    pop.innerHTML = `
      <div class="cp-swatches">
        <button type="button" class="cp-fg" aria-label="Color frontal">
          <span class="cp-box"><input type="color" tabindex="-1" aria-hidden="true"></span><span>Frontal</span>
        </button>
        <button type="button" class="cp-bg" aria-label="Color de fondo">
          <span class="cp-box"><input type="color" tabindex="-1" aria-hidden="true"></span><span>Fondo</span>
        </button>
      </div>
      <div class="cp-actions">
        <button type="button" class="cp-swap">Intercambiar</button>
        <button type="button" class="cp-reset">Restablecer</button>
      </div>`;
    document.body.appendChild(pop);

    popFg = pop.querySelector(".cp-fg");
    popBg = pop.querySelector(".cp-bg");
    const popFgInput = popFg.querySelector("input"), popBgInput = popBg.querySelector("input");
    // Por el bus y no con render() directo: así se entera también el
    // selector compacto de la barra de opciones en móvil.
    popFgInput.addEventListener("input", () => { state.fg = popFgInput.value; emit("color:change"); });
    popBgInput.addEventListener("input", () => { state.bg = popBgInput.value; emit("color:change"); });
    pop.querySelector(".cp-swap").addEventListener("click", () => { haptic(6); swapColors(); });
    pop.querySelector(".cp-reset").addEventListener("click", () => { haptic(6); resetColors(); });
    renderPop();

    const r = anchor.getBoundingClientRect();
    if(r.top < innerHeight / 2){
      // Anclado arriba (barra de opciones): se despliega hacia abajo.
      pop.style.left = Math.max(6, Math.min(r.left, innerWidth - pop.offsetWidth - 6)) + "px";
      pop.style.top = (r.bottom + 8) + "px";
    } else {
      pop.style.right = Math.max(6, innerWidth - r.right) + "px";
      pop.style.bottom = Math.max(6, innerHeight - r.top + 8) + "px";
    }

    setTimeout(() => document.addEventListener("click", onOutside, true), 0);
    addEventListener("keydown", onKey);
  }

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "cs-launcher";
  launcher.setAttribute("aria-label", "Abrir selector de color");
  launcher.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); openPop(); });
  wrap.appendChild(launcher);
  if(!isMobile()) launcher.style.display = "none";
  openColorPopover = anchor => openPop(anchor);

  on("color:change", render);
  render();
}
