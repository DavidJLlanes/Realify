/* ═══════════════════════════════════════════════════════════════
   PANEL DE CAPAS · OPACIDAD Y MODO DE FUSIÓN
   Los dos mandos de la capa activa bajo la lista de capas: el deslizador de opacidad (un solo paso de historial por gesto) y el
   desplegable del modo de fusión. Entradas: wireLayerControls() (una vez, al iniciar los paneles) · syncLayerControls() (tras repintar).
   Salidas: cambios en la capa activa con su entrada de historial. Límites: sólo la capa activa.
   ═══════════════════════════════════════════════════════════════ */
import { emit } from "../core/bus.js";
import { activeLayer } from "../core/doc.js";
import { record } from "../core/history.js";

const opacityEl = document.getElementById("layerOpacity");
const opacityVal = document.getElementById("layerOpacityVal");
const blendEl = document.getElementById("layerBlend");

export function wireLayerControls(){
  let before = null;
  opacityEl.addEventListener("pointerdown", () => {
    const l = activeLayer(); before = l ? l.opacity : null;
  });
  opacityEl.addEventListener("input", () => {
    const l = activeLayer();
    if(!l) return;
    // Con el teclado (flechas, Inicio/Fin) no hay `pointerdown`: sin
    // esto `before` seguía a null y el cambio no llegaba al historial.
    if(before === null) before = l.opacity;
    l.opacity = +opacityEl.value / 100;
    opacityVal.textContent = opacityEl.value + "%";
    emit("doc:change");
  });
  const commitOpacity = () => {
    const l = activeLayer();
    if(!l || before === null) return;
    const from = before, to = l.opacity;
    before = null;
    if(Math.abs(from - to) < 1e-6) return;
    record("Opacidad",
      () => { l.opacity = from; emit("doc:structure"); emit("doc:change"); },
      () => { l.opacity = to;   emit("doc:structure"); emit("doc:change"); });
    emit("doc:structure");
  };
  opacityEl.addEventListener("pointerup", commitOpacity);
  opacityEl.addEventListener("change", commitOpacity);
  opacityEl.addEventListener("blur", commitOpacity);

  blendEl.addEventListener("change", () => {
    const l = activeLayer();
    if(!l) return;
    const from = l.blend, to = blendEl.value;
    l.blend = to;
    record("Modo de fusión",
      () => { l.blend = from; syncLayerControls(); emit("doc:change"); },
      () => { l.blend = to;   syncLayerControls(); emit("doc:change"); });
    emit("doc:change");
  });
}

export function syncLayerControls(){
  const l = activeLayer();
  const on = !!l;
  opacityEl.disabled = blendEl.disabled = !on;
  if(!on) return;
  opacityEl.value = Math.round(l.opacity * 100);
  opacityVal.textContent = opacityEl.value + "%";
  blendEl.value = l.blend;
}
