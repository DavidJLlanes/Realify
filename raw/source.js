// RAW stays linear and 16 bit until the display/export transform. Raster inputs
// continue to use canvases; the worker accepts either representation.
export const isLinearSource=source=>!!source?.linear&&!!source?.data;
/* `meta` (opcional) describe los datos para el revelado Premium:
   `space` ("srgb" o "rec2020"), `gain` (margen de altas luces que hay
   que devolver) y `encoding` ("bt709": LibRaw aplica siempre esa curva,
   aunque el revelado de siempre la trate como lineal). */
export function linearSource(image,meta={}){
  if(!ArrayBuffer.isView(image?.data)||![8,16].includes(image.bits)||![1,3,4].includes(image.colors)||image.data.length!==image.width*image.height*image.colors)
    throw new Error('LibRaw no devolvió una imagen lineal de 16 bits válida');
  return {width:image.width,height:image.height,channels:image.colors,data:image.data,linear:true,scale:image.bits===16?65535:255,bits:image.bits,
    encoding:'bt709',space:meta.space||'srgb',gain:meta.gain||1,base:meta.base||1};
}
const isPremiumSource=source=>source.space==='rec2020'||(source.gain||1)!==1;
/* Vista previa reducida.
   · target "standard" (el revelado de siempre): interpolación bilineal
     de los valores tal cual. Si la fuente viene del motor Premium
     (Rec.2020 con margen), se convierte a lo que habría dado el motor
     de siempre, para que alternar el modo no deje colores falsos
     mientras LibRaw vuelve a revelar.
   · target "premium": media por área en luz lineal real, Rec.2020 y con
     el margen de altas luces ya devuelto. */
export function resizeLinear(source,width,height,target='standard'){
  if(target==='premium')return resizePremium(source,width,height,true);
  if(isPremiumSource(source))return legacyFromPremium(resizePremium(source,width,height,false));
  return resizeStandard(source,width,height);
}
function resizeStandard(source,width,height){
  const channels=source.channels||3,scale=source.scale||65535,data=new Float32Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=Math.max(0,(x+.5)*source.width/width-.5),sy=Math.max(0,(y+.5)*source.height/height-.5);
    const x0=Math.min(source.width-1,Math.floor(sx)),y0=Math.min(source.height-1,Math.floor(sy));
    const x1=Math.min(source.width-1,x0+1),y1=Math.min(source.height-1,y0+1),tx=sx-x0,ty=sy-y0;
    const i=(y*width+x)*4;
    for(let c=0;c<3;c++){
      const k=channels===1?0:c,a=source.data[(y0*source.width+x0)*channels+k],b=source.data[(y0*source.width+x1)*channels+k],d=source.data[(y1*source.width+x0)*channels+k],e=source.data[(y1*source.width+x1)*channels+k];
      data[i+c]=((a*(1-tx)+b*tx)*(1-ty)+(d*(1-tx)+e*tx)*ty)/scale;
    }
    data[i+3]=1;
  }
  return {width,height,channels:4,data,linear:true,scale:1};
}

let _lut=null;
const bt709=()=>{
  if(!_lut){
    // dcraw gamma_curve(0.45, 4.5): ver raw/premium/core.js
    const g=[.45,4.5,0,0,0],bnd=[0,1];
    for(let i=0;i<48;i++){g[2]=(bnd[0]+bnd[1])/2;bnd[((g[2]/g[1])**-g[0]-1)/g[0]-1/g[2]>-1?1:0]=g[2];}
    g[3]=g[2]/g[1];g[4]=g[2]*(1/g[0]-1);
    _lut=new Float32Array(65536);for(let n=0;n<65536;n++){const v=n/65536;_lut[n]=v<g[2]?v/g[1]:((v+g[4])/(1+g[4]))**(1/g[0]);}
    _lut.g=g;
  }
  return _lut;
};
const S2W=[[0.6274040,0.3292820,0.0433136],[0.0690970,0.9195400,0.0113612],[0.0163916,0.0880132,0.8955950]];
function resizePremium(source,width,height,withBase){
  const sw=source.width,sh=source.height,channels=source.channels||3,lut=bt709(),mul=(source.scale||65535)===255?256:1;
  const wide=source.space==='rec2020',gain=(source.gain||1)*(withBase?source.base||1:1),acc=new Float64Array(width*height*4);
  const jx=new Int32Array(sw);for(let x=0;x<sw;x++)jx[x]=Math.min(width-1,Math.floor((x+.5)*width/sw));
  for(let y=0;y<sh;y++){
    const j=Math.min(height-1,Math.floor((y+.5)*height/sh))*width;
    for(let x=0,i=y*sw*channels;x<sw;x++,i+=channels){
      const k=(j+jx[x])*4,r=lut[source.data[i]*mul],g=channels===1?r:lut[source.data[i+1]*mul],b=channels===1?r:lut[source.data[i+2]*mul];
      acc[k]+=r;acc[k+1]+=g;acc[k+2]+=b;acc[k+3]++;
    }
  }
  const data=new Float32Array(width*height*4);
  for(let i=0;i<width*height;i++){
    const n=acc[i*4+3]||1,r=acc[i*4]/n*gain,g=acc[i*4+1]/n*gain,b=acc[i*4+2]/n*gain;
    if(wide){data[i*4]=r;data[i*4+1]=g;data[i*4+2]=b;}
    else for(let c=0;c<3;c++)data[i*4+c]=S2W[c][0]*r+S2W[c][1]*g+S2W[c][2]*b;
    data[i*4+3]=1;
  }
  return {width,height,channels:4,data,linear:true,scale:1,encoding:'linear',space:'rec2020',gain:1};
}
const W2S=(()=>{const [[a,b,c],[d,e,f],[g,h,i]]=S2W,A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A+b*B+c*C;
  return [[A/det,-(b*i-c*h)/det,(b*f-c*e)/det],[B/det,(a*i-c*g)/det,-(a*f-c*d)/det],[C/det,-(a*h-b*g)/det,(a*e-b*d)/det]];})();
function legacyFromPremium(p){
  const g=bt709().g,enc=v=>{v=Math.max(0,Math.min(1,v));return v<g[3]?v*g[1]:v**g[0]*(1+g[4])-g[4];};
  const d=p.data;
  for(let i=0;i<d.length;i+=4){
    const r=d[i],gg=d[i+1],b=d[i+2];
    for(let c=0;c<3;c++)d[i+c]=enc(W2S[c][0]*r+W2S[c][1]*gg+W2S[c][2]*b);
  }
  return {...p,encoding:'bt709',space:'srgb'};
}
