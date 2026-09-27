/* ═══════════════════════════════════════════════════════════════
   ALGORITMOS DE PINTURA
   Lo que hacen de verdad las herramientas: rellenar, degradar,
   clonar, aclarar y arrastrar píxeles. Separado de tools.js para que
   ese archivo siga siendo la declaración de la interfaz y no una
   mezcla de interfaz y matemáticas.
   ═══════════════════════════════════════════════════════════════ */

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

/* ── sobreexponer y subexponer ────────────────────────────────
   Aclara u oscurece respetando el tono, y con distinta fuerza según
   la zona: la de sombras apenas toca las luces y al revés. Es cómo
   funcionaban las manos y los cartones bajo la ampliadora. */
export function dodgeBurn(ctx, x, y, radius, hardness, amount, mode, range){
  const r = Math.ceil(radius);
  const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
  const x1 = Math.min(ctx.canvas.width,  Math.ceil(x + r));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(y + r));
  const w = x1 - x0, h = y1 - y0;
  if(w <= 0 || h <= 0) return;

  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const inner = Math.max(0, Math.min(0.98, hardness / 100));
  const sign = mode === "dodge" ? 1 : -1;

  for(let py = 0; py < h; py++){
    for(let px = 0; px < w; px++){
      const dx = (x0 + px) - x, dy = (y0 + py) - y;
      const dist = Math.hypot(dx, dy) / radius;
      if(dist > 1) continue;
      // Caída del pincel
      let fall = dist <= inner ? 1 : 1 - (dist - inner) / (1 - inner);
      const i = (py * w + px) * 4;
      const lum = (d[i]*0.2126 + d[i+1]*0.7152 + d[i+2]*0.0722) / 255;
      // Peso por zona tonal
      const zw = range === "shadows"    ? Math.pow(1 - lum, 2)
               : range === "highlights" ? Math.pow(lum, 2)
               :                          1 - Math.abs(lum - 0.5) * 1.4;
      const k = sign * (amount / 100) * fall * Math.max(0, zw) * 0.5;
      if(k === 0 && mode !== "spongeSat" && mode !== "spongeDesat") continue;
      if(mode === "spongeSat" || mode === "spongeDesat"){
        const gray=(d[i]+d[i+1]+d[i+2])/3;
        const satK=(amount/100)*fall*.55*(mode === "spongeSat" ? 1 : -1);
        for(let c=0;c<3;c++) d[i+c]=Math.max(0,Math.min(255,gray+(d[i+c]-gray)*(1+satK)));
        continue;
      }
      for(let c = 0; c < 3; c++){
        const v = d[i+c] / 255;
        // Aclarar tira hacia el blanco y oscurecer hacia el negro, en
        // vez de sumar: sumar quema las luces y empasta las sombras.
        const nv = k > 0 ? v + (1 - v) * k : v * (1 + k);
        d[i+c] = Math.max(0, Math.min(255, nv * 255));
      }
    }
  }
  ctx.putImageData(img, x0, y0);
}

/* ── emborronar ───────────────────────────────────────────────
   Arrastra el color como un dedo sobre pintura fresca: se guarda lo
   que había bajo el pincel y se va mezclando con lo que hay delante
   según avanza. */
export function makeSmudge(ctx, radius, hardness, strength){
  const r = Math.ceil(radius);
  const size = r * 2;
  let carried = null;

  return {
    step(x, y){
      const x0 = Math.round(x - r), y0 = Math.round(y - r);
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      const sx = Math.max(0, x0), sy = Math.max(0, y0);
      const ex = Math.min(cw, x0 + size), ey = Math.min(ch, y0 + size);
      const w = ex - sx, h = ey - sy;
      if(w <= 0 || h <= 0) return;

      const img = ctx.getImageData(sx, sy, w, h);
      const d = img.data;

      if(!carried){
        carried = new Float32Array(d.length);
        for(let i = 0; i < d.length; i++) carried[i] = d[i];
        carried.w = w; carried.h = h;
        return;
      }

      const inner = Math.max(0, Math.min(0.98, hardness / 100));
      const s = strength / 100;
      const cx = x - sx, cy = y - sy;

      for(let py = 0; py < h; py++){
        for(let px = 0; px < w; px++){
          const dist = Math.hypot(px - cx, py - cy) / radius;
          if(dist > 1) continue;
          const fall = dist <= inner ? 1 : 1 - (dist - inner) / (1 - inner);
          const k = fall * s;
          const i = (py * w + px) * 4;
          const j = (py * (carried.w || w) + px) * 4;
          if(j + 3 >= carried.length) continue;
          for(let c = 0; c < 4; c++){
            const mixed = d[i+c] * (1 - k) + carried[j+c] * k;
            d[i+c] = mixed;
            // Lo que se lleva el dedo también se va contaminando
            carried[j+c] = carried[j+c] * (1 - k * 0.5) + mixed * (k * 0.5);
          }
        }
      }
      ctx.putImageData(img, sx, sy);
    },
    reset(){ carried = null; }
  };
}

