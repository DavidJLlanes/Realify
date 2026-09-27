/* ═══════════════════════════════════════════════════════════════
   PATCHMATCH
   El «Rellenar según el contenido» de antes (fillcontent.js) busca UNA
   sola traslación para el agujero entero: rápido, pero cada trozo del
   hueco sale idéntico a su correspondiente en el origen, así que un
   agujero grande sobre una textura irregular —hierba, piedra, agua—
   se nota como un «sello» repetido en vez de una síntesis de verdad.

   PatchMatch (Barnes, Shechtman, Finkelstein, Goldman, 2009) resuelve
   esto de otra forma: cada PÍXEL del agujero tiene su propio origen
   —un parche pequeño de alrededor que se le parece—, encontrado por
   una búsqueda aproximada que converge rápido gracias a dos trucos:

   · Propagación: los campos de desplazamiento de una imagen natural
     son coherentes por zonas —si al vecino de la izquierda le fue
     bien con un desplazamiento, probar ESE MISMO desplazamiento aquí
     suele ir bien también—, así que cada píxel se beneficia gratis de
     lo que ya encontraron sus vecinos.
   · Búsqueda aleatoria con radio decreciente: alrededor del mejor
     candidato de cada píxel, se prueban unos pocos saltos aleatorios
     cada vez más cortos, para escapar de mínimos locales sin barrer
     la imagen entera.

   Unas pocas pasadas alternando las dos cosas bastan para que el campo
   converja a algo casi tan bueno como la búsqueda exhaustiva, a una
   fracción de su coste. Se ejecuta en una PIRÁMIDE de resoluciones —de
   la más pequeña a la completa, cada nivel heredando el campo del
   anterior ya escalado—, que además de acelerar da coherencia
   estructural: la mitad de una ventana en un nivel grueso ya «sabe»
   que tiene que buscar cerca de otra ventana, no de un ladrillo suelto.
   ═══════════════════════════════════════════════════════════════ */

/* ── tabla de sumas de área ────────────────────────────────────────
   Para no recorrer el parche entero cada vez que hay que comprobar si
   un origen candidato es válido —que no pise el agujero ni se salga
   del área de muestreo permitida—: con esto, «¿hay algún píxel
   inválido en este rectángulo?» es una resta de cuatro números, no un
   bucle. Con miles de candidatos probados por píxel y miles de
   píxeles, es la diferencia entre segundos y minutos. */
function buildIntegral(invalid, w, h){
  const W = w + 1;
  const integral = new Int32Array(W * (h + 1));
  for(let y = 0; y < h; y++){
    let rowSum = 0;
    for(let x = 0; x < w; x++){
      rowSum += invalid[y * w + x];
      integral[(y + 1) * W + (x + 1)] = integral[y * W + (x + 1)] + rowSum;
    }
  }
  return integral;
}
/* Rectángulo semiabierto [x0,x1) × [y0,y1), recortado a los límites de
   la imagen —lo que quede FUERA cuenta como inválido, no se descarta
   sin más: un parche que se saldría del lienzo no es un origen
   utilizable—. */
function rectHasInvalid(integral, w, h, x0, y0, x1, y1){
  if(x0 < 0 || y0 < 0 || x1 > w || y1 > h) return true;
  const W = w + 1;
  return (integral[y1*W+x1] - integral[y0*W+x1] - integral[y1*W+x0] + integral[y0*W+x0]) > 0;
}

/* ── distancia entre dos parches ───────────────────────────────────
   Suma de diferencias al cuadrado, con parada temprana en cuanto se
   supera la mejor distancia conocida hasta ahora —la inmensa mayoría
   de candidatos son peores que el actual, y no hace falta terminar de
   sumar para saberlo—. */
function patchDist(data, w, half, ax, ay, bx, by, bestSoFar){
  let sum = 0;
  for(let dy = -half; dy <= half; dy++){
    const rowA = (ay + dy) * w, rowB = (by + dy) * w;
    for(let dx = -half; dx <= half; dx++){
      const ia = (rowA + ax + dx) * 4, ib = (rowB + bx + dx) * 4;
      const dr = data[ia] - data[ib], dg = data[ia+1] - data[ib+1], db = data[ia+2] - data[ib+2];
      sum += dr*dr + dg*dg + db*db;
    }
    if(sum >= bestSoFar) return sum;
  }
  return sum;
}

