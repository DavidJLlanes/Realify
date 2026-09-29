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

import { doc, addLayer } from "../core/doc.js";
import { record, recordLayers } from "../core/history.js";
import { emit } from "../core/bus.js";
import { applyLut, identityLut } from "./adjust.js";
import { applyBC, bcControls, bcPivot, BC_DEFAULTS, buildLevels, buildWB, hslShift } from "./adjustments.js";
import { curveLut, curveEditor } from "./curves.js";
import { slider, pickerGroup } from "./adjust.js";
import { dialog } from "../ui/dialog.js";
import { flatten } from "./layertree.js";
import { isMobile } from "../core/device.js";
import { buildBandTables, applyColorBands } from "./colorbands.js";

function grayscaleApply(data){
  for(let i = 0; i < data.length; i += 4){
    const l = data[i]*0.2126 + data[i+1]*0.7152 + data[i+2]*0.0722;
    data[i] = data[i+1] = data[i+2] = l;
  }
}
function invertApply(data){
  for(let i = 0; i < data.length; i += 4){
    data[i] = 255 - data[i]; data[i+1] = 255 - data[i+1]; data[i+2] = 255 - data[i+2];
  }
}
function defaultBands(){
  const o = {};
  for(const k of ["red","yellow","green","cyan","blue","magenta"]) o[k] = { hue:0, sat:0, light:0 };
  o.master = { bright:0, sat:0, light:0 };
  return o;
}

/* Cada tipo declara sus parámetros por defecto y cómo pasar de esos
   parámetros a píxeles. `apply` muta `data` in place: quien llama ya
   ha decidido si eso va a un `putImageData` directo o a una mezcla
   parcial por opacidad o máscara. */
export const ADJUST_TYPES = {
  bc: {
    name: "Brillo y contraste",
    defaults: () => ({ ...BC_DEFAULTS }),
    apply(data, w, h, p){ applyBC(data, p); }
  },
  levels: {
    name: "Niveles",
    defaults: () => ({ inLow:0, inHigh:255, gamma:1, outLow:0, outHigh:255, channel:"rgb" }),
    apply(data, w, h, p){ applyLut(data, buildLevels(p)); }
  },
  curves: {
    name: "Curvas",
    defaults: () => ({ points: [[0,0],[255,255]] }),
    apply(data, w, h, p){
      const t = curveLut(p.points && p.points.length >= 2 ? p.points : [[0,0],[255,255]]);
      applyLut(data, { r:t, g:t, b:t });
    }
  },
  wb: {
    name: "Balance de blancos",
    defaults: () => ({ temp: 0, tint: 0 }),
    apply(data, w, h, p){ applyLut(data, buildWB(p)); }
  },
  hsl: {
    name: "Tono y saturación",
    defaults: () => ({ hue: 0, sat: 0, light: 0, colorize: false }),
    apply(data, w, h, p){ hslShift(data, p); }
  },
  /* Exposición en pasos (EV), en luz lineal como en una cámara: +1 EV
     duplica la luz. La usa también «Aplicar esta edición a otras
     fotos» (lote/) para igualar la exposición de cada foto. */
  exposure: {
    name: "Exposición",
    defaults: () => ({ ev: 0 }),
    apply(data, w, h, p){
      const k = Math.pow(2, p.ev || 0);
      if(k === 1) return;
      const t = new Uint8ClampedArray(256);
      for(let i = 0; i < 256; i++){
        let v = i / 255; v = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        v = Math.min(1, v * k);
        t[i] = Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
      }
      applyLut(data, { r: t, g: t, b: t });
    }
  },
  gray: {
    name: "Blanco y negro",
    defaults: () => ({}),
    apply(data){ grayscaleApply(data); }
  },
  invert: {
    name: "Invertir",
    defaults: () => ({}),
    apply(data){ invertApply(data); }
  },
  bands: {
    name: "Color por canales",
    defaults: () => defaultBands(),
    apply(data, w, h, p){
      const t = buildBandTables(p);
      if(!t.anyBand && !t.anyMaster) return;
      for(let i = 0; i < data.length; i += 4){
        const [r, g, b] = applyColorBands(data[i], data[i+1], data[i+2], p, t);
        data[i] = r; data[i+1] = g; data[i+2] = b;
      }
    }
  }
};

export const adjustTypeIds = () => Object.keys(ADJUST_TYPES);
export const adjustTypeName = id => (ADJUST_TYPES[id] && ADJUST_TYPES[id].name) || id;

/* Aplica el efecto de una capa de ajuste sobre un `ImageData` que ya
   trae compuesto lo que hay debajo. Devuelve los mismos datos
   mutados: no hay copia adicional aquí, la hace quien llama si la
   necesita para poder comparar antes/después (la mezcla por opacidad
   o máscara, más abajo). */
export function applyAdjustLayer(layer, data, w, h){
  const t = ADJUST_TYPES[layer.adjustType];
  if(!t) return data;
  t.apply(data, w, h, layer.adjustParams || t.defaults());
  return data;
}

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

export const isAdjustLayer = l => !!(l && l.type === "adjust");

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

function bodyFor(typeId, p, preview){
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
    S("Temperatura", "temp", -100, 100);
    S("Tinte", "tint", -100, 100);
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
  const body = bodyFor(layer.adjustType, p, preview);

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
  const body = bodyFor(layer.adjustType, p, preview);
  container.appendChild(body);

  return {
    commit(){
      if(JSON.stringify(p) === JSON.stringify(original)) return;   // nada que confirmar
      setAdjustParams(layer, p);
    }
  };
}
