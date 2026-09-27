// RAW stays linear and 16 bit until the display/export transform. Raster inputs
// continue to use canvases; the worker accepts either representation.
export const isLinearSource=source=>!!source?.linear&&!!source?.data;
export function linearSource(image){
  if(!ArrayBuffer.isView(image?.data)||![8,16].includes(image.bits)||![1,3,4].includes(image.colors)||image.data.length!==image.width*image.height*image.colors)
    throw new Error('LibRaw no devolvió una imagen lineal de 16 bits válida');
  return {width:image.width,height:image.height,channels:image.colors,data:image.data,linear:true,scale:image.bits===16?65535:255,bits:image.bits};
}
export function resizeLinear(source,width,height){
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
