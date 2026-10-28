/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · EDITOR DE MÁSCARAS
   Se pinta sobre la foto (ratón o dedo): en rojo lo que NO debe
   usarse (gente que pasa, un coche…) y en verde lo que debe salir de
   ESTA foto aunque otras lo cubran. Las máscaras son lienzos pequeños
   (`photo.excl`, `photo.keep`) que usa masks.js.
   ═══════════════════════════════════════════════════════════════ */

import { createOverlay, unitPoint } from "./overlay.js";
import { escText as esc } from "../../js/core/util/html.js";

const MASK_SIDE = 480;
const newMask = proxy => { const k = MASK_SIDE / Math.max(proxy.width, proxy.height), c = document.createElement("canvas"); c.width = Math.max(8, Math.round(proxy.width * k)); c.height = Math.max(8, Math.round(proxy.height * k)); return c; };
const TINT = { excl: "rgba(255,60,60,.6)", keep: "rgba(60,220,110,.6)" };

/**
 * @param photos   [{ name, proxy, excl, keep }] (las máscaras se crean al pintar)
 * @param index    foto con la que se abre
 * @param onChange se llama al terminar cada trazo (hay que recalcular)
 */
export function openMaskEditor({ photos, index = 0, onChange = () => {}, onClose = () => {} }){
  let cur = Math.min(Math.max(0, index), photos.length - 1), mode = "excl", brush = 6;
  const ov = createOverlay({ title: "Máscaras", onClose });
  ov.body.innerHTML = `<div class="pano-mask-stage"><canvas></canvas></div>
    <p class="pano-ov-hint">Pinta de <b style="color:#ff6b6b">rojo</b> lo que no debe usarse (personas que se mueven) y de <b style="color:#4fdc86">verde</b> lo que debe salir de esta foto.</p>`;
  ov.tools.innerHTML = `
    <select data-photo aria-label="Foto">${photos.map((p, i) => `<option value="${i}">${i + 1}. ${esc(p.name)}</option>`).join("")}</select>
    <div class="pano-seg" data-mode><button type="button" data-m="excl" class="on">Excluir</button><button type="button" data-m="keep">Mantener</button><button type="button" data-m="erase">Borrar</button></div>
    <label class="pano-range">Pincel<input type="range" min="1" max="20" value="${brush}" data-brush></label>
    <button type="button" data-clear>Limpiar foto</button>`;
  const cv = ov.body.querySelector("canvas"), x = cv.getContext("2d"), sel = ov.tools.querySelector("[data-photo]");
  sel.value = String(cur);
  sel.addEventListener("change", () => { cur = +sel.value; draw(); });
  ov.tools.querySelector("[data-mode]").addEventListener("click", e => {
    const b = e.target.closest("[data-m]"); if(!b) return;
    mode = b.dataset.m; ov.tools.querySelectorAll("[data-m]").forEach(q => q.classList.toggle("on", q === b));
  });
  ov.tools.querySelector("[data-brush]").addEventListener("input", e => { brush = +e.target.value; });
  ov.tools.querySelector("[data-clear]").addEventListener("click", () => {
    const p = photos[cur];
    for(const k of ["excl", "keep"]) p[k]?.getContext("2d").clearRect(0, 0, p[k].width, p[k].height);
    draw(); onChange();
  });

  const tinted = (mask, color, w, h) => {
    const t = document.createElement("canvas"); t.width = w; t.height = h;
    const tx = t.getContext("2d"); tx.drawImage(mask, 0, 0, w, h);
    tx.globalCompositeOperation = "source-in"; tx.fillStyle = color; tx.fillRect(0, 0, w, h);
    return t;
  };
  function draw(){
    const p = photos[cur];
    cv.width = p.proxy.width; cv.height = p.proxy.height;
    x.drawImage(p.proxy, 0, 0);
    for(const k of ["excl", "keep"]) if(p[k]) x.drawImage(tinted(p[k], TINT[k], cv.width, cv.height), 0, 0);
  }

  let last = null;
  const stroke = (a, b) => {
    const p = photos[cur];
    p.excl ||= newMask(p.proxy); p.keep ||= newMask(p.proxy);
    const w = p.excl.width, h = p.excl.height, lw = Math.max(2, brush / 100 * w * 1.2);
    const line = (ctx, op) => {
      ctx.globalCompositeOperation = op; ctx.strokeStyle = ctx.fillStyle = "#fff"; ctx.lineCap = ctx.lineJoin = "round"; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(a.u * w, a.v * h); ctx.lineTo(b.u * w, b.v * h); ctx.stroke();
      ctx.beginPath(); ctx.arc(b.u * w, b.v * h, lw / 2, 0, 7); ctx.fill();
    };
    const on = mode === "erase" ? null : p[mode], off = mode === "excl" ? p.keep : mode === "keep" ? p.excl : null;
    if(on) line(on.getContext("2d"), "source-over");
    for(const m of [off, mode === "erase" ? p.excl : null, mode === "erase" ? p.keep : null]) if(m) line(m.getContext("2d"), "destination-out");
  };
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); last = unitPoint(cv, e); stroke(last, last); draw(); });
  cv.addEventListener("pointermove", e => { if(!last) return; const q = unitPoint(cv, e); stroke(last, q); last = q; draw(); });
  const up = () => { if(last){ last = null; onChange(); } };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  draw();
  return ov;
}
