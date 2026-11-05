/* ═══════════════════════════════════════════════════════════════
   BRILLOS DE LA PIEL · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Brillos» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.skinShine",
  label: "Brillos de la piel…",
  short: "Brillos",
  icon: "sun-medium",
  help: "Detecta las zonas brillantes de la piel (frente, nariz, mejillas) y las atenúa sin apagar el reflejo de los ojos. En el editor de cara, capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "brillos" },
  params: PARAMS,
  load: () => import("./index.js")
};
