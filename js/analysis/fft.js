/* Transformada de Fourier y espectro. Los modelos de difusión dejan
   una rejilla periódica en el espectro, herencia de las capas de
   sobremuestreo, y es el indicio más usado por los detectores. */

export const FN = 256;

/* Cooley-Tukey iterativo, in-place, n potencia de dos. */
export function fft1d(re, im, n){
  for(let i=1, j=0; i<n; i++){
    let bit = n>>1;
    for(; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if(i < j){
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for(let len = 2; len <= n; len <<= 1){
    const ang = -2*Math.PI/len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len>>1;
    for(let i = 0; i < n; i += len){
      let cr = 1, ci = 0;
      for(let k = 0; k < half; k++){
        const a = i+k, b = i+k+half;
        const vr = re[b]*cr - im[b]*ci;
        const vi = re[b]*ci + im[b]*cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] += vr;        im[a] += vi;
        const nr = cr*wr - ci*wi;
        ci = cr*wi + ci*wr; cr = nr;
      }
    }
  }
}

/* Recorte central a resolución nativa, nunca reescalado: escalar
   promediaría justo las frecuencias altas donde vive la rejilla. */
export function spectrumMag(src, sw, sh){
  if(!src) return null;
  const c = document.createElement("canvas");
  c.width = FN; c.height = FN;
  const x = c.getContext("2d", {willReadFrequently:true});
  if(sw >= FN && sh >= FN){
    x.drawImage(src, (sw-FN)>>1, (sh-FN)>>1, FN, FN, 0, 0, FN, FN);
  } else {
    x.drawImage(src, 0, 0, FN, FN);
  }
  const d = x.getImageData(0,0,FN,FN).data;

  const re = new Float64Array(FN*FN);
  const im = new Float64Array(FN*FN);
  // Ventana de Hann: sin ella los bordes del recorte producen una
  // cruz brillante que tapa todo lo demás.
  const win = new Float64Array(FN);
  for(let i=0;i<FN;i++) win[i] = 0.5 - 0.5*Math.cos(2*Math.PI*i/(FN-1));
  for(let y=0;y<FN;y++){
    for(let xx=0;xx<FN;xx++){
      const i = (y*FN+xx)*4;
      const l = (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2])/255;
      re[y*FN+xx] = (l-0.5)*win[y]*win[xx];
    }
  }

  const rr = new Float64Array(FN), ii = new Float64Array(FN);
  for(let y=0;y<FN;y++){
    const o = y*FN;
    for(let i=0;i<FN;i++){ rr[i]=re[o+i]; ii[i]=im[o+i]; }
    fft1d(rr, ii, FN);
    for(let i=0;i<FN;i++){ re[o+i]=rr[i]; im[o+i]=ii[i]; }
  }
  for(let xx=0;xx<FN;xx++){
    for(let i=0;i<FN;i++){ rr[i]=re[i*FN+xx]; ii[i]=im[i*FN+xx]; }
    fft1d(rr, ii, FN);
    for(let i=0;i<FN;i++){ re[i*FN+xx]=rr[i]; im[i*FN+xx]=ii[i]; }
  }

  const mag = new Float64Array(FN*FN);
  for(let i=0;i<FN*FN;i++) mag[i] = Math.log(1 + Math.hypot(re[i], im[i])*FN);
  return mag;
}

export function spectrum(src, sw, sh, target){
  const mag = spectrumMag(src, sw, sh);
  if(!mag) return;

  // Normalizar por percentil, ignorando la continua del centro.
  const sorted = Array.from(mag).sort((a,b)=>a-b);
  const lo = sorted[Math.floor(sorted.length*0.55)];
  const hi = sorted[Math.floor(sorted.length*0.9995)];
  const span = Math.max(hi-lo, 1e-6);

  const tctx = target.getContext("2d");
  const out = tctx.createImageData(FN, FN);
  const half = FN>>1;
  for(let y=0;y<FN;y++){
    for(let xx=0;xx<FN;xx++){
      // fftshift: la continua al centro
      const sy = (y + half) & (FN-1);
      const sx = (xx + half) & (FN-1);
      let v = (mag[sy*FN+sx] - lo)/span;
      v = Math.max(0, Math.min(1, v));
      const i = (y*FN+xx)*4;
      out.data[i]   = Math.round(14 + v*228);
      out.data[i+1] = Math.round(18 + v*196);
      out.data[i+2] = Math.round(22 + v*120);
      out.data[i+3] = 255;
    }
  }
  tctx.putImageData(out, 0, 0);
}

