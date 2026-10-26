/* ═══════════════════════════════════════════════════════════════
   APP · comandos de IA
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { needsDoc } from "./helpers.js";

registerAll({
  "ai.tapSelect":   { run: async () => (await import("../../features/samtools.js")).openSamTool("select"), enabled: needsDoc },
  "ai.magicErase":  { run: async () => (await import("../../features/samtools.js")).openSamTool("erase"), enabled: needsDoc },
  "ai.faceBlur":    { run: async () => (await import("../../features/facetools.js")).openFaceBlur(), enabled: needsDoc },
  "ai.faceRetouch": { run: async () => (await import("../../features/facetools.js")).openFaceRetouch(), enabled: needsDoc },
  "ai.lowLight":    { run: async () => (await import("../../ai/zerodce.js")).aiLowLight(), enabled: needsDoc },
  "ai.faceRestore": { run: async () => (await import("../../features/facetools.js")).openFaceRestore(), enabled: needsDoc },
  "ai.redEye":      { run: async () => (await import("../../features/facetools.js")).fixRedEyes(), enabled: needsDoc },
  "ai.smartCrop":   { run: async () => (await import("../../features/smartcrop.js")).openSmartCrop(), enabled: needsDoc },
  "ai.faceCrop":    { run: async () => (await import("../../features/facetools.js")).faceCrop(), enabled: needsDoc },
  "ai.depthBlur":   { run: async () => (await import("../../features/depthtools.js")).openDepthBlur(), enabled: needsDoc },
  "ai.depthFog":    { run: async () => (await import("../../features/depthtools.js")).openDepthFog(), enabled: needsDoc },
  "ai.photo3d":     { run: async () => (await import("../../features/depthtools.js")).openPhoto3D(), enabled: needsDoc },
  "ai.textSelect":  { run: async () => (await import("../../features/textselect.js")).openTextSelect(), enabled: needsDoc },
  "ai.depthSelect": { run: async () => (await import("../../features/depthzones.js")).openDepthSelect(), enabled: needsDoc },
  "ai.depthLight":  { run: async () => (await import("../../features/depthlight.js")).openDepthLight(), enabled: needsDoc },
  "ai.depthPlanes": { run: async () => (await import("../../features/depthlight.js")).openDepthPlanes(), enabled: needsDoc },
  "ai.upscale":     { run: async () => (await import("../../features/aitools.js")).aiUpscale(), enabled: needsDoc },
  "ai.colorize":    { run: async () => (await import("../../features/aitools.js")).aiColorize(), enabled: needsDoc },
  "ai.expand":      { run: async () => (await import("../../features/aitools.js")).aiExpand(), enabled: needsDoc }
});
