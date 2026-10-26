/* ═══════════════════════════════════════════════════════════════
   CÁMARAS · MODELO DE AJUSTES
   Cada cámara es una receta: una combinación de modificadores de 0 a
   100 (0 = sin efecto). `intensity` (0-100) los escala todos a la vez,
   así que «a medias» es la misma cámara con menos efecto.

   `seed` fija la colocación de todo lo aleatorio (polvo, arañazos,
   fugas de luz, ruido de cinta…): la misma semilla da exactamente el
   mismo resultado en la vista previa, al aplicar y al reabrir la capa.
   ═══════════════════════════════════════════════════════════════ */

export const CAMARAS_VERSION = 1;

export const GROUPS = [
  ["color", "Color"], ["tono", "Tono"], ["luz", "Luz y sensor"], ["digital", "Digital y compresión"],
  ["video", "Vídeo y pantalla"], ["optica", "Óptica"], ["danos", "Daños y bordes"]
];

const C = (group, key, label) => ({ group, key, label, min: 0, max: 100 });

/* El ORDEN es el de la matriz `A[]` del shader: no reordenar sin tocar engine.js. */
export const CONTROLS = [
  C("color", "sepia",     "Sepia"),
  C("color", "mono",      "Blanco y negro"),
  C("color", "cyano",     "Cianotipia"),
  C("color", "vivid",     "Saturación alta"),
  C("color", "desat",     "Colores apagados"),
  C("color", "warm",      "Dominante cálida"),
  C("color", "cool",      "Dominante fría"),
  C("color", "green",     "Dominante verdosa"),
  C("color", "magenta",   "Dominante magenta"),
  C("color", "cross",     "Proceso cruzado"),
  C("color", "split",     "Tonos partidos"),
  C("color", "infrared",  "Falso infrarrojo"),
  C("color", "thermal",   "Falso color térmico"),
  C("color", "invert",    "Negativo"),
  C("color", "xray",      "Rayos X"),

  C("tono", "fade",       "Negros elevados"),
  C("tono", "punch",      "Contraste alto"),
  C("tono", "flat",       "Contraste bajo"),
  C("tono", "clip",       "Luces quemadas"),
  C("tono", "crush",      "Negros aplastados"),

  C("luz", "grain",       "Grano de película"),
  C("luz", "chromaNoise", "Ruido de color"),
  C("luz", "bloom",       "Resplandor"),
  C("luz", "flash",       "Flash de frente"),
  C("luz", "smear",       "Rayas verticales de luz"),
  C("luz", "halation",    "Halación"),
  C("luz", "leaks",       "Fugas de luz"),
  C("luz", "streak",      "Destello horizontal"),
  C("luz", "grainBig",    "Grano grueso"),
  C("luz", "flicker",     "Parpadeo de proyector"),
  C("luz", "glare",       "Reflejo de brillo"),

  C("digital", "lowRes",  "Baja resolución"),
  C("digital", "blocks",  "Bloques de compresión"),
  C("digital", "bleed",   "Sangrado de color"),
  C("digital", "oversharp","Enfoque excesivo"),
  C("digital", "halftone","Trama de semitono"),
  C("digital", "misreg",  "Registro de color desplazado"),
  C("digital", "posterize","Pocos colores"),
  C("digital", "threshold","Blanco y negro puro"),

  C("video", "scanlines", "Líneas de barrido"),
  C("video", "tape",      "Ruido de cinta"),
  C("video", "crt",       "Pantalla de tubo"),
  C("video", "moire",     "Muaré de pantalla"),
  C("video", "pixelgrid", "Rejilla de píxeles"),

  C("optica", "vignette", "Viñeteado"),
  C("optica", "soft",     "Baja nitidez"),
  C("optica", "fisheye",  "Ojo de pez"),
  C("optica", "ca",       "Aberración cromática"),
  C("optica", "tilt",     "Desenfoque tilt-shift"),
  C("optica", "iris",     "Campo circular"),
  C("optica", "starfilter","Filtro de estrellas"),
  C("optica", "smudge",   "Lente sucia"),
  C("optica", "drops",    "Gotas en la lente"),

  C("danos", "dust",      "Polvo y pelusas"),
  C("danos", "scratches", "Arañazos"),
  C("danos", "fog",       "Velo y manchas"),
  C("danos", "instant",   "Marco de instantánea"),
  C("danos", "film",      "Bordes de película 35 mm"),
  C("danos", "paper",     "Borde de papel"),
  C("danos", "stamp",     "Sello de fecha"),
  C("danos", "letterbox", "Bandas de cine")
];

export const KEYS = CONTROLS.map(c => c.key);

export const defaults = () => ({ version: CAMARAS_VERSION, preset: "", intensity: 100, seed: 1, date: "", premium: false, values: {} });

/** Estado completo y saneado a partir de lo guardado en una capa. */
export function normalize(value){
  const s = { ...defaults(), ...(value || {}), version: CAMARAS_VERSION };
  const src = s.values && typeof s.values === "object" ? s.values : {};
  s.values = {};
  for(const k of KEYS){ const v = +src[k]; if(Number.isFinite(v) && v > 0) s.values[k] = Math.min(100, v); }
  const i = +s.intensity; s.intensity = Number.isFinite(i) ? Math.max(0, Math.min(100, i)) : 100;
  s.seed = Number.isFinite(+s.seed) ? (+s.seed >>> 0) || 1 : 1;
  s.date = typeof s.date === "string" ? s.date.slice(0, 16) : "";
  s.preset = typeof s.preset === "string" ? s.preset : "";
  s.premium = !!s.premium;
  return s;
}

/** Los valores efectivos (ya multiplicados por la intensidad), en el orden de CONTROLS. */
export function effective(state){
  const k = Math.max(0, Math.min(1, state.intensity / 100));
  return KEYS.map(key => Math.min(100, (state.values[key] || 0) * k));
}

export const isActive = state => state.intensity > 0 && KEYS.some(k => (state.values[k] || 0) > 0);
