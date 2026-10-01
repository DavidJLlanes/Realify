/* ═══════════════════════════════════════════════════════════════
   FILTROS BÁSICOS
   Desenfoque, enfoque y ruido. El desenfoque y la máscara de enfoque
   se apoyan en el filtro nativo del lienzo, que va por GPU: hacer una
   convolución gaussiana a mano en JavaScript sobre 20 MP tarda
   segundos, y el navegador ya la trae hecha.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { commitFilter, filterBase } from "../editor/filterlayer.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { slider } from "../editor/adjust.js";
import { hexToRgb } from "../editor/paint.js";
import { blendBySelection } from "../editor/selection.js";
import { COARSE, isMobile } from "../core/device.js";
import { boxBlurFloat } from "../editor/refineedge-math.js";

function snapshot(layer){
  const c = document.createElement("canvas");
  c.width = layer.canvas.width; c.height = layer.canvas.height;
  // Se relee con getImageData (recorte a la selección): con esta opción
  // el navegador lo guarda en CPU y no avisa en la consola.
  c.getContext("2d", { willReadFrequently: true }).drawImage(layer.canvas, 0, 0);
  return c;
}
function restore(layer, snap){
  const x = layer.ctx;
  x.save(); x.globalCompositeOperation = "copy";
  x.drawImage(snap, 0, 0); x.restore();
  layer.thumbDirty = true;
  emit("doc:change");
}

/* A diferencia de los ajustes (adjust.js), un filtro no siempre
   escribe sus píxeles a través de una tabla: el desenfoque nativo, por
   ejemplo, deja que el propio navegador dibuje con `ctx.filter`. No
   hay un `data` común al que mezclar antes de escribir, así que la
   selección se aplica DESPUÉS, releyendo lo que `apply` acaba de
   dejar en el lienzo y devolviendo a su color original lo que caiga
   fuera de la máscara. Cuesta una lectura de más por fotograma, pero
   es el único punto que vale para cualquier filtro, escriba como
   escriba. */
function clipToSelection(layer, beforeCanvas){
  if(!doc.selection) return;
  const w = layer.canvas.width, h = layer.canvas.height;
  const now = layer.ctx.getImageData(0, 0, w, h);
  const bx = beforeCanvas.getContext("2d", { willReadFrequently: true });
  const orig = bx.getImageData(0, 0, w, h);
  blendBySelection(now.data, orig.data, doc.selection, w, h);
  layer.ctx.putImageData(now, 0, 0);
}

/* Esqueleto común: original guardado, vista previa por fotograma,
   historial en un solo paso, cancelar deja la capa intacta.

   La vista previa sigue escribiendo sobre la propia capa —es la única
   forma de verla en el lienzo mientras se mueven los mandos—, pero al
   aceptar se deshace ese trazo y el resultado se lleva a una capa
   nueva: la de origen acaba tan intacta como si se hubiera cancelado.
   Ver editor/filterlayer.js.

   `apply(layer, src, isFinal)` recibe además si esta llamada es la
   FINAL (al aceptar, o la única del propio `res!=="go"` de más abajo)
   o una de las muchas de la vista previa en vivo. Los filtros con un
   bucle CPU caro (Enfocar, Detalle y estructura) usan esa bandera
   para trabajar sobre una copia reducida mientras se arrastra un
   deslizador y sólo recalcular a resolución completa cuando de verdad
   hace falta guardar el resultado; los demás (el desenfoque nativo,
   que ya va por GPU) la ignoran sin más. */
