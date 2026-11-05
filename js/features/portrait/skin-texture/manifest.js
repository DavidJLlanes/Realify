/* ═══════════════════════════════════════════════════════════════
   TEXTURA DE PIEL · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cara en el grupo «Textura» (la cara tiene su propio editor, 4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export default {
  cmd: "ai.skinTexture",
  label: "Textura de piel…",
  short: "Textura",
  icon: "grip",
  help: "Añade poros y grano fino sólo donde la piel es demasiado lisa (típico de las imágenes de IA); la piel que ya tiene textura no cambia. En el editor de cara, capa nueva con «mezcla».",
  submenu: "retrato",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "face", group: "textura" },
  params: PARAMS,
  load: () => import("./index.js")
};
