/* ═══════════════════════════════════════════════════════════════
   PANEL DEL FILTRO CÁMARA
   Vista previa en vivo sobre la capa activa: se ve el resultado en
   el lienzo mientras se mueven los mandos, y sólo al aceptar se
   escribe en los píxeles. Cancelar deja la capa exactamente como
   estaba.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../../core/doc.js";
import { emit } from "../../core/bus.js";
import { isMobile } from "../../core/device.js";
import { dialog } from "../../ui/dialog.js";
import { toast, status } from "../../ui/toast.js";
import { CHAIN, CHAIN_BY_ID } from "./chain.js";
import { PRESETS } from "./presets.js";
import { normalizeState, varyStages, presetStages } from "./state.js";
import { wireRecommendation } from "./recommended.js";
import { commitFilter, filterBase } from "../../editor/filterlayer.js";
import { spectrum } from "../../analysis/fft.js";
import { matchCamera } from "./exifmatch.js";
import { exifState, saveExif } from "../../exif/ui.js";
import { spectralStats } from "./spectralclean.js";
import { applyCpuStages, cpuStagesActive } from "./cpustages.js";
import * as engine from "./engine.js";

const LS_KEY = "realify.camera";

/* Estado del filtro, persistente entre aperturas: es lo que uno
   espera al volver a abrirlo después de exportar. */
export const filterState = normalizeState(null);

try{
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
  Object.assign(filterState, normalizeState(saved));
}catch{}

function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({
    stages: filterState.stages, seed: filterState.seed,
    camSeed: filterState.camSeed, dose: filterState.dose
  })); }catch{}
}

/* ── vista previa ─────────────────────────────────────────────
   Se trabaja sobre una copia del original de la capa. La capa real
   se va sobrescribiendo con el resultado para que el compositor lo
   muestre sin enterarse de nada. */
let original = null, target = null, previewTimer = null;

/* Miniatura dentro del propio panel. El filtro ya escribía el
   resultado en la capa, pero el panel es ancho y alto y tapa el
   lienzo entero: mirando el diálogo no se veía nada de lo que estaba
   pasando, que es el «no hay previsualización» del que se queja el
   usuario. Ahora el resultado se ve aquí mismo, junto a los mandos
   que lo producen. */
let prevCv = null, prevCx = null;
let histCv = null, specCv = null, statsTimer = null;

/* Histograma RGB y espectro de Fourier de la propia vista previa, para
   ver de un vistazo si la rejilla espectral de la imagen cambia al aplicar el filtro. Estas gráficas
   describen textura y color; no clasifican la procedencia de la imagen. Se recalculan un instante después de soltar el mando,
   no en cada fotograma del arrastre: una FFT 256×256 sesenta veces por
   segundo se notaría en la fluidez sin aportar nada que no se vea ya
   con la vista quieta. */
function drawHistogram(){
  if(!histCv || !prevCv || !prevCv.width) return;
  const hx = histCv.getContext("2d");
  const sx = prevCv.getContext("2d", { willReadFrequently: true });
  const d = sx.getImageData(0, 0, prevCv.width, prevCv.height).data;
  const bins = 64;
  const r = new Float64Array(bins), g = new Float64Array(bins), b = new Float64Array(bins);
  for(let i = 0; i < d.length; i += 4){
    r[Math.min(bins - 1, (d[i]   * bins / 256) | 0)]++;
    g[Math.min(bins - 1, (d[i+1] * bins / 256) | 0)]++;
    b[Math.min(bins - 1, (d[i+2] * bins / 256) | 0)]++;
  }
  const mx = Math.max(1, Math.max(...r), Math.max(...g), Math.max(...b));
  const w = histCv.width, h = histCv.height;
  hx.clearRect(0, 0, w, h);
  hx.globalCompositeOperation = "lighter";
  const plot = (arr, color) => {
    hx.fillStyle = color;
    const bw = w / bins;
    hx.beginPath();
    hx.moveTo(0, h);
    for(let i = 0; i < bins; i++) hx.lineTo(i * bw, h - (arr[i] / mx) * h);
    hx.lineTo(w, h);
    hx.closePath();
    hx.fill();
  };
  plot(r, "rgba(255,90,90,.6)");
  plot(g, "rgba(90,255,120,.6)");
  plot(b, "rgba(90,150,255,.6)");
  hx.globalCompositeOperation = "source-over";
}

function drawSpectrum(){
  if(!specCv || !prevCv || !prevCv.width) return;
  spectrum(prevCv, prevCv.width, prevCv.height, specCv);
}

function scheduleStats(){
  // En móvil no existen esos dos lienzos, así que no hay nada que
  // calcular: ni el histograma ni —sobre todo— la FFT del espectro.
  if(!histCv && !specCv) return;
  if(statsTimer) clearTimeout(statsTimer);
  statsTimer = setTimeout(() => { statsTimer = null; drawHistogram(); drawSpectrum(); }, 150);
}

function paintThumb(){
  if(!prevCv || !target) return;
  const src = target.canvas;
  if(!src.width || !src.height) return;
  if(!prevCv.width || !prevCv.height) return;
  prevCx.clearRect(0, 0, prevCv.width, prevCv.height);
  prevCx.imageSmoothingQuality = "high";
  prevCx.drawImage(src, 0, 0, prevCv.width, prevCv.height);
}

/* La miniatura se dimensiona con la proporción de la imagen y un tope
   de altura, para que un panorama no ocupe una raya y un retrato no se
   coma el panel entero.

   En móvil esta miniatura no es una miniatura: es la única vista de la
   foto que hay, porque el panel ocupa la pantalla entera. Así que el
   tope se calcula sobre la pantalla real y en píxeles de dispositivo
   —el CSS la encaja después con `object-fit`—, o en una pantalla densa
   se vería la foto reescalada desde un lienzo de 260 px de alto. */
function sizeThumb(cv, w, h){
  let MAXW = 620, MAXH = 260;
  if(isMobile()){
    const dpr = Math.min(2, devicePixelRatio || 1);
    MAXW = Math.round(Math.min(innerWidth, 900) * dpr);
    MAXH = Math.round(Math.min(innerHeight * 0.55, 900) * dpr);
  }
  const k = Math.min(MAXW / w, MAXH / h, 1);
  cv.width  = Math.max(1, Math.round(w * k));
  cv.height = Math.max(1, Math.round(h * k));
}

function snapshotLayer(l){
  const c = document.createElement("canvas");
  c.width = l.canvas.width; c.height = l.canvas.height;
  c.getContext("2d").drawImage(l.canvas, 0, 0);
  return c;
}

function restoreLayer(l, snap){
  const x = l.ctx;
  x.save();
  x.globalCompositeOperation = "copy";
  x.drawImage(snap, 0, 0);
  x.restore();
  l.thumbDirty = true;
  emit("doc:change");
}

