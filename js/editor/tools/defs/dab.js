/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS DE PINTURA · ayudas de pincelada
   stampGradient (estampa un punto con degradado de dureza) y spacedSteps (reparte puntos a distancia fija a lo largo de un trazo).
   ═══════════════════════════════════════════════════════════════ */

/* ═══ pincel ═══
   Un pincel de verdad no es un círculo duro: tiene un borde con
   caída. Se consigue con un degradado radial cuyo punto de parada
   depende de la dureza. Y para que el trazo sea continuo aunque el
   ratón dé saltos, se interpolan sellos entre la posición anterior y
   la nueva, separados una fracción del diámetro. */
export function stampGradient(ctx, x, y, r, color, hardness){
  const inner = Math.max(0, Math.min(0.98, hardness / 100));
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.length === 7 ? color + "00" : color);
  return g;
}

/* Reparte puntos a lo largo de un segmento con un paso FIJO,
   arrastrando entre llamadas lo que sobre del segmento anterior —el
   mecanismo de «espaciado» de cualquier motor de pinceles—.

   Imprescindible para un efecto que se ACUMULA en cada pasada, como
   aclarar/oscurecer, a diferencia de repintar un color opaco, que es
   indiferente a cuántas veces se repita encima. Sin arrastrar el
   sobrante, cada llamada independiente redondeaba hacia arriba a «al
   menos un punto» sobre SU tramo, así que un trazo lento —que dispara
   muchos más eventos de movimiento sobre la misma distancia física
   que uno rápido— acababa aplicando muchos más puntos, y por tanto un
   efecto mucho más fuerte, sin que la velocidad del gesto tuviera que
   ver nada con el resultado que se busca. */
export function spacedSteps(x0, y0, x1, y1, step, carry = 0){
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const points = [];
  if(dist > 0){
    const ux = dx / dist, uy = dy / dist;
    let avail = carry + dist, along = -carry;
    while(avail >= step){
      along += step;
      points.push({ x: x0 + ux * along, y: y0 + uy * along });
      avail -= step;
    }
    carry = avail;
  }
  return { points, carry };
}
