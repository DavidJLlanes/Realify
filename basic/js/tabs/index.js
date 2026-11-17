/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PESTAÑAS
   Tabla de las tres pestañas, en el orden de la barra inferior. Cada una puede traer `montar(contenedor)`, que dibuja su panel sobre
   la barra de pestañas y devuelve { desmontar() }. Ajustar (F2) ya lo trae; Estilos (F4) y Recortar (F3) llegan en su fase.
   Entradas: ninguna. Salidas: PESTANAS = [{ id, texto, icono, montar? }].
   Límites: los paneles se cargan al entrar en la pestaña (import dinámico), no al abrir la app.
   ═══════════════════════════════════════════════════════════════ */
export const PESTANAS = [
  { id: "ajustar", texto: "Ajustar", icono: "ajustar", montar: async c => (await import("./adjust/panel.js")).montarAjustar(c) },
  { id: "estilos", texto: "Estilos", icono: "estilos" },
  { id: "recortar", texto: "Recortar", icono: "crop" },
];
