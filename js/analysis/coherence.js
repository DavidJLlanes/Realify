/* ═══════════════════════════════════════════════════════════════
   COHERENCIA ENTRE EXIF E IMAGEN
   Cada dato del EXIF por separado puede ser perfectamente creíble; lo
   que delata un archivo es que dos de ellos no puedan ser ciertos a la
   vez, o que lo que dicen no case con lo que la imagen enseña.

   Un ISO 25.600 es normal. Una imagen sin apenas grano es normal. Las
   dos cosas juntas, no. Un f/1.4 es normal, y un 18-55 también, pero
   ese objetivo no abre a f/1.4 ni forzándolo.

   Se separan dos niveles a propósito:
   · CONTRADICCIÓN: físicamente imposible. Un cuerpo no da más píxeles
     de los que tiene el sensor, y un objetivo no abre más de lo que
     abre. Esto no admite discusión.
   · AVISO: raro pero explicable. Un recorte cuadrado es perfectamente
     legítimo, sólo que no sale así de la cámara.

   No se mezclan porque un aviso tratado como prueba lleva a corregir
   cosas que no estaban mal.
   ═══════════════════════════════════════════════════════════════ */

import { BODY_BY_ID, LENS_BY_ID, mountCheck, maxAperture } from "../exif/db.js";

const CONTRADICTION = "contradiccion", WARNING = "aviso";
const round = (v, n = 2) => Number(v.toFixed(n));

/**
 * @param {object} o
 * @param {string} [o.bodyId]  cuerpo declarado (id de la base de datos)
 * @param {string} [o.lensId]  objetivo declarado
 * @param {number} [o.iso]
 * @param {number} [o.aperture] número f declarado
 * @param {number} [o.focal]    distancia focal declarada, en mm
 * @param {number} o.width      píxeles reales de la imagen
 * @param {number} o.height
 * @param {Date}   [o.date]     fecha declarada de la toma
 * @param {number} [o.noise]    grano medido, 0..1; opcional
 * @returns {{level:string, text:string}[]}
 */
export function checkCoherence({ bodyId, lensId, iso, aperture, focal,
                                 width, height, noise, date } = {}){
  const findings = [];
  const add = (level, text) => findings.push({ level, text });
  const body = bodyId ? BODY_BY_ID[bodyId] : null;
  const lens = lensId ? LENS_BY_ID[lensId] : null;

  if(body && lens){
    const fit = mountCheck(body, lens);
    if(fit === "bad"){
      add(CONTRADICTION, `Montura incompatible: un ${body.model} (${body.mount}) no monta ` +
        `un objetivo ${lens.mount}.`);
    } else if(fit === "adapter"){
      add(WARNING, `Sólo posible con adaptador (${lens.mount} en cuerpo ${body.mount}).`);
    } else if(fit === "crop"){
      add(WARNING, `Objetivo ${lens.mount} en cuerpo de fotograma completo: recortaría.`);
    }
  }

  /* Una cámara no puede haber tomado una foto antes de existir. */
  if(body && date instanceof Date && !isNaN(date) && date.getFullYear() < body.y){
    add(CONTRADICTION, `Fecha anterior a la salida del ${body.model} (${body.y}).`);
  }

  if(body && width > 0 && height > 0){
    const [nw, nh] = body.px;
    const native = nw * nh, actual = width * height;
    if(width > nw || height > nh){
      add(CONTRADICTION, `La imagen mide ${width}×${height}, más de lo que da el sensor ` +
        `del ${body.model} (${nw}×${nh}). Un sensor no produce más píxeles de los que tiene.`);
    }

    const nativeRatio = nw / nh, ratio = width / height;
    if(Math.abs(ratio - 1) < 0.01){
      add(WARNING, `Imagen cuadrada. El ${body.model} dispara en ${round(nativeRatio)}:1, ` +
        `así que tuvo que recortarse después: legítimo, pero no sale así de la cámara.`);
    } else if(Math.abs(ratio - nativeRatio) > 0.02 && Math.abs(ratio - 1/nativeRatio) > 0.02){
      add(WARNING, `La proporción ${round(ratio)}:1 no es la del ${body.model} ` +
        `(${round(nativeRatio)}:1). Encaja con un recorte.`);
    }

    if(actual < native * 0.02){
      add(WARNING, `${(actual / 1e6).toFixed(1)} MP frente a los ${(native / 1e6).toFixed(1)} MP ` +
        `del ${body.model}: la imagen es mucho más pequeña de lo que ese cuerpo entrega.`);
    }
  }

  if(body && Number.isFinite(iso) && iso > body.iso){
    add(CONTRADICTION, `ISO ${iso} declarado, pero el ${body.model} llega hasta ${body.iso} ` +
      `en su rango normal.`);
  }

  if(lens && Number.isFinite(focal)){
    if(focal < lens.fmin - 0.5 || focal > lens.fmax + 0.5){
      add(CONTRADICTION, `${focal} mm declarados con un ${lens.model}, que sólo cubre ` +
        `${lens.fmin}-${lens.fmax} mm.`);
    }
  }

  if(lens && Number.isFinite(aperture)){
    const focalForLens = Number.isFinite(focal)
      ? Math.max(lens.fmin, Math.min(lens.fmax, focal))
      : lens.fmin;
    const widest = maxAperture(lens, focalForLens);
    // Un número f MENOR es una apertura MÁS abierta.
    if(aperture < widest - 0.05){
      add(CONTRADICTION, `f/${aperture} declarado, pero el ${lens.model} no abre más de ` +
        `f/${widest}${lens.fmin !== lens.fmax ? ` a ${Math.round(focalForLens)} mm` : ""}.`);
    }
  }

  /* Grano frente a sensibilidad. El umbral es deliberadamente
     generoso: la reducción de ruido de la propia cámara puede dejar
     un ISO alto bastante limpio, así que sólo se avisa cuando la
     distancia es grande de verdad. */
  if(Number.isFinite(iso) && Number.isFinite(noise)){
    if(iso >= 3200 && noise < 0.004){
      add(WARNING, `ISO ${iso} declarado y prácticamente sin grano medible ` +
        `(${round(noise, 4)}). A esa sensibilidad se espera bastante más.`);
    } else if(iso <= 200 && noise > 0.05){
      add(WARNING, `ISO ${iso} declarado pero mucho grano medido (${round(noise, 4)}). ` +
        `A ISO base se espera una imagen limpia.`);
    }
  }

  return findings;
}

/** Cuenta por nivel, para poder titular el informe sin recorrerlo fuera. */
export const summarize = findings => ({
  contradictions: findings.filter(f => f.level === CONTRADICTION).length,
  warnings: findings.filter(f => f.level === WARNING).length
});

export { CONTRADICTION, WARNING };
