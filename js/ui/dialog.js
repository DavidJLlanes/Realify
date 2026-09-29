/* ═══════════════════════════════════════════════════════════════
   DIÁLOGOS
   Un constructor genérico: se le pasa un título, un cuerpo y unos
   botones, y devuelve una promesa con lo que el usuario eligió. El
   foco queda atrapado dentro mientras está abierto, porque si no
   quien navega con teclado se sale por detrás y se pierde.
   ═══════════════════════════════════════════════════════════════ */

import { attachViewGestures, zoomIn, zoomOut, zoom100, fit } from "../editor/view.js";
import { isMobile as isPhone, haptic } from "../core/device.js";
import { autoCompact } from "./compact.js";
import { followKeyboard } from "./keyboard.js";

/* Enganches del grabador de acciones (features/actions.js):
   · onClose(título, índice del botón o -1, cuerpo) al cerrar;
   · autofill(título, cuerpo) al abrir: si devuelve un índice de botón,
     el diálogo se rellenó solo y se pulsa ese botón. */
let hooks = null;
export const setDialogHooks = h => { hooks = h; };

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

export function dialog({ title, body, buttons = [], wide = false, cls = "", onOpen, footStart = null }){
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
      if(hooks?.onClose){ try{ hooks.onClose(title || "", buttons.findIndex(b => (b.value === undefined ? b.label : b.value) === value), bodyEl, value); }catch{} }
      stopKeyboard?.();
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

    // Algo a la izquierda de la barra de botones (el interruptor Premium)
    if(foot && footStart){ footStart.classList.add("foot-start"); foot.prepend(footStart); }

    back.querySelector("[data-close]").addEventListener("click", () => close(null));

    /* El fondo del diálogo nunca se oscurece (ver comentario de
       `makeDraggable`), así que la imagen sigue a la vista alrededor de
       la tarjeta. Sobre ese fondo se puede ampliar y desplazar la imagen
       igual que si el diálogo no estuviera (rueda, pellizco, arrastre),
       para revisar de cerca un efecto antes de aplicarlo. Sólo cuando el
       gesto empieza en el propio fondo, nunca sobre la tarjeta, donde la
       rueda debe poder seguir haciendo scroll dentro del panel. */
    const gestured = attachViewGestures(back);

    /* Tocar fuera cierra sólo los diálogos sin nada que perder (avisos,
       listas para elegir). Uno con deslizadores o con un botón de aplicar
       es un efecto a medias: tocar la imagen para ampliarla no puede
       tirarlo. Se cierra con ✕, Cancelar o Esc. */
    const dismissable = () => !buttons.some(b => b.primary) && !bodyEl.querySelector('input[type="range"]');
    back.addEventListener("click", e => {
      if(e.target === back && !gestured() && dismissable()) close(null);
    });

    /* Zoom con el teclado (Ctrl + / − / 0 / 1) aunque el foco esté en
       un deslizador del diálogo, donde los atajos generales no llegan y
       el navegador ampliaría la página entera. */
    const ZOOM_KEYS = { "+": zoomIn, "=": zoomIn, "-": zoomOut, "0": () => fit(), "1": zoom100 };
    const onKey = e => {
      if((e.ctrlKey || e.metaKey) && !e.altKey && ZOOM_KEYS[e.key] && e.target.tagName !== "TEXTAREA" &&
         !(e.target.tagName === "INPUT" && /^(text|search|number)$/.test(e.target.type))){
        e.preventDefault(); e.stopPropagation();
        ZOOM_KEYS[e.key]();
        return;
      }
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

    /* Teclado del móvil: al escribir (medidas de «Documento nuevo», un
       nombre, un número…) la hoja se apoya ENCIMA del teclado —el fondo
       del diálogo termina donde empieza el teclado— y no pasa del alto
       libre; el campo con el foco se desplaza a la vista. Igual que el
       buscador del cajón de herramientas. */
    const card = back.querySelector(".modal-card");
    let stopKeyboard = followKeyboard(back, (kb, free) => {
      back.classList.toggle("kb-open", kb > 0);
      back.style.bottom = kb ? `${kb}px` : "";
      card.style.maxHeight = kb ? `${Math.max(160, free - 8)}px` : "";
      if(kb) requestAnimationFrame(() => document.activeElement?.scrollIntoView?.({ block: "nearest" }));
    });

    const prev = document.activeElement;
    document.body.appendChild(back);
    openCount++;
    document.addEventListener("keydown", onKey, true);
    makeDraggable(back.querySelector(".modal-card"),
                  back.querySelector(".modal-head"), title || "");
    makeSheetDismissable(back.querySelector(".modal-card"),
                  back.querySelector(".sheet-grab"), close);

    if(onOpen) onOpen(bodyEl, { close });
    /* Hojas de ajuste del móvil: los deslizadores apilados se agrupan
       tras un desplegable, como en Tono y saturación (ui/compact.js). */
    if(/\bdlg-compact\b/.test(cls)) autoCompact(bodyEl);
    if(hooks?.autofill){
      let idx = -2;
      try{ idx = hooks.autofill(title || "", bodyEl); }catch{}
      if(idx !== -2 && idx !== undefined){
        // Se deja un momento para que la vista previa se calcule con los valores puestos
        setTimeout(() => {
          if(!back.isConnected) return;
          const btn = idx >= 0 ? foot?.children[idx] : null;
          if(btn) btn.click(); else close(null);
        }, 120);
      }
    }
    /* En pantallas táctiles no se da el foco a ningún mando al abrir: en
       el iPhone, enfocar un desplegable lo DESPLIEGA solo (la lista de
       opciones aparecía abierta nada más abrir Tono y saturación) y un
       campo de texto saca el teclado. Los desplegables siempre aparecen
       cerrados; el foco va a la propia tarjeta, para el lector de
       pantalla y la tecla Tab. Con ratón y teclado, como siempre. */
    if(matchMedia("(pointer: coarse)").matches){
      const card = back.querySelector(".modal-card");
      card.tabIndex = -1; card.style.outline = "none";
      card.focus({ preventScroll: true });
    } else {
      const f = bodyEl.querySelector(FOCUSABLE) || back.querySelector("[data-close]");
      if(f) f.focus();
    }
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
