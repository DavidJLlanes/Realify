/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN POR TEXTO · vocabulario y análisis (fase 10 de PENDIENTE.md)
   Sin DOM: lo usan la herramienta y las pruebas en Node.

   Vocabulario CERRADO: las 150 categorías de ADE20K que reconoce el
   modelo DeepLab que ya viaja con la web (Apache-2.0; ver models.js),
   con nombres y sinónimos en español, más adjetivos de color. No es un
   modelo de vocabulario abierto («una taza azul con un dibujo»): para eso
   haría falta bajar uno de Hugging Face, ver PENDIENTE.

   Gramática: «coche rojo y cielo», «persona, árboles», «césped sin
   personas». Los términos se separan por «y», «e», comas o «+»; un
   «sin», «no» o «excepto» delante resta lo que sigue.
   El canal del modelo de la clase i (0-149) es i + 1.
   ═══════════════════════════════════════════════════════════════ */

/* [nombre en inglés de ADE20K, español principal, sinónimos separados por «|»] */
export const CLASSES = [
  ["wall", "pared", "muro|paredes|muros"], ["building", "edificio", "edificios|construccion|construcciones"], ["sky", "cielo", "cielos"], ["floor", "suelo", "piso|suelos|pisos"],
  ["tree", "árbol", "arbol|arboles|árboles|arbol"], ["ceiling", "techo", "techos"], ["road", "carretera", "calle|asfalto|carreteras|calles"], ["bed", "cama", "camas"],
  ["windowpane", "ventana", "ventanas|cristal de ventana"], ["grass", "césped", "cesped|hierba|pasto|hierbas"], ["cabinet", "armario", "mueble|armarios|muebles"], ["sidewalk", "acera", "vereda|banqueta|aceras"],
  ["person", "persona", "personas|gente|hombre|hombres|mujer|mujeres|niño|niños|niña|niñas|nino|ninos|chico|chica|chicos|chicas|people"], ["earth", "tierra", "suelo de tierra"], ["door", "puerta", "puertas"], ["table", "mesa", "mesas"],
  ["mountain", "montaña", "montana|monte|sierra|montañas|montanas|montes"], ["plant", "planta", "plantas|vegetacion|vegetación"], ["curtain", "cortina", "cortinas"], ["chair", "silla", "sillas"],
  ["car", "coche", "coches|auto|autos|carro|carros|automovil|automóvil"], ["water", "agua", "aguas"], ["painting", "cuadro", "cuadros|pintura|pinturas"], ["sofa", "sofá", "sofa|sofas|sofás|sillon|sillón|sillones"],
  ["shelf", "estante", "estantes|estanteria|estantería|balda"], ["house", "casa", "casas"], ["sea", "mar", "oceano|océano|mares"], ["mirror", "espejo", "espejos"],
  ["rug", "alfombra", "alfombras"], ["field", "campo", "prado|campos|prados"], ["armchair", "butaca", "butacas"], ["seat", "asiento", "asientos"],
  ["fence", "valla", "cerca|verja|vallas|cercas"], ["desk", "escritorio", "escritorios"], ["rock", "roca", "piedra|rocas|piedras"], ["wardrobe", "ropero", "armario ropero|guardarropa"],
  ["lamp", "lámpara", "lampara|lamparas|lámparas"], ["bathtub", "bañera", "banera|bañeras"], ["railing", "barandilla", "baranda|barandillas"], ["cushion", "cojín", "cojin|cojines|almohadon|almohadón"],
  ["base", "pedestal", "base|bases"], ["box", "caja", "cajas"], ["column", "columna", "pilar|columnas|pilares"], ["signboard", "letrero", "cartel|rótulo|rotulo|letreros|carteles"],
  ["chest of drawers", "cómoda", "comoda|cómodas"], ["counter", "mostrador", "barra|mostradores"], ["sand", "arena", "arenas"], ["sink", "fregadero", "lavabo|pila|fregaderos|lavabos"],
  ["skyscraper", "rascacielos", "rascacielo"], ["fireplace", "chimenea", "hogar|chimeneas"], ["refrigerator", "nevera", "frigorifico|frigorífico|refrigerador|neveras"], ["grandstand", "grada", "tribuna|gradas"],
  ["path", "sendero", "senda|camino|senderos|caminos"], ["stairs", "escaleras", "escalera|escalones"], ["runway", "pista", "pistas"], ["case", "vitrina", "estuche|vitrinas"],
  ["pool table", "mesa de billar", "billar"], ["pillow", "almohada", "almohadas"], ["screen door", "mosquitera", "puerta mosquitera"], ["stairway", "escalinata", "escalinatas"],
  ["river", "río", "rio|rios|ríos"], ["bridge", "puente", "puentes"], ["bookcase", "librería", "libreria|biblioteca|librerias|librerías"], ["blind", "persiana", "persianas"],
  ["coffee table", "mesa de centro", "mesita"], ["toilet", "inodoro", "vater|váter|retrete|inodoros"], ["flower", "flor", "flores"], ["book", "libro", "libros"],
  ["hill", "colina", "cerro|loma|colinas|cerros"], ["bench", "banco", "bancos"], ["countertop", "encimera", "encimeras"], ["stove", "cocina", "fogon|fogón|estufa"],
  ["palm", "palmera", "palma|palmeras|palmas"], ["kitchen island", "isla de cocina", "isla"], ["computer", "ordenador", "computadora|computador|pc|ordenadores"], ["swivel chair", "silla giratoria", "sillas giratorias"],
  ["boat", "barco", "bote|barca|lancha|barcos|botes|barcas|lanchas"], ["bar", "bar", "bares"], ["arcade machine", "máquina recreativa", "maquina recreativa|recreativa"], ["hovel", "choza", "cabaña|cabana|chozas"],
  ["bus", "autobús", "bus|autobus|guagua|autobuses|buses"], ["towel", "toalla", "toallas"], ["light", "luz", "foco|bombilla|luces|focos|bombillas"], ["truck", "camión", "camion|camiones"],
  ["tower", "torre", "torres"], ["chandelier", "lámpara de araña", "lampara de arana|candelabro"], ["awning", "toldo", "toldos"], ["streetlight", "farola", "farol|alumbrado|farolas|faroles"],
  ["booth", "cabina", "puesto|caseta|cabinas"], ["television receiver", "televisión", "television|tele|televisor|tv|televisores"], ["airplane", "avión", "avion|aviones|aeroplano"], ["dirt track", "camino de tierra", "pista de tierra"],
  ["apparel", "ropa", "prenda|prendas|vestido|vestimenta|vestidos"], ["pole", "poste", "palo|mastil|mástil|postes"], ["land", "terreno", "terrenos"], ["bannister", "pasamanos", "pasamano"],
  ["escalator", "escalera mecánica", "escalera mecanica|escaleras mecanicas|escaleras mecánicas"], ["ottoman", "puf", "pouf|otomana|pufs"], ["bottle", "botella", "botellas"], ["buffet", "aparador", "bufe|bufé|aparadores"],
  ["poster", "póster", "poster|afiche|posters|pósteres|posteres"], ["stage", "escenario", "tarima|escenarios"], ["van", "furgoneta", "van|furgonetas|furgon|furgón"], ["ship", "buque", "nave|buques|naves"],
  ["fountain", "fuente", "fuentes"], ["conveyer belt", "cinta transportadora", "cinta"], ["canopy", "dosel", "marquesina|doseles"], ["washer", "lavadora", "lavadoras"],
  ["plaything", "juguete", "juguetes"], ["swimming pool", "piscina", "alberca|pileta|piscinas"], ["stool", "taburete", "taburetes"], ["barrel", "barril", "tonel|barriles"],
  ["basket", "cesta", "cesto|canasta|cestas"], ["waterfall", "cascada", "catarata|cascadas"], ["tent", "tienda de campaña", "tienda de campana|carpa|tienda|carpas"], ["bag", "bolsa", "bolso|mochila|bolsas|bolsos|mochilas"],
  ["minibike", "moto", "motocicleta|motos|scooter|motocicletas"], ["cradle", "cuna", "cunas"], ["oven", "horno", "hornos"], ["ball", "pelota", "balon|balón|bola|pelotas|bolas"],
  ["food", "comida", "alimento|alimentos|comidas"], ["step", "peldaño", "peldano|escalon|escalón|peldaños"], ["tank", "depósito", "deposito|tanque|tanques"], ["trade name", "marca", "marcas"],
  ["microwave", "microondas", "microonda"], ["pot", "maceta", "olla|tiesto|macetas|ollas"], ["animal", "animal", "animales|perro|perros|gato|gatos|caballo|caballos|vaca|vacas|oveja|ovejas|pajaro|pájaro|ave|aves|pajaros|pájaros"], ["bicycle", "bicicleta", "bici|bicicletas|bicis"],
  ["lake", "lago", "lagos"], ["dishwasher", "lavavajillas", "lavavajilla"], ["screen", "pantalla", "pantallas"], ["blanket", "manta", "cobija|colcha|mantas"],
  ["sculpture", "escultura", "estatua|esculturas|estatuas"], ["hood", "campana", "campana extractora"], ["sconce", "aplique", "apliques"], ["vase", "jarrón", "jarron|florero|jarrones|floreros"],
  ["traffic light", "semáforo", "semaforo|semáforos|semaforos"], ["tray", "bandeja", "bandejas"], ["ashcan", "papelera", "cubo de basura|basura|contenedor|papeleras"], ["fan", "ventilador", "ventiladores"],
  ["pier", "muelle", "embarcadero|muelles"], ["crt screen", "monitor antiguo", "pantalla crt"], ["plate", "plato", "platos"], ["monitor", "monitor", "monitores"],
  ["bulletin board", "tablón", "tablon|corcho|tablones"], ["shower", "ducha", "duchas"], ["radiator", "radiador", "radiadores"], ["glass", "vaso", "copa|vasos|copas"],
  ["clock", "reloj", "relojes"], ["flag", "bandera", "banderas"]
];

