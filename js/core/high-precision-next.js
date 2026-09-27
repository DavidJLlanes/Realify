/*
 * Motor de exportación lineal seguro.
 *
 * Se mantiene intencionadamente separado del compositor experimental: este
 * archivo sólo participa al exportar y no puede impedir que el editor cargue.
 * Convierte el compuesto actual de sRGB a RGB lineal Float32, remuestrea en
 * esa superficie y vuelve a codificar sRGB. Las capas y filtros que todavía
 * se calculan en Canvas conservan su resultado antes de entrar aquí.
 */

const MAX_PIXELS = 8_000_000;
const srgbToLinear = v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
const linearToSrgb = v => {
  v = Math.max(0, Math.min(1, v));
  return v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055;
};

function dimensions(a, b){
  if(Number.isFinite(a) && Number.isFinite(b)) return { w:Math.round(a), h:Math.round(b) };
  const pixels = Math.max(1, Math.round(a || 0));
  return { w:pixels, h:1 };
}

export function highPrecisionCapabilities(){
  return {
    usable: typeof document !== "undefined",
    wasm: typeof WebAssembly !== "undefined",
    webgpu: !!globalThis.navigator?.gpu,
    maxPixels: MAX_PIXELS,
    spatialMaxPixels: 0,
    spatialDualMaxPixels: 0,
    reason: "Exportación RGB lineal Float32; los filtros no migrados conservan la composición compatible."
  };
}

export function highPrecisionAvailableFor(a, b){
  const { w, h } = dimensions(a, b);
  if(typeof document === "undefined") return { ok:false, reason:"El motor Float32 sólo está disponible en el navegador." };
  if(!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return { ok:false, reason:"Tamaño de exportación no válido." };
  if(w * h > MAX_PIXELS) return { ok:false, reason:`La exportación Float32 está limitada a ${Math.floor(MAX_PIXELS / 1e6)} MP para proteger la memoria del dispositivo.` };
  return { ok:true, reason:"RGB lineal Float32 para el remuestreo final." };
}

function makeCanvas(w, h){
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  return out;
}

/* Ruido de tramado determinista en [-0.5, 0.5): mismo píxel, mismo
 * valor, así dos exportaciones iguales dan el mismo archivo. Con esa
 * amplitud un valor que ya era un nivel exacto de 8 bits NO cambia —el
 * tramado sólo reparte los que caen ENTRE dos niveles, que es de donde
 * salen las bandas en cielos y degradados—. */
function ditherNoise(x, y, c){
  let n = (Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77) ^ Math.imul(c + 1, 0xc2b2ae35)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296 - 0.5;
}

/* Muestreo bilineal en espacio lineal y alfa premultiplicado. Es menos
 * espectacular que un filtro espacial experimental, pero evita halos de
 * gamma y bordes oscuros al cambiar tamaño, que es lo importante en salida.
 * `options.dither`: tramado al volver a 8 bits (ver `ditherNoise`). */
export function renderHighPrecisionCanvas(source, requestedW, requestedH, options = {}){
  const dither = !!options.dither;
  if(!source?.width || !source?.height) return { canvas:null, mode:"compatible", reason:"No hay un lienzo compuesto para exportar." };
  const w = Math.max(1, Math.round(requestedW || source.width));
  const h = Math.max(1, Math.round(requestedH || source.height));
  const available = highPrecisionAvailableFor(w, h);
  if(!available.ok) return { canvas:null, mode:"compatible", reason:available.reason };
  try{
    const input = makeCanvas(source.width, source.height);
    const ictx = input.getContext("2d", { willReadFrequently:true, colorSpace:"srgb" });
    ictx.drawImage(source, 0, 0);
    const src = ictx.getImageData(0, 0, input.width, input.height).data;
    const pixels = input.width * input.height;
    const linear = new Float32Array(pixels * 4);
    for(let p = 0, i = 0; p < pixels; p++, i += 4){
      const a = src[i + 3] / 255;
      linear[i] = srgbToLinear(src[i] / 255) * a;
      linear[i + 1] = srgbToLinear(src[i + 1] / 255) * a;
      linear[i + 2] = srgbToLinear(src[i + 2] / 255) * a;
      linear[i + 3] = a;
    }
    const out = makeCanvas(w, h), octx = out.getContext("2d", { colorSpace:"srgb" });
    const image = octx.createImageData(w, h), dst = image.data;
    const sx = input.width / w, sy = input.height / h;
    for(let y = 0, d = 0; y < h; y++){
      const fy = (y + .5) * sy - .5, y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(input.height - 1, y0 + 1), wy = fy - Math.floor(fy);
      for(let x = 0; x < w; x++, d += 4){
        const fx = (x + .5) * sx - .5, x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(input.width - 1, x0 + 1), wx = fx - Math.floor(fx);
        const i00 = (y0 * input.width + x0) * 4, i10 = (y0 * input.width + x1) * 4;
        const i01 = (y1 * input.width + x0) * 4, i11 = (y1 * input.width + x1) * 4;
        const mix = c => (linear[i00 + c] * (1 - wx) + linear[i10 + c] * wx) * (1 - wy) + (linear[i01 + c] * (1 - wx) + linear[i11 + c] * wx) * wy;
        const a = mix(3);
        dst[d + 3] = Math.round(a * 255);
        for(let c = 0; c < 3; c++){
          const v = linearToSrgb(a > 1e-6 ? mix(c) / a : 0) * 255;
          dst[d + c] = Math.round(dither ? v + ditherNoise(x, y, c) : v);
        }
      }
    }
    octx.putImageData(image, 0, 0);
    return { canvas:out, mode:"high-precision", reason:"Compuesto remuestreado en RGB lineal Float32" + (dither ? " con tramado a 8 bits." : ".") };
  }catch(error){
    return { canvas:null, mode:"compatible", reason:`No se pudo reservar la superficie Float32: ${error?.message || "memoria insuficiente"}.` };
  }
}

/* La pila de ajustes aún no se interpreta aquí: devolver null hace que la
 * exportación entregue el compuesto real al motor Float32 de arriba. */
export function renderPrecisionAdjustmentStack(){ return null; }
