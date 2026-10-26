/* ═══════════════════════════════════════════════════════════════
   floatcompositor · float compose
   Parte de js/editor/render/floatcompositor.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { canvasRev } from "../../../core/canvasrev.js";
import { adjustFunction, GRID, STEP, unsupportedReason } from "../../../io/precision/precision-stack.js";
import { doc } from "../../../core/doc.js";
import { hasEnabledStyle, gradientParams } from "../../layers/layerstyles.js";
import { isAdjustLayer } from "../../layers/adjust-types.js";
import { isBlendIfActive, CHANNELS, channelSides } from "../../layers/blendif.js";
import { workSpace } from "../../../core/colorspace.js";
import { CUSTOM_BLENDS } from "../../../core/blend.js";
import { collectStyleShapes } from "../../layers/layertree.js";
import { HEAD } from "./common.js";
import { FS_BLEND } from "./blend-shader.js";

const COARSE = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

const memory = navigator.deviceMemory || 8;

/* Composición por TESELAS (v252): los acumuladores (4–6 texturas a la vez) sólo miden una tesela, así que el límite ya no lo pone el tamaño del
   documento sino las texturas de las capas (8 bits + origen de 16 bits + máscaras, a tamaño completo): presupuesto de memoria de vídeo. */
const MAX_DOC_PX = (COARSE || memory <= 4) ? 12e6 : 40e6;

const TEX_BUDGET = (COARSE || memory <= 4) ? 160e6 : 640e6;

export const floatTuning = { tile: (COARSE || memory <= 4) ? 512 : 1024 };

const MODES = {
  "source-over": 0, multiply: 1, screen: 2, overlay: 3, darken: 4, lighten: 5, "color-dodge": 6, "color-burn": 7,
  "hard-light": 8, "soft-light": 9, difference: 10, exclusion: 11,
  hue: 12, saturation: 13, color: 14, luminosity: 15,
  "linear-light": 20, "linear-burn": 21, subtract: 22, divide: 23, "pin-light": 24, "vivid-light": 25, "hard-mix": 26,
  "darker-color": 27, "lighter-color": 28, dissolve: 29, lighter: 30
};

/* ── shaders ──────────────────────────────────────────────────── */
const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const FS_ADJUST = HEAD + `
uniform sampler2D uDst;
uniform sampler3D uLut;             // RGB32F, 86³, valores 0..255
uniform sampler2D uLut1;            // RGB32F, N×1: una curva por canal (niveles, curvas, exposición, balance de blancos)
uniform int uKind, uN;              // 0: tabla 3D, 1: tablas 1D
uniform sampler2D uMask; uniform bool uHasMask;
uniform float uOpacity;
uniform float uGrid, uStep;
uniform ivec2 uOff;
vec3 lutAt(ivec3 i){ return texelFetch(uLut, i, 0).rgb; }
vec3 lookup(vec3 c){
  vec3 f = clamp(c, 0.0, 255.0) / uStep;
  int g1 = int(uGrid) - 1;
  ivec3 i0 = ivec3(f);
  i0 = min(i0, ivec3(g1 - 1));
  vec3 t = f - vec3(i0);
  vec3 c000 = lutAt(i0), c100 = lutAt(i0 + ivec3(1, 0, 0)), c010 = lutAt(i0 + ivec3(0, 1, 0)), c110 = lutAt(i0 + ivec3(1, 1, 0));
  vec3 c001 = lutAt(i0 + ivec3(0, 0, 1)), c101 = lutAt(i0 + ivec3(1, 0, 1)), c011 = lutAt(i0 + ivec3(0, 1, 1)), c111 = lutAt(i0 + ivec3(1, 1, 1));
  vec3 a0 = mix(mix(c000, c100, t.x), mix(c010, c110, t.x), t.y);
  vec3 a1 = mix(mix(c001, c101, t.x), mix(c011, c111, t.x), t.y);
  return mix(a0, a1, t.z);
}
vec3 lookup1(vec3 c){
  vec3 f = clamp(c, 0.0, 255.0) / 255.0 * float(uN - 1);
  ivec3 i0 = min(ivec3(f), ivec3(uN - 2));
  vec3 t = f - vec3(i0);
  vec3 lo = vec3(texelFetch(uLut1, ivec2(i0.r, 0), 0).r, texelFetch(uLut1, ivec2(i0.g, 0), 0).g, texelFetch(uLut1, ivec2(i0.b, 0), 0).b);
  vec3 hi = vec3(texelFetch(uLut1, ivec2(i0.r + 1, 0), 0).r, texelFetch(uLut1, ivec2(i0.g + 1, 0), 0).g, texelFetch(uLut1, ivec2(i0.b + 1, 0), 0).b);
  return mix(lo, hi, t);
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 dst = texelFetch(uDst, p, 0);
  float a = dst.a;
  if(a <= 0.0){ outColor = dst; return; }
  float f = uOpacity * (uHasMask ? texelFetch(uMask, p + uOff, 0).a : 1.0);
  if(f <= 0.0){ outColor = dst; return; }
  vec3 c = dst.rgb / a * 255.0;
  vec3 t = clamp(uKind == 1 ? lookup1(c) : lookup(c), 0.0, 255.0);
  outColor = vec4((c + (t - c) * f) / 255.0 * a, a);
}`;

