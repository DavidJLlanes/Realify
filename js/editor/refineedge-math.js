/* ═══════════════════════════════════════════════════════════════
   REFINAR BORDE · MOTOR
   Sólo matemática pura sobre `Float32Array`/`Uint8ClampedArray`, sin
   nada de canvas ni DOM: así se puede probar con números de verdad,
   en Node, sin un navegador de por medio —crítico aquí porque es la
   pieza más fácil de estropear sutilmente de toda la función (una
   ventana deslizante mal cerrada, un filtro guiado con el eps al
   revés…) y la más cara de depurar sólo mirando el resultado en
   pantalla—. El diálogo y su vista previa viven en refineedge.js.

   La pieza central es un «filtro guiado»: en vez de difuminar el
   canal alfa a ciegas —que sólo emborrona el borde sin recuperar
   nada—, se usa el propio COLOR de la foto como guía, así que el
   alfa se «engancha» a las transiciones de color reales. Donde hay un
   mechón de pelo suelto sobre un fondo distinto, ahí hay un borde de
   color; el filtro lo encuentra y deja el alfa seguirlo, mechón a
   mechón, en vez de una curva suave que se lo come.

   Técnica: «Guided Image Filtering» (He, Sun, Tang, 2010), el mismo
   principio detrás del «Refinar borde» de cualquier editor serio.
   ═══════════════════════════════════════════════════════════════ */

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

/* ── desenfoque de caja, ventana deslizante ──────────────────────
   Separable en dos pasadas (horizontal, vertical), cada una O(w·h)
   con independencia del radio: se mantiene una suma corriente que
   sólo suma el píxel que entra por un lado y resta el que sale por
   el otro, en vez de recorrer la ventana entera en cada posición. Los
   bordes se extienden —el mismo criterio que el resto de la app usa
   para el desenfoque de verdad (ver filters/basic.js)—, así que un
   sujeto pegado al borde del lienzo no se oscurece por «ver» vacío
   fuera de la imagen. */
export function boxBlurFloat(src, w, h, radius){
  if(radius <= 0) return Float32Array.from(src);
  const win = radius * 2 + 1;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  for(let y = 0; y < h; y++){
    const row = y * w;
    let sum = 0;
    for(let k = -radius; k <= radius; k++) sum += src[row + Math.min(w - 1, Math.max(0, k))];
    tmp[row] = sum / win;
    for(let x = 1; x < w; x++){
      sum += src[row + Math.min(w - 1, x + radius)] - src[row + Math.max(0, x - radius - 1)];
      tmp[row + x] = sum / win;
    }
  }
  for(let x = 0; x < w; x++){
    let sum = 0;
    for(let k = -radius; k <= radius; k++) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    out[x] = sum / win;
    for(let y = 1; y < h; y++){
      sum += tmp[Math.min(h - 1, y + radius) * w + x] - tmp[Math.max(0, y - radius - 1) * w + x];
      out[y * w + x] = sum / win;
    }
  }
  return out;
}

/* ── máximo/mínimo en ventana deslizante ──────────────────────────
   Lo que hace falta para «expandir»/«contraer» la máscara de verdad
   —dilatar u erosionar por un radio, no sólo subir o bajar el valor
   del alfa—, con la misma cota O(w·h) independiente del radio que el
   desenfoque de arriba, vía una cola monótona: al entrar un valor se
   descartan por el fondo de la cola todos los que ya no pueden ganar
   (son menores, si se busca el máximo), así que la cola se queda
   siempre ordenada y el máximo vigente está en cabeza sin recorrer la
   ventana entera. */
