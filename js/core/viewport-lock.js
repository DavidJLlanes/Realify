/* ═══════════════════════════════════════════════════════════════
   BLOQUEO DEL VIEWPORT EN MÓVIL
   La etiqueta <meta viewport> pide `user-scalable=no`, pero Safari en
   iOS la ignora desde iOS 10 y algunos Android también: pellizcar sobre
   un panel o un diálogo agrandaba la PÁGINA entera, y a partir de ahí
   todo lo que está en `position:fixed` se dibuja desplazado respecto
   de donde el navegador registra el toque — el síntoma de «pongo el
   dedo aquí y la app pulsa allá». Lo mismo pasa cuando iOS desplaza el
   documento para enfocar un campo de texto y lo deja así al salir.

   Aquí se cierran las tres puertas:
   · pellizco y gestos propietarios de Safari fuera del lienzo (el
     lienzo ya se ocupa del suyo con touch-action:none);
   · doble toque para ampliar (touch-action en CSS + retén aquí);
   · desplazamiento residual del documento: se devuelve a (0,0) cada
     vez que el teclado se va o el viewport visual cambia.
   ═══════════════════════════════════════════════════════════════ */

const stage = document.getElementById("stage");
const inStage = t => stage && t instanceof Node && stage.contains(t);

/* WebKit no expone una media query específica de iOS y las versiones
   antiguas ni siquiera informan siempre de display-mode:standalone.
   Esta clase permite que mobile.css aplique el ajuste del borde sólo
   a una PWA realmente instalada en un iPhone/iPad. */
const isIOS = /iP(hone|ad|od)/.test(navigator.platform) ||
  (/Mac/.test(navigator.platform || "") && navigator.maxTouchPoints > 1);
const isStandalone = navigator.standalone === true ||
  matchMedia("(display-mode:standalone)").matches;
if(isIOS && isStandalone){
  document.documentElement.classList.add("ios-standalone");
}

// Pellizco fuera del lienzo → nada
addEventListener("touchmove", e => {
  if(e.touches.length > 1 && !inStage(e.target)) e.preventDefault();
}, { passive: false });
addEventListener("touchstart", e => {
  if(e.touches.length > 1 && !inStage(e.target)) e.preventDefault();
}, { passive: false });

// Gestos propietarios de Safari, en todo el documento
["gesturestart", "gesturechange", "gestureend"].forEach(n =>
  document.addEventListener(n, e => e.preventDefault(), { passive: false }));

// Ctrl+rueda / pellizco de trackpad fuera del lienzo: zoom de página
addEventListener("wheel", e => {
  if(e.ctrlKey && !inStage(e.target)) e.preventDefault();
}, { passive: false });

// El doble toque para ampliar lo desactiva `touch-action:pan-x pan-y`
// en base.css; anularlo aquí con preventDefault se comería el segundo
// clic de cualquier botón pulsado deprisa.
addEventListener("touchend", () => resetScroll(), { passive: true });

/* El documento nunca debería desplazarse (html,body overflow:hidden),
   pero iOS lo hace igual para enseñar el campo enfocado. Al salir del
   campo se recoloca; si no, la interfaz queda «subida» unos píxeles y
   todos los toques caen desplazados. */
function resetScroll(){
  if(window.scrollX || window.scrollY) window.scrollTo(0, 0);
  if(document.documentElement.scrollTop) document.documentElement.scrollTop = 0;
  if(document.body.scrollTop) document.body.scrollTop = 0;
}
addEventListener("focusout", () => setTimeout(resetScroll, 50));
addEventListener("orientationchange", () => setTimeout(resetScroll, 120));
if(window.visualViewport){
  let t = null;
  visualViewport.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(resetScroll, 60); });
  visualViewport.addEventListener("scroll", () => {
    // Si la página no está ampliada, no hay motivo para que el viewport
    // visual se mueva: es el desplazamiento residual del teclado.
    if(visualViewport.scale <= 1.001) resetScroll();
  });
}
