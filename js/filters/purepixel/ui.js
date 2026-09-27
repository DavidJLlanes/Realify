import { doc, activeLayer } from "../../core/doc.js";
import { on, emit } from "../../core/bus.js";
import { commitFilter, filterBase } from "../../editor/filterlayer.js";
import { dialog, anyDialogOpen } from "../../ui/dialog.js";
import { toast } from "../../ui/toast.js";
import { slider } from "../../editor/adjust.js";
import { renderExport, saveOrShare, stamp } from "../../io/export.js";
import { stripPNG } from "../../io/strip.js";
import { DEFAULTS, difference } from "./engine.js";

// Separate export path: never calls withExif or changes EXIF preferences.
async function savePNG() {
  const blob = await renderExport({ w: doc.w, h: doc.h, type: "image/png" });
  if (!blob) throw new Error("No se pudo generar el PNG. La capa procesada sigue disponible para exportar.");
  const clean = stripPNG(new Uint8Array(await blob.arrayBuffer()), true);
  if (!clean) throw new Error("No se pudo verificar el formato PNG.");
  const result = await saveOrShare(new Blob(clean.parts, { type: "image/png" }), `purepixel-${stamp()}.png`);
  if (result !== "cancelled") toast("PurePixel: PNG guardado sin metadatos de origen", "ok");
}

/* Cálculo sin diálogo para el registro de filtros: el mismo worker,
   sobre un lienzo cualquiera, con las opciones dadas. */
function renderHeadless(src, options){
  return new Promise((resolve, reject) => {
    const w = src.width, h = src.height;
    const image = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h);
    const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (data.error) { worker.terminate(); reject(new Error(data.error)); }
      else if (data.result) {
        worker.terminate();
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").putImageData(new ImageData(data.result.data, w, h), 0, 0);
        resolve(c);
      }
    };
    worker.onerror = e => { e.preventDefault(); worker.terminate(); reject(new Error("PurePixel no pudo ejecutarse")); };
    worker.postMessage({ data: image.data, width: w, height: h, options: { ...options }, mask: null, originX: 0, originY: 0 }, [image.data.buffer]);
  });
}