const FS_OUT = HEAD + `
uniform sampler2D uDst;
uniform ivec2 uSize, uOff;
uniform bool uDither;
float ditherNoise(int x, int y, int c){
  uint n = (uint(x + 1) * 0x9e3779b1u) ^ (uint(y + 1) * 0x85ebca77u) ^ (uint(c + 1) * 0xc2b2ae35u);
  n = (n ^ (n >> 16)) * 0x7feb352du;
  n = (n ^ (n >> 15)) * 0x846ca68bu;
  return float(n ^ (n >> 16)) / 4294967296.0 - 0.5;
}
void main(){
  ivec2 p = ivec2(int(gl_FragCoord.x), uSize.y - 1 - int(gl_FragCoord.y));   // el lienzo se lee de arriba abajo (coordenadas globales)
  vec4 d = texelFetch(uDst, p - uOff, 0);                                    // la textura es la de la tesela
  float a = clamp(d.a, 0.0, 1.0);
  if(a <= 0.0){ outColor = vec4(0.0); return; }
  vec3 c = clamp(d.rgb / a, 0.0, 1.0) * 255.0;
  if(uDither) c += vec3(ditherNoise(p.x, p.y, 0), ditherNoise(p.x, p.y, 1), ditherNoise(p.x, p.y, 2));
  c = floor(c + 0.5) / 255.0;
  float a8 = floor(a * 255.0 + 0.5) / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0) * a8, a8);
}`;

const FS_COPY = HEAD + `
uniform sampler2D uSrc; uniform ivec2 uSize;
void main(){ ivec2 p = ivec2(int(gl_FragCoord.x), uSize.y - 1 - int(gl_FragCoord.y)); outColor = texelFetch(uSrc, p, 0); }`;

/* ── contexto ─────────────────────────────────────────────────── */
let S = null, failed = false;

function compile(gl, type, src){
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(sh));
  return sh;
}

function program(gl, fs){
  const pr = gl.createProgram();
  gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error("enlace: " + gl.getProgramInfoLog(pr));
  const u = {}, n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
  for(let i = 0; i < n; i++){ const info = gl.getActiveUniform(pr, i); u[info.name] = gl.getUniformLocation(pr, info.name); }
  return { pr, u };
}

export function init(){
  if(S || failed) return S;
  try{
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if(!gl) throw new Error("sin WebGL2");
    const f32 = !!gl.getExtension("EXT_color_buffer_float");
    const f16 = f32 || !!gl.getExtension("EXT_color_buffer_half_float");
    if(!f16) throw new Error("sin texturas de coma flotante dibujables");
    S = {
      canvas, gl, f32, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      blend: program(gl, FS_BLEND), adjust: program(gl, FS_ADJUST), out: program(gl, FS_OUT),
      vao: gl.createVertexArray(), fbo: gl.createFramebuffer(),
      pool: [], poolW: 0, poolH: 0, poolF32: false, hi: new Map(), lut: new Map(), tex8: new Map(), temps: [], plates: null, live: null, idle: 0, dummyHi: null, dummy3D: null
    };
    // Textura de relleno para el muestreador entero cuando la capa no trae 16 bits (WebGL valida el tipo)
    S.dummy3D = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, S.dummy3D);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, 1, 1, 1, 0, gl.RGB, gl.FLOAT, new Float32Array(3));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    S.dummyHi = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, S.dummyHi);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16UI, 1, 1, 0, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array(3));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); failed = true; S = null; });
  }catch(err){
    console.info("[compositor GPU] no disponible:", err.message || err);
    failed = true; S = null;
  }
  return S;
}

