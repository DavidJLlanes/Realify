import { buildToneLUT, toneKey, wbGains, LUT_SIZE } from './tone.js';
import { normalize } from './state.js';
// Two persistent GPU passes: tonal development, then spatial detail.
// The original texture is uploaded only when the preview size changes.
const vertex = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const tone = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform sampler2D curve;
uniform vec3 whiteBalance;
uniform vec4 color; // saturation, vibrance, hue, grain
uniform vec2 optics; // vignette, lateral chromatic correction
uniform bool linearSource;
uniform vec2 size;
uniform bool original;
in vec2 uv; out vec4 outputColor;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 srgb(vec3 c){c=max(c,vec3(0));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec4 sampleAt(vec2 q){
 vec2 p=clamp(q*size-.5,vec2(0),size-1.);ivec2 a=ivec2(floor(p)),b=min(a+1,ivec2(size)-1);vec2 t=fract(p);
 return mix(mix(texelFetch(image,a,0),texelFetch(image,ivec2(b.x,a.y),0),t.x),mix(texelFetch(image,ivec2(a.x,b.y),0),texelFetch(image,b,0),t.x),t.y);
}
void main(){
 // UNPACK_FLIP_Y_WEBGL already converts the top-left image origin to the
 // bottom-left framebuffer origin. Applying another Y inversion here turns
 // linear RAW previews upside down (and made some cameras look 180° rotated).
 vec2 sampleUV=uv;
 vec4 pixel=texture(image,sampleUV);
 if(original){outputColor=vec4(linearSource?srgb(pixel.rgb):pixel.rgb,pixel.a);return;}
 if(optics.y!=0.){vec2 delta=(sampleUV-.5)*optics.y;pixel.r=sampleAt(sampleUV+delta).r;pixel.b=sampleAt(sampleUV-delta).b;}
 vec3 c=(linearSource?pixel.rgb:linearRGB(pixel.rgb))*whiteBalance;
 float lum=dot(c,vec3(.2126,.7152,.0722));
 float index=sqrt(clamp(lum,0.,1.))*4095.;int lo=int(floor(index));float t=fract(index);
 float gain=mix(texelFetch(curve,ivec2(lo,0),0).r,texelFetch(curve,ivec2(min(lo+1,4095),0),0).r,t);
 c*=gain;
 float l=clamp(dot(c,vec3(.2126,.7152,.0722)),0.,1.);
 float hi=max(c.r,max(c.g,c.b)),chroma=(hi-min(c.r,min(c.g,c.b)))/max(hi,.000001);
 c=l+(c-l)*color.x*(1.+color.y*(1.-chroma)*.75);
 if(color.z!=0.){float a=cos(color.z),q=sin(color.z),cb=(c.b-l)/1.8556,cr=(c.r-l)/1.5748;c.r=l+1.5748*(cr*a-cb*q);c.b=l+1.8556*(cr*q+cb*a);c.g=(l-.2126*c.r-.0722*c.b)/.7152;}
 hi=max(c.r,max(c.g,c.b))-l;float low=min(c.r,min(c.g,c.b))-l;
 float gamut=min(1.,min(hi>0.?(1.-l)/hi:1.,low<0.?-l/low:1.));c=l+(c-l)*gamut;
 vec2 pos=vec2(floor(uv.x*size.x),size.y-1.-floor(uv.y*size.y));
 vec2 d=(pos-size*.5)/(max(size.x,size.y)*.5);
 float edge=min(1.,dot(d,d));c*=exp2(-optics.x*edge*edge*.8);
 uint seed=uint(pos.x)*374761393u+uint(pos.y)*668265263u;
 seed=(seed^(seed>>13u))*1274126177u;
 float grain=(float((seed^(seed>>16u))&255u)/255.-.5)*color.w*.035*(1.-l*l);
 outputColor=vec4(clamp(srgb(c)+grain,0.,1.),pixel.a);
}`;
const detail = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform vec4 amount; // sharpness, luminance noise, chroma noise, clarity
uniform float textureAmount;
in vec2 uv; out vec4 outputColor;
void main(){
 ivec2 size=textureSize(image,0),p=ivec2(gl_FragCoord.xy);
 vec4 base=texelFetch(image,p,0);
 if(all(equal(amount,vec4(0))) && textureAmount==0.){outputColor=base;return;}
 vec3 sum=vec3(0),fineSum=vec3(0);float n=0.,nf=0.;
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  ivec2 q=p+ivec2(x,y);
  if(all(greaterThanEqual(q,ivec2(0))) && all(lessThan(q,size))){vec3 v=texelFetch(image,q,0).rgb;sum+=v;n++;if(abs(x)<=1&&abs(y)<=1){fineSum+=v;nf++;}}
 }
 vec3 soft=floor(sum/n*255.+.5)/255.,fine=floor(fineSum/nf*255.+.5)/255.;
 float l=dot(base.rgb,vec3(.2126,.7152,.0722)),f=dot(fine,vec3(.2126,.7152,.0722)),b=dot(soft,vec3(.2126,.7152,.0722));
 float gate=exp(-pow((l-b)/.08,2.)),edge=l-f;
 float sharp=sign(edge)*max(0.,abs(edge)-.003)*amount.x;
 float local=sharp+edge*textureAmount*.35+(l-b)*amount.w*.6*4.*l*(1.-l);
 float target=l+(b-l)*amount.y*.8*gate+clamp(local,-.08,.08);
 vec3 chroma=base.rgb-l,softChroma=soft-b;
 outputColor=vec4(clamp(target+mix(chroma,softChroma,amount.z*.95*gate),0.,1.),base.a);
}`;

export class GPUPreview {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext("webgl2", { alpha:true, premultipliedAlpha:false, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:true });
    if (!gl) throw new Error("WebGL2 no disponible");
    this.programs=[]; this.textures=[];
    try {
      this.tone=this.program(vertex,tone); this.detail=this.program(vertex,detail);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      this.input=this.texture();this.intermediate=this.texture();this.curve=this.texture();this.framebuffer=gl.createFramebuffer();
      gl.disable(gl.BLEND);gl.disable(gl.DITHER);
    } catch(error) { this.dispose(); throw error; }
  }
  program(vs,fs) {
    const gl=this.gl, shaders=[];
    const program=gl.createProgram();this.programs.push(program);
    try {
      for(const [type,code] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
        const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,code);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program,shader);
      }
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      const uniforms={};
      for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(program,i);uniforms[u.name]=gl.getUniformLocation(program,u.name);}
      return {program, uniforms, position:gl.getAttribLocation(program,"position")};
    } finally {for(const shader of shaders)gl.deleteShader(shader);}
  }
  texture(){const gl=this.gl,t=gl.createTexture();this.textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
  setSource(source){
    const gl=this.gl,w=source.width,h=source.height;
    this.canvas.width=w;this.canvas.height=h;gl.viewport(0,0,w,h);
    gl.bindTexture(gl.TEXTURE_2D,this.input);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    this.linearSource=!!source.linear;
    if(this.linearSource){
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,source.data);
    }else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.bindTexture(gl.TEXTURE_2D,this.intermediate);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.intermediate,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error("No se pudo crear la previsualización GPU");
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  use(pass,texture,target){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.useProgram(pass.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(pass.position);gl.vertexAttribPointer(pass.position,2,gl.FLOAT,false,0,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(pass.uniforms.image,0);}
  render(s,original=false){
    s=normalize(s);
    const gl=this.gl;
    if(gl.isContextLost())throw new Error("Se ha perdido el contexto gráfico");
    this.use(this.tone,this.input,this.framebuffer);const u=this.tone.uniforms;
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.curve);
    const key=toneKey(s);
    if(key!==this.lastTone){gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,LUT_SIZE,1,0,gl.RED,gl.FLOAT,buildToneLUT(s));this.lastTone=key;}
    gl.uniform1i(u.curve,1);gl.uniform1i(u.linearSource,this.linearSource?1:0);
    gl.uniform3fv(u.whiteBalance,wbGains(s));gl.uniform4f(u.color,1+s.saturation/100,s.vibrance/100,s.hue/180*Math.PI,s.grain/100);
    gl.uniform2f(u.optics,(s.vignette-s.lensVignette)/100,s.ca*.000015);
    gl.uniform2f(u.size,this.canvas.width,this.canvas.height);gl.uniform1i(u.original,original?1:0);
    gl.drawArrays(gl.TRIANGLES,0,6);
    this.use(this.detail,this.intermediate,null);const d=this.detail.uniforms;
    gl.uniform4f(d.amount,original?0:s.sharpen/100,original?0:s.noise/100,original?0:s.colorNoise/100,original?0:s.clarity/100);
    gl.uniform1f(d.textureAmount,original?0:s.texture/100);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  dispose(){const gl=this.gl;for(const p of this.programs)gl.deleteProgram(p);for(const t of this.textures)gl.deleteTexture(t);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.framebuffer)gl.deleteFramebuffer(this.framebuffer);}
}
