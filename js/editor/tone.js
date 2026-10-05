/* ═══════════════════════════════════════════════════════════════
   TONOS POR ZONA
   Los cuatro mandos clásicos de cualquier revelador (Blancos, Altas
   luces, Sombras, Negros): cada uno actúa sólo sobre una franja de
   luminancia, con una caída suave hacia las vecinas para que no se
   note el punto donde una zona termina y la siguiente empieza. El
   color se conserva escalando los tres canales por igual —la misma
   idea que ya usa el tono y saturación—, así que subir las sombras
   las aclara sin decolorarlas.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, applyLut, slider, pickerGroup } from "./adjust.js";

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* Cuatro campanas centradas en 0 (negros), 0.32 (sombras), 0.68
   (altas luces) y 1 (blancos), con solape amplio para que el efecto
   de un mando se note en zonas vecinas, como en cualquier revelador:
   nadie espera que «Blancos» deje intactos los grises claros. */
function weights(l){
  const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  return {
    blacks:     bell(l, 0.00, 0.22),
    shadows:    bell(l, 0.30, 0.24),
    highlights: bell(l, 0.70, 0.24),
    whites:     bell(l, 1.00, 0.22)
  };
}

function buildToneLut(p){
  const t = new Uint8ClampedArray(256);
  const k = { blacks: p.blacks/100, shadows: p.shadows/100,
              highlights: p.highlights/100, whites: p.whites/100 };
  for(let i = 0; i < 256; i++){
    const l = i / 255;
    const w = weights(l);
    const delta = k.blacks * w.blacks + k.shadows * w.shadows +
                  k.highlights * w.highlights + k.whites * w.whites;
    // Aclarar tira hacia 1, oscurecer hacia 0: sumar directamente
    // quemaría las luces y ensuciaría las sombras con negros sucios.
    const nl = delta >= 0 ? l + (1 - l) * delta * 0.7 : l * (1 + delta * 0.7);
    t[i] = Math.round(clamp01(nl) * 255);
  }
  /* Las campanas se solapan y cada una decae después de su pico; con
     dos mandos opuestos cerca uno del otro, esa caída puede ganarle
     terreno al avance de i y la curva retrocede un instante, un
     escalón hacia atrás que en la imagen se ve como una banda. Se
     fuerza que nunca baje: es la misma «regresión isotónica» barata
     que usa cualquier revelador serio para esta clase de curvas. */
  for(let i = 1; i < 256; i++) if(t[i] < t[i-1]) t[i] = t[i-1];
  return t;
}

export function toneRegions(opts = {}){
  const p = { blacks: 0, shadows: 0, highlights: 0, whites: 0, ...opts.init };

  return runAdjust({
    title: "Tonos",
    asLayer: true, filterId: "tone", filterParams: p, float: true,
    compute(data){
      const lut = buildToneLut(p);
      // Se aplica sobre la luminancia y se reparte a los tres canales
      // en la misma proporción, para no desplazar el color.
      for(let i = 0; i < data.length; i += 4){
        const r = data[i], g = data[i+1], b = data[i+2];
        const l = (r*0.2126 + g*0.7152 + b*0.0722) / 255;
        const nl = lut[Math.round(l*255)] / 255;
        const scale = l > 0.002 ? nl / l : (nl > 0 ? 1 : 0);
        data[i]   = Math.max(0, Math.min(255, r * scale));
        data[i+1] = Math.max(0, Math.min(255, g * scale));
        data[i+2] = Math.max(0, Math.min(255, b * scale));
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.appendChild(pickerGroup([
        { label: "Blancos", node: slider("Blancos", -100, 100, p.whites, v => { p.whites = v; preview(); }) },
        { label: "Altas luces", node: slider("Altas luces", -100, 100, p.highlights, v => { p.highlights = v; preview(); }) },
        { label: "Sombras", node: slider("Sombras", -100, 100, p.shadows, v => { p.shadows = v; preview(); }) },
        { label: "Negros", node: slider("Negros", -100, 100, p.blacks, v => { p.blacks = v; preview(); }) }
      ]));
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.style.marginTop = "10px";
      hint.textContent = "Cada mando pesa más en su franja de luminancia y se " +
        "desvanece hacia las vecinas, para que el retoque no se note como un " +
        "escalón. El color se conserva: sólo cambia el brillo.";
      box.appendChild(hint);
      return box;
    }
  }, opts);
}
