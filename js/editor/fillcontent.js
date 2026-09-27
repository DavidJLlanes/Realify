/* ═══════════════════════════════════════════════════════════════
   RELLENAR SEGÚN EL CONTENIDO
   La misma idea que el corrector de manchas (paint.js: healSpot),
   llevada de un círculo de pincel a una selección de cualquier forma:
   se busca en otra parte de la capa un trozo cuyo CONTORNO se parezca
   al contorno del agujero, se copia con su textura, y se corrige la
   diferencia de color en el borde con un campo suave que se apaga
   hacia el interior. La costura desaparece porque en el borde mismo
   la corrección vale exactamente lo que hacía falta.

   Lo que cambia respecto al corrector es la FORMA del contorno: un
   círculo tiene una fórmula cerrada preciosa para su interpolación
   armónica (el núcleo de Poisson del disco). Un contorno arbitrario
   —el que deja un lazo, una varita mágica, o simplemente un
   rectángulo— no la tiene: resolver la ecuación de Laplace de verdad
   ahí dentro pide un solver numérico iterativo. En vez de eso se usa
   ponderación por distancia inversa (IDW) desde las muestras del
   contorno, que es el interpolante suave más simple que existe y que
   converge al valor de cada muestra según uno se acerca a ella. No es
   la solución exacta de Laplace, pero para tapar un objeto es
   indistinguible a simple vista y no necesita ninguna iteración.
   ═══════════════════════════════════════════════════════════════ */

/* ── contorno de la máscara ──────────────────────────────────────
   OJO: el anillo tiene que caer FUERA de la máscara, en el fondo que
   la rodea —no en el propio borde interior del agujero—. La primera
   versión de esto tomaba el borde INTERIOR (los últimos píxeles
   dentro de la selección), que para "quitar un objeto" es
   precisamente la peor referencia posible: son los píxeles del propio
   objeto que se quiere eliminar, así que el color a «preservar» en el
   borde salía del objeto en vez de salir del fondo, y el resultado se
   quedaba con su color original sin cambiar nada de verdad. Es el
   mismo motivo por el que `healSpot` muestrea a `radius + 3`, fuera
   de la mancha: aquí se generaliza esa idea a una forma cualquiera
   creciendo la máscara hacia fuera, capa a capa, y quedándose con los
   píxeles nuevos de cada capa —que por construcción están todos fuera
   de la máscara original—. */
