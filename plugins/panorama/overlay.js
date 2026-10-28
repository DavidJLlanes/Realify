/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · VENTANA SUPERPUESTA
   Capa a pantalla completa por encima del editor (máscaras y puntos
   de control). Escritorio y móvil: barra de arriba con el título y
   «Hecho», el contenido en medio y las herramientas abajo.
   ═══════════════════════════════════════════════════════════════ */

import { escAttr as esc } from "../../js/core/util/html.js";

/** Crea la capa. Devuelve { root, body, tools, close }; `onClose()` se llama al pulsar «Hecho» o Escape. */
export function createOverlay({ title, onClose = () => {} }){
  const root = document.createElement("section");
  root.className = "pano-ov";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", title);
  root.innerHTML = `<header><b>${esc(title)}</b><button type="button" class="primary" data-done>Hecho</button></header><div class="pano-ov-body"></div><footer class="pano-ov-tools"></footer>`;
  document.body.appendChild(root);
  let closed = false;
  const close = () => { if(closed) return; closed = true; document.removeEventListener("keydown", onKey, true); root.remove(); onClose(); };
  const onKey = e => { if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener("keydown", onKey, true);
  root.querySelector("[data-done]").addEventListener("click", close);
  return { root, body: root.querySelector(".pano-ov-body"), tools: root.querySelector(".pano-ov-tools"), close };
}

/** Coordenadas (0–1) de un evento de puntero dentro de un elemento. */
export function unitPoint(el, e){
  const r = el.getBoundingClientRect();
  return { u: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
}
