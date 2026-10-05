/* Limpieza de metadatos. Dos caminos, según lo que se quiera de
   verdad:

   - El archivo original tal cual (o uno suelto elegido a mano): se
     recorren sus segmentos y se descartan los que llevan metadatos,
     sin volver a codificar. Es la única forma de quitar EXIF sin
     perder ni un bit de calidad, pero trabaja sobre los bytes
     originales, así que cualquier edición hecha en esta sesión no
     está en el resultado.

   - El documento tal como está ahora mismo, editado: se compone y se
     codifica de nuevo. Un archivo recién codificado por el lienzo ya
     sale sin metadatos —el EXIF no viaja solo, alguien tiene que
     copiarlo a propósito—, así que esta vía nunca llama al panel EXIF
     aunque esté activado: es la exportación "sin preguntar nada". */

import { stripJPEG, stripPNG } from "./strip.js";
import { detectProvenance } from "../analysis/provenance.js";
import { download, saveOrShare, renderExport, stamp } from "./export.js";
import { doc } from "../core/doc.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";

async function stripBytes(file, keepICC, out, mode = "all"){
  out.textContent = "Procesando…";
  try{
    const u8 = new Uint8Array(await file.arrayBuffer());
    const isPNG = u8[0] === 0x89 && u8[1] === 0x50;
    /* Se mira ANTES de limpiar: los limpiadores van por lista blanca y
       se llevan por delante las credenciales de contenido sin nombrarlas,
       así que sin esto el informe diría «caBX» y ya está. */
    const found = detectProvenance(u8);
    const res = isPNG ? stripPNG(u8, keepICC) : stripJPEG(u8, keepICC);
    if(!res){
      out.innerHTML = `<span style="color:var(--bad)">Sólo JPEG y PNG.</span>`;
      return;
    }
    const type = isPNG ? "image/png" : "image/jpeg";
    let blob = new Blob(res.parts, { type });
    /* «Quitar sólo la ubicación y los números de serie»: se vuelve a escribir lo demás (fecha, cámara, autor,
       descripción y la orientación) desde el propio archivo, filtrado (io/metadata.js). Sin miniatura ni notas
       del fabricante, que pueden revelar lo mismo. */
    let kept = "";
    if(mode === "keep"){
      const M = await import("./metadata.js");
      const policy = { ...M.META_PRESETS.nogps };                  // todo salvo ubicación y números de serie
      const meta = M.filterMetadata(await M.readOriginalMetadata(file), policy, { original: true });
      const withMeta = await M.embedMetadata(blob, meta);
      if(withMeta !== blob){ blob = withMeta; kept = M.describeMeta(meta, policy); }
    }
    await saveOrShare(blob, file.name.replace(/\.[^.]+$/, "") + "-limpio." + (isPNG ? "png" : "jpg"));

    const head = mode === "keep"
      ? `<b style="color:var(--ok)">Ubicación, números de serie, miniatura y notas del fabricante fuera.</b>` + (kept ? ` Se conserva: ${kept}.` : "")
      : res.removed
        ? `<b style="color:var(--ok)">${res.removed.toLocaleString("es-ES")} bytes fuera</b>: ${res.kinds.join(", ")}`
        : "No había metadatos que quitar.";
    const notes = [];
    if(found.aiDeclared) notes.push(`El original declaraba material generado por un modelo (${found.sourceType}).`);
    if(found.c2pa) notes.push("Llevaba credenciales de contenido C2PA firmadas; se han quitado con el resto.");
    notes.push("Esto sólo quita lo que va escrito en el archivo: una marca " +
               "incrustada en los propios píxeles no se ve ni se elimina así.");
    out.innerHTML = `${head}<br><span class="hint">${notes.join(" ")}</span>`;
  }catch(err){
    out.innerHTML = `<span style="color:var(--bad)">No se pudo leer el archivo.</span>`;
  }
}

export async function openStrip(){
  const hasOpenFile = doc.open && doc.source && doc.source.file;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    ${hasOpenFile ? `
    <div class="section-label">Este documento</div>
    <p class="hint">Limpia el archivo <b>original</b> tal como se abrió
      (${doc.source.name}), sin recomprimir. Si has editado la imagen en esta
      sesión, esos cambios no estarán en el resultado: para eso usa la otra
      opción, la de exportar lo editado.</p>
    <button id="stripOpen" class="wide primary">Limpiar el original abierto</button>
    <p class="hint" style="margin:10px 0 0">¿Prefieres el resultado con tus
      ediciones, aunque se recodifique? Exporta directamente sin activar el
      panel EXIF, o usa el botón de aquí abajo para un PNG sin preguntar nada.</p>
    <button id="exportClean" class="wide">Exportar lo editado, sin metadatos</button>
    <p class="hint" id="outOpen" style="margin-top:8px"></p>
    <hr>
    <div class="section-label">Otro archivo</div>` : ""}
    <p class="hint">Elimina EXIF, XMP, IPTC, comentarios y perfiles de un JPEG o un
      PNG <b>sin recomprimir</b>: se recorren los segmentos del archivo y se
      descartan los que llevan metadatos. Los datos de imagen quedan intactos.</p>
    <div class="field"><label>Quitar</label>
      <select id="stripMode" class="grow">
        <option value="all">Todo</option>
        <option value="keep">Sólo ubicación y números de serie</option>
      </select></div>
    <p class="hint" id="stripModeHint">«Sólo ubicación…» conserva fecha, cámara, autor, descripción y orientación, sin miniatura ni notas del fabricante.</p>
    <label class="chk"><input type="checkbox" id="keepICC" checked>
      Conservar el perfil de color (ICC)</label>
    <p class="hint">Sin el perfil, algunos visores interpretan mal los colores de
      imágenes que no estén en sRGB.</p>
    <button id="pick" class="wide${hasOpenFile ? "" : " primary"}" style="margin-top:8px">Elegir archivo…</button>
    <p class="hint" id="out" style="margin-top:10px"></p>`;

  const dlg = dialog({
    title:"Limpiar metadatos", body: wrap,
    buttons:[{ label:"Cerrar", primary:true }]
  });

  if(hasOpenFile){
    wrap.querySelector("#stripOpen").addEventListener("click", () =>
      stripBytes(doc.source.file, wrap.querySelector("#keepICC").checked,
                 wrap.querySelector("#outOpen"), wrap.querySelector("#stripMode").value));

    wrap.querySelector("#exportClean").addEventListener("click", async () => {
      const out = wrap.querySelector("#outOpen");
      out.textContent = "Exportando…";
      status("Exportando…");
      const blob = await renderExport({ w: doc.w, h: doc.h, type: "image/png" });
      status("");
      if(!blob){ out.innerHTML = `<span style="color:var(--bad)">La exportación falló.</span>`; return; }
      await saveOrShare(blob, `${doc.name || "realify"}-${stamp()}-limpio.png`);
      out.innerHTML = `<b style="color:var(--ok)">Exportado</b>: PNG recién codificado, sin EXIF.`;
    });
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png";
  input.hidden = true;
  wrap.appendChild(input);

  wrap.querySelector("#pick").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const f = input.files[0];
    input.value = "";
    if(f) stripBytes(f, wrap.querySelector("#keepICC").checked, wrap.querySelector("#out"), wrap.querySelector("#stripMode").value);
  });

  await dlg;
}
