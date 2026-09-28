/* ═══════════════════════════════════════════════════════════════
   CAPAS DE TEXTO
   El texto se guarda como texto, no como píxeles: la capa conserva
   su contenido y sus atributos y se vuelve a dibujar cuando algo
   cambia. Así se puede reeditar una y otra vez sin pérdida, que es
   lo que espera cualquiera que venga de Photoshop o Photopea.
   Sólo se rasteriza de verdad al exportar o al acoplar.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { record } from "../core/history.js";
import { googleFontItems, isGoogleStack, ensureFont } from "./gfonts.js";

/* Fuentes presentes en la práctica totalidad de los equipos, con
   sustitutas equivalentes de Windows, macOS/iOS y Android para que
   cada entrada tenga algo parecido en todas partes. Detrás van las
   tipografías libres alojadas en /fonts/ (ver gfonts.js): las más
   usadas en la lista y el resto en el buscador. Quien quiera otra la carga desde un archivo suyo
   (.ttf/.otf/.woff/.woff2), que se registra en el navegador con la API
   FontFace y se guarda localmente. */
/* Valor de las entradas de lista que sólo separan grupos. */
export const FONT_SEPARATOR = "__sep__";
export const FONTS = [
  // Sans
  ["system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",           "Sistema"],
  ["Arial, Helvetica, 'Liberation Sans', sans-serif",                     "Arial"],
  ["'Arial Black', 'Arial Bold', Gadget, sans-serif",                     "Arial Black"],
  ["'Helvetica Neue', Helvetica, Arial, sans-serif",                      "Helvetica"],
  ["'Segoe UI', 'San Francisco', Roboto, 'Noto Sans', sans-serif",        "Segoe UI"],
  ["Roboto, 'Segoe UI', 'Noto Sans', sans-serif",                         "Roboto"],
  ["'Noto Sans', 'Segoe UI', Roboto, sans-serif",                         "Noto Sans"],
  ["Calibri, Carlito, 'Segoe UI', sans-serif",                            "Calibri"],
  ["Candara, 'Segoe UI', sans-serif",                                     "Candara"],
  ["Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', sans-serif",  "Bahnschrift"],
  ["'Franklin Gothic Medium', 'Franklin Gothic', 'Arial Narrow', sans-serif", "Franklin Gothic"],
  ["'Century Gothic', 'Avenir Next', 'URW Gothic', sans-serif",           "Century Gothic"],
  ["'Gill Sans', 'Gill Sans MT', Calibri, sans-serif",                    "Gill Sans"],
  ["Futura, 'Century Gothic', 'Trebuchet MS', sans-serif",                "Futura"],
  ["Optima, Candara, 'Segoe UI', sans-serif",                             "Optima"],
  ["Avenir, 'Avenir Next', 'Century Gothic', sans-serif",                 "Avenir"],
  ["Verdana, Geneva, 'DejaVu Sans', sans-serif",                          "Verdana"],
  ["Tahoma, Geneva, 'DejaVu Sans', sans-serif",                           "Tahoma"],
  ["'Trebuchet MS', 'Lucida Grande', sans-serif",                         "Trebuchet"],
  ["'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', sans-serif",   "Lucida Sans"],
  ["'Arial Narrow', 'Helvetica Neue Condensed', 'Roboto Condensed', sans-serif", "Arial Narrow"],
  ["Impact, Haettenschweiler, 'Anton', sans-serif",                       "Impact"],
  // Serif
  ["Georgia, 'Times New Roman', 'Noto Serif', serif",                     "Georgia"],
  ["'Times New Roman', Times, 'Liberation Serif', serif",                 "Times"],
  ["Cambria, 'Hoefler Text', 'Noto Serif', serif",                        "Cambria"],
  ["Garamond, 'EB Garamond', 'Apple Garamond', serif",                    "Garamond"],
  ["'Book Antiqua', 'Palatino Linotype', Palatino, serif",                "Book Antiqua"],
  ["'Palatino Linotype', Palatino, 'Book Antiqua', serif",                "Palatino"],
  ["Baskerville, 'Baskerville Old Face', 'Libre Baskerville', serif",     "Baskerville"],
  ["Didot, 'Bodoni MT', 'Bodoni 72', serif",                              "Didot / Bodoni"],
  ["Constantia, 'Hoefler Text', Cambria, serif",                          "Constantia"],
  ["Rockwell, 'Roboto Slab', 'Courier New', serif",                       "Rockwell (slab)"],
  ["'Century Schoolbook', 'New Century Schoolbook', 'Noto Serif', serif", "Century Schoolbook"],
  ["'Trajan Pro', Trajan, Cinzel, 'Times New Roman', serif",              "Trajan"],
  // Monoespaciadas
  ["'Courier New', Courier, 'Liberation Mono', monospace",                "Courier"],
  ["ui-monospace, Consolas, Menlo, monospace",                            "Monoespaciada"],
  ["Consolas, 'SF Mono', Menlo, monospace",                               "Consolas"],
  ["'Lucida Console', Monaco, 'DejaVu Sans Mono', monospace",             "Lucida Console"],
  ["'Cascadia Code', 'Cascadia Mono', 'Fira Code', monospace",            "Cascadia"],
  // Manuscritas y decorativas
  ["'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', cursive",             "Comic Sans"],
  ["'Brush Script MT', 'Brush Script Std', 'Snell Roundhand', cursive",   "Brush Script"],
  ["'Lucida Handwriting', 'Apple Chancery', 'Bradley Hand', cursive",     "Lucida Handwriting"],
  ["'Segoe Script', 'Bradley Hand', 'Marker Felt', cursive",              "Segoe Script"],
  ["'Segoe Print', 'Chalkboard SE', 'Noteworthy', cursive",               "Segoe Print"],
  ["'Freestyle Script', 'Snell Roundhand', 'Zapfino', cursive",           "Freestyle Script"],
  ["'American Typewriter', 'Courier New', serif",                         "American Typewriter"],
  ["Copperplate, 'Copperplate Gothic Light', 'Copperplate Gothic', fantasy", "Copperplate"],
  ["Papyrus, fantasy",                                                    "Papyrus"],
  ["'Algerian', 'Old English Text MT', fantasy",                          "Algerian"],
  ["'Old English Text MT', 'Blackletter', 'UnifrakturMaguntia', fantasy", "Old English"],
  ["'Showcard Gothic', 'Cooper Black', Impact, fantasy",                  "Showcard"],
  ["'Cooper Black', 'Cooper Std', 'Arial Black', serif",                  "Cooper Black"],
  ["'Stencil', 'Stencil Std', Impact, fantasy",                           "Stencil"],
  ["'Bauhaus 93', 'Century Gothic', fantasy",                             "Bauhaus"],
  ["'Broadway', Impact, fantasy",                                         "Broadway"],
  ["'Jokerman', 'Chalkduster', fantasy",                                  "Jokerman"],
  ["'Kristen ITC', 'Chalkboard SE', cursive",                             "Kristen"],
  ["'Ink Free', 'Bradley Hand', 'Marker Felt', cursive",                  "Ink Free"],
  // Separador (no seleccionable) y tipografías libres alojadas en /fonts/
  [FONT_SEPARATOR, "── Tipografías libres ──"],
  ...googleFontItems()
];

