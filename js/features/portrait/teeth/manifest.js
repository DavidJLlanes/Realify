/* ═══════════════════════════════════════════════════════════════
   DIENTES · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Dientes» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.teeth",
  label: "Dientes…",
  short: "Dientes",
  icon: "sparkle",
  help: "Blanquea los dientes por zonas, conservando el brillo: no toca encías, lengua ni labios. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "dientes" },
  params: PARAMS,
  load: () => import("./index.js")
};
