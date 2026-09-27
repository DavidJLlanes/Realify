/* ═══════════════════════════════════════════════════════════════
   ETAPAS DE CPU DE LA CADENA
   Lo que no cabe en un shader: la limpieza espectral por bloques de
   Fourier y la ida y vuelta real por el códec JPEG del navegador.

   Es UNA función para los tres sitios que la necesitan —la vista
   previa una vez asentada, el botón Aplicar y el lote— porque en
   cuanto hubo tres copias cada una se quedó con un subconjunto
   distinto: la vista previa sin ninguna, Aplicar con todas y el lote
   sólo con el JPEG, y encima dos de ellas sin aplicar la dosis. El
   resultado no coincidía con lo que se acababa de ver, que es lo peor
   que le puede pasar a un filtro con vista previa en vivo.
   ═══════════════════════════════════════════════════════════════ */

import * as engine from "./engine.js";
import { removePeriodicPatterns, normalizeSpectralSlope } from "./spectralclean.js";

/* ¿Hay algo que hacer en CPU con esta configuración? Sirve para no
   programar una pasada que no va a tocar nada. */
export function cpuStagesActive(stages, dose){
  if(dose <= 0) return false;
  return !!(stages.periodic?.on || stages.hfslope?.on || stages.jpeg?.on);
}

function replaceWith(canvas, result){
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(result, 0, 0);
  ctx.restore();
}

/* Aplica, sobre el propio `canvas` y en este orden, las etapas de CPU
   que estén encendidas. Los parámetros pasan por `effParams`, que es
   donde vive la dosis: así el 50 % de un filtro también es el 50 % de
   su limpieza espectral, y no el 100 % con la mitad del resto.

   El orden importa y no es casual: el espectro se limpia y se
   normaliza ANTES de comprimir, porque el propio JPEG mete su rejilla
   de bloques de 8 px, que se confundiría con la periodicidad que se
   está intentando quitar si se midiera después de codificar. */
export async function applyCpuStages(canvas, stages, dose, onStatus = () => {}){
  if(dose <= 0) return;

  if(stages.periodic?.on){
    onStatus("Limpiando espectro…");
    const p = engine.effParams(stages, "periodic", dose);
    replaceWith(canvas, removePeriodicPatterns(canvas, {
      amt:     p.amt / 100,
      thresh:  1.5 + (p.thresh / 100) * (4.0 - 1.5),
      dcGuard: 0.02 + (p.guard / 100) * (0.15 - 0.02)
    }));
  }

  if(stages.hfslope?.on){
    onStatus("Normalizando espectro…");
    const p = engine.effParams(stages, "hfslope", dose);
    replaceWith(canvas, normalizeSpectralSlope(canvas, {
      amt:         p.amt / 100,
      targetAlpha: 0.7 + (p.target / 100) * (1.4 - 0.7),
      dcGuard:     0.02 + (p.guard / 100) * (0.15 - 0.02)
    }));
  }

  if(stages.jpeg?.on){
    onStatus("Comprimiendo…");
    await engine.applyJpeg(canvas, stages, dose);
  }
}
