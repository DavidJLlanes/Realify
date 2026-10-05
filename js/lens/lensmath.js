/* ═══════════════════════════════════════════════════════════════
   CORRECCIÓN DE LENTE CON PERFILES (fase 9 de PENDIENTE.md) · matemática
   Sin DOM: la usan la herramienta y las pruebas en Node.

   Modelos de la base de datos de Lensfun (CC BY-SA 3.0, ver
   assets/lensdb/LICENSE.md), reimplementados desde su documentación:
     · Distorsión: poly3, poly5 y ptlens (convención de Hugin, coeficientes
       reescalados a la distancia focal real).
     · Aberración cromática (TCA): lineal y poly3, rojo y azul respecto al verde.
     · Viñeteo: modelo «pa» (1 + k1·r² + k2·r⁴ + k3·r⁶).
   Coordenadas normalizadas en unidades de la distancia focal real, con el
   origen en el centro de la imagen.
   ═══════════════════════════════════════════════════════════════ */

const DIAG35 = Math.hypot(36, 24);

/* ── Identificación de cámara y objetivo ──────────────────────── */
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, " ").trim();
const compact = s => norm(s).replace(/ /g, "");
const MAKERS = ["canon", "nikon", "sony", "fujifilm", "fuji", "olympus", "om system", "panasonic", "leica", "pentax", "ricoh", "samsung", "sigma", "tamron", "tokina", "zeiss", "carl zeiss", "voigtlander", "samyang", "rokinon", "apple", "gopro", "dji", "hasselblad", "konica minolta", "minolta", "kodak", "casio", "yongnuo"];

/** Texto sin la marca, para comparar «Canon EF 24-70mm f/2.8L II USM» con «EF24-70mm f/2.8L II USM». */
function bare(s){
  let t = norm(s);
  for(const mk of MAKERS) if(t.startsWith(mk + " ")){ t = t.slice(mk.length + 1); break; }
  return t.replace(/ /g, "");
}

/** Puntuación 0-1 de parecido entre dos nombres de objetivo. */
export function lensSimilarity(a, b){
  const x = bare(a), y = bare(b);
  if(!x || !y) return 0;
  if(x === y) return 1;
  if(x.includes(y) || y.includes(x)) return 0.9 * Math.min(x.length, y.length) / Math.max(x.length, y.length) + 0.1;
  // Parecido por trigramas
  const tri = s => { const o = new Set(); for(let i = 0; i + 3 <= s.length; i++) o.add(s.slice(i, i + 3)); return o; };
  const A = tri(x), B = tri(y); let n = 0; for(const t of A) if(B.has(t)) n++;
  return n / Math.max(1, Math.min(A.size, B.size) + Math.max(A.size, B.size)) * 2 * 0.85;
}

/** Cámara de la base a partir del EXIF (marca y modelo). */
export function findCamera(db, make, model){
  const mk = norm(make).split(" ")[0], md = compact(model);
  if(!md) return null;
  let best = null, bs = 0;
  for(const c of db.cameras){
    const cm = compact(c[1]);
    if(!norm(c[0]).startsWith(mk) && !mk.startsWith(norm(c[0]).split(" ")[0])) continue;
    const s = cm === md ? 1 : (cm.includes(md) || md.includes(cm)) ? 0.8 * Math.min(cm.length, md.length) / Math.max(cm.length, md.length) : 0;
    if(s > bs){ bs = s; best = c; }
  }
  return bs >= 0.6 ? { maker: best[0], model: best[1], mount: best[2], crop: best[3] } : null;
}

/** ¿El objetivo (montaje `lensMounts`) entra en una cámara de montaje `camMount`? (compatibles incluidos) */
export function mountFits(db, camMount, lensMounts){
  if(!camMount || !lensMounts?.length) return true;
  const ok = new Set([camMount, ...(db.mounts[camMount] || [])]);
  return lensMounts.some(m => ok.has(m));
}

/**
 * Candidatos de objetivo para lo que dice el EXIF, de mejor a peor.
 * @param info  { make, model, lens, focal, focal35 }
 */
