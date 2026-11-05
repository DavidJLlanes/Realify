/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · DETECCIÓN DE CARAS (YuNet)
   Detecta caras y sus puntos.
   Entradas: modelo, imagen RGBA, tamaño y umbral. Salida: cajas y puntos.
   ═══════════════════════════════════════════════════════════════ */

import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

/* ── Caras (YuNet, OpenCV Zoo) ──────────────────────────────────
   Entrada BGR 0-255 (blobFromImage sin escala ni media) rellena hasta
   múltiplo de 32; salidas cls/obj/bbox/kps a pasos 8, 16 y 32, que se
   decodifican como en FaceDetectorYN de OpenCV. Devuelve cajas y los 5
   puntos (ojo derecho, ojo izquierdo, nariz, comisuras) en píxeles de
   la imagen recibida, sin supresión de solapes (la hace quien llama). */
export async function faces({ model, id, rgba, w, h, threshold = 0.6 }){
  const { session } = await getSession(id, model);
  // Esta exportación tiene la entrada fija a 640×640: se rellena hasta ahí
  const pw = Math.max(640, Math.ceil(w / 32) * 32), ph = Math.max(640, Math.ceil(h / 32) * 32), n = pw * ph;
  const x = new Float32Array(3 * n);
  for(let y = 0; y < h; y++) for(let xx = 0; xx < w; xx++){
    const i = (y * w + xx) * 4, p = y * pw + xx;
    x[p] = rgba[i + 2]; x[n + p] = rgba[i + 1]; x[2 * n + p] = rgba[i];
  }
  const name = session.inputNames[0];
  const out = await runSession(id, model, { [name]: new ort.Tensor("float32", x, [1, 3, ph, pw]) });
  const list = [];
  for(const s of [8, 16, 32]){
    const cls = readFloats(out["cls_" + s]), obj = readFloats(out["obj_" + s]);
    const bb = readFloats(out["bbox_" + s]), kp = readFloats(out["kps_" + s]);
    const cols = pw / s, rows = ph / s;
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
      const k = r * cols + c;
      const score = Math.sqrt(Math.min(1, Math.max(0, cls[k])) * Math.min(1, Math.max(0, obj[k])));
      if(score < threshold) continue;
      const cx = (c + bb[k * 4]) * s, cy = (r + bb[k * 4 + 1]) * s;
      const bw = Math.exp(bb[k * 4 + 2]) * s, bh = Math.exp(bb[k * 4 + 3]) * s;
      const pts = [];
      for(let j = 0; j < 5; j++) pts.push([(kp[k * 10 + 2 * j] + c) * s, (kp[k * 10 + 2 * j + 1] + r) * s]);
      list.push({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, pts, score });
    }
  }
  return { faces: list };
}
