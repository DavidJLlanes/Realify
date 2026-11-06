/* ═══════════════════════════════════════════════════════════════
   PRESET DE EXPORTACIÓN · YouTube 1080p
   Un archivo por preset (docs/VIDEO.md, 6.3): añadir uno es añadir un archivo y una línea en ../lista.js. Fija formato (alto y ancho), fotogramas, contenedor y tasas de bits.
   Entradas: ninguna. Salida: objeto { id, nombre, nota, contenedor, ancho, alto, fps, bitrate (bit/s de vídeo), audioBitrate }.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "youtube", nombre: "YouTube 1080p", nota: "16:9 · 1920×1080 · 30 fps", contenedor: "mp4", ancho: 1920, alto: 1080, fps: 30, bitrate: 12000000, audioBitrate: 192000 };
