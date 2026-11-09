/* ═══════════════════════════════════════════════════════════════
   PINCELES DE RETOQUE · exponer, esponja y dedo
   Operaciones de píxeles de un toque del pincel (sin DOM de interfaz): quemar/aclarar, desaturar/saturar y manchar. Entradas: contexto,
   centro, radio, dureza y fuerza. Salida: modifican el lienzo.
   ═══════════════════════════════════════════════════════════════ */

/* ── sobreexponer y subexponer ────────────────────────────────
   Aclara u oscurece respetando el tono, y con distinta fuerza según
   la zona: la de sombras apenas toca las luces y al revés. Es cómo
   funcionaban las manos y los cartones bajo la ampliadora. */
export function dodgeBurn(ctx, x, y, radius, hardness, amount, mode, range){
  const r = Math.ceil(radius);
  const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
  const x1 = Math.min(ctx.canvas.width,  Math.ceil(x + r));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(y + r));
  const w = x1 - x0, h = y1 - y0;
  if(w <= 0 || h <= 0) return;

  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const inner = Math.max(0, Math.min(0.98, hardness / 100));
  const sign = mode === "dodge" ? 1 : -1;

  for(let py = 0; py < h; py++){
    for(let px = 0; px < w; px++){
      const dx = (x0 + px) - x, dy = (y0 + py) - y;
      const dist = Math.hypot(dx, dy) / radius;
      if(dist > 1) continue;
      // Caída del pincel
      let fall = dist <= inner ? 1 : 1 - (dist - inner) / (1 - inner);
      const i = (py * w + px) * 4;
      const lum = (d[i]*0.2126 + d[i+1]*0.7152 + d[i+2]*0.0722) / 255;
      // Peso por zona tonal
      const zw = range === "shadows"    ? Math.pow(1 - lum, 2)
               : range === "highlights" ? Math.pow(lum, 2)
               :                          1 - Math.abs(lum - 0.5) * 1.4;
      const k = sign * (amount / 100) * fall * Math.max(0, zw) * 0.5;
      if(k === 0 && mode !== "spongeSat" && mode !== "spongeDesat") continue;
      if(mode === "spongeSat" || mode === "spongeDesat"){
        const gray=(d[i]+d[i+1]+d[i+2])/3;
        const satK=(amount/100)*fall*.55*(mode === "spongeSat" ? 1 : -1);
        for(let c=0;c<3;c++) d[i+c]=Math.max(0,Math.min(255,gray+(d[i+c]-gray)*(1+satK)));
        continue;
      }
      for(let c = 0; c < 3; c++){
        const v = d[i+c] / 255;
        // Aclarar tira hacia el blanco y oscurecer hacia el negro, en
        // vez de sumar: sumar quema las luces y empasta las sombras.
        const nv = k > 0 ? v + (1 - v) * k : v * (1 + k);
        d[i+c] = Math.max(0, Math.min(255, nv * 255));
      }
    }
  }
  ctx.putImageData(img, x0, y0);
}

/* ── esponja ──────────────────────────────────────────────────
   Quita o da color sólo donde se pasa el pincel, sin tocar la luz: cada
   píxel se acerca a su propio gris (luminancia Rec. 709) o se aleja de
   él. Desaturar tira hacia el gris en proporción a la fuerza (a 100 %
   un solo toque lo deja gris); saturar protege lo que ya es muy vivo
   para no quemar el color. Entradas: contexto, centro, radio, dureza,
   fuerza 1-100 y modo "desat" | "sat". Salida: modifica el lienzo. */
export function sponge(ctx, x, y, radius, hardness, amount, mode){
  const r = Math.ceil(radius);
  const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(x + r)), y1 = Math.min(ctx.canvas.height, Math.ceil(y + r));
  const w = x1 - x0, h = y1 - y0;
  if(w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x0, y0, w, h), d = img.data;
  const inner = Math.max(0, Math.min(0.98, hardness / 100)), k0 = Math.min(1, amount / 100);
  for(let py = 0; py < h; py++) for(let px = 0; px < w; px++){
    const dist = Math.hypot(x0 + px - x, y0 + py - y) / radius;
    if(dist > 1) continue;
    const fall = dist <= inner ? 1 : 1 - (dist - inner) / (1 - inner), i = (py * w + px) * 4;
    if(!d[i + 3]) continue;
    const gray = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
    let f;
    if(mode === "sat"){
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), vivo = mx ? (mx - mn) / mx : 0;
      f = 1 + k0 * fall * (1 - vivo * 0.8) * 0.6;
    } else f = 1 - k0 * fall;
    for(let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, gray + (d[i + c] - gray) * f));
  }
  ctx.putImageData(img, x0, y0);
}

/* ── emborronar ───────────────────────────────────────────────
   Arrastra el color como un dedo sobre pintura fresca: se guarda lo
   que había bajo el pincel y se va mezclando con lo que hay delante
   según avanza. */
export function makeSmudge(ctx, radius, hardness, strength){
  const r = Math.ceil(radius);
  const size = r * 2;
  let carried = null;

  return {
    step(x, y){
      const x0 = Math.round(x - r), y0 = Math.round(y - r);
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      const sx = Math.max(0, x0), sy = Math.max(0, y0);
      const ex = Math.min(cw, x0 + size), ey = Math.min(ch, y0 + size);
      const w = ex - sx, h = ey - sy;
      if(w <= 0 || h <= 0) return;

      const img = ctx.getImageData(sx, sy, w, h);
      const d = img.data;

      if(!carried){
        carried = new Float32Array(d.length);
        for(let i = 0; i < d.length; i++) carried[i] = d[i];
        carried.w = w; carried.h = h;
        return;
      }

      const inner = Math.max(0, Math.min(0.98, hardness / 100));
      const s = strength / 100;
      const cx = x - sx, cy = y - sy;

      for(let py = 0; py < h; py++){
        for(let px = 0; px < w; px++){
          const dist = Math.hypot(px - cx, py - cy) / radius;
          if(dist > 1) continue;
          const fall = dist <= inner ? 1 : 1 - (dist - inner) / (1 - inner);
          const k = fall * s;
          const i = (py * w + px) * 4;
          const j = (py * (carried.w || w) + px) * 4;
          if(j + 3 >= carried.length) continue;
          for(let c = 0; c < 4; c++){
            const mixed = d[i+c] * (1 - k) + carried[j+c] * k;
            d[i+c] = mixed;
            // Lo que se lleva el dedo también se va contaminando
            carried[j+c] = carried[j+c] * (1 - k * 0.5) + mixed * (k * 0.5);
          }
        }
      }
      ctx.putImageData(img, sx, sy);
    },
    reset(){ carried = null; }
  };
}
