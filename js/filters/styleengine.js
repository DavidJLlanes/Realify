/* ═══════════════════════════════════════════════════════════════
   MOTOR DE ESTILOS POR CAPAS (v260)
   Evalúa una «receta»: una pila de capas como la que construye una acción de Photoshop (capas de ajuste, rellenos de color y de degradado, copias de la
   propia imagen con filtros, grupos con su opacidad y su modo de fusión…) sobre una imagen. Las recetas salen de convertir las acciones (.atn) con
   tools/atn/ y viven en assets/estilos/*.json; el motor no sabe nada de Photoshop, sólo de recetas.

   Es de funciones puras sobre matrices (sin DOM), para poder probarlo igual en Node y en el navegador.

   Cómo se calcula
     · Cada píxel recorre la pila de abajo arriba con un estado (r, g, b en 0-255 y alfa 0-1), en coma flotante: nada se redondea entre capa y capa.
     · Capas de ajuste: transforman el color de lo que hay debajo. Rellenos: color constante o degradado analítico (en función de la posición).
       Copias de la imagen («snap»): el color de lo que había debajo al crearlas, con sus filtros de color (desaturar, invertir, niveles…).
     · Lo ESPACIAL (desenfoques, ruido, transformar, alinear… sobre un relleno o un grupo fusionado) se genera una vez en un lienzo de baja resolución
       (como mucho GEN píxeles de lado: son luces suaves) y se muestrea con interpolación bilineal; la foto, en cambio, se procesa siempre a su
       resolución completa. Así un estilo con destellos cuesta lo mismo en una foto de 24 MP que en una de 2 MP.
     · Las medidas en píxeles de la receta (radio de desenfoque, desplazamiento…) se escalan con el lado mayor de la imagen respecto de `ref`.

   Hipótesis que no se pueden comprobar sin Photoshop (documentadas en README/CHANGELOG): orden canal → compuesto en Curvas y Niveles, y las fórmulas de
   Color selectivo, Equilibrio de color y Filtro de foto, que son aproximaciones de las de Adobe.
   ═══════════════════════════════════════════════════════════════ */

import { curveFunction } from "../editor/curves.js";

const GEN = 800;                     // lado máximo del lienzo donde se generan las capas espaciales (son luces suaves)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/* ── Modos de fusión (valores 0-1) ───────────────────────────── */
const Dsoft = x => x <= 0.25 ? ((16 * x - 12) * x + 4) * x : Math.sqrt(x);
const SEP = {
  multiply: (b, s) => b * s,
  screen: (b, s) => b + s - b * s,
  overlay: (b, s) => b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s),
  hardLight: (b, s) => s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s),
  softLight: (b, s) => s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (Dsoft(b) - b),
  colorDodge: (b, s) => b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)),
  colorBurn: (b, s) => b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s),
  darken: (b, s) => Math.min(b, s),
  lighten: (b, s) => Math.max(b, s),
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
  linearDodge: (b, s) => Math.min(1, b + s),
  linearBurn: (b, s) => Math.max(0, b + s - 1),
  vividLight: (b, s) => s <= 0.5 ? (s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / (2 * s))) : (s >= 1 ? 1 : Math.min(1, b / (2 * (1 - s)))),
  linearLight: (b, s) => clamp(b + 2 * s - 1, 0, 1),
  pinLight: (b, s) => s < 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1),
  hardMix: (b, s) => (s <= 0.5 ? (s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / (2 * s))) : (s >= 1 ? 1 : Math.min(1, b / (2 * (1 - s))))) < 0.5 ? 0 : 1,
  subtract: (b, s) => Math.max(0, b - s),
  divide: (b, s) => s <= 0 ? 1 : Math.min(1, b / s)
};
const Lm = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
function clipColor(c){
  const l = Lm(c[0], c[1], c[2]), n = Math.min(c[0], c[1], c[2]), x = Math.max(c[0], c[1], c[2]);
  if(n < 0) for(let i = 0; i < 3; i++) c[i] = l + (c[i] - l) * l / (l - n);
  if(x > 1) for(let i = 0; i < 3; i++) c[i] = l + (c[i] - l) * (1 - l) / (x - l);
}
function setLum(c, l){ const d = l - Lm(c[0], c[1], c[2]); c[0] += d; c[1] += d; c[2] += d; clipColor(c); }
const Sat = c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
function setSat(c, s){
  const idx = [0, 1, 2].sort((a, b) => c[a] - c[b]), mn = idx[0], md = idx[1], mx = idx[2];
  if(c[mx] > c[mn]){ c[md] = (c[md] - c[mn]) * s / (c[mx] - c[mn]); c[mx] = s; } else { c[md] = 0; c[mx] = 0; }
  c[mn] = 0;
}
const tmpA = [0, 0, 0], tmpB = [0, 0, 0];
/** Fusión de color 0-1: out ← mezcla(b, s) según el modo */
function blendColor(mode, b, s, out){
  const f = SEP[mode];
  if(f){ out[0] = f(b[0], s[0]); out[1] = f(b[1], s[1]); out[2] = f(b[2], s[2]); return; }
  switch(mode){
    case "hue": tmpA[0] = s[0]; tmpA[1] = s[1]; tmpA[2] = s[2]; setSat(tmpA, Sat(b)); setLum(tmpA, Lm(b[0], b[1], b[2])); break;
    case "saturation": tmpA[0] = b[0]; tmpA[1] = b[1]; tmpA[2] = b[2]; setSat(tmpA, Sat(s)); setLum(tmpA, Lm(b[0], b[1], b[2])); break;
    case "color": tmpA[0] = s[0]; tmpA[1] = s[1]; tmpA[2] = s[2]; setLum(tmpA, Lm(b[0], b[1], b[2])); break;
    case "luminosity": tmpA[0] = b[0]; tmpA[1] = b[1]; tmpA[2] = b[2]; setLum(tmpA, Lm(s[0], s[1], s[2])); break;
    case "darkerColor": { const o = Lm(b[0], b[1], b[2]) <= Lm(s[0], s[1], s[2]) ? b : s; out[0] = o[0]; out[1] = o[1]; out[2] = o[2]; return; }
    case "lighterColor": { const o = Lm(b[0], b[1], b[2]) >= Lm(s[0], s[1], s[2]) ? b : s; out[0] = o[0]; out[1] = o[1]; out[2] = o[2]; return; }
    default: out[0] = s[0]; out[1] = s[1]; out[2] = s[2]; return;      // normal, pass, dissolve
  }
  out[0] = tmpA[0]; out[1] = tmpA[1]; out[2] = tmpA[2];
}

/** Compone (cs, as) sobre el estado st = [r, g, b, a] (0-255, 0-1) con un modo de fusión y una opacidad (fórmula de composición del W3C) */
const _b = [0, 0, 0], _s = [0, 0, 0], _o = [0, 0, 0];
function composite(st, cr, cg, cb2, as, mode){
  if(as <= 0) return;
  const ab = st[3];
  let r = cr, g = cg, b = cb2;
  if(mode !== "normal" && mode !== "pass" && ab > 0){
    _b[0] = st[0] / 255; _b[1] = st[1] / 255; _b[2] = st[2] / 255; _s[0] = cr / 255; _s[1] = cg / 255; _s[2] = cb2 / 255;
    blendColor(mode, _b, _s, _o);
    r = ((1 - ab) * cr + ab * _o[0] * 255); g = ((1 - ab) * cg + ab * _o[1] * 255); b = ((1 - ab) * cb2 + ab * _o[2] * 255);
  }
  const ao = as + ab * (1 - as);
  if(ao <= 0) return;
  const k = as / ao;
  st[0] = st[0] * (1 - k) + r * k; st[1] = st[1] * (1 - k) + g * k; st[2] = st[2] * (1 - k) + b * k; st[3] = ao;
}