export function maskBoundary(mask, w, h, bounds, margin = 3){
  const x0 = Math.max(0, bounds.x - margin - 1), y0 = Math.max(0, bounds.y - margin - 1);
  const x1 = Math.min(w, bounds.x + bounds.w + margin + 1), y1 = Math.min(h, bounds.y + bounds.h + margin + 1);
  const bw = x1 - x0, bh = y1 - y0;
  if(bw <= 0 || bh <= 0) return [];

  const visited = new Uint8Array(bw * bh);
  let frontier = [];
  for(let y = 0; y < bh; y++){
    for(let x = 0; x < bw; x++){
      if(mask[(y+y0)*w + (x+x0)] > 0){
        visited[y*bw + x] = 1;
        frontier.push([x, y]);
      }
    }
  }

  const ring = [];
  const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
  for(let pass = 0; pass < margin; pass++){
    const next = [];
    for(const [x, y] of frontier){
      for(const [dx, dy] of DIRS){
        const nx = x+dx, ny = y+dy;
        if(nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        if(visited[ny*bw + nx]) continue;
        visited[ny*bw + nx] = 1;
        ring.push([nx + x0, ny + y0]);
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return ring;
}

/* Reduce una lista de puntos a lo sumo `n`, tomados a intervalos
   regulares en vez de al azar: así el contorno sigue representado en
   todo su perímetro y no se acumulan muestras en un solo tramo. */
export function subsample(points, n){
  if(points.length <= n) return points;
  const out = [];
  const step = points.length / n;
  for(let i = 0; i < n; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

/* ── búsqueda del origen ──────────────────────────────────────────
   Traslada el contorno entero a varios candidatos (distancias ×
   ángulos, escaladas al tamaño de la propia selección) y se queda con
   el que menos se diferencia en color de dónde tiene que encajar. */
export function findSource(getPixel, ring, bounds, canvasW, canvasH){
  const cx = bounds.x + bounds.w/2, cy = bounds.y + bounds.h/2;
  const R = Math.max(bounds.w, bounds.h);
  const DISTS = [1.3, 1.8, 2.5, 3.4];
  const ANGLES = 16;

  const dstColors = ring.map(([x,y]) => getPixel(x, y));

  let best = null, bestScore = Infinity;
  for(const dm of DISTS){
    for(let a = 0; a < ANGLES; a++){
      const th = 2 * Math.PI * a / ANGLES;
      const dx = Math.round(Math.cos(th) * R * dm);
      const dy = Math.round(Math.sin(th) * R * dm);

      /* Convención: el origen de un píxel de destino (x,y) es
         (x−dx, y−dy) —así lo usan luego `corrections` y el bucle de
         relleno de `fillContentAware`—. La búsqueda tiene que evaluar
         candidatos en esa MISMA dirección; evaluarlos al revés (x+dx)
         validaba un candidato y luego se aplicaba el opuesto, que caía
         en un sitio totalmente distinto —a veces fuera del lienzo
         aunque el candidato validado no lo estuviera—.

         Y no basta con que el ANILLO —submuestreado, así que ni
         siquiera cubre cada píxel del contorno— quede dentro del
         lienzo: hace falta que la CAJA ENTERA de la selección quepa,
         porque el mismo desplazamiento se usa para todo el interior,
         ring o no. */
      // Margen extra: el anillo puede asomar hasta `margin` pixeles
      // MAS ALLA de `bounds` (es el crecimiento hacia fuera de
      // maskBoundary), asi que la caja que hay que validar es la caja
      // más ese margen, no la caja a secas.
      const pad = 4;
      if(bounds.x - dx < pad || bounds.y - dy < pad ||
         bounds.x + bounds.w - dx > canvasW - pad || bounds.y + bounds.h - dy > canvasH - pad) continue;

      let diff = 0;
      for(let i = 0; i < ring.length; i++){
        const c = getPixel(ring[i][0] - dx, ring[i][1] - dy);
        const d0 = dstColors[i];
        diff += Math.abs(c[0]-d0[0]) + Math.abs(c[1]-d0[1]) + Math.abs(c[2]-d0[2]);
      }
      const score = diff / ring.length;
      if(score < bestScore){ bestScore = score; best = { dx, dy, score }; }
    }
  }
  return best;
}

/* ── campo de corrección por IDW ──────────────────────────────────
   Para cada píxel del interior, media ponderada de la diferencia
   (color de destino en el borde − color de origen en el borde) de
   cada muestra del contorno, con peso 1/d². Cuanto más cerca de una
   muestra, más manda ella sola; en medio de varias, se reparte. */
export function idwCorrection(x, y, ring, corrections){
  let wsum = 0, r = 0, g = 0, b = 0;
  for(let i = 0; i < ring.length; i++){
    const dx = x - ring[i][0], dy = y - ring[i][1];
    const d2 = dx*dx + dy*dy;
    if(d2 < 0.25) return corrections[i];      // prácticamente encima de la muestra
    const w = 1 / (d2 * d2);                  // 1/d⁴: cae más rápido que 1/d², menos "borroneo" a distancia
    wsum += w;
    r += w * corrections[i][0]; g += w * corrections[i][1]; b += w * corrections[i][2];
  }
  return wsum > 0 ? [r/wsum, g/wsum, b/wsum] : [0,0,0];
}

/* ── relleno completo sobre un ImageData ──────────────────────────
   Opera sobre `img` (un ImageData ya leído del lienzo, tamaño del
   propio lienzo) y lo muta in place. `mask`/`bounds` en las mismas
   coordenadas. Devuelve `true` si encontró un origen razonable y
   rellenó con textura; `false` si no encontró nada parecido y no ha
   tocado nada —quien llama decide entonces si avisar o recurrir a
   otra cosa—. */
export function fillContentAware(img, mask, w, h, bounds){
  const d = img.data;
  const getPixel = (x, y) => { const i = (y*w+x)*4; return [d[i], d[i+1], d[i+2]]; };

  const ring = subsample(maskBoundary(mask, w, h, bounds), 80);
  if(!ring.length) return false;

  const src = findSource(getPixel, ring, bounds, w, h);
  if(!src) return false;

  const corrections = ring.map(([x,y]) => {
    const dstC = getPixel(x, y);
    const srcC = getPixel(x - src.dx, y - src.dy);
    return [dstC[0]-srcC[0], dstC[1]-srcC[1], dstC[2]-srcC[2]];
  });

  /* El campo IDW es O(interior × muestras): para una selección grande
     se calcula en una rejilla reducida y se interpola bilinealmente al
     escribir, que es barato porque el campo es de baja frecuencia por
     construcción —una media ponderada nunca tiene detalle fino—. */
  const area = bounds.w * bounds.h;
  const CAP = 24000;
  const step = area > CAP ? Math.max(1, Math.ceil(Math.sqrt(area / CAP))) : 1;

  const gw = Math.ceil(bounds.w / step) + 1, gh = Math.ceil(bounds.h / step) + 1;
  const grid = new Float32Array(gw * gh * 3);
  for(let gy = 0; gy < gh; gy++){
    for(let gx = 0; gx < gw; gx++){
      const x = Math.min(w-1, bounds.x + gx*step), y = Math.min(h-1, bounds.y + gy*step);
      const c = idwCorrection(x, y, ring, corrections);
      const p = (gy*gw+gx)*3;
      grid[p]=c[0]; grid[p+1]=c[1]; grid[p+2]=c[2];
    }
  }
  const sampleGrid = (x, y) => {
    const fx = (x - bounds.x) / step, fy = (y - bounds.y) / step;
    const gx0 = Math.max(0, Math.min(gw-2, Math.floor(fx))), gy0 = Math.max(0, Math.min(gh-2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - gx0)), ty = Math.min(1, Math.max(0, fy - gy0));
    const at = (gx,gy,ch) => grid[(gy*gw+gx)*3+ch];
    const lerp = (a,b,t) => a+(b-a)*t;
    const out = [0,0,0];
    for(let ch=0; ch<3; ch++){
      const top = lerp(at(gx0,gy0,ch), at(gx0+1,gy0,ch), tx);
      const bot = lerp(at(gx0,gy0+1,ch), at(gx0+1,gy0+1,ch), tx);
      out[ch] = lerp(top, bot, ty);
    }
    return out;
  };

  const out = Uint8ClampedArray.from(d);
  for(let y = bounds.y; y < bounds.y + bounds.h; y++){
    for(let x = bounds.x; x < bounds.x + bounds.w; x++){
      const m = mask[y*w+x];
      if(m === 0) continue;
      const sx = x - src.dx, sy = y - src.dy;
      if(sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const s = getPixel(sx, sy);
      const c = step === 1 ? idwCorrection(x, y, ring, corrections) : sampleGrid(x, y);
      const i = (y*w+x)*4;
      const nr = s[0]+c[0], ng = s[1]+c[1], nb = s[2]+c[2];
      if(m === 255){
        out[i]=nr; out[i+1]=ng; out[i+2]=nb;
      } else {
        const t = m/255, u = 1-t;
        out[i]   = d[i]*u   + nr*t;
        out[i+1] = d[i+1]*u + ng*t;
        out[i+2] = d[i+2]*u + nb*t;
      }
    }
  }
  d.set(out);
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   RELLENO DE VERDAD: PATCHMATCH
   La traslación única de arriba —todo el agujero viene de UN sitio,
   a una sola distancia y ángulo— es rápida y basta para una mancha
   sobre un fondo liso, pero un agujero grande sobre una textura
   irregular (hierba, agua, piedra, una multitud) sale con un «sello»
   repetido: cada trozo del agujero es idéntico a su correspondiente
   en el origen, porque sólo hay un desplazamiento para todos.

   PatchMatch (patchmatch.js) resuelve esto de verdad: cada PÍXEL del
   agujero encuentra su propio origen, así que la textura se sintetiza
   en vez de copiarse en bloque. Aquí se recorta la región de trabajo
   —no hace falta correr la búsqueda sobre el documento entero—, se
   deja pintar al usuario DE DÓNDE puede tomar muestras —el «área de
   muestreo» de cualquier editor serio—, y se difumina la costura del
   borde con un desenfoque del propio resultado, con más peso cuanto
   más cerca del límite: el centro del agujero se queda con la textura
   sintetizada tal cual, el borde se funde con el fondo real.
   ═══════════════════════════════════════════════════════════════ */
import { computeNNF, synthesize } from "./patchmatch.js";
import { featherMask, boundsOf as boundsOfSel } from "./selection.js";
import { blurred } from "../filters/basic.js";

/* Región de trabajo: la caja del agujero con un margen generoso de
   contexto alrededor —para que PatchMatch tenga textura de sobra
   donde buscar sin tener que correr sobre el documento entero, que
   con una foto de varios megapíxeles sería tirar el tiempo—. */
function workRegion(bounds, w, h){
  const margin = Math.max(60, Math.round(Math.max(bounds.w, bounds.h) * 1.2));
  const x0 = Math.max(0, bounds.x - margin), y0 = Math.max(0, bounds.y - margin);
  const x1 = Math.min(w, bounds.x + bounds.w + margin), y1 = Math.min(h, bounds.y + bounds.h + margin);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function cropRGBA(img, w, region){
  const out = new Uint8ClampedArray(region.w * region.h * 4);
  for(let y = 0; y < region.h; y++){
    const srcOff = ((region.y + y) * w + region.x) * 4;
    out.set(img.data.subarray(srcOff, srcOff + region.w * 4), y * region.w * 4);
  }
  return out;
}
export function cropMask(mask, w, region){
  const out = new Uint8ClampedArray(region.w * region.h);
  for(let y = 0; y < region.h; y++){
    const srcOff = (region.y + y) * w + region.x;
    out.set(mask.subarray(srcOff, srcOff + region.w), y * region.w);
  }
  return out;
}

/* Desenfoca sólo el trozo sintetizado en su propio recorte —trabajar
   ya sobre la región de trabajo, no sobre el documento entero, es lo
   que hace que esto sea barato— y lo funde con el resultado nítido
   según lo cerca que esté del borde del agujero: en el centro,
   `feather` vale prácticamente 255 y gana la textura sintetizada tal
   cual; a un puñado de píxeles del borde decae hacia el desenfoque,
   que ahí ya está dominado por el fondo real que lo rodea —el mismo
   truco que un difuminado de pincel, aplicado una sola vez al
   resultado entero en vez de píxel a píxel—. */
function featherEdge(rgbaU8, holeMaskU8, w, h, width){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgbaU8), w, h), 0, 0);
  const soft = blurred(c, Math.max(2, width)).getContext("2d").getImageData(0, 0, w, h).data;

  const feather = featherMask(holeMaskU8, w, h, width);
  const out = Uint8ClampedArray.from(rgbaU8);
  for(let i = 0; i < w * h; i++){
    if(holeMaskU8[i] === 0) continue;
    const t = feather[i] / 255;
    const p = i * 4;
    out[p]   = soft[p]   + (rgbaU8[p]   - soft[p])   * t;
    out[p+1] = soft[p+1] + (rgbaU8[p+1] - soft[p+1]) * t;
    out[p+2] = soft[p+2] + (rgbaU8[p+2] - soft[p+2]) * t;
  }
  return out;
}

/**
 * Relleno con PatchMatch de verdad, sobre un recorte de trabajo.
 * `img` es el ImageData del LIENZO ENTERO —se muta in place—; `mask`,
 * del tamaño del lienzo. `sampleRegionMask`, si se da, tiene el
 * tamaño de la REGIÓN DE TRABAJO (no del lienzo): es lo que el
 * usuario pintó como «de aquí sí se puede tomar muestra».
 * Devuelve `true` si sintetizó algo.
 */
export function fillContentAwarePatchMatch(img, mask, w, h, bounds, opts = {}){
  const region = workRegion(bounds, w, h);
  const rgba = cropRGBA(img, w, region);
  const hole = cropMask(mask, w, region);

  const { holePts, nnf } = computeNNF(rgba, region.w, region.h, hole, {
    patchSize: 7,
    iterations: opts.iterations ?? 5,
    allowRotation: !!opts.allowRotation,
    allowScale: !!opts.allowScale,
    sampleMask: opts.sampleRegionMask || null,
    seed: opts.seed
  });
  if(holePts.length === 0) return false;

  const synth = synthesize(rgba, region.w, region.h, holePts, nnf);
  const eased = featherEdge(synth, hole, region.w, region.h, 5);

  const d = img.data;
  for(let y = 0; y < region.h; y++){
    for(let x = 0; x < region.w; x++){
      const li = y * region.w + x;
      if(hole[li] === 0) continue;
      const gx = region.x + x, gy = region.y + y;
      const m = mask[gy*w+gx];
      const i = (gy*w+gx)*4, li4 = li*4;
      if(m >= 253){
        d[i]=eased[li4]; d[i+1]=eased[li4+1]; d[i+2]=eased[li4+2];
      } else {
        const t = m/255, u = 1-t;
        d[i]   = d[i]*u   + eased[li4]*t;
        d[i+1] = d[i+1]*u + eased[li4+1]*t;
        d[i+2] = d[i+2]*u + eased[li4+2]*t;
      }
    }
  }
  return true;
}

export { workRegion as fillWorkRegion };

/* ═══════════════════════════════════════════════════════════════
   COMANDO: aplicar sobre la capa activa según la selección actual
   ═══════════════════════════════════════════════════════════════ */
import { doc, activeLayer } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";

const FILL_ENGINE_KEY = "realify.fillEngine";

/* ── vista previa con área de muestreo pintable ────────────────────
   Un overlay verde sobre lo que SÍ se puede usar como origen —todo
   menos el agujero, al empezar—: arrastrar con el botón izquierdo lo
   QUITA del área de muestreo (por ejemplo, un objeto que no se quiere
   ver clonado en el relleno), y con Alt o el botón derecho lo vuelve
   a poner. Es el mismo gesto que «Área de muestreo» de cualquier
   editor serio, resuelto aquí dentro del propio diálogo en vez de en
   un espacio de trabajo aparte. */
function mountSampleAreaEditor(region, holeMaskCrop){
  const canvas = document.createElement("canvas");
  canvas.width = region.w; canvas.height = region.h;
  canvas.style.cssText = "width:100%;height:auto;display:block;cursor:crosshair;" +
    "border-radius:var(--r);border:1px solid var(--line-soft)";

  // 255 = se puede muestrear aquí. Empieza en todo menos el agujero.
  const sampleMask = new Uint8ClampedArray(region.w * region.h);
  for(let i = 0; i < sampleMask.length; i++) sampleMask[i] = holeMaskCrop[i] > 0 ? 0 : 255;

  const baseImg = region.previewSrc;   // ImageData de la región, para dibujar de fondo
  function redraw(){
    const cx = canvas.getContext("2d");
    cx.putImageData(baseImg, 0, 0);
    const overlay = cx.getImageData(0, 0, region.w, region.h);
    for(let i = 0; i < sampleMask.length; i++){
      if(holeMaskCrop[i] > 0) continue;          // el agujero no lleva overlay, ya se ve aparte
      if(sampleMask[i] === 0) continue;          // fuera del área de muestreo: sin tinte
      const p = i * 4;
      overlay.data[p+1] = Math.min(255, overlay.data[p+1] + 70);   // tinte verde
      overlay.data[p]   = overlay.data[p] * 0.7;
      overlay.data[p+2] = overlay.data[p+2] * 0.7;
    }
    // el agujero se marca en rojo suave, para que quede claro qué se va a rellenar
    for(let i = 0; i < holeMaskCrop.length; i++){
      if(holeMaskCrop[i] === 0) continue;
      const p = i*4;
      overlay.data[p] = Math.min(255, overlay.data[p] + 60);
      overlay.data[p+1] *= 0.75; overlay.data[p+2] *= 0.75;
    }
    cx.putImageData(overlay, 0, 0);
  }
  redraw();

  let painting = false, erase = false;
  const paintAt = (px, py, radius) => {
    const r2 = radius*radius;
    const x0 = Math.max(0, Math.floor(px-radius)), x1 = Math.min(region.w, Math.ceil(px+radius));
    const y0 = Math.max(0, Math.floor(py-radius)), y1 = Math.min(region.h, Math.ceil(py+radius));
    for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++){
      const dx = x-px, dy = y-py;
      if(dx*dx+dy*dy > r2) continue;
      sampleMask[y*region.w+x] = erase ? 0 : 255;
    }
  };
  const toCanvasXY = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * region.w, y: (e.clientY - r.top) / r.height * region.h };
  };
  // El overlay se reconstruye recorriendo la región entera —barato
  // para el tamaño habitual de este recorte, pero no gratis—: se
  // agrupan los repintados a uno por fotograma en vez de uno por cada
  // `pointermove`, que en un arrastre largo puede disparar docenas.
  let queued = false;
  const scheduleRedraw = () => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; redraw(); });
  };

  canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    painting = true; erase = e.altKey || e.button === 2;
    try{ canvas.setPointerCapture(e.pointerId); }catch{ /* sin puntero activo que capturar: se sigue pintando igual */ }
    const { x, y } = toCanvasXY(e);
    paintAt(x, y, Math.max(6, region.w * 0.04));
    scheduleRedraw();
  });
  canvas.addEventListener("pointermove", e => {
    if(!painting) return;
    const { x, y } = toCanvasXY(e);
    paintAt(x, y, Math.max(6, region.w * 0.04));
    scheduleRedraw();
  });
  canvas.addEventListener("pointerup", () => { painting = false; });
  canvas.addEventListener("pointerleave", () => { painting = false; });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  return { el: canvas, sampleMask, reset(){
    for(let i = 0; i < sampleMask.length; i++) sampleMask[i] = holeMaskCrop[i] > 0 ? 0 : 255;
    redraw();
  } };
}

