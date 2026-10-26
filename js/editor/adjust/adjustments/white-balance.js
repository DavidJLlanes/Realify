/* ═══════════════════════════════════════════════════════════════
   adjustments · white balance
   Parte de js/editor/adjust/adjustments.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, applyLut, slider, pickerGroup, liftImageAbove } from "../adjust.js";
import { doc } from "../../../core/doc.js";
import { averageRGB, PIPETTE_SVG } from "../../../ui/kit/wbpick.js";
import { toImage } from "../../../core/view.js";
import { toast } from "../../../core/toast.js";
import { clamp255 } from "./common.js";

/* ── balance de blancos ───────────────────────────────────────── */
export function whiteBalance(opts = {}){
  const p = { temp: 0, tint: 0, ...opts.init };

  return runAdjust({
    title: "Balance de blancos",
    asLayer: true, filterId: "whiteBalance", filterParams: p,
    float: true,
    compute(data){
      const lut = buildWB(p);
      applyLut(data, lut);
    },
    buildBody({ preview, source }){
      const box = document.createElement("div");
      let sTemp, sTint;
      /* Cuentagotas sobre la propia imagen abierta: se lee `source`, la
         capa TAL CUAL estaba al abrir (sin este balance), porque lo que
         se ve en el lienzo ya está corregido y cada toque corregiría
         sobre lo corregido. */
      const pick = wbEyedropper(sampleCanvas(source), p, () => {
        sTemp.setValue(p.temp); sTint.setValue(p.tint); preview();
      });
      sTemp = slider("Temperatura", -100, 100, p.temp, v => { p.temp = v; preview(); });
      sTint = slider("Tinte", -100, 100, p.tint, v => { p.tint = v; preview(); });
      box.appendChild(pickerGroup([
        { label: "Temperatura", node: sTemp },
        { label: "Tinte", node: sTint }
      ]));
      box.appendChild(pick.el);
      liftImageAbove(box);
      return box;
    }
  }, opts);
}

/* Lector de la media de un pequeño entorno de `canvas` (que cubre el
   documento entero, a cualquier escala) en coordenadas del documento. */
