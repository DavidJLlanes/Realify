/* ═══════════════════════════════════════════════════════════════
   LICUAR
   Una rejilla de puntos de control cubre la imagen. Empujar, fruncir,
   hinchar o remolinear no toca ni un píxel directamente: mueve los
   puntos de la rejilla cerca del pincel, y la imagen se vuelve a
   dibujar entera cada vez a partir del ORIGINAL —el de antes de tocar
   nada—, deformada según dónde ha ido a parar cada punto. Redibujar
   siempre desde el original (nunca sobre el resultado del trazo
   anterior) es lo que evita que la imagen se emborrone con cada
   pincelada: cada nueva deformación es una interpolación limpia del
   original, no una interpolación de una interpolación.

   El estirado de cada celda de la rejilla usa el mismo truco que la
   corrección de perspectiva (perspective.js): dos triángulos afines
   por celda, con `ctx.transform` + `drawImage` recortado. Ahí ya
   estaba resuelto —y probado— el problema de estirar un trozo
   rectangular de imagen a un cuadrilátero cualquiera; una rejilla no
   es más que muchos cuadriláteros pequeños seguidos.
   ═══════════════════════════════════════════════════════════════ */

import { solveAffine3 } from "./perspective.js";

/* Rejilla de (cols+1)×(rows+1) puntos cubriendo [0,w]×[0,h]. `rest` es
   la posición original de cada punto (no cambia nunca); `cur` es su
   posición actual, la que se va desplazando al licuar. Guardadas como
   arrays planos [x0,y0,x1,y1,...] en vez de arrays de pares: la mitad
   de asignaciones al reiniciar y menos basura para el recolector en
   cada fotograma de arrastre. */
export function makeGrid(cols, rows, w, h){
  const n = (cols + 1) * (rows + 1);
  const rest = new Float64Array(n * 2);
  for(let j = 0; j <= rows; j++){
    for(let i = 0; i <= cols; i++){
      const k = (j * (cols + 1) + i) * 2;
      rest[k] = i / cols * w;
      rest[k + 1] = j / rows * h;
    }
  }
  return { cols, rows, w, h, rest, cur: Float64Array.from(rest) };
}

export function resetGrid(grid){ grid.cur.set(grid.rest); }

export function isIdentityGrid(grid){
  for(let i = 0; i < grid.cur.length; i++)
    if(Math.abs(grid.cur[i] - grid.rest[i]) > 1e-6) return false;
  return true;
}

/* Caída suave del efecto desde el centro del pincel hasta su borde:
   1 en el centro, 0 en el borde, con derivada nula en los dos
   extremos —así el límite del pincel no deja un pliegue visible en la
   rejilla, que es lo que pasaría con una caída lineal o un corte
   seco—. */
function falloff(distRatio){
  if(distRatio >= 1) return 0;
  const c = Math.cos(distRatio * Math.PI / 2);
  return c * c;
}

/* Una sola «pincelada puntual»: desplaza los puntos de la rejilla que
   caen dentro del radio alrededor de (cx,cy), cada uno según su propia
   caída. `amount` ya lleva dentro fuerza × sentido; su significado
   exacto depende del modo:
     - push:   (amount.x, amount.y) es cuánto se arrastra el punto.
     - pinch:  amount es un escalar 0..1, fracción del camino hacia el centro.
     - bloat:  igual que pinch pero alejándose.
     - twirl:  amount es el ángulo en radianes que gira alrededor del centro. */
export function applyDab(grid, mode, cx, cy, radius, amount){
  if(radius <= 0) return;
  const { cols, rows, cur } = grid;
  const cellW = grid.w / cols, cellH = grid.h / rows;
  const i0 = Math.max(0, Math.floor((cx - radius) / cellW) - 1);
  const i1 = Math.min(cols, Math.ceil((cx + radius) / cellW) + 1);
  const j0 = Math.max(0, Math.floor((cy - radius) / cellH) - 1);
  const j1 = Math.min(rows, Math.ceil((cy + radius) / cellH) + 1);

  for(let j = j0; j <= j1; j++){
    for(let i = i0; i <= i1; i++){
      const k = (j * (cols + 1) + i) * 2;
      const px = cur[k], py = cur[k + 1];
      const dx = px - cx, dy = py - cy;
      const dist = Math.hypot(dx, dy);
      if(dist >= radius) continue;
      const w = falloff(dist / radius);
      if(w <= 0) continue;

      if(mode === "push"){
        cur[k]     += amount.x * w;
        cur[k + 1] += amount.y * w;
      } else if(mode === "pinch"){
        cur[k]     = px - dx * amount * w;
        cur[k + 1] = py - dy * amount * w;
      } else if(mode === "bloat"){
        cur[k]     = px + dx * amount * w;
        cur[k + 1] = py + dy * amount * w;
      } else if(mode === "twirl"){
        const a = amount * w;
        const s = Math.sin(a), c = Math.cos(a);
        cur[k]     = cx + dx * c - dy * s;
        cur[k + 1] = cy + dx * s + dy * c;
      }
    }
  }
}

