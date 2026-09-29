/* ═══════════════════════════════════════════════════════════════
   CUENTAGOTAS DE BALANCE DE BLANCOS · piezas comunes
   Lo usan el plugin Balance de blancos y su capa de ajuste
   (js/editor/adjustments.js, adjustlayers.js), el revelador RAW
   (raw/ui.js, normal y Premium) y la Fusión HDR (hdr/ui.js). Cada uno
   resuelve su propio modelo de temperatura/tinte; aquí sólo están el
   icono y la media de un pequeño entorno de píxeles.
   ═══════════════════════════════════════════════════════════════ */

/** Icono de cuentagotas (trazo, hereda el color). */
export const PIPETTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/><path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"/><path d="m2 22 .414-.414"/></svg>';

/** Media RGB (0-255) de un cuadrado de lado 2·rad+1 centrado en (x, y)
    dentro de `data` (RGBA, w×h). `clipped` = más de la mitad de los
    píxeles con algún canal quemado. */
export function averageRGB(data, w, h, x, y, rad = 2){
  const s = [0, 0, 0]; let n = 0, clip = 0;
  for(let yy = Math.max(0, y - rad); yy <= Math.min(h - 1, y + rad); yy++)
    for(let xx = Math.max(0, x - rad); xx <= Math.min(w - 1, x + rad); xx++){
      const i = (yy * w + xx) * 4;
      s[0] += data[i]; s[1] += data[i + 1]; s[2] += data[i + 2]; n++;
      if(Math.max(data[i], data[i + 1], data[i + 2]) >= 250) clip++;
    }
  return { rgb: n ? s.map(v => v / n) : [0, 0, 0], clipped: clip * 2 > n };
}
