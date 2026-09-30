/* ═══════════════════════════════════════════════════════════════
   MOTOR DEL FILTRO CÁMARA
   Contexto WebGL2 propio, aparte del lienzo 2D del editor. Recibe un
   canvas de entrada y devuelve otro con la cadena aplicada, así que
   sirve igual para la vista previa, para aplicar a una capa o para
   procesar un lote sin tocar el documento.

   El contexto se crea la primera vez que se usa: quien no abra nunca
   el filtro no paga el coste de reservar una GPU.
   ═══════════════════════════════════════════════════════════════ */

import { VS, PRE, SH } from "./shaders.js";
import { CHAIN, CHAIN_BY_ID } from "./chain.js";

let gl = null, glCanvas = null, floatOK = false, float32OK = false, premium = false;
let PROG = {}, quadVAO = null, srcTex = null;
let fbFull = [], fbHalf = [], fbQ = [], fbE = [], fbCache = null;
let fbWork = [], fbResample = null, sourceCanvas = null;
let W = 0, H = 0;
let ready = false, initError = null;

export function available(){
  ensure();
  return !!gl && !initError;
}
export function lastError(){ return initError; }
export function hasFloat(){ return floatOK; }

/* Motor Premium 👑 («el bueno y el mejor»), con los mismos mandos:
     · Bueno: toda la cadena en coma flotante de 32 bits (en vez de 16)
       y luces con hombro suave que conserva el tono.
     · Mejor: tinte y saturación en OKLab con mapeo de gama (sin virar
       ni recortar colores) y tramado al pasar a 8 bits.
   Apagado, el filtro queda exactamente igual que antes. */
export function setPremium(on){
  on = !!on;
  if(on === premium) return;
  premium = on;
  if(gl && W && H) allocate(W, H);
  invalidateCache();
}
export const isPremium = () => premium;

function ensure(){
  if(ready) return;
  ready = true;
  glCanvas = document.createElement("canvas");
  gl = glCanvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
  if(!gl){ initError = "Este navegador no expone WebGL2."; return; }
  floatOK = !!gl.getExtension("EXT_color_buffer_float") ||
            !!gl.getExtension("EXT_color_buffer_half_float");
  // Premium: intermedios de 32 bits si se pueden pintar y filtrar
  float32OK = !!gl.getExtension("EXT_color_buffer_float") && !!gl.getExtension("OES_texture_float_linear");
  try{ initGL(); }
  catch(err){ initError = String(err.message || err); }

  glCanvas.addEventListener("webglcontextlost", e => {
    e.preventDefault();
    initError = "Se perdió el contexto gráfico.";
  });
  glCanvas.addEventListener("webglcontextrestored", () => {
    try{
      srcTex = null; fbFull = []; fbHalf = []; fbQ = []; fbE = []; fbCache = null;
      fbWork = []; fbResample = null;
      initGL(); initError = null; W = H = 0;
    }catch(err){ initError = String(err.message || err); }
  });
}

function compile(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function program(fs){
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function initGL(){
  PROG = {};
  for(const k in SH) PROG[k] = program(SH[k]);
  quadVAO = gl.createVertexArray();
  gl.bindVertexArray(quadVAO);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
}

function makeFBO(w, h){
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const f32 = premium && float32OK;
  const internal = f32 ? gl.RGBA32F : floatOK ? gl.RGBA16F : gl.RGBA8;
  const type     = f32 ? gl.FLOAT : floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, w, h };
}

export function vramEstimate(w, h){
  const bpp = premium && float32OK ? 16 : floatOK ? 8 : 4;
  // Cota superior: incluye los buffers opcionales de remuestreo y ondículas.
  return w * h * bpp * (7 + 2*0.25 + 2*0.0625 + 2*0.015625);
}

function allocate(w, h){
  [...fbFull, ...fbHalf, ...fbQ, ...fbE, ...fbWork,
   ...(fbResample ? [fbResample] : []), ...(fbCache ? [fbCache] : [])].forEach(f => {
    gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex);
  });
  fbWork = []; fbResample = null;
  fbFull  = [makeFBO(w, h), makeFBO(w, h)];
  fbCache = makeFBO(w, h);
  const q = (n, d) => Math.max(1, n >> d);
  fbHalf = [makeFBO(q(w,1), q(h,1)), makeFBO(q(w,1), q(h,1))];
  fbQ    = [makeFBO(q(w,2), q(h,2)), makeFBO(q(w,2), q(h,2))];
  fbE    = [makeFBO(q(w,3), q(h,3)), makeFBO(q(w,3), q(h,3))];
  invalidateCache();
}

