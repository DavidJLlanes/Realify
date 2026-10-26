/* ═══════════════════════════════════════════════════════════════
   floatcompositor · blend shader
   Parte de js/editor/render/floatcompositor.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { HEAD } from "./common.js";

export const FS_BLEND = HEAD + `
uniform sampler2D uDst;
uniform sampler2D uSrc;
uniform int uSrcKind;               // 0: lienzo RGBA8 sin premultiplicar, 1: coma flotante premultiplicado
uniform usampler2D uHi;
uniform bool uHasHi, uDither;
uniform ivec2 uHiOff, uHiSize;
uniform sampler2D uMask; uniform bool uHasMask;
uniform sampler2D uClip; uniform bool uHasClip;
uniform bool uBI; uniform vec4 uBIThis, uBIUnder;   // negroMin, negroMax, blancoMin, blancoMax (0..255)
uniform vec4 uBIRT, uBIRU, uBIGT, uBIGU, uBIBT, uBIBU;   // canales sueltos (rojo, verde, azul): esta capa / subyacente; sin efecto = 0,0,255,255
uniform float uOpacity;
uniform int uMode;
uniform ivec2 uOff;                 // esquina de la tesela en el lienzo: el origen, la máscara y las láminas se leen en coordenadas globales (p + uOff)
uniform bool uPrep;                 // sólo devuelve la capa preparada (máscara, recorte, «Fusionar si»)
// Estilos de capa (mismo orden que io/precision/precision-stack.js › applyStylesBand): degradado sobre la capa, sombra y resplandor detrás, trazo encima
uniform bool uHasStyle, uHasBehind, uHasRing, uGrad;
uniform sampler2D uBehind, uRing;
uniform vec4 uGradP; uniform vec3 uGradC1, uGradC2; uniform float uGradOp;
vec4 plateAt(sampler2D t, ivec2 g){ vec4 c = texelFetch(t, g, 0); return vec4(c.rgb * c.a, c.a); }

float dith(int x, int y, int c){
  uint h = (uint(x * 3 + c) + 0x2545f491u) * 0x9e3779b1u ^ (uint(y) + 0x6a09e667u) * 0x85ebca77u;
  h ^= h >> 15; h *= 0x2c1b3c6du; h ^= h >> 12;
  return (float(h & 1023u) + 0.5) / 1024.0 - 0.5;
}
int q8(uint v){ return int((v + 128u) / 257u); }
int d8(uint v, int x, int y, int c){ float r = floor(float(v) * (255.0 / 65535.0) + dith(x, y, c) + 0.5); return int(clamp(r, 0.0, 255.0)); }

vec4 fetchSrc(ivec2 p, ivec2 g){
  if(uSrcKind == 1) return texelFetch(uSrc, p, 0);          // grupo: textura de la tesela
  vec4 t = texelFetch(uSrc, g, 0);
  float a = t.a;
  if(a <= 0.0) return vec4(0.0);
  vec3 c = t.rgb;
  if(uHasHi){
    ivec2 s = g - uHiOff;
    if(s.x >= 0 && s.y >= 0 && s.x < uHiSize.x && s.y < uHiSize.y){
      uvec3 h = texelFetch(uHi, s, 0).rgb;
      ivec3 c8 = ivec3(floor(c * 255.0 + 0.5));
      bool same = uDither
        ? (d8(h.r, s.x, s.y, 0) == c8.r && d8(h.g, s.x, s.y, 1) == c8.g && d8(h.b, s.x, s.y, 2) == c8.b)
        : (q8(h.r) == c8.r && q8(h.g) == c8.g && q8(h.b) == c8.b);
      if(same) c = vec3(h) / 65535.0;
    }
  }
  return vec4(c * a, a);
}

float ramp(float v, vec4 s){
  if(s.x == 0.0 && s.y == 0.0 && s.z == 255.0 && s.w == 255.0) return 1.0;     // sin efecto: sin redondeos de coma flotante pasando de 255
  float lo = 1.0;
  if(s.y > s.x) lo = clamp((v - s.x) / (s.y - s.x), 0.0, 1.0); else if(v < s.x) lo = 0.0;
  float hi = 1.0;
  if(s.w > s.z) hi = clamp((s.w - v) / (s.w - s.z), 0.0, 1.0); else if(v > s.w) hi = 0.0;
  return min(lo, hi);
}

float lum3(vec3 c){ return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; }
vec3 clipColor(vec3 c){
  float l = lum3(c), n = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));
  if(n < 0.0) c = l + (c - l) * l / (l - n == 0.0 ? 1e-9 : l - n);
  if(x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l == 0.0 ? 1e-9 : x - l);
  return c;
}
vec3 setLum(vec3 c, float l){ return clipColor(c + (l - lum3(c))); }
float satOf(vec3 c){ return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 setSat(vec3 c, float s){
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  if(mx <= mn) return vec3(0.0);
  return (c - mn) * s / (mx - mn);
}

float hardLight(float b, float s){ return s <= 0.5 ? b * 2.0 * s : b + (2.0 * s - 1.0) - b * (2.0 * s - 1.0); }
float softLight(float b, float s){
  if(s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return b + (2.0 * s - 1.0) * (d - b);
}
float sepBlend(int m, float b, float s){
  if(m == 0) return s;
  if(m == 1) return b * s;
  if(m == 2) return b + s - b * s;
  if(m == 3) return hardLight(s, b);
  if(m == 4) return min(b, s);
  if(m == 5) return max(b, s);
  if(m == 6) return b <= 0.0 ? 0.0 : (s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)));
  if(m == 7) return b >= 1.0 ? 1.0 : (s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s));
  if(m == 8) return hardLight(b, s);
  if(m == 9) return softLight(b, s);
  if(m == 10) return abs(b - s);
  return b + s - 2.0 * b * s;
}
vec3 nonSepBlend(int m, vec3 cb, vec3 cs){
  if(m == 12) return setLum(setSat(cs, satOf(cb)), lum3(cb));
  if(m == 13) return setLum(setSat(cb, satOf(cs)), lum3(cb));
  if(m == 14) return setLum(cs, lum3(cb));
  return setLum(cb, lum3(cs));
}
float vivid(float b, float s){
  if(s <= 0.5) return s <= 0.0 ? 0.0 : 1.0 - clamp((1.0 - b) / (2.0 * s), 0.0, 1.0);
  return s >= 1.0 ? 1.0 : clamp(b / (2.0 * (1.0 - s)), 0.0, 1.0);
}
// los modos «a mano» de core/blend.js: en 0..1, con los umbrales de 128/255 de allí
float customBlend(int m, float b, float s){
  if(m == 20) return clamp(b + 2.0 * s - 1.0, 0.0, 1.0);
  if(m == 21) return clamp(b + s - 1.0, 0.0, 1.0);
  if(m == 22) return clamp(b - s, 0.0, 1.0);
  if(m == 23) return s <= 0.0 ? 1.0 : clamp(b / s, 0.0, 1.0);
  if(m == 24) return s < 128.0 / 255.0 ? min(b, 2.0 * s) : max(b, clamp(2.0 * s - 1.0, 0.0, 1.0));
  if(m == 25) return vivid(b, s);
  return vivid(b, s) < 128.0 / 255.0 ? 0.0 : 1.0;      // 26: mezcla fuerte
}
float hash2i(int x, int y){
  uint h = uint(x) * 374761393u + uint(y) * 668265263u;
  h = (h ^ (h >> 13)) * 1274126177u;
  return float((h ^ (h >> 16)) % 4096u) / 4096.0;      // igual que hash2i de core/blend.js
}

void main(){
  ivec2 p = ivec2(gl_FragCoord.xy), g = p + uOff;
  vec4 dst = texelFetch(uDst, p, 0);
  vec4 src = fetchSrc(p, g);
  // «Fusionar si»: antes de máscara y recorte
  if(uBI){
    float tl = src.a > 0.0 ? (src.r * 0.2126 + src.g * 0.7152 + src.b * 0.0722) / src.a * 255.0 : 0.0;
    float ul = dst.a > 0.0 ? (dst.r * 0.2126 + dst.g * 0.7152 + dst.b * 0.0722) / dst.a * 255.0 : 0.0;
    vec3 sc = src.a > 0.0 ? src.rgb / src.a * 255.0 : vec3(0.0), dc = dst.a > 0.0 ? dst.rgb / dst.a * 255.0 : vec3(0.0);
    src *= ramp(tl, uBIThis) * ramp(ul, uBIUnder) * ramp(sc.r, uBIRT) * ramp(dc.r, uBIRU) * ramp(sc.g, uBIGT) * ramp(dc.g, uBIGU) * ramp(sc.b, uBIBT) * ramp(dc.b, uBIBU);
  }
  if(uHasMask) src *= texelFetch(uMask, g, 0).a;
  if(uHasClip) src *= texelFetch(uClip, p, 0).a;
  if(uPrep){ outColor = src; return; }
  if(uHasStyle){
    if(uGrad && src.a > 0.0){
      vec2 gd = uGradP.zw - uGradP.xy; float L2 = dot(gd, gd); if(L2 == 0.0) L2 = 1e-9;
      float t = clamp(dot(vec2(g) + 0.5 - uGradP.xy, gd) / L2, 0.0, 1.0);
      vec3 cur = src.rgb / src.a * 255.0, gc = mix(uGradC1, uGradC2, t);
      src.rgb = (cur + (gc - cur) * uGradOp) / 255.0 * src.a;
    }
    vec4 acc = uHasBehind ? plateAt(uBehind, g) : vec4(0.0);
    acc = src + acc * (1.0 - src.a);
    if(uHasRing){ vec4 r = plateAt(uRing, g); acc = r + acc * (1.0 - r.a); }
    src = acc;
  }
  float sa = src.a;
  if(sa <= 0.0){ outColor = dst; return; }
  float as = sa * uOpacity, ab = dst.a;
  vec3 cs = src.rgb / sa;
  vec3 cb = ab > 0.0 ? dst.rgb / ab : vec3(0.0);
  int m = uMode;
  if(m < 20){
    vec3 B;
    if(m < 12) B = vec3(sepBlend(m, cb.r, cs.r), sepBlend(m, cb.g, cs.g), sepBlend(m, cb.b, cs.b));
    else B = nonSepBlend(m, cb, cs);
    vec3 mixc = (1.0 - ab) * cs + ab * B;
    outColor = vec4(as * mixc + (1.0 - as) * dst.rgb, as + ab * (1.0 - as));
    return;
  }
  if(m == 30){ outColor = vec4(min(vec3(1.0), dst.rgb + as * cs), min(1.0, ab + as)); return; }
  if(m == 29){
    if(hash2i(g.x, g.y) >= as){ outColor = dst; return; }
    outColor = vec4(cs, 1.0); return;
  }
  vec3 d = cb; float na;
  if(m <= 26){
    d = cb + (vec3(customBlend(m, cb.r, cs.r), customBlend(m, cb.g, cs.g), customBlend(m, cb.b, cs.b)) - cb) * as;
  } else {
    float lD = dot(cb, vec3(0.2126, 0.7152, 0.0722)), lS = dot(cs, vec3(0.2126, 0.7152, 0.0722));
    bool pick = m == 27 ? lS < lD : lS > lD;
    if(!pick){ outColor = dst; return; }
    d = cb + (cs - cb) * as;
  }
  na = min(1.0, ab + sa * as);
  outColor = vec4(d * na, na);
}`;
