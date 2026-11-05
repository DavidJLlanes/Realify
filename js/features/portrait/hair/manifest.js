/* ═══════════════════════════════════════════════════════════════
   CABELLO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Cabello» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.hair",
  label: "Cabello…",
  short: "Cabello",
  icon: "feather",
  help: "Cambia el color del pelo (tono y saturación en OKLab, conservando sombras y mechones), su luz y su brillo, y le da volumen suave. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "pelo" },
  params: PARAMS,
  load: () => import("./index.js")
};
