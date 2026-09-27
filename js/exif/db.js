/* ══════════════════════════════════════════════════════════════
   BASE DE DATOS FOTOGRÁFICA
   Cuerpos, objetivos, series estándar de exposición y capitales.
   El sorteo automático no elige números sueltos: fija un valor de
   exposición para la escena y deriva la velocidad de la apertura y
   el ISO, de modo que el triángulo sea físicamente posible.
   ══════════════════════════════════════════════════════════════ */

export const BODIES = [
  {id:"canon_400d", model:"Canon EOS 400D DIGITAL", mount:"EF-S", sw:22.2, sh:14.8, px:[3888,2592], iso:1600,   y:2006},
  {id:"canon_450d", model:"Canon EOS 450D",         mount:"EF-S", sw:22.2, sh:14.8, px:[4272,2848], iso:1600,   y:2008},
  {id:"canon_600d", model:"Canon EOS 600D",         mount:"EF-S", sw:22.3, sh:14.9, px:[5184,3456], iso:6400,   y:2011},
  {id:"canon_700d", model:"Canon EOS 700D",         mount:"EF-S", sw:22.3, sh:14.9, px:[5184,3456], iso:12800,  y:2013},
  {id:"canon_750d", model:"Canon EOS 750D",         mount:"EF-S", sw:22.3, sh:14.9, px:[6000,4000], iso:12800,  y:2015},
  {id:"canon_800d", model:"Canon EOS 800D",         mount:"EF-S", sw:22.3, sh:14.9, px:[6000,4000], iso:25600,  y:2017},
  {id:"canon_90d",  model:"Canon EOS 90D",          mount:"EF-S", sw:22.3, sh:14.8, px:[6960,4640], iso:25600,  y:2019},
  {id:"canon_7d2",  model:"Canon EOS 7D Mark II",   mount:"EF-S", sw:22.4, sh:15.0, px:[5472,3648], iso:16000,  y:2014},
  {id:"canon_6d",   model:"Canon EOS 6D",           mount:"EF",   sw:35.8, sh:23.9, px:[5472,3648], iso:25600,  y:2012},
  {id:"canon_6d2",  model:"Canon EOS 6D Mark II",   mount:"EF",   sw:35.9, sh:24.0, px:[6240,4160], iso:40000,  y:2017},
  {id:"canon_5d3",  model:"Canon EOS 5D Mark III",  mount:"EF",   sw:36.0, sh:24.0, px:[5760,3840], iso:25600,  y:2012},
  {id:"canon_5d4",  model:"Canon EOS 5D Mark IV",   mount:"EF",   sw:36.0, sh:24.0, px:[6720,4480], iso:32000,  y:2016},
  {id:"canon_r",    model:"Canon EOS R",            mount:"RF",   sw:36.0, sh:24.0, px:[6720,4480], iso:40000,  y:2018},
  {id:"canon_rp",   model:"Canon EOS RP",           mount:"RF",   sw:35.9, sh:24.0, px:[6240,4160], iso:40000,  y:2019},
  {id:"canon_r6",   model:"Canon EOS R6",           mount:"RF",   sw:35.9, sh:23.9, px:[5472,3648], iso:102400, y:2020},
  {id:"canon_r62",  model:"Canon EOS R6m2",         mount:"RF",   sw:35.9, sh:23.9, px:[6000,4000], iso:102400, y:2022},
  {id:"canon_r5",   model:"Canon EOS R5",           mount:"RF",   sw:36.0, sh:24.0, px:[8192,5464], iso:51200,  y:2020},
  {id:"canon_r10",  model:"Canon EOS R10",          mount:"RF-S", sw:22.3, sh:14.9, px:[6000,4000], iso:32000,  y:2022},
  {id:"canon_r50",  model:"Canon EOS R50",          mount:"RF-S", sw:22.3, sh:14.9, px:[6000,4000], iso:32000,  y:2023},
  {id:"canon_m50",  model:"Canon EOS M50",          mount:"EF-M", sw:22.3, sh:14.9, px:[6000,4000], iso:25600,  y:2018}
];

