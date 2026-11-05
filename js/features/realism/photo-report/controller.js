/* ═══════════════════════════════════════════════════════════════
   INFORME DE REALISMO · FLUJO
   Foto → medidas (nitidez, ruido, rango, zonas lisas) + Plausibilidad + metadatos → informe en diálogo con PDF y JSON. No toca la foto. Entradas: ninguna. Salida: promesa.
   ══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openReport } from "../../ai-kit/report-host.js";
import { doc } from "../../../core/doc.js";
import { toast } from "../../../core/toast.js";
import { toPlanes } from "../../portrait/shared/planes.js";
import { medir, juicio } from "../engine/informe.js";
import { mapaLiso } from "../engine/zonas.js";

const reducida = (src, lado) => {
  const k = Math.min(1, lado / Math.max(src.width, src.height)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height); return { c, x };
};

export async function ejecutar(){
  const src = await visibleImage(); if(!src) return;
  try{
    const { c, x } = reducida(src, 1024), px = x.getImageData(0, 0, c.width, c.height), m = medir(px.data, c.width, c.height);
    const items = juicio(m).map(i => ({ ...i, titulo: { nitidez: "Nitidez", ruido: "Ruido", rango: "Rango dinámico", recortes: "Recortes" }[i.clave] }));
    const z = mapaLiso(toPlanes(px.data, c.width, c.height));
    items.push({ nivel: z.cobertura > 0.35 ? "aviso" : "ok", titulo: "Zonas lisas", texto: `${(z.cobertura * 100).toFixed(0)} % de la foto no tiene textura de sensor` + (z.cobertura > 0.35 ? ": «Zonas demasiado lisas» puede añadirla." : ".") });
    const { measureAll } = await import("../../../analysis/metrics.js"), pl = measureAll(src);
    items.unshift({ nivel: pl.score >= 70 ? "ok" : "aviso", titulo: "Puntuación de plausibilidad", texto: `${pl.score} de 100` });
    let prov = null;
    const f = doc.source?.file;
    if(f){ const { detectProvenance, describeProvenance } = await import("../../../analysis/provenance.js"); prov = detectProvenance(await f.arrayBuffer()); items.push({ nivel: prov.aiDeclared ? "aviso" : "ok", titulo: "Metadatos del archivo", texto: describeProvenance(prov) + (prov.exif ? " Lleva EXIF." : " No lleva EXIF.") }); }
    else items.push({ nivel: "info", titulo: "Metadatos del archivo", texto: "No hay archivo original abierto: no se pueden revisar." });
    await openReport({ title: "Informe de realismo 👑", resumen: `${doc.name || "Documento"} · ${src.width}×${src.height}`, items, nombre: "informe-realismo",
      datos: { documento: doc.name || null, ancho: src.width, alto: src.height, plausibilidad: pl.score, medidas: m, zonasLisas: z.cobertura, procedencia: prov, avisos: items.filter(i => i.nivel === "aviso").map(i => i.texto) } });
  } catch(err){ toast("No se pudo crear el informe: " + (err.message || err), "err"); }
}
