/* ═══════════════════════════════════════════════════════════════
   CAPAS DE AJUSTE
   La diferencia con un ajuste normal (adjustments.js) no está en las
   matemáticas —son las mismas tablas— sino en CUÁNDO se calculan: en
   vez de escribirse una sola vez sobre los píxeles de una capa, una
   capa de ajuste no tiene contenido propio y su efecto se recalcula
   en cada composición sobre lo que haya debajo en ese momento. Mover
   una capa de foto por debajo de una capa de ajuste hace que el
   ajuste la alcance sin haber tocado ni un píxel de nadie; volver a
   abrir sus parámetros semanas después sigue siendo posible porque
   nunca se «cocinaron» en nada.

   Las funciones que calculan cada efecto son las mismas —y las mismas
   tablas de 256 entradas— que usan los ajustes destructivos de
   siempre: `applyBC`, `buildLevels`, `curveLut`, `buildWB`, `hslShift`,
   `buildBandTables`/`applyColorBands`. No hay dos implementaciones de
   «subir el contraste» en la aplicación, sólo dos sitios que llaman a
   la misma.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../../core/doc.js";
import { record, recordLayers } from "../../core/history.js";
import { emit } from "../../core/bus.js";
import { applyBC, bcControls, bcPivot, buildLevels, buildWB, hslShift, wbEyedropper, sampleCanvas } from "../adjust/adjustments.js";
import { curveLut, curveEditor } from "../adjust/curves.js";
import { slider, pickerGroup } from "../adjust/adjust.js";
import { dialog } from "../../ui/kit/dialog.js";
import { flatten } from "./layertree.js";
import { isMobile } from "../../core/device.js";
import { buildBandTables, applyColorBands } from "../adjust/colorbands.js";
import { ADJUST_TYPES, adjustTypeName, isAdjustLayer } from "./adjust-types.js";
export { ADJUST_TYPES, exposureFunction, adjustTypeIds, adjustTypeName, applyAdjustLayer, isAdjustLayer } from "./adjust-types.js";

/* Pivote automático de Brillo y contraste en una capa de ajuste. La
   capa se pinta a veces por teselas, y si cada tesela midiera su propia
   luminosidad media el contraste cambiaría de una a otra y se verían
   las costuras: se mide UNA vez sobre todo lo que queda debajo, al
   abrir sus mandos, y se guarda en los parámetros (`pivotL`). No abre
   paso de historial: es un dato derivado de la imagen, no una edición. */
