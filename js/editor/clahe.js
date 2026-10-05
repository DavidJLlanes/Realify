/* ═══════════════════════════════════════════════════════════════
   CONTRASTE LOCAL (CLAHE) · Ajustes › Detalle y cajón «Mejorar»
   Ecualización adaptativa del histograma con límite de contraste:
   saca detalle de sombras y luces a la vez, zona a zona, sin el efecto
   «lavado» de una ecualización global (ver clahe-math.js).

   Normal: sobre la luma de la imagen (valores codificados, 256
   niveles), conservando la proporción entre canales.
   Premium 👑 («el bueno y el mejor»):
     · Bueno: sobre la luminosidad PERCIBIDA (L de OKLab) en coma
       flotante con 1024 niveles de histograma, y el color acompaña a
       la luz (el croma sigue a la luminosidad, sin lavarse ni
       saturarse), con mapeo de gama.
     · Mejor: salida con tramado, sin bandas en cielos y degradados
       que el realce de contraste local suele dejar.
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust, slider, pickerGroup } from "./adjust.js";
import { premiumSwitch, premiumPref } from "../ui/premium.js";
import { isMobile } from "../core/device.js";
import { claheMap, DEC, enc, linToOklab, oklabToLinInGamut } from "./clahe-math.js";

const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const grid = (p, w, h) => { const tx = Math.max(1, Math.round(p.tiles)); return { tilesX: tx, tilesY: Math.max(1, Math.round(tx * h / w)) }; };

function basic(d, w, h, p){
  const n = w * h, Y = new Float32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4) Y[i] = (d[j] * 0.2126 + d[j + 1] * 0.7152 + d[j + 2] * 0.0722) / 255;
  const M = claheMap(Y, w, h, { ...grid(p, w, h), clip: p.clip, bins: 256 }), a = p.amount / 100;
  for(let i = 0, j = 0; i < n; i++, j += 4){
    const y = Y[i]; if(y < 1e-4) continue;
    const q = (y + (M[i] - y) * a) / y;
    d[j] = Math.min(255, d[j] * q); d[j + 1] = Math.min(255, d[j + 1] * q); d[j + 2] = Math.min(255, d[j + 2] * q);
  }
}

function premium(d, w, h, p){
  const n = w * h, L = new Float32Array(n), lab = [0, 0, 0], lin = [0, 0, 0];
  // Se guardan a y b para no pasar dos veces a OKLab (la raíz cúbica es lo más caro); en imágenes enormes se recalculan para no gastar memoria
  const keep = n <= 12e6, A = keep ? new Float32Array(n) : null, B = keep ? new Float32Array(n) : null;
  for(let i = 0, j = 0; i < n; i++, j += 4){
    L[i] = linToOklab(DEC[d[j]], DEC[d[j + 1]], DEC[d[j + 2]], lab)[0];
    if(keep){ A[i] = lab[1]; B[i] = lab[2]; }
  }
  const M = claheMap(L, w, h, { ...grid(p, w, h), clip: p.clip, bins: 1024 }), a = p.amount / 100;
  for(let i = 0, j = 0; i < n; i++, j += 4){
    let L0, oa, ob;
    if(keep){ L0 = L[i]; oa = A[i]; ob = B[i]; }
    else { linToOklab(DEC[d[j]], DEC[d[j + 1]], DEC[d[j + 2]], lab); L0 = lab[0]; oa = lab[1]; ob = lab[2]; }
    const L1 = Math.min(1, Math.max(0, L0 + (M[i] - L0) * a));
    // El croma acompaña a la luz: ni se lava al aclarar ni se infla al oscurecer
    const k = L0 > 1e-4 ? Math.min(1.5, Math.max(0.6, Math.sqrt(L1 / L0))) : 1;
    oklabToLinInGamut(L1, oa * k, ob * k, lin);
    const nz = (hash(i) - 0.5) * 0.9;
    d[j] = enc(lin[0]) + nz; d[j + 1] = enc(lin[1]) + nz; d[j + 2] = enc(lin[2]) + nz;
  }
}

export function clahe(opts = {}){
  const p = { clip: 3, tiles: 8, amount: 100, premium: opts.premium !== undefined ? !!opts.premium : opts.init ? false : premiumPref.get("clahe"), ...opts.init };
  return runAdjust({
    title: "Contraste local (CLAHE)", asLayer: true, float: "delta", filterId: "clahe", filterParams: p, previewLimit: 1.2e6, refineEstMs: 14000, refineRealMs: 6000,
    compute: (d, w, h) => (p.premium ? premium : basic)(d, w, h, p),
    buildBody: ({ preview }) => {
      const b = document.createElement("div");
      b.appendChild(pickerGroup([
        { label: "Límite", node: slider("Límite", 1, 10, p.clip, v => { p.clip = v; preview(); }, "", 0.1) },
        { label: "Zonas", node: slider("Zonas", 2, 24, p.tiles, v => { p.tiles = v; preview(); }) },
        { label: "Cantidad", node: slider("Cantidad", 0, 100, p.amount, v => { p.amount = v; preview(); }, "%") }
      ]));
      const sw = premiumSwitch({ checked: p.premium, title: "Contraste local de alta calidad: luminosidad percibida (OKLab) en coma flotante, color que acompaña a la luz, mapeo de gama y tramado (función Premium)",
        onChange: on => { p.premium = on; premiumPref.set("clahe", on); preview(); } });
      sw.classList.add("adj-premium");
      if(isMobile()){ sw.classList.add("ps-docked"); b.footStart = sw; } else b.prepend(sw);
      preview();
      return b;
    }
  }, opts);
}
export const clahePremium = (opts = {}) => clahe({ ...opts, premium: true });
