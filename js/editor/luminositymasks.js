/* ═══════════════════════════════════════════════════════════════
   MÁSCARAS DE LUMINOSIDAD Y COLOR
   El panel de cualquier plugin de retoque de paisaje serio (TK
   Actions, Lumenzia…): quince botones —Luces, Medios y Sombras, cinco
   niveles cada uno— más una máscara por rango de color, con vista
   previa antes de decidir nada y salida directa a una máscara de capa
   de verdad, no a un archivo aparte.

   La progresión de los cinco niveles es la misma matemática que usan
   esos plugins y que cualquier tutorial de la técnica explica: el
   nivel 1 es la luminosidad (o su inversa, o la «tienda de campaña»
   centrada en gris medio) tal cual, y cada nivel siguiente es el
   anterior MULTIPLICADO POR SÍ MISMO —el equivalente exacto de poner
   esa misma máscara en modo Multiplicar sobre una copia de sí misma—.
   Cada pasada estrecha el rango que queda claro: L1 es todo lo que
   tiene algo de luz, L5 es sólo el brillo más puro. Nada de esto
   necesita conocer el algoritmo interno de ningún plugin concreto,
   es aritmética de toda la vida sobre la propia luminosidad.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { addMask } from "./masks.js";
import { featherMask } from "./selection.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { toast } from "../ui/toast.js";
import { dialog } from "../ui/dialog.js";
import { slider } from "./adjust.js";
import { rangeMask as colorRangeMask } from "../features/photo-tools.js";
import { autoCompact } from "../ui/compact.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const LR = 0.2126, LG = 0.7152, LB = 0.0722;

/* ── la matemática, pura y comprobable sin lienzo ────────────────── */

export function luminosityArray(data, w, h){
  const n = w * h;
  const out = new Float32Array(n);
  for(let p = 0, i = 0; p < n; p++, i += 4) out[p] = data[i]*LR + data[i+1]*LG + data[i+2]*LB;
  return out;
}

/* Una pasada de auto-multiplicación: m·m/255, el mismo resultado que
   fundir la máscara consigo misma en modo Multiplicar. Estrecha hacia
   el extremo que ya fuera más claro dentro del propio array. */
function selfMultiplyPass(src){
  const out = new Float32Array(src.length);
  for(let i = 0; i < src.length; i++) out[i] = src[i] * src[i] / 255;
  return out;
}

const KIND_BASE = {
  lights(lum){ return lum; },
  darks(lum){
    const out = new Float32Array(lum.length);
    for(let i = 0; i < lum.length; i++) out[i] = 255 - lum[i];
    return out;
  },
  // «Tienda de campaña»: 255 en el gris medio exacto, cae hacia 0 tanto
  // en negro puro como en blanco puro — la base de cualquier máscara
  // de medios.
  mids(lum){
    const out = new Float32Array(lum.length);
    for(let i = 0; i < lum.length; i++) out[i] = 255 - Math.abs(2 * lum[i] - 255);
    return out;
  }
};

/* `level` de 1 a 5. Nivel 1 es la base sin tocar; cada nivel de más
   añade una auto-multiplicación, exactamente como los L2-L5/D2-D5 de
   cualquier panel de máscaras de luminosidad. */
export function luminosityPreset(lum, kind, level){
  let m = KIND_BASE[kind](lum);
  for(let k = 1; k < level; k++) m = selfMultiplyPass(m);
  const out = new Uint8ClampedArray(m.length);
  for(let i = 0; i < m.length; i++) out[i] = clamp255(Math.round(m[i]));
  return out;
}

function invertMask(m){
  const out = new Uint8ClampedArray(m.length);
  for(let i = 0; i < m.length; i++) out[i] = 255 - m[i];
  return out;
}

/* ── llevar el resultado a una capa de verdad ────────────────────── */

function rasterLayer(){
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return null; }
  if(l.locked){ toast("La capa está bloqueada"); return null; }
  if(l.type === "adjust" || l.type === "group"){
    toast("Selecciona una capa de imagen, no un ajuste ni un grupo", "err");
    return null;
  }
  return l;
}

/* Un solo paso de historial tanto si la capa no tenía máscara —se crea
   ya con este contenido, reutilizando `addMask(layer, true)` sobre
   `doc.selection`, el mismo camino que ya usa «Máscara degradada…»—
   como si YA tenía una y hay que sustituirla de verdad, que es el caso
   nuevo que no cubría ese camino (addMask se niega en silencio si la
   capa ya lleva máscara). */
