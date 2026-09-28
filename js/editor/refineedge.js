/* ═══════════════════════════════════════════════════════════════
   REFINAR BORDE · DIÁLOGO
   El problema de siempre con una selección de pelo: la varita mágica
   o cualquier detector de fondo da un contorno DURO —dentro o fuera,
   sin término medio—, y el pelo fino no es así, es medio transparente
   mechón a mechón. Sin eso, cualquier recorte de pelo sale con un
   halo del color del fondo pegado alrededor.

   El motor —filtro guiado por color, desplazamiento de borde y
   descontaminación— vive en refineedge-math.js, sin nada de DOM, para
   poder probarlo con números de verdad en vez de sólo mirar la
   pantalla. Aquí sólo el diálogo: recorte de trabajo, vista previa
   sobre negro/blanco/transparencia, y qué hacer con el resultado
   según de dónde venga —una máscara de capa o la selección activa—.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer, makeLayer, layerIndex } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { slider } from "./adjust.js";
import { cloneMask } from "./masks.js";
import { commitSelection } from "./selection.js";
import { computeRefinedAlpha, decontaminate } from "./refineedge-math.js";
import { autoCompact } from "../ui/compact.js";

/* ═══════════════════════════════════════════════════════════════
   DIÁLOGO
   ═══════════════════════════════════════════════════════════════ */

const PREVIEW_MAX = 340;   // lado mayor del recorte de trabajo en el diálogo

/* Recorte ajustado a donde de verdad hay algo que refinar —lejos del
   contorno no hace falta ver nada—, con margen para que el radio y el
   desplazamiento de borde tengan sitio hacia fuera sin toparse con el
   límite del recorte. Si la máscara está vacía o llena del todo (nada
   que recortar), se usa el lienzo entero. */
function boundingBoxOfAlpha(alpha, w, h, margin){
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w; x++){
      const a = alpha[row + x];
      if(a > 2 && a < 253){ if(x < minX) minX = x; if(x > maxX) maxX = x; if(y < minY) minY = y; if(y > maxY) maxY = y; }
    }
  }
  if(maxX < 0){
    // sin borde difuso: usar el contorno sólido en su lugar
    for(let y = 0; y < h; y++){
      const row = y * w;
      for(let x = 0; x < w; x++){
        if(alpha[row + x] > 2){ if(x < minX) minX = x; if(x > maxX) maxX = x; if(y < minY) minY = y; if(y > maxY) maxY = y; }
      }
    }
  }
  if(maxX < 0) return { x: 0, y: 0, w, h };
  minX = Math.max(0, minX - margin); minY = Math.max(0, minY - margin);
  maxX = Math.min(w - 1, maxX + margin); maxY = Math.min(h - 1, maxY + margin);
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function cropAlpha(alpha, w, box){
  const out = new Uint8ClampedArray(box.w * box.h);
  for(let y = 0; y < box.h; y++){
    const srcRow = (box.y + y) * w + box.x;
    out.set(alpha.subarray(srcRow, srcRow + box.w), y * box.w);
  }
  return out;
}
function cropRgba(rgba, w, box){
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for(let y = 0; y < box.h; y++){
    const srcOff = ((box.y + y) * w + box.x) * 4;
    out.set(rgba.subarray(srcOff, srcOff + box.w * 4), y * box.w * 4);
  }
  return out;
}

/* Reduce un par (rgba, alfa) a un tamaño de trabajo manejable para que
   la vista previa siga al deslizador sin tirones —el filtro guiado
   hace más de una decena de pasadas de desenfoque por fotograma—,
   usando el propio canvas para el remuestreo bilineal. */
function downscale(rgba, alpha, w, h, maxSide){
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const ow = Math.max(1, Math.round(w * scale)), oh = Math.max(1, Math.round(h * scale));
  if(scale === 1) return { rgba, alpha, w, h };

  const rgbaCanvas = document.createElement("canvas");
  rgbaCanvas.width = w; rgbaCanvas.height = h;
  const rctx = rgbaCanvas.getContext("2d");
  rctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  const outR = document.createElement("canvas");
  outR.width = ow; outR.height = oh;
  const orctx = outR.getContext("2d", { willReadFrequently: true });
  orctx.imageSmoothingQuality = "high";
  orctx.drawImage(rgbaCanvas, 0, 0, ow, oh);

  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = w; alphaCanvas.height = h;
  const actx = alphaCanvas.getContext("2d");
  const aImg = actx.createImageData(w, h);
  for(let i = 0; i < alpha.length; i++){ aImg.data[i*4] = aImg.data[i*4+1] = aImg.data[i*4+2] = 255; aImg.data[i*4+3] = alpha[i]; }
  actx.putImageData(aImg, 0, 0);
  const outA = document.createElement("canvas");
  outA.width = ow; outA.height = oh;
  const oactx = outA.getContext("2d", { willReadFrequently: true });
  oactx.imageSmoothingQuality = "high";
  oactx.drawImage(alphaCanvas, 0, 0, ow, oh);
  const aData = oactx.getImageData(0, 0, ow, oh).data;
  const outAlpha = new Uint8ClampedArray(ow * oh);
  for(let i = 0; i < outAlpha.length; i++) outAlpha[i] = aData[i*4+3];

  return { rgba: new Uint8ClampedArray(orctx.getImageData(0, 0, ow, oh).data), alpha: outAlpha, w: ow, h: oh };
}

