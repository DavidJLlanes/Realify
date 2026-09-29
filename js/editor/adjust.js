/* ═══════════════════════════════════════════════════════════════
   AJUSTES DE IMAGEN
   Todos comparten el mismo esqueleto: se guarda el original de la
   capa, cada cambio se aplica sobre ese original —nunca en cadena
   sobre el resultado anterior, que acumularía error de redondeo— y
   sólo al aceptar se escribe en el historial.

   La mayoría se resuelven con una tabla de 256 entradas por canal.
   Precalcularla y luego recorrer los píxeles una vez es órdenes de
   magnitud más rápido que hacer la cuenta en cada píxel, y permite
   que la vista previa siga el deslizador.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { record } from "../core/history.js";
import { addFilterLayer, commitFilter, filterBase } from "./filterlayer.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { blendBySelection } from "./selection.js";
import { isMobile } from "../core/device.js";
import { view, fitAbove } from "./view.js";

/* Por encima de este tamaño, la vista previa se calcula sobre una
   versión reducida: al aceptar sí se aplica entera.

   El límite estaba en 6 MP y era la causa de que los deslizadores
   fueran «a tirones»: 6 millones de píxeles son 24 MB que hay que
   copiar, recorrer y volver a escribir en cada fotograma, unos 80-120
   ms por movimiento del dedo. Con 1,2 MP la pasada baja a unos 15 ms
   —cabe de sobra en un fotograma— y en pantalla no se nota la
   diferencia, porque de todas formas la imagen se está viendo
   reducida para caber en la ventana. */
const PREVIEW_LIMIT = 1.2e6;

function snapshot(layer){
  const c = document.createElement("canvas");
  c.width = layer.canvas.width; c.height = layer.canvas.height;
  c.getContext("2d").drawImage(layer.canvas, 0, 0);
  return c;
}

function restore(layer, snap){
  const x = layer.ctx;
  x.save();
  x.globalCompositeOperation = "copy";
  x.drawImage(snap, 0, 0);
  x.restore();
  layer.thumbDirty = true;
  emit("doc:change");
}

/* ── aplicación de tablas ─────────────────────────────────────── */
export function applyLut(data, lut){
  const { r, g, b } = lut;
  for(let i = 0; i < data.length; i += 4){
    data[i]     = r[data[i]];
    data[i + 1] = g[data[i + 1]];
    data[i + 2] = b[data[i + 2]];
  }
}

export const identityLut = () => {
  const t = new Uint8ClampedArray(256);
  for(let i = 0; i < 256; i++) t[i] = i;
  return t;
};

export function histogram(imgData){
  const d = imgData.data;
  const h = { r:new Uint32Array(256), g:new Uint32Array(256),
              b:new Uint32Array(256), l:new Uint32Array(256) };
  for(let i = 0; i < d.length; i += 4){
    h.r[d[i]]++; h.g[d[i+1]]++; h.b[d[i+2]]++;
    h.l[(d[i]*0.2126 + d[i+1]*0.7152 + d[i+2]*0.0722) | 0]++;
  }
  return h;
}

export function drawHistogram(canvas, hist, channel = "l"){
  const cx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  cx.clearRect(0, 0, W, H);
  cx.fillStyle = "#141517";
  cx.fillRect(0, 0, W, H);

  const draw = (arr, color) => {
    // El pico se busca ignorando los extremos: un fondo plano blanco
    // o negro aplasta todo lo demás contra el suelo.
    let peak = 1;
    for(let i = 1; i < 255; i++) if(arr[i] > peak) peak = arr[i];
    cx.fillStyle = color;
    for(let i = 0; i < 256; i++){
      const h = Math.min(1, arr[i] / peak) * (H - 2);
      cx.fillRect(i * W / 256, H - h, W / 256 + 0.5, h);
    }
  };
  if(channel === "rgb"){
    cx.globalCompositeOperation = "lighter";
    draw(hist.r, "#7a2a24"); draw(hist.g, "#26662e"); draw(hist.b, "#243c82");
    cx.globalCompositeOperation = "source-over";
  } else {
    draw(hist[channel] || hist.l, "#565d66");
  }
}

/* ── esqueleto común ──────────────────────────────────────────── */
/* `asLayer` deja el resultado en una capa nueva en vez de sobrescribir
   la capa activa. No lo usan los ajustes del menú Ajustes —ésos ya
   tienen su vía no destructiva propia, las capas de ajuste—, sino los
   que viven en el menú Filtro y comparten esta maquinaria, como
   Estilos: allí lo que se espera es lo mismo que en el resto de
   filtros. Ver editor/filterlayer.js. */