function setLayerMaskFromArray(layer, maskArr){
  const w = doc.w, h = doc.h;
  if(!layer.mask){
    const prevSelection = doc.selection;
    doc.selection = { mask: maskArr, w, h };
    addMask(layer, true);
    doc.selection = prevSelection;
    return;
  }
  const before = document.createElement("canvas");
  before.width = w; before.height = h;
  before.getContext("2d").drawImage(layer.mask.canvas, 0, 0);

  const img = new ImageData(w, h);
  const d = img.data;
  for(let p = 0, i = 0; p < maskArr.length; p++, i += 4){ d[i] = d[i+1] = d[i+2] = 255; d[i+3] = maskArr[p]; }
  layer.mask.ctx.save();
  layer.mask.ctx.globalCompositeOperation = "copy";
  layer.mask.ctx.putImageData(img, 0, 0);
  layer.mask.ctx.restore();
  layer.thumbDirty = true;

  const after = document.createElement("canvas");
  after.width = w; after.height = h;
  after.getContext("2d").drawImage(layer.mask.canvas, 0, 0);

  const restoreTo = canvas => {
    layer.mask.ctx.save();
    layer.mask.ctx.globalCompositeOperation = "copy";
    layer.mask.ctx.drawImage(canvas, 0, 0);
    layer.mask.ctx.restore();
    layer.thumbDirty = true;
    emit("doc:change");
  };
  record("Máscara de luminosidad", () => restoreTo(before), () => restoreTo(after));
  emit("doc:structure"); emit("doc:change");
}

/* ── el panel ─────────────────────────────────────────────────────── */

const LUM_ROWS = [
  { kind:"lights", label:"Luces" },
  { kind:"mids",   label:"Medios" },
  { kind:"darks",  label:"Sombras" }
];
const THUMB = 64;

