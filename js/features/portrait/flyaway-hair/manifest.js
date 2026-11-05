/* ═══════════════════════════════════════════════════════════════
   PELOS SUELTOS · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Pelos sueltos» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.flyawayHair",
  label: "Pelos sueltos…",
  short: "Pelos sueltos",
  icon: "wind",
  help: "Quita los pelos sueltos que cruzan el fondo junto a la cabeza: los detecta como líneas finas y los rellena con el fondo. No toca el peinado. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "sueltos" },
  params: PARAMS,
  load: () => import("./index.js")
};
