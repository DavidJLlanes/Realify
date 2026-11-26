/* ═══════════════════════════════════════════════════════════════
   IO · GUARDAR SOBRE EL MISMO ARCHIVO (Archivo › Guardar, Ctrl+S)
   En Chrome y Edge de escritorio «Abrir imagen» usa el selector del sistema que devuelve un «permiso» sobre el archivo
   (File System Access API). Con él, Guardar escribe la imagen editada ENCIMA del archivo abierto, en su mismo formato,
   sin descargar una copia. Conserva los metadatos del original (EXIF, XMP, IPTC), que se leen ANTES de la primera escritura.
   Entradas: abrirConPermiso() (desde promptOpen) · puedeGuardarEncima() · guardar() (Ctrl+S).
   Salidas: abrirConPermiso → File[] | null (null = este navegador no puede, usa el selector de siempre).
   Límites: sólo JPEG, PNG y WebP (los demás formatos van a Exportar); la primera vez en cada documento pide confirmación porque
   sobrescribir el original no se puede deshacer. Sin permiso (móvil, Safari, Firefox) Ctrl+S sigue guardando el proyecto.
   ═══════════════════════════════════════════════════════════════ */
import { doc } from "../core/doc.js";
import { toast } from "../core/toast.js";
import { dialog } from "../ui/kit/dialog.js";

const TIPOS = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const permisos = new WeakMap();          // File abierto → { handle, meta (metadatos del original, leídos una vez), ok (ya confirmado) }

const escritorio = () => !matchMedia("(pointer:coarse)").matches;
const tipoDe = nombre => TIPOS[(/\.([a-z0-9]+)$/i.exec(nombre || "") || [])[1]?.toLowerCase()];

/** Selector del sistema con permiso de escritura. null si este navegador no lo tiene (o en el móvil): se usa el de siempre. */
export async function abrirConPermiso(accept){
  if(typeof window.showOpenFilePicker !== "function" || !escritorio()) return null;
  const exts = String(accept || "").split(",").map(s => s.trim()).filter(s => /^\.[a-z0-9]+$/i.test(s));
  let handles;
  try{
    handles = await window.showOpenFilePicker({ multiple: true, excludeAcceptAllOption: false,
      types: [{ description: "Imágenes", accept: { "image/*": exts.length ? exts : [".jpg", ".jpeg", ".png", ".webp"] } }] });
  }catch(err){ if(err?.name === "AbortError") return []; throw err; }
  const files = [];
  for(const handle of handles){
    const file = await handle.getFile();
    permisos.set(file, { handle, meta: undefined, ok: false });
    files.push(file);
  }
  return files;
}

const entrada = () => doc.open && doc.source?.file ? permisos.get(doc.source.file) : null;

/** ¿El documento activo vino de un archivo con permiso y en un formato que se puede reescribir? */
export const puedeGuardarEncima = () => { const e = entrada(); return !!(e && tipoDe(e.handle.name)); };

/** Ctrl+S: sobre el archivo abierto si se puede; si no, «Guardar proyecto» (lo de siempre). */
export async function guardar(){
  if(!puedeGuardarEncima()) return (await import("./project.js")).saveProject();
  const e = entrada(), nombre = e.handle.name, type = tipoDe(nombre);
  if(!e.ok){
    const r = await dialog({ title: "Guardar sobre el archivo",
      body: Object.assign(document.createElement("p"), { textContent: `Se sobrescribirá «${nombre}» con la imagen editada. El archivo original no se podrá recuperar (tus capas y el historial siguen aquí). Para conservarlo, usa Exportar.` }),
      buttons: [{ label: "Cancelar", value: null }, { label: "Sobrescribir", primary: true, value: "si" }] });
    if(r !== "si") return;
  }
  try{
    if(await e.handle.queryPermission?.({ mode: "readwrite" }) !== "granted" && await e.handle.requestPermission?.({ mode: "readwrite" }) !== "granted"){
      toast("Sin permiso para escribir en el archivo: usa Exportar", "err"); return;
    }
    const M = await import("./meta/metadata.js");
    // Metadatos del original: se leen una sola vez, antes de la primera escritura (después el archivo ya es el editado)
    if(e.meta === undefined) e.meta = await M.readOriginalMetadata(doc.source.file).catch(() => null);
    const { renderExport } = await import("./export/export.js");
    let blob = await renderExport({ w: doc.w, h: doc.h, type, quality: type === "image/png" ? undefined : 0.95, alpha: type !== "image/jpeg" });
    if(!blob) throw new Error("no se pudo codificar la imagen");
    if(e.meta){
      const meta = M.filterMetadata(e.meta, M.META_PRESETS.all, { w: doc.w, h: doc.h });
      if(meta.exif || meta.xmp || meta.iptc) blob = await M.embedMetadata(blob, meta);
    }
    const w = await e.handle.createWritable();
    try{ await w.write(blob); } finally { await w.close(); }
    e.ok = true;
    toast(`Guardado en «${nombre}»`, "ok");
  }catch(err){
    console.error(err);
    toast("No se pudo guardar sobre el archivo: " + (err.message || err), "err");
  }
}
