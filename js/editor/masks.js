/* ═══════════════════════════════════════════════════════════════
   MÁSCARAS DE CAPA
   Edición no destructiva de verdad: en vez de borrar píxeles, se
   pinta cuánto se dejan ver. La máscara guarda esa cantidad en su
   propio CANAL ALFA —blanco opaco = se ve entera, transparente = no
   se ve nada—, no en su color, y eso no es un detalle de implementación
   cualquiera: es lo que permite componerla con `destination-in`, el
   operador nativo del lienzo 2D que multiplica el alfa de destino por
   el alfa de lo que se dibuja encima. Con eso, aplicar la máscara a
   una capa es un `drawImage` más, sin recorrer un solo píxel a mano
   ni pagar el coste de leer y escribir la imagen entera en cada
   fotograma —que es justo lo que habría hecho falta si la máscara
   guardara su valor en la luminancia en vez de en el alfa—.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { autoCompact } from "../ui/compact.js";

function makeMaskCanvas(w, h){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { canvas: c, ctx: c.getContext("2d", { willReadFrequently: true }) };
}

/* Copia independiente de una máscara, con la misma forma {canvas, ctx}
   que espera todo el mundo (compositor, historial, panel). Para que
   nadie tenga que recordar que `layer.mask` no es un lienzo a secas. */
export function cloneMask(mask){
  const m = makeMaskCanvas(mask.canvas.width, mask.canvas.height);
  m.ctx.drawImage(mask.canvas, 0, 0);
  return m;
}

/* Los datos de una máscara nueva a partir de una selección, como
   pura función de (w, h, selección) → ImageData: dentro visible,
   fuera oculto. Aparte de `addMask` para poder comprobar con números
   que el volcado es el que toca, sin depender de que un `<canvas>` de
   verdad sepa guardar lo que se le pinta —que en la app corre en el
   navegador, pero aquí, al probarlo, no—. */
export function maskDataFromSelection(w, h, selection){
  const img = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  const mask = selection.mask, mw = selection.w, mh = selection.h;
  for(let y = 0; y < h; y++){
    const my = mh === h ? y : Math.min(mh - 1, (y * mh / h) | 0);
    for(let x = 0; x < w; x++){
      const mx = mw === w ? x : Math.min(mw - 1, (x * mw / w) | 0);
      const p = (y * w + x) * 4;
      img.data[p] = img.data[p+1] = img.data[p+2] = 255;
      img.data[p+3] = mask[my * mw + mx];
    }
  }
  return img;
}

/* Máscara nueva, opaca del todo: añadirla no debe ocultar nada hasta
   que alguien pinte sobre ella, que es lo que espera cualquiera que
   la cree por accidente o para ir afinando poco a poco.
   `invert` es el Alt+clic de Photoshop: sin selección da la máscara
   opuesta a la normal —negra en vez de blanca, "oculta todo" en vez
   de "descubre todo"—, y con selección, la selección al revés. */
export function addMask(layer, fromSelection, invert = false){
  if(!layer || layer.mask) return;
  const w = layer.canvas.width, h = layer.canvas.height;
  const m = makeMaskCanvas(w, h);
  if(fromSelection && doc.selection){
    const raw = maskDataFromSelection(w, h, doc.selection);
    if(invert) invertAlpha(raw);
    /* maskDataFromSelection devuelve una estructura simple para poder
       probarla también fuera del navegador. Canvas exige un ImageData real. */
    const image = typeof ImageData === "function" ? new ImageData(raw.data, w, h) : raw;
    m.ctx.putImageData(image, 0, 0);
  } else if(!invert){
    /* Blanca, revela del todo. La negra («oculta todo») no necesita
       ningún fillRect: el dato de verdad vive en el canal alfa (ver
       cabecera del archivo), no en el color, y un <canvas> recién
       creado ya nace transparente del todo —alfa 0 en cada píxel—,
       que es exactamente «oculta todo». Pintarla de negro opaco sería
       el error contrario: alfa 255, o sea visible del todo. */
    m.ctx.fillStyle = "#fff";
    m.ctx.fillRect(0, 0, w, h);
  }

  const before = null, after = m;
  layer.mask = after;
  layer.maskEnabled = true;
  record("Añadir máscara",
    () => { layer.mask = before; emit("doc:structure"); emit("doc:change"); },
    () => { layer.mask = after;  emit("doc:structure"); emit("doc:change"); });
  emit("doc:structure"); emit("doc:change");
}

