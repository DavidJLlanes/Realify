import { buildToneLUT, toneGain, wbGains, toLinear } from './tone.js';
import { isLinearSource } from './source.js';
import { normalize } from './state.js';
const clamp = value => Math.max(0, Math.min(255, value));
const srgbToLinear = value => {
  value /= 255; return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4);
};
const LINEAR = Float32Array.from({length:256},(_,i)=>srgbToLinear(i));
const linearToSrgb = value => 255 * (value <= .0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - .055);
const grainAt = (x, y) => {
  let value=(Math.imul(x,374761393)+Math.imul(y,668265263))>>>0;
  value=Math.imul(value^(value>>>13),1274126177)>>>0;
  return ((value^(value>>>16))&255)/255-.5;
};

const copy = source => {
  const canvas = typeof document === "undefined" ? new OffscreenCanvas(source.width, source.height) : document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
  canvas.getContext("2d", { willReadFrequently:true }).drawImage(source, 0, 0); return canvas;
};

const blur = (data, width, height, radius) => {
  if(radius < 1) return data;
  const out = new Uint8ClampedArray(data.length), r = Math.min(4, Math.max(1, Math.round(radius)));
  // Sliding vertical sums: O(pixels), independent of the neighbourhood area.
  // Only three scanlines of sums are needed instead of another full image.
  const sums=new Float64Array(width*3);
  const addRow=(y,sign)=>{for(let x=0;x<width;x++){const i=(y*width+x)*4,j=x*3;sums[j]+=sign*data[i];sums[j+1]+=sign*data[i+1];sums[j+2]+=sign*data[i+2];}};
  for(let y=0;y<=Math.min(r,height-1);y++)addRow(y,1);
  for(let y=0;y<height;y++){
    const rows=Math.min(height-1,y+r)-Math.max(0,y-r)+1;
    let rr=0,gg=0,bb=0;
    for(let x=0;x<=Math.min(r,width-1);x++){rr+=sums[x*3];gg+=sums[x*3+1];bb+=sums[x*3+2];}
    for(let x=0;x<width;x++){
      const n=rows*(Math.min(width-1,x+r)-Math.max(0,x-r)+1),i=(y*width+x)*4;
      out[i]=rr/n;out[i+1]=gg/n;out[i+2]=bb/n;out[i+3]=data[i+3];
      if(x-r>=0){const j=(x-r)*3;rr-=sums[j];gg-=sums[j+1];bb-=sums[j+2];}
      if(x+r+1<width){const j=(x+r+1)*3;rr+=sums[j];gg+=sums[j+1];bb+=sums[j+2];}
    }
    if(y-r>=0)addRow(y-r,-1);
    if(y+r+1<height)addRow(y+r+1,1);
  }
  return out;
};