export async function runFilter({ title, build, apply, wide = false, id, params, asyncRefine = false }, opts = {}){
  /* Modo sin diálogo: el registro de filtros pide el resultado para
     un lienzo cualquiera (deslizador de aplicación de la capa). */
  if(opts.render){
    const src = opts.render.src;
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const fake = { canvas: c, ctx: c.getContext("2d", { willReadFrequently: true }) };
    await Promise.resolve(apply(fake, src, opts.render.isFinal !== false));
    return c;
  }

  const edit = opts.edit || null;
  const layer = edit || activeLayer();
  if(!layer){ toast("No hay capa activa"); return; }
  if(layer.locked){ toast("La capa está bloqueada"); return; }
  /* Una capa de ajuste no tiene píxeles propios: filtrarla daría una
     capa nueva en blanco sin que se entienda por qué. */
  if(layer.type === "adjust"){
    toast("Una capa de ajuste no tiene píxeles que filtrar", "err");
    return;
  }
  /* Reabrir sobre una capa de filtro: el origen es la capa de debajo
     y al aceptar se sustituye ESTA capa en vez de apilar otra. */
  const base = edit ? filterBase(edit) : layer;
  if(!base){ toast("La capa de filtro no tiene ninguna capa debajo", "err"); return; }

  const before = snapshot(layer);
  const source = edit ? snapshot(base) : before;
  const clipRef = edit ? before : source;
  /* En el panel de Propiedades (sin botón Aplicar), al dejar de mover
     un mando se recalcula a resolución completa si el filtro es rápido
     (los filtros CPU caros trabajan sobre una copia reducida mientras
     se arrastra): si no, la capa quedaba con la copia ampliada hasta
     cambiar de capa. En el diálogo no hace falta, porque Aplicar ya
     recalcula, y así nunca congela la app al soltar un mando.
     `asyncRefine`: el filtro calcula la versión completa en un worker
     (no congela nada), así que se recalcula también en el diálogo y sin
     límite de tiempo; es para los filtros cuya copia reducida no sirve
     para juzgar el resultado (los de enfoque: el detalle fino es justo
     lo que la reducción se come). */
  const px = layer.canvas.width * layer.canvas.height;
  let queued = false, refineTimer = 0, lastMs = 0, refineOff = false, gen = 0;
  const refine = async () => {
    refineTimer = 0;
    const my = gen, t0 = performance.now();
    await Promise.resolve(apply(layer, source, true));
    if(my !== gen) return;          // se movió un mando mientras tanto
    clipToSelection(layer, clipRef);
    layer.thumbDirty = true;
    emit("doc:change");
    if(performance.now() - t0 > 900) refineOff = true;
  };
  const preview = () => {
    if(queued) return;
    queued = true;
    gen++;
    clearTimeout(refineTimer); refineTimer = 0;
    requestAnimationFrame(async () => {
      queued = false;
      const t0 = performance.now();
      await Promise.resolve(apply(layer, source, false));
      lastMs = performance.now() - t0;
      clipToSelection(layer, clipRef);
      layer.thumbDirty = true;
      emit("doc:change");
      if(asyncRefine ? px > FILTER_PREVIEW_LIMIT
         : opts.container && px > FILTER_PREVIEW_LIMIT && !refineOff && lastMs * px / FILTER_PREVIEW_LIMIT < 1500)
        refineTimer = setTimeout(refine, asyncRefine ? 250 : 450);
    });
  };

  const body = build(preview);
  /* Al reabrir, la capa ya tiene el resultado a resolución completa:
     no se repinta con la vista previa (en fotos grandes la dejaba con
     la copia reducida mientras siguiera seleccionada). */

  /* Compartido por las dos salidas: el diálogo modal de siempre y el
     panel de propiedades en vivo (ver editor/adjust.js, que sigue el
     mismo patrón para los ajustes). */
  const finish = async commit => {
    gen++; clearTimeout(refineTimer); refineTimer = 0;
    if(!commit){ restore(layer, before); return; }
    await Promise.resolve(apply(layer, source, true));
    clipToSelection(layer, clipRef);
    const after = snapshot(layer);
    restore(layer, before);
    commitFilter({ base, edit, result: after, title,
                   filter: id || title, params: params || {} });
    toast(title + (edit ? " · actualizado" : " · capa nueva"), "ok");
  };

  if(opts.container){
    opts.container.appendChild(body);
    return { body, commit: () => finish(true), cancel: () => finish(false) };
  }

  const res = await dialog({
    title, body, wide,
    cls: isMobile() ? "dlg-compact" : "",
    buttons:[{ label:"Cancelar", value:null },
             { label: edit ? "Guardar cambios" : "Aplicar", primary:true, value:"go" }]
  });
  await finish(res === "go");
}

/* Límite de trabajo por fotograma para los filtros CPU de este
   archivo (Enfocar, Detalle y estructura): mismo criterio que
   editor/adjust.js y features/photo-tools.js, más estricto en
   `pointer:coarse`. Sólo se usa mientras NO es la llamada final. */
