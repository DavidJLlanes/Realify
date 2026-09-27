/* ══════════════════════════════════════════════════════════════
   UNMARK · RELLENO DE LA ZONA MARCADA
   Tres formas de tapar un agujero, de menos a más ambiciosa:

   · DIFUSIÓN: resuelve la ecuación de Laplace dentro de la máscara
     con una pirámide multirresolución (Jacobi grueso → Gauss-Seidel
     fino). Sale un relleno perfectamente suave que respeta el color
     del borde: perfecto en cielos y fondos lisos, «plástico» sobre
     textura.
   · PARCHE: el «Rellenar según el contenido» del editor —busca un
     trozo vecino cuyo contorno case y lo copia corrigiendo la
     costura—. Bueno en textura repetitiva, malo si no hay ningún
     parche que encaje.
   · HÍBRIDO: la estructura la pone la difusión y la textura fina
     la pone el parche (su parte de alta frecuencia), más un grano
     calibrado con el ruido que ya hay alrededor. Es lo que hacen,
     a lo bruto, los modelos de inpainting: fondo coherente y detalle
     creíble. Si no hay parche válido, sólo grano.

   Todo se calcula sobre un RECORTE alrededor de la máscara: en una
   foto de 20 MP con un logotipo de 80 px no hay que tocar 20 MP.
   ══════════════════════════════════════════════════════════════ */

import { maskBoundary, subsample, findSource, fillContentAware } from "../../editor/fillcontent.js";
import { blurPlane, rng, gauss } from "./disrupt.js";

function dilateMask(mask, w, h, r){
  if(r <= 0) return mask;
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w; x++){
      let v = 0;
      for(let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r) && !v; k++) v = mask[row + k];
      tmp[row + x] = v;
    }
  }
  for(let x = 0; x < w; x++)
    for(let y = 0; y < h; y++){
      let v = 0;
      for(let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r) && !v; k++) v = tmp[k * w + x];
      out[y * w + x] = v;
    }
  return out;
}

