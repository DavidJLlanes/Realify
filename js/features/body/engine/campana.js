/* Ponderación suave de un mando a lo largo de una parte: 1 en el centro `c` (0-1 del eje) y 0 fuera de `a`. Puro. */
export const campana = (t, c, a) => { const d = Math.abs(t - c) / a; return d >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * d)); };
