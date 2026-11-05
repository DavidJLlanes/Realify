/* ═══════════════════════════════════════════════════════════════
   QUITAR NEBLINA CON PROFUNDIDAD · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): ai-kit/simple-host.js lo monta. Entradas: nada. Salida: la configuración del panel.
   ══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ title: "Quitar neblina con IA", subtitle: "Premium 👑", applyLabel: "Aplicar", params: PARAMS });