/* fmin/fmax: focales. amin: apertura máxima en fmin. amax: en fmax. */
export const LENSES = [
  {id:"canon_efs_18_55_is2", make:"Canon",  model:"EF-S18-55mm f/3.5-5.6 IS II",       mount:"EF-S", fmin:18,  fmax:55,  amin:3.5, amax:5.6},
  {id:"canon_efs_18_135",    make:"Canon",  model:"EF-S18-135mm f/3.5-5.6 IS STM",     mount:"EF-S", fmin:18,  fmax:135, amin:3.5, amax:5.6},
  {id:"canon_efs_55_250",    make:"Canon",  model:"EF-S55-250mm f/4-5.6 IS STM",       mount:"EF-S", fmin:55,  fmax:250, amin:4.0, amax:5.6},
  {id:"canon_efs_17_55",     make:"Canon",  model:"EF-S17-55mm f/2.8 IS USM",          mount:"EF-S", fmin:17,  fmax:55,  amin:2.8, amax:2.8},
  {id:"canon_ef_50_18",      make:"Canon",  model:"EF50mm f/1.8 STM",                  mount:"EF",   fmin:50,  fmax:50,  amin:1.8, amax:1.8},
  {id:"canon_ef_50_14",      make:"Canon",  model:"EF50mm f/1.4 USM",                  mount:"EF",   fmin:50,  fmax:50,  amin:1.4, amax:1.4},
  {id:"canon_ef_85_18",      make:"Canon",  model:"EF85mm f/1.8 USM",                  mount:"EF",   fmin:85,  fmax:85,  amin:1.8, amax:1.8},
  {id:"canon_ef_100_28l",    make:"Canon",  model:"EF100mm f/2.8L Macro IS USM",       mount:"EF",   fmin:100, fmax:100, amin:2.8, amax:2.8},
  {id:"canon_ef_24_70",      make:"Canon",  model:"EF24-70mm f/2.8L II USM",           mount:"EF",   fmin:24,  fmax:70,  amin:2.8, amax:2.8},
  {id:"canon_ef_24_105",     make:"Canon",  model:"EF24-105mm f/4L IS II USM",         mount:"EF",   fmin:24,  fmax:105, amin:4.0, amax:4.0},
  {id:"canon_ef_70_200",     make:"Canon",  model:"EF70-200mm f/2.8L IS II USM",       mount:"EF",   fmin:70,  fmax:200, amin:2.8, amax:2.8},
  {id:"tamron_18_270",       make:"Tamron", model:"18-270mm F/3.5-6.3 Di II VC PZD",   mount:"EF-S", fmin:18,  fmax:270, amin:3.5, amax:6.3},
  {id:"tamron_18_400",       make:"Tamron", model:"18-400mm F/3.5-6.3 Di II VC HLD",   mount:"EF-S", fmin:18,  fmax:400, amin:3.5, amax:6.3},
  {id:"tamron_24_70_g2",     make:"Tamron", model:"SP 24-70mm F/2.8 Di VC USD G2",     mount:"EF",   fmin:24,  fmax:70,  amin:2.8, amax:2.8},
  {id:"sigma_17_50",         make:"Sigma",  model:"17-50mm F2.8 EX DC OS HSM",         mount:"EF-S", fmin:17,  fmax:50,  amin:2.8, amax:2.8},
  {id:"sigma_18_35_art",     make:"Sigma",  model:"18-35mm F1.8 DC HSM Art",           mount:"EF-S", fmin:18,  fmax:35,  amin:1.8, amax:1.8},
  {id:"canon_rf_50_18",      make:"Canon",  model:"RF50mm F1.8 STM",                   mount:"RF",   fmin:50,  fmax:50,  amin:1.8, amax:1.8},
  {id:"canon_rf_85_2",       make:"Canon",  model:"RF85mm F2 MACRO IS STM",            mount:"RF",   fmin:85,  fmax:85,  amin:2.0, amax:2.0},
  {id:"canon_rf_24_105",     make:"Canon",  model:"RF24-105mm F4 L IS USM",            mount:"RF",   fmin:24,  fmax:105, amin:4.0, amax:4.0},
  {id:"canon_rf_24_70",      make:"Canon",  model:"RF24-70mm F2.8 L IS USM",           mount:"RF",   fmin:24,  fmax:70,  amin:2.8, amax:2.8},
  {id:"canon_rfs_18_45",     make:"Canon",  model:"RF-S18-45mm F4.5-6.3 IS STM",       mount:"RF-S", fmin:18,  fmax:45,  amin:4.5, amax:6.3},
  {id:"tamron_18300_diiia",  make:"Tamron", model:"18-300mm F/3.5-6.3 Di III-A VC VXD",mount:"RF-S", fmin:18,  fmax:300, amin:3.5, amax:6.3},
  {id:"canon_efm_22",        make:"Canon",  model:"EF-M22mm f/2 STM",                  mount:"EF-M", fmin:22,  fmax:22,  amin:2.0, amax:2.0},
  {id:"canon_efm_18_150",    make:"Canon",  model:"EF-M18-150mm f/3.5-6.3 IS STM",     mount:"EF-M", fmin:18,  fmax:150, amin:3.5, amax:6.3}
];