/* ── fuentes cargadas por el usuario ─────────────────────────────
   Archivos locales registrados con FontFace. Se guardan en base64 en
   localStorage (con un tope: una fuente de 200 KB cabe de sobra; una
   familia CJK de 15 MB no, y se queda sólo para la sesión) para que
   un documento guardado con esa fuente la recupere al abrirlo. */
const LS_FONTS = "realify.fonts";
const LS_LIMIT = 3.5 * 1024 * 1024;
export const USER_FONTS = [];   // [{ family, label, data?: dataURL }]

function familyName(fileName){
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Fuente";
}

async function registerFont(family, src){
  const face = new FontFace(family, src);
  await face.load();
  document.fonts.add(face);
}

export async function loadFontFile(file){
  const base = familyName(file.name);
  let family = base, n = 2;
  while(FONTS.some(f => f[1] === family) || USER_FONTS.some(f => f.label === family)) family = `${base} ${n++}`;
  const buf = await file.arrayBuffer();
  await registerFont(family, buf);
  const entry = { family, label: family };
  const dataURL = await new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => res(null);
    r.readAsDataURL(file);
  });
  if(dataURL){
    const stored = USER_FONTS.reduce((s, f) => s + (f.data?.length || 0), 0);
    if(stored + dataURL.length <= LS_LIMIT) entry.data = dataURL;
  }
  USER_FONTS.push(entry);
  FONTS.push([`'${family}'`, family]);
  try{
    localStorage.setItem(LS_FONTS, JSON.stringify(USER_FONTS.filter(f => f.data)));
  }catch{}
  return `'${family}'`;
}

export async function restoreUserFonts(){
  let saved = [];
  try{ saved = JSON.parse(localStorage.getItem(LS_FONTS) || "[]"); }catch{}
  for(const f of saved){
    if(!f?.family || !f.data) continue;
    try{
      await registerFont(f.family, `url(${f.data})`);
      USER_FONTS.push(f);
      FONTS.push([`'${f.family}'`, f.label || f.family]);
    }catch(err){ console.warn("[fonts] no se pudo restaurar", f.family, err); }
  }
  return USER_FONTS.length;
}

if(typeof FontFace !== "undefined"){
  restoreUserFonts().then(n => { if(n) emit("tool:options"); });
}

export const defaultText = () => ({
  content: "Escribe aquí",
  x: Math.round(doc.w / 2),
  y: Math.round(doc.h / 2),
  font: FONTS[0][0],
  size: Math.max(16, Math.round(doc.h / 14)),
  weight: 400,
  italic: false,
  color: "#ffffff",
  align: "center",
  baseline: "middle",
  lineHeight: 1.25,
  tracking: 0,
  strokeWidth: 0,
  strokeColor: "#000000",
  shadow: false,
  shadowBlur: 8,
  shadowX: 2,
  shadowY: 3,
  shadowColor: "#000000",
  shadowAlpha: 55,
  /* Mayúsculas y caja de fondo: las dos únicas mejoras que le faltaban
     a la herramienta de texto normal frente al modo meme, que ya las
     tenía a su manera pero sólo ahí dentro. */
  allCaps: false,
  bg: false,
  bgColor: "#000000",
  bgOpacity: 70,
  bgPadding: 14,
  bgRadius: 8,
  /* Texto en círculo. `circleDistance` es separación EXTRA entre
     letras sobre el arco, en píxeles, igual que `tracking` en el texto
     recto; cero deja el ritmo natural de la fuente. */
  circle: false,
  circleRadius: 160,
  circleDistance: 0,
  circleSkew: 0,
  circleFlip: false,
  /* Giro en grados alrededor del ancla, y marco de párrafo. `boxW` a
     null significa texto de punto: crece a lo que ocupe y sólo salta
     de línea donde se pulse Intro. Con un ancho, pasa a ser texto de
     párrafo y las líneas se reajustan dentro del marco. */
  angle: 0,
  boxW: null,
  boxH: null,
  /* Sangrías de párrafo, sólo tienen efecto con marco (`boxW`
     puesto): `indentFirst` se SUMA a `indentLeft` sólo en la primera
     línea de cada párrafo (cada salto de línea a mano cuenta como
     uno nuevo), `indentLeft`/`indentRight` recortan el ancho
     disponible de TODAS las líneas por igual. `align:"justify"` —una
     opción más de las de siempre— estira el hueco entre palabras
     para que cada línea llegue justo al borde derecho del marco,
     salvo la última de cada párrafo, que se deja suelta como en
     cualquier maquetador. */
  indentFirst: 0,
  indentLeft: 0,
  indentRight: 0,
  /* Kerning manual: separación EXTRA, en píxeles, insertada entre el
     carácter `i` y el `i+1` de `content` —el índice es sobre lo
     ESCRITO, antes de mayúsculas o de repartir en líneas, así que
     sobrevive a reajustar el párrafo—. Vacío por defecto: nadie tiene
     que pensar en esto si no lo toca. Se edita con el cursor (sin
     selección) puesto entre dos letras concretas, igual que en
     cualquier editor con panel de carácter. */
  kerning: {},
  /* OpenType. `ligatures` en `true` dibuja la frase entera de una vez
     y deja que el propio navegador combine "fi", "fl"… en su glifo
     compuesto si la fuente lo trae —el comportamiento normal de
     `fillText`—; en `false` fuerza el dibujo letra a letra (como ya
     hace el espaciado) para GARANTIZAR que no se combine ninguna,
     incluso con una fuente que las traiga. `smallCaps` usa
     `fontVariantCaps` del propio lienzo: minúsculas dibujadas como
     mayúsculas más pequeñas de la propia fuente, no una mayúscula
     normal encogida a mano. */
  ligatures: true,
  smallCaps: false,
  /* Deformación (Photoshop la llama «Warp Text»): dobla el bloque de
     texto YA compuesto —con sus líneas, su sangría, su justificado—
     sobre una curva con nombre en vez de una dibujada a mano. `amount`
     va de -100 a 100; el signo decide hacia qué lado se dobla. `null`
     es «sin deformar», el caso normal. */
  warp: null,   // { kind:"arc"|"flag"|"fish", amount:number }
  /* Texto en trazado de verdad: una curva cuadrática de Bézier —tres
     puntos, inicio/control/fin, en coordenadas de documento— sobre la
     que se reparten las letras una tras otra, como ya hacía el texto
     en círculo pero sobre un trazado cualquiera en vez de una
     circunferencia fija. `null` es texto normal. Activo, IGNORA el
     marco de párrafo: un trazado no tiene líneas que reajustar. */
  path: null   // { p0:[x,y], p1:[x,y], p2:[x,y] }
});

