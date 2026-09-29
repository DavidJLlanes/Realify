import { linearReader } from './source.js';
// Shared tonal model. GPU and export consume the same high precision gain LUT.
// Contrast acts in perceptual lightness; zone controls smoothly change log odds.
export const LUT_SIZE=4096;
export const toLinear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
export const toSrgb=x=>x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;
export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const toneKey=s=>[s.exposure,s.contrast,s.shadows,s.highlights,s.whites,s.blacks,s.dehaze].join(',');
export function toneLightness(x,s){
  if(x<=0)return 0;
  const exposure=2**(s.exposure||0),linear=toLinear(x);
  // A normalized photographic shoulder approaches white continuously on exposure
  // increases; lowering exposure retains the linear stop relationship.
  x=toSrgb(exposure>=1?linear*exposure/(1+(exposure-1)*linear):linear*exposure);
  if(x>=1)return 1;
  let odds=Math.log(x/(1-x))*2**((s.contrast||0)*.010+(s.dehaze||0)*.003);
  x=1/(1+Math.exp(-odds));
  const shift=(s.shadows||0)*.017*(1-smooth(.04,.68,x))
    +(s.highlights||0)*.017*smooth(.32,.96,x)
    +(s.blacks||0)*.012*(1-smooth(0,.32,x))
    +(s.whites||0)*.012*smooth(.68,1,x)-(s.dehaze||0)*.0025;
  return 1/(1+Math.exp(-(odds+shift*Math.LN2)));
}
export function buildToneLUT(s){
  const lut=new Float32Array(LUT_SIZE);
  let previous=0;
  for(let i=1;i<LUT_SIZE;i++){
    const linear=(i/(LUT_SIZE-1))**2;
    const output=Math.max(previous,toLinear(toneLightness(toSrgb(linear),s)));
    lut[i]=output/linear;previous=output;
  }
  lut[0]=lut[1];return lut;
}
export function toneGain(luminance,lut){
  const index=Math.sqrt(Math.max(0,Math.min(1,luminance)))*(LUT_SIZE-1),lo=Math.floor(index),t=index-lo;
  return lut[lo]*(1-t)+lut[Math.min(lo+1,LUT_SIZE-1)]*t;
}
export function wbGains(s){
  const presets={camera:[1,1,1],daylight:[1,1,1],cloudy:[1.08,1,.92],shade:[1.16,1,.84],tungsten:[.72,1,1.35],fluorescent:[.92,.92,1.18],flash:[1.04,1,.97]};
  const base=s.wb==='auto'?(s.autoWb||[1,1,1]):(presets[s.wb]||presets.camera);
  const warm=(s.temperature||0)/100,tint=(s.tint||0)/100;
  const gain=[base[0]*2**(warm*.55+tint*.15),base[1]*2**(-tint*.3),base[2]*2**(-warm*.55+tint*.15)];
  const norm=.2126*gain[0]+.7152*gain[1]+.0722*gain[2];
  return gain.map(v=>v/norm);
}
export function autoWhiteBalance(source){
  let pixels,width,height,channels=4,linear=false,read=null;
  if(source.data){({data:pixels,width,height}=source);channels=source.channels||3;linear=true;read=linearReader(source);}
  else{
    const c=typeof document==='undefined'?new OffscreenCanvas(64,64):document.createElement('canvas');c.width=c.height=64;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,64,64);pixels=ctx.getImageData(0,0,64,64).data;width=height=64;
  }
  const sums=[0,0,0];let count=0;
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const i=(Math.min(height-1,Math.floor((y+.5)*height/64))*width+Math.min(width-1,Math.floor((x+.5)*width/64)))*channels;
    const rgb=[0,1,2].map(k=>linear?read(i+(channels===1?0:k)):toLinear(pixels[i+k]/255));
    const l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
    if(l<.02||l>.85||Math.max(...rgb)>.98)continue;
    rgb.forEach((v,k)=>sums[k]+=v);count++;
  }
  if(!count)return [1,1,1];const mean=(sums[0]+sums[1]+sums[2])/3;
  return sums.map(v=>Math.max(.65,Math.min(1.55,mean/Math.max(v,1e-6))));
}
