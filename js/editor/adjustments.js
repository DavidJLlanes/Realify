/* ═══════════════════════════════════════════════════════════════
   LOS AJUSTES
   Cada uno construye su tabla y deja que el esqueleto de adjust.js
   se ocupe de la vista previa, el historial y el cancelar.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { PIPETTE_SVG, averageRGB } from "../ui/wbpick.js";
import { toImage } from "./view.js";
import { toast } from "../ui/toast.js";
import { isMobile } from "../core/device.js";
import { premiumSwitch, premiumPref } from "../ui/premium.js";
import { hslPremium } from "./hslpremium.js";
import { applyLevelsPremium, applyCurvesPremium, autoLevelsState, autoCurvePoints, autoContrastState, levelsLuts } from "./tonepremium.js";
import { runAdjust, applyDirect, applyLut, identityLut,
         drawHistogram, slider, histogram, pickerGroup, liftImageAbove } from "./adjust.js";
import { curveEditor, curveLut, curveThumb, CHANNEL_COLORS, CURVE_PRESETS, userCurvePresets, saveUserCurvePresets, applyCurves } from "./curves.js";
import { curvesFullscreen } from "./curvesfs.js";
export { CURVE_PRESETS };
import { BW_RECIPES, applyBWRecipe } from "./bwrecipes.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

/* ── brillo y contraste ───────────────────────────────────────── */
export function brightnessContrast(opts = {}){
  // Una capa ya hecha conserva su motor; un ajuste nuevo, la última elección
  const p = { ...BC_DEFAULTS, premium: opts.init ? false : premiumPref.get("bc"), ...opts.init };

  return runAdjust({
    title: "Brillo y contraste",
    asLayer: true, filterId: "bc", filterParams: p, dlgCls: "dlg-compact",
    float: () => !p.premium,
    compute(data, w, h){ if(p.premium) applyBCPremium(data, w, h, p); else applyBC(data, p); },
    buildBody({ preview }){
      const box = bcControls(p, preview);
      const sw = premiumSwitch({ checked: p.premium, title: "Brillo y contraste de alta calidad: curva sobre la base y textura conservada, sin halos (función Premium)",
        onChange: on => { p.premium = on; premiumPref.set("bc", on); preview(); } });
      sw.classList.add("adj-premium");
      if(isMobile()){ sw.classList.add("ps-docked"); box.footStart = sw; } else box.prepend(sw);
      return box;
    }
  }, opts);
}

export const BC_DEFAULTS = { brightness: 0, contrast: 0, protect: 100, pivot: "auto", useLegacy: false };

/* Los mandos, compartidos por el filtro y la capa de ajuste. */
export function bcControls(p, preview){
  const box = document.createElement("div");
  const prot = slider("Protección", 0, 100, p.protect ?? 100,
    v => { p.protect = v; preview(); }, "%");
  box.appendChild(pickerGroup([
    { label: "Brillo", node: slider("Brillo", -100, 100, p.brightness, v => { p.brightness = v; preview(); }) },
    { label: "Contraste", node: slider("Contraste", -100, 100, p.contrast, v => { p.contrast = v; preview(); }) },
    { label: "Protección de luces y sombras", node: prot }
  ]));
  const piv = document.createElement("div");
  piv.className = "field";
  piv.innerHTML = `<label title="Pivote del contraste">Pivote</label>
    <select class="grow">
      <option value="auto">Automático (según la foto)</option>
      <option value="mid">Gris medio</option>
    </select>`;
  const sel = piv.querySelector("select");
  sel.value = p.pivot === "mid" ? "mid" : "auto";
  sel.addEventListener("change", () => { p.pivot = sel.value; preview(); });
  box.appendChild(piv);
  const leg = document.createElement("label");
  leg.className = "chk";
  leg.innerHTML = `<input type="checkbox"${p.useLegacy ? " checked" : ""}> Usar heredado (algoritmo antiguo, canal a canal y con recorte)`;
  const note = document.createElement("p");
  note.className = "hint";
  note.style.marginTop = "10px";
  const sync = () => {
    const on = !!p.useLegacy;
    prot.querySelector("input").disabled = on; sel.disabled = on;
    note.textContent = on
      ? "Heredado: el cálculo de antes, sobre cada canal en 8 bits. Recorta luces y sombras y puede cambiar el tono de los colores."
      : "Trabaja sobre la luminosidad percibida y conserva el tono de los colores. " +
        "Con protección al 100 % nada se quema ni se empasta; al bajarla, el contraste " +
        "aprieta más los extremos. En automático el contraste pivota sobre la luminosidad " +
        "media de la foto, así que no la oscurece ni la aclara.";
  };
  leg.querySelector("input").addEventListener("change", e => { p.useLegacy = e.target.checked; sync(); preview(); });
  box.appendChild(leg);
  sync();
  box.appendChild(note);
  return box;
}

/* Brillo y contraste de precisión.
   Antes era una tabla de 8 bits aplicada canal a canal en sRGB: el
   contraste era una recta con recorte duro (a +50 ya se perdían todas
   las luces por encima de 215 y las sombras por debajo de 40), el
   brillo una suma que también recortaba, y al tratar R, G y B por
   separado los colores cambiaban de tono y de saturación.
   Ahora, en coma flotante y por píxel:
   · Se calcula la luminancia RELATIVA real (Y, en luz lineal) y se
     pasa a luminosidad percibida (L* de CIELAB, 0..1), que es donde
     «el gris medio» y «un poco más de brillo» significan lo mismo en
     sombras y en luces.
   · Contraste positivo: curva en S (ganancia de Schlick) centrada en
     L* 50. Pendiente `s` (hasta 3) en el centro y 1/s en los extremos, así que el
     negro y el blanco quedan fijos y nada se recorta: las luces y las
     sombras se comprimen suavemente en vez de saturarse.
     Contraste negativo: compresión lineal hacia el gris medio (y del
     color con ella), de modo que −100 deja la imagen plana, como antes.
   · Brillo: curva de sesgo de Schlick que lleva L* 50 a L* 50 ± 30 con
     el negro y el blanco fijos y pendiente finita en ambos extremos
     (no dispara el ruido de las sombras como una gamma).
   · El resultado se aplica escalando R, G y B en luz lineal por Y'/Y:
     conserva el tono y la saturación. Si un color intenso no cabe, se
     desatura justo lo necesario en OKLab, con la luminosidad y el tono
     fijos, en vez de recortar un canal (que cambiaría el tono).
   · Vuelta a sRGB con redondeo exacto (tabla de 65 536 pasos).
   · Pivote automático: el contraste gira sobre la luminosidad media
     (L*) de la foto, no sobre un gris fijo, así que en una foto oscura
     o clara separa luces y sombras sin cambiar su brillo general.
   · Protección de luces y sombras (0..100 %): mezcla la curva en S con
     la recta de la misma pendiente central. Al 100 %, nada se recorta;
     al 0 %, contraste «duro» que sí aprieta los extremos.
   · Tramado al volver a 8 bits: ruido uniforme de ±½ nivel, fijo para
     cada píxel (la misma imagen da siempre el mismo resultado). Al
     estirar tonos quedan niveles sin usar y los cielos y degradados
     formarían bandas; el tramado las disuelve sin grano visible y
     conserva el valor medio exacto. Donde el resultado cae justo en un
     nivel entero (sin cambio) no toca nada.
   Los parámetros siguen siendo −100..100, así que proyectos, capas de
   ajuste, acciones y lotes ya guardados siguen funcionando. */