/* Lo que se dibuja y se mide nunca es `t.content` directamente si hay
   mayúsculas activadas: el contenido guardado se queda tal cual se
   escribió —con sus minúsculas, si las tiene—, y sólo la
   REPRESENTACIÓN en pantalla se pasa a mayúsculas. Guardarlo ya en
   mayúsculas perdería la capitalización original en cuanto se
   desactivara la opción, y volver a escribir todo de cero no es lo
   que espera nadie que sólo quería probar cómo se ve. */
function displayText(t){ return t.allCaps ? String(t.content).toUpperCase() : String(t.content); }

export function fontString(t){
  return `${t.italic ? "italic " : ""}${t.weight} ${t.size}px ${t.font}`;
}

/* ── disposición ───────────────────────────────────────────────
   Un único cálculo del que salen TANTO el dibujo como la medida. Antes
   eran dos cuentas parecidas pero distintas —una para pintar y otra
   para la caja de selección—, y de ahí venía que los tiradores
   marcaran un rectángulo bastante más grande que las letras: la caja
   contaba el interlineado entero de la primera y la última línea,
   espacio que no ocupa ningún trazo.

   La vertical se reparte como lo hace el CSS: la altura de línea que
   sobra por encima de las letras se divide en dos mitades (el
   «half-leading»), una arriba y otra abajo. Calcularlo igual que el
   navegador es lo que permite que el <textarea> de edición caiga justo
   encima del texto ya dibujado en vez de un par de píxeles más abajo. */
function vMetrics(ctx, t){
  const m = ctx.measureText("Hxg");
  // `fontBoundingBox*` describe la fuente, no la frase: así la caja no
  // baila al escribir una «g» o borrar una mayúscula.
  const asc  = m.fontBoundingBoxAscent  || t.size * 0.80;
  const desc = m.fontBoundingBoxDescent || t.size * 0.20;
  return { asc, desc };
}

/* Ancho de un trozo de línea contando el espaciado entre letras. El
   kerning manual y el hueco de justificado se dejan fuera A PROPÓSITO
   —son ajustes finos de POSICIÓN, no de cuánto ancho reserva la
   línea—: decidir dónde parte una palabra con ellos puestos crearía un
   ciclo (el hueco depende del ancho de la línea, y el ancho de la
   línea del hueco). */
function widthOf(ctx, s, t){
  const n = [...s].length;
  return ctx.measureText(s).width + (t.tracking || 0) * Math.max(0, n - 1);
}

/* Parte un párrafo en las líneas que caben en `maxFirst` (la primera,
   que puede llevar sangría de primera línea aparte de la izquierda) y
   `maxRest` (el resto), por palabras. Una palabra más larga que la
   caja se trocea por letras antes que desbordar: es preferible una
   palabra partida a un renglón saliéndose del marco que el propio
   usuario ha dibujado. Devuelve `{text, len}`: `len` es cuánto del
   PROPIO PÁRRAFO original consume cada línea —contando también los
   espacios que el ajuste se traga al saltar de línea—, para que el
   kerning manual (indexado sobre `content` tal cual se escribió) siga
   apuntando a la letra correcta aunque el párrafo se reajuste. */
function wrapLine(ctx, line, t, maxFirst, maxRest){
  if(!line) return [{ text:"", len:0 }];
  const maxOf = () => out.length === 0 ? maxFirst : maxRest;
  if(widthOf(ctx, line, t) <= maxFirst) return [{ text: line, len: line.length }];

  const out = [];
  let cur = "", curLen = 0;
  const pushCur = text => { out.push({ text, len: curLen }); cur = ""; curLen = 0; };

  for(const word of line.split(/(\s+)/)){
    if(!word) continue;
    const max = maxOf();
    const tryLine = cur + word;
    if(cur && widthOf(ctx, tryLine, t) > max){
      if(/^\s+$/.test(word)){
        curLen += word.length;
        pushCur(cur.replace(/\s+$/, ""));
      } else {
        pushCur(cur.replace(/\s+$/, ""));
        cur = word; curLen = word.length;
      }
    } else {
      cur = tryLine; curLen += word.length;
    }
    // Palabra suelta que ni siquiera cabe entera: se parte por letras.
    while(widthOf(ctx, cur, t) > maxOf() && [...cur].length > 1){
      let cut = "", cutLen = 0;
      const m2 = maxOf();
      for(const ch of [...cur]){
        if(widthOf(ctx, cut + ch, t) > m2) break;
        cut += ch; cutLen++;
      }
      if(!cut) break;
      out.push({ text: cut, len: cutLen });
      cur = cur.slice(cut.length); curLen -= cutLen;
    }
  }
  if(cur) pushCur(cur);
  return out.length ? out : [{ text:"", len: line.length }];
}