export async function runContentAwareFill(){
  if(!doc.selection){ toast("Necesitas una selección primero"); return; }
  const layer = activeLayer();
  if(!layer){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }

  const bounds = boundsOfSel(doc.selection.mask, doc.w, doc.h);
  if(!bounds){ toast("La selección está vacía"); return; }

  const region = workRegion(bounds, doc.w, doc.h);
  const fullImg = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const previewSrc = new ImageData(cropRGBA(fullImg, doc.w, region), region.w, region.h);
  const holeMaskCrop = cropMask(doc.selection.mask, doc.w, region);

  const p = { allowRotation: false, allowScale: false };
  const editor = mountSampleAreaEditor({ ...region, previewSrc }, holeMaskCrop);

  const body = document.createElement("div");
  body.innerHTML = `
    <p class="hint" style="margin-bottom:8px">En verde, de dónde se puede tomar la
      muestra —arrastra para quitar zonas (un objeto que no quieras ver clonado) y
      Alt+arrastre o clic derecho para volver a añadirlas—. En rojo, lo que se va a
      rellenar.</p>`;
  body.appendChild(editor.el);

  let engine = "patchmatch";
  try{ if(localStorage.getItem(FILL_ENGINE_KEY) === "lama") engine = "lama"; }catch{}
  const lamaNote = await (await import("../ai/runtime.js")).sizeNote("lama");
  const engineRow = document.createElement("div");
  engineRow.innerHTML = `
    <div class="field" style="margin-top:10px"><label for="cafEngine">Motor</label>
      <select id="cafEngine" class="grow">
        <option value="patchmatch">PatchMatch · copia textura de la foto</option>
        <option value="lama">IA · LaMa (${lamaNote})</option>
      </select></div>
    <p class="hint" id="cafLamaHint">LaMa reconstruye la zona a partir de toda la escena: estructuras, bordes y perspectiva. La zona de muestra en verde sólo se usa con PatchMatch.</p>`;
  body.appendChild(engineRow);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:14px;margin-top:10px;flex-wrap:wrap";
  row.innerHTML = `
    <label class="field" style="display:flex;align-items:center;gap:6px;width:auto">
      <input type="checkbox" id="cafRot"><span>Adaptar rotación</span></label>
    <label class="field" style="display:flex;align-items:center;gap:6px;width:auto">
      <input type="checkbox" id="cafScale"><span>Adaptar escala</span></label>
    <button id="cafReset" type="button">Restablecer área</button>`;
  body.appendChild(row);
  row.querySelector("#cafRot").addEventListener("change", e => { p.allowRotation = e.target.checked; });
  row.querySelector("#cafScale").addEventListener("change", e => { p.allowScale = e.target.checked; });
  row.querySelector("#cafReset").addEventListener("click", () => editor.reset());

  const engineSel = engineRow.querySelector("#cafEngine");
  const syncEngine = () => {
    engine = engineSel.value;
    engineRow.querySelector("#cafLamaHint").hidden = engine !== "lama";
    row.querySelector("#cafRot").parentElement.hidden = engine === "lama";
    row.querySelector("#cafScale").parentElement.hidden = engine === "lama";
  };
  engineSel.value = engine;
  engineSel.addEventListener("change", syncEngine);
  syncEngine();

  const res = await dialog({
    title: "Rellenar según el contenido", body, wide: true,
    buttons: [{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }]
  });
  if(res !== "go") return;
  try{ localStorage.setItem(FILL_ENGINE_KEY, engine); }catch{}
  if(engine === "lama"){ await applyLamaFill(layer, doc.selection.mask, bounds); return; }
  applyContentAwareFill(layer, doc.selection.mask, bounds, {
    allowRotation: p.allowRotation, allowScale: p.allowScale, sampleRegionMask: editor.sampleMask
  });
}