/* Parche de origen leído con una rotación/escala aplicadas alrededor
   de su propio centro (bx,by), por interpolación bilineal —para poder
   comparar «¿este trozo rotado 12° y al 92% se parece al destino?»
   sin tener que materializar la imagen entera rotada—. `patch` sale
   en un buffer reutilizado por el llamador (evita reservar uno nuevo
   por candidato, que con miles de candidatos por píxel sería basura
   de sobra para el recolector). */
function sampleRotScale(data, w, h, bx, by, half, angle, scale, out){
  const cos = Math.cos(angle) / scale, sin = Math.sin(angle) / scale;
  let k = 0;
  for(let dy = -half; dy <= half; dy++){
    for(let dx = -half; dx <= half; dx++){
      const sx = bx + dx * cos - dy * sin;
      const sy = by + dx * sin + dy * cos;
      if(sx < 0 || sy < 0 || sx >= w - 1 || sy >= h - 1) return false;
      const x0 = sx | 0, y0 = sy | 0, tx = sx - x0, ty = sy - y0;
      const i00 = (y0*w+x0)*4, i10 = (y0*w+x0+1)*4, i01 = (y0+1)*w*4+x0*4, i11 = ((y0+1)*w+x0+1)*4;
      for(let c = 0; c < 3; c++){
        const top = data[i00+c] + (data[i10+c] - data[i00+c]) * tx;
        const bot = data[i01+c] + (data[i11+c] - data[i01+c]) * tx;
        out[k*3+c] = top + (bot - top) * ty;
      }
      k++;
    }
  }
  return true;
}
function distToSample(data, w, half, ax, ay, sample, bestSoFar){
  let sum = 0, k = 0;
  for(let dy = -half; dy <= half; dy++){
    const row = (ay+dy) * w;
    for(let dx = -half; dx <= half; dx++){
      const ia = (row + ax+dx) * 4;
      const dr = data[ia]-sample[k*3], dg = data[ia+1]-sample[k*3+1], db = data[ia+2]-sample[k*3+2];
      sum += dr*dr+dg*dg+db*db;
      k++;
    }
    if(sum >= bestSoFar) return sum;
  }
  return sum;
}

/* ── un nivel de la pirámide ────────────────────────────────────────
   `nnf` trae, para cada píxel del agujero (en el orden de `holePts`),
   su mejor candidato conocido: {x, y, angle, scale, dist}. Se muta in
   place. `angle`/`scale` sólo se usan y se guardan si `allowRot`/
   `allowScale` están activos; si no, siempre son 0 y 1. */
function runLevel(data, w, h, holePts, invalidOrigin, integral, half, nnf, opts){
  const { iterations, allowRotation, allowScale, rng } = opts;
  const n = holePts.length / 2;
  const idxAt = new Int32Array(w * h).fill(-1);
  for(let k = 0; k < n; k++) idxAt[holePts[k*2+1]*w + holePts[k*2]] = k;

  const validOrigin = (bx, by) => !rectHasInvalid(integral, w, h, bx-half, by-half, bx+half+1, by+half+1);
  const sampleBuf = new Float32Array((half*2+1) * (half*2+1) * 3);

  const tryCandidate = (k, ax, ay, bx, by, angle, scale) => {
    if(bx-half < 0 || by-half < 0 || bx+half >= w || by+half >= h) return;
    let dist;
    if(angle === 0 && scale === 1){
      if(!validOrigin(bx, by)) return;
      dist = patchDist(data, w, half, ax, ay, bx, by, nnf[k].dist);
    } else {
      // Un parche rotado/escalado puede salirse del rectángulo que
      // valida `validOrigin` sin llegar a tocar el agujero de verdad;
      // para no complicar la tabla de sumas con esa forma, se
      // comprueba el propio muestreo: si toca el lienzo, vale, y el
      // agujero ya no está donde se rota/escala lo bastante como para
      // que esto importe en la práctica —el margen del recorte de
      // trabajo se encarga de que casi nunca esté cerca—.
      if(!sampleRotScale(data, w, h, bx, by, half, angle, scale, sampleBuf)) return;
      dist = distToSample(data, w, half, ax, ay, sampleBuf, nnf[k].dist);
    }
    if(dist < nnf[k].dist) nnf[k] = { x: bx, y: by, angle, scale, dist };
  };

  for(let it = 0; it < iterations; it++){
    const reverse = it % 2 === 1;
    for(let step = 0; step < n; step++){
      const k = reverse ? n - 1 - step : step;
      const ax = holePts[k*2], ay = holePts[k*2+1];
      const cur = nnf[k];

      // Propagación: el desplazamiento de los vecinos ya visitados en
      // ESTE barrido, trasladado a este píxel.
      const nx = reverse ? ax + 1 : ax - 1, ny = ay;
      const mx = ax, my = reverse ? ay + 1 : ay - 1;
      for(const [px, py] of [[nx, ny], [mx, my]]){
        if(px < 0 || py < 0 || px >= w || py >= h) continue;
        const nk = idxAt[py*w+px];
        if(nk < 0) continue;
        const nb = nnf[nk];
        const bx = nb.x + (ax - px), by = nb.y + (ay - py);
        tryCandidate(k, ax, ay, bx, by, nb.angle, nb.scale);
      }

      // Búsqueda aleatoria: radio decreciente alrededor del mejor
      // candidato actual, hasta que el salto es menor que un píxel.
      let radius = Math.max(w, h);
      while(radius >= 1){
        const bx = Math.round(cur.x + (rng() * 2 - 1) * radius);
        const by = Math.round(cur.y + (rng() * 2 - 1) * radius);
        let angle = cur.angle, scale = cur.scale;
        if(allowRotation && rng() < 0.3) angle = (rng() * 2 - 1) * (Math.PI / 6);      // ±30°
        if(allowScale && rng() < 0.3) scale = 0.85 + rng() * 0.3;                       // 0.85..1.15
        tryCandidate(k, ax, ay, bx, by, angle, scale);
        radius = Math.floor(radius / 2);
      }
    }
  }
}

