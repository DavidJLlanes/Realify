/* ═══════════════════════════════════════════════════════════════
   FILTRO VINTAGE · MOTOR WebGL2
   Un solo programa de fragmentos calcula todos los modificadores en
   un paso, y se usa tal cual para la vista previa y para el resultado
   final: lo que se ve arrastrando un deslizador es lo que se aplica.

   Coordenadas: todo efecto espacial se expresa en coordenadas de la
   imagen COMPLETA (0-1, o fracciones de su lado mayor), nunca en
   píxeles de la vista previa. Así el grano, el polvo, las fugas o el
   viñeteado caen en el mismo sitio en la vista previa reducida y en
   cada tesela del resultado a resolución completa.

   Texturas:
     · image   → la vista previa entera, o una tesela del original con
                 margen (los efectos que muestrean lejos —espiral,
                 coma, trepidación, distorsión— necesitan vecinos)
     · low / blurS / blurW / bright → versiones de 640 px de la imagen
                 ENTERA (suavizadas y paso de altas luces), comunes a
                 vista previa y resultado: sirven para el destello, la
                 halación, la pérdida de foco periférica…
     · burn / dodge / paint → capas dibujadas (ver overlays.js)
   ═══════════════════════════════════════════════════════════════ */

import { CONTROLS, normalize } from "./state.js";
import { drawOverlays, overlayKey, rng } from "./overlays.js";

const LOW = 640;
const N = CONTROLS.length;
const DEFINES = CONTROLS.map((c, i) => `#define ${c.key.toUpperCase()} A[${i}]`).join("\n");

const VERT = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0., 1.); }`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D src; uniform vec2 dir; uniform float sigma; uniform bool brightPass;
out vec4 o;
void main(){
  vec2 size = vec2(textureSize(src, 0)), uv = gl_FragCoord.xy / size;
  vec3 acc = vec3(0.); float wsum = 0.;
  for(int i = -12; i <= 12; i++){
    float w = exp(-float(i * i) / (2. * sigma * sigma));
    vec3 c = texture(src, uv + dir * float(i) / size).rgb;
    if(brightPass){ float l = dot(c, vec3(.2126, .7152, .0722)); c *= smoothstep(.78, 1., l); }
    acc += c * w; wsum += w;
  }
  o = vec4(acc / wsum, 1.);
}`;

