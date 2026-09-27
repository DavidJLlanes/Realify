/* ═══════════════════════════════════════════════════════════════
   ESTILOS
   Más de ciento cincuenta looks (treinta clásicos y el catálogo
   ampliado de más abajo), por categorías y con buscador, construidos exactamente igual que el ajuste de
   Curvas manual: una curva maestra de contraste, una curva por canal
   para el tinte de color, y un empujón de saturación. Ningún nombre
   ni ninguna receta copia un filtro concreto de ninguna aplicación:
   son combinaciones propias que persiguen el mismo tipo de resultado
   —cálido y desvaído, frío y contrastado, pastel, etc.— con las
   herramientas que ya tiene este editor.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { runAdjust } from "../editor/adjust.js";
import { curveLut } from "../editor/curves.js";
import { rgbToHsl, hslToRgb } from "../editor/adjustments.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";

const IDN = [[0,0],[255,255]];

export const LOOKS = [
  { name:"Nostalgia",
    curves:{ rgb:[[0,16],[128,136],[255,242]], b:[[0,20],[200,190],[255,220]] },
    sat: -12 },
  { name:"Medianoche",
    curves:{ rgb:[[0,0],[70,50],[190,190],[255,250]], b:[[0,15],[255,255]] },
    sat: -6 },
  { name:"Polaroid 79",
    curves:{ rgb:[[0,24],[110,120],[255,235]], r:[[0,10],[255,250]], b:[[0,0],[255,215]] },
    sat: -18 },
  { name:"Frío Ártico",
    curves:{ rgb:[[0,5],[128,135],[255,255]], r:[[0,0],[255,235]], b:[[0,25],[255,255]] },
    sat: -8 },
  { name:"Kodak Clásico",
    curves:{ rgb:[[0,0],[60,45],[190,205],[255,255]], r:[[0,5],[255,255]] },
    sat: 22 },
  { name:"Sepia Urbano",
    curves:{ rgb:[[0,20],[128,130],[255,235]], r:[[0,20],[255,240]], g:[[0,10],[255,215]], b:[[0,0],[255,170]] },
    sat: -55 },
  { name:"Alto Contraste Mono",
    curves:{ rgb:[[0,0],[90,60],[170,200],[255,255]] },
    sat: -100 },
  { name:"Pastel Suave",
    curves:{ rgb:[[0,35],[128,140],[255,235]] },
    sat: -25 },
  { name:"Neón Nocturno",
    curves:{ rgb:[[0,0],[80,55],[190,205],[255,255]], b:[[0,10],[255,255]] },
    sat: 45 },
  { name:"Vintage Desvanecido",
    curves:{ rgb:[[0,30],[128,130],[255,220]], r:[[0,15],[255,235]], b:[[0,5],[255,200]] },
    sat: -30 },
  { name:"Technicolor",
    curves:{ rgb:[[0,0],[70,50],[190,205],[255,255]] },
    sat: 55 },
  { name:"Blanco Frío",
    curves:{ rgb:[[0,10],[128,145],[255,255]], b:[[0,15],[255,255]] },
    sat: -5 },

  /* ── vintage ──────────────────────────────────────────────────
     Cada uno imita el comportamiento característico de una película
     o un proceso concretos. Lo que define a una emulsión antigua no
     es un tono plano encima, sino cómo reparte la densidad por
     canal: el negro levantado de una copia vieja, el azul que se
     agarra a las sombras de un revelado cruzado, el amarillo que se
     come las luces del Super 8. Todo eso se expresa con curvas
     distintas por canal, que es justo lo que hay aquí. */

  { name:"Kodachrome 64",
    // Contraste alto, rojos densos y sombras que tiran a cian: la
    // firma de la diapositiva de Kodak de los 60 y 70.
    curves:{ rgb:[[0,0],[58,38],[190,208],[255,255]],
             r:[[0,8],[120,132],[255,255]],
             g:[[0,4],[255,248]],
             b:[[0,14],[128,120],[255,236]] },
    sat: 26 },

  { name:"Ektachrome",
    curves:{ rgb:[[0,4],[64,52],[190,203],[255,252]],
             r:[[0,0],[255,240]],
             b:[[0,16],[128,140],[255,255]] },
    sat: 14 },

  { name:"Agfacolor 50",
    // Amarillo-verdoso desvaído, el aspecto de una foto familiar de
    // los años cincuenta que lleva medio siglo en un álbum.
    curves:{ rgb:[[0,34],[128,132],[255,224]],
             r:[[0,26],[255,232]],
             g:[[0,24],[255,226]],
             b:[[0,12],[128,112],[255,186]] },
    sat: -34 },

  { name:"Revelado Cruzado",
    // E-6 revelado en C-41: negros azulados, luces amarillas que se
    // van, y un contraste que se sale de madre.
    curves:{ rgb:[[0,0],[48,26],[200,224],[255,255]],
             r:[[0,0],[70,58],[255,255]],
             g:[[0,6],[128,128],[255,246]],
             b:[[0,42],[128,128],[255,214]] },
    sat: 34 },

  { name:"Super 8",
    // Cine doméstico: negro levantado por el paso del tiempo, poco
    // contraste y una dominante cálida de bombilla.
    curves:{ rgb:[[0,40],[128,134],[255,228]],
             r:[[0,42],[255,240]],
             g:[[0,36],[255,224]],
             b:[[0,26],[128,116],[255,196]] },
    sat: -20 },

  { name:"VHS",
    // Copia de copia: negros que nunca llegan a negro, blancos que
    // nunca llegan a blanco y azules que se desbordan.
    curves:{ rgb:[[0,26],[128,132],[255,232]],
             r:[[0,22],[128,138],[255,238]],
             g:[[0,24],[255,228]],
             b:[[0,30],[128,136],[255,242]] },
    sat: -12 },

  { name:"Kodak Gold",
    curves:{ rgb:[[0,6],[70,62],[190,200],[255,252]],
             r:[[0,10],[128,140],[255,255]],
             g:[[0,4],[128,132],[255,248]],
             b:[[0,0],[128,116],[255,222]] },
    sat: 18 },

  { name:"Velvia",
    // Diapositiva de paisaje: saturación agresiva y verdes densos.
    curves:{ rgb:[[0,0],[52,32],[196,214],[255,255]],
             r:[[0,2],[255,255]],
             g:[[0,0],[128,134],[255,255]],
             b:[[0,6],[255,246]] },
    sat: 48 },

  { name:"Lomo",
    curves:{ rgb:[[0,0],[44,20],[200,228],[255,255]],
             r:[[0,6],[128,142],[255,255]],
             g:[[0,2],[255,244]],
             b:[[0,20],[128,118],[255,232]] },
    sat: 32 },

  { name:"Cine Descolorido",
    // Blanqueo omitido: contraste de cine y casi nada de color.
    curves:{ rgb:[[0,8],[56,36],[196,218],[255,250]] },
    sat: -62 },

  { name:"Albúmina",
    // Copia a la albúmina del XIX: monocromo cálido y luces suaves.
    curves:{ rgb:[[0,22],[128,140],[255,238]],
             r:[[0,30],[255,252]],
             g:[[0,20],[255,222]],
             b:[[0,6],[255,168]] },
    sat: -88 },

  { name:"Daguerrotipo",
    // Placa de plata: casi monocroma, fría y con un contraste duro.
    curves:{ rgb:[[0,0],[64,40],[190,212],[255,246]],
             r:[[0,0],[255,236]],
             g:[[0,2],[255,242]],
             b:[[0,10],[255,255]] },
    sat: -92 },

  { name:"Autocromo 1907",
    // Placas de fécula de patata teñida, el primer proceso de color
    // comercial: la trama de grano deja un color suave y como
    // filtrado, con un velo magenta muy suave en las luces.
    curves:{ rgb:[[0,26],[128,132],[255,232]],
             r:[[0,20],[128,140],[255,238]],
             g:[[0,18],[255,220]],
             b:[[0,24],[128,136],[255,228]] },
    sat: -22 },

  { name:"Cianotipo",
    // Proceso de hierro del XIX: el rojo y el verde quedan muy por
    // debajo del azul de Prusia, que domina toda la imagen de punta a
    // punta —no es un tinte encima, es la química real del papel—.
    curves:{ rgb:[[0,0],[80,55],[190,215],[255,255]],
             r:[[0,0],[255,150]],
             g:[[0,0],[255,190]],
             b:[[0,50],[128,175],[255,255]] },
    sat: 10 },

  { name:"Ferrotipo Húmedo",
    // Colodión húmedo sobre metal: contraste muy duro, negros que se
    // cierran del todo y un frío metálico en vez de la plata cálida
    // del daguerrotipo.
    curves:{ rgb:[[0,0],[80,42],[180,214],[255,248]],
             r:[[0,0],[255,232]],
             g:[[0,0],[255,240]],
             b:[[0,6],[255,255]] },
    sat: -95 },

  { name:"SX-70 Original",
    // El revelado instantáneo original de Polaroid, distinto de la
    // «Polaroid 79»: sombras con un velo magenta y un contraste bajo
    // muy particular, más suave y más cálido.
    curves:{ rgb:[[0,30],[110,116],[255,238]],
             r:[[0,26],[128,138],[255,244]],
             g:[[0,14],[255,226]],
             b:[[0,24],[128,120],[255,206]] },
    sat: -14 },

  { name:"Superia 90s",
    // Negativo de consumo japonés de los noventa: verdes fríos, un
    // contraste marcado en las luces y una saturación generosa sin
    // llegar a empastar.
    curves:{ rgb:[[0,2],[64,50],[190,206],[255,254]],
             r:[[0,4],[255,246]],
             g:[[0,0],[128,126],[255,242]],
             b:[[0,10],[255,238]] },
    sat: 24 },

  { name:"Bicolor 1922",
    // Dos tiras, roja y verde, sin ninguna emulsión sensible al azul:
    // el cine en color de comienzos de los años veinte no tenía forma
    // de registrar un azul de verdad, así que el cielo sale verdoso y
    // la piel, muy cálida.
    curves:{ rgb:[[0,0],[70,48],[190,210],[255,252]],
             r:[[0,10],[128,148],[255,255]],
             g:[[0,6],[128,136],[255,248]],
             b:[[0,40],[128,110],[255,190]] },
    sat: 30 }
];

