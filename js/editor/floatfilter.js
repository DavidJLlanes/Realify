/* ═══════════════════════════════════════════════════════════════
   FILTROS SOBRE ORIGEN DE ALTA PROFUNDIDAD (fase 12)

   Continúa editor/floatadjust.js (fase 11) para los filtros de `runFilter`
   (filters/basic.js) y de photo-tools. Un filtro calcula sobre el lienzo de
   8 bits y tira los bits extra que la capa trae en `hiSrc` (RAW revelado,
   PNG/TIFF de 16 bits, AVIF de 10/12). Hay dos maneras de conservarlos:

   · «color»: el filtro sólo mira el color de cada píxel (virados, tablas
     de color, curvas…). Se evalúa en una rejilla RGB, igual que en los
     ajustes, y el resultado sale en coma flotante de los 16 bits.

   · «delta»: el filtro es local (desenfoque, enfoque, ruido, detalle…).
     Se calcula como siempre sobre el lienzo de 8 bits y su CAMBIO
     (resultado − origen, en niveles de 8 bits) se suma a los 16 bits del
     origen: donde el filtro no toca un píxel se conservan sus 16 bits
     exactos y donde lo toca se arrastra su precisión, en vez de quedarse
     con el redondeo de 8 bits. Sirve cuando cada píxel sigue siendo «el
     mismo píxel»; los filtros que mueven la imagen (distorsiones, remuestreo)
     o la sustituyen (IA) no lo usan: ahí el 16 bits no significa nada.

   En los dos casos el lienzo de 8 bits de la capa nueva es el redondeo
   (con el mismo tramado que el origen) de los 16 bits, como exige
   core/hisrc.js, y si algo no cuadra se usa el camino de 8 bits de siempre.
   ═══════════════════════════════════════════════════════════════ */

import { hiToCanvas8 } from "../core/hisrc.js";
import { hiFullCover, hiRect, gridInput, colorFnFromTable } from "./floatadjust.js";

export { hiFullCover, hiRect };

const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * Función de color en coma flotante de un filtro que trabaja con lienzos: `apply(fake, src, true)` es la misma
 * función que usa el filtro (la capa falsa sólo lleva `canvas` y `ctx`). La rejilla de 86³ colores viaja como
 * un lienzo de 1024 de ancho y el resultado se interpola de forma trilineal.
 */
export async function colorFnFromFilter(apply){
  const { d, n } = gridInput(), W = 1024, H = Math.ceil(n / W);
  const full = new Uint8ClampedArray(W * H * 4);
  full.set(d);
  for(let i = n * 4 + 3; i < full.length; i += 4) full[i] = 255;
  const src = document.createElement("canvas"); src.width = W; src.height = H;
  src.getContext("2d").putImageData(new ImageData(full, W, H), 0, 0);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const fake = { canvas: c, ctx: c.getContext("2d", { willReadFrequently: true }) };
  await Promise.resolve(apply(fake, src, true));
  return colorFnFromTable(fake.ctx.getImageData(0, 0, W, H).data);
}

/**
 * Suma el cambio de un filtro local a los 16 bits de `base`. `source`: el lienzo de 8 bits del que salió el
 * filtro (la capa de origen tal cual); `result`: el lienzo con el resultado ya calculado (y recortado a la
 * selección). Devuelve { canvas, hi } como `applyFloatFromBase`: lienzo de 8 bits (redondeo tramado de `hi`) y
 * los 16 bits nuevos.
 */
export async function applyDeltaFromBase(base, source, result){
  const hs = base.hiSrc, W = source.width, H = source.height, rc = hiRect(base) || { x: 0, y: 0, w: W, h: H };
  if(result.width !== W || result.height !== H) return null;
  const out = new Uint16Array(rc.w * rc.h * 3);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const sx = source.getContext("2d", { willReadFrequently: true }), rx = result.getContext("2d", { willReadFrequently: true });
  const rows = Math.max(16, Math.floor(1.5e6 / W));
  for(let y0 = 0; y0 < H; y0 += rows){
    const bh = Math.min(rows, H - y0), s = sx.getImageData(0, y0, W, bh).data, img = rx.getImageData(0, y0, W, bh), r = img.data;
    for(let p = 0, i = 0; p < W * bh; p++, i += 4){
      const x = p % W, y = y0 + (p / W | 0), hx = x - rc.x, hy = y - rc.y;
      if(hx < 0 || hy < 0 || hx >= rc.w || hy >= rc.h) continue;               // fuera del origen de 16 bits: se queda el resultado de 8 bits
      const j = (hy * rc.w + hx) * 3;
      const R = hs.data[j], G = hs.data[j + 1], B = hs.data[j + 2];
      // Donde el lienzo ya no es el redondeo del origen (se pintó encima) manda el lienzo
      const keep = hiToCanvas8(R, hx, hy, 0, hs.dither) === s[i] && hiToCanvas8(G, hx, hy, 1, hs.dither) === s[i + 1] && hiToCanvas8(B, hx, hy, 2, hs.dither) === s[i + 2];
      let nr, ng, nb;
      if(keep){
        nr = R + (r[i] - s[i]) * 257; ng = G + (r[i + 1] - s[i + 1]) * 257; nb = B + (r[i + 2] - s[i + 2]) * 257;
      } else { nr = r[i] * 257; ng = r[i + 1] * 257; nb = r[i + 2] * 257; }
      nr = nr < 0 ? 0 : nr > 65535 ? 65535 : nr; ng = ng < 0 ? 0 : ng > 65535 ? 65535 : ng; nb = nb < 0 ? 0 : nb > 65535 ? 65535 : nb;
      out[j] = nr; out[j + 1] = ng; out[j + 2] = nb;
      if(r[i + 3] === 0) continue;               // transparente: el lienzo no lleva color
      r[i] = hiToCanvas8(nr, hx, hy, 0, hs.dither); r[i + 1] = hiToCanvas8(ng, hx, hy, 1, hs.dither); r[i + 2] = hiToCanvas8(nb, hx, hy, 2, hs.dither);
    }
    cx.putImageData(img, 0, y0);
    await tick();
  }
  return { canvas: cv, hi: out, rect: rc };
}

