/* ═══════════════════════════════════════════════════════════════
   PROCESADO POR LOTES
   Aplica el filtro Realify a un montón de imágenes sin tocar el
   documento abierto. Cada archivo sale con sus parámetros desviados
   y su propia semilla: veinte salidas con la misma configuración
   comparten firma de ruido, y eso es justo lo que se quiere evitar.
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../ui/dialog.js";
import { toast, status, progress } from "../ui/toast.js";
import { download, saveOrShare, stamp } from "./export.js";
import { buildZip, ZIP_LIMIT } from "./zip.js";
import { varyStages } from "../filters/camera/state.js";
import { compatibleFile, decodeAny } from "./compatibility.js";

let running = false;

export async function openBatch(){
  if(running){ toast("Ya hay un lote en marcha"); return; }

  const picker = document.getElementById("filePickerMulti");
  const files = await new Promise(res => {
    const onChange = () => {
      picker.removeEventListener("change", onChange);
      // El mismo criterio que «Abrir imagen»: PSD, HEIC o DNG suelen
      // llegar con el tipo vacío en Windows y antes se descartaban sin
      // decir nada.
      const f = [...picker.files].filter(compatibleFile);
      picker.value = "";
      res(f);
    };
    picker.addEventListener("change", onChange);
    picker.click();
  });
  if(!files.length) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p class="hint">${files.length} imágenes seleccionadas. Se les aplicará el filtro
      Realify con los ajustes que tengas puestos.</p>
    <div class="field"><label>Formato</label>
      <select id="bType" class="grow">
        <option value="image/jpeg">JPEG</option>
        <option value="image/png">PNG</option>
      </select></div>
    <div class="field"><label>Lado mayor</label>
      <input type="number" id="bMax" class="grow" min="0" max="16384" value="0">
      <span class="unit">px</span></div>
    <p class="hint">0 mantiene el tamaño original de cada imagen.</p>
    <label class="chk"><input type="checkbox" id="bVary" checked>
      Variar los parámetros en cada una</label>
    <label class="chk"><input type="checkbox" id="bZip" checked>
      Entregar todo en un ZIP</label>
    <p class="hint">Sin ZIP, el navegador estrangula las descargas seguidas y hay que
      esperar entre una y otra.</p>`;

  const go = await dialog({
    title:"Procesar carpeta", body: wrap,
    buttons:[{ label:"Cancelar", value:null },
             { label:`Procesar ${files.length}`, primary:true, value:"go" }]
  });
  if(go !== "go") return;

  const type = wrap.querySelector("#bType").value;
  const maxSide = Math.max(0, +wrap.querySelector("#bMax").value || 0);
  const vary = wrap.querySelector("#bVary").checked;
  const asZip = wrap.querySelector("#bZip").checked;
  const ext = type === "image/png" ? "png" : "jpg";

  const { filterState } = await import("../filters/camera/ui.js");
  const engine = await import("../filters/camera/engine.js");
  const { applyCpuStages } = await import("../filters/camera/cpustages.js");
  const exif = await import("../exif/ui.js");

  if(!engine.available()){
    toast("El filtro necesita WebGL2 y no está disponible", "err");
    return;
  }

  running = true;
  const base = JSON.parse(JSON.stringify(filterState.stages));
  const baseSeed = filterState.seed;
  /* La huella del sensor se fija UNA vez para todo el lote: es lo que
     hace que las imágenes parezcan salidas de la misma cámara. Sólo la
     semilla de disparo se sortea por imagen, como el grano real. */
  engine.setCameraSeed(filterState.camSeed);
  const entries = [];
  let zipBytes = 0, overflow = false, done = 0, failed = 0;

  /* Las fotos de un lote son, verosímilmente, de una misma sesión:
     minutos entre ellas, no tres años. */
  let sessionT = exif.exifState.on ? exif.exifValues(false).date.getTime() : null;

  const cv = document.createElement("canvas");
  const cx = cv.getContext("2d");

  try{
    for(let i = 0; i < files.length; i++){
      const f = files[i];
      status(`Lote ${i + 1} de ${files.length}: ${f.name}`);
      progress(i / files.length);

      let bmp;
      try{ bmp = await decodeAny(f); }
      catch{ failed++; continue; }

      let w = bmp.width, h = bmp.height;
      if(maxSide && Math.max(w, h) > maxSide){
        const s = maxSide / Math.max(w, h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
      cv.width = w; cv.height = h;
      cx.drawImage(bmp, 0, 0, w, h);
      if(typeof bmp.close === "function") bmp.close();

      if(vary){
        // Se parte siempre del ajuste original, no del ya desviado, o
        // el lote entero derivaría poco a poco hacia otro sitio.
        filterState.stages = JSON.parse(JSON.stringify(base));
        filterState.seed = Math.floor(Math.random() * 99999);
        varyStages(filterState.stages);
      }

      engine.invalidateCache();
      engine.setSeed(filterState.seed);
      if(!engine.setSource(cv)){ failed++; continue; }
      engine.renderTo(cx, filterState.stages, { dose: filterState.dose / 100, stable:true });
      // Las mismas etapas de CPU, en el mismo orden, que el botón
      // Aplicar: el lote saltaba la limpieza espectral y sólo hacía el
      // JPEG, así que sus salidas no eran las del panel.
      await applyCpuStages(cv, filterState.stages, filterState.dose / 100, status);

      const q = type === "image/jpeg"
        ? engine.jpegQuality(filterState.stages, filterState.dose / 100) : undefined;
      const blob = await new Promise(r => cv.toBlob(r, type, q));
      if(!blob){ failed++; continue; }

      let d = null;
      if(sessionT !== null){
        sessionT += Math.round(4000 + Math.random() * 260000);   // 4 s a 4½ min
        d = new Date(sessionT);
      }
      const out = await exif.withExif(blob, w, h, true, d);
      const name = (exif.useCameraNaming() && type === "image/jpeg")
        ? exif.cameraName()
        : f.name.replace(/\.[^.]+$/, "") + "-realify." + ext;

      if(asZip && !overflow){
        if(zipBytes + out.size > ZIP_LIMIT){
          overflow = true;
          toast("El lote no cabe en un ZIP; se pasa a descargas sueltas");
          for(const e of entries) download(new Blob([e.data]), e.name);
          entries.length = 0;
          download(out, name);
          await pause(180);
        } else {
          entries.push({ name, data: new Uint8Array(await out.arrayBuffer()),
                         date: d || new Date() });
          zipBytes += out.size;
        }
      } else {
        download(out, name);
        await pause(180);
      }
      done++;
      await pause(0);
    }

    if(asZip && entries.length){
      status(`Empaquetando ${entries.length} archivos…`);
      await pause(0);
      await saveOrShare(buildZip(entries), `realify-${stamp()}.zip`);
    }
  } finally {
    // Pase lo que pase, los ajustes del filtro vuelven a como estaban
    filterState.stages = base;
    filterState.seed = baseSeed;
    engine.invalidateCache();
    running = false;
    progress(null);
  }

  status("");
  toast(failed
    ? `Lote terminado: ${done} de ${files.length} (${failed} con error)`
    : `Lote terminado: ${done} imágenes`, failed ? "" : "ok");
}

const pause = ms => new Promise(r => setTimeout(r, ms));
