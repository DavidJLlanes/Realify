/* ═══════════════════════════════════════════════════════════════
   FILTROS BÁSICOS
   Desenfoque, enfoque y ruido. El desenfoque y la máscara de enfoque
   se apoyan en el filtro nativo del lienzo, que va por GPU: hacer una
   convolución gaussiana a mano en JavaScript sobre 20 MP tarda
   segundos, y el navegador ya la trae hecha.
   ═══════════════════════════════════════════════════════════════ */

import "../../core/doc.js";
import "../../core/bus.js";
import "../../editor/layers/filterlayer.js";
import "../../ui/kit/dialog.js";
import "../../core/toast.js";
import { slider } from "../../editor/adjust/adjust.js";
import "../../editor/tools/paint.js";
import "../../editor/selection/selection.js";
import "../../core/device.js";
import "../../editor/selection/refineedge-math.js";
import "../../editor/render/floatfilter.js";
import "../../editor/render/floatspatial.js";
import "../../editor/render/floatadjust.js";
import "../../ui/kit/premium.js";
import { runFilter } from "./basic/common.js";
export { runFilter, FILTER_PREVIEW_LIMIT } from "./basic/common.js";
export { blurred, blur, sharpen } from "./basic/sharpen.js";
export { clarity } from "./basic/clarity.js";
export { vignetteRamp, vignette } from "./basic/vignette.js";
export { noise } from "./basic/noise.js";

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
    id: "motion-blur", params: p, float: "delta",
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
