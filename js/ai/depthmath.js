/* ═══════════════════════════════════════════════════════════════
   MATEMÁTICA DE LAS HERRAMIENTAS DE PROFUNDIDAD (fase 5)
   Selección por zonas, luz por distancia y separación en planos.
   Sin DOM: lo usan las herramientas y las pruebas en Node.

   Convención: `d` es la profundidad del mapa (1 = lo más cercano,
   0 = lo más lejano) y `u = 1 − d` la DISTANCIA (0 = lo más cercano,
   1 = lo más lejano), que es lo que ve quien maneja los mandos.
   ═══════════════════════════════════════════════════════════════ */

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth01 = t => { t = clamp01(t); return t * t * (3 - 2 * t); };

/** Pertenencia (0-1) de una distancia `u` a la zona [a, b]. `soft` es la
    mitad del ancho de la transición (en unidades de distancia): 0 = corte
    seco. Los extremos del mapa (0 y 1) no se difuminan hacia fuera. */
export function zoneAlpha(u, a, b, soft){
  if(soft <= 1e-6) return u >= a && u <= b ? 1 : 0;
  const lo = a <= 0 ? 1 : smooth01((u - (a - soft)) / (2 * soft));
  const hi = b >= 1 ? 1 : 1 - smooth01((u - (b - soft)) / (2 * soft));
  return lo * hi;
}

/** Distancias que reparten la escena en `n` partes con la misma cantidad
    de píxeles (percentiles de `u`). Devuelve n − 1 límites crecientes. */
export function quantileBounds(d, n){
  const BINS = 1024, hist = new Float64Array(BINS);
  for(let i = 0; i < d.length; i++){ const u = 1 - clamp01(d[i]); hist[Math.min(BINS - 1, (u * BINS) | 0)]++; }
  const out = [], total = d.length;
  let acc = 0, k = 1;
  for(let b = 0; b < BINS && k < n; b++){
    acc += hist[b];
    while(k < n && acc >= total * k / n){ out.push((b + 1) / BINS); k++; }
  }
  while(out.length < n - 1) out.push(1);
  return out;
}

/** Zonas rápidas: [a, b] para primer plano, plano medio y fondo, con las
    distancias que dejan cada tercio de la imagen en una zona. */
export function presetZone(kind, d){
  const [t1, t2] = quantileBounds(d, 3);
  if(kind === "near") return [0, t1];
  if(kind === "mid") return [t1, t2];
  if(kind === "far") return [t2, 1];
  return null;
}

/** Cantidad de luz (en pasos EV) para una distancia: `evNear` hasta el
    punto de giro `pivot`, `evFar` más allá, con una transición suave de
    anchura `width`. */
export function lightEv(u, pivot, evNear, evFar, width){
  const t = smooth01((u - pivot) / Math.max(0.04, width) + 0.5);
  return evNear + (evFar - evNear) * t;
}

/** Aplica ganancia lineal `k` a un píxel en luz lineal con hombro suave:
    nunca recorta de golpe las luces (conserva el tono) y con k = 1 no toca
    nada. `rgb` es [r, g, b] en 0-1 lineal; se modifica en su sitio. */
export function gainWithShoulder(rgb, k){
  if(k === 1) return rgb;
  const mx = Math.max(rgb[0], rgb[1], rgb[2]);
  if(mx <= 1e-6) return rgb;
  let out;
  if(k < 1) out = mx * k;
  else{
    const v = mx * k, knee = Math.max(0.85, mx);
    out = v <= knee ? v : knee + (1 - knee) * Math.tanh((v - knee) / Math.max(1e-6, 1 - knee));
  }
  const f = out / mx;
  rgb[0] *= f; rgb[1] *= f; rgb[2] *= f;
  return rgb;
}

/** Pesos de `bounds.length + 1` planos para la distancia `u`, que suman 1
    en cada punto (transiciones suaves de mitad de ancho `soft`).
    Plano 0 = el más cercano. */
export function planeWeights(u, bounds, soft, out){
  const n = bounds.length + 1, w = out || new Float32Array(n);
  let prev = 1;                                   // «hasta aquí no se ha dejado atrás»
  for(let i = 0; i < n; i++){
    const next = i < bounds.length
      ? (soft <= 1e-6 ? (u > bounds[i] ? 1 : 0) : smooth01((u - (bounds[i] - soft)) / (2 * soft)))
      : 0;
    // `next`: cuánto de `u` ya pertenece a planos más lejanos que el i
    w[i] = prev - next;
    prev = next;
  }
  return w;
}
