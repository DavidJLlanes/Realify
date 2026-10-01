/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CURVAS
   Un cuadrado con el histograma detrás, la diagonal como punto de
   partida y puntos que se arrastran. El histograma al fondo no es
   decoración: sin él uno mueve la curva a ciegas sin saber dónde
   está la información de la imagen.
   ═══════════════════════════════════════════════════════════════ */

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

/* Interpolación monótona (Fritsch-Carlson): pasa por todos los puntos
   sin inventarse sobreoscilaciones. Una spline normal se sale del
   rango entre puntos muy juntos y crea inversiones de tono visibles
   como bandas de color. */
export function curveLut(points){
  const f = curveFunction(points), t = new Uint8ClampedArray(256);
  for(let x = 0; x < 256; x++) t[x] = clamp255(f(x));
  return t;
}

/* La curva como función continua de 0..255 (admite decimales): la
   tabla de 8 bits de arriba la muestrea en los enteros, y la exportación
   de alta precisión (core/precision-stack.js) la evalúa sin redondear. */
export function curveFunction(points){
  const pts = points.slice().sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if(n === 0) return x => x;
  if(n === 1) return () => pts[0][1];

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const d = [], m = [];
  for(let i = 0; i < n - 1; i++){
    const h = xs[i+1] - xs[i];
    d[i] = h === 0 ? 0 : (ys[i+1] - ys[i]) / h;
  }
  m[0] = d[0];
  for(let i = 1; i < n - 1; i++){
    if(d[i-1] * d[i] <= 0) m[i] = 0;
    else m[i] = (d[i-1] + d[i]) / 2;
  }
  m[n-1] = d[n-2];
  for(let i = 0; i < n - 1; i++){
    if(d[i] === 0){ m[i] = 0; m[i+1] = 0; continue; }
    const a = m[i] / d[i], b = m[i+1] / d[i];
    const s = a*a + b*b;
    if(s > 9){ const f = 3 / Math.sqrt(s); m[i] = f*a*d[i]; m[i+1] = f*b*d[i]; }
  }

  return x => {
    if(x <= xs[0]) return ys[0];
    if(x >= xs[n-1]) return ys[n-1];
    let i = 0;
    while(i < n - 2 && x > xs[i+1]) i++;
    const h = xs[i+1] - xs[i];
    const u = (x - xs[i]) / h;
    const u2 = u*u, u3 = u2*u;
    return (2*u3 - 3*u2 + 1) * ys[i] +
      (u3 - 2*u2 + u) * h * m[i] +
      (-2*u3 + 3*u2) * ys[i+1] +
      (u3 - u2) * h * m[i+1];
  };
}


/* Estilos: las curvas más usadas (S clásica, cine, mate, película
   cruzada…). Cada uno es [id, nombre, curvas por canal]; los canales
   que no aparecen quedan en la diagonal. */
const ID = () => [[0,0],[255,255]];
export const CURVE_PRESETS = [
  ["linear",    "Lineal",                 { rgb: ID() }],
  ["s-soft",    "Curva en S suave",       { rgb: [[0,0],[64,56],[192,200],[255,255]] }],
  ["s-classic", "Curva en S clásica",     { rgb: [[0,0],[64,48],[192,208],[255,255]] }],
  ["s-strong",  "Curva en S fuerte",      { rgb: [[0,0],[60,34],[128,128],[196,222],[255,255]] }],
  ["contrast-l","Contraste en luminosidad", { lum: [[0,0],[64,46],[192,210],[255,255]] }],
  ["inverse-s", "S invertida (suavizar)", { rgb: [[0,0],[64,78],[192,178],[255,255]] }],
  ["fade",      "Desvanecido",            { rgb: [[0,28],[255,236]] }],
  ["matte",     "Mate de película",       { rgb: [[0,34],[48,48],[128,130],[210,214],[255,238]] }],
  ["cine",      "Cine (turquesa y naranja)", { rgb: [[0,10],[64,54],[192,204],[255,248]], r: [[0,0],[70,62],[190,204],[255,255]], g: [[0,4],[128,128],[255,250]], b: [[0,26],[80,92],[190,178],[255,232]] }],
  ["blockbuster","Cine de acción",        { rgb: [[0,0],[50,38],[200,214],[255,255]], r: [[0,0],[128,136],[255,255]], b: [[0,20],[128,120],[255,236]] }],
  ["cross",     "Proceso cruzado",        { r: [[0,0],[64,50],[192,218],[255,255]], g: [[0,0],[64,58],[192,208],[255,255]], b: [[0,40],[128,120],[255,210]] }],
  ["vintage",   "Vintage cálido",         { rgb: [[0,30],[128,132],[255,232]], r: [[0,20],[128,140],[255,255]], b: [[0,40],[128,118],[255,200]] }],
  ["cold",      "Frío nórdico",           { rgb: [[0,12],[128,126],[255,246]], r: [[0,0],[128,118],[255,240]], b: [[0,14],[128,140],[255,255]] }],
  ["warm",      "Cálido suave",           { r: [[0,0],[128,140],[255,255]], b: [[0,0],[128,116],[255,240]] }],
  ["portra",    "Retrato (piel suave)",   { rgb: [[0,18],[64,66],[192,196],[255,246]], r: [[0,6],[128,134],[255,255]], g: [[0,4],[128,130],[255,252]] }],
  ["bleach",    "Blanqueo parcial",       { rgb: [[0,0],[64,40],[128,132],[192,220],[255,255]], lum: [[0,0],[96,84],[255,255]] }],
  ["lift-shadows","Abrir sombras",        { rgb: [[0,0],[48,70],[128,142],[255,255]] }],
  ["tame-lights","Recuperar luces",       { rgb: [[0,0],[128,124],[210,196],[255,236]] }],
  ["brighten",  "Aclarar",                { rgb: [[0,0],[128,160],[255,255]] }],
  ["darken",    "Oscurecer",              { rgb: [[0,0],[128,100],[255,255]] }],
  ["highkey",   "Clave alta",             { rgb: [[0,40],[96,150],[255,255]] }],
  ["lowkey",    "Clave baja",             { rgb: [[0,0],[160,96],[255,220]] }],
  ["solarize",  "Solarizar",              { rgb: [[0,0],[128,255],[255,0]] }],
  ["negative",  "Negativo",               { rgb: [[0,255],[255,0]] }],
  ["posterlike","Tonos separados",        { rgb: [[0,0],[60,20],[70,120],[180,140],[190,235],[255,255]] }]
];