/* ── Ajustes (color de entrada 0-255 → salida en out[0..2]) ──── */
const curveTable = pts => {          // tabla de 256 + 1 entradas, interpolada linealmente para entradas decimales
  const f = curveFunction(pts), t = new Float32Array(257);
  for(let i = 0; i < 256; i++) t[i] = clamp255(f(i));
  t[256] = t[255]; return t;
};
const tget = (t, v) => { v = v < 0 ? 0 : v > 255 ? 255 : v; const i = v | 0, f = v - i; return t[i] + (t[i + 1] - t[i]) * f; };

function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if(d){ s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); if(h < 0) h += 360; }
  return [h, s, l];
}
function hslToRgb(h, s, l){
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const q = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(q[0] + m) * 255, (q[1] + m) * 255, (q[2] + m) * 255];
}
const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const toSrgb = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);

/** Color de un degradado (paradas [pos, [r,g,b], medio]) en t ∈ [0,1] */
function gradColor(stops, t, out){
  const n = stops.length;
  if(n === 0){ out[0] = out[1] = out[2] = 0; return; }
  if(t <= stops[0][0] || n === 1){ const c = stops[0][1]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return; }
  if(t >= stops[n - 1][0]){ const c = stops[n - 1][1]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return; }
  let i = 0; while(i < n - 2 && t > stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1], span = b[0] - a[0];
  let u = span > 0 ? (t - a[0]) / span : 0;
  const mid = a[2] ?? 0.5;
  if(mid > 0.001 && mid < 0.999 && Math.abs(mid - 0.5) > 1e-3) u = Math.pow(u, Math.log(0.5) / Math.log(mid));
  out[0] = a[1][0] + (b[1][0] - a[1][0]) * u; out[1] = a[1][1] + (b[1][1] - a[1][1]) * u; out[2] = a[1][2] + (b[1][2] - a[1][2]) * u;
}
function gradAlpha(al, t){
  const n = al.length;
  if(!n) return 1;
  if(t <= al[0][0]) return al[0][1];
  if(t >= al[n - 1][0]) return al[n - 1][1];
  let i = 0; while(i < n - 2 && t > al[i + 1][0]) i++;
  const a = al[i], b = al[i + 1], span = b[0] - a[0];
  return a[1] + (b[1] - a[1]) * (span > 0 ? (t - a[0]) / span : 0);
}

