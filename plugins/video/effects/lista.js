/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · LISTA DE EFECTOS
   Una línea por efecto: importa su manifiesto y lo registra. Vacía hasta F15.5 (cadena de sensor, color, estilos de cámara). Entradas: un registro. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
export const MANIFIESTOS = [];
export function registrarTodos(registro){ MANIFIESTOS.forEach(m => registro.registrar(m)); }