function renderPreview(stable=false){
  if(!target || !original) return;
  engine.setSeed(filterState.seed);
  engine.setCameraSeed(filterState.camSeed);
  const ms = engine.renderTo(target.ctx, filterState.stages, {
    dose: filterState.dose / 100,
    solo: filterState.solo,
    stable
  });
  target.thumbDirty = true;
  emit("doc:change");
  paintThumb();
  scheduleStats();
  const n = CHAIN.filter(s => filterState.stages[s.id].on).length;
  status(`${n} de ${CHAIN.length} etapas · ${Math.round(ms)} ms`);
  // Cualquier pasada de CPU en vuelo trabajaba sobre píxeles que este
  // render acaba de reemplazar: se invalida y se pide otra.
  cpuTicket++;
  if(!stable) scheduleCpuPreview();
}

/* ── vista previa de las etapas de CPU ──────────────────────────
   La limpieza espectral y el JPEG son demasiado lentos para
   recalcularse en cada movimiento de un deslizador, así que mientras
   se arrastra la vista previa es sólo la parte de GPU. En cuanto el
   panel lleva un instante quieto se aplican encima, sobre los mismos
   píxeles y con la misma función que usará Aplicar: lo que se ve
   quieto es lo que va a salir.

   Se trabaja sobre una copia y se vuelca al final sólo si nadie ha
   vuelto a renderizar entretanto. El JPEG es asíncrono y no se puede
   cancelar; sin este cerrojo, una ida y vuelta lenta terminaba
   después del siguiente render y lo pisaba con píxeles viejos. */
let cpuTimer = null, cpuTicket = 0;