function slidingExtreme1D(src, w, h, radius, horizontal, useMax){
  const better = useMax ? (a, b) => a > b : (a, b) => a < b;
  const out = new Float32Array(w * h);
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const idx = (line, i) => horizontal ? line * w + i : i * w + line;
  const clampIdx = i => i < 0 ? 0 : i >= len ? len - 1 : i;

  const deque = new Int32Array(len + 2 * radius);   // POSICIONES reales (pueden ser < 0 o >= len)
  const vals = new Float32Array(len + 2 * radius);

  for(let line = 0; line < lines; line++){
    let head = 0, tail = 0;   // [head, tail) — vacío si head===tail
    // Posiciones reales de -radius a len-1+radius: el valor leído
    // siempre viene del índice recortado a [0, len-1] —«extender el
    // borde», el mismo criterio que `boxBlurFloat`—, pero la posición
    // que se guarda en la cola es la real, sin recortar, porque es la
    // que decide cuándo expira.
    for(let pos = -radius; pos < len + radius; pos++){
      const v = src[idx(line, clampIdx(pos))];
      while(tail > head && better(v, vals[tail - 1])) tail--;
      deque[tail] = pos; vals[tail] = v; tail++;

      const outI = pos - radius;
      if(outI >= 0 && outI < len){
        while(deque[head] < outI - radius) head++;
        out[idx(line, outI)] = vals[head];
      }
    }
  }
  return out;
}

/** Dilata (useMax=true) o erosiona (useMax=false) un canal por un
    radio dado —dos pasadas 1D, horizontal y vertical, cada una un
    máximo/mínimo real de ventana cuadrada—. */
export function morph(src, w, h, radius, useMax){
  if(radius <= 0) return Float32Array.from(src);
  const h1 = slidingExtreme1D(src, w, h, radius, true, useMax);
  return slidingExtreme1D(h1, w, h, radius, false, useMax);
}

/* ── filtro guiado ────────────────────────────────────────────────
   `I` es la imagen guía (luminancia 0-1), `p` el alfa de entrada
   (0-1). La salida sigue el alfa de `p` en las zonas lisas de color
   pero se PEGA a las fronteras de `I` donde las hay —el efecto que
   hace falta para que un mechón suelto conserve su forma en vez de
   quedar emborronado con el fondo—. `eps` es la única perilla del
   propio filtro: cuanto más pequeño, más fielmente sigue cualquier
   variación de color, por pequeña que sea (más «mordida», también más
   ruido); cuanto más grande, más se comporta como un desenfoque liso
   de `p` sin mirar apenas el color. */
export function guidedFilterAlpha(I, p, w, h, radius, eps){
  const n = w * h;
  const meanI = boxBlurFloat(I, w, h, radius);
  const meanP = boxBlurFloat(p, w, h, radius);
  const Ip = new Float32Array(n), II = new Float32Array(n);
  for(let i = 0; i < n; i++){ Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
  const meanIp = boxBlurFloat(Ip, w, h, radius);
  const meanII = boxBlurFloat(II, w, h, radius);

  const a = new Float32Array(n), b = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const varI = meanII[i] - meanI[i] * meanI[i];
    const covIp = meanIp[i] - meanI[i] * meanP[i];
    const ai = covIp / (varI + eps);
    a[i] = ai;
    b[i] = meanP[i] - ai * meanI[i];
  }
  const meanA = boxBlurFloat(a, w, h, radius);
  const meanB = boxBlurFloat(b, w, h, radius);

  const q = new Float32Array(n);
  for(let i = 0; i < n; i++) q[i] = clamp01(meanA[i] * I[i] + meanB[i]);
  return q;
}

/* Curva en S centrada en 0,5: sube el «Contraste» endurece la
   transición —los grises intermedios se reparten hacia los extremos—
   sin tocar lo que ya era sólido (0 o 1 se quedan en 0 o 1). */
function applyContrastCurve(alpha, amount){
  if(!amount) return alpha;
  const k = amount / 100 * 6;   // 0..6, empírico: a 100 la curva ya satura casi del todo
  const out = new Float32Array(alpha.length);
  for(let i = 0; i < alpha.length; i++){
    const x = alpha[i] * 2 - 1;              // -1..1
    const y = Math.tanh(x * (1 + k)) / Math.tanh(1 + k);
    out[i] = clamp01((y + 1) / 2);
  }
  return out;
}

