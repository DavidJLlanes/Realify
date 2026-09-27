/* Aceleración progresiva WebGPU. Ninguna función obliga a disponer de
   GPU: devuelve null y el llamador conserva su implementación Canvas
   2D/CPU. Los trabajos se trocean fuera de este módulo en mosaicos. */

let runtimePromise=null, disabled=false;
const align256=n=>(n+255)&~255;

async function runtime(){
  if(disabled || !navigator.gpu) return null;
  if(runtimePromise) return runtimePromise;
  runtimePromise=(async()=>{
    try{
      const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});
      if(!adapter) return null;
      const device=await adapter.requestDevice();
      const rt={device,blendPipelines:new Map(),convPipeline:null,morphPipeline:null};
      device.lost.then(()=>{disabled=true;runtimePromise=null;}).catch(()=>{});
      return rt;
    }catch(err){ console.info("[rendimiento] WebGPU no disponible; se usa CPU",err); return null; }
  })();
  return runtimePromise;
}

export async function webGPUAvailable(){ return !!(await runtime()); }

/* `copyExternalImageToTexture` exige que el destino tenga, además de
   COPY_DST, el uso RENDER_ATTACHMENT: sin él la copia falla con un
   error de validación silencioso, la textura se queda a cero y el
   resultado sale TRANSPARENTE (así fallaban Mínimo/Máximo). */
function texture(device,w,h,usage){if(usage&GPUTextureUsage.COPY_DST)usage|=GPUTextureUsage.RENDER_ATTACHMENT;return device.createTexture({size:[w,h],format:"rgba8unorm",usage});}
/* Ejecuta un trabajo de GPU vigilando los errores de validación: si
   hay alguno se devuelve null y quien llama usa su ruta de CPU. */