/* Genera un número pseudoaleatorio reproducible (LCG simple): con
   `Math.random()` un mismo caso de prueba da un resultado distinto en
   cada corrida, y verificar «esto converge y mejora» con números que
   cambian solos es mucho más frágil que con una semilla fija. */
function makeRng(seed){
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ── pirámide completa ─────────────────────────────────────────────
   `rgba`/`holeMask`/`sampleMask` a resolución completa. Devuelve el
   NNF final, a resolución completa, uno por cada píxel de `holeMask`
   en orden de fila —el mismo orden que producirá `synthesize`—. */
export function computeNNF(rgba, w, h, holeMask, opts = {}){
  const patchSize = opts.patchSize || 7;
  const half = patchSize >> 1;
  const iterations = opts.iterations || 5;
  const allowRotation = !!opts.allowRotation;
  const allowScale = !!opts.allowScale;
  const sampleMask = opts.sampleMask || null;
  const rng = opts.rng || makeRng(opts.seed ?? 1);

  // Pirámide: cada nivel a mitad de tamaño que el anterior, hasta que
  // el AGUJERO —no la imagen— mide como mucho un parche de lado: a
  // partir de ahí ya no hace falta pirámide, ese nivel tiene margen de
  // sobra para buscar un origen sin que el agujero se lo coma entero.
  const levels = [{ rgba, w, h, holeMask, sampleMask }];
  while(true){
    const cur = levels[levels.length - 1];
    const box = boundingBoxOfMask(cur.holeMask, cur.w, cur.h);
    if(!box) break;
    // No basta con que el agujero mida menos que un parche: un origen
    // válido necesita además un ANILLO de medio parche alrededor libre
    // por cada lado —si no, «isValidCandidate» descarta cada posición
    // porque el parche entero, no sólo su centro, tiene que caer fuera
    // del agujero—. Se para cuando el agujero MÁS ese anillo por los
    // dos lados cabe con margen de sobra en la imagen de este nivel.
    const needed = Math.max(box.w, box.h) + patchSize * 2;
    if(needed <= Math.min(cur.w, cur.h)) break;
    if(Math.min(cur.w, cur.h) <= patchSize + 4) break;   // salvaguarda: nunca por debajo de un nivel utilizable
    levels.push(downsampleLevel(cur, patchSize));
    if(levels.length > 8) break;   // cota de seguridad, nunca debería hacer falta
  }

  let nnf = null, prevW = 0, prevH = 0, prevHolePts = null;
  for(let li = levels.length - 1; li >= 0; li--){
    const lvl = levels[li];
    const holePts = collectHolePixels(lvl.holeMask, lvl.w, lvl.h);
    if(holePts.length === 0) return { holePts: [], nnf: [], patchSize };

    const invalidOrigin = new Uint8Array(lvl.w * lvl.h);
    for(let i = 0; i < invalidOrigin.length; i++){
      invalidOrigin[i] = lvl.holeMask[i] > 127 ? 1 : (lvl.sampleMask && lvl.sampleMask[i] <= 127 ? 1 : 0);
    }
    const integral = buildIntegral(invalidOrigin, lvl.w, lvl.h);

    const n = holePts.length / 2;
    const levelNnf = new Array(n);
    const validOrigins = collectValidOrigins(invalidOrigin, lvl.w, lvl.h, half);
    if(validOrigins.length === 0){
      // Nada de dónde tomar muestras —el área de muestreo elegida no
      // deja ningún parche entero—: se avisa con un NNF vacío, que
      // `synthesize` interpreta como «no hay nada que sintetizar».
      return { holePts: [], nnf: [], patchSize };
    }

    for(let k = 0; k < n; k++){
      let bx, by, angle = 0, scale = 1;
      if(nnf && prevHolePts){
        // Heredado del nivel anterior (mitad de resolución): mismo
        // punto relativo, escalado ×2, como arranque ya razonable.
        const ax = holePts[k*2], ay = holePts[k*2+1];
        const pax = Math.min(prevW-1, ax >> 1), pay = Math.min(prevH-1, ay >> 1);
        const pk = findNearestPrevIndex(prevHolePts, pax, pay);
        if(pk >= 0){
          const prev = nnf[pk];
          bx = Math.min(lvl.w-1, Math.max(0, prev.x * 2));
          by = Math.min(lvl.h-1, Math.max(0, prev.y * 2));
          angle = prev.angle; scale = prev.scale;
          if(!isValidCandidate(invalidOrigin, lvl.w, lvl.h, bx, by, half)){
            const pick = validOrigins[(rng() * validOrigins.length) | 0];
            bx = pick[0]; by = pick[1];
          }
        }
      }
      if(bx === undefined){
        const pick = validOrigins[(rng() * validOrigins.length) | 0];
        bx = pick[0]; by = pick[1];
      }
      const ax = holePts[k*2], ay = holePts[k*2+1];
      const dist = (angle === 0 && scale === 1)
        ? patchDist(lvl.rgba, lvl.w, half, ax, ay, bx, by, Infinity)
        : Infinity;
      levelNnf[k] = { x: bx, y: by, angle, scale, dist };
    }

    runLevel(lvl.rgba, lvl.w, lvl.h, holePts, invalidOrigin, integral, half, levelNnf, {
      iterations, allowRotation, allowScale, rng
    });

    nnf = levelNnf; prevW = lvl.w; prevH = lvl.h; prevHolePts = holePts;
    if(li === 0) return { holePts, nnf, patchSize };
  }
  return { holePts: [], nnf: [], patchSize };
}

function isValidCandidate(invalidOrigin, w, h, bx, by, half){
  if(bx-half < 0 || by-half < 0 || bx+half >= w || by+half >= h) return false;
  for(let dy = -half; dy <= half; dy++) for(let dx = -half; dx <= half; dx++)
    if(invalidOrigin[(by+dy)*w+(bx+dx)]) return false;
  return true;
}

/* Caja que envuelve el agujero, en el propio nivel —para decidir
   cuándo parar de reducir la pirámide: lo que importa no es que la
   IMAGEN se haga pequeña, sino que el AGUJERO se haga pequeño frente
   al parche. Una imagen grande con un agujero minúsculo no necesita
   ninguna reducción; una imagen minúscula con un agujero que ocupa
   casi todo —el caso que rompía esto— necesita pararse ANTES de que
   ese agujero se coma el poco margen que quede para buscar un
   origen. */
function boundingBoxOfMask(mask, w, h){
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w; x++){
      if(mask[row + x] > 127){ if(x < minX) minX = x; if(x > maxX) maxX = x; if(y < minY) minY = y; if(y > maxY) maxY = y; }
    }
  }
  if(maxX < 0) return null;
  return { w: maxX - minX + 1, h: maxY - minY + 1 };
}

