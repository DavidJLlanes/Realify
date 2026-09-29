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
export async function developRaws(files, { fit, busy, premium = false }){
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
      try{ out.push(await renderRaw(f, settings, fit, premium)); }
      catch(err){ toast(`${f.name}: ${err.message}`, "err"); }
      continue;
    }
    busy(`Abriendo el RAW · ${k + 1} de ${n}`);
    const r = await developOne(f, { k, n, fit, initial: settings || (premium ? { premium: true } : null), busy, sync: how === "sync" });
    if(r && premium){
      busy(`Preparando los datos lineales del RAW · ${k + 1} de ${n}`);
      try{ Object.assign(r, await linearOf(f, r.settings, fit)); }catch(err){ toast(`${f.name}: ${err.message}`, "err"); }
    }
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
    const start = { ...defaults(), ...(initial || {}) };
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

async function renderRaw(file, settings, fit, premium = false){
  const [{ RawDecoder }, { RenderWorker }] = await Promise.all([import("../raw/decoder.js"), import("../raw/render-client.js")]);
  const dec = await RawDecoder.open(file, settings);
  const metadata = dec.metadata, src = dec.source;
  dec.source = null; dec.dispose();
  const w = new RenderWorker();
  let extra = {};
  try{
    let canvas;
    if(src.linear){
      const { width, height } = src;
      // El worker se queda con la fuente: si el revelado ya es Premium,
      // los datos lineales para el HDR salen de la misma decodificación.
      const meta = { gain: src.gain, base: src.base };
      await w.setSource(src, { transfer: true });
      const [ow, oh] = fit(width, height);
      canvas = settings?.premium ? await w.renderPremium(settings, width, height, () => {}, ow, oh)
                                 : await w.renderToCanvas(settings, width, height, () => {}, ow, oh);
      if(premium && settings?.premium) extra = await linearFromWorker(w, settings, width, height, ow, oh, meta);
    }else{
      await w.setSource(src);
      const bmp = await w.render(settings);
      canvas = fitCanvas(bmp, fit); bmp.close?.();
    }
    if(premium && !extra.lin) extra = await linearOf(file, settings, fit);
    return { file, name: file.name, canvas, exif: exifFromRaw(metadata), ...extra };
  }finally{ w.dispose(); }
}

/* ── Datos lineales para la fusión HDR Premium ──────────────────
   La escena en luz lineal Rec.2020 (balance, óptica, ruido y exposición
   del revelador aplicados; sin tono), a tamaño de trabajo, en Uint16
   ×16 384, y el nivel de recorte del sensor en esas unidades por canal
   (para no fusionar luces quemadas). Siempre con el motor Premium. */
