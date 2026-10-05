/* Proyecto editable de Realify. El archivo contiene la pila completa de
   capas, máscaras, texto y ajustes. Las imágenes se guardan como PNG dentro
   del JSON para conservar sus píxeles sin pérdidas. */

import { doc, makeLayer } from "../core/doc.js";
import { clear as clearHistory } from "../core/history.js";
import { clearSnapshots } from "../core/snapshots.js";
import { emit, on } from "../core/bus.js";
import { view, apply as applyView } from "../editor/view.js";
import { flatten } from "../editor/layertree.js";
import { saveOrShare, stamp } from "./export.js";
import { toast, status } from "../ui/toast.js";
import { openAsNewTab, listTabs, activeTab, switchTo } from "../core/documents.js";
import { anyDialogOpen } from "../ui/dialog.js";
import { hiCoversCanvas, hiRect, hiAllowed } from "../core/hisrc.js";

export const PROJECT_MIME = "application/vnd.realify+json";
export const PROJECT_VERSION = 1;
const DB_NAME = "realify-projects", STORE = "recent", RECENT_KEY = "last";
const AUTOSAVE_DELAY = 12000;

const cloneJson = value => value == null ? value : JSON.parse(JSON.stringify(value));

function canvasBlob(canvas){
  return new Promise((resolve, reject) => canvas.toBlob(
    b => b ? resolve(b) : reject(new Error("No se pudo guardar una capa")), "image/png"));
}