/** Para cada tipo de capa de ajuste, una función (r, g, b, out) → out[0..2] */
function makeAdjust(L){
  switch(L.t){
    case "Crvs": {
      const ch = L.ch || {}, tr = ch.r && curveTable(ch.r), tg = ch.g && curveTable(ch.g), tb = ch.b && curveTable(ch.b), tc = ch.c && curveTable(ch.c);
      return (r, g, b, o) => {
        if(tr) r = tget(tr, r); if(tg) g = tget(tg, g); if(tb) b = tget(tb, b);
        if(tc){ r = tget(tc, r); g = tget(tc, g); b = tget(tc, b); }
        o[0] = r; o[1] = g; o[2] = b;
      };
    }
    case "Lvls": {
      const fn = d => {
        if(!d) return null;
        const lo = d.in[0], hi = Math.max(lo + 1e-3, d.in[1]), gm = d.g || 1, oLo = d.out[0], oHi = d.out[1], ig = 1 / gm;
        return v => { const u = clamp((v - lo) / (hi - lo), 0, 1); return oLo + (oHi - oLo) * Math.pow(u, ig); };
      };
      const ch = L.ch || {}, fr = fn(ch.r), fg = fn(ch.g), fb = fn(ch.b), fc = fn(ch.c);
      return (r, g, b, o) => {
        if(fr) r = fr(r); if(fg) g = fg(g); if(fb) b = fb(b);
        if(fc){ r = fc(r); g = fc(g); b = fc(b); }
        o[0] = r; o[1] = g; o[2] = b;
      };
    }
    case "HStr": return makeHue(L);
    case "GdMp": {
      const stops = L.stops || [[0, [0, 0, 0], 0.5], [1, [255, 255, 255], 0.5]], rev = !!L.rev, c = [0, 0, 0];
      // 256 muestras: la luminancia (0-255) busca el color
      const lut = new Float32Array(256 * 3);
      for(let i = 0; i < 256; i++){ gradColor(stops, rev ? 1 - i / 255 : i / 255, c); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
      return (r, g, b, o) => {
        const y = clamp(lum(r, g, b), 0, 255), i = y | 0, f = y - i, j = Math.min(255, i + 1);
        o[0] = lut[i * 3] + (lut[j * 3] - lut[i * 3]) * f; o[1] = lut[i * 3 + 1] + (lut[j * 3 + 1] - lut[i * 3 + 1]) * f; o[2] = lut[i * 3 + 2] + (lut[j * 3 + 2] - lut[i * 3 + 2]) * f;
      };
    }
    case "photoFilter": {
      const col = L.rgb || [236, 138, 0], d = clamp((L.d ?? 25) / 100, 0, 1), pl = L.pl !== 0;
      return (r, g, b, o) => {
        const y0 = lum(r, g, b);
        let nr = r * (1 - d) + r * col[0] / 255 * d, ng = g * (1 - d) + g * col[1] / 255 * d, nb = b * (1 - d) + b * col[2] / 255 * d;
        if(pl){ const y1 = lum(nr, ng, nb); if(y1 > 1e-3){ const k = y0 / y1; nr *= k; ng *= k; nb *= k; } }
        o[0] = nr; o[1] = ng; o[2] = nb;
      };
    }
    case "BrgC": {
      const B = (L.b || 0) / 100, C = (L.c || 0) / 100;
      // brillo: curva que empuja los medios sin tocar los extremos; contraste: pendiente alrededor del gris medio
      const k = C >= 0 ? 1 / (1 - Math.min(0.99, C) * 0.9) : 1 + C * 0.9;
      const f = v => { let u = v / 255; u = (u - 0.5) * k + 0.5; u = u + B * 0.5 * 4 * u * (1 - u); return clamp255(u * 255); };
      return (r, g, b, o) => { o[0] = f(r); o[1] = f(g); o[2] = f(b); };
    }
    case "ClrB": return makeColorBalance(L);
    case "SlcC": return makeSelective(L);
    case "Exps": {
      const e = Math.pow(2, L.e || 0), off = L.o || 0, gm = L.g || 1, ig = 1 / (gm || 1);
      const f = v => toSrgb(Math.pow(Math.max(0, toLin(v) * e + off), ig));
      const lut = new Float32Array(257); for(let i = 0; i < 256; i++) lut[i] = clamp255(f(i)); lut[256] = lut[255];
      return (r, g, b, o) => { o[0] = tget(lut, r); o[1] = tget(lut, g); o[2] = tget(lut, b); };
    }
    case "vibrance": {
      const v = (L.v || 0) / 100, s = (L.s || 0) / 100;
      return (r, g, b, o) => {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), y = lum(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
        // la viveza actúa más en los colores poco saturados y respeta los muy saturados
        let k = 1 + s + (v >= 0 ? v * (1 - sat) : v * sat);
        if(k < 0) k = 0;
        o[0] = clamp255(y + (r - y) * k); o[1] = clamp255(y + (g - y) * k); o[2] = clamp255(y + (b - y) * k);
      };
    }
    case "BanW": {
      const w = (L.bw || [40, 60, 40, 60, 20, 80]).map(v => v / 100);   // rojos, amarillos, verdes, cianes, azules, magentas
      return (r, g, b, o) => {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        let y;
        if(mx === mn) y = mn;
        else {
          let h;
          if(mx === r) h = ((g - b) / (mx - mn) + 6) % 6; else if(mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
          const i = Math.floor(h) % 6, f = h - Math.floor(h), wh = w[i] + (w[(i + 1) % 6] - w[i]) * f;
          y = mn + (mx - mn) * wh;
        }
        o[0] = o[1] = o[2] = clamp255(y);
      };
    }
    case "Invr": return (r, g, b, o) => { o[0] = 255 - r; o[1] = 255 - g; o[2] = 255 - b; };
    default: return null;
  }
}

/** Tono / Saturación / Luminosidad: maestro y rangos con trapecio (inicio del rango, inicio pleno, fin pleno, fin del rango) */
function makeHue(L){
  const ms = L.m || [0, 0, 0], rg = L.rg || [], colorize = !!L.colorize;
  const mod = x => ((x % 360) + 360) % 360;
  const wgt = (h, R) => {
    const [b0, bs, es, e] = R.r, u = mod(h - b0), total = mod(e - b0) || 360, rise = mod(bs - b0), plat = mod(es - b0);
    if(u > total) return 0;
    if(u < rise) return rise > 0 ? u / rise : 1;
    if(u <= plat) return 1;
    return total > plat ? (total - u) / (total - plat) : 0;
  };
  return (r, g, b, o) => {
    let [h, s, l] = rgbToHsl(r, g, b);
    if(colorize){
      h = ms[0] < 0 ? ms[0] + 360 : ms[0]; s = clamp((ms[1] + 100) / 200, 0, 1);
      l = ms[2] >= 0 ? l + (1 - l) * ms[2] / 100 : l * (1 + ms[2] / 100);
      const c = hslToRgb(h, s, l); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return;
    }
    let H = ms[0], S = ms[1], Lg = ms[2];
    // el peso por saturación es continuo: los grises no pertenecen a ningún rango, sin escalones
    for(const R of rg){ const w = wgt(h, R) * Math.min(1, s * 8); if(w > 0){ H += R.h * w; S += R.s * w; Lg += R.l * w; } }
    if(!H && !S && !Lg){ o[0] = r; o[1] = g; o[2] = b; return; }
    h += H;
    s = S >= 0 ? clamp(s * (1 + S / 100), 0, 1) : s * (1 + S / 100);
    l = Lg >= 0 ? l + (1 - l) * Lg / 100 : l * (1 + Lg / 100);
    const c = hslToRgb(h, s, l); o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
  };
}

/** Equilibrio de color (sombras, medios, luces; cian-rojo, magenta-verde, amarillo-azul; conservar luminosidad) */
function makeColorBalance(L){
  const S = L.s || [0, 0, 0], M = L.m || [0, 0, 0], H = L.h || [0, 0, 0], pl = L.pl !== 0;
  const a = 0.25, bb = 0.333, scale = 0.35;           // calibrado a ojo: el ±100 de Adobe es bastante más suave que el de GIMP (0,7)
  return (r, g, b, o) => {
    const l = lum(r, g, b) / 255;
    const ws = clamp((l - bb) / -a + 0.5, 0, 1) * scale;
    const wm = clamp((l - bb) / a + 0.5, 0, 1) * clamp((l + bb - 1) / -a + 0.5, 0, 1) * scale;
    const wh = clamp((l + bb - 1) / a + 0.5, 0, 1) * scale;
    let nr = r + 255 * (S[0] * ws + M[0] * wm + H[0] * wh) / 100;
    let ng = g + 255 * (S[1] * ws + M[1] * wm + H[1] * wh) / 100;
    let nb = b + 255 * (S[2] * ws + M[2] * wm + H[2] * wh) / 100;
    nr = clamp255(nr); ng = clamp255(ng); nb = clamp255(nb);
    if(pl){ const y1 = lum(nr, ng, nb); if(y1 > 1e-3){ const k = lum(r, g, b) / y1; nr = clamp255(nr * k); ng = clamp255(ng * k); nb = clamp255(nb * k); } }
    o[0] = nr; o[1] = ng; o[2] = nb;
  };
}

/** Color selectivo: por cada rango de color, cuánto cian, magenta, amarillo y negro se suma (relativo o absoluto) */
function makeSelective(L){
  const C = L.c || {}, abs = !!L.abs;
  const names = ["red", "yellow", "green", "cyan", "blue", "magenta"], hue0 = [0, 60, 120, 180, 240, 300];
  const get = k => C[k] ? C[k].map(v => v / 100) : null;
  const hueAdj = names.map(get), whAdj = get("white"), neAdj = get("neutral"), blAdj = get("black");
  return (r, g, b, o) => {
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, chroma = mx - mn;
    const l = (mx + mn) / 2;
    let c = 1 - r / 255, m = 1 - g / 255, y = 1 - b / 255, k = 0;
    const acc = [0, 0, 0, 0];
    const add = (adj, w) => { if(!adj || w <= 0) return; for(let i = 0; i < 4; i++) acc[i] += adj[i] * w; };
    if(chroma > 0){
      const h = rgbToHsl(r, g, b)[0];
      for(let i = 0; i < 6; i++){
        const d = Math.min(Math.abs(h - hue0[i]), 360 - Math.abs(h - hue0[i]));
        add(hueAdj[i], Math.max(0, 1 - d / 60) * chroma);
      }
    }
    add(whAdj, Math.max(0, (l - 0.5) * 2) * (1 - chroma));
    add(blAdj, Math.max(0, (0.5 - l) * 2) * (1 - chroma));
    add(neAdj, (1 - chroma) * (1 - Math.abs(2 * l - 1)));
    if(!acc[0] && !acc[1] && !acc[2] && !acc[3]){ o[0] = r; o[1] = g; o[2] = b; return; }
    // En «relativo» el cambio es proporcional a la cantidad de tinta que ya hay; en «absoluto», directo
    const dc = abs ? acc[0] : acc[0] * c, dm = abs ? acc[1] : acc[1] * m, dy = abs ? acc[2] : acc[2] * y, dk = abs ? acc[3] : acc[3] * (1 - l);
    c = clamp(c + dc, 0, 1); m = clamp(m + dm, 0, 1); y = clamp(y + dy, 0, 1);
    const kk = clamp(-dk, -1, 1);          // más negro = más oscuro
    o[0] = clamp255((1 - c) * 255 * (1 + kk * (kk < 0 ? 1 : 0)) + (kk > 0 ? -0 : 0));
    o[1] = clamp255((1 - m) * 255 * (1 + kk * (kk < 0 ? 1 : 0)));
    o[2] = clamp255((1 - y) * 255 * (1 + kk * (kk < 0 ? 1 : 0)));
    if(dk > 0){ const f = 1 - dk; o[0] *= f; o[1] *= f; o[2] *= f; }
    else if(dk < 0){ const f = -dk; o[0] += (255 - o[0]) * f * 0.5; o[1] += (255 - o[1]) * f * 0.5; o[2] += (255 - o[2]) * f * 0.5; }
  };
}

/* ── Filtros sobre lienzos RGBA flotantes (lienzo de baja resolución) ──────── */
function boxSizes(sigma, n = 3){
  const wIdeal = Math.sqrt(12 * sigma * sigma / n + 1);
  let wl = Math.floor(wIdeal); if(wl % 2 === 0) wl--;
  const wu = wl + 2, mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4), m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}
function boxBlurH(src, dst, w, h, r, ch){
  const k = 1 / (2 * r + 1);
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let c = 0; c < ch; c++){
      let acc = src[(row) * ch + c] * (r + 1);
      for(let x = 0; x < r; x++) acc += src[(row + Math.min(w - 1, x)) * ch + c];
      for(let x = 0; x < w; x++){
        acc += src[(row + Math.min(w - 1, x + r)) * ch + c] - src[(row + Math.max(0, x - r - 1)) * ch + c];
        dst[(row + x) * ch + c] = acc * k;
      }
    }
  }
}
function boxBlurV(src, dst, w, h, r, ch){
  const k = 1 / (2 * r + 1);
  for(let x = 0; x < w; x++){
    for(let c = 0; c < ch; c++){
      let acc = src[x * ch + c] * (r + 1);
      for(let y = 0; y < r; y++) acc += src[(Math.min(h - 1, y) * w + x) * ch + c];
      for(let y = 0; y < h; y++){
        acc += src[(Math.min(h - 1, y + r) * w + x) * ch + c] - src[(Math.max(0, y - r - 1) * w + x) * ch + c];
        dst[(y * w + x) * ch + c] = acc * k;
      }
    }
  }
}
/** Desenfoque gaussiano (sigma en píxeles del lienzo) de un buffer de `ch` canales */
function gaussian(buf, w, h, sigma, ch){
  if(sigma < 0.3) return buf;
  let a = buf, b = new Float32Array(buf.length);
  for(const bs of boxSizes(sigma)){
    const r = (bs - 1) >> 1;
    boxBlurH(a, b, w, h, r, ch); const t = a === buf ? new Float32Array(buf.length) : a; boxBlurV(b, t, w, h, r, ch); a = t;
  }
  return a;
}
const premul = (px, n) => { const o = new Float32Array(n * 4); for(let i = 0; i < n; i++){ const a = px[i * 4 + 3]; o[i * 4] = px[i * 4] * a; o[i * 4 + 1] = px[i * 4 + 1] * a; o[i * 4 + 2] = px[i * 4 + 2] * a; o[i * 4 + 3] = a; } return o; };
const unpremul = (px, n) => { for(let i = 0; i < n; i++){ const a = px[i * 4 + 3]; if(a > 1e-5){ px[i * 4] /= a; px[i * 4 + 1] /= a; px[i * 4 + 2] /= a; } } return px; };

