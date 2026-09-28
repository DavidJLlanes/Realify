/* ═══════════════════════════════════════════════════════════════
   TIRADORES FÁCILES DE AGARRAR
   Un solo sitio decide cuánto «perdona» un tirador según con qué se
   está tocando la pantalla: con el ratón bastan unos pocos píxeles,
   con el dedo hace falta un círculo del tamaño de la yema (~48 px de
   diámetro, lo que piden las guías de accesibilidad táctil), y el
   lápiz queda en medio. Lo usan Recortar, Transformar, Perspectiva,
   las formas, el marco del texto, la pluma y los plugins de pantalla
   completa.

   Tres reglas más, que son las que de verdad quitan la sensación de
   «hay que acertar el píxel»:
   · Cuando dos tiradores caen dentro del radio (un marco pequeño en
     pantalla), gana el MÁS CERCANO, no el primero de la lista.
   · Un borde se agarra desde fuera con todo el radio, pero hacia
     dentro sólo hasta un cuarto del marco: así un recorte pequeño
     sigue pudiéndose mover arrastrando desde su interior.
   · Al agarrar un tirador lejos de su centro, no salta bajo el dedo:
     se mueve con el mismo desfase con el que se cogió (ver `offset`).
   ═══════════════════════════════════════════════════════════════ */

let pointer = (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) ? "touch" : "mouse";

// Se escucha en fase de captura para saber con qué se ha tocado ANTES
// de que ninguna herramienta decida qué tirador hay debajo.
if(typeof addEventListener === "function"){
  const note = e => { if(e.pointerType) pointer = e.pointerType; };
  addEventListener("pointerdown", note, { capture: true, passive: true });
  addEventListener("pointermove", note, { capture: true, passive: true });
}

export const pointerKind = () => pointer;
export const isTouch = () => pointer === "touch";

/** Radio de agarre en píxeles de PANTALLA para un tirador cuyo radio
    de ratón es `mouse`. */
export function grabPx(mouse = 10){
  if(pointer === "touch") return Math.max(26, mouse + 16);
  if(pointer === "pen") return Math.max(15, mouse + 5);
  return Math.max(10, mouse);
}

/** Lo mismo en unidades del documento, dado el zoom (px de pantalla por px de imagen). */
export const grabDoc = (zoom, mouse) => grabPx(mouse) / Math.max(zoom, 1e-6);

/** Tamaño con el que se DIBUJA un tirador: algo mayor con el dedo para
    que se vea dónde está sin taparlo del todo. */
export function drawPx(mouse){
  if(pointer === "touch") return mouse * 1.6;
  if(pointer === "pen") return mouse * 1.25;
  return mouse;
}

/** Índice del punto más cercano a `p` dentro de `tol`, o -1.
    `pts` admite [x,y] o {x,y}. */
export function nearest(p, pts, tol){
  let best = -1, bd = tol;
  for(let i = 0; i < pts.length; i++){
    const q = pts[i];
    if(!q) continue;
    const x = Array.isArray(q) ? q[0] : q.x, y = Array.isArray(q) ? q[1] : q.y;
    const d = Math.hypot(p.x - x, p.y - y);
    if(d < bd){ bd = d; best = i; }
  }
  return best;
}

/** Tirador de un rectángulo alineado {x,y,w,h}: "nw","n","ne","e","se",
    "s","sw","w" o null. Los bordes se agarran en toda su longitud. */
export function rectHandleAt(p, r, tol){
  if(!r) return null;
  const inX = Math.min(tol, Math.abs(r.w) / 4), inY = Math.min(tol, Math.abs(r.h) / 4);
  const dl = p.x - r.x, dr = r.x + r.w - p.x, dt = p.y - r.y, db = r.y + r.h - p.y;
  const near = (d, tin) => d > -tol && d < tin;
  const L = near(dl, inX), R = near(dr, inX), T = near(dt, inY), B = near(db, inY);
  const h = L && R ? (Math.abs(dl) <= Math.abs(dr) ? "w" : "e") : L ? "w" : R ? "e" : "";
  const v = T && B ? (Math.abs(dt) <= Math.abs(db) ? "n" : "s") : T ? "n" : B ? "s" : "";
  if(h && v) return v + h;
  if(h && dt > -tol && db > -tol) return h;
  if(v && dl > -tol && dr > -tol) return v;
  return null;
}

/** Desfase entre el puntero y el punto exacto del tirador de un
    rectángulo, para que al arrastrar el borde no salte bajo el dedo. */
export function rectHandleOffset(mode, r, p){
  let x = 0, y = 0;
  if(mode.includes("w")) x = r.x - p.x;
  else if(mode.includes("e")) x = r.x + r.w - p.x;
  if(mode.includes("n")) y = r.y - p.y;
  else if(mode.includes("s")) y = r.y + r.h - p.y;
  return { x, y };
}

/** `p` corregido con un desfase {x,y} (o sin tocar si no lo hay). */
export const offset = (p, off) => off ? { ...p, x: p.x + off.x, y: p.y + off.y } : p;
