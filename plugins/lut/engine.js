/* ═══════════════════════════════════════════════════════════════
   EFECTOS LUT · MOTOR WebGL2
   Aplica una tabla de color 3D (.cube) en la GPU, igual para las
   miniaturas, la vista previa y el resultado final (por teselas).

   La tabla se sube como textura 3D con el ROJO corriendo más rápido,
   luego el verde y por último el azul, que es el orden del .cube.

   Dos modos de cálculo:
     · normal   → RGBA16F con filtrado trilineal de la GPU.
     · Premium 👑 → RGBA32F e INTERPOLACIÓN TETRAÉDRICA (la que usan los
       programas de etalonaje: sigue la diagonal gris sin teñirla, que es
       donde una interpolación trilineal tiende a colar un tinte), más
       tramado triangular de la salida para que los degradados no hagan
       bandas.
   ═══════════════════════════════════════════════════════════════ */

import { parseCube } from "../../js/filters/lut/engine.js";
import { workSpace } from "../../js/core/colorspace.js";

const VERT = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0., 1.); }`;

const MAIN = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uImage;
uniform sampler3D uLut;
uniform float uSize, uInt;
uniform vec3 uMin, uSpan;
uniform vec2 uOff;
uniform bool uPrem, uOriginal;
out vec4 outColor;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 node(ivec3 b, int dx, int dy, int dz){
  int last = int(uSize) - 1;
  return texelFetch(uLut, clamp(b + ivec3(dx, dy, dz), ivec3(0), ivec3(last)), 0).rgb;
}

/* Interpolación tetraédrica: el cubo se parte en seis tetraedros según el orden de las fracciones. */
vec3 lutTetra(vec3 c){
  vec3 t = clamp((c - uMin) / uSpan, 0., 1.) * (uSize - 1.);
  ivec3 b = ivec3(floor(min(t, vec3(uSize - 1.0001))));
  vec3 f = t - vec3(b);
  vec3 c000 = node(b, 0, 0, 0), c111 = node(b, 1, 1, 1);
  if(f.r > f.g){
    if(f.g > f.b){ vec3 c100 = node(b, 1, 0, 0); return c000 + (c100 - c000) * f.r + (node(b, 1, 1, 0) - c100) * f.g + (c111 - node(b, 1, 1, 0)) * f.b; }
    if(f.r > f.b){ vec3 c100 = node(b, 1, 0, 0), c101 = node(b, 1, 0, 1); return c000 + (c100 - c000) * f.r + (c111 - c101) * f.g + (c101 - c100) * f.b; }
    vec3 c001 = node(b, 0, 0, 1), c101 = node(b, 1, 0, 1); return c000 + (c101 - c001) * f.r + (c111 - c101) * f.g + (c001 - c000) * f.b;
  }
  if(f.b > f.g){ vec3 c001 = node(b, 0, 0, 1), c011 = node(b, 0, 1, 1); return c000 + (c001 - c000) * f.b + (c011 - c001) * f.g + (c111 - c011) * f.r; }
  if(f.b > f.r){ vec3 c010 = node(b, 0, 1, 0), c011 = node(b, 0, 1, 1); return c000 + (c010 - c000) * f.g + (c011 - c010) * f.b + (c111 - c011) * f.r; }
  vec3 c010 = node(b, 0, 1, 0), c110 = node(b, 1, 1, 0); return c000 + (c010 - c000) * f.g + (c110 - c010) * f.r + (c111 - c110) * f.b;
}

void main(){
  vec2 frag = vec2(gl_FragCoord.x, float(textureSize(uImage, 0).y) - gl_FragCoord.y);
  vec4 src = texelFetch(uImage, ivec2(gl_FragCoord.x, float(textureSize(uImage, 0).y) - gl_FragCoord.y), 0);
  if(uOriginal){ outColor = src; return; }
  vec3 c = src.rgb, o;
  if(uPrem) o = lutTetra(c);
  else {
    vec3 t = clamp((c - uMin) / uSpan, 0., 1.);
    o = texture(uLut, (t * (uSize - 1.) + .5) / uSize).rgb;
  }
  o = mix(c, clamp(o, 0., 1.), uInt);
  if(uPrem) o += (hash(frag + uOff + .5) + hash((frag + uOff) * 1.7 + 3.1) - 1.) / 255.;
  outColor = vec4(clamp(o, 0., 1.), src.a);
}`;

