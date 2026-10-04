const LIMITS = Object.freeze({
  exposure:[-5,5],
  brightness:[-100,100],
  contrast:[-100,100],
  highlights:[-100,100],
  shadows:[-100,100],
  whites:[-100,100],
  blacks:[-100,100],
  temperature:[-100,100],
  tint:[-100,100],
  saturation:[-100,100],
  vibrance:[-100,100],
  clarity:[-100,100],
  texture:[-100,100],
  dehaze:[-100,100],
  sharpen:[0,100]
});

const clamp=(v,a=0,b=255)=>v<a?a:v>b?b:v;
const clamp01=v=>v<0?0:v>1?1:v;
const lum=(r,g,b)=>0.2126*r+0.7152*g+0.0722*b;

export function sanitizeAdjustments(input={}){
  const out={};
  for(const [key,[lo,hi]] of Object.entries(LIMITS)){
    let v=Number(input[key]);
    if(!Number.isFinite(v)) v=0;
    out[key]=Math.max(lo,Math.min(hi,v));
  }
  return out;
}

function tonalWeight(l, center, radius){
  const d=Math.abs(l-center)/radius;
  return d>=1?0:(1-d)*(1-d);
}

function applyLocalDetail(data,w,h,amount){
  if(Math.abs(amount)<0.01 || w<3 || h<3) return;
  const src=Uint8ClampedArray.from(data);
  const a=amount/100;
  const strength=a>=0 ? a*0.75 : a*0.55;
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const i=(y*w+x)*4;
      for(let c=0;c<3;c++){
        let sum=0;
        for(let yy=-1;yy<=1;yy++) for(let xx=-1;xx<=1;xx++)
          sum+=src[((y+yy)*w+(x+xx))*4+c];
        const blur=sum/9;
        data[i+c]=clamp(src[i+c]+(src[i+c]-blur)*strength);
      }
    }
  }
}

export function renderAdjustments(source, params, reuse){
  const p=sanitizeAdjustments(params);
  const out=reuse||document.createElement("canvas");
  if(out.width!==source.width||out.height!==source.height){
    out.width=source.width; out.height=source.height;
  }
  const x=out.getContext("2d",{willReadFrequently:true});
  x.clearRect(0,0,out.width,out.height);
  x.drawImage(source,0,0);
  const img=x.getImageData(0,0,out.width,out.height);
  const d=img.data;

  const exposureMul=Math.pow(2,p.exposure);
  const bright=p.brightness*1.28;
  const contrast=p.contrast/100;
  const contrastMul=contrast>=0 ? 1+contrast*1.8 : 1+contrast*0.75;
  const sat=1+p.saturation/100;
  const vib=p.vibrance/100;
  const temp=p.temperature/100;
  const tint=p.tint/100;
  const dehaze=p.dehaze/100;

  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];

    if(p.exposure){
      r=255*(1-Math.pow(1-clamp01(r/255),exposureMul));
      g=255*(1-Math.pow(1-clamp01(g/255),exposureMul));
      b=255*(1-Math.pow(1-clamp01(b/255),exposureMul));
    }

    r+=bright; g+=bright; b+=bright;

    r=(r-128)*contrastMul+128;
    g=(g-128)*contrastMul+128;
    b=(b-128)*contrastMul+128;

    let l=clamp01(lum(r,g,b)/255);
    let delta=0;
    delta += p.blacks/100*34*tonalWeight(l,0.08,0.28);
    delta += p.shadows/100*48*tonalWeight(l,0.28,0.38);
    delta += p.highlights/100*48*tonalWeight(l,0.72,0.38);
    delta += p.whites/100*34*tonalWeight(l,0.94,0.28);
    r+=delta; g+=delta; b+=delta;

    if(temp){
      r+=temp*22; b-=temp*22; g+=temp*3;
    }
    if(tint){
      r+=tint*8; b+=tint*8; g-=tint*18;
    }

    const y=lum(r,g,b);
    const maxc=Math.max(r,g,b), minc=Math.min(r,g,b);
    const currentSat=(maxc-minc)/255;
    const vibBoost=1+vib*(1-currentSat)*0.9;
    const chroma=sat*vibBoost;
    r=y+(r-y)*chroma;
    g=y+(g-y)*chroma;
    b=y+(b-y)*chroma;

    if(dehaze){
      const k=1+dehaze*0.45;
      r=(r-18*dehaze-128)*k+128;
      g=(g-18*dehaze-128)*k+128;
      b=(b-18*dehaze-128)*k+128;
    }

    d[i]=clamp(r); d[i+1]=clamp(g); d[i+2]=clamp(b);
  }

  const detail=p.clarity*0.55+p.texture*0.35+p.sharpen*0.65;
  applyLocalDetail(d,out.width,out.height,Math.max(-100,Math.min(100,detail)));
  x.putImageData(img,0,0);
  return out;
}

export function isNeutral(params){
  const p=sanitizeAdjustments(params);
  return Object.values(p).every(v=>Math.abs(v)<1e-6);
}

export { LIMITS };