/* Suaviza el campo de desplazamiento —la diferencia entre `cur` y
   `rest`— hacia la media de los cuatro vecinos de cada punto interior,
   una única pasada. No es una simulación de fluidos de verdad: no hay
   presión ni velocidad, sólo esta relajación del campo. Pero aproxima
   su efecto más visible, que es lo que se echaba en falta con el
   empuje puro —estirar una zona tira un poco de la de al lado en vez
   de dejarla intacta, así que lo que se hincha en un sitio adelgaza
   algo alrededor en lugar de aparecer de la nada sólo dentro del
   círculo del pincel—. El marco exterior de la rejilla se deja fuera a
   propósito, para que el borde del lienzo no empiece a moverse solo. */
export function relaxGrid(grid, amount){
  if(amount <= 0) return;
  const { cols, rows, rest, cur } = grid;
  const disp = new Float64Array(cur.length);
  for(let i = 0; i < cur.length; i++) disp[i] = cur[i] - rest[i];

  const at = (i, j) => (j * (cols + 1) + i) * 2;
  for(let j = 1; j < rows; j++){
    for(let i = 1; i < cols; i++){
      const k = at(i, j);
      const nl = at(i-1,j), nr = at(i+1,j), nu = at(i,j-1), nd = at(i,j+1);
      const avgX = (disp[nl]   + disp[nr]   + disp[nu]   + disp[nd])   / 4;
      const avgY = (disp[nl+1] + disp[nr+1] + disp[nu+1] + disp[nd+1]) / 4;
      cur[k]     = rest[k]     + disp[k]     * (1 - amount) + avgX * amount;
      cur[k + 1] = rest[k + 1] + disp[k + 1] * (1 - amount) + avgY * amount;
    }
  }
}

/* Varias pinceladas repartidas a lo largo de un segmento, para que un
   arrastre rápido del ratón no deje huecos sin deformar entre un
   punto y el siguiente —el mismo problema, y la misma solución, que
   ya tienen el pincel y el corrector de manchas—. */
export function applyStroke(grid, mode, from, to, radius, amountAt){
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const step = Math.max(1, radius * 0.25);
  const n = Math.max(1, Math.ceil(dist / step));
  /* `amountAt` recibe también `n`: para el modo empujar, la cantidad
     que hay que aplicar en CADA pincelada es una FRACCIÓN del
     desplazamiento total, no el total entero repetido en cada una.
     Repartir en varias pinceladas es imprescindible para no dejar
     huecos en un arrastre rápido, pero si cada una arrastrase el
     desplazamiento completo, un solo trazo empujaría el contenido
     varias veces su propia distancia y lo sacaría del lienzo por
     completo —justo lo que pasaba antes de repartir por `n`—. Los
     demás modos (fruncir, hinchar, remolino) no tienen este problema:
     su cantidad ya es una fracción pequeña pensada para acumularse
     pincelada a pincelada, así que a ellos `n` no les afecta. */
  for(let s = 0; s <= n; s++){
    const t = n === 0 ? 0 : s / n;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    applyDab(grid, mode, x, y, radius, amountAt(from, to, t, n));
  }
}

/* ── estirado de la rejilla sobre un lienzo ─────────────────────
   Mismo principio que `warpQuadToCanvas` en perspective.js pero
   celda a celda en vez de un único cuadrilátero: cada celda de la
   rejilla se dibuja como dos triángulos afines, del sitio ORIGINAL al
   sitio ACTUAL de sus tres vértices. */
function overscan(tri, px){
  const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
  const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  return tri.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    return [x + dx / len * px, y + dy / len * px];
  });
}

function drawTriAffine(ctx, image, srcTri, dstTri){
  const m = solveAffine3(srcTri, dstTri);
  if(!m) return;
  const clipTri = overscan(dstTri, 0.75);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clipTri[0][0], clipTri[0][1]);
  ctx.lineTo(clipTri[1][0], clipTri[1][1]);
  ctx.lineTo(clipTri[2][0], clipTri[2][1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(...m);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/* `scale` reescala TANTO el origen como el destino de cada triángulo
   por el mismo factor: sirve para redibujar sobre un canvas de
   trabajo reducido (`outW,outH` más pequeños) usando una versión de
   `sourceImage` reducida en la misma proporción, sin tener que tocar
   la rejilla en sí —que sigue viviendo en coordenadas de documento
   completo, para que el redibujado final a resolución completa (al
   soltar el trazo) no tenga que reinterpolar nada—. */
export function renderLiquify(ctx, sourceImage, grid, outW, outH, scale = 1){
  ctx.clearRect(0, 0, outW, outH);
  const { cols, rows, rest, cur } = grid;
  const at = (arr, i, j) => {
    const k = (j * (cols + 1) + i) * 2;
    return [arr[k] * scale, arr[k + 1] * scale];
  };
  for(let j = 0; j < rows; j++){
    for(let i = 0; i < cols; i++){
      const s00 = at(rest,i,j),   s10 = at(rest,i+1,j);
      const s01 = at(rest,i,j+1), s11 = at(rest,i+1,j+1);
      const d00 = at(cur,i,j),    d10 = at(cur,i+1,j);
      const d01 = at(cur,i,j+1),  d11 = at(cur,i+1,j+1);
      drawTriAffine(ctx, sourceImage, [s00,s10,s11], [d00,d10,d11]);
      drawTriAffine(ctx, sourceImage, [s00,s11,s01], [d00,d11,d01]);
    }
  }
}
