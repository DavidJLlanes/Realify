/* ═══════════════════════════════════════════════════════════════
   ESTILO · REFERENCIA Y ZONAS
   Elegir una foto de referencia (selector de archivos), reducirla y medirla por zonas (cielo / personas / resto con la segmentación de la IA; si
   los modelos no están, las zonas se omiten y todo va como una sola zona). Entradas: lienzo de la foto o archivo. Salidas: elegirArchivo() →
   File | null; imagenDe(file) → lienzo; zonasDe(src, prep) → pesos { cielo?, personas? }; medirReferencia(lienzo) → estadísticas.
   ═══════════════════════════════════════════════════════════════ */
import { trabajar } from "../../scene/shared/trabajo.js";
import { gauss } from "../../portrait/shared/blur.js";
import { estadisticas } from "../engine/transferir.js";

export function elegirArchivo(accept = "image/*"){
  return new Promise(resolve => {
    const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.style.display = "none";
    i.addEventListener("change", () => { resolve(i.files[0] || null); i.remove(); }, { once: true });
    i.addEventListener("cancel", () => { resolve(null); i.remove(); }, { once: true });
    document.body.appendChild(i); i.click();
  });
}

export async function imagenDe(file){
  const b = await createImageBitmap(file, { colorSpaceConversion: "default" }), c = document.createElement("canvas"); c.width = b.width; c.height = b.height;
  c.getContext("2d", { willReadFrequently: true }).drawImage(b, 0, 0); b.close?.(); return c;
}

function aPeso(mask, w, h, W, H){
  const f = new Float32Array(W * H);
  for(let y = 0; y < H; y++){ const sy = Math.min(h - 1, Math.floor(y * h / H)); for(let x = 0; x < W; x++) f[y * W + x] = mask[sy * w + Math.min(w - 1, Math.floor(x * w / W))] / 255; }
  return gauss(f, W, H, Math.max(2, Math.min(W, H) / 150));
}

export async function zonasDe(src, prep){
  const pesos = {};
  try{
    const { segmentSky, segmentPerson } = await import("../../../filters/segment/segment.js");
    const s = await segmentSky(src); if(s.hasSky) pesos.cielo = aPeso(s.mask, src.width, src.height, prep.W, prep.H);
    const p = await segmentPerson(src); if(p.mask.some(v => v > 127)) pesos.personas = aPeso(p.mask, src.width, src.height, prep.W, prep.H);
  } catch(err){ if(err && err.cancelled) throw err; console.warn("[estilo] sin zonas:", err); }
  return pesos;
}

export async function medirReferencia(c, conZonas = true){
  const prep = trabajar(c, 1024);
  return estadisticas(prep.planes, conZonas ? await zonasDe(c, prep) : {});
}
