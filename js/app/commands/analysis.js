/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Análisis y metadatos
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { needsDoc } from "./helpers.js";

registerAll({
  "an.palette":     { run: async () => (await import("../../features/palette.js")).colorPalette(), enabled: needsDoc },
  "an.eyedropper":  { run: async () => (await import("../../features/palette.js")).screenEyedropper() },
  "an.metrics":     { run: async () => (await import("../../analysis/ui.js")).openMetrics(),
                      enabled: needsDoc },
  "an.forensics":   { run: async () => (await import("../../analysis/ui.js")).openForensics(),
                      enabled: needsDoc },
  "an.spectrum":    { run: async () => (await import("../../analysis/ui.js")).openSpectrum(),
                      enabled: needsDoc },
  "an.exif":        async () => (await import("../../exif/ui.js")).openExif(),
  "an.meta":        async () => (await import("../../exif/inspector.js")).openMetadataInspector(),
  "an.metaEdit":    { run: async () => (await import("../../io/meta/metaedit.js")).open(), enabled: needsDoc },
  "an.strip":       async () => (await import("../../io/meta/stripui.js")).openStrip()
});
