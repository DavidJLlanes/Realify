/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · LISTA DE EFECTOS
   Una línea por efecto: importa su manifiesto y lo registra. Añadir un efecto = una carpeta en effects/ y una línea aquí; el motor no cambia. Entradas: un registro. Salida: nada.
   ═══════════════════════════════════════════════════════════════ */
import color from "./color/manifest.js";
import sensor from "./sensor/manifest.js";
import camaras from "./camaras/manifest.js";
import fondo from "./fondo/manifest.js";
import estabilizar from "./estabilizar/manifest.js";

export const MANIFIESTOS = [color, sensor, camaras, fondo, estabilizar];
export function registrarTodos(registro){ MANIFIESTOS.forEach(m => registro.registrar(m)); }