const BC_MID = 0.5;                        // L* 50: el gris medio perceptual
let _toLin = null, _toSrgb = null;
function bcTables(){
  if(_toLin) return;
  _toLin = new Float32Array(256);
  for(let i = 0; i < 256; i++){
    const v = i / 255;
    _toLin[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  _toSrgb = new Float32Array(65536);               // sRGB 0..255 SIN redondear: el tramado va después
  for(let i = 0; i < 65536; i++){
    const v = i / 65535;
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    _toSrgb[i] = s * 255;
  }
}
const yToL = y => y <= 216 / 24389 ? y * (24389 / 27) / 100 : (116 * Math.cbrt(y) - 16) / 100;
const lToY = l => { const L = l * 100; return L <= 8 ? L * 27 / 24389 : Math.pow((L + 16) / 116, 3); };
// Sesgo de Schlick: fija 0 y 1, lleva 0.5 a `a`, monótona y suave.
const bias = (x, a) => x / ((1 / a - 2) * (1 - x) + 1);

/* La curva tonal en L* (0..1 → 0..1). `pivotL` es el punto fijo del
   contraste (0.5 = L* 50); `protect` 0..100. */
export function bcCurve({ brightness = 0, contrast = 0, protect = 100, pivotL = BC_MID } = {}){
  const c = Math.max(-1, Math.min(1, contrast / 100));
  const b = Math.max(-1, Math.min(1, brightness / 100));
  const k = Math.max(0, Math.min(1, (Number.isFinite(+protect) ? +protect : 100) / 100));
  const P = Math.max(0.2, Math.min(0.8, +pivotL || BC_MID));
  const a = BC_MID + 0.3 * b;                       // brillo: L*50 → L*20..80
  const s = 1 + 2 * c;                              // contraste +: pendiente central 1..3
  const g = 1 / (1 + s);                            // ganancia de Schlick con esa pendiente
  return l => {
    let v;
    if(c > 0){
      const soft = l < P ? bias(l / P, g) * P
                         : 1 - bias((1 - l) / (1 - P), g) * (1 - P);
      if(k < 1){
        let hard = P + (l - P) * s;
        hard = hard < 0 ? 0 : hard > 1 ? 1 : hard;
        v = hard + (soft - hard) * k;
      } else v = soft;
    } else {
      v = P + (l - P) * (1 + c);
    }
    return b === 0 ? v : bias(v, a);
  };
}

/* Luminosidad media percibida (L*, 0..1) de unos píxeles RGBA,
   ponderada por la opacidad. Con muestreo: sobra con ~250 000 píxeles. */
export function bcPivot(data){
  bcTables();
  const n = data.length >> 2, step = Math.max(1, Math.floor(n / 250000)) * 4;
  let sum = 0, wsum = 0;
  for(let i = 0; i < data.length; i += step){
    const a = data[i + 3]; if(!a) continue;
    const y = 0.2126 * _toLin[data[i]] + 0.7152 * _toLin[data[i + 1]] + 0.0722 * _toLin[data[i + 2]];
    sum += yToL(y) * a; wsum += a;
  }
  return wsum ? sum / wsum : BC_MID;
}

/* Fuera de gama: se reduce el croma en OKLab con la luminosidad y el
   tono fijos (el método de CSS Color 4) hasta que el color cabe. Bajar
   el croma en RGB lineal hacia el gris, o recortar un canal, torcería
   el tono: un naranja intenso que se aclara acabaría amarillento. */
const _gm = new Float64Array(3);
function oklabToLin(L, A, B){
  let l = L + 0.3963377774 * A + 0.2158037573 * B; l = l * l * l;
  let m = L - 0.1055613458 * A - 0.0638541728 * B; m = m * m * m;
  let s = L - 0.0894841775 * A - 1.2914855480 * B; s = s * s * s;
  _gm[0] =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  _gm[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  _gm[2] = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
}
function gamutMap(r, g, b){
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  if(L >= 1){ _gm[0] = _gm[1] = _gm[2] = 1; return; }
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let lo = 0, hi = 1;
  for(let k = 0; k < 12; k++){                      // precisión 1/4096 del croma (sobra para 8 bits)
    const t = (lo + hi) / 2;
    oklabToLin(L, A * t, B * t);
    const ok = _gm[0] <= 1 && _gm[1] <= 1 && _gm[2] <= 1 && _gm[0] >= 0 && _gm[1] >= 0 && _gm[2] >= 0;
    if(ok) lo = t; else hi = t;
  }
  oklabToLin(L, A * lo, B * lo);
}

export function applyBC(data, p){
  if(p && p.useLegacy){ const t = buildBC(p); applyLut(data, { r: t, g: t, b: t }); return; }
  const brightness = +p.brightness || 0, contrast = +p.contrast || 0;
  if(!brightness && !contrast) return;
  bcTables();
  /* Pivote: gris medio, el que haya fijado quien llama (las capas de
     ajuste lo miden una vez sobre toda la imagen, porque aquí pueden
     llegar sólo trozos) o la media de estos píxeles. */
  const pivotL = p.pivot === "mid" ? BC_MID
               : Number.isFinite(p.pivotL) ? p.pivotL : bcPivot(data);
  const curve = bcCurve({ brightness, contrast, protect: p.protect ?? 100, pivotL });
  const chroma = contrast < 0 ? 1 + Math.max(-1, contrast / 100) : 1;
  /* Y → Y' tabulada con índice en raíz cuadrada (más densa en las
     sombras, donde la vista es más sensible) e interpolada: el error
     frente al cálculo directo queda muy por debajo de 1/65 000. */
  const N = 8192, yt = new Float64Array(N + 1);
  for(let i = 0; i <= N; i++){ const q = i / N; yt[i] = lToY(curve(yToL(q * q))); }
  const toLin = _toLin, toSrgb = _toSrgb;
  for(let i = 0; i < data.length; i += 4){
    let r = toLin[data[i]], g = toLin[data[i + 1]], bl = toLin[data[i + 2]];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    const f = Math.sqrt(y) * N, k = f | 0;
    const y2 = k >= N ? yt[N] : yt[k] + (yt[k + 1] - yt[k]) * (f - k);
    if(y <= 0){ r = g = bl = y2; }
    else {
      const m = y2 / y;
      r *= m; g *= m; bl *= m;
      if(chroma !== 1){ r = y2 + (r - y2) * chroma; g = y2 + (g - y2) * chroma; bl = y2 + (bl - y2) * chroma; }
      const mx = r > g ? (r > bl ? r : bl) : (g > bl ? g : bl);
      if(mx > 1){ gamutMap(r, g, bl); r = _gm[0]; g = _gm[1]; bl = _gm[2]; }
    }
    // Tramado: un hash del índice del píxel da tres ruidos de ±½ nivel.
    let h = Math.imul((i >> 2) + 0x632be5ab, 0x9e3779b1);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca77); h ^= h >>> 13;
    data[i]     = toSrgb[(r <= 0 ? 0 : r >= 1 ? 1 : r) * 65535 + 0.5 | 0] + ((h & 255) + 0.5) / 256 - 0.5;
    data[i + 1] = toSrgb[(g <= 0 ? 0 : g >= 1 ? 1 : g) * 65535 + 0.5 | 0] + (((h >>> 8) & 255) + 0.5) / 256 - 0.5;
    data[i + 2] = toSrgb[(bl <= 0 ? 0 : bl >= 1 ? 1 : bl) * 65535 + 0.5 | 0] + (((h >>> 16) & 255) + 0.5) / 256 - 0.5;
  }
}

/* ── Brillo y contraste Premium 👑 ──
   Mismos mandos y la misma curva (bcCurve), con dos diferencias que se
   ven:
   · La curva no se aplica a la luminancia sino a la «norma» de cada
     color (media de potencias de R, G y B, entre la luminancia y el
     canal máximo) y los tres canales se escalan por igual. Con la
     luminancia, un color intenso que se aclara tiene que desaturarse
     para caber: el cielo azul palidecía hacia el blanco al subir el
     contraste o el brillo. Así conserva su color.
   · Donde la curva se aplana (luces y sombras con contraste alto, luces
     al subir el brillo) se recupera la mitad de la textura que se
     perdería —nubes, piel, hierba—, medida contra una base de filtro
     guiado ancho. Nunca más que la original ni donde la curva ya la
     aumenta, así que no hay aspecto «HDR» ni grano realzado; al bajar el
     contraste no se recupera nada (−100 sigue dejando la imagen plana).
   El resto, como el motor normal: coma flotante, mapeo de gama en OKLab
   y tramado. */
function boxBlur(src, w, h, r){
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for(let y = 0; y < h; y++){
    const o = y * w; let s = 0;
    for(let x = -r; x <= r; x++) s += src[o + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    for(let x = 0; x < w; x++){
      tmp[o + x] = s / n;
      const xa = x + r + 1, xr = x - r;
      s += src[o + (xa >= w ? w - 1 : xa)] - src[o + (xr < 0 ? 0 : xr)];
    }
  }
  for(let x = 0; x < w; x++){
    let s = 0;
    for(let y = -r; y <= r; y++) s += tmp[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + x];
    for(let y = 0; y < h; y++){
      out[y * w + x] = s / n;
      const ya = y + r + 1, yr = y - r;
      s += tmp[(ya >= h ? h - 1 : ya) * w + x] - tmp[(yr < 0 ? 0 : yr) * w + x];
    }
  }
  return out;
}
/* Filtro guiado «rápido» (He y Sun, 2015): los coeficientes a y b se
   calculan sobre una copia reducida `s` veces y se amplían con
   interpolación bilineal; la salida q = a·I + b se evalúa con la imagen
   a resolución completa, así que los bordes siguen igual de nítidos. */
function guidedSelf(I, w, h, r, eps){
  const s = Math.max(1, Math.min(4, Math.floor(r / 2)));
  const sw = Math.max(1, Math.ceil(w / s)), sh = Math.max(1, Math.ceil(h / s)), m = sw * sh;
  const lo = new Float32Array(m);
  for(let y = 0; y < sh; y++) for(let x = 0; x < sw; x++){
    let sum = 0, c = 0;
    for(let yy = y * s; yy < Math.min(h, y * s + s); yy++) for(let xx = x * s; xx < Math.min(w, x * s + s); xx++){ sum += I[yy * w + xx]; c++; }
    lo[y * sw + x] = sum / c;
  }
  const rs = Math.max(1, Math.round(r / s)), II = new Float32Array(m);
  for(let i = 0; i < m; i++) II[i] = lo[i] * lo[i];
  const mI = boxBlur(lo, sw, sh, rs), mII = boxBlur(II, sw, sh, rs);
  const A = new Float32Array(m), B = new Float32Array(m);
  for(let i = 0; i < m; i++){ const v = Math.max(0, mII[i] - mI[i] * mI[i]); A[i] = v / (v + eps); B[i] = mI[i] - A[i] * mI[i]; }
  const mA = boxBlur(A, sw, sh, rs), mB = boxBlur(B, sw, sh, rs), q = new Float32Array(w * h);
  for(let y = 0; y < h; y++){
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) / s - 0.5)), y0 = fy | 0, y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < w; x++){
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) / s - 0.5)), x0 = fx | 0, x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      const i00 = y0 * sw + x0, i01 = y0 * sw + x1, i10 = y1 * sw + x0, i11 = y1 * sw + x1;
      const a = (mA[i00] * (1 - tx) + mA[i01] * tx) * (1 - ty) + (mA[i10] * (1 - tx) + mA[i11] * tx) * ty;
      const b = (mB[i00] * (1 - tx) + mB[i01] * tx) * (1 - ty) + (mB[i10] * (1 - tx) + mB[i11] * tx) * ty;
      q[y * w + x] = a * I[y * w + x] + b;
    }
  }
  return q;
}
export function applyBCPremium(data, w, h, p){
  const brightness = +p.brightness || 0, contrast = +p.contrast || 0;
  if(!brightness && !contrast) return;
  bcTables();
  const n = w * h, toLin = _toLin, toSrgb = _toSrgb;
  /* «Norma» de cada color: media de potencias (Σc³/Σc²), entre la
     luminancia y el canal máximo. La curva se aplica a ella y R, G y B
     se escalan por igual: se conservan tono Y saturación, y un color
     intenso nunca tiene que desaturarse para caber (el cielo azul sigue
     azul al subir el contraste o el brillo, en vez de palidecer). */
  const NT = 8192, YL = new Float32Array(NT + 1), LY = new Float32Array(NT + 1);
  for(let i = 0; i <= NT; i++){ const q = i / NT; YL[i] = yToL(q * q); LY[i] = lToY(q); }
  const y2l = y => { const f = Math.sqrt(y < 0 ? 0 : y > 1 ? 1 : y) * NT, k = f | 0; return k >= NT ? YL[NT] : YL[k] + (YL[k + 1] - YL[k]) * (f - k); };
  const l2y = l => { const f = (l < 0 ? 0 : l > 1 ? 1 : l) * NT, k = f | 0; return k >= NT ? LY[NT] : LY[k] + (LY[k + 1] - LY[k]) * (f - k); };
  const Ns = new Float32Array(n), Ls = new Float32Array(n);
  let psum = 0, pn = 0;
  for(let i = 0, j = 0; j < n; i += 4, j++){
    const r = toLin[data[i]], g = toLin[data[i + 1]], b = toLin[data[i + 2]];
    const q2 = r * r + g * g + b * b;
    const N = q2 > 0 ? (r * r * r + g * g * g + b * b * b) / q2 : 0;
    Ns[j] = N; const L = y2l(N); Ls[j] = L;
    if(data[i + 3] && !(j & 3)){ psum += L; pn++; }
  }
  const pivotL = p.pivot === "mid" ? BC_MID : Number.isFinite(p.pivotL) ? p.pivotL : (pn ? psum / pn : BC_MID);
  const curve = bcCurve({ brightness, contrast, protect: p.protect ?? 100, pivotL });
  const chroma = contrast < 0 ? 1 + Math.max(-1, contrast / 100) : 1;
  /* Textura: donde la curva se aplana (luces y sombras con contraste
     alto, luces al subir el brillo) recupera la MITAD de la textura que
     se perdería, nunca más que la original y nunca donde la curva ya
     la aumenta: sin aspecto «HDR». La base es un filtro guiado ancho
     (2,5 % del lado corto). Como nunca pasa de la textura original, el
     grano no se realza. Al BAJAR el contraste no se recupera nada: −100
     tiene que seguir dejando la imagen plana. */
  const r = Math.max(3, Math.round(Math.min(w, h) * 0.025));
  const base = guidedSelf(Ls, w, h, r, 0.002);
  const keepTexture = contrast >= 0;
  const NC = 2048, cv = new Float32Array(NC + 1), sl = new Float32Array(NC + 1);
  for(let i = 0; i <= NC; i++) cv[i] = curve(i / NC);
  for(let i = 0; i <= NC; i++){ const a = Math.max(0, i - 1), b = Math.min(NC, i + 1); sl[i] = (cv[b] - cv[a]) / ((b - a) / NC); }
  const look = (T, x) => { const f = (x < 0 ? 0 : x > 1 ? 1 : x) * NC, k = f | 0; return k >= NC ? T[NC] : T[k] + (T[k + 1] - T[k]) * (f - k); };
  for(let i = 0, j = 0; j < n; i += 4, j++){
    const L = Ls[j], bL = base[j];
    let L2 = look(cv, L);
    const slope = look(sl, bL);
    if(keepTexture && slope < 1){
      // la mitad de la textura que la curva aplanaría
      L2 += (L - bL) * (1 - slope) * 0.5;
    }
    L2 = L2 < 0 ? 0 : L2 > 1 ? 1 : L2;
    const N = Ns[j], N2 = l2y(L2);
    let rr = toLin[data[i]], gg = toLin[data[i + 1]], bb = toLin[data[i + 2]];
    if(N <= 1e-7){ rr = gg = bb = N2; }
    else {
      const m = N2 / N;
      rr *= m; gg *= m; bb *= m;
      if(chroma !== 1){
        const y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
        rr = y + (rr - y) * chroma; gg = y + (gg - y) * chroma; bb = y + (bb - y) * chroma;
      }
      const mx = rr > gg ? (rr > bb ? rr : bb) : (gg > bb ? gg : bb);
      if(mx > 1){ gamutMap(rr, gg, bb); rr = _gm[0]; gg = _gm[1]; bb = _gm[2]; }
    }
    let hh = Math.imul(j + 0x632be5ab, 0x9e3779b1);
    hh ^= hh >>> 15; hh = Math.imul(hh, 0x85ebca77); hh ^= hh >>> 13;
    data[i]     = toSrgb[(rr <= 0 ? 0 : rr >= 1 ? 1 : rr) * 65535 + 0.5 | 0] + ((hh & 255) + 0.5) / 256 - 0.5;
    data[i + 1] = toSrgb[(gg <= 0 ? 0 : gg >= 1 ? 1 : gg) * 65535 + 0.5 | 0] + (((hh >>> 8) & 255) + 0.5) / 256 - 0.5;
    data[i + 2] = toSrgb[(bb <= 0 ? 0 : bb >= 1 ? 1 : bb) * 65535 + 0.5 | 0] + (((hh >>> 16) & 255) + 0.5) / 256 - 0.5;
  }
}