function bytesToBase64(bytes){
  let out = "";
  const step = 0x8000;
  for(let i = 0; i < bytes.length; i += step){
    out += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(out);
}

function base64ToBytes(value){
  const raw = atob(value || ""), out = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function encodeCanvas(canvas){
  const b = await canvasBlob(canvas);
  return bytesToBase64(new Uint8Array(await b.arrayBuffer()));
}

async function decodeCanvas(encoded, w, h){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  if(!encoded) return c;
  const bmp = await createImageBitmap(new Blob([base64ToBytes(encoded)], { type:"image/png" }));
  c.getContext("2d", { colorSpace:"srgb", willReadFrequently:true }).drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

function projectThumbnail(){
  const src=flatten(), max=240, s=Math.min(1,max/Math.max(doc.w,doc.h));
  const c=document.createElement("canvas");c.width=Math.max(1,Math.round(doc.w*s));c.height=Math.max(1,Math.round(doc.h*s));
  c.getContext("2d",{colorSpace:"srgb"}).drawImage(src,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",.72);
}

/* Origen de 16 bits de una capa (core/hisrc.js) como PNG de 16 bits en base64, o null. Ocupa bastante: el
   autoguardado periódico lo omite (`hi: false`); el guardado de proyecto y el de «antes de actualizar» lo llevan. */
/* Los datos de 16 bits de una capa no se modifican nunca en su sitio (cada operación crea los suyos): lo ya codificado se guarda por identidad de los
   datos, así el autoguardado periódico sólo paga la compresión la primera vez (o cuando la capa cambia de verdad) y no en cada guardado. */
const hiCache = new WeakMap();
async function encodeHi(layer, maxPixels = 24e6){
  const rc = hiRect(layer);                                    // el lienzo entero o sólo una parte (recortado o desplazado)
  if(!rc || layer.canvas.width * layer.canvas.height > maxPixels) return null;
  const cached = hiCache.get(layer.hiSrc.data);
  if(cached && cached.key === `${rc.x},${rc.y},${rc.w},${rc.h},${!!layer.hiSrc.dither}`) return cached.value;
  try{
    const { png16, png16Supported } = await import("./formats16.js");
    if(!png16Supported()) return null;
    const hs = layer.hiSrc;
    const blob = await png16({ data: hs.data, channels: 3, w: hs.w, h: hs.h });
    const partial = rc.x || rc.y || rc.w !== layer.canvas.width || rc.h !== layer.canvas.height;
    const value = { png: bytesToBase64(new Uint8Array(await blob.arrayBuffer())), dither: !!hs.dither, ...(partial ? { x: rc.x, y: rc.y, w: rc.w, h: rc.h } : {}) };
    hiCache.set(hs.data, { key: `${rc.x},${rc.y},${rc.w},${rc.h},${!!hs.dither}`, value });
    return value;
  }catch(err){ console.warn("[project] no se pudieron guardar los 16 bits de una capa", err); return null; }
}
async function decodeHi(saved, w, h){
  if(!saved || !saved.png || !hiAllowed(w, h)) return null;
  try{
    const { decodePng16 } = await import("./hidepth.js");
    const u8 = base64ToBytes(saved.png);
    const r = await decodePng16(u8.buffer);
    const x = saved.x || 0, y = saved.y || 0, rw = saved.w || w, rh = saved.h || h;
    if(!r || r.w !== rw || r.h !== rh || x < 0 || y < 0 || x + rw > w || y + rh > h) return null;
    return { data: r.data, w: rw, h: rh, dither: !!saved.dither, x, y, canvasW: w, canvasH: h };
  }catch(err){ console.warn("[project] no se pudieron recuperar los 16 bits de una capa", err); return null; }
}

export async function serializeProject({ hi = true, hiMaxPixels = 24e6 } = {}){
  if(!doc.open) throw new Error("No hay documento abierto");
  const layers = [];
  for(const layer of doc.layers){
    layers.push({
      hi: hi && layer.hiSrc ? await encodeHi(layer, hiMaxPixels) : null,
      id: layer.id,
      name: layer.name,
      type: layer.type || "raster",
      visible: layer.visible,
      opacity: layer.opacity,
      blend: layer.blend,
      blendIf: cloneJson(layer.blendIf || null),
      locked: !!layer.locked,
      filters: cloneJson(layer.filters || []),
      text: cloneJson(layer.text || null),
      adjustType: layer.adjustType || null,
      adjustParams: cloneJson(layer.adjustParams || null),
      pixels: await encodeCanvas(layer.canvas),
      maskEnabled: layer.maskEnabled !== false,
      depthMask: cloneJson(layer.depthMask || null),   // máscara por profundidad «viva» (features/depthlive.js)
      mask: layer.mask ? await encodeCanvas(layer.mask.canvas) : null,
      // Grupos, recorte y estilos de capa: `groupId` va con el id
      // ORIGINAL tal cual, porque al restaurar cada capa recibe un id
      // nuevo — restoreProject() lo traduce en una segunda pasada,
      // una vez que todas las capas (y por tanto todos los grupos)
      // ya existen.
      groupId: layer.groupId ?? null,
      collapsed: !!layer.collapsed,
      clipped: !!layer.clipped,
      styles: cloneJson(layer.styles || null),
      // Objeto inteligente: el original se guarda como PNG aparte,
      // igual que los propios píxeles o una máscara; `smartTransform`
      // y `smartBox` ya son JSON llano.
      smart: !!layer.smart,
      smartSource: layer.smart && layer.smartSource ? await encodeCanvas(layer.smartSource) : null,
      smartTransform: cloneJson(layer.smartTransform || null),
      smartBox: cloneJson(layer.smartBox || null),
      dodgeBurn: !!layer.dodgeBurn,
      // Capa de relleno (editor/layercontent.js): todo es JSON llano
      // salvo el motivo, que —como el original de un objeto
      // inteligente— es un <canvas> aparte y se guarda como su propio
      // PNG. Sin esto una capa de relleno sobreviviría a guardar y
      // volver a abrir con el aspecto correcto (sus píxeles sí se
      // guardan como cualquier otra capa) pero inerte: el panel de
      // Propiedades no tendría con qué reconstruir sus mandos.
      fill: layer.fill ? {
        ...cloneJson({ ...layer.fill, patternImg: undefined }),
        patternImg: layer.fill.patternImg ? await encodeCanvas(layer.fill.patternImg) : null
      } : null,
      // Capa de forma: sólo números, colores y booleanos — clona tal cual.
      shape: cloneJson(layer.shape || null),
      svgSource: layer.svgSource || null
    });
  }
  return {
    format:"realify-project", version:PROJECT_VERSION, savedAt:new Date().toISOString(),
    document:{
      name:doc.name, width:doc.w, height:doc.h, activeId:doc.activeId,
      colorSpace:doc.colorSpace || "srgb",
      thumbnail:projectThumbnail(),
      source:doc.source ? { w:doc.source.w, h:doc.source.h, type:doc.source.type,
                            size:doc.source.size, name:doc.source.name } : null,
      guides:cloneJson(doc.guides),
      selection:doc.selection ? {
        w:doc.selection.w, h:doc.selection.h,
        mask:bytesToBase64(new Uint8Array(doc.selection.mask))
      } : null,
      view:{ zoom:view.zoom, x:view.x, y:view.y, fitted:view.fitted },
      layers
    }
  };
}

export function validateProject(data){
  if(!data || data.format !== "realify-project" || data.version !== PROJECT_VERSION) return false;
  const d = data.document;
  return !!(d && Number.isInteger(d.width) && d.width > 0 &&
    Number.isInteger(d.height) && d.height > 0 && Array.isArray(d.layers) && d.layers.length);
}

export async function restoreProject(data){
  if(!validateProject(data)) throw new Error("El archivo no es un proyecto Realify compatible");
  const d = data.document, idMap = new Map(), layers = [];
  // Antes de crear las capas: sus lienzos nacen en el espacio del proyecto
  doc.colorSpace = d.colorSpace === "display-p3" ? "display-p3" : "srgb";
  for(const saved of d.layers){
    const layer = makeLayer({ name:saved.name || "Capa", w:d.width, h:d.height, type:saved.type });
    idMap.set(saved.id, layer.id);
    layer.visible = saved.visible !== false;
    layer.opacity = Math.max(0, Math.min(1, Number(saved.opacity ?? 1)));
    layer.blend = saved.blend || "source-over";
    layer.blendIf = cloneJson(saved.blendIf || null);
    layer.locked = !!saved.locked;
    layer.filters = cloneJson(saved.filters || []);
    layer.text = cloneJson(saved.text || null);
    if(saved.adjustType) layer.adjustType = saved.adjustType;
    if(saved.adjustParams) layer.adjustParams = cloneJson(saved.adjustParams);
    layer.canvas = await decodeCanvas(saved.pixels, d.width, d.height);
    layer.ctx = layer.canvas.getContext("2d", { colorSpace:"srgb", willReadFrequently:true });
    if(saved.hi){ const hiSrc = await decodeHi(saved.hi, d.width, d.height); if(hiSrc) layer.hiSrc = hiSrc; }   // los 16 bits de origen
    if(saved.mask){
      const canvas = await decodeCanvas(saved.mask, d.width, d.height);
      layer.mask = { canvas, ctx:canvas.getContext("2d", { colorSpace:"srgb", willReadFrequently:true }) };
    }
    layer.maskEnabled = saved.maskEnabled !== false;
    if(saved.depthMask && layer.mask){
      layer.depthMask = { ...saved.depthMask };
      Object.defineProperty(layer.depthMask, "sig", { value: null, writable: true, enumerable: false });
    }
    layer.collapsed = !!saved.collapsed;
    layer.clipped = !!saved.clipped;
    layer.styles = cloneJson(saved.styles || null);
    layer.smart = !!saved.smart;
    layer.dodgeBurn = !!saved.dodgeBurn;
    layer.smartTransform = cloneJson(saved.smartTransform || null);
    layer.smartBox = cloneJson(saved.smartBox || null);
    layer.shape = cloneJson(saved.shape || null);
    layer.svgSource = saved.svgSource || null;
    if(saved.fill){
      layer.fill = cloneJson({ ...saved.fill, patternImg: undefined });
      if(saved.fill.patternImg){
        const bmp = await createImageBitmap(new Blob([base64ToBytes(saved.fill.patternImg)], { type:"image/png" }));
        const c = document.createElement("canvas");
        c.width = bmp.width; c.height = bmp.height;
        c.getContext("2d", { colorSpace:"srgb" }).drawImage(bmp, 0, 0);
        bmp.close();
        layer.fill.patternImg = c;
      }
    }
    if(saved.smart && saved.smartSource){
      // El original de un objeto inteligente puede guardarse a una
      // resolución distinta de la del documento (es la resolución que
      // tenía la capa al convertirse, no la del lienzo), así que se
      // decodifica a SU propio tamaño, leído del propio PNG — no al de
      // `d.width`/`d.height` como los píxeles o la máscara.
      const bmp = await createImageBitmap(new Blob([base64ToBytes(saved.smartSource)], { type:"image/png" }));
      const c = document.createElement("canvas");
      c.width = bmp.width; c.height = bmp.height;
      c.getContext("2d", { colorSpace:"srgb" }).drawImage(bmp, 0, 0);
      bmp.close();
      layer.smartSource = c;
    }
    layer.thumbDirty = true;
    layers.push(layer);
  }
  // `groupId` se traduce en una segunda pasada: apunta al id ORIGINAL
  // de otra capa del archivo, y ese id no tiene por qué coincidir con
  // el nuevo que le acaba de tocar aquí —sólo `idMap`, ya completo
  // ahora que el bucle de arriba ha terminado, sabe la traducción—.
  d.layers.forEach((saved, i) => {
    layers[i].groupId = saved.groupId != null ? (idMap.get(saved.groupId) ?? null) : null;
  });
  doc.open = true; doc.w = d.width; doc.h = d.height;
  doc.name = d.name || "Sin título"; doc.source = d.source || null;
  doc.layers = layers; doc.activeId = idMap.get(d.activeId) || layers[layers.length - 1].id;
  doc.guides = d.guides || { h:[], v:[] };
  doc.selection = d.selection ? {
    w:d.selection.w, h:d.selection.h, mask:base64ToBytes(d.selection.mask)
  } : null;
  clearHistory();
  clearSnapshots();
  emit("doc:new"); emit("doc:structure"); emit("doc:change");
  if(d.view && !d.view.fitted){
    requestAnimationFrame(() => {
      view.zoom = d.view.zoom || 1; view.x = d.view.x || 0; view.y = d.view.y || 0;
      view.fitted = false; applyView();
    });
  }
  document.getElementById("empty")?.classList.add("hide");
}

function openDb(){
  return new Promise((resolve, reject) => {
    if(typeof indexedDB === "undefined") return reject(new Error("Almacenamiento local no disponible"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRecent(blob, name, thumbnail = null){
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ blob, name, thumbnail, savedAt:Date.now() }, RECENT_KEY);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
  db.close();
  dispatchEvent(new Event("realify:recent"));
}

/* ── Guardado para actualizar la app ─────────────────────────────
   Antes de recargar para pasar a una versión nueva (ver pwa.js) se
   guardan TODAS las pestañas abiertas, completas —capas, máscaras,
   ajustes y textos—, y al arrancar la versión nueva se reabren solas.
   Se usa la misma base de datos local que el «proyecto reciente»,
   con otra clave; nada sale del navegador. */
const UPDATE_KEY = "before-update";
async function idb(mode, fn){
  const db = await openDb();
  try{
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }finally{ db.close(); }
}

/** Guarda todas las pestañas. Devuelve cuántas se guardaron. La
    misma copia sirve, con otra `key`, de red de seguridad antes de un
    modelo de IA pesado (ver ai/runtime.js): si el navegador se queda
    sin memoria y recarga la página, al arrancar se reabren. */
export async function stashForUpdate(key = UPDATE_KEY){
  const tabs = listTabs(), start = activeTab()?.tabId ?? null, docs = [];
  let active = 0;
  if(tabs.length){
    // Cambios forzados (sin esperar a que se cierre un diálogo) y vuelta
    // SIEMPRE a la pestaña de partida: con documentos grandes esto tarda
    // unos segundos, y si el usuario abre un diálogo mientras tanto, lo
    // que viene después (el resultado de la IA) iría a otro documento.
    try{
      for(const t of tabs){
        if(t.tabId !== activeTab()?.tabId && !switchTo(t.tabId, { force: true })) continue;
        if(!doc.open) continue;
        if(t.tabId === start) active = docs.length;
        docs.push(await serializeProject());
      }
    }finally{ if(start !== null) switchTo(start, { force: true }); }
  } else if(doc.open) docs.push(await serializeProject());
  if(!docs.length) return 0;
  await idb("readwrite", s => s.put({ docs, active, savedAt: Date.now() }, key));
  return docs.length;
}

/** Al arrancar: si hay pestañas guardadas antes de actualizar, las reabre. */
export async function restoreAfterUpdate(key = UPDATE_KEY){
  let saved = null;
  try{ saved = await idb("readonly", s => s.get(key)); }catch{ return 0; }
  if(!saved) return 0;
  try{ await idb("readwrite", s => s.delete(key)); }catch{}
  if(Date.now() - saved.savedAt > 24 * 3600e3 || !Array.isArray(saved.docs)) return 0;
  const ids = [];
  for(const data of saved.docs){
    try{ if(await openAsNewTab(() => restoreProject(data))) ids.push(activeTab()?.tabId); }catch(e){ console.warn("[actualizar] no se pudo reabrir", e); }
  }
  const back = ids[saved.active];
  if(back != null) switchTo(back);
  return ids.length;
}

/** Borra una copia guardada con `stashForUpdate(key)` que ya no hace falta. */
export async function discardStash(key){
  try{ await idb("readwrite", s => s.delete(key)); }catch{}
}

export async function getRecentProject(){
  try{
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(RECENT_KEY);
      req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
    });
    db.close(); return value;
  }catch{ return null; }
}

export async function saveProject(){
  if(!doc.open) return;
  status("Guardando proyecto…");
  const data = await serializeProject();
  const blob = new Blob([JSON.stringify(data)], { type:PROJECT_MIME });
  const safe = String(doc.name || "proyecto").replace(/[^a-z0-9áéíóúüñ _-]+/gi, "").trim() || "proyecto";
  const name = `${safe}-${stamp()}.realify`;
  await putRecent(blob, name, data.document.thumbnail);
  const result = await saveOrShare(blob, name, "picker");
  if(result !== "cancelled") toast("Proyecto guardado con capas, máscaras y ajustes", "ok");
  status("");
}

export async function openProjectFile(file){
  if(!file) return;
  status("Abriendo proyecto…");
  try{
    const data = JSON.parse(await file.text());
    // En una pestaña nueva, como abrir cualquier otro archivo: nunca
    // sustituye lo que ya hubiera abierto.
    if(!(await openAsNewTab(() => restoreProject(data)))) return;
    await putRecent(new Blob([JSON.stringify(data)], { type:PROJECT_MIME }), file.name, data.document?.thumbnail || null);
    toast(`Proyecto abierto · ${data.document.layers.length} capas`, "ok");
  }finally{ status(""); }
}

export function promptOpenProject(){ document.getElementById("projectPicker")?.click(); }

export async function openRecentProject(){
  const recent = await getRecentProject();
  if(!recent) throw new Error("No hay ningún proyecto reciente guardado");
  await openProjectFile(new File([recent.blob], recent.name, { type:PROJECT_MIME }));
}

export function initProjects(){
  const picker = document.getElementById("projectPicker");
  picker?.addEventListener("change", () => {
    const file = picker.files?.[0]; picker.value = "";
    if(file) openProjectFile(file).catch(err => toast(err.message, "err"));
  });
  const refreshRecent = async () => {
    const recent = await getRecentProject();
    const button = document.getElementById("continueRecent");
    const label = document.getElementById("recentProjectName");
    if(button) button.hidden = !recent;
    if(label && recent) label.textContent = recent.name.replace(/\.realify$/i, "");
    if(button && recent?.thumbnail){
      button.style.backgroundImage=`linear-gradient(90deg,rgba(20,21,24,.90),rgba(20,21,24,.72)),url(${recent.thumbnail})`;
      button.style.backgroundSize="cover";button.style.backgroundPosition="center";
    }
  };
  addEventListener("realify:recent", refreshRecent);
  refreshRecent();

  /* Autoguardado recuperable. Se agrupan los cambios para no codificar
     todas las capas mientras se arrastra un control; al ocultar la app
     se intenta guardar inmediatamente, que cubre el cierre normal de
     una PWA móvil mucho mejor que beforeunload. */
  let timer=null,saving=false,pending=false;
  const saveAuto=async()=>{
    if(!doc.open||saving||anyDialogOpen()){pending=true;scheduleAuto();return;}
    saving=true;pending=false;
    try{
      // Con los 16 bits (hasta 12 MP por capa): lo ya codificado se reutiliza (hiCache), así que sólo la primera vez cuesta; antes se omitían y la
      // recuperación tras un cierre brusco dejaba la foto en 8 bits.
      const data=await serializeProject({hi:true,hiMaxPixels:12e6});
      const blob=new Blob([JSON.stringify(data)],{type:PROJECT_MIME});
      const safe=String(doc.name||"proyecto").replace(/[^a-z0-9áéíóúüñ _-]+/gi,"").trim()||"proyecto";
      await putRecent(blob,`${safe} · autoguardado.realify`,data.document.thumbnail);
    }catch(err){ console.warn("[project] autoguardado falló",err); }
    finally{saving=false;if(pending)scheduleAuto();}
  };
  const scheduleAuto=()=>{clearTimeout(timer);timer=setTimeout(saveAuto,AUTOSAVE_DELAY);};
  on("doc:change",scheduleAuto);on("doc:structure",scheduleAuto);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&doc.open){clearTimeout(timer);void saveAuto();}});
}
