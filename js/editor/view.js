/* ═══════════════════════════════════════════════════════════════
   VISTA DEL LIENZO
   Zoom y desplazamiento con una sola transformación CSS sobre el
   contenedor. No se toca el tamaño de los lienzos al hacer zoom: el
   navegador escala con la GPU y va suave hasta en móviles flojos.
   ═══════════════════════════════════════════════════════════════ */

import { emit, on } from "../core/bus.js";
import { doc } from "../core/doc.js";
import { haptic } from "../core/device.js";

const stage    = document.getElementById("stage");
const board    = document.getElementById("board");
const scroller = document.getElementById("scroller");

export const view = { zoom: 1, x: 0, y: 0, fitted: true };

const ZMIN = 0.02, ZMAX = 32;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Cuánto se puede alejar el lienzo del centro antes de que ya no
   quede ni un borde alcanzable: como en Photoshop, se puede pasear la
   vista con la mano, pero nunca lo bastante como para perder el
   lienzo de vista del todo y no saber hacia dónde volver. Se deja un
   margen —una franja del propio lienzo, más un colchón fijo en
   pantalla— en vez de exigir que quede pegado al borde, que sería
   demasiado rígido. */
const MIN_VISIBLE = 0.12;   // al menos este tanto por uno del lienzo a la vista
const EDGE_SLACK = 60;      // colchón en píxeles de pantalla, aparte

/* Si el paneo/zoom llega al tope, un toque háptico breve avisa del
   límite igual que el rebote visual de iOS — pero sólo en el instante
   en que se alcanza (flanco de subida), no en cada fotograma mientras
   el dedo se queda apoyado contra el borde. */
let clampedEdge = false;
function clampView(){
  if(!doc.open) return;
  const w = doc.w * view.zoom, h = doc.h * view.zoom;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const marginX = Math.max(EDGE_SLACK, w * MIN_VISIBLE);
  const marginY = Math.max(EDGE_SLACK, h * MIN_VISIBLE);
  const nx = clamp(view.x, marginX - w, sw - marginX);
  const ny = clamp(view.y, marginY - h, sh - marginY);
  const hitEdge = nx !== view.x || ny !== view.y;
  if(hitEdge && !clampedEdge) haptic(14);
  clampedEdge = hitEdge;
  view.x = nx; view.y = ny;
}

/* Tamaño del escenario la última vez que se pintó la vista. Al cambiar
   el tamaño de la ventana hace falta para saber qué punto de la imagen
   estaba en el centro y volver a dejarlo ahí. */
let lastW = 0, lastH = 0;

export function apply(){
  if(!doc.open){ board.style.display = "none"; return; }
  board.style.display = "block";
  clampView();
  lastW = stage.clientWidth; lastH = stage.clientHeight;
  board.style.width  = doc.w + "px";
  board.style.height = doc.h + "px";
  board.style.transform = `translate(${view.x.toFixed(2)}px,${view.y.toFixed(2)}px) scale(${view.zoom})`;
  // Por encima del 250 % interesa ver el píxel, no una interpolación:
  // es cuando se está mirando grano y artefactos.
  board.classList.toggle("pixelated", view.zoom >= 2.5);
  emit("view:change");
}

export function fitScale(){
  if(!doc.open) return 1;
  const pad = 32;
  const w = stage.clientWidth  - pad;
  const h = stage.clientHeight - pad;
  return clamp(Math.min(w / doc.w, h / doc.h), ZMIN, 1);
}

/* Si el grid todavía no ha repartido el espacio —justo tras crear o
   abrir un documento, antes de que el navegador termine ese primer
   layout—, `stage.clientWidth/Height` valen 0. `fitScale()` dividiría
   por un hueco negativo y `clamp` lo aplastaría contra ZMIN (2 %): el
   documento se vería como una mota minúscula pegada a la esquina en
   vez de ajustado a la ventana. Mejor esperar un fotograma más a que
   el layout esté listo de verdad, con un tope para no reintentar para
   siempre si #stage se quedara a 0 por algún otro motivo. */
export function fit(retries = 20){
  if(!doc.open) return;
  if((!stage.clientWidth || !stage.clientHeight) && retries > 0){
    requestAnimationFrame(() => fit(retries - 1));
    return;
  }
  view.zoom = fitScale();
  center();
  view.fitted = true;
  apply();
}

