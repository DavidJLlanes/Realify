/* ═══════════════════════════════════════════════════════════════
   basic · noise
   Parte de js/filters/library/basic.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { noiseHi } from "../../../editor/render/floatspatial.js";
import { slider } from "../../../editor/adjust/adjust.js";
import { runFilter, previewProxy } from "./common.js";

/* ── ruido ────────────────────────────────────────────────────── */
export function noise(opts = {}){
  /* `seed` queda en los parámetros: el mismo ruido al reeditar, al recalcular el porcentaje de aplicación
     y al comparar con el cálculo completo (antes salía distinto cada vez). */
  const p = { amount: 12, mono: true, gaussian: true, seed: (Math.random() * 2147483647) | 0, ...opts.init };

  return runFilter({
    title: "Añadir ruido",
    id: "noise", params: p, float: "delta",
    native: () => (inp, w, h, tick) => noiseHi(inp, w, h, p, tick),
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
      let st = (p.seed | 0) >>> 0;                    // mulberry32: determinista a partir de la semilla
      const rand = () => {
        st = (st + 0x6D2B79F5) >>> 0;
        let t = st;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const rnd = p.gaussian
        ? () => {
            const u = Math.max(rand(), 1e-9);
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * rand()) * 0.4;
          }
        : () => rand() * 2 - 1;

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
