/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR PARTES · MOTOR (puro, sin DOM)
   Compone la máscara de una parte a tamaño del documento a partir de las máscaras por persona (cada una a la resolución de su
   caja): interpolación bilineal, unión de las personas elegidas y borde suave (smoothstep alrededor de 0,5).
   Entradas: personas (de js/ai/people/analyze.js), { parte, persona: "todas" | índice, suavidad 0-100 % }, W, H.
   Salida: { mask: Uint8ClampedArray(W×H) 0-255, cubierto: fracción 0-1 con valor > 50 % }.
   ═══════════════════════════════════════════════════════════════ */

const smooth = (v, soft) => {
  const a = 0.5 - soft, b = 0.5 + soft;
  if(v <= a) return 0; if(v >= b) return 1;
  const t = (v - a) / (b - a); return t * t * (3 - 2 * t);
};

export function composeParts(personas, { parte, persona = "todas", suavidad = 10 }, W, H){
  const mask = new Uint8ClampedArray(W * H), soft = Math.max(0.01, suavidad / 100 * 0.45);
  let cubierto = 0;
  personas.forEach((p, i) => {
    if(persona !== "todas" && String(i) !== String(persona)) return;
    const part = p.partes, m = part && part.mascaras[parte];
    if(!m) return;
    const { caja, w, h } = part;
    const x0 = Math.max(0, Math.floor(caja.x)), x1 = Math.min(W, Math.ceil(caja.x + caja.w));
    const y0 = Math.max(0, Math.floor(caja.y)), y1 = Math.min(H, Math.ceil(caja.y + caja.h));
    for(let Y = y0; Y < y1; Y++){
      const fy = Math.min(h - 1.001, Math.max(0, (Y + 0.5 - caja.y) / caja.h * h - 0.5)), a = fy | 0, ty = fy - a;
      for(let X = x0; X < x1; X++){
        const fx = Math.min(w - 1.001, Math.max(0, (X + 0.5 - caja.x) / caja.w * w - 0.5)), b = fx | 0, tx = fx - b;
        const v = ((m[a * w + b] * (1 - tx) + m[a * w + b + 1] * tx) * (1 - ty) + (m[(a + 1) * w + b] * (1 - tx) + m[(a + 1) * w + b + 1] * tx) * ty) / 255;
        const o = Y * W + X, r = Math.round(smooth(v, soft) * 255);
        if(r > mask[o]) mask[o] = r;
      }
    }
  });
  for(let i = 0; i < mask.length; i += 5) if(mask[i] > 127) cubierto++;
  return { mask, cubierto: cubierto * 5 / mask.length };
}
