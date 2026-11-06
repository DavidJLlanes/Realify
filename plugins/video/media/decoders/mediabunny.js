/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · DECODIFICADOR «mediabunny» (WebCodecs)
   Abre un archivo (MP4, WebM, MOV, MKV…), da sus datos y entrega fotogramas como lienzos a la escala pedida. Entradas: File/Blob. Salida de abrir():
   { info:{ duracion, ancho, alto, fps, codec, audio }, fotograma(t), fotogramas(desde, hasta), cerrar() }. Cada lienzo es del que lo pide (no se reutiliza).
   Límites: sólo decodifica los códecs que el navegador sepa (se comprueba con canDecode antes de prometer nada).
   ═══════════════════════════════════════════════════════════════ */
import { cargarMediabunny } from "../../bridge/mediabunny.js";

export const id = "mediabunny", prioridad = 100;

async function entrada(archivo){
  const M = await cargarMediabunny(), input = new M.Input({ source: new M.BlobSource(archivo), formats: M.ALL_FORMATS });
  return { M, input };
}

export async function soporta(archivo){
  const { input } = await entrada(archivo);
  try{ const v = await input.getPrimaryVideoTrack(); return !!v && await v.canDecode(); } catch{ return false; } finally { input.dispose?.(); }
}

export async function abrir(archivo, { ancho = 0 } = {}){
  const { M, input } = await entrada(archivo), v = await input.getPrimaryVideoTrack();
  if(!v) throw new Error("El archivo no tiene vídeo");
  if(!await v.canDecode()) throw new Error(`Este dispositivo no puede decodificar ${v.codec || "ese códec"}`);
  const [duracion, stats, a] = await Promise.all([input.computeDuration(), v.computePacketStats(60).catch(() => null), input.getPrimaryAudioTrack().catch(() => null)]);
  const w = v.displayWidth, h = v.displayHeight, k = ancho && ancho < w ? ancho / w : 1;
  const sink = new M.CanvasSink(v, { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), fit: "fill", poolSize: 0 });
  const info = { duracion, ancho: w, alto: h, fps: stats?.averagePacketRate ? +stats.averagePacketRate.toFixed(3) : 30, codec: v.codec, audio: !!a };
  return {
    info,
    async fotograma(t){ const r = await sink.getCanvas(Math.max(0, Math.min(t, Math.max(0, duracion - 1e-3)))); return r ? { lienzo: r.canvas, t: r.timestamp } : null; },
    /** Sonido del tramo [desde, hasta) en segundos del medio: { canales:[Float32Array…], tasa, t0 } (t0 = instante real de la primera muestra) o null si no hay audio. */
    async audio(desde, hasta){
      if(!a) return null; const sink = new M.AudioBufferSink(a), trozos = []; let n = 0, tasa = 0, ch = 0, t0 = null;
      for await (const w of sink.buffers(Math.max(0, desde), Math.min(duracion, hasta))){ trozos.push(w); n += w.buffer.length; tasa = w.buffer.sampleRate; ch = w.buffer.numberOfChannels; if(t0 === null) t0 = w.timestamp; }
      if(!n) return null; const canales = Array.from({ length: ch }, () => new Float32Array(n)); let o = 0;
      for(const w of trozos){ for(let c = 0; c < ch; c++) canales[c].set(w.buffer.getChannelData(c), o); o += w.buffer.length; }
      return { canales, tasa, t0 };
    },
    async *fotogramas(desde = 0, hasta = duracion){ for await (const r of sink.canvases(desde, hasta)) yield { lienzo: r.canvas, t: r.timestamp }; },
    cerrar(){ input.dispose?.(); }
  };
}