export const BODY_BY_ID = Object.fromEntries(BODIES.map(b=>[b.id,b]));
export const LENS_BY_ID = Object.fromEntries(LENSES.map(l=>[l.id,l]));

/* Factor de recorte NOMINAL, no el que sale de la diagonal. La
   diagonal de un APS-C Canon da 1.6134, pero la cámara escribe
   FocalLengthIn35mmFilm con 1.6 redondo: un 50 mm en una 600D
   declara 80 mm, no 81. Copiamos lo que hace la cámara, que es de
   lo que se trata. */
export const cropOf = b => (b.mount === "EF" || b.mount === "RF") ? 1.0 : 1.6;

/* Qué monta en qué. Un 600D con un objetivo de montura RF-S es una
   contradicción física, y es lo primero que se ve al abrir el
   archivo con cualquier lector de metadatos. */
export function mountCheck(body, lens){
  const b = body.mount, l = lens.mount;
  if(b === "EF-S")  return (l==="EF-S"||l==="EF") ? "ok" : "bad";
  if(b === "EF")    return l==="EF" ? "ok" : (l==="EF-S" ? "bad" : "bad");
  if(b === "RF")    return l==="RF" ? "ok"
                         : l==="RF-S" ? "crop"
                         : (l==="EF"||l==="EF-S") ? "adapter" : "bad";
  if(b === "RF-S")  return (l==="RF"||l==="RF-S") ? "ok"
                         : (l==="EF"||l==="EF-S") ? "adapter" : "bad";
  if(b === "EF-M")  return l==="EF-M" ? "ok"
                         : (l==="EF"||l==="EF-S") ? "adapter" : "bad";
  return "bad";
}

/* Series estándar en tercios de paso. Escribir un 1/237 delata el
   archivo tanto como no escribir nada. */
export const SHUTTERS = [
  [1,8000],[1,6400],[1,5000],[1,4000],[1,3200],[1,2500],[1,2000],[1,1600],
  [1,1250],[1,1000],[1,800],[1,640],[1,500],[1,400],[1,320],[1,250],
  [1,200],[1,160],[1,125],[1,100],[1,80],[1,60],[1,50],[1,40],[1,30],
  [1,25],[1,20],[1,15],[1,13],[1,10],[1,8],[1,6],[1,5],[1,4],
  [3,10],[4,10],[5,10],[6,10],[8,10],[1,1],[13,10],[16,10],[2,1],
  [25,10],[32,10],[4,1],[5,1],[6,1],[8,1],[10,1],[13,1],[15,1],
  [20,1],[25,1],[30,1]
];
export const APERTURES = [1.0,1.1,1.2,1.4,1.6,1.8,2.0,2.2,2.5,2.8,3.2,3.5,4.0,4.5,
                   5.0,5.6,6.3,7.1,8.0,9.0,10,11,13,14,16,18,20,22,25,29,32];
export const ISOS = [50,100,125,160,200,250,320,400,500,640,800,1000,1250,1600,2000,
              2500,3200,4000,5000,6400,8000,10000,12800,16000,20000,25600,
              32000,40000,51200,64000,102400];

export const shLabel = (n,d)=> (n===1 && d>1) ? "1/"+d+" s" : (n/d)+" s";
export const shSec   = s => s[0]/s[1];

export function nearestShutter(t){
  let best = 0, bd = Infinity;
  for(let i=0;i<SHUTTERS.length;i++){
    const d = Math.abs(Math.log2(shSec(SHUTTERS[i])) - Math.log2(t));
    if(d < bd){ bd = d; best = i; }
  }
  return best;
}
export function snapUp(arr, v){
  for(const x of arr) if(x >= v - 1e-9) return x;
  return arr[arr.length-1];
}

/* Apertura máxima del objetivo a una focal dada: los zooms pierden
   luminosidad de forma aproximadamente logarítmica con la focal. */
export function maxAperture(lens, f){
  if(lens.fmax === lens.fmin) return lens.amin;
  const t = Math.log(f/lens.fmin)/Math.log(lens.fmax/lens.fmin);
  return snapUp(APERTURES, lens.amin*Math.pow(lens.amax/lens.amin, Math.max(0,Math.min(1,t))));
}

/* ev: valor de exposición a ISO 100 para esa luz.
   ap: rango de aperturas que un fotógrafo elegiría en esa escena. */
