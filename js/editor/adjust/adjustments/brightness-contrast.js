/* ═══════════════════════════════════════════════════════════════
   adjustments · brightness contrast
   Parte de js/editor/adjust/adjustments.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { premiumPref, premiumSwitch } from "../../../ui/kit/premium.js";
import { runAdjust, slider, pickerGroup, applyLut } from "../adjust.js";
import { isMobile } from "../../../core/device.js";
import { doc } from "../../../core/doc.js";
import { clamp255 } from "./common.js";

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
  // Canvas/ImageData devuelve componentes P3 en documentos de ese espacio.
  // Su luminancia usa otros coeficientes que sRGB; mezclarlos desplaza los
  // pesos tonales y, al abrir sombras saturadas, se percibe como un tinte.
  const [wr, wg, wb] = doc.colorSpace === "display-p3" ? [0.22897456, 0.69173852, 0.07928691] : [0.2126, 0.7152, 0.0722];
  const NT = 8192, YL = new Float32Array(NT + 1), LY = new Float32Array(NT + 1);
  for(let i = 0; i <= NT; i++){ const q = i / NT; YL[i] = yToL(q * q); LY[i] = lToY(q); }
  const y2l = y => { const f = Math.sqrt(y < 0 ? 0 : y > 1 ? 1 : y) * NT, k = f | 0; return k >= NT ? YL[NT] : YL[k] + (YL[k + 1] - YL[k]) * (f - k); };
  const l2y = l => { const f = (l < 0 ? 0 : l > 1 ? 1 : l) * NT, k = f | 0; return k >= NT ? LY[NT] : LY[k] + (LY[k + 1] - LY[k]) * (f - k); };
  // Luminancia (no la norma del color): así «sombra» y «luz» significan
  // lo mismo que en el modo normal y un cielo azul no cuenta como más claro.
  const Ns = new Float32Array(n), Ls = new Float32Array(n);
  for(let i = 0, j = 0; j < n; i += 4, j++){
    const Y = wr * toLin[data[i]] + wg * toLin[data[i + 1]] + wb * toLin[data[i + 2]];
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
      const wanted = N2 / N;
      // Aplicar un único factor y limitarlo antes del recorte conserva la
      // proporción RGB original. El mapeo OKLab sRGB anterior podía cambiar
      // el matiz de sombras saturadas, especialmente en documentos P3.
      const mx = Math.max(rr, gg, bb);
      const m = Math.min(wanted, mx > 0 ? 1 / mx : wanted);
      rr *= m; gg *= m; bb *= m;
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