export function center(){
  view.x = (stage.clientWidth  - doc.w * view.zoom) / 2;
  view.y = (stage.clientHeight - doc.h * view.zoom) / 2;
}

/* Zoom manteniendo fijo el punto de pantalla que se indique, que es
   lo que espera cualquiera que use la rueda sobre un detalle. */
export function zoomAt(z, sx, sy){
  if(!doc.open) return;
  z = clamp(z, ZMIN, ZMAX);
  const r = stage.getBoundingClientRect();
  const px = (sx === undefined ? r.width  / 2 : sx - r.left);
  const py = (sy === undefined ? r.height / 2 : sy - r.top);
  const ix = (px - view.x) / view.zoom;
  const iy = (py - view.y) / view.zoom;
  view.zoom = z;
  view.x = px - ix * z;
  view.y = py - iy * z;
  view.fitted = false;
  apply();
}

export const zoomIn  = () => zoomAt(view.zoom * 1.25);
export const zoomOut = () => zoomAt(view.zoom / 1.25);
export const zoom100 = () => { zoomAt(1); };

/* Encaja un rectángulo —en coordenadas de documento, como el que se
   arrastra con la herramienta Lupa— dentro de la ventana, centrado.
   Es a `zoomAt` lo que `fit()` es a mirar el documento entero: mismo
   cálculo, pero con la caja que interesa en vez de con doc.w×doc.h. */
export function zoomToRect(r){
  if(!doc.open || r.w < 1 || r.h < 1) return;
  const pad = 16;
  const w = Math.max(1, stage.clientWidth  - pad);
  const h = Math.max(1, stage.clientHeight - pad);
  const z = clamp(Math.min(w / r.w, h / r.h), ZMIN, ZMAX);
  view.zoom = z;
  view.x = stage.clientWidth  / 2 - (r.x + r.w / 2) * z;
  view.y = stage.clientHeight / 2 - (r.y + r.h / 2) * z;
  view.fitted = false;
  apply();
}

/* Encaja el documento en la franja del escenario que queda por encima
   de `bottom` (coordenada de pantalla), p.ej. el borde superior de una
   hoja de ajustes en el móvil, para ver el resultado mientras se
   mueven sus mandos. Devuelve una función que deja la vista como
   estaba. */
export function fitAbove(bottom){
  if(!doc.open) return () => {};
  const prev = { ...view };
  const r = stage.getBoundingClientRect(), pad = 12;
  const visH = Math.max(40, Math.min(r.height, bottom - r.top));
  const z = clamp(Math.min((r.width - pad * 2) / doc.w, (visH - pad * 2) / doc.h), ZMIN, 1);
  view.zoom = z;
  view.x = (r.width - doc.w * z) / 2;
  view.y = (visH - doc.h * z) / 2;
  view.fitted = false;
  apply();
  return () => { Object.assign(view, prev); apply(); };
}

/* Encaja el documento en un rectángulo de PANTALLA (coordenadas del
   viewport: { top, bottom, left, right }), el hueco que dejan libre las
   barras de un modo a pantalla completa —p. ej. Capas en el móvil—.
   Devuelve la función que restaura la vista anterior. */
export function fitInRect({ top, bottom, left, right }){
  if(!doc.open) return () => {};
  const prev = { ...view };
  const r = stage.getBoundingClientRect(), pad = 10;
  const L = Math.max(r.left, left ?? r.left), R = Math.min(r.right, right ?? r.right);
  const T = Math.max(r.top, top ?? r.top), B = Math.min(r.bottom, bottom ?? r.bottom);
  const w = Math.max(40, R - L), h = Math.max(40, B - T);
  const z = clamp(Math.min((w - pad * 2) / doc.w, (h - pad * 2) / doc.h), ZMIN, 1);
  view.zoom = z;
  view.x = (L - r.left) + (w - doc.w * z) / 2;
  view.y = (T - r.top) + (h - doc.h * z) / 2;
  view.fitted = false;
  apply();
  return () => { Object.assign(view, prev); apply(); };
}

