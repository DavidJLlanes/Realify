/* ═══════════════════════════════════════════════════════════════
   DIÁLOGOS
   Un constructor genérico: se le pasa un título, un cuerpo y unos
   botones, y devuelve una promesa con lo que el usuario eligió. El
   foco queda atrapado dentro mientras está abierto, porque si no
   quien navega con teclado se sale por detrás y se pierde.
   ═══════════════════════════════════════════════════════════════ */

import { view, zoomAt } from "../editor/view.js";
import { isMobile as isPhone, haptic } from "../core/device.js";

const FOCUSABLE = 'button, [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
let openCount = 0;

/* Dónde dejó el usuario cada diálogo, por título. Un panel que se
   aparta para ver la foto y vuelve al centro la próxima vez obliga a
   apartarlo otra vez cada vez que se abre. */
const POS_KEY = "realify.dlgpos";
let savedPos = {};
try{ savedPos = JSON.parse(localStorage.getItem(POS_KEY) || "{}"); }catch{}

/* Arrastrar el diálogo por su cabecera. Se mueve con `transform`, así
   que el centrado por flexbox sigue intacto y basta con desplazar
   desde donde el navegador lo había puesto. El fondo nunca se oscurece
   (ni en reposo ni arrastrando), así que no hay nada que aclarar aquí. */
