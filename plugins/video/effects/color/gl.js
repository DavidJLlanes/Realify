/* ═══════════════════════════════════════════════════════════════
   EFECTO COLOR · VERSIÓN WEBGL
   Hace en la tarjeta gráfica lo mismo que motor.js hace en la CPU: balance de blancos (temperatura y tinte), curva de tono por tabla de 256 valores (la misma `tablaTono`, así el resultado
   es idéntico salvo un nivel de redondeo) y saturación. Entradas: lienzo del fotograma y params. Salida: lienzo nuevo, o null si no hay WebGL (el adaptador usa entonces la CPU).
   Límite: un solo contexto por instancia del efecto; se libera con liberar().
   ═══════════════════════════════════════════════════════════════ */
import { tablaTono } from "./motor.js";

const VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
const FS = `precision highp float;varying vec2 v;uniform sampler2D img,lut;uniform vec3 k;uniform float s;uniform float sat,bal;
float t(float c){return texture2D(lut,vec2((floor(clamp(c,0.,255.)+.5)+.5)/256.,.5)).r;}
void main(){vec3 c=floor(texture2D(img,v).rgb*255.+.5);if(bal>.5)c*=k;c=vec3(t(c.r),t(c.g),t(c.b))*255.;
if(sat>.5){float l=dot(c,vec3(.2126,.7152,.0722));c=l+(c-l)*s;}gl_FragColor=vec4(clamp(c/255.,0.,1.),1.);}`;

export function crearGL(){
  const cv = document.createElement("canvas"), gl = cv.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if(!gl) return null;
  const sh = (tipo, src) => { const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = () => { const x = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, x); for(const [a, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, v); return x; };
  const tImg = tex(), tLut = tex(), u = n => gl.getUniformLocation(pr, n);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  return {
    aplicar(frame, p){
      cv.width = frame.width; cv.height = frame.height; gl.viewport(0, 0, cv.width, cv.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tImg); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame); gl.uniform1i(u("img"), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tLut); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(tablaTono(p))); gl.uniform1i(u("lut"), 1);
      gl.uniform3f(u("k"), 1 + p.temperatura / 100 * 0.25, 1 - p.tinte / 100 * 0.15, 1 - p.temperatura / 100 * 0.25);
      gl.uniform1f(u("s"), 1 + p.saturacion / 100); gl.uniform1f(u("sat"), p.saturacion !== 0 ? 1 : 0); gl.uniform1f(u("bal"), p.temperatura !== 0 || p.tinte !== 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const out = Object.assign(document.createElement("canvas"), { width: cv.width, height: cv.height }); out.getContext("2d").drawImage(cv, 0, 0); return out;
    },
    liberar(){ gl.getExtension("WEBGL_lose_context")?.loseContext(); }
  };
}
