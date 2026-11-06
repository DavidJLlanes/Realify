/* ═══════════════════════════════════════════════════════════════
   PRESET DE EXPORTACIÓN · WhatsApp (pequeño)
   Un archivo por preset (docs/VIDEO.md, 6.3): añadir uno es añadir un archivo y una línea en ../lista.js. Fija formato (alto y ancho), fotogramas, contenedor y tasas de bits.
   Entradas: ninguna. Salida: objeto { id, nombre, nota, contenedor, ancho, alto, fps, bitrate (bit/s de vídeo), audioBitrate }.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "whatsapp", nombre: "WhatsApp (pequeño)", nota: "9:16 · 720×1280 · 30 fps, pesa poco", contenedor: "mp4", ancho: 720, alto: 1280, fps: 30, bitrate: 2000000, audioBitrate: 96000 };