export async function runAdjust({ title, buildBody, compute, wide = false,
                                  previewLimit = PREVIEW_LIMIT, dlgCls = "",
                                  asLayer = false, filterId, filterParams, fullscreen = false }, opts = {}){
  /* Modo sin diálogo (registro de filtros): `compute` sobre un lienzo
     cualquiera y se devuelve el resultado. */
  if(opts.render){
    const src = opts.render.src;
    const d = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, src.width, src.height);
    compute(d.data, d.width, d.height);
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d").putImageData(d, 0, 0);
    return c;
  }

  const edit = asLayer && opts.edit ? opts.edit : null;
  const layer = edit || activeLayer();
  if(!layer){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  const base = edit ? filterBase(edit) : layer;
  if(!base){ toast("La capa de filtro no tiene ninguna capa debajo", "err"); return; }

  const before = snapshot(layer);
  const source = edit ? snapshot(base) : before;
  const full = source.getContext("2d", { willReadFrequently: true })
                     .getImageData(0, 0, layer.canvas.width, layer.canvas.height);

  // Copia reducida para la vista previa en imágenes grandes
  const big = layer.canvas.width * layer.canvas.height > previewLimit;
  let small = null, smallCanvas = null;
  if(big){
    const s = Math.sqrt(previewLimit / (layer.canvas.width * layer.canvas.height));
    smallCanvas = document.createElement("canvas");
    smallCanvas.width  = Math.max(1, Math.round(layer.canvas.width * s));
    smallCanvas.height = Math.max(1, Math.round(layer.canvas.height * s));
    const sx = smallCanvas.getContext("2d", { willReadFrequently: true });
    sx.drawImage(source, 0, 0, smallCanvas.width, smallCanvas.height);
    small = sx.getImageData(0, 0, smallCanvas.width, smallCanvas.height);
  }

  const hist = histogram(big ? small : full);

  /* Un solo buffer reutilizado. Antes se reservaba un ImageData nuevo
     en cada fotograma: a 24 MB por pasada el recolector de basura
     entraba constantemente, y ese es el otro motivo de que los
     deslizadores dieran tirones aunque el cálculo fuera rápido. */
  const src0 = big ? small : full;
  const work = new ImageData(new Uint8ClampedArray(src0.data.length), src0.width, src0.height);

  let queued = false, body = null;
  const preview = () => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const src = big ? small : full;
      work.data.set(src.data);
      compute(work.data, work.width, work.height);
      if(doc.selection) blendBySelection(work.data, src.data, doc.selection, work.width, work.height);
      if(big){
        smallCanvas.getContext("2d").putImageData(work, 0, 0);
        const x = layer.ctx;
        x.save();
        x.globalCompositeOperation = "copy";
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = "high";
        x.drawImage(smallCanvas, 0, 0, layer.canvas.width, layer.canvas.height);
        x.restore();
      } else {
        layer.ctx.putImageData(work, 0, 0);
      }
      layer.thumbDirty = true;
      emit("doc:change");
      // El cuerpo del diálogo puede querer repintar algo suyo con el
      // resultado —una miniatura, un histograma—: se le avisa aquí en
      // vez de que tenga que envolver `preview` por su cuenta.
      if(body && body.onPreview){
        try{ body.onPreview(); }catch(err){ console.error("[onPreview]", err); }
      }
    });
  };

  body = buildBody({ hist, preview, source });
  if(edit) preview();

  /* Recalcula a resolución completa —aunque la vista previa fuera
     reducida, lo que se ve es una aproximación, lo que se guarda no
     debe serlo— y decide qué hacer con el resultado: guardarlo como
     paso de historial, o deshacer la vista previa si se cancela.
     Compartida por las dos vías de salida de abajo: el diálogo modal
     de siempre y el panel de propiedades en vivo. */
  const finish = async commit => {
    if(!commit){ restore(layer, before); return; }
    if(big) status("Aplicando…");
    const out = new ImageData(new Uint8ClampedArray(full.data), full.width, full.height);
    compute(out.data, out.width, out.height);
    if(doc.selection) blendBySelection(out.data, full.data, doc.selection, out.width, out.height);
    layer.ctx.putImageData(out, 0, 0);
    layer.thumbDirty = true;
    const after = snapshot(layer);
    status("");

    if(asLayer){
      restore(layer, before);
      commitFilter({ base, edit, result: after, title,
                     filter: filterId || title, params: filterParams || {} });
      toast(title + (edit ? " · actualizado" : " · capa nueva"), "ok");
      return;
    }

    record(title,
      () => restore(layer, before),
      () => restore(layer, after));
    emit("doc:structure"); emit("doc:change");
    toast(title + " aplicado", "ok");
  };

  /* Panel de propiedades: sin diálogo modal, los mandos se montan
     directamente en `opts.container` y quedan en vivo mientras la capa
     siga seleccionada. No hay «Cancelar» —no tiene sentido en un panel
     que no se cierra nunca del todo—: quien monta decide cuándo llamar
     a `commit()`, típicamente al dejar de estar esta capa activa, con
     el mismo criterio de «un solo paso de historial por sesión de
     edición» que ya usa el diálogo con su botón Aplicar. */
  if(opts.container){
    opts.container.appendChild(body);
    return { body, commit: () => finish(true), cancel: () => finish(false) };
  }

  /* Pantalla completa (Curvas): el propio cuerpo se presenta, como el
     revelador RAW, y devuelve "go" al aplicar o null al cancelar. La
     vista previa, el historial y la capa de filtro siguen siendo los
     de aquí; el cuerpo sólo dibuja la capa en su propio lienzo en cada
     `onPreview`. */
  if(fullscreen && body?.present){
    const res = await body.present({ layer, edit });
    await finish(res === "go");
    return;
  }

  /* Todos los ajustes del menú comparten este punto de entrada. En
     móvil adoptan el mismo armazón compacto que Brillo y contraste.
     En escritorio se conserva exactamente la clase de cada ajuste. */
  const mobileCls = isMobile()
    ? ["dlg-compact", dlgCls].filter(Boolean).join(" ")
    : dlgCls;
  const res = await dialog({
    title, body, wide, cls: mobileCls, footStart: body?.footStart || null,
    buttons: [{ label:"Cancelar", value:null },
              { label: edit ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }]
  });
  await finish(res === "go");
}