/* ── Sombras / Iluminaciones Premium 👑 (shadowshighlights.js) ──
   Mismos mandos (Sombras, Iluminaciones, Radio, Tono), otro motor:
   · El «entorno» de cada píxel se mide con un filtro guiado sobre la
     luminosidad percibida (L*), que suaviza SIN cruzar los bordes: una
     silueta oscura contra un cielo claro no se rodea de un halo, como
     pasa con el desenfoque normal.
   · El radio es relativo al tamaño de la imagen (px de la imagen
     completa), así que la vista previa reducida y el resultado final se
     ven igual.
   · La corrección se aplica a la BASE (el entorno) y la textura se
     conserva e incluso se refuerza un poco donde se abren las sombras o
     se recuperan las luces: lo que se recupera no queda plano.
   · Transiciones suaves (curva en S) en vez de rampas.
   · Color: R, G y B se escalan por igual en luz lineal (tono y
     saturación intactos); si un color no cabe, mapeo de gama en OKLab
     en vez de recortar un canal; tramado al volver a 8 bits. */
export function applyShadowsHighlightsPremium(data, w, h, p, scale = 1){
  const sa = (+p.shadows || 0) / 100, ha = (+p.highlights || 0) / 100;
  if(!sa && !ha) return;
  bcTables();
  const n = w * h, toLin = _toLin, toSrgb = _toSrgb;
  const NT = 8192, YL = new Float32Array(NT + 1), LY = new Float32Array(NT + 1);
  for(let i = 0; i <= NT; i++){ const q = i / NT; YL[i] = yToL(q * q); LY[i] = lToY(q); }
  const y2l = y => { const f = Math.sqrt(y < 0 ? 0 : y > 1 ? 1 : y) * NT, k = f | 0; return k >= NT ? YL[NT] : YL[k] + (YL[k + 1] - YL[k]) * (f - k); };
  const l2y = l => { const f = (l < 0 ? 0 : l > 1 ? 1 : l) * NT, k = f | 0; return k >= NT ? LY[NT] : LY[k] + (LY[k + 1] - LY[k]) * (f - k); };
  // Luminancia (no la norma del color): así «sombra» y «luz» significan
  // lo mismo que en el modo normal y un cielo azul no cuenta como más claro.
  const Ns = new Float32Array(n), Ls = new Float32Array(n);
  for(let i = 0, j = 0; j < n; i += 4, j++){
    const Y = 0.2126 * toLin[data[i]] + 0.7152 * toLin[data[i + 1]] + 0.0722 * toLin[data[i + 2]];
    Ns[j] = Y; Ls[j] = y2l(Y);
  }
  const rad = Math.max(2, Math.round((+p.radius || 60) * scale));
  const base = guidedSelf(Ls, w, h, rad, 0.01);
  const tw = 0.12 + ((p.tone ?? 50) / 100) * 0.38;
  const S = x => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
  for(let i = 0, j = 0; j < n; i += 4, j++){
    const L = Ls[j], bL = base[j] < 0 ? 0 : base[j] > 1 ? 1 : base[j];
    const sw = S(1 - bL / tw), hw = S((bL - (1 - tw)) / tw);
    if(sw <= 0 && hw <= 0) continue;
    const delta = sa * sw * 0.85 - ha * hw * 0.85;
    const b2 = delta >= 0 ? bL + (1 - bL) * delta : bL * (1 + delta);
    // textura: se conserva y se refuerza hasta un 35 % donde se corrige
    const k = 1 + 0.35 * (sa * sw + ha * hw);
    let L2 = b2 + (L - bL) * k;
    L2 = L2 < 0 ? 0 : L2 > 1 ? 1 : L2;
    const N = Ns[j], N2 = l2y(L2);
    let rr = toLin[data[i]], gg = toLin[data[i + 1]], bb = toLin[data[i + 2]];
    if(N <= 1e-7){ rr = gg = bb = N2; }
    else {
      const m = N2 / N; rr *= m; gg *= m; bb *= m;
      const mx = rr > gg ? (rr > bb ? rr : bb) : (gg > bb ? gg : bb);
      if(mx > 1){ gamutMap(rr, gg, bb); rr = _gm[0]; gg = _gm[1]; bb = _gm[2]; }
    }
    let hh = Math.imul(j + 0x632be5ab, 0x9e3779b1);
    hh ^= hh >>> 15; hh = Math.imul(hh, 0x85ebca77); hh ^= hh >>> 13;
    data[i]     = toSrgb[(rr <= 0 ? 0 : rr >= 1 ? 1 : rr) * 65535 + 0.5 | 0] + ((hh & 255) + 0.5) / 256 - 0.5;
    data[i + 1] = toSrgb[(gg <= 0 ? 0 : gg >= 1 ? 1 : gg) * 65535 + 0.5 | 0] + (((hh >>> 8) & 255) + 0.5) / 256 - 0.5;
    data[i + 2] = toSrgb[(bb <= 0 ? 0 : bb >= 1 ? 1 : bb) * 65535 + 0.5 | 0] + (((hh >>> 16) & 255) + 0.5) / 256 - 0.5;
  }
}