function applyContentAwareFill(layer, selMask, bounds, opts){
  status("Rellenando…");
  const before = document.createElement("canvas");
  before.width = layer.canvas.width; before.height = layer.canvas.height;
  before.getContext("2d").drawImage(layer.canvas, 0, 0);

  const img = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const ok = fillContentAwarePatchMatch(img, selMask, layer.canvas.width, layer.canvas.height, bounds, opts);
  status("");
  if(!ok){ toast("No se encontró un origen parecido para rellenar", "err"); return; }

  layer.ctx.putImageData(img, 0, 0);
  layer.thumbDirty = true;

  const after = document.createElement("canvas");
  after.width = layer.canvas.width; after.height = layer.canvas.height;
  after.getContext("2d").drawImage(layer.canvas, 0, 0);

  const restore = snap => {
    layer.ctx.save(); layer.ctx.globalCompositeOperation = "copy";
    layer.ctx.drawImage(snap, 0, 0); layer.ctx.restore();
    layer.thumbDirty = true; emit("doc:change");
  };
  record("Rellenar según el contenido", () => restore(before), () => restore(after));
  emit("doc:structure"); emit("doc:change");
  toast("Rellenado", "ok");
}

/* ── Relleno con LaMa ─────────────────────────────────────────────
   LaMa (modelo de ImageToolbox, ver js/ai/models.js) trabaja SIEMPRE a
   512×512. En vez de reducir la foto entera —como hace ImageToolbox—,
   se recorta un cuadrado alrededor del agujero con contexto de sobra
   (el agujero ocupa ~40 % del lado), así el modelo ve la escena a la
   mayor resolución posible. El resultado vuelve a su tamaño y sólo se
   copia DENTRO de la selección, con una costura suavizada: fuera de
   ella la capa queda intacta, píxel a píxel. */