/* Ajustes de un solo paso, sin diálogo. `asLayer` es el mismo
   contrato que en `runAdjust`: el resultado va a una capa nueva en vez
   de sobrescribir la activa. */
export function applyDirect(title, compute, { asLayer = false, filterId, filterParams } = {}, opts = {}){
  if(opts.render){
    const src = opts.render.src;
    const d = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, src.width, src.height);
    compute(d.data, d.width, d.height);
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d").putImageData(d, 0, 0);
    return c;
  }
  const edit = asLayer && opts.edit ? opts.edit : null;
  const layer = edit || activeLayer();
  if(!layer){ toast("No hay capa activa"); return; }
  const base = edit ? filterBase(edit) : layer;
  if(!base){ toast("La capa de filtro no tiene ninguna capa debajo", "err"); return; }
  const before = snapshot(layer);
  const source = edit ? base.canvas : layer.canvas;
  const d = source.getContext("2d", { willReadFrequently: true })
                  .getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const orig = doc.selection ? Uint8ClampedArray.from(d.data) : null;
  compute(d.data, d.width, d.height);
  if(orig) blendBySelection(d.data, orig, doc.selection, d.width, d.height);
  layer.ctx.putImageData(d, 0, 0);
  layer.thumbDirty = true;
  const after = snapshot(layer);

  if(asLayer){
    restore(layer, before);
    commitFilter({ base, edit, result: after, title,
                   filter: filterId || title, params: filterParams || {} });
    toast(title + (edit ? " · actualizado" : " · capa nueva"), "ok");
    return;
  }

  record(title, () => restore(layer, before), () => restore(layer, after));
  emit("doc:structure"); emit("doc:change");
  toast(title, "ok");
}

/* En el móvil, la hoja de un ajuste tapa casi toda la imagen: mientras
   esté abierta, la imagen se coloca en la franja libre de encima para
   ver el resultado en tiempo real (y se recoloca si la hoja cambia de
   alto). Al cerrarse, la vista vuelve a como estaba. `el` es cualquier
   elemento del cuerpo del diálogo. */
