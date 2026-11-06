/* ═══════════════════════════════════════════════════════════════
   PRESET DE EXPORTACIÓN · Web ligera (WebM)
   Un archivo por preset (docs/VIDEO.md, 6.3): añadir uno es añadir un archivo y una línea en ../lista.js. Fija formato (alto y ancho), fotogramas, contenedor y tasas de bits.
   Entradas: ninguna. Salida: objeto { id, nombre, nota, contenedor, ancho, alto, fps, bitrate (bit/s de vídeo), audioBitrate }.
   ═══════════════════════════════════════════════════════════════ */
export default { id: "web", nombre: "Web ligera (WebM)", nota: "16:9 · 1280×720 · 30 fps · WebM", contenedor: "webm", ancho: 1280, alto: 720, fps: 30, bitrate: 2500000, audioBitrate: 96000 };