function blurRGBA(px, w, h, sigma){
  const p = premul(px, w * h), o = gaussian(p, w, h, sigma, 4);
  return unpremul(o === p ? p : o, w * h);
}
function motionBlurPremul(p, w, h, angle, dist){
  const o = new Float32Array(w * h * 4), a = angle * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a), steps = Math.max(1, Math.min(Math.round(dist) + 1, 41));
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    let r = 0, g = 0, b = 0, al = 0;
    for(let s = 0; s < steps; s++){
      const t = (s / (steps - 1 || 1) - 0.5) * dist, sx = x + dx * t, sy = y + dy * t;
      const ix = sx < 0 ? 0 : sx > w - 1 ? w - 1 : (sx + 0.5) | 0, iy = sy < 0 ? 0 : sy > h - 1 ? h - 1 : (sy + 0.5) | 0, q = (iy * w + ix) * 4;
      r += p[q]; g += p[q + 1]; b += p[q + 2]; al += p[q + 3];
    }
    const i = (y * w + x) * 4; o[i] = r / steps; o[i + 1] = g / steps; o[i + 2] = b / steps; o[i + 3] = al / steps;
  }
  return o;
}
/** Reduce un buffer premultiplicado por un factor entero (promedio de cada bloque) */
function downsample(p, w, h, f){
  const w2 = Math.max(1, Math.floor(w / f)), h2 = Math.max(1, Math.floor(h / f)), o = new Float32Array(w2 * h2 * 4);
  for(let y = 0; y < h2; y++) for(let x = 0; x < w2; x++){
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for(let yy = y * f; yy < Math.min(h, (y + 1) * f); yy++) for(let xx = x * f; xx < Math.min(w, (x + 1) * f); xx++){ const q = (yy * w + xx) * 4; r += p[q]; g += p[q + 1]; b += p[q + 2]; a += p[q + 3]; n++; }
    const i = (y * w2 + x) * 4; o[i] = r / n; o[i + 1] = g / n; o[i + 2] = b / n; o[i + 3] = a / n;
  }
  return { p: o, w: w2, h: h2 };
}
/** Amplía (interpolación bilineal) un buffer premultiplicado a w × h */
function upsample(p, w2, h2, w, h){
  const o = new Float32Array(w * h * 4);
  for(let y = 0; y < h; y++){
    const fy = clamp((y + 0.5) * h2 / h - 0.5, 0, h2 - 1), y0 = fy | 0, y1 = Math.min(h2 - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < w; x++){
      const fx = clamp((x + 0.5) * w2 / w - 0.5, 0, w2 - 1), x0 = fx | 0, x1 = Math.min(w2 - 1, x0 + 1), tx = fx - x0;
      const a = (y0 * w2 + x0) * 4, b = (y0 * w2 + x1) * 4, c = (y1 * w2 + x0) * 4, d = (y1 * w2 + x1) * 4, i = (y * w + x) * 4;
      for(let k = 0; k < 4; k++) o[i + k] = (p[a + k] * (1 - tx) + p[b + k] * tx) * (1 - ty) + (p[c + k] * (1 - tx) + p[d + k] * tx) * ty;
    }
  }
  return o;
}
function motionBlur(px, w, h, angle, dist){
  const n = w * h; let p = premul(px, n);
  // con distancias grandes se desenfoca una copia reducida (la imagen que sale es igual de suave y cuesta una fracción)
  let f = 1; while(dist / f > 20 && f < 16) f *= 2;
  if(f > 1){
    const d = downsample(p, w, h, f), b = motionBlurPremul(d.p, d.w, d.h, angle, dist / f);
    p = upsample(b, d.w, d.h, w, h);
  } else p = motionBlurPremul(p, w, h, angle, dist);
  return unpremul(p, n);
}
function radialBlur(px, w, h, amount, mode){
  const n = w * h, p = premul(px, n), o = new Float32Array(n * 4), cx = w / 2, cy = h / 2, steps = Math.max(4, Math.min(24, Math.round(amount * 0.8 + 4)));
  const ang = amount / 100 * Math.PI / 3, zoom = amount / 100 * 0.5;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    let r = 0, g = 0, b = 0, al = 0; const dx = x - cx, dy = y - cy;
    for(let s = 0; s < steps; s++){
      const t = s / (steps - 1) - 0.5; let sx, sy;
      if(mode === "spin"){ const c = Math.cos(t * ang), sn = Math.sin(t * ang); sx = cx + dx * c - dy * sn; sy = cy + dx * sn + dy * c; }
      else { const k = 1 + t * zoom; sx = cx + dx * k; sy = cy + dy * k; }
      const ix = clamp(Math.round(sx), 0, w - 1), iy = clamp(Math.round(sy), 0, h - 1), q = (iy * w + ix) * 4;
      r += p[q]; g += p[q + 1]; b += p[q + 2]; al += p[q + 3];
    }
    const i = (y * w + x) * 4; o[i] = r / steps; o[i + 1] = g / steps; o[i + 2] = b / steps; o[i + 3] = al / steps;
  }
  return unpremul(o, n);
}
const hash2 = (x, y, s) => { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function addNoise(px, w, h, op){
  const amp = op.n / 100 * 255 * 1.2;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const i = (y * w + x) * 4; if(px[i + 3] <= 0) continue;
    const u = hash2(x, y, op.seed || 1);
    const gv = (v) => op.gauss ? (v + hash2(x, y, (op.seed || 1) + 7) + hash2(x, y, (op.seed || 1) + 13) - 1.5) * 0.9 * 2 : (v - 0.5) * 2;
    if(op.mono){ const d = gv(u) * amp; px[i] = clamp255(px[i] + d); px[i + 1] = clamp255(px[i + 1] + d); px[i + 2] = clamp255(px[i + 2] + d); }
    else { px[i] = clamp255(px[i] + gv(hash2(x, y, (op.seed || 1) + 1)) * amp); px[i + 1] = clamp255(px[i + 1] + gv(hash2(x, y, (op.seed || 1) + 2)) * amp); px[i + 2] = clamp255(px[i + 2] + gv(hash2(x, y, (op.seed || 1) + 3)) * amp); }
  }
  return px;
}
/** Caja de lo que no es transparente (alfa > 0.01) */
function bounds(px, w, h){
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(px[(y * w + x) * 4 + 3] > 0.01){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
/** Transformación afín (escala y giro alrededor del centro de la caja de la capa, y desplazamiento); lo de fuera queda transparente */
function transform(px, w, h, op, k){
  const bb = bounds(px, w, h) || { x0: 0, y0: 0, x1: w, y1: h };
  const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, sx = op.sx ?? 1, sy = op.sy ?? op.sx ?? 1, tx = (op.tx || 0) * k, ty = (op.ty || 0) * k;
  const rot = -(op.rot || 0) * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
  const out = new Float32Array(px.length), P = premul(px, w * h);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    // inversa: destino → origen
    const dx = x + 0.5 - cx - tx, dy = y + 0.5 - cy - ty;
    const ux = (dx * cr + dy * sr) / sx + cx - 0.5, uy = (-dx * sr + dy * cr) / sy + cy - 0.5;
    if(ux < -0.5 || uy < -0.5 || ux > w - 0.5 || uy > h - 0.5) continue;
    const x0 = Math.floor(ux), y0 = Math.floor(uy), fx = ux - x0, fy = uy - y0, i = (y * w + x) * 4;
    const in00 = x0 >= 0 && y0 >= 0 && x0 < w && y0 < h, in10 = x0 + 1 >= 0 && y0 >= 0 && x0 + 1 < w && y0 < h, in01 = x0 >= 0 && y0 + 1 >= 0 && x0 < w && y0 + 1 < h, in11 = x0 + 1 >= 0 && y0 + 1 >= 0 && x0 + 1 < w && y0 + 1 < h;
    const q00 = (y0 * w + x0) * 4, q10 = q00 + 4, q01 = q00 + w * 4, q11 = q01 + 4, w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    for(let c = 0; c < 4; c++) out[i + c] = (in00 ? P[q00 + c] * w00 : 0) + (in10 ? P[q10 + c] * w10 : 0) + (in01 ? P[q01 + c] * w01 : 0) + (in11 ? P[q11 + c] * w11 : 0);
  }
  return unpremul(out, w * h);
}
function alignLayer(px, w, h, to){
  const bb = bounds(px, w, h); if(!bb) return px;
  let tx = 0, ty = 0;
  if(to === "top") ty = -bb.y0; else if(to === "bottom") ty = h - bb.y1; else if(to === "left") tx = -bb.x0; else if(to === "right") tx = w - bb.x1;
  else if(to === "vcenter") ty = (h - (bb.y1 - bb.y0)) / 2 - bb.y0; else if(to === "hcenter") tx = (w - (bb.x1 - bb.x0)) / 2 - bb.x0;
  return transform(px, w, h, { tx, ty, sx: 1, sy: 1 }, 1);
}
const POINTWISE_OPS = new Set(["desat", "inv", "lvl", "hue"]);
const isPointwiseOps = ops => !ops || ops.every(o => POINTWISE_OPS.has(o.op));

/** Un filtro de color sobre (r, g, b) (afecta sólo al color, no al alfa) */
function colorOp(op){
  switch(op.op){
    case "desat": return (c) => { const v = (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 2; c[0] = c[1] = c[2] = v; };
    case "inv": return (c) => { c[0] = 255 - c[0]; c[1] = 255 - c[1]; c[2] = 255 - c[2]; };
    case "lvl": { const f = makeAdjust({ t: "Lvls", ch: op.ch }), t = [0, 0, 0]; return (c) => { f(c[0], c[1], c[2], t); c[0] = t[0]; c[1] = t[1]; c[2] = t[2]; }; }
    case "hue": { const f = makeHue(op), t = [0, 0, 0]; return (c) => { f(c[0], c[1], c[2], t); c[0] = t[0]; c[1] = t[1]; c[2] = t[2]; }; }
  }
  return null;
}

/* ═══ El plan: la receta ya preparada para evaluarse ═══ */
export const GRAD_TYPES = ["lin", "rad", "ang", "ref", "dia"];

/** Posición t ∈ [0,1] de un píxel (x, y) en un relleno de degradado de un lienzo w × h */
function gradPositioner(L, w, h){
  const ang = (L.angle ?? 90) * Math.PI / 180, dx = Math.cos(ang), dy = -Math.sin(ang), sc = (L.scale ?? 100) / 100;
  const off = L.off || [0, 0], cx = w / 2 + off[0] / 100 * w, cy = h / 2 + off[1] / 100 * h, type = L.type || "lin", rev = !!L.rev;
  const ext = Math.abs(w * dx) + Math.abs(h * dy), len = Math.max(1e-6, ext * sc), R = Math.max(1e-6, Math.hypot(w, h) / 2 * sc);
  return (x, y) => {
    const px = x + 0.5 - cx, py = y + 0.5 - cy;
    let t;
    switch(type){
      case "rad": t = Math.hypot(px, py) / R; break;
      case "ang": t = (Math.atan2(dy, dx) - Math.atan2(py, px)) / (2 * Math.PI); t = ((t % 1) + 1) % 1; break;
      case "ref": t = Math.abs((px * dx + py * dy) / len * 2); break;
      case "dia": { const u = px * dx + py * dy, v = -px * dy + py * dx; t = (Math.abs(u) + Math.abs(v)) / R; break; }
      default: t = (px * dx + py * dy) / len + 0.5;
    }
    t = clamp(t, 0, 1);
    return rev ? 1 - t : t;
  };
}

/**
 * Prepara las capas de una receta. Devuelve un árbol de nodos con `eval(st, x, y, ctx)`.
 * `W, H`: tamaño del lienzo donde se va a evaluar (la imagen o el lienzo reducido de una capa generada); `k`: píxeles de la receta → píxeles del lienzo.
 */
function buildNodes(layers, W, H, k, ctx){
  const nodes = [];
  for(const L of layers){
    const n = buildNode(L, W, H, k, ctx);
    if(n) nodes.push(n);
  }
  return nodes;
}

function layerMeta(L){
  return { bm: L.bm || "normal", op: (L.op ?? 1) * (L.fo ?? 1), hid: !!L.hid, kind: L.k };
}

/* ── Texturas (imágenes de destellos y bokeh) ──────────────────────────────────
   Una capa {k:"tex", src, bm:"screen"} mezcla una imagen sobre la foto. Las imágenes las decodifica quien llama (looks.js) y las registra aquí con
   registerTexture(src, w, h, RGBA); la miniatura (misma ruta + "#t") se usa si la grande aún no está. Se ajusta al documento: se gira si el formato
   es el contrario, se estira si la proporción difiere menos de 1,5× (los destellos de borde no se pierden) y, si no, se recorta centrada. Para
   reducir sin dentado se usa la copia a mitad de tamaño más cercana (pirámide). */
const TEX = new Map(); let texVersion = 0;
export function registerTexture(src, w, h, data, thumb = false){ TEX.set(thumb ? src + "#t" : src, { w, h, data, mips: null }); texVersion++; }
export const hasTexture = (src, thumb = false) => TEX.has(thumb ? src + "#t" : src);
export function recipeTextures(recipe){ const out = []; const walk = ls => (ls || []).forEach(L => { if(L.k === "tex") out.push(L.src); if(L.kids) walk(L.kids); }); walk(recipe && recipe.layers); return out; }
function texMip(t, n){
  if(!t.mips) t.mips = [{ w: t.w, h: t.h, data: t.data }];
  while(t.mips.length <= n){
    const s = t.mips[t.mips.length - 1], w = Math.max(1, s.w >> 1), h = Math.max(1, s.h >> 1), d = new Uint8ClampedArray(w * h * 4);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const x0 = Math.min(s.w - 1, x * 2), x1 = Math.min(s.w - 1, x0 + 1), y0 = Math.min(s.h - 1, y * 2), y1 = Math.min(s.h - 1, y0 + 1), o = (y * w + x) * 4;
      for(let c = 0; c < 4; c++) d[o + c] = (s.data[(y0 * s.w + x0) * 4 + c] + s.data[(y0 * s.w + x1) * 4 + c] + s.data[(y1 * s.w + x0) * 4 + c] + s.data[(y1 * s.w + x1) * 4 + c] + 2) >> 2;
    }
    t.mips.push({ w, h, data: d });
  }
  return t.mips[n];
}
function texSampler(t, W, H){
  const tr = (W >= H) !== (t.w >= t.h) && Math.abs(W / H - 1) > 0.05, ew = tr ? t.h : t.w, eh = tr ? t.w : t.h, r = (W / H) / (ew / eh);
  let sx, sy;                                           // doc px → px de la textura efectiva
  if(r >= 1 / 1.5 && r <= 1.5){ sx = ew / W; sy = eh / H; }
  else { const s = Math.min(ew / W, eh / H); sx = sy = s; }
  const ox = (ew - W * sx) / 2, oy = (eh - H * sy) / 2;
  const n = Math.max(0, Math.floor(Math.log2(Math.max(1, Math.min(sx, sy))))), f = 2 ** n, m = texMip(t, n), out = [0, 0, 0];
  return (x, y) => {
    const ex = ((x + 0.5) * sx + ox) / f - 0.5, ey = ((y + 0.5) * sy + oy) / f - 0.5;
    let u, v;
    if(tr){ u = ey; v = m.h - 1 - ex; } else { u = ex; v = ey; }   // giro de 90° en sentido horario
    u = clamp(u, 0, m.w - 1); v = clamp(v, 0, m.h - 1);
    const x0 = u | 0, y0 = v | 0, x1 = Math.min(m.w - 1, x0 + 1), y1 = Math.min(m.h - 1, y0 + 1), tx = u - x0, ty = v - y0, d = m.data;
    const a = (y0 * m.w + x0) * 4, b = (y0 * m.w + x1) * 4, c = (y1 * m.w + x0) * 4, e = (y1 * m.w + x1) * 4;
    for(let i = 0; i < 3; i++) out[i] = (d[a + i] * (1 - tx) + d[b + i] * tx) * (1 - ty) + (d[c + i] * (1 - tx) + d[e + i] * tx) * ty;
    return out;
  };
}

function buildNode(L, W, H, k, ctx){
  const meta = layerMeta(L);
  if(L.k === "adj"){
    const f = makeAdjust(L);
    if(!f) { ctx.skipped.add("ajuste " + L.t); return null; }
    const o = [0, 0, 0];
    const bm = meta.bm, op = meta.op, cb = [0, 0, 0], cs = [0, 0, 0], co = [0, 0, 0];
    return { ...meta, run(st){
      if(st[3] <= 0 || op <= 0) return;
      f(st[0], st[1], st[2], o);
      let r = o[0], g = o[1], b2 = o[2];
      if(bm !== "normal" && bm !== "pass"){
        cb[0] = st[0] / 255; cb[1] = st[1] / 255; cb[2] = st[2] / 255; cs[0] = r / 255; cs[1] = g / 255; cs[2] = b2 / 255;
        blendColor(bm, cb, cs, co); r = co[0] * 255; g = co[1] * 255; b2 = co[2] * 255;
      }
      st[0] += (r - st[0]) * op; st[1] += (g - st[1]) * op; st[2] += (b2 - st[2]) * op;      // el alfa del fondo no cambia
    } };
  }
  if(L.k === "solid" || L.k === "grad" || L.k === "pix" || L.k === "snap" || L.k === "group"){
    return contentNode(L, meta, W, H, k, ctx);
  }
  if(L.k === "tex"){
    const t = TEX.get(L.src) || TEX.get(L.src + "#t");
    if(!t){ ctx.skipped.add("textura sin cargar " + L.src); return null; }
    const sample = texSampler(t, W, H), bm = meta.bm, op = meta.op;
    return { ...meta, run(st, x, y){ if(op <= 0) return; const c = sample(x, y); composite(st, c[0], c[1], c[2], op, bm); } };
  }
  ctx.skipped.add("capa " + L.k);
  return null;
}

/** Un nodo de contenido (relleno, copia, grupo fusionado). Sin filtros espaciales se evalúa por píxel; con ellos, se genera en un lienzo reducido. */
function contentNode(L, meta, W, H, k, ctx){
  const ops = L.ops || [];
  // un grupo que se compone como un todo (destellos, copias fusionadas…) no depende del color de la foto: se genera UNA vez en el lienzo reducido
  const spatial = !isPointwiseOps(ops) || L.k === "group";
  // Grupo que se compone como un todo (con modo propio, fusionado o con filtros) frente a «paso a través»
  if(L.k === "group"){
    const passThrough = (L.bm || "pass") === "pass" && !L.iso && !ops.length;
    if(passThrough){
      const kids = buildNodes(L.kids || [], W, H, k, ctx);
      const op = L.op ?? 1;
      return { ...meta, kids, pass: true, op, run(st, x, y, c){
        if(op >= 0.9999){ runNodes(kids, st, x, y, c); return; }
        const r0 = st[0], g0 = st[1], b0 = st[2], a0 = st[3];
        runNodes(kids, st, x, y, c);
        st[0] = r0 + (st[0] - r0) * op; st[1] = g0 + (st[1] - g0) * op; st[2] = b0 + (st[2] - b0) * op; st[3] = a0 + (st[3] - a0) * op;
      } };
    }
  }
  if(L.k === "snap" && !spatial){
    const cops = ops.map(colorOp).filter(Boolean), c = [0, 0, 0], id = L.id, src = L.src;
    return { ...meta, snap: id, run(st, x, y, cx2){
      let r, g, b;
      if(src === "base"){ r = cx2.base[0]; g = cx2.base[1]; b = cx2.base[2]; }
      else if(src === "ref" && cx2.snaps.has(id)){ const s = cx2.snaps.get(id); r = s[0]; g = s[1]; b = s[2]; }
      else { r = st[0]; g = st[1]; b = st[2]; if(src === "stack") cx2.snaps.set(id, [r, g, b]); }
      c[0] = r; c[1] = g; c[2] = b;
      for(const f of cops) f(c);
      composite(st, c[0], c[1], c[2], meta.op, meta.bm);
    } };
  }
  if(L.k === "snap" && spatial){
    // copia de la imagen con filtros espaciales (desenfoque…): se calcula en un lienzo reducido con lo que hay debajo
    const id = L.id, src = L.src, node = { ...meta, snapSpatial: true, id, layer: L, buf: null, w: 0, h: 0 };
    node.run = (st, x, y, cx2) => {
      if(!node.buf) return;
      const c = sampleBuf(node.buf, node.w, node.h, (x + 0.5) / W * node.w - 0.5, (y + 0.5) / H * node.h - 0.5);
      composite(st, c[0], c[1], c[2], meta.op * c[3], meta.bm);
    };
    node.prepare = (stack) => { node.buf = renderSnapBuffer(L, stack, node, W, H, k, ctx); };
    ctx.spatialSnaps.push(node);
    return node;
  }
  // Rellenos y grupos aislados: contenido propio (color + alfa)
  const sample = makeContent(L, W, H, k, ctx, spatial);
  return { ...meta, run(st, x, y, cx2){
    const c = sample(x, y, cx2);
    if(c[3] <= 0) return;
    composite(st, c[0], c[1], c[2], meta.op * c[3], meta.bm);
  } };
}

const outC = [0, 0, 0, 1];
function sampleBuf(buf, w, h, fx, fy){
  fx = clamp(fx, 0, w - 1); fy = clamp(fy, 0, h - 1);
  const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4;
  const al = (buf[a + 3] * (1 - tx) + buf[b + 3] * tx) * (1 - ty) + (buf[c + 3] * (1 - tx) + buf[d + 3] * tx) * ty;
  for(let i = 0; i < 3; i++){
    // interpolación con peso del alfa para que los bordes no se tiñan
    const wa = buf[a + 3] * (1 - tx) * (1 - ty), wb = buf[b + 3] * tx * (1 - ty), wc = buf[c + 3] * (1 - tx) * ty, wd = buf[d + 3] * tx * ty, ws = wa + wb + wc + wd;
    outC[i] = ws > 1e-6 ? (buf[a + i] * wa + buf[b + i] * wb + buf[c + i] * wc + buf[d + i] * wd) / ws : 0;
  }
  outC[3] = al; return outC;
}

/** Función (x, y) → [r, g, b, a] del contenido propio de una capa (relleno o grupo aislado), en un lienzo W × H */
function makeContent(L, W, H, k, ctx, spatial){
  const ops = L.ops || [];
  // Contenido analítico por píxel
  let analytic = null;
  if(L.k === "solid"){ const rgb = L.rgb || [0, 0, 0], out = [rgb[0], rgb[1], rgb[2], 1]; analytic = () => out; }
  else if(L.k === "grad"){
    const pos = gradPositioner(L, W, H), stops = L.stops || [], al = L.alpha || null, c = [0, 0, 0], out = [0, 0, 0, 1];
    analytic = (x, y) => { const t = pos(x, y); gradColor(stops, t, c); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = al ? gradAlpha(al, t) : 1; return out; };
  } else if(L.k === "pix"){ analytic = () => [0, 0, 0, 0]; }
  else if(L.k === "group"){
    // grupo aislado: sus hijos sobre transparente
    const kids = buildNodes(L.kids || [], W, H, k, ctx), st = [0, 0, 0, 0], out = [0, 0, 0, 0];
    analytic = (x, y, cx2) => {
      st[0] = st[1] = st[2] = st[3] = 0;
      runNodes(kids, st, x, y, cx2 || ctx.cur);
      out[0] = st[0]; out[1] = st[1]; out[2] = st[2]; out[3] = st[3]; return out;
    };
  }
  if(!analytic) return () => [0, 0, 0, 0];
  if(!spatial){
    const cops = ops.map(colorOp).filter(Boolean);
    if(!cops.length) return analytic;
    const c = [0, 0, 0], out = [0, 0, 0, 1];
    return (x, y) => { const s = analytic(x, y); c[0] = s[0]; c[1] = s[1]; c[2] = s[2]; for(const f of cops) f(c); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = s[3]; return out; };
  }
  // Contenido espacial: se genera una vez en un lienzo reducido y se muestrea
  const g = Math.min(1, GEN / Math.max(W, H)), gw = Math.max(1, Math.round(W * g)), gh = Math.max(1, Math.round(H * g)), gk = k * g;
  let px = new Float32Array(gw * gh * 4);
  // el contenido analítico se evalúa con la geometría del lienzo reducido
  const lowAnalytic = lowContent(L, gw, gh, gk, ctx);
  const cur = { base: [0, 0, 0], snaps: new Map() };
  for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){
    const s = lowAnalytic(x, y, cur), i = (y * gw + x) * 4; px[i] = s[0]; px[i + 1] = s[1]; px[i + 2] = s[2]; px[i + 3] = s[3];
  }
  for(const op of ops) px = applyOp(px, gw, gh, op, gk, ctx);
  return (x, y) => sampleBuf(px, gw, gh, (x + 0.5) * g - 0.5, (y + 0.5) * g - 0.5);
}