function scheduleCpuPreview(){
  if(cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = null;
  if(!cpuStagesActive(filterState.stages, filterState.dose / 100)) return;
  cpuTimer = setTimeout(runCpuPreview, 380);
}

async function runCpuPreview(){
  cpuTimer = null;
  if(!target || !original) return;
  const ticket = cpuTicket;
  const work = snapshotLayer(target);
  await applyCpuStages(work, filterState.stages, filterState.dose / 100, status);
  if(ticket !== cpuTicket || !target) return;
  restoreLayer(target, work);
  paintThumb();
  scheduleStats();
  const n = CHAIN.filter(s => filterState.stages[s.id].on).length;
  status(`${n} de ${CHAIN.length} etapas · con CPU`);
}

function schedulePreview(){
  if(previewTimer) return;
  previewTimer = requestAnimationFrame(() => { previewTimer = null; renderPreview(); });
}

/* ── ajuste recomendado ────────────────────────────────────────
   Dos escalas de medida, porque miden cosas distintas:
   · Lo GLOBAL —brillo medio, recorte de luces y sombras, saturación,
     contraste, dominante de color— se mide sobre una copia reducida:
     son propiedades de la imagen entera y reducirla no las altera.
   · Lo FINO —ruido, detalle, bloques JPEG, rejillas, pendiente del
     espectro— se mide sobre losas a resolución NATIVA. Reducir la
     imagen promedia justo las frecuencias altas donde vive todo eso:
     sobre la copia pequeña una imagen ruidosa y una nítida daban el
     mismo número. Es la regla que ya sigue analysis/fft.js.
   Ruido y detalle se separan a propósito, porque el fallo clásico de
   un laplaciano medio es que no distingue grano de textura real: el
   ruido sale de la mediana del residuo de Immerkær —un núcleo que se
   anula sobre rampas y responde casi sólo al grano— y el detalle del
   percentil 90 del gradiente, que un poco de ruido apenas mueve pero
   un contorno sí. */
export function analyzeLayer(canvas){
  const W = canvas.width, H = canvas.height;

  /* Global, sobre copia reducida. */
  const side = 512;
  const sc = Math.min(1, side / Math.max(W, H));
  const w = Math.max(8, Math.round(W * sc));
  const h = Math.max(8, Math.round(H * sc));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;

  const n = w * h;
  let sum = 0, hi = 0, lo = 0, sat = 0, sR = 0, sG = 0, sB = 0, sq = 0;
  for(let i = 0, p = 0; p < n; i += 4, p++){
    const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
    const l = 0.2126*r + 0.7152*g + 0.0722*b;
    sum += l; sq += l*l; sR += r; sG += g; sB += b;
    if(l > 0.92) hi++;
    if(l < 0.06) lo++;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    sat += mx > 0.004 ? (mx-mn)/mx : 0;
  }
  const mean = sum/n, sd = Math.sqrt(Math.max(0, sq/n - mean*mean));
  const mR = sR/n, mG = sG/n, mB = sB/n;
  // Dominante: eje cálido/frío (rojo frente a azul) y eje verde/magenta.
  const castTemp = (mR - mB) / (mR + mB + 1e-6);
  const castTint = mG - (mR + mB) / 2;

  /* Fino, sobre losas nativas: centro y cuatro cuadrantes, alineadas
     a la rejilla de 8 px para que la medida de bloques JPEG tenga
     sentido. Cada métrica se agrega por mediana entre losas: una
     losa que caiga sobre cielo liso o sobre un texto no debe mandar
     sola. */
  const tile = [256, 128, 64, 32].find(t => Math.min(W, H) >= t) || 0;
  const fine = { noise: [], structure: [], block: [], alpha: [], peak2: [], peak4: [], peakMax: [] };
  if(tile){
    const pos = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const tc = document.createElement("canvas");
    tc.width = tile; tc.height = tile;
    const tx = tc.getContext("2d", { willReadFrequently: true });
    const seen = new Set();
    for(const [fx, fy] of pos){
      const sx = Math.max(0, Math.min(W - tile, Math.round(fx * W - tile / 2) & ~7));
      const sy = Math.max(0, Math.min(H - tile, Math.round(fy * H - tile / 2) & ~7));
      const key = sx + "," + sy;
      if(seen.has(key)) continue;
      seen.add(key);
      tx.drawImage(canvas, sx, sy, tile, tile, 0, 0, tile, tile);
      const td = tx.getImageData(0, 0, tile, tile).data;
      const L = new Float64Array(tile * tile);
      for(let p = 0, i = 0; p < L.length; p++, i += 4)
        L[p] = (0.2126*td[i] + 0.7152*td[i+1] + 0.0722*td[i+2]) / 255;
      const m = fineMetrics(L, tile);
      for(const k in m) fine[k].push(m[k]);
    }
  }
  const med = arr => { if(!arr.length) return null; const s = [...arr].sort((p, q) => p - q); return s[s.length >> 1]; };

  return {
    mean, hiF: hi/n, loF: lo/n, satM: sat/n, sd, castTemp, castTint,
    mp: (W * H) / 1e6,
    noise:     med(fine.noise)     ?? 0.006,
    structure: med(fine.structure) ?? 0.06,
    block:     med(fine.block)     ?? 1.0,
    alpha:     med(fine.alpha)     ?? 1.0,
    peak2:     med(fine.peak2)     ?? 1.0,
    peak4:     med(fine.peak4)     ?? 1.0,
    peakMax:   med(fine.peakMax)   ?? 1.0
  };
}

/* Métricas de una losa nativa de luminancia (0..1), lado `n`. */
function fineMetrics(L, n){
  // Ruido: mediana del residuo de Immerkær. El núcleo
  // [1 -2 1; -2 4 -2; 1 -2 1] tiene norma 6 y se anula sobre rampas;
  // para ruido gaussiano, mediana(|res|) = 0.6745·6·σ.
  const res = [];
  for(let y = 1; y < n - 1; y++){
    for(let x = 1; x < n - 1; x++){
      const p = y * n + x;
      const v = 4*L[p] - 2*(L[p-1] + L[p+1] + L[p-n] + L[p+n])
              + L[p-n-1] + L[p-n+1] + L[p+n-1] + L[p+n+1];
      res.push(Math.abs(v));
    }
  }
  res.sort((a, b) => a - b);
  const noise = res[res.length >> 1] / (0.6745 * 6);

  // Detalle: densidad de contornos, la fracción de píxeles cuyo
  // gradiente supera claramente lo que el propio ruido produce. El
  // gradiente central de ruido gaussiano σ tiene módulo medio ≈0.88σ;
  // a 3× de eso el grano ya casi no cuenta, y un borde de verdad sí.
  // Un percentil no sirve: en una imagen de bordes escasos el 90 % de
  // los píxeles son planos y el percentil 90 no llega a los bordes.
  const edgeThr = Math.max(3 * 0.88 * noise, 0.01);
  let edges = 0, cntG = 0;
  for(let y = 1; y < n - 1; y++){
    for(let x = 1; x < n - 1; x++){
      const p = y * n + x;
      if(Math.hypot(L[p+1] - L[p-1], L[p+n] - L[p-n]) * 0.5 > edgeThr) edges++;
      cntG++;
    }
  }
  const structure = cntG ? edges / cntG : 0;

  // Bloques JPEG: salto medio en las fronteras de 8 px frente al salto
  // medio en el interior. 1.0 = sin bloques; una foto recomprimida
  // con pérdida visible sube claramente de 1.1. Dos salvaguardas:
  // · Sólo cuentan los saltos PEQUEÑOS (≤14 LSB). El escalón entre
  //   bloques de un códec es de unos pocos niveles; un salto grande es
  //   un contorno de la escena, que puede caer en un múltiplo de 8 por
  //   pura casualidad (baldosas, píxel art) sin ser compresión.
  // · Se toma el MÍNIMO de los dos ejes: los bloques son cuadrados y
  //   aparecen en ambos; un degradado posterizado cada 16 px sólo
  //   salta en uno.
  const SMALL = 14 / 255;
  let bH = 0, iH = 0, nbH = 0, niH = 0, bV = 0, iV = 0, nbV = 0, niV = 0;
  for(let y = 0; y < n; y++){
    for(let x = 1; x < n; x++){
      const dd = Math.abs(L[y*n+x] - L[y*n+x-1]);
      if(dd > SMALL) continue;
      if((x & 7) === 0){ bH += dd; nbH++; } else { iH += dd; niH++; }
    }
  }
  for(let x = 0; x < n; x++){
    for(let y = 1; y < n; y++){
      const dd = Math.abs(L[y*n+x] - L[(y-1)*n+x]);
      if(dd > SMALL) continue;
      if((y & 7) === 0){ bV += dd; nbV++; } else { iV += dd; niV++; }
    }
  }
  const ratio = (b, nb, i, ni) => (nb && ni) ? (b/nb) / Math.max(i/ni, 0.002) : 1;
  const block = Math.min(ratio(bH, nbH, iH, niH), ratio(bV, nbV, iV, niV));

  const { alpha, peak2, peak4, peakMax } = spectralStats(L, n);
  return { noise, structure, block, alpha, peak2, peak4, peakMax };
}

/* El ajuste recomendado se calcula aquí mismo, midiendo la imagen: no
   consulta nada. Monta la cadena de captura que a una imagen generada
   le falta —óptica, sensor, revelado y códec— y dosifica cada etapa
   según lo que la medida dice que la imagen ya trae.

   Tres reglas gobiernan el reparto:
   · El GRANO que se añade va en función del ruido que ya hay, no del
     detalle: a una imagen ya granulada no se le echa más encima.
   · La MICROESTRUCTURA del generador se rompe en función del detalle
     real —remuestreo, ondículas, remedio de la reducción de ruido—:
     una imagen hiperdetallada y regular pide romper esa regularidad;
     una lisa pide textura, no menos.
   · Las etapas CORRECTORAS (rejilla de upsampling, picos espectrales,
     pendiente del espectro, recompresión) sólo se encienden cuando la
     medida encuentra qué corregir, y con la fuerza que esa medida
     dicta. Encender un filtro peine sobre una imagen sin rejilla sólo
     quita nitidez a cambio de nada.
   Devuelve también un informe legible de qué se midió y qué decidió,
   porque un ajuste que no explica sus razones no se puede revisar. */
export function computeRecommendation(canvas){
  const a = analyzeLayer(canvas);
  const unit = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const mix  = (from, to, t) => Math.round(from + (to - from) * t);

  const grid2    = unit(a.peak2,   3,   12);         // tablero de 2 px
  const grid4    = unit(a.peak4,   3,   12);         // tablero de 4 px
  const periodic = unit(a.peakMax, 4,   15);         // cualquier pico aislado fino
  // Un tablero de 2 px es, para el estimador de ruido, ruido puro: lo
  // lee como grano aunque sea una rejilla que la cadena va a quitar
  // antes de llegar al sensor. Se descuenta en proporción a la rejilla
  // detectada para no dejar sin grano una imagen que quedará limpia.
  const noiseEff = a.noise * (1 - 0.85 * grid2);
  const detail   = unit(a.structure, 0.03,  0.45);  // densidad de contornos: 0 lisa · 1 hiperdetallada
  const noise    = unit(noiseEff,    0.004, 0.025); // grano ya presente
  const contrast = unit(a.sd,   0.10,  0.30);
  const colour   = unit(a.satM, 0.12,  0.55);
  const blown    = unit(a.hiF,  0,     0.10);        // altas luces quemadas
  const crushed  = unit(a.loF,  0,     0.10);        // negros empastados
  const big      = unit(a.mp,   0.4,   6);
  const blocky   = unit(a.block,   1.06, 1.30);      // bloques JPEG ya visibles
  // La pendiente sólo tiene sentido con textura que medir: sobre una
  // imagen casi plana el espectro es fuga de ventana, no señal. Y las
  // fotos reales se mueven entre α≈0.8 y 1.3, así que dentro de esa
  // banda no hay nada que corregir.
  const textured = detail > 0.05 || noise > 0.05;
  const slopeDev = textured ? unit(Math.abs(a.alpha - 1.0), 0.15, 0.6) : 0;
  const warm     = unit( a.castTemp, 0.02, 0.15);
  const cool     = unit(-a.castTemp, 0.02, 0.15);
  const green    = unit( a.castTint, 0.01, 0.06);
  const magenta  = unit(-a.castTint, 0.01, 0.06);
  const dark     = unit(0.5 - a.mean, 0, 0.25);
  const bright   = unit(a.mean - 0.5, 0, 0.25);

  /* Objetivo de todo lo que sigue: una réflex de gama media a ISO 200
     con luz de día, guardando en JPEG. Es la foto más corriente que
     existe y por eso la referencia: grano de luminancia apenas
     visible al 100 %, ruido de color casi nulo, una pizca de suavidad
     óptica, viñeteo y aberración discretos y tono neutro.

     La versión anterior apilaba todo a media fuerza y la suma salía
     como una compacta a ISO 6400 con el sensor roto: tres capas de
     grano (sensor, patrón fijo y residuos) más ruido de color al 75 %,
     un desenfoque de 4,5 px para las imágenes lisas —justo las que
     menos lo necesitan— y una normalización espectral que sobre una
     imagen lisa no corrige nada: inyecta alta frecuencia, o sea
     ruido. Cada valor de aquí abajo es más bajo que el de antes por
     esa razón, y los que no lo son van explicados. */
  const P = {
    ...PRESETS['Todo apagado'],
    // Romper la retícula del generador sin emborronar: remuestreo
    // corto y con mezcla parcial, ondículas suaves.
    resample:{on:true, amt:mix(8,22,detail), mix:55},
    wavelet:{on:true, fine:mix(6,22,detail), coarse:mix(3,10,detail), edge:84},
    // Filtro peine sólo si el espectro enseña de verdad un pico en 2 ó
    // 4 px, y con la fuerza que ese pico pide.
    upsamp:{on: grid2 > 0 || grid4 > 0,
            amt:mix(8,50,grid2), amt2:mix(6,36,grid4), edge:72},
    // Perfil de sensor por el DETALLE QUE TIENE LA CÁMARA SIMULADA,
    // no por el que tenga la imagen: «vintage» es un pasa-bajos de
    // 4,5 px y sobre una imagen lisa sólo la deja más lisa aún. Réflex
    // normal, o de alta resolución si la imagen ya viene muy detallada.
    spectral:{on:true, profile:detail>0.7?"hires":"dslr", radius:50},
    // Profundidad de campo: configurada en modo físico y coherente con
    // una apertura moderada, pero apagada — decidir DÓNDE enfocar (qué
    // es el sujeto) no es algo que esta medición pueda deducir.
    dof:{on:false, mode:"physical", fstop:40, focal:29, distance:41, crop:0,
         focusX:50, focusY:50, radius:22, bokeh:45},
    // Óptica: ningún objetivo real es perfecto, pero uno decente casi.
    distort:{on:true, amt:14, edge:30},
    ca:{on:true, lat:mix(10,18,big), fringe:14},
    soft:{on:true, amt:mix(18,10,detail), start:52, astig:12},
    vignette:{on:true, amt:mix(14,24,a.mean), ext:50, desat:10},
    halation:{on:true, str:mix(8,22,blown), thr:mix(78,64,blown), rad:34, tint:55},
    bayer:{on:true, amt:mix(36,52,detail)},
    cfa:{on:true, amt:16, color:45},
    // Grano: UNA fuente principal (el sensor) y las otras dos de
    // acompañamiento, todas por debajo de lo que se ve al 100 %. A
    // más ruido de partida, menos añadido.
    prnu:{on:true, amt:mix(14,6,noise), scale:mix(45,30,big), wafer:8},
    sensor:{on:true, shot:mix(14,5,noise), read:mix(7,3,noise), size:mix(30,38,big),
            blue:36, chr:mix(6,2,noise), band:2, hot:0,
            response:mix(8,3,noise), column:2,
            shadow:mix(6,18,crushed)},
    // Recorte suave: un JPEG de cámara pierde algo en negros y luces,
    // no media escala de grises.
    clip:{on:true, black:mix(2,7,crushed), skew:mix(24,34,contrast), ceil:mix(78,68,blown)},
    // Balance: el error de un AWB real es pequeño y tiende a
    // sobrecorregir la dominante que ve, así que una imagen cálida
    // sale un punto fría y una fría un punto cálida; nunca se empuja
    // una dominante fuerte más en su propia dirección. Exposición: la
    // medición de una cámara tira hacia el gris medio, subiendo una
    // escena oscura y bajando una clara, pero poco: un tercio de paso.
    tone:{on:true,
          temp: Math.round(-5 - 5*warm + 7*cool),
          tint: Math.round(3 - 5*green + 3*magenta),
          exp:  Math.round(1 + 3*dark - 4*bright),
          scur:mix(12,22,contrast), sat:mix(3,-5,colour)},
    // Un ISP real emborrona más cuanto más ruido tiene que tapar; el
    // enfoque y sus halos se notan donde hay contornos que enfocar.
    detail:{on:true, smear:mix(12,26,noise), edge:60, sharp:mix(18,30,detail), rad:40, local:0},
    residual:{on:true, amt:mix(14,5,noise), detail:70, scale:35},
    warp:{on:true, amp:16, freq:46},
    chroma:{on:true, amt:mix(14,26,colour)},
    // Si el origen ya trae bloques de 8 px visibles, no se le pintan
    // más encima ni se le recomprime: es un JPEG de segunda mano y hay
    // que tratarlo como tal.
    jpegtrace:{on:true, block:Math.round(mix(8,20,detail) * (1 - 0.85*blocky)), ring:mix(6,18,detail)},
    periodic:{on: periodic > 0, amt:mix(15,50,periodic), thresh:45, guard:20},
    /* Pendiente espectral: sólo con textura de verdad que medir y con
       la mano muy corta. Una imagen lisa tiene la pendiente alta
       porque ES lisa, no porque la haya estropeado nadie; «normalizar»
       eso hacia 1.0 no arregla nada, sólo mete ruido de alta frecuencia
       en todo el encuadre. */
    hfslope:{on: slopeDev > 0 && detail > 0.25, amt:mix(6,22,slopeDev), target:43, guard:20},
    // Una sola generación a calidad alta: es lo que hace una cámara.
    jpeg:{on:true, q:Math.max(mix(94,90,detail), mix(90,95,blocky)), gens:mix(4,2,blocky)},
    exifmatch:{on:true}
  };

  const level = t => t < 0.33 ? "bajo" : t < 0.66 ? "medio" : "alto";
  const report = [
    `ruido σ ${(noiseEff*100).toFixed(2)} %` + (noise > 0.5 ? " (ya granulada → menos grano)" : ""),
    `detalle ${level(detail)} (${Math.round(a.structure*100)} % contorno)`,
    grid2 > 0 || grid4 > 0
      ? `rejilla ${grid2 >= grid4 ? 2 : 4} px ×${(grid2 >= grid4 ? a.peak2 : a.peak4).toFixed(1)} → upsampling`
      : "sin rejilla de upsampling",
    periodic > 0 ? `pico espectral ×${a.peakMax.toFixed(1)} → limpieza periódica` : null,
    `pendiente α ${a.alpha.toFixed(2)}` + (slopeDev > 0 ? " → normalizada" : " (natural)"),
    blocky > 0 ? `bloques JPEG ×${a.block.toFixed(2)} → menos recompresión` : null,
    warm > 0.2 ? "dominante cálida → balance un punto frío" :
    cool > 0.2 ? "dominante fría → balance un punto cálido" : null,
    dark > 0.4 ? "escena oscura → la medición sube la exposición" :
    bright > 0.4 ? "escena clara → la medición baja la exposición" : null
  ].filter(Boolean);

  return {
    state: normalizeState({stages:presetStages(P), seed:filterState.seed, dose:100}),
    report
  };
}

/* Cálculo sin diálogo (registro de filtros): la misma cadena que el
   botón Aplicar y que el lote, sobre un lienzo cualquiera y con los
   parámetros guardados en la capa. */
async function renderHeadless(src, params){
  if(!engine.available()) throw new Error(engine.lastError() || "WebGL2 no disponible");
  const st = normalizeState(params);
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const cx = c.getContext("2d", { willReadFrequently: true });
  engine.invalidateCache();
  engine.setSeed(st.seed);
  engine.setCameraSeed(st.camSeed);
  if(!engine.setSource(src)) throw new Error("No se pudo preparar la GPU");
  engine.renderTo(cx, st.stages, { dose: st.dose / 100, stable: true });
  await applyCpuStages(c, st.stages, st.dose / 100, () => {});
  engine.invalidateCache();
  return c;
}

/* ── panel ───────────────────────────────────────────────────── */
export async function openCamera(opts = {}){
  if(opts.render) return renderHeadless(opts.render.src, opts.init);
  const edit = opts.edit || null;
  const layer = edit || activeLayer();
  if(!layer){ toast("No hay capa activa"); return; }
  const base = edit ? filterBase(edit) : layer;
  if(!base){ toast("La capa de filtro no tiene ninguna capa debajo", "err"); return; }
  if(opts.init){
    const st = normalizeState(opts.init);
    filterState.stages = st.stages; filterState.seed = st.seed;
    filterState.camSeed = st.camSeed; filterState.dose = st.dose;
  }

  if(!engine.available()){
    await dialog({
      title: "Realify",
      body: `<p class="hint">${engine.lastError() || "WebGL2 no está disponible."}</p>
             <p class="hint">El filtro necesita WebGL2. Prueba con Chrome, Firefox o
                Edge actualizados, y comprueba que la aceleración por hardware esté
                activada en los ajustes del navegador.</p>`,
      buttons: [{ label:"Cerrar", primary:true }]
    });
    return;
  }

  const before = edit ? snapshotLayer(layer) : null;
  original = snapshotLayer(base);
  target = layer;
  if(!engine.setSource(original)){ toast("No se pudo preparar la GPU", "err"); return; }
  engine.invalidateCache();

  const mb = engine.vramEstimate(original.width, original.height) / 1048576;

  const body = document.createElement("div");
  body.className = "cadena-panel";
  body.innerHTML = buildHtml(mb);
  wire(body);
  renderPreview();

  const res = await dialog({
    // En escritorio, a pantalla completa (`dlg-full`): el panel
    // necesita todo el alto para que la miniatura se vea grande Y los
    // mandos queden a la vez en pantalla. En móvil ya no hace falta
    // esa miniatura propia —el lienzo de verdad, mucho más grande,
    // asoma por encima de la hoja compacta, igual que con cualquier
    // otro filtro—, así que Realify se comporta como Brillo/Contraste:
    // una hoja corta con un único desplegable.
    title: isMobile() ? "Realify" : "Realify — simulación de captura",
    body, wide: true, cls: isMobile() ? "dlg-compact" : "dlg-full",
    buttons: [
      { label:"Cancelar", value:null },
      { label: edit ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }
    ]
  });

  // Vaciar el último movimiento pendiente antes de aplicar o cancelar.
  if(previewTimer){ cancelAnimationFrame(previewTimer); previewTimer = null; }
  if(res === "go"){
    // «Solo» es una ayuda de inspección; Aplicar procesa la cadena completa.
    filterState.solo = null;
    // Se cancela la pasada de CPU de la vista previa y se rehace todo
    // desde la GPU, en el mismo orden y con la misma función que
    // acaba de usar la vista previa: mismo camino, mismo resultado.
    if(cpuTimer){ clearTimeout(cpuTimer); cpuTimer = null; }
    cpuTicket++;
    engine.invalidateCache();
    renderPreview(true);
    await applyCpuStages(layer.canvas, filterState.stages, filterState.dose / 100, status);
    // No toca un píxel: sólo deja marcado en el panel EXIF el cuerpo
    // y objetivo cuyos rasgos físicos mejor casan con esta cadena.
    if(filterState.stages.exifmatch.on){
      const match = matchCamera(filterState.stages, layer.canvas.width, layer.canvas.height);
      if(match){
        exifState.body = match.bodyId;
        exifState.lens = match.lensId;
        exifState.last = null;
        exifState.on = true;
        saveExif();
      }
    }
    /* La capa de origen se devuelve a como estaba y el resultado se
       lleva a una capa nueva: así queda el antes debajo del después,
       se puede dosificar con opacidad sin recalcular la cadena, y una
       máscara sobre esa capa aplica Realify sólo donde interese
       —manos, texto o caras suelen pedir otra dosis que el fondo—. */
    const after = snapshotLayer(layer);
    restoreLayer(layer, edit ? before : original);
    commitFilter({
      base, edit, result: after, title: "Realify", filter: "realify",
      params: { stages: filterState.stages, seed: filterState.seed,
                 camSeed: filterState.camSeed, dose: filterState.dose }
    });
    save();
    toast(edit ? "Realify · actualizado" : "Realify · capa nueva", "ok");
    status("");
  } else {
    restoreLayer(layer, edit ? before : original);
    status("");
  }
  filterState.solo = null;
  if(cpuTimer){ clearTimeout(cpuTimer); cpuTimer = null; }
  cpuTicket++;
  if(statsTimer){ clearTimeout(statsTimer); statsTimer = null; }
  original = null; target = null; prevCv = null; prevCx = null;
  histCv = null; specCv = null;
  engine.invalidateCache();
}

/* El panel es la misma lista de mandos en los dos sitios, pero con la
   pantalla de un móvil por delante el reparto es otro por completo.

   En escritorio sigue siendo lo de siempre: miniatura propia,
   histograma y espectro, semillas plegadas y las treinta y una etapas
   en su acordeón con un mando por línea —sobra alto para todo eso—.

   En móvil desaparece la miniatura —el lienzo de verdad, detrás de la
   hoja, ya hace de vista previa, como en cualquier otro filtro— y las
   treinta y una etapas con sus mandos se resuelven con UN solo
   desplegable (`cdFlatPicker`, ver wire()): elegir una entrada ahí
   —«Activar Remuestreo», «Remuestreo: Mezcla», «Semillas y
   memoria»…— es lo único que hace aparecer algo, y sólo eso. Con más
   de ciento cincuenta mandos en la cadena completa, apilarlos o
   plegarlos por etapas seguía siendo una lista larga; con uno solo
   visible a la vez, como Brillo y Contraste, no hay nada que
   desplazar para llegar al que se busca. */
function buildHtml(mb){
  const presetNames = Object.keys(PRESETS);
  const mob = isMobile();
  return `
  ${mob ? "" : `
  <div class="cadena-prevwrap">
    <canvas id="cdPrev"></canvas>
    <div class="cadena-stats">
      <div class="cadena-statbox">
        <span class="cadena-stattitle">Histograma</span>
        <canvas id="cdHist" width="128" height="60"></canvas>
      </div>
      <div class="cadena-statbox">
        <span class="cadena-stattitle">Espectro</span>
        <canvas id="cdSpectrum" width="256" height="256"></canvas>
      </div>
    </div>
  </div>`}

  <div class="cadena-dose">
    <label for="cdDose">Dosis</label>
    <input type="range" id="cdDose" min="0" max="100" step="1"
           value="${filterState.dose}"
           title="Multiplica la fuerza de las ${CHAIN.length} etapas activas a la vez; 0 % conserva el original">
    <span class="unit mono" id="cdDoseV">${filterState.dose}%</span>
    <button id="cdCompare" title="Mantén pulsado para ver el original">Comparar</button>
  </div>

  <div class="cadena-actions">
    <div class="field cadena-preset-field">
      <label>Preset</label>
      <select id="cdPreset" class="grow" aria-label="Preset">
        <option value="">Valores actuales</option>
        ${presetNames.map(n => `<option>${n}</option>`).join("")}
      </select>
    </div>
    <button id="cdRec" title="Mide esta imagen y propone una cadena de captura para ella">Ajuste recomendado</button>
    ${mob ? "" : `<button id="cdOnly" title="Mostrar sólo las etapas encendidas">Sólo activas</button>`}
    <button id="cdAll">Apagar todo</button>
    <button id="cdVary" title="Desvía cada valor y sortea semilla">Variar</button>
  </div>

  <div class="cadena-top" id="cdRecRow" hidden>
    <span class="hint" id="cdRecInfo" style="margin:0"></span>
  </div>

  ${mob ? flatPickerHtml() : `
  <details class="cadena-adv" open>
    <summary>Semillas y memoria</summary>
    <div class="cadena-advbody">
      ${seedsBodyHtml(mb)}
    </div>
  </details>

  <div class="cadena-stages">
    ${CHAIN.map((s, i) => stageHtml(s, i, false)).join("")}
  </div>`}`;
}

function seedsBodyHtml(mb){
  return `
      <div class="cadena-top">
        <div class="field" style="margin:0">
          <label style="width:auto">Semilla</label>
          <input type="number" id="cdSeed" style="width:82px" value="${filterState.seed}"
                 title="El disparo concreto: cambia el grano y las variaciones aleatorias">
          <button id="cdNewSeed" class="icon" title="Nueva semilla de disparo">⟳</button>
        </div>
        <div class="field" style="margin:0">
          <label style="width:auto">Cámara</label>
          <input type="number" id="cdCamSeed" style="width:82px" value="${filterState.camSeed}"
                 title="Identifica el sensor simulado: su patrón fijo por píxel. Déjala igual en todas las fotos que deban parecer de la misma cámara">
          <button id="cdNewCamSeed" class="icon" title="Otro sensor">⟳</button>
        </div>
      </div>
      <p class="hint" style="margin:6px 0 0">La semilla de <b>cámara</b> fija el patrón de
        respuesta del sensor, que en un equipo real es idéntico en todas sus fotos. Mantenla
        sin tocar en un lote y todas compartirán esa huella; cámbiala y será como haber
        usado otro cuerpo.</p>
      ${mb > 700 ? `<p class="hint" style="color:var(--warn)">La cadena completa puede usar hasta
         ${Math.round(mb)} MB de memoria de vídeo. Si va a tirones, reduce la imagen
         antes de aplicar el filtro.</p>` : ""}`;
}

/* Un único desplegable para las treinta y una etapas: cada una es un
   <optgroup> con su «Activar esta etapa» primero y luego un ítem por
   mando, más uno propio para las semillas. Debajo, un solo hueco
   (`#cdFlatResult`) enseña lo que toque según lo elegido —el mismo
   `.cstage`/`.cparam` de siempre, sólo que sacado de la lista y
   mostrado suelto—, así que toda la maquinaria de `wire()` que ya
   sabía leer esos elementos (interruptores, aislar, deslizadores,
   `syncControls`, «Ajuste recomendado»…) sigue funcionando sin tocarla:
   sigue viendo las mismas capas de siempre, unas ocultas y una a la
   vista. */
function flatPickerHtml(){
  const options = CHAIN.map((s, i) => `
    <optgroup label="${i + 1}. ${s.name}">
      <option value="toggle:${s.id}">Activar / desactivar</option>
      ${s.params.map(pr => `<option value="param:${s.id}:${pr.k}">${pr.label}</option>`).join("")}
    </optgroup>`).join("");
  return `
  <select id="cdFlatPicker" class="grow cparam-picker" aria-label="Elegir mando de Realify">
    <option value="" selected>— Elige un mando —</option>
    <option value="seeds">Semillas y memoria</option>
    ${options}
  </select>
  <div id="cdFlatResult">
    <div class="cadena-advbody" data-picker-key="seeds" hidden>
      ${seedsBodyHtml(0)}
    </div>
    <div class="cadena-stages flat">
      ${CHAIN.map((s, i) => stageHtml(s, i, true)).join("")}
    </div>
  </div>`;
}

function stageHtml(s, i, flat){
  const st = filterState.stages[s.id];
  return `
  <section class="cstage${st.on ? " on" : ""}"${flat ? ` data-picker-key="stage:${s.id}" hidden` : ""} data-id="${s.id}">
    <header class="chead"${flat ? ' style="cursor:default"' : ""}>
      <span class="cnum">${i + 1}</span>
      ${flat ? "" : `<span class="ccaret" aria-hidden="true">›</span>`}
      <span class="cname">${s.name}</span>
      <button class="csolo icon" title="Aislar esta etapa">S</button>
      <input type="checkbox" class="sw" ${st.on ? "checked" : ""}
             aria-label="Activar ${s.name}">
    </header>
    <div class="cbody">
      ${flat ? "" : `<p class="hint cnote">${s.note}</p>`}
      <div class="cparams-list">
        ${s.params.map(pr => paramHtml(s, pr, flat)).join("")}
      </div>
    </div>
  </section>`;
}

function paramHtml(s, pr, flat){
  const st = filterState.stages[s.id];
  // En el desplegable único, el nombre del mando ya lo dice la opción
  // elegida: repetirlo en la etiqueta de debajo sería decirlo dos
  // veces seguidas, así que aquí no se escribe en absoluto (no sólo se
  // esconde por CSS, como con el resto de paneles con desplegable).
  const hideAttr = flat ? " hidden" : "";
  if(pr.type === "choice"){
    const val = st.p[pr.k];
    return `
    <div class="cparam cparam-choice" data-stage="${s.id}" data-key="${pr.k}"${hideAttr}>
      <div class="clabel">${flat ? "" : `<span>${pr.label}</span>`}</div>
      <select class="grow" aria-label="${s.name}: ${pr.label}">
        ${pr.options.map(o => `<option value="${o.v}"${o.v === val ? " selected" : ""}>${o.label}</option>`).join("")}
      </select>
    </div>`;
  }
  const min = pr.min ?? 0;
  return `
  <div class="cparam" data-stage="${s.id}" data-key="${pr.k}"${hideAttr}>
    <div class="clabel">${flat ? "" : `<span>${pr.label}</span>`}<span class="cval mono">${st.p[pr.k]}</span></div>
    <input type="range" min="${min}" max="100" step="1" value="${st.p[pr.k]}"
           aria-label="${s.name}: ${pr.label}">
  </div>`;
}

function wire(body){
  const q = sel => body.querySelector(sel);

  prevCv = q("#cdPrev");
  prevCx = prevCv ? prevCv.getContext("2d", { willReadFrequently: true }) : null;
  if(prevCv && original) sizeThumb(prevCv, original.width, original.height);
  histCv = q("#cdHist");
  specCv = q("#cdSpectrum");

  /* Plegado de etapas. En móvil sólo una abierta a la vez: con el
     espacio que hay, dos cuerpos desplegados dejan el segundo fuera de
     la pantalla y obligan a desplazar a ciegas. Al abrirla se sube
     hasta su cabecera, que si no queda debajo del borde cuando la
     anterior era larga. */
  const mob = isMobile();

  /* La explicación de cada etapa vale su espacio en un monitor, pero en
     un móvil son cuatro líneas de prosa por delante de los mandos que
     se venía a tocar. Se recorta a dos y se abre entera al tocarla. */
  if(mob){
    body.querySelectorAll(".cnote").forEach(n => {
      n.addEventListener("click", () => n.classList.toggle("open"));
    });
  }

  /* El desplegable único de móvil (ver flatPickerHtml): elegir una
     entrada enseña UN solo bloque marcado con `data-picker-key` —el
     de las semillas, o la etapa entera que le toca a ese mando— y
     esconde todos los demás; dentro de la etapa que queda a la vista,
     además, sólo el `.cparam` elegido (o ninguno, si lo elegido era
     «Activar/desactivar»). No reconstruye nada: son los mismos nodos
     de siempre, los mismos que ya sabe leer el resto de wire() más
     abajo —interruptores, aislar, deslizadores…—, sólo que ocultos o
     visibles según toque. */
  const flatPicker = q("#cdFlatPicker");
  if(flatPicker){
    const showOnly = key => {
      body.querySelectorAll("[data-picker-key]").forEach(el => { el.hidden = el.dataset.pickerKey !== key; });
    };
    flatPicker.addEventListener("change", () => {
      const v = flatPicker.value;
      if(!v){ showOnly(null); return; }
      if(v === "seeds"){ showOnly("seeds"); return; }
      const [kind, id, key] = v.split(":");
      showOnly("stage:" + id);
      const stage = body.querySelector(`.cstage[data-id="${id}"]`);
      stage.querySelectorAll(".cparam").forEach(c => {
        c.hidden = !(kind === "param" && c.dataset.key === key);
      });
    });
  }

  if(!mob){
    body.querySelectorAll(".chead").forEach(h => {
      h.addEventListener("click", e => {
        if(e.target.closest("input,button")) return;
        const sec = h.parentElement;
        sec.classList.toggle("collapsed");
      });
    });
  }

  // Interruptores
  body.querySelectorAll(".cstage .sw").forEach(sw => {
    sw.addEventListener("change", () => {
      const id = sw.closest(".cstage").dataset.id;
      filterState.stages[id].on = sw.checked;
      sw.closest(".cstage").classList.toggle("on", sw.checked);
      engine.invalidateCache();
      schedulePreview();
    });
  });

  // Aislar
  body.querySelectorAll(".csolo").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const id = b.closest(".cstage").dataset.id;
      filterState.solo = filterState.solo === id ? null : id;
      body.querySelectorAll(".csolo").forEach(x => x.classList.remove("on"));
      if(filterState.solo) b.classList.add("on");
      engine.invalidateCache();
      schedulePreview();
    });
  });

  // Deslizadores de parámetro
  body.querySelectorAll(".cparam input").forEach(r => {
    const wrap = r.closest(".cparam");
    const id = wrap.dataset.stage, key = wrap.dataset.key;
    const val = wrap.querySelector(".cval");
    r.addEventListener("pointerdown", () => {
      // Congela lo anterior de la cadena para que arrastrar vaya fluido
      const st = CHAIN_BY_ID[id];
      if(!st.cpu) engine.buildCache(filterState.stages, filterState.dose / 100,
                                    filterState.solo, engine.STEP_INDEX[id]);
    });
    const release = () => engine.invalidateCache();
    r.addEventListener("pointerup", release);
    r.addEventListener("blur", release);
    r.addEventListener("input", () => {
      filterState.stages[id].p[key] = +r.value;
      val.textContent = valueLabel(id, key);
      q("#cdPreset").value = "";
      schedulePreview();
    });
  });

  // Selectores (parámetros de tipo "choice", como el tipo de arrastre)
  body.querySelectorAll(".cparam-choice select").forEach(sel => {
    const wrap = sel.closest(".cparam");
    const id = wrap.dataset.stage, key = wrap.dataset.key;
    sel.addEventListener("change", () => {
      filterState.stages[id].p[key] = sel.value;
      q("#cdPreset").value = "";
      engine.invalidateCache();
      schedulePreview();
    });
  });

  // Dosis
  const dose = q("#cdDose"), doseV = q("#cdDoseV");
  dose.addEventListener("input", () => {
    filterState.dose = +dose.value;
    doseV.textContent = dose.value + "%";
    refreshValueLabels(body);
    engine.invalidateCache();
    schedulePreview();
  });

  // Semilla
  const seed = q("#cdSeed");
  seed.addEventListener("change", () => {
    filterState.seed = Math.round(Math.max(0, Math.min(99999, +seed.value || 0)));
    seed.value = filterState.seed;
    engine.invalidateCache();
    schedulePreview();
  });
  q("#cdNewSeed").addEventListener("click", () => {
    filterState.seed = Math.floor(Math.random() * 99999);
    seed.value = filterState.seed;
    engine.invalidateCache();
    schedulePreview();
  });

  /* Semilla de cámara. Deliberadamente aparte de la de disparo: ni
     «Variar» ni el ⟳ de al lado la tocan, porque lo que da coherencia a
     un lote es justamente que ésta no se mueva. */
  const camSeed = q("#cdCamSeed");
  const setCam = value => {
    filterState.camSeed = Math.round(Math.max(0, Math.min(99999, value || 0)));
    camSeed.value = filterState.camSeed;
    engine.setCameraSeed(filterState.camSeed);
    engine.invalidateCache();
    schedulePreview();
  };
  camSeed.addEventListener("change", () => setCam(+camSeed.value));
  q("#cdNewCamSeed").addEventListener("click", () => setCam(Math.floor(Math.random() * 99999)));

  // Presets
  q("#cdPreset").addEventListener("change", e => {
    const pr = PRESETS[e.target.value];
    if(!pr) return;
    filterState.stages = presetStages(pr);
    filterState.solo = null;
    body.querySelectorAll(".csolo").forEach(b => b.classList.remove("on"));
    syncControls(body);
    engine.invalidateCache();
    schedulePreview();
  });

  /* Filtrar la lista a las etapas encendidas. Con treinta y una en la
     cadena, la mitad de los toques se iban en recorrer cabeceras
     apagadas buscando la que se estaba ajustando. Sólo existe en
     escritorio: en móvil ya no hay una lista que recorrer —el
     desplegable único la sustituye—, así que el botón ni se genera. */
  const onlyBtn = q("#cdOnly");
  if(onlyBtn){
    const stagesBox = q(".cadena-stages");
    onlyBtn.addEventListener("click", () => {
      const only = stagesBox.classList.toggle("only-on");
      onlyBtn.classList.toggle("on", only);
    });
  }

  // Apagar o encender todo
  let memory = null;
  const allBtn = q("#cdAll");
  const allOff = () => !CHAIN.some(s => filterState.stages[s.id].on);
  const syncAll = () => { allBtn.textContent = allOff() ? "Encender todo" : "Apagar todo"; };
  allBtn.addEventListener("click", () => {
    if(!allOff()){
      memory = Object.fromEntries(CHAIN.map(s => [s.id, filterState.stages[s.id].on]));
      CHAIN.forEach(s => filterState.stages[s.id].on = false);
    } else if(memory){
      CHAIN.forEach(s => filterState.stages[s.id].on = memory[s.id] !== false);
    } else {
      CHAIN.forEach(s => filterState.stages[s.id].on = true);
    }
    syncControls(body); syncAll();
    engine.invalidateCache();
    schedulePreview();
  });
  syncAll();

  // Comparar: mantener pulsado enseña el original sin tocar el estado
  const cmpBtn = q("#cdCompare");
  const showOriginal = () => { target.ctx.save(); target.ctx.globalCompositeOperation = "copy";
    target.ctx.drawImage(original, 0, 0); target.ctx.restore(); emit("doc:change");
    paintThumb(); };
  const showPreview = () => renderPreview();
  cmpBtn.addEventListener("pointerdown", e => { e.preventDefault(); showOriginal(); });
  ["pointerup","pointerleave","pointercancel"].forEach(ev => cmpBtn.addEventListener(ev, showPreview));

  /* Variar: veinte exportaciones con la misma configuración comparten
     firma de ruido. Ésta es la cura. */
  q("#cdVary").addEventListener("click", () => {
    varyStages(filterState.stages);
    filterState.seed = Math.floor(Math.random() * 99999);
    seed.value = filterState.seed;
    q("#cdPreset").value = "";
    syncControls(body);
    engine.invalidateCache();
    schedulePreview();
  });

  wireRecommendation(body, {
    recommend:()=>computeRecommendation(original),
    before:()=>{
      if(previewTimer){cancelAnimationFrame(previewTimer);previewTimer=null;}
      engine.invalidateCache();
    },
    accept:({state})=>{
      Object.assign(filterState,normalizeState(state));
      q("#cdPreset").value="";
      q("#cdDose").value=filterState.dose;q("#cdDoseV").textContent=filterState.dose+"%";
      q("#cdSeed").value=filterState.seed;
      body.querySelectorAll(".csolo").forEach(b=>b.classList.remove("on"));
      syncControls(body);
      syncAll();
    },
    after:()=>{engine.invalidateCache();renderPreview();}
  });
}

