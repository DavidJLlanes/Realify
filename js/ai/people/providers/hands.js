/* ═══════════════════════════════════════════════════════════════
   PERSONAS · PROVEEDOR · MANOS (MediaPipe)
   1) Detector de palma sobre la foto entera (cuadrado de 192 con relleno). «Mejor»: además, sobre una zona alrededor de cada
      muñeca encontrada por la pose (manos pequeñas).
   2) Por cada palma: recorte girado (dedos hacia arriba) de 224×224 → 21 puntos → vuelta a la foto.
   Salida: [{ puntos: [[x, y, z]×21], x, y, w, h, presencia, probDerecha }]. `probDerecha` es lo que dice el modelo, que supone una
   imagen en espejo: no se usa para decidir el lado.
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "../../runtime.js";
import { cropRgba, letterbox } from "./crop.js";

async function detect(source, box){
  const L = letterbox(source, box, 192);
  const r = await runModel("handDetect", "handdet", { rgba: L.rgba, threshold: 0.5 }, [L.rgba.buffer], { quiet: true });
  // del cuadrado 0…1 a píxeles de la foto
  const toPhoto = (u, v) => [box.x + (u * 192 - L.ox) / L.k, box.y + (v * 192 - L.oy) / L.k];
  return r.hands.map(h => ({ ...h, kp: h.kp.map(([u, v]) => toPhoto(u, v)), c: toPhoto(h.cx, h.cy), size: Math.max(h.w, h.h) * 192 / L.k }));
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export async function handsProvider({ source, quality, signal, partial }){
  const W = source.width, H = source.height;
  let dets = await detect(source, { x: 0, y: 0, w: W, h: H });
  if(quality === "mejor"){
    for(const pose of partial.poses || []){
      for(const n of ["munecaI", "munecaD"]){
        const m = pose.puntos[n], codo = pose.puntos[n === "munecaI" ? "codoI" : "codoD"];
        if(!m || m[2] < 0.3 || !codo) continue;
        const r = Math.max(24, dist(m, codo) * 1.1), box = { x: Math.max(0, m[0] - r), y: Math.max(0, m[1] - r), w: Math.min(W, 2 * r), h: Math.min(H, 2 * r) };
        for(const d of await detect(source, box)) if(!dets.some(o => dist(o.c, d.c) < Math.max(o.size, d.size) * 0.5)) dets.push(d);
      }
    }
  }
  const out = [];
  for(const d of dets){
    if(signal && signal.aborted) throw new DOMException("Análisis cancelado", "AbortError");
    // giro: la dirección del puño (kp0) al nudillo del medio (kp2) debe quedar hacia arriba en el recorte
    const dx = d.kp[2][0] - d.kp[0][0], dy = d.kp[2][1] - d.kp[0][1], ang = Math.atan2(dx, -dy);
    const side = d.size * 2.6, up = [Math.sin(ang), -Math.cos(ang)];
    const cx = d.c[0] + up[0] * d.size * 0.5, cy = d.c[1] + up[1] * d.size * 0.5;   // el recorte se corre hacia los dedos
    const { rgba, map } = cropRgba(source, cx, cy, side, side, ang, 224, 224);
    const r = await runModel("handLandmarks", "handlm", { rgba }, [rgba.buffer], { quiet: true });
    if(r.presence < 0.5) continue;
    const puntos = [];
    for(let k = 0; k < 21; k++){ const [x, y] = map(r.pts[k * 3], r.pts[k * 3 + 1]); puntos.push([x, y, r.pts[k * 3 + 2] * side / 224]); }
    const xs = puntos.map(p => p[0]), ys = puntos.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
    out.push({ puntos, x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0, presencia: r.presence, probDerecha: r.right });
  }
  return out;
}