export const FILTER_PREVIEW_LIMIT = COARSE ? 4e5 : 1.2e6;

/* Reduce `src` a una copia de como mucho `FILTER_PREVIEW_LIMIT`
   píxeles si hace falta, y devuelve también el factor de escala —para
   reescalar cualquier radio en píxeles ABSOLUTOS que el filtro use
   por debajo, o el resultado se vería más fuerte en el proxy que en
   la imagen completa—. `scale` es 1 (sin copia) si no hacía falta
   reducir nada. */
function previewProxy(src, isFinal){
  const w = src.width, h = src.height;
  if(isFinal || w * h <= FILTER_PREVIEW_LIMIT) return { canvas: src, w, h, scale: 1 };
  const scale = Math.sqrt(FILTER_PREVIEW_LIMIT / (w * h));
  const pw = Math.max(1, Math.round(w * scale)), ph = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = pw; c.height = ph;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, pw, ph);
  return { canvas: c, w: pw, h: ph, scale };
}

/* El filtro nativo `blur()` de Canvas 2D trata todo lo que hay MÁS
   ALLÁ del lienzo de origen como transparente, y esa transparencia se
   filtra hacia dentro según crece el radio. No es un matiz menor: a
   partir de unas pocas decenas de píxeles ya alcanza el CENTRO de una
   imagen de tamaño normal, y a 200 px —el máximo del deslizador— una
   imagen corriente puede acabar con menos de una cuarta parte de su
   opacidad original en el centro. El resultado no es «una imagen
   desenfocada»: es una imagen que se desvanece hacia transparente
   según se sube el radio, y por eso «no parece afectar a toda la
   imagen por igual» —el centro se ve raro, no sólo los bordes—.

   La solución estándar es extender los píxeles del borde HACIA FUERA
   antes de desenfocar, para que lo que el filtro encuentre más allá
   del borde real sea el propio color de ese borde y no vacío, y
   recortar la ampliación al terminar. El margen es 3 veces el radio:
   ahí es donde cae, en la práctica, la cola de un desenfoque
   gaussiano de esa desviación típica. */
export function blurred(src, radiusPx){
  const w = src.width, h = src.height;
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  // Casi todos los que llaman leen el resultado con getImageData, y la
  // opción sólo cuenta en el PRIMER getContext: pedirla después, como
  // hacían, ya no tenía efecto.
  const ox = out.getContext("2d", { willReadFrequently: true });
  if(radiusPx <= 0){ ox.drawImage(src, 0, 0); return out; }

  const pad = Math.max(1, Math.ceil(radiusPx * 3));
  const pw = w + pad * 2, ph = h + pad * 2;

  const ext = document.createElement("canvas");
  ext.width = pw; ext.height = ph;
  const ex = ext.getContext("2d");
  ex.drawImage(src, pad, pad);
  // Bordes: la fila o columna límite, estirada hacia fuera.
  ex.drawImage(src, 0, 0, w, 1, pad, 0, w, pad);              // arriba
  ex.drawImage(src, 0, h - 1, w, 1, pad, pad + h, w, pad);    // abajo
  ex.drawImage(src, 0, 0, 1, h, 0, pad, pad, h);              // izquierda
  ex.drawImage(src, w - 1, 0, 1, h, pad + w, pad, pad, h);    // derecha
  // Esquinas: el píxel de la esquina, estirado en cuadrado.
  ex.drawImage(src, 0, 0, 1, 1, 0, 0, pad, pad);
  ex.drawImage(src, w - 1, 0, 1, 1, pad + w, 0, pad, pad);
  ex.drawImage(src, 0, h - 1, 1, 1, 0, pad + h, pad, pad);
  ex.drawImage(src, w - 1, h - 1, 1, 1, pad + w, pad + h, pad, pad);

  /* «copy», no el «source-over» por defecto: dibujar un lienzo sobre
     sí mismo con un filtro de por medio compone el resultado ENCIMA
     del contenido de partida —que ahí sigue, sin desenfocar, hasta
     que este mismo trazo termina de pintar—, y con alfa 255 debajo,
     «source-over» nunca lo deja bajar del 255 aunque el desenfoque sí
     lo haya rebajado (los mismos números de siempre: outA = srcA +
     dstA·(1-srcA), que da 255 en cuanto dstA=255, gane lo que gane
     srcA). Invisible en una foto normal, donde todo es opaco en todas
     partes y por tanto srcA también sale en 255; sale a la luz en
     cuanto hay transparencia de verdad de por medio —el borde de un
     recorte, una máscara—, que es justo lo que hace falta para
     suavizar el borde de una máscara sin que se quede pegado al
     lado opaco. */
  ex.globalCompositeOperation = "copy";
  ex.filter = `blur(${radiusPx}px)`;
  ex.drawImage(ext, 0, 0);       // desenfoca sobre sí mismo: ya no hay vacío que sangre
  ex.filter = "none";
  ex.globalCompositeOperation = "source-over";

  ox.drawImage(ext, pad, pad, w, h, 0, 0, w, h);
  return out;
}

