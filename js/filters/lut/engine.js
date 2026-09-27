/* ═══════════════════════════════════════════════════════════════
   TABLAS DE COLOR (.cube)
   Carga una LUT de las que usa cualquier programa de etalonaje y la
   aplica a la capa. Reproducir a mano con curvas el aspecto de una
   película concreta es trabajo de horas; la tabla ya lo trae resuelto
   y además es exactamente la misma que se usó en el rodaje.

   El formato es el de Adobe/IRIDAS, texto plano:

     TITLE "lo que sea"        · opcional
     LUT_3D_SIZE 33            · o LUT_1D_SIZE
     DOMAIN_MIN 0 0 0          · opcional, por defecto 0
     DOMAIN_MAX 1 1 1          · opcional, por defecto 1
     0.0 0.0 0.0               · size³ filas (o size, si es 1D)
     ...

   En una tabla 3D el índice ROJO es el que corre más rápido, luego el
   verde y por último el azul. Equivocar ese orden no rompe nada de
   forma visible —sigue saliendo una imagen— pero intercambia los ejes
   del color, así que conviene dejarlo dicho.
   ═══════════════════════════════════════════════════════════════ */

/**
 * @param {string} text contenido del .cube
 * @returns {{size:number, dim:1|3, min:number[], max:number[], data:Float32Array}}
 */
export function parseCube(text){
  if(typeof text !== "string" || !text.trim()) throw new Error("El archivo está vacío.");
  let size = 0, dim = 0;
  const min = [0, 0, 0], max = [1, 1, 1];
  const table = [];

  for(const raw of text.split(/\r?\n/)){
    const line = raw.trim();
    if(!line || line.startsWith("#")) continue;

    const upper = line.toUpperCase();
    if(upper.startsWith("TITLE")) continue;
    if(upper.startsWith("LUT_3D_SIZE") || upper.startsWith("LUT_1D_SIZE")){
      const n = Number(line.split(/\s+/)[1]);
      if(!Number.isInteger(n) || n < 2 || n > 256) throw new Error(`Tamaño de tabla no válido: ${n}`);
      size = n; dim = upper.startsWith("LUT_3D_SIZE") ? 3 : 1;
      continue;
    }
    if(upper.startsWith("DOMAIN_MIN") || upper.startsWith("DOMAIN_MAX")){
      const v = line.split(/\s+/).slice(1, 4).map(Number);
      if(v.length !== 3 || v.some(x => !Number.isFinite(x))) throw new Error("DOMAIN inválido.");
      (upper.startsWith("DOMAIN_MIN") ? min : max).splice(0, 3, ...v);
      continue;
    }

    const parts = line.split(/\s+/);
    if(parts.length !== 3) continue;              // línea desconocida: se ignora
    const rgb = parts.map(Number);
    if(rgb.some(x => !Number.isFinite(x))) throw new Error(`Valor no numérico: «${line}»`);
    table.push(rgb[0], rgb[1], rgb[2]);
  }

  if(!dim) throw new Error("Falta LUT_3D_SIZE o LUT_1D_SIZE: no parece un .cube.");
  const expected = (dim === 3 ? size ** 3 : size) * 3;
  if(table.length !== expected){
    throw new Error(`La tabla dice ${size} pero trae ${table.length / 3} entradas en vez de ${expected / 3}.`);
  }
  if(max.some((m, i) => m <= min[i])) throw new Error("DOMAIN_MAX debe ser mayor que DOMAIN_MIN.");
  return { size, dim, min, max, data: Float32Array.from(table) };
}

/* Interpolación trilineal: el color de entrada cae casi siempre entre
   ocho nodos de la rejilla, y tomar el más cercano produce escalones
   visibles en los degradados —justo donde una LUT se nota—. */
function sample3D(lut, r, g, b, out){
  const n = lut.size, last = n - 1, d = lut.data;
  const fr = r * last, fg = g * last, fb = b * last;
  const r0 = Math.min(last, Math.floor(fr)), g0 = Math.min(last, Math.floor(fg)), b0 = Math.min(last, Math.floor(fb));
  const r1 = Math.min(last, r0 + 1), g1 = Math.min(last, g0 + 1), b1 = Math.min(last, b0 + 1);
  const dr = fr - r0, dg = fg - g0, db = fb - b0;

  // Índice con el rojo corriendo más rápido.
  const at = (ri, gi, bi) => (ri + gi * n + bi * n * n) * 3;
  const c000 = at(r0,g0,b0), c100 = at(r1,g0,b0), c010 = at(r0,g1,b0), c110 = at(r1,g1,b0);
  const c001 = at(r0,g0,b1), c101 = at(r1,g0,b1), c011 = at(r0,g1,b1), c111 = at(r1,g1,b1);

  for(let k = 0; k < 3; k++){
    const x00 = d[c000+k] + (d[c100+k] - d[c000+k]) * dr;
    const x10 = d[c010+k] + (d[c110+k] - d[c010+k]) * dr;
    const x01 = d[c001+k] + (d[c101+k] - d[c001+k]) * dr;
    const x11 = d[c011+k] + (d[c111+k] - d[c011+k]) * dr;
    const y0 = x00 + (x10 - x00) * dg;
    const y1 = x01 + (x11 - x01) * dg;
    out[k] = y0 + (y1 - y0) * db;
  }
}

function sample1D(lut, r, g, b, out){
  const n = lut.size, last = n - 1, d = lut.data;
  const one = (v, k) => {
    const f = v * last, i0 = Math.min(last, Math.floor(f)), i1 = Math.min(last, i0 + 1), t = f - i0;
    return d[i0*3+k] + (d[i1*3+k] - d[i0*3+k]) * t;
  };
  out[0] = one(r, 0); out[1] = one(g, 1); out[2] = one(b, 2);
}

/**
 * Aplica la tabla sobre píxeles RGBA en sitio.
 * @param {Uint8ClampedArray} data
 * @param {object} lut resultado de parseCube
 * @param {number} intensity 0..100; por debajo de 100 se mezcla con el original
 */
export function applyCubeLut(data, lut, intensity = 100){
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  if(!lut || t === 0) return data;
  const [minR, minG, minB] = lut.min;
  const spanR = lut.max[0] - minR, spanG = lut.max[1] - minG, spanB = lut.max[2] - minB;
  const sample = lut.dim === 3 ? sample3D : sample1D;
  const out = [0, 0, 0];
  const unit = v => v < 0 ? 0 : v > 1 ? 1 : v;

  for(let i = 0; i < data.length; i += 4){
    // Al dominio de la tabla, y de vuelta a 0..1 para indexarla.
    const r = unit((data[i]   / 255 - minR) / spanR);
    const g = unit((data[i+1] / 255 - minG) / spanG);
    const b = unit((data[i+2] / 255 - minB) / spanB);
    sample(lut, r, g, b, out);
    data[i]   = data[i]   + (unit(out[0]) * 255 - data[i])   * t;
    data[i+1] = data[i+1] + (unit(out[1]) * 255 - data[i+1]) * t;
    data[i+2] = data[i+2] + (unit(out[2]) * 255 - data[i+2]) * t;
  }
  return data;
}