async function guarded(device,job){device.pushErrorScope("validation");let out=null;try{out=await job();}catch(err){out=null;}const e=await device.popErrorScope().catch(()=>null);if(e){console.warn("[rendimiento] WebGPU:",e.message,"· se usa CPU");return null;}return out;}
async function canvasFromTexture(device,tex,w,h){
  const row=w*4,padded=align256(row),buffer=device.createBuffer({size:padded*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const enc=device.createCommandEncoder();enc.copyTextureToBuffer({texture:tex},{buffer,bytesPerRow:padded,rowsPerImage:h},[w,h]);device.queue.submit([enc.finish()]);
  await buffer.mapAsync(GPUMapMode.READ);const src=new Uint8Array(buffer.getMappedRange()),out=new Uint8ClampedArray(row*h);
  for(let y=0;y<h;y++)out.set(src.subarray(y*padded,y*padded+row),y*row);
  buffer.unmap();buffer.destroy();const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").putImageData(new ImageData(out,w,h),0,0);return c;
}

const BLEND_CODES={"linear-light":1,"linear-burn":2,subtract:3,divide:4,"pin-light":5,"vivid-light":6,"hard-mix":7,"darker-color":8,"lighter-color":9,dissolve:10};
const blendShader=`
struct P { size:vec2<u32>, mode:u32, pad:u32, opacity:f32, seed:f32, p2:f32, p3:f32 }
@group(0) @binding(0) var baseTex:texture_2d<f32>;
@group(0) @binding(1) var topTex:texture_2d<f32>;
@group(0) @binding(2) var outTex:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(3) var<uniform> p:P;
fn lum(c:vec3<f32>)->f32{return dot(c,vec3<f32>(.2126,.7152,.0722));}
fn vivid(b:f32,s:f32)->f32{if(s<=.5){if(s<=0.){return 0.;}return 1.-clamp((1.-b)/(2.*s),0.,1.);}if(s>=1.){return 1.;}return clamp(b/(2.*(1.-s)),0.,1.);}
fn hash(q:vec2<u32>)->f32{var n=q.x*374761393u+q.y*668265263u;n=(n^(n>>13u))*1274126177u;return f32(n^(n>>16u))/4294967295.;}
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) q:vec3<u32>){
 if(q.x>=p.size.x||q.y>=p.size.y){return;} let xy=vec2<i32>(q.xy);let b=textureLoad(baseTex,xy,0);let s=textureLoad(topTex,xy,0);let a=s.a*p.opacity;if(a<=0.){textureStore(outTex,xy,b);return;}
 var r=s.rgb;
 if(p.mode==1u){r=clamp(b.rgb+2.*s.rgb-vec3<f32>(1.),vec3<f32>(0.),vec3<f32>(1.));}
 else if(p.mode==2u){r=clamp(b.rgb+s.rgb-vec3<f32>(1.),vec3<f32>(0.),vec3<f32>(1.));}
 else if(p.mode==3u){r=clamp(b.rgb-s.rgb,vec3<f32>(0.),vec3<f32>(1.));}
 else if(p.mode==4u){r=select(clamp(b.rgb/max(s.rgb,vec3<f32>(.00001)),vec3<f32>(0.),vec3<f32>(1.)),vec3<f32>(1.),s.rgb<=vec3<f32>(0.));}
 else if(p.mode==5u){r=select(min(b.rgb,2.*s.rgb),max(b.rgb,2.*s.rgb-vec3<f32>(1.)),s.rgb>=vec3<f32>(.5));}
 else if(p.mode==6u||p.mode==7u){r=vec3<f32>(vivid(b.r,s.r),vivid(b.g,s.g),vivid(b.b,s.b));if(p.mode==7u){r=select(vec3<f32>(0.),vec3<f32>(1.),r>=vec3<f32>(.5));}}
 else if(p.mode==8u||p.mode==9u){let pick=select(lum(s.rgb)<lum(b.rgb),lum(s.rgb)>lum(b.rgb),p.mode==9u);r=select(b.rgb,s.rgb,pick);}
 else if(p.mode==10u){if(hash(q.xy)>=a){textureStore(outTex,xy,b);return;}a=1.;}
 textureStore(outTex,xy,vec4<f32>(mix(b.rgb,r,a),min(1.,b.a+s.a*a)));
}`;

export async function gpuBlend(base,top,mode,opacity=1){
  const rt=await runtime(),code=BLEND_CODES[mode];if(!rt||!code||!base.width||!base.height)return null;
  const {device}=rt,w=base.width,h=base.height,U=GPUTextureUsage;
  return guarded(device,async()=>{
  let pipeline=rt.blendPipelines.get("main");if(!pipeline){pipeline=device.createComputePipeline({layout:"auto",compute:{module:device.createShaderModule({code:blendShader}),entryPoint:"main"}});rt.blendPipelines.set("main",pipeline);}
  const a=texture(device,w,h,U.TEXTURE_BINDING|U.COPY_DST),b=texture(device,w,h,U.TEXTURE_BINDING|U.COPY_DST),out=texture(device,w,h,U.STORAGE_BINDING|U.COPY_SRC);
  device.queue.copyExternalImageToTexture({source:base},{texture:a},[w,h]);device.queue.copyExternalImageToTexture({source:top},{texture:b},[w,h]);
  const values=new ArrayBuffer(32),dv=new DataView(values);dv.setUint32(0,w,true);dv.setUint32(4,h,true);dv.setUint32(8,code,true);dv.setFloat32(16,opacity,true);const ub=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(ub,0,values);
  const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:a.createView()},{binding:1,resource:b.createView()},{binding:2,resource:out.createView()},{binding:3,resource:{buffer:ub}}]});
  const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(w/8),Math.ceil(h/8));pass.end();device.queue.submit([enc.finish()]);
  const c=await canvasFromTexture(device,out,w,h);a.destroy();b.destroy();out.destroy();ub.destroy();return c;
  });
}

const convShader=`
@group(0) @binding(0) var src:texture_2d<f32>;
@group(0) @binding(1) var dst:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<storage,read> p:array<f32>;
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) q:vec3<u32>){let w=u32(p[0]);let h=u32(p[1]);if(q.x>=w||q.y>=h){return;}var rgb=vec3<f32>(0.);for(var ky:i32=-2;ky<=2;ky++){for(var kx:i32=-2;kx<=2;kx++){let x=clamp(i32(q.x)+kx,0,i32(w)-1);let y=clamp(i32(q.y)+ky,0,i32(h)-1);let k=p[4+u32((ky+2)*5+kx+2)];rgb+=textureLoad(src,vec2<i32>(x,y),0).rgb*k;}}let original=textureLoad(src,vec2<i32>(q.xy),0);textureStore(dst,vec2<i32>(q.xy),vec4<f32>(clamp(rgb/max(.00001,p[2])+vec3<f32>(p[3]/255.),vec3<f32>(0.),vec3<f32>(1.)),original.a));}`;