/* La tabla de 8 bits de siempre, canal a canal en sRGB. Sólo para
   `useLegacy` (la casilla «Usar heredado»). */
export function buildBC({ brightness, contrast }){
  const t = new Uint8ClampedArray(256);
  const b = brightness * 1.28;                 // -128..128
  const c = contrast;
  /* Dos ramas, porque las dos direcciones piden cosas distintas.
     Subiendo, la fórmula clásica: crece de forma no lineal para que
     el extremo del deslizador siga siendo útil en vez de saturarlo
     todo a mitad de recorrido.
     Bajando, un factor lineal hasta cero, de modo que -100 deje la
     imagen realmente plana en gris medio. La fórmula clásica aplicada
     a la baja se queda en un factor 0.44 —un rango de 72 a 184— y el
     final del recorrido no hace lo que uno espera que haga. */
  const f = c >= 0
    ? (259 * (c + 255)) / (255 * (259 - c))
    : 1 + c / 100;
  for(let i = 0; i < 256; i++){
    // El brillo se suma DESPUÉS del contraste, no dentro de la misma
    // multiplicación: si no, subir el contraste amplifica también el
    // brillo ya aplicado —o lo aplasta si el contraste baja—, y dos
    // deslizadores que deberían ser independientes quedan acoplados.
    // Con contraste +100 y brillo +50, la versión acoplada llevaba el
    // gris medio directamente a blanco puro; así se queda en un
    // desplazamiento de brillo razonable, sea cual sea el contraste.
    t[i] = clamp255(f * (i - 128) + 128 + b);
  }
  return t;
}

/* ── niveles ──────────────────────────────────────────────────── */
/* Un estado POR CANAL —como en Curvas—, no uno compartido: si no, al
   cambiar de canal en el desplegable los mandos siguen mostrando y
   editando los valores del canal anterior, porque no hay dónde
   guardar los del que se acaba de dejar. Ajustar Rojo y pasar a Verde
   parecía "arrastrar" el ajuste de Rojo a Verde, y en realidad era
   sencillamente que nunca había habido dos ajustes distintos que
   guardar. El maestro (RGB) se compone POR ENCIMA de cada canal, en
   el mismo orden que ya usa Curvas y que es el de Photoshop. */
const mkLevelState = () => ({ inLow:0, inHigh:255, gamma:1, outLow:0, outHigh:255 });

