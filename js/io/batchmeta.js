/* ═══════════════════════════════════════════════════════════════
   METADATOS EN LAS EXPORTACIONES EN LOTE (v255)
   El lote («Editar en lote») y las Acciones en lote entregan un ZIP con cada foto recodificada: sin esto, sus metadatos se perdían.
   - «Conservar los metadatos del original»: cada foto lleva los suyos (autor, fecha, cámara, texto), sin ubicación ni números de serie.
   - «Aplicar mis campos»: título, descripción, autor, copyright y palabras clave de «Editar metadatos al exportar» del documento desde el que se
     lanza el lote, en todas las fotos (la fecha y la ubicación son de cada foto: no se reparten).
   ═══════════════════════════════════════════════════════════════ */
import { doc } from "../core/doc.js";
import { META_PRESETS, META_NONE } from "./metapresets.js";

/** Campos editados que tiene sentido repartir a todas las fotos del lote (copia), o null. Se lee antes de abrir la primera foto. */
export function sharedFields(){
  const o = doc.open && doc.metaEdit;
  if(!o) return null;
  const f = { title: o.title || "", description: o.description || "", author: o.author || "", copyright: o.copyright || "", keywords: [...(o.keywords || [])] };
  return f.title || f.description || f.author || f.copyright || f.keywords.length ? f : null;
}

/** Incrusta en `blob` (ya exportado de la foto abierta) los metadatos que pide el lote; devuelve el mismo blob si no hay nada que escribir o falla. */
export async function embedForBatch(blob, { keep = false, fields = null } = {}){
  try{
    if(!keep && !fields) return blob;
    const M = await import("./metadata.js");
    const file = doc.source && doc.source.file, orig = keep && file ? await M.readOriginalMetadata(file) : null;
    const meta = M.filterMetadata(orig, orig ? META_PRESETS.nogps : META_NONE, { w: doc.w, h: doc.h, over: fields });
    if(!meta.exif && !meta.xmp && !meta.iptc) return blob;
    return await M.embedMetadata(blob, meta);
  }catch(err){ console.warn("[lote] metadatos", err); return blob; }
}
