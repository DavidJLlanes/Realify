/* ═══════════════════════════════════════════════════════════════
   ESPAÑOL → INGLÉS para la selección por descripción libre (CLIPSeg, fase 20)
   CLIP se entrenó casi sólo con texto en inglés: «una taza azul» funciona a medias y «un pez» casi nada, mientras que «a blue cup» y
   «a fish» van bien. Antes de enviar la descripción al modelo se traducen las palabras habituales con este diccionario (objetos,
   animales, comida, ropa, lugares, colores, materiales y adjetivos corrientes); lo que no está, pasa tal cual (nombres propios,
   palabras ya en inglés). Sin DOM; lo usan también las pruebas.
   ═══════════════════════════════════════════════════════════════ */

const PAIRS = `
persona:person|personas:people|gente:people|hombre:man|hombres:men|mujer:woman|mujeres:women|niño:child|niña:girl|niños:children|nino:child|nina:girl|ninos:children|bebé:baby|bebe:baby|chico:boy|chica:girl|anciano:old man|cara:face|rostro:face|cabeza:head|pelo:hair|cabello:hair|barba:beard|bigote:mustache|ojo:eye|ojos:eyes|nariz:nose|boca:mouth|labios:lips|diente:tooth|dientes:teeth|oreja:ear|mano:hand|manos:hands|dedo:finger|pie:foot|pies:feet|pierna:leg|brazo:arm|cuerpo:body|espalda:back|
perro:dog|perros:dogs|gato:cat|gatos:cats|caballo:horse|vaca:cow|oveja:sheep|cerdo:pig|cabra:goat|pájaro:bird|pajaro:bird|pájaros:birds|ave:bird|pato:duck|gallina:chicken|pollo:chicken|loro:parrot|búho:owl|buho:owl|águila:eagle|aguila:eagle|pez:fish|peces:fish|tiburón:shark|tiburon:shark|ballena:whale|delfín:dolphin|delfin:dolphin|tortuga:turtle|serpiente:snake|lagarto:lizard|rana:frog|mariposa:butterfly|abeja:bee|araña:spider|arana:spider|hormiga:ant|mosca:fly|conejo:rabbit|ratón:mouse|raton:mouse|rata:rat|zorro:fox|lobo:wolf|oso:bear|elefante:elephant|jirafa:giraffe|cebra:zebra|león:lion|leon:lion|tigre:tiger|mono:monkey|gorila:gorilla|ciervo:deer|animal:animal|animales:animals|
coche:car|coches:cars|carro:car|auto:car|autobús:bus|autobus:bus|camión:truck|camion:truck|furgoneta:van|moto:motorcycle|motocicleta:motorcycle|bicicleta:bicycle|bici:bicycle|tren:train|avión:airplane|avion:airplane|helicóptero:helicopter|helicoptero:helicopter|barco:boat|bote:boat|velero:sailboat|taxi:taxi|tractor:tractor|patinete:scooter|monopatín:skateboard|monopatin:skateboard|rueda:wheel|ruedas:wheels|matrícula:license plate|matricula:license plate|
casa:house|edificio:building|edificios:buildings|puerta:door|ventana:window|techo:roof|tejado:roof|pared:wall|muro:wall|suelo:floor|escalera:stairs|escaleras:stairs|puente:bridge|torre:tower|iglesia:church|castillo:castle|valla:fence|calle:street|carretera:road|camino:path|acera:sidewalk|plaza:square|farola:street lamp|semáforo:traffic light|semaforo:traffic light|señal:sign|senal:sign|cartel:sign|letrero:sign|bandera:flag|tienda:shop|ventanas:windows|balcón:balcony|balcon:balcony|chimenea:chimney|jardín:garden|jardin:garden|
mesa:table|silla:chair|sillas:chairs|sofá:sofa|sofa:sofa|cama:bed|almohada:pillow|cojín:cushion|cojin:cushion|manta:blanket|alfombra:rug|cortina:curtain|lámpara:lamp|lampara:lamp|luz:light|espejo:mirror|cuadro:painting|foto:photo|fotografía:photograph|fotografia:photograph|estantería:shelf|estanteria:shelf|libro:book|libros:books|armario:wardrobe|cajón:drawer|cajon:drawer|escritorio:desk|ordenador:computer|computadora:computer|portátil:laptop|portatil:laptop|pantalla:screen|monitor:monitor|teclado:keyboard|ratón:mouse|teléfono:phone|telefono:phone|móvil:phone|movil:phone|cámara:camera|camara:camera|televisión:television|television:television|tele:television|radio:radio|reloj:clock|nevera:refrigerator|frigorífico:refrigerator|frigorifico:refrigerator|horno:oven|fregadero:sink|lavabo:sink|grifo:faucet|bañera:bathtub|banera:bathtub|inodoro:toilet|ducha:shower|toalla:towel|
taza:cup|tazas:cups|vaso:glass|copa:wine glass|botella:bottle|plato:plate|platos:plates|cuenco:bowl|bol:bowl|cuchara:spoon|tenedor:fork|cuchillo:knife|sartén:pan|sarten:pan|olla:pot|jarra:jug|jarrón:vase|jarron:vase|caja:box|cajas:boxes|bolsa:bag|bolso:handbag|mochila:backpack|maleta:suitcase|paraguas:umbrella|llave:key|llaves:keys|tijeras:scissors|lápiz:pencil|lapiz:pencil|bolígrafo:pen|boligrafo:pen|papel:paper|carta:letter|sobre:envelope|cartel:poster|póster:poster|poster:poster|globo:balloon|pelota:ball|balón:ball|balon:ball|juguete:toy|muñeca:doll|muneca:doll|peluche:teddy bear|vela:candle|regalo:gift|moneda:coin|dinero:money|
manzana:apple|manzanas:apples|plátano:banana|platano:banana|banana:banana|naranja:orange|limón:lemon|limon:lemon|fresa:strawberry|uva:grape|uvas:grapes|sandía:watermelon|sandia:watermelon|piña:pineapple|pina:pineapple|pera:pear|cereza:cherry|melocotón:peach|melocoton:peach|tomate:tomato|patata:potato|zanahoria:carrot|cebolla:onion|lechuga:lettuce|pepino:cucumber|pimiento:pepper|seta:mushroom|maíz:corn|maiz:corn|pan:bread|queso:cheese|huevo:egg|huevos:eggs|carne:meat|jamón:ham|jamon:ham|pizza:pizza|hamburguesa:hamburger|bocadillo:sandwich|ensalada:salad|sopa:soup|pasta:pasta|arroz:rice|tarta:cake|pastel:cake|galleta:cookie|helado:ice cream|chocolate:chocolate|café:coffee|cafe:coffee|té:tea|te:tea|cerveza:beer|vino:wine|leche:milk|zumo:juice|agua:water|comida:food|
árbol:tree|arbol:tree|árboles:trees|arboles:trees|hoja:leaf|hojas:leaves|flor:flower|flores:flowers|rosa:rose|planta:plant|plantas:plants|maceta:flower pot|césped:grass|cesped:grass|hierba:grass|arbusto:bush|seto:hedge|palmera:palm tree|bosque:forest|selva:jungle|montaña:mountain|montana:mountain|montañas:mountains|colina:hill|valle:valley|roca:rock|piedra:stone|rocas:rocks|arena:sand|playa:beach|mar:sea|océano:ocean|oceano:ocean|ola:wave|olas:waves|río:river|rio:river|lago:lake|cascada:waterfall|charco:puddle|isla:island|cielo:sky|nube:cloud|nubes:clouds|sol:sun|luna:moon|estrella:star|estrellas:stars|arcoíris:rainbow|arcoiris:rainbow|nieve:snow|hielo:ice|lluvia:rain|niebla:fog|humo:smoke|fuego:fire|llama:flame|rayo:lightning|tierra:soil|barro:mud|desierto:desert|campo:field|prado:meadow|
camiseta:t-shirt|camisa:shirt|pantalón:trousers|pantalon:trousers|pantalones:trousers|vaqueros:jeans|falda:skirt|vestido:dress|chaqueta:jacket|abrigo:coat|jersey:sweater|sudadera:hoodie|traje:suit|corbata:tie|bufanda:scarf|guantes:gloves|calcetín:sock|calcetin:sock|zapato:shoe|zapatos:shoes|zapatilla:sneaker|zapatillas:sneakers|bota:boot|botas:boots|sandalia:sandal|sombrero:hat|gorra:cap|gorro:beanie|casco:helmet|gafas:glasses|gafas de sol:sunglasses|anillo:ring|collar:necklace|pulsera:bracelet|pendiente:earring|cinturón:belt|cinturon:belt|ropa:clothes|uniforme:uniform|bikini:bikini|bañador:swimsuit|banador:swimsuit|
tenis:tennis|futbol:soccer|baloncesto:basketball|golf:golf|guitarra:guitar|piano:piano|violín:violin|violin:violin|batería:drums|bateria:drums|micrófono:microphone|microfono:microphone|altavoz:speaker|auriculares:headphones|trompeta:trumpet|flauta:flute|
cuadrado:square|círculo:circle|circulo:circle|triángulo:triangle|triangulo:triangle|línea:line|linea:line|texto:text|letra:letter|letras:letters|número:number|numero:number|logo:logo|logotipo:logo|marca:brand|sombra:shadow|reflejo:reflection|sombras:shadows|fondo:background|primer plano:foreground|borde:edge|marco:frame|dibujo:drawing|pintura:painting|garabato:scribble|mancha:stain|agujero:hole|grieta:crack|
grande:big|pequeño:small|pequeno:small|enorme:huge|alto:tall|bajo:low|largo:long|corto:short|ancho:wide|estrecho:narrow|viejo:old|antiguo:old|nuevo:new|joven:young|redondo:round|plano:flat|brillante:shiny|oscuro:dark|claro:bright|abierto:open|cerrado:closed|lleno:full|vacío:empty|vacio:empty|sucio:dirty|limpio:clean|roto:broken|mojado:wet|seco:dry|caliente:hot|frío:cold|frio:cold|
de madera:wooden|madera:wood|de metal:metal|metal:metal|de plástico:plastic|plastico:plastic|de cristal:glass|cristal:glass|de papel:paper|de piedra:stone|de cuero:leather|cuero:leather|de tela:fabric|tela:fabric|de oro:golden|dorado:golden|plateado:silver|
rojo:red|roja:red|rojos:red|rojas:red|azul:blue|azules:blue|verde:green|verdes:green|amarillo:yellow|amarilla:yellow|naranja:orange|morado:purple|morada:purple|violeta:purple|rosa:pink|rosado:pink|marrón:brown|marron:brown|café:brown|blanco:white|blanca:white|blancos:white|negro:black|negra:black|negros:black|gris:gray|grises:gray|beige:beige|turquesa:turquoise|
con:with|sin:without|de:of|en:in|sobre:on|bajo:under|junto a:next to|y:and|el:the|la:the|los:the|las:the|un:a|una:a|unos:some|unas:some|del:of the|al:to the|que:that|es:is|está:is|esta:is|hay:there is|
`;
const MAP = new Map();
for(const entry of PAIRS.split("|")){
  const e = entry.trim(); const i = e.indexOf(":"); if(i < 1) continue;
  const key = e.slice(0, i).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n"), val = e.slice(i + 1).trim();
  if(!MAP.has(key)) MAP.set(key, val);
}
const ART = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "que", "es", "esta", "hay"]);
const norm = w => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n");