/* ── desenfoque gaussiano ─────────────────────────────────────── */
export function blur(opts = {}){
  const p = { radius: 4, ...opts.init };
  return runFilter({
    title: "Desenfoque gaussiano",
    id: "blur", params: p,
    build(preview){
      const box = document.createElement("div");
      box.appendChild(slider("Radio", 0, 200, p.radius, v => { p.radius = v; preview(); }, " px"));
      const n = document.createElement("p");
      n.className = "hint";
      n.textContent = "Usa el desenfoque nativo del navegador, que va por GPU.";
      box.appendChild(n);
      return box;
    },
    apply(layer, src, isFinal){
      const W = layer.canvas.width, H = layer.canvas.height;
      // Sin esto, cada tirón del deslizador desenfocaba la imagen COMPLETA
      // —el lienzo extendido de `blurred()` puede ser varias veces más
      // grande que el propio documento a radios altos—, y en una foto de
      // móvil normal eso tarda tanto por fotograma que el arrastre se ve
      // congelado: parece que «no hace nada» aunque el resultado final,
      // al soltar, sí estuviera bien. Mismo proxy reducido que ya usan
      // Enfocar y Detalle mientras se previsualiza; el radio en píxeles
      // absolutos se escala en la misma proporción que el propio proxy.
      const { canvas: work, w, h, scale } = previewProxy(src, isFinal);
      const x = layer.ctx;
      x.save();
      x.globalCompositeOperation = "copy";
      if(work === src){
        x.drawImage(blurred(src, p.radius), 0, 0);
      } else {
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = "high";
        x.drawImage(blurred(work, p.radius * scale), 0, 0, w, h, 0, 0, W, H);
      }
      x.restore();
    }
  }, opts);
}

