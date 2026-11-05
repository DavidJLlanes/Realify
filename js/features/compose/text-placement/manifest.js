/* ═══════════════════════════════════════════════════════════════
   COLOCAR TEXTO EN LA ZONA LIBRE · MANIFIESTO
   Sólo DATOS: menú, cajón, lista ☰ y comando salen de aquí. Interfaz simple (4 mandos).
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.textPlacement",
  label: "Texto en zona libre con IA…",
  short: "Texto zona libre",
  icon: "type",
  help: "Busca la zona de la foto que menos molesta (sin sujeto, caras ni texturas) y escribe ahí tu texto o marca de agua, en claro u oscuro según el fondo, en una capa nueva.",
  submenu: "encuadre",
  tabs: ["estilo"],
  premium: true,
  ui: "simple",
  params: PARAMS,
  load: () => import("./index.js")
};
