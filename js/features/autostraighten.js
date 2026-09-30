/* ═══════════════════════════════════════════════════════════════
   ENDEREZAR AUTOMÁTICAMENTE (menú Imagen)
   A diferencia del horizonte de la cuadrícula inteligente (una sola
   línea larga), aquí cuentan TODAS las líneas casi horizontales y casi
   verticales de la foto: el horizonte, pero también cornisas, ventanas,
   farolas, marcos o el borde de una mesa. Método de «nitidez de la
   proyección» (el mismo principio que endereza documentos escaneados):
   para cada ángulo candidato se proyectan los bordes sobre la
   perpendicular y se mide cuánto se amontonan; con el ángulo correcto,
   los bordes de cada línea caen en la misma fila y la proyección se
   vuelve «picuda».

     · A 1024 px, bordes de Sobel más fuertes que el 90 % de la foto.
     · Ángulos de −12° a +12° cada 0,1°, afinados con una parábola.
     · Líneas horizontales con más peso que las verticales (éstas
       convergen por la perspectiva cuando la cámara mira hacia arriba).
     · Sólo se endereza si el pico destaca con claridad: una foto sin
       líneas rectas no se gira «por si acaso».
   El giro lo hace smartgrid.js › straighten (todas las capas, sin
   esquinas vacías, un paso de deshacer).
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { toast } from "../ui/toast.js";

/** Inclinación (grados) de `source`, o null si no hay líneas claras. */
export function detectTilt(source){
  const k = Math.min(1, 1024 / Math.max(source.width, source.height));
  const w = Math.max(8, Math.round(source.width * k)), h = Math.max(8, Math.round(source.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(source, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, n = w * h, Y = new Float32Array(n);
  for(let i = 0; i < n; i++) Y[i] = d[i * 4] * 0.2126 + d[i * 4 + 1] * 0.7152 + d[i * 4 + 2] * 0.0722;
  // Sobel y umbral en el percentil 90 de la magnitud
  const mag = new Float32Array(n), gxA = new Float32Array(n), gyA = new Float32Array(n);
  for(let y = 1; y < h - 1; y++) for(let xx = 1; xx < w - 1; xx++){
    const i = y * w + xx;
    const gx = Y[i - w + 1] + 2 * Y[i + 1] + Y[i + w + 1] - Y[i - w - 1] - 2 * Y[i - 1] - Y[i + w - 1];
    const gy = Y[i + w - 1] + 2 * Y[i + w] + Y[i + w + 1] - Y[i - w - 1] - 2 * Y[i - w] - Y[i - w + 1];
    gxA[i] = gx; gyA[i] = gy; mag[i] = Math.hypot(gx, gy);
  }
  const hist = new Uint32Array(1024); let mx = 0;
  for(let i = 0; i < n; i++) if(mag[i] > mx) mx = mag[i];
  if(mx <= 0) return null;
  for(let i = 0; i < n; i++) hist[Math.min(1023, (mag[i] / mx * 1023) | 0)]++;
  let acc = 0, thr = mx;
  for(let b = 1023; b >= 0; b--){ acc += hist[b]; if(acc > n * 0.1){ thr = b / 1023 * mx; break; } }
  thr = Math.max(thr, 20);
  const H = [], V = [];
  for(let y = 1; y < h - 1; y++) for(let xx = 1; xx < w - 1; xx++){
    const i = y * w + xx; if(mag[i] < thr) continue;
    const ax = Math.abs(gxA[i]), ay = Math.abs(gyA[i]);
    if(ay > ax * 2.5) H.push(xx - w / 2, y - h / 2);       // borde de una línea casi horizontal
    else if(ax > ay * 2.5) V.push(xx - w / 2, y - h / 2);  // casi vertical
  }
  if(H.length + V.length < 400) return null;
  const A0 = -12, STEP = 0.1, NA = 241, R = Math.ceil(Math.hypot(w, h)) + 4;
  const bins = new Float32Array(2 * R);
  const sharp = (P, a, vertical) => {
    bins.fill(0);
    const cs = Math.cos(a), sn = Math.sin(a);
    for(let j = 0; j < P.length; j += 2){
      const px = P[j], py = P[j + 1];
      const rho = vertical ? px * cs + py * sn : py * cs - px * sn;
      bins[(rho + R) | 0]++;
    }
    let s = 0; for(let b = 0; b < bins.length; b++) s += bins[b] * bins[b];
    return s;
  };
  const sH = new Float64Array(NA), sV = new Float64Array(NA);
  for(let t = 0; t < NA; t++){
    const a = (A0 + t * STEP) * Math.PI / 180;
    sH[t] = H.length ? sharp(H, a, false) : 0;
    sV[t] = V.length ? sharp(V, a, true) : 0;
  }
  // Cada familia, relativa a su mediana (así ninguna domina por tener más bordes)
  const rel = s => { const q = Array.from(s).sort((a, b) => a - b), m = q[q.length >> 1] || 1; return Array.from(s, v => v / m); };
  const rH = rel(sH), rV = rel(sV);
  // Pico de cada familia (afinado con una parábola) y cuánto destaca
  const peak = r => {
    let b = 0; for(let t = 1; t < NA; t++) if(r[t] > r[b]) b = t;
    const q = r.slice().sort((a, c) => a - c), prom = r[b] - q[q.length >> 1];
    let off = 0;
    if(b > 0 && b < NA - 1){ const a = r[b - 1], m = r[b], c = r[b + 1], den = a - 2 * m + c; if(den < 0) off = 0.5 * (a - c) / den; }
    const ang = A0 + (b + off) * STEP;
    // Un pico pegado al límite del barrido no es fiable
    return { ang, prom: Math.abs(ang) > 11.5 ? 0 : prom };
  };
  // Una línea recta de verdad: en el ángulo del pico, en la fila (o
  // columna) más cargada, los bordes forman un tramo CONTINUO (huecos
  // < 3 %) de al menos el 20 % de la foto (12 % en las verticales, que
  // suelen ser más cortas: farolas, marcos, esquinas). Una textura (pelo, hojas)
  // reparte bordes por todas partes pero nunca en un tramo seguido.
  const longLine = (P, a, vertical, span, need) => {
    bins.fill(0);
    const cs = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
    const rhoOf = j => vertical ? P[j] * cs + P[j + 1] * sn : P[j + 1] * cs - P[j] * sn;
    for(let j = 0; j < P.length; j += 2) bins[((rhoOf(j) + R) / 2) | 0]++;
    // las 5 filas más cargadas
    const top = Array.from(bins.keys()).sort((u, v) => bins[v] - bins[u]).slice(0, 5);
    for(const b of top){
      const t = [];
      for(let j = 0; j < P.length; j += 2) if((((rhoOf(j) + R) / 2) | 0) === b) t.push(vertical ? P[j + 1] * cs - P[j] * sn : P[j] * cs + P[j + 1] * sn);
      t.sort((u, v) => u - v);
      let run = 0, start = t[0], gap = span * 0.03;
      for(let k = 1; k < t.length; k++){ if(t[k] - t[k - 1] > gap) start = t[k]; run = Math.max(run, t[k] - start); }
      if(run >= span * need) return true;
    }
    return false;
  };
  let pH = H.length > 100 ? peak(rH) : { ang: 0, prom: 0 };
  let pV = V.length > 100 ? peak(rV) : { ang: 0, prom: 0 };
  if(pH.prom && !longLine(H, pH.ang, false, w, 0.2)) pH = { ang: pH.ang, prom: 0 };
  if(pV.prom && !longLine(V, pV.ang, true, h, 0.12)) pV = { ang: pV.ang, prom: 0 };
  if(typeof globalThis.__tiltDebug === "function") globalThis.__tiltDebug({ H: pH, V: pV });
  /* Decisión, conservadora a propósito (una foto mal girada es peor que
     una sin girar):
     · Las dos familias destacan y coinciden (±1,5°): media ponderada.
     · Discrepan (perspectiva, objetos inclinados): sólo si una domina
       con claridad (≥ 2 veces y ≥ 0,3); si no, nada.
     · Sólo una familia: tiene que destacar bastante (≥ 0,25).
     · Nunca más de 10°: eso ya no es «torcida», es otra cosa. */
  let ang = null;
  const okH = pH.prom >= 0.15, okV = pV.prom >= 0.15;
  if(okH && okV){
    if(Math.abs(pH.ang - pV.ang) <= 1.5) ang = (pH.ang * pH.prom + pV.ang * pV.prom) / (pH.prom + pV.prom);
    else if(pH.prom >= 2 * pV.prom && pH.prom >= 0.3) ang = pH.ang;
    else if(pV.prom >= 2 * pH.prom && pV.prom >= 0.3) ang = pV.ang;
  } else if(okH && pH.prom >= 0.25) ang = pH.ang;
  else if(okV && pV.prom >= 0.25) ang = pV.ang;
  if(ang === null || Math.abs(ang) > 10) return null;
  return +ang.toFixed(2);
}

/* Ventana: propone el ángulo detectado y deja afinarlo antes de aplicar
   (una foto mal girada es peor que una torcida). Vista previa girada y
   ampliada como quedará, con cuadrícula para juzgar; un deslizador. */
let open = false;
export async function autoStraighten(){
  if(open) return;
  if(!doc.open){ toast("Abre una imagen primero"); return; }
  const { flatten } = await import("../editor/layertree.js");
  const full = flatten();
  const found = detectTilt(full);
  open = true;
  const { createShell, ensureShellStyles } = await import("../ui/fsshell.js");
  await ensureShellStyles();
  // Copia reducida para la vista previa
  const k = Math.min(1, 1400 / Math.max(full.width, full.height));
  const small = document.createElement("canvas"); small.width = Math.round(full.width * k); small.height = Math.round(full.height * k);
  const sx = small.getContext("2d"); sx.imageSmoothingQuality = "high"; sx.drawImage(full, 0, 0, small.width, small.height);
  const view = document.createElement("canvas"); view.width = small.width; view.height = small.height;
  let angle = found ?? 0;
  const render = () => {
    const a = -angle * Math.PI / 180, W = view.width, H = view.height;
    const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a)), z = Math.max((W * cos + H * sin) / W, (W * sin + H * cos) / H);
    const x = view.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    x.imageSmoothingQuality = "high"; x.translate(W / 2, H / 2); x.rotate(a); x.scale(z, z); x.drawImage(small, -W / 2, -H / 2);
    sh.setView(view);
    sh.setApplyEnabled(Math.abs(angle) >= 0.05);
    for(const el of sh.root.querySelectorAll(".straighten-val")) el.textContent = (angle > 0 ? "+" : "") + angle.toFixed(1).replace(".", ",") + "°";
  };
  const close = () => { open = false; sh.close(); };
  const sh = createShell({
    title: "Enderezar", applyLabel: "Aplicar",
    subtitle: found === null ? "No hay líneas rectas claras: ajústalo a mano" : Math.abs(found) < 0.1 ? "La foto ya está recta" : `Inclinación detectada: ${found.toFixed(1).replace(".", ",")}°`,
    onCancel: close,
    onApply: async () => { const a = angle; close(); const { straighten } = await import("../editor/smartgrid.js"); straighten(a); }
  });
  sh.setOriginal(small);
  // Cuadrícula fina para juzgar lo recto
  sh.setOverlay((cx, t) => {
    cx.strokeStyle = "rgba(255,255,255,.35)"; cx.lineWidth = t.dpr;
    const W = view.width * t.k, H = view.height * t.k, n = 8;
    for(let i = 1; i < n; i++){
      cx.beginPath(); cx.moveTo(t.ox + W * i / n, t.oy); cx.lineTo(t.ox + W * i / n, t.oy + H); cx.stroke();
      cx.beginPath(); cx.moveTo(t.ox, t.oy + H * i / n); cx.lineTo(t.ox + W, t.oy + H * i / n); cx.stroke();
    }
  });
  const ctl = () => {
    const el = document.createElement("div"); el.className = "face-ctl";
    el.innerHTML = `<span class="straighten-val mono"></span><input type="range" min="-15" max="15" step="0.1" aria-label="Ángulo">`;
    const r = el.querySelector("input"); r.value = angle;
    r.addEventListener("input", () => { angle = +r.value; sh.root.querySelectorAll(".face-ctl input").forEach(o => { if(o !== r) o.value = angle; }); render(); });
    return el;
  };
  sh.mobile.appendChild(ctl()); sh.right.appendChild(ctl());
  render();
}