export function removeMask(layer, apply){
  if(!layer || !layer.mask) return;
  const before = layer.mask;
  if(apply){
    // Aplicar de verdad: la máscara se funde con el canal alfa de la
    // capa y desaparece como objeto aparte. A partir de aquí es
    // destructivo, así que sólo pasa si el usuario lo pide expresamente.
    const beforePixels = document.createElement("canvas");
    beforePixels.width = layer.canvas.width; beforePixels.height = layer.canvas.height;
    beforePixels.getContext("2d").drawImage(layer.canvas, 0, 0);
    layer.ctx.save();
    layer.ctx.globalCompositeOperation = "destination-in";
    layer.ctx.drawImage(before.canvas, 0, 0);
    layer.ctx.restore();
    layer.mask = null;
    layer.thumbDirty = true;
    const afterPixels = document.createElement("canvas");
    afterPixels.width = layer.canvas.width; afterPixels.height = layer.canvas.height;
    afterPixels.getContext("2d").drawImage(layer.canvas, 0, 0);
    record("Aplicar máscara",
      () => {
        layer.mask = before;
        layer.ctx.save(); layer.ctx.globalCompositeOperation = "copy";
        layer.ctx.drawImage(beforePixels, 0, 0); layer.ctx.restore();
        layer.thumbDirty = true; emit("doc:structure"); emit("doc:change");
      },
      () => {
        layer.mask = null;
        layer.ctx.save(); layer.ctx.globalCompositeOperation = "copy";
        layer.ctx.drawImage(afterPixels, 0, 0); layer.ctx.restore();
        layer.thumbDirty = true; emit("doc:structure"); emit("doc:change");
      });
  } else {
    layer.mask = null;
    record("Eliminar máscara",
      () => { layer.mask = before; emit("doc:structure"); emit("doc:change"); },
      () => { layer.mask = null;   emit("doc:structure"); emit("doc:change"); });
  }
  emit("doc:structure"); emit("doc:change");
}

export function toggleMask(layer){
  if(!layer || !layer.mask) return;
  const from = layer.maskEnabled, to = !from;
  layer.maskEnabled = to;
  record(to ? "Activar máscara" : "Desactivar máscara",
    () => { layer.maskEnabled = from; emit("doc:change"); },
    () => { layer.maskEnabled = to;   emit("doc:change"); });
  emit("doc:change");
}

/* Invierte el canal alfa de una imagen: lo que se veía deja de verse
   y viceversa. Separada de `invertMaskLayer` para poder probarla con
   números de verdad —un `ImageData` de mentira basta— sin depender de
   que un `<canvas>` real sepa componer nada. */
export function invertAlpha(imgData){
  const d = imgData.data;
  for(let i = 3; i < d.length; i += 4) d[i] = 255 - d[i];
}