/* ── enfoque (máscara de desenfoque) ──────────────────────────── */
export function sharpen(opts = {}){
  const p = { amount: 60, radius: 2, threshold: 0, ...opts.init };

  return runFilter({
    title: "Enfocar",
    id: "sharpen", params: p,
    build(preview){
      const box = document.createElement("div");
      box.appendChild(slider("Cantidad", 0, 300, p.amount, v => { p.amount = v; preview(); }, "%"));
      box.appendChild(slider("Radio", 1, 40, p.radius, v => { p.radius = v; preview(); }, " px"));
      box.appendChild(slider("Umbral", 0, 60, p.threshold, v => { p.threshold = v; preview(); }));
      const n = document.createElement("p");
      n.className = "hint";
      n.style.marginTop = "10px";
      n.textContent = "Máscara de desenfoque: resta a la imagen su versión borrosa " +
        "y devuelve la diferencia amplificada. El umbral deja quietas las zonas " +
        "planas, que es lo que evita enfocar el ruido del cielo.";
      box.appendChild(n);
      return box;
    },
    apply(layer, src, isFinal){
      const W = layer.canvas.width, H = layer.canvas.height;
      const { canvas: work, w, h, scale } = previewProxy(src, isFinal);
      // El radio del desenfoque nativo está en píxeles ABSOLUTOS del
      // canvas: en el proxy reducido hay que encogerlo en la misma
      // proporción, o el enfoque se vería más agresivo ahí que en el
      // resultado final a resolución completa.
      const bx = blurred(work, p.radius * scale).getContext("2d", { willReadFrequently: true });

      const sx = work.getContext("2d", { willReadFrequently: true });
      const a = sx.getImageData(0, 0, w, h);
      const b = bx.getImageData(0, 0, w, h);
      const da = a.data, db = b.data;
      const amt = p.amount / 100;
      const th = p.threshold;

      for(let i = 0; i < da.length; i += 4){
        for(let k = 0; k < 3; k++){
          const diff = da[i+k] - db[i+k];
          // Por debajo del umbral no se toca: ahí sólo hay ruido y
          // amplificarlo es justo lo contrario de enfocar.
          if(Math.abs(diff) <= th) continue;
          const v = da[i+k] + diff * amt;
          da[i+k] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }

      if(work === src){
        layer.ctx.putImageData(a, 0, 0);
      } else {
        work.getContext("2d").putImageData(a, 0, 0);
        const x = layer.ctx;
        x.save(); x.globalCompositeOperation = "copy";
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
        x.drawImage(work, 0, 0, W, H); x.restore();
      }
    }
  }, opts);
}

/* ── desenfoque de movimiento ─────────────────────────────────── */
/* No hay primitiva de desenfoque de movimiento en `ctx.filter`, así
   que se aproxima con el mismo truco de siempre: muchas copias de la
   imagen desplazadas a lo largo de una dirección, cada una translúcida,
   compuestas unas sobre otras. Con la distancia a cero no se toca nada
   —se queda en la copia opaca inicial—, así el efecto es inerte en su
   valor por defecto como el resto de la app. */
export function motionBlur(opts = {}){
  const p = { amount: 24, angle: 0, ...opts.init };
  return runFilter({
    title: "Desenfoque de movimiento",
    id: "motion-blur", params: p,
    build(preview){
      const box = document.createElement("div");
      box.appendChild(slider("Distancia", 0, 300, p.amount, v => { p.amount = v; preview(); }, " px"));
      box.appendChild(slider("Ángulo", -180, 180, p.angle, v => { p.angle = v; preview(); }, "°"));
      const n = document.createElement("p");
      n.className = "hint";
      n.textContent = "Arrastra la capa a lo largo de una dirección y distancia constantes, " +
        "como una cámara —o el propio motivo— moviéndose durante la exposición. Útil para " +
        "unificar un texto con el resto de una foto en movimiento.";
      box.appendChild(n);
      return box;
    },
    apply(layer, src){
      const w = layer.canvas.width, h = layer.canvas.height;
      const x = layer.ctx;
      x.save();
      x.globalCompositeOperation = "copy";
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = "source-over";
      if(p.amount > 0){
        const N = 24;
        const rad = p.angle * Math.PI / 180;
        const dx = Math.cos(rad), dy = Math.sin(rad);
        x.clearRect(0, 0, w, h);
        x.globalAlpha = 1 / N;
        for(let i = 0; i < N; i++){
          const t = (i / (N - 1) - 0.5) * p.amount;
          x.drawImage(src, dx * t, dy * t);
        }
        x.globalAlpha = 1;
      }
      x.restore();
    }
  }, opts);
}

/* Suavizado que respeta los bordes: filtro guiado (He et al.) con la
   propia luminancia como guía. Dentro de una zona lisa promedia como
   un desenfoque de caja; en un borde fuerte —varianza local muy por
   encima de `eps`— devuelve casi el valor original. Es justo lo que
   hace falta como «base» para separar el contraste local del resto:
   restando un desenfoque normal, el borde entre un cielo claro y una
   silueta oscura aparecía como diferencia enorme y se amplificaba en
   un halo blanco (o, en negativo, en una niebla oscura), que es el
   defecto que tenía la versión anterior de «Detalle y estructura». */
function guidedBase(L, w, h, r, eps){
  const n = w * h, LL = new Float32Array(n);
  for(let i = 0; i < n; i++) LL[i] = L[i] * L[i];
  const mean = boxBlurFloat(L, w, h, r), corr = boxBlurFloat(LL, w, h, r);
  const a = new Float32Array(n), b = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const v = corr[i] - mean[i] * mean[i];
    a[i] = v / (v + eps);
    b[i] = mean[i] - a[i] * mean[i];
  }
  const ma = boxBlurFloat(a, w, h, r), mb = boxBlurFloat(b, w, h, r);
  const out = new Float32Array(n);
  for(let i = 0; i < n; i++) out[i] = ma[i] * L[i] + mb[i];
  return out;
}