/* ── Catálogo ampliado ─────────────────────────────────────────────
   Los estilos nuevos se describen con unos pocos parámetros de
   fotógrafo y se traducen a las mismas curvas por canal que los de
   arriba (ver `build`), más un virado partido opcional —un color en
   las sombras y otro en las luces— que es lo que da el aspecto de
   cine, los duotonos y los blanco y negro virados.

   [nombre, categoría, contraste, desvaído, calidez, tinte, saturación,
    sombras, luces, fuerza del virado]
     · contraste −40…60 (curva en S o suavizado)
     · desvaído 0…60 (negro levantado y blanco apagado)
     · calidez −40…40 (+ cálido, − frío) y tinte −30…30 (+ magenta)
     · saturación −100…80
     · sombras / luces: colores del virado; fuerza 0…1

   IMPORTANTE: los estilos se guardan en las capas por su POSICIÓN en
   LOOKS, así que los nuevos siempre se añaden al final. */
const X = [
  // Retrato
  ["Piel luminosa", "Retrato", 8, 10, 10, 4, -6, "#3a2f36", "#ffe4cf", .18],
  ["Retrato suave", "Retrato", -10, 18, 8, 2, -14, null, "#fff0e0", .12],
  ["Retrato editorial", "Retrato", 22, 6, 4, 0, -20, "#1e2a33", "#f5dcc5", .2],
  ["Melocotón", "Retrato", 4, 16, 14, 8, -4, "#4a3040", "#ffd7b8", .22],
  ["Porcelana", "Retrato", 6, 14, -6, 2, -30, "#2b2f3a", "#f4f1ee", .15],
  ["Bronceado", "Retrato", 16, 4, 20, -2, 10, "#3a2418", "#ffd29a", .2],
  ["Estudio neutro", "Retrato", 14, 0, 0, 0, 0, null, null, 0],
  ["Retrato de ventana", "Retrato", 18, 8, -4, 0, -16, "#1f2a38", "#f1ebe2", .18],
  ["Rubor", "Retrato", 2, 12, 6, 12, -2, "#3b2a3a", "#ffd6dc", .2],
  ["Hora dorada en la piel", "Retrato", 10, 8, 24, 2, 8, "#3b2a1c", "#ffcf8a", .26],
  // Paisaje
  ["Paisaje vívido", "Paisaje", 20, 0, 4, -4, 40, null, null, 0],
  ["Montaña clara", "Paisaje", 16, 0, -10, -2, 20, "#1b2d44", "#e8f2ff", .15],
  ["Bosque profundo", "Paisaje", 24, 6, -4, -10, 18, "#10261c", "#e2efd5", .2],
  ["Desierto", "Paisaje", 14, 8, 26, 4, 6, "#3d2616", "#ffdcaa", .24],
  ["Océano", "Paisaje", 18, 2, -22, -2, 22, "#08263a", "#d7f1ff", .22],
  ["Atardecer intenso", "Paisaje", 26, 0, 30, 8, 30, "#2b1030", "#ffc07a", .28],
  ["Niebla alpina", "Paisaje", -24, 34, -10, 0, -30, "#3a4550", "#f2f5f8", .2],
  ["Otoño dorado", "Paisaje", 18, 8, 24, 2, 24, "#35200f", "#ffcf80", .22],
  ["Primavera fresca", "Paisaje", 8, 10, -2, -8, 18, "#23352a", "#f4ffe6", .16],
  ["Nieve", "Paisaje", 10, 6, -18, 0, -18, "#28384c", "#ffffff", .2],
  ["Tierras altas", "Paisaje", 22, 4, 6, -6, -10, "#1f2a24", "#efe8d4", .2],
  ["Tormenta", "Paisaje", 34, 0, -14, 0, -26, "#121b26", "#dfe6ee", .24],
  // Cine
  ["Turquesa y naranja", "Cine", 22, 6, 6, 0, 10, "#0d3a42", "#ffb36b", .36],
  ["Cine de acción", "Cine", 34, 2, 4, 0, -4, "#0f2c38", "#ffc58f", .3],
  ["Thriller verdoso", "Cine", 26, 8, -6, -16, -24, "#102a22", "#e4f0cf", .3],
  ["Drama cálido", "Cine", 20, 12, 18, 4, -10, "#2a1a14", "#ffd9a8", .26],
  ["Ciencia ficción", "Cine", 28, 4, -26, 6, -10, "#07203a", "#bfe6ff", .34],
  ["Western", "Cine", 24, 10, 26, 2, -18, "#2e1a0e", "#ffd08a", .3],
  ["Noir en color", "Cine", 38, 0, -8, 0, -60, "#0c141c", "#e9e2d2", .22],
  ["Indie desvaído", "Cine", 4, 30, 8, 6, -22, "#2a2e3c", "#f7e7d2", .24],
  ["Blockbuster azul", "Cine", 30, 0, -18, 0, 0, "#081c34", "#e8eef6", .3],
  ["Neón de cine", "Cine", 26, 4, -10, 14, 24, "#20093a", "#ff9fd0", .34],
  ["Película de época", "Cine", 12, 20, 16, 0, -34, "#2c2218", "#f3dfbd", .3],
  ["Cine de autor", "Cine", 14, 16, 0, 0, -40, "#1d2226", "#ece6dc", .2],
  ["Mañana de rodaje", "Cine", 16, 10, 10, -4, -6, "#1d2b34", "#ffe7c2", .24],
  ["Sci-fi ámbar", "Cine", 30, 2, 28, -4, -10, "#1a1208", "#ffbf5e", .34],
  // Urbano
  ["Calle fría", "Urbano", 26, 4, -16, 0, -20, "#10202e", "#dbe6ee", .24],
  ["Asfalto mojado", "Urbano", 32, 0, -10, 4, -8, "#0b1624", "#cfe0ff", .26],
  ["Hormigón", "Urbano", 20, 10, -4, 0, -48, "#20252a", "#e6e4df", .15],
  ["Metro", "Urbano", 22, 12, -8, -12, -16, "#132620", "#e2eed8", .24],
  ["Ciudad de noche", "Urbano", 30, 0, -14, 10, 20, "#0d1030", "#ffcf9a", .34],
  ["Grafiti", "Urbano", 34, 0, 4, 4, 46, null, null, 0],
  ["Tejados al sol", "Urbano", 18, 6, 18, 2, 8, "#261c20", "#ffe0b0", .22],
  ["Industrial", "Urbano", 36, 4, -6, -4, -36, "#151b1f", "#e0ddd5", .2],
  // Comida
  ["Comida apetitosa", "Comida", 16, 0, 12, 2, 26, null, "#fff1d8", .12],
  ["Café y madera", "Comida", 18, 8, 20, 2, 4, "#2a1a10", "#f7dcb4", .24],
  ["Fresco y verde", "Comida", 12, 4, -4, -8, 22, "#1c2a1c", "#f4ffe8", .16],
  ["Repostería", "Comida", 4, 16, 10, 8, 4, "#3a2a2e", "#fff0e6", .18],
  ["Mesa oscura", "Comida", 30, 0, 10, 0, 6, "#120c08", "#ffe2b8", .24],
  // Moda y editorial
  ["Revista", "Moda y editorial", 20, 6, 0, 2, -12, "#1c1f2a", "#f6ecea", .2],
  ["Moda pastel", "Moda y editorial", -8, 26, 2, 10, -20, "#3a3548", "#fff0f2", .22],
  ["Lujo", "Moda y editorial", 30, 2, 10, 0, -24, "#140e0a", "#f3d9b0", .28],
  ["Pasarela", "Moda y editorial", 36, 0, -4, 4, -30, "#10121c", "#f4eef0", .2],
  ["Catálogo limpio", "Moda y editorial", 10, 4, 0, 0, 6, null, null, 0],
  ["Editorial frío", "Moda y editorial", 24, 8, -20, 4, -18, "#0f1c2c", "#eef3fb", .26],
  ["Desierto chic", "Moda y editorial", 14, 18, 20, 6, -24, "#3a2a20", "#f8dfc2", .26],
  // Redes sociales
  ["Brillo de verano", "Redes sociales", 12, 8, 16, 4, 20, "#2c2030", "#ffe6c0", .2],
  ["Azul de playa", "Redes sociales", 14, 6, -16, -2, 26, "#0c2c40", "#e6fbff", .2],
  ["Mate cremoso", "Redes sociales", 0, 32, 10, 4, -12, "#3e3632", "#fbeede", .2],
  ["Rosa millennial", "Redes sociales", 2, 20, 4, 16, -6, "#3a2838", "#ffe0ea", .26],
  ["Aesthetic beige", "Redes sociales", -4, 24, 18, 4, -34, "#3f342a", "#f6e8d4", .28],
  ["Verde oliva", "Redes sociales", 10, 16, 8, -14, -20, "#262a18", "#f0ecd0", .26],
  ["Fotografía de viaje", "Redes sociales", 20, 4, 8, -2, 24, "#152634", "#ffe8c4", .22],
  ["Brunch", "Redes sociales", 6, 14, 14, 4, 6, "#33281f", "#fff2dc", .18],
  ["Claro y aireado", "Redes sociales", -12, 18, -2, 2, -8, "#4a5058", "#ffffff", .15],
  ["Oscuro y cálido", "Redes sociales", 22, 10, 18, 2, -14, "#1c120c", "#f2cf9e", .26],
  ["Vaporwave", "Redes sociales", 14, 10, -6, 24, 30, "#2a0f4a", "#7ef2ff", .4],
  ["Y2K", "Redes sociales", 24, 4, -10, 10, 36, "#0a2a5a", "#ffd0f0", .3],
  // Blanco y negro
  ["B/N neutro", "Blanco y negro", 12, 0, 0, 0, -100, null, null, 0],
  ["B/N contraste duro", "Blanco y negro", 50, 0, 0, 0, -100, null, null, 0],
  ["B/N suave", "Blanco y negro", -16, 20, 0, 0, -100, null, null, 0],
  ["B/N mate", "Blanco y negro", 6, 40, 0, 0, -100, null, null, 0],
  ["B/N cálido", "Blanco y negro", 16, 6, 0, 0, -100, "#2a1c10", "#f4e6cc", .35],
  ["B/N frío", "Blanco y negro", 16, 6, 0, 0, -100, "#101c2c", "#e6eef8", .35],
  ["Selenio", "Blanco y negro", 22, 4, 0, 0, -100, "#2a1830", "#efe8ee", .35],
  ["Tono de oro", "Blanco y negro", 18, 8, 0, 0, -100, "#1c1a2c", "#f6e2b8", .4],
  ["Platino", "Blanco y negro", -6, 22, 0, 0, -100, "#34302a", "#f2ece2", .3],
  ["Papel viejo", "Blanco y negro", 6, 30, 0, 0, -100, "#3a2c1c", "#efe0bf", .45],
  ["Grafito", "Blanco y negro", 30, 14, 0, 0, -100, "#1e2224", "#d8dcdc", .3],
  ["Cine mudo", "Blanco y negro", 34, 18, 0, 0, -100, "#1a160f", "#f2ead6", .3],
  // Noche
  ["Noche azul", "Noche", 24, 4, -26, 4, -6, "#050f2a", "#bcd6ff", .34],
  ["Farolas", "Noche", 22, 6, 24, 0, 8, "#101428", "#ffc47a", .34],
  ["Luna llena", "Noche", 18, 10, -20, 0, -40, "#0c1422", "#dce8f5", .3],
  ["Neón rosa", "Noche", 28, 2, -8, 20, 30, "#1c0930", "#ff8fcf", .36],
  ["Club", "Noche", 32, 0, -10, 12, 40, "#12053a", "#62f0ff", .36],
  ["Hoguera", "Noche", 24, 6, 32, 2, 14, "#160a06", "#ffb060", .32],
  // Estaciones
  ["Invierno", "Estaciones", 10, 12, -22, 2, -24, "#1c2a3e", "#f2f7ff", .26],
  ["Primavera", "Estaciones", 6, 14, 4, 6, 12, "#2f2f3a", "#fff4f0", .18],
  ["Verano", "Estaciones", 16, 6, 20, 2, 20, "#2c2018", "#ffe8b8", .2],
  ["Otoño", "Estaciones", 18, 10, 24, 0, 6, "#2e1a0e", "#ffd49a", .26],
  ["Navidad", "Estaciones", 20, 6, 14, 4, 16, "#1c0e10", "#ffe0b0", .26],
  ["Halloween", "Estaciones", 30, 4, 18, -10, -10, "#0e1408", "#ffa850", .34],
  // Suaves y pastel
  ["Algodón de azúcar", "Suaves y pastel", -10, 28, 0, 14, -14, "#3a3450", "#ffe8f4", .28],
  ["Menta", "Suaves y pastel", -8, 26, -8, -10, -18, "#2c3e3a", "#eefff6", .26],
  ["Lavanda", "Suaves y pastel", -6, 24, -6, 12, -22, "#343048", "#f4eeff", .28],
  ["Crema", "Suaves y pastel", -12, 30, 14, 2, -28, "#40362c", "#fff6e8", .24],
  ["Cielo pastel", "Suaves y pastel", -10, 26, -14, 4, -16, "#2e3a4e", "#f0f8ff", .24],
  ["Durazno pastel", "Suaves y pastel", -8, 26, 14, 8, -16, "#403036", "#fff0e2", .26],
  // Dramáticos
  ["Dramático", "Dramáticos", 44, 0, 0, 0, -20, "#10141a", "#f0ece4", .2],
  ["Épico", "Dramáticos", 40, 0, 10, 0, 16, "#101824", "#ffd8a0", .3],
  ["Sombrío", "Dramáticos", 30, 8, -12, 0, -46, "#0c1218", "#d4d8dc", .24],
  ["Tenebrista", "Dramáticos", 56, 0, 14, 0, -20, "#080604", "#f4d6a8", .3],
  ["Apocalíptico", "Dramáticos", 36, 10, 22, -12, -30, "#1a1408", "#f0c878", .36],
  ["Contraluz", "Dramáticos", 30, 0, 18, 0, 6, "#141018", "#ffe0a8", .26],
  // Duotonos y creativos
  ["Duotono azul y rosa", "Duotonos y creativos", 20, 0, 0, 0, -100, "#1b2b8f", "#ff7ab6", .9],
  ["Duotono naranja y morado", "Duotonos y creativos", 20, 0, 0, 0, -100, "#3a1462", "#ffa04a", .9],
  ["Duotono verde y amarillo", "Duotonos y creativos", 20, 0, 0, 0, -100, "#0c3b2e", "#f6ec6a", .9],
  ["Duotono rojo y crema", "Duotonos y creativos", 20, 0, 0, 0, -100, "#6a0f1a", "#f8ecd6", .9],
  ["Duotono azul marino", "Duotonos y creativos", 22, 0, 0, 0, -100, "#0a1a3a", "#bfe2ff", .9],
  ["Duotono atardecer", "Duotonos y creativos", 18, 0, 0, 0, -100, "#521d6e", "#ffc36a", .9],
  ["Infrarrojo", "Duotonos y creativos", 20, 0, 0, 0, -40, "#20124a", "#ffe6f4", .5],
  ["Termal", "Duotonos y creativos", 30, 0, 0, 0, -100, "#1a0a6a", "#ffe04a", .95],
  ["Rayos X", "Duotonos y creativos", 30, 0, 0, 0, -100, "#0a2a3a", "#e6fbff", .7],
  ["Pop art", "Duotonos y creativos", 50, 0, 0, 0, 80, null, null, 0],
  ["Cómic", "Duotonos y creativos", 46, 0, 6, 0, 50, "#14121c", "#fff4d6", .2],
  ["Sueño", "Duotonos y creativos", -20, 30, 0, 10, -10, "#40306a", "#ffe8f6", .34],
  ["Sepia moderno", "Duotonos y creativos", 16, 10, 0, 0, -100, "#3a2414", "#f6e0bc", .6],
  ["Cianotipia suave", "Duotonos y creativos", 12, 12, 0, 0, -100, "#0e2c5a", "#e6f2ff", .7],
  ["Matrix", "Duotonos y creativos", 30, 4, -10, -30, -40, "#021a0a", "#c8ffcf", .5],
  ["Marte", "Duotonos y creativos", 24, 6, 36, -6, -20, "#3a1206", "#ffb07a", .45],
  // Vintage (además de los clásicos de arriba)
  ["Álbum de los 70", "Vintage", 6, 30, 22, -4, -24, "#3a2a1a", "#f4dfb0", .3],
  ["Polaroid fría", "Vintage", 0, 30, -12, 6, -20, "#2a3040", "#eef2f0", .26],
  ["Diapositiva de los 60", "Vintage", 28, 6, 16, 0, 24, "#1a2430", "#ffe2b0", .22],
  ["Postal antigua", "Vintage", 8, 26, 16, -6, -40, "#3a2e1e", "#efe0c0", .34],
  ["Película caducada", "Vintage", 10, 22, 6, 18, -16, "#2a1e36", "#ffe6c8", .32],
  ["Años 80", "Vintage", 20, 10, -6, 10, 18, "#1a1a40", "#ffd4c0", .3],
  ["Años 90", "Vintage", 16, 12, 4, -8, 6, "#1e2c24", "#f6e8c8", .24],
  ["Disco", "Vintage", 24, 8, 18, 10, 20, "#2a0e2a", "#ffd08a", .3],
  ["Revista de los 50", "Vintage", 10, 22, 18, 6, -10, "#30262a", "#fff0d0", .26],
  ["Cine en casa", "Vintage", 6, 28, 24, 0, -18, "#2e2014", "#ffdca0", .32]
];

