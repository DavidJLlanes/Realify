/* ═══════════════════════════════════════════════════════════════
   EFECTO COLOR · MOTOR DE PÍXELES (puro, sin DOM)
   Exposición (pasos de luz), contraste, saturación, temperatura y tinte sobre un RGBA de 8 bits. Todo por tablas de 256 valores (exposición y contraste) y una pasada por píxel
   (saturación y balance). Entradas: Uint8ClampedArray RGBA y params { exposicion:-2..2, contraste:-100..100, saturacion:-100..100, temperatura:-100..100, tinte:-100..100 }.
   Salida: modifica el array y lo devuelve. Con todo a 0 no toca nada. Límite: trabaja en el espacio del vídeo (sRGB), sin luz lineal.
   ═══════════════════════════════════════════════════════════════ */
export const POR_DEFECTO = { exposicion: 0, contraste: 0, saturacion: 0, temperatura: 0, tinte: 0 };
const neutro = p => !p.exposicion && !p.contraste && !p.saturacion && !p.temperatura && !p.tinte;

export function tablaTono({ exposicion = 0, contraste = 0 }){
  const t = new Uint8ClampedArray(256), g = 2 ** exposicion, c = 1 + contraste / 100 * (contraste > 0 ? 1.5 : 0.9);
  for(let i = 0; i < 256; i++){
    const lin = Math.pow(i / 255, 2.2) * g, v = Math.pow(Math.min(1, Math.max(0, lin)), 1 / 2.2);
    t[i] = Math.round(255 * Math.min(1, Math.max(0, (v - 0.5) * c + 0.5)));
  }
  return t;
}

export function aplicarColor(d, params){
  const p = { ...POR_DEFECTO, ...params }; if(neutro(p)) return d;
  const t = tablaTono(p), s = 1 + p.saturacion / 100, kr = 1 + p.temperatura / 100 * 0.25, kb = 1 - p.temperatura / 100 * 0.25, kg = 1 - p.tinte / 100 * 0.15;
  const sat = p.saturacion !== 0, bal = p.temperatura !== 0 || p.tinte !== 0;
  for(let i = 0; i < d.length; i += 4){
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if(bal){ r *= kr; g *= kg; b *= kb; }
    r = t[r > 255 ? 255 : r]; g = t[g > 255 ? 255 : g]; b = t[b > 255 ? 255 : b];
    if(sat){ const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return d;
}
