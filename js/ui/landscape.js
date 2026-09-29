/* ═══════════════════════════════════════════════════════════════
   AVISO DE MÓVIL EN HORIZONTAL
   En un teléfono (Android o iPhone) girado, Realify avisa de que está
   pensado para usarse en vertical y de que la versión de escritorio es
   para ordenador. Se puede seguir en horizontal: «Seguir así» lo oculta
   hasta que se cierre la pestaña (sessionStorage); si no, vuelve a
   salir cada vez que el teléfono se ponga en horizontal y desaparece
   solo al volver a vertical. Nunca sale en tabletas ni ordenadores.
   ═══════════════════════════════════════════════════════════════ */
import { isPhone } from "../core/device.js";

const KEY = "realify.landscapeOk";
let el = null;

function build(){
  el = document.createElement("div");
  el.className = "landscape-notice";
  el.setAttribute("role", "alertdialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "lnTitle");
  el.innerHTML = `
    <div class="ln-card">
      <svg class="ln-ic" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="21" y="8" width="22" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="3"/>
        <circle cx="32" cy="42" r="1.8" fill="currentColor"/>
        <path d="M50 30a18 18 0 0 1-9 15.6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <path d="m36.5 44 4.7 1.9-.9 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h2 id="lnTitle">Gira el móvil</h2>
      <p>Realify está optimizado para usarse en el <b>móvil en vertical</b>.</p>
      <p>La versión de escritorio debe usarse en un <b>ordenador</b>.</p>
      <button type="button" class="ln-go">Seguir en horizontal</button>
    </div>`;
  el.querySelector(".ln-go").addEventListener("click", () => {
    try{ sessionStorage.setItem(KEY, "1"); }catch{}
    update();
  });
  document.body.appendChild(el);
}

function dismissed(){ try{ return sessionStorage.getItem(KEY) === "1"; }catch{ return false; } }

function update(){
  const land = matchMedia("(orientation: landscape)").matches;
  const show = land && isPhone() && !dismissed();
  if(show && !el) build();
  if(el) el.hidden = !show;
}

export function initLandscapeNotice(){
  update();
  matchMedia("(orientation: landscape)").addEventListener("change", update);
  addEventListener("resize", update);
}