/** Contenido analítico de una capa evaluado en un lienzo reducido (para generar su buffer) */
function lowContent(L, gw, gh, gk, ctx){
  const L2 = { ...L, ops: [] };
  if(L.k === "group"){
    const sub = { skipped: ctx.skipped, spatialSnaps: [], cur: null };
    const kids = buildNodes(L.kids || [], gw, gh, gk, sub), st = [0, 0, 0, 0], out = [0, 0, 0, 0];
    return (x, y, cx2) => { st[0] = st[1] = st[2] = st[3] = 0; runNodes(kids, st, x, y, cx2); out[0] = st[0]; out[1] = st[1]; out[2] = st[2]; out[3] = st[3]; return out; };
  }
  return makeContent(L2, gw, gh, gk, ctx, false);
}

function applyOp(px, w, h, op, k, ctx){
  switch(op.op){
    case "blur": return blurRGBA(px, w, h, Math.max(0, op.r * k));
    case "mblur": return motionBlur(px, w, h, op.a, Math.max(1, op.d * k));
    case "rblur": return radialBlur(px, w, h, op.n, op.mode);
    case "noise": return addNoise(px, w, h, op);
    case "xf": return transform(px, w, h, op, k);
    case "align": return alignLayer(px, w, h, op.to);
    case "desat": case "inv": case "lvl": case "hue": {
      const f = colorOp(op), c = [0, 0, 0];
      for(let i = 0; i < w * h; i++){ c[0] = px[i * 4]; c[1] = px[i * 4 + 1]; c[2] = px[i * 4 + 2]; f(c); px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; }
      return px;
    }
    default: ctx.skipped.add("filtro " + op.op); return px;
  }
}

