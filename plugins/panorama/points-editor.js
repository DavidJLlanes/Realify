/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · PUNTOS DE CONTROL
   Cuando una unión sale mal (poca textura, repeticiones, noche) se
   marca a mano el MISMO detalle en dos fotos: se toca en la primera,
   se toca en la segunda (con lupa mientras se arrastra para afinar) y
   se pulsa «Añadir punto». Hacen falta 4 como mínimo; con 8 o más,
   mejor. Se guardan en coordenadas 0–1 de cada foto:
     manual = [{ a: idFoto, b: idFoto, pts: [ua, va, ub, vb, …] }]
   ═══════════════════════════════════════════════════════════════ */

import { createOverlay, unitPoint } from "./overlay.js";
import { escText as esc } from "../../js/core/util/html.js";

export const MIN_POINTS = 4;
const LOUPE = 110, ZOOM = 3.5;

/** Puntos (de a, de b) que ya hay entre dos fotos: [{ pa:{u,v}, pb:{u,v} }]. */
export function pairPoints(manual, A, B){
  const out = [];
  for(const m of manual){
    const fwd = m.a === A && m.b === B, rev = m.a === B && m.b === A;
    if(!fwd && !rev) continue;
    for(let i = 0; i + 3 < m.pts.length; i += 4){
      const p = { u: m.pts[i], v: m.pts[i + 1] }, q = { u: m.pts[i + 2], v: m.pts[i + 3] };
      out.push(fwd ? { pa: p, pb: q } : { pa: q, pb: p });
    }
  }
  return out;
}

/**
 * @param photos   [{ id, name, proxy }]
 * @param manual   lista que se modifica en el sitio (ver arriba)
 * @param onChange se llama al añadir o quitar puntos (hay que recalcular)
 */