/** Desplaza el borde hacia fuera (shift > 0, «expandir») o hacia
    dentro (shift < 0, «contraer») de verdad —dilatación/erosión
    morfológica real, no un simple sumar al alfa—, mezclada
    proporcionalmente para que el mando sea continuo en vez de saltar
    a radios enteros. `shift` en -100..100. */
function shiftEdgeAlpha(alpha, w, h, shift){
  if(!shift) return alpha;
  const maxRadius = 20;   // en el tope del mando, hasta 20 px de verdad
  const mag = Math.abs(shift) / 100 * maxRadius;
  const r0 = Math.floor(mag), r1 = Math.ceil(mag);
  const t = mag - r0;
  const useMax = shift > 0;
  const lo = morph(alpha, w, h, r0, useMax);
  if(r1 === r0) return lo;
  const hi = morph(alpha, w, h, r1, useMax);
  const out = new Float32Array(alpha.length);
  for(let i = 0; i < out.length; i++) out[i] = lo[i] + (hi[i] - lo[i]) * t;
  return out;
}

/* ── color de frente/fondo LOCAL, y proyección ─────────────────────
   El filtro guiado (arriba) es excelente para AJUSTAR un borde que ya
   está aproximadamente donde debe —lo pega a la transición de color
   real—, pero no para ENCONTRAR detalle que la máscara de entrada no
   sabía que existía: un mechón de pelo de un par de píxeles de ancho,
   con alfa 0 en TODA su vecindad salvo el propio mechón, apenas mueve
   la covarianza de una ventana grande, y el filtro guiado lo deja casi
   como estaba. Para ESO hace falta la otra mitad de cualquier matting
   de verdad: estimar el color de frente y de fondo LOCALES —el
   promedio, ponderado por alfa y por (1-alfa), suavizado por radio— y
   proyectar el color observado de cada píxel sobre la recta que va de
   uno a otro. Un píxel cuyo color caiga a medio camino es medio
   mechón, medio fondo; uno que caiga en el propio frente es mechón
   entero, por fino que sea el trazo, porque aquí no hace falta que
   ocupe una fracción grande de ninguna ventana —le basta con que SU
   COLOR se parezca al del frente conocido—. */
function estimateLocalColors(rgbaU8, alpha0, w, h, radius){
  const n = w * h;
  const wB = new Float32Array(n);
  const rF = new Float32Array(n), gF = new Float32Array(n), bF = new Float32Array(n);
  const rB = new Float32Array(n), gB = new Float32Array(n), bB = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const a = alpha0[i], wb = 1 - a;
    wB[i] = wb;
    const q = i * 4;
    rF[i] = rgbaU8[q] * a;     gF[i] = rgbaU8[q+1] * a;     bF[i] = rgbaU8[q+2] * a;
    rB[i] = rgbaU8[q] * wb;    gB[i] = rgbaU8[q+1] * wb;    bB[i] = rgbaU8[q+2] * wb;
  }
  const bWF = boxBlurFloat(alpha0, w, h, radius), bWB = boxBlurFloat(wB, w, h, radius);
  const bRF = boxBlurFloat(rF, w, h, radius), bGF = boxBlurFloat(gF, w, h, radius), bBF = boxBlurFloat(bF, w, h, radius);
  const bRB = boxBlurFloat(rB, w, h, radius), bGB = boxBlurFloat(gB, w, h, radius), bBB = boxBlurFloat(bB, w, h, radius);

  const F = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
  const B = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
  for(let i = 0; i < n; i++){
    const df = Math.max(1e-3, bWF[i]), db = Math.max(1e-3, bWB[i]);
    F.r[i] = bRF[i] / df; F.g[i] = bGF[i] / df; F.b[i] = bBF[i] / df;
    B.r[i] = bRB[i] / db; B.g[i] = bGB[i] / db; B.b[i] = bBB[i] / db;
  }
  return { F, B };
}

