/* ═══════════════════════════════════════════════════════════════
   EMPAREJAMIENTO EXIF ↔ ÓPTICA SIMULADA
   El panel EXIF (js/exif/) y este filtro viven separados: nada obliga
   a que el cuerpo y objetivo declarados en el EXIF tengan algo que
   ver con la distorsión, el ruido o el viñeteo que de verdad se
   aplicaron. Esta etapa cierra ese hueco: puntúa cada combinación
   cuerpo+objetivo de la base de datos por cuánto encajan sus rasgos
   físicos reales con los parámetros activos de la cadena, y se queda
   con la de mayor puntuación.

   No es un shader: no toca un solo píxel. Actúa sobre `exifState` al
   aceptar el filtro, igual que la compresión JPEG real de más abajo
   actúa en CPU en vez de en la GPU.
   ═══════════════════════════════════════════════════════════════ */

import { BODIES, LENSES, mountCheck } from "../../exif/db.js";

const N = v => (v ?? 0) / 100;
const p = (stages, id) => stages[id]?.on ? stages[id].p : null;

/* Cuánto "defecto óptico de objetivo económico" piden los mandos:
   distorsión, aberración cromática, pérdida de nitidez en el borde y
   viñeteo son justo los rasgos que un zoom barato exagera y un primo
   de gama alta corrige casi del todo. */
function opticalFlaw(stages){
  const distort = p(stages,"distort") ? N(stages.distort.p.amt) : 0;
  const ca = p(stages,"ca") ? (N(stages.ca.p.lat)+N(stages.ca.p.fringe))/2 : 0;
  const soft = p(stages,"soft") ? N(stages.soft.p.amt) : 0;
  const vig = p(stages,"vignette") ? N(stages.vignette.p.amt) : 0;
  return distort*0.40 + ca*0.25 + soft*0.20 + vig*0.15;
}

function lensScore(lens, stages){
  const flaw = opticalFlaw(stages);
  // Un primo tiene zoomRatio=1; un superzoom como el 18-400 mm, ~22.
  // El propio zoom es lo que más correlaciona con defectos ópticos
  // marcados: cuanto más pide la cadena, más zoom económico encaja.
  const zoomRatio = lens.fmax / lens.fmin;
  const zoomFactor = Math.min(1, Math.log(zoomRatio) / Math.log(15));
  const zoomMatch = 1 - Math.abs(zoomFactor - flaw);

  // Un bokeh marcado en Profundidad de campo sólo es creíble con un
  // objetivo que de verdad abra tanto.
  const bokeh = p(stages,"dof") ? N(stages.dof.p.bokeh) : 0;
  const apertureMatch = bokeh > 0.25
    ? Math.max(0, 1 - (lens.amin - 1.0) / 3.5)
    : 0.6;

  return zoomMatch*0.65 + apertureMatch*0.35;
}

function bodyScore(body, stages, w, h){
  const [nw, nh] = body.px;
  // Restricción física dura: un sensor no da más píxeles de los que
  // tiene. checkCoherence() marca esto como contradicción, así que
  // ni se contempla como candidato.
  if(w > nw || h > nh) return -Infinity;

  const noise = p(stages,"sensor") ? (N(stages.sensor.p.shot)+N(stages.sensor.p.read))/2 : 0;
  const prnu = p(stages,"prnu") ? N(stages.prnu.p.amt) : 0;
  const roughness = noise*0.7 + prnu*0.3;

  // Un cuerpo más antiguo tiene, a igualdad de ISO, más ruido; uno
  // moderno lo limpia mucho mejor. El ruido pedido en la cadena
  // orienta la antigüedad del cuerpo, no al revés.
  const ageFactor = 1 - Math.min(1, Math.max(0, body.y - 2006) / (2023 - 2006));
  const ageMatch = 1 - Math.abs(ageFactor - roughness);

  // Entre varios cuerpos que sí dan suficientes píxeles, preferir el
  // que menos le sobra: una R5 de 8192 px para una imagen de 1024 es
  // técnicamente válido pero un salto de resolución que llama la
  // atención en cuanto se mira el EXIF junto al archivo.
  const overkill = (nw * nh) / Math.max(1, w * h);
  const sizeMatch = 1 / (1 + Math.log(Math.max(1, overkill)) * 0.12);

  return ageMatch*0.55 + sizeMatch*0.45;
}

function bestLensFor(body, stages){
  let best = null, bestScore = -Infinity;
  for(const lens of LENSES){
    if(mountCheck(body, lens) !== "ok") continue;
    const s = lensScore(lens, stages);
    if(s > bestScore){ bestScore = s; best = lens; }
  }
  return best;
}

/**
 * Elige el cuerpo y objetivo de la base de datos EXIF cuyos rasgos
 * físicos mejor encajan con las etapas ópticas y de sensor activas
 * en `stages`. `w`/`h` son las dimensiones reales de la imagen, para
 * no proponer nunca un sensor que no las cubra.
 * @returns {{bodyId:string, lensId:string}|null}
 */
export function matchCamera(stages, w, h){
  let best = null, bestScore = -Infinity;
  for(const body of BODIES){
    const bs = bodyScore(body, stages, w, h);
    if(bs === -Infinity) continue;
    const lens = bestLensFor(body, stages);
    if(!lens) continue;
    const score = bs*0.5 + lensScore(lens, stages)*0.5;
    if(score > bestScore){ bestScore = score; best = { bodyId: body.id, lensId: lens.id }; }
  }
  if(best) return best;

  // Ninguna cámara de la base de datos cubre esa resolución: mejor
  // esfuerzo con el sensor de más píxeles disponible, en vez de no
  // proponer nada.
  const fallbackBody = BODIES.reduce((a, b) => (a.px[0]*a.px[1] >= b.px[0]*b.px[1]) ? a : b);
  const fallbackLens = bestLensFor(fallbackBody, stages);
  return fallbackLens ? { bodyId: fallbackBody.id, lensId: fallbackLens.id } : null;
}
