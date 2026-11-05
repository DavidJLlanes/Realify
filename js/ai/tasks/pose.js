/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · POSE (RTMPose-m, 17 puntos COCO)
   Entradas: modelo, recorte RGBA de la persona de 192×256 y `tta` (Mejor: se promedia con la imagen volteada).
   Salida: { pts: Float32Array(17×3) = x, y (píxeles del recorte) y confianza }.
   ═══════════════════════════════════════════════════════════════ */
import * as ort from "../../vendor/ort/ort.webgpu.min.js";
import { getSession, runSession } from "../engine/sessions.js";
import { readFloats } from "../engine/tensors.js";

const W = 192, H = 256, KX = W * 2, KY = H * 2;
const MEAN = [123.675, 116.28, 103.53], STD = [58.395, 57.12, 57.375];
// Qué punto es el «otro lado» al voltear (COCO: ojos, orejas, hombros, codos, muñecas, caderas, rodillas, tobillos)
const FLIP = [0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15];

function input(rgba, flip){
  const n = W * H, x = new Float32Array(3 * n);
  for(let y = 0; y < H; y++) for(let xx = 0; xx < W; xx++){
    const i = (y * W + (flip ? W - 1 - xx : xx)) * 4, p = y * W + xx;
    x[p] = (rgba[i] - MEAN[0]) / STD[0]; x[n + p] = (rgba[i + 1] - MEAN[1]) / STD[1]; x[2 * n + p] = (rgba[i + 2] - MEAN[2]) / STD[2];
  }
  return new ort.Tensor("float32", x, [1, 3, H, W]);
}

async function simcc(id, model, session, rgba, flip){
  const out = await runSession(id, model, { [session.inputNames[0]]: input(rgba, flip) });
  return [readFloats(out.simcc_x || out[session.outputNames[0]]), readFloats(out.simcc_y || out[session.outputNames[1]])];
}

export async function pose({ model, id, rgba, tta = false }){
  const { session } = await getSession(id, model);
  const [sx, sy] = await simcc(id, model, session, rgba, false);
  if(tta){
    const [fx, fy] = await simcc(id, model, session, rgba, true);
    for(let k = 0; k < 17; k++){
      // El punto k de la imagen volteada es el FLIP[k] de la original, con el eje x al revés
      for(let i = 0; i < KX; i++) sx[k * KX + i] = (sx[k * KX + i] + fx[FLIP[k] * KX + (KX - 1 - i)]) / 2;
      for(let i = 0; i < KY; i++) sy[k * KY + i] = (sy[k * KY + i] + fy[FLIP[k] * KY + i]) / 2;
    }
  }
  const pts = new Float32Array(17 * 3);
  for(let k = 0; k < 17; k++){
    let bx = 0, vx = -Infinity, by = 0, vy = -Infinity;
    for(let i = 0; i < KX; i++){ const v = sx[k * KX + i]; if(v > vx){ vx = v; bx = i; } }
    for(let i = 0; i < KY; i++){ const v = sy[k * KY + i]; if(v > vy){ vy = v; by = i; } }
    pts[k * 3] = bx / 2; pts[k * 3 + 1] = by / 2; pts[k * 3 + 2] = Math.max(0, Math.min(vx, vy));
  }
  return { pts };
}
