/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · CONTROL DE PLEGADOS
   Un campo no se pliega si el determinante del jacobiano de x → x + d(x) es positivo en todas las celdas. `limitar` reduce la
   amplitud (búsqueda binaria sobre un factor t) hasta que el menor determinante supera `minimo`, y avisa de que lo ha hecho.
   Entradas: campo y mínimo (0.15 por defecto). Salidas: { campo, escala, minDet, reducido }.
   Límites: sólo mira la rejilla; el campo de la rejilla es lo que se aplica, así que lo que se comprueba es lo que se ve.
   ═══════════════════════════════════════════════════════════════ */
import { escalarCampo } from "./field.js";

/* Menor determinante del campo multiplicado por t (t = 1: tal cual). */
export function minDet(c, t = 1){
  const { gw, gh, paso, dx, dy } = c; let m = Infinity;
  const k = t / (2 * paso);
  for(let j = 0; j < gh - 1; j++) for(let i = 0; i < gw - 1; i++){
    const a = j * gw + i, b = a + 1, d = a + gw, e = d + 1;
    const xx = (dx[b] + dx[e] - dx[a] - dx[d]) * k, xy = (dx[d] + dx[e] - dx[a] - dx[b]) * k;
    const yx = (dy[b] + dy[e] - dy[a] - dy[d]) * k, yy = (dy[d] + dy[e] - dy[a] - dy[b]) * k;
    const det = (1 + xx) * (1 + yy) - xy * yx;
    if(det < m) m = det;
  }
  return m;
}

export function limitar(c, minimo = 0.15){
  const m0 = minDet(c, 1);
  if(m0 >= minimo) return { campo: c, escala: 1, minDet: m0, reducido: false };
  let lo = 0, hi = 1;                                   // en t = 0 el campo es la identidad (det = 1)
  for(let k = 0; k < 24; k++){ const mid = (lo + hi) / 2; if(minDet(c, mid) >= minimo) lo = mid; else hi = mid; }
  return { campo: escalarCampo(c, lo), escala: lo, minDet: minDet(c, lo), reducido: true };
}
