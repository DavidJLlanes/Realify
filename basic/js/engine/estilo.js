/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · ESTILO
   Aplica un look prediseñado de Realify (js/filters/looks/catalog.js: curvas por canal, saturación y virado) a la imagen y lo mezcla
   con el original según la intensidad. Es la primera etapa de la cadena, así que los ajustes de Ajustar trabajan encima del estilo.
   Entradas: cargarEstilos() (async, una vez) · pasoEstilo(datos RGBA, { _e: posición + 1, _k: intensidad 0–100 }).
   Salidas: catálogo { LOOKS, LOOK_CATS } tras cargarEstilos(); pasoEstilo modifica los datos en su sitio.
   Límites: sin DOM. El catálogo (≈ 100 KB) se carga sólo al elegir un estilo o abrir uno guardado.
   ═══════════════════════════════════════════════════════════════ */
let cat = null;

export async function cargarEstilos() { return (cat ||= await import("../../../js/filters/looks/catalog.js")); }

export function pasoEstilo(d, a) {
  const look = cat?.LOOKS[a._e - 1], t = Math.max(0, Math.min(1, a._k / 100));
  if (!look || !t) return;
  const orig = t < 1 ? new Uint8ClampedArray(d) : null;
  cat.applyLook(d, look);
  if (orig) for (let i = 0; i < d.length; i += 4) {
    d[i] = orig[i] + (d[i] - orig[i]) * t; d[i + 1] = orig[i + 1] + (d[i + 1] - orig[i + 1]) * t; d[i + 2] = orig[i + 2] + (d[i + 2] - orig[i + 2]) * t;
  }
}
