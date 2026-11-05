/* Prueba en el navegador del render de deformación: GPU (WebGL2) frente a CPU, y el worker. Si no hay WebGL2 lo dice y sólo prueba CPU. */
import { abrir } from "../lib/navegador.mjs";

const m = await abrir("escritorio");
const r = await m.page.evaluate(async () => {
  const W = 400, H = 300, A = await import("/js/features/warp/index.js");
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#e33"); gr.addColorStop(0.5, "#3c5"); gr.addColorStop(1, "#33e"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff"; for(let i = 0; i < 40; i++) g.fillRect(i * 10, 100 + (i % 3) * 30, 4, 40);
  g.clearRect(0, 0, 60, 60);                                            // zona transparente
  const campo = A.limitar(A.campoMLS(W, H, [{ x: 150, y: 150, tx: 190, ty: 140 }, { x: 300, y: 200, tx: 280, ty: 215 }], { paso: 8 })).campo;
  const cpu = await A.deformar(cv, campo, { gpu: false }), gpu = await A.deformar(cv, campo, { gpu: true });
  const a = cpu.getContext("2d").getImageData(0, 0, W, H).data, b = gpu.getContext("2d").getImageData(0, 0, W, H).data;
  let suma = 0, max = 0, n = 0;
  for(let i = 0; i < a.length; i += 4){ if(a[i + 3] < 250 || b[i + 3] < 250) continue; for(let k = 0; k < 3; k++){ const d = Math.abs(a[i + k] - b[i + k]); suma += d; n++; if(d > max) max = d; } }
  const gl = !!document.createElement("canvas").getContext("webgl2");
  const t = document.createElement("canvas").getContext("2d"); void t;
  return { gl, media: suma / n, max, n };
});
console.log(JSON.stringify(r));
let fallos = 0;
if(r.gl){ if(!(r.media < 0.6 && r.max <= 6)) { fallos++; console.log("FALLO: GPU y CPU difieren", r); } } else console.log("AVISO: sin WebGL2 en este navegador; GPU sin probar");
console.log("errores:", [...m.errs]);
await m.cerrar();
console.log(fallos ? "warp (render): FALLO" : "warp (render): OK");
process.exit(fallos ? 1 : 0);