/* Cuánto añade el kerning manual dentro de un tramo de `content`
   —de `charStart` a `charStart+len`, sin incluir los dos extremos—:
   hace falta sumarlo al ancho medido de la línea, o la caja de
   selección, el fondo y la alineación centrada o a la derecha se
   quedarían calculados como si el kerning no existiera, aunque el
   dibujo sí lo aplicara. */
function kerningSumFor(t, charStart, len){
  const kerning = t.kerning;
  if(!kerning) return 0;
  let sum = 0;
  const end = charStart + len;
  for(const k in kerning){
    const i = +k;
    if(i > charStart && i <= end) sum += kerning[k] || 0;
  }
  return sum;
}

export function layoutText(ctx, t){
  ctx.font = fontString(t);
  const lh = t.size * (t.lineHeight || 1);
  const { asc, desc } = vMetrics(ctx, t);

  /* Dos modos. En el de punto (`boxW` sin definir) el texto crece a lo
     que ocupe y el bloque se centra en el ancla, que es como nació la
     herramienta. En el de párrafo hay un marco de ancho fijo: las
     líneas se reajustan solas dentro de él y el texto se apoya en su
     borde superior, como en cualquier maquetador. El ancla (`x`,`y`)
     es el centro del marco en los dos casos, así que mover, centrar o
     rotar la capa funciona igual sin distinguir modos. */
  const boxed = Number.isFinite(t.boxW) && t.boxW > 0;
  const raw = displayText(t).split("\n");
  const indentL = boxed ? Math.max(0, t.indentLeft || 0) : 0;
  const indentR = boxed ? Math.max(0, t.indentRight || 0) : 0;
  const indentF = boxed ? (t.indentFirst || 0) : 0;

  // Líneas + de dónde viene cada una dentro de `content` (para el
  // kerning manual) + si es la ÚLTIMA línea de SU párrafo (para no
  // justificar el renglón final, como en cualquier maquetador).
  const lines = [], lineStarts = [], lineLast = [];
  {
    let idx = 0;
    raw.forEach((para, pi) => {
      if(pi > 0) idx += 1;   // el "\n" que separaba de la línea anterior
      if(boxed){
        const wrapped = wrapLine(ctx, para, t, t.boxW - indentL - indentR - indentF, t.boxW - indentL - indentR);
        wrapped.forEach((seg, si) => {
          lines.push(seg.text); lineStarts.push(idx); lineLast.push(si === wrapped.length - 1);
          idx += seg.len;
        });
      } else {
        lines.push(para); lineStarts.push(idx); lineLast.push(true);
        idx += para.length;
      }
    });
  }

  const total = lh * lines.length;
  const top = boxed
    ? t.y - (Number.isFinite(t.boxH) ? t.boxH : total) / 2
    : t.y - total / 2;
  const half = (lh - (asc + desc)) / 2;

  // Borde izquierdo contra el que alinear: el del marco en párrafo, el
  // propio ancla en texto de punto.
  const left = boxed ? t.x - t.boxW / 2 : t.x;

  const rows = lines.map((line, i) => {
    const m = ctx.measureText(line);
    // `w` incluye YA el kerning manual de este tramo: es el ancho de
    // verdad que va a ocupar el dibujo, no sólo lo que da la fuente
    // más el espaciado uniforme.
    const w = widthOf(ctx, line, t) + kerningSumFor(t, lineStarts[i], line.length);
    // Primera línea de SU párrafo: la primerísima fila, o cualquiera
    // que venga justo después de la última fila del párrafo anterior.
    const isFirstOfParagraph = i === 0 || lineLast[i - 1];
    const indent = boxed && isFirstOfParagraph ? indentF : 0;
    const lineLeft = left + indentL + indent;
    const avail = boxed ? t.boxW - indentL - indentR - indent : 0;
    // Justificar: sólo con marco, sólo si no es la última línea de su
    // párrafo, y sólo si de verdad hay algún espacio donde repartir el
    // sobrante —una sola palabra más larga que el marco no se estira—.
    const spaceCount = boxed && t.align === "justify" && !lineLast[i]
      ? (line.match(/ /g) || []).length : 0;
    const justifyGap = spaceCount > 0 ? Math.max(0, (avail - w) / spaceCount) : 0;
    // La x de cada línea se resuelve aquí, y el dibujo pinta siempre
    // con `textAlign:"left"`. Dejar la alineación en manos del canvas
    // obligaba a corregirla a mano en cuanto había espaciado entre
    // letras, y las dos vías no daban lo mismo.
    const x = boxed
      ? (t.align === "center" ? lineLeft + (avail - w) / 2
        : t.align === "right" ? lineLeft + avail - w
        : lineLeft)
      : (t.align === "center" ? t.x - w / 2
        : t.align === "right" ? t.x - w
        : t.x);
    return { line, w: w + justifyGap * spaceCount, x,
             charStart: lineStarts[i], justifyGap,
             baseline: top + half + asc + i * lh,
             // Lo que la frase ocupa DE VERDAD por encima y por debajo
             // de su línea base, no lo que la fuente reserva.
             up:   m.actualBoundingBoxAscent  || 0,
             down: m.actualBoundingBoxDescent || 0 };
  });

  const width = boxed ? t.boxW : rows.reduce((mx, r) => Math.max(mx, r.w), 0);
  const boxX = boxed ? left
             : t.align === "center" ? t.x - width / 2
             : t.align === "right"  ? t.x - width
             : t.x;

  /* Dos cajas, porque se usan para cosas distintas:
     · `box` se ciñe a la tinta de lo escrito y es la que marcan los
       tiradores. Es la que el ojo reconoce como «el tamaño del texto»:
       si sólo hay minúsculas sin rabos, el rectángulo es bajo.
     · `blockBox` es la caja tipográfica, con el hueco que la fuente
       reserva para acentos y descendentes. La usa el fondo de color,
       que si se ciñera a la tinta cambiaría de alto al escribir una
       «g» —y un rótulo que da saltos mientras se teclea es peor que
       uno con un par de píxeles de margen de más—. */
  let inkTop = Infinity, inkBot = -Infinity;
  for(const r of rows){
    if(!r.line) continue;
    // Si el navegador no diera la extensión real de la tinta, se cae a
    // la caja de la fuente antes que devolver un rectángulo plano.
    const up   = r.up   || asc;
    const down = r.down || desc;
    inkTop = Math.min(inkTop, r.baseline - up);
    inkBot = Math.max(inkBot, r.baseline + down);
  }
  if(!isFinite(inkTop)){
    // Sólo líneas vacías: se deja una caja simbólica sobre la primera
    // línea base para que siga habiendo algo que agarrar.
    inkTop = rows[0].baseline - asc * 0.5;
    inkBot = rows[0].baseline + desc * 0.5;
  }

  const blockTop = rows[0].baseline - asc;
  const blockBot = rows[rows.length - 1].baseline + desc;

  /* En párrafo, el marco que se ve y se agarra es el que dibujó el
     usuario, no lo que ocupen las letras dentro: si no, soltar media
     frase encogería el marco y ya no se podría volver a ensancharlo. */
  const frame = boxed
    ? { x: left, y: top, w: t.boxW, h: Number.isFinite(t.boxH) ? t.boxH : total }
    : null;

  // Si lo escrito no cabe en el alto del marco, el marco lo avisa. No
  // se recorta el texto que sobra, a diferencia de otros editores:
  // esconder lo que alguien acaba de escribir asusta más de lo que
  // ayuda, y la señal en el marco ya dice que hay que agrandarlo.
  const overflow = boxed && Number.isFinite(t.boxH) && total > t.boxH + 0.5;

  return { rows, lh, asc, desc, half, total, boxed, frame, overflow,
           box:      { x: boxX, y: inkTop,   w: width, h: inkBot - inkTop },
           blockBox: { x: boxX, y: blockTop, w: width, h: blockBot - blockTop } };
}