/* Pantalla → coordenadas de imagen */
export function toImage(clientX, clientY){
  const r = stage.getBoundingClientRect();
  return {
    x: (clientX - r.left - view.x) / view.zoom,
    y: (clientY - r.top  - view.y) / view.zoom
  };
}

/* ── interacción ──────────────────────────────────────────────
   El paneo con espacio o botón central siempre está disponible, sea
   cual sea la herramienta activa: es la convención en todos los
   editores y quien la conoce la busca sin pensar. */
let spaceDown = false;
let panning = null;
const pointers = new Map();
let pinch = null;

export function isPanKey(){ return spaceDown; }

addEventListener("keydown", e => {
  if(e.code === "Space" && !e.repeat && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)){
    spaceDown = true;
    stage.classList.add("grabbable");
    e.preventDefault();
  }
});
addEventListener("keyup", e => {
  if(e.code === "Space"){
    spaceDown = false;
    stage.classList.remove("grabbable", "grabbing");
  }
});
addEventListener("blur", () => {
  spaceDown = false;
  stage.classList.remove("grabbable", "grabbing");
});

stage.addEventListener("wheel", e => {
  if(!doc.open) return;
  e.preventDefault();
  // Ctrl+rueda es zoom en todas partes; la rueda sola también aquí,
  // porque en un lienzo es lo que se espera.
  const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAt(view.zoom * f, e.clientX, e.clientY);
}, { passive: false });

/* Devuelve true si la vista se ha quedado con el gesto, para que la
   herramienta activa no lo procese también. */
export function handlePointerDown(e){
  if(!doc.open) return false;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if(pointers.size === 2){
    /* El segundo dedo secuestra el gesto para pellizcar, pero si el
       primero ya había empezado un trazo (pincel, mover, clonar…) ese
       trazo se queda a medias: la capa temporal nunca se cierra y el
       punto sigue pintado en pantalla para siempre. Antes de montar
       el pellizco, se avisa para que quien tenga un trazo abierto lo
       cancele. */
    emit("view:gesturestart");
    const [a, b] = [...pointers.values()];
    pinch = {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      z: view.zoom,
      cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
      px: view.x, py: view.y
    };
    panning = null;
    /* Los dos dedos del pellizco tienen que seguir mandando sus
       eventos a #stage pase lo que pase fuera de su rectángulo
       mientras dura el gesto —si no, en cuanto uno se sale de esos
       límites (fácil al separar los dedos para ampliar, o cerca del
       borde de la pantalla) deja de recibir pointermove y el
       pellizco se atasca o da saltos, que es justo el «funciona de
       manera errática con dos dedos» que se nota al tacto—. El
       primer dedo puede llevar ya su propia captura si empezó
       paneando con la Mano puesta, o ninguna si empezó pintando con
       otra herramienta; de las dos formas, volver a pedirla aquí no
       hace daño. */
    for(const id of pointers.keys()){
      try{ stage.setPointerCapture(id); }catch{}
    }
    return true;
  }

  /* En móvil, una vez ampliada la imagen, un dedo debe desplazarla
     aunque esté activa una herramienta de edición. A escala de ajuste
     se conserva el comportamiento normal de pintar/seleccionar; el
     segundo dedo sigue iniciando el pellizco desde cualquier escala. */
  const touchPan = e.pointerType === "touch" && view.zoom > fitScale() * 1.01;
  const wantPan = spaceDown || e.button === 1 || e.pointerType === "touch" && (window.__panTool || touchPan);
  if(wantPan || window.__panTool){
    emit("view:gesturestart");
    panning = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, id: e.pointerId };
    stage.classList.add("grabbing");
    stage.setPointerCapture(e.pointerId);
    return true;
  }
  return false;
}

/* Desplaza la vista una cantidad de pantalla, para el autodesplazamiento
   cerca del borde mientras se dibuja. */
export function panBy(dx, dy){
  if(!doc.open) return;
  view.x += dx; view.y += dy;
  view.fitted = false;
  apply();
}

/* Cuánto y hacia dónde autodesplazar si (clientX,clientY) está cerca
   del borde de #stage. Devuelve {dx,dy} en píxeles de pantalla, o
   null si no hace falta moverse. Se usa mientras se dibuja cerca del
   límite del lienzo, para no tener que soltar y volver a agarrar. */
