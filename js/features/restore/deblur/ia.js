/* ═══════════════════════════════════════════════════════════════
   QUITAR DESENFOQUE · MOTOR CON IA (NAFNet)
   Pasa los planos en luz lineal a RGBA, deja que NAFNet (entrenado con GoPro: desenfoque de movimiento real) restaure por teselas en
   el worker y mezcla el resultado con el original según «Cantidad». Entradas: planos, cantidad (0-100). Salida: los planos se modifican.
   Límites: el modelo pesa 33 MB (se avisa antes de bajarlo); no corrige el desenfoque de enfoque tan bien como el de movimiento.
   ═══════════════════════════════════════════════════════════════ */
import { toPlanes, fromPlanes } from "../../portrait/shared/planes.js";

export async function quitarDesenfoqueIA(planes, cantidad = 100){
  const { W, H } = planes, rgba = new Uint8ClampedArray(W * H * 4);
  fromPlanes(planes, rgba); for(let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  const { runModel } = await import("../../../ai/runtime.js");
  const res = await runModel("restore", "nafnet", { rgba, w: W, h: H, strength: 0 }, [rgba.buffer]);
  const nuevo = toPlanes(res.rgba, W, H), k = Math.max(0, Math.min(1, cantidad / 100));
  for(const c of ["R", "G", "B"]) for(let i = 0; i < planes[c].length; i++) planes[c][i] += (nuevo[c][i] - planes[c][i]) * k;
  return planes;
}
