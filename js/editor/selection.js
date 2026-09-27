/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN
   Una selección es una máscara de un byte por píxel del tamaño del
   documento: 0 = fuera, 255 = dentro, cualquier valor intermedio es
   un borde difuminado. `doc.selection === null` significa «todo
   seleccionado», que es el caso normal y el único que no cuesta
   memoria ni tiempo de proceso.

   Rectángulo, elipse y lazo se rasterizan a mano, en JavaScript puro,
   en vez de apoyarse en `ctx.fill()` de un lienzo oculto. La razón no
   es sólo de gusto: así la máscara es una función matemática que se
   puede probar con números —¿el área pintada es la que toca?, ¿el
   borde decae donde debe?— sin depender de cómo rasterice curvas el
   motor del navegador de turno, que varía y que en Node ni siquiera
   existe para poder comprobarlo.
   ═══════════════════════════════════════════════════════════════ */

export function newMask(w, h){
  return new Uint8ClampedArray(w * h);
}

/* Rectángulo con cobertura exacta en el borde: cada píxel vale la
   fracción de su propio cuadrado que cae dentro del rectángulo real
   (en coordenadas continuas, no enteras), así que un rectángulo que
   termine a medio píxel sale con un borde suavizado matemáticamente
   correcto y no dentado. */
export function maskFromRect(w, h, x, y, rw, rh){
  const mask = newMask(w, h);
  if(rw <= 0 || rh <= 0) return mask;
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(w, Math.ceil(x + rw)), y1 = Math.min(h, Math.ceil(y + rh));
  for(let py = y0; py < y1; py++){
    const cy = Math.max(0, Math.min(py + 1, y + rh) - Math.max(py, y));
    if(cy <= 0) continue;
    for(let px = x0; px < x1; px++){
      const cx = Math.max(0, Math.min(px + 1, x + rw) - Math.max(px, x));
      if(cx <= 0) continue;
      mask[py * w + px] = Math.round(cx * cy * 255);
    }
  }
  return mask;
}

/* Elipse con antialiasing por supermuestreo 2×2: cuatro puntos por
   píxel, cada uno dentro o fuera según la ecuación normalizada de la
   elipse, promediados. Con eso el borde tiene cinco niveles posibles
   (0, 64, 128, 191, 255) en vez de un salto brusco de 0 a 255, que es
   lo que se nota como dentado en un contorno curvo. Sólo se recorre
   la caja de la elipse, con un margen de un píxel. */
export function maskFromEllipse(w, h, cx, cy, rx, ry){
  const mask = newMask(w, h);
  rx = Math.max(0.5, rx); ry = Math.max(0.5, ry);
  const x0 = Math.max(0, Math.floor(cx - rx - 1)), y0 = Math.max(0, Math.floor(cy - ry - 1));
  const x1 = Math.min(w, Math.ceil(cx + rx + 1)), y1 = Math.min(h, Math.ceil(cy + ry + 1));
  const offs = [0.25, 0.75];
  for(let py = y0; py < y1; py++){
    for(let px = x0; px < x1; px++){
      let hits = 0;
      for(const oy of offs){
        const ny = (py + oy - cy) / ry;
        const ny2 = ny * ny;
        for(const ox of offs){
          const nx = (px + ox - cx) / rx;
          if(nx*nx + ny2 <= 1) hits++;
        }
      }
      if(hits) mask[py * w + px] = Math.round(hits / 4 * 255);
    }
  }
  return mask;
}

/* Lazo: contorno por puntos de clic, relleno por el criterio clásico
   de paridad (even-odd) evaluado en el centro de cada píxel de la
   caja del polígono. Sin antialiasing —cada píxel es 0 ó 255—: un
   trazo a mano alzada ya tiene un contorno irregular de por sí, y
   quien quiera un borde suave tiene el difuminado aparte. Simplifica
   la prueba de que el relleno es correcto sin perder nada útil. */