function measureBcPivot(layer){
  if(layer.adjustType !== "bc") return;
  try{
    const idx = doc.layers.indexOf(layer);
    if(idx < 0) return;
    const full = flatten(null, doc.layers.slice(0, idx));
    const k = Math.min(1, 512 / Math.max(full.width, full.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(full.width * k)); c.height = Math.max(1, Math.round(full.height * k));
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(full, 0, 0, c.width, c.height);
    layer.adjustParams = { ...(layer.adjustParams || {}), pivotL: bcPivot(x.getImageData(0, 0, c.width, c.height).data) };
  }catch(err){ console.warn("[bc] pivote", err); }
}

/* Lo que se ve debajo de una capa de ajuste, reducido a 1024 px como
   mucho: la fuente del cuentagotas de su balance de blancos. */
function compositeBelow(layer){
  try{
    const idx = layer ? doc.layers.indexOf(layer) : -1;
    if(idx < 0) return null;
    const full = flatten(null, doc.layers.slice(0, idx));
    const k = Math.min(1, 1024 / Math.max(full.width, full.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(full.width * k)); c.height = Math.max(1, Math.round(full.height * k));
    c.getContext("2d").drawImage(full, 0, 0, c.width, c.height);
    full.width = full.height = 1;
    return c;
  }catch(err){ console.warn("[wb] debajo", err); return null; }
}

/* ── crear y editar ──────────────────────────────────────────── */
export function addAdjustmentLayer(typeId){
  const t = ADJUST_TYPES[typeId];
  if(!t || !doc.open) return null;
  return recordLayers("Nueva capa de ajuste", () => {
    const l = addLayer({ type: "adjust", name: t.name });
    l.adjustType = typeId;
    l.adjustParams = t.defaults();
    emit("doc:structure"); emit("doc:change");
    return l;
  });
}

/* Cambiar los parámetros también es un paso de historial, aparte del
   de crear la capa, porque es la parte que de verdad se retoca con calma, se prueba, y
   sobre la que tiene sentido poder arrepentirse. */
export function setAdjustParams(layer, params){
  if(!layer || layer.type !== "adjust") return;
  const before = layer.adjustParams, after = { ...params };
  layer.adjustParams = after;
  record("Ajuste: " + adjustTypeName(layer.adjustType),
    () => { layer.adjustParams = before; emit("doc:change"); },
    () => { layer.adjustParams = after;  emit("doc:change"); });
  emit("doc:change");
}

/* Vista previa en vivo mientras se mueve un deslizador: cambia el
   parámetro sin abrir un paso de historial en cada fotograma —eso lo
   hace `setAdjustParams` una sola vez, al terminar—. */
export function previewAdjustParams(layer, params){
  if(!layer || layer.type !== "adjust") return;
  layer.adjustParams = { ...params };
  emit("doc:change");
}


/* ═══════════════════════════════════════════════════════════════
   PANEL DE EDICIÓN
   No reutiliza `runAdjust` —ese esqueleto está pensado para escribir
   píxeles una vez al aceptar—; aquí «aceptar» sólo confirma unos
   parámetros que ya se estaban viendo en directo desde la primera
   pincelada de deslizador, porque la capa entera es la vista previa.
   Cancelar los devuelve a como estaban al abrir el panel.
   ═══════════════════════════════════════════════════════════════ */

const HIST_VACIO = () => ({ r:new Uint32Array(256), g:new Uint32Array(256),
                             b:new Uint32Array(256), l:new Uint32Array(256) });

function bodyFor(typeId, p, preview, layer = null){
  const box = document.createElement("div");
  const S = (label, key, min, max, unit) =>
    box.appendChild(slider(label, min, max, p[key], v => { p[key] = v; preview(); }, unit || ""));

  if(typeId === "bc"){
    box.appendChild(bcControls(p, preview));
  } else if(typeId === "levels"){
    S("Negro de entrada", "inLow", 0, 254);
    // Gamma se guarda como razón (1 = neutro), pero el deslizador
    // trabaja en enteros: se expone como porcentaje (100 = neutro) y
    // se escala al leer y al escribir, igual que en el diálogo de
    // Niveles de siempre.
    box.appendChild(slider("Gamma", 10, 300, Math.round(p.gamma * 100),
      v => { p.gamma = v / 100; preview(); }, "%"));
    S("Blanco de entrada", "inHigh", 1, 255);
    S("Negro de salida", "outLow", 0, 254);
    S("Blanco de salida", "outHigh", 1, 255);
  } else if(typeId === "curves"){
    const ed = curveEditor({
      getPoints: () => p.points,
      setPoints: pts => { p.points = pts; preview(); },
      hist: HIST_VACIO(),
      channel: () => "rgb"
    });
    box.appendChild(ed.el);
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Sólo la curva maestra: para ajustar canales por separado, usa " +
      "Curvas… en el menú Ajustes como retoque normal.";
    box.appendChild(hint);
  } else if(typeId === "exposure"){
    box.appendChild(slider("Exposición", -3, 3, Math.round((p.ev || 0) * 100) / 100,
      v => { p.ev = v; preview(); }, " EV", 0.05));
  } else if(typeId === "wb"){
    // Cuentagotas sobre la imagen abierta; lee lo que queda DEBAJO de
    // la capa (sin este balance), que es lo que ella corrige.
    let sTemp, sTint, below = null;
    const pick = wbEyedropper((x, y) => sampleCanvas(below ||= compositeBelow(layer))(x, y), p, () => {
      sTemp.setValue(p.temp); sTint.setValue(p.tint); preview();
    });
    sTemp = box.appendChild(slider("Temperatura", -100, 100, p.temp, v => { p.temp = v; preview(); }));
    sTint = box.appendChild(slider("Tinte", -100, 100, p.tint, v => { p.tint = v; preview(); }));
    box.appendChild(pick.el);
  } else if(typeId === "hsl"){
    S("Tono", "hue", -180, 180, "°");
    S("Saturación", "sat", -100, 100);
    S("Luminosidad", "light", -100, 100);
  } else if(typeId === "bands"){
    const tabs = document.createElement("div");
    tabs.className = "seg";
    tabs.style.cssText = "flex-wrap:wrap;height:auto;margin-bottom:8px";
    const host = document.createElement("div");
    const defs = [["master","Todas"],["red","Rojos"],["yellow","Amarillos"],
                  ["green","Verdes"],["cyan","Cianes"],["blue","Azules"],["magenta","Magentas"]];
    let cur = "master";
    const renderTab = () => {
      host.innerHTML = "";
      const b = p[cur];
      const put = (label, key, min, max) => host.appendChild(
        slider(label, min, max, b[key], v => { b[key] = v; preview(); }));
      if(cur === "master"){
        put("Brillo", "bright", -100, 100);
        put("Saturación", "sat", -100, 100);
        put("Luminosidad", "light", -100, 100);
      } else {
        put("Matiz", "hue", -100, 100);
        put("Saturación", "sat", -100, 100);
        put("Luminosidad", "light", -100, 100);
      }
    };
    for(const [key, label] of defs){
      const b = document.createElement("button");
      b.textContent = label;
      b.className = key === cur ? "on" : "";
      b.addEventListener("click", () => {
        cur = key;
        tabs.querySelectorAll("button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        renderTab();
      });
      tabs.appendChild(b);
    }
    box.append(tabs, host);
    renderTab();
  } else {
    const p2 = document.createElement("p");
    p2.className = "hint";
    p2.textContent = "Este ajuste no tiene parámetros: convierte a blanco y negro (o invierte)" +
      " todo lo que haya debajo, según su opacidad y su máscara.";
    box.appendChild(p2);
  }
  return box;
}

/* Tipos que ya usan pickerGroup (ver bodyFor): sólo ésos pierden la
   cabecera, el texto de ayuda y encogen el pie del diálogo en móvil
   —el resto sigue enseñando varios deslizadores a la vez sin un
   desplegable que los sustituya, y ahí la cabecera sigue haciendo
   falta para saber qué panel es éste—. Se amplía según se vaya
   convirtiendo cada tipo. */
const PICKER_TYPES = new Set(["bc"]);

export async function openAdjustPanel(layer){
  if(!isAdjustLayer(layer)) return;
  const t = ADJUST_TYPES[layer.adjustType];
  if(!t) return;
  measureBcPivot(layer);
  const original = layer.adjustParams;
  const p = JSON.parse(JSON.stringify(original));   // copia de trabajo

  const preview = () => previewAdjustParams(layer, p);
  const body = bodyFor(layer.adjustType, p, preview, layer);

  const res = await dialog({
    title: t.name, body, wide: layer.adjustType === "curves" || layer.adjustType === "bands",
    cls: isMobile() ? "dlg-compact" : "",
    buttons: [{ label:"Cancelar", value:null }, { label:"Aceptar", primary:true, value:"go" }]
  });

  if(res === "go") setAdjustParams(layer, p);
  else previewAdjustParams(layer, original);   // deshace la vista previa en directo
}

/* ── panel de propiedades, en vivo ─────────────────────────────────
   Misma maquinaria que `openAdjustPanel` —vista previa inmediata desde
   la primera pincelada, `bodyFor` reutilizado tal cual—, pero montada
   directamente en el panel en vez de tras un diálogo modal. Sin
   «Cancelar»: en un panel que no se cierra nunca del todo no hay nada
   que cancelar, sólo un `commit()` que confirma como un único paso de
   historial —lo llama quien monta, normalmente al dejar de estar esta
   capa activa—. */
export function mountAdjustProperties(layer, container){
  if(!isAdjustLayer(layer)) return null;
  const t = ADJUST_TYPES[layer.adjustType];
  if(!t) return null;
  measureBcPivot(layer);
  const original = layer.adjustParams;
  const p = JSON.parse(JSON.stringify(original));

  const preview = () => previewAdjustParams(layer, p);
  const body = bodyFor(layer.adjustType, p, preview, layer);
  container.appendChild(body);

  return {
    commit(){
      if(JSON.stringify(p) === JSON.stringify(original)) return;   // nada que confirmar
      setAdjustParams(layer, p);
    }
  };
}