const strip = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/* Índice: texto sin acentos → clase (0-149). Los plurales se resuelven quitando «s»/«es». */
const INDEX = new Map();
CLASSES.forEach((c, i) => {
  for(const w of [c[0], c[1], ...c[2].split("|")]){ const k = strip(w); if(k && !INDEX.has(k)) INDEX.set(k, i); }
});
export function classOf(word){
  const k = strip(word);
  if(INDEX.has(k)) return INDEX.get(k);
  if(k.endsWith("es") && INDEX.has(k.slice(0, -2))) return INDEX.get(k.slice(0, -2));
  if(k.endsWith("s") && INDEX.has(k.slice(0, -1))) return INDEX.get(k.slice(0, -1));
  return -1;
}
/** Grupos de clases que una palabra general abarca (varias clases ADE20K) */
const GROUPS = {
  "vehiculo": ["car", "bus", "truck", "van", "airplane", "boat", "ship", "minibike", "bicycle"], "vehiculos": ["car", "bus", "truck", "van", "airplane", "boat", "ship", "minibike", "bicycle"],
  "naturaleza": ["tree", "grass", "plant", "flower", "mountain", "hill", "rock", "sand", "water", "sea", "river", "lake", "waterfall", "field", "palm"],
  "vegetacion": ["tree", "grass", "plant", "flower", "palm"], "agua": ["water", "sea", "river", "lake", "waterfall", "swimming pool", "fountain"],
  "muebles": ["table", "chair", "sofa", "armchair", "bed", "cabinet", "desk", "wardrobe", "bookcase", "shelf", "chest of drawers", "stool", "bench", "ottoman", "coffee table", "buffet"],
  "mueble": ["table", "chair", "sofa", "armchair", "bed", "cabinet", "desk", "wardrobe", "bookcase", "shelf", "chest of drawers", "stool", "bench", "ottoman", "coffee table", "buffet"],
  "edificios": ["building", "house", "skyscraper", "tower", "hovel"], "construcciones": ["building", "house", "skyscraper", "tower", "hovel", "bridge"],
  "suelos": ["floor", "road", "sidewalk", "path", "earth", "sand", "dirt track", "runway", "land"], "pantallas": ["screen", "monitor", "television receiver", "crt screen", "computer"],
  "luces": ["lamp", "light", "chandelier", "streetlight", "sconce"], "animales": ["animal"]
};
const NAME_INDEX = new Map(CLASSES.map((c, i) => [c[0], i]));
for(const [k, names] of Object.entries(GROUPS)) GROUPS[k] = names.map(n => NAME_INDEX.get(n)).filter(i => i !== undefined);

