/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE PHOTO LENS · CATEGORÍAS, PRESETS Y MAPEO
   Ocho grupos, noventa y dos tipos de fotografía, y para cada uno el
   revelado que le sienta bien: saturación, calidez, claridad,
   contraste, vibrancia, sombras y luces, en una escala -100..100 que
   la intensidad del filtro multiplica después.

   Los presets son moderados a propósito —casi todo dentro de ±30—:
   un «preset de comida» que dispara la saturación al 60 % queda bien
   en la miniatura de una app y horrible en una foto vista entera. Lo
   que hace un buen revelador por tipo de foto es poco y en la
   dirección correcta: calidez y claridad en el pan, frío y detalle en
   la nieve, contraste y sombras hundidas en el low key, y en un
   retrato quitar claridad en vez de añadirla, porque la piel no pide
   textura.

   El modelo que clasifica es MobileNet entrenado en ImageNet: sabe de
   mil OBJETOS (un pastor alemán, un pretzel, un acantilado), no de
   géneros fotográficos. La tabla del final traduce cada una de esas
   mil clases al tipo de foto que suele contenerla; lo que ImageNet no
   ve —un retrato, un contraluz, un blanco y negro— lo cubren unas
   pocas medidas directas sobre los píxeles en `classify.js`.
   ═══════════════════════════════════════════════════════════════ */

export const GROUPS = [
  { id:"auto",     label:"Detección automática" },
  { id:"food",     label:"Comida & Bebida" },
  { id:"animals",  label:"Animales" },
  { id:"nature",   label:"Naturaleza & Paisajes" },
  { id:"arch",     label:"Arquitectura" },
  { id:"portrait", label:"Retratos" },
  { id:"special",  label:"Fotografía Especial" },
  { id:"misc",     label:"Especiales" }
];