export async function openPurePixel(opts = {}) {
  if (opts.render) return renderHeadless(opts.render.src, { ...DEFAULTS, ...opts.init });
  const edit = opts.edit || null;
  const layer = edit || activeLayer();
  if (!doc.open || !layer || layer.locked || layer.type !== "raster" || anyDialogOpen()) return;
  if (typeof Worker === "undefined") throw new Error("PurePixel necesita un navegador compatible con Web Workers.");
  const base = edit ? filterBase(edit) : layer;
  if (!base) { toast("La capa de filtro no tiene ninguna capa debajo", "err"); return; }
  const canvas = layer.canvas, width = canvas.width, height = canvas.height;
  // Los píxeles de ORIGEN: la capa de debajo si se está reeditando
  const srcCtx = base.canvas.getContext("2d", { willReadFrequently: true });
  const options = { ...DEFAULTS, ...opts.init }, position = { x: 50, y: 50 };
  let worker = null, rejectJob = null, timer = null, version = 0;
  let closed = false, applying = false, closeDialog = null;
  let subscriptions = [];
  const cancelled = () => new DOMException("Operación cancelada", "AbortError");
  const stopJob = () => {
    if (worker) worker.terminate();
    worker = null;
    if (rejectJob) rejectJob(cancelled());
    rejectJob = null;
  };
  const unsubscribe = () => { subscriptions.forEach(off => off()); subscriptions = []; };
  const cleanup = () => { closed = true; clearTimeout(timer); stopJob(); unsubscribe(); };
  const valid = () => doc.open && activeLayer() === layer && layer.canvas === canvas &&
    !layer.locked && layer.type === "raster" && canvas.width === width && canvas.height === height;

  function runJob(image, mask, originX, originY, progress) {
    stopJob();
    return new Promise((resolve, reject) => {
      const current = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      worker = current; rejectJob = reject;
      const finish = (error, result) => {
        if (worker !== current) return;
        current.terminate(); worker = null; rejectJob = null;
        if (error) reject(error); else resolve(result);
      };
      current.onmessage = ({ data }) => {
        if (data.error) finish(new Error(data.error));
        else if (data.result) finish(null, data.result);
        else if (progress) progress(data.progress);
      };
      current.onerror = event => { event.preventDefault(); finish(new Error("No se pudo ejecutar PurePixel. Recarga la página e inténtalo de nuevo.")); };
      current.onmessageerror = () => finish(new Error("No se pudo leer el resultado de PurePixel."));
      const transfer = [image.data.buffer];
      if (mask) transfer.push(mask.buffer);
      try {
        current.postMessage({ data: image.data, width: image.width, height: image.height,
          options: { ...options }, mask, originX, originY }, transfer);
      } catch (error) { finish(error); }
    });
  }

  function selectionCrop(x, y, w, h) {
    if (!doc.selection) return null;
    const selection = doc.selection, mask = new Uint8Array(w * h);
    for (let yy = 0; yy < h; yy++) {
      const sy = Math.min(selection.h - 1, Math.floor((y + yy) * selection.h / height));
      for (let xx = 0; xx < w; xx++) {
        const sx = Math.min(selection.w - 1, Math.floor((x + xx) * selection.w / width));
        mask[yy * w + xx] = selection.mask[sy * selection.w + sx];
      }
    }
    return mask;
  }

  const body = document.createElement("div");
  body.dataset.purepixel = "";
  body.innerHTML = `
    <p class="hint" style="margin-top:0">Suaviza residuos finos de luminancia y color y añade textura controlada.
      No garantiza eliminar todos los indicios de IA ni superar detectores.</p>
    <div data-controls></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">
      <figure style="flex:1;min-width:0;margin:0"><figcaption>Original</figcaption><canvas data-before style="width:100%;height:auto;background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0/16px 16px"></canvas></figure>
      <figure style="flex:1;min-width:0;margin:0"><figcaption>PurePixel</figcaption><canvas data-after style="width:100%;height:auto;background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0/16px 16px"></canvas></figure>
    </div>
    <p class="hint" data-region></p>
    <div data-position></div>
    <p class="hint mono" data-status role="status" aria-live="polite">Preparando vista previa…</p>
    <p class="hint">Se aplica a la capa activa y respeta la selección. «Aplicar y guardar PNG» exporta todas
      las capas visibles sin añadir los metadatos de origen. El original permanece en tu equipo.</p>`;
  const beforeView = body.querySelector("[data-before]"), afterView = body.querySelector("[data-after]");
  const message = body.querySelector("[data-status]");
  const metrics = stats => `Cambio medio RGB: ${stats.mae.toFixed(2)}/255 · Máximo: ${stats.max}/255 · PSNR: ${Number.isFinite(stats.psnr) ? stats.psnr.toFixed(1) + " dB" : "sin cambios"}`;

  async function preview() {
    if (closed || applying || !valid()) return;
    const ticket = ++version;
    const w = Math.min(360, width), h = Math.min(240, height);
    const x = Math.round((width - w) * position.x / 100), y = Math.round((height - h) * position.y / 100);
    // One-pixel halo gives the preview the same neighbors as the full image.
    const left = Math.max(0, x - 1), top = Math.max(0, y - 1);
    const rw = Math.min(width, x + w + 1) - left, rh = Math.min(height, y + h + 1) - top;
    try {
      const original = srcCtx.getImageData(x, y, w, h);
      beforeView.width = afterView.width = w; beforeView.height = afterView.height = h;
      beforeView.getContext("2d").putImageData(original, 0, 0);
      afterView.getContext("2d").putImageData(original, 0, 0);
      body.querySelector("[data-region]").textContent = `Recorte de ${w} × ${h} píxeles sin remuestrear · posición ${x}, ${y}. Las métricas describen el cambio visual, no la probabilidad de IA.`;
      message.textContent = "Calculando vista previa…";
      const result = await runJob(srcCtx.getImageData(left, top, rw, rh), selectionCrop(left, top, rw, rh), left, top);
      if (closed || applying || ticket !== version) return;
      const crop = new ImageData(w, h);
      for (let yy = 0; yy < h; yy++) {
        const offset = ((yy + y - top) * rw + x - left) * 4;
        crop.data.set(result.data.subarray(offset, offset + w * 4), yy * w * 4);
      }
      afterView.getContext("2d").putImageData(crop, 0, 0);
      message.textContent = metrics(difference(original.data, crop.data));
    } catch (error) {
      if (!closed && ticket === version && error.name !== "AbortError") message.textContent = error.message;
    }
  }

  function schedulePreview() {
    if (closed || applying) return;
    ++version; stopJob(); clearTimeout(timer);
    message.textContent = "Actualizando vista previa…";
    timer = setTimeout(preview, 140);
  }
  const controls = body.querySelector("[data-controls]");
  const sliders = [];
  for (const [key, label, max, unit] of [
    ["smooth", "Suavizado fino", 100, "%"], ["chroma", "Suavizado de color", 100, "%"],
    ["grain", "Textura fina", 100, "%"], ["limit", "Cambio máximo RGB", 16, "/255"]
  ]) {
    const control = slider(label, 0, max, options[key], value => { options[key] = value; schedulePreview(); }, unit);
    control.querySelector("input").setAttribute("aria-label", label);
    controls.appendChild(control); sliders.push([key, control]);
  }
  const reset = document.createElement("button"); reset.textContent = "Restablecer";
  reset.addEventListener("click", () => {
    Object.assign(options, DEFAULTS);
    sliders.forEach(([key, control]) => control.setValue(options[key])); schedulePreview();
  });
  controls.appendChild(reset);
  for (const [key, label] of [["x", "Recorte horizontal"], ["y", "Recorte vertical"]]) {
    const control = slider(label, 0, 100, 50, value => { position[key] = value; schedulePreview(); }, "%");
    control.querySelector("input").setAttribute("aria-label", label);
    body.querySelector("[data-position]").appendChild(control);
  }

  async function apply(save) {
    if (applying || closed || !valid()) return;
    applying = true; ++version; clearTimeout(timer); stopJob();
    body.querySelectorAll("input, button").forEach(el => { el.disabled = true; });
    message.textContent = "Procesando a resolución completa… Puedes cancelar.";
    try {
      const result = await runJob(srcCtx.getImageData(0, 0, width, height), selectionCrop(0, 0, width, height), 0, 0,
        progress => { message.textContent = `Procesando ${Math.round(progress * 100)} %… Puedes cancelar.`; });
      if (closed || !valid()) return;
      // Allocate the output before opening a history transaction.
      const image = new ImageData(result.data, width, height);
      if (result.stats.max) {
        const out = document.createElement("canvas");
        out.width = width; out.height = height;
        out.getContext("2d").putImageData(image, 0, 0);
        /* Antes de tocar la estructura: `addFilterLayer` emite
           doc:structure, y el vigilante que hay montado cierra el
           diálogo en cuanto el documento cambia. */
        unsubscribe();
        commitFilter({ base, edit, result: out, title: "PurePixel",
                       filter: "purepixel", params: { ...options } });
      }
      cleanup(); closeDialog("applied");
      toast(result.stats.max ? `PurePixel aplicado · ${metrics(result.stats)}` : "PurePixel: sin cambios de píxeles", "ok");
      if (save) await savePNG();
    } catch (error) {
      if (error.name !== "AbortError") {
        if (closed) toast(error.message, "err");
        else message.textContent = error.message;
      }
    } finally {
      applying = false;
      if (!closed) body.querySelectorAll("input, button").forEach(el => { el.disabled = false; });
    }
  }

  try {
    await dialog({ title: "PurePixel", body, wide: innerWidth > 900,
      cls: innerWidth <= 900 ? "dlg-compact" : "",
      buttons: [{ label: "Cancelar", value: null },
        { label: "Aplicar y guardar PNG", onClick: () => { void apply(true); return false; } },
        { label: edit ? "Guardar cambios" : "Aplicar", primary: true, onClick: () => { void apply(false); return false; } }],
      onOpen: (_, api) => {
        closeDialog = api.close;
        const invalidated = () => { if (!closed) { cleanup(); closeDialog(null); toast("PurePixel cerrado porque el documento ha cambiado."); } };
        subscriptions = ["doc:change", "doc:structure", "doc:active", "sel:change"].map(event => on(event, invalidated));
        void preview();
      }
    });
  } finally { cleanup(); }
}
