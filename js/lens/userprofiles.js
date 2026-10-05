/* ═══════════════════════════════════════════════════════════════
   PERFILES DE LENTE PROPIOS (fase 9 de PENDIENTE.md)
   Móviles y cámaras sin objetivo en la base de Lensfun (iPhone, Pixel,
   Galaxy…): el usuario aporta su perfil —medido, copiado de una fuente
   fiable o ajustado a ojo con una foto de líneas rectas— y se guarda en
   este navegador (localStorage). Se puede exportar e importar como JSON
   y se aplica solo a las fotos de esa misma cámara.

   Formato (JSON):
     { "name": "Pixel 8 · principal", "match": { "make": "Google", "model": "Pixel 8" },
       "distortion": { "model": "acm", "k": [k1, k2, k3], "p": [p1, p2] },     // radio 1 en la esquina de la foto
       "vignette":   { "model": "acm", "v": [v1, v2, v3] },                     // iluminación relativa = 1 + v1·r² + v2·r⁴ + v3·r⁶
       "tca":        { "red": 1.0004, "blue": 0.9996 } }                        // escala radial de rojo y azul respecto al verde
   «acm» = el modelo radial + tangencial de Adobe (WarpRectilinear del DNG); r normalizado a la esquina.
   Los archivos .lcp de Adobe no se leen: sus unidades no están contrastadas aquí.
   Sin DOM salvo localStorage.
   ═══════════════════════════════════════════════════════════════ */

const KEY = "realify.lensProfiles";
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const num = (v, d = 0) => Number.isFinite(+v) ? +v : d;

/** Valida y normaliza un perfil (lanza un Error en español si no sirve). */
export function sanitize(p){
  if(!p || typeof p !== "object") throw new Error("El perfil no es un objeto JSON");
  const name = String(p.name || "").trim().slice(0, 80); if(!name) throw new Error("El perfil necesita un nombre");
  const out = { name, match: { make: String(p.match?.make || "").trim(), model: String(p.match?.model || "").trim() } };
  if(p.distortion){
    if(p.distortion.model && p.distortion.model !== "acm") throw new Error("Sólo se admite el modelo de distorsión «acm»");
    const k = [0, 1, 2].map(i => num(p.distortion.k?.[i])), t = [0, 1].map(i => num(p.distortion.p?.[i]));
    if(k.some(v => Math.abs(v) > 2) || t.some(v => Math.abs(v) > 0.5)) throw new Error("Coeficientes de distorsión fuera de rango");
    if(k.some(Boolean) || t.some(Boolean)) out.distortion = { model: "acm", k, p: t };
  }
  if(p.vignette){
    const v = [0, 1, 2].map(i => num(p.vignette.v?.[i]));
    if(v.some(x => Math.abs(x) > 6)) throw new Error("Coeficientes de viñeteo fuera de rango");
    if(v.some(Boolean)) out.vignette = { model: "acm", v };
  }
  if(p.tca){
    const red = num(p.tca.red, 1), blue = num(p.tca.blue, 1);
    if(Math.abs(red - 1) > 0.02 || Math.abs(blue - 1) > 0.02) throw new Error("Aberración cromática fuera de rango");
    if(red !== 1 || blue !== 1) out.tca = { red, blue };
  }
  if(!out.distortion && !out.vignette && !out.tca) throw new Error("El perfil no corrige nada (distorsión, viñeteo o aberración)");
  return out;
}

export function list(){ try{ const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; }catch{ return []; } }
function save(a){ try{ localStorage.setItem(KEY, JSON.stringify(a)); return true; }catch{ return false; } }

/** Guarda (o sustituye por nombre) un perfil propio. */
export function put(p){ const s = sanitize(p), a = list().filter(x => x.name !== s.name); a.push(s); if(!save(a)) throw new Error("No se pudo guardar en este navegador"); return s; }
export function remove(name){ save(list().filter(x => x.name !== name)); }
export const exportJson = p => JSON.stringify(p, null, 2);
export function importJson(text){
  const v = JSON.parse(text);
  return (Array.isArray(v) ? v : [v]).map(put);
}

/** Perfil propio que corresponde a la cámara (marca y modelo del EXIF), o null. */
export function findFor(info, profiles = list()){
  const mk = norm(info?.make), md = norm(info?.model);
  if(!md) return null;
  return profiles.find(p => p.match?.model && norm(p.match.model) === md && (!p.match.make || !mk || mk.startsWith(norm(p.match.make).split(" ")[0]) || norm(p.match.make).startsWith(mk.split(" ")[0]))) || null;
}

/** Perfil propio → perfil de makeCorrector (js/lens/lensmath.js): normalizado a la esquina de la foto. */
export function toProfile(u){
  return {
    dist: u.distortion ? { model: "acm", terms: [...u.distortion.k, ...u.distortion.p], d: 1 } : null,
    tca: u.tca ? { model: "linear", terms: [u.tca.red, u.tca.blue] } : null,
    vig: u.vignette ? { terms: u.vignette.v } : null,
    realFocal: 1, normDiag: true
  };
}
