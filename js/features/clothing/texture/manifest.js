/* ═══════════════════════════════════════════════════════════════
   TEXTURA DE TEJIDO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de ropa en el grupo «textura» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.fabricTexture",
  label: "Textura de tejido…",
  short: "Textura tela",
  icon: "grid-3x3",
  help: "Realza, apaga o devuelve la trama del tejido y rellena las zonas que quedaron demasiado lisas tras planchar o recolorear.",
  submenu: "ropa",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "clothing", group: "textura" },
  params: PARAMS,
  load: () => import("./index.js")
};
