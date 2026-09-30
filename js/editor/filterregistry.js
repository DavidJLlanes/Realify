/* ═══════════════════════════════════════════════════════════════
   REGISTRO DE FILTROS
   Cada capa de filtro guarda un `id` y los `params` con que se
   obtuvo. Este módulo sabe, para cada id, tres cosas que el panel de
   capas necesita y que hasta ahora estaban repartidas por ocho
   archivos con cuatro esqueletos distintos:

   · open(layer):   reabrir el panel del filtro sobre esa capa, con
                    sus valores precargados, para sustituirla al
                    aceptar (doble clic en la insignia «fx»).
   · render(src, params, isFinal): calcular el filtro sin diálogo,
                    sobre un lienzo cualquiera, con esos parámetros.
   · scale(params, t): los parámetros escalados a un tanto por uno
                    para el deslizador de aplicación. Sólo se escalan
                    los mandos que son INTENSIDAD (radio, cantidad,
                    fuerza…) hacia su valor neutro; lo que es posición,
                    ángulo, tamaño de bloque o elección se deja quieto.
                    Devuelve null cuando el filtro no tiene mandos de
                    intensidad (invertir, contraste automático…): ahí
                    el deslizador se resuelve como mezcla entre el
                    original y el resultado completo.

   Cada módulo de filtro se importa a demanda —igual que desde el
   menú— y recibe `{ init, edit, render }`:
     init    parámetros con los que arrancar en vez de los de fábrica
     edit    la capa de filtro cuyo contenido hay que sustituir
     render  { src, isFinal }: modo sin diálogo; devuelve el lienzo
   ═══════════════════════════════════════════════════════════════ */

const lerp = (a, b, t) => a + (b - a) * t;

/* Copia de `p` con las claves de `neutral` interpoladas desde su
   valor neutro (t=0) hasta el guardado (t=1). Lo demás, tal cual. */
function toward(p, t, neutral){
  const o = { ...p };
  for(const k in neutral) if(Number.isFinite(o[k])) o[k] = lerp(neutral[k], o[k], t);
  return o;
}
const zeros = (...keys) => Object.fromEntries(keys.map(k => [k, 0]));

const LEVEL_NEUTRAL = { inLow: 0, inHigh: 255, gamma: 1, outLow: 0, outHigh: 255 };

const mod = path => () => import(path);

/* id → definición. `fn` es el nombre de la función exportada que abre
   el panel y que, con `render`, calcula sin diálogo. */