export function renderPhoto(source, settings, { preview = false } = {}) {
  settings=normalize(settings);
  const linear=isLinearSource(source),w=source.width,h=source.height;
  const canvas=typeof document==='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!linear)ctx.drawImage(source,0,0);
  const image=linear?ctx.createImageData(w,h):ctx.getImageData(0,0,w,h),data=image.data;
  const input=linear?source.data:new Uint8ClampedArray(data),channels=linear?source.channels:4,scale=source.scale||65535;
  const lut=buildToneLUT(settings),gains=wbGains(settings),sat=1+settings.saturation/100,vibrance=settings.vibrance/100;
  const angle=settings.hue*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),max=Math.max(w,h),ca=settings.ca*.000015;
  const component=(x,y,k)=>{const i=(y*w+x)*channels+(channels===1?0:k);return linear?input[i]/scale:LINEAR[input[i]];};
  const sample=(x,y,k)=>{
    x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
    const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=x-x0,ty=y-y0;
    // Interpolate encoded RGB for raster sources, matching the GPU input texture.
    if(!linear){const value=(xx,yy)=>input[(yy*w+xx)*4+k]/255;return toLinear((value(x0,y0)*(1-tx)+value(x1,y0)*tx)*(1-ty)+(value(x0,y1)*(1-tx)+value(x1,y1)*tx)*ty);}
    return (component(x0,y0,k)*(1-tx)+component(x1,y0,k)*tx)*(1-ty)+(component(x0,y1,k)*(1-tx)+component(x1,y1,k)*tx)*ty;
  };
  for(let y=0; y<h; y++) for(let x=0; x<w; x++) {
    const i=(y*w+x)*4;
    let r=component(x,y,0),g=component(x,y,1),b=component(x,y,2);
    if(ca){r=sample(x+(x+.5-w/2)*ca,y+(y+.5-h/2)*ca,0);b=sample(x-(x+.5-w/2)*ca,y-(y+.5-h/2)*ca,2);}
    r*=gains[0];g*=gains[1];b*=gains[2];
    const lum=.2126*r+.7152*g+.0722*b,gain=toneGain(lum,lut);
    r*=gain;g*=gain;b*=gain;
    const l=Math.max(0,Math.min(1,.2126*r+.7152*g+.0722*b));
    const chroma=(Math.max(r,g,b)-Math.min(r,g,b))/Math.max(Math.max(r,g,b),1e-6);
    const saturation=sat*(1+vibrance*(1-chroma)*.75);
    r=l+(r-l)*saturation;g=l+(g-l)*saturation;b=l+(b-l)*saturation;
    if(angle){const cb=(b-l)/1.8556,cr=(r-l)/1.5748;r=l+1.5748*(cr*cos-cb*sin);b=l+1.8556*(cr*sin+cb*cos);g=(l-.2126*r-.0722*b)/.7152;}
    // Compress chroma towards the same luminance instead of clipping channels.
    const hi=Math.max(r,g,b)-l,lo=Math.min(r,g,b)-l;
    const gamut=Math.min(1,hi>0?(1-l)/hi:1,lo<0?-l/lo:1);
    r=l+(r-l)*gamut;g=l+(g-l)*gamut;b=l+(b-l)*gamut;
    const dx=(x-w/2)/(max/2), dy=(y-h/2)/(max/2), edge=Math.min(1, dx*dx+dy*dy);
    const vig=2**(-(settings.vignette-settings.lensVignette)/100*edge*edge*.8);
    const n=grainAt(x,y)*settings.grain/100*.035*(1-l*l)*255;
    data[i]=clamp(linearToSrgb(Math.max(0,r*vig))+n);data[i+1]=clamp(linearToSrgb(Math.max(0,g*vig))+n);data[i+2]=clamp(linearToSrgb(Math.max(0,b*vig))+n);data[i+3]=linear?255:input[i+3];
  }
  const detail=Math.max(Math.abs(settings.clarity||0),Math.abs(settings.texture||0),settings.sharpen||0,settings.noise||0,settings.colorNoise||0);
  if(detail) {
    const original=new Uint8ClampedArray(data),fine=blur(original,w,h,1),soft=blur(original,w,h,2);
    for(let i=0;i<data.length;i+=4){
      const l=(.2126*original[i]+.7152*original[i+1]+.0722*original[i+2])/255;
      const f=(.2126*fine[i]+.7152*fine[i+1]+.0722*fine[i+2])/255;
      const b=(.2126*soft[i]+.7152*soft[i+1]+.0722*soft[i+2])/255;
      const gate=Math.exp(-(((l-b)/.08)**2)),noise=settings.noise/100*.8*gate,colorNoise=settings.colorNoise/100*.95*gate;
      const edge=l-f,sharp=Math.sign(edge)*Math.max(0,Math.abs(edge)-.003)*settings.sharpen/100;
      const local=sharp+edge*settings.texture/100*.35+(l-b)*settings.clarity/100*.6*4*l*(1-l);
      const target=l+(b-l)*noise+Math.max(-.08,Math.min(.08,local));
      for(let c=0;c<3;c++){const chroma=original[i+c]/255-l,softChroma=soft[i+c]/255-b;data[i+c]=clamp((target+chroma+(softChroma-chroma)*colorNoise)*255);}
    }
  }
  ctx.putImageData(image,0,0); return canvas;
}

export function histogram(source) {
  const canvas=copy(source), data=canvas.getContext("2d",{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  const bins=Array.from({length:256},()=>0); for(let i=0;i<data.length;i+=4) bins[Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])]++;
  const top=Math.max(1,...bins); return bins.map(v=>v/top);
}
