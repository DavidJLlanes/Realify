/* ═══════════════════════════════════════════════════════════════
   HDR · DE DÓNDE SALEN LAS FOTOS
   · RAW: se preguntan una vez para todo el lote:
       – «Revelar la primera y aplicar lo mismo a las demás»: se abre el
         revelador RAW con la primera; sus ajustes (balance de blancos
         incluido) se aplican sin más pantallas al resto, que es lo que
         pide un horquillado para que las tomas casen entre sí.
       – «Revelar una a una»: el revelador RAW con cada foto.
       – «Usar el JPEG de todas»: la previsualización incrustada, rápida.
     La exposición de cada RAW sale de sus metadatos (LibRaw).
   · Fotos abiertas: las pestañas abiertas en Realify, cada una tal
     como se está editando (todas sus capas, ya compuestas).
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../js/ui/dialog.js";
import { toast } from "../js/ui/toast.js";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export async function isRaw(file){
  if(!file) return false;
  const { isRawFile } = await import("../raw/formats.js");
  return isRawFile(file);
}

/** EXIF mínimo (el que usa el HDR) a partir de los metadatos de LibRaw. */
export function exifFromRaw(m){
  if(!m) return null;
  const e = {
    exposureTime: +m.shutter || +m.exposure_time || undefined,
    fNumber: +m.aperture || +m.f_number || undefined,
    iso: +(m.iso_speed || m.iso || m.common?.real_ISO) || undefined
  };
  return e.exposureTime ? e : null;
}

/**
 * Convierte los RAW de la lista en lienzos. `fit(w, h)` → [w, h] de
 * trabajo; `busy(msg)` muestra el progreso. Devuelve
 * [{ file, name, canvas, exif }] (los que el usuario no canceló) o null
 * si canceló todo.
 */
export async function developRaws(files, { fit, busy }){
  const n = files.length;
  const buttons = [{ label: "Cancelar", value: null }, { label: "Usar el JPEG de todas", value: "jpeg" }];
  if(n > 1) buttons.push({ label: "Revelar una a una", value: "each" });
  buttons.push({ label: n > 1 ? "Revelar la primera y aplicar a todas" : "Revelar RAW", value: n > 1 ? "sync" : "each", primary: true });
  const how = await dialog({
    title: n === 1 ? "Archivo RAW" : `${n} archivos RAW`,
    body: `<p class="hint" style="margin:0 0 8px">${files.map(f => esc(f.name)).join(", ")}</p>
      ${n > 1 ? `<p class="hint" style="margin:0 0 6px"><b>Revelar la primera y aplicar a todas</b> (recomendado): ajustas una en el revelador RAW y el resto se revela igual, con el mismo balance de blancos, para que las tomas del horquillado casen.</p>
      <p class="hint" style="margin:0 0 6px"><b>Revelar una a una</b>: el revelador RAW se abre con cada foto.</p>` :
      `<p class="hint" style="margin:0 0 6px"><b>Revelar RAW</b>: se abre el revelador RAW con la foto.</p>`}
      <p class="hint" style="margin:0">${n > 1 ? "<b>Usar el JPEG de todas</b>" : "<b>Usar el JPEG</b>"}: la previsualización que guarda la cámara dentro del RAW. Es rápido, pero con menos margen en luces y sombras.</p>`,
    buttons, cls: "dlg-stack"
  });
  if(!how) return null;
  const out = [];
  if(how === "jpeg"){
    for(let k = 0; k < n; k++){
      busy(`Extrayendo el JPEG · ${k + 1} de ${n}`);
      try{ out.push(await rawThumbnail(files[k], fit)); }
      catch(err){ toast(`${files[k].name}: ${err.message}`, "err"); }
    }
    busy(null);
    return out;
  }
  let settings = null;
  for(let k = 0; k < n; k++){
    const f = files[k];
    if(how === "sync" && settings){
      busy(`Revelando con los mismos ajustes · ${k + 1} de ${n}: ${f.name}`);
      try{ out.push(await renderRaw(f, settings, fit)); }
      catch(err){ toast(`${f.name}: ${err.message}`, "err"); }
      continue;
    }
    busy(`Abriendo el RAW · ${k + 1} de ${n}`);
    const r = await developOne(f, { k, n, fit, initial: settings, busy, sync: how === "sync" });
    if(r){ out.push(r); settings = r.settings; }
    else if(how === "sync" && !settings){ busy(null); return out.length ? out : null; }   // cancelado el primero: nada que aplicar
  }
  busy(null);
  return out;
}

