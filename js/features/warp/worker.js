/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · WORKER
   Ejecuta render-cpu.js fuera del hilo principal. Mensaje: { data, W, H, campo, lineal } → respuesta { data } (se transfiere el buffer).
   ═══════════════════════════════════════════════════════════════ */
import { deformarCPU } from "./render-cpu.js";

self.onmessage = e => {
  const { data, W, H, campo, lineal } = e.data;
  const out = deformarCPU(data, W, H, campo, { lineal });
  self.postMessage({ data: out }, [out.buffer]);
};
