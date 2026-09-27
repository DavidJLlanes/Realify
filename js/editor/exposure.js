/* ═══════════════════════════════════════════════════════════════
   EXPOSICIÓN
   A diferencia de Brillo y contraste, que trabaja directamente sobre
   los valores sRGB de pantalla, esto simula lo que hace una cámara:
   la luz se mide y se multiplica en espacio LINEAL —donde doblar la
   exposición es, de verdad, doblar la cantidad de luz—, y sólo al
   final se convierte de vuelta a sRGB para mostrarla. Por eso
   Exposición +1 se ve distinto de Brillo +50: aquí un paso completo
   dobla la luz en toda la imagen por igual, no aclara más las medias
   luces que las sombras.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, applyLut, slider, pickerGroup } from "./adjust.js";

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

function srgbToLinear(c){ return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgb(c){ return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

function buildExposureLut(p){
  const t = new Uint8ClampedArray(256);
  const mul = Math.pow(2, p.exposure);
  const invGamma = 1 / p.gamma;
  for(let i = 0; i < 256; i++){
    let lin = srgbToLinear(i / 255);
    lin = Math.max(0, lin * mul + p.offset);
    lin = Math.pow(lin, invGamma);
    t[i] = Math.round(clamp01(linearToSrgb(clamp01(lin))) * 255);
  }
  return t;
}

export function exposure(opts = {}){
  const p = { exposure: 0, offset: 0, gamma: 1, ...opts.init };

  return runAdjust({
    title: "Exposición",
    asLayer: true, filterId: "exposure", filterParams: p,
    compute(data){
      const lut = buildExposureLut(p);
      applyLut(data, { r: lut, g: lut, b: lut });
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.appendChild(pickerGroup([
        { label: "Exposición", node: slider("Exposición", -5, 5, p.exposure, v => { p.exposure = v; preview(); }, " EV", 0.05) },
        { label: "Desplazamiento", node: slider("Desplazamiento", -0.5, 0.5, p.offset, v => { p.offset = v; preview(); }, "", 0.01) },
        { label: "Gamma", node: slider("Gamma", 0.1, 3, p.gamma, v => { p.gamma = v; preview(); }, "", 0.01) }
      ]));
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.style.marginTop = "10px";
      hint.textContent = "La exposición multiplica la luz en espacio lineal —cada paso " +
        "completo dobla o parte por dos la cantidad de luz, como en una cámara—. El " +
        "desplazamiento suma un empujón fijo, más visible en sombras. La gamma curva " +
        "el resultado: por debajo de 1 oscurece las medias luces, por encima las aclara.";
      box.appendChild(hint);
      return box;
    }
  }, opts);
}