export function openPointsEditor({ photos, manual, onChange = () => {}, onClose = () => {} }){
  let A = 0, B = Math.min(1, photos.length - 1);
  const pending = { a: null, b: null };
  const ov = createOverlay({ title: "Puntos de control", onClose });
  const opts = photos.map((p, i) => `<option value="${i}">${i + 1}. ${esc(p.name)}</option>`).join("");
  ov.body.innerHTML = `<div class="pano-pts-pair"><div class="pano-pts-cell"><canvas data-side="a"></canvas></div><div class="pano-pts-cell"><canvas data-side="b"></canvas></div></div>
    <canvas class="pano-loupe" width="${LOUPE}" height="${LOUPE}" hidden></canvas>
    <p class="pano-ov-hint" data-hint></p>`;
  ov.tools.innerHTML = `<label>Foto A <select data-a>${opts}</select></label><label>Foto B <select data-b>${opts}</select></label>
    <button type="button" class="primary" data-add disabled>Añadir punto</button>
    <button type="button" data-undo>Quitar último</button><button type="button" data-clear>Quitar los de esta pareja</button>`;
  const cvs = { a: ov.body.querySelector('[data-side="a"]'), b: ov.body.querySelector('[data-side="b"]') }, loupe = ov.body.querySelector(".pano-loupe"), lx = loupe.getContext("2d");
  const selA = ov.tools.querySelector("[data-a]"), selB = ov.tools.querySelector("[data-b]"), add = ov.tools.querySelector("[data-add]"), hint = ov.body.querySelector("[data-hint]");
  selA.value = String(A); selB.value = String(B);
  selA.addEventListener("change", () => { A = +selA.value; reset(); });
  selB.addEventListener("change", () => { B = +selB.value; reset(); });

  const ids = () => [photos[A].id, photos[B].id];
  function reset(){ pending.a = pending.b = null; draw(); }
  function marker(ctx, w, h, p, label, color){
    const r = Math.max(7, w / 90);
    ctx.lineWidth = Math.max(2, r / 3); ctx.strokeStyle = color; ctx.fillStyle = "#000a";
    ctx.beginPath(); ctx.arc(p.u * w, p.v * h, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.u * w - r * 1.6, p.v * h); ctx.lineTo(p.u * w + r * 1.6, p.v * h); ctx.moveTo(p.u * w, p.v * h - r * 1.6); ctx.lineTo(p.u * w, p.v * h + r * 1.6); ctx.stroke();
    if(label){ ctx.fillStyle = color; ctx.font = `bold ${Math.round(r * 1.8)}px sans-serif`; ctx.fillText(label, p.u * w + r * 1.2, p.v * h - r * 1.2); }
  }
  function draw(){
    const list = pairPoints(manual, ...ids());
    for(const side of ["a", "b"]){
      const p = photos[side === "a" ? A : B], cv = cvs[side], x = cv.getContext("2d");
      cv.width = p.proxy.width; cv.height = p.proxy.height; x.drawImage(p.proxy, 0, 0);
      list.forEach((q, i) => marker(x, cv.width, cv.height, side === "a" ? q.pa : q.pb, String(i + 1), "#58a6ff"));
      if(pending[side]) marker(x, cv.width, cv.height, pending[side], "", "#ffd33d");
    }
    add.disabled = !(pending.a && pending.b);
    hint.textContent = A === B ? "Elige dos fotos distintas." : list.length < MIN_POINTS
      ? `${list.length} de ${MIN_POINTS} puntos. Toca el mismo detalle en las dos fotos (se puede arrastrar para afinar) y pulsa «Añadir punto».`
      : `${list.length} puntos entre estas dos fotos. Con 8 o más la unión es más fiable.`;
  }
  function showLoupe(side, p){
    const cv = cvs[side], src = LOUPE / ZOOM * (cv.width / 600), sx = p.u * cv.width - src / 2, sy = p.v * cv.height - src / 2;
    loupe.hidden = false; lx.fillStyle = "#000"; lx.fillRect(0, 0, LOUPE, LOUPE);
    lx.drawImage(cv, sx, sy, src, src, 0, 0, LOUPE, LOUPE);
    lx.strokeStyle = "#ffd33d"; lx.lineWidth = 1.5; lx.beginPath(); lx.moveTo(LOUPE / 2, 0); lx.lineTo(LOUPE / 2, LOUPE); lx.moveTo(0, LOUPE / 2); lx.lineTo(LOUPE, LOUPE / 2); lx.stroke();
    loupe.style.left = side === "a" ? "auto" : "8px"; loupe.style.right = side === "a" ? "8px" : "auto";
  }
  for(const side of ["a", "b"]){
    const cv = cvs[side]; cv.style.touchAction = "none"; let drag = false;
    const put = e => { pending[side] = unitPoint(cv, e); draw(); showLoupe(side, pending[side]); };
    cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); drag = true; put(e); });
    cv.addEventListener("pointermove", e => { if(drag) put(e); });
    const end = () => { drag = false; loupe.hidden = true; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  }
  add.addEventListener("click", () => {
    if(!pending.a || !pending.b || A === B) return;
    const [ia, ib] = ids(), fwd = manual.find(m => m.a === ia && m.b === ib), rev = manual.find(m => m.a === ib && m.b === ia);
    if(fwd) fwd.pts.push(pending.a.u, pending.a.v, pending.b.u, pending.b.v);
    else if(rev) rev.pts.push(pending.b.u, pending.b.v, pending.a.u, pending.a.v);
    else manual.push({ a: ia, b: ib, pts: [pending.a.u, pending.a.v, pending.b.u, pending.b.v] });
    reset(); onChange();
  });
  const entry = () => { const [ia, ib] = ids(); return manual.find(m => (m.a === ia && m.b === ib) || (m.a === ib && m.b === ia)); };
  ov.tools.querySelector("[data-undo]").addEventListener("click", () => {
    const e = entry(); if(!e) return;
    e.pts.splice(-4, 4); if(!e.pts.length) manual.splice(manual.indexOf(e), 1);
    reset(); onChange();
  });
  ov.tools.querySelector("[data-clear]").addEventListener("click", () => { const e = entry(); if(e){ manual.splice(manual.indexOf(e), 1); reset(); onChange(); } });
  draw();
  return ov;
}