export function invertMaskLayer(layer){
  if(!layer || !layer.mask) return;
  const { canvas, ctx } = layer.mask;
  const before = document.createElement("canvas");
  before.width = canvas.width; before.height = canvas.height;
  before.getContext("2d").drawImage(canvas, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  invertAlpha(img);
  ctx.putImageData(img, 0, 0);
  layer.thumbDirty = true;

  const after = document.createElement("canvas");
  after.width = canvas.width; after.height = canvas.height;
  after.getContext("2d").drawImage(canvas, 0, 0);

  const restore = snap => {
    ctx.save(); ctx.globalCompositeOperation = "copy";
    ctx.drawImage(snap, 0, 0); ctx.restore();
    layer.thumbDirty = true; emit("doc:change");
  };
  record("Invertir máscara", () => restore(before), () => restore(after));
  emit("doc:change");
}

/* ── pintar la máscara ──────────────────────────────────────────
   Como en Photoshop: la máscara es una escala de grises de verdad, no
   sólo blanco/negro. Blanco revela del todo, negro oculta del todo, y
   cualquier gris de en medio dosifica la transparencia según su
   tono —justo el número que ya guarda el canal alfa (ver arriba)—.
   Pintar es entonces desplazar el alfa de cada píxel hacia el nivel
   de gris del trazo (`gray`, 0-255), en proporción a la opacidad y a
   lo cerca que esté del centro; con opacidad 100 % y dureza alta un
   solo paso ya deja el alfa exactamente en `gray`.
   Deliberadamente independiente del pincel normal de tools.js: ese
   pasa por una capa de trazo aparte para respetar el orden de
   apilamiento mientras se dibuja, algo que una máscara no necesita
   —no hay nada debajo con lo que mezclarse—. Trabaja pixel a pixel
   sobre la región que toca el trazo (como healSpot o dodgeBurn en
   paint.js) en vez de con composite operations, porque ésas sólo
   saben sumar hacia opaco o restar hacia transparente: no hay forma
   de pedirles "deja esto en un 40 % de opacidad" con una sola. */
function distToSegmentSq(px, py, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 1e-6 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
  const cx = ax + dx * t, cy = ay + dy * t;
  const ddx = px - cx, ddy = py - cy;
  return ddx * ddx + ddy * ddy;
}

export function paintMaskDab(ctx, a, b, radius, hardness, opacity, gray){
  const canvas = ctx.canvas;
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y) - radius));
  const maxX = Math.min(canvas.width,  Math.ceil(Math.max(a.x, b.x) + radius));
  const maxY = Math.min(canvas.height, Math.ceil(Math.max(a.y, b.y) + radius));
  const w = maxX - minX, h = maxY - minY;
  if(w <= 0 || h <= 0) return;

  const img = ctx.getImageData(minX, minY, w, h);
  const d = img.data;
  const inner = Math.max(0, Math.min(0.98, hardness / 100)) * radius;
  const falloffRange = Math.max(1, radius - inner);
  const strokeOpacity = Math.max(0, Math.min(1, opacity));
  const ax = a.x - minX, ay = a.y - minY, bx = b.x - minX, by = b.y - minY;
  const r2 = radius * radius;
  const g = Math.max(0, Math.min(255, gray));

  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      const d2 = distToSegmentSq(x + 0.5, y + 0.5, ax, ay, bx, by);
      if(d2 > r2) continue;
      const dist = Math.sqrt(d2);
      const falloff = dist <= inner ? 1 : Math.max(0, 1 - (dist - inner) / falloffRange);
      const amount = strokeOpacity * falloff;
      if(amount <= 0) continue;
      const p = (y * w + x) * 4;
      d[p] = d[p+1] = d[p+2] = 255;
      d[p+3] = d[p+3] + (g - d[p+3]) * amount;
    }
  }
  ctx.putImageData(img, minX, minY);
}

/* ── degradado en la máscara ──────────────────────────────────────
   Igual idea que un degradado normal, pero el color no pinta nada
   por sí mismo —otra vez, el dato vive en el alfa—: lo que interesa
   de «desde blanco hasta negro» son los niveles de gris 255→0, no el
   color. Se calcula la transición dos veces por la razón contraria a
   lo que parece: para dejar que el propio Canvas 2D haga la
   matemática del degradado (lineal, radial…) en vez de reescribirla
   a mano, se pinta primero a un lienzo aparte con `copy` —así el
   resultado es el nivel exacto pedido, sin que la composición normal
   lo deje pegado al 255 que ya hubiera antes (ver el porqué exacto en
   `paintMaskDab`)—, y sólo entonces se mezcla ese resultado con el
   contenido de partida (`backup`) según la opacidad de la herramienta,
   píxel a píxel, que es la única forma de que un degradado al 40% se
   note como un 40% y no como nada. */
/* Lienzo de trabajo reutilizado entre llamadas: se llamaba con un
   `document.createElement("canvas")` nuevo en CADA `pointermove` del
   arrastre del degradado, uno de los pocos sitios de la app que
   reservaba un lienzo entero por fotograma en vez de uno solo. */
const gradScratch = document.createElement("canvas");
const gradSctx = gradScratch.getContext("2d");

export function paintMaskGradient(mask, backup, kind, from, to, grayFrom, grayTo, opacity){
  const { ctx, canvas } = mask;
  const w = canvas.width, h = canvas.height;

  if(gradScratch.width !== w || gradScratch.height !== h){
    gradScratch.width = w; gradScratch.height = h;
  }
  const sctx = gradSctx;
  const dist = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  const g = kind === "radial"
    ? sctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, dist)
    : sctx.createLinearGradient(from.x, from.y, to.x, to.y);
  g.addColorStop(0, `rgba(255,255,255,${Math.max(0, Math.min(255, grayFrom)) / 255})`);
  g.addColorStop(1, `rgba(255,255,255,${Math.max(0, Math.min(255, grayTo)) / 255})`);
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, w, h);
  const gradImg = sctx.getImageData(0, 0, w, h);

  const baseImg = backup.canvas.getContext("2d").getImageData(0, 0, w, h);
  const out = new ImageData(w, h);
  const mix = Math.max(0, Math.min(1, opacity));
  for(let i = 0; i < out.data.length; i += 4){
    out.data[i] = out.data[i+1] = out.data[i+2] = 255;
    const base = baseImg.data[i+3], target = gradImg.data[i+3];
    out.data[i+3] = base + (target - base) * mix;
  }
  ctx.putImageData(out, 0, 0);
}

