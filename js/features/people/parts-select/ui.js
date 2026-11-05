/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR PARTES · INTERFAZ
   Sólo declara el panel (el host de ai-kit lo monta como diálogo simple, igual que el resto de funciones simples).
   Entradas: nada. Salida: la configuración del panel.
   ═══════════════════════════════════════════════════════════════ */
import { PARAMS } from "./params.js";

export const panel = () => ({
  title: "Seleccionar partes",
  subtitle: "Premium 👑 · pelo, piel, ropa, brazos, piernas…",
  applyLabel: "Aplicar",
  params: PARAMS
});