const MAIN = `#version 300 es
precision highp float;
uniform sampler2D uImage, uBlurS, uBlurW, uBright, uBurn, uDodge, uPaint;
uniform vec2 uFull, uTexOrigin, uTexSize, uCanvas, uLight, uShake;
uniform vec4 uRegion;
uniform vec4 uLeak[3];
uniform float A[${N}];
uniform bool uOriginal, uHasLight;
out vec4 outColor;
${DEFINES}

float LSIDE;
vec4 img(vec2 g){
  vec2 t = (clamp(g, 0., 1.) * uFull - uTexOrigin) / uTexSize;
  return texture(uImage, clamp(t, 0., 1.));
}
vec3 imgRGB(vec2 g){ return img(g).rgb; }
/* Coordenadas centradas: esquina = radio 1, aspecto real */
float HALFDIAG;
vec2 toC(vec2 g){ return (g - .5) * uFull / HALFDIAG; }
vec2 fromC(vec2 v){ return v * HALFDIAG / uFull + .5; }
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec3 grad3(float t, vec3 a, vec3 b, vec3 c){ return t < .5 ? mix(a, b, t * 2.) : mix(b, c, t * 2. - 1.); }
vec3 screen(vec3 a, vec3 b){ return 1. - (1. - a) * (1. - b); }
vec3 scurve(vec3 x, float k){ return mix(x, x * x * (3. - 2. * x), k); }

void main(){
  LSIDE = max(uFull.x, uFull.y);
  HALFDIAG = .5 * length(uFull);
  vec2 frag = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 gp = uRegion.xy + frag / uCanvas * uRegion.zw;
  vec2 g = gp / uFull;
  vec2 ouv = frag / uCanvas;
  vec4 src = img(g);
  if(uOriginal){ outColor = src; return; }

  /* ── Geometría ── */
  vec2 v = toC(g);
  float kb = BARREL / 100. * .24 - PINCUSHION / 100. * .2;
  if(kb != 0.){ float r2 = dot(v, v); v = v * (1. + kb * r2) / (1. + max(kb, 0.)); }
  vec2 gs = fromC(v);
  float r = length(toC(gs)), r2 = r * r;

  /* ── Óptica: muestreo ── */
  vec3 c = imgRGB(gs);
  if(CA > 0.){
    vec2 d = (gs - .5) * CA / 100. * .006;
    c.r = imgRGB(gs + d).r; c.b = imgRGB(gs - d).b;
  }
  if(SWIRL > 0.){
    float a = SWIRL / 100. * .06 * (.35 + r2);
    vec3 acc = vec3(0.);
    for(int i = 0; i < 9; i++){ float t = float(i) / 8. - .5; acc += imgRGB(fromC(rot(toC(gs), a * t))); }
    c = mix(c, acc / 9., smoothstep(.18, .85, r) * min(1., SWIRL / 100. * 1.6));
  }
  if(SHAKE > 0.){
    vec2 d = uShake * LSIDE / uFull * SHAKE / 100. * .007;
    vec3 acc = vec3(0.);
    for(int i = 0; i < 9; i++){ float t = float(i) / 8. - .5; acc += imgRGB(gs + d * t); }
    c = mix(c, acc / 9., min(1., SHAKE / 100. * 1.3));
    c = mix(c, imgRGB(gs + d * 1.6), SHAKE / 100. * .32);
  }
  if(SOFT > 0.){
    vec2 rad = vec2(.0011 * LSIDE) / uFull;
    vec3 acc = c;
    for(int i = 0; i < 8; i++){ float a = float(i) * .7854; acc += imgRGB(gs + vec2(cos(a), sin(a)) * rad); }
    c = mix(c, acc / 9., SOFT / 100. * .9);
    c = mix(c, texture(uBlurS, gs).rgb, SOFT / 100. * .22);
  }
  if(EDGEBLUR > 0.){
    float e = smoothstep(.22, 1., r) * EDGEBLUR / 100.;
    c = mix(c, texture(uBlurS, gs).rgb, min(1., e * 1.5));
    c = mix(c, texture(uBlurW, gs).rgb, max(0., e - .45));
  }
  if(COMA > 0.){
    vec2 n = normalize(toC(gs) + 1e-5), pp = vec2(-n.y, n.x);
    float len = COMA / 100. * .07 * r2;
    vec3 acc = vec3(0.);
    for(int i = 1; i <= 10; i++){
      float t = float(i) / 10.;
      vec2 q = toC(gs) - n * len * t + pp * len * t * t * .45 * (mod(float(i), 2.) * 2. - 1.);
      vec3 s = imgRGB(fromC(q));
      acc += s * smoothstep(.82, 1., luma(s)) * (1. - t);
    }
    c += acc / 5. * COMA / 100. * smoothstep(.35, 1., r) * 1.1;
  }

  /* ── Luz ── */
  if(BLOOM > 0.){
    vec3 bw = texture(uBlurW, gs).rgb;
    c = screen(c, bw * BLOOM / 100. * .7);
    c = mix(c, c * .88 + .06, BLOOM / 100. * .3);
  }
  if(HALATION > 0.){
    // El halo nace del reflejo en la base de la película: se ve
    // ALREDEDOR de la luz intensa, no encima de ella.
    vec3 br = texture(uBright, gs).rgb;
    float h = dot(br, vec3(.3, .5, .2));
    float own = smoothstep(.78, 1., luma(c));
    h = max(0., h - own * .85);
    c += vec3(1., .3, .1) * h * HALATION / 100. * 2.2;
  }

  /* ── Color ── */
  float l = luma(c);
  if(AGEDDESAT > 0.){
    float cg = max(0., (c.g + c.b) * .5 - c.r) + max(0., c.g - max(c.r, c.b));
    float s = 1. - AGEDDESAT / 100. * (.45 + .5 * clamp(cg * 4., 0., 1.));
    c = l + (c - l) * s;
    c = mix(c, c * vec3(1.02, 1., .95), AGEDDESAT / 100. * .5);
  }
  if(WARMSLIDE > 0.){
    float t = WARMSLIDE / 100.;
    vec3 w = scurve(c, .55);
    float lw = luma(w);
    w = lw + (w - lw) * 1.28;
    w *= vec3(1.07, 1.01, .86);
    w.b += (1. - lw) * .04;
    c = mix(c, w, t);
  }
  if(COOLNEG > 0.){
    float t = COOLNEG / 100.;
    vec3 w = c;
    float gdom = max(0., w.g - max(w.r, w.b));
    w.g -= gdom * .45; w.r += gdom * .12;
    float lw = luma(w);
    w = lw + (w - lw) * .82;
    w += (1. - lw) * (1. - lw) * vec3(-.03, .015, .06);
    w += lw * lw * vec3(-.01, .02, .0);
    c = mix(c, w, t);
  }
  if(CROSS > 0.){
    float t = CROSS / 100.;
    vec3 x = c;
    x.r = mix(x.r, x.r * x.r * (3. - 2. * x.r), .9);
    x.r = mix(x.r, x.r * x.r * (3. - 2. * x.r), .6);
    x.g = mix(x.g, x.g * x.g * (3. - 2. * x.g), .6) * 1.04 + .02;
    x.b = x.b * .62 + .16;
    float lx = luma(x);
    x = lx + (x - lx) * 1.35;
    c = mix(c, x, t);
  }
  if(CASTYELLOW > 0.) c = mix(c, c * vec3(1.04, 1.0, .74) + vec3(.035, .025, 0.), CASTYELLOW / 100.);
  if(CASTGREEN > 0.)  c = mix(c, c * vec3(.9, 1.03, .9) + vec3(0., .035, .012), CASTGREEN / 100.);
  if(CASTMAGENTA > 0.)c = mix(c, c * vec3(1.05, .85, 1.02) + vec3(.035, 0., .035), CASTMAGENTA / 100.);
  if(SPLIT > 0.){
    float lw = luma(c);
    c += SPLIT / 100. * ((1. - lw) * (1. - lw) * vec3(-.05, .01, .07) + lw * lw * vec3(.07, .035, -.05));
  }
  if(ORTHO > 0.){
    float m = dot(clamp(c, 0., 1.), vec3(.03, .37, .60));
    m = mix(m, m * m * (3. - 2. * m), .3);
    c = mix(c, vec3(m), ORTHO / 100.);
  }
  // Virados: mapa de degradado sobre la luminosidad
  if(SEPIA + CYANOTYPE + SELENIUM + PLATINUM > 0.){
    float m = clamp(luma(c), 0., 1.);
    if(SEPIA > 0.)     c = mix(c, grad3(m, vec3(.16, .09, .05), vec3(.62, .45, .30), vec3(1., .95, .83)), SEPIA / 100.);
    if(CYANOTYPE > 0.) c = mix(c, grad3(m, vec3(.02, .09, .24), vec3(.16, .38, .64), vec3(.88, .94, .98)), CYANOTYPE / 100.);
    if(SELENIUM > 0.)  c = mix(c, grad3(m, vec3(.09, .05, .10), vec3(.43, .40, .44), vec3(.95, .95, .96)), SELENIUM / 100.);
    if(PLATINUM > 0.)  c = mix(c, grad3(m, vec3(.20, .17, .14), vec3(.55, .50, .44), vec3(.95, .92, .86)), PLATINUM / 100.);
  }

  /* ── Tono ── */
  if(LOWRANGE > 0.) c = mix(c, smoothstep(.1, .9, c), LOWRANGE / 100.);
  if(ROLLOFF > 0.){
    float t = ROLLOFF / 100.;
    vec3 w = smoothstep(.45, 1., c);
    vec3 sh = 1. - pow(max(1. - c, 0.), vec3(1. + .9 * t));
    c = mix(c, sh * (1. - .12 * t * w), w);
  }
  if(FADE > 0.){ float t = FADE / 100. * .24; c = t * vec3(1., .98, .95) + c * (1. - t - FADE / 100. * .06); }
  if(FOG > 0.){
    float t = FOG / 100.;
    float lf = luma(c);
    c = mix(c, vec3(lf), t * .25);
    c = mix(c, vec3(.62, .63, .6), t * .38);
  }

  /* ── Luces añadidas ── */
  if(LEAKS > 0.){
    for(int k = 0; k < 3; k++){
      vec4 L = uLeak[k];
      vec2 d = (g - L.xy) * uFull / LSIDE;
      float f = exp(-dot(d, d) / (L.z * L.z));
      vec3 col = mix(vec3(1., .5, .12), vec3(1., .16, .07), L.w);
      c = screen(c, col * f * LEAKS / 100. * .95);
    }
  }
  if(FLARE > 0. && uHasLight){
    vec2 C = vec2(.5);
    float tt[5] = float[5](-.35, .25, .55, .9, 1.25);
    float rr[5] = float[5](.05, .03, .08, .045, .11);
    vec3 tint[5] = vec3[5](vec3(1., .8, .5), vec3(.5, 1., .7), vec3(.6, .7, 1.), vec3(1., .6, .8), vec3(.8, .9, 1.));
    vec3 acc = vec3(0.);
    for(int i = 0; i < 5; i++){
      vec2 P = C + (C - uLight) * tt[i];
      float d = length((g - P) * uFull / LSIDE);
      float ring = exp(-pow((d - rr[i]) / (rr[i] * .12), 2.)) * .55 + exp(-pow(d / rr[i], 4.)) * .12;
      acc += tint[i] * ring;
    }
    float dl = length((g - uLight) * uFull / LSIDE);
    acc += vec3(1., .85, .6) * (exp(-pow((dl - .16) / .02, 2.)) * .35 + exp(-dl * 18.) * .5);
    c += acc * FLARE / 100. * .6;
  }

  /* ── Viñeteados ── */
  if(VIGOPTICAL > 0.) c *= 1. - VIGOPTICAL / 100. * .82 * pow(smoothstep(.1, 1.15, r), 1.5);
  if(VIGMECH > 0.){
    float R = 1.25 - .45 * VIGMECH / 100.;
    c *= smoothstep(R, R - .09, length(toC(g)));
  }

  /* ── Grano: más grueso y marcado en sombras ── */
  if(GRAIN > 0.){
    float lg = clamp(luma(c), 0., 1.);
    float px = uRegion.z / uCanvas.x;
    float cell = max(LSIDE / 2600., px * .9);
    float n1 = vnoise(gp / cell) - .5, n2 = vnoise(gp / (cell * 2.6) + 17.3) - .5;
    float n = mix(n1, n2, (1. - lg) * .65);
    float amp = GRAIN / 100. * (.05 + .13 * (1. - lg) * (1. - lg));
    c += vec3(n) * amp + (vec3(vnoise(gp / cell + 3.1), vnoise(gp / cell + 7.7), vnoise(gp / cell + 11.)) - .5) * amp * .15;
  }

  /* ── Capas dibujadas ── */
  c = clamp(c, 0., 1.);
  float burn = texture(uBurn, ouv).a, dodge = texture(uDodge, ouv).a;
  vec4 paint = texture(uPaint, ouv);
  c *= 1. - burn * .92;
  c = mix(c, vec3(.97, .96, .92), dodge * .9);
  c = mix(c, paint.rgb, paint.a);
  outColor = vec4(clamp(c, 0., 1.), max(src.a, paint.a));
}`;

