/* ═══════════════════════════════════════════════════════════════
   REVELADO PREMIUM · GPU (vista previa)
   Las mismas operaciones que cpu.js, en WebGL2 con texturas de coma
   flotante (EXT_color_buffer_float). Comparte el contexto de la vista
   previa de siempre (gpu-preview.js) y su textura de origen.

   Pases por fotograma:
     prep   origen → Rec.2020 lineal (CA, balance, viñeteado de lente)
            y log2 Y                                   (resolución vista)
     fine   filtro guiado fino r = 2 y medias 3×3 / 5×5
     final  todo lo demás, hasta sRGB de 8 bits con tramado
   Y, sólo cuando cambia algo que les afecta (balance, viñeteado de
   lente, ruido de color, origen), los mapas de 512 px:
     down   media por área → (log2 Y, mínimo, R/Y, B/Y)
     4 + 4  cajas del filtro guiado rápido (base/neblina y color)
   La rejilla de los mapas se calcula con el tamaño del ORIGINAL, igual
   que en la CPU, para que la vista previa y el resultado coincidan.
   ═══════════════════════════════════════════════════════════════ */
import { Y2020, MID, R_COARSE, R_CHROMA, EPS_COARSE, EPS_HAZE, SRGB_TO_2020, REC2020_TO_SRGB,
         OK_M1_2020, OK_M2, OK_M2_INV, OK_M1_INV_SRGB, SHOULDER, glMat3, mapSize, mapsKey, premiumParams } from "./core.js";
import { wbGains } from "../tone.js";