export const FILTERS = {
  /* ── filters/basic.js ── */
  "blur":        { load: mod("../filters/basic.js"), fn: "blur",
                   scale: (p, t) => toward(p, t, zeros("radius")) },
  "sharpen":     { load: mod("../filters/basic.js"), fn: "sharpen",
                   scale: (p, t) => toward(p, t, zeros("amount")) },
  "motion-blur": { load: mod("../filters/basic.js"), fn: "motionBlur",
                   scale: (p, t) => toward(p, t, zeros("amount")) },
  "clarity":     { load: mod("../filters/basic.js"), fn: "clarity",
                   scale: (p, t) => toward(p, t, zeros("structure", "detail")) },
  "vignette":    { load: mod("../filters/basic.js"), fn: "vignette",
                   scale: (p, t) => toward(p, t, zeros("amount")) },
  "noise":       { load: mod("../filters/basic.js"), fn: "noise",
                   scale: (p, t) => toward(p, t, zeros("amount")) },

  /* ── filters/advanced.js ── */
  "lens-blur":       { load: mod("../filters/advanced.js"), fn: "lensBlur",
                         scale: (p,t) => toward(p,t,zeros("radius")) },
  "radial-blur":     { load: mod("../filters/advanced.js"), fn: "radialBlur",
                         scale: (p,t) => toward(p,t,zeros("amount")) },
  "surface-blur":    { load: mod("../filters/advanced.js"), fn: "surfaceBlur",
                         scale: (p,t) => toward(p,t,zeros("radius")) },
  "high-pass":       { load: mod("../filters/advanced.js"), fn: "highPass",
                         scale: (p,t) => toward(p,t,zeros("contrast")) },
  "channel-denoise": { load: mod("../filters/advanced.js"), fn: "channelDenoise",
                         scale: (p,t) => toward(p,t,zeros("red","green","blue")) },
  "smart-sharpen":   { load: mod("../filters/advanced.js"), fn: "smartSharpen",
                         scale: (p,t) => toward(p,t,zeros("amount")) },
  "distort":         { load: mod("../filters/advanced.js"), fn: "distort",
                         scale: (p,t) => toward(p,t,zeros("amount")) },
  "stylize":         { load: mod("../filters/advanced.js"), fn: "stylize",
                         scale: (p,t) => toward(p,t,zeros("amount")) },

  /* ── filters/effects.js ── */
  "pixelate-suite": { load: mod("../filters/effects.js"), fn: "pixelate", scale: () => null },
  "stylize-effects": { load: mod("../filters/effects.js"), fn: "stylizeEffects",
                         scale: (p,t) => toward(p,t,zeros("amount")) },
  "artistic-gallery": { load: mod("../filters/effects.js"), fn: "artisticGallery",
                          scale: (p,t) => toward(p,t,zeros("amount")) },
  "render-effects": { load: mod("../filters/effects.js"), fn: "renderEffects",
                        scale: (p,t) => toward(p,t,zeros("amount")) },
  "texture-effects": { load: mod("../filters/effects.js"), fn: "textureEffects",
                         scale: (p,t) => toward(p,t,zeros("amount")) },
  "custom-convolution": { load: mod("../filters/effects.js"), fn: "customConvolution", scale: () => null },
  "offset-morphology": { load: mod("../filters/effects.js"), fn: "offsetMorphology", scale: () => null },

  /* ── filters/classic.js ── */
  "blur-gallery": { load: mod("../filters/classic.js"), fn: "blurGallery",
                     scale: (p,t) => toward(p,t,zeros("amount")) },
  "utility-blur": { load: mod("../filters/classic.js"), fn: "utilityBlur",
                     scale: (p,t) => toward(p,t,zeros("radius")) },
  "restoration": { load: mod("../filters/classic.js"), fn: "restoration",
                    scale: (p,t) => toward(p,t,zeros("strength")) },
  "advanced-sharpen": { load: mod("../filters/classic.js"), fn: "advancedSharpen",
                         scale: (p,t) => toward(p,t,zeros("amount")) },
  "classic-distort": { load: mod("../filters/classic.js"), fn: "classicDistort",
                        scale: (p,t) => toward(p,t,zeros("amount")) },
  "adaptive-wide-angle": { load: mod("../filters/classic.js"), fn: "adaptiveWideAngle",
                            scale: (p,t) => toward(p,t,zeros("curvature","vertical","horizontal")) },
  "puppet-warp": { load: mod("../filters/classic.js"), fn: "puppetWarp",
                    scale: (p,t) => ({...p,strength:(p.strength??100)*t}) },

  /* ── editor/adjustments.js ── */
  "bc":           { load: mod("./adjustments.js"), fn: "brightnessContrast",
                    scale: (p, t) => toward(p, t, zeros("brightness", "contrast")) },
  "levels":       { load: mod("./adjustments.js"), fn: "levels",
                    scale: (p, t) => ({ ...p, ch: Object.fromEntries(
                      Object.entries(p.ch || {}).map(([k, v]) => [k, toward(v, t, LEVEL_NEUTRAL)])) }) },
  "curves":       { load: mod("./adjustments.js"), fn: "curves",
                    scale: (p, t) => ({ ...p, points: Object.fromEntries(
                      Object.entries(p.points || {}).map(([k, pts]) =>
                        [k, pts.map(([x, y]) => [x, lerp(x, y, t)])])) }) },
  "whiteBalance": { load: mod("./adjustments.js"), fn: "whiteBalance",
                    scale: (p, t) => toward(p, t, zeros("temp", "tint")) },
  "hsl":          { load: mod("./adjustments.js"), fn: "hueSaturation",
                    scale: (p, t) => p.colorize ? null : toward(p, t, zeros("hue", "sat", "light")) },
  "bw":           { load: mod("./adjustments.js"), fn: "grayscale", scale: () => null },
  "invert":       { load: mod("./adjustments.js"), fn: "invert", scale: () => null },
  "autoLevels":   { load: mod("./adjustments.js"), fn: "autoLevels", scale: () => null },
  "autoContrast": { load: mod("./adjustments.js"), fn: "autoContrast", scale: () => null },

  /* ── editor/tone.js · colorbands.js ── */
  "tone":       { load: mod("./tone.js"), fn: "toneRegions",
                  scale: (p, t) => toward(p, t, zeros("blacks", "shadows", "highlights", "whites")) },
  "colorBands": { load: mod("./colorbands.js"), fn: "colorBands",
                  scale: (p, t) => Object.fromEntries(Object.entries(p).map(([k, v]) =>
                    [k, (v && typeof v === "object") ? toward(v, t, zeros("hue", "sat", "light", "bright")) : v])) },

  /* ── editor/exposure.js · vibrance.js · shadowshighlights.js · colorbalance.js
       · channelmixer.js · selectivecolor.js · gradientmap.js ── */
  "exposure": { load: mod("./exposure.js"), fn: "exposure",
                scale: (p, t) => toward(p, t, { exposure: 0, offset: 0, gamma: 1 }) },
  "vibrance": { load: mod("./vibrance.js"), fn: "vibrance",
                scale: (p, t) => toward(p, t, zeros("vibrance", "saturation")) },
  "shadowsHighlights": { load: mod("./shadowshighlights.js"), fn: "shadowsHighlights",
                // El radio y el tono son estructurales —el tamaño del entorno que se
                // promedia, no una intensidad—, así que no se escalan con el deslizador.
                scale: (p, t) => toward(p, t, zeros("shadows", "highlights")) },
  "colorBalance": { load: mod("./colorbalance.js"), fn: "colorBalance",
                     scale: (p, t) => Object.fromEntries(Object.entries(p).map(([k, v]) =>
                       [k, (v && typeof v === "object") ? toward(v, t, zeros("cr", "mg", "yb")) : v])) },
  "channelMixer": { load: mod("./channelmixer.js"), fn: "channelMixer", scale: () => null },
  "selectiveColor": { load: mod("./selectivecolor.js"), fn: "selectiveColor",
                       scale: (p, t) => Object.fromEntries(Object.entries(p).map(([k, v]) =>
                         [k, toward(v, t, zeros("c", "m", "y", "k"))])) },
  "gradientMap": { load: mod("./gradientmap.js"), fn: "gradientMap", scale: () => null },

  /* ── editor/advanced-color.js ── */
  "color-grading": { load: mod("./advanced-color.js"), fn: "colorGrading",
                      scale: (p, t) => ({ ...p, mix: (p.mix ?? 50) * t }) },
  "split-toning": { load: mod("./advanced-color.js"), fn: "splitToning",
                     scale: (p, t) => toward(p, t, zeros("shadowSat", "highlightSat")) },
  "photo-filter": { load: mod("./advanced-color.js"), fn: "photoFilter",
                     scale: (p, t) => ({ ...p, density: (p.density ?? 25) * t }) },
  "dehaze": { load: mod("./advanced-color.js"), fn: "dehaze",
               scale: (p, t) => toward(p, t, zeros("amount")) },
  "tone-band": { load: mod("./toneband.js"), fn: "toneBand",
                  scale: (p, t) => toward(p, t, zeros("brightness", "contrast", "saturation", "warmth")) },
  "lab-curves": { load: mod("./advanced-color.js"), fn: "labCurves",
                   scale: (p, t) => ({ ...p, points: Object.fromEntries(
                     Object.entries(p.points || {}).map(([k, pts]) =>
                       [k, pts.map(([x, y]) => [x, lerp(x, y, t)])])) }) },
  "range-hsl": { load: mod("./advanced-color.js"), fn: "rangeHsl",
                  scale: (p, t) => ({ ...p, ranges: Object.fromEntries(
                    Object.entries(p.ranges || {}).map(([k, v]) =>
                      [k, toward(v, t, zeros("hue", "sat", "light"))])) }) },
  "replace-color": { load: mod("./advanced-color.js"), fn: "replaceColor", scale: () => null },
  "match-color": { load: mod("./advanced-color.js"), fn: "matchColor",
                    scale: (p, t) => ({ ...p, strength: (p.strength ?? 100) * t }) },
  "threshold": { load: mod("./advanced-color.js"), fn: "threshold", scale: () => null },
  "posterize": { load: mod("./advanced-color.js"), fn: "posterize", scale: () => null },
  "equalize": { load: mod("./advanced-color.js"), fn: "equalize",
                scale: (p, t) => ({ ...p, strength: (p.strength ?? 100) * t }) },
  "desaturate": { load: mod("./advanced-color.js"), fn: "desaturate",
                   scale: (p, t) => ({ ...p, amount: (p.amount ?? 100) * t }) },
  "auto-tone-color": { load: mod("./advanced-color.js"), fn: "autoToneColor", scale: () => null },
  "auto-premium":    { load: mod("./autoenhance.js"), fn: "autoEnhancePremium", scale: () => null },
  "ai-low-light":    { load: () => import("../ai/zerodce.js"), fn: "aiLowLight",
                       scale: (p, t) => ({ ...p, amount: (p.amount ?? 100) * t }) },
  "low-light":       { load: mod("./lowlight.js"), fn: "lowLight",
                       scale: (p, t) => ({ ...p, amount: (p.amount ?? 60) * t }) },
  "hdr-tone": { load: mod("./advanced-color.js"), fn: "hdrTone",
                 scale: (p, t) => toward(p, t, zeros("compression", "detail", "glow")) },
  "tonal-contrast": { load: mod("./advanced-color.js"), fn: "tonalContrast",
                       scale: (p, t) => toward(p, t, zeros("micro", "medium", "macro")) },
  "graduated-filter": { load: mod("./advanced-color.js"), fn: "graduatedFilter",
                         scale: (p, t) => toward(p, t, zeros("exposure", "contrast", "temp")) },

  /* ── filters/looks.js · lut ── */
  "look": { load: mod("../filters/looks.js"), fn: "openLooks",
            scale: (p, t) => ({ ...p, intensity: (p.intensity ?? 100) * t }) },
  "lut":  { load: mod("../filters/lut/ui.js"), fn: "openLut",
            scale: (p, t) => ({ ...p, intensity: (p.intensity ?? 100) * t }) },

  /* ── features/photo-tools.js (el id es la etiqueta, por compatibilidad
        con los proyectos ya guardados) ── */
  "Reducción de ruido":  { load: mod("../features/photo-tools.js"), fn: "reduceNoise",
                           scale: (p, t) => toward(p, t, zeros("lum", "chroma")) },
  "Corrección de lente": { load: mod("../features/photo-tools.js"), fn: "lensCorrection",
                           scale: (p, t) => toward(p, t, zeros("distortion", "ca", "vignette")) },
  "Enfoque selectivo":   { load: mod("../features/photo-tools.js"), fn: "selectiveSharpen",
                           scale: (p, t) => toward(p, t, zeros("amount")) },
  "Retoque de retrato":  { load: mod("../features/photo-tools.js"), fn: "portraitRetouch",
                           scale: (p, t) => toward(p, t, zeros("smooth", "shine", "redEye")) },

  /* ── paneles grandes ── */
  "purepixel": { load: mod("../filters/purepixel/ui.js"), fn: "openPurePixel",
                 scale: (p, t) => toward(p, t, zeros("smooth", "chroma", "grain")) },
  "realify":   { load: mod("../filters/camera/ui.js"), fn: "openCamera",
                 scale: (p, t) => ({ ...p, dose: (p.dose ?? 100) * t }) },
  "lens":      { load: mod("../filters/lens/ui.js"), fn: "openLens",
                 scale: (p, t) => ({ ...p, intensity: (p.intensity ?? 100) * t }) },
  "unmark":    { load: mod("../filters/unmark/ui.js"), fn: "openUnmark",
                 scale: (p, t) => ({ ...p, state: { ...(p.state || {}), dose: (p.state?.dose ?? 100) * t } }) },
  "photo-develop": { load: mod("../../raw/index.js"), fn: "renderPhotoDevelop",
                     scale: () => null },
  /* Todos sus modificadores son cantidades 0-100 que empiezan en cero,
     así que el porcentaje de la capa escala cada uno por igual. */
  "vintage": { load: mod("../../vintagefilter/index.js"), fn: "renderVintageFilter",
               scale: (p, t) => Object.fromEntries(Object.entries(p).map(([k, v]) =>
                 [k, typeof v === "number" && k !== "seed" && k !== "version" ? v * t : v])) }
};