const EDGE_MARGIN = 34, EDGE_SPEED = 14;
export function edgeAutoScroll(clientX, clientY){
  const r = stage.getBoundingClientRect();
  let dx = 0, dy = 0;
  const dl = clientX - r.left, dr = r.right - clientX;
  const dt = clientY - r.top,  db = r.bottom - clientY;
  if(dl >= 0 && dl < EDGE_MARGIN) dx =  EDGE_SPEED * (1 - dl / EDGE_MARGIN);
  else if(dr >= 0 && dr < EDGE_MARGIN) dx = -EDGE_SPEED * (1 - dr / EDGE_MARGIN);
  if(dt >= 0 && dt < EDGE_MARGIN) dy =  EDGE_SPEED * (1 - dt / EDGE_MARGIN);
  else if(db >= 0 && db < EDGE_MARGIN) dy = -EDGE_SPEED * (1 - db / EDGE_MARGIN);
  return (dx || dy) ? { dx, dy } : null;
}

/* Safari sigue disparando sus gestos propietarios de pellizco aunque
   `touch-action:none` los bloquee casi siempre; en versiones viejas de
   iOS puede colarse un zoom de página entero por debajo del nuestro.
   Cancelarlos explícitamente es la red de seguridad barata. */
["gesturestart", "gesturechange", "gestureend"].forEach(name =>
  stage.addEventListener(name, e => e.preventDefault()));

/* Zoom y desplazamiento desde una capa que tapa el lienzo, como el fondo
   transparente de un diálogo de ajuste: pellizcar con dos dedos amplía,
   arrastrar con uno (o con el ratón) desplaza, igual que sobre el propio
   lienzo pero sin pasar nada a la herramienta activa. Sólo los gestos
   que empiezan en `el` mismo, nunca en lo que tenga dentro. Devuelve
   una función que dice si el último gesto movió la vista, para que
   quien escuche el «click» del final no lo tome por un toque suelto. */
export function attachViewGestures(el){
  const pts = new Map();
  let g = null, moved = false;
  const begin = () => {
    const p = [...pts.values()];
    if(p.length === 1) g = { x: p[0].x, y: p[0].y, vx: view.x, vy: view.y };
    else if(p.length === 2){
      g = { pinch: true, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), z: view.zoom,
            cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2, px: view.x, py: view.y };
    } else g = null;
  };
  el.addEventListener("pointerdown", e => {
    if(e.target !== el || !doc.open || pts.size >= 2) return;
    if(e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    if(!pts.size) moved = false;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try{ el.setPointerCapture(e.pointerId); }catch{}
    begin();
    if(e.button === 1) e.preventDefault();
  });
  el.addEventListener("pointermove", e => {
    if(!g || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.values()];
    if(g.pinch && p.length === 2){
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
      const z = clamp(g.z * (d / Math.max(g.d, 1)), ZMIN, ZMAX);
      const r = stage.getBoundingClientRect();
      const ix = (g.cx - r.left - g.px) / g.z, iy = (g.cy - r.top - g.py) / g.z;
      view.zoom = z;
      view.x = (cx - r.left) - ix * z;
      view.y = (cy - r.top)  - iy * z;
      moved = true;
    } else if(!g.pinch){
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if(!moved && Math.hypot(dx, dy) < 4) return;
      view.x = g.vx + dx; view.y = g.vy + dy;
      moved = true;
    } else return;
    view.fitted = false;
    apply();
  });
  const end = e => {
    if(!pts.delete(e.pointerId)) return;
    begin();   // al levantar un dedo del pellizco se sigue desplazando con el otro, sin salto
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e => {
    if(e.target !== el || !doc.open) return;
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(view.zoom * f, e.clientX, e.clientY);
  }, { passive: false });
  return () => moved;
}

