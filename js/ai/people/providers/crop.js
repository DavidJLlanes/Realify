/* ═══════════════════════════════════════════════════════════════
   PERSONAS · RECORTES PARA LOS MODELOS
   Saca de la foto un recorte de tamaño fijo, centrado, girado y a escala, y sabe devolver los puntos del recorte a la foto.
   Entradas: lienzo `source`, centro (cx, cy), tamaño del área en la foto (w, h), ángulo (rad) y tamaño de salida.
   Salidas: cropRgba → { rgba, map(u, v) → [x, y] }; letterbox → recorte con relleno gris que conserva la proporción.
   ═══════════════════════════════════════════════════════════════ */

/** Recorte de w×h (en píxeles de la foto) centrado en (cx, cy) y girado `ang`, escalado a outW×outH. */
export function cropRgba(source, cx, cy, w, h, ang, outW, outH, fill = "#808080"){
  const c = document.createElement("canvas"); c.width = outW; c.height = outH;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = fill; x.fillRect(0, 0, outW, outH);
  x.imageSmoothingQuality = "high";
  x.translate(outW / 2, outH / 2); x.scale(outW / w, outH / h); x.rotate(-ang); x.translate(-cx, -cy);
  x.drawImage(source, 0, 0);
  const cos = Math.cos(ang), sin = Math.sin(ang);
  return {
    rgba: x.getImageData(0, 0, outW, outH).data,
    map: (u, v) => {
      const dx = (u / outW - 0.5) * w, dy = (v / outH - 0.5) * h;
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
    }
  };
}

/** Caja {x,y,w,h} de la foto dentro de un cuadrado S×S, centrada y sin deformar. Devuelve el recorte y la zona útil del cuadrado. */
export function letterbox(source, box, S){
  const k = S / Math.max(box.w, box.h), uw = box.w * k, uh = box.h * k, ox = (S - uw) / 2, oy = (S - uh) / 2;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const r = cropRgba(source, cx, cy, S / k, S / k, 0, S, S);
  return { rgba: r.rgba, ox, oy, uw, uh, k };
}

/** Caja de la persona a partir de su cara (cabeza, hombros y cuerpo entero hasta el borde de la foto si cabe), con margen. */
export function bodyBoxFromFace(f, imgW, imgH){
  const w = f.w * 4.4, x0 = Math.max(0, f.x + f.w / 2 - w / 2), x1 = Math.min(imgW, f.x + f.w / 2 + w / 2);
  const y0 = Math.max(0, f.y - f.h * 0.6), y1 = Math.min(imgH, f.y + f.h * 7.2);
  return { x: x0, y: y0, w: Math.max(8, x1 - x0), h: Math.max(8, y1 - y0) };
}

/** Caja que envuelve los puntos de pose confiables (con margen proporcional). */
export function boxFromKeypoints(pts, imgW, imgH, margin = 0.15, minConf = 0.3){
  const v = pts.filter(p => p[2] >= minConf);
  if(v.length < 4) return null;
  const xs = v.map(p => p[0]), ys = v.map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const mx = (x1 - x0) * margin, my = (y1 - y0) * margin;
  x0 = Math.max(0, x0 - mx); x1 = Math.min(imgW, x1 + mx); y0 = Math.max(0, y0 - my * 1.5); y1 = Math.min(imgH, y1 + my);
  return { x: x0, y: y0, w: Math.max(8, x1 - x0), h: Math.max(8, y1 - y0) };
}