/* Si la capa usa una tipografía de /fonts/ que aún no ha llegado, se
   pide (ver gfonts.js) y la capa se vuelve a dibujar en cuanto está
   lista. Mientras tanto se ve con la alternativa. Sin comprobar antes
   si es «de las nuestras»: un proyecto puede traer una elegida en el
   buscador en otro equipo; si no está en el catálogo, no se hace nada. */
function requestFont(layer){
  const t = layer.text;
  if(!t.font) return;
  const font = t.font, weight = t.weight, italic = t.italic;
  ensureFont(font, { weight, italic }).then(changed => {
    if(!changed || !layer.text || layer.text.font !== font) return;
    renderTextLayer(layer);
    emit("doc:change");
  });
}

/* Dibuja la capa de texto en su propio lienzo, de cero. */
export function renderTextLayer(layer){
  if(!layer || !layer.text) return;
  const t = layer.text;
  requestFont(layer);
  const c = layer.canvas, x = layer.ctx;

  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);

  x.font = fontString(t);
  x.textBaseline = "alphabetic";
  x.lineJoin = "round";
  x.miterLimit = 2;
  // Versalitas de verdad —glifos propios de la fuente, más pequeños
  // que una mayúscula normal—, no una mayúscula encogida a mano; el
  // propio contexto 2D lo sabe hacer desde hace tiempo en Chrome.
  if("fontVariantCaps" in x) x.fontVariantCaps = t.smallCaps ? "small-caps" : "normal";

  /* El giro se aplica al lienzo alrededor del ancla, no al cálculo de
     la disposición: así todo lo demás —medir, alinear, reajustar las
     líneas de un párrafo— sigue trabajando en horizontal, y la
     rotación es sólo la última capa de pintura. */
  const spin = (t.angle || 0) * Math.PI / 180;
  if(spin){
    x.save();
    x.translate(t.x, t.y);
    x.rotate(spin);
    x.translate(-t.x, -t.y);
  }

  if(t.path && t.path.p0 && t.path.p2){
    drawTextOnPath(x, displayText(t), t);
  } else if(t.circle){
    drawTextInCircle(x, displayText(t), t);
  } else {
    // Siempre a la izquierda: la alineación ya viene resuelta en la x
    // de cada línea (ver `layoutText`).
    x.textAlign = "left";
    const L = layoutText(x, t);

    if(t.bg){
      const b = L.blockBox, p = t.bgPadding;
      x.save();
      x.fillStyle = hexToRgba(t.bgColor, t.bgOpacity / 100);
      roundRectPath(x, b.x - p, b.y - p, b.w + p*2, b.h + p*2, Math.min(t.bgRadius, (b.h + p*2)/2));
      x.fill();
      x.restore();
    }

    applyShadow(x, t);

    // La deformación (Arco/Bandera/Pez) dobla el bloque YA compuesto:
    // se calcula una vez sobre la caja tipográfica entera y se aplica
    // igual a cada línea, cada una a su propia altura de base.
    const warpFn = (t.warp && t.warp.kind && t.warp.amount) ? makeWarp(t.warp, L) : null;

    for(const r of L.rows){
      if(t.strokeWidth > 0){
        x.strokeStyle = t.strokeColor;
        x.lineWidth = t.strokeWidth * 2;
        drawRow(x, r, t, true, warpFn);
      }
      // La sombra se pinta una sola vez: si se deja puesta también
      // para el relleno que va encima del contorno, sale doblada.
      if(t.shadow && t.strokeWidth > 0) clearShadow(x);
      x.fillStyle = t.color;
      drawRow(x, r, t, false, warpFn);
    }

    clearShadow(x);
  }
  if(spin) x.restore();
  layer.thumbDirty = true;
}

/* ── deformación (Arco / Bandera / Pez) ───────────────────────────
   `nx` es la posición horizontal DENTRO DEL BLOQUE entero (0 al borde
   izquierdo, 1 al derecho) de cada letra, no de cada línea suelta:
   así un párrafo de varias líneas se dobla como un solo bloque, cada
   línea a su altura, en vez de que cada renglón dibuje su propio
   arco independiente. La pendiente sale por diferencia numérica —dos
   evaluaciones de la misma curva— en vez de derivar cada fórmula a
   mano, que es mucho más fácil de equivocar que de comprobar. */
