/* ═══════════════════════════════════════════════════════════════
   CÁMARAS · MOTOR WebGL2
   Un solo programa de fragmentos calcula todos los modificadores, y se
   usa tal cual para las miniaturas, la vista previa y el resultado a
   resolución completa (por teselas): lo que se ve es lo que se aplica.

   Coordenadas: todo efecto espacial se expresa en coordenadas de la
   imagen COMPLETA (píxeles `gp`, o fracciones de su lado mayor), nunca
   en píxeles de la vista previa. El polvo, las fugas o la trama caen
   en el mismo sitio en una miniatura, en la vista previa y en cada
   tesela del resultado.

   Dos etapas:
     A · ÓPTICA Y LUZ  (muestreo, desenfoques, resplandor, flash, rayas
         de luz, halación, fugas, viñeteado)
     B · REVELADO      (curvas, color, virados, grano, daños, marcos)
   Con el modo Premium 👑, la etapa A se calcula en LUZ LINEAL (los
   desenfoques también), con un hombro suave en las luces en vez de
   recorte duro, y la salida lleva tramado triangular para que los
   degradados no hagan bandas. Sin él, todo se calcula sobre el valor
   codificado, que es más rápido y más "digital".
   ═══════════════════════════════════════════════════════════════ */

import { CONTROLS, effective } from "./state.js";
import { workSpace } from "../js/core/colorspace.js";

const LOW = 640;
const N = CONTROLS.length;
const DEFINES = CONTROLS.map((c, i) => `#define ${c.key.toUpperCase()} A[${i}]`).join("\n");
const IDX = Object.fromEntries(CONTROLS.map((c, i) => [c.key, i]));

const VERT = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0., 1.); }`;

/* Desenfoque separable de 25 tomas. `dir` es el paso entre tomas en
   píxeles; `thr` > 0 deja sólo las luces; `lin` promedia en luz lineal. */
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D src; uniform vec2 dir; uniform float sigma, thr; uniform bool lin;
out vec4 o;
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 toGam(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main(){
  vec2 size = vec2(textureSize(src, 0)), uv = gl_FragCoord.xy / size;
  vec3 acc = vec3(0.); float wsum = 0.;
  for(int i = -12; i <= 12; i++){
    float w = exp(-float(i * i) / (2. * sigma * sigma));
    vec3 c = texture(src, uv + dir * float(i) / size).rgb;
    if(thr > 0.){ float l = dot(c, vec3(.2126, .7152, .0722)); c *= smoothstep(thr, 1., l); }
    if(lin) c = toLin(c);
    acc += c * w; wsum += w;
  }
  acc /= wsum;
  o = vec4(lin ? toGam(acc) : acc, 1.);
}`;