export function matchLenses(db, info, limit = 8){
  const cam = findCamera(db, info.make, info.model);
  const out = [];
  const nameQ = info.lens || "";
  for(const l of db.lenses){
    let s = nameQ ? lensSimilarity(nameQ, l.n) : 0;
    if(!nameQ){
      // Cámaras con objetivo fijo (compactas, móviles): el objetivo lleva el modelo de la cámara
      s = lensSimilarity(info.model || "", l.n) * 0.9;
      if(cam && l.t.includes(cam.mount) && (norm(l.m) === norm(cam.maker))) s = Math.max(s, 0.3);
    }
    if(s < 0.35) continue;
    if(cam && !mountFits(db, cam.mount, l.t)) s *= 0.5;
    // El objetivo debe poder dar la focal anunciada
    if(info.focal && !focalInRange(l, info.focal)) s *= 0.8;
    out.push({ lens: l, score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return { camera: cam, candidates: out.slice(0, limit) };
}

function focalInRange(l, focal){
  let lo = 1e9, hi = 0;
  for(const s of l.s) for(const d of s.d) { lo = Math.min(lo, d[0]); hi = Math.max(hi, d[0]); }
  if(hi === 0) return true;
  return focal >= lo * 0.8 && focal <= hi * 1.25;
}

/* ── Calibraciones ───────────────────────────────────────────── */

/** Calibración del objetivo con el recorte más cercano (como Lensfun: razón ≥ 0,96 la menor). */
function pickSet(l, crop, kind){
  let best = null, br = 1e6;
  for(const s of l.s){
    if(!s[kind].length) continue;
    const r = crop / s.c;
    if(r >= 0.96 && r < br){ br = r; best = s; }
  }
  return best;
}

/** Hermite con tangentes de Catmull-Rom entre y2 e y3 (t de 0 a 1), como Lensfun. */
const hermite = (y1, y2, y3, y4, t) => {
  const tg2 = (y3 - y1) * 0.5, tg3 = (y4 - y2) * 0.5;
  return y2 + t * (tg2 + t * (3 * (y3 - y2) - 2 * tg2 - tg3 + t * (tg2 + tg3 + 2 * (y2 - y3))));
};

/** Interpolación entre las focales calibradas: spline con los cuatro vecinos más cercanos (fuera del rango, el extremo). */
function interpByFocal(rows, focal, nTerms, scaleTerm = () => 1){
  const rs = rows.slice().sort((a, b) => a[0] - b[0]);
  let i = 0;
  while(i + 1 < rs.length && rs[i + 1][0] <= focal) i++;
  const j = Math.min(rs.length - 1, i + 1), lo = rs[i], hi = rs[j];
  const prev = rs[Math.max(0, i - 1)], next = rs[Math.min(rs.length - 1, j + 1)];
  let t = hi[0] === lo[0] ? 0 : (focal - lo[0]) / (hi[0] - lo[0]);
  if(focal <= rs[0][0]) t = 0; else if(focal >= rs.at(-1)[0]) t = 0;
  const at = (r, k) => r[3 + k] * scaleTerm(k, r[0]);
  const terms = [];
  for(let k = 0; k < nTerms; k++){
    const v = focal >= rs.at(-1)[0] ? at(rs.at(-1), k) : focal <= rs[0][0] ? at(rs[0], k) : hermite(at(prev, k), at(lo, k), at(hi, k), at(next, k), t);
    terms.push(v / scaleTerm(k, focal));
  }
  return { terms, row: t < 0.5 ? lo : hi, t, lo, hi };
}

/**
 * Perfil de corrección para un objetivo y unas condiciones de toma.
 * @returns { dist, tca, vig, realFocal } con coeficientes ya reescalados a la focal real; null en lo que falte
 */
export function buildProfile(l, { crop, focal, aperture = 0, distance = 1000, aspect = 1.5 }){
  const out = { dist: null, tca: null, vig: null, realFocal: focal };
  const ds = pickSet(l, crop, "d");
  if(ds){
    const model = ds.d[0][1], rows = ds.d.filter(r => r[1] === model), n = model === "ptlens" ? 3 : model === "poly5" ? 2 : 1;
    const I = interpByFocal(rows.map(r => [r[0], r[1], r[2], ...r.slice(3)]), focal, n);
    const rf = interpReal(rows, focal) || focal;
    out.realFocal = rf;
    const hs = rf / (DIAG35 / ds.c / Math.hypot(ds.a, 1) / 2);
    let t = I.terms.slice();
    /* Convención de Hugin, que es la de la calibración: Rd = Ru · (a·Ru³ + b·Ru² + c·Ru + d), con
       d = 1 − a − b − c (poly3: d = 1 − k1). La versión más reciente de Lensfun la reescala a d = 1
       (agranda ≈ 2 % la imagen corregida); aquí se mantiene la de Hugin, que coincide con las
       versiones de Lensfun en uso (comprobado contra lensfunpy a 0,25 px). */
    let d = 1;
    if(model === "poly3"){ d = 1 - t[0]; t = [t[0] * hs ** 2]; }
    else if(model === "poly5"){ t = [t[0] * hs ** 2, t[1] * hs ** 4]; }
    else { d = 1 - t[0] - t[1] - t[2]; t = [t[0] * hs ** 3, t[1] * hs ** 2, t[2] * hs]; }
    out.dist = { model, terms: t, d };
  }
  const ts = pickSet(l, crop, "t");
  if(ts){
    const model = ts.t[0][1], rows = ts.t.filter(r => r[1] === model), rf = out.realFocal;
    const hs = rf / (DIAG35 / ts.c / Math.hypot(ts.a, 1) / 2);
    if(model === "poly3"){
      // Términos: vr, vb (sin escala), cr, cb (× focal al interpolar), br, bb
      const I = interpByFocal(rows.map(r => [r[0], r[1], 0, ...r.slice(2)]), focal, 6, (i, f) => i < 2 ? 1 : f);
      const k = I.terms; out.tca = { model, terms: [k[0], k[1], k[2] * hs, k[3] * hs, k[4] * hs * hs, k[5] * hs * hs] };
    } else {
      const I = interpByFocal(rows.map(r => [r[0], r[1], 0, ...r.slice(2)]), focal, 2, () => 1);
      out.tca = { model: "linear", terms: I.terms };
    }
  }
  const vs = pickSet(l, crop, "v");
  if(vs){
    out.vig = vignettingIDW(vs, l, crop, focal, aperture || 4, distance, out.realFocal);
  }
  return out;
}

function interpReal(rows, focal){
  if(!rows.some(r => r[2])) return 0;
  const R = rows.map(r => [r[0], "x", 0, r[2] || r[0]]);
  return interpByFocal(R, focal, 1).terms[0];
}

/** Viñeteo: ponderación por distancia inversa (p = 3,5) sobre focal, diafragma y distancia de enfoque. */
function vignettingIDW(set, l, crop, focal, aperture, distance, realFocal){
  const fs = set.v.map(r => r[0]), minF = Math.min(...fs), maxF = Math.max(...fs), df = maxF - minF;
  const dist = r => {
    let f1 = focal - minF, f2 = r[0] - minF; if(df){ f1 /= df; f2 /= df; }
    const a1 = 4 / aperture, a2 = 4 / r[1], d1 = 0.1 / distance, d2 = 0.1 / r[2];
    return Math.sqrt((f2 - f1) ** 2 + (a2 - a1) ** 2 + (d2 - d1) ** 2);
  };
  const acc = [0, 0, 0]; let tw = 0, smallest = Infinity;
  for(const r of set.v){
    const d = dist(r);
    if(d < 1e-4){ acc[0] = r[3]; acc[1] = r[4]; acc[2] = r[5]; tw = 1; smallest = d; break; }
    smallest = Math.min(smallest, d);
    const w = 1 / Math.pow(d, 3.5);
    for(let i = 0; i < 3; i++) acc[i] += w * r[3 + i] * r[0];
    tw += w;
  }
  if(smallest > 1 || !tw) return null;
  const k = smallest < 1e-4 ? acc : acc.map(v => v / (tw * focal));
  const hs = realFocal / (DIAG35 / set.c / 2);
  return { terms: [k[0] * hs ** 2, k[1] * hs ** 4, k[2] * hs ** 6] };
}

/* ── Mapas de coordenadas ────────────────────────────────────── */

/**
 * Prepara la corrección de una imagen W×H.
 * @param profile  resultado de buildProfile
 * @param opts     { crop, W, H, distortion, tca, vignette, autoScale }
 * @returns { map(x, y, out), gain(x, y), scale }  `map` escribe [xR, yR, xG, yG, xB, yB] en píxeles de la foto original
 */
export function makeCorrector(profile, { crop, W, H, distortion = true, tca = true, vignette = true, autoScale = true, keep = 1 }){
  /* Coordenadas normalizadas: en distancias focales (perfiles de Lensfun) o, en los perfiles propios (`profile.normDiag`, modelo «acm»), con el radio 1 en
     la esquina de la foto original. `keep` (0,1-1) es la fracción del ancho original que conserva el propio archivo cuando ya viene recortado (recorte
     centrado): las posiciones se miden respecto a la foto completa, así que los radios se reducen en esa proporción. */
  const ns = (profile.normDiag ? 2 / Math.hypot(W, H) : DIAG35 / crop / Math.hypot(W, H) / profile.realFocal) * Math.min(1, Math.max(0.05, keep));       // píxeles → unidades de la normalización
  const cx = (W - 1) / 2, cy = (H - 1) / 2, un = 1 / ns;
  const dist = distortion ? profile.dist : null, ta = tca ? profile.tca : null, vg = vignette ? profile.vig : null;
  let scale = 1;

  const distort = (x, y) => {                   // normalizadas, de salida → de la foto original (sin TCA)
    if(!dist) return [x, y];
    const t = dist.terms, r2 = x * x + y * y;
    let p;
    if(dist.model === "acm"){
      /* Modelo de cámara de Adobe (WarpRectilinear del DNG): radial 1 + k1·r² + k2·r⁴ + k3·r⁶ y tangencial p1, p2 (Brown-Conrady) */
      const [k1, k2, k3, p1 = 0, p2 = 0] = t, rad = 1 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2;
      return [x * rad + 2 * p1 * x * y + p2 * (r2 + 2 * x * x), y * rad + p1 * (r2 + 2 * y * y) + 2 * p2 * x * y];
    }
    if(dist.model === "poly3") p = t[0] * r2 + dist.d;
    else if(dist.model === "poly5") p = 1 + t[0] * r2 + t[1] * r2 * r2;
    else { const r = Math.sqrt(r2); p = t[0] * r2 * r + t[1] * r2 + t[2] * r + dist.d; }
    return [x * p, y * p];
  };
  const tcaScale = (x, y, which) => {
    if(!ta) return 1;
    const t = ta.terms;
    if(ta.model === "linear") return which === 0 ? t[0] : t[1];
    const r2 = x * x + y * y, r = Math.sqrt(r2);
    return which === 0 ? t[4] * r2 + t[2] * r + t[0] : t[5] * r2 + t[3] * r + t[1];
  };

  const inside = k => {                        // ¿con el zoom k todo el borde cae dentro de la foto?
    const n = 64;
    for(let i = 0; i <= n; i++) for(const [u, v] of [[i / n, 0], [i / n, 1], [0, i / n], [1, i / n]]){
      const [dx, dy] = distort(((u * (W - 1)) - cx) * ns * k, ((v * (H - 1)) - cy) * ns * k);
      const sx = dx * un + cx, sy = dy * un + cy;
      if(sx < -0.5 || sx > W - 0.5 || sy < -0.5 || sy > H - 0.5) return false;
    }
    return true;
  };
  if(autoScale && dist && !inside(1)){
    let lo = 0.3, hi = 1;
    for(let i = 0; i < 24; i++){ const mid = (lo + hi) / 2; if(inside(mid)) lo = mid; else hi = mid; }
    scale = lo;
  }
  return {
    scale, hasDist: !!dist, hasTca: !!ta, hasVig: !!vg,
    map(x, y, out){
      const [dx, dy] = distort(((x - cx) * ns) * scale, ((y - cy) * ns) * scale);
      let rx = dx, ry = dy, bx = dx, by = dy;
      if(ta){ const kr = tcaScale(dx, dy, 0), kb = tcaScale(dx, dy, 1); rx = dx * kr; ry = dy * kr; bx = dx * kb; by = dy * kb; }
      out[0] = rx * un + cx; out[1] = ry * un + cy; out[2] = dx * un + cx; out[3] = dy * un + cy; out[4] = bx * un + cx; out[5] = by * un + cy;
    },
    /** Ganancia (≥ 1) que compensa el viñeteo en un punto de la foto ORIGINAL. */
    gain(sx, sy){
      if(!vg) return 1;
      const nx = (sx - cx) * ns, ny = (sy - cy) * ns, r2 = nx * nx + ny * ny, t = vg.terms;
      const c = 1 + t[0] * r2 + t[1] * r2 * r2 + t[2] * r2 * r2 * r2;
      return c > 0.05 ? 1 / c : 20;
    }
  };
}

/* ── Aplicación a píxeles ────────────────────────────────────── */

const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/* Pesos bicúbicos de Catmull-Rom para una fracción t */
function cr(t, w){
  const t2 = t * t, t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t; w[1] = 1.5 * t3 - 2.5 * t2 + 1; w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t; w[3] = 0.5 * t3 - 0.5 * t2;
}

/**
 * Corrige las filas [y0, y1) de la foto `src` (RGBA, W×H) y las escribe en `out` (RGBA, alto y1 − y0).
 * Resamplea UNA sola vez (bicúbico de Catmull-Rom), cada canal con sus propias coordenadas (aberración
 * cromática); el viñeteo se compensa en luz lineal (con tramado donde actúa).
 * Donde la foto original no llega, alfa 0.
 */
export function correctRows(src, W, H, C, y0, y1, out){
  const o = new Array(6), wx = new Float32Array(4), wy = new Float32Array(4), ch = [0, 0, 0];
  const sample = (fx, fy, c) => {
    const x0 = Math.floor(fx), y0f = Math.floor(fy);
    cr(fx - x0, wx); cr(fy - y0f, wy);
    let acc = 0;
    for(let j = 0; j < 4; j++){
      let yy = y0f - 1 + j; yy = yy < 0 ? 0 : yy >= H ? H - 1 : yy;
      let row = 0;
      for(let i = 0; i < 4; i++){ let xx = x0 - 1 + i; xx = xx < 0 ? 0 : xx >= W ? W - 1 : xx; row += wx[i] * src[(yy * W + xx) * 4 + c]; }
      acc += wy[j] * row;
    }
    return acc < 0 ? 0 : acc > 255 ? 255 : acc;
  };
  for(let y = y0; y < y1; y++){
    for(let x = 0; x < W; x++){
      C.map(x, y, o);
      const oo = ((y - y0) * W + x) * 4, gx = o[2], gy = o[3];
      if(gx < -0.5 || gx > W - 0.5 || gy < -0.5 || gy > H - 0.5){ out[oo] = out[oo + 1] = out[oo + 2] = out[oo + 3] = 0; continue; }
      ch[0] = sample(o[0], o[1], 0); ch[1] = sample(gx, gy, 1); ch[2] = sample(o[4], o[5], 2);
      const g = C.hasVig ? C.gain(gx, gy) : 1;
      if(g > 1.002){
        const nz = (hash(y * W + x) - 0.5) * 0.9;
        for(let k = 0; k < 3; k++) out[oo + k] = enc(DEC[Math.round(ch[k])] * g) + nz;
      } else { out[oo] = ch[0]; out[oo + 1] = ch[1]; out[oo + 2] = ch[2]; }
      out[oo + 3] = 255;
    }
  }
}
