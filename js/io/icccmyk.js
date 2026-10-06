/* ═══════════════════════════════════════════════════════════════
   PERFIL ICC DE SALIDA CMYK (v256) para el PDF/X: convierte sRGB → CMYK con el perfil de la imprenta (FOGRA39, SWOP, el que sea) y lo incrusta como intención de salida.
   Lee un perfil ICC de salida (clase «prtr», espacio CMYK, PCS Lab) y evalúa su tabla B2A (Lab → CMYK) —«lut8» (mft1), «lut16» (mft2) o v4 «lutBtoA» (mBA)— con
   el intento colorimétrico relativo (B2A1) o, si no lo hay, el perceptual (B2A0); sin compensación del punto negro. Para ir rápido se evalúa en una rejilla 33³ de sRGB
   y cada píxel se interpola (tetraédrica). Se comprobó contra littlecms (PIL.ImageCms) con un perfil de prueba: tests/icc-cmyk.mjs + tests/make_cmyk_icc.py.
   No hay gestión de gama más allá de lo que lleve la tabla; un perfil con PCS XYZ o sin B2A no se admite.
   ═══════════════════════════════════════════════════════════════ */

const ascii = (u, i, n) => String.fromCharCode(...u.subarray(i, i + n));
const s15 = (dv, o) => dv.getInt32(o) / 65536;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/** Cabecera y etiquetas de un perfil ICC: { version, cls, space, pcs, desc, tags: Map<firma, {off, size}> } o lanza un Error. */
export function parseIcc(u8){
  if(u8.length < 132 || ascii(u8, 36, 4) !== "acsp") throw new Error("No es un perfil ICC");
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint32(128), tags = new Map();
  for(let i = 0; i < n && 132 + i * 12 + 12 <= u8.length; i++){ const o = 132 + i * 12; tags.set(ascii(u8, o, 4), { off: dv.getUint32(o + 4), size: dv.getUint32(o + 8) }); }
  const info = { version: u8[8], cls: ascii(u8, 12, 4), space: ascii(u8, 16, 4), pcs: ascii(u8, 20, 4), tags, desc: "" };
  const d = tags.get("desc");
  if(d){
    const t = ascii(u8, d.off, 4);
    if(t === "desc"){ const len = dv.getUint32(d.off + 8); info.desc = ascii(u8, d.off + 12, Math.max(0, len - 1)); }
    else if(t === "mluc"){ const cnt = dv.getUint32(d.off + 8), len = dv.getUint32(d.off + 20), off = dv.getUint32(d.off + 24); let s = ""; for(let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(dv.getUint16(d.off + off + k)); info.desc = cnt ? s : ""; }
  }
  return info;
}

/* ── curvas y tablas ─────────────────────────────────────────────────────────── */
function curveAt(u, dv, off){                     // 'curv' o 'para' → { fn, size } (size = bytes ocupados, alineado a 4)
  const t = ascii(u, off, 4);
  if(t === "curv"){
    const n = dv.getUint32(off + 8), size = 12 + n * 2;
    if(n === 0) return { fn: x => x, size: (size + 3) & ~3 };
    if(n === 1){ const g = dv.getUint16(off + 12) / 256; return { fn: x => Math.pow(x, g), size: (size + 3) & ~3 }; }
    const tab = new Float64Array(n); for(let i = 0; i < n; i++) tab[i] = dv.getUint16(off + 12 + i * 2) / 65535;
    return { fn: x => { const p = clamp01(x) * (n - 1), i = Math.min(n - 2, Math.floor(p)), f = p - i; return tab[i] + (tab[i + 1] - tab[i]) * f; }, size: (size + 3) & ~3 };
  }
  if(t === "para"){
    const ft = dv.getUint16(off + 8), cnt = [1, 3, 4, 5, 7][ft] ?? 1, p = []; for(let i = 0; i < cnt; i++) p.push(s15(dv, off + 12 + i * 4));
    const [g, a, b, c, d, e, f] = p;
    const fn = x => { x = clamp01(x); let y;
      switch(ft){
        case 0: y = Math.pow(x, g); break;
        case 1: y = x >= -b / a ? Math.pow(a * x + b, g) : 0; break;
        case 2: y = x >= -b / a ? Math.pow(a * x + b, g) + c : c; break;
        case 3: y = x >= d ? Math.pow(a * x + b, g) : c * x; break;
        default: y = x >= d ? Math.pow(a * x + b, g) + e : c * x + f;
      } return clamp01(y); };
    return { fn, size: (12 + cnt * 4 + 3) & ~3 };
  }
  throw new Error("Curva de perfil no admitida: " + t);
}
function interp1(tab, x){ const n = tab.length; if(n === 1) return tab[0]; const p = clamp01(x) * (n - 1), i = Math.min(n - 2, Math.floor(p)), f = p - i; return tab[i] + (tab[i + 1] - tab[i]) * f; }

/** CLUT n-dimensional (n = 3 aquí, el B2A de Lab) con interpolación tetraédrica; `grid`: nodos por eje, `out`: canales de salida, `data` normalizada 0..1. */
function clut3(grid, out, data){
  const [gx, gy, gz] = grid, sz = gz * out, sy = gy * sz;
  return (x, y, z) => {
    const px = clamp01(x) * (gx - 1), py = clamp01(y) * (gy - 1), pz = clamp01(z) * (gz - 1);
    const ix = Math.min(gx - 2 < 0 ? 0 : gx - 2, Math.floor(px)), iy = Math.min(gy - 2 < 0 ? 0 : gy - 2, Math.floor(py)), iz = Math.min(gz - 2 < 0 ? 0 : gz - 2, Math.floor(pz));
    const fx = px - ix, fy = py - iy, fz = pz - iz, o = ix * sy + iy * sz + iz * out, dx = gx > 1 ? sy : 0, dy = gy > 1 ? sz : 0, dz = gz > 1 ? out : 0, res = new Float64Array(out);
    for(let c = 0; c < out; c++){
      const c000 = data[o + c], c111 = data[o + dx + dy + dz + c];
      let v;
      if(fx >= fy){
        if(fy >= fz) v = c000 + fx * (data[o + dx + c] - c000) + fy * (data[o + dx + dy + c] - data[o + dx + c]) + fz * (c111 - data[o + dx + dy + c]);
        else if(fx >= fz) v = c000 + fx * (data[o + dx + c] - c000) + fz * (data[o + dx + dz + c] - data[o + dx + c]) + fy * (c111 - data[o + dx + dz + c]);
        else v = c000 + fz * (data[o + dz + c] - c000) + fx * (data[o + dx + dz + c] - data[o + dz + c]) + fy * (c111 - data[o + dx + dz + c]);
      } else {
        if(fx >= fz) v = c000 + fy * (data[o + dy + c] - c000) + fx * (data[o + dx + dy + c] - data[o + dy + c]) + fz * (c111 - data[o + dx + dy + c]);
        else if(fy >= fz) v = c000 + fy * (data[o + dy + c] - c000) + fz * (data[o + dy + dz + c] - data[o + dy + c]) + fx * (c111 - data[o + dy + dz + c]);
        else v = c000 + fz * (data[o + dz + c] - c000) + fy * (data[o + dy + dz + c] - data[o + dz + c]) + fx * (c111 - data[o + dy + dz + c]);
      }
      res[c] = v;
    }
    return res;
  };
}

/** Tabla B2A del perfil → función (L, a, b en unidades CIE) → [c, m, y, k] en 0..1, o lanza si no hay una admitida. */
export function b2aFunction(u8, intent = 1){
  const info = parseIcc(u8);
  if(info.cls !== "prtr" || info.space !== "CMYK") throw new Error("Hace falta un perfil de salida CMYK («prtr»)");
  if(info.pcs !== "Lab ") throw new Error("El perfil usa PCS XYZ, que aquí no se admite");
  const order = intent === 1 ? ["B2A1", "B2A0"] : ["B2A0", "B2A1"], tag = order.map(k => info.tags.get(k)).find(Boolean);
  if(!tag) throw new Error("El perfil no lleva tabla B2A (Lab → CMYK)");
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), o = tag.off, t = ascii(u8, o, 4);
  if(t === "mft1" || t === "mft2"){
    const inCh = u8[o + 8], outCh = u8[o + 9], g = u8[o + 10];
    if(inCh !== 3 || outCh !== 4) throw new Error("Tabla B2A con canales inesperados");
    let p = o + 48, nIn = 256, nOut = 256;
    if(t === "mft2"){ nIn = dv.getUint16(o + 48); nOut = dv.getUint16(o + 50); p = o + 52; }
    const rd = t === "mft1" ? (q) => u8[q] / 255 : (q) => dv.getUint16(q) / 65535, sz = t === "mft1" ? 1 : 2;
    const inT = [0, 1, 2].map(c => { const a = new Float64Array(nIn); for(let i = 0; i < nIn; i++) a[i] = rd(p + (c * nIn + i) * sz); return a; }); p += 3 * nIn * sz;
    const total = g * g * g * 4, data = new Float64Array(total); for(let i = 0; i < total; i++) data[i] = rd(p + i * sz); p += total * sz;
    const outT = [0, 1, 2, 3].map(c => { const a = new Float64Array(nOut); for(let i = 0; i < nOut; i++) a[i] = rd(p + (c * nOut + i) * sz); return a; });
    const lut = clut3([g, g, g], 4, data);
    // codificación Lab heredada: lut8 L = v·100/255, a = v − 128; lut16 L = v·100/65280, a = v/256 − 128
    const enc = t === "mft1" ? (L, a, b) => [L / 100, (a + 128) / 255, (b + 128) / 255] : (L, a, b) => [L * 652.8 / 65535, (a + 128) * 256 / 65535, (b + 128) * 256 / 65535];
    return (L, a, b) => { const [x, y, z] = enc(L, a, b), r = lut(interp1(inT[0], x), interp1(inT[1], y), interp1(inT[2], z)); return [0, 1, 2, 3].map(c => clamp01(interp1(outT[c], r[c]))); };
  }
  if(t === "mBA "){
    const inCh = u8[o + 8], outCh = u8[o + 9];
    if(inCh !== 3 || outCh !== 4) throw new Error("Tabla B2A con canales inesperados");
    const offB = dv.getUint32(o + 12), offMat = dv.getUint32(o + 16), offM = dv.getUint32(o + 20), offC = dv.getUint32(o + 24), offA = dv.getUint32(o + 28);
    const curves = (off, n) => { const fns = []; let q = o + off; for(let i = 0; i < n; i++){ const c = curveAt(u8, dv, q); fns.push(c.fn); q += c.size; } return fns; };
    const B = offB ? curves(offB, 3) : null, M = offM ? curves(offM, 3) : null, A = offA ? curves(offA, 4) : null;
    let mat = null; if(offMat){ mat = []; for(let i = 0; i < 12; i++) mat.push(s15(dv, o + offMat + i * 4)); }
    let lut = null;
    if(offC){
      const grid = [0, 1, 2].map(i => u8[o + offC + i]), prec = u8[o + offC + 16], total = grid[0] * grid[1] * grid[2] * 4, data = new Float64Array(total), base = o + offC + 20;
      for(let i = 0; i < total; i++) data[i] = prec === 1 ? u8[base + i] / 255 : dv.getUint16(base + i * 2) / 65535;
      lut = clut3(grid, 4, data);
    }
    // codificación Lab de la v4: L = v·100/65535, a = v·255/65535 − 128
    return (L, a, b) => {
      let v = [L / 100, (a + 128) / 255, (b + 128) / 255];
      if(B) v = v.map((x, i) => B[i](x));
      if(mat) v = [0, 1, 2].map(r => clamp01(mat[r * 3] * v[0] + mat[r * 3 + 1] * v[1] + mat[r * 3 + 2] * v[2] + mat[9 + r]));
      if(M) v = v.map((x, i) => M[i](x));
      let out = lut ? Array.from(lut(v[0], v[1], v[2])) : v;
      if(A) out = out.map((x, i) => A[i](x));
      return out.map(clamp01);
    };
  }
  throw new Error("Tabla B2A de tipo no admitido: " + t);
}