export function liftImageAbove(el){
  if(!isMobile()) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const card = el.closest(".modal-card"), back = el.closest(".modal");
    if(!card || !back) return;
    let restore = null, lastTop = -1, placed = null;
    const place = () => {
      const top = Math.round(card.getBoundingClientRect().top);
      if(Math.abs(top - lastTop) < 4) return;
      /* Si el usuario ya ha ampliado o movido la imagen (pellizco sobre
         el fondo del diálogo), un cambio de alto de la hoja no le
         deshace el zoom. */
      if(placed && (view.zoom !== placed.zoom || view.x !== placed.x || view.y !== placed.y)) return;
      lastTop = top;
      const r = fitAbove(top);
      if(!restore) restore = r;
      placed = { zoom: view.zoom, x: view.x, y: view.y };
    };
    /* La hoja entra deslizándose desde abajo: se espera a que su borde
       deje de moverse (unos fotogramas seguidos quieto) antes de
       colocar la imagen; después, cada cambio de alto la recoloca. */
    let prevTop = null, still = 0, frames = 0;
    const settle = () => {
      if(!back.isConnected) return;
      const top = Math.round(card.getBoundingClientRect().top);
      still = top === prevTop ? still + 1 : 0; prevTop = top;
      if(still >= 3 || ++frames > 90) place(); else requestAnimationFrame(settle);
    };
    requestAnimationFrame(settle);
    const ro = new ResizeObserver(() => { if(restore) place(); }); ro.observe(card);
    const mo = new MutationObserver(() => {
      if(back.isConnected) return;
      mo.disconnect(); ro.disconnect(); restore?.();
    });
    mo.observe(document.body, { childList: true });
  }));
}

/* ── controles reutilizables ──────────────────────────────────── */
export function slider(label, min, max, value, onInput, unit = "", step = 1){
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.innerHTML =
    `<label>${label}</label>
     <input type="range" class="grow" min="${min}" max="${max}" step="${step}" value="${value}">
     <span class="unit mono" style="min-width:40px;text-align:right">${value}${unit}</span>`;
  const r = wrap.querySelector("input");
  const v = wrap.querySelector(".unit");
  r.addEventListener("input", () => {
    v.textContent = r.value + unit;
    onInput(+r.value);
  });
  // Doble clic devuelve al valor neutro, como en cualquier editor
  r.addEventListener("dblclick", () => {
    r.value = value; v.textContent = value + unit; onInput(value);
  });
  wrap.reset = () => { r.value = value; v.textContent = value + unit; };
  wrap.setValue = n => { r.value = n; v.textContent = n + unit; };
  return wrap;
}

/* Agrupa varios controles ya construidos —normalmente `slider()`— en
   un desplegable que enseña uno solo a la vez: elegir otro esconde el
   anterior y muestra ése, sin reconstruir nada (son los mismos nodos,
   con su mismo estado y sus mismos listeners, sólo ocultos con
   `hidden`). Sólo en móvil y sólo con más de un control: en escritorio,
   o con uno solo, se apilan tal cual —exactamente lo que hacía
   cualquier panel de esta app antes de que existiera esta función—,
   porque ahí sobra alto y un desplegable de un único mando no
   ahorraría nada, sólo un toque de más.

   `entries` es `[{ label, node }, …]`; `node` es lo que devuelve
   `slider()` u otro control equivalente (cualquier elemento al que se
   le pueda poner `.hidden`). */
export function pickerGroup(entries){
  if(!isMobile() || entries.length <= 1){
    const frag = document.createDocumentFragment();
    entries.forEach(e => frag.appendChild(e.node));
    return frag;
  }
  const wrap = document.createElement("div");
  wrap.dataset.picker = "1";                     // ya compacto: ui/compact.js no lo toca
  const select = document.createElement("select");
  select.className = "grow";
  // Más bajo que el touch mínimo de siempre: sigue siendo cómodo de
  // tocar, pero es UN mando de navegación —elegir cuál se ve—, no uno
  // que haya que arrastrar con precisión como el propio deslizador.
  select.style.cssText = "width:100%;min-height:38px;margin-bottom:8px";
  entries.forEach((e, i) => {
    const op = document.createElement("option");
    op.value = i; op.textContent = e.label;
    select.appendChild(op);
  });
  wrap.appendChild(select);
  entries.forEach((e, i) => {
    // La etiqueta del propio mando —"Brillo", "Contraste"— ya la dice
    // el desplegable de arriba: repetirla en el deslizador es decir lo
    // mismo dos veces seguidas.
    const label = e.node.querySelector("label");
    if(label) label.style.display = "none";
    e.node.hidden = i !== 0;
    wrap.appendChild(e.node);
  });
  select.addEventListener("change", () => {
    const idx = +select.value;
    entries.forEach((e, i) => { e.node.hidden = i !== idx; });
  });
  return wrap;
}
