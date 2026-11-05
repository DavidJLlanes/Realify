/* ═══════════════════════════════════════════════════════════════
   PERSONAS · PROVEEDOR · PARTES DEL CUERPO Y ROPA (SegFormer-B2)
   Por persona: su caja (de la pose si hay, o de la cara) con margen → cuadrado 512 sin deformar → 18 clases → máscaras por grupo
   (0-255) a la resolución de la caja (Bueno: lado mayor ≤ 512; Mejor: ≤ 1024, con las probabilidades ampliadas con interpolación
   bilineal ANTES de elegir, que da bordes más finos que ampliar la máscara ya decidida).
   Salida: [{ persona: índice de cara, caja, w, h, mascaras: { grupo: Uint8Array(w×h) } }].
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "../../runtime.js";
import { letterbox, bodyBoxFromFace } from "./crop.js";
import { GRUPOS } from "../groups.js";

export async function partsProvider({ source, caras, quality, signal, partial }){
  const out = [], maxSide = quality === "mejor" ? 1024 : 512;
  for(let i = 0; i < caras.length; i++){
    if(signal && signal.aborted) throw new DOMException("Análisis cancelado", "AbortError");
    const pose = (partial.poses || []).find(p => p.cara === i);
    const base = pose ? pose.caja : bodyBoxFromFace(caras[i], source.width, source.height);
    const mx = base.w * 0.08, my = base.h * 0.05;
    const x0 = Math.max(0, base.x - mx), y0 = Math.max(0, base.y - my);
    const caja = { x: x0, y: y0, w: Math.min(source.width, base.x + base.w + mx) - x0, h: Math.min(source.height, base.y + base.h + my) - y0 };
    const L = letterbox(source, caja, 512);
    const r = await runModel("humanParse", "humanparse", { rgba: L.rgba }, [L.rgba.buffer], { quiet: true });
    const k = Math.min(1, maxSide / Math.max(caja.w, caja.h)), w = Math.max(1, Math.round(caja.w * k)), h = Math.max(1, Math.round(caja.h * k));
    const mascaras = {};
    for(const g in GRUPOS) mascaras[g] = new Uint8Array(w * h);
    const S = r.S, scale = S / 512;                       // la salida es de 128 para una entrada de 512
    for(let y = 0; y < h; y++){
      const sy = Math.min(S - 1.001, Math.max(0, ((L.oy + (y + 0.5) / h * L.uh) * scale) - 0.5)), y0i = Math.floor(sy), fy = sy - y0i;
      for(let x = 0; x < w; x++){
        const sx = Math.min(S - 1.001, Math.max(0, ((L.ox + (x + 0.5) / w * L.uw) * scale) - 0.5)), x0i = Math.floor(sx), fx = sx - x0i;
        const p = y * w + x;
        for(const g in GRUPOS){
          let v = 0;
          for(const c of GRUPOS[g]){
            const o = c * S * S + y0i * S + x0i;
            v += (r.probs[o] * (1 - fx) + r.probs[o + 1] * fx) * (1 - fy) + (r.probs[o + S] * (1 - fx) + r.probs[o + S + 1] * fx) * fy;
          }
          mascaras[g][p] = Math.min(255, Math.round(v));
        }
      }
    }
    out.push({ persona: i, caja, w, h, mascaras });
  }
  return out;
}
