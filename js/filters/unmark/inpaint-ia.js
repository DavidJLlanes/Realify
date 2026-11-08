/* ═══════════════════════════════════════════════════════════════
   UNMARK · RELLENO CON IA (LaMa en escritorio, MI-GAN en móvil)
   Recorta un cuadrado con contexto alrededor de la marca, lo pasa por el modelo de relleno (js/ai/relleno.js), devuelve el hueco al
   tamaño real y lo funde con el borde. Como el modelo trabaja a 512 px, si el recorte era mayor el relleno sale más liso que la foto:
   se le devuelve el grano que la foto tiene alrededor del hueco. Entradas: ImageData completa, máscara 0/255 (w×h) y { expand, feather,
   grain 0-1, seed }. Salida: { img, changed, bounds } como inpaint.js. Límites: asíncrono; necesita el modelo (se descarga al usarlo).
   ═══════════════════════════════════════════════════════════════ */
import { dilateMask, boundsOf, featherBlend } from "./inpaint.js";
import { rng, gauss } from "./disrupt.js";

const N = 512;

export async function inpaintIA(img, mask, o){
  const w = img.width, h = img.height, out = new ImageData(new Uint8ClampedArray(img.data), w, h);
  const bin = new Uint8Array(w * h); let any = 0;
  for(let i = 0; i < bin.length; i++){ bin[i] = mask[i] > 127 ? 1 : 0; any |= bin[i]; }
  if(!any) return { img: out, changed: false, bounds: null };
  const grown = dilateMask(bin, w, h, Math.round(o.expand)), bb = boundsOf(grown, w, h);
  if(!bb) return { img: out, changed: false, bounds: null };

  // Recorte cuadrado con contexto
  const side = Math.min(Math.max(w, h), Math.max(384, Math.min(1024, Math.round(Math.max(bb.w, bb.h) * 2.5)))), sw = Math.min(side, w), sh = Math.min(side, h);
  const rx = Math.max(0, Math.min(w - sw, Math.round(bb.x + bb.w / 2 - sw / 2))), ry = Math.max(0, Math.min(h - sh, Math.round(bb.y + bb.h / 2 - sh / 2)));
  const src = document.createElement("canvas"); src.width = w; src.height = h; src.getContext("2d").putImageData(img, 0, 0);
  const inC = document.createElement("canvas"); inC.width = inC.height = N;
  const ix = inC.getContext("2d", { willReadFrequently: true }); ix.imageSmoothingQuality = "high"; ix.drawImage(src, rx, ry, sw, sh, 0, 0, N, N);
  const inRgba = ix.getImageData(0, 0, N, N).data, hole = new Uint8Array(N * N), kx = sw / N, ky = sh / N;
  for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
    const X0 = rx + Math.floor(x * kx), Y0 = ry + Math.floor(y * ky), X1 = Math.min(w - 1, rx + Math.floor((x + 1) * kx)), Y1 = Math.min(h - 1, ry + Math.floor((y + 1) * ky));
    let on = 0; for(let yy = Y0; yy <= Y1 && !on; yy++) for(let xx = X0; xx <= X1; xx++) if(grown[yy * w + xx]){ on = 1; break; }
    hole[y * N + x] = on;
  }
  const { rellenar } = await import("../../ai/relleno.js");
  const res = await rellenar(inRgba, hole, N, { title: "Rellenando la marca" });

  const oc = document.createElement("canvas"); oc.width = oc.height = N; oc.getContext("2d").putImageData(new ImageData(res.rgba, N, N), 0, 0);
  const up = document.createElement("canvas"); up.width = sw; up.height = sh;
  const ux = up.getContext("2d", { willReadFrequently: true }); ux.imageSmoothingQuality = "high"; ux.drawImage(oc, 0, 0, sw, sh);
  const fill = ux.getImageData(0, 0, sw, sh).data, d = img.data, od = out.data;

  // Grano de alta frecuencia del anillo (fuera del hueco) por canal
  const s2 = [0, 0, 0]; let cnt = 0;
  for(let y = ry + 1; y < ry + sh - 1; y += 2) for(let x = rx + 1; x < rx + sw - 1; x += 2){
    const p = y * w + x; if(grown[p]) continue; const i = p * 4;
    for(let c = 0; c < 3; c++){ const hp = d[i + c] - (d[i - 4 + c] + d[i + 4 + c] + d[i - w * 4 + c] + d[i + w * 4 + c]) / 4; s2[c] += hp * hp; }
    cnt++;
  }
  const ampliado = Math.min(1, Math.max(0, (sw / N - 0.8) / 1.5)), g = Math.max(0, Math.min(1, o.grain)) * (0.5 + 0.5 * ampliado);
  const sig = s2.map(v => cnt ? Math.sqrt(v / cnt) * g : 0), rand = rng((o.seed | 0) * 131 + 5);
  for(let y = 0; y < sh; y++) for(let x = 0; x < sw; x++){
    const p = (ry + y) * w + rx + x; if(!grown[p]) continue;
    const i = p * 4, j = (y * sw + x) * 4, n = gauss(rand);
    for(let c = 0; c < 3; c++) od[i + c] = Math.max(0, Math.min(255, fill[j + c] + n * sig[c]));
  }
  featherBlend(img, out, grown, w, h, bb, o.feather);
  return { img: out, changed: true, bounds: bb };
}
