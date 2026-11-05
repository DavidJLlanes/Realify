/* ═══════════════════════════════════════════════════════════════
   PERSONAS · PROVEEDOR · PUNTOS DE LA CARA
   Para cada cara de YuNet: recorte girado (ojos en horizontal) con margen, MediaPipe Face Landmarker y vuelta a la foto.
   Salida: [{ cara: índice, puntos: [[x, y, z]×478] (píxeles de la foto), presencia }].
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "../../runtime.js";
import { cropRgba } from "./crop.js";

export async function landmarksProvider({ source, caras, quality, signal }){
  const out = [];
  for(let i = 0; i < caras.length; i++){
    if(signal && signal.aborted) throw new DOMException("Análisis cancelado", "AbortError");
    const f = caras[i], [e0, e1] = f.eyes;
    const ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]);
    const side = Math.max(f.w, f.h) * (quality === "mejor" ? 1.55 : 1.5);
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2 + f.h * 0.05;
    const { rgba, map } = cropRgba(source, cx, cy, side, side, ang, 256, 256);
    const r = await runModel("landmarks", "facelm", { rgba }, [rgba.buffer], { quiet: true });
    if(r.presence < 0.5) continue;
    const puntos = [];
    for(let k = 0; k < 478; k++){ const [x, y] = map(r.pts[k * 3], r.pts[k * 3 + 1]); puntos.push([x, y, r.pts[k * 3 + 2] * side / 256]); }
    out.push({ cara: i, puntos, presencia: r.presence });
  }
  return out;
}