/* ── ajustes de la máscara con vista previa y un solo paso de
   historial: Niveles, Curvas, Desenfoque, Densidad/Desvanecer viven
   en editor/maskadjust.js y comparten este esqueleto, que hace lo
   mismo que `runAdjust`/`runFilter` de adjust.js pero apuntando al
   lienzo de la máscara en vez de al de la capa —y sin la reducción de
   vista previa de `runAdjust`: una máscara es un byte por píxel del
   tamaño del documento, un cuarto de lo que pesa la capa a todo
   color, así que el margen ya está ahí—. `apply(ctx, backup, w, h)`
   recibe siempre el estado ORIGINAL en `backup`, nunca el resultado
   del fotograma anterior, para que mover un deslizador no acumule
   redondeos de la vez anterior. */
export async function runMaskDialog(layer, { title, wide = false, buildBody, apply }){
  if(!layer || !layer.mask) return;
  const { canvas, ctx } = layer.mask;
  const w = canvas.width, h = canvas.height;
  const backup = cloneMask(layer.mask);

  const restore = snap => {
    ctx.save(); ctx.globalCompositeOperation = "copy";
    ctx.drawImage(snap.canvas || snap, 0, 0); ctx.restore();
    layer.thumbDirty = true; emit("doc:change");
  };

  let queued = false;
  const preview = () => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply(ctx, backup, w, h);
      layer.thumbDirty = true;
      emit("doc:change");
    });
  };

  const body = buildBody({ preview, backup, w, h });
  /* Móvil: deslizadores apilados → desplegable + uno (ui/compact.js). */ autoCompact(body);
  const res = await dialog({
    title, body, wide,
    buttons: [{ label:"Cancelar", value:null },
              { label:"Aplicar", primary:true, value:"go" }]
  });

  if(res !== "go"){ restore(backup); return; }

  apply(ctx, backup, w, h);   // por si el último fotograma quedó a medio pedir
  layer.thumbDirty = true;
  const after = cloneMask(layer.mask);

  record(title,
    () => restore(backup),
    () => restore(after));
  emit("doc:structure"); emit("doc:change");
}

/* ── a qué capa se le está pintando la máscara ───────────────────
   Estado de interacción, no del documento: no tiene sentido en el
   historial ni tiene por qué sobrevivir a cambiar de capa o de
   herramienta, así que vive aquí como una variable de módulo y no en
   `doc`. */
let target = null;
export const getMaskTarget = () => target;
export function setMaskTarget(layerId){
  /* Sin cambio real, sin evento. Además de ahorrar repintados, esto
     rompe un bucle infinito de verdad: `renderLayers()` llama a
     `clearMaskTarget()` cuando no hay documento abierto, y el panel
     escucha «mask:target» con ese mismo `renderLayers`. Emitiendo
     siempre, cerrar el documento se volvía recursivo hasta reventar
     la pila (lo tapaba el try/catch del bus, así que sólo se veía
     como un panel a medio pintar y un pico de CPU). */
  if(target === layerId) return;
  target = layerId;
  emit("mask:target", target);
}
export function clearMaskTarget(){ setMaskTarget(null); }

/* Ctrl/Cmd+clic sobre la miniatura, como en Photoshop: el canal alfa
   de la máscara —ya es la cantidad exacta de "dentro" que hace falta,
   0-255— se convierte tal cual en el array plano que pide
   `commitSelection`. Aparte de `addMask`/`invertMaskLayer` para
   poder probarlo con un `{canvas,ctx}` de mentira, sin depender de
   `getImageData` de un `<canvas>` real. */
export function maskAlphaAsSelectionMask(mask, w, h){
  const img = mask.ctx.getImageData(0, 0, w, h);
  const out = new Uint8ClampedArray(w * h);
  for(let i = 0; i < out.length; i++) out[i] = img.data[i * 4 + 3];
  return out;
}

