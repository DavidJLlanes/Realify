/* ═══════════════════════════════════════════════════════════════
   TEXTO ALTERNATIVO · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (1 mando) + informe.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.altText",
  label: "Texto alternativo…",
  short: "Texto alternativo",
  icon: "scan",
  help: "Escribe en español una descripción de la foto para lectores de pantalla (corta, de hasta 125 caracteres, o larga). Se copia al portapapeles.",
  submenu: "lote",
  tabs: ["analizar"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