/* ── eliminar manchas ───────────────────────────
   Clonado sin costura, que es lo que hace un pincel corrector de
   verdad y no lo que hacía la versión anterior de esto.

   La versión anterior rellenaba el círculo con la extensión armónica
   de su contorno: matemáticamente impecable, pero el resultado es por
   construcción una función suave, o sea una mancha lisa. Sobre una
   piel con poro, una pared con gotelé o cualquier grano visible, ese
   parche liso canta más que el defecto que venía a tapar: es
   literalmente «pintar encima».

   Lo correcto es el clonado sin costura de Pérez y otros (2003). En
   vez de inventarse el contenido, se copia un trozo de otro sitio de
   la propia foto —que trae su textura, su grano y su ruido— y se le
   suma un campo armónico que corrige sólo la diferencia de color
   entre el borde del parche y el borde del agujero. Como ese campo es
   suave, no toca el detalle fino: la textura sobrevive entera y la
   costura desaparece, porque en el borde la corrección vale
   exactamente la diferencia que había.

   El origen se elige solo: se prueban parches a varias distancias y
   ángulos y gana el que tiene el contorno más parecido al del
   agujero. Si ninguno se parece lo suficiente —una mancha en mitad de
   algo muy estructurado, sin nada comparable cerca— se vuelve al
   relleno armónico de antes, que será liso pero nunca importa un ojo
   de otro sitio de la cara. */

const HEAL_K = 32;          // muestras angulares del contorno
const HEAL_ANGLES = 16;     // ángulos de búsqueda del parche de origen
const HEAL_DISTS = [1.7, 2.4, 3.1];   // distancias, en radios
const HEAL_MAX_MISMATCH = 60;         // por encima, ningún parche vale

/* Núcleo de Poisson del disco de radio R evaluado a distancia `dist`
   del centro y ángulo `ang`, contra una muestra del contorno en `th`.
   En el centro vale 1 para cualquier th —la media uniforme— y cerca
   del borde se concentra en el punto del contorno más próximo. */
function poissonWeight(R2, R, dist, dist2, ang, th){
  return (R2 - dist2) / Math.max(1e-6, R2 - 2 * R * dist * Math.cos(ang - th) + dist2);
}

/* `sampleCtx`, si se da, es de dónde se LEE todo —el contorno con el
   que comparar, la búsqueda del parche de origen, la textura que se
   copia—: la composición de todas las capas, para «Muestra: todas las
   capas» (ver tools.js). Sin él, se lee de la propia `ctx`, el
   comportamiento de siempre. Lo que se ESCRIBE es, en los dos casos,
   sólo el círculo del pincel sobre `ctx` —la capa activa—; el resto
   del recorte de trabajo se copia tal cual estaba en `ctx`, nunca se
   sustituye por lo que hubiera en `sampleCtx` fuera de ese círculo. */
