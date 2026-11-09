/* ═══════════════════════════════════════════════════════════════
   ALGORITMOS DE PINTURA
   Lo que hacen de verdad las herramientas: rellenar, degradar,
   clonar, aclarar y arrastrar píxeles. Separado de tools.js para que
   ese archivo siga siendo la declaración de la interfaz y no una
   mezcla de interfaz y matemáticas.
   ═══════════════════════════════════════════════════════════════ */

export { dodgeBurn, sponge, makeSmudge } from "./retoque.js";
export { healSpot, cloneStamp } from "./reparar.js";

export function hexToRgb(hex){
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ── relleno por región ───────────────────────────────────────
   Recorrido por líneas de barrido: se avanza a lo ancho todo lo que
   se pueda antes de mirar arriba y abajo. Frente al de cuatro
   vecinos píxel a píxel, hace muchísimas menos operaciones de pila y
   no la desborda en zonas grandes, que es lo que pasa con la versión
   recursiva en cuanto la imagen es de varios megapíxeles. */
export function floodFill(imgData, x0, y0, color, tolerance, contiguous){
  const { data, width: w, height: h } = imgData;
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  if(x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return false;

  const at = (x, y) => (y * w + x) * 4;
  const start = at(x0, y0);
  const sr = data[start], sg = data[start+1], sb = data[start+2], sa = data[start+3];
  const [fr, fg, fb] = color;
  const tol = tolerance * tolerance * 4;      // se compara en distancia al cuadrado

  const match = i => {
    const dr = data[i] - sr, dg = data[i+1] - sg;
    const db = data[i+2] - sb, da = data[i+3] - sa;
    return dr*dr + dg*dg + db*db + da*da <= tol;
  };

  if(sr === fr && sg === fg && sb === fb && sa === 255 && tolerance === 0) return false;

  if(!contiguous){
    // Global: se pinta todo píxel parecido, esté donde esté
    let n = 0;
    for(let i = 0; i < data.length; i += 4){
      if(match(i)){ data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = 255; n++; }
    }
    return n > 0;
  }

  const seen = new Uint8Array(w * h);
  const stack = [[x0, y0]];
  let painted = 0;

  while(stack.length){
    const [sx, sy] = stack.pop();
    let x = sx;
    while(x > 0 && !seen[sy*w + x - 1] && match(at(x - 1, sy))) x--;
    let up = false, down = false;
    for(; x < w; x++){
      const p = sy*w + x;
      if(seen[p] || !match(at(x, sy))) break;
      seen[p] = 1;
      const i = at(x, sy);
      data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = 255;
      painted++;
      if(sy > 0){
        const ok = !seen[p - w] && match(at(x, sy - 1));
        if(ok && !up){ stack.push([x, sy - 1]); up = true; }
        else if(!ok) up = false;
      }
      if(sy < h - 1){
        const ok = !seen[p + w] && match(at(x, sy + 1));
        if(ok && !down){ stack.push([x, sy + 1]); down = true; }
        else if(!ok) down = false;
      }
    }
  }
  return painted > 0;
}

/* ── degradado ────────────────────────────────────────────────
   El degradado nativo del lienzo interpola en sRGB, que es lo que
   espera todo el mundo porque es lo que hace cualquier editor. */
export function drawGradient(ctx, kind, from, to, colorA, colorB, opacity){
  const g = kind === "radial"
    ? ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y,
        Math.max(1, Math.hypot(to.x - from.x, to.y - from.y)))
    : ctx.createLinearGradient(from.x, from.y, to.x, to.y);

  if(kind === "transparent"){
    const g2 = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    g2.addColorStop(0, colorA);
    g2.addColorStop(1, colorA + "00");
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    return;
  }

  g.addColorStop(0, colorA);
  g.addColorStop(1, colorB);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/* ── formas ───────────────────────────────────────────────────── */
export function drawShape(ctx, kind, a, b, opts){
  const { fill, stroke, lineWidth, fillOn, strokeOn, opacity, shift, sides=5, inner=50 } = opts;
  let x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  let w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
  // Con Mayús, cuadrado o círculo perfecto
  if(shift && kind !== "line"){
    const s = Math.max(w, h);
    if(b.x < a.x) x = a.x - s;
    if(b.y < a.y) y = a.y - s;
    w = h = s;
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.beginPath();

  if(kind === "rect"){
    ctx.rect(x, y, w, h);
  } else if(kind === "ellipse"){
    ctx.ellipse(x + w/2, y + h/2, Math.max(0.5, w/2), Math.max(0.5, h/2), 0, 0, 6.2832);
  } else if(kind === "line"){
    let bx = b.x, by = b.y;
    if(shift){
      // Ángulos de 45°, que es para lo que se pulsa Mayús
      const dx = b.x - a.x, dy = b.y - a.y;
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI/4)) * (Math.PI/4);
      const len = Math.hypot(dx, dy);
      bx = a.x + Math.cos(ang)*len; by = a.y + Math.sin(ang)*len;
    }
    ctx.moveTo(a.x, a.y); ctx.lineTo(bx, by);
  } else if(kind === "polygon" || kind === "star"){
    const n=Math.max(3,Math.round(sides)),count=kind==="star"?n*2:n,cx=x+w/2,cy=y+h/2,rx=w/2,ry=h/2;
    for(let i=0;i<count;i++){const ang=-Math.PI/2+i*Math.PI*2/count,m=kind==="star"&&i%2?Math.max(.05,Math.min(.95,inner/100)):1,px=cx+Math.cos(ang)*rx*m,py=cy+Math.sin(ang)*ry*m;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();
  }

  if(fillOn && kind !== "line") ctx.fill();
  if(strokeOn || kind === "line") ctx.stroke();
  ctx.restore();
}