/* [id, grupo, nombre, sat, calidez, claridad, contraste, vibrancia, sombras, luces] */
const ROWS = [
  ["auto", "auto", "Detección automática", 0, 0, 0, 0, 0, 0, 0],

  // ── Comida & Bebida (14) ──
  ["food-hot",       "food", "Platos calientes",            12, 18, 15, 10, 15,  8,  -6],
  ["food-salad",     "food", "Ensaladas y verduras",        14, -4, 18,  8, 22,  6,  -4],
  ["food-fruit",     "food", "Frutas",                      16,  8, 12, 10, 24,  4,  -6],
  ["food-dessert",   "food", "Postres y dulces",             8, 14,  6,  6, 14, 12,  -8],
  ["food-bakery",    "food", "Panadería y bollería",         6, 22, 20, 12,  8,  6, -10],
  ["food-coffee",    "food", "Café y té",                    0, 20, 12, 14,  6, -4,  -8],
  ["food-cocktail",  "food", "Cócteles y bebidas",          14,  4, 14, 14, 18, -6,  -4],
  ["food-wine",      "food", "Vino y cerveza",               8, 16, 10, 16, 10, -8,  -6],
  ["food-meat",      "food", "Carne y barbacoa",            10, 22, 22, 16, 10, -4, -10],
  ["food-seafood",   "food", "Pescado y marisco",            8, -6, 16, 10, 14,  8,  -6],
  ["food-pasta",     "food", "Pasta y pizza",               12, 18, 16, 12, 14,  6,  -8],
  ["food-sushi",     "food", "Sushi y cocina asiática",     10, -2, 18, 12, 16,  4,  -4],
  ["food-breakfast", "food", "Desayuno",                     8, 14,  8,  6, 12, 14,  -6],
  ["food-product",   "food", "Producto gastronómico",        6,  4, 20, 14, 10, 10, -12],

  // ── Animales (14) ──
  ["animal-dog",     "animals", "Perros",                    6,  8, 18, 10, 10, 12,  -8],
  ["animal-cat",     "animals", "Gatos",                     4,  6, 16, 10,  8, 12,  -8],
  ["animal-bird",    "animals", "Aves",                     12,  2, 22, 12, 18,  8,  -8],
  ["animal-horse",   "animals", "Caballos y ganado",         6, 10, 16, 12,  8,  8,  -8],
  ["animal-wild",    "animals", "Fauna salvaje",             8,  8, 20, 14, 12, 10, -10],
  ["animal-insect",  "animals", "Insectos y macro animal",  14,  2, 28, 14, 16,  6,  -6],
  ["animal-reptile", "animals", "Reptiles y anfibios",      10,  4, 24, 14, 14,  8,  -6],
  ["animal-fish",    "animals", "Peces y vida marina",      12, -8, 18, 12, 18, 10,  -4],
  ["animal-small",   "animals", "Mascotas pequeñas",         6,  8, 14,  8, 10, 14,  -8],
  ["animal-snow",    "animals", "Animales en la nieve",      4, -6, 16, 10,  8,  6, -14],
  ["animal-safari",  "animals", "Safari",                    8, 16, 20, 14, 12,  6, -10],
  ["animal-flight",  "animals", "Aves en vuelo",             8,  0, 24, 16, 12, 10, -12],
  ["animal-farm",    "animals", "Animales de granja",        6, 10, 14, 10,  8, 10,  -8],
  ["animal-zoo",     "animals", "Acuario y zoo",            10,  0, 16, 14, 14, 12,  -6],

  // ── Naturaleza & Paisajes (14) ──
  ["nature-mountain",  "nature", "Montaña",                10, -2, 24, 16, 14,  6, -12],
  ["nature-beach",     "nature", "Playa y costa",          12,  8, 14, 10, 18,  4, -10],
  ["nature-forest",    "nature", "Bosque",                  8,  4, 20, 12, 16, 14,  -8],
  ["nature-desert",    "nature", "Desierto",                8, 18, 22, 14, 10,  4,  -8],
  ["nature-lake",      "nature", "Lago y río",             10, -4, 16, 12, 16,  6,  -8],
  ["nature-waterfall", "nature", "Cascada",                 8, -6, 18, 10, 14,  8, -14],
  ["nature-sunset",    "nature", "Atardecer y amanecer",   16, 22, 10, 14, 20,  4, -12],
  ["nature-snow",      "nature", "Nieve e invierno",        2,-10, 16,  8,  6,  8, -14],
  ["nature-autumn",    "nature", "Otoño",                  16, 20, 18, 12, 18,  6,  -8],
  ["nature-field",     "nature", "Campo y prados",         10,  8, 16, 10, 16,  6,  -8],
  ["nature-flowers",   "nature", "Flores y jardín",        14,  4, 14,  8, 22,  8,  -8],
  ["nature-sky",       "nature", "Cielo y nubes",          12, -6, 20, 14, 16,  4, -16],
  ["nature-night",     "nature", "Noche y estrellas",      10, -8, 26, 22, 12, -6,   8],
  ["nature-fog",       "nature", "Tormenta y niebla",      -6, -8, 22, 18,  4, -4,  -6],

  // ── Arquitectura (12) ──
  ["arch-modern",     "arch", "Edificios modernos",         0, -6, 26, 18,  6,  4, -10],
  ["arch-historic",   "arch", "Arquitectura histórica",     4, 10, 24, 14,  8,  8, -10],
  ["arch-church",     "arch", "Iglesias y templos",         2,  8, 22, 14,  6, 12, -12],
  ["arch-interior",   "arch", "Interiores",                 2,  6, 16,  8,  8, 16, -14],
  ["arch-street",     "arch", "Calles urbanas",             4,  2, 24, 16, 10,  8,  -8],
  ["arch-bridge",     "arch", "Puentes",                    4, -4, 26, 18,  8,  6, -10],
  ["arch-skyline",    "arch", "Rascacielos y skyline",      4, -8, 26, 20, 10,  6, -12],
  ["arch-ruins",      "arch", "Ruinas y monumentos",        2, 12, 26, 14,  6,  8, -10],
  ["arch-facade",     "arch", "Fachadas y detalles",        6,  4, 28, 16, 10,  6,  -8],
  ["arch-doors",      "arch", "Puertas y ventanas",         8,  6, 24, 14, 12,  8,  -8],
  ["arch-industrial", "arch", "Arquitectura industrial",   -8, -6, 30, 20,  0,  4,  -8],
  ["arch-night",      "arch", "Noche urbana",              10, -4, 20, 20, 14, -4,   6],

  // ── Retratos (12) ──
  ["portrait-classic", "portrait", "Retrato clásico",         -2,  6, -6,  6,  8, 10,  -8],
  ["portrait-outdoor", "portrait", "Retrato en exterior",      2,  8,  0,  8, 10, 12, -10],
  ["portrait-studio",  "portrait", "Retrato de estudio",      -4,  4, -4, 10,  6,  6,  -6],
  ["portrait-group",   "portrait", "Grupo y familia",          2,  6,  2,  8, 10, 12,  -8],
  ["portrait-kids",    "portrait", "Niños y bebés",            0, 10,-10,  4,  8, 14,  -6],
  ["portrait-wedding", "portrait", "Boda",                    -4,  8, -6,  4,  6, 14, -10],
  ["portrait-fashion", "portrait", "Moda y editorial",        -6, -2,  8, 14,  8,  2,  -6],
  ["portrait-bw",      "portrait", "Retrato en blanco y negro", -100, 0, 10, 16, 0, 8, -8],
  ["portrait-sport",   "portrait", "Deportes y acción",        6,  2, 20, 16, 12,  6,  -8],
  ["portrait-street",  "portrait", "Retrato de calle",         0,  4, 10, 12,  8,  8,  -8],
  ["portrait-selfie",  "portrait", "Selfie",                   2,  8, -8,  4, 10, 14,  -8],
  ["portrait-pet",     "portrait", "Persona con mascota",      2,  8,  4,  8, 10, 12,  -8],

  // ── Fotografía Especial (12) ──
  ["special-macro",      "special", "Macro",                   8,  2, 24, 12, 14,  8,  -8],
  ["special-astro",      "special", "Astrofotografía",        12,-12, 30, 26, 14, -8,  10],
  ["special-longexp",    "special", "Larga exposición",        6, -6, 14, 14, 10,  4, -10],
  ["special-bw",         "special", "Blanco y negro",       -100,  0, 18, 20,  0,  6,  -8],
  ["special-aerial",     "special", "Aérea y dron",           10, -4, 26, 16, 16,  6, -10],
  ["special-underwater", "special", "Submarina",              14, 18, 20, 14, 18,  8,  -4],
  ["special-night",      "special", "Fotografía nocturna",     8, -6, 20, 18, 12, -4,   6],
  ["special-highkey",    "special", "Alta clave (high key)",  -4,  4, -6, -8,  6, 22,  10],
  ["special-lowkey",     "special", "Baja clave (low key)",   -4, -2, 14, 24,  4,-22,  -6],
  ["special-hdr",        "special", "HDR",                    10,  2, 32,  6, 18, 26, -26],
  ["special-silhouette", "special", "Silueta",                12, 14, 12, 26, 14,-26,   4],
  ["special-backlight",  "special", "Contraluz",               6, 12,  8, 10, 12, 18, -18],

  // ── Especiales (13) ──
  ["misc-product",   "misc", "Producto y e-commerce",       4,  0, 20, 12,  8, 12, -10],
  ["misc-car",       "misc", "Vehículos y coches",          6, -4, 26, 18, 10,  4, -10],
  ["misc-moto",      "misc", "Motos y bicicletas",          6, -2, 26, 16, 10,  6,  -8],
  ["misc-plane",     "misc", "Aviones y trenes",            4, -6, 24, 16,  8,  6, -12],
  ["misc-boat",      "misc", "Barcos y náutica",            8, -4, 20, 14, 14,  6, -12],
  ["misc-tech",      "misc", "Tecnología y gadgets",       -2, -6, 24, 16,  4,  8,  -8],
  ["misc-document",  "misc", "Documento y escaneado",     -20,  0, 26, 26,  0,-10,  12],
  ["misc-art",       "misc", "Arte y pintura",              6,  2, 10,  6, 10,  6,  -6],
  ["misc-texture",   "misc", "Texturas y patrones",         4,  0, 34, 18,  6,  4,  -8],
  ["misc-clothing",  "misc", "Ropa y calzado",              6,  2, 16, 10, 10, 10,  -8],
  ["misc-jewelry",   "misc", "Joyería y relojes",           2,  0, 30, 18,  6,  6, -10],
  ["misc-event",     "misc", "Eventos y conciertos",       10,  4, 12, 18, 14, -4,  -6],
  ["misc-fireworks", "misc", "Fuegos artificiales",        16,  0, 18, 22, 18,-10,   6]
];