export function healSpot(ctx, x, y, radius, sampleCtx = null){
  const R = radius + 3;                       // contorno: justo fuera de la mancha
  const far = HEAL_DISTS[HEAL_DISTS.length - 1];
  const pad = Math.ceil(R * (far + 1)) + 2;   // sitio para el agujero y los candidatos

  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor(x - pad)), y0 = Math.max(0, Math.floor(y - pad));
  const x1 = Math.min(cw, Math.ceil(x + pad)), y1 = Math.min(ch, Math.ceil(y + pad));
  const w = x1 - x0, h = y1 - y0;
  if(w <= 0 || h <= 0) return;

  const img = ctx.getImageData(x0, y0, w, h);
  const d = sampleCtx ? sampleCtx.getImageData(x0, y0, w, h).data : img.data;
  const cx = x - x0, cy = y - y0;

  // Muestrea el contorno de un disco centrado en (ox,oy). Devuelve null
  // si alguna muestra se sale de la región: un parche a medias no sirve.
  const sampleRing = (ox, oy) => {
    const out = new Float64Array(HEAL_K * 3);
    for(let k = 0; k < HEAL_K; k++){
      const th = 2 * Math.PI * k / HEAL_K;
      const sx = Math.round(ox + Math.cos(th) * R);
      const sy = Math.round(oy + Math.sin(th) * R);
      if(sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
      const i = (sy * w + sx) * 4;
      out[k*3] = d[i]; out[k*3+1] = d[i+1]; out[k*3+2] = d[i+2];
    }
    return out;
  };

  const dstRing = sampleRing(cx, cy);
  if(!dstRing) return;

  // ── buscar el parche de origen ──
  let best = null, bestScore = Infinity;
  for(const dm of HEAL_DISTS){
    for(let a = 0; a < HEAL_ANGLES; a++){
      const th = 2 * Math.PI * a / HEAL_ANGLES;
      const ox = cx + Math.cos(th) * R * dm;
      const oy = cy + Math.sin(th) * R * dm;
      const ring = sampleRing(ox, oy);
      if(!ring) continue;
      let diff = 0;
      for(let i = 0; i < ring.length; i++) diff += Math.abs(ring[i] - dstRing[i]);
      const score = diff / ring.length;
      if(score < bestScore){ bestScore = score; best = { ox, oy, ring }; }
    }
  }
  if(best && bestScore > HEAL_MAX_MISMATCH) best = null;

  // ── rellenar ──
  // Copia de lo que YA HAY en `ctx` —no de `d`—: con muestra de todas
  // las capas, `d` puede venir de una composición distinta, y fuera
  // del círculo del pincel no se debe tocar nada, ni siquiera con el
  // contenido «correcto» de otra capa que no es ésta.
  const out = Uint8ClampedArray.from(img.data);
  const R2 = R * R, rad2 = radius * radius;
  const angs = new Float64Array(HEAL_K);
  for(let k = 0; k < HEAL_K; k++) angs[k] = 2 * Math.PI * k / HEAL_K;

  // Con parche, lo que se interpola es la DIFERENCIA de contorno; sin
  // parche, el contorno entero (el comportamiento de antes).
  const bnd = new Float64Array(HEAL_K * 3);
  for(let i = 0; i < bnd.length; i++)
    bnd[i] = best ? dstRing[i] - best.ring[i] : dstRing[i];

  const ix0 = Math.max(0, Math.floor(cx - radius)), ix1 = Math.min(w, Math.ceil(cx + radius) + 1);
  const iy0 = Math.max(0, Math.floor(cy - radius)), iy1 = Math.min(h, Math.ceil(cy + radius) + 1);

  for(let py = iy0; py < iy1; py++){
    for(let px = ix0; px < ix1; px++){
      const dx = px - cx, dy = py - cy;
      const dist2 = dx*dx + dy*dy;
      if(dist2 > rad2) continue;
      const dist = Math.sqrt(dist2);
      const ang = dist < 1e-6 ? 0 : Math.atan2(dy, dx);

      let wsum = 0, rr = 0, gg = 0, bb = 0;
      for(let k = 0; k < HEAL_K; k++){
        const wgt = poissonWeight(R2, R, dist, dist2, ang, angs[k]);
        wsum += wgt;
        rr += wgt * bnd[k*3]; gg += wgt * bnd[k*3+1]; bb += wgt * bnd[k*3+2];
      }
      rr /= wsum; gg /= wsum; bb /= wsum;

      const i = (py * w + px) * 4;
      if(best){
        // Textura del parche + corrección suave de color
        const sx = Math.round(best.ox + dx), sy = Math.round(best.oy + dy);
        const j = ((sy < 0 ? 0 : sy >= h ? h-1 : sy) * w +
                   (sx < 0 ? 0 : sx >= w ? w-1 : sx)) * 4;
        out[i]   = d[j]   + rr;
        out[i+1] = d[j+1] + gg;
        out[i+2] = d[j+2] + bb;
      } else {
        out[i] = rr; out[i+1] = gg; out[i+2] = bb;
      }
      out[i+3] = 255;
    }
  }
  img.data.set(out);
  ctx.putImageData(img, x0, y0);
}

/* ── tampón de clonar ─────────────────────────────────────────
   Copia desde un origen que se mueve con el pincel manteniendo el
   desplazamiento. Se pinta con el mismo degradado radial que el
   pincel para que el parche no tenga un borde duro. */
export function cloneStamp(ctx, src, sx, sy, dx, dy, radius, hardness, opacity){
  const r = radius;
  const tmp = document.createElement("canvas");
  tmp.width = Math.ceil(r * 2); tmp.height = Math.ceil(r * 2);
  const t = tmp.getContext("2d");

  t.drawImage(src, sx - r, sy - r, r * 2, r * 2, 0, 0, r * 2, r * 2);

  // Máscara circular con caída
  const inner = Math.max(0, Math.min(0.97, hardness / 100));
  const g = t.createRadialGradient(r, r, r * inner, r, r, r);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  t.globalCompositeOperation = "destination-in";
  t.fillStyle = g;
  t.fillRect(0, 0, r * 2, r * 2);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(tmp, dx - r, dy - r);
  ctx.restore();
}
