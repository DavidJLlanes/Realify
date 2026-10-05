/* ═══════════════════════════════════════════════════════════════
   HDR · AJUSTES Y ESTILOS
   Un único objeto de ajustes (`DEFAULTS`) para los cuatro métodos; cada
   estilo sobrescribe sólo lo que cambia. Los nombres siguen la
   terminología habitual de Photomatix y compañía para que quien viene
   de ellos se oriente.
   ═══════════════════════════════════════════════════════════════ */

export const METHODS = [
  ["details", "Detalles realzados"],
  ["fusion", "Fusión de exposición"],
  ["compressor", "Compresor de tonos"],
  ["drago", "Fotográfico"]
];

export const DEFAULTS = {
  method: "details",
  // Fusión de las fotos
  align: true, crop: true, deghost: 0, ghostRef: -1, precise: false,
  // Detalles realzados
  strength: 70, sat: 110, luminosity: 0, detail: 30, smooth: 60, micro: 20, smoothHi: 0,
  // Compresor / Fotográfico
  brightness: 0, tcontrast: 0, whiteCmp: 50, bias: 70,
  // Fusión de exposición
  wContrast: 100, wSat: 100, wExpo: 100, expoWidth: 50,
  // Ajustes finales
  exposure: 0, contrast: 0, black: 5, white: 0, gamma: 0, shadows: 0, highlights: 0,
  saturation: 0, vibrance: 0, satHi: 0, satLo: 0, temp: 0, tint: 0, sharpen: 0,
  // Motor Premium (hdr/premium.js), con el interruptor de la corona
  premium: false
};

export const PRESETS = [
  ["natural",     "Natural",          { method: "details", strength: 60, sat: 105, detail: 15, smooth: 80, micro: 30, black: 4, contrast: 5 }],
  ["realista",    "Realista",         { method: "details", strength: 75, sat: 110, detail: 30, smooth: 65, micro: 25, black: 6, contrast: 10 }],
  ["vivo",        "Vívido",           { method: "details", strength: 80, sat: 130, detail: 40, smooth: 55, micro: 20, black: 6, vibrance: 25, contrast: 12 }],
  ["pintoresco",  "Pictórico",        { method: "details", strength: 90, sat: 125, detail: 70, smooth: 25, micro: 5, black: 8, vibrance: 15 }],
  ["surrealista", "Surrealista",      { method: "details", strength: 100, sat: 145, detail: 100, smooth: 5, micro: 0, black: 10, luminosity: 20, vibrance: 20 }],
  ["dramatico",   "Dramático",        { method: "details", strength: 95, sat: 95, detail: 80, smooth: 30, micro: 10, black: 14, contrast: 25, sharpen: 30 }],
  ["grunge",      "Grunge",           { method: "details", strength: 100, sat: 70, detail: 100, smooth: 15, micro: 0, black: 12, contrast: 20, sharpen: 60, temp: -10 }],
  ["arquitectura","Arquitectura",     { method: "details", strength: 80, sat: 95, detail: 45, smooth: 70, micro: 35, black: 5, sharpen: 25, highlights: 20 }],
  ["interior",    "Interior",         { method: "fusion", wContrast: 80, wSat: 80, wExpo: 120, expoWidth: 60, shadows: 25, highlights: 15, vibrance: 10 }],
  ["paisaje",     "Paisaje",          { method: "details", strength: 80, sat: 120, detail: 35, smooth: 60, micro: 25, black: 6, vibrance: 30, satLo: 10 }],
  ["atardecer",   "Atardecer",        { method: "details", strength: 75, sat: 130, detail: 25, smooth: 70, micro: 30, temp: 25, vibrance: 20, satHi: 20 }],
  ["fusionNat",   "Fusión natural",   { method: "fusion" }],
  ["fusionInt",   "Fusión intensa",   { method: "fusion", wContrast: 160, wSat: 130, wExpo: 80, contrast: 20, vibrance: 20, sharpen: 25, black: 6 }],
  ["suave",       "Suave",            { method: "compressor", brightness: 10, tcontrast: -10, whiteCmp: 60, sat: 105 }],
  ["fotografico", "Fotográfico",      { method: "drago", brightness: 0, bias: 75, sat: 110, contrast: 10, black: 4 }],
  ["byn",         "Blanco y negro",   { method: "details", strength: 85, sat: 0, detail: 50, smooth: 45, micro: 15, black: 10, contrast: 20, sharpen: 20 }],
  ["bynSuave",    "B/N suave",        { method: "compressor", sat: 0, brightness: 5, whiteCmp: 50, contrast: 10 }]
];

/** Ajustes completos de un estilo (manteniendo alineación y antifantasmas). */
export function presetSettings(id, current = DEFAULTS){
  const p = PRESETS.find(x => x[0] === id);
  const keep = { align: current.align, crop: current.crop, deghost: current.deghost, ghostRef: current.ghostRef, precise: !!current.precise, premium: !!current.premium };
  return { ...DEFAULTS, ...(p ? p[2] : {}), ...keep };
}
