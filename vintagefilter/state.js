/* ═══════════════════════════════════════════════════════════════
   FILTRO VINTAGE · MODELO DE AJUSTES
   Cada modificador es una cantidad de 0 a 100 (0 = sin efecto). Las
   variantes de un mismo fenómeno —los virados, las dominantes, los dos
   viñeteados…— son entradas separadas para poder combinarlas y para
   que la interfaz sea siempre «un desplegable + un deslizador».

   `seed` fija la colocación de todo lo aleatorio (polvo, arañazos,
   fugas de luz, grietas…): la misma semilla da exactamente el mismo
   resultado en la vista previa, al aceptar y al reabrir la capa.
   ═══════════════════════════════════════════════════════════════ */

export const VINTAGE_VERSION = 1;

export const GROUPS = [
  ["virado", "Virados"], ["color", "Color"], ["tono", "Tono"], ["luz", "Luz y película"],
  ["danos", "Daños"], ["bordes", "Bordes"], ["optica", "Óptica"]
];

const C = (group, key, label, help) => ({ group, key, label, help, min: 0, max: 100, step: 1, unit: "" });

export const CONTROLS = [
  C("virado", "sepia",     "Sepia",                    "Marrones cálidos de las copias al sulfuro."),
  C("virado", "cyanotype", "Cianotipia",               "Azul Prusia de las copias al hierro."),
  C("virado", "selenium",  "Virado al selenio",        "Marrones fríos y negros purpúreos."),
  C("virado", "platinum",  "Platino y paladio",        "Grises cálidos, suaves y sin negros duros."),

  C("color", "ortho",      "B/N ortocromático",        "Insensible al rojo: labios y pieles rojizas casi negros."),
  C("color", "panchro",    "B/N pancromático",         "Blanco y negro de película moderna, sensible a todos los colores."),
  C("color", "agedDesat",  "Desaturación envejecida",  "Colores apagados; cian y verde se pierden primero."),
  C("color", "castYellow", "Dominante amarilla",       "Tintes inestables que amarillean con los años."),
  C("color", "castGreen",  "Dominante verdosa",        "Virado verdoso de copias mal conservadas."),
  C("color", "castMagenta","Dominante magenta",        "Pérdida del tinte cian: todo tira a magenta."),
  C("color", "cross",      "Proceso cruzado",          "Diapositiva revelada como negativo: colores fluorescentes y contraste salvaje."),
  C("color", "warmSlide",  "Diapositiva cálida",       "Rojos y amarillos cálidos de diapositiva clásica."),
  C("color", "coolNeg",    "Negativo frío",            "Verdes apagados y tonos fríos de negativo clásico."),
  C("color", "split",      "Tonos partidos",           "Sombras frías y altas luces cálidas."),

  C("tono", "lowRange",    "Bajo rango dinámico",      "Se pierde detalle en sombras profundas y en luces a la vez."),
  C("tono", "fade",        "Negros elevados (mate)",   "Sombras grises, lechosas y empolvadas."),
  C("tono", "rolloff",     "Suavizado de altas luces", "Transición analógica hacia el blanco, sin corte digital."),
  C("tono", "fog",         "Velado por rayos X o calor", "Neblina grisácea y pérdida de contraste."),

  C("luz", "grain",        "Grano de película",        "Más grueso y marcado en sombras y zonas subexpuestas."),
  C("luz", "leaks",        "Fugas de luz",             "Llamaradas naranjas y rojas entrando por los bordes."),
  C("luz", "halation",     "Halación",                 "Halo rojizo alrededor de las luces intensas."),
  C("luz", "bloom",        "Destello difuso",          "Neblina luminosa de lentes sin recubrimiento."),
  C("luz", "flare",        "Destellos de lente",       "Aros concéntricos de una luz intensa."),

  C("danos", "dust",       "Polvo y pelusas",          "Motas, pelusas y filamentos del negativo."),
  C("danos", "scratches",  "Arañazos de arrastre",     "Líneas verticales continuas de rodillos o polvo en el chasis."),
  C("danos", "stains",     "Manchas químicas",         "Gotas secas y escurridos de un mal lavado."),
  C("danos", "cracks",     "Craquelado",               "Microgrietas en la emulsión del papel."),
  C("danos", "instant",    "Marcas de instantánea",    "Manchas de la pasta química en las esquinas."),

  C("bordes", "filmBorder","Bordes de película 35 mm", "Marco negro, perforaciones y rótulos del borde."),
  C("bordes", "paperBorder","Bordes de papel",         "Margen de papel baritado cortado a mano."),
  C("bordes", "dateStamp", "Sello de fecha",           "Números naranjas quemados en la esquina."),

  C("optica", "soft",      "Baja nitidez",             "Menos microcontraste; texturas y piel más suaves."),
  C("optica", "ca",        "Aberración cromática",     "Flecos de color en las siluetas."),
  C("optica", "coma",      "Coma y astigmatismo",      "Las luces de las esquinas se estiran como cometas."),
  C("optica", "swirl",     "Bokeh en espiral",         "Fondo que gira en círculos, como las lentes antiguas."),
  C("optica", "edgeBlur",  "Pérdida de foco periférica", "Centro nítido y bordes cada vez más blandos."),
  C("optica", "vigOptical","Viñeteado óptico",         "Oscurecimiento suave y progresivo hacia las esquinas."),
  C("optica", "vigMech",   "Viñeteado mecánico",       "Esquinas negras recortadas por el barril o el parasol."),
  C("optica", "barrel",    "Distorsión de barril",     "Líneas rectas que se abomban hacia fuera."),
  C("optica", "pincushion","Distorsión de cojín",      "Líneas rectas que se hunden hacia dentro."),
  C("optica", "shake",     "Trepidación",              "Movimiento fantasma de una exposición lenta a pulso.")
];

export const defaults = () => {
  // `date`: texto del sello de fecha («'98 7 14»), fijado al abrir.
  const state = { version: VINTAGE_VERSION, seed: 1, date: "" };
  for(const item of CONTROLS) state[item.key] = 0;
  return state;
};

export const normalize = value => {
  const state = { ...defaults(), ...(value || {}), version: VINTAGE_VERSION };
  for(const item of CONTROLS){
    const v = +state[item.key];
    state[item.key] = Math.max(item.min, Math.min(item.max, Number.isFinite(v) ? v : 0));
  }
  state.seed = Number.isFinite(+state.seed) ? (+state.seed >>> 0) || 1 : 1;
  state.date = typeof state.date === "string" ? state.date.slice(0, 16) : "";
  return state;
};

export const control = key => CONTROLS.find(item => item.key === key);
export const controlsFor = group => CONTROLS.filter(item => item.group === group);
export const valueText = (item, value) => `${Math.round(value)}${item.unit || ""}`;
export const isActive = state => CONTROLS.some(item => state[item.key] > 0);