const MAIN = `#version 300 es
precision highp float;
uniform sampler2D uImage, uBlurS, uBlurW, uBright, uSV, uSH, uStamp;
uniform vec2 uFull, uTexOrigin, uTexSize, uCanvas, uStampSize;
uniform vec4 uRegion;
uniform vec4 uLeak[2];
uniform float A[${N}];
uniform float uSeed;
uniform bool uOriginal, uPrem;
out vec4 outColor;
${DEFINES}

float LSIDE, SSIDE, HALFDIAG;
const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);

vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 toGam(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
vec3 W(vec3 c){ return uPrem ? toLin(c) : c; }          // valor codificado → espacio de trabajo de la etapa A
vec3 shoulder(vec3 x){ vec3 t = max(x - .8, 0.); return min(x, vec3(.8)) + .2 * (1. - exp(-t / .2)); }

vec4 imgA(vec2 g){
  vec2 t = (clamp(g, 0., 1.) * uFull - uTexOrigin) / uTexSize;
  return texture(uImage, clamp(t, 0., 1.));
}
vec3 im(vec2 g){ return W(imgA(g).rgb); }
vec3 tx(sampler2D s, vec2 g){ return W(texture(s, clamp(g, 0., 1.)).rgb); }

float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
float luma2(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hs(vec2 p, float k){ return hash(p + vec2(uSeed * .137 + k, uSeed * .311 - k * .7)); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec2 toC(vec2 g){ return (g - .5) * uFull / HALFDIAG; }
vec3 rgb2ycc(vec3 c){ float y = luma2(c); return vec3(y, (c.b - y) * .565, (c.r - y) * .713); }
vec3 ycc2rgb(vec3 v){ return vec3(v.x + v.z / .713, v.x - .344 * v.y / .565 - .714 * v.z / .713, v.x + v.y / .565); }
vec3 scurve(vec3 x){ return x * x * (3. - 2. * x); }

void main(){
  LSIDE = max(uFull.x, uFull.y); SSIDE = min(uFull.x, uFull.y);
  HALFDIAG = .5 * length(uFull);
  vec2 frag = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 gp = uRegion.xy + frag / uCanvas * uRegion.zw;
  vec2 g = gp / uFull;
  vec4 srcA = imgA(g);
  if(uOriginal){ outColor = srcA; return; }
  float px = uRegion.z / uCanvas.x;
  float aa = max(px, 1.);
  float outside = 0.;

  /* ═════════ Geometría: dónde se lee la imagen ═════════ */
  vec2 gs = g;
  if(TAPE > 0.){
    float tt = TAPE / 100.;
    float row = floor(gp.y / max(uFull.y / 240., 1.));
    float tj = (hs(vec2(row, 2.), 1.) - .5) * .008 * tt + sin(g.y * 38. + uSeed) * .0025 * tt;
    float yb = fract(uSeed * .6180339);
    tj += smoothstep(.05, 0., abs(g.y - yb)) * (hs(vec2(row, 5.), 2.) - .5) * .06 * tt;
    tj += smoothstep(.94, 1., g.y) * (hs(vec2(row, 9.), 3.) - .3) * .08 * tt;
    gs.x += tj;
  }
  if(CRT > 0.){
    vec2 v = (gs - .5) * 2.;
    v *= 1. + CRT / 100. * .09 * (v.yx * v.yx);
    gs = v * .5 + .5;
    outside = max(outside, step(0., -gs.x) + step(1., gs.x) + step(0., -gs.y) + step(1., gs.y));
  }
  if(FISHEYE > 0.){
    float kf = FISHEYE / 100. * .9;
    vec2 v = toC(gs);
    v *= (1. + kf * dot(v, v)) / (1. + kf);
    gs = v * HALFDIAG / uFull + .5;
  }
  float cell = 0.;
  if(LOWRES > 0.){
    float res = mix(LSIDE, 180., pow(LOWRES / 100., .7));
    cell = LSIDE / res;
    gs = (floor(gs * uFull / cell) + .5) * cell / uFull;
  }
  vec2 gb = gs;
  float r = length(toC(g)), r2 = r * r;

  /* ═════════ Etapa A · óptica y luz ═════════ */
  vec3 c;
  if(LOWRES > 0.){
    vec2 o = vec2(cell * .28) / uFull;
    c = (im(gb + o) + im(gb - o) + im(gb + vec2(o.x, -o.y)) + im(gb + vec2(-o.x, o.y))) * .25;
  } else c = im(gb);

  if(CA > 0.){
    vec2 d = (gb - .5) * CA / 100. * .008;
    c.r = im(gb + d).r; c.b = im(gb - d).b;
  }
  if(MISREG > 0.){
    vec2 d = vec2(LSIDE * .004, LSIDE * .0025) * MISREG / 100. / uFull;
    c.r = im(gb + d).r; c.b = im(gb - d).b;
  }
  if(BLEED > 0.){
    float st = LSIDE * .0035 * BLEED / 100.;
    vec3 y0 = rgb2ycc(c);
    vec2 acc = vec2(0.);
    for(int i = -4; i <= 4; i++){
      vec3 t = rgb2ycc(im(gb + vec2(float(i) * st / uFull.x, 0.)));
      acc += t.yz;
    }
    c = ycc2rgb(vec3(y0.x, acc / 9.));
  }
  if(SOFT > 0.){
    vec2 rad = vec2(.0011 * LSIDE) / uFull;
    vec3 acc = c;
    for(int i = 0; i < 8; i++){ float a = float(i) * .7854; acc += im(gb + vec2(cos(a), sin(a)) * rad); }
    c = mix(c, acc / 9., SOFT / 100. * .9);
    c = mix(c, tx(uBlurS, gb), SOFT / 100. * .28);
  }
  if(SMUDGE > 0.){
    vec2 q = g * vec2(uFull.x / uFull.y, 1.);
    float sm = vnoise(q * 5. + uSeed) * vnoise(q * 9. + 3.1);
    c = mix(c, tx(uBlurW, gb) * 1.08 + .03, SMUDGE / 100. * smoothstep(.15, .5, sm) * .85);
  }
  if(TILT > 0.){
    float t = smoothstep(.07, .28, abs(g.y - .5)) * TILT / 100.;
    c = mix(c, tx(uBlurS, gb), min(1., t * 1.4));
    c = mix(c, tx(uBlurW, gb), max(0., t - .5) * 1.6);
  }
  if(DROPS > 0.){
    float cs = LSIDE / 13.;
    vec2 id = floor(gp / cs);
    for(int oy = -1; oy <= 1; oy++) for(int ox = -1; ox <= 1; ox++){
      vec2 cid = id + vec2(float(ox), float(oy));
      if(hs(cid, 41.) < DROPS / 100. * .4){
        vec2 cen = (cid + vec2(.2 + .6 * hs(cid, 42.), .2 + .6 * hs(cid, 43.))) * cs;
        float rad = cs * (.12 + .2 * hs(cid, 44.)), d = length(gp - cen);
        if(d < rad + aa){
          vec3 ref = tx(uBlurS, (cen * 2. - gp) / uFull) * 1.12 + smoothstep(rad * .6, rad, d) * .1;
          c = mix(c, ref, smoothstep(rad + aa, rad - aa, d) * .92);
        }
      }
    }
  }
  if(OVERSHARP > 0.){
    vec2 rad = vec2(max(LSIDE * .0013, px)) / uFull;
    vec3 acc = vec3(0.);
    for(int i = 0; i < 8; i++){ float a = float(i) * .7854; acc += im(gb + vec2(cos(a), sin(a)) * rad); }
    c += (c - acc / 8.) * OVERSHARP / 100. * 2.4;
  }

  /* Luz añadida */
  if(BLOOM > 0.){
    c += tx(uBright, g) * BLOOM / 100.;
    c = mix(c, tx(uBlurS, g), BLOOM / 100. * .18);
  }
  if(HALATION > 0.) c += tx(uBright, g) * vec3(1., .3, .12) * HALATION / 100. * 1.1;
  if(SMEAR > 0.)   c += tx(uSV, g) * vec3(1., .97, .9) * SMEAR / 100. * 1.3;
  if(STREAK > 0.)  c += tx(uSH, g) * vec3(.35, .6, 1.) * STREAK / 100. * 1.8;
  if(STARFILTER > 0.) c += (tx(uSH, g) + tx(uSV, g)) * vec3(1., .95, .9) * STARFILTER / 100. * 1.1;
  if(FLASH > 0.){
    float F = FLASH / 100.;
    c *= 1. + F * (.48 * (1. - r2) - .3 * r2);
  }
  if(LEAKS > 0.){
    for(int i = 0; i < 2; i++){
      vec4 L = uLeak[i];
      float d = length((g - L.xy) * uFull / HALFDIAG);
      float glow = exp(-pow(d / L.z, 1.5));
      c += mix(vec3(1., .35, .08), vec3(1., .1, .3), L.w) * glow * LEAKS / 100. * .85;
    }
  }
  if(IRIS > 0.){
    float rr = length((g - .5) * uFull / SSIDE * 2.), R = mix(2.2, .98, IRIS / 100.);
    c *= smoothstep(R, R - .07, rr);
  }
  if(VIGNETTE > 0.) c *= 1. - VIGNETTE / 100. * .85 * pow(smoothstep(.12, 1.15, r), 1.5);

  if(uPrem) c = toGam(shoulder(max(c, 0.)));
  c = clamp(c, 0., 1.);

  /* ═════════ Etapa B · revelado ═════════ */
  if(INVERT > 0.) c = mix(c, 1. - c, INVERT / 100.);
  if(CLIP > 0.){
    float k = CLIP / 100.;
    c = min(vec3(1.), c * (1. + k * .9));
    c = mix(c, vec3(1.), smoothstep(.72, 1., luma(c)) * k * .5);
  }
  if(CRUSH > 0.){
    float k = CRUSH / 100.;
    c = max(vec3(0.), (c - .12 * k) / (1. - .12 * k));
    c = pow(c, vec3(1. + .4 * k));
  }
  if(FADE > 0.){ float k = FADE / 100.; c = c * (1. - .17 * k) + .15 * k * vec3(1., .985, .96); }
  if(FLICKER > 0.){
    float k = FLICKER / 100.;
    c *= 1. + (hs(vec2(7., 7.), 31.) - .5) * .35 * k + .1 * k * sin(g.y * 3. + uSeed * 5.);
  }
  if(PUNCH > 0.) c = mix(c, scurve(c), PUNCH / 100. * .85);
  if(FLAT > 0.)  c = mix(c, vec3(.5) + (c - .5) * .55, FLAT / 100.) + FLAT / 100. * .04;
  float l0 = luma2(c);
  if(DESAT > 0.) c = mix(vec3(l0), c, 1. - .75 * DESAT / 100.);
  if(VIVID > 0.) c = clamp(mix(vec3(l0), c, 1. + VIVID / 100. * 1.3), 0., 1.);
  if(CROSS > 0.){
    float k = CROSS / 100.;
    vec3 x = vec3(scurve(vec3(c.r)).r, mix(c.g, scurve(vec3(c.g)).g, .5) + .03, .12 + .72 * c.b);
    x.b = mix(x.b, 1. - (1. - x.b) * (1. - x.b), .35);
    c = mix(c, clamp(x, 0., 1.), k);
  }
  if(WARM > 0.)    c *= vec3(1. + .14 * WARM / 100., 1. + .03 * WARM / 100., 1. - .16 * WARM / 100.);
  if(COOL > 0.)    c *= vec3(1. - .14 * COOL / 100., 1. - .02 * COOL / 100., 1. + .14 * COOL / 100.);
  if(GREEN > 0.)   c *= vec3(1. - .07 * GREEN / 100., 1. + .09 * GREEN / 100., 1. - .07 * GREEN / 100.);
  if(MAGENTA > 0.) c *= vec3(1. + .08 * MAGENTA / 100., 1. - .11 * MAGENTA / 100., 1. + .08 * MAGENTA / 100.);
  if(SPLIT > 0.){
    float l = luma2(c), k = SPLIT / 100.;
    c += k * ((1. - smoothstep(0., .6, l)) * vec3(-.06, .02, .09) + smoothstep(.4, 1., l) * vec3(.09, .03, -.07));
  }
  if(INFRARED > 0.){
    float v = clamp((c.r * .35 + c.g * .95 - c.b * .4) * 1.1, 0., 1.);
    c = mix(c, vec3(v), INFRARED / 100.);
  }
  if(THERMAL > 0.){
    float t = luma2(c);
    vec3 p = t < .25 ? mix(vec3(0.), vec3(.1, 0., .5), t * 4.)
           : t < .5  ? mix(vec3(.1, 0., .5), vec3(.8, 0., .3), (t - .25) * 4.)
           : t < .75 ? mix(vec3(.8, 0., .3), vec3(1., .6, 0.), (t - .5) * 4.)
           : mix(vec3(1., .6, 0.), vec3(1., 1., .7), (t - .75) * 4.);
    c = mix(c, p, THERMAL / 100.);
  }
  if(MONO > 0.) c = mix(c, vec3(luma2(c)), MONO / 100.);
  if(XRAY > 0.){ float l = luma2(c); c = mix(c, (1. - l) * vec3(.80, .92, 1.08) + .02, XRAY / 100.); }
  if(SEPIA > 0.){ float l = luma2(c); c = mix(c, l * vec3(1.07, .84, .62) + vec3(.02, .01, 0.), SEPIA / 100.); }
  if(CYANO > 0.){
    float l = luma2(c);
    vec3 p = l < .5 ? mix(vec3(.02, .07, .22), vec3(.10, .35, .62), l * 2.) : mix(vec3(.10, .35, .62), vec3(.90, .96, 1.), l * 2. - 1.);
    c = mix(c, p, CYANO / 100.);
  }

  if(POSTERIZE > 0.){ float n = mix(32., 4., POSTERIZE / 100.); c = mix(c, floor(c * n + .5) / n, min(1., POSTERIZE / 30.)); }
  if(THRESHOLD > 0.){
    float ct = max(LSIDE / 700., px * 1.5);
    ivec2 q = ivec2(mod(floor(gp / ct), 4.));
    float t = (BAYER[q.y * 4 + q.x] + .5) / 16.;
    c = mix(c, vec3(luma2(c) > t ? .97 : .06), THRESHOLD / 100.);
  }

  /* Trama de semitono: sustituye a la imagen por puntos de tinta */
  if(HALFTONE > 0.){
    float cs = LSIDE / 95.;
    vec2 f = fract(rot(gp, .7854) / cs) - .5;
    float rr = sqrt(clamp(1. - luma2(c), 0., 1.)) * .72;
    float ink = smoothstep(rr + aa / cs, rr - aa / cs, length(f));
    c = mix(c, mix(vec3(.96, .94, .9), vec3(.09, .09, .11), ink), HALFTONE / 100.);
  }

  /* Grano y ruido de sensor */
  float cellN = max(LSIDE / 2600., px * .9);
  if(GRAIN > 0.){
    float lg = clamp(luma2(c), 0., 1.);
    float n = mix(vnoise(gp / cellN) - .5, vnoise(gp / (cellN * 2.6) + 17.3) - .5, (1. - lg) * .65);
    c += vec3(n) * GRAIN / 100. * (.05 + .13 * (1. - lg) * (1. - lg));
  }
  if(GRAINBIG > 0.){
    float lg = clamp(luma2(c), 0., 1.);
    float n = (vnoise(gp / (cellN * 3.2)) - .5) * .7 + (vnoise(gp / (cellN * 1.6) + 9.1) - .5) * .5;
    c += vec3(n) * GRAINBIG / 100. * (.10 + .18 * (1. - lg));
  }
  if(CHROMANOISE > 0.){
    float lg = clamp(luma2(c), 0., 1.);
    vec3 n = vec3(vnoise(gp / (cellN * 2.4) + 3.1), vnoise(gp / (cellN * 2.4) + 7.7), vnoise(gp / (cellN * 2.4) + 11.)) - .5;
    c += n * CHROMANOISE / 100. * .2 * (1. - lg * .5) + (vnoise(gp / cellN) - .5) * CHROMANOISE / 100. * .06;
  }

  /* Daños */
  if(FOG > 0.){
    vec2 q = g * vec2(uFull.x / uFull.y, 1.) * 2.4 + uSeed;
    c = mix(c, vec3(.78, .76, .72), FOG / 100. * (.16 + .30 * vnoise(q) * vnoise(q * 2.3 + 5.)));
  }
  if(DUST > 0.){
    float cs = LSIDE / 110.;
    vec2 id = floor(gp / cs);
    for(int oy = -1; oy <= 1; oy++) for(int ox = -1; ox <= 1; ox++){
      vec2 cid = id + vec2(float(ox), float(oy));
      if(hs(cid, 11.) < DUST / 100. * .09){
        vec2 pos = (cid + vec2(hs(cid, 12.), hs(cid, 13.))) * cs;
        float h4 = hs(cid, 14.), rad = cs * (.02 + .09 * h4 * h4);
        float sp = smoothstep(rad + aa, rad * .4, length(gp - pos));
        c = mix(c, hs(cid, 15.) > .35 ? vec3(.06) : vec3(.96), sp * .85);
      }
    }
  }
  if(SCRATCHES > 0.){
    float w = LSIDE / 650., id = floor(gp.x / w);
    if(hs(vec2(id, 21.), 21.) < SCRATCHES / 100. * .022){
      float cx = (id + .5) * w + (hs(vec2(id, 22.), 22.) - .5) * w * .6;
      float line = smoothstep(max(w * .12, aa * .7), 0., abs(gp.x - cx));
      float len = smoothstep(.5, .62, vnoise(vec2(id * 3.3, gp.y / (LSIDE * .35) + uSeed)));
      c = mix(c, vec3(.92, .9, .85), line * len * .55);
    }
  }

  /* Vídeo y pantalla */
  if(MOIRE > 0.){
    float f = 6.2832 / (LSIDE / 190.);
    c *= 1. - MOIRE / 100. * .22 * (.5 + .5 * sin((gp.x * .9 + gp.y * .4) * f) * sin((gp.x * .86 + gp.y * .5) * f));
  }
  if(PIXELGRID > 0.){
    float cp = max(LSIDE / 300., px * 3.);
    vec2 f = fract(gp / cp);
    vec3 sub = vec3(step(f.x, .43), step(.43, f.x) * step(f.x, .72), step(.72, f.x));
    float k = PIXELGRID / 100.;
    c *= mix(vec3(1.), .62 + .7 * sub, k * .5);
    c *= 1. - min(1., step(f.x, .14) + step(f.y, .14)) * k * .55;
  }
  if(GLARE > 0.){
    float k = GLARE / 100., d = dot(g - .5, vec2(.7, .7));
    c = mix(c, c * .9 + .05, k * .3) + vec3(1., .98, .95) * k * .55 * exp(-pow((d - .08) / .16, 2.));
  }
  if(SCANLINES > 0.){
    float period = max(uFull.y / 270., 1.5);
    float sl = .5 + .5 * cos(fract(gp.y / period) * 6.2832);
    c *= 1. - SCANLINES / 100. * .45 * (1. - sl);
  }
  if(CRT > 0.){
    float k = CRT / 100.;
    float tw = max(LSIDE / 700., px * 2.5), ph3 = fract(gp.x / tw) * 3.;
    vec3 mask = vec3(step(ph3, 1.), step(1., ph3) * step(ph3, 2.), step(2., ph3));
    c *= mix(vec3(1.), .55 + mask * 1.1, k * .4);
    vec2 e = abs(g - .5) * 2.;
    c *= 1. - k * .5 * smoothstep(.75, 1.25, max(e.x, e.y) + .25 * (e.x * e.y));
    c = clamp(c * (1. + k * .12), 0., 1.);
    c *= 1. - clamp(outside, 0., 1.) * k;
  }

  /* Marcos y rotulación */
  if(PAPER > 0.){
    float m = SSIDE * .045 * PAPER / 100. * (.7 + .6 * vnoise(gp / (SSIDE * .15)));
    float e = min(min(gp.x, uFull.x - gp.x), min(gp.y, uFull.y - gp.y));
    float k = clamp((m - e) / aa + .5, 0., 1.);
    vec3 paperC = vec3(.94, .91, .84) - .04 * vnoise(gp / (SSIDE * .02));
    c = mix(c * (1. - .25 * smoothstep(SSIDE * .012, 0., e - m)), paperC, k);
  }
  if(INSTANT > 0.){
    float t = INSTANT / 100.;
    float m = SSIDE * .055 * t, bb = m * 3.4;
    float e = min(min(gp.x - m, uFull.x - m - gp.x), min(gp.y - m, uFull.y - bb - gp.y));
    float inside = clamp(e / aa + .5, 0., 1.);
    vec3 paperC = vec3(.95, .93, .88) - .03 * vnoise(gp / (SSIDE * .02));
    c = mix(paperC, c * (1. - .3 * smoothstep(SSIDE * .012, 0., e)), inside);
  }
  if(FILM > 0.){
    float hb = .1 * uFull.y * FILM / 100.;
    float yb = min(gp.y, uFull.y - gp.y);
    if(yb < hb + aa){
      float hx = mod(gp.x, hb * .85) - hb * .425, hy = yb - hb * .5;
      vec2 q = abs(vec2(hx, hy)) - vec2(hb * .2, hb * .14);
      float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - hb * .05;
      vec3 bar = mix(vec3(.07, .045, .03), vec3(.92, .85, .7), 1. - smoothstep(-aa, aa, d));
      c = mix(c, bar, clamp((hb - yb) / aa + .5, 0., 1.));
    }
  }
  if(STAMP > 0.){
    float sh = .052 * SSIDE, sw = sh * uStampSize.x / uStampSize.y;
    vec2 p = (gp - vec2(uFull.x - sw - .05 * SSIDE, uFull.y - sh - .05 * SSIDE)) / vec2(sw, sh);
    if(p.x >= 0. && p.x <= 1. && p.y >= 0. && p.y <= 1.){
      vec4 s = texture(uStamp, p);
      c = mix(c, s.rgb, s.a * min(1., STAMP / 100. * 1.1));
    }
  }
  if(LETTERBOX > 0.){
    float bar = (uFull.y - min(uFull.y, uFull.x / 2.39)) * .5 * LETTERBOX / 100.;
    float e = min(gp.y, uFull.y - gp.y);
    c *= clamp((e - bar) / aa + .5, 0., 1.);
  }

  /* Tramado triangular de la salida en Premium */
  if(uPrem) c += (hash(gp + .5) + hash(gp * 1.7 + 3.1) - 1.) / 255.;
  outColor = vec4(clamp(c, 0., 1.), srcA.a);
}`;