/* Documentos Display P3: el lienzo de salida y la subida de las capas trabajan en P3 (sin conversión). Como no
   se puede dar por hecho que el navegador lo respete, se comprueba una vez pasando unos colores saturados de
   un lienzo P3 por la propia GPU y devolviéndolos a otro lienzo P3: si no vuelven iguales, los documentos P3
   siguen por el camino de 8 bits de siempre. */
let p3State = null;

function p3Ok(){
  if(p3State !== null) return p3State;
  p3State = false;
  try{
    if(!S) return false;
    const { gl } = S;
    if(!("drawingBufferColorSpace" in gl) || !("unpackColorSpace" in gl)) return false;
    const src = document.createElement("canvas"); src.width = 4; src.height = 2;
    const sx = src.getContext("2d", { colorSpace: "display-p3" });
    if(!sx || sx.getContextAttributes().colorSpace !== "display-p3") return false;
    const want = [[255, 0, 0], [0, 255, 0], [10, 200, 30], [250, 120, 5], [0, 0, 255], [128, 128, 128], [255, 255, 255], [3, 3, 3]];
    const img = new ImageData(4, 2, { colorSpace: "display-p3" });
    want.forEach((c, i) => { img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; });
    sx.putImageData(img, 0, 0);
    setSpace("display-p3");
    S.canvas.width = 4; S.canvas.height = 2;
    const prog = program(gl, FS_COPY);
    gl.bindVertexArray(S.vao); gl.disable(gl.BLEND);
    const tex = uploadCanvas(src);
    gl.useProgram(prog.pr); bindTex(0, tex); gl.uniform1i(prog.u.uSrc, 0); gl.uniform2i(prog.u.uSize, 4, 2);
    drawInto(null, 4, 2);
    const dst = document.createElement("canvas"); dst.width = 4; dst.height = 2;
    const dx = dst.getContext("2d", { colorSpace: "display-p3" });
    dx.drawImage(S.canvas, 0, 0);
    const got = dx.getImageData(0, 0, 4, 2, { colorSpace: "display-p3" }).data;
    gl.deleteTexture(tex); gl.deleteProgram(prog.pr);
    let worst = 0;
    want.forEach((c, i) => { for(let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(got[i * 4 + k] - c[k])); });
    p3State = worst <= 1;
    if(!p3State) console.info("[compositor GPU] P3 no se conserva en este navegador (error " + worst + "): se usa el camino de 8 bits");
  }catch(err){ console.info("[compositor GPU] prueba P3 fallida:", err.message || err); p3State = false; }
  finally{ if(S) setSpace("srgb"); }
  return p3State;
}

let spaceNow = "srgb";

function setSpace(space){
  const { gl } = S;
  if(spaceNow === space) return;
  spaceNow = space;
  if("drawingBufferColorSpace" in gl){ gl.drawingBufferColorSpace = space; gl.unpackColorSpace = space; }
}

