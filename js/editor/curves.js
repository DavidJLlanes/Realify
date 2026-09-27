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
  const pts = points.slice().sort((a, b) => a[0] - b[0]);
  const t = new Uint8ClampedArray(256);
  const n = pts.length;
  if(n === 0){ for(let i = 0; i < 256; i++) t[i] = i; return t; }
  if(n === 1){ for(let i = 0; i < 256; i++) t[i] = clamp255(pts[0][1]); return t; }

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

  for(let x = 0; x < 256; x++){
    if(x <= xs[0]){ t[x] = clamp255(ys[0]); continue; }
    if(x >= xs[n-1]){ t[x] = clamp255(ys[n-1]); continue; }
    let i = 0;
    while(i < n - 2 && x > xs[i+1]) i++;
    const h = xs[i+1] - xs[i];
    const u = (x - xs[i]) / h;
    const u2 = u*u, u3 = u2*u;
    t[x] = clamp255(
      (2*u3 - 3*u2 + 1) * ys[i] +
      (u3 - 2*u2 + u) * h * m[i] +
      (-2*u3 + 3*u2) * ys[i+1] +
      (u3 - u2) * h * m[i+1]);
  }
  return t;
}


const SIZE = 256;
const PAD = 10;

export function curveEditor({ getPoints, setPoints, hist, channel }){
  const el = document.createElement("div");
  el.style.cssText = "position:relative;margin:6px 0";
  const cv = document.createElement("canvas");
  cv.width = SIZE + PAD * 2;
  cv.height = SIZE + PAD * 2;
  cv.style.cssText =
    "width:100%;max-width:320px;display:block;margin:0 auto;cursor:crosshair;" +
    "border:1px solid var(--line);border-radius:var(--r);background:var(--s-900);" +
    "touch-action:none";
  el.appendChild(cv);
  const cx = cv.getContext("2d");

  let dragging = -1;

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

  function nearest(x, y){
    const pts = getPoints();
    let best = -1, bd = 14;
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

    // Histograma de fondo
    const arr = ch === "rgb" ? hist.l : hist[ch];
    let peak = 1;
    for(let i = 1; i < 255; i++) if(arr[i] > peak) peak = arr[i];
    cx.fillStyle = "rgba(120,130,142,.22)";
    for(let i = 0; i < 256; i++){
      const h = Math.min(1, arr[i] / peak) * SIZE;
      cx.fillRect(PAD + i / 255 * SIZE, PAD + SIZE - h, SIZE / 256 + 0.6, h);
    }

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

    // La curva, dibujada desde la misma tabla que se va a aplicar:
    // así lo que se ve es exactamente lo que hará.
    const lut = curveLut(pts);
    cx.strokeStyle = ch === "r" ? "#d4685c" : ch === "g" ? "#5fa96e"
                   : ch === "b" ? "#5f86c9" : "#e8a33d";
    cx.lineWidth = 1.8;
    cx.beginPath();
    for(let i = 0; i < 256; i++){
      const x = PAD + i / 255 * SIZE;
      const y = PAD + SIZE - lut[i] / 255 * SIZE;
      i ? cx.lineTo(x, y) : cx.moveTo(x, y);
    }
    cx.stroke();

    // Puntos
    for(const p of pts){
      const [x, y] = toCanvas(p);
      cx.fillStyle = "#141517";
      cx.beginPath(); cx.arc(x, y, 5, 0, 6.2832); cx.fill();
      cx.fillStyle = cx.strokeStyle;
      cx.beginPath(); cx.arc(x, y, 3.4, 0, 6.2832); cx.fill();
    }
  }

  cv.addEventListener("pointerdown", e => {
    e.preventDefault();
    const [x, y] = eventPos(e);
    const pts = getPoints().slice();
    let i = nearest(x, y);

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

  const end = () => { dragging = -1; };
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
