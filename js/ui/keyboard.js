/* ═══════════════════════════════════════════════════════════════
   TECLADO DEL MÓVIL
   El teclado en pantalla se abre ENCIMA de la página (no la encoge):
   lo que está pegado al borde inferior —el cajón de herramientas, las
   hojas de diálogo— queda tapado. `visualViewport` (Android e iPhone)
   dice cuánto alto queda libre; con eso se apoya el panel encima.
   ═══════════════════════════════════════════════════════════════ */

/** Alto del teclado en píxeles CSS (0 si no hay, o si lo que falta es
    sólo la barra del navegador, que aparece y desaparece). */
export function keyboardHeight(){
  const vv = window.visualViewport;
  if(!vv) return 0;
  const kb = Math.round(innerHeight - vv.height - vv.offsetTop);
  return kb > 80 ? kb : 0;
}

/** Campos que abren el teclado (no deslizadores, casillas, colores…). */
export const opensKeyboard = el => !!el && (el.tagName === "TEXTAREA" || el.isContentEditable ||
  (el.tagName === "INPUT" && /^(text|search|number|email|url|tel|password)$/.test(el.type || "text")));

/** Mientras un campo de `root` tiene el foco con el teclado abierto,
    llama a `fit(kb, freeHeight)`; al cerrarse, `fit(0)`. Devuelve una
    función para dejar de escuchar. */
export function followKeyboard(root, fit){
  const vv = window.visualViewport;
  let last = -1;
  const check = () => {
    const kb = opensKeyboard(document.activeElement) && root.contains(document.activeElement) ? keyboardHeight() : 0;
    if(kb === last) return;
    last = kb;
    fit(kb, kb ? Math.round(vv.height) : 0);
  };
  // El teclado tarda en abrirse: se vuelve a medir mientras se anima
  const onFocus = () => { for(const ms of [0, 120, 300, 600]) setTimeout(check, ms); };
  const onBlur = () => setTimeout(check, 0);
  root.addEventListener("focusin", onFocus);
  root.addEventListener("focusout", onBlur);
  vv?.addEventListener("resize", check);
  vv?.addEventListener("scroll", check);
  return () => {
    root.removeEventListener("focusin", onFocus);
    root.removeEventListener("focusout", onBlur);
    vv?.removeEventListener("resize", check);
    vv?.removeEventListener("scroll", check);
  };
}

/* ── Arreglo general para el resto de la app ──
   Los diálogos (dialog.js) y el cajón de herramientas (tooldrawer.js)
   ya se apoyan solos encima del teclado. Para todo lo demás —editores
   a pantalla completa (memes, Collage/Post, stickers, estilos, cámara,
   revelador RAW, cortar…) y paneles pegados abajo—: al escribir, el
   contenedor fijo más cercano que llega al borde inferior termina donde
   empieza el teclado (su `bottom` sube la altura del teclado), así su
   rejilla se recoloca y el pie con el campo queda a la vista. Si aun
   así el campo quedara tapado, se desplaza su lista hasta él. Al
   cerrarse el teclado todo vuelve como estaba. `body` y `#app` no se
   tocan: la ventana principal no cambia de tamaño por escribir. */
let lifted = null;   // { el, bottom, maxHeight }
const OWN = ".modal, #toolDrawer, .text-edit";
function bottomHost(input){
  for(let el = input.parentElement; el && el !== document.body && el.id !== "app"; el = el.parentElement){
    if(getComputedStyle(el).position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    return r.bottom >= innerHeight - 4 ? el : null;
  }
  return null;
}
function drop(){
  if(!lifted) return;
  lifted.el.style.bottom = lifted.bottom;
  lifted.el.style.maxHeight = lifted.maxHeight;
  lifted.el.classList.remove("kb-lifted");
  lifted = null;
}
function fitFocused(){
  const el = document.activeElement;
  const kb = opensKeyboard(el) && !el.closest(OWN) ? keyboardHeight() : 0;
  if(!kb){ drop(); return; }
  const host = lifted?.el.contains(el) ? lifted.el : bottomHost(el);
  if(host !== lifted?.el){ drop(); if(host) lifted = { el: host, bottom: host.style.bottom, maxHeight: host.style.maxHeight }; }
  if(lifted){
    lifted.el.style.bottom = `${kb}px`;
    lifted.el.style.maxHeight = `${Math.max(120, Math.round(window.visualViewport.height))}px`;
    lifted.el.classList.add("kb-lifted");
  }
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect(), limit = innerHeight - kb - 6;
    if(r.bottom > limit || r.top < 0) el.scrollIntoView({ block: "nearest" });
  });
}
export function installKeyboardFit(){
  const vv = window.visualViewport;
  if(!vv) return;
  const soon = () => { for(const ms of [0, 120, 300, 600]) setTimeout(fitFocused, ms); };
  document.addEventListener("focusin", e => { if(opensKeyboard(e.target) && !e.target.closest(OWN)) soon(); });
  document.addEventListener("focusout", () => setTimeout(fitFocused, 0));
  vv.addEventListener("resize", fitFocused);
  vv.addEventListener("scroll", fitFocused);
}
