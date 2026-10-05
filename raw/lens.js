/* ═══════════════════════════════════════════════════════════════
   CORRECCIÓN DE LENTE ANTES DEL REVELADO (fase 9 de PENDIENTE.md)
   En el revelador RAW, con «Corrección de lente por perfil», la
   distorsión, la aberración cromática y el viñeteo se corrigen sobre los
   datos lineales de 16 bits, ANTES de balance de blancos, tono y color:
     · el viñeteo se compensa en luz lineal (con la curva BT.709 que
       LibRaw aplica siempre, ver source.js), no sobre un JPEG ya hecho;
     · un único remuestreo bilineal sobre el dato de 16 bits; el revelado
       trabaja ya con la geometría corregida (y sus mapas de baja
       resolución también).
   Perfil: el propio de esa cámara si existe (js/lens/userprofiles.js) o
   el objetivo de Lensfun que dicen los datos EXIF (js/lens/lensmath.js),
   con el mismo criterio que «Lente automática». Sin perfil, el RAW sigue
   como estaba y se avisa.
   ═══════════════════════════════════════════════════════════════ */

import { decodeLut16, bt709Encode } from "./premium/core.js";

let dbPromise = null;
const loadDb = () => dbPromise ||= fetch(new URL("../assets/lensdb/lensfun.json", import.meta.url)).then(r => { if(!r.ok) throw new Error("No se pudo cargar la base de objetivos"); return r.json(); });

/** Perfil para un RAW: { profile, crop, name, keep } o null. `meta` = metadatos de LibRaw (camera_make, camera_model, aperture, focal_len). */
export async function profileForRaw(file, meta = {}){
  const [M, UP, { readLensExif }] = await Promise.all([import("../js/lens/lensmath.js"), import("../js/lens/userprofiles.js"), import("../js/lens/exifread.js")]);
  const exif = file ? await readLensExif(file) : null;
  const info = { make: exif?.make || meta.camera_make || "", model: exif?.model || meta.camera_model || "", lens: exif?.lens || "", focal: exif?.focal || meta.focal_len || 0, focal35: exif?.focal35 || 0, fNumber: exif?.fNumber || meta.aperture || 0, distance: exif?.distance || 0 };
  const user = UP.findFor(info);
  if(user) return { profile: UP.toProfile(user), crop: 1, name: user.name, M };
  let db; try{ db = await loadDb(); }catch{ return null; }
  const { camera, candidates } = M.matchLenses(db, info);
  const c = candidates[0]; if(!c || c.score < 0.5) return null;
  const l = c.lens, crop = camera?.crop || (info.focal && info.focal35 ? info.focal35 / info.focal : l.c || 1);
  const focal = info.focal || Math.round(((l.s[0].d[0] || [24])[0] + (l.s[0].d.at(-1) || [24])[0]) / 2);
  const profile = M.buildProfile(l, { crop, focal, aperture: info.fNumber || 4, distance: info.distance || 1000 });
  return { profile, crop, name: l.n, M };
}

/**
 * Corrige una fuente RAW lineal (LibRaw: Uint16 RGB con curva BT.709, ver source.js). Devuelve la fuente corregida (misma forma) o la misma si no hay perfil.
 * @param onProgress  (0-1) opcional
 */
export async function correctLinearSource(source, file, meta, { onProgress = null } = {}){
  if(!source || source.channels !== 3 || !(source.data instanceof Uint16Array)) return { source, name: null };
  const p = await profileForRaw(file, meta);
  if(!p || (!p.profile.dist && !p.profile.tca && !p.profile.vig)) return { source, name: null };
  const { width: W, height: H, data } = source, C = p.M.makeCorrector(p.profile, { crop: p.crop, W, H, distortion: true, tca: true, vignette: true, autoScale: true });
  const out = new Uint16Array(data.length), o = new Array(6), lut = decodeLut16();
  const bil = (fx, fy, c) => {
    fx = fx < 0 ? 0 : fx > W - 1 ? W - 1 : fx; fy = fy < 0 ? 0 : fy > H - 1 ? H - 1 : fy;
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    return (data[(y0 * W + x0) * 3 + c] * (1 - tx) + data[(y0 * W + x1) * 3 + c] * tx) * (1 - ty) + (data[(y1 * W + x0) * 3 + c] * (1 - tx) + data[(y1 * W + x1) * 3 + c] * tx) * ty;
  };
  const rows = Math.max(8, Math.floor(2e6 / W));
  for(let y0 = 0; y0 < H; y0 += rows){
    for(let y = y0; y < Math.min(H, y0 + rows); y++) for(let x = 0; x < W; x++){
      C.map(x, y, o);
      const i = (y * W + x) * 3, g = C.hasVig ? C.gain(o[2], o[3]) : 1;
      for(let c = 0; c < 3; c++){
        const v = bil(o[c * 2], o[c * 2 + 1], c);
        // Con viñeteo: se pasa a luz lineal, se compensa y se vuelve a codificar con la curva de LibRaw
        out[i + c] = g > 1.002 ? Math.max(0, Math.min(65535, Math.round(bt709Encode(Math.min(1, lut[Math.min(65535, Math.round(v))] * g)) * 65536))) : Math.round(v);
      }
    }
    onProgress?.(Math.min(1, (y0 + rows) / H)); await new Promise(r => setTimeout(r, 0));
  }
  return { source: { ...source, data: out }, name: p.name };
}