/* Parámetros → curvas por canal y virado */
function build([name, cat, contrast, fade, warm, tint, sat, sh, hi, k]){
  const c = contrast * .45, lift = fade, roll = Math.round(fade * .45);
  const curves = { rgb: [[0, lift], [64, Math.round(64 - c + lift * .35)], [192, Math.round(192 + c - roll * .4)], [255, 255 - roll]] };
  if(warm){ curves.r = [[0, 0], [128, Math.round(128 + warm * .45)], [255, 255]]; curves.b = [[0, 0], [128, Math.round(128 - warm * .45)], [255, 255]]; }
  if(tint) curves.g = [[0, 0], [128, Math.round(128 - tint * .45)], [255, 255]];
  const look = { name, cat, curves, sat };
  if(k > 0 && (sh || hi)) look.split = { sh: sh || null, hi: hi || null, k };
  return look;
}
LOOKS.push(...X.map(build));

/* Categoría de los treinta originales */
const FIRST_CATS = ["Básicos", "Básicos", "Vintage", "Básicos", "Películas", "Vintage", "Blanco y negro", "Suaves y pastel",
  "Noche", "Vintage", "Películas", "Básicos", "Películas", "Películas", "Películas", "Películas", "Vintage", "Vintage",
  "Películas", "Películas", "Películas", "Cine", "Blanco y negro", "Blanco y negro", "Vintage", "Duotonos y creativos",
  "Blanco y negro", "Vintage", "Películas", "Películas"];