function runNodes(nodes, st, x, y, cx2){
  for(let i = 0; i < nodes.length; i++){
    const n = nodes[i];
    if(n.hid){
      // una copia oculta igualmente guarda su instantánea para las copias posteriores
      if(n.snap !== undefined && !cx2.snaps.has(n.snap)) cx2.snaps.set(n.snap, [st[0], st[1], st[2]]);
      continue;
    }
    n.run(st, x, y, cx2);
  }
}

/** Copia de la imagen con filtros espaciales: se evalúa lo que hay debajo en un lienzo reducido, se filtra y se guarda */
function renderSnapBuffer(L, stack, node, W, H, k, ctx){
  const g = Math.min(1, GEN / Math.max(W, H)), gw = Math.max(1, Math.round(W * g)), gh = Math.max(1, Math.round(H * g));
  const px = new Float32Array(gw * gh * 4), st = [0, 0, 0, 1], cur = { base: [0, 0, 0], snaps: new Map() };
  const photo = ctx.lowPhoto(gw, gh);
  for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){
    const q = (y * gw + x) * 4; st[0] = photo[q]; st[1] = photo[q + 1]; st[2] = photo[q + 2]; st[3] = 1;
    cur.base[0] = st[0]; cur.base[1] = st[1]; cur.base[2] = st[2];
    // evalúa las capas anteriores a ésta
    for(const n of stack){ if(n === node) break; if(!n.hid) n.run(st, x * W / gw, y * H / gh, cur); }
    px[q] = st[0]; px[q + 1] = st[1]; px[q + 2] = st[2]; px[q + 3] = 1;
  }
  let out = px;
  for(const op of L.ops || []) out = applyOp(out, gw, gh, op, k * g, ctx);
  node.w = gw; node.h = gh;
  return out;
}

