/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · MÁSCARAS
   Cada foto puede llevar dos máscaras pintadas (lienzos pequeños; lo
   pintado tiene alfa > 0):
     · excluir: esa zona no se usa (gente que pasa, un coche…): no se
       buscan puntos de unión en ella y queda transparente al mezclar.
     · mantener: esa zona sale de ESTA foto aunque otras la cubran.
   Sin DOM más allá de los lienzos; las usa stitch.js.
   ═══════════════════════════════════════════════════════════════ */

const ctx2d = c => c.getContext("2d", { willReadFrequently: true });
const make = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

/** ¿Tiene algo pintado? */
export function hasInk(mask){
  if(!mask) return false;
  const d = ctx2d(mask).getImageData(0, 0, mask.width, mask.height).data;
  for(let i = 3; i < d.length; i += 4) if(d[i] > 8) return true;
  return false;
}

/** Copia de la foto con la zona excluida transparente (para mezclar). */
export function excludedCopy(photo, mask){
  const c = make(photo.width, photo.height), x = ctx2d(c);
  x.drawImage(photo, 0, 0);
  x.globalCompositeOperation = "destination-out";
  x.imageSmoothingQuality = "high";
  x.drawImage(mask, 0, 0, photo.width, photo.height);
  return c;
}

/** Copia de la foto con la zona excluida en gris liso (sin esquinas que detectar) para buscar puntos de unión. */
export function grayedCopy(photo, mask){
  const c = make(photo.width, photo.height), x = ctx2d(c), t = make(photo.width, photo.height), tx = ctx2d(t);
  x.drawImage(photo, 0, 0);
  tx.drawImage(mask, 0, 0, photo.width, photo.height);
  tx.globalCompositeOperation = "source-in"; tx.fillStyle = "#808080"; tx.fillRect(0, 0, t.width, t.height);
  x.drawImage(t, 0, 0);
  return c;
}

/** Lienzo del tamaño de la foto con alfa 255 donde está la máscara «mantener» (se lleva al mosaico igual que la foto). */
export function keepCanvas(width, height, mask){
  const c = make(width, height), x = ctx2d(c);
  x.drawImage(mask, 0, 0, width, height);
  const im = x.getImageData(0, 0, width, height), d = im.data;
  for(let i = 0; i < d.length; i += 4){ const on = d[i + 3] > 100; d[i] = d[i + 1] = d[i + 2] = on ? 255 : 0; d[i + 3] = on ? 255 : 0; }
  x.putImageData(im, 0, 0);
  return c;
}

/**
 * Lo que una foto debe conservar quita a las demás ese trozo del mosaico.
 * @param images  fotos ya colocadas [{ w, h, data, x, y, i }] (se modifican)
 * @param keeps   [{ i, image }]: `image` es la máscara «mantener» de la foto `i` colocada igual que ella
 */
export function applyKeep(images, keeps){
  for(const { i, image: k } of keeps) for(const im of images){
    if(im.i === i) continue;
    const x0 = Math.max(im.x, k.x), y0 = Math.max(im.y, k.y), x1 = Math.min(im.x + im.w, k.x + k.w), y1 = Math.min(im.y + im.h, k.y + k.h);
    for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++){
      if(k.data[((y - k.y) * k.w + (x - k.x)) * 4 + 3] > 127) im.data[((y - im.y) * im.w + (x - im.x)) * 4 + 3] = 0;
    }
  }
}
