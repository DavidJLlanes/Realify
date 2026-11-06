/* ═══════════════════════════════════════════════════════════════
   MENÚ «VÍDEO» · DATOS
   Menú exclusivo del editor de vídeo (plan 4.8): la barra de escritorio, la sección de ☰ y la pestaña del cajón del móvil salen de esta lista, con el mismo contenido y orden.
   Entradas: ninguna. Salida: VIDEO_ITEMS (cmd, label del menú, corto del cajón, ic, help). Los comandos están en js/app/commands/video.js (sólo import()).
   ═══════════════════════════════════════════════════════════════ */
export const VIDEO_ITEMS = [
  { cmd: "video.edit", label: "Editor de vídeo…", corto: "Editor de vídeo", ic: "clapperboard",
    help: "Monta vídeos con línea de tiempo: recortar, dividir, mover, velocidad y volumen, efectos (sensor de Realify, color, estilos de cámara, fondo con IA, estabilizar) y exportar a MP4 o WebM con presets para redes. Todo en tu dispositivo." },
  { cmd: "video.import", label: "Importar vídeo…", corto: "Importar vídeo", ic: "film",
    help: "Abre el editor de vídeo y te deja elegir uno o varios vídeos de tu dispositivo para empezar." }
];