export function sampleCanvas(canvas){
  if(!canvas) return () => null;
  const cx = canvas.getContext("2d", { willReadFrequently: true });
  return (x, y) => {
    const sx = canvas.width / doc.w, sy = canvas.height / doc.h;
    const px = Math.floor(x * sx), py = Math.floor(y * sy);
    if(px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
    const rad = Math.max(2, Math.round(Math.max(canvas.width, canvas.height) / 400));
    const x0 = Math.max(0, px - rad), y0 = Math.max(0, py - rad);
    const w = Math.min(canvas.width - 1, px + rad) - x0 + 1, h = Math.min(canvas.height - 1, py + rad) - y0 + 1;
    const d = cx.getImageData(x0, y0, w, h).data;
    return averageRGB(d, w, h, px - x0, py - y0, rad);
  };
}

/* ── Cuentagotas de punto blanco (plugin y capa de ajuste) ──
   Un botón «Cuentagotas»: con él activo, el siguiente toque SOBRE LA
   IMAGEN ABIERTA (el lienzo, alrededor del diálogo o de la hoja) se
   usa como punto que debería ser blanco o gris neutro, y se calculan la
   temperatura y el tinte que lo dejan neutro. El ajuste se ve en el
   propio lienzo, en tiempo real, como el resto de ajustes.
     - `sampleAt(x, y)` (coordenadas del documento) devuelve la media de
       un pequeño entorno de la imagen SIN este balance: { rgb, clipped }.
     - Tras elegir, el modo se apaga solo.
   `onChange()` se llama tras escribir p.temp/p.tint. */
export function wbEyedropper(sampleAt, p, onChange){
  const row = document.createElement("div");
  row.className = "wb-pick-row";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "wb-pick-btn";
  btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = `${PIPETTE_SVG}<span>Cuentagotas</span>`;
  btn.title = "Toca en la imagen un punto que deba ser blanco o gris neutro";
  const hint = document.createElement("span");
  hint.className = "wb-pick-hint"; hint.hidden = true;
  hint.textContent = "Toca en la imagen algo blanco o gris";
  row.append(btn, hint);

  let picking = false;
  const stage = document.getElementById("stage");
  const onImage = t => (t.classList?.contains("modal") && !t.closest(".modal-card")) || (stage && stage.contains(t));
  const down = e => {
    if(!picking || !onImage(e.target) || !doc.open) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const q = toImage(e.clientX, e.clientY);
    setPicking(false);
    const s = sampleAt(q.x, q.y);
    if(!s){ toast("Toca dentro de la imagen"); return; }
    if(Math.max(...s.rgb) < 12){ toast("Ese punto es casi negro: elige una zona gris o blanca con algo de luz"); return; }
    const res = grayPointToWB(...s.rgb);
    p.temp = res.temp; p.tint = res.tint;
    onChange();
    if(res.limited) toast("Ese punto tiene un tono muy fuerte: la corrección se ha quedado en el límite");
    else if(s.clipped) toast("Ese punto está quemado: el balance puede no ser exacto; mejor un gris claro");
    else toast(`Balance ajustado: temperatura ${res.temp}, tinte ${res.tint}`, "ok");
  };
  // Se traga también el clic que sigue al toque, para que no llegue al
  // lienzo ni cierre nada.
  let swallowClick = false;
  const click = e => { if(swallowClick && onImage(e.target)){ e.preventDefault(); e.stopPropagation(); swallowClick = false; } };
  const setPicking = on => {
    picking = on;
    btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", String(on));
    hint.hidden = !on;
    document.body.classList.toggle("wb-picking", on);
    if(on){ document.addEventListener("pointerdown", down, true); document.addEventListener("click", click, true); }
    else { document.removeEventListener("pointerdown", down, true); swallowClick = true; setTimeout(() => { swallowClick = false; document.removeEventListener("click", click, true); }, 400); }
  };
  btn.addEventListener("click", () => setPicking(!picking));
  // Si el diálogo o el panel se cierran con el modo activo, se apaga
  const obs = new MutationObserver(() => { if(!row.isConnected && picking){ setPicking(false); obs.disconnect(); } });
  requestAnimationFrame(() => obs.observe(document.body, { childList: true, subtree: true }));
  return { el: row, setPicking };
}

/* Modelo multiplicativo sencillo: la temperatura mueve rojo y azul en
   direcciones opuestas, el tinte mueve el verde frente a los otros
   dos. No es la adaptación cromática completa de un revelador de RAW,
   pero para corregir un tono dominante es más que suficiente y es
   trivialmente invertible, que es lo que hace falta para el
   cuentagotas de abajo. */
/* Ganancias de cada canal del balance de blancos (también las usa la
   exportación de alta precisión, sin redondear). */
export function wbGains({ temp, tint }){
  const t = temp / 100, g = tint / 100;
  return { r: 1 + t * 0.4, g: 1 - g * 0.25, b: 1 - t * 0.4 };
}

export function buildWB({ temp, tint }){
  const { r: rGain, g: gGain, b: bGain } = wbGains({ temp, tint });
  const mk = gain => { const a = new Uint8ClampedArray(256);
    for(let i = 0; i < 256; i++) a[i] = clamp255(i * gain); return a; };
  return { r: mk(rGain), g: mk(gGain), b: mk(bGain) };
}

/* Deshace el modelo anterior: a partir de un color que debería ser
   gris, la temperatura y el tinte que lo dejan EXACTAMENTE neutro.
     r·(1+0,4t) = b·(1−0,4t)   →  t = (b−r) / (0,4·(r+b))
   y los dos quedan en n = 2rb/(r+b) (su media armónica, casi el mismo
   brillo); el verde se lleva a ese mismo valor:
     g·(1−0,25k) = n           →  k = (1 − n/g) / 0,25
   Antes se promediaban dos estimaciones de t y el punto quedaba casi,
   pero no del todo, gris. `limited`: hizo falta más de ±100. */
function grayPointToWB(r, g, b){
  r = Math.max(1, r); g = Math.max(1, g); b = Math.max(1, b);
  const t = (b - r) / (0.4 * (r + b));
  const n = 2 * r * b / (r + b);
  const k = (1 - n / g) / 0.25;
  return {
    temp: Math.round(clamp1(t) * 100),
    tint: Math.round(clamp1(k) * 100),
    limited: Math.abs(t) > 1.005 || Math.abs(k) > 1.005
  };
}

const clamp1 = v => Math.max(-1, Math.min(1, v));