export async function gpuConvolution5(src,kernel,divisor=1,offset=0){
  const rt=await runtime();if(!rt||kernel.length!==25||!src.width||!src.height)return null;const {device}=rt,w=src.width,h=src.height,U=GPUTextureUsage;
  return guarded(device,async()=>{
  if(!rt.convPipeline)rt.convPipeline=device.createComputePipeline({layout:"auto",compute:{module:device.createShaderModule({code:convShader}),entryPoint:"main"}});
  const input=texture(device,w,h,U.TEXTURE_BINDING|U.COPY_DST),out=texture(device,w,h,U.STORAGE_BINDING|U.COPY_SRC);device.queue.copyExternalImageToTexture({source:src},{texture:input},[w,h]);
  const vals=new Float32Array(29);vals.set([w,h,divisor||1,offset]);vals.set(kernel,4);const pb=device.createBuffer({size:vals.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(pb,0,vals);
  const pipeline=rt.convPipeline,bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:input.createView()},{binding:1,resource:out.createView()},{binding:2,resource:{buffer:pb}}]});const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(w/8),Math.ceil(h/8));pass.end();device.queue.submit([enc.finish()]);
  const c=await canvasFromTexture(device,out,w,h);input.destroy();out.destroy();pb.destroy();return c;
  });
}

const morphShader=`
struct P { size:vec2<u32>, radius:u32, mode:u32 }
@group(0) @binding(0) var src:texture_2d<f32>;
@group(0) @binding(1) var dst:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> p:P;
@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) q:vec3<u32>){if(q.x>=p.size.x||q.y>=p.size.y){return;}var v=select(vec3<f32>(0.),vec3<f32>(1.),p.mode==0u);let r=i32(p.radius);for(var yy:i32=-20;yy<=20;yy++){if(abs(yy)>r){continue;}for(var xx:i32=-20;xx<=20;xx++){if(abs(xx)>r){continue;}let x=clamp(i32(q.x)+xx,0,i32(p.size.x)-1);let y=clamp(i32(q.y)+yy,0,i32(p.size.y)-1);let z=textureLoad(src,vec2<i32>(x,y),0).rgb;v=select(max(v,z),min(v,z),p.mode==0u);}}let a=textureLoad(src,vec2<i32>(q.xy),0).a;textureStore(dst,vec2<i32>(q.xy),vec4<f32>(v,a));}`;
export async function gpuMorphology(src,radius,minimum=true){
  const rt=await runtime();if(!rt||!src.width||!src.height||radius>20)return null;const{device}=rt,w=src.width,h=src.height,U=GPUTextureUsage;
  return guarded(device,async()=>{
  if(!rt.morphPipeline)rt.morphPipeline=device.createComputePipeline({layout:"auto",compute:{module:device.createShaderModule({code:morphShader}),entryPoint:"main"}});
  const input=texture(device,w,h,U.TEXTURE_BINDING|U.COPY_DST),out=texture(device,w,h,U.STORAGE_BINDING|U.COPY_SRC);device.queue.copyExternalImageToTexture({source:src},{texture:input},[w,h]);
  const vals=new Uint32Array([w,h,Math.max(1,Math.round(radius)),minimum?0:1]),pb=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(pb,0,vals);
  const pipeline=rt.morphPipeline,bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:input.createView()},{binding:1,resource:out.createView()},{binding:2,resource:{buffer:pb}}]});const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(w/8),Math.ceil(h/8));pass.end();device.queue.submit([enc.finish()]);
  const c=await canvasFromTexture(device,out,w,h);input.destroy();out.destroy();pb.destroy();return c;
  });
}
