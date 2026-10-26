/* ═══════════════════════════════════════════════════════════════
   MEMES · MODELO
   Un texto del meme lleva todas sus propiedades en un objeto plano.
   Las medidas son RELATIVAS para que el diseño se pueda cambiar sin
   romper nada:
     · x, y, w     → % del ancho / alto del lienzo del meme
     · size        → cuerpo de letra en milésimas del ancho del lienzo
     · contornos, sombra, brillo, relieve, relleno de fondo → % del
       cuerpo de letra, así escalan con el texto.

   `PROPS` describe cada propiedad para la interfaz: el panel de
   escritorio las agrupa por secciones y en móvil se eligen de un
   desplegable con su control debajo.
   ═══════════════════════════════════════════════════════════════ */

import { FONTS } from "./fonts.js";

export const TEXT_DEFAULTS = {
  text: "TEXTO", x: 50, y: 50, w: 90, rot: 0, opacity: 100,
  font: "Anton", size: 90, bold: false, italic: false, caps: true, align: "center", lineHeight: 110, tracking: 0,
  fill: "solid", color: "#ffffff", color2: "#ffd84d", gradAngle: 90,
  stroke: 12, strokeColor: "#000000", stroke2: 0, stroke2Color: "#ffffff",
  shadow: 0, shadowAngle: 135, shadowBlur: 20, shadowColor: "#000000", shadowOpacity: 70,
  glow: 0, glowColor: "#00e5ff",
  extrude: 0, extrudeColor: "#1b1b1b", extrudeAngle: 135,
  bgShape: "none", bgColor: "#ffffff", bgOpacity: 100, bgPad: 30, bgRadius: 30,
  curve: 0, glitch: 0
};

const R = (group, key, label, min, max, unit = "") => ({ group, key, label, type: "range", min, max, unit });
const Col = (group, key, label) => ({ group, key, label, type: "color" });
const Sel = (group, key, label, options) => ({ group, key, label, type: "select", options });
const Tog = (group, key, label) => ({ group, key, label, type: "toggle" });

export const PROP_GROUPS = [
  ["texto", "Texto"], ["tipo", "Tipografía"], ["relleno", "Relleno"], ["contorno", "Contornos"],
  ["sombra", "Sombra y brillo"], ["relieve", "Relieve 3D"], ["fondo", "Fondo del texto"], ["forma", "Forma y posición"]
];

