/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Vista
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { fit, zoom100, zoomIn, zoomOut } from "../../core/view.js";
import { isMobile, toggleSheet } from "../../ui/panels.js";
import { setGuidesVisible, guidesVisible, setRulersVisible, rulersVisible, clearGuides, setGridVisible, gridVisible, setSnapToGrid, snapToGridEnabled, gridConfig, setGridConfig } from "../../editor/tools/rulers.js";
import { dialog } from "../../ui/kit/dialog.js";
import { setTool } from "../../editor/tools/tools.js";
import { needsDoc } from "./helpers.js";
import { panels } from "../dom.js";

registerAll({
  "view.fit":     { run: fit, enabled: needsDoc },
  "view.zoom100": { run: zoom100, enabled: needsDoc },
  "view.zoomIn":  { run: zoomIn, enabled: needsDoc },
  "view.zoomOut": { run: zoomOut, enabled: needsDoc },
  "view.panels":  () => {
      if(isMobile()) toggleSheet();
      else panels.classList.toggle("collapsed");
    },
  "view.guides":  () => setGuidesVisible(!guidesVisible()),
  "view.rulers":  () => setRulersVisible(!rulersVisible()),
  "view.guidesClear": { run: clearGuides, enabled: needsDoc },
  "view.grid":       () => setGridVisible(!gridVisible()),
  "view.gridSnap":   () => setSnapToGrid(!snapToGridEnabled()),
  /* Cuadrícula inteligente (editor/tools/smartgrid.js): guías calculadas a
     partir del contenido (sujeto, horizonte, rostros) */
  "view.smartGrid":  { run: async () => (await import("../../editor/tools/smartgrid.js")).openSmartGrid(), enabled: needsDoc },
  "view.smartGridToggle": { run: async () => (await import("../../editor/tools/smartgrid.js")).toggleSmartGrid(), enabled: needsDoc },
  "view.gridConfig": { run: async () => {
      const cfg = gridConfig();
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="field"><label>Espaciado</label>
          <input type="range" id="gcSize" class="grow" min="4" max="500" value="${cfg.size}">
          <span class="unit mono" id="gcSizeV" style="min-width:46px;text-align:right">${cfg.size} px</span></div>
        <div class="field"><label>Subdivisiones</label>
          <input type="range" id="gcSub" class="grow" min="1" max="10" value="${cfg.sub}">
          <span class="unit mono" id="gcSubV" style="min-width:46px;text-align:right">${cfg.sub}</span></div>
        <p class="hint" style="margin-top:8px">Líneas mayores cada tantos píxeles, con líneas
          menores repartiendo cada celda entre las subdivisiones —igual que un papel
          milimetrado—. «Ajustar a la cuadrícula» (menú Ver) usa este mismo espaciado.</p>`;
      const sizeR = wrap.querySelector("#gcSize"), sizeV = wrap.querySelector("#gcSizeV");
      const subR = wrap.querySelector("#gcSub"), subV = wrap.querySelector("#gcSubV");
      sizeR.addEventListener("input", () => { sizeV.textContent = sizeR.value + " px"; });
      subR.addEventListener("input", () => { subV.textContent = subR.value; });
      const res = await dialog({
        title: "Configurar cuadrícula", body: wrap,
        buttons: [{ label:"Cancelar", value:null }, { label:"Aceptar", primary:true, value:"go" }]
      });
      if(res !== "go") return;
      setGridConfig(+sizeR.value, +subR.value);
      if(!gridVisible()) setGridVisible(true);
    } },
  "view.compare": { run: () => setTool("compare"), enabled: needsDoc },
  "view.compare100": { run: () => { setTool("compare"); zoom100(); }, enabled: needsDoc },
  "view.histogram": { run: async () => (await import("../../ui/histogrampanel.js")).showHistogramPanel() }
});
