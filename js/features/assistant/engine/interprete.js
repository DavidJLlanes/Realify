/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · INTÉRPRETE DE ÓRDENES EN ESPAÑOL (motor puro, sin DOM)
   Convierte «hazla más cálida y con grano de película» en un plan { pasos } con reglas. Es el intérprete que funciona SIN modelo de lenguaje;
   cuando exista el modelo local (F14.1) devolverá el mismo formato de plan y pasará por la misma validación.
   Se parte la orden en cláusulas (y, coma, con, pero); en cada una se busca una intención, un signo («más/menos», «cálida/fría»…) y una
   intensidad («un poco» 0,35 · normal 0,6 · «mucho» 1). Lo que no se entiende se devuelve en `sinEntender`.
   Entradas: texto. Salida: { pasos, entendido:[texto], sinEntender:[texto] }.
   ═══════════════════════════════════════════════════════════════ */
const quitar = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const POCO = /\b(un poco|algo|ligeramente|sutil(mente)?|suave(mente)?|levemente|poquito)\b/, MUCHO = /\b(mucho|muy|bastante|extrem\w*|fuerte|al maximo|a tope)\b/;
const MENOS = /\b(menos|quita\w*|baja\w*|reduc\w*|sin)\b/;

/* [regex de la cláusula, herramienta, mando, signo por defecto, tope del mando] */
const REGLAS = [
  [/blanco.negro|monocrom|\bb\/?n\b|escala de grises/, "gray", null, 1, 0],
  [/grano|pelicula|analogic|cine\b/, "grano", "fuerza", 1, 70],
  [/neblina|bruma|niebla|calima/, "ai.dehaze", null, 1, 0],
  [/luces quemadas|recuper\w* (las )?luces|sobreexpuest\w*|cielo quemado/, "ai.highlightRecovery", null, 1, 0],
  [/\bcielo\b/, "ai.skyEnhance", null, 1, 0],
  [/calid|calient|dorad|anaranjad|atardecer/, "wb", "temp", 1, 45],
  [/\bfri[ao]s?\b|frescas?|azulad|helad/, "wb", "temp", -1, 45],
  [/contraste|dramatic|con mas fuerza|punch/, "bc", "contrast", 1, 45],
  [/satur|colorid|vivos|viv[ao]s?\b|intens\w* los colores|mas color/, "hsl", "sat", 1, 45],
  [/apagad|desatur|pastel|menos color/, "hsl", "sat", -1, 45],
  [/luminos|mas luz|mas clar|brillant|iluminad|aclar/, "exposure", "ev", 1, 0.9],
  [/oscur|menos luz|sombria|menos brillo|bajar la luz/, "exposure", "ev", -1, 0.9]
];

function intensidad(c){ return POCO.test(c) ? 0.35 : MUCHO.test(c) ? 1 : 0.6; }

export function interpretar(texto){
  const pasos = [], entendido = [], sinEntender = [];
  const clausulas = quitar(texto).replace(/blanco y negro/g, "blanco_negro").replace(/[¿?¡!.]/g, " ").split(/\s*(?:,|;|\by\b|\be\b|\bcon\b|\bpero\b|\bademas\b|\btambien\b)\s*/).map(s => s.trim()).filter(Boolean);
  for(const c of clausulas){
    if(/^(hazla|hazlo|ponla|ponlo|dejala|dejalo|quiero|que|la|lo|mi|foto|imagen|esta)\b\s*$/.test(c)) continue;
    let hecho = false;
    for(const [re, id, key, signo, tope] of REGLAS){
      if(!re.test(c)) continue;
      if(pasos.some(p => p.herramienta === id && (!key || key in p.valores))) { hecho = true; break; }
      let s = signo; if(MENOS.test(c) && !/\bsin\s+(grano|neblina|bruma)/.test(c)) s = -s; if(/\bsin\s+(grano|neblina|bruma|niebla)/.test(c)) { hecho = true; break; }
      const valores = key ? { [key]: +(s * intensidad(c) * tope).toFixed(id === "exposure" ? 2 : 0) } : {};
      if(id === "grano") valores.fuerza = Math.round(intensidad(c) * tope);
      pasos.push({ herramienta: id, valores }); entendido.push(c); hecho = true; break;
    }
    if(!hecho) sinEntender.push(c);
  }
  return { pasos, entendido, sinEntender };
}
