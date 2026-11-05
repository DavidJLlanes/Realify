/* ═══════════════════════════════════════════════════════════════
   NOMBRES DE ARCHIVO · PLANTILLAS (motor puro, sin DOM)
   «{fecha}_{etiqueta}_{n}» → «2026-11-05_perro_001». Fichas: {fecha} {año} {mes} {dia} {hora} {etiqueta} {etiqueta2} {etiquetas} {categoria} {color}
   {nombre} {n} {ancho} {alto}. Lo que falta queda vacío y los separadores sobrantes se limpian. El resultado es un nombre seguro (minúsculas, sin acentos).
   Entradas: plantilla y datos { fecha:Date, etiquetas:[], categoria, color, nombre, n, ancho, alto }. Salida: texto sin extensión.
   Lo usan Etiquetas automáticas y la exportación por lotes (F13.5).
   ═══════════════════════════════════════════════════════════════ */
export const FICHAS = ["fecha", "año", "mes", "dia", "hora", "etiqueta", "etiqueta2", "etiquetas", "categoria", "color", "nombre", "n", "ancho", "alto"];

export const seguro = (s, max = 80) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/[-_.]{2,}/g, m => m[0]).replace(/^[-_.]+|[-_.]+$/g, "").slice(0, max);
const dos = n => String(n).padStart(2, "0");

export function aplicarPlantilla(plantilla, d = {}){
  const f = d.fecha instanceof Date && !isNaN(d.fecha) ? d.fecha : new Date(), et = d.etiquetas || [];
  const V = {
    fecha: `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`, "año": String(f.getFullYear()), mes: dos(f.getMonth() + 1), dia: dos(f.getDate()), hora: `${dos(f.getHours())}${dos(f.getMinutes())}`,
    etiqueta: et[0] || "", etiqueta2: et[1] || "", etiquetas: et.slice(0, 3).join("-"), categoria: d.categoria || "", color: d.color || "", nombre: d.nombre || "",
    n: String(d.n ?? 1).padStart(3, "0"), ancho: d.ancho ? String(d.ancho) : "", alto: d.alto ? String(d.alto) : ""
  };
  const t = String(plantilla || "{nombre}").replace(/\{([^{}]+)\}/g, (_, k) => seguro(V[k.trim().toLowerCase()] ?? "", 40));
  return seguro(t) || "foto";
}