function collectHolePixels(mask, w, h){
  const pts = [];
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(mask[y*w+x] > 127){ pts.push(x, y); }
  return pts;
}
/* Orígenes válidos, submuestreados a una rejilla si hay muchos —para
   la inicialización aleatoria no hace falta CADA píxel candidato, con
   una muestra representativa basta y sale más barato de construir. */
function collectValidOrigins(invalidOrigin, w, h, half){
  const out = [];
  const step = Math.max(1, Math.floor(Math.sqrt((w*h) / 4000)));
  for(let y = half; y < h - half; y += step){
    for(let x = half; x < w - half; x += step){
      if(isValidCandidate(invalidOrigin, w, h, x, y, half)) out.push([x, y]);
    }
  }
  return out;
}
function findNearestPrevIndex(prevHolePts, x, y){
  // Los puntos del agujero se recorren en orden de fila en los dos
  // niveles, así que el mismo índice relativo (por posición, no por
  // k) cae cerca: una búsqueda lineal corta desde una estimación por
  // proporción basta, no hace falta un índice espacial de verdad para
  // el tamaño de agujero que esto maneja.
  const n = prevHolePts.length / 2;
  if(n === 0) return -1;
  let best = -1, bestD = Infinity;
  const guess = Math.min(n - 1, Math.floor((y * 997 + x) % n));
  const span = Math.min(n, 40);
  for(let i = 0; i < span; i++){
    const k = (guess + i) % n;
    const dx = prevHolePts[k*2] - x, dy = prevHolePts[k*2+1] - y;
    const d = dx*dx + dy*dy;
    if(d < bestD){ bestD = d; best = k; }
  }
  return best;
}