function shapeY(kind, nx, bendPx){
  if(kind === "flag") return bendPx * Math.sin(nx * Math.PI * 2);
  if(kind === "fish") return bendPx * Math.sin(nx * Math.PI) * (1 - 0.6 * nx);
  return bendPx * (1 - 4 * (nx - 0.5) * (nx - 0.5));   // "arc": parábola, máxima en el centro
}
function makeWarp(warp, L){
  const kind = warp.kind;
  const amt = Math.max(-100, Math.min(100, warp.amount || 0)) / 100;
  const box = L.blockBox;
  const bendPx = amt * box.h * 0.6;
  const eps = 0.002;
  return (px, py) => {
    const nx = box.w > 0 ? Math.max(0, Math.min(1, (px - box.x) / box.w)) : 0.5;
    const y  = shapeY(kind, nx, bendPx);
    const y2 = shapeY(kind, Math.min(1, nx + eps), bendPx);
    const slope = (y2 - y) / (eps * (box.w || 1));
    return { x: px, y: py + y, angle: Math.atan(slope) };
  };
}

function applyShadow(ctx, t){
  if(!t.shadow) return;
  ctx.shadowColor   = hexToRgba(t.shadowColor, (t.shadowAlpha ?? 55) / 100);
  ctx.shadowBlur    = t.shadowBlur ?? 0;
  ctx.shadowOffsetX = t.shadowX ?? 0;
  ctx.shadowOffsetY = t.shadowY ?? 0;
}

function clearShadow(ctx){
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}

/* ── texto en círculo ──────────────────────────────────────────
   Cada letra se coloca sobre el arco y se gira para quedar DE PIE
   sobre él, que es lo que hace un texto en trazado de verdad: la
   tangente en ese punto, o sea el ángulo del radio más un cuarto de
   vuelta. Sin ese cuarto de vuelta las letras salían tumbadas
   apuntando al centro, y entonces el mando de inclinación parecía
   estropeado cuando lo que estaba mal era el ángulo de partida.

   El avance de una letra a la siguiente es el que pide su propio
   ancho —el arco que ocupa es `ancho/radio` radianes—, no un reparto
   fijo de la circunferencia entre el número de letras: así una «i» y
   una «M» no ocupan lo mismo y el texto no se estira ni se apelmaza
   según cuántas letras tenga. «Distancia» es la separación extra
   entre letras, medida igual que el espaciado del texto normal. */
function drawTextInCircle(ctx, text, t){
  const chars = [...String(text).replace(/\n/g, "")];
  if(!chars.length) return;

  const radius = Math.max(1, t.circleRadius || 100);
  const gap = t.circleDistance ?? 0;
  const lean = ((t.circleSkew || 0) * Math.PI) / 180;
  const flip = t.circleFlip ? -1 : 1;

  const widths = chars.map(ch => ctx.measureText(ch).width);
  const arc = widths.reduce((s, w) => s + w, 0) + gap * (chars.length - 1);
  // Centrado en lo alto del círculo: el bloque se reparte a un lado y
  // otro de las doce en punto.
  let angle = -Math.PI / 2 - (flip * arc / radius) / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  applyShadow(ctx, t);

  for(let i = 0; i < chars.length; i++){
    const step = (widths[i] + gap) / radius;
    const mid = angle + flip * step / 2;
    const px = t.x + Math.cos(mid) * radius;
    const py = t.y + Math.sin(mid) * radius;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(mid + (flip > 0 ? Math.PI / 2 : -Math.PI / 2) + lean);

    if(t.strokeWidth > 0){
      ctx.strokeStyle = t.strokeColor;
      ctx.lineWidth = t.strokeWidth * 2;
      ctx.strokeText(chars[i], 0, 0);
    }
    if(t.shadow && t.strokeWidth > 0) clearShadow(ctx);
    ctx.fillStyle = t.color;
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();

    angle += flip * step;
  }

  clearShadow(ctx);
}

/* La x de cada letra dentro de la línea, relativa al principio de la
   línea (x=0): tracking siempre que lo haya, kerning manual en los
   huecos concretos que lo tengan puesto —el índice es el de CURSOR
   entre dos letras, el mismo que da `textarea.selectionStart`, para
   que ajustar el kerning desde el cuadro de edición sea tan directo
   como leer esa propiedad— y el hueco extra de justificar detrás de
   cada espacio. La reutilizan tanto el dibujo normal letra a letra
   como la deformación, que necesita saber dónde cae cada letra. */
function rowCharPositions(ctx, row, t){
  const chars = [...row.line];
  const kerning = t.kerning;
  const hasKerning = kerning && Object.keys(kerning).length > 0;
  let x = 0;
  const out = [];
  for(let i = 0; i < chars.length; i++){
    out.push({ ch: chars[i], x });
    x += ctx.measureText(chars[i]).width;
    if(i < chars.length - 1){
      x += t.tracking || 0;
      if(hasKerning){
        const k = kerning[row.charStart + i + 1];
        if(k) x += k;
      }
      if(row.justifyGap && chars[i] === " ") x += row.justifyGap;
    }
  }
  return out;
}

/* ¿Hace falta ir letra a letra? Espaciado, kerning manual EN ESTA
   línea, justificado, o ligaduras apagadas a propósito —lo único que
   de verdad garantiza que la fuente no combine "fi"/"fl" en un solo
   glifo es no dejarle ver dos letras seguidas de una vez—. Fuera de
   estos casos, una sola llamada a fillText/strokeText es más rápida
   Y mejor tipografiada: conserva los kerning pairs propios de la
   fuente, que letra a letra se pierden. */
function rowNeedsPerChar(row, t){
  if(t.tracking || row.justifyGap || t.ligatures === false) return true;
  const kerning = t.kerning;
  if(!kerning) return false;
  const end = row.charStart + row.line.length;
  return Object.keys(kerning).some(k => { const i = +k; return i > row.charStart && i <= end; });
}

