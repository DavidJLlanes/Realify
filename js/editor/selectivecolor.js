/* ═══════════════════════════════════════════════════════════════
   CORRECCIÓN SELECTIVA DE COLOR
   Nueve rangos —seis de matiz (rojos, amarillos, verdes, cianes,
   azules, magentas) y tres de brillo (blancos, neutros, negros)—,
   cada uno con sus cuatro tintas C/M/Y/K. «Método relativo»: subir
   el cian de un píxel lo acerca a su complementario en proporción a
   lo que le queda de camino, así que un rojo casi puro no se puede
   sobre-cianar hasta volverse gris de golpe. Es el panel que hace
   falta para, por ejemplo, virar sólo el cielo azul sin tocar la
   piel ni la ropa.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider } from "./adjust.js";
import { rgbToHsl } from "./adjustments.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));

const HUE_RANGES = [
  ["reds",     "Rojos",    0],
  ["yellows",  "Amarillos", 60],
  ["greens",   "Verdes",   120],
  ["cyans",    "Cianes",   180],
  ["blues",    "Azules",   240],
  ["magentas", "Magentas", 300]
];
const TONE_RANGES = [["whites", "Blancos"], ["neutrals", "Neutros"], ["blacks", "Negros"]];
const ALL_RANGES = [...HUE_RANGES.map(([k, n]) => [k, n]), ...TONE_RANGES];

function hueDist(a, b){ const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
const SAT_MIN = 0.05, SAT_FULL = 0.30;
function satInfluence(s){
  if(s <= SAT_MIN) return 0;
  if(s >= SAT_FULL) return 1;
  const t = (s - SAT_MIN) / (SAT_FULL - SAT_MIN);
  return t * t * (3 - 2 * t);
}

// «Relativo»: acerca el valor a su destino (0 si sube la tinta, 255 si baja)
// en proporción a lo que le queda de camino hasta ahí.
function relAdjust(value, amt){
  const a = amt / 100;
  return a >= 0 ? value - value * a : value + (255 - value) * (-a);
}

function defaultRanges(){
  const o = {};
  for(const [key] of ALL_RANGES) o[key] = { c: 0, m: 0, y: 0, k: 0 };
  return o;
}

export function selectiveColor(opts = {}){
  const ranges = defaultRanges();
  if(opts.init) for(const [key] of ALL_RANGES) if(opts.init[key]) Object.assign(ranges[key], opts.init[key]);
  const state = { current: "reds" };

  return runAdjust({
    title: "Corrección selectiva",
    wide: true,
    asLayer: true, filterId: "selectiveColor", filterParams: ranges, float: true,
    previewLimit: 6e5,
    compute(data){
      let any = false;
      for(const [key] of ALL_RANGES){ const r = ranges[key]; if(r.c || r.m || r.y || r.k){ any = true; break; } }
      if(!any) return;

      for(let i = 0; i < data.length; i += 4){
        const r = data[i], g = data[i+1], b = data[i+2];
        const [h, s, l] = rgbToHsl(r, g, b);
        const hueDeg = h * 360;
        const satInf = satInfluence(s);

        let totalC = 0, totalM = 0, totalY = 0, totalK = 0;

        if(satInf > 0){
          for(const [key, , center] of HUE_RANGES){
            const w = Math.max(0, 1 - hueDist(hueDeg, center) / 60) * satInf;
            if(w <= 0) continue;
            const rg = ranges[key];
            totalC += w * rg.c; totalM += w * rg.m; totalY += w * rg.y; totalK += w * rg.k;
          }
        }
        // Los rangos de brillo actúan sólo por luminosidad, sin mirar matiz ni saturación.
        const wWhite = bell(l, 1.00, 0.25), wBlack = bell(l, 0.00, 0.25), wNeutral = bell(l, 0.50, 0.32);
        for(const [key, w] of [["whites", wWhite], ["neutrals", wNeutral], ["blacks", wBlack]]){
          if(w <= 0.001) continue;
          const rg = ranges[key];
          totalC += w * rg.c; totalM += w * rg.m; totalY += w * rg.y; totalK += w * rg.k;
        }

        if(!totalC && !totalM && !totalY && !totalK) continue;

        let nr = relAdjust(r, totalC), ng = relAdjust(g, totalM), nb = relAdjust(b, totalY);
        if(totalK){ nr = relAdjust(nr, totalK); ng = relAdjust(ng, totalK); nb = relAdjust(nb, totalK); }
        data[i] = clamp255(nr); data[i+1] = clamp255(ng); data[i+2] = clamp255(nb);
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="seg" id="scTabs" style="flex-wrap:wrap;height:auto"></div>
        <div id="scSliders" style="margin-top:10px"></div>
        <p class="hint" style="margin-top:10px">Método relativo: subir una tinta acerca
          el color a su opuesto en proporción a lo que le queda de camino, así que un
          color muy puro nunca se cianota de golpe. Cada rango se desvanece hacia sus
          vecinos, igual que en Color por canales.</p>`;

      const tabs = box.querySelector("#scTabs");
      const sliderHost = box.querySelector("#scSliders");

      for(const [key, name] of ALL_RANGES){
        const b = document.createElement("button");
        b.textContent = name;
        b.className = key === state.current ? "on" : "";
        b.style.flex = "1 1 auto";
        b.addEventListener("click", () => {
          state.current = key;
          tabs.querySelectorAll("button").forEach(x => x.classList.remove("on"));
          b.classList.add("on");
          renderSliders();
        });
        tabs.appendChild(b);
      }

      function renderSliders(){
        sliderHost.innerHTML = "";
        const rg = ranges[state.current];
        sliderHost.append(
          slider("Cian",    -100, 100, rg.c, v => { rg.c = v; preview(); }, "%"),
          slider("Magenta", -100, 100, rg.m, v => { rg.m = v; preview(); }, "%"),
          slider("Amarillo",-100, 100, rg.y, v => { rg.y = v; preview(); }, "%"),
          slider("Negro",   -100, 100, rg.k, v => { rg.k = v; preview(); }, "%")
        );
      }
      renderSliders();

      return box;
    }
  }, opts);
}
