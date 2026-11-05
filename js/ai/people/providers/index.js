/* ═══════════════════════════════════════════════════════════════
   PERSONAS · PROVEEDORES (enchufa los modelos en analyze())
   Se carga con import() desde analyze.js sólo en el navegador. El orden importa: la pose va antes que las manos y las partes,
   que la usan para ajustar sus cajas.
   ═══════════════════════════════════════════════════════════════ */
import { registerProvider } from "../analyze.js";
import { landmarksProvider } from "./landmarks.js";
import { poseProvider } from "./pose.js";
import { handsProvider } from "./hands.js";
import { partsProvider } from "./parts.js";

registerProvider("landmarks", landmarksProvider);
registerProvider("poses", poseProvider);
registerProvider("manos", handsProvider);
registerProvider("partes", partsProvider);