/* Proyección del color observado sobre la recta frente↔fondo: la
   fracción de camino en la que cae es la estimación de alfa. Cuando
   frente y fondo locales están casi al mismo color —una zona sin
   contraste de color, donde esta técnica no tiene nada que decir—, se
   deja el punto medio para que sea el filtro guiado, después, quien
   decida a partir de la textura fina. */
function colorProjection(rgbaU8, F, B, w, h){
  const n = w * h;
  const t = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const dR = F.r[i] - B.r[i], dG = F.g[i] - B.g[i], dB = F.b[i] - B.b[i];
    const denom = dR * dR + dG * dG + dB * dB;
    if(denom < 4){ t[i] = 0.5; continue; }
    const q = i * 4;
    const cR = rgbaU8[q] - B.r[i], cG = rgbaU8[q+1] - B.g[i], cB = rgbaU8[q+2] - B.b[i];
    t[i] = clamp01((cR * dR + cG * dG + cB * dB) / denom);
  }
  return t;
}

/* ── el pipeline completo ─────────────────────────────────────────
   1. Se busca detalle dentro de la BANDA que marca el radio —los
      píxeles que tienen frente Y fondo de la máscara ORIGINAL a menos
      de `radius` de distancia—, con la proyección de color de arriba:
      esto es lo que de verdad «encuentra» un mechón que la máscara de
      entrada no sabía que existía, por fino que sea.
   2. El resultado de ese paso se pule con el filtro guiado, para que
      el borde recién encontrado se pegue a la transición de color
      exacta en vez de quedarse en el promedio de su ventana.
   3. Contraste: endurece la transición ya recuperada.
   4. Suavizar: un desenfoque final, pequeño, para limar el dentado
      que pueda haber quedado sin deshacer el detalle fino recuperado.
   5. Desplazar borde: expande o contrae de verdad.
   Devuelve el alfa resultante, 0-255. */
export function computeRefinedAlpha(alphaU8, rgbaU8, w, h, p){
  const n = w * h;
  const alpha0 = new Float32Array(n);
  for(let i = 0; i < n; i++) alpha0[i] = alphaU8[i] / 255;

  let alpha = alpha0;

  if(p.radius > 0){
    // Banda de búsqueda: cerca de frente Y cerca de fondo, los dos a
    // la vez —lejos de cualquier contorno sólo hay una de las dos
    // cosas, nunca ambas—, así que no hace falta un blur para
    // encontrarla, con dilatar de verdad basta.
    const isFg = new Float32Array(n), isBg = new Float32Array(n);
    for(let i = 0; i < n; i++){ isFg[i] = alpha0[i] > 0.5 ? 1 : 0; isBg[i] = 1 - isFg[i]; }
    const nearFg = morph(isFg, w, h, p.radius, true);
    const nearBg = morph(isBg, w, h, p.radius, true);

    const { F, B } = estimateLocalColors(rgbaU8, alpha0, w, h, Math.max(p.radius, 4));
    const proj = colorProjection(rgbaU8, F, B, w, h);

    const extended = new Float32Array(n);
    for(let i = 0; i < n; i++) extended[i] = (nearFg[i] > 0.5 && nearBg[i] > 0.5) ? proj[i] : alpha0[i];

    // Pulido: el filtro guiado sobre el resultado ya extendido, con un
    // radio DELIBERADAMENTE pequeño y fijo —no proporcional al radio
    // de búsqueda—: sólo tiene que enganchar el borde que el paso
    // anterior ya puso aproximadamente en su sitio a la transición de
    // color exacta, no encontrar nada de cero. Un radio de pulido
    // grande vuelve a diluir en su ventana la señal fina que la
    // proyección de color acaba de recuperar —un mechón de un par de
    // píxeles de ancho es, otra vez, una fracción minúscula de esa
    // ventana—, y el resultado retrocede hacia el mismo problema que
    // tenía el filtro guiado por sí solo. Eps más pequeño (Contraste
    // alto) = más fiel a cada variación de color = más «mordida».
    const gray = new Float32Array(n);
    for(let i = 0; i < n; i++){
      const q = i * 4;
      gray[i] = (rgbaU8[q] * 0.2126 + rgbaU8[q + 1] * 0.7152 + rgbaU8[q + 2] * 0.0722) / 255;
    }
    const eps = 0.0008 + (1 - p.contrast / 100) * 0.06;
    const polishRadius = 2;
    const guided = guidedFilterAlpha(gray, extended, w, h, polishRadius, eps);
    const blurredExt = boxBlurFloat(extended, w, h, polishRadius);

    alpha = new Float32Array(n);
    for(let i = 0; i < n; i++){
      const band = clamp01(Math.abs(extended[i] - blurredExt[i]) * 3.5);
      alpha[i] = extended[i] + (guided[i] - extended[i]) * band;
    }
  }

  if(p.contrast > 0) alpha = applyContrastCurve(alpha, p.contrast);
  if(p.smooth > 0) alpha = boxBlurFloat(alpha, w, h, p.smooth);
  if(p.shift) alpha = shiftEdgeAlpha(alpha, w, h, p.shift);

  const out = new Uint8ClampedArray(n);
  for(let i = 0; i < n; i++) out[i] = Math.round(clamp01(alpha[i]) * 255);
  return out;
}