export const PROPS = [
  { group: "texto", key: "text", label: "Texto", type: "text" },
  { group: "texto", key: "preset", label: "Estilo rápido", type: "preset" },
  Sel("tipo", "font", "Tipografía", FONTS.map(f => [f[0], f[3]])),
  R("tipo", "size", "Tamaño", 10, 300),
  Tog("tipo", "bold", "Negrita"),
  Tog("tipo", "italic", "Cursiva"),
  Tog("tipo", "caps", "Mayúsculas"),
  Sel("tipo", "align", "Alineación", [["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]]),
  R("tipo", "lineHeight", "Interlineado", 70, 200, " %"),
  R("tipo", "tracking", "Espaciado", -10, 60),
  Sel("relleno", "fill", "Tipo de relleno", [["solid", "Color sólido"], ["gradient", "Degradado"]]),
  Col("relleno", "color", "Color"),
  Col("relleno", "color2", "Segundo color"),
  R("relleno", "gradAngle", "Ángulo del degradado", 0, 360, "°"),
  R("contorno", "stroke", "Contorno", 0, 40),
  Col("contorno", "strokeColor", "Color del contorno"),
  R("contorno", "stroke2", "Contorno exterior", 0, 40),
  Col("contorno", "stroke2Color", "Color exterior"),
  R("sombra", "shadow", "Sombra", 0, 60),
  R("sombra", "shadowAngle", "Dirección de la sombra", 0, 360, "°"),
  R("sombra", "shadowBlur", "Difuminado", 0, 100),
  Col("sombra", "shadowColor", "Color de la sombra"),
  R("sombra", "shadowOpacity", "Opacidad de la sombra", 0, 100, " %"),
  R("sombra", "glow", "Brillo / neón", 0, 100),
  Col("sombra", "glowColor", "Color del brillo"),
  R("sombra", "glitch", "Glitch RGB", 0, 100),
  R("relieve", "extrude", "Profundidad 3D", 0, 60),
  Col("relieve", "extrudeColor", "Color del relieve"),
  R("relieve", "extrudeAngle", "Dirección del relieve", 0, 360, "°"),
  Sel("fondo", "bgShape", "Forma del fondo", [["none", "Sin fondo"], ["rect", "Rectángulo"], ["round", "Redondeado"],
    ["pill", "Píldora"], ["bubble", "Bocadillo de cómic"], ["thought", "Bocadillo de pensamiento"], ["highlight", "Subrayador"]]),
  Col("fondo", "bgColor", "Color del fondo"),
  R("fondo", "bgOpacity", "Opacidad del fondo", 0, 100, " %"),
  R("fondo", "bgPad", "Margen del fondo", 0, 150),
  R("fondo", "bgRadius", "Redondeo", 0, 100),
  R("forma", "w", "Ancho de la caja", 10, 100, " %"),
  R("forma", "curve", "Curvatura", -100, 100),
  R("forma", "rot", "Rotación", -180, 180, "°"),
  R("forma", "opacity", "Opacidad", 0, 100, " %")
];
export const prop = key => PROPS.find(p => p.key === key);

/* Estilos rápidos: sólo tocan el aspecto, nunca el texto ni la
   posición ni el tamaño. */
const RESET = { fill: "solid", stroke: 0, stroke2: 0, shadow: 0, glow: 0, extrude: 0, bgShape: "none", curve: 0, glitch: 0, italic: false };
export const TEXT_PRESETS = [
  ["classic", "Meme clásico", { ...RESET, font: "Anton", caps: true, color: "#ffffff", stroke: 12, strokeColor: "#000000" }],
  ["impact", "Impact de toda la vida", { ...RESET, font: "Impact", caps: true, color: "#ffffff", stroke: 10, strokeColor: "#000000" }],
  ["modern", "Moderno (texto negro)", { ...RESET, font: "Inter", bold: true, caps: false, color: "#111111" }],
  ["caption", "Pie de foto", { ...RESET, font: "Roboto", bold: true, caps: false, color: "#ffffff", shadow: 8, shadowBlur: 40, shadowOpacity: 90 }],
  ["subtitle", "Subtítulo de película", { ...RESET, font: "Roboto", bold: true, caps: false, color: "#ffe14d", stroke: 5, strokeColor: "#000000", shadow: 6, shadowBlur: 20 }],
  ["neon", "Neón", { ...RESET, font: "Monoton", caps: true, color: "#ffffff", glow: 70, glowColor: "#ff2bd6", stroke: 3, strokeColor: "#ff9cf0" }],
  ["neonblue", "Neón azul", { ...RESET, font: "Righteous", caps: true, color: "#e8fdff", glow: 80, glowColor: "#00e5ff" }],
  ["retro3d", "Retro 3D", { ...RESET, font: "Righteous", caps: true, fill: "gradient", color: "#fff45c", color2: "#ff5c8a", gradAngle: 90, stroke: 5, strokeColor: "#2a0a3d", extrude: 25, extrudeColor: "#2a0a3d", extrudeAngle: 135 }],
  ["comic", "Cómic", { ...RESET, font: "Bangers", caps: true, color: "#ffe600", stroke: 8, strokeColor: "#000000", extrude: 12, extrudeColor: "#000000", extrudeAngle: 135 }],
  ["bubble", "Bocadillo", { ...RESET, font: "Comic Neue", bold: true, caps: false, color: "#111111", bgShape: "bubble", bgColor: "#ffffff", bgPad: 45, bgOpacity: 100 }],
  ["gold", "Oro", { ...RESET, font: "Playfair Display", bold: true, caps: true, fill: "gradient", color: "#fff1a8", color2: "#b8860b", gradAngle: 90, stroke: 3, strokeColor: "#5a3d00", shadow: 8, shadowBlur: 25 }],
  ["fire", "Fuego", { ...RESET, font: "Anton", caps: true, fill: "gradient", color: "#fff27a", color2: "#ff3d00", gradAngle: 90, glow: 45, glowColor: "#ff6a00", stroke: 3, strokeColor: "#7a1500" }],
  ["ice", "Hielo", { ...RESET, font: "Bebas Neue", caps: true, fill: "gradient", color: "#ffffff", color2: "#6fd6ff", gradAngle: 90, stroke: 4, strokeColor: "#0b3a5c", glow: 30, glowColor: "#9be7ff" }],
  ["sticker", "Pegatina", { ...RESET, font: "Luckiest Guy", caps: true, color: "#ff4d6d", stroke: 8, strokeColor: "#ffffff", stroke2: 5, stroke2Color: "#222222", shadow: 10, shadowBlur: 15 }],
  ["double", "Contorno doble", { ...RESET, font: "Anton", caps: true, color: "#ffffff", stroke: 8, strokeColor: "#000000", stroke2: 8, stroke2Color: "#ffd000" }],
  ["hardshadow", "Sombra dura", { ...RESET, font: "Montserrat", bold: true, caps: true, color: "#ffffff", shadow: 14, shadowBlur: 0, shadowOpacity: 100, shadowColor: "#ff3d7f" }],
  ["glitch", "Glitch", { ...RESET, font: "Press Start 2P", caps: true, color: "#ffffff", glitch: 60 }],
  ["typewriter", "Máquina de escribir", { ...RESET, font: "Special Elite", caps: false, color: "#1d1d1d", bgShape: "rect", bgColor: "#f4efe1", bgPad: 35 }],
  ["marker", "Rotulador", { ...RESET, font: "Permanent Marker", caps: false, color: "#111111", bgShape: "highlight", bgColor: "#fff34d", bgPad: 25 }],
  ["handwritten", "A mano", { ...RESET, font: "Caveat", bold: true, caps: false, color: "#1a1a1a" }],
  ["horror", "Terror", { ...RESET, font: "Creepster", caps: true, color: "#b30000", stroke: 4, strokeColor: "#000000", glow: 30, glowColor: "#ff0000" }],
  ["news", "Titular", { ...RESET, font: "Oswald", bold: true, caps: true, color: "#ffffff", bgShape: "rect", bgColor: "#d10000", bgPad: 30 }],
  ["pill", "Etiqueta", { ...RESET, font: "Fredoka", bold: true, caps: false, color: "#ffffff", bgShape: "pill", bgColor: "#111111", bgOpacity: 80, bgPad: 45 }],
  ["elegant", "Elegante", { ...RESET, font: "Playfair Display", italic: true, caps: false, color: "#ffffff", shadow: 5, shadowBlur: 50, shadowOpacity: 80 }],
  ["military", "Militar", { ...RESET, font: "Black Ops One", caps: true, color: "#c8d6a0", stroke: 4, strokeColor: "#1f2a12", shadow: 6, shadowBlur: 10 }],
  ["arcade", "Arcade", { ...RESET, font: "Press Start 2P", caps: true, fill: "gradient", color: "#48f7ff", color2: "#b44cff", gradAngle: 90, extrude: 15, extrudeColor: "#15002b", stroke: 3, strokeColor: "#15002b" }]
];

let uid = 0;
export const newText = (over = {}) => ({ ...TEXT_DEFAULTS, ...over, uid: ++uid });
export const applyPreset = (t, id) => { const p = TEXT_PRESETS.find(x => x[0] === id); if(p) Object.assign(t, p[2]); };