/* ── detalle y estructura ─────────────────────────────────────────
   Contraste local en dos franjas, sólo sobre la luminancia (el color
   no se desplaza ni se satura):
   · Estructura: base de radio ancho —proporcional al tamaño de la
     imagen, no fijo en píxeles—, como la Claridad de un revelador.
   · Detalle: base de radio estrecho, la textura fina.
   En ambos casos la base es un suavizado que respeta los bordes, así
   que ni se forman halos junto a las siluetas ni, en negativo, se
   cubre la foto de niebla: el negativo suaviza la franja sin
   emborronar los contornos. Además el efecto se atenúa hacia el negro
   y el blanco puros para no quemar luces ni empastar sombras. */
export function clarity(opts = {}){
  const p = { structure: 0, detail: 0, ...opts.init };
  const work = document.createElement("canvas");

  return runFilter({
    title: "Detalle y estructura",
    id: "clarity", params: p,
    build(preview){
      const box = document.createElement("div");
      box.appendChild(slider("Estructura", -100, 100, p.structure, v => { p.structure = v; preview(); }));
      box.appendChild(slider("Detalle", -100, 100, p.detail, v => { p.detail = v; preview(); }));
      const n = document.createElement("p");
      n.className = "hint";
      n.style.marginTop = "10px";
      n.textContent = "Estructura sube el contraste local de las zonas medias (volumen, " +
        "nubes, arquitectura) sin crear halos junto a los bordes. Detalle actúa sobre la " +
        "textura fina. En negativo, cada uno suaviza su franja sin emborronar los contornos.";
      box.appendChild(n);
      return box;
    },
    apply(layer, src, isFinal){
      const W = layer.canvas.width, H = layer.canvas.height;
      const x = layer.ctx;
      if(!p.structure && !p.detail){
        x.save(); x.globalCompositeOperation = "copy"; x.drawImage(src, 0, 0); x.restore();
        return;
      }
      const { canvas: proxySrc, w, h } = previewProxy(src, isFinal);
      work.width = w; work.height = h;
      const wx = work.getContext("2d", { willReadFrequently: true });
      wx.save(); wx.globalCompositeOperation = "copy"; wx.drawImage(proxySrc, 0, 0); wx.restore();
      const img = wx.getImageData(0, 0, w, h), d = img.data, n = w * h;

      const L = new Float32Array(n);
      for(let i = 0, j = 0; j < n; i += 4, j++)
        L[j] = (0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]) / 255;

      // Radios relativos al lado corto: así la vista previa reducida y
      // el resultado a tamaño completo se ven igual, y una foto de 12 MP
      // recibe el mismo efecto que su versión para redes.
      const side = Math.min(w, h);
      const out = Float32Array.from(L);
      if(p.structure){
        const base = guidedBase(L, w, h, Math.max(2, Math.round(side * 0.02)), 0.006);
        const k = p.structure > 0 ? p.structure / 100 * 1.6 : p.structure / 100;
        for(let j = 0; j < n; j++) out[j] += (L[j] - base[j]) * k;
      }
      if(p.detail){
        const base = guidedBase(L, w, h, Math.max(1, Math.round(side * 0.0018)), 0.0015);
        const k = p.detail > 0 ? p.detail / 100 * 2 : p.detail / 100;
        for(let j = 0; j < n; j++) out[j] += (L[j] - base[j]) * k;
      }

      for(let i = 0, j = 0; j < n; i += 4, j++){
        const l = L[j];
        // Peso de medios tonos: 1 en el centro, 0 en negro y blanco puros.
        const m = 1 - Math.pow(2 * l - 1, 4);
        const delta = (out[j] - l) * m * 255;
        if(!delta) continue;
        for(let c = 0; c < 3; c++){
          const v = d[i+c] + delta;
          d[i+c] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }
      wx.putImageData(img, 0, 0);

      x.save(); x.globalCompositeOperation = "copy";
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
      x.drawImage(work, 0, 0, W, H); x.restore();
    }
  }, opts);
}