LOOKS.forEach((l, i) => { if(!l.cat) l.cat = FIRST_CATS[i] || "Básicos"; });
export const LOOK_CATS = ["Básicos", "Retrato", "Paisaje", "Cine", "Películas", "Urbano", "Comida", "Moda y editorial",
  "Redes sociales", "Blanco y negro", "Noche", "Estaciones", "Suaves y pastel", "Dramáticos", "Duotonos y creativos", "Vintage"];

const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function lutsFor(look){
  return {
    master: curveLut(look.curves.rgb || IDN),
    r: curveLut(look.curves.r || IDN),
    g: curveLut(look.curves.g || IDN),
    b: curveLut(look.curves.b || IDN)
  };
}

export function applyLook(data, look){
  const L = lutsFor(look);
  const split = look.split ? { sh: look.split.sh ? hexRgb(look.split.sh) : null, hi: look.split.hi ? hexRgb(look.split.hi) : null, k: look.split.k, duo: look.split.k >= .85 } : null;
  for(let i = 0; i < data.length; i += 4){
    let r = L.master[L.r[data[i]]], g = L.master[L.g[data[i+1]]], b = L.master[L.b[data[i+2]]];
    if(look.sat){
      let [h, s, l] = rgbToHsl(r, g, b);
      s = Math.max(0, Math.min(1, s * (1 + look.sat / 100)));
      [r, g, b] = hslToRgb(h, s, l);
    }
    if(split){
      // Virado partido: mezcla hacia el color de sombras en lo oscuro
      // y hacia el de luces en lo claro, conservando la luminosidad.
      const y = (r * .2126 + g * .7152 + b * .0722) / 255;
      /* Virado muy fuerte (duotonos, termal…): mapa de degradado de
         verdad, del color de sombras al de luces según la luminosidad. */
      if(split.duo){
        const t = Math.max(0, Math.min(1, y)), a = split.sh || [0, 0, 0], z = split.hi || [255, 255, 255];
        r += (a[0] + (z[0] - a[0]) * t - r) * split.k; g += (a[1] + (z[1] - a[1]) * t - g) * split.k; b += (a[2] + (z[2] - a[2]) * t - b) * split.k;
        data[i] = r; data[i+1] = g; data[i+2] = b;
        continue;
      }
      const ws = split.sh ? (1 - y) * (1 - y) * split.k : 0, wh = split.hi ? y * y * split.k : 0;
      if(ws){ r += (split.sh[0] * (y * 2 + .15) - r) * ws; g += (split.sh[1] * (y * 2 + .15) - g) * ws; b += (split.sh[2] * (y * 2 + .15) - b) * ws; }
      if(wh){ r += (split.hi[0] * Math.min(1.08, y + .12) - r) * wh; g += (split.hi[1] * Math.min(1.08, y + .12) - g) * wh; b += (split.hi[2] * Math.min(1.08, y + .12) - b) * wh; }
    }
    data[i] = r; data[i+1] = g; data[i+2] = b;
  }
}

