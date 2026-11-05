/* ═══════════════════════════════════════════════════════════════
   POLVO Y MOTAS · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): ai-kit/simple-host.js lo monta. Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ title: "Polvo y motas del sensor", subtitle: "Premium 👑", applyLabel: "Aplicar", params: PARAMS });