/* ── viñeteado ──────────────────────────────────────────────────
   Negro con multiplicar, blanco con trama y color libre con mezcla
   normal: el mismo degradado radial en los tres casos, sólo cambia
   qué modo de fusión hace que se lea como algo natural en vez de
   una mancha plana encima. */
export function vignette(opts = {}){
  const p = { kind: "black", color: "#3a2a18", amount: 55, size: 58, feather: 45, opacity: 100, roundness: 100, ...opts.init };

  return runFilter({
    title: "Viñeteado",
    id: "vignette", params: p,
    build(preview){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="seg" id="vgKind" style="margin-bottom:9px">
          <button data-k="black"${p.kind === "black" ? ' class="on"' : ""}>Negro</button>
          <button data-k="white"${p.kind === "white" ? ' class="on"' : ""}>Blanco</button>
          <button data-k="color"${p.kind === "color" ? ' class="on"' : ""}>Color</button>
        </div>
        <div class="field" id="vgColorRow"${p.kind === "color" ? "" : " hidden"}><label>Color</label>
          <input type="color" id="vgColor" value="${p.color}"
                 style="width:100%;height:30px;padding:0;border:1px solid var(--line);
                        border-radius:var(--r);background:transparent"></div>`;
      box.appendChild(slider("Cantidad", 0, 100, p.amount, v => { p.amount = v; preview(); }, "%"));
      box.appendChild(slider("Tamaño", 0, 100, p.size, v => { p.size = v; preview(); }, "%"));
      box.appendChild(slider("Pluma", 5, 100, p.feather, v => { p.feather = v; preview(); }, "%"));
      // 100 % = círculo, la forma de siempre. Bajarlo va ajustando la
      // elipse al marco del lienzo, hasta tocar el borde medio en vez
      // de sólo las esquinas: útil en panorámicas y retratos muy
      // verticales, donde un círculo puro sale descentrado.
      box.appendChild(slider("Redondez", 0, 100, p.roundness, v => { p.roundness = v; preview(); }, "%"));
      /* Cantidad y opacidad no son lo mismo aunque lo parezcan.
         «Cantidad» es cuánto llega a cerrarse el viñeteado en el borde
         —la densidad final del gradiente—, y «Opacidad» rebaja el
         efecto entero sin cambiar su forma. Sirven para cosas
         distintas: con la cantidad se decide cuánto cierra la esquina,
         con la opacidad se atenúa un viñeteado ya perfilado hasta que
         deja de cantar, que es el ajuste fino de siempre. */
      box.appendChild(slider("Opacidad", 0, 100, p.opacity, v => { p.opacity = v; preview(); }, "%"));

      box.querySelector("#vgKind").addEventListener("click", e => {
        const b = e.target.closest("[data-k]");
        if(!b) return;
        p.kind = b.dataset.k;
        box.querySelectorAll("#vgKind button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        box.querySelector("#vgColorRow").hidden = p.kind !== "color";
        preview();
      });
      box.querySelector("#vgColor").addEventListener("input", e => { p.color = e.target.value; preview(); });
      return box;
    },
    apply(layer, src){
      const w = layer.canvas.width, h = layer.canvas.height;
      const x = layer.ctx;
      x.save(); x.globalCompositeOperation = "copy"; x.drawImage(src, 0, 0); x.restore();

      const cx = w / 2, cy = h / 2;
      const outerR = Math.hypot(cx, cy);
      const inner = outerR * Math.max(0, Math.min(0.95, p.size / 100)) * 0.85;
      const outer = Math.max(inner + 1, outerR * (1 + p.feather / 200));

      const col = p.kind === "black" ? [0,0,0] : p.kind === "white" ? [255,255,255] : hexToRgb(p.color);
      // El degradado en sí sigue siendo un círculo perfecto de radio
      // `outer`; lo que cambia con la redondez es el espacio en el que
      // se dibuja. Con escala 1:1 (100 %) llega igual de lejos en
      // cualquier dirección, como hasta ahora. Escalando cada eje hacia
      // cx/outerR y cy/outerR (0 %) el mismo círculo se aplasta hasta
      // encajar exactamente en el rectángulo del lienzo —toca el borde
      // medio en vez de sólo la diagonal de la esquina—, sin tocar la
      // forma del propio degradado (radios, pluma) para nada.
      const t = Math.max(0, Math.min(100, p.roundness)) / 100;
      const scaleX = (cx / outerR) * (1 - t) + t;
      const scaleY = (cy / outerR) * (1 - t) + t;

      const g = x.createRadialGradient(0, 0, Math.max(0, inner), 0, 0, outer);
      g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},${p.amount / 100})`);

      x.save();
      x.globalAlpha = Math.max(0, Math.min(1, p.opacity / 100));
      x.globalCompositeOperation = p.kind === "black" ? "multiply" : p.kind === "white" ? "screen" : "source-over";
      x.translate(cx, cy);
      x.scale(scaleX, scaleY);
      x.fillStyle = g;
      x.fillRect(-cx / scaleX, -cy / scaleY, w / scaleX, h / scaleY);
      x.restore();
    }
  }, opts);
}

/* ── ruido ────────────────────────────────────────────────────── */
export function noise(opts = {}){
  const p = { amount: 12, mono: true, gaussian: true, ...opts.init };

  return runFilter({
    title: "Añadir ruido",
    id: "noise", params: p,
    build(preview){
      const box = document.createElement("div");
      box.appendChild(slider("Cantidad", 0, 100, p.amount, v => { p.amount = v; preview(); }, "%"));

      const m = document.createElement("label");
      m.className = "chk";
      m.innerHTML = `<input type="checkbox"${p.mono ? " checked" : ""}> Monocromático`;
      m.querySelector("input").addEventListener("change", e => {
        p.mono = e.target.checked; preview();
      });
      box.appendChild(m);

      const g = document.createElement("label");
      g.className = "chk";
      g.innerHTML = `<input type="checkbox"${p.gaussian ? " checked" : ""}> Distribución gaussiana`;
      g.querySelector("input").addEventListener("change", e => {
        p.gaussian = e.target.checked; preview();
      });
      box.appendChild(g);

      const n = document.createElement("p");
      n.className = "hint";
      n.style.marginTop = "10px";
      n.innerHTML = "El ruido gaussiano se parece más al de un sensor que el " +
        "uniforme. Para grano fotográfico de verdad —proporcional a la raíz de la " +
        "señal y en cúmulos— usa <b>Filtro → Simulación de captura</b>.";
      box.appendChild(n);
      return box;
    },
    apply(layer, src, isFinal){
      const W = layer.canvas.width, H = layer.canvas.height;
      // El bucle de abajo llama a Math.random()/Math.log()/Math.cos() por
      // canal y por píxel: en una foto de móvil normal, sin reducir,
      // tarda de sobra para que arrastrar el deslizador se vea congelado.
      // Mismo proxy que el resto de filtros CPU de este archivo mientras
      // se previsualiza.
      const { canvas: work, w, h } = previewProxy(src, isFinal);
      const sx = work.getContext("2d", { willReadFrequently: true });
      const img = sx.getImageData(0, 0, w, h);
      const d = img.data;
      const amt = p.amount * 1.28;

      // Box-Muller da una normal de verdad; el uniforme es un simple
      // desplazamiento plano y se ve más "digital".
      const rnd = p.gaussian
        ? () => {
            const u = Math.max(Math.random(), 1e-9);
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * Math.random()) * 0.4;
          }
        : () => Math.random() * 2 - 1;

      for(let i = 0; i < d.length; i += 4){
        if(p.mono){
          const n = rnd() * amt;
          for(let k = 0; k < 3; k++){
            const v = d[i+k] + n;
            d[i+k] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
        } else {
          for(let k = 0; k < 3; k++){
            const v = d[i+k] + rnd() * amt;
            d[i+k] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
        }
      }

      if(work === src){
        layer.ctx.putImageData(img, 0, 0);
      } else {
        work.getContext("2d").putImageData(img, 0, 0);
        const x = layer.ctx;
        x.save(); x.globalCompositeOperation = "copy";
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
        x.drawImage(work, 0, 0, W, H); x.restore();
      }
    }
  }, opts);
}
