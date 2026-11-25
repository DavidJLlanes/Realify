/* ═══════════════════════════════════════════════════════════════
   basic · local-contrast (Detalle y estructura)
   Parte de js/filters/library/basic.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { slider } from "../../../editor/adjust/adjust.js";
import { runFilter, previewProxy } from "./common.js";
import { claridadPixeles } from "./local-contrast-engine.js";

export { guidedBase } from "./local-contrast-engine.js";

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
      const img = wx.getImageData(0, 0, w, h), d = img.data;

      // Radios relativos al lado corto: la vista previa reducida y el resultado a tamaño completo se ven igual.
      claridadPixeles(d, w, h, { structure: p.structure, detail: p.detail });
      wx.putImageData(img, 0, 0);

      x.save(); x.globalCompositeOperation = "copy";
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
      x.drawImage(work, 0, 0, W, H); x.restore();
    }
  }, opts);
}