/* Etiqueta del valor de un mando. Con la dosis por debajo del 100 %
   enseña también el valor EFECTIVO —«50 → 25»—, porque la dosis es
   relativa a cada mando y sin verlo escrito no hay forma de saber que
   lo es: el deslizador se queda en 50 y lo que se aplica es 25. */
function valueLabel(id, key){
  const raw = filterState.stages[id].p[key];
  const dose = filterState.dose / 100;
  if(dose >= 1) return String(raw);
  const eff = engine.effParams(filterState.stages, id, dose)[key];
  const shown = Math.round(eff);
  return shown === raw ? String(raw) : `${raw} → ${shown}`;
}

function refreshValueLabels(body){
  body.querySelectorAll(".cparam:not(.cparam-choice)").forEach(wrap => {
    wrap.querySelector(".cval").textContent = valueLabel(wrap.dataset.stage, wrap.dataset.key);
  });
}

function syncControls(body){
  body.querySelectorAll(".cstage").forEach(el => {
    const id = el.dataset.id;
    const st = filterState.stages[id];
    el.classList.toggle("on", st.on);
    el.querySelector(".sw").checked = st.on;
  });
  body.querySelectorAll(".cparam").forEach(wrap => {
    const v = filterState.stages[wrap.dataset.stage].p[wrap.dataset.key];
    if(wrap.classList.contains("cparam-choice")){
      wrap.querySelector("select").value = v;
      return;
    }
    wrap.querySelector("input").value = v;
    wrap.querySelector(".cval").textContent = valueLabel(wrap.dataset.stage, wrap.dataset.key);
  });
}

export { engine };
