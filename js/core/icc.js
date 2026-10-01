/* ═══════════════════════════════════════════════════════════════
   PERFILES DE COLOR (ICC) Y MATRICES RGB
   Fase 2 de PENDIENTE.md: color de gama amplia.

   · Matrices RGB lineal ↔ XYZ a partir de los primarios y el blanco de
     cada espacio (sRGB y Display P3 comparten blanco D65 y curva de
     transferencia; sólo cambian los primarios).
   · Un perfil ICC v2 «Display P3» compacto (primarios adaptados a D50
     con Bradford, curva sRGB tabulada) para incrustarlo al exportar en
     PNG, JPEG y TIFF: así cualquier visor sabe que los números del
     archivo son P3 y no los confunde con sRGB.
   Sin dependencias: lo usan el editor y las pruebas en Node.
   ═══════════════════════════════════════════════════════════════ */

export const SPACES = {
  srgb:        { name: "sRGB IEC61966-2.1", r: [0.640, 0.330], g: [0.300, 0.600], b: [0.150, 0.060], w: [0.3127, 0.3290] },
  "display-p3":{ name: "Display P3",        r: [0.680, 0.320], g: [0.265, 0.690], b: [0.150, 0.060], w: [0.3127, 0.3290] }
};

const mul = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((s, _, k) => s + A[i][k] * B[k][j], 0)));
const mulv = (A, v) => A.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
function inv(m){
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
          [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
          [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
const xyz = ([x, y]) => [x / y, 1, (1 - x - y) / y];

/** RGB lineal → XYZ (blanco del propio espacio) */
export function rgbToXyz(space){
  const s = SPACES[space], P = [xyz(s.r), xyz(s.g), xyz(s.b)];
  const M = [[P[0][0], P[1][0], P[2][0]], [P[0][1], P[1][1], P[2][1]], [P[0][2], P[1][2], P[2][2]]];
  const S = mulv(inv(M), xyz(s.w));
  return M.map(row => row.map((v, j) => v * S[j]));
}
/** Matriz 3×3 RGB lineal de `from` → RGB lineal de `to` (mismo blanco D65) */
export function rgbMatrix(from, to){ return mul(inv(rgbToXyz(to)), rgbToXyz(from)); }

const BRADFORD = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
const D50 = [0.9642, 1.0, 0.8249];
function adaptToD50(space){
  const W = xyz(SPACES[space].w), cs = mulv(BRADFORD, W), cd = mulv(BRADFORD, D50);
  const D = [[cd[0] / cs[0], 0, 0], [0, cd[1] / cs[1], 0], [0, 0, cd[2] / cs[2]]];
  return mul(mul(inv(BRADFORD), D), mul(BRADFORD, rgbToXyz(space)));
}

/* ── escritura del perfil ICC v2 ─────────────────────────────── */
function s15(v){ return Math.round(v * 65536) | 0; }
function textDesc(str){
  const ascii = new TextEncoder().encode(str);
  const n = ascii.length + 1;
  const out = new Uint8Array(12 + n + 8 + 3 + 67);
  const v = new DataView(out.buffer);
  out.set([0x64, 0x65, 0x73, 0x63]); v.setUint32(8, n); out.set(ascii, 12);
  return out;   // unicode y ScriptCode a cero (ya están a cero)
}
function textTag(str){
  const t = new TextEncoder().encode(str), out = new Uint8Array(8 + t.length + 1);
  out.set([0x74, 0x65, 0x78, 0x74]); out.set(t, 8); return out;
}
function xyzTag(X, Y, Z){
  const out = new Uint8Array(20), v = new DataView(out.buffer);
  out.set([0x58, 0x59, 0x5A, 0x20]); v.setInt32(8, s15(X)); v.setInt32(12, s15(Y)); v.setInt32(16, s15(Z));
  return out;
}
function srgbCurve(){
  const N = 1024, out = new Uint8Array(12 + N * 2), v = new DataView(out.buffer);
  out.set([0x63, 0x75, 0x72, 0x76]); v.setUint32(8, N);
  for(let i = 0; i < N; i++){
    const x = i / (N - 1), y = x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    v.setUint16(12 + i * 2, Math.round(y * 65535));
  }
  return out;
}

export function buildProfile(space){
  const s = SPACES[space], M = adaptToD50(space);
  const trc = srgbCurve();
  const tags = [
    ["desc", textDesc(s.name)],
    ["cprt", textTag("No copyright, use freely")],
    ["wtpt", xyzTag(...D50)],
    ["rXYZ", xyzTag(M[0][0], M[1][0], M[2][0])],
    ["gXYZ", xyzTag(M[0][1], M[1][1], M[2][1])],
    ["bXYZ", xyzTag(M[0][2], M[1][2], M[2][2])],
    ["rTRC", trc], ["gTRC", trc], ["bTRC", trc]
  ];
  // Datos de cada etiqueta (las tres curvas comparten los mismos bytes)
  let off = 128 + 4 + tags.length * 12;
  const placed = new Map(), entries = [];
  for(const [sig, data] of tags){
    if(!placed.has(data)){ placed.set(data, off); off += data.length; off = (off + 3) & ~3; }
    entries.push([sig, placed.get(data), data.length]);
  }
  const size = off, out = new Uint8Array(size), v = new DataView(out.buffer);
  const ascii = (o, s4) => { for(let i = 0; i < 4; i++) out[o + i] = s4.charCodeAt(i); };
  v.setUint32(0, size);
  v.setUint32(8, 0x02100000);              // versión 2.1
  ascii(12, "mntr"); ascii(16, "RGB "); ascii(20, "XYZ ");
  const d = new Date(); [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].forEach((x, i) => v.setUint16(24 + i * 2, x));
  ascii(36, "acsp");
  v.setInt32(68, s15(D50[0])); v.setInt32(72, s15(D50[1])); v.setInt32(76, s15(D50[2]));
  v.setUint32(128, entries.length);
  entries.forEach(([sig, o, n], k) => { ascii(132 + k * 12, sig); v.setUint32(136 + k * 12, o); v.setUint32(140 + k * 12, n); });
  for(const [data, o] of placed) out.set(data, o);
  return out;
}

const cache = {};
export const profileFor = space => cache[space] || (cache[space] = buildProfile(space));