/* sRGB (codificado) → Lab con iluminante D50, como en un perfil ICC */
const M = [[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]];
const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const fL = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
export function srgbToLabD50(r, g, b){
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255);
  const X = (M[0][0] * R + M[0][1] * G + M[0][2] * B) / 0.9642, Y = M[1][0] * R + M[1][1] * G + M[1][2] * B, Z = (M[2][0] * R + M[2][1] * G + M[2][2] * B) / 0.8249;
  const fx = fL(X), fy = fL(Y), fz = fL(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const N = 33;
/** Convierte sRGB → CMYK con el perfil: devuelve { desc, lut } con la rejilla 33³ (Uint8Array de N³·4 bytes: c, m, y, k) y `apply(rgba, background)` para una imagen. */
export function cmykConverter(profileBytes, { intent = 1 } = {}){
  const info = parseIcc(profileBytes), fn = b2aFunction(profileBytes, intent), lut = new Uint8Array(N * N * N * 4);
  for(let r = 0, i = 0; r < N; r++) for(let g = 0; g < N; g++) for(let b = 0; b < N; b++, i += 4){
    const [L, a, bb] = srgbToLabD50(r * 255 / (N - 1), g * 255 / (N - 1), b * 255 / (N - 1)), c = fn(L, a, bb);
    lut[i] = Math.round(c[0] * 255); lut[i + 1] = Math.round(c[1] * 255); lut[i + 2] = Math.round(c[2] * 255); lut[i + 3] = Math.round(c[3] * 255);
  }
  const apply = (rgba, background = [255, 255, 255]) => {
    const n = rgba.length >> 2, out = new Uint8Array(n * 4), S = (N - 1) / 255;
    const at = (ri, gi, bi, c) => lut[((ri * N + gi) * N + bi) * 4 + c];
    for(let p = 0, o = 0; p < n; p++, o += 4){
      const a = rgba[p * 4 + 3] / 255;
      const R = rgba[p * 4] * a + background[0] * (1 - a), G = rgba[p * 4 + 1] * a + background[1] * (1 - a), B = rgba[p * 4 + 2] * a + background[2] * (1 - a);
      const x = R * S, y = G * S, z = B * S, ix = Math.min(N - 2, x | 0), iy = Math.min(N - 2, y | 0), iz = Math.min(N - 2, z | 0), fx = x - ix, fy = y - iy, fz = z - iz;
      for(let c = 0; c < 4; c++){
        const c000 = at(ix, iy, iz, c), c111 = at(ix + 1, iy + 1, iz + 1, c);
        let v;
        if(fx >= fy){ if(fy >= fz) v = c000 + fx * (at(ix + 1, iy, iz, c) - c000) + fy * (at(ix + 1, iy + 1, iz, c) - at(ix + 1, iy, iz, c)) + fz * (c111 - at(ix + 1, iy + 1, iz, c));
          else if(fx >= fz) v = c000 + fx * (at(ix + 1, iy, iz, c) - c000) + fz * (at(ix + 1, iy, iz + 1, c) - at(ix + 1, iy, iz, c)) + fy * (c111 - at(ix + 1, iy, iz + 1, c));
          else v = c000 + fz * (at(ix, iy, iz + 1, c) - c000) + fx * (at(ix + 1, iy, iz + 1, c) - at(ix, iy, iz + 1, c)) + fy * (c111 - at(ix + 1, iy, iz + 1, c)); }
        else { if(fx >= fz) v = c000 + fy * (at(ix, iy + 1, iz, c) - c000) + fx * (at(ix + 1, iy + 1, iz, c) - at(ix, iy + 1, iz, c)) + fz * (c111 - at(ix + 1, iy + 1, iz, c));
          else if(fy >= fz) v = c000 + fy * (at(ix, iy + 1, iz, c) - c000) + fz * (at(ix, iy + 1, iz + 1, c) - at(ix, iy + 1, iz, c)) + fx * (c111 - at(ix, iy + 1, iz + 1, c));
          else v = c000 + fz * (at(ix, iy, iz + 1, c) - c000) + fy * (at(ix, iy + 1, iz + 1, c) - at(ix, iy, iz + 1, c)) + fx * (c111 - at(ix, iy + 1, iz + 1, c)); }
        out[o + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
    return out;
  };
  return { desc: info.desc, lut, apply };
}