/* Réplica en la CPU de la distorsión del shader: qué punto del
   original se lee para un punto dado del resultado. Para calcular qué
   trozo del original necesita cada tesela. */
function geomMap(gx, gy, W, H, s){
  const kb = s.barrel / 100 * .24 - s.pincushion / 100 * .2;
  if(!kb) return [gx, gy];
  const hd = .5 * Math.hypot(W, H);
  let vx = (gx / W - .5) * W / hd, vy = (gy / H - .5) * H / hd;
  const f = (1 + kb * (vx * vx + vy * vy)) / (1 + Math.max(kb, 0));
  vx *= f; vy *= f;
  return [(vx * hd / W + .5) * W, (vy * hd / H + .5) * H];
}

/* Margen de vecindad (fracción del lado mayor) que necesitan los
   efectos que muestrean lejos del píxel. */
const marginFrac = s => .004 + s.swirl / 100 * .045 + s.coma / 100 * .045 + s.shake / 100 * .013 + s.ca / 100 * .004 + s.soft / 100 * .002;

/* Parámetros aleatorios que no dibuja el lienzo 2D: fugas de luz y
   dirección de la trepidación. */
function seeded(s){
  const R = rng(s.seed * 97 + 13);
  const leaks = [];
  for(let i = 0; i < 3; i++){
    const edge = Math.floor(R() * 4), t = R();
    const pos = [[t, -.05], [1.05, t], [t, 1.05], [-.05, t]][edge];
    leaks.push(pos[0], pos[1], .12 + R() * .22, R());
  }
  const a = R() * Math.PI;
  return { leaks: new Float32Array(leaks), shake: [Math.cos(a), Math.sin(a)] };
}

