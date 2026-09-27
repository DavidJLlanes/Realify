/* ══════════════════════════════════════════════════════════════
   PLAUSIBILIDAD
   Mide en la salida los cinco rasgos que separan una captura de un
   render. OJO: mide justo lo que la cadena fabrica, así que por
   construcción tiende a dar la razón. Es un espejo, no un detector;
   la comprobación independiente está en forensics.js.
   ══════════════════════════════════════════════════════════════ */

import { spectrumMag, FN } from "./fft.js";

export const clamp01 = v => Math.max(0, Math.min(1, v));

export function sampleOut(view, side){
  const w = Math.min(side, view.width), h = Math.min(side, view.height);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", {willReadFrequently:true});
  // Recorte central a resolución nativa: escalar destruiría justo el
  // grano y los bloques que queremos medir.
  x.drawImage(view, (view.width-w)>>1, (view.height-h)>>1, w, h, 0, 0, w, h);
  return x.getImageData(0,0,w,h);
}

/* Estimador de ruido de Immerkær: el kernel anula cualquier rampa
   lineal, así que lo que queda es esencialmente ruido, no contenido. */
export const LAP = [1,-2,1,-2,4,-2,1,-2,1];
export function noiseField(px, w, h, ch){
  const out = new Float64Array(w*h);
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      let s = 0, k = 0;
      for(let j=-1;j<=1;j++)
        for(let i=-1;i<=1;i++)
          s += px[((y+j)*w + (x+i))*4 + ch] * LAP[k++];
      out[y*w+x] = s/6;
    }
  }
  return out;
}

export function pearson(a, b){
  const n = a.length;
  if(n < 3) return 0;
  let ma=0, mb=0;
  for(let i=0;i<n;i++){ ma+=a[i]; mb+=b[i]; }
  ma/=n; mb/=n;
  let sab=0, saa=0, sbb=0;
  for(let i=0;i<n;i++){
    const da=a[i]-ma, db=b[i]-mb;
    sab+=da*db; saa+=da*da; sbb+=db*db;
  }
  return (saa>1e-12 && sbb>1e-12) ? sab/Math.sqrt(saa*sbb) : 0;
}

/* 1. Rejilla espectral residual. Los modelos de difusión dejan picos
   periódicos fuera del centro; se comparan contra la mediana del
   anillo, evitando la cruz de los ejes, donde hay energía legítima. */
export function metricGrid(view){
  const mag = spectrumMag(view, view.width, view.height);
  if(!mag) return {v:0, raw:0};
  const half = FN>>1;
  const ring = [];
  for(let y=0;y<FN;y++){
    for(let x=0;x<FN;x++){
      const ky = y > half ? y-FN : y;
      const kx = x > half ? x-FN : x;
      if(Math.abs(kx) < 4 || Math.abs(ky) < 4) continue;   // ejes fuera
      const r = Math.hypot(kx,ky)/half;
      if(r < 0.30 || r > 0.88) continue;
      ring.push(mag[y*FN+x]);
    }
  }
  if(ring.length < 64) return {v:0, raw:0};
  ring.sort((a,b)=>a-b);
  const med = ring[ring.length>>1];
  const top = ring[Math.min(ring.length-1, Math.floor(ring.length*0.9995))];
  const raw = med > 1e-6 ? top/med : 1;
  return {v: clamp01((6.0 - raw)/(6.0 - 2.2)), raw};
}

/* 2. Ruido de disparo: la varianza debe crecer con la señal. Es el
   rasgo más caro de falsificar a ojo y el que más miran los
   detectores estadísticos. */
export function metricShot(img){
  const {data:px, width:w, height:h} = img;
  const nf = noiseField(px, w, h, 1);           // canal verde
  const B = 16, mus = [], vars = [];
  for(let by=1; by+B<h-1; by+=B){
    for(let bx=1; bx+B<w-1; bx+=B){
      let mu=0, s2=0, n=0, grad=0;
      for(let y=by; y<by+B; y++){
        for(let x=bx; x<bx+B; x++){
          const i = y*w+x;
          mu += px[i*4+1];
          s2 += nf[i]*nf[i];
          grad += Math.abs(px[i*4+1] - px[(i-1)*4+1]);
          n++;
        }
      }
      mu/=n; s2/=n; grad/=n;
      // Sólo zonas planas: en un borde el estimador mide el borde.
      if(grad > 9) continue;
      mus.push(mu/255);
      vars.push(s2);
    }
  }
  if(mus.length < 12) return {v:0.5, raw:0, sd:0};
  const meanVar = vars.reduce((a,b)=>a+b,0)/vars.length;
  const sd = Math.sqrt(meanVar)/255;
  if(sd < 0.0016) return {v:0, raw:0, sd};       // prácticamente sin ruido
  const r = pearson(mus, vars);
  return {v: clamp01(r/0.55), raw:r, sd};
}

/* 3. Correlación del ruido entre canales. Tras un demosaico real es
   parcial: ni independiente por canal (ruido añadido a mano) ni
   idéntica en los tres (ruido de luminancia superpuesto). */
