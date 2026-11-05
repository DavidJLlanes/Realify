/* ═══════════════════════════════════════════════════════════════
   FORMA DE LA CARA · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Forma» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.faceShape",
  label: "Forma de la cara…",
  short: "Forma",
  icon: "scan-face",
  help: "Retoca la forma de la cara con cambios pequeños y naturales: mandíbula, mentón, anchura, nariz, tamaño de los ojos y grosor de los labios, deformando sin pliegues a partir de los 478 puntos de la cara. El perfil infantil usa un rango reducido. Capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "forma" },
  params: PARAMS,
  load: () => import("./index.js")
};