const STOP = new Set(["a", "an", "the", "with", "without", "of", "in", "on", "under", "next to", "and", "that", "is", "there is", "of the", "to the", "some"]);
const ADJECTIVES = new Set(["big", "small", "huge", "tall", "low", "long", "short", "wide", "narrow", "old", "new", "young", "round", "flat", "shiny", "dark", "bright", "open", "closed", "full", "empty", "dirty", "clean", "broken", "wet", "dry", "hot", "cold",
  "wooden", "metal", "plastic", "glass", "paper", "stone", "leather", "fabric", "golden", "silver", "red", "blue", "green", "yellow", "orange", "purple", "pink", "brown", "white", "black", "gray", "beige", "turquoise"]);

/** Traduce la descripción (se prueban primero las expresiones de tres y de dos palabras) y pone cada adjetivo delante de su nombre
    («taza azul» → «blue cup»). Devuelve { text, changed }. */
export function toEnglish(text){
  const words = String(text || "").toLowerCase().replace(/[^\p{L}\p{N}\s'-]+/gu, " ").split(/\s+/).filter(Boolean), out = [];
  let changed = false;
  for(let i = 0; i < words.length; i++){
    let done = false;
    for(const n of [3, 2]){
      if(i + n > words.length) continue;
      const k = norm(words.slice(i, i + n).join(" "));
      if(MAP.has(k)){ out.push(MAP.get(k)); i += n - 1; changed = done = true; break; }
    }
    if(done) continue;
    const k = norm(words[i]);
    if(ART.has(k)){ changed = true; continue; }                                     // sin artículos: «a/the» no aportan
    if(MAP.has(k)){ out.push(MAP.get(k)); changed = true; continue; }
    const single = k.endsWith("es") && MAP.has(k.slice(0, -2)) ? k.slice(0, -2) : k.endsWith("s") && MAP.has(k.slice(0, -1)) ? k.slice(0, -1) : null;
    if(single){ const v = MAP.get(single); out.push(/s$|y$/.test(v) ? v : v + "s"); changed = true; continue; }
    out.push(words[i]);
  }
  // En español el adjetivo va detrás («taza azul»); en inglés, delante («blue cup»)
  for(let i = 1; i < out.length; i++){
    if(ADJECTIVES.has(out[i]) && !ADJECTIVES.has(out[i - 1]) && !STOP.has(out[i - 1])){
      let j = i - 1; while(j > 0 && ADJECTIVES.has(out[j - 1])) j--;
      const [a] = out.splice(i, 1); out.splice(j, 0, a); changed = true;
    }
  }
  return { text: out.join(" ").trim(), changed };
}