/* ── Colores ─────────────────────────────────────────────────── */
export const COLORS = {
  rojo: ["roj", "red"], naranja: ["naranj", "orange"], amarillo: ["amarill", "yellow"], verde: ["verd", "green"], azul: ["azul", "blue"], morado: ["morad", "violet", "purpur", "purple", "lila"],
  rosa: ["rosa", "pink", "rosad"], marron: ["marron", "cafe", "brown", "pardo"], blanco: ["blanc", "white"], negro: ["negr", "black"], gris: ["gris", "gray", "grey", "plate"]
};
export function colorOf(word){
  const k = strip(word);
  for(const [name, stems] of Object.entries(COLORS)) for(const s of stems) if(k === s || (k.startsWith(s) && k.length <= s.length + 3)) return name;
  return null;
}

/** Pertenencia 0-1 de un color RGB (0-255) a un nombre de color (con bordes suaves). */
export function colorMembership(r, g, b, name){
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, d = mx - mn, v = mx, s = mx ? d / mx : 0;
  const ramp = (x, a, b2) => x <= a ? 0 : x >= b2 ? 1 : (x - a) / (b2 - a);
  if(name === "negro") return 1 - ramp(v, 0.14, 0.26);
  if(name === "blanco") return ramp(v, 0.7, 0.82) * (1 - ramp(s, 0.1, 0.2));
  if(name === "gris") return (1 - ramp(s, 0.1, 0.2)) * ramp(v, 0.14, 0.26) * (1 - ramp(v, 0.7, 0.82));
  let h = 0;
  if(d){ h = mx === r / 255 ? ((g - b) / 255 / d) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4; h = (h * 60 + 360) % 360; }
  const sat = ramp(s, 0.2, 0.35) * ramp(v, 0.14, 0.26);
  // Banda de tono [lo, hi] (puede cruzar 0°): 1 dentro, caída suave de `soft` grados fuera
  const band = (lo, hi, soft = 10) => { const w = ((hi - lo + 360) % 360) / 2, c = (lo + w) % 360, dd = Math.abs(((h - c + 540) % 360) - 180); return 1 - ramp(dd, w, w + soft); };
  switch(name){
    case "rojo": return sat * band(345, 15);
    case "naranja": return sat * band(16, 44) * (1 - 0.0);
    case "amarillo": return sat * band(46, 70);
    case "verde": return sat * band(72, 165);
    case "azul": return sat * band(175, 255);
    case "morado": return sat * band(262, 300);
    case "rosa": return sat * band(300, 346) * ramp(v, 0.5, 0.65);
    case "marron": return ramp(s, 0.25, 0.4) * band(10, 45) * ramp(v, 0.14, 0.24) * (1 - ramp(v, 0.5, 0.65));
    default: return 1;
  }
}

