/* ═══════════════════════════════════════════════════════════════
   basic · vignette
   Parte de js/filters/library/basic.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { slider } from "../../../editor/adjust/adjust.js";
import { hexToRgb } from "../../../editor/tools/paint.js";
import { runFilter } from "./common.js";

/* ── viñeteado ──────────────────────────────────────────────────
   Un velo que crece del centro al borde y se mezcla con la foto:
   negro (oscurece), blanco (aclara) o un color libre.

   · «Cantidad» es lo que se cierra el velo en el sitio donde llega al
     máximo; «Opacidad» rebaja el efecto entero sin cambiar su forma.
   · «Zona clara» es hasta dónde no se toca nada, medido del centro a
     las esquinas (0 % = el velo empieza ya en el centro).
   · «Pluma» es lo suave de la transición: con 100 % el velo crece
     poco a poco hasta las esquinas; bajándola, llega antes al máximo
     y el borde se nota más. Siempre más pluma = más suave.
   · «Redondez»: 100 % es un círculo; 0 % una elipse con la proporción
     de la foto. Las esquinas siempre reciben el valor completo.

   La caída es una curva suave (smootherstep) sin ningún quiebro, así
   que no se ve el anillo donde empieza el efecto, y se dibuja con
   «source-atop»: el velo sólo se mezcla donde hay imagen y nunca pinta
   sobre las zonas transparentes de la capa. */
const VIGNETTE_STOPS = 48;

const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);

/** Parámetros del degradado normalizado: [radio donde empieza, radio donde acaba] en 0..1. */
export function vignetteRamp(p){
  const r0 = Math.max(0, Math.min(1, p.size / 100)) * 0.9;
  const width = (1 - r0) * (0.12 + 0.88 * Math.max(0, Math.min(1, p.feather / 100)));
  return [r0, Math.min(1, r0 + Math.max(0.01, width))];
}

export function vignette(opts = {}){
  const p = { kind: "black", color: "#3a2a18", amount: 45, size: 40, feather: 70, opacity: 100, roundness: 100, ...opts.init };

  return runFilter({
    title: "Viñeteado",
    id: "vignette", params: p, float: "delta",
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
      box.appendChild(slider("Zona clara", 0, 100, p.size, v => { p.size = v; preview(); }, "%"));
      box.appendChild(slider("Pluma", 0, 100, p.feather, v => { p.feather = v; preview(); }, "%"));
      box.appendChild(slider("Redondez", 0, 100, p.roundness, v => { p.roundness = v; preview(); }, "%"));
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

      const strength = Math.max(0, Math.min(1, p.amount / 100)) * Math.max(0, Math.min(1, p.opacity / 100));
      if(strength <= 0) return;
      const col = p.kind === "black" ? [0, 0, 0] : p.kind === "white" ? [255, 255, 255] : hexToRgb(p.color);

      // Forma: del círculo (redondez 100 %) a la elipse de la proporción de
      // la foto (0 %). El radio se normaliza para que las esquinas valgan 1.
      const cx = w / 2, cy = h / 2, t = Math.max(0, Math.min(100, p.roundness)) / 100;
      const corner = Math.hypot(cx, cy);
      const ax = cx * Math.SQRT2 * (1 - t) + corner * t;
      const ay = cy * Math.SQRT2 * (1 - t) + corner * t;
      const rmax = Math.hypot(cx / ax, cy / ay) || 1;
      const sx = ax * rmax, sy = ay * rmax;       // semiejes (px) donde el radio vale 1

      const [r0, r1] = vignetteRamp(p);
      const rgb = `${col[0]},${col[1]},${col[2]}`;
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(${rgb},0)`);
      g.addColorStop(Math.min(1, r0), `rgba(${rgb},0)`);
      for(let i = 1; i <= VIGNETTE_STOPS; i++){
        const u = i / VIGNETTE_STOPS;
        g.addColorStop(Math.min(1, r0 + (r1 - r0) * u), `rgba(${rgb},${(strength * smootherstep(u)).toFixed(4)})`);
      }

      x.save();
      x.globalCompositeOperation = "source-atop";
      x.translate(cx, cy);
      x.scale(sx, sy);
      x.fillStyle = g;
      x.fillRect(-cx / sx, -cy / sy, w / sx, h / sy);
      x.restore();
    }
  }, opts);
}
