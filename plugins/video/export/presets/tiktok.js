/* ═══════════════════════════════════════════════════════════════
   PRESET DE EXPORTACIÓN · TikTok
   Un archivo por preset (docs/VIDEO.md, 6.3): añadir uno es añadir un archivo y una línea en ../lista.js. Fija formato (alto y ancho), fotogramas, contenedor y tasas de bits.
   Entradas: ninguna. Salida: objeto { id, nombre, nota, contenedor, ancho, alto, fps, bitrate (bit/s de vídeo), audioBitrate }.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "tiktok", nombre: "TikTok", nota: "9:16 · 1080×1920 · 30 fps", contenedor: "mp4", ancho: 1080, alto: 1920, fps: 30, bitrate: 8000000, audioBitrate: 128000 };
