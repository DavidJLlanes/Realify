/* ═══════════════════════════════════════════════════════════════
   IMPERFECCIONES Y TONO · INTERFAZ
   Sólo declara el panel (no importa fsshell ni dialog): el editor de cara monta los mandos de `params` en el grupo «Imperfecciones».
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({ editor: "face", group: "tono", title: "Imperfecciones y tono", params: PARAMS });