function makeDraggable(card, head, key){
  if(isPhone()) return;
  head.style.cursor = "move";
  head.style.touchAction = "none";
  head.style.userSelect = "none";

  let dx = 0, dy = 0, drag = null;

  const place = () => {
    card.style.transform = (dx || dy) ? `translate(${dx}px,${dy}px)` : "";
  };

  if(key && savedPos[key]){ dx = savedPos[key].x || 0; dy = savedPos[key].y || 0; }

  // Que no se quede fuera de la pantalla al restaurar una posición
  // guardada con la ventana de otro tamaño.
  requestAnimationFrame(() => {
    if(!dx && !dy) return;
    const r = card.getBoundingClientRect();
    const maxX = innerWidth  - 80, maxY = innerHeight - 60;
    if(r.left > maxX || r.right < 80 || r.top > maxY || r.bottom < 40){ dx = dy = 0; }
    place();
  });
  place();

  head.addEventListener("pointerdown", e => {
    if(e.target.closest("button")) return;      // la ✕ y demás siguen siendo botones
    drag = { x: e.clientX, y: e.clientY, dx, dy };
    head.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  head.addEventListener("pointermove", e => {
    if(!drag) return;
    dx = drag.dx + (e.clientX - drag.x);
    dy = drag.dy + (e.clientY - drag.y);
    place();
  });
  const stop = () => {
    if(!drag) return;
    drag = null;
    if(key){
      savedPos[key] = { x: dx, y: dy };
      try{ localStorage.setItem(POS_KEY, JSON.stringify(savedPos)); }catch{}
    }
  };
  head.addEventListener("pointerup", stop);
  head.addEventListener("pointercancel", stop);
}

/* Arrastrar el asa de la hoja hacia abajo la cierra, igual que la
   hoja de paneles (`js/ui/panels.js`'s `initGrip`): misma heurística
   de velocidad+distancia, para que el gesto se sienta idéntico en
   toda la app en vez de que cada hoja invente el suyo. */
function makeSheetDismissable(card, handle, close){
  if(!isPhone()) return;
  let start = null;
  handle.addEventListener("pointerdown", e => {
    start = { y: e.clientY, t: performance.now() };
    handle.setPointerCapture(e.pointerId);
    card.style.transition = "none";
  });
  handle.addEventListener("pointermove", e => {
    if(!start) return;
    const dy = Math.max(0, e.clientY - start.y);
    card.style.transform = `translateY(${dy}px)`;
  });
  const end = e => {
    if(!start) return;
    const dy = Math.max(0, e.clientY - start.y);
    const dt = performance.now() - start.t;
    const fast = dy / Math.max(dt, 1) > 0.5;
    card.style.transition = "";
    card.style.transform = "";
    if(fast || dy > 110) close(null);
    start = null;
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

export function dialog({ title, body, buttons = [], wide = false, cls = "", onOpen }){
  return new Promise(resolve => {
    const back = document.createElement("div");
    back.className = "modal";
    back.innerHTML = `
      <div class="modal-card${wide ? " wide" : ""}${cls ? " " + cls : ""}" role="dialog" aria-modal="true">
        <div class="sheet-grab"></div>
        <div class="modal-head">
          <h2></h2>
          <button class="icon ghost" data-close aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body"></div>
        ${buttons.length ? '<div class="modal-foot"></div>' : ""}
      </div>`;

    back.querySelector("h2").textContent = title || "";
    const bodyEl = back.querySelector(".modal-body");
    if(typeof body === "string") bodyEl.innerHTML = body;
    else if(body) bodyEl.appendChild(body);

    const foot = back.querySelector(".modal-foot");
    const close = value => {
      back.remove();
      openCount--;
      document.removeEventListener("keydown", onKey, true);
      if(prev && prev.focus) prev.focus();
      resolve(value);
    };

    if(foot){
      for(const b of buttons){
        const el = document.createElement("button");
        el.textContent = b.label;
        if(b.primary) el.className = "primary";
        if(b.danger) el.className = "danger";
        el.addEventListener("click", () => {
          if(b.onClick && b.onClick(bodyEl) === false) return;
          if(b.primary) haptic(10);
          close(b.value === undefined ? b.label : b.value);
        });
        foot.appendChild(el);
      }
    }

    back.querySelector("[data-close]").addEventListener("click", () => close(null));
    back.addEventListener("click", e => { if(e.target === back) close(null); });

    /* El fondo del diálogo nunca se oscurece (ver comentario de
       `makeDraggable`), así que el lienzo sigue visible alrededor de
       la tarjeta y ésta se puede arrastrar a un lado. La rueda sobre
       ese fondo hace zoom en la imagen igual que si el diálogo no
       estuviera: sólo cuando `e.target` es el propio fondo, nunca
       sobre la tarjeta, donde la rueda debe poder seguir haciendo
       scroll dentro del panel. */
    back.addEventListener("wheel", e => {
      if(e.target !== back) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(view.zoom * f, e.clientX, e.clientY);
    }, { passive: false });

    const onKey = e => {
      if(e.key === "Escape"){
        e.preventDefault(); e.stopPropagation();
        close(null);
        return;
      }
      if(e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA"){
        const primary = buttons.find(b => b.primary);
        if(primary && !/^(SELECT)$/.test(e.target.tagName)){
          e.preventDefault();
          if(primary.onClick && primary.onClick(bodyEl) === false) return;
          close(primary.value === undefined ? primary.label : primary.value);
        }
        return;
      }
      if(e.key !== "Tab") return;
      const f = [...back.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if(!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    };

    const prev = document.activeElement;
    document.body.appendChild(back);
    openCount++;
    document.addEventListener("keydown", onKey, true);
    makeDraggable(back.querySelector(".modal-card"),
                  back.querySelector(".modal-head"), title || "");
    makeSheetDismissable(back.querySelector(".modal-card"),
                  back.querySelector(".sheet-grab"), close);

    if(onOpen) onOpen(bodyEl, { close });
    const f = bodyEl.querySelector(FOCUSABLE) || back.querySelector("[data-close]");
    if(f) f.focus();
  });
}

export const anyDialogOpen = () => openCount > 0;

/* Atajos habituales */
export const confirmDlg = (title, msg, okLabel = "Aceptar") =>
  dialog({ title, body: `<p class="hint" style="margin:0">${msg}</p>`, buttons:[
    { label:"Cancelar", value:false },
    { label:okLabel, value:true, primary:true }
  ]});

export function promptDlg(title, label, value = ""){
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="field stack"><label>${label}</label>
    <input type="text" class="grow" value="${String(value).replace(/"/g,"&quot;")}"></div>`;
  const input = wrap.querySelector("input");
  return dialog({ title, body: wrap, buttons:[
    { label:"Cancelar", value:null },
    { label:"Aceptar", primary:true, value:"__ok" }
  ]}).then(r => r === "__ok" ? input.value : null);
}