/* ═══ API ═══ */

/** ¿La receta sólo depende del color de cada píxel (no de su posición ni de sus vecinos)? Entonces se puede evaluar como una función de color. */
export function styleIsPure(recipe){
  const walk = layers => (layers || []).every(L => {
    if(L.k === "grad" || L.k === "pix" || L.k === "tex") return false;
    if(L.ops && !isPointwiseOps(L.ops)) return false;
    if(L.k === "group") return (L.iso ? false : walk(L.kids));
    return true;
  });
  return walk(recipe.layers);
}

/* Recetas «puras» (sólo dependen del color de cada píxel): se evalúan una vez sobre una rejilla de colores 49³ y la imagen se resuelve por interpolación
   trilineal. Es unas 20 veces más rápido que recorrer las capas por cada píxel, y el error frente al cálculo exacto es menor que un nivel de 8 bits
   (tests/estilos-motor.mjs lo comprueba). `opts.exact` fuerza el cálculo píxel a píxel. */
const LUT_N = 49, lutCache = new WeakMap(), planCache = new WeakMap();
function lutFor(recipe){
  let t = lutCache.get(recipe);
  if(t) return t;
  const f = styleColorFn(recipe, 1), N = LUT_N, S = 255 / (N - 1);
  t = new Float32Array(N * N * N * 3);
  for(let r = 0, o = 0; r < N; r++) for(let g = 0; g < N; g++) for(let b = 0; b < N; b++, o += 3){ const c = f(r * S, g * S, b * S); t[o] = c[0]; t[o + 1] = c[1]; t[o + 2] = c[2]; }
  lutCache.set(recipe, t); return t;
}
function applyLut(data, W, H, recipe, t){
  const lut = lutFor(recipe), N = LUT_N, S = (N - 1) / 255, N2 = N * N, f32 = data instanceof Float32Array, clamped = data instanceof Uint8ClampedArray;
  for(let i = 0, n = W * H * 4; i < n; i += 4){
    const r0 = data[i], g0 = data[i + 1], b0 = data[i + 2], fr = r0 * S, fg = g0 * S, fb = b0 * S;
    const ri = Math.min(N - 2, fr | 0), gi = Math.min(N - 2, fg | 0), bi = Math.min(N - 2, fb | 0), tr = fr - ri, tg = fg - gi, tb = fb - bi;
    const o = (ri * N2 + gi * N + bi) * 3, oG = N * 3, oR = N2 * 3;
    let R = 0, G = 0, B = 0;
    for(let c = 0; c < 3; c++){
      const c00 = lut[o + c] + (lut[o + 3 + c] - lut[o + c]) * tb, c01 = lut[o + oG + c] + (lut[o + oG + 3 + c] - lut[o + oG + c]) * tb;
      const c10 = lut[o + oR + c] + (lut[o + oR + 3 + c] - lut[o + oR + c]) * tb, c11 = lut[o + oR + oG + c] + (lut[o + oR + oG + 3 + c] - lut[o + oR + oG + c]) * tb;
      const v = (c00 + (c01 - c00) * tg) * (1 - tr) + (c10 + (c11 - c10) * tg) * tr;
      if(c === 0) R = v; else if(c === 1) G = v; else B = v;
    }
    if(t < 1){ R = r0 + (R - r0) * t; G = g0 + (G - g0) * t; B = b0 + (B - b0) * t; }
    if(f32 || clamped){ data[i] = R; data[i + 1] = G; data[i + 2] = B; } else { data[i] = clamp255(R) + 0.5; data[i + 1] = clamp255(G) + 0.5; data[i + 2] = clamp255(B) + 0.5; }
  }
}

