/* ═══════════════════════════════════════════════════════════════
   BIBLIOTECA · INDEXAR UNA FOTO (lo usan Buscar fotos, Etiquetas y Texto alternativo)
   Con una copia reducida: la lente (js/filters/lens/classify.js: tipo de foto en español y las 10 clases de MobileNet) y los colores
   dominantes. Entradas: lienzo ≤ 640 px. Salida: { reg, mini } listo para guardar en el índice. El modelo se descarga sólo si hace falta.
   ═══════════════════════════════════════════════════════════════ */
import { coloresDominantes } from "../search-photos/engine/color.js";

export async function indexarFoto(c){
  const { classify } = await import("../../../filters/lens/classify.js"), { CATEGORY_BY_ID, GROUPS } = await import("../../../filters/lens/categories.js");
  const k = Math.min(1, 96 / Math.max(c.width, c.height)), p = document.createElement("canvas"); p.width = Math.max(1, Math.round(c.width * k)); p.height = Math.max(1, Math.round(c.height * k));
  p.getContext("2d").drawImage(c, 0, 0, p.width, p.height);
  const col = coloresDominantes(p.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, p.width, p.height).data, p.width, p.height);
  const r = await classify(c), cat = r.category ? CATEGORY_BY_ID[r.category] : null, grupo = cat ? GROUPS.find(g => g.id === cat.group)?.label || "" : "";
  const m = r.measures || {};
  const reg = { cat: r.category, catEtiqueta: cat ? cat.label : "", grupo, top: (r.model?.top || []).map(t => ({ label: t.label, p: +t.p.toFixed(3) })), colores: col.colores, brillo: col.brillo, sat: col.sat, bn: m.sat != null ? m.sat < 0.045 && m.maxSat < 0.2 : col.sat < 0.05, piel: +(m.skin || 0).toFixed(3) };
  const t = document.createElement("canvas"), kk = Math.min(1, 160 / Math.max(c.width, c.height)); t.width = Math.max(1, Math.round(c.width * kk)); t.height = Math.max(1, Math.round(c.height * kk)); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
  const mini = await new Promise(ok => t.toBlob(ok, "image/jpeg", 0.7));
  return { reg, mini };
}
