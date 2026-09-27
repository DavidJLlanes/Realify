/* ══════════════════════════════════════════════════════════════
   UNMARK · ESTADO Y PRESETS
   Mismo contrato que filters/camera/state.js: un estado siempre
   completo y saneado, salga de donde salga (localStorage, un preset,
   los parámetros guardados en una capa), y una dosis global que
   escala las amplitudes sin mover los deslizadores.
   ══════════════════════════════════════════════════════════════ */

import { CHAIN, CHAIN_BY_ID, defaultStages } from "./chain.js";

export function normalizeState(saved){
  const state = { stages: defaultStages(), seed: 4242, dose: 100, solo: null };
  if(!saved || typeof saved !== "object") return state;
  for(const s of CHAIN){
    const src = saved.stages?.[s.id], dst = state.stages[s.id];
    if(!src || typeof src !== "object") continue;
    if(typeof src.on === "boolean") dst.on = src.on;
    for(const pr of s.params){
      const v = src.p?.[pr.k];
      if(pr.type === "choice"){
        if(pr.options.some(o => o.v === v)) dst.p[pr.k] = v;
      } else if(typeof v === "number" && Number.isFinite(v)){
        dst.p[pr.k] = Math.round(Math.max(pr.min ?? 0, Math.min(100, v)));
      }
    }
  }
  if(Number.isFinite(saved.seed)) state.seed = Math.round(Math.max(0, Math.min(99999, saved.seed)));
  if(Number.isFinite(saved.dose)) state.dose = Math.max(0, Math.min(100, saved.dose));
  return state;
}

/* La dosis multiplica las amplitudes; los mandos `keep` (radios,
   posiciones, selectores) no se tocan y los `inv` (calidad JPEG)
   suben hacia 100 al bajar la dosis. */
export function effParams(stages, id, dose){
  const raw = stages[id].p;
  if(dose >= 1) return raw;
  const out = {};
  for(const pr of CHAIN_BY_ID[id].params){
    const v = raw[pr.k];
    out[pr.k] = pr.type === "choice" ? v
              : pr.mode === "keep" ? v
              : pr.mode === "inv"  ? v + (100 - v) * (1 - dose)
              : v * dose;
  }
  return out;
}

/* Desvía cada amplitud un poco: veinte exportaciones con los mismos
   valores exactos comparten firma, y eso también es una marca. */
export function varyStages(stages, random = Math.random){
  for(const s of CHAIN){
    const st = stages[s.id];
    if(!st?.on) continue;
    for(const pr of s.params){
      if(pr.type === "choice" || pr.mode === "keep") continue;
      const min = pr.min ?? 0, span = (100 - min) * 0.09;
      st.p[pr.k] = Math.round(Math.max(min, Math.min(100,
        st.p[pr.k] + (random() * 2 - 1) * span)));
    }
  }
}

export function presetStages(preset){
  const stages = defaultStages();
  for(const s of CHAIN){
    const src = preset[s.id];
    if(!src) continue;
    if(typeof src.on === "boolean") stages[s.id].on = src.on;
    for(const pr of s.params){
      if(pr.k in src) stages[s.id].p[pr.k] = src[pr.k];
    }
  }
  return normalizeState({ stages }).stages;
}

const OFF = Object.fromEntries(CHAIN.map(s => [s.id, { on:false }]));

export const PRESETS = {
  "Equilibrado": {
    ...OFF,
    detect:{on:true}, inpaint:{on:true, method:"hybrid"},
    geometry:{on:true, rot:30, crop:15, shift:50, aniso:20},
    resample:{on:true, amt:30, mix:70},
    dwt:{on:true, ll:40, hf:35}, dct:{on:true, amt:40},
    blursharp:{on:true, blur:30, sharp:40},
    noise:{on:true, lum:30, chr:15}, lsb:{on:true},
    jpeg:{on:true, q:78, gens:15, jitter:30},
    policy:{on:true, mode:"clean"}
  },
  "Suave (casi sin cambio visible)": {
    ...OFF,
    detect:{on:true}, inpaint:{on:true, method:"hybrid"},
    geometry:{on:true, rot:12, crop:6, shift:50, aniso:10},
    dwt:{on:true, ll:25, hf:20}, dct:{on:true, amt:22},
    noise:{on:true, lum:14, chr:6}, lsb:{on:true},
    jpeg:{on:true, q:88, gens:5, jitter:20},
    policy:{on:true, mode:"clean"}
  },
  "Agresivo (marcas robustas)": {
    ...OFF,
    detect:{on:true}, inpaint:{on:true, method:"hybrid"},
    geometry:{on:true, rot:60, crop:30, shift:50, aniso:45},
    resample:{on:true, amt:55, mix:55},
    dwt:{on:true, ll:70, hf:60, levels:"3"}, dct:{on:true, amt:70, band:60},
    blursharp:{on:true, blur:45, sharp:55},
    noise:{on:true, lum:55, chr:30, size:35},
    tone:{on:true, gamma:25, contrast:20, sat:-8, hue:6},
    lsb:{on:true, bits:"3"},
    spectral:{on:true, amt:45},
    jpeg:{on:true, q:70, gens:35, jitter:40},
    policy:{on:true, mode:"clean"}
  },
  "Regeneración en el servidor": {
    ...OFF,
    detect:{on:true}, inpaint:{on:true, method:"hybrid"},
    regen:{on:true, strength:35, pipeline:"auto"},
    geometry:{on:true, rot:15, crop:8, shift:50, aniso:10},
    noise:{on:true, lum:12, chr:6}, lsb:{on:true},
    jpeg:{on:true, q:84, gens:6, jitter:25},
    policy:{on:true, mode:"clean"}
  },
  "Sólo marca visible": {
    ...OFF,
    detect:{on:true}, inpaint:{on:true, method:"hybrid"},
    policy:{on:true, mode:"keep"}
  },
  "Sólo marcas invisibles": {
    ...OFF,
    geometry:{on:true}, resample:{on:true}, dwt:{on:true}, dct:{on:true},
    blursharp:{on:true}, noise:{on:true}, lsb:{on:true}, jpeg:{on:true},
    policy:{on:true, mode:"keep"}
  },
  "Sólo metadatos": {
    ...OFF,
    policy:{on:true, mode:"clean"}
  },
  "Todo apagado": OFF
};
