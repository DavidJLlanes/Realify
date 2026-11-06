/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · CODIFICADOR «mediabunny» (WebCodecs)
   Convierte lienzos en un archivo MP4 o WebM. Elige el primer códec que ESTE dispositivo sepa codificar en el orden de preferencia del contenedor
   (MP4: H.264 → AV1 → VP9 · WebM: VP9 → AV1 → VP8); si ninguno sirve, lo dice. Entradas: { ancho, alto, fps, contenedor:"mp4"|"webm", bitrate? }.
   Salida de crear(): { codec, anadir(lienzo, t, duracion), cerrar() → Blob, cancelar() }. Sin audio todavía (F15.7).
   ═══════════════════════════════════════════════════════════════ */
import { cargarMediabunny } from "../../bridge/mediabunny.js";

export const id = "mediabunny", prioridad = 100;
const PREFERENCIA = { mp4: ["avc", "av1", "vp9"], webm: ["vp9", "av1", "vp8"] };

export async function codecPara({ ancho, alto, contenedor = "mp4" }){
  const M = await cargarMediabunny();
  for(const c of PREFERENCIA[contenedor] || []) if(await M.canEncodeVideo(c, { width: ancho, height: alto })) return c;
  return null;
}
export const soporta = async cfg => !!(await codecPara(cfg));

export async function crear({ ancho, alto, fps = 30, contenedor = "mp4", bitrate = null }){
  const M = await cargarMediabunny(), codec = await codecPara({ ancho, alto, contenedor });
  if(!codec) throw new Error(`Este dispositivo no puede codificar vídeo ${contenedor.toUpperCase()} a ${ancho}×${alto}`);
  const lienzo = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(ancho, alto) : Object.assign(document.createElement("canvas"), { width: ancho, height: alto });
  const x = lienzo.getContext("2d"), salida = new M.Output({ format: contenedor === "webm" ? new M.WebMOutputFormat() : new M.Mp4OutputFormat(), target: new M.BufferTarget() });
  const fuente = new M.CanvasSource(lienzo, { codec, bitrate: bitrate || Math.round(ancho * alto * fps * 0.1) });
  salida.addVideoTrack(fuente, { frameRate: fps }); await salida.start();
  return {
    codec,
    async anadir(origen, t, duracion = 1 / fps){ x.drawImage(origen, 0, 0, ancho, alto); await fuente.add(t, duracion); },
    async cerrar(){ fuente.close(); await salida.finalize(); return new Blob([salida.target.buffer], { type: contenedor === "webm" ? "video/webm" : "video/mp4" }); },
    async cancelar(){ try{ await salida.cancel(); }catch{} }
  };
}