function paintCheckerboard(ctx, w, h){
  const cell = 8;
  for(let y = 0; y < h; y += cell){
    for(let x = 0; x < w; x += cell){
      ctx.fillStyle = (((x / cell) | 0) + ((y / cell) | 0)) % 2 === 0 ? "#3a3d42" : "#2b2d31";
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function renderPreview(canvas, rgba, alpha, w, h, bg){
  canvas.width = w; canvas.height = h;
  const cx = canvas.getContext("2d");
  if(bg === "white"){ cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h); }
  else if(bg === "black"){ cx.fillStyle = "#000000"; cx.fillRect(0, 0, w, h); }
  else paintCheckerboard(cx, w, h);

  const img = cx.getImageData(0, 0, w, h);
  const d = img.data;
  for(let i = 0; i < w * h; i++){
    const a = alpha[i] / 255;
    const p = i * 4;
    d[p]     = rgba[p]     * a + d[p]     * (1 - a);
    d[p + 1] = rgba[p + 1] * a + d[p + 1] * (1 - a);
    d[p + 2] = rgba[p + 2] * a + d[p + 2] * (1 - a);
  }
  cx.putImageData(img, 0, 0);
}

/* ── crear la capa descontaminada ─────────────────────────────────
   Nunca sobre la capa original —«descontaminar» reescribe el color,
   y eso no se puede deshacer sin guardar el original aparte—: una
   copia nueva, justo encima, con el alfa refinado como máscara. La
   capa de partida se queda exactamente como estaba. */
function createDecontaminatedLayer(colorLayer, rgbaDecon, alphaFull, w, h, title){
  const l = makeLayer({ name: title });
  l.ctx.putImageData(new ImageData(rgbaDecon, w, h), 0, 0);
  const mc = document.createElement("canvas");
  mc.width = w; mc.height = h;
  const mctx = mc.getContext("2d");
  const mImg = mctx.createImageData(w, h);
  for(let i = 0; i < alphaFull.length; i++){
    mImg.data[i*4] = mImg.data[i*4+1] = mImg.data[i*4+2] = 255;
    mImg.data[i*4+3] = alphaFull[i];
  }
  mctx.putImageData(mImg, 0, 0);
  l.mask = { canvas: mc, ctx: mctx };
  l.maskEnabled = true;

  const prevLayers = doc.layers.slice();
  const prevActive = doc.activeId;
  const at = layerIndex(colorLayer.id) + 1;
  const nextLayers = prevLayers.slice();
  nextLayers.splice(at, 0, l);
  doc.layers = nextLayers;
  doc.activeId = l.id;

  record(title,
    () => { doc.layers = prevLayers; doc.activeId = prevActive; emit("doc:structure"); emit("doc:change"); },
    () => { doc.layers = nextLayers; doc.activeId = l.id;       emit("doc:structure"); emit("doc:change"); });
  emit("doc:structure"); emit("doc:change");
  return l;
}

/**
 * Abre el diálogo de Refinar borde.
 * `source`: `{ type:"mask", layer }` para la máscara de una capa, o
 * `{ type:"selection" }` para la selección activa —usa la capa activa
 * como color de referencia—.
 */
export async function refineEdge(source){
  const colorLayer = source.type === "mask" ? source.layer : activeLayer();
  if(!colorLayer){ toast("No hay capa activa"); return; }
  const w = colorLayer.canvas.width, h = colorLayer.canvas.height;

  let alphaFull;
  if(source.type === "mask"){
    if(!source.layer.mask){ toast("Esta capa no tiene máscara"); return; }
    const img = source.layer.mask.ctx.getImageData(0, 0, w, h);
    alphaFull = new Uint8ClampedArray(w * h);
    for(let i = 0; i < alphaFull.length; i++) alphaFull[i] = img.data[i*4+3];
  } else {
    if(!doc.selection){ toast("No hay selección activa"); return; }
    alphaFull = doc.selection.mask;
  }

  const rgbaFull = new Uint8ClampedArray(colorLayer.ctx.getImageData(0, 0, w, h).data);

  const p = { radius: 4, contrast: 20, smooth: 2, shift: 0, decontaminate: false };
  const state = { bg: "transparent" };

  // Datos de trabajo para la vista previa: recorte a donde hace falta
  // mirar, y reducido si aun así es grande.
  const box = boundingBoxOfAlpha(alphaFull, w, h, 60);
  const cropA = cropAlpha(alphaFull, w, box);
  const cropC = cropRgba(rgbaFull, w, box);
  const work = downscale(cropC, cropA, box.w, box.h, PREVIEW_MAX);

  const body = document.createElement("div");
  body.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div style="flex:1 1 300px;min-width:240px">
        <canvas id="rePreview" style="width:100%;height:auto;display:block;
          border-radius:var(--r);border:1px solid var(--line-soft)"></canvas>
        <div class="seg" id="reBg" style="margin-top:8px">
          <button data-bg="transparent" class="on">Transparencia</button>
          <button data-bg="white">Blanco</button>
          <button data-bg="black">Negro</button>
        </div>
      </div>
      <div style="flex:1 1 240px;min-width:220px" id="reControls"></div>
    </div>`;

  const canvas = body.querySelector("#rePreview");
  const bgSeg = body.querySelector("#reBg");
  const controls = body.querySelector("#reControls");

  let queued = false;
  const preview = () => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const refined = computeRefinedAlpha(work.alpha, work.rgba, work.w, work.h, p);
      const shown = p.decontaminate
        ? decontaminate(work.rgba, refined, work.w, work.h, Math.max(2, Math.round(p.radius)))
        : work.rgba;
      renderPreview(canvas, shown, refined, work.w, work.h, state.bg);
    });
  };

  controls.appendChild(slider("Radio de detección", 0, 100, p.radius, v => { p.radius = v; preview(); }, " px"));
  controls.appendChild(slider("Suavizar", 0, 40, p.smooth, v => { p.smooth = v; preview(); }, " px"));
  controls.appendChild(slider("Contraste", 0, 100, p.contrast, v => { p.contrast = v; preview(); }, "%"));
  controls.appendChild(slider("Desplazar borde", -100, 100, p.shift, v => { p.shift = v; preview(); }, "%"));

  const deconRow = document.createElement("label");
  deconRow.className = "field";
  deconRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:10px";
  deconRow.innerHTML = `<input type="checkbox" id="reDecon"><span>Descontaminar color</span>`;
  controls.appendChild(deconRow);
  deconRow.querySelector("#reDecon").addEventListener("change", e => { p.decontaminate = e.target.checked; preview(); });

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.style.marginTop = "10px";
  hint.textContent = "El radio busca detalle fino —pelo, pelaje— alrededor del contorno " +
    "actual; el contraste endurece esa transición y suavizar lima el dentado que quede. " +
    "Desplazar borde expande o contrae de verdad, no sólo sube o baja el alfa. " +
    "Descontaminar quita el cerco del color de fondo de los píxeles a medio camino " +
    "—cambia el color, así que el resultado va siempre a una capa nueva—.";
  controls.appendChild(hint);

  bgSeg.addEventListener("click", e => {
    const b = e.target.closest("button[data-bg]");
    if(!b) return;
    state.bg = b.dataset.bg;
    bgSeg.querySelectorAll("button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    preview();
  });

  preview();

  /* Móvil: deslizadores apilados → desplegable + uno (ui/compact.js). */ autoCompact(body);
  const res = await dialog({
    title: "Refinar borde", body, wide: true,
    buttons: [{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }]
  });
  if(res !== "go") return;

  status("Aplicando…");
  // A resolución completa: lo que se vio en el recorte reducido era
  // una aproximación, lo que se guarda no debe serlo.
  await new Promise(r => requestAnimationFrame(r));
  let refinedFull = computeRefinedAlpha(alphaFull, rgbaFull, w, h, p);
  status("");

  if(p.decontaminate){
    const rgbaDecon = decontaminate(rgbaFull, refinedFull, w, h, Math.max(2, Math.round(p.radius)));
    createDecontaminatedLayer(colorLayer, rgbaDecon, refinedFull, w, h, "Refinar borde");
    toast("Refinar borde · capa nueva", "ok");
    return;
  }

  if(source.type === "mask"){
    const layer = source.layer;
    const before = cloneMask(layer.mask);
    const img = new ImageData(w, h);
    for(let i = 0; i < refinedFull.length; i++){
      img.data[i*4] = img.data[i*4+1] = img.data[i*4+2] = 255;
      img.data[i*4+3] = refinedFull[i];
    }
    layer.mask.ctx.putImageData(img, 0, 0);
    layer.thumbDirty = true;
    const after = cloneMask(layer.mask);
    const restore = snap => {
      layer.mask.ctx.save(); layer.mask.ctx.globalCompositeOperation = "copy";
      layer.mask.ctx.drawImage(snap.canvas, 0, 0); layer.mask.ctx.restore();
      layer.thumbDirty = true; emit("doc:change");
    };
    record("Refinar borde", () => restore(before), () => restore(after));
    emit("doc:change");
  } else {
    commitSelection(refinedFull, "new");
  }
  toast("Borde refinado", "ok");
}
