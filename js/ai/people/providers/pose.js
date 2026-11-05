/* ═══════════════════════════════════════════════════════════════
   PERSONAS · PROVEEDOR · POSE (RTMPose-m)
   Por persona (arriba→abajo): caja desde la cara → recorte 192×256 → 17 puntos COCO. «Mejor»: promedia con la imagen volteada y
   repite el recorte con la caja ajustada a los puntos encontrados (la segunda pasada corrige cajas mal estimadas).
   Salida: [{ cara: índice, puntos: { nariz: [x, y, confianza]… }, caja }].
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "../../runtime.js";
import { cropRgba, bodyBoxFromFace, boxFromKeypoints } from "./crop.js";
import { COCO } from "../proportions.js";

const W = 192, H = 256, ASPECT = W / H;

async function onBox(source, box, tta){
  let w = box.w * 1.25, h = box.h * 1.25;                       // el modelo se entrenó con 1,25 de margen
  if(w > h * ASPECT) h = w / ASPECT; else w = h * ASPECT;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const { rgba, map } = cropRgba(source, cx, cy, w, h, 0, W, H);
  const r = await runModel("pose", "pose", { rgba, tta }, [rgba.buffer], { quiet: true });
  const pts = [];
  for(let k = 0; k < 17; k++){ const [x, y] = map(r.pts[k * 3], r.pts[k * 3 + 1]); pts.push([x, y, r.pts[k * 3 + 2]]); }
  return pts;
}

export async function poseProvider({ source, caras, quality, signal }){
  const out = [], mejor = quality === "mejor";
  for(let i = 0; i < caras.length; i++){
    if(signal && signal.aborted) throw new DOMException("Análisis cancelado", "AbortError");
    let caja = bodyBoxFromFace(caras[i], source.width, source.height);
    let pts = await onBox(source, caja, mejor);
    if(mejor){
      const ajustada = boxFromKeypoints(pts, source.width, source.height);
      if(ajustada){ caja = ajustada; pts = await onBox(source, caja, true); }
    }
    out.push({ cara: i, puntos: Object.fromEntries(COCO.map((n, k) => [n, pts[k]])), caja });
  }
  return out;
}
