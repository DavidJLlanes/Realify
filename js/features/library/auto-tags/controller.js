/* ═══════════════════════════════════════════════════════════════
   ETIQUETAS AUTOMÁTICAS · FLUJO
   Mandos → foto visible reducida → registro de la IA (js/features/library/shared/indexar.js) → etiquetas + nombre propuesto → informe (copia/PDF/JSON).
   No toca los píxeles; con «Poner ese nombre al documento» sólo cambia doc.name. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { openReport } from "../../ai-kit/report-host.js";
import { doc } from "../../../core/doc.js";
import { toast } from "../../../core/toast.js";
import { indexarFoto } from "../shared/indexar.js";
import { etiquetasDe } from "./engine/etiquetas.js";
import { aplicarPlantilla, FICHAS } from "./engine/plantilla.js";
import { PARAMS } from "./params.js";

export async function ejecutar(){
  const src = await visibleImage(); if(!src) return;
  const r = await openSimple({ title: "Etiquetas y nombre 👑", subtitle: "Fichas: " + FICHAS.slice(0, 9).map(f => `{${f}}`).join(" "), params: PARAMS, applyLabel: "Etiquetar" });
  if(!r.ok) return;
  try{
    const k = Math.min(1, 640 / Math.max(src.width, src.height)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height);
    const { reg } = await indexarFoto(c), tags = etiquetasDe(reg), f = doc.source?.file;
    const nombre = aplicarPlantilla(r.values.plantilla, { fecha: f?.lastModified ? new Date(f.lastModified) : new Date(), etiquetas: tags, categoria: reg.catEtiqueta, color: reg.colores?.[0]?.[0], nombre: (f?.name || doc.name || "foto").replace(/\.[^.]+$/, ""), n: 1, ancho: src.width, alto: src.height });
    if(r.values.renombrar){ doc.name = nombre; }
    await openReport({ title: "Etiquetas 👑", resumen: `${src.width}×${src.height}`, nombre: "etiquetas", items: [
      { nivel: "info", titulo: "Etiquetas", texto: tags.length ? tags.join(", ") : "La IA no ha reconocido nada con seguridad." },
      { nivel: "info", titulo: "Nombre propuesto", texto: nombre + (r.values.renombrar ? " (puesto al documento)" : "") }
    ], datos: { etiquetas: tags, nombre, tipo: reg.catEtiqueta, colores: reg.colores } });
  } catch(err){ if(err && err.cancelled) return; toast("No se pudieron crear las etiquetas: " + (err.message || err), "err"); }
}
