/* ═══════════════════════════════════════════════════════════════
   COLOCAR TEXTO EN LA ZONA LIBRE · INTERFAZ
   Sólo declara el panel (ai-kit/simple-host.js lo monta). Entradas: nada. Salida: la configuración del panel.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ title: "Texto en la zona libre", subtitle: "Premium 👑", applyLabel: "Colocar", params: PARAMS });
