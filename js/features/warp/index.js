/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · PUERTA ÚNICA
   Motor de deformación reutilizable (editor de cuerpo, forma de la cara, ajustes finos). Contiene el campo, MLS con restricciones,
   control de plegados, render en GPU con respaldo en CPU (worker) y compensación del fondo.
   `deformar(lienzo, campo)` → lienzo nuevo del mismo tamaño. Orden de intento: GPU, worker de CPU, CPU en el hilo principal.
   ═══════════════════════════════════════════════════════════════ */
import { deformarGPU } from "./render-gpu.js";
import { deformarCPU } from "./render-cpu.js";

export { crearCampo, muestrear, adelante, escalarCampo, maximo } from "./field.js";
export { campoMLS, enderezar } from "./mls.js";
export { limitar, minDet } from "./jacobian.js";
export { deformarCPU } from "./render-cpu.js";
export { descubierto, rellenar } from "./fondo.js";
export { lamaInpaint } from "./lama.js";

function viaWorker(rgba, W, H, campo, lineal){
  return new Promise((ok, mal) => {
    try{
      const w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      w.onmessage = e => { w.terminate(); ok(e.data.data); };
      w.onerror = e => { w.terminate(); mal(new Error(e.message || "worker")); };
      w.postMessage({ data: rgba, W, H, campo, lineal }, [rgba.buffer]);
    } catch(err){ mal(err); }
  });
}

export async function deformar(lienzo, campo, { gpu = true, lineal = true } = {}){
  if(gpu){ const r = deformarGPU(lienzo, campo, { lineal }); if(r) return r; }
  const W = lienzo.width, H = lienzo.height, ctx = lienzo.getContext("2d", { willReadFrequently: true });
  const src = new Uint8ClampedArray(ctx.getImageData(0, 0, W, H).data);
  let out;
  try{ out = await viaWorker(src.slice(), W, H, campo, lineal); } catch{ out = deformarCPU(src, W, H, campo, { lineal }); }
  const res = document.createElement("canvas"); res.width = W; res.height = H;
  res.getContext("2d").putImageData(new ImageData(out, W, H), 0, 0);
  return res;
}
