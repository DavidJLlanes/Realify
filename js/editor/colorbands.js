/* ═══════════════════════════════════════════════════════════════
   COLOR POR CANALES
   Seis bandas de matiz —rojos, amarillos, verdes, cianes, azules,
   magentas— cada una con su propio matiz/saturación/luminosidad, más
   un maestro que actúa sobre toda la foto. Es el panel HSL de
   cualquier revelador serio: cada píxel reparte su influencia entre
   las dos bandas más cercanas según lo lejos que esté de su centro,
   así que mover «Rojos» no dibuja un borde donde empiezan los
   naranjas, se desvanece.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider } from "./adjust.js";
import { rgbToHsl, hslToRgb } from "./adjustments.js";

const BAND_DEFS = [
  ["red",     "Rojos",    0],
  ["yellow",  "Amarillos", 60],
  ["green",   "Verdes",   120],
  ["cyan",    "Cianes",   180],
  ["blue",    "Azules",   240],
  ["magenta", "Magentas", 300]
];

/* Distancia angular en un círculo de 360°, siempre el camino corto. */
function hueDist(a, b){
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/* Peso de cada banda para un matiz dado: una tienda de campaña de
   60° de ancho centrada en cada banda. Con seis bandas separadas
   exactamente 60°, en cualquier punto del círculo los pesos de las
   bandas que llegan a tocar suman siempre 1 —en el centro de una
   banda, ella sola vale 1; a medio camino entre dos, cada una vale
   0,5—, así que el reparto nunca oscurece ni aclara de más porque
   dos bandas se pisen. */
function bandWeights(hueDeg){
  const w = {};
  for(const [key, , center] of BAND_DEFS){
    w[key] = Math.max(0, 1 - hueDist(hueDeg, center) / 60);
  }
  return w;
}

function defaultBands(){
  const o = {};
  for(const [key] of BAND_DEFS) o[key] = { hue: 0, sat: 0, light: 0 };
  o.master = { bright: 0, sat: 0, light: 0 };
  return o;
}

/* ── el problema del gris ──────────────────────────────────────
   `rgbToHsl` tiene que devolver ALGO como matiz para un pixel gris, y
   devuelve 0, que es rojo. Sin tenerlo en cuenta, la banda «Rojos»
   acababa tocando todos los grises, blancos y negros de la foto: se
   bajaba la luminosidad de los rojos y se oscurecia el cielo nublado
   entero. Un pixel sin color no pertenece a ninguna banda, asi que su
   influencia se atenua con la propia saturacion y por debajo de un
   minimo no se le toca nada.

   El desvanecido es ancho y con arranque y frenada suaves (la curva
   3t²-2t³, con derivada nula en los dos extremos). Con una ventana
   estrecha y lineal, un degradado que la cruce enseña el borde: la
   rampa empieza y acaba de golpe aunque el valor sea continuo. */
const SAT_MIN = 0.05, SAT_FULL = 0.30;

function bandInfluence(s){
  if(s <= SAT_MIN) return 0;
  if(s >= SAT_FULL) return 1;
  const t = (s - SAT_MIN) / (SAT_FULL - SAT_MIN);
  return t * t * (3 - 2 * t);
}

/* ── tablas por grado de matiz ─────────────────────────────────
   El reparto entre bandas depende SOLO del matiz, asi que se calcula
   una vez para los 360 grados y luego cada pixel es una consulta.
   Antes se hacian seis distancias angulares por pixel: sobre un millon
   de pixeles eso son seis millones de operaciones por fotograma, y de
   ahi que los deslizadores fueran a trompicones. */
export function buildBandTables(bands){
  const hueShift = new Float32Array(360);
  const satDelta = new Float32Array(360);
  const lightDelta = new Float32Array(360);
  let anyBand = false;

  for(const [key] of BAND_DEFS){
    const b = bands[key];
    if(b.hue || b.sat || b.light) anyBand = true;
  }
  if(anyBand){
    for(let deg = 0; deg < 360; deg++){
      const w = bandWeights(deg);
      let hs = 0, sd = 0, ld = 0;
      for(const [key] of BAND_DEFS){
        const bw = w[key];
        if(bw <= 0) continue;
        const band = bands[key];
        hs += bw * band.hue * 0.3;      // ±30° como mucho, por banda
        sd += bw * band.sat / 100;
        ld += bw * band.light / 100;
      }
      hueShift[deg] = hs; satDelta[deg] = sd; lightDelta[deg] = ld;
    }
  }

  const m = bands.master;
  const anyMaster = !!(m.bright || m.sat || m.light);
  return { hueShift, satDelta, lightDelta, anyBand, anyMaster,
           mBright: m.bright / 100, mSat: m.sat / 100, mLight: m.light / 100 };
}

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* Aplica el reparto de bandas más el maestro a un único píxel RGB.
   `t` son las tablas de buildBandTables; si no se pasan, se construyen
   al vuelo (cómodo para probar un píxel suelto, inútil para recorrer
   una imagen entera). */
export function applyColorBands(r, g, b, bands, t){
  if(!t) t = buildBandTables(bands);
  if(!t.anyBand && !t.anyMaster) return [r, g, b];

  let [h, s, l] = rgbToHsl(r, g, b);

  if(t.anyBand){
    const inf = bandInfluence(s);
    if(inf > 0){
      const deg = (h * 360) | 0;
      const i = deg < 0 ? 0 : deg > 359 ? 359 : deg;
      h = ((h * 360 + t.hueShift[i] * inf) % 360 + 360) % 360 / 360;
      s = clamp01(s * (1 + t.satDelta[i] * inf));
      const ld = t.lightDelta[i] * inf;
      l = ld >= 0 ? l + (1 - l) * ld : l * (1 + ld);
      l = clamp01(l);
    }
  }

  // El maestro actúa sobre toda la foto, sin depender del matiz.
  if(t.anyMaster){
    l = t.mBright >= 0 ? l + (1 - l) * t.mBright : l * (1 + t.mBright);
    s = clamp01(s * (1 + t.mSat));
    l = t.mLight >= 0 ? l + (1 - l) * t.mLight : l * (1 + t.mLight);
    l = clamp01(l);
  }

  return hslToRgb(h, s, l);
}

export function colorBands(opts = {}){
  const bands = defaultBands();
  if(opts.init) for(const k in bands) if(opts.init[k] && typeof opts.init[k] === "object") Object.assign(bands[k], opts.init[k]);
  const state = { current: "master" };

  return runAdjust({
    title: "Color por canales",
    wide: true,
    asLayer: true, filterId: "colorBands", filterParams: bands,
    float: true,
    /* Este ajuste no se puede resolver con una tabla de 256 entradas
       por canal como los demás: depende del color entero del píxel, no
       de cada canal por separado, así que hay que convertir a HSL y
       volver. Es caro, y por eso su vista previa trabaja sobre una
       copia más pequeña que la del resto. */
    previewLimit: 4e5,
    compute(data){
      const t = buildBandTables(bands);
      if(!t.anyBand && !t.anyMaster) return;
      for(let i = 0; i < data.length; i += 4){
        const [r, g, b] = applyColorBands(data[i], data[i+1], data[i+2], bands, t);
        data[i] = r; data[i+1] = g; data[i+2] = b;
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="seg" id="cbTabs" style="flex-wrap:wrap;height:auto"></div>
        <div id="cbSliders" style="margin-top:10px"></div>
        <p class="hint" style="margin-top:10px">Cada banda se desvanece hacia sus
          vecinas: mover «Rojos» también roza un poco los naranjas y los magentas
          cercanos, igual que en cualquier revelador. «Todas» actúa sobre la foto
          entera, sin mirar el color.</p>`;

      const tabs = box.querySelector("#cbTabs");
      const sliderHost = box.querySelector("#cbSliders");

      const allTabs = [["master", "Todas"], ...BAND_DEFS.map(([k, name]) => [k, name])];
      for(const [key, name] of allTabs){
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
        if(state.current === "master"){
          const m = bands.master;
          sliderHost.append(
            slider("Brillo", -100, 100, m.bright, v => { m.bright = v; preview(); }),
            slider("Saturación", -100, 100, m.sat, v => { m.sat = v; preview(); }),
            slider("Luminosidad", -100, 100, m.light, v => { m.light = v; preview(); })
          );
        } else {
          const band = bands[state.current];
          sliderHost.append(
            slider("Matiz", -100, 100, band.hue, v => { band.hue = v; preview(); }),
            slider("Saturación", -100, 100, band.sat, v => { band.sat = v; preview(); }),
            slider("Luminosidad", -100, 100, band.light, v => { band.light = v; preview(); })
          );
        }
      }
      renderSliders();

      return box;
    }
  }, opts);
}
