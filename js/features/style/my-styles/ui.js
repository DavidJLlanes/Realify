/* ═══════════════════════════════════════════════════════════════
   MIS ESTILOS · INTERFAZ
   Sólo declara el panel (ai-kit/simple-host.js lo monta). Entradas: lista de estilos guardados [[id, nombre]…]. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = (estilos = []) => ({ title: "Mis estilos", subtitle: "Premium 👑", applyLabel: "Hecho", params: PARAMS.map(p => p.key === "estilo" && estilos.length ? { ...p, options: estilos, def: estilos[0][0] } : p) });