let seedValue = 1000;
export function setSeed(v){ seedValue = v; }
/* Identidad del sensor simulado. Se mantiene entre imágenes —no la
   toca «Variar»— para que un lote comparta huella, como pasaría con
   una cámara de verdad. */
let camSeedValue = 1000;
export function setCameraSeed(v){ camSeedValue = v; }

function pass(name, target, inTex, uniforms, extraTex, thirdTex){
  const p = PROG[name];
  gl.useProgram(p);
  gl.bindVertexArray(quadVAO);

  if(target){
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
    gl.viewport(0, 0, target.w, target.h);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, inTex);
  gl.uniform1i(gl.getUniformLocation(p, "uTex"), 0);
  if(extraTex){
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, extraTex);
    gl.uniform1i(gl.getUniformLocation(p, "uTex2"), 1);
  }
  if(thirdTex){
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, thirdTex);
    gl.uniform1i(gl.getUniformLocation(p, "uTex3"), 2);
  }

  const res = target ? [target.w, target.h] : [glCanvas.width, glCanvas.height];
  gl.uniform2f(gl.getUniformLocation(p, "uRes"), res[0], res[1]);
  gl.uniform1f(gl.getUniformLocation(p, "uSeed"), seedValue);
  gl.uniform1f(gl.getUniformLocation(p, "uCamSeed"), camSeedValue);
  gl.uniform1f(gl.getUniformLocation(p, "uPremium"), premium ? 1 : 0);

  for(const k in uniforms || {}){
    const loc = gl.getUniformLocation(p, k);
    if(loc === null) continue;
    const v = uniforms[k];
    if(Array.isArray(v)){
      if(v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else               gl.uniform3f(loc, v[0], v[1], v[2]);
    } else gl.uniform1f(loc, v);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

/* ── conversión de valores del panel a uniformes ─────────────── */
const N = v => v / 100;
const S = v => v / 100;

function hashSeed(k){
  const x = Math.sin(seedValue * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* Círculo de confusión de un fondo muy alejado, fórmula estándar de
   lente delgada: coc = focal² / (N · S1), donde S1 es la distancia de
   enfoque. Con un objeto en el infinito el resultado ya no depende de
   la distancia del propio fondo, sólo de dónde se enfocó. Se expresa
   como fracción del ancho del sensor (el mismo desenfoque absoluto en
   mm ocupa más proporción del encuadre cuanto más pequeño el sensor,
   que es justo por qué un móvil consigue mucho menos bokeh que una
   full-frame con la misma focal y apertura) y de ahí a la escala 0-100
   del uniforme, con un factor de calibración fijado a ojo contra
   valores fotográficos típicos —un 85mm a f/1.8 a 2m debe leerse como
   «fuerte pero no extremo», no como el tope de la escala. */
function physicalDofAmt(p){
  const fstop    = Math.pow(2, (p.fstop / 100) * 5);            // f/1.0 .. f/32
  const focalMm  = 18 * Math.pow(600 / 18, p.focal / 100);      // 18 .. 600 mm
  const distMm   = 300 * Math.pow(30000 / 300, p.distance / 100); // 0.3 .. 30 m
  const crop     = 1.0 + (p.crop / 100) * (2.7 - 1.0);          // 1.0 .. 2.7×
  const sensorWidthMm = 36 / crop;

  const coc = (focalMm * focalMm) / (Math.max(fstop, 0.5) * distMm);
  const relative = coc / sensorWidthMm;
  const CALIBRATION = 11;
  return Math.max(0, Math.min(100, relative * 100 * CALIBRATION)) / 100 * 3.2;
}

/* La dosis manual multiplica lo que hay en el panel al renderizar,
   sin mover los deslizadores. Casi todos los parámetros son inertes
   en 0, así que multiplicar basta; dos no lo son —el techo de recorte
   y la calidad JPEG—, y esos suben hacia 100 al bajar la dosis. Los
   radios no se tocan: con la amplitud a cero dan igual, y quietos el
   50 % se ve como lo mismo más flojo en vez de como otra cosa. */
export function effParams(stages, id, dose){
  const raw = stages[id].p;
  if(dose >= 1) return raw;
  const out = {};
  for(const pr of CHAIN_BY_ID[id].params){
    const v = raw[pr.k];
    out[pr.k] = pr.mode === "keep" ? v
              : pr.mode === "inv"  ? v + (100 - v) * (1 - dose)
              : v * dose;
  }
  return out;
}

export function uni(stages, id, dose){
  const p = effParams(stages, id, dose);
  switch(id){
    case "resample": return { scale: 1-N(p.amt)*0.5, uMix: N(p.mix) };
    case "wavelet": return {
      uFine: N(p.fine)*0.045, uCoarse: N(p.coarse)*0.03, uEdge: N(p.edge)
    };
    case "upsamp": return {
      uAmt: N(p.amt)*0.9, uAmt2: N(p.amt2)*0.9, uEdge: N(p.edge)
    };
    case "spectral": {
      const RADII = { vintage:4.5, dslr:2.0, mobile:6.5, hires:0.8, manual:0 };
      const r = p.profile === "manual" ? 0.1 + N(p.radius) * 3.0 : RADII[p.profile];
      // Esta etapa no tiene amplitud: su radio ES la fuerza, así que
      // es lo que escala con la dosis. Sin esto iba al 100 % con la
      // dosis al 1 %, que era el salto brusco al salir de cero.
      return { uRadius: r * dose };
    }
    case "distort": {
      const k1 = -S(p.amt) * 0.115;
      const k2 = -S(p.amt) * N(p.edge) * 0.075;
      return { uK1: k1, uK2: k2, uZoom: Math.max(1, 1 + k1 + k2) };
    }
    case "dof": {
      // En modo físico el desenfoque sale de focal, apertura y distancia,
      // que no se escalan (son la cámara, no una cantidad); la dosis se
      // aplica al resultado, como haría la amplitud en modo manual.
      const amt = p.mode === "physical" ? physicalDofAmt(p) * dose : N(p.amt) * 3.2;
      return {
        uAmt: amt,
        uFocus: [N(p.focusX), N(p.focusY)],
        uRadius: 0.05 + N(p.radius) * 0.35,
        uBokeh: N(p.bokeh)
      };
    }
    case "motion": {
      const KIND = { linear:0, zoom:1, tremor:2 };
      return {
        uAmt: N(p.amt) * 60.0,
        uAngle: (p.angle / 180) * Math.PI,
        uMode: KIND[p.kind] ?? 0,
        uZoomC: [N(p.zoomX), N(p.zoomY)],
        uRolling: S(p.rolling) * 0.14
      };
    }
    case "ca": return { uLat: S(p.lat) * 0.0045, uFringe: N(p.fringe) * 0.85 };
    case "soft": return {
      uAmt: N(p.amt) * 0.85, uStart: 0.10 + N(p.start) * 0.70, uAstig: S(p.astig)
    };
    case "vignette": return {
      uAmount: N(p.amt) * 0.9, uExt: 0.25 + N(p.ext) * 1.1, uDesat: N(p.desat) * 0.8
    };
    case "halation": return {
      thresh: 0.20 + N(p.thr) * 0.72, radius: 1.0 + N(p.rad) * 7.0,
      uStrength: N(p.str) * 1.5, uTint: N(p.tint)
    };
    case "flare": return {
      thresh:  0.55 + N(p.thr) * 0.40,
      streakR: 4.0 + N(p.streak) * 26.0,
      streakW: N(p.streak) * 1.6,
      spikeR:  3.0 + N(p.spikes) * 46.0,
      spikeW:  N(p.spikes) * 0.9,
      ghostsW: N(p.ghosts) * 1.5,
      uTint:   N(p.tint)
    };
    case "bayer": return {
      uAmount: N(p.amt),
      uPhase: [Math.floor(hashSeed(1) * 2), Math.floor(hashSeed(2) * 2)]
    };
    case "cfa": return { uAmt: N(p.amt) * 0.07, uColor: N(p.color) };
    case "prnu": return {
      uAmt: N(p.amt) * 0.06, uScale: 0.4 + N(p.scale) * 3.0, uWafer: N(p.wafer) * 0.10
    };
    case "sensor": return {
      uShot: N(p.shot) * 0.085, uRead: N(p.read) * 0.020,
      uScale: 0.7 + N(p.size) * 2.9,
      uGain: [1.0, 0.86, 1.0 + N(p.blue) * 1.4],
      uChroma: N(p.chr) * 0.035, uBand: N(p.band) * 0.012,
      uHot: N(p.hot) * 0.00035,
      uResponse: N(p.response ?? 0)*0.025, uColumn: N(p.column ?? 0)*0.008,
      uShadow: N(p.shadow ?? 0) * 4.0
    };
    case "dust": return {
      uAmt: N(p.amt), uSize: N(p.size), uSoft: N(p.soft)
    };
    case "clip": {
      const sk = N(p.skew) * 0.09;
      const ceil = 0.80 + N(p.ceil) * 0.45;
      return { uBlack: N(p.black) * 0.035,
               uCeil: [ceil + sk*0.35, ceil - sk, ceil + sk*0.75] };
    }
    case "tone": {
      const t = S(p.temp), g = S(p.tint);
      return {
        uWb: [1.0 - t*0.16, 1.0 + g*0.07, 1.0 + t*0.20],
        uExp: Math.pow(2.0, S(p.exp) * 0.7),
        uS: N(p.scur) * 0.85, uSat: S(p.sat)
      };
    }
    case "grade": {
      const cvt = v => (v - 50) / 50;
      return {
        uShTint: [cvt(p.shR), cvt(p.shB)],
        uHiTint: [cvt(p.hiR), cvt(p.hiB)],
        uAmt: N(p.amt)
      };
    }
    case "scratches": return {
      uAmt: N(p.amt), uLength: 0.3 + N(p.length) * 1.4, uWidth: N(p.width)
    };
    case "detail": return {
      uSmear: N(p.smear) * 1.05, uSharp: N(p.sharp) * 1.4,
      uSharpR: 1.0 + N(p.rad) * 3.2, uSigma: 0.30 - N(p.edge) * 0.275,
      uLocal: N(p.local) * 0.6
    };
    case "residual": return {
      uAmt: N(p.amt) * 0.09, uDetail: N(p.detail), uScale: 0.4 + N(p.scale) * 2.6
    };
    case "relief": return {
      uAmt: N(p.amt) * 0.55,
      uScale: 1.4 + N(p.scale) * 5.0,
      uAngle: (p.angle / 180) * Math.PI
    };
    case "warp": return { uAmp: N(p.amp) * 2.2, uFreq: 8.0 + N(p.freq) * 90.0 };
    case "chroma": return { uAmount: N(p.amt) };
    case "jpegtrace": return { uBlock: N(p.block)*0.05, uRing: N(p.ring)*0.10 };
  }
  return {};
}

/* ── pasos de render ─────────────────────────────────────────── */
const STEPS = [
  { id:"resample", run(src, dst, u){
      if(u.scale >= 1 || u.uMix <= 0){ pass("copy",dst,src.tex); return; }
      const w = Math.max(1,Math.ceil(W*u.scale)), h = Math.max(1,Math.ceil(H*u.scale));
      if(!fbResample || fbResample.w !== w || fbResample.h !== h){
        if(fbResample){ gl.deleteFramebuffer(fbResample.fb); gl.deleteTexture(fbResample.tex); }
        fbResample = makeFBO(w,h);
      }
      if(!fbWork[0]) fbWork[0] = makeFBO(W,H);
      pass("resample",fbResample,src.tex);
      pass("resample",fbWork[0],fbResample.tex);
      pass("resampleMix",dst,src.tex,{uMix:u.uMix},fbWork[0].tex);
    }},
  { id:"wavelet", run(src, dst, u){
      if(u.uFine <= 0 && u.uCoarse <= 0){ pass("copy",dst,src.tex); return; }
      for(let i=0;i<3;i++) if(!fbWork[i]) fbWork[i]=makeFBO(W,H);
      pass("waveletBlur",fbWork[0],src.tex,{uDir:[1,0],uStride:1});
      pass("waveletBlur",fbWork[1],fbWork[0].tex,{uDir:[0,1],uStride:1});
      pass("waveletBlur",fbWork[0],fbWork[1].tex,{uDir:[1,0],uStride:2});
      pass("waveletBlur",fbWork[2],fbWork[0].tex,{uDir:[0,1],uStride:2});
      pass("waveletShrink",dst,src.tex,u,fbWork[1].tex,fbWork[2].tex);
    }},
  { id:"upsamp" },
  { id:"spectral", run(src, dst, u){
      if(u.uRadius <= 0.05){ pass("copy",dst,src.tex); return; }
      if(!fbWork[0]) fbWork[0] = makeFBO(W,H);
      pass("spectralH",fbWork[0],src.tex,{uRadius:u.uRadius});
      pass("spectralV",dst,fbWork[0].tex,{uRadius:u.uRadius});
    }},
  { id:"distort" }, { id:"dof" }, { id:"motion" }, { id:"ca" }, { id:"soft" }, { id:"vignette" },
  { id:"halation", run(src, dst, u){
      // Pirámide de tres niveles: un solo gaussiano deja un aura
      // pegada al borde, y la halación real tiene cola larga.
      pass("bright", fbHalf[0], src.tex, { uThresh: u.thresh });
      pass("blur",   fbHalf[1], fbHalf[0].tex, { uDir:[1,0], uRadius:u.radius });
      pass("blur",   fbHalf[0], fbHalf[1].tex, { uDir:[0,1], uRadius:u.radius });
      pass("copy",   fbQ[0],    fbHalf[0].tex);
      pass("blur",   fbQ[1],    fbQ[0].tex, { uDir:[1,0], uRadius:u.radius });
      pass("blur",   fbQ[0],    fbQ[1].tex, { uDir:[0,1], uRadius:u.radius });
      pass("copy",   fbE[0],    fbQ[0].tex);
      pass("blur",   fbE[1],    fbE[0].tex, { uDir:[1,0], uRadius:u.radius });
      pass("blur",   fbE[0],    fbE[1].tex, { uDir:[0,1], uRadius:u.radius });
      pass("addup",  fbQ[1],    fbQ[0].tex,    { uW:0.62 }, fbE[0].tex);
      pass("addup",  fbHalf[1], fbHalf[0].tex, { uW:0.62 }, fbQ[1].tex);
      pass("halate", dst, src.tex,
           { uStrength: u.uStrength * 0.62, uTint: u.uTint }, fbHalf[1].tex);
    }},
  { id:"flare", run(src, dst, u){
      // Recorte de brillo propio, en media resolución.
      pass("bright", fbHalf[0], src.tex, { uThresh: u.thresh });

      // Estela horizontal ancha (halo tipo anamórfico): dos pasadas
      // seguidas en el mismo eje, para que quede alargada y no redonda.
      pass("blur", fbHalf[1], fbHalf[0].tex, { uDir:[1,0], uRadius:u.streakR });
      pass("blur", fbQ[0],    fbHalf[1].tex, { uDir:[1,0], uRadius:u.streakR });
      pass("scale", fbQ[1], fbQ[0].tex, { uW: u.streakW });

      // Puntas de difracción: cuatro ejes angulares, sumados —el
      // patrón en estrella que deja el borde del diafragma sobre una
      // fuente muy intensa.
      pass("blur", fbHalf[1], fbHalf[0].tex, { uDir:[1.0,0.0],        uRadius:u.spikeR });
      pass("blur", fbQ[0],    fbHalf[0].tex, { uDir:[0.0,1.0],        uRadius:u.spikeR });
      pass("addup", fbE[0], fbHalf[1].tex, { uW:1.0 }, fbQ[0].tex);
      pass("blur", fbHalf[1], fbHalf[0].tex, { uDir:[0.7071,0.7071],  uRadius:u.spikeR });
      pass("addup", fbE[1], fbE[0].tex, { uW:1.0 }, fbHalf[1].tex);
      pass("blur", fbHalf[1], fbHalf[0].tex, { uDir:[0.7071,-0.7071], uRadius:u.spikeR });
      pass("addup", fbE[0], fbE[1].tex, { uW:1.0 }, fbHalf[1].tex);
      pass("scale", fbQ[0], fbE[0].tex, { uW: u.spikeW });

      // Fantasmas: el recorte de brillo espejado a través del centro.
      pass("flareGhosts", fbHalf[1], fbHalf[0].tex, { uGhosts: u.ghostsW });

      // Estela + puntas + fantasmas, y todo junto sobre la imagen.
      pass("addup", fbE[1], fbQ[1].tex, { uW:1.0 }, fbQ[0].tex);
      pass("addup", fbHalf[0], fbE[1].tex, { uW:1.0 }, fbHalf[1].tex);

      pass("flareComposite", dst, src.tex, { uTint: u.uTint }, fbHalf[0].tex);
    }},
  { id:"bayer" }, { id:"cfa" }, { id:"prnu" }, { id:"sensor" }, { id:"dust" }, { id:"clip" },
  // Siempre se ejecuta: es donde se codifica a sRGB.
  { id:"tone", always:true, neutral:{ uWb:[1,1,1], uExp:1, uS:0, uSat:0 } },
  { id:"grade" },
  { id:"detail", run(src, dst, u){
      // Media local muy suavizada, a resolución baja: dos bajadas de
      // resolución con un desenfoque separable completo en cada una,
      // que en conjunto equivalen a un radio enorme sobre la imagen a
      // resolución completa sin pagar su coste real.
      pass("copy", fbQ[0], src.tex);
      pass("blur", fbQ[1], fbQ[0].tex, { uDir:[1,0], uRadius: 30 });
      pass("blur", fbQ[0], fbQ[1].tex, { uDir:[0,1], uRadius: 30 });
      pass("blur", fbE[0], fbQ[0].tex, { uDir:[1,0], uRadius: 30 });
      pass("blur", fbE[1], fbE[0].tex, { uDir:[0,1], uRadius: 30 });
      pass("detail", dst, src.tex, u, fbE[1].tex);
    }},
  { id:"residual" },
  { id:"scratches" }, { id:"relief" }, { id:"warp" }, { id:"chroma" }, { id:"jpegtrace" }
];

export const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));

let cacheIdx = -1, cacheValid = false;
export function invalidateCache(){ cacheIdx = -1; cacheValid = false; }

function runChain(stages, dose, solo, from, upto){
  let cur, oth;
  if(from > 0 && cacheValid){
    pass("copy", fbFull[0], fbCache.tex);
    cur = fbFull[0]; oth = fbFull[1];
  } else {
    pass("input", fbFull[0], srcTex);
    cur = fbFull[0]; oth = fbFull[1];
    from = 0;
  }
  for(let i = from; i < upto; i++){
    const st = STEPS[i];
    const on = solo ? st.id === solo : stages[st.id].on;
    if(!st.always && !on) continue;
    const u = on ? uni(stages, st.id, dose) : (st.neutral || {});
    if(st.run) st.run(cur, oth, u);
    else pass(st.id, oth, cur.tex, u);
    const t = cur; cur = oth; oth = t;
  }
  return cur;
}

/* Congela todo lo anterior a la etapa k. Al arrastrar un deslizador,
   las etapas previas dan siempre el mismo resultado: se calculan una
   vez al empezar el gesto y cada movimiento reanuda desde ahí. En 4K
   con la cadena entera, la diferencia es de segundos a instantáneo. */
export function buildCache(stages, dose, solo, k){
  invalidateCache();
  if(!srcTex || k <= 0 || solo) return;
  const cur = runChain(stages, dose, solo, 0, k);
  pass("copy", fbCache, cur.tex);
  cacheIdx = k;
  cacheValid = true;
}

/* Sube el lienzo de origen a la GPU. */
export function setSource(canvas){
  ensure();
  if(!gl || initError) return false;
  sourceCanvas = canvas;
  invalidateCache();
  const w = canvas.width, h = canvas.height;
  if(!srcTex) srcTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if(w !== W || h !== H){
    W = w; H = h;
    glCanvas.width = w; glCanvas.height = h;
    allocate(w, h);
  }
  return true;
}

/* Ejecuta la cadena y vuelca el resultado en el contexto 2D dado. */
export function renderTo(ctx2d, stages, { dose = 1, solo = null, stable = false } = {}){
  if(!gl || initError || !srcTex) return 0;
  const t0 = performance.now();
  if(dose <= 0 || !STEPS.some(s => solo ? s.id === solo : stages[s.id]?.on)){
    ctx2d.save();
    ctx2d.setTransform(1,0,0,1,0,0);
    ctx2d.globalAlpha=1; ctx2d.globalCompositeOperation="copy";
    ctx2d.drawImage(sourceCanvas,0,0,ctx2d.canvas.width,ctx2d.canvas.height);
    ctx2d.restore();
    return performance.now()-t0;
  }
  const from = (cacheValid && cacheIdx > 0) ? cacheIdx : 0;
  const cur = runChain(stages, dose, solo, from, STEPS.length);
  pass(premium ? "outDither" : "copy", null, cur.tex);
  if(stable && ctx2d.canvas.width===W && ctx2d.canvas.height===H){
    // La lectura explícita fija los bytes antes de medir/exportar; evita
    // diferencias de redondeo entre superficies Canvas aceleradas y de CPU.
    const pixels=new Uint8Array(W*H*4),data=ctx2d.createImageData(W,H);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    for(let row=0;row<H;row++)data.data.set(pixels.subarray(row*W*4,(row+1)*W*4),(H-1-row)*W*4);
    ctx2d.putImageData(data,0,0);
    return performance.now()-t0;
  }
  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.globalAlpha = 1;
  ctx2d.globalCompositeOperation = "copy";
  ctx2d.drawImage(glCanvas, 0, 0, ctx2d.canvas.width, ctx2d.canvas.height);
  ctx2d.globalCompositeOperation = "source-over";
  return performance.now() - t0;
}

/* ── etapa de CPU: ida y vuelta real por el códec ────────────── */
export function jpegRoundTrip(canvas, quality, gens){
  return new Promise(resolve => {
    let n = 0;
    const step = () => {
      if(n >= gens) return resolve();
      canvas.toBlob(blob => {
        if(!blob) return resolve();
        const url = URL.createObjectURL(blob);
        const im = new Image();
        im.onload = () => {
          const c = canvas.getContext("2d");
          c.globalCompositeOperation = "copy";
          c.drawImage(im, 0, 0);
          c.globalCompositeOperation = "source-over";
          URL.revokeObjectURL(url);
          n++; step();
        };
        im.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        im.src = url;
      }, "image/jpeg", quality);
    };
    step();
  });
}

export async function applyJpeg(canvas, stages, dose = 1){
  if(dose <= 0 || !stages.jpeg || !stages.jpeg.on) return;
  const p = effParams(stages, "jpeg", dose);
  const q = 0.30 + N(p.q) * 0.69;
  const gens = Math.max(1, Math.round(1 + N(p.gens) * 7));
  await jpegRoundTrip(canvas, q, gens);
}

export const jpegQuality = (stages, dose = 1) =>
  0.30 + N(effParams(stages, "jpeg", dose).q) * 0.69;

/* Diagnóstico: compila cada shader por separado para poder decir
   cuál falla en vez de un «algo ha ido mal». */
export function diagnose(){
  ensure();
  const out = { webgl2: !!gl, float: floatOK, error: initError, shaders: {}, renderer: null };
  if(!gl) return out;
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  if(dbg) out.renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
  out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  for(const k in SH){
    try{ gl.deleteProgram(program(SH[k])); out.shaders[k] = true; }
    catch(err){ out.shaders[k] = String(err.message || err); }
  }
  return out;
}