/**
 * Filtro espacial calculado de verdad en coma flotante (editor/floatspatial.js): `native(inp, W, H, tick)` recibe los 16 bits de `base` (RGB
 * Uint16Array; donde el lienzo ya no es su redondeo manda el lienzo) y devuelve los 16 bits del resultado. Sólo capas opacas que el origen cubre
 * entero y de hasta 16 MP (el filtro necesita ~20 bytes por píxel); si no, null y el llamador usa el camino de siempre. `selection` mezcla igual
 * que `applyFloatFromBase`. Devuelve { canvas, hi, rect } como `applyDeltaFromBase`.
 */
export async function applyNativeFromBase(base, source, native, selection = null){
  const hs = base.hiSrc, W = source.width, H = source.height, rc = hiRect(base);
  if(!rc || rc.x || rc.y || rc.w !== W || rc.h !== H || W * H > 16e6) return null;
  const sx = source.getContext("2d", { willReadFrequently: true }), img = sx.getImageData(0, 0, W, H), d = img.data, n = W * H;
  const inp = new Uint16Array(hs.data);
  for(let p = 0, i = 0, j = 0; p < n; p++, i += 4, j += 3){
    if(d[i + 3] !== 255) return null;                       // con transparencia el desenfoque tendría que ir premultiplicado: camino de 8 bits
    const x = p % W, y = (p / W) | 0;
    if(hiToCanvas8(inp[j], x, y, 0, hs.dither) !== d[i] || hiToCanvas8(inp[j + 1], x, y, 1, hs.dither) !== d[i + 1] || hiToCanvas8(inp[j + 2], x, y, 2, hs.dither) !== d[i + 2]){
      inp[j] = d[i] * 257; inp[j + 1] = d[i + 1] * 257; inp[j + 2] = d[i + 2] * 257;     // pintado encima: manda el lienzo
    }
  }
  const out = await native(inp, W, H, tick);
  if(!out || out.length !== inp.length) return null;
  const mask = selection?.mask, mw = selection?.w, mh = selection?.h;
  for(let p = 0, i = 0, j = 0; p < n; p++, i += 4, j += 3){
    const x = p % W, y = (p / W) | 0;
    if(mask){
      const mx = mw === W ? x : Math.min(mw - 1, (x * mw / W) | 0), my = mh === H ? y : Math.min(mh - 1, (y * mh / H) | 0), t = mask[my * mw + mx] / 255;
      if(t < 1) for(let k = 0; k < 3; k++) out[j + k] = Math.round(inp[j + k] + (out[j + k] - inp[j + k]) * t);
    }
    d[i] = hiToCanvas8(out[j], x, y, 0, hs.dither); d[i + 1] = hiToCanvas8(out[j + 1], x, y, 1, hs.dither); d[i + 2] = hiToCanvas8(out[j + 2], x, y, 2, hs.dither);
  }
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  cv.getContext("2d", { willReadFrequently: true }).putImageData(img, 0, 0);
  return { canvas: cv, hi: out, rect: rc };
}

/** Deja en la capa recién creada los 16 bits del resultado (si los hay) con el mismo tramado que el origen. */
export function attachFloatResult(made, base, fres){
  if(!made || !fres || !base?.hiSrc) return false;
  const hs = base.hiSrc, W = fres.canvas.width, H = fres.canvas.height, rc = fres.rect || { x: 0, y: 0, w: W, h: H };
  made.hiSrc = { data: fres.hi, w: rc.w, h: rc.h, dither: hs.dither, x: rc.x, y: rc.y, canvasW: W, canvasH: H };
  made.thumbDirty = true;
  return true;
}