async function rawThumbnail(file, fit){
  const { RawDecoder } = await import("../raw/decoder.js");
  const { defaults } = await import("../raw/state.js");
  const dec = await RawDecoder.open(file, defaults(), { thumbnailOnly: true });
  try{
    let thumb;
    try{ thumb = await dec.thumbnail(); }catch{ throw new Error("no trae un JPEG incrustado utilizable; elige revelarlo"); }
    return { file, name: file.name, canvas: fitCanvas(thumb, fit), exif: exifFromRaw(dec.metadata) };
  }finally{ dec.dispose(); }
}

function developOne(file, { k, n, fit, initial, busy, sync = false }){
  return new Promise(async resolve => {
    const [{ RawDecoder }, { defaults }, { openDeveloper }] = await Promise.all([
      import("../raw/decoder.js"), import("../raw/state.js"), import("../raw/ui.js")]);
    const start = initial || defaults();
    let dec;
    try{ dec = await RawDecoder.open(file, start); }
    catch(err){ busy(null); toast(err.message, "err"); resolve(null); return; }
    busy(null);
    const metadata = dec.metadata;
    let done = false;
    openDeveloper({
      title: n > 1 ? `Revelar para HDR · ${k + 1} de ${n} · ${file.name}` : `Revelar para HDR · ${file.name}`,
      // En el móvil el título no se ve: el botón dice en qué foto se está.
      acceptLabel: sync && n > 1 ? `Aplicar a las ${n}` : k + 1 < n ? `Usar y seguir · ${k + 1}/${n}` : n > 1 ? `Usar en el HDR · ${n}/${n}` : "Usar en el HDR",
      source: dec.source, metadata, initial: start,
      outputSize: (w, h) => fit(w, h),
      onSettingChange: s => dec.renderBase(s),
      onClose: () => { dec?.dispose(); if(!done) resolve(null); },
      onAccept: async (result, settings) => {
        done = true;
        resolve({ file, name: file.name, canvas: result, exif: exifFromRaw(metadata), settings });
      }
    });
    dec.source = null;
  });
}

async function renderRaw(file, settings, fit){
  const [{ RawDecoder }, { RenderWorker }] = await Promise.all([import("../raw/decoder.js"), import("../raw/render-client.js")]);
  const dec = await RawDecoder.open(file, settings);
  const metadata = dec.metadata, src = dec.source;
  dec.source = null; dec.dispose();
  const w = new RenderWorker();
  try{
    let canvas;
    if(src.linear){
      const { width, height } = src;
      await w.setSource(src, { transfer: true });
      const [ow, oh] = fit(width, height);
      canvas = await w.renderToCanvas(settings, width, height, () => {}, ow, oh);
    }else{
      await w.setSource(src);
      const bmp = await w.render(settings);
      canvas = fitCanvas(bmp, fit); bmp.close?.();
    }
    return { file, name: file.name, canvas, exif: exifFromRaw(metadata) };
  }finally{ w.dispose(); }
}

function fitCanvas(img, fit){
  const [w, h] = fit(img.width, img.height);
  if(w === img.width && h === img.height && img instanceof HTMLCanvasElement) return img;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, w, h);
  return c;
}

/**
 * Elegir entre las fotos abiertas (pestañas). `tabs`: [{ id, title,
 * thumb, used }]. Con una sola disponible se devuelve directamente.
 * Devuelve la lista de ids elegidos.
 */
export async function pickOpenPhotos(tabs){
  const free = tabs.filter(t => !t.used);
  if(!free.length){ toast("Ya están todas las fotos abiertas en el HDR"); return []; }
  if(free.length === 1) return [free[0].id];
  let chosen = null;
  const res = await dialog({
    title: "Usar las fotos abiertas",
    body: `<p class="hint" style="margin:0 0 10px">Elige las fotos que forman el horquillado. Entran tal como las estás editando.</p>
      <div class="hdr-pick" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px">
      ${tabs.map(t => `<label style="display:grid;gap:4px;padding:6px;border:1px solid var(--line,#333);border-radius:8px;cursor:pointer;${t.used ? "opacity:.45;cursor:default" : ""}">
        <span style="display:flex;align-items:center;gap:6px"><input type="checkbox" value="${t.id}" ${t.used ? "disabled" : "checked"}><small style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</small></span>
        ${t.thumb ? `<img src="${t.thumb}" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;background:#111">` : ""}
        ${t.used ? `<small>Ya en el HDR</small>` : ""}
      </label>`).join("")}</div>`,
    buttons: [{ label: "Cancelar", value: null }, { label: "Añadir", primary: true, value: "ok" }],
    onOpen(body){ chosen = () => [...body.querySelectorAll("input:checked")].map(i => i.value === "null" ? null : +i.value); }
  });
  return res === "ok" && chosen ? chosen() : [];
}
