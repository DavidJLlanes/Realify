/* ═══════════════════════════════════════════════════════════════
   AI-KIT · PEGAR UN RECORTE RETOCADO
   Los editores de cara y de cuerpo trabajan sobre un recorte de la foto, a veces reducido (escala k < 1). Aquí se devuelve a la foto:
   con k = 1 se pegan los píxeles; con k < 1 se suma sólo la diferencia (resultado − original, ambos escalados al tamaño real), para no
   emborronar el resto del recorte. Entradas: lienzo destino a tamaño de la foto, recorte { x, y, w, h, k, W, H }, ImageData original
   del recorte y ImageData resultado. Salida: nada (modifica el lienzo).
   ═══════════════════════════════════════════════════════════════ */
export function pegarRecorte(dest, crop, original, out){
  const dx = dest.getContext("2d", { willReadFrequently: true });
  if(crop.k === 1){ dx.putImageData(out, crop.x, crop.y); return; }
  const grande = img => { const c = document.createElement("canvas"); c.width = crop.W; c.height = crop.H; c.getContext("2d").putImageData(img, 0, 0);
    const g = document.createElement("canvas"); g.width = crop.w; g.height = crop.h; const gx = g.getContext("2d", { willReadFrequently: true });
    gx.imageSmoothingQuality = "high"; gx.drawImage(c, 0, 0, crop.w, crop.h); return gx.getImageData(0, 0, crop.w, crop.h).data; };
  const a = grande(out), o = grande(original), reg = dx.getImageData(crop.x, crop.y, crop.w, crop.h), d = reg.data;
  for(let i = 0; i < d.length; i += 4) for(let c = 0; c < 3; c++) d[i + c] += a[i + c] - o[i + c];
  dx.putImageData(reg, crop.x, crop.y);
}
