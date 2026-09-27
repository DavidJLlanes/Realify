/* ═══════════════════════════════════════════════════════════════
   RECETAS DE BLANCO Y NEGRO
   Diez formas de convertir a blanco y negro, cada una con su propia
   mezcla de canales, curva de contraste, recorte de negros/blancos y
   grano —las mismas cuatro decisiones que definían el carácter de
   una copia en un laboratorio químico: qué filtro de color se puso
   delante del objetivo, cuánto contraste dio el papel, dónde se cortó
   el negro y el blanco, y cuánto se notaba la película—.

   Los nombres son inventados a propósito: no son el nombre de nadie
   real, son la sensación que persigue cada receta.
   ═══════════════════════════════════════════════════════════════ */

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

/* Generador determinista: el grano tiene que ser el MISMO cada vez
   que se renderiza la misma receta sobre la misma imagen —para que la
   miniatura de la rejilla y el resultado final coincidan, y para que
   dos aplicaciones seguidas no den un grano distinto—, así que nada
   de Math.random(). Un LCG barato basta para esto: no hace falta que
   sea criptográfico, sólo repetible. */
function seededNoise(seed){
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* Curva en S alrededor del gris medio: sube luces y baja sombras a la
   vez, que es lo que da la sensación de «contraste de papel» en vez
   de simplemente estirar el histograma. `amount` en 0..1. */
function contrastCurve(v, amount){
  // amount en -1..1. Positivo separa los extremos alrededor del gris
  // medio (más contraste); negativo los acerca (menos contraste, el
  // aire «documental» de una copia plana). Un único factor de escala,
  // simétrico en los dos sentidos: en amount=1 el factor es 2.8×, en
  // amount=-1 es 1/2.8×, y en 0 no toca nada.
  if(amount === 0) return v;
  const x = v - 128;
  const factor = amount > 0 ? 1 + amount * 1.8 : 1 / (1 - amount * 1.8);
  return clamp255(x * factor + 128);
}

/**
 * @param {Uint8ClampedArray} data RGBA en sitio
 * @param {number} w
 * @param {number} h
 * @param {object} recipe uno de BW_RECIPES
 */
export function applyBWRecipe(data, w, h, recipe){
  const t = recipe.r + recipe.g + recipe.b || 1;
  const wr = recipe.r / t, wg = recipe.g / t, wb = recipe.b / t;
  const { blackPoint = 0, whitePoint = 255, contrast = 0, grain = 0 } = recipe;
  const span = Math.max(1, whitePoint - blackPoint);
  const rand = grain > 0 ? seededNoise(0x9e3779b9 ^ (w * 73856093) ^ (h * 19349663)) : null;

  for(let p = 0, i = 0; p < w * h; p++, i += 4){
    let v = data[i] * wr + data[i+1] * wg + data[i+2] * wb;
    v = clamp255((v - blackPoint) * 255 / span);
    v = contrastCurve(v, contrast);
    if(rand){
      // Grano fino centrado en 0, más visible en tonos medios que en
      // negros y blancos puros —como el grano de película real, que
      // se ve menos en las zonas ya saturadas—.
      const g = (rand() - 0.5) * 2 * grain;
      const mid = 1 - Math.abs(v / 255 - 0.5) * 1.4;
      v = clamp255(v + g * Math.max(0, mid));
    }
    data[i] = data[i+1] = data[i+2] = v;
  }
}

/* Dieciocho recetas. `r+g+b` no hace falta que sumen 100: se
   normalizan solas dentro de `applyBWRecipe`. */
export const BW_RECIPES = [
  { id:"plata",    name:"Plata Vieja",     r:30, g:59, b:11, contrast:0.08, blackPoint:4,  whitePoint:250, grain:2,
    note:"Luminancia clásica con un contraste suave: el punto de partida neutro, sin filtro de color." },
  { id:"plomo",    name:"Cielo de Plomo",  r:62, g:27, b:11, contrast:0.34, blackPoint:8,  whitePoint:248, grain:5,
    note:"Filtro rojo fuerte: oscurece el cielo azul y aclara la piel, con negros profundos." },
  { id:"niebla",   name:"Niebla de Archivo", r:34, g:33, b:33, contrast:-0.18, blackPoint:14, whitePoint:236, grain:3,
    note:"Plano y documental, sin negros ni blancos puros: el aire de un archivo antiguo." },
  { id:"grano",    name:"Grano de Calle",  r:38, g:41, b:21, contrast:0.42, blackPoint:6,  whitePoint:246, grain:14,
    note:"Alto contraste y grano marcado: fotografía de calle, con textura de película rápida." },
  { id:"estudio",  name:"Luz de Estudio",  r:24, g:56, b:20, contrast:0.05, blackPoint:2,  whitePoint:253, grain:0,
    note:"Gradación suave y limpia, casi sin grano: el tono cremoso de un retrato de estudio." },
  { id:"sombra",   name:"Sombra Profunda", r:35, g:45, b:20, contrast:0.62, blackPoint:16, whitePoint:238, grain:6,
    note:"Contraste dramático, negros que se cierran del todo: la escena se vuelve gráfica." },
  { id:"museo",    name:"Placa de Museo",  r:28, g:52, b:20, contrast:-0.05, blackPoint:10, whitePoint:242, grain:8,
    note:"Tono suave y grano visible, como una copia antigua conservada en una vitrina." },
  { id:"neon",     name:"Noche de Neón",   r:15, g:30, b:55, contrast:0.28, blackPoint:5,  whitePoint:249, grain:4,
    note:"Filtro azul: oscurece pieles y cálidos, ilumina cielos y neones. Ambiente nocturno." },
  { id:"vencido",  name:"Papel Vencido",   r:32, g:38, b:30, contrast:-0.30, blackPoint:20, whitePoint:225, grain:10,
    note:"Contraste bajo y negros que nunca llegan a cerrar: el aspecto de un papel ya gastado." },
  { id:"contraluz",name:"Contraluz Total", r:33, g:50, b:17, contrast:0.85, blackPoint:24, whitePoint:230, grain:3,
    note:"Casi sin medios tonos: la imagen se separa en blancos y negros puros, muy gráfica." },
  { id:"verde",    name:"Filtro Verde",    r:14, g:72, b:14, contrast:0.14, blackPoint:6,  whitePoint:247, grain:2,
    note:"Filtro verde clásico de retrato: aclara la vegetación y suaviza el tono de piel." },
  { id:"infrarrojo",name:"Infrarrojo de Campo", r:4, g:92, b:4, contrast:0.55, blackPoint:2, whitePoint:255, grain:5,
    note:"Peso casi entero en el verde, al límite: cielos casi negros y follaje casi blanco, como una IR B/N." },
  { id:"prensa",   name:"Papel de Prensa", r:36, g:44, b:20, contrast:0.30, blackPoint:18, whitePoint:232, grain:11,
    note:"Contraste de tabloide y grano de trama, con el blanco algo sucio de la impresión offset." },
  { id:"cenital",  name:"Luz Cenital",     r:27, g:54, b:19, contrast:-0.10, blackPoint:0,  whitePoint:255, grain:0,
    note:"Altísima clave: blancos puros sin recortar, negros que apenas se cierran. Producto y moda clara." },
  { id:"carbon",   name:"Carbón y Ceniza", r:32, g:48, b:20, contrast:0.40, blackPoint:28, whitePoint:220, grain:0,
    note:"Muy oscura y sin grano: negros que se comen media escena, pero la superficie queda lisa." },
  { id:"cian",     name:"Cianotipia Gris", r:12, g:38, b:50, contrast:0.02, blackPoint:6,  whitePoint:244, grain:1,
    note:"Filtro cian-azulado casi neutro en contraste: el aire frío de una prueba de laboratorio." },
  { id:"calido",   name:"Retrato Cálido",  r:42, g:44, b:14, contrast:0.16, blackPoint:5,  whitePoint:249, grain:3,
    note:"Rojo y verde a la par, azul casi fuera: mantiene la piel suave sin el filtro rojo a fondo." },
  { id:"grafico",  name:"Alto Contraste Gráfico", r:33, g:50, b:17, contrast:0.98, blackPoint:10, whitePoint:245, grain:0,
    note:"Casi binaria y sin grano que la suavice: el cartel serigrafiado, no la fotografía de calle." }
];
