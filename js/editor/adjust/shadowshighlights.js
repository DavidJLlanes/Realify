/* ═══════════════════════════════════════════════════════════════
   SOMBRAS / ILUMINACIONES
   No confundir con «Tonos»: aquél decide cuánto tocar cada píxel
   mirando SÓLO el propio brillo de ese píxel. Este ajuste mira el
   brillo MEDIO de su alrededor —una versión desenfocada de la
   foto—, así que un ojo oscuro en una cara muy iluminada no se
   trata como «sombra» —su entorno es claro—, mientras que esa misma
   cara entera, si está a contraluz, sí se abre. Es lo que de verdad
   hace falta para recuperar detalle en un contraluz sin aplanar los
   negros del resto de la foto.

   «Radio» es el tamaño de ese entorno que se promedia: pequeño,
   reacciona a detalle fino; grande, sólo a zonas amplias de luz o
   sombra. «Tono» es lo ancho de la transición entre «zona de sombra»
   y «zona normal»: estrecho, el efecto se nota más localizado;
   ancho, se reparte con más suavidad hacia las medias luces.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider, pickerGroup } from "./adjust.js";
import { blurred } from "../../filters/library/basic.js";
import { applyShadowsHighlightsPremium } from "./adjustments.js";
import { premiumSwitch, premiumPref } from "../../ui/kit/premium.js";
import { isMobile } from "../../core/device.js";
import { doc } from "../../core/doc.js";
import { clamp01 } from "../../core/util/math.js";

const toLinear = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const toSrgb8 = v => Math.round(255 * (v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1/2.4) - .055));

export function shadowsHighlights(opts = {}){
  // Una capa ya hecha conserva su motor; un ajuste nuevo, la última elección
  const p = { shadows: 0, highlights: 0, radius: 60, tone: 50, premium: opts.init ? false : premiumPref.get("shadowsHighlights"), ...opts.init };

  return runAdjust({
    title: "Sombras / Iluminaciones",
    asLayer: true, float: "delta", filterId: "shadowsHighlights", filterParams: p,
    previewLimit: 6e5,
    compute(data, w, h){
      // Premium 👑: radio relativo a la imagen completa (vista previa = resultado)
      if(p.premium){ applyShadowsHighlightsPremium(data, w, h, p, doc.w ? w / doc.w : 1); return; }
      const shadowsAmt = p.shadows / 100, highlightsAmt = p.highlights / 100;
      if(!shadowsAmt && !highlightsAmt) return;

      const src = document.createElement("canvas");
      src.width = w; src.height = h;
      src.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
      const bx = blurred(src, Math.max(0.5, p.radius)).getContext("2d", { willReadFrequently: true });
      const blur = bx.getImageData(0, 0, w, h).data;

      const toneWidth = 0.12 + (p.tone / 100) * 0.38;   // 0.12 .. 0.50
      // Un documento P3 contiene números RGB P3, no sRGB. Usar los pesos
      // sRGB aquí cambia qué zonas cuentan como sombra y tiñe colores vivos.
      const [wr, wg, wb] = doc.colorSpace === "display-p3" ? [0.22897456, 0.69173852, 0.07928691] : [0.2126, 0.7152, 0.0722];

      for(let i = 0; i < data.length; i += 4){
        const lLocal = wr*toLinear(blur[i]) + wg*toLinear(blur[i+1]) + wb*toLinear(blur[i+2]);
        // Peso 1 en negro puro, se desvanece a 0 según crece lLocal
        const shadowW = clamp01(1 - lLocal / toneWidth);
        // Peso 1 en blanco puro, se desvanece a 0 según baja lLocal
        const highlightW = clamp01((lLocal - (1 - toneWidth)) / toneWidth);
        if(shadowW <= 0 && highlightW <= 0) continue;

        const delta = shadowsAmt * shadowW * 0.85 - highlightsAmt * highlightW * 0.85;
        if(!delta) continue;

        const r = toLinear(data[i]), g = toLinear(data[i+1]), b = toLinear(data[i+2]);
        const l = r * wr + g * wg + b * wb;
        const nl = delta >= 0 ? l + (1 - l) * delta : l * (1 + delta);
        // Limitar el factor ANTES de escalar los canales. Recortarlos por
        // separado (Math.min(1, canal * scale)) cambia el matiz de sombras
        // saturadas al aclararlas; en móvil era especialmente visible en
        // fotos P3 y con un ajuste intenso. Mantener un único factor conserva
        // la proporción RGB y evita que aparezcan dominantes rojas o azules.
        const mx = Math.max(r, g, b);
        const scale = l > 1e-7 ? Math.min(nl / l, mx > 0 ? 1 / mx : 0) : 0;
        data[i]   = toSrgb8(r * scale);
        data[i+1] = toSrgb8(g * scale);
        data[i+2] = toSrgb8(b * scale);
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.appendChild(pickerGroup([
        { label: "Sombras", node: slider("Sombras", 0, 100, p.shadows, v => { p.shadows = v; preview(); }, "%") },
        { label: "Iluminaciones", node: slider("Iluminaciones", 0, 100, p.highlights, v => { p.highlights = v; preview(); }, "%") },
        { label: "Radio", node: slider("Radio", 5, 250, p.radius, v => { p.radius = v; preview(); }, " px") },
        { label: "Tono", node: slider("Tono", 0, 100, p.tone, v => { p.tone = v; preview(); }, "%") }
      ]));
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.style.marginTop = "10px";
      hint.textContent = "«Sombras» aclara las zonas oscuras del entorno; «Iluminaciones» " +
        "oscurece las claras —como recuperar un contraluz—. El radio decide qué tamaño de " +
        "zona cuenta como «entorno»; el tono, qué tan ancha es la transición.";
      box.appendChild(hint);
      const sw = premiumSwitch({ checked: p.premium, title: "Sombras / Iluminaciones de alta calidad: entorno sin halos, textura conservada, color intacto (función Premium)",
        onChange: on => { p.premium = on; premiumPref.set("shadowsHighlights", on); preview(); } });
      sw.classList.add("adj-premium");
      if(isMobile()){ sw.classList.add("ps-docked"); box.footStart = sw; } else box.prepend(sw);
      return box;
    }
  }, opts);
}