export function handlePointerMove(e){
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if(pinch && pointers.size === 2){
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const z = clamp(pinch.z * (d / Math.max(pinch.d, 1)), ZMIN, ZMAX);
    // Pellizcar hace zoom y arrastrar los dos dedos desplaza a la vez
    const r = stage.getBoundingClientRect();
    const ix = (pinch.cx - r.left - pinch.px) / pinch.z;
    const iy = (pinch.cy - r.top  - pinch.py) / pinch.z;
    view.zoom = z;
    view.x = (cx - r.left) - ix * z;
    view.y = (cy - r.top)  - iy * z;
    view.fitted = false;
    apply();
    return true;
  }

  if(panning){
    view.x = panning.vx + (e.clientX - panning.x);
    view.y = panning.vy + (e.clientY - panning.y);
    view.fitted = false;
    apply();
    return true;
  }
  return false;
}

export function handlePointerUp(e){
  pointers.delete(e.pointerId);
  if(pointers.size < 2) pinch = null;
  if(panning && (panning.id === e.pointerId || e.pointerId === undefined)){
    panning = null;
    stage.classList.remove("grabbing");
    return true;
  }
  return false;
}

/* Doble toque: alterna entre ajustar y 100 %.

   Sólo con el dedo y sólo con la mano activa. Antes saltaba con
   cualquier puntero y con cualquier herramienta, y como se comprueba
   ANTES de pasarle el gesto a la herramienta, dos clics seguidos
   haciendo manchas o ajustando una esquina de perspectiva hacían zoom
   en vez de lo que se pretendía. Con el ratón ya no hace falta: el
   doble clic en los botones de la mano y la lupa de la barra de
   herramientas hace lo mismo, que además es donde lo busca quien
   viene de Photoshop. */
let lastTap = 0;
export function handleDoubleTap(e){
  if(e.pointerType !== "touch" || !window.__panTool) return false;
  /* El segundo dedo de un pellizco NO es un doble toque: los dos dedos
     se apoyan casi a la vez (menos de 300 ms), y antes eso saltaba a
     100 % y el pellizco ni empezaba (con Capas abiertas en el móvil,
     donde tocar la imagen siempre es «mano», pellizcar no funcionaba). */
  if(pointers.size > 0){ lastTap = 0; return false; }
  const t = performance.now();
  const isDouble = t - lastTap < 300;
  lastTap = t;
  if(!isDouble) return false;
  lastTap = 0;
  haptic(10);
  if(Math.abs(view.zoom - 1) < 0.01){ if(!window.__fitView?.()) fit(); }
  else zoomAt(1, e.clientX, e.clientY);
  return true;
}

/* Reajusta al cambiar el tamaño de la ventana o al rotar el móvil */
let resizeTimer = null;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if(!doc.open) return;
    if(view.fitted){ fit(); return; }

    /* Con zoom manual (`fitted` es falso en cuanto se toca la rueda o
       se pasea la vista), `apply()` a secas se limita a recortar con
       el tamaño nuevo: deja la vista donde estaba en coordenadas de
       PANTALLA, así que al estrechar la ventana —abrir las
       herramientas de desarrollo, acoplar otra ventana al lado,
       restaurar desde maximizado— el lienzo se queda fuera por la
       derecha. Y como el recorte sólo exige que asome un 12 %, cada
       cambio de tamaño lo empuja un poco más hasta dejarlo reducido a
       un cuadradito en la esquina, sin manera evidente de recuperarlo.
       Lo que hay que conservar no es la posición en pantalla, sino el
       punto de la IMAGEN que estaba en el centro. */
    recenterAfterResize(lastW, lastH);
    apply();
  }, 80);
});

/* Aparte del oyente para poder comprobar la aritmética con números
   sueltos, sin depender de que el navegador dispare un «resize». */
export function recenterAfterResize(prevW, prevH){
  if(!doc.open || !(prevW > 0) || !(prevH > 0)) return;
  const cx = (prevW / 2 - view.x) / view.zoom;
  const cy = (prevH / 2 - view.y) / view.zoom;
  view.x = stage.clientWidth  / 2 - cx * view.zoom;
  view.y = stage.clientHeight / 2 - cy * view.zoom;
}

on("doc:new", () => fit());
on("doc:resize", () => { if(view.fitted) fit(); else apply(); });
/* Al cerrar el documento hay que volver a esconder el tablero: si no,
   se queda el damero del lienzo anterior flotando sobre el fondo. */
on("doc:structure", () => { if(!doc.open) apply(); });
