/* ═══════════════════════════════════════════════════════════════
   basic · clarity
   Parte de js/filters/library/basic.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { boxBlurFloat } from "../../../editor/selection/refineedge-math.js";
import { slider } from "../../../editor/adjust/adjust.js";
import { runFilter, previewProxy } from "./common.js";

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
    id: "clarity", params: p, float: "delta",
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
