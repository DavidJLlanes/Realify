/* ══════════════════════════════════════════════════════════════
   SEGUNDA OPINIÓN
   Tres detectores forenses publicados, escritos desde la descripción
   del método y no de lo que hace la cadena. No saben nada de ella y
   pueden llevarle la contraria; ahí está su valor.
   ══════════════════════════════════════════════════════════════ */

import { fft1d } from "./fft.js";
import { clamp01, sampleOut } from "./metrics.js";

export function detectCFA(img){
  const {data:px, width:w, height:h} = img;
  const sum = [0,0,0,0], sum2 = [0,0,0,0], n = [0,0,0,0];

  for(let ch = 0; ch < 3; ch += 2){          // rojo y azul: los más interpolados
    for(let y = 2; y < h-2; y++){
      for(let x = 2; x < w-2; x++){
        const i = (y*w + x)*4 + ch;
        const pred = (px[i-4] + px[i+4] + px[i-w*4] + px[i+w*4])*0.25;
        const r = px[i] - pred;
        const k = (y & 1)*2 + (x & 1);
        sum[k] += r; sum2[k] += r*r; n[k]++;
      }
    }
  }
  const varf = [0,1,2,3].map(k => n[k] ? sum2[k]/n[k] - Math.pow(sum[k]/n[k], 2) : 0);
  const mean = varf.reduce((a,b)=>a+b,0)/4;
  if(mean < 1e-6) return {v:0, raw:0, verdict:"sin señal"};

  // Dispersión relativa entre las cuatro fases del mosaico
  const raw = (Math.max.apply(null, varf) - Math.min.apply(null, varf))/mean;
  return {
    v: clamp01(raw/0.55),
    raw,
    verdict: raw > 0.30 ? "patrón de mosaico presente"
           : raw > 0.12 ? "traza débil de mosaico"
           : "sin patrón de mosaico"
  };
}

/* ── 2. Análisis de nivel de error (ELA) ─────────────────
   Se recomprime la imagen a una calidad conocida y se mira cuánto
   cambia cada zona. Una imagen con un historial de compresión
   homogéneo cambia de forma pareja en todas partes; un montaje, o
   una zona generada y pegada, salta porque llega al recodificado
   con otro nivel de error acumulado.
   Aquí interesa la homogeneidad: es lo que tiene una foto que ha
   pasado entera por el mismo camino. */
export async function detectELA(view, quality, mapCanvas){
  const q = quality === undefined ? 0.90 : quality;
  const blob = await new Promise(r=>view.toBlob(r, "image/jpeg", q));
  if(!blob) return {v:0.5, raw:0, verdict:"no evaluable"};

  const bmp = await createImageBitmap(blob);
  const W = Math.min(480, view.width), H = Math.min(480, view.height);
  const sx = (view.width - W)>>1, sy = (view.height - H)>>1;

  const c1 = document.createElement("canvas"); c1.width = W; c1.height = H;
  const c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
  const x1 = c1.getContext("2d", {willReadFrequently:true});
  const x2 = c2.getContext("2d", {willReadFrequently:true});
  x1.drawImage(view, sx, sy, W, H, 0, 0, W, H);
  x2.drawImage(bmp,  sx, sy, W, H, 0, 0, W, H);
  bmp.close();

  const a = x1.getImageData(0,0,W,H).data;
  const b = x2.getImageData(0,0,W,H).data;

  // Error medio por bloque de 16×16
  const B = 16, blocks = [];
  for(let by = 0; by + B <= H; by += B){
    for(let bx = 0; bx + B <= W; bx += B){
      let e = 0;
      for(let y = by; y < by+B; y++){
        for(let x = bx; x < bx+B; x++){
          const i = (y*W + x)*4;
          e += Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
        }
      }
      blocks.push(e/(B*B*3));
    }
  }
  if(blocks.length < 4) return {v:0.5, raw:0, verdict:"imagen demasiado pequeña"};

  const mean = blocks.reduce((s,v)=>s+v,0)/blocks.length;
  if(mean < 0.05) return {v:0.35, raw:0, verdict:"sin error: no había compresión previa"};
  const sd = Math.sqrt(blocks.reduce((s,v)=>s+Math.pow(v-mean,2),0)/blocks.length);
  const raw = sd/mean;                    // coeficiente de variación

  // Pintar el mapa, que dice más de un vistazo que el número
  const cv = mapCanvas;
  if(cv){
    cv.width = W; cv.height = H;
    const cx = cv.getContext("2d");
    const out = cx.createImageData(W, H);
    for(let i = 0; i < W*H; i++){
      const j = i*4;
      const e = Math.min(255, (Math.abs(a[j]-b[j]) + Math.abs(a[j+1]-b[j+1]) + Math.abs(a[j+2]-b[j+2]))*8);
      out.data[j] = 14 + e*0.90; out.data[j+1] = 18 + e*0.77; out.data[j+2] = 22 + e*0.47;
      out.data[j+3] = 255;
    }
    cx.putImageData(out, 0, 0);
    cv.style.display = "block";
  }

  return {
    v: clamp01(1 - (raw - 0.35)/0.95),
    raw,
    verdict: raw < 0.55 ? "error homogéneo en toda la imagen"
           : raw < 0.95 ? "error algo irregular"
           : "error muy irregular entre zonas"
  };
}

