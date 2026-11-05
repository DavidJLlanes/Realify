/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CUERPO · MANIFIESTO
   Sólo DATOS: de aquí salen el menú, el cajón del móvil, la lista ☰ y el comando (4.5 del plan).
   `ui`: abre el editor de cuerpo en el grupo «silueta» (4.7 del plan).
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export default {
  cmd: "ai.bodyEditor",
  label: "Editor de cuerpo…",
  short: "Cuerpo",
  icon: "user-round",
  help: "Abre el editor de cuerpo: silueta, proporciones, cabeza y cuello, torso, brazos, piernas, postura, definición y piel, con zoom en la persona. Eliges el perfil (hombre, mujer, niño o niña) y cada persona va a su propia capa.",
  submenu: "cuerpo",
  tabs: ["retoque"],
  premium: true,
  ui: { editor: "body", group: "silueta" },
  params: PARAMS,
  load: () => import("./index.js")
};
