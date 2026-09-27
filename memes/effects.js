/* ═══════════════════════════════════════════════════════════════
   MEMES · EFECTO DE IMAGEN
   Retoques de la foto propios de los memes. `amount` 0-100. Todo se
   hace píxel a píxel (no depende de `ctx.filter`, que no todos los
   navegadores aplican en el lienzo), salvo el desenfoque, que usa la
   reducción y ampliación del propio lienzo. El ruido del «frito» sale
   de un generador con semilla: la vista previa y el resultado dan el
   mismo grano.
   ═══════════════════════════════════════════════════════════════ */

export const EFFECTS = [
  ["none", "Ninguno"], ["deepfried", "Frito (deep fried)"], ["bw", "Blanco y negro"], ["sepia", "Sepia"],
  ["vignette", "Viñeta"], ["contrast", "Alto contraste"], ["saturate", "Colores vivos"], ["fade", "Desvaído"],
  ["blur", "Desenfocado"], ["pixel", "Pixelado"], ["invert", "Negativo"], ["jpeg", "JPEG destrozado"]
];

const make = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

function hashNoise(x, y){
  let n = (Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) & 255) / 255 - .5;
}

/* JPEG a muy baja calidad (asíncrono) */
async function crunch(canvas, quality){
  const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
  if(!blob) return canvas;
  const bmp = await createImageBitmap(blob);
  const c = make(canvas.width, canvas.height); c.getContext("2d").drawImage(bmp, 0, 0); bmp.close?.();
  return c;
}

/**
 * Devuelve un lienzo nuevo con el efecto aplicado a `src` (del tamaño
 * `w`×`h`). `unit` = píxeles de destino por píxel real de la foto,
 * para que el pixelado y el desenfoque midan lo mismo en la vista
 * previa y en el resultado.
 */
export async function applyEffect(src, w, h, effect, amount, unit = 1){
  const out = make(w, h), x = out.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  const t = amount / 100;
  if(effect === "none" || t <= 0){ x.drawImage(src, 0, 0, w, h); return out; }
  const big = Math.max(w, h) / unit;   // lado mayor real de la foto

  if(effect === "blur" || effect === "pixel"){
    const k = effect === "blur" ? Math.max(1, 1 + t * 40) : Math.max(1, big * (.004 + t * .03));
    const sw = Math.max(1, Math.round(w / (k * unit))), sh = Math.max(1, Math.round(h / (k * unit)));
    const small = make(sw, sh), sx = small.getContext("2d");
    sx.imageSmoothingQuality = "high"; sx.drawImage(src, 0, 0, sw, sh);
    x.imageSmoothingEnabled = effect === "blur";
    x.drawImage(small, 0, 0, w, h);
    return out;
  }

  x.drawImage(src, 0, 0, w, h);
  const img = x.getImageData(0, 0, w, h), d = img.data;
  const noiseScale = 1 / unit;
  for(let yy = 0, i = 0; yy < h; yy++) for(let xx = 0; xx < w; xx++, i += 4){
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = .299 * r + .587 * g + .114 * b;
    switch(effect){
      case "bw": r += (l - r) * t; g += (l - g) * t; b += (l - b) * t; break;
      case "sepia": { const sr = l * 1.07 + 20, sg = l * .88 + 8, sb = l * .66; r += (sr - r) * t; g += (sg - g) * t; b += (sb - b) * t; break; }
      case "contrast": { const k = 1 + t * 1.2; r = (r - 128) * k + 128; g = (g - 128) * k + 128; b = (b - 128) * k + 128; break; }
      case "saturate": { const k = 1 + t * 1.3; r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k; break; }
      case "fade": { const k = t * .35; r = r * (1 - k) + 60 * k + 40 * k; g = g * (1 - k) + 55 * k + 40 * k; b = b * (1 - k) + 50 * k + 45 * k; const s = 1 - t * .4; const nl = .299 * r + .587 * g + .114 * b; r = nl + (r - nl) * s; g = nl + (g - nl) * s; b = nl + (b - nl) * s; break; }
      case "invert": r += (255 - 2 * r) * t; g += (255 - 2 * g) * t; b += (255 - 2 * b) * t; break;
      case "vignette": { const dx = (xx / w - .5) * 2, dy = (yy / h - .5) * 2, e = Math.min(1, (dx * dx + dy * dy) / 2); const k = 1 - t * .85 * e * e; r *= k; g *= k; b *= k; break; }
      case "deepfried": {
        const k = 1 + t * 1.8, s = 1 + t * 2.2;
        let rr = (r - 128) * k + 128 + 20 * t, gg = (g - 128) * k + 128, bb = (b - 128) * k + 128 - 25 * t;
        const nl = .299 * rr + .587 * gg + .114 * bb;
        rr = nl + (rr - nl) * s; gg = nl + (gg - nl) * s; bb = nl + (bb - nl) * s;
        const n = hashNoise(Math.floor(xx * noiseScale), Math.floor(yy * noiseScale)) * 90 * t;
        r = rr + n; g = gg + n; b = bb + n; break;
      }
      default: break;
    }
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
  x.putImageData(img, 0, 0);
  if(effect === "deepfried") return crunch(out, Math.max(.03, .5 - t * .45));
  if(effect === "jpeg"){
    let c = out;
    for(let i = 0; i < 1 + Math.round(t * 3); i++) c = await crunch(c, Math.max(.02, .25 - t * .23));
    return c;
  }
  return out;
}