export const ADJ_KEYS = ["sat", "warmth", "clarity", "contrast", "vibrance", "shadows", "highlights"];
export const ADJ_LABELS = {
  sat:"Saturación", warmth:"Calidez", clarity:"Claridad", contrast:"Contraste",
  vibrance:"Vibrancia", shadows:"Sombras", highlights:"Luces"
};

export const CATEGORIES = ROWS.map(([id, group, label, ...v]) => ({
  id, group, label,
  preset: Object.fromEntries(ADJ_KEYS.map((k, i) => [k, v[i]]))
}));
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
export const CATEGORY_COUNT = CATEGORIES.length;   // 92

export const neutralAdj = () => Object.fromEntries(ADJ_KEYS.map(k => [k, 0]));

/* ── ImageNet → tipo de foto ────────────────────────────────────
   Reglas por índice de clase, aplicadas en orden: la última que cubra
   un índice gana. Un número es un índice, un par [a,b] es un rango
   inclusivo. `wear` marca prendas y accesorios: por sí solas son
   «ropa», pero si la imagen tiene piel son un retrato, y eso lo decide
   `classify.js` con esa marca. */
const RULES = [
  // Fauna
  [[[0, 6], [389, 397], [107, 126], [147, 150], [327, 329]], "animal-fish"],
  [[[7, 24], [80, 100], [127, 146]], "animal-bird"],
  [[[25, 68]], "animal-reptile"],
  [[[69, 79], [300, 326]], "animal-insect"],
  [[[101, 106], [269, 280], [286, 287], [294, 295], 297, [341, 344],
    [346, 347], [349, 350], [356, 388]], "animal-wild"],
  [[296, 145], "animal-snow"],
  [[[151, 268]], "animal-dog"],
  [[[281, 285]], "animal-cat"],
  [[[288, 293], 298, 299, 340, [351, 354], 385, 386], "animal-safari"],
  [[[330, 338]], "animal-small"],
  [[339, 603, 690], "animal-horse"],
  [[7, 8, 345, 348, 355, 341, 425], "animal-farm"],

  // Comida y bebida
  [[924, 925, 926, 933, 934, 935, 964, 965, 567, 909, 762, 532, 521, 544, 766], "food-hot"],
  [[[936, 947]], "food-salad"],
  [[[948, 957]], "food-fruit"],
  [[927, 928, 929, 960, 509], "food-dessert"],
  [[930, 931, 932, 961, 415], "food-bakery"],
  [[967, 968, 504, 505, 550, 849], "food-coffee"],
  [[969, 503, 737, 898, 899], "food-cocktail"],
  [[966, 440, 441, 572, 907, 901], "food-wine"],
  [[962, 467, 499], "food-meat"],
  [[959, 963], "food-pasta"],
  [[659, 809, 923, 725, 868, 922, 582, 773, 618, 910, 813, 647], "food-product"],

  // Naturaleza
  [[970, 972, 979, 980], "nature-mountain"],
  [[976, 977, 978, 437, 460], "nature-beach"],
  [[[988, 997], 672], "nature-forest"],
  [[975], "nature-lake"],
  [[974], "nature-waterfall"],
  [[958, 987, 998, 730, 595, 866], "nature-field"],
  [[984, 985, 986, 883], "nature-flowers"],
  [[973], "special-underwater"],

  // Arquitectura
  [[483, 698, 663, 873, 682, 649, 863, 500, 915], "arch-historic"],
  [[497, 668, 832, 406, 442, 538], "arch-church"],
  [[498, 624, 743, 727, 526, 453, 495, 493, 564, 831, 765, 846, 619, 894,
    598, 548, 559, 857, 861, 435, 896, 794, 760, 827, 651, 534, 706, 580,
    660, 449, 425, 736, 753, 811, 782], "arch-interior"],
  [[919, 920, 704, 703, 640, 562, 557, 800, 886, 877, 637, 707, 771], "arch-street"],
  [[821, 839, 888, 525, 718, 536], "arch-bridge"],
  [[825, 912, 716, 489, 858, 853, 421], "arch-facade"],
  [[799, 789, 904, 905, 695], "arch-doors"],
  [[634, 540, 900, 807, 755, 517, 561], "arch-industrial"],

  // Vehículos y transporte
  [[407, 436, 468, 511, 609, 627, 656, 661, 717, 751, 817, 864, 867, 569,
    555, 654, 779, 675, 734, 757, 475, 479, 581, 573, 575, 586, 847, 803,
    571, 535, 686, 785], "misc-car"],
  [[665, 670, 671, 444, 870, 880, 518], "misc-moto"],
  [[404, 405, 895, 908, 812, 466, 547, 820, 565, 705, 829, 874, 701, 417, 726], "misc-plane"],
  [[403, 472, 484, 510, 554, 576, 625, 628, 780, 814, 833, 871, 914, 724,
    693, 694, 913], "misc-boat"],

  // Objetos
  [[487, 508, 527, 590, 620, 605, 664, 681, 742, 851, 662, 592, 673, 613,
    761, 878, 745, 688, 754, 848, 482, 485, 759, 732, 872, 622, 633, 447,
    530, 528, 713, 844, 810, 632], "misc-tech"],
  [[916, 917, 918, 921, 549, 692, 446, 553, 418, 563, 749, 769, 798, 611, 646], "misc-document"],
  [[679, 531, 826, 409, 892, 604, 835, 464, 584], "misc-jewelry"],
  [[599, 815, 616, 488, 506, 885, 750, 741, 539, 700, 999, 971, 911, 519, 478], "misc-texture"],
  [[696, 739, 883, 594], "misc-art"],
  [[401, 402, 420, 432, 486, 513, 541, 546, 558, 566, 579, 593, 641, 642,
    650, 683, 684, 687, 699, 776, 822, 875, 881, 889, 818, 819, 854, 476,
    645, 843, 470, 862, 626, 644, 607], "misc-event"],
  [[788, 748, 893, 414, 770, 774, 502, 630, 514], "misc-clothing"],

  // Personas: deporte, boda, bebés, y lo que se lleva puesto
  [[981, 429, 430, 768, 805, 852, 890, 574, 722, 746, 752, 416, 602, 702,
    422, 543, 747, 795, 450, 802, 537, 560], "portrait-sport"],
  [[982], "portrait-wedding"],
  [[431, 516, 520, 529, 850, 443, 680], "portrait-kids"],
  [[983, 801], "special-underwater"],
  [[399, 400, 411, 445, 452, 457, 459, 474, 501, 515, 568, 578, 601, 608,
    610, 614, 617, 638, 639, 652, 655, 658, 689, 697, 735, 775, 806, 808,
    824, 834, 841, 842, 869, 887, 906, 836, 837, 903, 643, 629, 551, 585,
    711, 838, 433, 796, 667, 715, 439, 465, 524, 461], "misc-clothing", "wear"]
];

/* Índice → { cat, wear } para las 1000 clases; lo que ninguna regla
   cubre es un objeto cualquiera: foto de producto. */
export const IMAGENET_MAP = (() => {
  const map = new Array(1000).fill(null).map(() => ({ cat: "misc-product", wear: false }));
  for(const [spec, cat, flag] of RULES){
    for(const s of spec){
      const [a, b] = Array.isArray(s) ? s : [s, s];
      for(let i = a; i <= b; i++) map[i] = { cat, wear: flag === "wear" };
    }
  }
  return map;
})();