export function maskFromPolygon(w, h, points){
  const mask = newMask(w, h);
  if(!points || points.length < 3) return mask;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(const p of points){
    if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x;
    if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y;
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(w, Math.ceil(x1));  y1 = Math.min(h, Math.ceil(y1));
  if(x1 <= x0 || y1 <= y0) return mask;

  const n = points.length;
  for(let py = y0; py < y1; py++){
    const cy = py + 0.5;
    for(let px = x0; px < x1; px++){
      const cx = px + 0.5;
      let inside = false;
      for(let i = 0, j = n - 1; i < n; j = i++){
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        if(((yi > cy) !== (yj > cy)) &&
           (cx < (xj - xi) * (cy - yi) / (yj - yi) + xi)){
          inside = !inside;
        }
      }
      if(inside) mask[py * w + px] = 255;
    }
  }
  return mask;
}

/* ── varita mágica ────────────────────────────────────────────
   Mismo recorrido por líneas de barrido que `floodFill` en paint.js,
   pero en vez de teñir píxeles produce una máscara: no se puede
   reutilizar la función tal cual porque esa muta el color, y aquí no
   se toca ni un píxel de la imagen. */
export function maskFromWand(imgData, x0, y0, tolerance, contiguous){
  const { data, width: w, height: h } = imgData;
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const mask = newMask(w, h);
  if(x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return mask;

  const at = (x, y) => (y * w + x) * 4;
  const start = at(x0, y0);
  const sr = data[start], sg = data[start+1], sb = data[start+2], sa = data[start+3];
  const tol = tolerance * tolerance * 4;

  const match = i => {
    const dr = data[i] - sr, dg = data[i+1] - sg;
    const db = data[i+2] - sb, da = data[i+3] - sa;
    return dr*dr + dg*dg + db*db + da*da <= tol;
  };

  if(!contiguous){
    for(let i = 0, p = 0; i < data.length; i += 4, p++) if(match(i)) mask[p] = 255;
    return mask;
  }

  const seen = new Uint8Array(w * h);
  const stack = [[x0, y0]];
  while(stack.length){
    const [sx, sy] = stack.pop();
    let x = sx;
    while(x > 0 && !seen[sy*w + x - 1] && match(at(x - 1, sy))) x--;
    let up = false, down = false;
    for(; x < w; x++){
      const p = sy*w + x;
      if(seen[p] || !match(at(x, sy))) break;
      seen[p] = 1;
      mask[p] = 255;
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
  return mask;
}

/* ── combinar con lo que ya hubiera seleccionado ────────────────
   Cuatro modos, los mismos cuatro gestos de cualquier editor: nuevo
   trazo reemplaza, Mayús suma, Alt resta, Mayús+Alt se queda sólo con
   el solape.

   OJO con el `null` de aquí: es el «todavía no se ha dibujado nada en
   este gesto», el de la herramienta activa. Es un `null` distinto del
   de `doc.selection`, que significa «todo el documento vale» — si se
   confunden los dos, sumar a partir de cero sale «todo el documento»
   en vez de «lo que se acaba de trazar», que es justo lo contrario de
   lo que espera cualquiera que sujete Mayús sin haber seleccionado
   nada antes. Sin selección previa, sumar y restar se comportan como
   un trazo nuevo —no hay nada a lo que sumar o de lo que restar—, e
   intersecar con nada da un vacío, porque cruzar «nada» con cualquier
   otra cosa sigue siendo nada. */
export function combineMask(existing, incoming, w, h, mode){
  if(mode === "new" || !existing) {
    if(mode === "intersect") return newMask(w, h);
    return incoming;
  }
  const out = newMask(w, h);
  for(let i = 0; i < out.length; i++){
    const a = existing[i], b = incoming[i];
    out[i] = mode === "add" ? Math.max(a, b)
           : mode === "subtract" ? Math.max(0, a - b)
           : /* intersect */ Math.min(a, b);
  }
  return out;
}

export function fullMask(w, h){
  const m = newMask(w, h);
  m.fill(255);
  return m;
}

export function invertMask(mask){
  const out = new Uint8ClampedArray(mask.length);
  for(let i = 0; i < mask.length; i++) out[i] = 255 - mask[i];
  return out;
}

/* Caja estrecha alrededor de lo distinto de cero: recorrer sólo esa
   región es la diferencia entre difuminar una selección pequeña en
   milisegundos o en un suspiro entero sobre el documento completo. */
export function boundsOf(mask, w, h){
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w; x++){
      if(mask[row + x] > 0){
        if(x < x0) x0 = x; if(x > x1) x1 = x;
        if(y < y0) y0 = y; if(y > y1) y1 = y;
      }
    }
  }
  if(x1 < x0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* ── difuminado del borde ─────────────────────────────────────
   Un desenfoque de caja repetido tres veces converge muy cerca de un
   gaussiano de verdad (es la aproximación clásica de «fast almost
   gaussian blur») y es muchísimo más barato que convolucionar con un
   núcleo real. Sólo se recorre el rectángulo de la selección con un
   margen del radio del difuminado alrededor: fuera de ahí el
   resultado no puede cambiar. */
export function featherMask(mask, w, h, radius){
  radius = Math.round(radius);
  if(radius <= 0) return mask;
  const b = boundsOf(mask, w, h);
  if(!b) return mask;

  const pad = radius * 2 + 2;
  const x0 = Math.max(0, b.x - pad), y0 = Math.max(0, b.y - pad);
  const x1 = Math.min(w, b.x + b.w + pad), y1 = Math.min(h, b.y + b.h + pad);
  const rw = x1 - x0, rh = y1 - y0;
  if(rw <= 0 || rh <= 0) return mask;

  let buf = new Float32Array(rw * rh);
  for(let y = 0; y < rh; y++)
    for(let x = 0; x < rw; x++)
      buf[y*rw + x] = mask[(y + y0) * w + (x + x0)];

  const passRadius = Math.max(1, Math.round(radius * 0.6));
  for(let pass = 0; pass < 3; pass++) buf = boxBlur(buf, rw, rh, passRadius);

  const out = newMask(w, h);
  out.set(mask);
  for(let y = 0; y < rh; y++)
    for(let x = 0; x < rw; x++)
      out[(y + y0) * w + (x + x0)] = Math.max(0, Math.min(255, Math.round(buf[y*rw + x])));
  return out;
}

function boxBlur(src, w, h, r){
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (r * 2 + 1);
  // horizontal
  for(let y = 0; y < h; y++){
    const row = y * w;
    let acc = 0;
    for(let x = -r; x <= r; x++) acc += src[row + clampI(x, w)];
    for(let x = 0; x < w; x++){
      tmp[row + x] = acc * norm;
      acc += src[row + clampI(x + r + 1, w)] - src[row + clampI(x - r, w)];
    }
  }
  // vertical
  for(let x = 0; x < w; x++){
    let acc = 0;
    for(let y = -r; y <= r; y++) acc += tmp[clampI(y, h) * w + x];
    for(let y = 0; y < h; y++){
      out[y*w + x] = acc * norm;
      acc += tmp[clampI(y + r + 1, h) * w + x] - tmp[clampI(y - r, h) * w + x];
    }
  }
  return out;
}
const clampI = (v, n) => v < 0 ? 0 : v >= n ? n - 1 : v;

export const isEmptyMask = mask => {
  for(let i = 0; i < mask.length; i++) if(mask[i] > 0) return false;
  return true;
};

/* ── aplicar una selección a un cambio ya calculado ─────────────
   El patrón en todo el editor es: calcular el resultado completo
   sobre una copia y luego, si hay selección, mezclarlo de vuelta con
   el original según la máscara. Un único punto de integración aquí
   evita tocar cada ajuste y cada filtro uno por uno. */
export function blendBySelection(computed, original, selection, w, h){
  if(!selection) return;                 // sin selección, el cambio ya vale entero
  const mask = selection.mask, mw = selection.w, mh = selection.h;
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      // Muestreo al vecino más cercano si la vista previa trabaja a
      // una resolución distinta de la de la máscara (que siempre está
      // a resolución completa del documento).
      const mx = mw === w ? x : Math.min(mw - 1, (x * mw / w) | 0);
      const my = mh === h ? y : Math.min(mh - 1, (y * mh / h) | 0);
      const f = mask[my * mw + mx];
      if(f === 255) continue;
      const i = (y * w + x) * 4;
      if(f === 0){
        computed[i] = original[i]; computed[i+1] = original[i+1];
        computed[i+2] = original[i+2]; computed[i+3] = original[i+3];
        continue;
      }
      const t = f / 255, u = 1 - t;
      computed[i]   = original[i]   * u + computed[i]   * t;
      computed[i+1] = original[i+1] * u + computed[i+1] * t;
      computed[i+2] = original[i+2] * u + computed[i+2] * t;
      computed[i+3] = original[i+3] * u + computed[i+3] * t;
    }
  }
}


/* ═══════════════════════════════════════════════════════════════
   INTEGRACIÓN CON EL DOCUMENTO
   Todo lo de arriba es matemática pura sobre arrays; esto es lo que
   conecta esa matemática con `doc.selection` y con el historial.
   ═══════════════════════════════════════════════════════════════ */
import { doc } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";

/* Guarda una máscara nueva como resultado de combinar con la que
   hubiera. Un clic sin arrastre y sin modificador —el gesto de
   «deseleccionar» de cualquier editor— vuelve a `null` (todo vale).
   Cualquier otro resultado, aunque acabe vacío del todo —por ejemplo
   Seleccionar todo y luego Invertir—, se guarda tal cual: un vacío
   producido a propósito por el usuario restringe de verdad a «nada»,
   que es justo lo contrario de `null`, que restringe a «todo». Que
   una tecla mande a un sitio y la otra al opuesto es la diferencia
   entre que deshacer funcione como se espera o no. */
export function commitSelection(incoming, mode){
  const w = doc.w, h = doc.h;
  const existing = doc.selection ? doc.selection.mask : null;

  if(mode === "new" && isEmptyMask(incoming)){
    setSelection(null);
    return;
  }
  const combined = combineMask(existing, incoming, w, h, mode);
  setSelection({ mask: combined, w, h });
}

/* Misma selección, sin importar que sean objetos distintos: dos
   Ctrl+A seguidos o un Deseleccionar sin nada seleccionado no deben
   dejar un paso de historial que no cambia nada. */
function sameSelection(a, b){
  if(a === b) return true;
  if(!a || !b || a.w !== b.w || a.h !== b.h) return false;
  const x = a.mask, y = b.mask;
  if(x.length !== y.length) return false;
  for(let i = 0; i < x.length; i++) if(x[i] !== y[i]) return false;
  return true;
}

function setSelection(sel){
  const before = doc.selection;
  const after = sel;
  if(sameSelection(before, after)) return;
  doc.selection = after;
  record("Selección",
    () => { doc.selection = before; emit("doc:change"); emit("sel:change"); },
    () => { doc.selection = after;  emit("doc:change"); emit("sel:change"); });
  emit("doc:change");
  emit("sel:change");
}

/* Una máscara llena de verdad, no `null`: `null` significa «no hay
   selección» —la que deja Deseleccionar— y con él Borrar selección,
   Difuminar o el contorno en pantalla no tenían nada sobre lo que
   actuar después de Ctrl+A. */
export function selectAll(){
  if(!doc.open) return;
  setSelection({ mask: fullMask(doc.w, doc.h), w: doc.w, h: doc.h });
}
export function selectNone(){ setSelection(null); }

export function invertSelection(){
  if(!doc.open) return;
  const base = doc.selection ? doc.selection.mask : fullMask(doc.w, doc.h);
  setSelection({ mask: invertMask(base), w: doc.w, h: doc.h });
}

export function featherSelection(radius){
  if(!doc.selection) return;   // difuminar «todo» no tiene sentido
  const soft = featherMask(doc.selection.mask, doc.w, doc.h, radius);
  setSelection({ mask: soft, w: doc.w, h: doc.h });
}

export const hasSelection = () => !!doc.selection;
