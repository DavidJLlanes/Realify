/* ═══════════════════════════════════════════════════════════════
   PRIMER USO EN MÓVIL
   Tres tarjetas breves, una detrás de otra, que señalan lo que no es
   obvio a la primera: el cajón de herramientas se abre desde su asa, la barra
   inferior concentra lo habitual, y hay gestos (pellizco, arrastrar
   un asa) que ningún icono anuncia por sí solo. No bloquea nada si
   algo falla —el overlay no intercepta toques salvo en su propia
   tarjeta— y no vuelve a aparecer tras la primera vez.
   ═══════════════════════════════════════════════════════════════ */

import { isMobile, haptic } from "../core/device.js";
import { doc } from "../core/doc.js";

const KEY = "realify.onboarded.v1";

const STEPS = [
  { target: "#toolsHandle",
    text: "Todas las herramientas, ajustes y filtros están aquí, ordenados por categorías. Desliza para cambiar de categoría o escribe en el buscador para encontrar cualquiera." },
  { target: "#mobilebar",
    text: "Lo más habitual, abajo del todo: abrir, capas, exportar, deshacer/rehacer y el menú completo." },
  { target: null,
    text: "Pellizca con dos dedos para hacer zoom, y arrastra hacia abajo el asa de cualquier hoja o ajuste para cerrarlo." }
];

let active = false;

export function maybeShowOnboarding(){
  if(active || !isMobile() || !doc.open) return;
  try{ if(localStorage.getItem(KEY)) return; }catch{ return; }
  active = true;
  runStep(0);
}

function finish(){
  active = false;
  try{ localStorage.setItem(KEY, "1"); }catch{}
}

function runStep(i){
  if(i >= STEPS.length){ finish(); return; }
  const step = STEPS[i];
  const target = step.target ? document.querySelector(step.target) : null;

  const overlay = document.createElement("div");
  overlay.className = "onboard-overlay";

  if(target) target.classList.add("onboard-highlight");

  const card = document.createElement("div");
  card.className = "menu-pop onboard-card" + (target ? "" : " onboard-center");
  card.innerHTML = `
    <p>${step.text}</p>
    <div class="onboard-foot">
      <button type="button" class="ghost onboard-skip">Saltar</button>
      <button type="button" class="primary onboard-next">${i === STEPS.length - 1 ? "Entendido" : "Siguiente"}</button>
    </div>`;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  if(target){
    const r = target.getBoundingClientRect();
    if(r.top > innerHeight / 2) card.style.bottom = Math.max(8, innerHeight - r.top + 10) + "px";
    else card.style.top = Math.max(8, r.bottom + 10) + "px";
  }

  const advance = () => {
    haptic(6);
    if(target) target.classList.remove("onboard-highlight");
    overlay.remove();
    runStep(i + 1);
  };
  const skip = () => {
    if(target) target.classList.remove("onboard-highlight");
    overlay.remove();
    finish();
  };
  card.querySelector(".onboard-next").addEventListener("click", advance);
  card.querySelector(".onboard-skip").addEventListener("click", skip);
}