/* ── Aleatorio con semilla ── */
export function rng(seed){
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const leaksFor = seed => {
  const R = rng(seed * 97 + 13), out = [];
  for(let i = 0; i < 2; i++){
    const edge = Math.floor(R() * 4), t = R();
    const pos = [[t, -.05], [1.05, t], [t, 1.05], [-.05, t]][edge];
    out.push(pos[0], pos[1], .2 + R() * .28, R());
  }
  return new Float32Array(out);
};

/* Réplica en la CPU de la geometría del shader (CRT y ojo de pez):
   qué punto del original se lee para un punto dado del resultado.
   Sirve para calcular qué trozo del original necesita cada tesela. */
function geomMap(gx, gy, W, H, e){
  let x = gx / W, y = gy / H;
  const crt = e[IDX.crt], fish = e[IDX.fisheye];
  if(crt > 0){ let vx = (x - .5) * 2, vy = (y - .5) * 2; const k = crt / 100 * .09; vx *= 1 + k * vy * vy; vy *= 1 + k * vx * vx; x = vx * .5 + .5; y = vy * .5 + .5; }
  if(fish > 0){
    const kf = fish / 100 * .9, hd = .5 * Math.hypot(W, H);
    let vx = (x - .5) * W / hd, vy = (y - .5) * H / hd;
    const f = (1 + kf * (vx * vx + vy * vy)) / (1 + kf);
    vx *= f; vy *= f; x = vx * hd / W + .5; y = vy * hd / H + .5;
  }
  return [x * W, y * H];
}
/* Margen de vecindad (fracción del lado mayor) que necesitan los efectos que muestrean lejos del píxel. */
const marginFrac = e => .004 + e[IDX.tape] / 100 * .075 + e[IDX.crt] / 100 * .02 + e[IDX.bleed] / 100 * .016
  + e[IDX.ca] / 100 * .008 + e[IDX.misreg] / 100 * .007 + e[IDX.soft] / 100 * .003 + e[IDX.oversharp] / 100 * .003 + e[IDX.lowRes] / 100 * .02;

/* Texto del sello de fecha, dibujado una vez como textura. */
function stampCanvas(text){
  const c = document.createElement("canvas"); c.width = 360; c.height = 64;
  const x = c.getContext("2d");
  x.font = "bold 50px 'Courier New', monospace"; x.textBaseline = "middle"; x.textAlign = "center";
  x.shadowColor = "rgba(255,70,0,.85)"; x.shadowBlur = 10; x.fillStyle = "rgb(255,150,40)";
  x.fillText(text || "'05 7 14", 180, 34);
  x.shadowBlur = 0; x.fillStyle = "rgb(255,190,90)"; x.fillText(text || "'05 7 14", 180, 33);
  return c;
}

export class CamarasGL {
  constructor(canvas = document.createElement("canvas")){
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
    if(!gl) throw new Error("Las cámaras necesitan WebGL2, que este navegador no ofrece.");
    this.textures = []; this.programs = [];
    this.main = this.program(MAIN); this.blur = this.program(BLUR);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.fb = gl.createFramebuffer();
    this.tex = { image: this.texture(), low: this.texture(), tmp: this.texture(), blurS: this.texture(), blurW: this.texture(),
                 bright: this.texture(), sv: this.texture(), sh: this.texture(), stamp: this.texture() };
    this.maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
    this.blursPrem = null; this.stampText = null; this.lowSize = [1, 1];
    gl.disable(gl.BLEND); gl.disable(gl.DITHER);
  }
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
  /* En un documento Display P3 la GPU sube y devuelve en P3; los shaders trabajan sobre valores codificados y P3 y sRGB comparten curva. */
  syncSpace(){
    const gl = this.gl, want = workSpace();
    if(this.space === want || !("drawingBufferColorSpace" in gl)) return;
    try{ gl.drawingBufferColorSpace = want; gl.unpackColorSpace = want; this.space = want; }catch{}
  }
  upload(tex, source){
    const gl = this.gl;
    this.syncSpace();
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
  blurPass(src, dst, w, h, dir, sigma, thr = 0, lin = false){
    const gl = this.gl, b = this.blur;
    gl.bindTexture(gl.TEXTURE_2D, dst);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.useProgram(b.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(b.u.src, 0); gl.uniform2f(b.u.dir, dir[0], dir[1]); gl.uniform1f(b.u.sigma, sigma);
    gl.uniform1f(b.u.thr, thr); gl.uniform1i(b.u.lin, lin ? 1 : 0);
    this.draw(b, dst, w, h);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Imagen completa a la que se refieren los efectos (su tamaño real) y sus versiones de 640 px para los efectos difusos. */
  setImage(full, W, H){
    this.W = W; this.H = H;
    const k = Math.min(1, LOW / Math.max(W, H));
    const lw = Math.max(1, Math.round(W * k)), lh = Math.max(1, Math.round(H * k));
    const low = document.createElement("canvas"); low.width = lw; low.height = lh;
    low.getContext("2d").drawImage(full, 0, 0, lw, lh);
    this.upload(this.tex.low, low);
    low.width = low.height = 1;
    this.lowSize = [lw, lh];
    this.blursPrem = null;
  }
  /* Los desenfoques se calculan en luz lineal si el modo Premium está activo. */
  buildBlurs(lin){
    if(this.blursPrem === lin) return;
    const T = this.tex, [lw, lh] = this.lowSize;
    this.blurPass(T.low, T.tmp, lw, lh, [1, 0], 2, 0, lin);   this.blurPass(T.tmp, T.blurS, lw, lh, [0, 1], 2, 0, lin);
    this.blurPass(T.blurS, T.tmp, lw, lh, [1, 0], 7, 0, lin); this.blurPass(T.tmp, T.blurW, lw, lh, [0, 1], 7, 0, lin);
    this.blurPass(T.low, T.tmp, lw, lh, [1, 0], 5, .78, lin); this.blurPass(T.tmp, T.bright, lw, lh, [0, 1], 5, 0, lin);
    // rayas largas: sólo las luces fuertes, estiradas en una dirección
    this.blurPass(T.low, T.tmp, lw, lh, [0, 3], 6, .88, lin); this.blurPass(T.tmp, T.sv, lw, lh, [0, 9], 7, 0, lin);
    this.blurPass(T.low, T.tmp, lw, lh, [3, 0], 6, .86, lin); this.blurPass(T.tmp, T.sh, lw, lh, [9, 0], 7, 0, lin);
    this.blursPrem = lin;
  }
  /** Textura principal: la vista previa entera o un recorte del original a resolución completa. */
  setTexture(canvas, origin = [0, 0], size = [this.W, this.H]){
    this.upload(this.tex.image, canvas);
    this.texOrigin = origin; this.texSize = size;
  }
  setStamp(text){
    if(text === this.stampText) return;
    this.stampText = text;
    this.upload(this.tex.stamp, stampCanvas(text));
  }

  /** Dibuja en el lienzo WebGL (de `cw`×`ch` píxeles) la zona `region` de la imagen completa. */
  render(state, { region = { x: 0, y: 0, w: this.W, h: this.H }, cw, ch, original = false, target = null } = {}){
    const gl = this.gl, m = this.main, u = m.u, prem = !!state.premium;
    if(gl.isContextLost()) throw new Error("Se ha perdido el contexto gráfico");
    if(this.canvas.width !== cw || this.canvas.height !== ch){ this.canvas.width = cw; this.canvas.height = ch; }
    this.buildBlurs(prem);
    this.setStamp(state.date || "");
    gl.useProgram(m.p);
    const bind = (unit, tex, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); };
    const T = this.tex;
    bind(0, T.image, "uImage"); bind(1, T.blurS, "uBlurS"); bind(2, T.blurW, "uBlurW"); bind(3, T.bright, "uBright");
    bind(4, T.sv, "uSV"); bind(5, T.sh, "uSH"); bind(6, T.stamp, "uStamp");
    gl.uniform2f(u.uFull, this.W, this.H);
    gl.uniform2f(u.uTexOrigin, this.texOrigin[0], this.texOrigin[1]);
    gl.uniform2f(u.uTexSize, this.texSize[0], this.texSize[1]);
    gl.uniform2f(u.uCanvas, cw, ch);
    gl.uniform2f(u.uStampSize, 360, 64);
    gl.uniform4f(u.uRegion, region.x, region.y, region.w, region.h);
    gl.uniform4fv(u.uLeak, leaksFor(state.seed || 1));
    gl.uniform1f(u.uSeed, (state.seed || 1) % 997);
    gl.uniform1fv(u.A, new Float32Array(effective(state)));
    gl.uniform1i(u.uOriginal, original ? 1 : 0);
    gl.uniform1i(u.uPrem, prem ? 1 : 0);
    this.draw(m, target, cw, ch);
  }

  /** Resultado a resolución completa, por teselas. `src` es el lienzo original; devuelve un lienzo nuevo del mismo tamaño. */
  async renderFull(src, state, onProgress = () => {}){
    const W = src.width, H = src.height, L = Math.max(W, H), e = effective(state);
    this.setImage(src, W, H);
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const octx = out.getContext("2d");
    const margin = Math.ceil(marginFrac(e) * L) + 4;
    const tile = Math.max(256, this.maxTex - 2 * margin - 8);
    const tmp = document.createElement("canvas"), tctx = tmp.getContext("2d");
    const tiles = [];
    for(let y = 0; y < H; y += tile) for(let x = 0; x < W; x += tile) tiles.push({ x, y, w: Math.min(tile, W - x), h: Math.min(tile, H - y) });
    for(let i = 0; i < tiles.length; i++){
      const t = tiles[i];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for(let k = 0; k <= 8; k++) for(const [px, py] of [[t.x + t.w * k / 8, t.y], [t.x + t.w * k / 8, t.y + t.h], [t.x, t.y + t.h * k / 8], [t.x + t.w, t.y + t.h * k / 8]]){
        const [mx, my] = geomMap(px, py, W, H, e);
        x0 = Math.min(x0, mx, px); y0 = Math.min(y0, my, py); x1 = Math.max(x1, mx, px); y1 = Math.max(y1, my, py);
      }
      const bx = Math.max(0, Math.floor(x0 - margin)), by = Math.max(0, Math.floor(y0 - margin));
      const bw = Math.min(W, Math.ceil(x1 + margin)) - bx, bh = Math.min(H, Math.ceil(y1 + margin)) - by;
      const scale = Math.min(1, this.maxTex / Math.max(bw, bh));
      tmp.width = Math.max(1, Math.round(bw * scale)); tmp.height = Math.max(1, Math.round(bh * scale));
      tctx.imageSmoothingQuality = "high";
      tctx.drawImage(src, bx, by, bw, bh, 0, 0, tmp.width, tmp.height);
      this.setTexture(tmp, [bx, by], [bw, bh]);
      this.render(state, { region: { x: t.x, y: t.y, w: t.w, h: t.h }, cw: t.w, ch: t.h });
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
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
