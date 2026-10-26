/* ═══════════════════════════════════════════════════════════════
   basic · sharpen
   Parte de js/filters/library/basic.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { gaussianBlurHi, unsharpHi } from "../../../editor/render/floatspatial.js";
import { slider } from "../../../editor/adjust/adjust.js";
import { premiumPref, premiumSwitch } from "../../../ui/kit/premium.js";
import { runFilter, previewProxy } from "./common.js";

let premiumSharpenWorker = null, premiumSharpenSeq = 0;

const premiumSharpenJobs = new Map();

function sharpenPremium(data, w, h, p, scale=1){
  if(typeof Worker === "undefined") return import("../sharpen-engine.js").then(({sharpenRGBA}) => sharpenRGBA(data, w, h, { mode:"unsharp", amount:p.amount, radius:p.radius, threshold:p.threshold, edge:45, halo:35 }, scale));
  if(!premiumSharpenWorker){
    premiumSharpenWorker = new Worker(new URL("../sharpen-worker.js", import.meta.url), { type:"module" });
    premiumSharpenWorker.onmessage = e => { const job=premiumSharpenJobs.get(e.data.id); if(!job) return; premiumSharpenJobs.delete(e.data.id); e.data.error ? job.reject(new Error(e.data.error)) : job.resolve(new Uint8ClampedArray(e.data.data)); };
    premiumSharpenWorker.onerror = () => { for(const job of premiumSharpenJobs.values()) job.reject(new Error("No se pudo ejecutar el enfoque Premium")); premiumSharpenJobs.clear(); premiumSharpenWorker?.terminate(); premiumSharpenWorker=null; };
  }
  const id=++premiumSharpenSeq, copy=data.slice();
  return new Promise((resolve,reject)=>{ premiumSharpenJobs.set(id,{resolve,reject}); premiumSharpenWorker.postMessage({ id, data:copy.buffer, w, h, scale, p:{mode:"unsharp",amount:p.amount,radius:p.radius,threshold:p.threshold,edge:45,halo:35} },[copy.buffer]); });
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
    id: "blur", params: p, float: "delta",
    native: () => p.radius > 0 ? (inp, w, h, tick) => gaussianBlurHi(inp, w, h, p.radius, tick) : null,
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
  const p = { amount: 60, radius: 2, threshold: 0, structure: 0, premium: opts.init ? !!opts.init.premium : premiumPref.get("sharpen"), ...opts.init };

  return runFilter({
    title: "Enfocar",
    id: "sharpen", params: p, float: "delta",
    native: () => !p.premium && !p.structure ? (inp, w, h, tick) => unsharpHi(inp, w, h, p, tick) : null,
    build(preview){
      const box = document.createElement("div");
      box.appendChild(slider("Cantidad", 0, 300, p.amount, v => { p.amount = v; preview(); }, "%"));
      box.appendChild(slider("Radio", 1, 40, p.radius, v => { p.radius = v; preview(); }, " px"));
      box.appendChild(slider("Umbral", 0, 60, p.threshold, v => { p.threshold = v; preview(); }));
      box.appendChild(slider("Estructura", -100, 100, p.structure, v => { p.structure = v; preview(); }));
      const sw = premiumSwitch({ checked: p.premium, title: "Enfoque y estructura Premium: procesa la luminancia para conservar mejor el color y limitar halos (función Premium)", onChange: on => { p.premium = on; premiumPref.set("sharpen", on); preview(); } });
      box.prepend(sw);
      const n = document.createElement("p");
      n.className = "hint";
      n.style.marginTop = "10px";
      n.textContent = "Máscara de desenfoque: resta a la imagen su versión borrosa " +
        "y devuelve la diferencia amplificada. El umbral deja quietas las zonas " +
        "planas, que es lo que evita enfocar el ruido del cielo.";
      box.appendChild(n);
      return box;
    },
    async apply(layer, src, isFinal){
      const W = layer.canvas.width, H = layer.canvas.height;
      const { canvas: work, w, h, scale } = previewProxy(src, isFinal);
      // El radio del desenfoque nativo está en píxeles ABSOLUTOS del
      // canvas: en el proxy reducido hay que encogerlo en la misma
      // proporción, o el enfoque se vería más agresivo ahí que en el
      // resultado final a resolución completa.
      const sx = work.getContext("2d", { willReadFrequently: true });
      const a = sx.getImageData(0, 0, w, h);
      const da = a.data;
      const amt = p.amount / 100;
      const th = p.threshold;

      if(p.premium){
        const highQuality = await sharpenPremium(da, w, h, p, scale);
        da.set(highQuality);
      }else{
        const bx = blurred(work, p.radius * scale).getContext("2d", { willReadFrequently: true });
        const db = bx.getImageData(0, 0, w, h).data;
        for(let i = 0; i < da.length; i += 4){
          for(let k = 0; k < 3; k++){
          const diff = da[i+k] - db[i+k];
          // Por debajo del umbral no se toca: ahí sólo hay ruido y
          // amplificarlo es justo lo contrario de enfocar.
          if(Math.abs(diff) <= th) continue;
          da[i+k] = Math.max(0, Math.min(255, da[i+k] + diff * amt));
          }
        }
      }

      // Estructura añade contraste local de baja frecuencia a la luminancia,
      // manteniendo el color. El radio relativo produce el mismo aspecto en móvil.
      if(p.structure){
        const broad = blurred(work, Math.max(2, Math.min(w, h) * 0.018)).getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
        const k = p.structure / 100 * (p.structure > 0 ? 1.5 : 1);
        for(let i = 0; i < da.length; i += 4){
          const lum = .2126*da[i] + .7152*da[i+1] + .0722*da[i+2];
          const base = .2126*broad[i] + .7152*broad[i+1] + .0722*broad[i+2];
          const delta = (lum - base) * k;
          da[i] = Math.max(0, Math.min(255, da[i] + delta));
          da[i+1] = Math.max(0, Math.min(255, da[i+1] + delta));
          da[i+2] = Math.max(0, Math.min(255, da[i+2] + delta));
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