export class VintageGL {
  constructor(canvas = document.createElement("canvas")){
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
    if(!gl) throw new Error("El Filtro Vintage necesita WebGL2, que este navegador no ofrece.");
    this.textures = []; this.programs = [];
    this.main = this.program(MAIN); this.blur = this.program(BLUR);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.fb = gl.createFramebuffer();
    this.tex = { image: this.texture(), low: this.texture(), tmp: this.texture(), blurS: this.texture(),
                 blurW: this.texture(), bright: this.texture(), burn: this.texture(), dodge: this.texture(), paint: this.texture() };
    this.overlay = { burn: this.ctx2d(), dodge: this.ctx2d(), paint: this.ctx2d() };
    this.maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
    gl.disable(gl.BLEND); gl.disable(gl.DITHER);
  }
  ctx2d(){ const c = document.createElement("canvas"); c.width = c.height = 1; return c.getContext("2d"); }
  program(fs){
    const gl = this.gl, p = gl.createProgram(); this.programs.push(p);
    for(const [type, code] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]]){
      const sh = gl.createShader(type); gl.shaderSource(sh, code); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh); gl.deleteShader(sh);
    }
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for(let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++){
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u, pos: gl.getAttribLocation(p, "position") };
  }
  texture(){
    const gl = this.gl, t = gl.createTexture(); this.textures.push(t);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  upload(tex, source){
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }
  draw(prog, target, w, h){
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? this.fb : null);
    if(target) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(prog.pos);
    gl.vertexAttribPointer(prog.pos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  blurPass(src, dst, w, h, dir, sigma, bright = false){
    const gl = this.gl, b = this.blur;
    gl.bindTexture(gl.TEXTURE_2D, dst);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.useProgram(b.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(b.u.src, 0); gl.uniform2f(b.u.dir, dir[0], dir[1]); gl.uniform1f(b.u.sigma, sigma); gl.uniform1i(b.u.brightPass, bright ? 1 : 0);
    this.draw(b, dst, w, h);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Imagen completa a la que se refieren los efectos (su tamaño real)
      y versiones de 640 px para los efectos difusos y la posición de
      la luz más intensa (destellos de lente). */
  setImage(full, W, H){
    this.W = W; this.H = H;
    const k = Math.min(1, LOW / Math.max(W, H));
    const lw = Math.max(1, Math.round(W * k)), lh = Math.max(1, Math.round(H * k));
    const low = document.createElement("canvas"); low.width = lw; low.height = lh;
    const lx = low.getContext("2d", { willReadFrequently: true });
    lx.imageSmoothingQuality = "high"; lx.drawImage(full, 0, 0, lw, lh);
    this.upload(this.tex.low, low);
    const T = this.tex;
    this.blurPass(T.low, T.tmp, lw, lh, [1, 0], 2);   this.blurPass(T.tmp, T.blurS, lw, lh, [0, 1], 2);
    this.blurPass(T.blurS, T.tmp, lw, lh, [1, 0], 7); this.blurPass(T.tmp, T.blurW, lw, lh, [0, 1], 7);
    this.blurPass(T.low, T.tmp, lw, lh, [1, 0], 5, true); this.blurPass(T.tmp, T.bright, lw, lh, [0, 1], 5);
    this.lowSize = [lw, lh];
    // Luz más intensa: bloques de 8×8 de la miniatura.
    const d = lx.getImageData(0, 0, lw, lh).data;
    let best = 0, bx = .3, by = .3;
    for(let y = 0; y < lh; y += 8) for(let x = 0; x < lw; x += 8){
      let sum = 0, n = 0;
      for(let yy = y; yy < Math.min(lh, y + 8); yy++) for(let xx = x; xx < Math.min(lw, x + 8); xx++){
        const i = (yy * lw + xx) * 4; sum += .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; n++;
      }
      if(sum / n > best){ best = sum / n; bx = (x + 4) / lw; by = (y + 4) / lh; }
    }
    this.light = { x: bx, y: by, ok: best > 200 };
    low.width = low.height = 1;
    this.overlayKey = null;
  }

  /** Textura principal: la vista previa entera (`region` omitida) o un
      recorte del original a resolución completa. */
  setTexture(canvas, origin = [0, 0], size = [this.W, this.H]){
    this.upload(this.tex.image, canvas);
    this.texOrigin = origin; this.texSize = size;
  }

  overlays(s, region, cw, ch){
    const key = overlayKey(s) + `|${region.x},${region.y},${region.w},${region.h}|${cw}x${ch}`;
    if(key === this.overlayKey) return;
    for(const ctx of Object.values(this.overlay)){
      if(ctx.canvas.width !== cw || ctx.canvas.height !== ch){ ctx.canvas.width = cw; ctx.canvas.height = ch; }
    }
    drawOverlays(this.overlay, this.W, this.H, region, s);
    this.upload(this.tex.burn, this.overlay.burn.canvas);
    this.upload(this.tex.dodge, this.overlay.dodge.canvas);
    this.upload(this.tex.paint, this.overlay.paint.canvas);
    this.overlayKey = key;
  }

  /** Dibuja en el lienzo WebGL (de `cw`×`ch` píxeles) la zona `region`
      de la imagen completa. */
  render(state, { region = { x: 0, y: 0, w: this.W, h: this.H }, cw, ch, original = false } = {}){
    const s = normalize(state), gl = this.gl, m = this.main, u = m.u;
    if(gl.isContextLost()) throw new Error("Se ha perdido el contexto gráfico");
    if(this.canvas.width !== cw || this.canvas.height !== ch){ this.canvas.width = cw; this.canvas.height = ch; }
    this.overlays(s, region, cw, ch);
    const rnd = seeded(s);
    gl.useProgram(m.p);
    const bind = (unit, tex, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); };
    bind(0, this.tex.image, "uImage"); bind(1, this.tex.blurS, "uBlurS"); bind(2, this.tex.blurW, "uBlurW");
    bind(3, this.tex.bright, "uBright"); bind(4, this.tex.burn, "uBurn"); bind(5, this.tex.dodge, "uDodge"); bind(6, this.tex.paint, "uPaint");
    gl.uniform2f(u.uFull, this.W, this.H);
    gl.uniform2f(u.uTexOrigin, this.texOrigin[0], this.texOrigin[1]);
    gl.uniform2f(u.uTexSize, this.texSize[0], this.texSize[1]);
    gl.uniform2f(u.uCanvas, cw, ch);
    gl.uniform4f(u.uRegion, region.x, region.y, region.w, region.h);
    gl.uniform2f(u.uLight, this.light.x, this.light.y);
    gl.uniform1i(u.uHasLight, this.light.ok ? 1 : 0);
    gl.uniform2f(u.uShake, rnd.shake[0], rnd.shake[1]);
    gl.uniform4fv(u.uLeak, rnd.leaks);
    gl.uniform1fv(u.A, new Float32Array(CONTROLS.map(c => s[c.key])));
    gl.uniform1i(u.uOriginal, original ? 1 : 0);
    this.draw(m, null, cw, ch);
  }

  /** Resultado a resolución completa, por teselas. `src` es el lienzo
      original; devuelve un lienzo nuevo del mismo tamaño. */
  async renderFull(src, state, onProgress = () => {}){
    const s = normalize(state), W = src.width, H = src.height, L = Math.max(W, H);
    this.setImage(src, W, H);
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const octx = out.getContext("2d");
    const margin = Math.ceil(marginFrac(s) * L) + 4;
    let tile = Math.max(256, this.maxTex - 2 * margin - 8);
    const tmp = document.createElement("canvas"), tctx = tmp.getContext("2d");
    const tiles = [];
    for(let y = 0; y < H; y += tile) for(let x = 0; x < W; x += tile)
      tiles.push({ x, y, w: Math.min(tile, W - x), h: Math.min(tile, H - y) });
    for(let i = 0; i < tiles.length; i++){
      const t = tiles[i];
      // Zona del original que necesita la tesela: su imagen por la
      // distorsión, más el margen de los efectos de vecindad.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for(let k = 0; k <= 8; k++) for(const [px, py] of [[t.x + t.w * k / 8, t.y], [t.x + t.w * k / 8, t.y + t.h], [t.x, t.y + t.h * k / 8], [t.x + t.w, t.y + t.h * k / 8]]){
        const [mx, my] = geomMap(px, py, W, H, s);
        x0 = Math.min(x0, mx, px); y0 = Math.min(y0, my, py); x1 = Math.max(x1, mx, px); y1 = Math.max(y1, my, py);
      }
      const bx = Math.max(0, Math.floor(x0 - margin)), by = Math.max(0, Math.floor(y0 - margin));
      const bw = Math.min(W, Math.ceil(x1 + margin)) - bx, bh = Math.min(H, Math.ceil(y1 + margin)) - by;
      const scale = Math.min(1, this.maxTex / Math.max(bw, bh));
      tmp.width = Math.max(1, Math.round(bw * scale)); tmp.height = Math.max(1, Math.round(bh * scale));
      tctx.imageSmoothingQuality = "high";
      tctx.drawImage(src, bx, by, bw, bh, 0, 0, tmp.width, tmp.height);
      this.setTexture(tmp, [bx, by], [bw, bh]);
      this.render(s, { region: { x: t.x, y: t.y, w: t.w, h: t.h }, cw: t.w, ch: t.h });
      octx.drawImage(this.canvas, t.x, t.y);
      onProgress(Math.round((i + 1) / tiles.length * 100));
      await new Promise(r => setTimeout(r, 0));
    }
    tmp.width = tmp.height = 1;
    return out;
  }

  dispose(){
    const gl = this.gl;
    for(const t of this.textures) gl.deleteTexture(t);
    for(const p of this.programs) gl.deleteProgram(p);
    gl.deleteBuffer(this.buffer); gl.deleteFramebuffer(this.fb);
    for(const ctx of Object.values(this.overlay)) ctx.canvas.width = ctx.canvas.height = 1;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