export function metricChannels(img){
  const {data:px, width:w, height:h} = img;
  const nr = noiseField(px, w, h, 0);
  const ng = noiseField(px, w, h, 1);
  const nb = noiseField(px, w, h, 2);
  const a=[], b=[], c=[];
  for(let y=2;y<h-2;y+=2) for(let x=2;x<w-2;x+=2){
    const i=y*w+x; a.push(nr[i]); b.push(ng[i]); c.push(nb[i]);
  }
  const rg = pearson(a,b), gb = pearson(b,c);
  const m = (Math.abs(rg)+Math.abs(gb))/2;
  return {v: clamp01(1 - Math.abs(m-0.36)/0.46), raw:m};
}

/* 4. Uniformidad de nitidez: en una captura las esquinas son más
   blandas que el centro. Un render es igual de nítido en todas
   partes, y eso no lo produce ninguna óptica. */
export function metricField(view){
  const W = view.width, H = view.height;
  const S = Math.max(24, Math.min(200, Math.floor(Math.min(W, H)/5)));
  // Centro y esquinas tienen que caber sin solaparse; por debajo de
  // eso la medida no significa nada y las coordenadas se irían a
  // negativo, que drawImage acepta en silencio dando basura.
  if(W < S*2 + 16 || H < S*2 + 16) return {v:0.5, raw:1, na:true};
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const x = c.getContext("2d", {willReadFrequently:true});
  const energy = (sx, sy)=>{
    x.clearRect(0,0,S,S);
    x.drawImage(view, sx, sy, S, S, 0, 0, S, S);
    const d = x.getImageData(0,0,S,S).data;
    let e = 0, n = 0;
    for(let y=1;y<S-1;y++) for(let i=1;i<S-1;i++){
      const p = (y*S+i)*4;
      const l  = d[p]*0.2126 + d[p+1]*0.7152 + d[p+2]*0.0722;
      const lr = d[p+4]*0.2126 + d[p+5]*0.7152 + d[p+6]*0.0722;
      const ld = d[p+S*4]*0.2126 + d[p+S*4+1]*0.7152 + d[p+S*4+2]*0.0722;
      e += Math.abs(l-lr) + Math.abs(l-ld); n++;
    }
    return n ? e/n : 0;
  };
  const m = 6;
  const mid = energy((W-S)>>1, (H-S)>>1);
  const cor = (energy(m,m) + energy(W-S-m,m) +
               energy(m,H-S-m) + energy(W-S-m,H-S-m))/4;
  if(mid < 1e-6) return {v:0.5, raw:1};
  const raw = cor/mid;
  // Ideal en torno a 0.55-0.90. Penaliza tanto el 1.0 plano como una
  // caída exagerada que se vería como un defecto.
  const v = raw > 0.95 ? clamp01((1.10 - raw)/0.15)*0.55
          : raw < 0.30 ? clamp01(raw/0.30)*0.7
          : 1;
  return {v, raw};
}

/* 5. Rejilla de bloques 8×8 del JPEG. Debe existir: su ausencia
   completa es propia de un PNG recién generado. */
export function metricBlocks(img){
  const {data:px, width:w, height:h} = img;
  let on=0, non=0, onN=0, nonN=0;
  for(let y=2;y<h-2;y++){
    for(let x=8;x<w-2;x++){
      const i = (y*w+x)*4, j = (y*w+x-1)*4;
      const d = Math.abs(px[i]-px[j]) + Math.abs(px[i+1]-px[j+1]) + Math.abs(px[i+2]-px[j+2]);
      if(x % 8 === 0){ on += d; onN++; } else { non += d; nonN++; }
    }
  }
  if(!onN || !nonN || non === 0) return {v:0.5, raw:1};
  const raw = (on/onN)/(non/nonN);
  return {v: clamp01((raw - 0.995)/0.05), raw};
}

export const METRICS = [
  {k:"grid",  name:"Rejilla espectral rota",
   fmt:m=>"×"+m.raw.toFixed(2),
   note:"Pico periódico frente a la mediana del anillo. Más bajo, mejor."},
  {k:"shot",  name:"Ruido proporcional a la señal",
   fmt:m=>"r=" + m.raw.toFixed(2) + " · σ=" + (m.sd*100).toFixed(2) + "%",
   note:"La varianza debe crecer con la luminancia, como el ruido de disparo."},
  {k:"chan",  name:"Correlación entre canales",
   fmt:m=>m.raw.toFixed(2),
   note:"Un demosaico real deja correlación parcial, ni 0 ni 1."},
  {k:"field", name:"Caída de nitidez en esquinas",
   fmt:m=>m.na ? "n/d" : "×"+m.raw.toFixed(2),
   note:"Las esquinas deben resolver menos que el centro."},
  {k:"block", name:"Bloques 8×8 del códec",
   fmt:m=>"×"+m.raw.toFixed(3),
   note:"Discontinuidad en los bordes de bloque frente al interior."}
];

/* Ejecuta las cinco medidas sobre un canvas ya compuesto. */
export function measureAll(view){
  const img = sampleOut(view, 640);
  const res = {
    grid:  metricGrid(view),
    shot:  metricShot(img),
    chan:  metricChannels(img),
    field: metricField(view),
    block: metricBlocks(img)
  };
  const wts = { grid:0.28, shot:0.28, chan:0.16, field:0.16, block:0.12 };
  let score = 0;
  for(const k in wts) score += res[k].v * wts[k];
  res.score = Math.round(score * 100);
  return res;
}
