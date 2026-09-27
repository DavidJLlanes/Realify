/* ═══════════════════════════════════════════════════════════════
   EQUILIBRIO DE COLOR
   Tres zonas de luminancia —Sombras, Medios, Iluminaciones—, cada
   una con sus tres mandos clásicos en los extremos opuestos del
   círculo cromático: Cian-Rojo, Magenta-Verde, Amarillo-Azul. Cada
   píxel reparte el efecto entre zonas vecinas según su propio brillo
   —la misma idea de campana que ya usa «Tonos»—, así que corregir
   sólo las sombras de una foto no deja un escalón donde empiezan las
   medias luces.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider } from "./adjust.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));

function zoneWeights(l){
  return { shadows: bell(l, 0.00, 0.35), midtones: bell(l, 0.50, 0.30), highlights: bell(l, 1.00, 0.35) };
}

const ZONES = [["shadows", "Sombras"], ["midtones", "Medios"], ["highlights", "Iluminaciones"]];
const defaultZone = () => ({ cr: 0, mg: 0, yb: 0 });
const AMOUNT = 0.6;   // el efecto pleno de un mando a fondo (100) sería demasiado brusco

export function colorBalance(opts = {}){
  const p = { shadows: defaultZone(), midtones: defaultZone(), highlights: defaultZone(),
              preserveLum: true };
  if(opts.init){
    for(const [k] of ZONES) if(opts.init[k]) Object.assign(p[k], opts.init[k]);
    if(typeof opts.init.preserveLum === "boolean") p.preserveLum = opts.init.preserveLum;
  }
  const state = { current: "midtones" };

  return runAdjust({
    title: "Equilibrio de color",
    wide: true,
    asLayer: true, filterId: "colorBalance", filterParams: p,
    compute(data){
      for(let i = 0; i < data.length; i += 4){
        const r = data[i], g = data[i+1], b = data[i+2];
        const l = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
        const w = zoneWeights(l);
        let dr = 0, dg = 0, db = 0;
        for(const [key] of ZONES){
          const wz = w[key];
          if(wz <= 0) continue;
          const z = p[key];
          dr += wz * z.cr * AMOUNT;
          dg += wz * z.mg * AMOUNT;
          db += wz * z.yb * AMOUNT;
        }
        if(!dr && !dg && !db) continue;
        let nr = r + dr, ng = g + dg, nb = b + db;
        if(p.preserveLum){
          const diff = l * 255 - (nr * 0.2126 + ng * 0.7152 + nb * 0.0722);
          nr += diff; ng += diff; nb += diff;
        }
        data[i] = clamp255(nr); data[i+1] = clamp255(ng); data[i+2] = clamp255(nb);
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="seg" id="cbalTabs" style="flex-wrap:wrap;height:auto"></div>
        <div id="cbalSliders" style="margin-top:10px"></div>
        <label class="field" style="display:flex;align-items:center;gap:8px;margin-top:10px">
          <input type="checkbox" id="cbalLum" ${p.preserveLum ? "checked" : ""}>
          <span>Conservar la luminosidad</span>
        </label>
        <p class="hint" style="margin-top:10px">Cada zona se desvanece hacia las
          vecinas, para que el retoque no se note como un escalón entre sombras y
          medios. Conservar la luminosidad evita que el tinte aclare u oscurezca
          la foto de paso.</p>`;

      const tabs = box.querySelector("#cbalTabs");
      const sliderHost = box.querySelector("#cbalSliders");

      for(const [key, name] of ZONES){
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
        const z = p[state.current];
        sliderHost.append(
          slider("Cian — Rojo",    -100, 100, z.cr, v => { z.cr = v; preview(); }),
          slider("Magenta — Verde", -100, 100, z.mg, v => { z.mg = v; preview(); }),
          slider("Amarillo — Azul", -100, 100, z.yb, v => { z.yb = v; preview(); })
        );
      }
      renderSliders();

      box.querySelector("#cbalLum").addEventListener("change", e => { p.preserveLum = e.target.checked; preview(); });

      return box;
    }
  }, opts);
}
