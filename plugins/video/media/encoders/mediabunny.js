/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · CODIFICADOR «mediabunny» (WebCodecs)
   Convierte lienzos en un archivo MP4 o WebM. Elige el primer códec que ESTE dispositivo sepa codificar en el orden de preferencia del contenedor
   (MP4: H.264 → AV1 → VP9 · WebM: VP9 → AV1 → VP8); si ninguno sirve, lo dice. Entradas: { ancho, alto, fps, contenedor:"mp4"|"webm", bitrate? }.
   Con `audio: true` añade una pista de sonido (MP4: AAC u Opus · WebM: Opus o Vorbis, el primero que sepa el dispositivo). Salida de crear(): { codec, codecAudio, anadir(lienzo, t, duracion), anadirAudio(canales, tasa), cerrar() → Blob, cancelar() }.
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

const AUDIO = { mp4: ["aac", "opus"], webm: ["opus", "vorbis"] };
export async function crear({ ancho, alto, fps = 30, contenedor = "mp4", bitrate = null, audio = false, audioBitrate = 128000 }){
  const M = await cargarMediabunny(), codec = await codecPara({ ancho, alto, contenedor });
  if(!codec) throw new Error(`Este dispositivo no puede codificar vídeo ${contenedor.toUpperCase()} a ${ancho}×${alto}`);
  const lienzo = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(ancho, alto) : Object.assign(document.createElement("canvas"), { width: ancho, height: alto });
  const x = lienzo.getContext("2d"), salida = new M.Output({ format: contenedor === "webm" ? new M.WebMOutputFormat() : new M.Mp4OutputFormat(), target: new M.BufferTarget() });
  const fuente = new M.CanvasSource(lienzo, { codec, bitrate: bitrate || Math.round(ancho * alto * fps * 0.1) });
  salida.addVideoTrack(fuente, { frameRate: fps });
  const codecAudio = audio ? await M.getFirstEncodableAudioCodec(AUDIO[contenedor], { numberOfChannels: 2, sampleRate: 48000 }) : null;
  if(audio && !codecAudio) throw new Error(`Este dispositivo no puede codificar el sonido de ${contenedor.toUpperCase()}. Prueba con ${contenedor === "webm" ? "MP4" : "WebM"} o exporta sin sonido.`);
  const fuenteAudio = codecAudio ? new M.AudioBufferSource({ codec: codecAudio, bitrate: audioBitrate }) : null; if(fuenteAudio) salida.addAudioTrack(fuenteAudio);
  await salida.start();
  return {
    codec, codecAudio,
    async anadir(origen, t, duracion = 1 / fps){ x.drawImage(origen, 0, 0, ancho, alto); await fuente.add(t, duracion); },
    /** Añade sonido (canales Float32 con la misma longitud) a continuación de lo anterior. Lo llama quien exporta, en trozos, antes de cerrar(). */
    async anadirAudio(canales, tasa){
      if(!fuenteAudio) return; const b = new AudioBuffer({ length: canales[0].length, sampleRate: tasa, numberOfChannels: canales.length });
      canales.forEach((c, i) => b.copyToChannel(c, i)); await fuenteAudio.add(b);
    },
    async cerrar(){ fuente.close(); fuenteAudio?.close(); await salida.finalize(); return new Blob([salida.target.buffer], { type: contenedor === "webm" ? "video/webm" : "video/mp4" }); },
    async cancelar(){ try{ await salida.cancel(); }catch{} }
  };
}
