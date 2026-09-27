/* ═══════════════════════════════════════════════════════════════
   VIBRANCE
   Distinto de Tono y saturación: aquí el empuje es más fuerte cuanto
   MENOS saturado está ya el color, así que los colores apagados
   ganan vida sin que los que ya son muy vivos se quemen a un solo
   tono plano. También se atenúa un poco en la franja de matices de
   piel, para poder subir el conjunto de una foto con gente sin que
   las caras se vean anaranjadas. «Saturación», debajo, es el empuje
   llano de siempre —igual para todos los colores—, como una segunda
   pasada independiente del ajuste Tono y saturación.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider, pickerGroup } from "./adjust.js";
import { rgbToHsl, hslToRgb } from "./adjustments.js";

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));

export function vibrance(opts = {}){
  const p = { vibrance: 0, saturation: 0, ...opts.init };

  return runAdjust({
    title: "Vibrance",
    asLayer: true, filterId: "vibrance", filterParams: p,
    previewLimit: 6e5,
    compute(data){
      const vib = p.vibrance / 100, sat = p.saturation / 100;
      if(!vib && !sat) return;
      for(let i = 0; i < data.length; i += 4){
        let [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
        if(vib){
          const skinProtect = 1 - 0.5 * bell(h * 360, 25, 20);
          const boost = vib * (1 - s) * skinProtect;
          s = clamp01(s * (1 + boost));
        }
        if(sat) s = clamp01(s * (1 + sat));
        const [r, g, b] = hslToRgb(h, s, l);
        data[i] = r; data[i+1] = g; data[i+2] = b;
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.appendChild(pickerGroup([
        { label: "Vibrance", node: slider("Vibrance", -100, 100, p.vibrance, v => { p.vibrance = v; preview(); }) },
        { label: "Saturación", node: slider("Saturación", -100, 100, p.saturation, v => { p.saturation = v; preview(); }) }
      ]));
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.style.marginTop = "10px";
      hint.textContent = "Vibrance satura más los colores apagados y protege los que ya " +
        "son vivos —y, en parte, los tonos de piel—. Saturación sube todo por igual.";
      box.appendChild(hint);
      return box;
    }
  }, opts);
}
