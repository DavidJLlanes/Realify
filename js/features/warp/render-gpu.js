/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · RENDER EN GPU (WebGL2)
   Mismo cálculo que render-cpu.js: bicúbico Catmull-Rom en luz lineal con alfa premultiplicado. El campo va en una textura RG32F
   y se interpola a mano (no hace falta ninguna extensión); la imagen va como SRGB8_ALPHA8, así que el muestreo ya es lineal.
   Entradas: lienzo de origen y campo. Salida: lienzo nuevo, o null si no hay WebGL2 o la imagen no cabe en una textura.
   Límites: usa el DOM (canvas); el respaldo es render-cpu.js.
   ═══════════════════════════════════════════════════════════════ */

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D img; uniform sampler2D fld; uniform ivec2 size; uniform ivec2 grid; uniform float paso; uniform int lin;
out vec4 o;
vec4 tex(ivec2 q){ q = clamp(q, ivec2(0), size - 1); vec4 t = texelFetch(img, q, 0); return vec4(t.rgb * t.a, t.a); }
vec4 w4(float t){ float t2 = t*t, t3 = t2*t;
  return vec4(-.5*t3 + t2 - .5*t, 1.5*t3 - 2.5*t2 + 1., -1.5*t3 + 2.*t2 + .5*t, .5*t3 - .5*t2); }
vec3 enc(vec3 l){ return mix(l * 12.92, 1.055 * pow(l, vec3(1. / 2.4)) - .055, step(vec3(.0031308), l)); }
void main(){
  ivec2 px = ivec2(gl_FragCoord.x, float(size.y) - gl_FragCoord.y);
  vec2 f = min(vec2(px) / paso, vec2(grid - 1)); ivec2 g = min(ivec2(f), grid - 2); vec2 u = f - vec2(g);
  vec2 d = mix(mix(texelFetch(fld, g, 0).rg, texelFetch(fld, g + ivec2(1, 0), 0).rg, u.x),
               mix(texelFetch(fld, g + ivec2(0, 1), 0).rg, texelFetch(fld, g + ivec2(1, 1), 0).rg, u.x), u.y);
  vec2 s = vec2(px) + d; vec2 fl = floor(s); ivec2 i0 = ivec2(fl) - 1; vec4 wx = w4(s.x - fl.x), wy = w4(s.y - fl.y);
  vec4 acc = vec4(0.);
  for(int m = 0; m < 4; m++) for(int n = 0; n < 4; n++) acc += tex(i0 + ivec2(n, m)) * wx[n] * wy[m];
  float a = clamp(acc.a, 0., 1.);
  if(a < 1e-4){ o = vec4(0.); return; }
  vec3 c = clamp(acc.rgb / min(a, 1.), 0., 1.);
  o = vec4(lin == 1 ? enc(c) : c, a);
}`;

function programa(gl){
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if(!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  return pr;
}

export function deformarGPU(origen, c, { lineal = true } = {}){
  try{
    const W = origen.width, H = origen.height, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const gl = cv.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if(!gl || Math.max(W, H) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null;
    const pr = programa(gl); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const textura = unidad => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unidad); gl.bindTexture(gl.TEXTURE_2D, t);
      for(const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    textura(0); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, lineal ? gl.SRGB8_ALPHA8 : gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, origen);
    textura(1);
    const rg = new Float32Array(c.gw * c.gh * 2); for(let i = 0; i < c.dx.length; i++){ rg[i * 2] = c.dx[i]; rg[i * 2 + 1] = c.dy[i]; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, c.gw, c.gh, 0, gl.RG, gl.FLOAT, rg);
    gl.uniform1i(gl.getUniformLocation(pr, "img"), 0); gl.uniform1i(gl.getUniformLocation(pr, "fld"), 1);
    gl.uniform2i(gl.getUniformLocation(pr, "size"), W, H); gl.uniform2i(gl.getUniformLocation(pr, "grid"), c.gw, c.gh);
    gl.uniform1f(gl.getUniformLocation(pr, "paso"), c.paso); gl.uniform1i(gl.getUniformLocation(pr, "lin"), lineal ? 1 : 0);
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if(gl.getError() !== gl.NO_ERROR) return null;
    const res = document.createElement("canvas"); res.width = W; res.height = H; res.getContext("2d").drawImage(cv, 0, 0);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return res;
  } catch { return null; }
}
