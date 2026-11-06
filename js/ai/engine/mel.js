/* ═══════════════════════════════════════════════════════════════
   IA · ESPECTROGRAMA LOG-MEL DE WHISPER (puro, sin DOM)
   Reproduce el WhisperFeatureExtractor: audio mono a 16 kHz, 30 s (se rellena con ceros o se recorta), ventana de Hann de 400 muestras,
   salto de 160, STFT con reflejo en los bordes, potencia, 80 filtros mel (escala y norma de Slaney), log10 con suelo 1e-10, recorte a
   (máximo − 8) y (x + 4) / 4. Entradas: Float32Array de muestras. Salida: Float32Array [80 × 3000] (filas = mel, columnas = tiempo).
   Límites: DFT directa de 400 puntos (201 bins) con tablas precalculadas, sin FFT: unos 0,3 s por 30 s de audio; sin recorte de silencios.
   ═══════════════════════════════════════════════════════════════ */
export const SR = 16000, NFFT = 400, HOP = 160, NMEL = 80, NSAMP = 480000, NFR = 3000, NBIN = NFFT / 2 + 1;

const hz2mel = f => f < 1000 ? f * 3 / 200 : 15 + Math.log(f / 1000) / (Math.log(6.4) / 27);
const mel2hz = m => m < 15 ? m * 200 / 3 : 1000 * Math.exp((Math.log(6.4) / 27) * (m - 15));

let banco = null;
export function filtrosMel(){
  if(banco) return banco;
  const fr = Array.from({ length: NBIN }, (_, i) => i * SR / NFFT), lo = hz2mel(0), hi = hz2mel(SR / 2);
  const pts = Array.from({ length: NMEL + 2 }, (_, i) => mel2hz(lo + (hi - lo) * i / (NMEL + 1)));
  banco = new Float32Array(NMEL * NBIN);
  for(let m = 0; m < NMEL; m++){
    const enorm = 2 / (pts[m + 2] - pts[m]);
    for(let k = 0; k < NBIN; k++){
      const subida = (fr[k] - pts[m]) / (pts[m + 1] - pts[m]), bajada = (pts[m + 2] - fr[k]) / (pts[m + 2] - pts[m + 1]);
      banco[m * NBIN + k] = Math.max(0, Math.min(subida, bajada)) * enorm;
    }
  }
  return banco;
}

/* Tablas de la DFT de 400 puntos (sólo los 201 bins no negativos) y ventana de Hann periódica. */
let cos = null, sin = null, ventana = null;
function tablas(){
  if(cos) return;
  cos = new Float32Array(NBIN * NFFT); sin = new Float32Array(NBIN * NFFT); ventana = new Float32Array(NFFT);
  for(let n = 0; n < NFFT; n++) ventana[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / NFFT);
  for(let k = 0; k < NBIN; k++) for(let n = 0; n < NFFT; n++){ const a = 2 * Math.PI * k * n / NFFT; cos[k * NFFT + n] = Math.cos(a); sin[k * NFFT + n] = Math.sin(a); }
}

export function logMel(audio){
  tablas();
  const x = new Float32Array(NSAMP + NFFT);                       // reflejo de NFFT/2 muestras a cada lado (center=True)
  const n = Math.min(audio.length, NSAMP), medio = NFFT / 2;
  const base = new Float32Array(NSAMP); base.set(audio.subarray(0, n));
  for(let i = 0; i < NSAMP; i++) x[i + medio] = base[i];
  for(let i = 0; i < medio; i++){ x[medio - 1 - i] = base[Math.min(NSAMP - 1, i + 1)]; x[medio + NSAMP + i] = base[Math.max(0, NSAMP - 2 - i)]; }
  const filtros = filtrosMel(), pot = new Float32Array(NBIN), out = new Float32Array(NMEL * NFR), tramo = new Float32Array(NFFT);
  let maximo = -Infinity;
  for(let t = 0; t < NFR; t++){
    for(let i = 0; i < NFFT; i++) tramo[i] = x[t * HOP + i] * ventana[i];
    for(let k = 0; k < NBIN; k++){
      let re = 0, im = 0; const o = k * NFFT;
      for(let i = 0; i < NFFT; i++){ re += tramo[i] * cos[o + i]; im -= tramo[i] * sin[o + i]; }
      pot[k] = re * re + im * im;
    }
    for(let m = 0; m < NMEL; m++){
      let s = 0; const o = m * NBIN;
      for(let k = 0; k < NBIN; k++) s += filtros[o + k] * pot[k];
      const v = Math.log10(Math.max(s, 1e-10)); out[m * NFR + t] = v; if(v > maximo) maximo = v;
    }
  }
  const suelo = maximo - 8;
  for(let i = 0; i < out.length; i++) out[i] = (Math.max(out[i], suelo) + 4) / 4;
  return out;
}