function lamaRegion(bounds, w, h){
  let side = Math.round(Math.max(bounds.w, bounds.h) * 2.5);
  side = Math.max(side, Math.min(512, Math.max(w, h)));
  const sw = Math.min(side, w), sh = Math.min(side, h);
  const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
  const x = Math.max(0, Math.min(w - sw, Math.round(cx - sw / 2)));
  const y = Math.max(0, Math.min(h - sh, Math.round(cy - sh / 2)));
  return { x, y, w: sw, h: sh };
}

async function applyLamaFill(layer, selMask, bounds){
  const W = layer.canvas.width, H = layer.canvas.height, N = 512;
  const region = lamaRegion(bounds, W, H);
  const scale = Math.max(region.w, region.h) / N;

  // Imagen del recorte a 512×512.
  const inC = document.createElement("canvas"); inC.width = inC.height = N;
  const ix = inC.getContext("2d", { willReadFrequently: true });
  ix.imageSmoothingQuality = "high";
  ix.drawImage(layer.canvas, region.x, region.y, region.w, region.h, 0, 0, N, N);
  const rgba = ix.getImageData(0, 0, N, N).data;

  // Máscara del recorte a 512×512, algo DILATADA: LaMa rellena mejor
  // si el agujero cubre también el halo del objeto que se quita.
  const holeCrop = cropMask(selMask, W, region);
  const grown = featherMask(holeCrop, region.w, region.h, Math.max(2, Math.round(3 * scale)));
  const mC = document.createElement("canvas"); mC.width = region.w; mC.height = region.h;
  const mImg = new ImageData(region.w, region.h);
  for(let i = 0; i < grown.length; i++){
    const v = grown[i] > 8 ? 255 : 0;
    mImg.data[i*4] = mImg.data[i*4+1] = mImg.data[i*4+2] = v; mImg.data[i*4+3] = 255;
  }
  mC.getContext("2d").putImageData(mImg, 0, 0);
  const smC = document.createElement("canvas"); smC.width = smC.height = N;
  const smx = smC.getContext("2d", { willReadFrequently: true });
  smx.drawImage(mC, 0, 0, N, N);
  const md = smx.getImageData(0, 0, N, N).data, hole = new Uint8Array(N * N);
  for(let i = 0; i < hole.length; i++) hole[i] = md[i*4] > 0 ? 1 : 0;

  let res;
  try{
    const { runModel } = await import("../ai/runtime.js");
    res = await runModel("inpaint", "lama", { rgba, hole, size: N }, [rgba.buffer, hole.buffer]);
  }catch(err){ toast("No se pudo rellenar con LaMa: " + err.message, "err"); return; }

  // Resultado de vuelta al tamaño del recorte.
  const outC = document.createElement("canvas"); outC.width = outC.height = N;
  outC.getContext("2d").putImageData(new ImageData(res.rgba, N, N), 0, 0);
  const upC = document.createElement("canvas"); upC.width = region.w; upC.height = region.h;
  const ux = upC.getContext("2d", { willReadFrequently: true });
  ux.imageSmoothingQuality = "high";
  ux.drawImage(outC, 0, 0, region.w, region.h);
  const fill = ux.getImageData(0, 0, region.w, region.h).data;

  // Mezcla: 100 % dentro de la selección original, y una rampa corta
  // hacia fuera (dentro de la zona que LaMa ya rellenó al dilatar).
  const alpha = featherMask(holeCrop, region.w, region.h, Math.max(1, Math.round(1.5 * scale)));

  const before = document.createElement("canvas");
  before.width = W; before.height = H;
  before.getContext("2d").drawImage(layer.canvas, 0, 0);

  const img = layer.ctx.getImageData(region.x, region.y, region.w, region.h), d = img.data;
  for(let p = 0; p < alpha.length; p++){
    const a = Math.max(alpha[p], holeCrop[p]) / 255;
    if(a <= 0) continue;
    const i = p * 4;
    d[i]     = d[i]     + (fill[i]     - d[i])     * a;
    d[i + 1] = d[i + 1] + (fill[i + 1] - d[i + 1]) * a;
    d[i + 2] = d[i + 2] + (fill[i + 2] - d[i + 2]) * a;
    // El hueco queda opaco aunque la capa tuviera transparencia ahí.
    d[i + 3] = d[i + 3] + (255 - d[i + 3]) * a;
  }
  layer.ctx.putImageData(img, region.x, region.y);
  layer.thumbDirty = true;

  const after = document.createElement("canvas");
  after.width = W; after.height = H;
  after.getContext("2d").drawImage(layer.canvas, 0, 0);
  const restore = snap => {
    layer.ctx.save(); layer.ctx.globalCompositeOperation = "copy";
    layer.ctx.drawImage(snap, 0, 0); layer.ctx.restore();
    layer.thumbDirty = true; emit("doc:change");
  };
  record("Rellenar según el contenido", () => restore(before), () => restore(after));
  emit("doc:structure"); emit("doc:change");
  toast("Rellenado con IA (LaMa)", "ok");
}
