/* ═══════════════════════════════════════════════════════════════
   ZONAS LISAS · INTERFAZ
   Sólo declara el panel (ai-kit/simple-host.js lo monta). Entradas: nada. Salida: la configuración del panel.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ title: "Zonas demasiado lisas", subtitle: "Premium 👑", applyLabel: "Aplicar", params: PARAMS });
