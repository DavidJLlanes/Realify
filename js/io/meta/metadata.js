/* ═══════════════════════════════════════════════════════════════
   METADATOS DEL ORIGINAL AL EXPORTAR (fase 15 de docs/PENDIENTE.md)

   El lienzo del navegador codifica sin metadatos: un JPEG, PNG o WebP exportado sale
   «limpio». Aquí se puede, a elección de la persona, volver a escribir parte de lo que traía
   el archivo original, filtrado:

     autor       Artist y Copyright (EXIF), By-line, Copyright, Credit y Source (IPTC), creador,
                 derechos y términos de uso (XMP)
     fecha       fecha y hora de la toma (EXIF, IPTC y XMP)
     cámara      marca, modelo, objetivo, exposición, ISO, flash… (EXIF estándar)
     gps         ubicación GPS (EXIF) y lugar (IPTC y XMP)
     texto       descripción, comentarios, título y palabras clave
     ids         números de serie e identificador único de la imagen (sólo con «Todos»)

   Siempre se descartan: la miniatura incrustada (enseña el original SIN recortar ni retocar,
   un clásico agujero de privacidad), las notas del fabricante (MakerNote: números de serie,
   contadores, nombre del propietario), la orientación (el lienzo ya sale girado) y el perfil
   ICC del original (los píxeles ya están convertidos al espacio del documento; el perfil de
   éste lo incrusta la exportación como siempre).

   Por construcción es una LISTA BLANCA: nada se copia que no esté nombrado aquí. El EXIF se
   reescribe etiqueta a etiqueta (sea el original big o little endian); IPTC y XMP se construyen
   de nuevo con los campos permitidos, no se filtran los originales.
   ═══════════════════════════════════════════════════════════════ */

import "../../exif/quick-exif.js";
import "../../exif/writer.js";
import "../formats/zip.js";
export { parseTiff, parseIim, iimFromProfile, readIptcAny, readIptc, readXmp, readXmpExtended, readOriginalMetadata } from "./metadata/read.js";
export { parseLocalDate, buildFilteredExif, buildIim, buildIptc, wrapIim, buildXmp, filterMetadata, fieldsFromXmp, fieldsFromOriginal } from "./metadata/build-exif.js";
export { xmpSegments, md5hex, embedMetadata } from "./metadata/inject.js";

export { META_NONE, META_PRESETS, metaActive } from "./metapresets.js";

/* ── ExifReader (MPL-2.0, sin modificar) bajo demanda ─────────────── */
let xrLoading = null;

export function loadExifReader(){
  if(globalThis.ExifReader) return Promise.resolve(globalThis.ExifReader);
  if(xrLoading) return xrLoading;
  xrLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../../vendor/exifreader/exif-reader.js", import.meta.url).href;
    s.onload = () => globalThis.ExifReader ? resolve(globalThis.ExifReader) : reject(new Error("ExifReader no arrancó"));
    s.onerror = () => reject(new Error("No se pudo cargar el lector de metadatos"));
    document.head.appendChild(s);
  }).finally(() => { if(!globalThis.ExifReader) xrLoading = null; });
  return xrLoading;
}

/** Texto corto de lo que lleva `meta`, para el aviso tras exportar. */
export function describeMeta(meta, policy, over = null){
  const parts = [];
  if(meta.exif || meta.xmp || meta.iptc){
    if(policy.author || (over && (over.author || over.copyright))) parts.push("autor");
    if(policy.date || (over && over.date)) parts.push("fecha");
    if(policy.camera) parts.push("cámara");
    if(policy.gps || (over && Number.isFinite(over.lat))) parts.push("GPS");
    if(policy.text || (over && (over.description || over.title || (over.keywords || []).length))) parts.push("descripción");
    if(policy.maker) parts.push("notas del fabricante");
  }
  return parts.join(", ");
}
