/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · PESTAÑAS
   Tabla de las tres pestañas, en el orden de la barra inferior. Cada una puede traer `montar(contenedor, visor)`, que dibuja su panel sobre
   la barra de pestañas y devuelve { desmontar() }. Las tres lo traen (Ajustar F2, Recortar F3, Estilos F4).
   Entradas: ninguna. Salidas: PESTANAS = [{ id, texto, icono, montar? }].
   Límites: los paneles se cargan al entrar en la pestaña (import dinámico), no al abrir la app.
   ═══════════════════════════════════════════════════════════════ */
export const PESTANAS = [
  { id: "ajustar", texto: "Ajustar", icono: "ajustar", montar: async c => (await import("./adjust/panel.js")).montarAjustar(c) },
  { id: "estilos", texto: "Estilos", icono: "estilos", montar: async c => (await import("./looks/panel.js")).montarEstilos(c) },
  { id: "recortar", texto: "Recortar", icono: "crop", montar: async (c, visor) => (await import("./crop/panel.js")).montarRecortar(c, visor) },
];