function drawRow(ctx, row, t, stroke, warpFn){
  const { line, x, baseline } = row;
  if(!rowNeedsPerChar(row, t) && !warpFn){
    stroke ? ctx.strokeText(line, x, baseline) : ctx.fillText(line, x, baseline);
    return;
  }
  for(const p of rowCharPositions(ctx, row, t)){
    const px = x + p.x, py = baseline;
    if(warpFn){
      const d = warpFn(px, py);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      stroke ? ctx.strokeText(p.ch, 0, 0) : ctx.fillText(p.ch, 0, 0);
      ctx.restore();
    } else {
      stroke ? ctx.strokeText(p.ch, px, py) : ctx.fillText(p.ch, px, py);
    }
  }
}

/* ── texto en trazado ─────────────────────────────────────────────
   Una curva cuadrática de Bézier —tres puntos: inicio, control, fin—
   en vez de la circunferencia fija del texto en círculo, pero con la
   misma idea: cada letra se coloca por la LONGITUD de arco que ocupa
   (no por un reparto fijo de parámetro `t`, que en una curva de
   verdad avanza más deprisa donde la curva es más «recta» y más
   despacio donde se cierra) y se gira según la tangente de la curva
   en ese punto. La tabla de longitud acumulada se calcula una vez por
   dibujo, con muestras de sobra para cualquier tamaño de letra
   razonable. */
function quadPoint(p0, p1, p2, tt){
  const mt = 1 - tt;
  return [mt*mt*p0[0] + 2*mt*tt*p1[0] + tt*tt*p2[0],
          mt*mt*p0[1] + 2*mt*tt*p1[1] + tt*tt*p2[1]];
}
function quadTangentAngle(p0, p1, p2, tt){
  const mt = 1 - tt;
  const dx = 2*mt*(p1[0]-p0[0]) + 2*tt*(p2[0]-p1[0]);
  const dy = 2*mt*(p1[1]-p0[1]) + 2*tt*(p2[1]-p1[1]);
  return Math.atan2(dy, dx);
}
function buildArcLengthTable(p0, p1, p2, samples = 200){
  const table = [{ t:0, s:0, pt:p0 }];
  let prev = p0, s = 0;
  for(let i = 1; i <= samples; i++){
    const tt = i / samples;
    const pt = quadPoint(p0, p1, p2, tt);
    s += Math.hypot(pt[0]-prev[0], pt[1]-prev[1]);
    table.push({ t:tt, s, pt });
    prev = pt;
  }
  return table;
}
function pointAtLength(table, targetS){
  const last = table[table.length - 1];
  if(targetS <= 0) return { t: table[0].t, pt: table[0].pt };
  if(targetS >= last.s) return { t: last.t, pt: last.pt };
  for(let i = 1; i < table.length; i++){
    if(table[i].s >= targetS){
      const a = table[i-1], b = table[i];
      const f = (targetS - a.s) / Math.max(1e-6, b.s - a.s);
      return { t: a.t + (b.t - a.t) * f,
               pt: [a.pt[0] + (b.pt[0]-a.pt[0])*f, a.pt[1] + (b.pt[1]-a.pt[1])*f] };
    }
  }
  return { t: last.t, pt: last.pt };
}

export function pathArcLength(path){
  if(!path || !path.p0 || !path.p2) return 0;
  const table = buildArcLengthTable(path.p0, path.p1 || midpoint(path.p0, path.p2), path.p2, 60);
  return table[table.length - 1].s;
}
function midpoint(a, b){ return [(a[0]+b[0])/2, (a[1]+b[1])/2]; }

