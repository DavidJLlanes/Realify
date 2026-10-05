/* ═══════════════════════════════════════════════════════════════
   FILTRO REALIFY
   Simulación de la cadena de captura de una cámara: óptica, sensor,
   revelado y códec, en 31 etapas (chain.js) calculadas en la GPU
   (engine.js) más las de CPU (cpustages.js).

   Aquí viven el estado persistente, la medición de la imagen para el
   ajuste recomendado y el cálculo sin ventana que usan el registro de
   filtros y el procesado por lotes. La ventana a pantalla completa
   está en editor.js y su hoja de estilos en realify.css.
   ═══════════════════════════════════════════════════════════════ */

import { activeLayer } from "../../core/doc.js";
import { dialog } from "../../ui/dialog.js";
import { toast } from "../../ui/toast.js";
import { PRESETS } from "./presets.js";
import { normalizeState, presetStages } from "./state.js";
import { commitFilter, filterBase } from "../../editor/filterlayer.js";
import { attachFloatResult } from "../../editor/floatfilter.js";
import { hiCoversCanvas } from "../../core/hisrc.js";
import { matchCamera } from "./exifmatch.js";
import { exifState, saveExif } from "../../exif/ui.js";
import { spectralStats } from "./spectralclean.js";
import { applyCpuStages } from "./cpustages.js";
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
    camSeed: filterState.camSeed, dose: filterState.dose, premium: !!filterState.premium
  })); }catch{}
}

function snapshotLayer(l){
  const c = document.createElement("canvas");
  c.width = l.canvas.width; c.height = l.canvas.height;
  c.getContext("2d").drawImage(l.canvas, 0, 0);
  return c;
}

/* La hoja de estilos de la ventana no depende de index.html. */
function ensureStyles(){
  const href = new URL("./realify.css", import.meta.url).href;
  if(document.querySelector('link[href$="camera/realify.css"]') ||
     [...document.styleSheets].some(x => x.href === href)) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
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
  engine.setPremium(st.premium);
  if(!engine.setSource(src)) throw new Error("No se pudo preparar la GPU");
  engine.renderTo(cx, st.stages, { dose: st.dose / 100, stable: true });
  await applyCpuStages(c, st.stages, st.dose / 100, () => {});
  engine.invalidateCache();
  return c;
}

/* ── ventana ─────────────────────────────────────────────────── */
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
    filterState.premium = st.premium;
  }
  // «Realify Premium 👑» del menú y del cajón abre con el motor Premium
  if(opts.premium) filterState.premium = true;

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

  const original = snapshotLayer(base);
  if(!engine.setSource(original)){ toast("No se pudo preparar la GPU", "err"); return; }
  engine.invalidateCache();
  await ensureStyles();
  const { openRealifyEditor } = await import("./editor.js");

  openRealifyEditor({
    source: original, state: filterState, editing: !!edit,
    title: "Realify — simulación de captura",
    recommend: () => computeRecommendation(original),
    hiSrc: hiCoversCanvas(base) && base.hiSrc.w === original.width && base.hiSrc.h === original.height ? base.hiSrc : null,
    onAccept: async (result, fres) => {
      // No toca un píxel: sólo deja marcado en el panel EXIF el cuerpo
      // y objetivo cuyos rasgos físicos mejor casan con esta cadena.
      if(filterState.stages.exifmatch.on){
        const match = matchCamera(filterState.stages, result.width, result.height);
        if(match){
          exifState.body = match.bodyId; exifState.lens = match.lensId;
          exifState.last = null; exifState.on = true;
          saveExif();
        }
      }
      /* El resultado va a una capa nueva sobre la de origen: queda el
         antes debajo del después, se puede dosificar con opacidad sin
         recalcular la cadena, y una máscara aplica Realify sólo donde
         interese —manos, texto o caras suelen pedir otra dosis—. */
      const made = commitFilter({
        base, edit, result, title: "Realify", filter: "realify",
        params: { stages: filterState.stages, seed: filterState.seed,
                   camSeed: filterState.camSeed, dose: filterState.dose, premium: !!filterState.premium }
      });
      if(fres && made){ attachFloatResult(made, { hiSrc: { dither: true } }, fres); } else if(made && edit) delete made.hiSrc;
      save();
      toast((edit ? "Realify · actualizado" : "Realify · capa nueva") + (fres ? " · 16 bits conservados" : ""), "ok");
    },
    onClose: () => { filterState.solo = null; engine.invalidateCache(); }
  });
}

export { engine };
