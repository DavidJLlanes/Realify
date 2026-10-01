/* ═══════════════════════════════════════════════════════════════
   AJUSTES SOBRE LA MÁSCARA
   Niveles, Curvas, Desenfoque y Propiedades (densidad/desvanecer),
   pero apuntando a `layer.mask` en vez de a la capa —el equivalente a
   seleccionar la miniatura de la máscara en Photoshop y abrir
   Imagen›Ajustes con ella activa—. Reutiliza las mismas tablas y el
   mismo editor de curvas que ya usan los ajustes de capa
   (adjust.js/adjustments.js/curves.js): lo único distinto es cómo se
   lee y se escribe el resultado, porque una máscara no guarda su
   valor en RGB, lo guarda en el canal alfa (ver masks.js). Por eso
   cada ajuste, antes de aplicar la misma tabla de siempre, «copia» el
   alfa a los tres canales de color —así el resto de la maquinaria ve
   una imagen en gris como cualquier otra—, y al terminar hace el
   camino de vuelta: el resultado en rojo pasa a ser el nuevo alfa. */

import { runMaskDialog, cloneMask, getIsolateView, toggleIsolateView } from "./masks.js";
import { applyLut, drawHistogram, slider, histogram } from "./adjust.js";
import { curveLut, curveEditor } from "./curves.js";
import { blurred } from "../filters/basic.js";
import { backgroundMask } from "../features/photo-tools.js";
import { featherMask } from "./selection.js";
import { record } from "../core/history.js";
import { emit, on } from "../core/bus.js";
import { toast } from "../ui/toast.js";

/* Exportadas para poder probarlas con números de verdad, sin canvas:
   el «ida y vuelta» alfa↔gris es la pieza que hace que Niveles y
   Curvas —pensados para RGB— sirvan también para una máscara. */
export function toGrayView(canvas, w, h){
  const img = canvas.getContext("2d").getImageData(0, 0, w, h);
  return grayEncode(img);
}
export function grayEncode(img){
  const d = img.data;
  for(let i = 0; i < d.length; i += 4) d[i] = d[i+1] = d[i+2] = d[i+3];
  return img;
}
export function fromGrayView(img){
  const d = img.data;
  for(let i = 0; i < d.length; i += 4){ d[i+3] = d[i]; d[i] = d[i+1] = d[i+2] = 255; }
  return img;
}

/* Densidad: dosifica el efecto entero de la máscara mezclando su
   alfa hacia 255 (sin efecto) en proporción a `density` (0-100).
   Pura sobre un ImageData para poder probarla sin blur de por medio
   —el desenfoque de Desvanecer sólo existe de verdad en un <canvas>
   real, así que ese tramo se verifica en el navegador—. */
export function applyDensity(img, density){
  const d = img.data;
  const k = Math.max(0, Math.min(100, density)) / 100;
  for(let i = 3; i < d.length; i += 4) d[i] = d[i] * k + 255 * (1 - k);
  return img;
}

