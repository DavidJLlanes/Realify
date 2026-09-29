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