export async function openLooks(opts = {}){
  const state = { picked: -1, intensity: 100, ...opts.init };
  if(!opts.render){
    const layer = opts.edit || activeLayer();
    if(!layer){ toast("No hay capa activa"); return; }
  }

  return runAdjust({
    title: "Estilos",
    wide: true,
    asLayer: true, filterId: "look", filterParams: state,
    compute(data){
      if(state.picked < 0) return;
      const orig = Uint8ClampedArray.from(data);
      applyLook(data, LOOKS[state.picked]);
      const t = state.intensity / 100;
      if(t < 1){
        for(let i = 0; i < data.length; i += 4){
          data[i]   = orig[i]   + (data[i]   - orig[i])   * t;
          data[i+1] = orig[i+1] + (data[i+1] - orig[i+1]) * t;
          data[i+2] = orig[i+2] + (data[i+2] - orig[i+2]) * t;
        }
      }
    },
    buildBody({ preview, source }){
      const layer = { canvas: source };
      const box = document.createElement("div");
      box.innerHTML = `
        <input type="search" id="lkSearch" placeholder="Buscar estilo…" style="width:100%;box-sizing:border-box;margin-bottom:8px">
        <div id="lkCats" class="seg" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>
        <div id="lkGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));
             gap:8px;margin-bottom:10px;max-height:52vh;overflow:auto;padding-right:2px"></div>
        <div class="field" id="lkIntRow" style="display:${state.picked >= 0 ? "flex" : "none"}">
          <label>Intensidad</label>
          <input type="range" id="lkInt" class="grow" min="0" max="100" value="${Math.round(state.intensity)}">
          <span class="unit mono" id="lkIntV">${Math.round(state.intensity)}%</span>
        </div>`;

      const grid = box.querySelector("#lkGrid");
      // Miniatura compartida: una copia reducida de la capa activa,
      // recortada al centro para no deformar la proporción.
      const S = 96;
      const thumb = document.createElement("canvas");
      thumb.width = S; thumb.height = S;
      const tx = thumb.getContext("2d", { willReadFrequently: true });
      const side = Math.min(doc.w, doc.h);
      tx.drawImage(layer.canvas, (doc.w-side)/2, (doc.h-side)/2, side, side, 0, 0, S, S);
      const baseData = tx.getImageData(0, 0, S, S);

      const cells = [];
      const mkCell = (name, idx, lazy = false) => {
        const cell = document.createElement("button");
        cell.style.cssText = "padding:0;display:flex;flex-direction:column;gap:4px;background:transparent;border:0";
        const cv = document.createElement("canvas");
        cv.width = S; cv.height = S;
        cv.style.cssText = "width:100%;border-radius:var(--r);border:2px solid var(--line);display:block";
        const cx = cv.getContext("2d");
        const paint = () => {
          const img = new ImageData(new Uint8ClampedArray(baseData.data), S, S);
          if(idx >= 0) applyLook(img.data, LOOKS[idx]);
          cx.putImageData(img, 0, 0);
        };
        if(lazy) cell.__paint = paint; else paint();
        const label = document.createElement("span");
        label.textContent = name;
        label.style.cssText = "font-size:var(--fs-xs);color:var(--tx-dim);text-align:center;white-space:normal;overflow-wrap:anywhere;line-height:1.2";
        cell.append(cv, label);
        cell.dataset.cat = idx >= 0 ? LOOKS[idx].cat : "";
        cell.dataset.name = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        cell.addEventListener("click", () => {
          state.picked = idx;
          cells.forEach(c => c.cv.style.borderColor = "var(--line)");
          cv.style.borderColor = "var(--ac)";
          box.querySelector("#lkIntRow").style.display = idx >= 0 ? "flex" : "none";
          preview();
        });
        cells.push({ cv, idx });
        return cell;
      };

      grid.appendChild(mkCell("Original", -1));
      /* Miniaturas por tandas: con más de ciento cincuenta estilos, se
         pintan en segundo plano para que la ventana abra al momento. */
      const order = LOOK_CATS.flatMap(c => LOOKS.map((l, i) => [l, i]).filter(([l]) => l.cat === c));
      const pending = [];
      for(const [look, i] of order){ const c = mkCell(look.name, i, true); grid.appendChild(c); pending.push(c); }
      (function paintSome(){
        const batch = pending.splice(0, 12);
        batch.forEach(c => c.__paint?.());
        if(pending.length) requestAnimationFrame(paintSome);
      })();
      let cat = "Todos", query = "";
      const filter = () => {
        const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        for(const el of grid.children){
          const ok = !el.dataset.cat || ((cat === "Todos" || el.dataset.cat === cat) && (!q || el.dataset.name.includes(q)));
          el.style.display = ok ? "" : "none";
        }
      };
      const cats = box.querySelector("#lkCats");
      for(const c of ["Todos", ...LOOK_CATS]){
        const b = document.createElement("button");
        b.type = "button"; b.textContent = c + (c === "Todos" ? ` (${LOOKS.length})` : "");
        b.style.cssText = "flex:0 0 auto;padding:4px 9px";
        b.classList.toggle("on", c === cat);
        b.addEventListener("click", () => { cat = c; cats.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); filter(); });
        cats.appendChild(b);
      }
      box.querySelector("#lkSearch").addEventListener("input", e => { query = e.target.value; filter(); });
      (cells.find(c => c.idx === state.picked) || cells[0]).cv.style.borderColor = "var(--ac)";

      box.querySelector("#lkInt").addEventListener("input", e => {
        state.intensity = +e.target.value;
        box.querySelector("#lkIntV").textContent = e.target.value + "%";
        preview();
      });

      return box;
    }
  }, opts);
}