/* ── niveles ──────────────────────────────────────────────────── */
export function maskLevels(layer){
  if(!layer || !layer.mask) return;
  const p = { inLow:0, inHigh:255, gamma:1, outLow:0, outHigh:255 };
  const hist = histogram(toGrayView(layer.mask.canvas, layer.mask.canvas.width, layer.mask.canvas.height));

  return runMaskDialog(layer, {
    title: "Niveles de la máscara",
    wide: true,
    apply(ctx, backup, w, h){
      const img = toGrayView(backup.canvas, w, h);
      applyLut(img.data, buildLevelsForMask(p));
      ctx.putImageData(fromGrayView(img), 0, 0);
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <canvas id="lvHist" width="512" height="110"
          style="width:100%;border:1px solid var(--line-soft);border-radius:var(--r);
                 display:block;margin:4px 0 8px"></canvas>
        <div class="section-label">Entrada</div>
        <div id="lvIn"></div>
        <div class="section-label">Salida</div>
        <div id="lvOut"></div>`;
      drawHistogram(box.querySelector("#lvHist"), hist, "l");

      const inBox = box.querySelector("#lvIn");
      const sLow  = slider("Negro", 0, 254, 0, v => { p.inLow = Math.min(v, p.inHigh - 1); preview(); });
      const sGam  = slider("Gamma", 10, 300, 100, v => { p.gamma = v / 100; preview(); }, "%");
      const sHigh = slider("Blanco", 1, 255, 255, v => { p.inHigh = Math.max(v, p.inLow + 1); preview(); });
      inBox.append(sLow, sGam, sHigh);

      const outBox = box.querySelector("#lvOut");
      outBox.append(
        slider("Negro", 0, 254, 0, v => { p.outLow = v; preview(); }),
        slider("Blanco", 1, 255, 255, v => { p.outHigh = v; preview(); }));

      return box;
    }
  });
}

/* Como `buildLevels` de adjustments.js, sin el selector de canal: una
   máscara no tiene rojo/verde/azul, así que siempre es el maestro. */
export function buildLevelsForMask(p){
  const t = new Uint8ClampedArray(256);
  const span = Math.max(1, p.inHigh - p.inLow);
  const inv = 1 / p.gamma;
  for(let i = 0; i < 256; i++){
    let v = (i - p.inLow) / span;
    v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, inv);
    t[i] = Math.max(0, Math.min(255, Math.round(p.outLow + v * (p.outHigh - p.outLow))));
  }
  return { r:t, g:t, b:t };
}

/* ── curvas ───────────────────────────────────────────────────── */
export function maskCurves(layer){
  if(!layer || !layer.mask) return;
  const points = [[0,0],[255,255]];
  const hist = histogram(toGrayView(layer.mask.canvas, layer.mask.canvas.width, layer.mask.canvas.height));

  return runMaskDialog(layer, {
    title: "Curvas de la máscara",
    wide: true,
    apply(ctx, backup, w, h){
      const img = toGrayView(backup.canvas, w, h);
      const lut = curveLut(points);
      applyLut(img.data, { r:lut, g:lut, b:lut });
      ctx.putImageData(fromGrayView(img), 0, 0);
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      const ed = curveEditor({
        getPoints: () => points,
        setPoints: pts => { points.length = 0; points.push(...pts); preview(); },
        hist, channel: () => "l"
      });
      box.appendChild(ed.el);

      const row = document.createElement("div");
      row.className = "seg";
      row.style.marginTop = "8px";
      row.innerHTML = `<button data-p="reset">Restablecer</button>
                       <button data-p="scurve">Curva en S</button>
                       <button data-p="fade">Desvanecido</button>`;
      row.addEventListener("click", e => {
        const b = e.target.closest("[data-p]");
        if(!b) return;
        const next = b.dataset.p === "scurve" ? [[0,0],[64,48],[192,208],[255,255]]
                   : b.dataset.p === "fade"   ? [[0,24],[255,235]]
                   :                            [[0,0],[255,255]];
        points.length = 0; points.push(...next);
        ed.refresh(); preview();
      });
      box.appendChild(row);
      return box;
    }
  });
}

/* ── desenfoque gaussiano (suavizar los bordes de la máscara) ───── */
export function maskBlur(layer){
  if(!layer || !layer.mask) return;
  const p = { radius: 4 };

  return runMaskDialog(layer, {
    title: "Suavizar máscara",
    apply(ctx, backup){
      ctx.save();
      ctx.globalCompositeOperation = "copy";
      ctx.drawImage(blurred(backup.canvas, p.radius), 0, 0);
      ctx.restore();
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.appendChild(slider("Radio", 0, 200, 4, v => { p.radius = v; preview(); }, " px"));
      return box;
    }
  });
}

/* ── propiedades: densidad y desvanecer ──────────────────────────
   El panel «Propiedades» de Photoshop, resuelto como diálogo con
   vista previa: Densidad dosifica el efecto entero de la máscara
   —a 0% no oculta nada, sea cual sea su contenido—, Desvanecer
   difumina sus bordes con el mismo desenfoque gaussiano de arriba
   antes de aplicar la densidad, que es el orden en que Photoshop
   compone las dos. */
export function maskProperties(layer){
  if(!layer || !layer.mask) return;
  const p = { density: 100, feather: 0 };

  return runMaskDialog(layer, {
    title: "Propiedades de la máscara",
    apply(ctx, backup, w, h){
      const src = p.feather > 0 ? blurred(backup.canvas, p.feather) : backup.canvas;
      const img = src.getContext("2d").getImageData(0, 0, w, h);
      ctx.putImageData(applyDensity(img, p.density), 0, 0);
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.appendChild(slider("Densidad", 0, 100, 100, v => { p.density = v; preview(); }, "%"));
      box.appendChild(slider("Desvanecer", 0, 250, 0, v => { p.feather = v; preview(); }, " px"));
      return box;
    }
  });
}

/* ── seleccionar sujeto / cielo ─────────────────────────────────────
   Vuelven a calcular el CONTENIDO de la máscara a partir de los
   propios píxeles de la capa: no crean una máscara nueva, sustituyen
   la que ya hay, así que sirven para volver a intentarlo si el primer
   resultado no convenció. Sin panel de vista previa propio —un solo
   clic, no un deslizador que haya que tantear—, un paso de historial. */
function applyMaskArray(layer, arr, title){
  const w = layer.mask.canvas.width, h = layer.mask.canvas.height;
  const before = cloneMask(layer.mask);
  const img = new ImageData(w, h);
  for(let i = 0; i < arr.length; i++){
    const p = i * 4;
    img.data[p] = img.data[p+1] = img.data[p+2] = 255;
    img.data[p+3] = arr[i];
  }
  layer.mask.ctx.putImageData(img, 0, 0);
  layer.thumbDirty = true;
  const after = cloneMask(layer.mask);

  const restore = snap => {
    layer.mask.ctx.save();
    layer.mask.ctx.globalCompositeOperation = "copy";
    layer.mask.ctx.drawImage(snap.canvas, 0, 0);
    layer.mask.ctx.restore();
    layer.thumbDirty = true;
    emit("doc:change");
  };
  record(title, () => restore(before), () => restore(after));
  emit("doc:change");
}

function coverage(arr){
  let sum = 0;
  for(let i = 0; i < arr.length; i++) sum += arr[i] > 127 ? 1 : 0;
  return sum / arr.length;
}

/* ── detección pura ────────────────────────────────────────────────
   Calculan el array de máscara sin tocar el documento: las usan tanto
   los botones del panel de propiedades (aplican sobre `layer.mask`,
   abajo) como los comandos del menú Selección (dejan una selección
   activa con `commitSelection`, ver editor/selection.js) — la misma
   detección, dos sitios donde aterriza. */

/* Persona con el modelo BodyPix (segmentación real, por píxel); si no
   hay nadie con confianza razonable —máscara casi vacía— o el modelo
   no llega a cargar —sin red la primera vez, navegador sin Web
   Workers…—, cae al heurístico de color de siempre (el fondo
   conectado a los bordes, igual que «Eliminar fondo»). */
export async function detectSubjectMask(canvas, { tolerance = 42, feather = 3 } = {}){
  const w = canvas.width, h = canvas.height;
  let arr = null, method = "color";

  try{
    const { segmentPerson } = await import("../filters/segment/segment.js");
    const { mask } = await segmentPerson(canvas);
    const c = coverage(mask);
    // Ni «nadie detectado» ni «la foto entera es persona» —esto
    // último suele ser el modelo confundido con una textura repetida—
    // dan una máscara útil: en los dos casos se prefiere el heurístico.
    if(c > 0.02 && c < 0.92){ arr = mask; method = "persona"; }
  }catch(err){
    console.warn("[seleccionar sujeto] segmentación por IA no disponible, uso el color:", err);
  }

  if(!arr){
    const src = canvas.getContext("2d").getImageData(0, 0, w, h);
    arr = backgroundMask(src, tolerance);
    if(feather) arr = featherMask(arr, w, h, feather);
  }
  return { mask: arr, method };
}

/* Cielo con DeepLab (ADE20K trae «sky» entre sus 150 clases). Sin
   heurístico de repuesto propio —el color por sí solo confunde el
   cielo con cualquier pared o tela azul—: si el modelo no encuentra
   cielo o no llega a cargar, `mask` sale `null`. */
export async function detectSkyMask(canvas){
  const { segmentSky } = await import("../filters/segment/segment.js");
  const { mask, hasSky } = await segmentSky(canvas);
  if(!hasSky || coverage(mask) < 0.01) return { mask: null };
  return { mask };
}

/* ── aplicadas a la máscara de una capa ──────────────────────────── */
export async function selectSubjectMask(layer, opts){
  if(!layer || !layer.mask) return null;
  const { mask, method } = await detectSubjectMask(layer.canvas, opts);
  applyMaskArray(layer, mask, "Seleccionar sujeto");
  return method;
}

export async function selectSkyMask(layer){
  if(!layer || !layer.mask) return false;
  const { mask } = await detectSkyMask(layer.canvas);
  if(!mask) return false;
  applyMaskArray(layer, mask, "Seleccionar cielo");
  return true;
}

/* ── panel de propiedades, en vivo ─────────────────────────────────
   Versión sin diálogo de `maskProperties`: los mismos dos mandos —
   Densidad y Desvanecer— más «Seleccionar sujeto», montados
   directamente en el contenedor que le pase el panel de propiedades.
   La vista previa es inmediata en los dos deslizadores; el paso de
   historial se registra una sola vez, cuando quien llama invoca el
   `commit()` devuelto —normalmente, al dejar de estar esta capa
   activa—, con el mismo criterio que el resto de secciones del panel. */
export function mountMaskProperties(layer, container){
  if(!layer || !layer.mask) return null;
  let backup = cloneMask(layer.mask);
  const { ctx, canvas } = layer.mask;
  const w = canvas.width, h = canvas.height;
  const p = { density: 100, feather: 0 };

  const preview = () => {
    const src = p.feather > 0 ? blurred(backup.canvas, p.feather) : backup.canvas;
    const img = src.getContext("2d").getImageData(0, 0, w, h);
    ctx.putImageData(applyDensity(img, p.density), 0, 0);
    layer.thumbDirty = true;
    emit("doc:change");
  };

  const box = document.createElement("div");
  /* Si se ha pintado la máscara con el panel abierto, la copia de
     partida se renueva antes de mover un mando (si no, Densidad o
     Desvanecer devolverían la máscara a como estaba al abrir el panel). */
  const refresh = () => { if(p.density === 100 && p.feather === 0) backup = cloneMask(layer.mask); };
  box.addEventListener("pointerdown", refresh, true);
  box.addEventListener("focusin", refresh, true);
  box.appendChild(slider("Densidad", 0, 100, 100, v => { p.density = v; preview(); }, "%"));
  box.appendChild(slider("Desvanecer", 0, 250, 0, v => { p.feather = v; preview(); }, " px"));
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;margin-top:6px;flex-wrap:wrap";

  const subjBtn = document.createElement("button");
  subjBtn.textContent = "Seleccionar sujeto";
  subjBtn.title = "Detecta a la persona con IA (BodyPix); si no encuentra a nadie, " +
    "cae al fondo por color conectado a los bordes";
  subjBtn.addEventListener("click", async () => {
    subjBtn.disabled = true; skyBtn.disabled = true;
    const prevText = subjBtn.textContent;
    subjBtn.textContent = "Detectando…";
    try{
      const method = await selectSubjectMask(layer);
      toast(method === "persona" ? "Sujeto seleccionado por IA" : "Sujeto seleccionado por color", "ok");
    }catch(err){
      console.error(err);
      toast("No se pudo detectar el sujeto: " + (err.message || err), "err");
    }finally{
      subjBtn.disabled = false; skyBtn.disabled = false; subjBtn.textContent = prevText;
    }
  });

  const skyBtn = document.createElement("button");
  skyBtn.textContent = "Seleccionar cielo";
  skyBtn.title = "Detecta el cielo con IA (DeepLab/ADE20K)";
  skyBtn.addEventListener("click", async () => {
    subjBtn.disabled = true; skyBtn.disabled = true;
    const prevText = skyBtn.textContent;
    skyBtn.textContent = "Detectando…";
    try{
      const found = await selectSkyMask(layer);
      if(found) toast("Cielo seleccionado", "ok");
      else toast("No se ha encontrado cielo en esta foto", "err");
    }catch(err){
      console.error(err);
      toast("No se pudo detectar el cielo: " + (err.message || err), "err");
    }finally{
      subjBtn.disabled = false; skyBtn.disabled = false; skyBtn.textContent = prevText;
    }
  });

  const refineBtn = document.createElement("button");
  refineBtn.textContent = "Refinar borde…";
  refineBtn.title = "Pelo, pelaje, bordes semitransparentes: engancha el alfa a las transiciones de color reales";
  refineBtn.addEventListener("click", () => {
    import("./refineedge.js").then(m => m.refineEdge({ type:"mask", layer }));
  });

  /* Ver y pintar sólo la máscara: el Alt+clic en la miniatura del
     escritorio, para el móvil (y para quien no lo conozca). */
  const viewBtn = document.createElement("button");
  const syncView = () => { viewBtn.textContent = getIsolateView() === layer.id ? "Vista normal" : "Ver máscara"; };
  viewBtn.title = "Enseña sólo la máscara en grises y pinta sobre ella: negro oculta, blanco muestra";
  viewBtn.addEventListener("click", () => {
    const on = toggleIsolateView(layer.id);
    syncView();
    if(on) toast("Máscara a la vista: pinta en negro para ocultar y en blanco para mostrar");
  });
  syncView();
  on("mask:isolate", syncView);

  row.append(viewBtn, subjBtn, skyBtn, refineBtn);
  box.appendChild(row);
  container.appendChild(box);

  return {
    commit(){
      if(p.density === 100 && p.feather === 0) return;   // nada que confirmar
      preview();   // por si el último fotograma quedó a medio pedir
      const after = cloneMask(layer.mask);
      const restore = snap => {
        ctx.save(); ctx.globalCompositeOperation = "copy";
        ctx.drawImage(snap.canvas, 0, 0); ctx.restore();
        layer.thumbDirty = true; emit("doc:change");
      };
      record("Propiedades de la máscara", () => restore(backup), () => restore(after));
      emit("doc:structure"); emit("doc:change");
    }
  };
}