function boundsOf(mask, w, h){
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++){
    const row = y * w;
    for(let x = 0; x < w; x++){
      if(!mask[row + x]) continue;
      if(x < x0) x0 = x; if(x > x1) x1 = x;
      if(y < y0) y0 = y; if(y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* ── difusión armónica piramidal ─────────────────────────────── */
function downsample(pl, m, w, h){
  const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
  const o = [new Float32Array(hw * hh), new Float32Array(hw * hh), new Float32Array(hw * hh)];
  const om = new Uint8Array(hw * hh);
  for(let y = 0; y < hh; y++)
    for(let x = 0; x < hw; x++){
      let cnt = 0, unk = 0;
      const acc = [0, 0, 0];
      for(let dy = 0; dy < 2; dy++)
        for(let dx = 0; dx < 2; dx++){
          const sx = Math.min(w - 1, 2 * x + dx), sy = Math.min(h - 1, 2 * y + dy);
          const q = sy * w + sx;
          if(m[q]){ unk++; continue; }
          cnt++;
          acc[0] += pl[0][q]; acc[1] += pl[1][q]; acc[2] += pl[2][q];
        }
      const q = y * hw + x;
      if(cnt){ o[0][q] = acc[0] / cnt; o[1][q] = acc[1] / cnt; o[2][q] = acc[2] / cnt; }
      om[q] = cnt ? 0 : 1;
    }
  return { pl: o, m: om, w: hw, h: hh };
}

function relax(pl, m, w, h, iters){
  for(let it = 0; it < iters; it++){
    for(let c = 0; c < 3; c++){
      const a = pl[c];
      for(let y = 0; y < h; y++){
        const row = y * w;
        for(let x = 0; x < w; x++){
          const q = row + x;
          if(!m[q]) continue;
          const l = x > 0 ? a[q - 1] : a[q + 1];
          const r = x < w - 1 ? a[q + 1] : a[q - 1];
          const u = y > 0 ? a[q - w] : a[q + w];
          const d = y < h - 1 ? a[q + w] : a[q - w];
          a[q] = (l + r + u + d) * 0.25;
        }
      }
    }
  }
}

function diffusionFill(pl, m, w, h){
  const levels = [{ pl, m, w, h }];
  let cur = levels[0];
  let unknown = 0; for(let i = 0; i < m.length; i++) unknown += m[i];
  while(cur.w > 6 && cur.h > 6 && unknown > 4){
    cur = downsample(cur.pl, cur.m, cur.w, cur.h);
    levels.push(cur);
    unknown = 0; for(let i = 0; i < cur.m.length; i++) unknown += cur.m[i];
  }
  // Nivel más grueso: media de lo conocido como arranque
  const top = levels[levels.length - 1];
  for(let c = 0; c < 3; c++){
    let s = 0, n = 0;
    for(let i = 0; i < top.m.length; i++) if(!top.m[i]){ s += top.pl[c][i]; n++; }
    const mean = n ? s / n : 0.5;
    for(let i = 0; i < top.m.length; i++) if(top.m[i]) top.pl[c][i] = mean;
  }
  relax(top.pl, top.m, top.w, top.h, 200);
  // Subida: interpolar la solución gruesa como arranque del nivel fino
  for(let L = levels.length - 2; L >= 0; L--){
    const fine = levels[L], coarse = levels[L + 1];
    for(let c = 0; c < 3; c++){
      const a = fine.pl[c], b = coarse.pl[c];
      for(let y = 0; y < fine.h; y++){
        const fy = Math.min(coarse.h - 1, (y + 0.5) / 2 - 0.5);
        const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(coarse.h - 1, y0 + 1), ty = fy - y0;
        for(let x = 0; x < fine.w; x++){
          const q = y * fine.w + x;
          if(!fine.m[q]) continue;
          const fx = Math.min(coarse.w - 1, (x + 0.5) / 2 - 0.5);
          const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(coarse.w - 1, x0 + 1), tx = fx - x0;
          const v = (b[y0 * coarse.w + x0] * (1 - tx) + b[y0 * coarse.w + x1] * tx) * (1 - ty)
                  + (b[y1 * coarse.w + x0] * (1 - tx) + b[y1 * coarse.w + x1] * tx) * ty;
          a[q] = v;
        }
      }
    }
    relax(fine.pl, fine.m, fine.w, fine.h, L === 0 ? 10 : 6 + 4 * L);
  }
}

/* σ del ruido en el anillo exterior (residuo de Immerkær). */
function ringNoise(Y, m, w, h){
  const res = [];
  for(let y = 1; y < h - 1; y++)
    for(let x = 1; x < w - 1; x++){
      const p = y * w + x;
      if(m[p] || m[p-1] || m[p+1] || m[p-w] || m[p+w]) continue;
      const v = 4*Y[p] - 2*(Y[p-1] + Y[p+1] + Y[p-w] + Y[p+w])
              + Y[p-w-1] + Y[p-w+1] + Y[p+w-1] + Y[p+w+1];
      res.push(Math.abs(v));
    }
  if(res.length < 16) return 0;
  res.sort((a, b) => a - b);
  return res[res.length >> 1] / (0.6745 * 6);
}

/**
 * @param {ImageData} img         imagen completa (se devuelve una copia)
 * @param {Uint8Array} mask       0/255, tamaño w×h
 * @param {object} o  { method, expand, feather, texture, grain, seed }
 *   expand/feather en píxeles; texture/grain 0..1
 * @returns {{img:ImageData, changed:boolean, bounds:object|null}}
 */
export function inpaint(img, mask, o){
  const w = img.width, h = img.height;
  const out = new ImageData(new Uint8ClampedArray(img.data), w, h);
  const bin = new Uint8Array(w * h);
  let any = 0;
  for(let i = 0; i < bin.length; i++){ bin[i] = mask[i] > 127 ? 1 : 0; any |= bin[i]; }
  if(!any) return { img: out, changed: false, bounds: null };

  const grown = dilateMask(bin, w, h, Math.round(o.expand));
  const bb = boundsOf(grown, w, h);
  if(!bb) return { img: out, changed: false, bounds: null };

  /* Método parche puro: trabaja sobre la imagen entera porque su
     búsqueda quiere espacio. Si no encuentra origen, cae al híbrido. */
  if(o.method === "patch"){
    const m255 = new Uint8Array(w * h);
    for(let i = 0; i < grown.length; i++) m255[i] = grown[i] ? 255 : 0;
    const ok = fillContentAware(out, m255, w, h, bb);
    if(ok){ featherBlend(img, out, grown, w, h, bb, o.feather); return { img: out, changed: true, bounds: bb }; }
  }

  // Recorte de trabajo alrededor de la máscara
  const R = Math.max(bb.w, bb.h);
  const pad = Math.max(48, Math.round(R * 2.6));
  const cx0 = Math.max(0, bb.x - pad), cy0 = Math.max(0, bb.y - pad);
  const cx1 = Math.min(w, bb.x + bb.w + pad), cy1 = Math.min(h, bb.y + bb.h + pad);
  const cw = cx1 - cx0, ch = cy1 - cy0;
  const pl = [new Float32Array(cw * ch), new Float32Array(cw * ch), new Float32Array(cw * ch)];
  const cm = new Uint8Array(cw * ch);
  const d = img.data;
  for(let y = 0; y < ch; y++)
    for(let x = 0; x < cw; x++){
      const q = (y + cy0) * w + (x + cx0), i = q * 4, c = y * cw + x;
      pl[0][c] = d[i] / 255; pl[1][c] = d[i+1] / 255; pl[2][c] = d[i+2] / 255;
      cm[c] = grown[q];
    }
  const orig = pl.map(a => Float32Array.from(a));

  // 1 · estructura por difusión
  diffusionFill(pl, cm, cw, ch);

  if(o.method !== "diffusion"){
    // 2 · textura: parche vecino cuya alta frecuencia se devuelve encima
    const lb = { x: bb.x - cx0, y: bb.y - cy0, w: bb.w, h: bb.h };
    const getPixel = (x, y) => {
      const c = y * cw + x;
      return [orig[0][c] * 255, orig[1][c] * 255, orig[2][c] * 255];
    };
    const ring = subsample(maskBoundary(cm, cw, ch, lb), 80);
    const src = ring.length ? findSource(getPixel, ring, lb, cw, ch) : null;
    const texture = Math.max(0, Math.min(1, o.texture));
    if(src && texture > 0){
      const sigma = Math.max(1.2, R * 0.03);
      for(let c = 0; c < 3; c++){
        const low = blurPlane(orig[c], cw, ch, sigma);
        const a = pl[c];
        for(let y = 0; y < ch; y++)
          for(let x = 0; x < cw; x++){
            const q = y * cw + x;
            if(!cm[q]) continue;
            const sx = x - src.dx, sy = y - src.dy;
            if(sx < 0 || sy < 0 || sx >= cw || sy >= ch) continue;
            const s = sy * cw + sx;
            if(cm[s]) continue;   // el origen no puede ser el propio agujero
            a[q] += (orig[c][s] - low[s]) * texture;
          }
      }
    }
    // 3 · grano calibrado con el ruido del anillo
    const grain = Math.max(0, Math.min(1, o.grain));
    if(grain > 0){
      const Y = new Float32Array(cw * ch);
      for(let i = 0; i < Y.length; i++) Y[i] = 0.299 * orig[0][i] + 0.587 * orig[1][i] + 0.114 * orig[2][i];
      const sigma = ringNoise(Y, cm, cw, ch) * grain * 1.3;
      if(sigma > 1e-4){
        const rand = rng((o.seed | 0) * 97 + 13);
        for(let i = 0; i < cm.length; i++){
          if(!cm[i]) continue;
          const g = gauss(rand) * sigma;
          pl[0][i] += g; pl[1][i] += g; pl[2][i] += g;
        }
      }
    }
  }

  // Volcar el recorte
  const od = out.data;
  for(let y = 0; y < ch; y++)
    for(let x = 0; x < cw; x++){
      const c = y * cw + x;
      if(!cm[c]) continue;
      const i = ((y + cy0) * w + (x + cx0)) * 4;
      od[i]   = Math.max(0, Math.min(255, pl[0][c] * 255 + 0.5)) | 0;
      od[i+1] = Math.max(0, Math.min(255, pl[1][c] * 255 + 0.5)) | 0;
      od[i+2] = Math.max(0, Math.min(255, pl[2][c] * 255 + 0.5)) | 0;
    }
  featherBlend(img, out, grown, w, h, bb, o.feather);
  return { img: out, changed: true, bounds: bb };
}

/* Fundido del borde: dentro de la máscara la mezcla sube de ~0,5 en
   el límite a 1 hacia dentro, sobre la franja que `expand` añadió; fuera
   no se toca nada. Así no vuelve a asomar la marca por el contorno. */
function featherBlend(src, out, mask, w, h, bb, feather){
  const r = Math.round(feather);
  if(r <= 0) return;
  const x0 = Math.max(0, bb.x - r - 1), y0 = Math.max(0, bb.y - r - 1);
  const x1 = Math.min(w, bb.x + bb.w + r + 1), y1 = Math.min(h, bb.y + bb.h + r + 1);
  const cw = x1 - x0, ch = y1 - y0;
  const m = new Float32Array(cw * ch);
  for(let y = 0; y < ch; y++)
    for(let x = 0; x < cw; x++) m[y * cw + x] = mask[(y + y0) * w + (x + x0)];
  const soft = blurPlane(m, cw, ch, r * 0.6);
  const s = src.data, o = out.data;
  for(let y = 0; y < ch; y++)
    for(let x = 0; x < cw; x++){
      const q = (y + y0) * w + (x + x0);
      if(!mask[q]) continue;
      const t = Math.min(1, soft[y * cw + x] * 1.15);
      const a = t * t * (3 - 2 * t);
      const i = q * 4;
      o[i]   = s[i]   + (o[i]   - s[i])   * a;
      o[i+1] = s[i+1] + (o[i+1] - s[i+1]) * a;
      o[i+2] = s[i+2] + (o[i+2] - s[i+2]) * a;
    }
}

/* Máscara (0/255) → canvas en blanco y negro, para el servidor. */
export function maskToCanvas(mask, w, h){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  const img = x.createImageData(w, h);
  for(let p = 0; p < w * h; p++){
    const v = mask[p] > 127 ? 255 : 0;
    img.data[p*4] = v; img.data[p*4+1] = v; img.data[p*4+2] = v; img.data[p*4+3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

export { dilateMask };
