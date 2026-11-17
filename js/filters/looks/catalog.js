/* ═══════════════════════════════════════════════════════════════
   ESTILOS · CATÁLOGO Y APLICACIÓN
   Los más de ciento cincuenta looks prediseñados (curvas por canal + saturación + virado partido), sus categorías y applyLook, que los
   aplica sobre píxeles. Sin DOM ni interfaz: lo usan el editor de Estilos de Realify (looks.js) y Realify Basic.
   Entradas: LOOKS · LOOK_CATS · applyLook(data RGBA, look). Salidas: los píxeles modificados en su sitio.
   Límites: no mezcla con el original (la intensidad la gestiona quien llama); los estilos por capas están en looks.js.
   ═══════════════════════════════════════════════════════════════ */
import { curveLut } from "../../editor/adjust/curves.js";
import { rgbToHsl, hslToRgb } from "../../core/util/color.js";
import { AMPLIADO } from "./catalog-ampliado.js";

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

LOOKS.push(...AMPLIADO);

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