/* Reduce a mitad de tamaño (promedio de bloques 2×2) tanto la imagen
   como las dos máscaras binarias —cualquier píxel de la máscara
   cuenta como «dentro» si al menos uno de los cuatro lo estaba, para
   no perder un agujero fino al reducirlo—. */
function downsampleLevel(lvl, patchSize){
  const w2 = Math.max(patchSize + 1, lvl.w >> 1), h2 = Math.max(patchSize + 1, lvl.h >> 1);
  const sx = lvl.w / w2, sy = lvl.h / h2;
  const rgba = new Uint8ClampedArray(w2 * h2 * 4);
  const holeMask = new Uint8ClampedArray(w2 * h2);
  const sampleMask = lvl.sampleMask ? new Uint8ClampedArray(w2 * h2) : null;
  for(let y = 0; y < h2; y++){
    const sy0 = Math.min(lvl.h - 1, (y * sy) | 0), sy1 = Math.min(lvl.h - 1, ((y + 1) * sy) | 0);
    for(let x = 0; x < w2; x++){
      const sx0 = Math.min(lvl.w - 1, (x * sx) | 0), sx1 = Math.min(lvl.w - 1, ((x + 1) * sx) | 0);
      let r=0,g=0,b=0,a=0,cnt=0, hole=0, samp=0;
      for(let yy = sy0; yy <= sy1; yy++) for(let xx = sx0; xx <= sx1; xx++){
        const i = (yy*lvl.w+xx)*4;
        r+=lvl.rgba[i]; g+=lvl.rgba[i+1]; b+=lvl.rgba[i+2]; a+=lvl.rgba[i+3]; cnt++;
        if(lvl.holeMask[yy*lvl.w+xx] > 127) hole = 1;
        if(sampleMask && lvl.sampleMask[yy*lvl.w+xx] > 127) samp = 1;
      }
      const o = y*w2+x;
      rgba[o*4]=r/cnt; rgba[o*4+1]=g/cnt; rgba[o*4+2]=b/cnt; rgba[o*4+3]=a/cnt;
      holeMask[o] = hole ? 255 : 0;
      if(sampleMask) sampleMask[o] = samp ? 255 : 0;
    }
  }
  return { rgba, w: w2, h: h2, holeMask, sampleMask };
}

/* ── síntesis final ─────────────────────────────────────────────────
   Con el NNF ya convergido a resolución completa, cada píxel del
   agujero toma directamente el color del CENTRO de su mejor parche de
   origen —no hace falta «votar» entre los parches que lo cubren
   porque, con propagación de por medio, los parches vecinos ya
   comparten casi el mismo origen desplazado en uno; promediar aquí
   sólo emborronaría el resultado sin arreglar nada—. Con
   rotación/escala, se muestrea con la misma interpolación bilineal
   que usó la búsqueda, para que el resultado sea coherente con lo que
   se comparó. */
export function synthesize(rgba, w, h, holePts, nnf){
  const out = Uint8ClampedArray.from(rgba);
  for(let k = 0; k < holePts.length / 2; k++){
    const ax = holePts[k*2], ay = holePts[k*2+1];
    const c = nnf[k];
    const oi = (ay*w+ax)*4;
    if(c.angle === 0 && c.scale === 1){
      const si = (c.y*w+c.x)*4;
      out[oi]=rgba[si]; out[oi+1]=rgba[si+1]; out[oi+2]=rgba[si+2];
    } else {
      const sample = new Float32Array(3);
      sampleRotScale(rgba, w, h, c.x, c.y, 0, c.angle, c.scale, sample);
      out[oi]=sample[0]; out[oi+1]=sample[1]; out[oi+2]=sample[2];
    }
    out[oi+3] = 255;
  }
  return out;
}