function drawTextOnPath(ctx, text, t){
  const chars = [...String(text).replace(/\n/g, "")];
  const path = t.path;
  if(!chars.length || !path || !path.p0 || !path.p2) return;
  const p0 = path.p0, p1 = path.p1 || midpoint(p0, path.p2), p2 = path.p2;
  const table = buildArcLengthTable(p0, p1, p2);
  const totalLen = table[table.length - 1].s;
  const gap = t.tracking || 0;

  const widths = chars.map(ch => ctx.measureText(ch).width);
  const used = widths.reduce((s, w) => s + w, 0) + gap * (chars.length - 1);
  // Si el texto es más corto que el trazado, se centra en él; si es
  // más largo, se sale por el final en vez de apelmazarse.
  let s = Math.max(0, (totalLen - used) / 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  applyShadow(ctx, t);

  for(let i = 0; i < chars.length; i++){
    const mid = s + widths[i] / 2;
    const { t: tt, pt } = pointAtLength(table, mid);
    const angle = quadTangentAngle(p0, p1, p2, tt);
    ctx.save();
    ctx.translate(pt[0], pt[1]);
    ctx.rotate(angle);
    if(t.strokeWidth > 0){
      ctx.strokeStyle = t.strokeColor;
      ctx.lineWidth = t.strokeWidth * 2;
      ctx.strokeText(chars[i], 0, 0);
    }
    if(t.shadow && t.strokeWidth > 0) clearShadow(ctx);
    ctx.fillStyle = t.color;
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    s += widths[i] + gap;
  }
  clearShadow(ctx);
}

function hexToRgba(hex, a){
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* Contorno redondeado como trazado, sin rellenarlo ni trazarlo: lo
   decide quien llama. */
function roundRectPath(ctx, x, y, w, h, r){
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Un lienzo de un píxel que no se dibuja nunca: sólo existe para
   medir. Se reutiliza entre llamadas porque `textBounds` se consulta
   en cada movimiento del puntero y crear un canvas por consulta es
   basura para el recolector a sesenta por segundo. */
let measureCtx = null;
function measurer(){
  if(!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

/* Extensión del texto SIN girar, para seleccionarlo, moverlo y pintar
   sus tiradores. Sale del MISMO cálculo que el dibujo, así que la caja
   no puede volver a quedarse grande respecto a lo que se ve.

   En un párrafo la caja es el marco dibujado por el usuario, porque es
   lo que se agarra; en texto de punto, lo que ocupan las letras. */
export function textBounds(layer){
  const t = layer.text;
  const ctx = measurer();
  ctx.font = fontString(t);

  if(t.circle){
    // En círculo la caja es el propio círculo más lo que sobresalen
    // las letras hacia fuera.
    const r = Math.max(1, t.circleRadius || 100) + t.size;
    return { x: t.x - r, y: t.y - r, w: r * 2, h: r * 2 };
  }
  if(t.path && t.path.p0 && t.path.p2){
    // Una cuadrática de Bézier cae siempre DENTRO del triángulo que
    // forman sus tres puntos —una propiedad de la curva, no una
    // aproximación—, así que el mínimo/máximo de los tres ya es una
    // caja de verdad; el margen es sólo para lo que las letras
    // sobresalen de esa línea (su alto, giradas según la tangente).
    const p0 = t.path.p0, p2 = t.path.p2;
    const p1 = t.path.p1 || [(p0[0]+p2[0])/2, (p0[1]+p2[1])/2];
    const xs = [p0[0], p1[0], p2[0]], ys = [p0[1], p1[1], p2[1]];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const m = t.size;
    return { x: minX - m, y: minY - m, w: (maxX - minX) + m * 2, h: (maxY - minY) + m * 2 };
  }
  const L = layoutText(ctx, t);
  let box = L.frame || L.box;
  /* El contorno y la caja de fondo forman parte de lo que se ve del
     texto: los tiradores tienen que envolverlos, no quedarse por
     dentro. (La sombra no: es un efecto que cae fuera, como en
     cualquier editor.) En un párrafo se respeta el marco dibujado. */
  if(!L.frame){
    const grow = (b, m) => ({ x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 });
    const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
    if(t.strokeWidth > 0) box = grow(box, t.strokeWidth);
    if(t.bg) box = union(box, grow(L.blockBox, t.bgPadding || 0));
  }
  // La deformación puede empujar las letras hasta un 60% del alto del
  // bloque por encima o por debajo de su sitio: la caja de selección
  // se ensancha esa misma cantidad para seguir envolviéndolas, en vez
  // de dejar tiradores que recortan el texto doblado.
  if(t.warp && t.warp.kind && t.warp.amount){
    const pad = Math.abs(t.warp.amount) / 100 * L.blockBox.h * 0.6;
    box = { x: box.x, y: box.y - pad, w: box.w, h: box.h + pad * 2 };
  }
  return box;
}

/* ── geometría con el giro puesto ──────────────────────────────── */

export function rotatePoint(px, py, cx, cy, deg){
  if(!deg) return { x: px, y: py };
  const a = deg * Math.PI / 180, s = Math.sin(a), c = Math.cos(a);
  const dx = px - cx, dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

/* Las cuatro esquinas de la caja ya giradas, en coordenadas de
   documento: es lo que dibuja el marco de selección y de donde salen
   las posiciones de los tiradores. */
export function textQuad(layer){
  const b = textBounds(layer);
  const t = layer.text, a = t.angle || 0;
  const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
  return pts.map(([px, py]) => rotatePoint(px, py, t.x, t.y, a));
}

/* Un punto del documento, llevado al sistema sin girar del texto. Con
   esto el acierto sobre un texto rotado se resuelve con la misma
   comparación de rectángulo de siempre. */
export function toTextSpace(layer, p){
  const t = layer.text;
  return rotatePoint(p.x, p.y, t.x, t.y, -(t.angle || 0));
}

/* ¿Se sale el texto del alto de su marco? Lo consulta el marco de
   selección para avisar de que hay que agrandarlo. */
export function textOverflows(layer){
  const t = layer.text;
  if(!isText(layer) || !Number.isFinite(t.boxW) || !Number.isFinite(t.boxH)) return false;
  const ctx = measurer();
  ctx.font = fontString(t);
  return !!layoutText(ctx, t).overflow;
}

export function pointInText(layer, p, margin = 0){
  const b = textBounds(layer);
  const q = toTextSpace(layer, p);
  return q.x >= b.x - margin && q.x <= b.x + b.w + margin &&
         q.y >= b.y - margin && q.y <= b.y + b.h + margin;
}

/* Cambiar la alineación de un texto de PUNTO no debe moverlo: las
   líneas se alinean entre sí y el bloque se queda donde está. Como el
   ancla de un texto de punto es el borde izquierdo, el centro o el
   borde derecho según la alineación, al cambiarla se recoloca el ancla
   en el punto equivalente del mismo bloque (girado, si lo está). En un
   párrafo el ancla es el centro del marco y no hace falta tocarla. */
export function alignTextPatch(layer, align){
  const t = layer.text;
  const boxed = Number.isFinite(t.boxW) && t.boxW > 0;
  if(!isText(layer) || boxed || t.circle || (t.path && t.path.p0) || t.align === align) return { align };
  const ctx = measurer();
  ctx.font = fontString(t);
  const L = layoutText(ctx, t);
  const left = L.box.x, w = L.box.w;
  const k = align === "center" ? 0.5 : align === "right" ? 1 : 0;
  const p = rotatePoint(left + w * k, t.y, t.x, t.y, t.angle || 0);
  return { align, x: p.x, y: p.y };
}

export function createTextLayer(at){
  const t = defaultText();
  if(at){ t.x = Math.round(at.x); t.y = Math.round(at.y); t.align = "left"; }
  const l = addLayer({ name: "Texto" });
  l.type = "text";
  l.text = t;
  l.name = t.content.slice(0, 22) || "Texto";
  renderTextLayer(l);
  emit("doc:structure");
  emit("doc:change");
  return l;
}

export function updateText(layer, patch){
  if(!layer || !layer.text) return;
  Object.assign(layer.text, patch);
  if(patch.content !== undefined){
    layer.name = String(patch.content).split("\n")[0].slice(0, 22) || "Texto";
  }
  renderTextLayer(layer);
  emit("doc:change");
}

export const isText = l => !!(l && l.type === "text" && l.text);

/* Convierte la capa de texto en píxeles corrientes. El lienzo de la
   capa ya contiene su render exacto —no hay nada que redibujar—, así
   que "rasterizar" es sólo soltar los atributos de texto: a partir de
   ahí se puede recortar, deformar o pintar encima, pero ya no se puede
   reabrir para editar el contenido como texto. */
export function rasterizeText(layer){
  if(!isText(layer)) return false;
  const before = { type: layer.type, text: layer.text };
  const after  = { type: "raster",   text: null };
  const apply = st => {
    layer.type = st.type; layer.text = st.text;
    layer.thumbDirty = true;
    emit("doc:change");
  };
  apply(after);
  record("Rasterizar texto", () => apply(before), () => apply(after));
  emit("doc:structure");
  return true;
}