export const knownFilter = id => !!FILTERS[id];

/** Reabre el panel de un filtro sobre la capa que lo produjo. */
export async function openFilterEditor(layer, entry){
  const def = FILTERS[entry.id];
  if(!def) return false;
  const m = await def.load();
  await m[def.fn]({ init: structuredClone(entry.params || {}), edit: layer });
  return true;
}

/* Filtros cuya función de apertura sabe montarse en vivo en un
   contenedor —`opts.container`, ver editor/adjust.js y
   filters/basic.js— en vez de abrir siempre un diálogo modal. Todo lo
   que pasa por `runAdjust` (editor/adjustments.js y el resto de
   ajustes) o por `runFilter` (filters/basic.js) lo entiende; lo que
   usa un esqueleto propio —Tabla de color, Looks, Unmark— todavía no,
   así que ahí el panel de propiedades ofrece el botón de siempre en
   vez de intentar montarlo e ignorarlo.

   «Invertir», «Niveles automáticos» y «Contraste automático» tampoco
   van aquí, aunque no tengan diálogo propio: están hechos con
   `applyDirect`, no con `runAdjust`, y `applyDirect` no entiende
   `opts.container` en absoluto —lo ignora y, sin más, recalcula y
   confirma de inmediato—. Meterlos en este set hacía que sólo con
   SELECCIONAR esa capa en el panel de Propiedades (cualquier
   `doc:structure`, no un gesto del usuario) se disparase
   `commitFilter` otra vez: un paso fantasma en Ctrl+Z y un aviso
   «actualizado» de la nada, sin que hubiera ningún mando que tocar.
   Sin parámetros que editar, lo que les toca es el botón de siempre. */
