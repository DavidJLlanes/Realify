/* ═══════════════════════════════════════════════════════════════
   transformtool · piezas que usan varios bloques
   Parte de js/editor/tools/transformtool.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { makeWarpGrid } from "../perspective.js";

export const xform = {
  mode: "free",          // "free" | "warp"
  proportional: false,
  box: null,              // {x,y,w,h} rectángulo original, fijo durante toda la sesión
  // parámetros de la transformación afín (modo libre)
  sx: 1, sy: 1,
  angle: 0,               // radianes
  skewX: 0, skewY: 0,     // radianes
  tx: 0, ty: 0,           // desplazamiento del CENTRO de giro respecto al centro de `box`
  flipH: false, flipV: false,
  pivot: null,            // [x,y] en coordenadas de imagen; null = centro de `box`
  // deformar
  meshCols: 3, meshRows: 3,
  grid: null,             // puntos de control actuales (modo warp)
  quad: null,             // esquinas actuales, recalculadas — lo que de verdad se pinta
  _drag: null             // gesto en curso; ver xformDown()
};

/* ── geometría ────────────────────────────────────────────────── */
export function pivotPoint(){
  if(xform.pivot) return xform.pivot;
  const { x, y, w, h } = xform.box;
  return [x + w/2, y + h/2];
}

/* El cuadrilátero de destino a partir de los cinco parámetros afines:
   centrar en el pivote, sesgar, rotar, escalar (con el signo del
   volteo), y devolver al sitio con la traslación. El orden importa —
   es el mismo que aplicaría `ctx.transform` leído de derecha a
   izquierda— y es el que hace que «Escala» siga refiriéndose a los
   ejes de LA CAJA, no a los de la pantalla, una vez que ya está
   rotada. */
export function affineQuad(){
  const { x, y, w, h } = xform.box;
  const [px, py] = pivotPoint();
  const cs = Math.cos(xform.angle), sn = Math.sin(xform.angle);
  const sx = xform.sx * (xform.flipH ? -1 : 1);
  const sy = xform.sy * (xform.flipV ? -1 : 1);
  const corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  return corners.map(([cx0, cy0]) => {
    // Respecto al pivote, en los ejes ORIGINALES de la caja
    let dx = cx0 - px, dy = cy0 - py;
    // Sesgo (shear) sobre esos ejes
    dx = dx + dy * Math.tan(xform.skewX);
    dy = dy + dx * Math.tan(xform.skewY);
    // Escala
    dx *= sx; dy *= sy;
    // Rotación
    const rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
    return [px + rx + xform.tx, py + ry + xform.ty];
  });
}

export function xformRecompute(){
  if(!xform.box) return;
  if(xform.mode === "warp"){
    if(!xform.grid) xform.grid = makeWarpGrid(xform.box.x, xform.box.y, xform.box.w, xform.box.h, xform.meshCols, xform.meshRows);
    return;
  }
  xform.quad = affineQuad();
}