/* Estilos propios, guardados en el navegador (hasta 40). */
const USER_CURVES_KEY = "realify.curves.presets";
export const userCurvePresets = () => { try{ return JSON.parse(localStorage.getItem(USER_CURVES_KEY) || "[]"); }catch{ return []; } };
export const saveUserCurvePresets = list => { try{ localStorage.setItem(USER_CURVES_KEY, JSON.stringify(list.slice(-40))); }catch{} };

/* Aplica las cinco curvas a unos píxeles RGBA, en el orden de
   Photoshop más una etapa final: canal → maestra RGB → luminosidad.
   `s` es { points: { rgb, r, g, b, lum }, link, mix }. Con el vínculo,
   la maestra y la de luminosidad son la misma curva y `mix` reparte su
   efecto: `wc` lo que se aplica en color, `wl` en luminosidad. La usan
   el ajuste (adjustments.js) y las miniaturas de los estilos. */
export function applyCurves(data, s){
  const P = s.points;
  const master = curveLut(P.rgb || ID()), lr = curveLut(P.r || ID()), lg = curveLut(P.g || ID()), lb = curveLut(P.b || ID());
  const lum = curveLut(s.link ? (P.rgb || ID()) : (P.lum || ID()));
  const wl = s.link ? s.mix / 100 : 1, wc = s.link ? 1 - wl : 1;
  const r = new Uint8ClampedArray(256), g = new Uint8ClampedArray(256), b = new Uint8ClampedArray(256);
  for(let i = 0; i < 256; i++){
    r[i] = lr[i] + (master[lr[i]] - lr[i]) * wc;
    g[i] = lg[i] + (master[lg[i]] - lg[i]) * wc;
    b[i] = lb[i] + (master[lb[i]] - lb[i]) * wc;
  }
  for(let i = 0; i < data.length; i += 4){
    data[i] = r[data[i]]; data[i + 1] = g[data[i + 1]]; data[i + 2] = b[data[i + 2]];
  }
  let lumOn = false;
  for(let i = 0; i < 256; i++) if(lum[i] !== i){ lumOn = true; break; }
  if(!lumOn || wl <= 0) return;
  for(let i = 0; i < data.length; i += 4){
    const y = data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722;
    const yi = y | 0, ny = lum[yi] + (lum[Math.min(255, yi + 1)] - lum[yi]) * (y - yi);
    const d = (ny - y) * wl;
    data[i] += d; data[i + 1] += d; data[i + 2] += d;
  }
}

const SIZE = 256;
const PAD = 10;

/* Colores de cada canal: los mismos en el editor, en las miniaturas de
   los estilos y en la vista de varios paneles. */
export const CHANNEL_COLORS = { rgb: "#e8a33d", r: "#e0685c", g: "#5fbf74", b: "#5f8fe0", lum: "#e6e6e6" };

