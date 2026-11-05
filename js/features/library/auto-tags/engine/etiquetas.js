/* ═══════════════════════════════════════════════════════════════
   ETIQUETAS AUTOMÁTICAS · ETIQUETAS DE UN REGISTRO (motor puro, sin DOM)
   Convierte lo que la IA vio en una foto (registro de js/features/library/shared/indexar.js) en etiquetas en español, de la más a la menos segura:
   tipo de foto, grupo, objetos de MobileNet que se saben traducir, colores y marcas (blanco y negro, de noche, luminosa, con personas).
   Entradas: registro { catEtiqueta, grupo, top, colores, brillo, bn, piel } y opciones { max }. Salida: lista de textos sin repetir.
   ═══════════════════════════════════════════════════════════════ */
import { toSpanish } from "../../../../ai/es2en.js";

const minus = s => String(s || "").toLowerCase().trim();
const palabrasEn = label => minus(label).replace(/[^a-z\s-]/g, " ").split(/\s+/).filter(Boolean);

export function etiquetasDe(r, { max = 8 } = {}){
  const out = []; const poner = t => { t = minus(t); if(t && !out.includes(t)) out.push(t); };
  if(r.catEtiqueta && !/detecci/i.test(r.catEtiqueta)) poner(r.catEtiqueta);
  if(r.grupo && !/detecci|especial/i.test(r.grupo)) poner(r.grupo.replace(/\s*&\s*.*/, ""));
  for(const t of r.top || []){
    if(t.p < 0.06) continue;
    const w = palabrasEn(t.label), es = toSpanish(w.join(" ")) || toSpanish(w[w.length - 1]);
    if(es) poner(es);
  }
  if(r.bn) poner("blanco y negro"); else for(const [c, f] of (r.colores || []).slice(0, 2)) if(f >= 0.15 && c !== "negro" && c !== "blanco") poner(c);
  if(r.brillo < 0.2) poner("noche"); else if(r.brillo > 0.65) poner("luminosa");
  if(r.piel > 0.2) poner("personas");
  return out.slice(0, max);
}