/* ── Análisis de la frase ────────────────────────────────────── */
const FILLER = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "todo", "toda", "todos", "todas", "selecciona", "seleccionar", "elige", "elegir", "marca", "marcar", "quiero", "solo", "sólo", "el", "mi", "mis", "que", "hay", "en", "foto", "imagen"]);

/**
 * @returns { terms: [{ classes: [canal…], color, neg, label }], unknown: [palabras], empty }
 */
export function parseQuery(text){
  // Se conservan comas y «+» hasta partir la frase (strip los quitaría)
  const raw = String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n").replace(/[^a-z0-9 ,+]+/g, " ").replace(/\s+/g, " ").trim();
  const unknown = [], terms = [];
  if(!raw) return { terms, unknown, empty: true };
  // «A sin B» = A y (resta B): se parte antes de sin / excepto / menos y se marca el trozo negativo
  const parts = raw.replace(/\b(sin|excepto|menos|ni)\b/g, ",!").split(/\s*(?:,|\+|\by\b|\be\b|\bmas\b|\band\b)\s*/).map(s => s.trim()).filter(Boolean);
  for(let part of parts){
    let neg = false;
    if(part.startsWith("!")){ neg = true; part = part.slice(1).trim(); }
    let words = part.split(" ").filter(Boolean);
    if(words[0] === "no" && words.length > 1){ neg = true; words = words.slice(1); }
    words = words.filter(w => !FILLER.has(w) || w === "de");
    let color = null, colorWord = ""; const rest = [];
    for(let i = 0; i < words.length; i++){
      const c = colorOf(words[i]);
      if(c && !(words.length === 1 && classOf(words[i]) >= 0)){ color = c; colorWord = words[i]; } else rest.push(words[i]);
    }
    // El nombre puede tener varias palabras («mesa de billar»): se prueba entero y, si no, palabra a palabra
    const phrase = rest.filter((w, i) => !(w === "de" && i === rest.length - 1)).join(" ");
    let cls = [];
    const whole = classOf(phrase);
    if(whole >= 0) cls = [whole + 1];
    else if(GROUPS[strip(phrase)]) cls = GROUPS[strip(phrase)].map(i => i + 1);
    else for(const w of rest){
      if(w === "de") continue;
      const i = classOf(w);
      if(i >= 0) cls.push(i + 1);
      else if(GROUPS[strip(w)]) cls.push(...GROUPS[strip(w)].map(j => j + 1));
      else unknown.push(w);
    }
    if(!cls.length){
      if(color && !rest.length) { terms.push({ classes: [], color, neg, label: colorWord || color }); }   // «rojo» a secas: todo lo rojo
      continue;
    }
    const uniq = [...new Set(cls)], name = uniq.length === 1 ? CLASSES[uniq[0] - 1][1] : phrase;     // con tilde, como en la lista
    terms.push({ classes: uniq, color, neg, label: (color ? name + " " + colorWord : name) });
  }
  return { terms, unknown, empty: false };
}

/** Ejemplos de frases para la ayuda de la ventana */
export const EXAMPLES = ["persona", "cielo", "coche rojo", "césped y árboles", "edificio sin cielo", "agua azul"];
