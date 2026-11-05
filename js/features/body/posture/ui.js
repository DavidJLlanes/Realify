/* ═══════════════════════════════════════════════════════════════
   POSTURA · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cuerpo monta los mandos de `params` en el grupo «postura».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "../params.js";

export const panel = () => ({ editor: "body", group: "postura", title: "Postura", params: PARAMS });