async function linearFromWorker(w, settings, width, height, ow, oh, meta){
  const [{ premiumParams }, { wbGains }] = await Promise.all([import("../raw/premium/core.js"), import("../raw/tone.js")]);
  const lin = await w.renderLinear(settings, width, height, () => {}, ow, oh);
  const P = premiumParams(settings, wbGains(settings));
  // El blanco del sensor queda en 1 × exposición base (el margen de
  // `gain` sólo compensa el paso de menos del motor, no añade techo).
  const clip = P.wb.map(v => v * P.exposure * (meta.base || 1));
  return { lin, clip };
}
async function linearOf(file, settings, fit){
  const [{ RawDecoder }, { RenderWorker }] = await Promise.all([import("../raw/decoder.js"), import("../raw/render-client.js")]);
  const s = { ...settings, premium: true };
  const dec = await RawDecoder.open(file, s), src = dec.source;
  dec.source = null; dec.dispose();
  const w = new RenderWorker();
  try{
    const meta = { gain: src.gain, base: src.base }, { width, height } = src;
    await w.setSource(src, { transfer: true });
    const [ow, oh] = fit(width, height);
    return await linearFromWorker(w, s, width, height, ow, oh, meta);
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
 * Elegir hasta `max` elementos de una lista, con casillas y un contador
 * que no deja pasar del límite (al llegar, las demás casillas se
 * desactivan). `items`: [{ id, label, thumb?, note?, locked? }]; los
 * `locked` se muestran pero no se pueden elegir. Las primeras `max`
 * libres salen marcadas. Devuelve los ids elegidos o [] si se cancela.
 * No abre ni decodifica nada: con una selección enorme la app no se
 * queda colgada procesando fotos que no van a entrar.
 */
export async function chooseUpTo({ title, intro, items, max, okLabel = "Añadir" }){
  let chosen = null;
  const free = items.filter(t => !t.locked);
  const pre = new Set(free.slice(0, max).map(t => String(t.id)));
  const withThumbs = items.some(t => t.thumb);
  const res = await dialog({
    title, cls: "dlg-stack",
    body: `<p class="hint" style="margin:0 0 8px">${intro}</p>
      <p class="hint hdr-count" style="margin:0 0 10px;font-weight:600"></p>
      <div class="hdr-pick" style="display:grid;grid-template-columns:${withThumbs ? "repeat(auto-fill,minmax(96px,1fr))" : "1fr"};gap:${withThumbs ? 8 : 4}px;max-height:52vh;overflow:auto">
      ${items.map(t => `<label style="display:grid;gap:4px;padding:${withThumbs ? 6 : 7}px;border:1px solid var(--line,#333);border-radius:8px;cursor:pointer;${t.locked ? "opacity:.45;cursor:default" : ""}">
        <span style="display:flex;align-items:center;gap:8px;min-width:0"><input type="checkbox" value="${esc(t.id)}" ${t.locked ? "disabled" : pre.has(String(t.id)) ? "checked" : ""}><small style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.label)}</small></span>
        ${t.thumb ? `<img src="${t.thumb}" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;background:#111">` : ""}
        ${t.note ? `<small>${esc(t.note)}</small>` : ""}
      </label>`).join("")}</div>`,
    buttons: [{ label: "Cancelar", value: null }, { label: okLabel, primary: true, value: "ok" }],
    onOpen(body){
      const boxes = [...body.querySelectorAll('input[type=checkbox]:not([disabled])')];
      const count = body.querySelector(".hdr-count");
      const ok = body.closest(".modal")?.querySelector(".modal-foot button.primary");
      const sync = () => {
        const n = boxes.filter(b => b.checked).length;
        count.textContent = `${n} de ${max} elegidas` + (n >= max ? " · no caben más" : "");
        for(const b of boxes) if(!b.checked){ b.disabled = n >= max; b.closest("label").style.opacity = n >= max ? ".5" : ""; }
        if(ok) ok.disabled = n === 0;
      };
      body.addEventListener("change", sync);
      sync();
      chosen = () => boxes.filter(b => b.checked).map(b => b.value);
    }
  });
  return res === "ok" && chosen ? chosen() : [];
}

/**
 * Elegir entre las fotos abiertas (pestañas). `tabs`: [{ id, title,
 * thumb, used }], `room`: cuántas caben aún en el HDR. Con una sola
 * disponible (y sitio) se devuelve directamente.
 */
export async function pickOpenPhotos(tabs, room){
  const free = tabs.filter(t => !t.used);
  if(!free.length){ toast("Ya están todas las fotos abiertas en el HDR"); return []; }
  if(free.length === 1) return [free[0].id];
  const ids = await chooseUpTo({
    title: "Usar las fotos abiertas",
    intro: `Elige las fotos que forman el horquillado (caben ${room} más; el máximo del HDR son 11). Entran tal como las estás editando.`,
    items: tabs.map(t => ({ id: t.id, label: t.title, thumb: t.thumb, locked: t.used, note: t.used ? "Ya en el HDR" : "" })),
    max: room
  });
  return ids.map(v => v === "null" ? null : +v);
}
