/* ═══════════════════════════════════════════════════════════════
   STICKERS · DIBUJO
   Un sticker se compone en un lienzo propio («sprite») a partir de
   su imagen: giro y volteo, el borde blanco de pegatina y, al final,
   la sombra —siempre hacia abajo, gire como gire el sticker—. La
   vista previa y el resultado usan exactamente la misma función; sólo
   cambia la escala (píxeles de pantalla o píxeles de la imagen).
   ═══════════════════════════════════════════════════════════════ */

const make = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

/**
 * `st`: { size, rot (grados), flipX, flipY, outline (0-100), shadow (0-100) }.
 * `scale`: píxeles de destino por píxel de imagen.
 * Devuelve { canvas, w, h } con el sticker centrado en el lienzo.
 */
export function buildSprite(img, st, scale = 1){
  const s = Math.max(2, st.size * scale);
  const border = st.outline > 0 ? s * 0.055 * st.outline / 100 : 0;
  const a = st.rot * Math.PI / 180, cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
  const side = s + border * 2, box = side * (cos + sin) + 2;

  // 1) Imagen girada y volteada (y su silueta dilatada para el borde)
  const body = make(box, box), bx = body.getContext("2d");
  bx.imageSmoothingQuality = "high";
  const place = (ctx, dx = 0, dy = 0) => {
    ctx.save();
    ctx.translate(box / 2 + dx, box / 2 + dy); ctx.rotate(a); ctx.scale(st.flipX ? -1 : 1, st.flipY ? -1 : 1);
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
  };
  if(border > 0){
    const steps = Math.max(12, Math.min(36, Math.round(border * 1.5)));
    for(let i = 0; i < steps; i++){ const t = i / steps * Math.PI * 2; place(bx, Math.cos(t) * border, Math.sin(t) * border); }
    bx.globalCompositeOperation = "source-in";
    bx.fillStyle = "#fff"; bx.fillRect(0, 0, box, box);
    bx.globalCompositeOperation = "source-over";
  }
  place(bx);
  if(!(st.shadow > 0)) return { canvas: body, w: body.width, h: body.height };

  // 2) Sombra suave debajo, desplazada hacia abajo
  const blur = s * 0.07 * st.shadow / 100, dy = s * 0.045 * st.shadow / 100, pad = blur * 2 + dy;
  const out = make(box + pad * 2, box + pad * 2), ox = out.getContext("2d");
  ox.shadowColor = `rgba(0,0,0,${0.2 + 0.35 * st.shadow / 100})`;
  ox.shadowBlur = blur; ox.shadowOffsetY = dy;
  ox.drawImage(body, pad, pad);
  body.width = body.height = 1;
  return { canvas: out, w: out.width, h: out.height };
}

/** Dibuja el sprite centrado en (x, y) —coordenadas del destino—. */
export function drawSprite(ctx, sprite, x, y, opacity = 100){
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity / 100));
  ctx.drawImage(sprite.canvas, x - sprite.w / 2, y - sprite.h / 2);
  ctx.restore();
}
