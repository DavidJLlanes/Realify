/* ═══════════════════════════════════════════════════════════════
   TONOS DEL HISTOGRAMA
   Ajusta SÓLO una franja de tonos: la zona del histograma sobre la
   que se ha hecho clic (negros, sombras, medios, luces, blancos) o
   cualquier franja que se arrastre en el propio histograma del
   diálogo. Cada píxel pesa según lo cerca que está su luminancia del
   centro de la franja, con bordes suaves: no hay saltos entre lo que
   se toca y lo que no.

   Brillo, contraste, saturación y calidez sólo dentro de la franja,
   y «Ver zona afectada» enseña en gris qué píxeles entran y cuánto.
   Es una capa de filtro reeditable como las demás (id "tone-band").
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider } from "./adjust.js";

export const TONE_ZONES = [
  ["blacks", "Negros", 12, 26],
  ["shadows", "Sombras", 58, 44],
  ["mids", "Medios", 128, 56],
  ["lights", "Luces", 196, 44],
  ["whites", "Blancos", 243, 24]
];
export const zoneAt = v => TONE_ZONES.reduce((best, z) => Math.abs(v - z[2]) < Math.abs(v - best[2]) ? z : best, TONE_ZONES[0]);

const clamp = (v, a = 0, b = 255) => v < a ? a : v > b ? b : v;

/* Peso de cada nivel de luminancia (0..255) en la franja */
function bandWeights(center, width, soft){
  const w = new Float32Array(256), core = width * (1 - soft / 100);
  for(let i = 0; i < 256; i++){
    const d = Math.abs(i - center);
    if(d <= core) w[i] = 1;
    else if(d >= width) w[i] = 0;
    else { const t = (width - d) / Math.max(1e-6, width - core); w[i] = t * t * (3 - 2 * t); }
  }
  return w;
}