/* ── 3. Peine de cuantización en el histograma ─────────────
   Cada codificación JPEG cuantiza, y al descodificar los valores no
   vuelven a repartirse de forma continua: quedan huecos periódicos.
   Comprimir varias veces marca ese peine todavía más. Una imagen
   recién salida de un generador, que nunca ha pasado por un códec
   con pérdida, tiene el histograma liso. */
/* Espectro del histograma de un canal: devuelve cuánto destaca la
   raya periódica más fuerte sobre el fondo de su banda, y a qué paso
   de cuantización corresponde. */
export function combSpectrum(px, n, ch){
  const N = 256;
  const hist = new Float64Array(N);
  for(let i = 0; i < n; i++) hist[px[i*4 + ch]]++;

  let mean = 0;
  for(let i = 0; i < N; i++) mean += hist[i];
  mean /= N;

  const re = new Float64Array(N), im = new Float64Array(N);
  for(let i = 0; i < N; i++){
    const wnd = 0.5 - 0.5*Math.cos(2*Math.PI*i/(N-1));   // Hann
    re[i] = (hist[i] - mean)*wnd;
  }
  fft1d(re, im, N);

  /* Banda útil: de k=16 a k=128, o sea pasos de cuantización de 16
     niveles a 2, que es el rango que dejan las calidades JPEG con las
     que se trabaja. Por debajo de k=16 manda todavía la forma de la
     escena, y colaba falsos positivos con periodos de 26 niveles que
     ningún códec produce. */
  const LO = 16, HI = 128;
  const mag = [];
  for(let k = LO; k <= HI; k++) mag.push(Math.hypot(re[k], im[k]));

  const sorted = mag.slice().sort((a,b)=>a-b);
  const med = sorted[sorted.length>>1];
  let peak = 0, peakI = 0;
  for(let i = 0; i < mag.length; i++) if(mag[i] > peak){ peak = mag[i]; peakI = i; }

  /* Un peine no es una sinusoide: son deltas, y una serie de deltas
     tiene armónicos fuertes en 2f, 3f… A menudo el segundo armónico
     pega más que el fundamental, y quedarse con el máximo devolvía
     exactamente la mitad del paso real. El fundamental es la raya de
     frecuencia más baja que aún destaca, no la más alta. */
  let fundI = peakI;
  for(let i = 0; i < mag.length; i++){
    if(mag[i] >= peak*0.45){ fundI = i; break; }
  }

  const ratio = med > 1e-9 ? peak/med : 0;
  return {ratio, step: Math.max(2, Math.round(N/(LO + fundI)))};
}

export function detectComb(img){
  const {data:px, width:w, height:h} = img;
  const n = w*h;

  /* Por canal, no sobre la luminancia. La cuantización deja valores
     múltiplos de un paso en cada canal, pero la luma es una
     combinación con pesos no enteros (0.2126, 0.7152, 0.0722): al
     mezclarlos el peine se difumina y el detector se queda ciego.
     Se mira cada canal y manda el que dé la señal más clara. */
  let best = {ratio:0, step:0};
  for(let ch = 0; ch < 3; ch++){
    const r = combSpectrum(px, n, ch);
    if(r.ratio > best.ratio) best = r;
  }

  const raw = best.ratio;
  return {
    v: clamp01((raw - 4)/16),
    raw, lag: best.step,
    verdict: raw > 12 ? "cuantización marcada, paso ≈" + best.step + " niveles"
           : raw > 7  ? "traza de cuantización (paso ≈" + best.step + ")"
           : "histograma liso: sin paso por códec"
  };
}

export const FORENSICS = [
  {k:"cfa",  name:"Correlación CFA",
   sub:"Popescu y Farid, 2005",
   fmt:d=>d.raw.toFixed(3),
   want:"Una captura real tiene mosaico. Un render, no."},
  {k:"ela",  name:"Nivel de error (ELA)",
   sub:"homogeneidad del error de recompresión",
   fmt:d=>"CV " + d.raw.toFixed(2),
   want:"Cuanto más parejo, más coherente el historial de compresión."},
  {k:"comb", name:"Peine de cuantización",
   sub:"huecos periódicos en el histograma",
   fmt:d=>"\u00d7" + d.raw.toFixed(1),
   want:"Delata el paso por un códec con pérdida, y con qué paso."}
];


export async function runAll(view, mapCanvas){
  const img = sampleOut(view, 640);
  const res = { cfa: detectCFA(img), comb: detectComb(img) };
  try{ res.ela = await detectELA(view, 0.90, mapCanvas); }
  catch(err){ res.ela = { v:0.5, raw:0, verdict:"no evaluable en este navegador" }; }
  return res;
}