export const SCENES = {
  portrait_day:    {label:"Retrato, buena luz",     ev:[11.5,13.8], iso:[100,400],  focal:[50,135], ap:[2.0,5.6],  prog:3, scene:2, meter:5, flash:16, wb:0, hour:[9,19]},
  portrait_window: {label:"Retrato, luz de ventana",ev:[8.0,10.5],  iso:[200,1600], focal:[35,105], ap:[1.4,4.0],  prog:3, scene:2, meter:5, flash:16, wb:0, hour:[10,18]},
  portrait_studio: {label:"Retrato, estudio",       ev:[10.0,12.0], iso:[100,200],  focal:[50,135], ap:[4.0,11.0], prog:1, scene:2, meter:6, flash:9,  wb:1, hour:[10,20]},
  outdoor:         {label:"Exterior general",       ev:[12.5,15.0], iso:[100,400],  focal:[24,200], ap:[4.0,11.0], prog:3, scene:0, meter:5, flash:16, wb:0, hour:[8,20]},
  indoor:          {label:"Interior, poca luz",     ev:[6.0,8.5],   iso:[800,6400], focal:[24,85],  ap:[1.4,3.5],  prog:3, scene:0, meter:5, flash:16, wb:0, hour:[17,23]}
};

const rnd  = (a,b)=> a + Math.random()*(b-a);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];

/* Las 50 capitales de provincia más Ceuta y Melilla, con coordenadas
   del centro urbano y altitud real. La altitud importa: un GPS que
   declara 0 m en Ávila, que está a 1132, se contradice solo.
   [nombre, latitud, longitud, altitud en metros] */
export const CITIES = [
  ["A Coruña",                     43.3623,  -8.4115,    5],
  ["Albacete",                     38.9943,  -1.8585,  686],
  ["Alicante",                     38.3452,  -0.4810,    3],
  ["Almería",                      36.8381,  -2.4597,   10],
  ["Ávila",                        40.6565,  -4.6818, 1132],
  ["Badajoz",                      38.8794,  -6.9707,  184],
  ["Barcelona",                    41.3874,   2.1686,   12],
  ["Bilbao (Bizkaia)",             43.2630,  -2.9350,   19],
  ["Burgos",                       42.3439,  -3.6969,  861],
  ["Cáceres",                      39.4753,  -6.3724,  439],
  ["Cádiz",                        36.5271,  -6.2886,   11],
  ["Castellón de la Plana",        39.9864,  -0.0513,   30],
  ["Ceuta",                        35.8894,  -5.3213,   10],
  ["Ciudad Real",                  38.9848,  -3.9273,  630],
  ["Córdoba",                      37.8882,  -4.7794,  106],
  ["Cuenca",                       40.0704,  -2.1374,  946],
  ["Girona",                       41.9794,   2.8214,   70],
  ["Granada",                      37.1773,  -3.5986,  738],
  ["Guadalajara",                  40.6320,  -3.1608,  685],
  ["Huelva",                       37.2614,  -6.9447,   54],
  ["Huesca",                       42.1401,  -0.4089,  488],
  ["Jaén",                         37.7796,  -3.7849,  573],
  ["Las Palmas de Gran Canaria",   28.1235, -15.4363,    8],
  ["León",                         42.5987,  -5.5671,  837],
  ["Lleida",                       41.6176,   0.6200,  155],
  ["Logroño (La Rioja)",           42.4627,  -2.4450,  384],
  ["Lugo",                         43.0121,  -7.5559,  454],
  ["Madrid",                       40.4168,  -3.7038,  667],
  ["Málaga",                       36.7213,  -4.4214,   11],
  ["Melilla",                      35.2923,  -2.9381,   47],
  ["Murcia",                       37.9922,  -1.1307,   43],
  ["Ourense",                      42.3358,  -7.8639,  139],
  ["Oviedo (Asturias)",            43.3619,  -5.8494,  232],
  ["Palencia",                     42.0096,  -4.5288,  740],
  ["Palma (Illes Balears)",        39.5696,   2.6502,   13],
  ["Pamplona (Navarra)",           42.8125,  -1.6458,  449],
  ["Pontevedra",                   42.4310,  -8.6444,   19],
  ["Salamanca",                    40.9701,  -5.6635,  802],
  ["San Sebastián (Gipuzkoa)",     43.3183,  -1.9812,    6],
  ["Santa Cruz de Tenerife",       28.4636, -16.2518,    4],
  ["Santander (Cantabria)",        43.4623,  -3.8100,   15],
  ["Segovia",                      40.9429,  -4.1088, 1005],
  ["Sevilla",                      37.3891,  -5.9845,    7],
  ["Soria",                        41.7665,  -2.4790, 1065],
  ["Tarragona",                    41.1189,   1.2445,   68],
  ["Teruel",                       40.3456,  -1.1065,  915],
  ["Toledo",                       39.8628,  -4.0273,  529],
  ["Valencia",                     39.4699,  -0.3763,   15],
  ["Valladolid",                   41.6523,  -4.7245,  698],
  ["Vitoria-Gasteiz (Álava)",      42.8467,  -2.6716,  525],
  ["Zamora",                       41.5033,  -5.7446,  652],
  ["Zaragoza",                     41.6488,  -0.8891,  208]
];