/** Miniatura de un conjunto de curvas por canal ({rgb, r, g, b, lum}). */
export function curveThumb(set, size = 56){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  x.fillStyle = "#16181b"; x.fillRect(0, 0, size, size);
  x.strokeStyle = "rgba(255,255,255,.12)"; x.setLineDash([2, 2]);
  x.beginPath(); x.moveTo(3, size - 3); x.lineTo(size - 3, 3); x.stroke(); x.setLineDash([]);
  for(const k of ["r", "g", "b", "lum", "rgb"]){
    const pts = set[k];
    if(!pts) continue;
    const lut = curveLut(pts);
    x.strokeStyle = CHANNEL_COLORS[k]; x.lineWidth = k === "rgb" || k === "lum" ? 1.8 : 1.3;
    x.beginPath();
    for(let i = 0; i < 256; i += 3){
      const px = 3 + i / 255 * (size - 6), py = size - 3 - lut[i] / 255 * (size - 6);
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  return c;
}

/* `overlays()` (opcional): otras curvas a dibujar debajo, en tenue,
   como [{ points, color }] — así se ven todos los canales a la vez.
   `histMode()` (opcional): "rgb" dibuja los tres histogramas
   superpuestos en su color; si no, el del canal. `size` en píxeles CSS
   del editor (por defecto hasta 320). */
export function curveEditor({ getPoints, setPoints, hist, channel, overlays = null, histMode = null, maxWidth = 320, onEnd = null }){
  const el = document.createElement("div");
  el.style.cssText = "position:relative;margin:6px 0";
  const cv = document.createElement("canvas");
  cv.width = SIZE + PAD * 2;
  cv.height = SIZE + PAD * 2;
  cv.style.cssText =
    `width:100%;max-width:${maxWidth}px;display:block;margin:0 auto;cursor:crosshair;` +
    "border:1px solid var(--line);border-radius:var(--r);background:var(--s-900);" +
    "touch-action:none";
  el.appendChild(cv);
  const cx = cv.getContext("2d");

  let dragging = -1, outside = false;

  const toCanvas = p => [PAD + p[0] / 255 * SIZE, PAD + SIZE - p[1] / 255 * SIZE];
  const toValue = (x, y) => [
    Math.max(0, Math.min(255, Math.round((x - PAD) / SIZE * 255))),
    Math.max(0, Math.min(255, Math.round((PAD + SIZE - y) / SIZE * 255)))
  ];

  function eventPos(e){
    const r = cv.getBoundingClientRect();
    // El lienzo se dibuja a tamaño fijo y se escala por CSS: hay que
    // deshacer esa escala o los puntos caen desplazados.
    const sx = cv.width / r.width, sy = cv.height / r.height;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  }

  /* Radio para «agarrar» un punto, en píxeles del lienzo: con el dedo
     hace falta bastante más margen que con el ratón. */
  function nearest(x, y, touch = false){
    const pts = getPoints();
    const k = cv.width / (cv.getBoundingClientRect().width || cv.width);
    let best = -1, bd = Math.max(14, (touch ? 24 : 12) * k);
    pts.forEach((p, i) => {
      const [px, py] = toCanvas(p);
      const d = Math.hypot(px - x, py - y);
      if(d < bd){ bd = d; best = i; }
    });
    return best;
  }

  function draw(){
    const pts = getPoints();
    const ch = channel();
    cx.clearRect(0, 0, cv.width, cv.height);

    // Histograma de fondo: el del canal, o los tres superpuestos
    const bars = (arr, color) => {
      if(!arr) return;
      let peak = 1;
      for(let i = 1; i < 255; i++) if(arr[i] > peak) peak = arr[i];
      cx.fillStyle = color;
      for(let i = 0; i < 256; i++){
        const h = Math.min(1, arr[i] / peak) * SIZE;
        cx.fillRect(PAD + i / 255 * SIZE, PAD + SIZE - h, SIZE / 256 + 0.6, h);
      }
    };
    if(histMode && histMode() === "rgb" && hist.r){
      cx.globalCompositeOperation = "lighter";
      bars(hist.r, "rgba(170,60,50,.30)"); bars(hist.g, "rgba(50,140,60,.30)"); bars(hist.b, "rgba(50,80,170,.34)");
      cx.globalCompositeOperation = "source-over";
    } else bars(ch === "rgb" || ch === "lum" ? hist.l : hist[ch], "rgba(120,130,142,.22)");

    // Rejilla en cuartos
    cx.strokeStyle = "rgba(255,255,255,.07)";
    cx.lineWidth = 1;
    cx.beginPath();
    for(let i = 1; i < 4; i++){
      cx.moveTo(PAD + SIZE * i / 4, PAD);
      cx.lineTo(PAD + SIZE * i / 4, PAD + SIZE);
      cx.moveTo(PAD, PAD + SIZE * i / 4);
      cx.lineTo(PAD + SIZE, PAD + SIZE * i / 4);
    }
    cx.stroke();

    // Diagonal de referencia
    cx.strokeStyle = "rgba(255,255,255,.13)";
    cx.setLineDash([3, 3]);
    cx.beginPath();
    cx.moveTo(PAD, PAD + SIZE);
    cx.lineTo(PAD + SIZE, PAD);
    cx.stroke();
    cx.setLineDash([]);

    // Las demás curvas, en tenue, para verlas todas a la vez
    for(const o of (overlays ? overlays() : [])){
      const l2 = curveLut(o.points);
      cx.strokeStyle = o.color; cx.globalAlpha = .55; cx.lineWidth = 1.2;
      cx.beginPath();
      for(let i = 0; i < 256; i++){
        const x = PAD + i / 255 * SIZE, y = PAD + SIZE - l2[i] / 255 * SIZE;
        i ? cx.lineTo(x, y) : cx.moveTo(x, y);
      }
      cx.stroke(); cx.globalAlpha = 1;
    }

    // La curva, dibujada desde la misma tabla que se va a aplicar:
    // así lo que se ve es exactamente lo que hará.
    const lut = curveLut(pts);
    cx.strokeStyle = CHANNEL_COLORS[ch] || CHANNEL_COLORS.rgb;
    cx.lineWidth = 1.8;
    cx.beginPath();
    for(let i = 0; i < 256; i++){
      const x = PAD + i / 255 * SIZE;
      const y = PAD + SIZE - lut[i] / 255 * SIZE;
      i ? cx.lineTo(x, y) : cx.moveTo(x, y);
    }
    cx.stroke();

    // Puntos (el que se está sacando del cuadro, en rojo: al soltar se quita)
    pts.forEach((p, i) => {
      const [x, y] = toCanvas(p);
      const out = outside && i === dragging;
      cx.fillStyle = "#141517";
      cx.beginPath(); cx.arc(x, y, out ? 7 : 5, 0, 6.2832); cx.fill();
      cx.fillStyle = out ? "#ff6b6b" : cx.strokeStyle;
      cx.beginPath(); cx.arc(x, y, out ? 5 : 3.4, 0, 6.2832); cx.fill();
    });
  }

  cv.addEventListener("pointerdown", e => {
    e.preventDefault();
    const [x, y] = eventPos(e);
    const pts = getPoints().slice();
    let i = nearest(x, y, e.pointerType === "touch" || e.pointerType === "pen");

    if(e.button === 2){                       // clic derecho: quitar
      if(i >= 0 && pts.length > 2){
        pts.splice(i, 1);
        setPoints(pts); draw();
      }
      return;
    }
    if(i < 0){
      const v = toValue(x, y);
      pts.push(v);
      pts.sort((a, b) => a[0] - b[0]);
      i = pts.findIndex(p => p[0] === v[0] && p[1] === v[1]);
      setPoints(pts);
    }
    dragging = i;
    cv.setPointerCapture(e.pointerId);
    draw();
  });

  cv.addEventListener("pointermove", e => {
    if(dragging < 0) return;
    const [x, y] = eventPos(e);
    /* Arrastrar un punto intermedio bien fuera del cuadro lo quita al
       soltar (en el móvil no hay clic derecho ni doble clic fiable). */
    const r = cv.getBoundingClientRect(), m = 28;
    const wasOut = outside;
    outside = dragging > 0 && dragging < getPoints().length - 1 &&
      (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top - m || e.clientY > r.bottom + m);
    if(outside){ if(!wasOut) draw(); return; }
    const pts = getPoints().slice();
    const v = toValue(x, y);
    /* Los extremos sólo se mueven en vertical: si el primer punto se
       desplazara a la derecha quedaría un tramo sin definir. Y los
       intermedios no pueden adelantar a sus vecinos, o la curva
       dejaría de ser una función. */
    if(dragging === 0) pts[0] = [0, v[1]];
    else if(dragging === pts.length - 1) pts[dragging] = [255, v[1]];
    else {
      const lo = pts[dragging - 1][0] + 1;
      const hi = pts[dragging + 1][0] - 1;
      pts[dragging] = [Math.max(lo, Math.min(hi, v[0])), v[1]];
    }
    setPoints(pts);
    draw();
  });

  const end = () => {
    if(dragging >= 0 && outside){
      const pts = getPoints().slice();
      if(dragging > 0 && dragging < pts.length - 1){ pts.splice(dragging, 1); setPoints(pts); }
    }
    outside = false;
    if(dragging >= 0 && onEnd) onEnd();
    dragging = -1; draw();
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  cv.addEventListener("contextmenu", e => e.preventDefault());
  cv.addEventListener("dblclick", e => {
    const [x, y] = eventPos(e);
    const i = nearest(x, y);
    const pts = getPoints().slice();
    if(i > 0 && i < pts.length - 1){
      pts.splice(i, 1);
      setPoints(pts); draw();
    }
  });

  draw();
  return { el, refresh: draw };
}