export function toneBand(opts = {}){
  const p = { center: 128, width: 56, soft: 60, brightness: 0, contrast: 0, saturation: 0, warmth: 0, showMask: false, ...opts.init };
  return runAdjust({
    title: "Tonos del histograma",
    asLayer: true, filterId: "tone-band", filterParams: p, float: () => !p.showMask,
    compute(d){
      const W = bandWeights(p.center, p.width, p.soft);
      if(p.showMask){
        for(let i = 0; i < d.length; i += 4){
          const v = W[(d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) | 0] * 255;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
        return;
      }
      const br = p.brightness / 100 * 70, ct = p.contrast / 100, sat = p.saturation / 100, wm = p.warmth / 100 * 28;
      if(!br && !ct && !sat && !wm) return;
      for(let i = 0; i < d.length; i += 4){
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const y = r * .2126 + g * .7152 + b * .0722, w = W[y | 0];
        if(!w) continue;
        // Contraste alrededor del centro de la franja, en luminancia
        const dy = br * w + (y - p.center) * ct * w;
        r += dy; g += dy; b += dy;
        if(sat){ const ny = y + dy; r = ny + (r - ny) * (1 + sat * w); g = ny + (g - ny) * (1 + sat * w); b = ny + (b - ny) * (1 + sat * w); }
        if(wm){ r += wm * w; b -= wm * w; }
        d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
      }
    },
    buildBody({ hist, preview }){
      const box = document.createElement("div");
      /* Histograma con la franja: clic la centra, arrastrar la mueve y
         la rueda la ensancha o estrecha. */
      const cv = document.createElement("canvas");
      cv.width = 512; cv.height = 150;
      cv.style.cssText = "width:100%;height:120px;display:block;border:1px solid var(--line);border-radius:var(--r);background:var(--s-900);cursor:ew-resize;touch-action:none";
      const paint = () => {
        const x = cv.getContext("2d"), W = cv.width, H = cv.height;
        x.clearRect(0, 0, W, H);
        let peak = 1;
        for(let i = 2; i < 254; i++) peak = Math.max(peak, hist.r[i], hist.g[i], hist.b[i]);
        x.globalCompositeOperation = "lighter";
        for(const [arr, col] of [[hist.r, "rgba(190,70,60,.55)"], [hist.g, "rgba(60,160,80,.55)"], [hist.b, "rgba(60,90,190,.6)"]]){
          x.fillStyle = col;
          for(let i = 0; i < 256; i++){ const h = Math.min(1, arr[i] / peak) * (H - 6); x.fillRect(i * W / 256, H - h, W / 256 + .5, h); }
        }
        x.globalCompositeOperation = "source-over";
        const wts = bandWeights(p.center, p.width, p.soft);
        x.fillStyle = "rgba(232,163,61,.22)";
        for(let i = 0; i < 256; i++) if(wts[i] > 0){ x.globalAlpha = wts[i]; x.fillRect(i * W / 256, 0, W / 256 + .5, H); }
        x.globalAlpha = 1;
        x.strokeStyle = "#e8a33d"; x.lineWidth = 2;
        x.beginPath(); x.moveTo(p.center * W / 255, 0); x.lineTo(p.center * W / 255, H); x.stroke();
        x.fillStyle = "rgba(255,255,255,.75)"; x.font = "600 20px system-ui"; x.textBaseline = "top";
        x.fillText(zoneAt(p.center)[1], 8, 6);
      };
      const toVal = e => { const r = cv.getBoundingClientRect(); return Math.round(clamp((e.clientX - r.left) / r.width * 255)); };
      let drag = null;
      cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); drag = { x: toVal(e), c: p.center, moved: false }; p.center = toVal(e); paint(); syncZones(); preview(); });
      cv.addEventListener("pointermove", e => { if(!drag) return; p.center = toVal(e); drag.moved = true; paint(); syncZones(); preview(); });
      cv.addEventListener("pointerup", () => { drag = null; });
      cv.addEventListener("wheel", e => { e.preventDefault(); p.width = Math.round(clamp(p.width * Math.exp(-e.deltaY * .0015), 6, 128)); paint(); rebuild(); preview(); }, { passive: false });
      box.appendChild(cv);

      const zones = document.createElement("div");
      zones.className = "seg"; zones.style.margin = "8px 0";
      for(const [id, label, c, w] of TONE_ZONES){
        const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.zone = id;
        b.addEventListener("click", () => { p.center = c; p.width = w; paint(); rebuild(); syncZones(); preview(); });
        zones.appendChild(b);
      }
      const syncZones = () => zones.querySelectorAll("button").forEach(b => b.classList.toggle("on", zoneAt(p.center)[0] === b.dataset.zone));
      box.appendChild(zones);
      const ctrls = document.createElement("div");
      const rebuild = () => {
        ctrls.innerHTML = "";
        ctrls.append(
          slider("Brillo", -100, 100, p.brightness, v => { p.brightness = v; preview(); }, "%"),
          slider("Contraste", -100, 100, p.contrast, v => { p.contrast = v; preview(); }, "%"),
          slider("Saturación", -100, 100, p.saturation, v => { p.saturation = v; preview(); }, "%"),
          slider("Calidez", -100, 100, p.warmth, v => { p.warmth = v; preview(); }),
          slider("Centro de la franja", 0, 255, p.center, v => { p.center = v; paint(); syncZones(); preview(); }),
          slider("Anchura de la franja", 6, 128, p.width, v => { p.width = v; paint(); preview(); }),
          slider("Suavidad del borde", 0, 100, p.soft, v => { p.soft = v; paint(); preview(); }, "%"));
      };
      rebuild();
      const ck = document.createElement("label");
      ck.className = "chk";
      ck.innerHTML = '<input type="checkbox"> Ver zona afectada (en gris)';
      ck.querySelector("input").checked = p.showMask;
      ck.querySelector("input").addEventListener("change", e => { p.showMask = e.target.checked; preview(); });
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Toca el histograma para elegir los tonos (arrastra para moverte, rueda para ensanchar la franja). Sólo cambian los píxeles de esa franja.";
      box.append(ctrls, ck, hint);
      paint(); syncZones();
      return box;
    }
  }, opts);
}
