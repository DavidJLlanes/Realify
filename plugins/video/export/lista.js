/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · LISTA DE PRESETS DE EXPORTACIÓN (puro)
   Una línea por preset. `aplicarPreset` devuelve la salida del proyecto y los ajustes de codificación; `encajar` comprueba que el dispositivo puede (límite de lado) y avisa de lo que baja.
   Entradas: id de preset. Salidas: { salida:{ancho,alto,fps}, contenedor, bitrate, audioBitrate }.
   ═══════════════════════════════════════════════════════════════ */
import reel from "./presets/reel.js";
import historia from "./presets/historia.js";
import tiktok from "./presets/tiktok.js";
import youtube from "./presets/youtube.js";
import whatsapp from "./presets/whatsapp.js";
import web from "./presets/web.js";

export const PRESETS = [reel, historia, tiktok, youtube, whatsapp, web];
export const preset = id => PRESETS.find(p => p.id === id) || null;
export function aplicarPreset(id){
  const p = preset(id); if(!p) throw new Error("Preset desconocido: " + id);
  return { salida: { ancho: p.ancho, alto: p.alto, fps: p.fps }, contenedor: p.contenedor, bitrate: p.bitrate, audioBitrate: p.audioBitrate };
}