export function levels(opts = {}){
  // Una capa ya hecha conserva su motor; un ajuste nuevo, la última elección
  const state = { channel:"rgb", premium: opts.init ? !!opts.init.premium : premiumPref.get("levels"),
                  ch: { rgb:mkLevelState(), r:mkLevelState(), g:mkLevelState(), b:mkLevelState() } };
  if(opts.init?.ch) for(const k of ["rgb","r","g","b"]) Object.assign(state.ch[k], opts.init.ch[k] || {});

  return runAdjust({
    title: "Niveles",
    wide: true,
    asLayer: true, filterId: "levels", filterParams: state,
    float: () => !state.premium,
    compute(data, w, h){
      if(state.premium){ applyLevelsPremium(data, state, { fast: w * h < doc.w * doc.h * 0.98 }); return; }
      const lut = buildLevelsByChannel(state);
      applyLut(data, lut);
    },
    buildBody({ hist, preview, source }){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="field"><label>Canal</label>
          <select class="grow" id="lvCh">
            <option value="rgb">RGB</option>
            <option value="r">Rojo</option>
            <option value="g">Verde</option>
            <option value="b">Azul</option>
          </select></div>
        <canvas id="lvHist" width="512" height="110"
          style="width:100%;border:1px solid var(--line-soft);border-radius:var(--r);
                 display:block;margin:4px 0 8px"></canvas>
        <div class="section-label">Entrada</div>
        <div id="lvIn"></div>
        <div class="section-label">Salida</div>
        <div id="lvOut"></div>
        <button id="lvAuto" class="wide" style="margin-top:8px">Automático</button>`;

      const cv = box.querySelector("#lvHist");
      const paint = () => drawHistogram(cv, hist, state.channel === "rgb" ? "rgb" : state.channel);
      paint();

      const inBox = box.querySelector("#lvIn");
      const sLow  = slider("Negro", 0, 254, 0, v => {
        const p = state.ch[state.channel];
        p.inLow = Math.min(v, p.inHigh - 1); preview(); });
      const sGam  = slider("Gamma", 10, 300, 100, v => {
        state.ch[state.channel].gamma = v / 100; preview(); }, "%");
      const sHigh = slider("Blanco", 1, 255, 255, v => {
        const p = state.ch[state.channel];
        p.inHigh = Math.max(v, p.inLow + 1); preview(); });
      inBox.append(sLow, sGam, sHigh);

      const outBox = box.querySelector("#lvOut");
      const sOutLow  = slider("Negro", 0, 254, 0, v => { state.ch[state.channel].outLow = v; preview(); });
      const sOutHigh = slider("Blanco", 1, 255, 255, v => { state.ch[state.channel].outHigh = v; preview(); });
      outBox.append(sOutLow, sOutHigh);

      // Al cambiar de canal, los cinco mandos pasan a mostrar y editar
      // los valores YA GUARDADOS de ese canal — nunca los del anterior.
      const syncControls = () => {
        const p = state.ch[state.channel];
        sLow.setValue(p.inLow);
        sGam.setValue(Math.round(p.gamma * 100));
        sHigh.setValue(p.inHigh);
        sOutLow.setValue(p.outLow);
        sOutHigh.setValue(p.outHigh);
        paint();
      };

      box.querySelector("#lvCh").addEventListener("change", e => {
        state.channel = e.target.value; syncControls();
      });
      syncControls();

      /* Automático: recorta el 0,1 % de cada extremo y estira, sobre
         el histograma DEL CANAL ACTIVO (antes siempre era la
         luminancia general, incluso ajustando Rojo o Azul). Sin ese
         recorte, un solo píxel perdido a negro o a blanco anula el
         ajuste entero. */
      /* Premium: el automático mide los colores más oscuros y más claros
         de la foto y ajusta los tres canales y los medios de una vez
         (tonepremium.js › autoLevelsState). */
      box.querySelector("#lvAuto").addEventListener("click", () => {
        if(state.premium && source){
          const k = Math.min(1, 800 / Math.max(source.width, source.height)), c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(source.width * k)); c.height = Math.max(1, Math.round(source.height * k));
          const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(source, 0, 0, c.width, c.height);
          const auto = autoLevelsState(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          for(const ch of ["rgb", "r", "g", "b"]) Object.assign(state.ch[ch], auto.ch[ch]);
          syncControls(); preview();
          return;
        }
        const arr = state.channel === "rgb" ? hist.l : hist[state.channel];
        let total = 0;
        for(let i = 0; i < 256; i++) total += arr[i];
        const cut = total * 0.001;
        let acc = 0, lo = 0, hi = 255;
        for(let i = 0; i < 256; i++){ acc += arr[i]; if(acc > cut){ lo = i; break; } }
        acc = 0;
        for(let i = 255; i >= 0; i--){ acc += arr[i]; if(acc > cut){ hi = i; break; } }
        const p = state.ch[state.channel];
        p.inLow = lo; p.inHigh = Math.max(lo + 1, hi); p.gamma = 1;
        syncControls();
        preview();
      });

      const sw = premiumSwitch({ checked: state.premium, title: "Niveles de alta calidad: coma flotante sin bandas, maestro sin cambiar el tono, automático que neutraliza dominantes (función Premium)",
        onChange: on => { state.premium = on; premiumPref.set("levels", on); preview(); } });
      sw.classList.add("adj-premium");
      if(isMobile()){ sw.classList.add("ps-docked"); box.footStart = sw; } else box.prepend(sw);
      return box;
    }
  }, opts);
}

/* Tabla de 256 entradas para un único canal (negro/blanco de entrada
   y salida, gamma). */
function levelLut(p){
  const f = levelFunction(p), t = new Uint8ClampedArray(256);
  for(let i = 0; i < 256; i++) t[i] = clamp255(f(i));
  return t;
}
/* Niveles como función continua de 0..255 (admite decimales): la tabla
   de arriba la muestrea en los enteros; la exportación de alta precisión
   (core/precision-stack.js) la evalúa sin redondear. */
export function levelFunction(p){
  const span = Math.max(1, p.inHigh - p.inLow);
  const inv = 1 / p.gamma;
  return i => {
    let v = (i - p.inLow) / span;
    v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, inv);
    return p.outLow + v * (p.outHigh - p.outLow);
  };
}
/* { r, g, b } en coma flotante, con la misma regla de canal que buildLevels */
export function levelsFunctions(p){
  const f = levelFunction(p), id = v => v;
  if(p.channel === "rgb") return { r:f, g:f, b:f };
  return { r: p.channel === "r" ? f : id, g: p.channel === "g" ? f : id, b: p.channel === "b" ? f : id };
}

/* Versión con memoria por canal, usada sólo por el diálogo «Niveles…»
   de arriba. El maestro (RGB) se compone ENCIMA de cada canal — mismo
   orden que Curvas y el que espera quien ya sabe usar niveles en
   Photoshop. */
function buildLevelsByChannel(state){
  const master = levelLut(state.ch.rgb);
  const lr = levelLut(state.ch.r), lg = levelLut(state.ch.g), lb = levelLut(state.ch.b);
  const r = new Uint8ClampedArray(256), g = new Uint8ClampedArray(256), b = new Uint8ClampedArray(256);
  for(let i = 0; i < 256; i++){
    r[i] = master[lr[i]]; g[i] = master[lg[i]]; b[i] = master[lb[i]];
  }
  return { r, g, b };
}

/* Versión de un solo canal ACTIVO a la vez (sin memoria de los
   demás), con la firma plana `{inLow,inHigh,gamma,outLow,outHigh,
   channel}`: la usan las capas de ajuste no destructivas
   (adjustlayers.js), cuyo panel simplificado ni siquiera tiene
   selector de canal — ahí "channel" es siempre "rgb" y no hace falta
   nada más que esto. No confundir con `buildLevelsByChannel`, que es
   la del diálogo completo del menú Ajustes. */
export function buildLevels(p){
  const t = levelLut(p);
  const id = identityLut();
  if(p.channel === "rgb") return { r:t, g:t, b:t };
  return { r: p.channel === "r" ? t : id,
           g: p.channel === "g" ? t : id,
           b: p.channel === "b" ? t : id };
}

/* ── curvas ───────────────────────────────────────────────────── */
/* ── Curvas ─────────────────────────────────────────────────────
   Cinco curvas: RGB (maestra), Rojo, Verde, Azul y Luminosidad. El
   orden de aplicación es el de Photoshop más una etapa final:
   canal → maestra RGB → luminosidad.

   · La curva de LUMINOSIDAD cambia sólo el brillo: suma a los tres
     canales la diferencia de luminancia, así que el tono y la
     saturación no se mueven (una curva en S en RGB satura; en
     luminosidad, no).
   · «Vincular luminosidad y color»: las dos curvas pasan a ser la
     misma —se edite la que se edite, la otra la sigue— y un control
     reparte su efecto entre aplicarla como color (RGB) o como
     luminosidad, en vez de aplicarla dos veces.
   · Todas las curvas se ven a la vez (las demás en tenue), y la vista
     «R · G · B» enseña los tres canales en tres paneles simultáneos.
   · Estilos: una galería con miniatura de las curvas más usadas
     (S clásica, cine, mate, película cruzada…) y los estilos propios
     guardados en el navegador. */
const ID = () => [[0,0],[255,255]];

export function curves(opts = {}){
  const CH = ["rgb", "r", "g", "b", "lum"];
  const state = {
    channel: "rgb",
    points: { rgb: ID(), r: ID(), g: ID(), b: ID(), lum: ID() },
    link: false,      // luminosidad y color vinculadas
    mix: 50,          // reparto con vínculo: 0 = sólo color, 100 = sólo luminosidad
    view: "one",      // "one" (un editor) o "rgb3" (tres paneles R · G · B)
    preset: null,     // último estilo aplicado sin retocar después (sólo informativo)
    // Premium 👑: una capa ya hecha conserva su motor; uno nuevo, la última elección
    premium: opts.init ? !!opts.init.premium : premiumPref.get("curves")
  };
  if(opts.init?.points) for(const k of CH)
    if(Array.isArray(opts.init.points[k])) state.points[k] = opts.init.points[k].map(pt => [pt[0], pt[1]]);
  if(opts.init){
    if(typeof opts.init.link === "boolean") state.link = opts.init.link;
    if(Number.isFinite(opts.init.mix)) state.mix = opts.init.mix;
    if(typeof opts.init.preset === "string") state.preset = opts.init.preset;
  }
  /* Desde el menú (o al reabrir la capa de filtro) se abre el editor a
     pantalla completa (curvesfs.js); montado en el panel de Propiedades
     de una capa de filtro sigue siendo el panel compacto de abajo. */
  const fullscreen = !opts.container && !opts.render;

  return runAdjust({
    title: "Curvas",
    wide: true,
    asLayer: true, filterId: "curves", filterParams: state,
    float: () => !state.premium,
    fullscreen,
    compute(data, w, h){ if(state.premium) applyCurvesPremium(data, state, { fast: w * h < doc.w * doc.h * 0.98 }); else applyCurves(data, state); },
    buildBody({ hist, preview, source }){
      if(fullscreen) return curvesFullscreen({ state, hist, preview, source, title: "Curvas", edit: !!opts.edit });
      const box = document.createElement("div");
      box.className = "curves-panel";
      box.innerHTML = `
        <div class="field"><label>Canal</label>
          <select class="grow" id="cvCh">
            <option value="rgb">RGB (color)</option>
            <option value="r">Rojo</option>
            <option value="g">Verde</option>
            <option value="b">Azul</option>
            <option value="lum">Luminosidad</option>
          </select></div>
        <div class="seg cv-view" style="margin:6px 0">
          <button type="button" data-view="one">Un panel</button>
          <button type="button" data-view="rgb3">R · G · B a la vez</button>
        </div>
        <div class="cv-host"></div>
        <label class="chk cv-link"><input type="checkbox"> Vincular luminosidad y color</label>
        <div class="cv-mix"></div>
        <div class="section-label" style="margin-top:10px">Estilos</div>
        <div class="cv-presets"></div>
        <div class="seg" style="margin-top:8px">
          <button type="button" data-p="reset">Restablecer canal</button>
          <button type="button" data-p="resetAll">Restablecer todo</button>
          <button type="button" data-p="save">Guardar estilo…</button>
        </div>
        <p class="hint" style="margin-top:10px">Clic para añadir un punto, arrastrar para moverlo; para quitarlo, clic derecho, doble clic o arrástralo fuera del cuadro. Las demás curvas se ven en tenue.</p>`;
      const host = box.querySelector(".cv-host");
      const others = ch => CH.filter(k => k !== ch && !(state.link && (k === "lum" || k === "rgb") && (ch === "lum" || ch === "rgb")))
        .filter(k => !(state.points[k].length === 2 && state.points[k][0][0] === 0 && state.points[k][0][1] === 0 && state.points[k][1][0] === 255 && state.points[k][1][1] === 255))
        .map(k => ({ points: state.points[k], color: CHANNEL_COLORS[k] }));
      let editors = [];
      const setPts = (ch, pts) => {
        state.points[ch] = pts; state.preset = null;
        // Vinculadas: la otra sigue a la que se edita
        if(state.link && (ch === "rgb" || ch === "lum")) state.points[ch === "rgb" ? "lum" : "rgb"] = pts.map(p => [p[0], p[1]]);
        preview();
      };
      const renderEditors = () => {
        host.innerHTML = "";
        editors = [];
        box.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
        if(state.view === "rgb3"){
          const grid = document.createElement("div");
          grid.style.cssText = "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px";
          for(const ch of ["r", "g", "b"]){
            const cell = document.createElement("div");
            cell.innerHTML = `<div class="section-label" style="color:${CHANNEL_COLORS[ch]};text-align:center">${ch === "r" ? "Rojo" : ch === "g" ? "Verde" : "Azul"}</div>`;
            const ed = curveEditor({ getPoints: () => state.points[ch], setPoints: pts => { setPts(ch, pts); }, hist, channel: () => ch,
              overlays: () => others(ch), maxWidth: 220, onEnd: refreshAll });
            cell.appendChild(ed.el); grid.appendChild(cell); editors.push(ed);
          }
          host.appendChild(grid);
        } else {
          const ed = curveEditor({ getPoints: () => state.points[state.channel], setPoints: pts => setPts(state.channel, pts),
            hist, channel: () => state.channel, overlays: () => others(state.channel),
            histMode: () => state.channel === "rgb" ? "rgb" : "one", onEnd: refreshAll });
          host.appendChild(ed.el); editors.push(ed);
        }
      };
      const refreshAll = () => { editors.forEach(e => e.refresh()); renderPresets(); };
      const mixHost = box.querySelector(".cv-mix");
      const renderMix = () => {
        mixHost.innerHTML = "";
        if(!state.link) return;
        mixHost.appendChild(slider("Reparto color ↔ luminosidad", 0, 100, state.mix, v => { state.mix = v; preview(); }, "%"));
      };
      const link = box.querySelector(".cv-link input");
      link.checked = state.link;
      link.addEventListener("change", () => {
        state.link = link.checked;
        if(state.link){
          // Al vincular, manda la curva que se está viendo
          const src = state.channel === "lum" ? "lum" : "rgb";
          state.points[src === "rgb" ? "lum" : "rgb"] = state.points[src].map(p => [p[0], p[1]]);
        }
        renderMix(); refreshAll(); preview();
      });

      /* Galería de estilos con miniatura */
      const presetsEl = box.querySelector(".cv-presets");
      presetsEl.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px";
      const applyPreset = set => {
        for(const k of CH) state.points[k] = set[k] ? set[k].map(p => [p[0], p[1]]) : ID();
        state.preset = null;
        if(state.link){ const src = set.lum && !set.rgb ? "lum" : "rgb"; state.points[src === "rgb" ? "lum" : "rgb"] = state.points[src].map(p => [p[0], p[1]]); }
        refreshAll(); preview();
      };
      const renderPresets = () => {
        presetsEl.innerHTML = "";
        const all = [...CURVE_PRESETS, ...userCurvePresets().map(u => [u.id, u.name, u.points, true])];
        for(const [id, name, set, mine] of all){
          const b = document.createElement("button");
          b.type = "button"; b.className = "cv-preset"; b.title = name;
          b.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;padding:4px;min-width:0;height:auto;min-height:88px;font-size:10.5px;line-height:1.15;white-space:normal;overflow-wrap:anywhere;text-align:center";
          const t = curveThumb(set, 52); t.style.cssText = "width:52px;height:52px;border-radius:4px";
          const n = document.createElement("span"); n.textContent = name;
          b.append(t, n);
          b.addEventListener("click", () => applyPreset(set));
          if(mine) b.addEventListener("contextmenu", e => {
            e.preventDefault();
            saveUserCurvePresets(userCurvePresets().filter(u => u.id !== id));
            renderPresets();
          });
          presetsEl.appendChild(b);
        }
      };

      box.addEventListener("click", async e => {
        const v = e.target.closest("[data-view]");
        if(v){ state.view = v.dataset.view; renderEditors(); return; }
        const b = e.target.closest("[data-p]");
        if(!b) return;
        const k = b.dataset.p;
        if(k === "reset"){ setPts(state.channel, ID()); refreshAll(); }
        else if(k === "resetAll"){ for(const c of CH) state.points[c] = ID(); refreshAll(); preview(); }
        else if(k === "save"){
          const { promptDlg } = await import("../ui/dialog.js");
          const name = await promptDlg("Guardar estilo de curvas", "Nombre del estilo", "Mi curva");
          if(!name) return;
          const list = userCurvePresets();
          list.push({ id: "u" + Date.now(), name: name.trim().slice(0, 40), points: JSON.parse(JSON.stringify(state.points)) });
          saveUserCurvePresets(list);
          renderPresets();
        }
      });
      box.querySelector("#cvCh").value = state.channel;
      box.querySelector("#cvCh").addEventListener("change", e => {
        state.channel = e.target.value;
        if(state.view !== "one"){ state.view = "one"; }
        renderEditors();
      });
      renderEditors(); renderMix(); renderPresets();
      return box;
    }
  }, opts);
}

/* ── balance de blancos ───────────────────────────────────────── */
export function whiteBalance(opts = {}){
  const p = { temp: 0, tint: 0, ...opts.init };

  return runAdjust({
    title: "Balance de blancos",
    asLayer: true, filterId: "whiteBalance", filterParams: p,
    float: true,
    compute(data){
      const lut = buildWB(p);
      applyLut(data, lut);
    },
    buildBody({ preview, source }){
      const box = document.createElement("div");
      let sTemp, sTint;
      /* Cuentagotas sobre la propia imagen abierta: se lee `source`, la
         capa TAL CUAL estaba al abrir (sin este balance), porque lo que
         se ve en el lienzo ya está corregido y cada toque corregiría
         sobre lo corregido. */
      const pick = wbEyedropper(sampleCanvas(source), p, () => {
        sTemp.setValue(p.temp); sTint.setValue(p.tint); preview();
      });
      sTemp = slider("Temperatura", -100, 100, p.temp, v => { p.temp = v; preview(); });
      sTint = slider("Tinte", -100, 100, p.tint, v => { p.tint = v; preview(); });
      box.appendChild(pickerGroup([
        { label: "Temperatura", node: sTemp },
        { label: "Tinte", node: sTint }
      ]));
      box.appendChild(pick.el);
      liftImageAbove(box);
      return box;
    }
  }, opts);
}

/* Lector de la media de un pequeño entorno de `canvas` (que cubre el
   documento entero, a cualquier escala) en coordenadas del documento. */
export function sampleCanvas(canvas){
  if(!canvas) return () => null;
  const cx = canvas.getContext("2d", { willReadFrequently: true });
  return (x, y) => {
    const sx = canvas.width / doc.w, sy = canvas.height / doc.h;
    const px = Math.floor(x * sx), py = Math.floor(y * sy);
    if(px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
    const rad = Math.max(2, Math.round(Math.max(canvas.width, canvas.height) / 400));
    const x0 = Math.max(0, px - rad), y0 = Math.max(0, py - rad);
    const w = Math.min(canvas.width - 1, px + rad) - x0 + 1, h = Math.min(canvas.height - 1, py + rad) - y0 + 1;
    const d = cx.getImageData(x0, y0, w, h).data;
    return averageRGB(d, w, h, px - x0, py - y0, rad);
  };
}

/* ── Cuentagotas de punto blanco (plugin y capa de ajuste) ──
   Un botón «Cuentagotas»: con él activo, el siguiente toque SOBRE LA
   IMAGEN ABIERTA (el lienzo, alrededor del diálogo o de la hoja) se
   usa como punto que debería ser blanco o gris neutro, y se calculan la
   temperatura y el tinte que lo dejan neutro. El ajuste se ve en el
   propio lienzo, en tiempo real, como el resto de ajustes.
     - `sampleAt(x, y)` (coordenadas del documento) devuelve la media de
       un pequeño entorno de la imagen SIN este balance: { rgb, clipped }.
     - Tras elegir, el modo se apaga solo.
   `onChange()` se llama tras escribir p.temp/p.tint. */
export function wbEyedropper(sampleAt, p, onChange){
  const row = document.createElement("div");
  row.className = "wb-pick-row";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "wb-pick-btn";
  btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = `${PIPETTE_SVG}<span>Cuentagotas</span>`;
  btn.title = "Toca en la imagen un punto que deba ser blanco o gris neutro";
  const hint = document.createElement("span");
  hint.className = "wb-pick-hint"; hint.hidden = true;
  hint.textContent = "Toca en la imagen algo blanco o gris";
  row.append(btn, hint);

  let picking = false;
  const stage = document.getElementById("stage");
  const onImage = t => (t.classList?.contains("modal") && !t.closest(".modal-card")) || (stage && stage.contains(t));
  const down = e => {
    if(!picking || !onImage(e.target) || !doc.open) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const q = toImage(e.clientX, e.clientY);
    setPicking(false);
    const s = sampleAt(q.x, q.y);
    if(!s){ toast("Toca dentro de la imagen"); return; }
    if(Math.max(...s.rgb) < 12){ toast("Ese punto es casi negro: elige una zona gris o blanca con algo de luz"); return; }
    const res = grayPointToWB(...s.rgb);
    p.temp = res.temp; p.tint = res.tint;
    onChange();
    if(res.limited) toast("Ese punto tiene un tono muy fuerte: la corrección se ha quedado en el límite");
    else if(s.clipped) toast("Ese punto está quemado: el balance puede no ser exacto; mejor un gris claro");
    else toast(`Balance ajustado: temperatura ${res.temp}, tinte ${res.tint}`, "ok");
  };
  // Se traga también el clic que sigue al toque, para que no llegue al
  // lienzo ni cierre nada.
  let swallowClick = false;
  const click = e => { if(swallowClick && onImage(e.target)){ e.preventDefault(); e.stopPropagation(); swallowClick = false; } };
  const setPicking = on => {
    picking = on;
    btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", String(on));
    hint.hidden = !on;
    document.body.classList.toggle("wb-picking", on);
    if(on){ document.addEventListener("pointerdown", down, true); document.addEventListener("click", click, true); }
    else { document.removeEventListener("pointerdown", down, true); swallowClick = true; setTimeout(() => { swallowClick = false; document.removeEventListener("click", click, true); }, 400); }
  };
  btn.addEventListener("click", () => setPicking(!picking));
  // Si el diálogo o el panel se cierran con el modo activo, se apaga
  const obs = new MutationObserver(() => { if(!row.isConnected && picking){ setPicking(false); obs.disconnect(); } });
  requestAnimationFrame(() => obs.observe(document.body, { childList: true, subtree: true }));
  return { el: row, setPicking };
}

/* Modelo multiplicativo sencillo: la temperatura mueve rojo y azul en
   direcciones opuestas, el tinte mueve el verde frente a los otros
   dos. No es la adaptación cromática completa de un revelador de RAW,
   pero para corregir un tono dominante es más que suficiente y es
   trivialmente invertible, que es lo que hace falta para el
   cuentagotas de abajo. */
/* Ganancias de cada canal del balance de blancos (también las usa la
   exportación de alta precisión, sin redondear). */
export function wbGains({ temp, tint }){
  const t = temp / 100, g = tint / 100;
  return { r: 1 + t * 0.4, g: 1 - g * 0.25, b: 1 - t * 0.4 };
}
export function buildWB({ temp, tint }){
  const { r: rGain, g: gGain, b: bGain } = wbGains({ temp, tint });
  const mk = gain => { const a = new Uint8ClampedArray(256);
    for(let i = 0; i < 256; i++) a[i] = clamp255(i * gain); return a; };
  return { r: mk(rGain), g: mk(gGain), b: mk(bGain) };
}

/* Deshace el modelo anterior: a partir de un color que debería ser
   gris, la temperatura y el tinte que lo dejan EXACTAMENTE neutro.
     r·(1+0,4t) = b·(1−0,4t)   →  t = (b−r) / (0,4·(r+b))
   y los dos quedan en n = 2rb/(r+b) (su media armónica, casi el mismo
   brillo); el verde se lleva a ese mismo valor:
     g·(1−0,25k) = n           →  k = (1 − n/g) / 0,25
   Antes se promediaban dos estimaciones de t y el punto quedaba casi,
   pero no del todo, gris. `limited`: hizo falta más de ±100. */
function grayPointToWB(r, g, b){
  r = Math.max(1, r); g = Math.max(1, g); b = Math.max(1, b);
  const t = (b - r) / (0.4 * (r + b));
  const n = 2 * r * b / (r + b);
  const k = (1 - n / g) / 0.25;
  return {
    temp: Math.round(clamp1(t) * 100),
    tint: Math.round(clamp1(k) * 100),
    limited: Math.abs(t) > 1.005 || Math.abs(k) > 1.005
  };
}
const clamp1 = v => Math.max(-1, Math.min(1, v));

/* ── niveles automáticos ──────────────────────────────────────────
   Distinto del contraste automático: éste corrige también el color.
   Diagnóstico (autoanalysis.js › tonepremium.js › autoLevelsState):
   negro y blanco de cada canal con los colores más oscuros y más claros
   de verdad —sólo si son casi neutros; una lámpara amarilla o un mar
   azul profundo no se «corrigen»—, gamma de cada canal para que los
   medios neutros queden grises (con la confianza de la dominante
   detectada) y gamma maestra para la exposición. Sin estirar lo ya
   quemado y con la ganancia limitada. El normal lo aplica con tablas
   de 8 bits; el Premium, con el motor Premium. */
export function autoLevels(opts = {}){
  return applyDirect("Niveles automáticos", (data, w, h) => {
    const [r, g, b] = levelsLuts(autoLevelsState(data, w, h));
    applyLut(data, { r, g, b });
  }, { asLayer: true, filterId: "autoLevels", float: "delta" }, opts);
}

/* Niveles automáticos Premium 👑: mide la foto (tonepremium.js), aplica
   Niveles con el motor Premium y lo deja como una capa de filtro
   «Niveles» normal, así que el doble clic en su «fx» abre Niveles con
   esos valores para afinarlos. */
export function autoLevelsPremium(opts = {}){
  let state = null;
  const params = {};
  return applyDirect("Niveles automáticos Premium", (data, w, h) => {
    state = autoLevelsState(data, w, h);
    Object.assign(params, state);
    applyLevelsPremium(data, state);
  }, { asLayer: true, filterId: "levels", filterParams: params, float: "delta" }, opts);
}

/* ── tono y saturación ────────────────────────────────────────── */
export function hueSaturation(opts = {}){
  // Una capa ya hecha conserva su motor (sin `premium` guardado = normal);
  // un ajuste nuevo empieza con la última elección.
  const p = { hue: 0, sat: 0, light: 0, colorize: false, premium: opts.init ? false : premiumPref.get("hsl"), ...opts.init };

  return runAdjust({
    title: "Tono y saturación",
    asLayer: true, filterId: "hsl", filterParams: p,
    float: () => !p.premium,
    // Premium 👑: mismo ajuste en OKLCh, coma flotante, gama y tramado
    // (vista previa reducida → tabla interpolada; resultado final → exacto)
    previewLimit: 6e5,
    compute(data, w, h){ if(p.premium) hslPremium(data, p, { fast: w * h < doc.w * doc.h * 0.98 }); else hslShift(data, p); },
    buildBody({ preview }){
      const box = document.createElement("div");
      const sw = premiumSwitch({ checked: p.premium, title: "Tono y saturación de alta calidad: OKLCh, luz lineal, mapeo de gama y tramado (función Premium)",
        onChange: on => { p.premium = on; premiumPref.set("hsl", on); preview(); } });
      sw.classList.add("adj-premium");
      // Móvil: en la barra de Cancelar/Aplicar, a la izquierda (sin fila
      // propia: la imagen manda). Escritorio: encima de los mandos.
      if(isMobile()){ sw.classList.add("ps-docked"); box.footStart = sw; } else box.appendChild(sw);
      box.appendChild(pickerGroup([
        { label: "Tono", node: slider("Tono", -180, 180, p.hue, v => { p.hue = v; preview(); }, "°") },
        { label: "Saturación", node: slider("Saturación", -100, 100, p.sat, v => { p.sat = v; preview(); }) },
        { label: "Luminosidad", node: slider("Luminosidad", -100, 100, p.light, v => { p.light = v; preview(); }) }
      ]));
      const c = document.createElement("label");
      c.className = "chk";
      c.innerHTML = `<input type="checkbox"${p.colorize ? " checked" : ""}> Colorear (teñir toda la imagen de un tono)`;
      c.querySelector("input").addEventListener("change", e => {
        p.colorize = e.target.checked; preview();
      });
      box.appendChild(c);
      return box;
    }
  }, opts);
}

export function hslShift(data, p){
  const hueShift = p.hue / 360;
  const satF = 1 + p.sat / 100;
  const liF = p.light / 100;
  for(let i = 0; i < data.length; i += 4){
    let [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
    if(p.colorize){ h = (p.hue + 360) / 360 % 1; s = Math.max(0, Math.min(1, (p.sat + 100) / 200)); }
    else { h = (h + hueShift + 1) % 1; s = Math.max(0, Math.min(1, s * satF)); }
    // Aclarar hacia el blanco y oscurecer hacia el negro, no sumando
    // sin más: sumar aplasta las luces contra el techo.
    l = liF >= 0 ? l + (1 - l) * liF : l * (1 + liF);
    const [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, l)));
    data[i] = r; data[i+1] = g; data[i+2] = b;
  }
}

export function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if(mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if(mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if(mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb(h, s, l){
  if(s === 0){ const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = t => {
    if(t < 0) t += 1;
    if(t > 1) t -= 1;
    if(t < 1/6) return p + (q - p) * 6 * t;
    if(t < 1/2) return q;
    if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [Math.round(hue(h + 1/3) * 255),
          Math.round(hue(h) * 255),
          Math.round(hue(h - 1/3) * 255)];
}

/* ── blanco y negro ───────────────────────────────────────────── */
export function grayscale(opts = {}){
  const p = { mode: "manual", r: 30, g: 59, b: 11, recipe: null, ...opts.init };
  if(p.recipe && p.recipe.name) p.recipe = BW_RECIPES.find(r => r.name === p.recipe.name) || p.recipe;

  return runAdjust({
    title: "Blanco y negro",
    wide: true,
    asLayer: true, filterId: "bw", filterParams: p, float: () => p.mode === "manual" ? true : "delta",
    compute(data, w, h){
      if(p.mode === "auto"){
        applyBWRecipe(data, w, h, p.recipe || BW_RECIPES[0]);
        return;
      }
      // Los pesos se normalizan siempre: si suman más de 100 la
      // imagen se quema, y ese no es el trabajo de este ajuste.
      const t = p.r + p.g + p.b || 1;
      const wr = p.r / t, wg = p.g / t, wb = p.b / t;
      for(let i = 0; i < data.length; i += 4){
        const v = clamp255(data[i]*wr + data[i+1]*wg + data[i+2]*wb);
        data[i] = data[i+1] = data[i+2] = v;
      }
    },
    buildBody({ preview, source }){
      const layer = source ? { canvas: source } : activeLayer();
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="seg" id="bwMode" style="margin-bottom:10px">
          <button data-m="manual" class="on">Manual</button>
          <button data-m="auto">Automático</button>
        </div>
        <div id="bwManual"></div>
        <div id="bwAuto" hidden>
          <p class="hint" style="margin-top:0">Dieciocho conversiones inspiradas en otras tantas maneras
            de revelar en blanco y negro: cada una mezcla los canales, el contraste y el grano de
            forma distinta. Elige la que más se ajuste a esta foto.</p>
          <div id="bwGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px"></div>
          <p class="hint mono" id="bwNote" style="margin-top:8px"></p>
        </div>`;

      const manualBox = box.querySelector("#bwManual");
      const note = document.createElement("p");
      note.className = "hint";
      note.style.marginTop = "0";
      note.textContent = "Cuánto aporta cada color al gris. Bajar el azul oscurece " +
        "el cielo; subir el rojo aclara la piel. Es lo que hacían los filtros de " +
        "color sobre película en blanco y negro.";
      manualBox.appendChild(note);
      const sr = slider("Rojo", 0, 100, p.r, v => { p.r = v; preview(); }, "%");
      const sg = slider("Verde", 0, 100, p.g, v => { p.g = v; preview(); }, "%");
      const sb = slider("Azul", 0, 100, p.b, v => { p.b = v; preview(); }, "%");
      manualBox.append(sr, sg, sb);

      const presets = document.createElement("div");
      presets.className = "seg";
      presets.style.marginTop = "8px";
      presets.innerHTML = `<button data-v="30,59,11">Luminancia</button>
                           <button data-v="33,34,33">Plano</button>
                           <button data-v="60,28,12">Filtro rojo</button>
                           <button data-v="10,25,65">Filtro azul</button>`;
      presets.addEventListener("click", e => {
        const b = e.target.closest("[data-v]");
        if(!b) return;
        const [r, g, bl] = b.dataset.v.split(",").map(Number);
        p.r = r; p.g = g; p.b = bl;
        sr.setValue(r); sg.setValue(g); sb.setValue(bl);
        preview();
      });
      manualBox.appendChild(presets);

      // ── modo automático: rejilla de miniaturas ──────────────────
      const grid = box.querySelector("#bwGrid");
      const noteEl = box.querySelector("#bwNote");
      const S = 110;
      const thumb = document.createElement("canvas");
      thumb.width = S; thumb.height = S;
      const tx = thumb.getContext("2d", { willReadFrequently: true });
      const side = Math.min(doc.w, doc.h);
      tx.drawImage(layer.canvas, (doc.w - side) / 2, (doc.h - side) / 2, side, side, 0, 0, S, S);
      const baseData = tx.getImageData(0, 0, S, S);

      const cells = [];
      BW_RECIPES.forEach(recipe => {
        const cell = document.createElement("button");
        cell.style.cssText = "padding:0;display:flex;flex-direction:column;gap:4px;background:transparent;border:0";
        const cv = document.createElement("canvas");
        cv.width = S; cv.height = S;
        cv.style.cssText = "width:100%;border-radius:var(--r);border:2px solid var(--line);display:block";
        const cx = cv.getContext("2d");
        const img = new ImageData(new Uint8ClampedArray(baseData.data), S, S);
        applyBWRecipe(img.data, S, S, recipe);
        cx.putImageData(img, 0, 0);
        const label = document.createElement("span");
        label.textContent = recipe.name;
        label.style.cssText = "font-size:var(--fs-xs);color:var(--tx-dim);text-align:center";
        cell.append(cv, label);
        cell.addEventListener("click", () => {
          p.recipe = recipe;
          cells.forEach(c => c.style.borderColor = "var(--line)");
          cv.style.borderColor = "var(--ac)";
          noteEl.textContent = recipe.note;
          preview();
        });
        cell.cv = cv;
        cells.push(cell);
        grid.appendChild(cell);
      });

      box.querySelector("#bwMode").addEventListener("click", e => {
        const b = e.target.closest("[data-m]");
        if(!b) return;
        p.mode = b.dataset.m;
        box.querySelectorAll("#bwMode button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        manualBox.hidden = p.mode !== "manual";
        box.querySelector("#bwAuto").hidden = p.mode !== "auto";
        if(p.mode === "auto" && !p.recipe){
          p.recipe = BW_RECIPES[0];
          cells[0].cv.style.borderColor = "var(--ac)";
          noteEl.textContent = BW_RECIPES[0].note;
        }
        preview();
      });

      // Estado de partida al reabrir: modo y receta ya elegidos
      if(p.mode === "auto"){
        const btn = box.querySelector('#bwMode [data-m="auto"]');
        box.querySelectorAll("#bwMode button").forEach(x => x.classList.remove("on"));
        btn.classList.add("on");
        manualBox.hidden = true;
        box.querySelector("#bwAuto").hidden = false;
        const idx = Math.max(0, BW_RECIPES.indexOf(p.recipe));
        p.recipe = BW_RECIPES[idx];
        cells[idx].cv.style.borderColor = "var(--ac)";
        noteEl.textContent = BW_RECIPES[idx].note;
      }

      return box;
    }
  }, opts);
}

/* ── de un solo paso ──────────────────────────────────────────── */
export function invert(opts = {}){
  return applyDirect("Invertir", data => {
    for(let i = 0; i < data.length; i += 4){
      data[i] = 255 - data[i];
      data[i+1] = 255 - data[i+1];
      data[i+2] = 255 - data[i+2];
    }
  }, { asLayer: true, filterId: "invert", float: true }, opts);
}

/* Contraste automático: sólo la luminancia, los tres canales por igual
   (no toca el balance de color). Diagnóstico en autoanalysis.js: negro y
   blanco por percentiles sin estirar lo que ya está quemado ni contar
   los brillos aislados (sol, reflejos), ganancia limitada para no
   amplificar el ruido y medios hacia el gris medio con la mitad de
   fuerza (respetando la clave baja). */
export function autoContrast(opts = {}){
  return applyDirect("Contraste automático", (data, w, h) => {
    const [t] = levelsLuts(autoContrastState(data, w, h));
    applyLut(data, { r:t, g:t, b:t });
  }, { asLayer: true, filterId: "autoContrast", float: "delta" }, opts);
}

/* Contraste automático Premium 👑: el mismo recorte de la luminancia,
   aplicado como Niveles maestros Premium (tonepremium.js): estira la
   intensidad de cada color sin cambiar su tono ni su saturación. Queda
   como capa de filtro «Niveles» reeditable. */
export function autoContrastPremium(opts = {}){
  const params = {};
  return applyDirect("Contraste automático Premium", (data, w, h) => {
    const state = autoContrastState(data, w, h);
    Object.assign(params, state);
    applyLevelsPremium(data, state);
  }, { asLayer: true, filterId: "levels", filterParams: params, float: "delta" }, opts);
}
