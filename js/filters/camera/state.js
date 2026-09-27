import { CHAIN, defaultStages } from "./chain.js";

export function normalizeState(saved){
  /* `camSeed` identifica el sensor simulado y `seed` el disparo. Son
     dos cosas distintas a propósito: el patrón fijo del sensor debe
     repetirse en todas las fotos de esa cámara, y el grano no. */
  const state = { stages: defaultStages(), seed: 1000, camSeed: 1000, dose: 100, solo: null };
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
  if(Number.isFinite(saved.camSeed)) state.camSeed = Math.round(Math.max(0, Math.min(99999, saved.camSeed)));
  if(Number.isFinite(saved.dose)) state.dose = Math.max(0, Math.min(100, saved.dose));
  return state;
}

// Los selectores no son cantidades: sumarles ruido producía NaN.
export function varyStages(stages, random = Math.random){
  for(const s of CHAIN){
    const st = stages[s.id];
    if(!st?.on) continue;
    for(const pr of s.params){
      if(pr.type === "choice") continue;
      const min = pr.min ?? 0, span = (100 - min) * 0.09;
      st.p[pr.k] = Math.round(Math.max(min, Math.min(100,
        st.p[pr.k] + (random() * 2 - 1) * span)));
    }
  }
}

// Cada preset parte de los valores de fábrica; no hereda etapas
// opcionales del preset anterior ni de una sesión guardada.
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
