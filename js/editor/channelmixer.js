/* ═══════════════════════════════════════════════════════════════
   MEZCLADOR DE CANALES
   Cada canal de salida es una mezcla de los tres de entrada, no sólo
   de sí mismo: el Rojo de salida puede llevar también algo de Verde
   y de Azul. Con esto se resuelven cosas que Tono y saturación no
   puede —un cielo azul que se oscurece sin tocar el resto, un blanco
   y negro con el contraste exacto de un filtro de cámara de verdad—
   porque aquí se decide con qué proporción entra cada canal
   original, no cómo se retoca cada uno por separado.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider } from "./adjust.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

function defaultMixer(){
  return {
    mono: false,
    red:   { r: 100, g: 0, b: 0, k: 0 },
    green: { r: 0, g: 100, b: 0, k: 0 },
    blue:  { r: 0, g: 0, b: 100, k: 0 },
    gray:  { r: 40, g: 40, b: 20, k: 0 }
  };
}

export function channelMixer(opts = {}){
  const p = defaultMixer();
  if(opts.init){
    p.mono = !!opts.init.mono;
    for(const k of ["red", "green", "blue", "gray"]) if(opts.init[k]) Object.assign(p[k], opts.init[k]);
  }
  const state = { current: "red" };

  return runAdjust({
    title: "Mezclador de canales",
    wide: true,
    asLayer: true, filterId: "channelMixer", filterParams: p,
    float: true,
    compute(data){
      if(p.mono){
        const m = p.gray;
        for(let i = 0; i < data.length; i += 4){
          const v = clamp255((data[i] * m.r + data[i+1] * m.g + data[i+2] * m.b) / 100 + m.k * 2.55);
          data[i] = v; data[i+1] = v; data[i+2] = v;
        }
        return;
      }
      const R = p.red, G = p.green, B = p.blue;
      for(let i = 0; i < data.length; i += 4){
        const r = data[i], g = data[i+1], b = data[i+2];
        data[i]   = clamp255((r * R.r + g * R.g + b * R.b) / 100 + R.k * 2.55);
        data[i+1] = clamp255((r * G.r + g * G.g + b * G.b) / 100 + G.k * 2.55);
        data[i+2] = clamp255((r * B.r + g * B.g + b * B.b) / 100 + B.k * 2.55);
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <label class="field" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="cmMono" ${p.mono ? "checked" : ""}>
          <span>Monocromo (una sola salida, repartida a los tres canales)</span>
        </label>
        <div class="seg" id="cmTabs" style="flex-wrap:wrap;height:auto;margin-top:8px"></div>
        <div id="cmSliders" style="margin-top:10px"></div>
        <p class="hint" style="margin-top:10px">Cada mando es el tanto por ciento del
          canal de entrada que entra en el de salida elegido arriba; puede pasar de 100
          o de -100. «Constante» añade o quita brillo plano después de la mezcla.</p>`;

      const monoBox = box.querySelector("#cmMono");
      const tabs = box.querySelector("#cmTabs");
      const sliderHost = box.querySelector("#cmSliders");

      monoBox.addEventListener("change", () => { p.mono = monoBox.checked; renderTabs(); preview(); });

      function renderTabs(){
        tabs.innerHTML = "";
        const items = p.mono ? [["gray", "Monocromo"]]
                              : [["red", "Rojo"], ["green", "Verde"], ["blue", "Azul"]];
        if(!items.find(([k]) => k === state.current)) state.current = items[0][0];
        for(const [key, name] of items){
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
        renderSliders();
      }

      function renderSliders(){
        sliderHost.innerHTML = "";
        const ch = p[state.current];
        sliderHost.append(
          slider("Rojo de entrada",   -200, 200, ch.r, v => { ch.r = v; preview(); }, "%"),
          slider("Verde de entrada",  -200, 200, ch.g, v => { ch.g = v; preview(); }, "%"),
          slider("Azul de entrada",   -200, 200, ch.b, v => { ch.b = v; preview(); }, "%"),
          slider("Constante",         -100, 100, ch.k, v => { ch.k = v; preview(); })
        );
      }

      renderTabs();
      return box;
    }
  }, opts);
}
