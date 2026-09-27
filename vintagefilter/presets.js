/* ═══════════════════════════════════════════════════════════════
   FILTRO VINTAGE · AJUSTES PREDEFINIDOS
   Sólo nombran los modificadores que usan; el resto queda a cero.
   Nombres descriptivos y genéricos, sin marcas comerciales.
   ═══════════════════════════════════════════════════════════════ */

export const PRESETS = [
  { id: "none", label: "Sin efecto", values: {} },

  { id: "slide60", label: "Diapositiva cálida años 60",
    values: { warmSlide: 75, rolloff: 45, grain: 25, vigOptical: 30, soft: 15, fade: 8 } },
  { id: "neg90", label: "Negativo frío años 90",
    values: { coolNeg: 70, grain: 35, fade: 18, rolloff: 35, vigOptical: 15 } },
  { id: "family70", label: "Álbum familiar años 70",
    values: { castYellow: 55, agedDesat: 45, fade: 40, rolloff: 50, grain: 40, soft: 25, vigOptical: 25, dust: 15 } },
  { id: "instant", label: "Instantánea desvaída",
    values: { fade: 50, split: 35, agedDesat: 35, rolloff: 60, instant: 60, soft: 30, vigOptical: 30, grain: 15 } },
  { id: "summer", label: "Verano quemado por el sol",
    values: { warmSlide: 50, leaks: 70, halation: 45, bloom: 30, fade: 25, grain: 30, vigOptical: 20 } },
  { id: "cross", label: "Proceso cruzado",
    values: { cross: 85, grain: 30, vigOptical: 35, lowRange: 25 } },
  { id: "expired", label: "Película caducada",
    values: { castMagenta: 55, fog: 35, fade: 35, grain: 60, agedDesat: 30, leaks: 20 } },
  { id: "xray", label: "Rayos X de aeropuerto",
    values: { fog: 75, castGreen: 25, grain: 45, agedDesat: 25, lowRange: 20 } },
  { id: "postcard", label: "Postal envejecida",
    values: { castYellow: 45, agedDesat: 60, fade: 35, paperBorder: 55, cracks: 35, stains: 25, soft: 20 } },
  { id: "cinema", label: "Cine nocturno",
    values: { halation: 70, split: 50, grain: 45, bloom: 35, lowRange: 20, vigOptical: 30 } },

  { id: "sepia1900", label: "Sepia de 1900",
    values: { sepia: 85, soft: 35, vigOptical: 55, fade: 20, dust: 35, scratches: 20, cracks: 20, grain: 25 } },
  { id: "cyanotype", label: "Cianotipia",
    values: { cyanotype: 90, soft: 25, paperBorder: 45, fade: 15, grain: 20 } },
  { id: "selenium", label: "Copia al selenio",
    values: { selenium: 85, rolloff: 30, grain: 30, vigOptical: 20 } },
  { id: "platinum", label: "Platino y paladio",
    values: { platinum: 90, fade: 20, rolloff: 45, soft: 20, paperBorder: 30 } },
  { id: "ortho1910", label: "Ortocromático de 1910",
    values: { ortho: 95, lowRange: 30, soft: 40, vigOptical: 45, grain: 35, dust: 25 } },
  { id: "noir", label: "Noir de archivo",
    values: { ortho: 60, lowRange: 45, grain: 55, scratches: 35, dust: 20, vigOptical: 40 } },
  { id: "daguerre", label: "Daguerrotipo desgastado",
    values: { platinum: 60, selenium: 25, vigMech: 55, soft: 55, cracks: 45, stains: 40, fog: 20 } },
  { id: "enlarger", label: "Copia de ampliadora",
    values: { ortho: 40, paperBorder: 60, dust: 45, scratches: 25, grain: 30, rolloff: 25 } },
  { id: "scan35", label: "Negativo escaneado 35 mm",
    values: { filmBorder: 70, grain: 45, dust: 30, coolNeg: 30, fade: 15 } },

  { id: "toy", label: "Cámara de juguete",
    values: { vigMech: 60, soft: 40, ca: 50, leaks: 45, edgeBlur: 55, cross: 25, barrel: 30 } },
  { id: "petzval", label: "Objetivo de retrato antiguo",
    values: { swirl: 75, vigOptical: 45, edgeBlur: 35, soft: 20, warmSlide: 20 } },
  { id: "soviet", label: "Lente soviética",
    values: { swirl: 55, coma: 55, flare: 45, ca: 30, vigOptical: 30, bloom: 20 } },
  { id: "date98", label: "Compacta de 1998",
    values: { dateStamp: 90, warmSlide: 35, grain: 30, rolloff: 35, fade: 15, flare: 15 } },
  { id: "splitSoft", label: "Tonos partidos suaves",
    values: { split: 60, fade: 25, rolloff: 40, grain: 15 } },
  { id: "matte", label: "Mate contemporáneo",
    values: { fade: 55, agedDesat: 25, split: 20, grain: 20 } },
  { id: "nightShake", label: "Paseo nocturno a pulso",
    values: { shake: 55, halation: 45, bloom: 35, grain: 50, lowRange: 20 } }
];

export const preset = id => PRESETS.find(p => p.id === id);