const LIVE_CAPABLE = new Set([
  "bc", "levels", "curves", "whiteBalance", "hsl", "bw",
  "tone", "colorBands", "exposure", "vibrance", "shadowsHighlights", "colorBalance",
  "channelMixer", "selectiveColor", "gradientMap",
  "blur", "sharpen", "motion-blur", "clarity", "vignette", "noise"
  , "lens-blur", "radial-blur", "surface-blur", "high-pass", "channel-denoise",
  "smart-sharpen", "distort", "stylize"
  , "blur-gallery", "utility-blur", "restoration", "advanced-sharpen",
  "classic-distort", "adaptive-wide-angle", "puppet-warp"
  , "pixelate-suite", "stylize-effects", "render-effects", "texture-effects",
  "custom-convolution", "offset-morphology"
  , "color-grading", "split-toning", "photo-filter", "dehaze", "lab-curves",
  "range-hsl", "tone-band", "replace-color", "match-color", "threshold", "posterize", "equalize",
  "desaturate", "auto-tone-color", "low-light", "hdr-tone", "tonal-contrast", "graduated-filter"
]);
export const filterLiveCapable = id => LIVE_CAPABLE.has(id);

/** Como `openFilterEditor`, pero monta los mandos en `container` y
    deja la vista previa en vivo en vez de esperar un botón Aplicar.
    Sólo para los filtros de `LIVE_CAPABLE`: llamarla con otro id no
    hace nada —quien la usa ya ha comprobado `filterLiveCapable`
    antes—. Devuelve `{ commit() }`, para confirmar como un único paso
    de historial cuando el panel lo decida. */
export async function mountFilterEditor(layer, entry, container){
  if(!filterLiveCapable(entry.id)) return null;
  const def = FILTERS[entry.id];
  if(!def) return null;
  const m = await def.load();
  const session = await m[def.fn]({ init: structuredClone(entry.params || {}), edit: layer, container });
  return session || null;
}

/**
 * Calcula el filtro sin diálogo sobre `src`. Devuelve un lienzo del
 * mismo tamaño, o null si el filtro no puede recalcularse (una tabla
 * LUT que ya no está cargada, por ejemplo).
 */
export async function renderFilter(id, src, params, isFinal = true){
  const def = FILTERS[id];
  if(!def) return null;
  const m = await def.load();
  try{
    return await m[def.fn]({ init: structuredClone(params || {}), render: { src, isFinal } });
  }catch(err){
    console.warn("[filter] no se pudo recalcular", id, err);
    return null;
  }
}

/** Parámetros escalados a `t` (0..1), o null si el filtro no escala. */
export function scaleParams(id, params, t){
  const def = FILTERS[id];
  if(!def || !def.scale) return null;
  try{ return def.scale(structuredClone(params || {}), Math.max(0, Math.min(1, t))); }
  catch{ return null; }
}