export class LutGL {
  constructor(canvas = document.createElement("canvas")){
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
    if(!gl) throw new Error("Los efectos LUT necesitan WebGL2, que este navegador no ofrece.");
    this.program = this.link(MAIN);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.image = this.texture2D();
    /* Textura 3D de relleno para cuando no hay tabla: un sampler3D sin textura propia apunta, por defecto, a la unidad 0 —la misma que el sampler2D de la
       imagen— y WebGL se niega a dibujar si dos samplers de distinto tipo comparten unidad. */
    this.blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.blank);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    this.luts = new WeakMap();                 // tabla → { half, full }
    this.maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
    gl.disable(gl.BLEND); gl.disable(gl.DITHER);
  }
  link(fs){
    const gl = this.gl, p = gl.createProgram();
    for(const [type, code] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]]){
      const sh = gl.createShader(type); gl.shaderSource(sh, code); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh); gl.deleteShader(sh);
    }
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for(let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++){ const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    return { p, u, pos: gl.getAttribLocation(p, "position") };
  }
  texture2D(){
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  /* En un documento Display P3 la GPU sube y devuelve en P3; las tablas trabajan sobre valores codificados. */
  syncSpace(){
    const gl = this.gl, want = workSpace();
    if(this.space === want || !("drawingBufferColorSpace" in gl)) return;
    try{ gl.drawingBufferColorSpace = want; gl.unpackColorSpace = want; this.space = want; }catch{}
  }
  setImage(canvas){
    const gl = this.gl;
    this.syncSpace();
    gl.bindTexture(gl.TEXTURE_2D, this.image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  /* Textura 3D de la tabla, creada la primera vez que se usa en cada modo y guardada mientras exista la tabla. */
  lutTexture(lut, premium){
    const gl = this.gl;
    let entry = this.luts.get(lut); if(!entry){ entry = {}; this.luts.set(lut, entry); }
    const key = premium ? "full" : "half";
    if(entry[key]) return entry[key];
    const n = lut.size, rgba = new Float32Array(n * n * n * 4);
    for(let i = 0, j = 0, k = 0; i < n * n * n; i++, j += 3, k += 4){ rgba[k] = lut.data[j]; rgba[k + 1] = lut.data[j + 1]; rgba[k + 2] = lut.data[j + 2]; rgba[k + 3] = 1; }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, t);
    const f = premium ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, f);
    for(const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, premium ? gl.RGBA32F : gl.RGBA16F, n, n, n, 0, gl.RGBA, gl.FLOAT, rgba);
    entry[key] = t; return t;
  }
  /** Dibuja la imagen subida con la tabla `lut` (o sin ella con `original`) en el lienzo, de cw×ch píxeles. */
  render(lut, { intensity = 100, premium = false, cw, ch, original = false, offset = [0, 0] } = {}){
    const gl = this.gl, m = this.program, u = m.u;
    if(gl.isContextLost()) throw new Error("Se ha perdido el contexto gráfico");
    if(this.canvas.width !== cw || this.canvas.height !== ch){ this.canvas.width = cw; this.canvas.height = ch; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(m.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.image); gl.uniform1i(u.uImage, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, lut ? this.lutTexture(lut, premium) : this.blank); gl.uniform1i(u.uLut, 1);
    if(lut){
      gl.uniform1f(u.uSize, lut.size);
      gl.uniform3f(u.uMin, ...lut.min); gl.uniform3f(u.uSpan, lut.max[0] - lut.min[0], lut.max[1] - lut.min[1], lut.max[2] - lut.min[2]);
    }
    gl.uniform1f(u.uInt, Math.max(0, Math.min(1, intensity / 100)));
    gl.uniform2f(u.uOff, offset[0], offset[1]);
    gl.uniform1i(u.uPrem, premium ? 1 : 0);
    gl.uniform1i(u.uOriginal, original || !lut ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(m.pos); gl.vertexAttribPointer(m.pos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /** Resultado a resolución completa, por teselas (la tabla no necesita vecindad). Devuelve un lienzo nuevo. */
  async renderFull(src, lut, { intensity = 100, premium = false } = {}, onProgress = () => {}){
    const W = src.width, H = src.height, tile = Math.min(this.maxTex, 2048);
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const octx = out.getContext("2d"), tmp = document.createElement("canvas"), tctx = tmp.getContext("2d");
    const tiles = [];
    for(let y = 0; y < H; y += tile) for(let x = 0; x < W; x += tile) tiles.push({ x, y, w: Math.min(tile, W - x), h: Math.min(tile, H - y) });
    for(let i = 0; i < tiles.length; i++){
      const t = tiles[i];
      tmp.width = t.w; tmp.height = t.h; tctx.clearRect(0, 0, t.w, t.h);
      tctx.drawImage(src, t.x, t.y, t.w, t.h, 0, 0, t.w, t.h);
      this.setImage(tmp);
      this.render(lut, { intensity, premium, cw: t.w, ch: t.h, offset: [t.x, t.y] });
      octx.drawImage(this.canvas, t.x, t.y);
      onProgress(Math.round((i + 1) / tiles.length * 100));
      await new Promise(r => setTimeout(r, 0));
    }
    tmp.width = tmp.height = 1;
    return out;
  }
  dispose(){
    const gl = this.gl;
    gl.deleteTexture(this.image); gl.deleteTexture(this.blank); gl.deleteProgram(this.program.p); gl.deleteBuffer(this.buffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/* ── Carga de tablas: una descarga cada vez que se pide, como mucho 5 a la vez ── */
const cache = new Map();            // id → Promise<lut>
let active = 0; const waiting = [];
const pump = () => { while(active < 5 && waiting.length){ active++; waiting.shift()(); } };
const run = job => new Promise((resolve, reject) => {
  waiting.push(() => job().then(resolve, reject).finally(() => { active--; pump(); }));
  pump();
});
/** Descarga y lee la tabla `id` de la familia `fam` (con caché de la sesión). */
export function loadLut(fam, id){
  const key = fam + "/" + id;
  if(!cache.has(key)){
    const p = run(async () => {
      const res = await fetch(new URL(`./files/${fam}/${id}.cube`, import.meta.url));
      if(!res.ok) throw new Error(`No se pudo descargar la tabla «${id}» (${res.status})`);
      return parseCube(await res.text());
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}
export const isLoaded = (fam, id) => cache.has(fam + "/" + id);