/* ── descontaminar color ──────────────────────────────────────────
   El problema que deja cualquier borde semitransparente: el píxel no
   guarda sólo el color del pelo, guarda una MEZCLA del pelo con lo
   que hubiera detrás —`color = alfa·frente + (1-alfa)·fondo`—, así
   que un recorte sobre un fondo nuevo se ve con un cerco del color
   del fondo viejo pegado alrededor por mucho que el alfa esté bien.

   Se estima el color de FONDO local —el promedio, ponderado y
   suavizado por radio, de los píxeles cercanos con poco alfa— y se
   despeja el color de frente de la ecuación de arriba. Cambia el
   COLOR, no el alfa —por eso, a diferencia del resto de mandos, el
   resultado tiene que ir a una capa nueva: no hay forma de deshacer
   una mezcla ya cocida sobre los píxeles originales sin guardar el
   original aparte—. */
export function decontaminate(rgbaU8, alphaU8, w, h, radius){
  const n = w * h;
  const wBg = new Float32Array(n);
  const rBg = new Float32Array(n), gBg = new Float32Array(n), bBg = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const a = alphaU8[i] / 255, wb = 1 - a;
    const q = i * 4;
    wBg[i] = wb;
    rBg[i] = rgbaU8[q] * wb; gBg[i] = rgbaU8[q + 1] * wb; bBg[i] = rgbaU8[q + 2] * wb;
  }
  const r = Math.max(2, radius);
  const bW = boxBlurFloat(wBg, w, h, r);
  const bR = boxBlurFloat(rBg, w, h, r);
  const bG = boxBlurFloat(gBg, w, h, r);
  const bB = boxBlurFloat(bBg, w, h, r);

  const out = Uint8ClampedArray.from(rgbaU8);
  for(let i = 0; i < n; i++){
    const a = alphaU8[i] / 255;
    if(a <= 0.02 || a >= 0.98) continue;   // ya sólido o ya vacío: nada que descontaminar
    const denom = Math.max(1e-3, bW[i]);
    const Br = bR[i] / denom, Bg = bG[i] / denom, Bb = bB[i] / denom;
    const q = i * 4;
    out[q]     = clamp255((rgbaU8[q]     - (1 - a) * Br) / a);
    out[q + 1] = clamp255((rgbaU8[q + 1] - (1 - a) * Bg) / a);
    out[q + 2] = clamp255((rgbaU8[q + 2] - (1 - a) * Bb) / a);
  }
  return out;
}