/* ── ver sólo la máscara ──────────────────────────────────────────
   Alt+clic en la miniatura: el lienzo enseña la máscara en escala de
   grises en vez de la composición normal, hasta que se repite el
   gesto. Es sólo un modo de visión —no toca `doc` ni el historial—,
   así que vive aquí igual que `target`. */
let isolateLayerId = null;
export const getIsolateView = () => isolateLayerId;
export function setIsolateView(layerId){
  isolateLayerId = layerId;
  emit("mask:isolate", isolateLayerId);
}
export function toggleIsolateView(layerId){
  setIsolateView(isolateLayerId === layerId ? null : layerId);
}

/* ── vincular/mover/copiar máscaras arrastrando ──────────────────────
   Operaciones sobre máscaras entre capas. Todas registran undo/redo. */

/* Copiar: duplica el contenido de la máscara de srcLayer a dstLayer.
   Si srcLayer está vinculada (maskRef), copia desde la máscara compartida.
   Si dstLayer ya tiene máscara, la reemplaza. */
export function copyMask(srcLayer, dstLayer){
  if(!srcLayer || !dstLayer) return;
  const effectiveSrcMask = srcLayer.maskRef
    ? doc.layers.find(l => l.id === srcLayer.maskRef)?.mask
    : srcLayer.mask;
  if(!effectiveSrcMask) return;
  const backup = dstLayer.mask ? cloneMask(dstLayer.mask) : null;
  const backupRef = dstLayer.maskRef;
  dstLayer.mask = cloneMask(effectiveSrcMask);
  dstLayer.maskRef = null;
  dstLayer.maskEnabled = true;
  record("Copiar máscara",
    () => { dstLayer.mask = backup; dstLayer.maskRef = backupRef; },
    () => { dstLayer.mask = cloneMask(effectiveSrcMask); dstLayer.maskRef = null; }
  );
  emit("doc:change");
}

/* Mover: transfiere la máscara de srcLayer a dstLayer.
   Si dstLayer ya tiene máscara, la reemplaza. srcLayer pierde su máscara. */
export function moveMask(srcLayer, dstLayer){
  if(!srcLayer || !srcLayer.mask || !dstLayer) return;
  const srcMask = srcLayer.mask;
  const srcRef = srcLayer.maskRef;
  const dstMask = dstLayer.mask;
  const dstRef = dstLayer.maskRef;
  record("Mover máscara",
    () => { srcLayer.mask = srcMask; srcLayer.maskRef = srcRef; dstLayer.mask = dstMask; dstLayer.maskRef = dstRef; },
    () => { srcLayer.mask = null; srcLayer.maskRef = null; dstLayer.mask = srcMask; dstLayer.maskRef = null; }
  );
  srcLayer.mask = null;
  srcLayer.maskRef = null;
  dstLayer.mask = srcMask;
  dstLayer.maskRef = null;
  dstLayer.maskEnabled = true;
  emit("doc:change");
}

/* Vincular: ambas capas comparten la misma máscara. Los cambios en una
   se ven inmediatamente en la otra. La máscara vive en srcLayer;
   dstLayer solo apunta a ella via maskRef. */
export function linkMask(srcLayer, dstLayer){
  if(!srcLayer || !srcLayer.mask || !dstLayer || srcLayer === dstLayer) return;
  const oldDstMask = dstLayer.mask;
  const oldDstRef = dstLayer.maskRef;
  record("Vincular máscara",
    () => { dstLayer.mask = oldDstMask; dstLayer.maskRef = oldDstRef; },
    () => { dstLayer.mask = null; dstLayer.maskRef = srcLayer.id; dstLayer.maskEnabled = true; }
  );
  dstLayer.mask = null;
  dstLayer.maskRef = srcLayer.id;
  dstLayer.maskEnabled = true;
  emit("doc:change");
}

/* Desvincular: si dstLayer tenía una máscara compartida, ahora es
   independiente (se copia el contenido de la máscara original). */
export function unlinkMask(layer){
  if(!layer || !layer.maskRef) return;
  const refLayer = doc.layers.find(l => l.id === layer.maskRef);
  if(!refLayer || !refLayer.mask) return;
  const oldMask = layer.mask;
  const oldRef = layer.maskRef;
  record("Desvincular máscara",
    () => { layer.mask = oldMask; layer.maskRef = oldRef; },
    () => { layer.mask = cloneMask(refLayer.mask); layer.maskRef = null; }
  );
  layer.mask = cloneMask(refLayer.mask);
  layer.maskRef = null;
  emit("doc:change");
}
