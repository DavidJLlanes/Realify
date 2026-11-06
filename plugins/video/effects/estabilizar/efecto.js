/* ═══════════════════════════════════════════════════════════════
   EFECTO ESTABILIZAR · ADAPTADOR
   Reduce el fotograma a una miniatura de gris (≤ 160 px), pide la corrección al motor (engine.js) y dibuja el fotograma desplazado y ampliado lo justo para tapar los bordes.
   Sólo funciona con fotogramas consecutivos: si se salta en la línea de tiempo, reinicia y no corrige ese fotograma. Entradas: lienzo, params { fuerza, recorte }, t. Salida: lienzo.
   ═══════════════════════════════════════════════════════════════ */
import { crearEstabilizador } from "./engine.js";

export function crear(){
  let est = null, tPrevio = -1, fps = 30, mini = null;
  const gris = (frame) => {
    const k = 160 / Math.max(frame.width, frame.height), w = Math.max(8, Math.round(frame.width * k)), h = Math.max(8, Math.round(frame.height * k));
    mini = mini || document.createElement("canvas"); mini.width = w; mini.height = h; const x = mini.getContext("2d", { willReadFrequently: true }); x.drawImage(frame, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h); for(let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114; return { g, w, h };
  };
  return {
    prepare(ctx){ fps = ctx?.fps || 30; },
    process(frame, params, t){
      const fuerza = (params.fuerza ?? 60) / 100, rec = (params.recorte ?? 8) / 100;
      if(!est || Math.abs(fuerza - est.fuerza) > 1e-6){ est = { fuerza, e: crearEstabilizador({ suavizado: 0.5 + 0.48 * fuerza }) }; tPrevio = -1; }
      if(!(tPrevio >= 0 && t > tPrevio && t - tPrevio < 2.5 / fps)) est.e.reiniciar();
      tPrevio = t; const { g, w, h } = gris(frame), c = est.e.paso(g, w, h), k = frame.width / w;
      const out = Object.assign(document.createElement("canvas"), { width: frame.width, height: frame.height }), x = out.getContext("2d"), z = 1 + rec * 2;
      x.imageSmoothingQuality = "high"; x.translate(frame.width / 2 + c.dx * k, frame.height / 2 + c.dy * k); x.scale(z, z); x.drawImage(frame, -frame.width / 2, -frame.height / 2); return out;
    },
    dispose(){ est = null; }
  };
}