/* ── texturas ─────────────────────────────────────────────────── */
function newTex(gl, w, h, internal, format, type, data){
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function acquire(w, h, f32){
  const { gl } = S;
  if(S.poolW !== w || S.poolH !== h || S.poolF32 !== f32){ freePool(); S.poolW = w; S.poolH = h; S.poolF32 = f32; }
  return S.pool.pop() || newTex(gl, w, h, f32 ? gl.RGBA32F : gl.RGBA16F, gl.RGBA, f32 ? gl.FLOAT : gl.HALF_FLOAT, null);
}

const release = t => { if(t) S.pool.push(t); };

function freePool(){ if(!S) return; for(const t of S.pool) S.gl.deleteTexture(t); S.pool = []; }

function uploadCanvas(canvas){
  const { gl } = S;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

/* Caché de texturas de lienzo (v252): la textura de 8 bits de cada capa y de cada máscara se conserva entre fotogramas mientras el lienzo no
   cambie (revisión de core/canvasrev.js, que sube en cada escritura). Las que no se usan en una composición se liberan al terminar; el total
   cacheado tiene tope; lo que no cabe o no tiene revisión se sube como siempre y se borra al acabar. */
const CACHE_MAX_PX = (COARSE || memory <= 4) ? 24e6 : 96e6;

function canvasTexture(canvas){
  const rev = canvasRev(canvas), w = canvas.width, h = canvas.height;
  if(rev === null){ const t = uploadCanvas(canvas); S.temps.push(t); return t; }
  const e = S.tex8.get(canvas);
  if(e && e.rev === rev && e.w === w && e.h === h){ e.seen = true; floatInfo.texHits++; return e.tex; }
  if(e){ S.gl.deleteTexture(e.tex); S.tex8.delete(canvas); }
  let used = 0; for(const v of S.tex8.values()) used += v.w * v.h;
  const tex = uploadCanvas(canvas);
  floatInfo.texUploads++;
  if(used + w * h > CACHE_MAX_PX){ S.temps.push(tex); return tex; }
  S.tex8.set(canvas, { rev, w, h, tex, seen: true });
  return tex;
}

function tempTexture(canvas){ const t = uploadCanvas(canvas); S.temps.push(t); return t; }

function endCompose(){
  const { gl } = S;
  for(const t of S.temps) gl.deleteTexture(t);
  S.temps = [];
  for(const [c, e] of S.tex8){ if(e.seen) e.seen = false; else { gl.deleteTexture(e.tex); S.tex8.delete(c); } }
  S.plates = null; S.live = null;
}

/* Origen de 16 bits de una capa: se sube una vez por matriz de datos (RGB16UI). */
function hiTexture(layer){
  const hs = layer.hiSrc;
  if(!hs || !hs.data) return null;
  const hit = S.hi.get(layer.id);
  if(hit && hit.data === hs.data) { hit.seen = true; return hit; }
  if(hit) S.gl.deleteTexture(hit.tex);
  const { gl } = S;
  if(hs.w > S.maxTex || hs.h > S.maxTex) return null;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16UI, hs.w, hs.h, 0, gl.RGB_INTEGER, gl.UNSIGNED_SHORT, hs.data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const entry = { data: hs.data, tex, seen: true };
  S.hi.set(layer.id, entry);
  return entry;
}

/* Las capas de ajuste cuya cuenta es de un canal a la vez (niveles, curvas, exposición, balance de blancos) usan
   una curva de 4096 puntos por canal (la 3D de 3 niveles de paso no sigue bien un gamma cerca del negro); las
   demás, la rejilla RGB de 86³ de la exportación. */
const SEPARABLE = new Set(["levels", "curves", "exposure", "wb"]), N1 = 4096;

function lutTexture(layer){
  const { gl } = S;
  const key = layer.adjustType + "|" + JSON.stringify(layer.adjustParams || null);
  const hit = S.lut.get(layer.id);
  if(hit && hit.key === key){ hit.seen = true; return hit; }
  if(hit) gl.deleteTexture(hit.tex);
  const fn = adjustFunction(layer), o = [0, 0, 0];
  let entry;
  if(SEPARABLE.has(layer.adjustType)){
    const data = new Float32Array(N1 * 3);
    for(let k = 0; k < N1; k++){
      const v = k * 255 / (N1 - 1);
      fn(v, v, v, o);
      data[k * 3] = o[0]; data[k * 3 + 1] = o[1]; data[k * 3 + 2] = o[2];
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, N1, 1, 0, gl.RGB, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    entry = { key, tex, kind: 1, seen: true };
  } else {
    const n = GRID * GRID * GRID, data = new Float32Array(n * 3);
    for(let bi = 0, i = 0; bi < GRID; bi++) for(let gi = 0; gi < GRID; gi++) for(let ri = 0; ri < GRID; ri++, i += 3){
      fn(ri * STEP, gi * STEP, bi * STEP, o);
      data[i] = o[0]; data[i + 1] = o[1]; data[i + 2] = o[2];
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, GRID, GRID, GRID, 0, gl.RGB, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    entry = { key, tex, kind: 0, seen: true };
  }
  S.lut.set(layer.id, entry);
  return entry;
}

/* ── pasadas ──────────────────────────────────────────────────── */
function bindTex(unit, tex, target = null){ const { gl } = S; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target || gl.TEXTURE_2D, tex); }

function drawInto(target, w, h, vx = 0, vy = 0){
  const { gl } = S;
  if(target){
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
  } else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(vx, vy, w, h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function clearTex(tex, w, h){
  const { gl } = S;
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
}

const effectiveMask = layer => {
  if(layer.maskRef){ const r = doc.layers.find(l => l.id === layer.maskRef); return r ? r.mask : null; }
  return layer.mask;
};

const usable = l => l.visible && l.opacity > 0 && !l.__editing;

/* Recursos de textura de una composición (v252): la de cada capa, la de cada máscara y las láminas de estilo se preparan UNA vez y sirven a
   todas las teselas. */
function layerRes(l, R){
  let r = R.layers.get(l);
  if(r) return r;
  r = { srcTex: null, hi: null };
  /* Trazo en curso sobre esta capa: la capa y el trazo se funden en un lienzo temporal (como compositeTree); el origen de 16 bits sigue
     valiendo en los píxeles que no se han tocado (la comparación del shader usa el lienzo donde ya no coincide). */
  const lv = S.live;
  if(lv && lv.on && lv.ownerId === l.id && lv.canvas){
    const m = document.createElement("canvas"); m.width = l.canvas.width; m.height = l.canvas.height;
    const mx = m.getContext("2d", { colorSpace: "srgb" });
    mx.drawImage(l.canvas, 0, 0);
    mx.globalAlpha = lv.alpha; mx.globalCompositeOperation = lv.blend; mx.drawImage(lv.canvas, lv.x || 0, lv.y || 0);
    r.srcTex = tempTexture(m);
  } else r.srcTex = canvasTexture(l.canvas);
  if(l.hiSrc && (l.hiSrc.canvasW || l.hiSrc.w) === l.canvas.width && (l.hiSrc.canvasH || l.hiSrc.h) === l.canvas.height) r.hi = hiTexture(l);
  R.layers.set(l, r);
  return r;
}

function maskRes(canvas, R){
  let t = R.masks.get(canvas);
  if(!t){ t = canvasTexture(canvas); R.masks.set(canvas, t); }
  return t;
}

function styleRes(l, R){
  let r = R.styles.get(l);
  if(r) return r;
  r = {};
  const plate = S.plates && S.plates.get(l);
  if(plate && l.styles && hasEnabledStyle(l.styles)){ if(plate.behind) r.behind = tempTexture(plate.behind); if(plate.ring) r.ring = tempTexture(plate.ring); }
  R.styles.set(l, r);
  return r;
}

/* Compone un nivel del árbol para UNA tesela y devuelve su textura (premultiplicada, coma flotante). `tile` = { ox, oy, tw, th, aw, ah }: esquina,
   tamaño de la zona y tamaño de los acumuladores. Misma regla de recorte que compositeTree: la última capa no recortada sirve de base a las
   recortadas que la siguen. */
function composeLevel(nodes, tile, f32, R){
  const { gl } = S, { tw, th, aw, ah } = tile;
  let dst = acquire(aw, ah, f32);
  clearTex(dst, tw, th);
  let clipBase = null;            // textura con el alfa de la última capa no recortada (o null)
  for(let ni = 0; ni < nodes.length; ni++){
    const node = nodes[ni], l = node.layer;
    if(!usable(l)) continue;

    if(isAdjustLayer(l)){
      const mk = effectiveMask(l), hasMask = !!(mk && l.maskEnabled);
      const lut = lutTexture(l), maskTex = hasMask ? maskRes(mk.canvas, R) : null;
      const out = acquire(aw, ah, f32);
      gl.useProgram(S.adjust.pr);
      bindTex(0, dst); gl.uniform1i(S.adjust.u.uDst, 0);
      // Cada muestreador necesita una textura de su tipo en su unidad aunque no se use
      bindTex(1, lut.kind === 0 ? lut.tex : S.dummy3D, gl.TEXTURE_3D); gl.uniform1i(S.adjust.u.uLut, 1);
      bindTex(5, lut.kind === 1 ? lut.tex : dst); gl.uniform1i(S.adjust.u.uLut1, 5);
      gl.uniform1i(S.adjust.u.uKind, lut.kind); gl.uniform1i(S.adjust.u.uN, N1);
      bindTex(2, maskTex || dst); gl.uniform1i(S.adjust.u.uMask, 2); gl.uniform1i(S.adjust.u.uHasMask, hasMask ? 1 : 0);
      gl.uniform1f(S.adjust.u.uOpacity, l.opacity); gl.uniform1f(S.adjust.u.uGrid, GRID); gl.uniform1f(S.adjust.u.uStep, STEP);
      gl.uniform2i(S.adjust.u.uOff, tile.ox, tile.oy);
      drawInto(out, tw, th);
      release(dst); dst = out;
      continue;
    }

    let srcTex, srcKind = 0, hi = null;
    if(l.type === "group"){
      srcTex = composeLevel(node.children || [], tile, f32, R); srcKind = 1;
    } else {
      const r = layerRes(l, R); srcTex = r.srcTex; hi = r.hi;
    }
    const mk = effectiveMask(l), hasMask = !!(mk && l.maskEnabled);
    const maskTex = hasMask ? maskRes(mk.canvas, R) : null;
    const hasClip = !!(l.clipped && clipBase);
    const bi = l.type !== "group" && isBlendIfActive(l.blendIf) ? l.blendIf : null;
    const mode = MODES[l.blend || "source-over"] ?? 0;
    const styleTex = styleRes(l, R);

    const setup = prep => {
      const P = S.blend;
      gl.useProgram(P.pr);
      bindTex(0, dst); gl.uniform1i(P.u.uDst, 0);
      bindTex(1, srcTex); gl.uniform1i(P.u.uSrc, 1); gl.uniform1i(P.u.uSrcKind, srcKind);
      if(hi){ bindTex(2, hi.tex); gl.uniform1i(P.u.uHi, 2); }
      else { bindTex(2, S.dummyHi); gl.uniform1i(P.u.uHi, 2); }
      gl.uniform1i(P.u.uHasHi, hi ? 1 : 0);
      const hs = l.hiSrc;
      gl.uniform1i(P.u.uDither, hs && hs.dither ? 1 : 0);
      gl.uniform2i(P.u.uHiOff, hs ? (hs.x || 0) : 0, hs ? (hs.y || 0) : 0);
      gl.uniform2i(P.u.uHiSize, hs ? hs.w : 0, hs ? hs.h : 0);
      gl.uniform2i(P.u.uOff, tile.ox, tile.oy);
      bindTex(3, maskTex || dst); gl.uniform1i(P.u.uMask, 3); gl.uniform1i(P.u.uHasMask, hasMask ? 1 : 0);
      bindTex(4, hasClip ? clipBase : dst); gl.uniform1i(P.u.uClip, 4); gl.uniform1i(P.u.uHasClip, hasClip ? 1 : 0);
      gl.uniform1i(P.u.uBI, bi ? 1 : 0);
      if(bi){
        const t = bi.thisLayer, u = bi.underlying;
        gl.uniform4f(P.u.uBIThis, t.blackMin, t.blackMax, t.whiteMin, t.whiteMax);
        gl.uniform4f(P.u.uBIUnder, u.blackMin, u.blackMax, u.whiteMin, u.whiteMax);
        CHANNELS.forEach((c, k) => { const [ct, cu] = channelSides(bi, c), N = ["R", "G", "B"][k]; gl.uniform4f(P.u["uBI" + N + "T"], ct.blackMin, ct.blackMax, ct.whiteMin, ct.whiteMax); gl.uniform4f(P.u["uBI" + N + "U"], cu.blackMin, cu.blackMax, cu.whiteMin, cu.whiteMax); });
      }
      gl.uniform1f(P.u.uOpacity, l.opacity); gl.uniform1i(P.u.uMode, mode); gl.uniform1i(P.u.uPrep, prep ? 1 : 0);
      // estilos de capa (láminas de collectStyleShapes: sombra/resplandor detrás y trazo encima; el degradado se calcula aquí)
      const st = l.styles, pl = S.plates && S.plates.get(l), styled = !!(st && hasEnabledStyle(st) && pl);
      gl.uniform1i(P.u.uHasStyle, styled ? 1 : 0);
      if(styled){
        gl.uniform1i(P.u.uHasBehind, pl.behind ? 1 : 0); gl.uniform1i(P.u.uHasRing, pl.ring ? 1 : 0);
        bindTex(5, styleTex.behind || dst); gl.uniform1i(P.u.uBehind, 5);
        bindTex(6, styleTex.ring || dst); gl.uniform1i(P.u.uRing, 6);
        const g = st.gradient && st.gradient.enabled ? gradientParams(st.gradient, tile.W, tile.H) : null;
        gl.uniform1i(P.u.uGrad, g ? 1 : 0);
        if(g){ gl.uniform4f(P.u.uGradP, g.x0, g.y0, g.x1, g.y1); gl.uniform3f(P.u.uGradC1, g.c1[0], g.c1[1], g.c1[2]); gl.uniform3f(P.u.uGradC2, g.c2[0], g.c2[1], g.c2[2]); gl.uniform1f(P.u.uGradOp, g.opacity); }
      }
    };

    // La nueva base de recorte (si esta capa no está recortada y le sigue alguna recortada): su alfa ya recortada
    let newClip = null;
    if(!l.clipped){
      let needs = false;
      for(let k = ni + 1; k < nodes.length; k++){ const o = nodes[k].layer; if(!usable(o) || isAdjustLayer(o)) continue; if(o.clipped){ needs = true; break; } if(!o.clipped) break; }
      if(needs){ newClip = acquire(aw, ah, f32); setup(true); drawInto(newClip, tw, th); }
    }
    const out = acquire(aw, ah, f32);
    setup(false);
    drawInto(out, tw, th);
    release(dst); dst = out;
    if(srcKind === 1) release(srcTex);
    if(!l.clipped){ if(clipBase) release(clipBase); clipBase = newClip; }
  }
  if(clipBase) release(clipBase);
  return dst;
}

/* ── elegibilidad ─────────────────────────────────────────────── */
/** ¿Compensa y se puede componer este documento en coma flotante en la GPU? Devuelve el formato (true = 32 bits) o null. */
export function floatPlan(layers, w, h, { scratchOn = false, live = null } = {}){
  if(failed || scratchOn || !init()) return null;
  if(workSpace() !== "srgb" && !p3Ok()) return null;
  const px = w * h;
  if(w > S.maxTex || h > S.maxTex || px > MAX_DOC_PX) return null;
  const f32 = S.f32;                  // los acumuladores son de una tesela, no del documento: 32 bits siempre que se pueda
  let worth = false, texBytes = 0;
  for(const l of layers){
    if(!usable(l)) continue;
    if(l.type !== "adjust" && l.type !== "group"){ texBytes += px * 4 + (l.hiSrc && l.hiSrc.data ? l.hiSrc.w * l.hiSrc.h * 6 : 0); }
    if((l.mask || l.maskRef) && l.maskEnabled) texBytes += px * 4;
    if(l.type !== "adjust" && l.type !== "group" && (l.canvas.width !== w || l.canvas.height !== h)) return null;
    if(live && live.on && live.ownerId === l.id && l.styles && hasEnabledStyle(l.styles)) return null;     // trazo en curso sobre una capa con estilos: la lámina quedaría desfasada
    if(isAdjustLayer(l)) worth = true;
    else {
      if(l.hiSrc && l.hiSrc.data) worth = true;
      if(CUSTOM_BLENDS.has(l.blend) || (l.type !== "group" && isBlendIfActive(l.blendIf))) worth = true;
    }
  }
  if(!worth || texBytes > TEX_BUDGET) return null;
  if(unsupportedReason(layers)) return null;
  return { f32 };
}

/** Compone el árbol de capas en coma flotante y devuelve un lienzo WebGL (w×h, 8 bits con tramado) listo para
    dibujarlo con drawImage, o null si no se pudo. */
export function floatCompose(tree, layers, w, h, plan, { dither = true, live = null } = {}){
  if(!init()) return null;
  const { gl } = S;
  try{
    setSpace(workSpace());
    if(S.canvas.width !== w || S.canvas.height !== h){ S.canvas.width = w; S.canvas.height = h; }
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(S.vao);
    S.live = live;
    S.plates = layers.some(l => l.visible && l.opacity > 0 && l.styles && hasEnabledStyle(l.styles)) ? collectStyleShapes(tree, w, h) : null;
    const T = Math.max(64, floatTuning.tile | 0), aw = Math.min(w, T), ah = Math.min(h, T), R = { layers: new Map(), masks: new Map(), styles: new Map() };
    for(let oy = 0; oy < h; oy += T) for(let ox = 0; ox < w; ox += T){
      const tw = Math.min(T, w - ox), th = Math.min(T, h - oy);
      const result = composeLevel(tree, { ox, oy, tw, th, aw, ah, W: w, H: h }, plan.f32, R);
      gl.useProgram(S.out.pr);
      bindTex(0, result); gl.uniform1i(S.out.u.uDst, 0);
      gl.uniform2i(S.out.u.uSize, w, h); gl.uniform2i(S.out.u.uOff, ox, oy); gl.uniform1i(S.out.u.uDither, dither ? 1 : 0);
      drawInto(null, tw, th, ox, h - oy - th);       // la tesela va a su sitio del lienzo (el origen de la ventana está abajo)
      release(result);
    }
    if(gl.getError() !== gl.NO_ERROR) throw new Error("error de WebGL");
    floatInfo.composes++; floatInfo.last = { w, h, f32: plan.f32, tile: T };
    return S.canvas;
  }catch(err){
    console.warn("[compositor GPU]", err);
    failed = true;
    return null;
  }finally{
    endCompose();
    // limpia las tablas y los orígenes de capas que ya no están
    for(const [id, e] of S.hi) if(!layers.some(l => l.id === id)){ gl.deleteTexture(e.tex); S.hi.delete(id); }
    for(const [id, e] of S.lut) if(!layers.some(l => l.id === id)){ gl.deleteTexture(e.tex); S.lut.delete(id); }
    // la memoria de los acumuladores se devuelve si no se vuelve a componer en un rato
    clearTimeout(S.idle);
    S.idle = setTimeout(() => { freePool(); }, 4000);
  }
}

/** Para pruebas: compone y devuelve el resultado SIN pasar a 8 bits: Float32 RGBA premultiplicado (w·h·4), o null. */
export function _debugFloat(tree, layers, w, h, plan, live = null){
  if(!init()) return null;
  const { gl } = S;
  try{
    setSpace(workSpace());
    gl.disable(gl.BLEND); gl.bindVertexArray(S.vao);
    S.live = live;
    S.plates = layers.some(l => l.visible && l.opacity > 0 && l.styles && hasEnabledStyle(l.styles)) ? collectStyleShapes(tree, w, h) : null;
    const T = Math.max(64, floatTuning.tile | 0), aw = Math.min(w, T), ah = Math.min(h, T), R = { layers: new Map(), masks: new Map(), styles: new Map() };
    const out = new Float32Array(w * h * 4);
    for(let oy = 0; oy < h; oy += T) for(let ox = 0; ox < w; ox += T){
      const tw = Math.min(T, w - ox), th = Math.min(T, h - oy);
      const result = composeLevel(tree, { ox, oy, tw, th, aw, ah, W: w, H: h }, plan ? plan.f32 : true, R);
      gl.bindFramebuffer(gl.FRAMEBUFFER, S.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, result, 0);
      const buf = new Float32Array(tw * th * 4);
      gl.readPixels(0, 0, tw, th, gl.RGBA, gl.FLOAT, buf);
      for(let y = 0; y < th; y++) out.set(buf.subarray(y * tw * 4, (y + 1) * tw * 4), ((oy + y) * w + ox) * 4);
      release(result);
    }
    endCompose();
    return out;
  }catch(err){ console.warn("[compositor GPU]", err); return null; }
}

/** Para el diagnóstico: cuántas veces se ha compuesto en la GPU y con qué formato. */
export const floatInfo = { composes: 0, last: null, texHits: 0, texUploads: 0 };

export function floatReset(){ failed = false; }
