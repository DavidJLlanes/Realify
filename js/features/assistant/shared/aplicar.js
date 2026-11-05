/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · APLICAR UN PLAN
   Recorre los pasos ya validados: las capas de ajuste (calidez, brillo y contraste, exposición, saturación, blanco y negro) se crean con sus valores y
   quedan reeditables; el grano de película va a una capa nueva; las funciones de IA se ejecutan con sus mandos rellenos (ai-kit/plan-host.js).
   Entradas: pasos validados y esquema. Salida: { hechos, fallos:[texto] }. Un paso que falla no detiene los siguientes.
   ═══════════════════════════════════════════════════════════════ */
import { addAdjustmentLayer, setAdjustParams } from "../../../editor/layers/adjustlayers.js";
import { ADJUST_TYPES } from "../../../editor/layers/adjust-types.js";
import { visibleImage } from "../../ai-kit/visible-image.js";
import { toNewLayer } from "../../ai-kit/new-layer.js";
import { WORK } from "../../ai-kit/preview.js";
import { correrIA } from "../../ai-kit/plan-host.js";
import { trabajar, aLienzo } from "../../scene/shared/trabajo.js";
import { describirPaso } from "../engine/validar.js";

async function grano(valores){
  const src = await visibleImage(); if(!src) throw new Error("no hay imagen");
  const { anadirGrano } = await import("../../realism/engine/grano.js"), prep = trabajar(src, WORK());
  anadirGrano(prep.planes, new Float32Array(prep.W * prep.H).fill(1), { fuerza: valores.fuerza ?? 50, tam: valores.tam ?? 30 });
  await toNewLayer(aLienzo(prep, src), "Grano de película");
}

export async function aplicarPasos(pasos, esquema){
  let hechos = 0; const fallos = [];
  for(const p of pasos){
    const t = esquema.get(p.herramienta);
    try{
      if(t.tipo === "capa"){
        if(!ADJUST_TYPES[t.id]) throw new Error("tipo de capa desconocido");
        const l = addAdjustmentLayer(t.id); if(!l) throw new Error("no hay imagen abierta");
        setAdjustParams(l, { ...l.adjustParams, ...p.valores });
      } else if(t.tipo === "grano") await grano(p.valores);
      else await correrIA(t.cmd, t.params, p.valores);
      hechos++;
    } catch(err){ if(err && err.cancelled) continue; fallos.push(`${describirPaso(p, esquema)}: ${err.message || err}`); }
  }
  return { hechos, fallos };
}
