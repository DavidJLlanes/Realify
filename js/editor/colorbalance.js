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
import { applyColorMap, toLab, toRgb, DEC } from "./premiumcolor.js";
import { premiumSwitch, premiumPref } from "../ui/premium.js";
import { isMobile } from "../core/device.js";
import { doc } from "../core/doc.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));

function zoneWeights(l){
  return { shadows: bell(l, 0.00, 0.35), midtones: bell(l, 0.50, 0.30), highlights: bell(l, 1.00, 0.35) };
}

const ZONES = [["shadows", "Sombras"], ["midtones", "Medios"], ["highlights", "Iluminaciones"]];
const defaultZone = () => ({ cr: 0, mg: 0, yb: 0 });
const AMOUNT = 0.6;   // el efecto pleno de un mando a fondo (100) sería demasiado brusco

/* ── Premium 👑 ──
   Mismos mandos, otro motor (premiumcolor.js):
     · Las zonas se reparten por la luminosidad PERCIBIDA (L de OKLab),
       no por el valor codificado: la frontera entre sombras y medios cae
       donde la vista la pone.
     · Cada mando empuja el color hacia su primario en el plano de color
       de OKLab (rojo 29°, verde 142°, azul 264°, y sus opuestos), en
       vez de sumar niveles a un canal: el tinte no cambia la luminosidad
       y no se tuerce hacia otro tono al saturar.
     · «Conservar la luminosidad» es exacta (L no se toca); sin ella, la
       luminosidad cambia lo mismo que en el modo normal.
     · Mapeo de gama y tramado: los negros profundos y los blancos no se
       manchan de color recortado y no aparecen bandas.
   Calibrado para que un mando a fondo empuje lo mismo que en el modo
   normal (0,075 de croma OKLab en los medios). */
const PRIM = { cr: 29.2, mg: 142.5, yb: -95.9 };   // tono OKLab de los primarios sRGB
const DIR = Object.fromEntries(Object.entries(PRIM).map(([k, h]) => [k, [Math.cos(h * Math.PI / 180), Math.sin(h * Math.PI / 180)]]));
const CHROMA_PER = 0.075 / 100, LUM_PER = 0.287 / 100;
export function colorBalancePremium(data, p, { fast = false } = {}){
  const any = ZONES.some(([k]) => p[k].cr || p[k].mg || p[k].yb);
  if(!any) return;
  const lab = [0, 0, 0];
  applyColorMap(data, (R, G, B, rgb) => {
    toLab(DEC[R], DEC[G], DEC[B], lab);
    let L = lab[0], a = lab[1], b = lab[2];
    const w = zoneWeights(L < 0 ? 0 : L > 1 ? 1 : L);
    let da = 0, db = 0, dL = 0;
    for(const [key] of ZONES){
      const wz = w[key], z = p[key];
      if(wz <= 1e-4 || (!z.cr && !z.mg && !z.yb)) continue;
      for(const ax of ["cr", "mg", "yb"]){
        const v = z[ax]; if(!v) continue;
        da += wz * v * CHROMA_PER * DIR[ax][0];
        db += wz * v * CHROMA_PER * DIR[ax][1];
      }
      if(!p.preserveLum) dL += wz * (0.2126 * z.cr + 0.7152 * z.mg + 0.0722 * z.yb) * LUM_PER;
    }
    a += da; b += db; L += dL;
    toRgb(L, a, b, rgb);
    const Lc = L < 0 ? 0 : L > 1 ? 1 : L;
    return Lc * Lc * Lc;
  }, { fast });
}

export function colorBalance(opts = {}){
  const p = { shadows: defaultZone(), midtones: defaultZone(), highlights: defaultZone(),
              preserveLum: true, premium: opts.init ? false : premiumPref.get("colorBalance") };
  if(opts.init){
    for(const [k] of ZONES) if(opts.init[k]) Object.assign(p[k], opts.init[k]);
    if(typeof opts.init.preserveLum === "boolean") p.preserveLum = opts.init.preserveLum;
    p.premium = !!opts.init.premium;   // una capa ya hecha conserva su motor
  }
  const state = { current: "midtones" };

  return runAdjust({
    title: "Equilibrio de color",
    wide: true,
    asLayer: true, filterId: "colorBalance", filterParams: p, float: true,
    previewLimit: 6e5,
    compute(data, w, h, hint){
      // `hint.grid`: se evalúa en la rejilla de colores de la coma flotante (editor/floatadjust.js): nunca el atajo «rápido» de la vista previa
      if(p.premium){ colorBalancePremium(data, p, { fast: !hint?.grid && w * h < doc.w * doc.h * 0.98 }); return; }
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

      // Premium 👑: móvil → barra de Cancelar/Aplicar, a la izquierda
      const sw = premiumSwitch({ checked: p.premium, title: "Equilibrio de color de alta calidad: tintes en OKLab, luminosidad exacta, mapeo de gama y tramado (función Premium)",
        onChange: on => { p.premium = on; premiumPref.set("colorBalance", on); preview(); } });
      sw.classList.add("adj-premium");
      if(isMobile()){ sw.classList.add("ps-docked"); box.footStart = sw; } else box.prepend(sw);

      return box;
    }
  }, opts);
}