/**
 * Aplica una receta a una imagen RGBA de 8 bits (en su sitio).
 * @param data  Uint8ClampedArray RGBA (o Float32Array 0-255)
 * @param opts  { intensity: 0-1, ref: lado de referencia en px para las medidas de la receta }
 * Devuelve la lista de elementos que el motor no sabe evaluar (se ignoran).
 */
export function renderStyle(data, W, H, recipe, opts = {}){
  const intensity = opts.intensity ?? 1, ref = recipe.ref || opts.ref || 2000, k = Math.max(W, H) / ref;
  if(!opts.exact && W * H >= 120000 && styleIsPure(recipe)){ applyLut(data, W, H, recipe, clamp(intensity, 0, 1)); return []; }
  const ctx = { skipped: new Set(), spatialSnaps: [], cur: null, lowPhoto: null };
  // foto reducida para las copias espaciales (se calcula sólo si hace falta)
  let low = null, lowKey = "";
  ctx.lowPhoto = (gw, gh) => {
    const key = gw + "x" + gh; if(low && lowKey === key) return low;
    low = new Float32Array(gw * gh * 4); lowKey = key;
    for(let y = 0; y < gh; y++){
      const y0 = Math.floor(y * H / gh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H / gh));
      for(let x = 0; x < gw; x++){
        const x0 = Math.floor(x * W / gw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * W / gw));
        let r = 0, g = 0, b = 0, n = 0;
        for(let yy = y0; yy < y1; yy += Math.max(1, (y1 - y0) >> 2)) for(let xx = x0; xx < x1; xx += Math.max(1, (x1 - x0) >> 2)){ const q = (yy * W + xx) * 4; r += data[q]; g += data[q + 1]; b += data[q + 2]; n++; }
        const o = (y * gw + x) * 4; low[o] = r / n; low[o + 1] = g / n; low[o + 2] = b / n; low[o + 3] = 255;
      }
    }
    return low;
  };
  const key = W + "x" + H + "@" + ref + "#" + texVersion;
  let plan = planCache.get(recipe);
  let nodes;
  if(plan && plan.key === key) nodes = plan.nodes;
  else {
    nodes = buildNodes(recipe.layers || [], W, H, k, ctx);
    for(const n of ctx.spatialSnaps) n.prepare(nodes);
    // lo que se genera (destellos, rellenos…) sólo depende de la receta y del tamaño: se reutiliza al mover la intensidad. Las copias con filtros espaciales dependen de la foto.
    if(!ctx.spatialSnaps.length) planCache.set(recipe, { key, nodes });
  }
  const st = [0, 0, 0, 1], cur = { base: [0, 0, 0], snaps: new Map() };
  const t = clamp(intensity, 0, 1), f32 = data instanceof Float32Array, clamped = data instanceof Uint8ClampedArray;
  for(let y = 0; y < H; y++){
    for(let x = 0; x < W; x++){
      const i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      st[0] = r; st[1] = g; st[2] = b; st[3] = 1;
      cur.base[0] = r; cur.base[1] = g; cur.base[2] = b; cur.snaps.clear();
      runNodes(nodes, st, x, y, cur);
      let R = st[0], G = st[1], B = st[2];
      if(t < 1){ R = r + (R - r) * t; G = g + (G - g) * t; B = b + (B - b) * t; }
      if(f32 || clamped){ data[i] = R; data[i + 1] = G; data[i + 2] = B; }          // un Uint8ClampedArray ya redondea al asignar
      else { data[i] = clamp255(R) + 0.5; data[i + 1] = clamp255(G) + 0.5; data[i + 2] = clamp255(B) + 0.5; }
    }
  }
  return [...ctx.skipped];
}

/** Para recetas puras: función de color (r, g, b en 0-255 → [r, g, b]) para el camino de coma flotante */
export function styleColorFn(recipe, intensity = 1){
  const ctx = { skipped: new Set(), spatialSnaps: [], cur: null, lowPhoto: null };
  const nodes = buildNodes(recipe.layers || [], 1, 1, 1, ctx), st = [0, 0, 0, 1], cur = { base: [0, 0, 0], snaps: new Map() }, out = [0, 0, 0];
  const t = clamp(intensity, 0, 1);
  return (r, g, b) => {
    st[0] = r; st[1] = g; st[2] = b; st[3] = 1; cur.base[0] = r; cur.base[1] = g; cur.base[2] = b; cur.snaps.clear();
    runNodes(nodes, st, 0, 0, cur);
    out[0] = r + (st[0] - r) * t; out[1] = g + (st[1] - g) * t; out[2] = b + (st[2] - b) * t; return out;
  };
}