export async function openLuminosityMaskPanel(){
  const layer = rasterLayer();
  if(!layer) return;

  const fullImg = layer.ctx.getImageData(0, 0, doc.w, doc.h);
  const fullLum = luminosityArray(fullImg.data, doc.w, doc.h);

  // Miniatura cuadrada reducida, igual que la rejilla de Blanco y
  // negro automático: barata de recorrer quince veces (más el modo
  // color) aunque el documento sea grande de verdad.
  const side = Math.min(doc.w, doc.h);
  const tcanvas = document.createElement("canvas");
  tcanvas.width = THUMB; tcanvas.height = THUMB;
  const tctx = tcanvas.getContext("2d", { willReadFrequently:true });
  tctx.drawImage(layer.canvas, (doc.w - side) / 2, (doc.h - side) / 2, side, side, 0, 0, THUMB, THUMB);
  const thumbBaseData = tctx.getImageData(0, 0, THUMB, THUMB);
  const thumbLum = luminosityArray(thumbBaseData.data, THUMB, THUMB);

  function paintGrayThumb(canvas, maskArr, w, h){
    const cx = canvas.getContext("2d");
    const img = cx.createImageData(w, h);
    const d = img.data;
    for(let p = 0, i = 0; p < maskArr.length; p++, i += 4){ d[i] = d[i+1] = d[i+2] = maskArr[p]; d[i+3] = 255; }
    cx.putImageData(img, 0, 0);
  }

  // ── estado del candidato actual ──
  let current = { kind:"lights", level:1 };   // o { kind:"color", hue, tolerance }
  let invert = false, featherPx = 0;

  const box = document.createElement("div");
  box.innerHTML = `
    <p class="hint" style="margin-top:0">Quince máscaras listas —Luces, Medios y Sombras en
      cinco niveles cada una, del 1 (todo lo que tenga algo de esa luz) al 5 (sólo lo más
      puro)— más una a partir de un color. Elige una para verla en el lienzo, ajusta y
      lleva el resultado a la capa.</p>
    <div id="lumGrid"></div>
    <div class="section-label" style="margin-top:14px">Por color</div>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
      <canvas id="colorThumb" width="${THUMB}" height="${THUMB}"
        style="width:64px;height:64px;border-radius:var(--r);border:2px solid var(--line);cursor:pointer;flex:none"></canvas>
      <div style="flex:1;min-width:0" id="colorSliders"></div>
    </div>
    <div class="section-label" style="margin-top:14px">Ajustes</div>
    <div id="postSliders"></div>
    <p class="hint mono" id="lumNote" style="margin-top:6px"></p>`;

  const grid = box.querySelector("#lumGrid");
  const cells = new Map();   // key "lights-3" | "color" -> { cell, canvas }

  function markSelected(key){
    for(const [k, v] of cells) v.cell.style.borderColor = k === key ? "var(--ac)" : "var(--line)";
  }

  for(const row of LUM_ROWS){
    const rowEl = document.createElement("div");
    rowEl.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:6px";
    const label = document.createElement("span");
    label.textContent = row.label;
    label.style.cssText = "width:56px;flex:none;font-size:var(--fs-sm);color:var(--tx-dim)";
    rowEl.appendChild(label);
    for(let level = 1; level <= 5; level++){
      const cell = document.createElement("button");
      cell.style.cssText = "padding:2px;border-radius:var(--r);border:2px solid var(--line);background:transparent;flex:1;min-width:0";
      const cv = document.createElement("canvas");
      cv.width = THUMB; cv.height = THUMB;
      cv.style.cssText = "width:100%;height:auto;display:block;border-radius:2px";
      const num = document.createElement("div");
      num.textContent = row.label[0] + level;
      num.style.cssText = "font-size:var(--fs-xs);color:var(--tx-faint);text-align:center;margin-top:2px";
      cell.append(cv, num);
      const m = luminosityPreset(thumbLum, row.kind, level);
      paintGrayThumb(cv, m, THUMB, THUMB);
      const key = row.kind + "-" + level;
      cell.addEventListener("click", () => {
        current = { kind: row.kind, level };
        markSelected(key);
        updatePreview();
      });
      cells.set(key, { cell, canvas: cv });
      rowEl.appendChild(cell);
    }
    grid.appendChild(rowEl);
  }

  // ── color ──
  let colorHue = 30, colorTol = 35;
  const colorThumb = box.querySelector("#colorThumb");
  function redrawColorThumb(){
    const m = colorRangeMask(thumbBaseData.data, THUMB, THUMB, { mode:"color", hue:colorHue, tolerance:colorTol });
    paintGrayThumb(colorThumb, m, THUMB, THUMB);
  }
  redrawColorThumb();
  colorThumb.addEventListener("click", () => {
    current = { kind:"color" };
    markSelected("color");
    updatePreview();
  });
  cells.set("color", { cell: colorThumb, canvas: colorThumb });

  const colorSlidersHost = box.querySelector("#colorSliders");
  const hueSlider = slider("Matiz", 0, 359, colorHue, v => {
    colorHue = v; redrawColorThumb();
    if(current.kind === "color") updatePreview();
  }, "°");
  const tolSlider = slider("Tolerancia", 1, 180, colorTol, v => {
    colorTol = v; redrawColorThumb();
    if(current.kind === "color") updatePreview();
  }, "°");
  colorSlidersHost.append(hueSlider, tolSlider);

  // ── suavizar / invertir, sobre el candidato actual ──
  const postHost = box.querySelector("#postSliders");
  const featherSlider = slider("Suavizar", 0, 60, featherPx, v => { featherPx = v; updatePreview(); }, " px");
  const invertRow = document.createElement("label");
  invertRow.className = "chk";
  invertRow.innerHTML = `<input type="checkbox"> Invertir`;
  invertRow.querySelector("input").addEventListener("change", e => { invert = e.target.checked; updatePreview(); });
  postHost.append(featherSlider, invertRow);

  const note = box.querySelector("#lumNote");

  // ── vista previa en vivo: la máscara candidata, a tamaño completo,
  //    como selección —las mismas hormigas en marcha que ya usa
  //    cualquier otra selección de la aplicación—. */
  let fullCandidate = null;
  function computeFullMask(){
    let m;
    if(current.kind === "color") m = colorRangeMask(fullImg.data, doc.w, doc.h, { mode:"color", hue:colorHue, tolerance:colorTol });
    else m = luminosityPreset(fullLum, current.kind, current.level);
    if(invert) m = invertMask(m);
    if(featherPx > 0) m = featherMask(m, doc.w, doc.h, featherPx);
    return m;
  }
  function updatePreview(){
    fullCandidate = computeFullMask();
    doc.selection = { mask: fullCandidate, w: doc.w, h: doc.h };
    emit("doc:structure"); emit("doc:change");
    note.textContent = current.kind === "color"
      ? `Color · matiz ${colorHue}° · tolerancia ${colorTol}°` + (invert ? " · invertida" : "") + (featherPx ? ` · suavizada ${featherPx}px` : "")
      : `${LUM_ROWS.find(r => r.kind === current.kind).label} · nivel ${current.level}` + (invert ? " · invertida" : "") + (featherPx ? ` · suavizada ${featherPx}px` : "");
  }

  const prevSelection = doc.selection;
  markSelected("lights-1");
  updatePreview();

  /* Móvil: deslizadores apilados → desplegable + uno (ui/compact.js). */ autoCompact(box);
  const res = await dialog({
    title: "Máscaras de luminosidad y color", body: box, wide: true,
    buttons: [
      { label:"Cancelar", value:null },
      { label:"Aplicar como selección", value:"sel" },
      { label:"Aplicar como máscara de capa", value:"mask", primary:true }
    ]
  });

  if(res === null){
    doc.selection = prevSelection;
    emit("doc:structure"); emit("doc:change");
    return;
  }
  if(res === "sel"){
    // `fullCandidate` ya es exactamente lo que hay en `doc.selection`:
    // no hace falta tocar nada más, sólo confirmarlo con un aviso.
    toast("Selección creada", "ok");
    return;
  }
  // "mask": la selección en curso ya cumplió su papel de vista previa,
  // se limpia antes de escribir la máscara de verdad.
  doc.selection = prevSelection;
  setLayerMaskFromArray(layer, fullCandidate);
  toast("Máscara de capa aplicada", "ok");
}
