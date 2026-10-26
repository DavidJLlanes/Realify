/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Selección y cielo
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { runContentAwareFill } from "../../editor/tools/fillcontent.js";
import { doc } from "../../core/doc.js";
import { hasSelection, selectAll, selectNone, invertSelection, featherSelection } from "../../editor/selection/selection.js";
import { dialog } from "../../ui/kit/dialog.js";
import { setTool } from "../../editor/tools/tools.js";
import { needsDoc } from "./helpers.js";

registerAll({
  "sel.fillContent": { run: runContentAwareFill, enabled: () => doc.open && hasSelection() },
  "sel.rangeMask": { run: async () => (await import("../../editor/selection/luminositymasks.js")).openLuminosityMaskPanel(),
                     enabled: needsDoc },
  "sel.subject": { run: async () => (await import("../../features/segmentselect.js")).selectSubjectCommand(),
                   enabled: needsDoc },
  "sel.sky":     { run: async () => (await import("../../features/segmentselect.js")).selectSkyCommand(),
                   enabled: needsDoc },
  "sky.replace": { run: async () => (await import("../../features/sky.js")).replaceSky(),
                   enabled: needsDoc },
  "sel.all":    { run: selectAll, enabled: needsDoc },
  "sel.none":   { run: () => { if(!hasSelection()) return; selectNone(); },
                  enabled: () => doc.open && hasSelection() },
  "sel.invert": { run: invertSelection, enabled: needsDoc },
  "sel.feather": { run: async () => {
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="field"><label>Radio</label>
          <input type="range" id="sfR" class="grow" min="1" max="200" value="12">
          <span class="unit mono" id="sfV" style="min-width:40px;text-align:right">12 px</span></div>
        <p class="hint" style="margin-top:8px">Suaviza el borde de la selección actual. Sin
          selección activa no hay nada que difuminar: el efecto se nota al usarla después,
          en un ajuste o un relleno.</p>`;
      const r = wrap.querySelector("#sfR"), v = wrap.querySelector("#sfV");
      r.addEventListener("input", () => { v.textContent = r.value + " px"; });
      const res = await dialog({
        title: "Difuminar selección", body: wrap,
        buttons: [{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }]
      });
      if(res !== "go") return;
      featherSelection(+r.value);
    }, enabled: () => doc.open && hasSelection() },
  "sel.refineEdge": { run: async () => (await import("../../editor/selection/refineedge.js")).refineEdge({ type:"selection" }),
                      enabled: () => doc.open && hasSelection() },
  "sel.contentAwareMove": { run: () => setTool("camove"), enabled: () => doc.open && hasSelection() }
});
