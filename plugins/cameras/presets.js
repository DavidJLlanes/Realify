/* ═══════════════════════════════════════════════════════════════
   CÁMARAS · CATÁLOGO
   Cada entrada es una receta de modificadores (ver state.js); los que
   no se nombran quedan a cero. Nombres genéricos, sin marcas.

   CATS lista las 19 familias previstas en el orden en que se muestran.
   La interfaz sólo enseña las que ya tienen cámaras: para añadir una
   familia entera basta con meter sus entradas aquí, no hay que tocar
   la interfaz.
   ═══════════════════════════════════════════════════════════════ */

export const CATS = [
  "Procesos del siglo XIX", "Cámaras de cajón y fuelle", "Película en color", "Película en blanco y negro",
  "Instantáneas", "Cámaras de juguete", "Compactas analógicas", "Compactas digitales CCD",
  "Móviles y webcams", "Vídeo y vigilancia", "Ópticas especiales", "Cine y fotogramas",
  "Científica y técnica", "Espía y acción", "Prensa e impresión", "Pantallas y capturas",
  "Digitalización de época", "Lentes y accesorios", "Luz y clima"
];

const P = (id, cat, name, values) => ({ id, cat, name, values });

export const PRESETS = [
  /* ── Procesos del siglo XIX ── */
  P("daguerre", CATS[0], "Daguerrotipo",            { mono: 100, soft: 30, vignette: 70, fade: 30, punch: 30, dust: 40, scratches: 30, fog: 40, grain: 25 }),
  P("tintype",  CATS[0], "Ferrotipo",               { mono: 100, sepia: 20, punch: 50, vignette: 65, dust: 50, scratches: 40, fog: 30, soft: 25, crush: 40 }),
  P("cyano",    CATS[0], "Cianotipo",               { cyano: 100, soft: 15, fade: 20, paper: 55, grain: 20, dust: 25 }),
  P("albumen",  CATS[0], "Copia a la albúmina",     { sepia: 90, fade: 35, soft: 25, vignette: 40, paper: 60, dust: 30, flat: 30 }),
  P("glass",    CATS[0], "Placa de vidrio",         { mono: 100, clip: 20, soft: 20, vignette: 35, dust: 55, scratches: 30, fog: 45, grain: 20 }),
  P("calotype", CATS[0], "Calotipo",                { sepia: 70, mono: 60, soft: 55, grain: 55, vignette: 50, fog: 35, paper: 40, flat: 25 }),

  /* ── Cámaras de cajón y fuelle ── */
  P("box",      CATS[1], "Cámara de cajón",         { mono: 90, soft: 50, vignette: 75, fade: 30, dust: 35, grain: 35, leaks: 20 }),
  P("bellows",  CATS[1], "Plegable de fuelle",      { sepia: 40, mono: 60, soft: 30, vignette: 45, fade: 35, paper: 50, grain: 30, dust: 30 }),
  P("family30", CATS[1], "Álbum de familia",        { mono: 100, fade: 40, paper: 70, soft: 25, grain: 40, vignette: 40, dust: 35 }),

  /* ── Película en color ── */
  P("slide",    CATS[2], "Diapositiva cálida",      { warm: 45, vivid: 40, punch: 40, grain: 20, halation: 20, vignette: 25 }),
  P("fairneg",  CATS[2], "Negativo de feria",       { cool: 40, green: 25, fade: 25, grain: 40, desat: 15, vignette: 20 }),
  P("nightcine",CATS[2], "Película de cine nocturno",{ split: 60, halation: 55, grain: 45, bloom: 25, vignette: 30, cool: 15, crush: 20 }),
  P("expired",  CATS[2], "Película caducada",       { magenta: 45, fog: 40, fade: 35, grain: 55, leaks: 40, desat: 25 }),
  P("crossp",   CATS[2], "Proceso cruzado",         { cross: 90, punch: 30, vivid: 30, grain: 30, vignette: 35 }),

  /* ── Película en blanco y negro ── */
  P("hiiso",    CATS[3], "Película de alta sensibilidad", { mono: 100, grain: 80, punch: 45, crush: 25, vignette: 25 }),
  P("classicbw",CATS[3], "Blanco y negro clásico",  { mono: 100, punch: 25, grain: 30, vignette: 25, fade: 12 }),
  P("hicon",    CATS[3], "Alto contraste",          { mono: 100, punch: 90, crush: 40, clip: 25, grain: 35 }),
  P("infrared", CATS[3], "Infrarrojo",              { infrared: 100, mono: 70, bloom: 40, soft: 25, grain: 40, fade: 15 }),

  /* ── Instantáneas ── */
  P("instant",  CATS[4], "Instantánea clásica",     { instant: 100, fade: 40, warm: 25, soft: 25, vignette: 30, desat: 20, bloom: 15, fog: 20 }),
  P("instantc", CATS[4], "Instantánea fría",        { instant: 100, cool: 20, green: 15, punch: 25, vignette: 20, vivid: 10 }),
  P("instantbw",CATS[4], "Instantánea en blanco y negro", { instant: 100, mono: 100, fade: 40, soft: 20, grain: 20 }),

  /* ── Cámaras de juguete ── */
  P("plastic",  CATS[5], "Cámara de plástico",      { vignette: 85, soft: 55, leaks: 60, ca: 40, cross: 25, grain: 30, vivid: 25, fisheye: 15 }),
  P("lomo",     CATS[5], "Compacta de contrastes",  { vignette: 70, vivid: 70, punch: 55, cross: 40, warm: 15, ca: 30, grain: 25 }),
  P("dispos",   CATS[5], "Desechable con flash",    { flash: 70, warm: 25, grain: 50, vignette: 45, vivid: 20, punch: 30, desat: 10, stamp: 30 }),

  /* ── Compactas analógicas ── */
  P("flash35",  CATS[6], "Compacta de 35 mm con flash", { flash: 80, warm: 20, grain: 45, vignette: 35, punch: 25, stamp: 70 }),
  P("aps",      CATS[6], "Película con fecha impresa",  { stamp: 90, grain: 35, desat: 20, warm: 20, fade: 15, vignette: 20, soft: 15 }),
  P("iso400",   CATS[6], "Película de 400 ISO",         { grain: 60, warm: 15, fade: 20, halation: 25, vignette: 25, punch: 15 }),

  /* ── Compactas digitales CCD ── */
  P("ccd2005",  CATS[7], "Compacta digital de 2005",{ flash: 50, oversharp: 55, clip: 22, chromaNoise: 40, blocks: 30, smear: 30, vivid: 22, punch: 15, stamp: 70, lowRes: 20, bleed: 15 }),
  P("ccd2002",  CATS[7], "Compacta de 2 megapíxeles",{ lowRes: 70, blocks: 55, oversharp: 35, clip: 40, chromaNoise: 50, vivid: 25, stamp: 60, bleed: 25 }),
  P("ccdnight", CATS[7], "Compacta de noche",       { chromaNoise: 75, blocks: 45, flash: 40, soft: 35, crush: 20, cool: 20, bloom: 30, smear: 40, lowRes: 20 }),
  P("ccdsun",   CATS[7], "Compacta a pleno sol",    { clip: 45, smear: 55, vivid: 28, bloom: 40, ca: 30, oversharp: 45, punch: 25 }),
  P("ccdflash", CATS[7], "Flash directo",           { flash: 70, clip: 30, crush: 30, chromaNoise: 30, vignette: 45, punch: 45, oversharp: 40 }),
  P("ccd2008",  CATS[7], "Compacta de 2008",        { oversharp: 45, chromaNoise: 30, vivid: 35, soft: 15, blocks: 20, stamp: 60, punch: 20 }),

  /* ── Móviles y webcams ── */
  P("vga",      CATS[8], "Móvil con sensor VGA",    { lowRes: 90, blocks: 60, desat: 30, bleed: 35, soft: 30, chromaNoise: 40, oversharp: 25 }),
  P("webcam",   CATS[8], "Webcam de 2008",          { lowRes: 65, cool: 25, green: 10, soft: 35, blocks: 40, chromaNoise: 50, clip: 25, bleed: 25 }),
  P("phone09",  CATS[8], "Móvil de 2009",           { lowRes: 40, oversharp: 55, vivid: 30, blocks: 40, chromaNoise: 35, soft: 20 }),

  /* ── Vídeo y vigilancia ── */
  P("vhs",      CATS[9], "Cinta de vídeo doméstica",{ tape: 70, scanlines: 45, bleed: 70, lowRes: 40, soft: 35, desat: 15, chromaNoise: 30, crt: 20 }),
  P("cctv",     CATS[9], "Cámara de seguridad",     { mono: 80, green: 40, scanlines: 40, lowRes: 55, blocks: 45, tape: 25, stamp: 70, vignette: 25, crush: 30, fisheye: 25 }),
  P("crttv",    CATS[9], "Televisión de tubo",      { crt: 90, scanlines: 55, bleed: 40, bloom: 30, soft: 20, vignette: 30 }),
  P("dashcam",  CATS[9], "Cámara de coche",         { fisheye: 35, lowRes: 45, blocks: 40, punch: 25, clip: 40, vignette: 30, stamp: 80, desat: 15 }),

  /* ── Ópticas especiales ── */
  P("fisheye",  CATS[10], "Ojo de pez",             { fisheye: 90, vignette: 40, ca: 25 }),
  P("tilt",     CATS[10], "Maqueta (tilt-shift)",   { tilt: 85, vivid: 45, punch: 25 }),
  P("anamorph", CATS[10], "Lente anamórfica",       { streak: 80, bloom: 35, halation: 25, letterbox: 85, split: 30, vignette: 20 }),

  /* ══ Segunda tanda: más cámaras en las familias existentes ══ */

  /* ── Procesos del siglo XIX ── */
  P("platinum", CATS[0], "Platinotipia",            { sepia: 45, mono: 50, fade: 45, soft: 25, paper: 55, flat: 35, grain: 15 }),
  P("studio80", CATS[0], "Retrato de estudio de 1880",{ sepia: 80, paper: 70, vignette: 55, fade: 30, soft: 30, dust: 35, fog: 20 }),

  /* ── Cámaras de cajón y fuelle ── */
  P("pinhole",  CATS[1], "Cámara estenopeica",      { soft: 85, vignette: 80, mono: 70, fade: 25, grain: 40, fisheye: 25, leaks: 15 }),
  P("tlr",      CATS[1], "Réflex de dos objetivos", { soft: 15, vignette: 40, fade: 25, warm: 20, grain: 30, paper: 30, desat: 20 }),
  P("roll50",   CATS[1], "Película de rollo de 1950",{ mono: 100, fade: 25, grain: 45, vignette: 35, dust: 40, scratches: 20, soft: 20 }),
  P("bellows2", CATS[1], "Foto de estudio con fuelle",{ sepia: 55, mono: 40, vignette: 60, soft: 40, fade: 30, paper: 35, fog: 20 }),

  /* ── Película en color ── */
  P("portrait", CATS[2], "Negativo suave de retrato",{ warm: 28, fade: 32, desat: 14, grain: 22, soft: 10, halation: 20 }),
  P("landscape",CATS[2], "Película de paisaje saturada",{ vivid: 45, punch: 35, grain: 15, vignette: 15, cool: 8 }),
  P("sunfilm",  CATS[2], "Película de sol",         { warm: 50, leaks: 35, fade: 18, halation: 35, grain: 30, vivid: 20 }),
  P("greenfilm",CATS[2], "Película con dominante verde",{ green: 45, fade: 20, grain: 35, cool: 10, vignette: 20, desat: 10 }),
  P("tungsten", CATS[2], "Película de tungsteno",   { cool: 70, grain: 40, halation: 40, crush: 20, bloom: 20, vignette: 25 }),
  P("slidehi",  CATS[2], "Diapositiva contrastada", { punch: 70, vivid: 35, crush: 25, clip: 15, grain: 15, warm: 10 }),
  P("neg70",    CATS[2], "Negativo de los 70",      { warm: 30, fade: 48, desat: 28, grain: 45, flat: 25, vignette: 30, soft: 15, leaks: 12 }),
  P("warmcine", CATS[2], "Película de cine cálida", { warm: 45, split: 30, halation: 50, grain: 40, fade: 20, vignette: 25, bloom: 15 }),

  /* ── Película en blanco y negro ── */
  P("softbw",   CATS[3], "Blanco y negro suave",    { mono: 100, flat: 35, fade: 18, grain: 25, soft: 15, vignette: 20 }),
  P("noirportrait",CATS[3], "Retrato noir",         { mono: 100, punch: 65, crush: 45, vignette: 55, grain: 30, bloom: 10 }),
  P("photojourn",CATS[3], "Fotoperiodismo",         { mono: 100, punch: 40, grain: 65, crush: 20, vignette: 20, flat: 5 }),
  P("nightbw",  CATS[3], "Calle nocturna en blanco y negro",{ mono: 100, crush: 40, grain: 70, bloom: 35, halation: 20, punch: 35 }),

  /* ── Instantáneas ── */
  P("instantsepia",CATS[4], "Instantánea sepia",    { instant: 100, sepia: 70, fade: 35, soft: 20, vignette: 25 }),
  P("instantfade", CATS[4], "Instantánea de colores lavados",{ instant: 100, fade: 60, desat: 35, warm: 15, soft: 25, bloom: 20 }),
  P("instantleak", CATS[4], "Instantánea con fuga de luz",{ instant: 100, leaks: 70, fade: 30, warm: 20, soft: 20 }),

  /* ── Cámaras de juguete ── */
  P("filters",  CATS[5], "Compacta con filtros de colores",{ cross: 55, leaks: 35, vivid: 40, vignette: 60, magenta: 15, grain: 25, ca: 25 }),
  P("cardboard",CATS[5], "Cámara de cartón",        { soft: 60, vignette: 70, mono: 45, fade: 40, grain: 40, leaks: 25, dust: 20 }),
  P("minispy",  CATS[5], "Cámara en miniatura",     { lowRes: 50, green: 20, soft: 30, vignette: 55, grain: 40, vivid: 20, fade: 15 }),
  P("plasticlens",CATS[5], "Lente de plástico con viñeta",{ vignette: 95, soft: 40, ca: 55, warm: 25, vivid: 30, fisheye: 25 }),

  /* ── Compactas analógicas ── */
  P("zoom99",   CATS[6], "Compacta con zoom de 1999",{ flash: 55, warm: 15, grain: 38, vignette: 30, punch: 20, stamp: 60, soft: 12 }),
  P("expflash", CATS[6], "Película caducada con flash",{ flash: 60, magenta: 30, grain: 55, fade: 30, vignette: 40, stamp: 40, leaks: 20 }),
  P("onehour",  CATS[6], "Revelado en una hora",    { warm: 25, fade: 25, grain: 40, desat: 15, vignette: 20, punch: 20, soft: 15, paper: 20 }),
  P("pocket80", CATS[6], "Cámara de bolsillo de los 80",{ warm: 30, grain: 50, fade: 30, vignette: 40, soft: 25, stamp: 80, halation: 20 }),

  /* ── Compactas digitales CCD ── */
  P("ccd4mp",   CATS[7], "Compacta de 4 megapíxeles",{ oversharp: 40, chromaNoise: 30, vivid: 30, clip: 25, blocks: 20, stamp: 60, smear: 20, lowRes: 10 }),
  P("ccdindoor",CATS[7], "Compacta con flash de interior",{ flash: 60, chromaNoise: 45, clip: 20, vignette: 40, blocks: 30, stamp: 70, warm: 15, oversharp: 40 }),
  P("ccdback",  CATS[7], "Compacta a contraluz",    { smear: 60, bloom: 55, clip: 35, ca: 40, oversharp: 35, vivid: 18, flat: 10 }),
  P("ccdzoom",  CATS[7], "Compacta con zoom máximo",{ soft: 40, ca: 35, chromaNoise: 40, blocks: 35, oversharp: 55, vignette: 20, vivid: 25 }),
  P("ccdparty", CATS[7], "Compacta de fiesta",      { flash: 65, chromaNoise: 40, crush: 35, clip: 25, cool: 8, vignette: 50, punch: 30, stamp: 70 }),
  P("ccdmacro", CATS[7], "Compacta en modo macro",  { soft: 30, tilt: 40, vivid: 40, oversharp: 45, chromaNoise: 20, clip: 25 }),
  P("ccdbeach", CATS[7], "Compacta de playa",       { clip: 35, vivid: 30, cool: 10, bloom: 35, smear: 25, ca: 25, punch: 25, oversharp: 40 }),
  P("ccdtravel",CATS[7], "Compacta de viaje",       { vivid: 22, warm: 12, oversharp: 40, chromaNoise: 25, blocks: 20, stamp: 50, punch: 20, lowRes: 8, bleed: 10 }),

  /* ── Móviles y webcams ── */
  P("flipphone",CATS[8], "Móvil de tapa de 2006",   { lowRes: 70, blocks: 50, oversharp: 40, chromaNoise: 45, warm: 10, soft: 25, bleed: 30, vignette: 20 }),
  P("firstsmart",CATS[8], "Primer smartphone",      { lowRes: 45, oversharp: 50, vivid: 35, blocks: 35, chromaNoise: 35, cool: 8, vignette: 25, soft: 15 }),
  P("laptopcam",CATS[8], "Webcam con poca luz",     { lowRes: 55, chromaNoise: 70, cool: 30, blocks: 45, soft: 35, crush: 25, bleed: 35, green: 10 }),
  P("videocall",CATS[8], "Videollamada de 2010",    { lowRes: 60, blocks: 60, bleed: 45, soft: 30, desat: 20, cool: 15, oversharp: 30, flat: 15 }),
  P("squashed", CATS[8], "Foto muy comprimida",     { blocks: 85, lowRes: 50, bleed: 55, chromaNoise: 40, desat: 15, oversharp: 30 }),

  /* ── Vídeo y vigilancia ── */
  P("hi8",      CATS[9], "Videocámara de 8 mm",     { tape: 50, scanlines: 35, bleed: 55, lowRes: 30, soft: 30, warm: 20, fade: 20, stamp: 60, vignette: 25, grain: 30 }),
  P("broadcast90",CATS[9], "Retransmisión de los 90",{ scanlines: 40, bleed: 35, lowRes: 25, vivid: 25, bloom: 20, soft: 15, tape: 20, crt: 15 }),

  /* ── Ópticas especiales ── */
  P("telephoto",CATS[10], "Teleobjetivo comprimido",{ soft: 15, vignette: 35, ca: 20, bloom: 15, fade: 12, punch: 20 }),
  P("glasslens",CATS[10], "Lente de cristal con difusión",{ bloom: 60, soft: 45, halation: 40, fade: 20, vignette: 30, warm: 10 }),
  P("ultrawide",CATS[10], "Gran angular extremo",   { fisheye: 55, ca: 35, vignette: 30, punch: 15, vivid: 15 }),

  /* ══ Familias nuevas ══ */

  /* ── Cine y fotogramas ── */
  P("super8",   CATS[11], "Super 8 doméstico",      { warm: 40, fade: 35, grainBig: 55, leaks: 45, flicker: 50, soft: 35, dust: 40, scratches: 30, vignette: 40, desat: 15 }),
  P("mm16",     CATS[11], "16 mm de documental",    { grainBig: 50, fade: 28, desat: 30, flicker: 25, dust: 30, scratches: 20, vignette: 25, warm: 10, soft: 12 }),
  P("silent",   CATS[11], "Cine mudo",              { mono: 100, sepia: 35, flicker: 60, grainBig: 35, scratches: 55, dust: 55, iris: 40, vignette: 35, fade: 30, soft: 20 }),
  P("noirfilm", CATS[11], "Cine negro de los 40",   { mono: 100, punch: 55, crush: 40, grain: 40, vignette: 50, bloom: 25, scratches: 20, letterbox: 25 }),
  P("technicolor",CATS[11], "Color saturado de los 50",{ vivid: 70, punch: 40, warm: 20, grain: 20, halation: 25, bloom: 20, vignette: 20 }),
  P("western",  CATS[11], "Western polvoriento",    { warm: 55, sepia: 20, fade: 25, grain: 40, bloom: 30, fog: 20, vignette: 35, letterbox: 70, punch: 30 }),
  P("scifi",    CATS[11], "Ciencia ficción fría",   { cool: 45, green: 12, crush: 30, bloom: 40, streak: 50, grain: 25, vignette: 30, letterbox: 70, split: 30 }),
  P("horror",   CATS[11], "Cine de terror",         { desat: 45, green: 25, crush: 50, flicker: 35, grain: 50, vignette: 60, fog: 25, cool: 15 }),
  P("arthouse", CATS[11], "Cine de autor en 35 mm", { fade: 35, desat: 18, split: 30, grain: 35, halation: 30, vignette: 25, letterbox: 60, warm: 8 }),
  P("filmframe",CATS[11], "Fotograma de película",  { film: 85, grain: 40, dust: 30, scratches: 15, fade: 15, warm: 10 }),

  /* ── Científica y técnica ── */
  P("xray",     CATS[12], "Rayos X",                { xray: 100, grain: 30, bloom: 25, flat: 10, vignette: 20 }),
  P("thermal",  CATS[12], "Cámara térmica",         { thermal: 100, lowRes: 40, soft: 20, bleed: 10, grain: 20 }),
  P("irfield",  CATS[12], "Infrarrojo de campo",    { infrared: 80, mono: 40, cross: 30, bloom: 45, soft: 25, grain: 35, vignette: 20 }),
  P("microscope",CATS[12], "Microscopio óptico",    { iris: 90, cool: 25, vivid: 40, soft: 25, vignette: 30, bloom: 20, grain: 15, chromaNoise: 15 }),
  P("telescope",CATS[12], "Telescopio astronómico", { crush: 55, grain: 40, chromaNoise: 30, cool: 25, bloom: 30, starfilter: 40, mono: 20, iris: 20 }),
  P("endoscope",CATS[12], "Endoscopio",             { iris: 80, fisheye: 50, warm: 35, vivid: 25, bloom: 45, lowRes: 30, soft: 25, vignette: 20 }),
  P("radiograph",CATS[12], "Radiografía de contraste",{ xray: 70, mono: 60, punch: 40, crush: 30, grain: 20 }),
  P("polarized",CATS[12], "Microfotografía polarizada",{ cross: 70, vivid: 80, iris: 55, soft: 20, grain: 15, punch: 30, bloom: 25 }),

  /* ── Espía y acción ── */
  P("action",   CATS[13], "Cámara de acción",       { fisheye: 55, vivid: 40, punch: 30, ca: 25, oversharp: 35, clip: 20, vignette: 20 }),
  P("doorbell", CATS[13], "Timbre con cámara",      { fisheye: 50, lowRes: 35, cool: 20, blocks: 40, chromaNoise: 30, vignette: 30, desat: 15, crush: 15, stamp: 30 }),
  P("peephole", CATS[13], "Mirilla de puerta",      { fisheye: 95, iris: 70, soft: 40, vignette: 30, warm: 15, grain: 25, ca: 40 }),
  P("hidden",   CATS[13], "Cámara oculta",          { mono: 70, green: 35, grain: 55, lowRes: 40, tape: 25, scanlines: 25, vignette: 55, crush: 30, blocks: 30 }),
  P("nightvision",CATS[13], "Visión nocturna",      { mono: 100, green: 85, grain: 60, bloom: 45, crush: 20, lowRes: 30, vignette: 40, scanlines: 20 }),
  P("drone",    CATS[13], "Dron de bolsillo",       { fisheye: 30, vivid: 30, oversharp: 40, clip: 25, ca: 20, blocks: 15, soft: 8, punch: 20 }),

  /* ── Prensa e impresión ── */
  P("offset",   CATS[14], "Periódico en offset",    { halftone: 85, mono: 100, paper: 40, fade: 30, grain: 25, dust: 25 }),
  P("cmyk",     CATS[14], "Impresión en cuatricromía",{ halftone: 60, misreg: 70, vivid: 30, paper: 35, fade: 20 }),
  P("photocopy",CATS[14], "Fotocopia",              { mono: 100, punch: 85, crush: 35, clip: 30, grainBig: 55, dust: 45, fade: 10 }),
  P("fax",      CATS[14], "Fax",                    { threshold: 90, lowRes: 55, mono: 100, tape: 30, scanlines: 20, dust: 20 }),
  P("screenprint",CATS[14], "Cartel serigráfico",   { posterize: 85, vivid: 55, punch: 45, misreg: 25, paper: 30, grain: 15 }),
  P("magazine70",CATS[14], "Revista de los 70",     { halftone: 35, warm: 30, fade: 35, desat: 20, paper: 40, grain: 25, misreg: 20, vignette: 15 }),
  P("tabloid",  CATS[14], "Tabloide",               { halftone: 55, punch: 60, mono: 100, crush: 25, paper: 25, grain: 25, misreg: 15 }),
  P("comic",    CATS[14], "Cómic impreso",          { halftone: 70, posterize: 50, vivid: 55, misreg: 35, punch: 40, paper: 30 }),

  /* ── Pantallas y capturas ── */
  P("monitorphoto",CATS[15], "Foto a un monitor",   { moire: 70, crt: 25, scanlines: 35, bloom: 30, soft: 15, cool: 12, vignette: 20, flat: 10 }),
  P("lcd",      CATS[15], "Pantalla LCD",           { pixelgrid: 75, bloom: 15, vivid: 15, cool: 8, soft: 8, moire: 20 }),
  P("ledpanel", CATS[15], "Panel de LED",           { pixelgrid: 90, lowRes: 75, vivid: 55, bloom: 40, punch: 30, crush: 25 }),
  P("bartv",    CATS[15], "Televisión en un bar",   { crt: 55, scanlines: 45, bleed: 40, bloom: 40, moire: 40, vignette: 40, vivid: 15, soft: 20 }),
  P("console80",CATS[15], "Consola de los 80",      { lowRes: 70, crt: 70, scanlines: 60, bleed: 55, vivid: 35, bloom: 25, posterize: 30 }),
  P("atm",      CATS[15], "Cajero automático",      { mono: 70, green: 30, scanlines: 40, lowRes: 50, crt: 35, crush: 30, bloom: 30, stamp: 50 }),
  P("phonescreen",CATS[15], "Pantalla de móvil fotografiada",{ moire: 55, pixelgrid: 35, glare: 40, bloom: 20, cool: 10, vivid: 15, soft: 12 }),

  /* ── Digitalización de época ── */
  P("flatbed",  CATS[16], "Foto escaneada en plano",{ dust: 55, scratches: 25, desat: 12, fade: 25, paper: 35, warm: 10, glare: 10, soft: 10 }),
  P("slidescan",CATS[16], "Diapositiva escaneada", { vivid: 30, punch: 35, dust: 55, scratches: 15, crush: 20, fade: 8, warm: 8 }),
  P("photoofphoto",CATS[16], "Foto de una foto",    { glare: 60, moire: 20, fade: 30, desat: 20, paper: 30, soft: 30, vignette: 25, dust: 20 }),
  P("negscan",  CATS[16], "Negativo escaneado",     { invert: 100, warm: 55, fade: 20, grain: 30, dust: 40, flat: 20 }),
  P("damagedfilm",CATS[16], "Película dañada",      { fog: 55, leaks: 55, scratches: 55, dust: 60, fade: 40, desat: 30, grainBig: 40, warm: 25 }),
  P("faded",    CATS[16], "Impresión desvaída",     { fade: 55, desat: 45, warm: 35, paper: 40, flat: 30, dust: 20, soft: 15, glare: 15 }),

  /* ── Lentes y accesorios ── */
  P("starlens", CATS[17], "Filtro de estrellas",    { starfilter: 85, bloom: 30, halation: 15, soft: 8 }),
  P("diffusion",CATS[17], "Difusión suave",         { bloom: 55, soft: 35, halation: 30, fade: 15, flat: 15, warm: 8 }),
  P("dirtylens",CATS[17], "Lente sucia",            { smudge: 75, bloom: 35, flat: 20, fade: 20, soft: 15, halation: 25 }),
  P("scratchedlens",CATS[17], "Lente rayada con destellos",{ smudge: 35, streak: 40, bloom: 30, fade: 15, scratches: 25, ca: 20, halation: 20 }),
  P("macro",    CATS[17], "Tubo de extensión",      { tilt: 70, soft: 30, vivid: 25, vignette: 30, ca: 20, bloom: 10 }),
  P("bottle",   CATS[17], "Fondo de botella",       { soft: 60, fisheye: 25, ca: 60, leaks: 35, vignette: 55, warm: 20, bloom: 30, fade: 20 }),
  P("bluestreak",CATS[17], "Objetivo anamórfico azul",{ streak: 100, bloom: 30, cool: 25, letterbox: 60, halation: 15, split: 25, vignette: 15 }),
  P("nohood",   CATS[17], "Sin parasol",            { flat: 45, bloom: 50, fade: 30, halation: 20, leaks: 25, smudge: 20, ca: 15, desat: 10 }),

  /* ── Luz y clima ── */
  P("birthday", CATS[18], "Flash de cumpleaños",    { flash: 60, vivid: 30, clip: 15, crush: 20, chromaNoise: 20, vignette: 40, punch: 25, stamp: 40 }),
  P("neon",     CATS[18], "Luces de neón",          { split: 90, vivid: 55, crush: 45, bloom: 65, halation: 20, magenta: 30, grain: 30, cool: 20 }),
  P("rain",     CATS[18], "Lluvia en la lente",     { drops: 80, cool: 25, desat: 25, fog: 25, bloom: 20, flat: 15, vignette: 25 }),
  P("mist",     CATS[18], "Niebla",                 { fog: 80, flat: 50, desat: 35, bloom: 40, cool: 10, fade: 20 }),
  P("sunset",   CATS[18], "Contraluz de atardecer", { warm: 55, bloom: 70, halation: 40, leaks: 20, flat: 20, clip: 30, vignette: 25, streak: 20 }),
  P("snow",     CATS[18], "Nieve",                  { clip: 45, cool: 25, fade: 20, bloom: 35, flat: 20, grain: 20, desat: 10 }),
  P("nightcity",CATS[18], "Calle de noche",         { crush: 45, bloom: 50, halation: 30, split: 35, chromaNoise: 30, grain: 45, vignette: 40, cool: 10 })
];

export const preset = id => PRESETS.find(p => p.id === id) || null;

/** Familias que ya tienen cámaras, en orden. */
export const activeCats = () => CATS.filter(c => PRESETS.some(p => p.cat === c));
export const inCat = c => PRESETS.filter(p => p.cat === c);