/* Sortea una exposición que se sostiene: se elige focal, apertura e
   ISO y la velocidad SALE de ellos, no al revés. Después se comprueba
   la regla de la focal inversa —a pulso, por debajo de 1/focal
   equivalente sale trepidada— y si no llega, se sube el ISO como
   haría cualquiera. */
export function rollExif(bodyId, lensId, sceneKey){
  const body = BODY_BY_ID[bodyId] || BODIES[0];
  const lens = LENS_BY_ID[lensId] || LENSES[0];
  const sc   = SCENES[sceneKey] || SCENES.portrait_day;
  const crop = cropOf(body);

  // Focal: lo que pide la escena, recortado a lo que da el objetivo.
  let f0 = Math.max(lens.fmin, Math.min(lens.fmax, sc.focal[0]));
  let f1 = Math.max(lens.fmin, Math.min(lens.fmax, sc.focal[1]));
  if(f1 < f0) f1 = f0;
  let focal = lens.fmin === lens.fmax ? lens.fmin : Math.round(rnd(f0, f1));

  // Apertura: nunca más luminosa de lo que el objetivo permite ahí.
  const wide = maxAperture(lens, focal);
  let ap = snapUp(APERTURES, Math.max(wide, rnd(sc.ap[0], sc.ap[1])));

  let iso  = snapUp(ISOS, rnd(sc.iso[0], sc.iso[1]));
  const isoCap = ISOS.filter(v=>v <= body.iso).pop() || 6400;
  iso = Math.min(iso, isoCap);

  const ev100 = rnd(sc.ev[0], sc.ev[1]);
  const shutterFor = (N, I)=> (N*N) / (Math.pow(2, ev100) * (I/100));

  let si = nearestShutter(shutterFor(ap, iso));

  // Regla de la focal inversa, sólo si no hay flash de estudio.
  if(sc.flash === 16){
    const need = 1/(focal*crop);
    let guard = 0;
    const capIdx = ISOS.indexOf(isoCap);
    while(shSec(SHUTTERS[si]) > need*1.45 && iso < isoCap && guard++ < 12){
      // Subir de dos en dos tercios sin rebasar nunca el tope del
      // cuerpo: un 450D no tiene ISO 2000, y eso se ve en el EXIF.
      iso = ISOS[Math.min(ISOS.indexOf(iso) + 2, capIdx)];
      si = nearestShutter(shutterFor(ap, iso));
    }
    // Si aun subiendo el ISO no llega, se abre el diafragma.
    guard = 0;
    while(shSec(SHUTTERS[si]) > need*1.45 && ap > wide && guard++ < 12){
      ap = APERTURES[Math.max(0, APERTURES.indexOf(ap)-2)];
      if(ap < wide) ap = wide;
      si = nearestShutter(shutterFor(ap, iso));
    }
  }

  // Fecha: nunca anterior al lanzamiento del cuerpo, y a una hora
  // que cuadre con la escena.
  const now = new Date();
  const from = new Date(Math.max(new Date(body.y, 2, 1).getTime(),
                                 now.getTime() - 3*365*864e5));
  const d = new Date(rnd(from.getTime(), now.getTime()));
  d.setHours(Math.floor(rnd(sc.hour[0], sc.hour[1])),
             Math.floor(rnd(0,60)), Math.floor(rnd(0,60)), 0);

  return {
    bodyId, lensId,
    shutter: SHUTTERS[si], aperture: ap, iso, focal,
    bias: pick([-2,-1,-1,0,0,0,0,1,1,2]),   // tercios, sesgado a cero
    program: sc.prog, meter: sc.meter, flash: sc.flash,
    wb: sc.wb, sceneType: sc.scene, date: d
  };
}