const f = n => { const s = String(n); return s.includes(".") || s.includes("e") ? s : s + ".0"; };
const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const head = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
const vec3 YW=vec3(${Y2020.map(f).join(",")});
`;

const prep = head + `
uniform sampler2D image;
uniform bool linearSource;
uniform mat3 toWide;
uniform vec3 wb;
uniform vec2 size;       // vista
uniform float lensVig, ca;
vec3 dec(vec3 c){return linearSource?c:mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 fetchAt(ivec2 p){p=clamp(p,ivec2(0),ivec2(size)-1);vec3 c=dec(texelFetch(image,p,0).rgb);return linearSource?c:toWide*c;}
float chan(vec2 q,int k){
  q=clamp(q,vec2(0),size-1.);ivec2 a=ivec2(floor(q));vec2 t=q-vec2(a);
  float v00=fetchAt(a)[k],v10=fetchAt(a+ivec2(1,0))[k],v01=fetchAt(a+ivec2(0,1))[k],v11=fetchAt(a+ivec2(1,1))[k];
  return mix(mix(v00,v10,t.x),mix(v01,v11,t.x),t.y);
}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec3 c=fetchAt(p);
  vec2 pos=vec2(p)+.5-size*.5;          // centrado; la simetría hace irrelevante el volteo vertical
  if(ca!=0.){vec2 d=pos*ca;c.r=chan(vec2(p)+d,0);c.b=chan(vec2(p)-d,2);}
  float half_=max(size.x,size.y)*.5;
  if(lensVig!=0.){vec2 d=pos/half_;float e=min(1.,dot(d,d));c*=exp2(lensVig*e*e*.8);}
  c*=wb;
  outColor=vec4(c,log2(max(dot(c,YW),1e-6)));
}`;

const down = head + `
uniform sampler2D prepTex;
uniform vec2 size;      // vista
uniform vec2 msize;     // mapas
void main(){
  ivec2 q=ivec2(gl_FragCoord.xy);
  int jx=q.x, jy=int(msize.y)-1-q.y;                    // fila de mapa contada desde arriba
  int x0=int(ceil(float(jx)*size.x/msize.x-.5)), x1=int(ceil(float(jx+1)*size.x/msize.x-.5));
  int y0=int(ceil(float(jy)*size.y/msize.y-.5)), y1=int(ceil(float(jy+1)*size.y/msize.y-.5));
  vec3 s=vec3(0);float n=0.;
  for(int y=y0;y<y1;y++)for(int x=x0;x<x1;x++){s+=texelFetch(prepTex,ivec2(x,int(size.y)-1-y),0).rgb;n++;}
  vec3 m=s/max(n,1.);
  float Y=dot(m,YW);
  bool ok=Y>1e-6;
  outColor=vec4(log2(max(Y,1e-6)),max(0.,min(m.r,min(m.g,m.b))),ok?clamp(m.r/Y,0.,16.):1.,ok?clamp(m.b/Y,0.,16.):1.);
}`;

const lowpass = head + `
uniform sampler2D src;
uniform ivec2 dir;
uniform int radius, mode;
uniform vec2 eps;
vec4 value(ivec2 p){
  vec4 s=texelFetch(src,p,0);
  if(mode==0) return vec4(s.r,s.r*s.r,s.g,s.g*s.g);
  if(mode==1) return vec4(s.b,s.b*s.b,s.a,s.a*s.a);
  if(mode==3){
    float vx=max(0.,s.y-s.x*s.x),vy=max(0.,s.w-s.z*s.z),ax=vx/(vx+eps.x),ay=vy/(vy+eps.y);
    return vec4(ax,s.x*(1.-ax),ay,s.z*(1.-ay));
  }
  return s;
}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy),size=textureSize(src,0);
  vec4 s=vec4(0);float n=0.;
  for(int k=-32;k<=32;k++){
    if(k<-radius||k>radius)continue;
    ivec2 q=p+dir*k;
    if(q.x<0||q.y<0||q.x>=size.x||q.y>=size.y)continue;
    s+=value(q);n++;
  }
  outColor=s/n;
}`;

const fine = head + `
uniform sampler2D prepTex;
uniform float epsFine;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy),size=textureSize(prepTex,0);
  float s5=0.,q5=0.,n5=0.,s3=0.,n3=0.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    ivec2 q=p+ivec2(x,y);
    if(q.x<0||q.y<0||q.x>=size.x||q.y>=size.y)continue;
    float l=texelFetch(prepTex,q,0).a;
    s5+=l;q5+=l*l;n5++;
    if(abs(x)<=1&&abs(y)<=1){s3+=l;n3++;}
  }
  float m=s5/n5,v=max(0.,q5/n5-m*m),a=v/(v+epsFine);
  outColor=vec4(a,m*(1.-a),m,s3/n3);
}`;

const final = head + `
uniform sampler2D prepTex, fineTex, mapA, mapB;
uniform vec2 size, msize;
uniform bool original, useFine;
uniform float exposure, noise, colorNoise, dehaze, shadows, highlights, clarity, texture_, sharpen;
uniform float contrast, white, blacks, saturation, vibrance, hue, vignette, grain;
uniform mat3 toSrgb, okM1, okM2, okM2i, okM1i;
const float MID=${f(MID)};
const float SHOULDER=${f(SHOULDER)};
vec4 mapAt(sampler2D m,vec2 uvTop){
  // bilineal manual (texturas de 32 bits sin filtrado) en filas contadas desde arriba
  vec2 u=clamp(uvTop,vec2(0),msize-1.);ivec2 a=ivec2(floor(u));ivec2 b=min(a+1,ivec2(msize)-1);vec2 t=u-vec2(a);
  int H=int(msize.y)-1;
  vec4 v00=texelFetch(m,ivec2(a.x,H-a.y),0),v10=texelFetch(m,ivec2(b.x,H-a.y),0),v01=texelFetch(m,ivec2(a.x,H-b.y),0),v11=texelFetch(m,ivec2(b.x,H-b.y),0);
  return mix(mix(v00,v10,t.x),mix(v01,v11,t.x),t.y);
}
vec3 lab2srgb(vec3 lab){vec3 l=okM2i*lab;return okM1i*(l*l*l);}
bool inG(vec3 c){return all(greaterThanEqual(c,vec3(-1e-7)))&&all(lessThanEqual(c,vec3(1.+1e-7)));}
vec3 gamut(vec3 lab){
  if(lab.x>=1.)return vec3(1);if(lab.x<=0.)return vec3(0);
  vec3 c=lab2srgb(lab);if(inG(c))return c;
  float lo=0.,hi=1.;
  for(int k=0;k<14;k++){float t=(lo+hi)*.5;if(inG(lab2srgb(vec3(lab.x,lab.yz*t))))lo=t;else hi=t;}
  return clamp(lab2srgb(vec3(lab.x,lab.yz*lo)),0.,1.);
}
vec3 enc(vec3 c){c=clamp(c,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float grainAt(uint x,uint y){uint v=x*374761393u+y*668265263u;v=(v^(v>>13u))*1274126177u;return float((v^(v>>16u))&255u)/255.-.5;}
float ditherAt(uint x,uint y,uint c){
  uint h=((x*3u+c+0x2545f491u)*0x9e3779b1u)^((y+0x6a09e667u)*0x85ebca77u);
  h^=h>>15u;h*=0x2c1b3c6du;h^=h>>12u;return (float(h&1023u)+.5)/1024.-.5;
}
float sm(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 pr=texelFetch(prepTex,p,0);
  vec3 c=pr.rgb;float l0=pr.a;
  uint gx=uint(p.x),gy=uint(int(size.y)-1-p.y);
  if(original){outColor=vec4(enc(clamp(toSrgb*c,0.,1.)),1);return;}
  vec2 uvTop=vec2((float(p.x)+.5)*msize.x/size.x-.5,(float(int(size.y)-1-p.y)+.5)*msize.y/size.y-.5);
  vec4 ma=mapAt(mapA,uvTop);
  // fino: medias 5×5 de los coeficientes
  vec4 fc=texelFetch(fineTex,p,0);
  float af=0.,bf=0.;
  if(noise>0.){
    ivec2 sz=ivec2(size);float n=0.;
    for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){ivec2 q=p+ivec2(x,y);if(q.x<0||q.y<0||q.x>=sz.x||q.y>=sz.y)continue;vec4 v=texelFetch(fineTex,q,0);af+=v.x;bf+=v.y;n++;}
    af/=n;bf/=n;
  }
  float Ld=l0;
  if(noise>0.)Ld=l0+(af*l0+bf-l0)*noise;
  if(noise>0.||colorNoise>0.){
    float Y0=dot(c,YW);
    float cr=Y0>1e-6?clamp(c.r/Y0,0.,16.):1.,cb=Y0>1e-6?clamp(c.b/Y0,0.,16.):1.;
    if(colorNoise>0.){vec4 mb=mapAt(mapB,uvTop);cr+=(mb.x*cr+mb.y-cr)*colorNoise;cb+=(mb.z*cb+mb.w-cb)*colorNoise;}
    float Y1=exp2(Ld);c.r=cr*Y1;c.b=cb*Y1;c.g=max(0.,(Y1-YW.r*c.r-YW.b*c.b)/YW.g);
  }
  float E=log2(exposure);
  c*=exposure;
  float L=Ld+E;
  if(dehaze>0.){
    float h0=max(0.,min(pr.r,min(pr.g,pr.b)));
    float Hz=max(0.,ma.z*h0+ma.w)*exposure,k=.85*dehaze,t=1./(1.-k*min(Hz,.8));
    c=max(c-k*Hz,0.)*t;
  }else if(dehaze<0.){float vv=-dehaze*.5;c=c*(1.-vv)+vv*.3;}
  if(shadows!=0.||highlights!=0.||clarity!=0.||texture_!=0.||sharpen!=0.){
    float Lh=dehaze!=0.?log2(max(dot(c,YW),1e-6)):L;
    float Bs=ma.x*l0+ma.y+E+(Lh-L),D=Lh-Bs;
    if(shadows!=0.)Bs+=shadows*1.6*(1.-sm(MID-6.,MID+.5,Bs));
    if(highlights!=0.)Bs+=highlights*1.6*sm(MID-1.,MID+4.5,Bs);
    if(clarity!=0.){float e=D*clarity*.9;D+=e/(1.+abs(e)*.8);}
    if(texture_!=0.){float e=(l0-fc.z)*(1.-.6*noise)*texture_*.8;D+=e/(1.+abs(e)*2.);}
    if(sharpen!=0.){float F=l0-fc.w,th=.012+.05*noise,s=sign(F)*max(0.,abs(F)-th)*sharpen*1.8;D+=clamp(s,-.35,.35);}
    c*=exp2(Bs+D-Lh);
  }
  float Ys=dot(c,YW);
  if(Ys>0.){
    float lin=MID+contrast*log2(Ys/.18)-white,z=-SHOULDER*lin;
    float yd=min(1.,exp2((z>30.?lin:-log(1.+exp(z))/SHOULDER)+white));
    if(blacks!=0.){float q=1.-min(1.,yd),q2=q*q;yd=max(0.,yd+blacks*q2*q2*q2);}
    c*=yd/Ys;
  }else c=vec3(max(0.,blacks));
  vec3 s=toSrgb*c;
  bool colorOps=saturation!=1.||vibrance!=0.||hue!=0.;
  if(colorOps||!inG(s)){
    vec3 lab=okM2*pow(max(okM1*c,vec3(0)),vec3(1./3.));
    // (cbrt de negativos: tras la curva fílmica los valores son ≥ 0)
    if(hue!=0.){float ch=cos(hue),sh=sin(hue);lab.yz=vec2(lab.y*ch-lab.z*sh,lab.y*sh+lab.z*ch);}
    if(saturation!=1.||vibrance!=0.){float C=length(lab.yz);lab.yz*=saturation*(1.+vibrance*.8*(1.-sm(0.,.18,C)));}
    s=gamut(lab);
  }
  if(vignette!=0.){vec2 d=(vec2(p)+.5-size*.5)/(max(size.x,size.y)*.5);float e=min(1.,dot(d,d));s*=exp2(-vignette*e*e*.8);}
  float l=min(1.,dot(s,vec3(.2126,.7152,.0722)));
  float n=grain!=0.?grainAt(gx,gy)*grain*.035*(1.-l*l):0.;
  vec3 o=enc(s)+n;
  o=o*255.+vec3(ditherAt(gx,gy,0u),ditherAt(gx,gy,1u),ditherAt(gx,gy,2u));
  outColor=vec4(clamp(floor(o+.5)/255.,0.,1.),1);
}`;

export class PremiumGPU {
  /* `base` es la GPUPreview de siempre: se reutilizan su contexto, su
     textura de origen, su búfer de vértices y su compilador. */
  constructor(base){
    const gl = this.gl = base.gl;
    if(!gl.getExtension("EXT_color_buffer_float")) throw new Error("Sin texturas de coma flotante");
    this.base = base;
    this.p = { prep: base.program(vertex, prep), down: base.program(vertex, down), low: base.program(vertex, lowpass),
               fine: base.program(vertex, fine), final: base.program(vertex, final) };
    this.fb = gl.createFramebuffer();
    this.tex = {}; this.mapsKey = null; this.size = [0, 0];
  }
  target(name, w, h){
    const gl = this.gl; let t = this.tex[name];
    if(t && t.w === w && t.h === h) return t;
    if(t) gl.deleteTexture(t.t);
    const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    for(const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    return this.tex[name] = { t: tx, w, h };
  }
  pass(prog, out, inputs, set){
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? this.fb : null);
    if(out){
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out.t, 0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("La GPU no admite el revelado Premium");
      gl.viewport(0, 0, out.w, out.h);
    } else gl.viewport(0, 0, this.size[0], this.size[1]);
    gl.useProgram(prog.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.base.buffer);
    gl.enableVertexAttribArray(prog.position); gl.vertexAttribPointer(prog.position, 2, gl.FLOAT, false, 0, 0);
    inputs.forEach(([name, tex], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.uniforms[name], i); });
    set(prog.uniforms);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* s: ajustes normalizados; full: [ancho, alto] del ORIGINAL */
  render(s, original, full){
    const gl = this.gl, b = this.base, W = b.canvas.width, H = b.canvas.height;
    this.size = [W, H];
    const P = premiumParams(s, wbGains(s));
    // La vista previa se muestra en el espacio de salida elegido (Display P3: sin recortar a sRGB)
    if("drawingBufferColorSpace" in gl && gl.drawingBufferColorSpace !== P.space){ try{ gl.drawingBufferColorSpace = P.space; }catch{} }
    const prepT = this.target("prep", W, H);
    this.pass(this.p.prep, prepT, [["image", b.input]], u => {
      gl.uniform1i(u.linearSource, b.linearSource ? 1 : 0);
      gl.uniformMatrix3fv(u.toWide, false, glMat3(SRGB_TO_2020));
      gl.uniform3fv(u.wb, P.wb); gl.uniform2f(u.size, W, H);
      gl.uniform1f(u.lensVig, P.lensVignette);
      gl.uniform1f(u.ca, P.ca);
    });
    const [mw, mh] = mapSize(full[0], full[1]);
    const key = mapsKey(s) + `|${W}x${H}|${b.sourceVersion || 0}`;
    if(key !== this.mapsKey){
      const low = this.target("low", mw, mh);
      this.pass(this.p.down, low, [["prepTex", prepT.t]], u => { gl.uniform2f(u.size, W, H); gl.uniform2f(u.msize, mw, mh); });
      const chain = (mode, radius, eps, name) => {
        const t1 = this.target(name + "1", mw, mh), t2 = this.target(name + "2", mw, mh);
        const lp = (src, out, dir, m) => this.pass(this.p.low, out, [["src", src.t]], u => {
          gl.uniform2i(u.dir, dir[0], dir[1]); gl.uniform1i(u.radius, radius); gl.uniform1i(u.mode, m); gl.uniform2f(u.eps, eps[0], eps[1]);
        });
        lp(low, t1, [1, 0], mode); lp(t1, t2, [0, 1], 2); lp(t2, t1, [1, 0], 3);
        const outT = this.target(name, mw, mh); lp(t1, outT, [0, 1], 2);
      };
      chain(0, R_COARSE, [EPS_COARSE, EPS_HAZE], "mapA");
      chain(1, R_CHROMA, [P.epsChroma, P.epsChroma], "mapB");
      this.mapsKey = key;
    }
    const fineT = this.target("fine", W, H);
    this.pass(this.p.fine, fineT, [["prepTex", prepT.t]], u => gl.uniform1f(u.epsFine, P.epsFine));
    this.pass(this.p.final, null, [["prepTex", prepT.t], ["fineTex", fineT.t], ["mapA", this.tex.mapA.t], ["mapB", this.tex.mapB.t]], u => {
      gl.uniform2f(u.size, W, H); gl.uniform2f(u.msize, mw, mh);
      gl.uniform1i(u.original, original ? 1 : 0);
      for(const k of ["exposure", "noise", "colorNoise", "dehaze", "shadows", "highlights", "clarity", "sharpen", "contrast", "white", "blacks", "saturation", "vibrance", "hue", "vignette", "grain"]) gl.uniform1f(u[k], P[k]);
      gl.uniform1f(u.texture_, P.texture);
      gl.uniformMatrix3fv(u.toSrgb, false, glMat3(P.out.T));
      gl.uniformMatrix3fv(u.okM1, false, glMat3(OK_M1_2020)); gl.uniformMatrix3fv(u.okM2, false, glMat3(OK_M2));
      gl.uniformMatrix3fv(u.okM2i, false, glMat3(OK_M2_INV)); gl.uniformMatrix3fv(u.okM1i, false, glMat3(P.out.M1i));
    });
  }
  invalidate(){ this.mapsKey = null; }
  dispose(){
    const gl = this.gl;
    for(const t of Object.values(this.tex)) gl.deleteTexture(t.t);
    gl.deleteFramebuffer(this.fb); this.tex = {};
  }
}
