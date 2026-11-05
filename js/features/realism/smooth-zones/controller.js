/* ═══════════════════════════════════════════════════════════════
   ZONAS LISAS · FLUJO
   Foto → panel → zonas sin textura creíble → grano sólo ahí (o las zonas marcadas en rojo) → capa nueva. Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../../scene/shared/ejecutar.js";
import { mapaLiso, anadirGrano } from "./engine.js";
import { panel } from "./ui.js";

export function ejecutar(){
  return ejecutarEscena({
    panel: panel(), nombre: "Zonas lisas",
    datos: (src, prep) => { const z = mapaLiso(prep.planes); return z.cobertura < 0.003 ? { aviso: "No hay zonas demasiado lisas: la foto ya tiene textura." } : z; },
    motor: (p, z, v) => {
      if(!v.ver) return anadirGrano(p, z.liso, { fuerza: v.fuerza, tam: v.tam });
      for(let i = 0; i < z.liso.length; i++){ const m = z.liso[i] * 0.7; p.R[i] += (1 - p.R[i]) * m; p.G[i] *= 1 - m; p.B[i] *= 1 - m; }
    }
  });
}
