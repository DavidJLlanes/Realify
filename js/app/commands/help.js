/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Ayuda
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { promptInstall } from "../../pwa.js";
import { dialog } from "../../ui/kit/dialog.js";

registerAll({
  "help.install": () => promptInstall(),
  "help.update": async () => (await import("../../pwa.js")).checkForUpdateDialog(),
  "help.about": async () => (await import("../../ui/help/about.js")).openAbout(),
  "help.guide":     async () => (await import("../../ui/help/guide.js")).openGuide(),
  "help.legal":     async () => (await import("../../ui/help/legal.js")).openLegalNotice(),
  "help.report":    async () => (await import("../../ui/help/bugreport.js")).openBugReport(),
  "help.privacy":   async () => (await import("../../ui/help/legal.js")).openPrivacyPolicy(),
  "help.cookies":   async () => (await import("../../ui/help/legal.js")).openCookiesPolicy(),
  "help.diag":      async () => {
      const { diagnose } = await import("../../filters/camera/engine.js");
      const d = diagnose();
      const compatRows = (await import("../../core/compat.js")).checkCompat();
      const row = (ok, name, detail) =>
        `<div class="field"><label style="width:150px">${ok ? "✓" : "✗"} ${name}</label>
         <span class="hint" style="margin:0;color:${ok ? "var(--tx-dim)" : "var(--bad)"}">${detail}</span></div>`;
      const bad = Object.entries(d.shaders).filter(([, v]) => v !== true);
      const body = document.createElement("div");
      body.innerHTML =
          row(d.webgl2, "WebGL2", d.webgl2 ? "disponible" : (d.error || "no disponible")) +
          (d.renderer ? row(true, "GPU", d.renderer.slice(0, 70)) : "") +
          (d.webgl2 ? row(d.float, "Buffer flotante",
              d.float ? "sí, precisión completa" : "no: puede aparecer banding en sombras") : "") +
          (d.maxTexture ? row(true, "Textura máxima", d.maxTexture + " px") : "") +
          (d.webgl2 ? row(bad.length === 0, "Shaders",
              bad.length ? "fallan: " + bad.map(b => b[0]).join(", ")
                         : Object.keys(d.shaders).length + " compilan correctamente") : "") +
          `<div class="diag-float"></div>` +
          `<div class="diag-upd hint" style="margin:6px 0"></div>` +
          row(typeof createImageBitmap === "function", "createImageBitmap",
              typeof createImageBitmap === "function" ? "sí" : "no: el análisis ELA no funcionará") +
          row((() => { try{ localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; }catch{ return false; } })(),
              "Almacenamiento local", "para presets y ajustes") +
          row(!!navigator.gpu, "WebGPU", navigator.gpu ? "sí: la IA usa la GPU" : "no: la IA funciona en la CPU (WebAssembly), más despacio") +
          compatRows.map(p => row(false, p.title.split(" ").slice(0, 3).join(" "), p.title)).join("") +
          `<div class="field"><button type="button" class="diag-copy">Copiar diagnóstico</button><span class="hint" style="margin:0">para enviarlo si algo no funciona</span></div>` +
          `<div class="section-label" style="margin-top:12px">Modelos de IA descargados</div><div class="diag-models hint" style="margin:0">Comprobando…</div>`;
      // Avisos de versión nueva: versión cargada, última conocida y el registro de lo ocurrido (pwa-updates.js)
      import("../../core/pwa-updates.js").then(m => {
        const el = body.querySelector(".diag-upd"); if(!el) return;
        const i = m.updateInfo, esc = t => String(t).replace(/</g, "&lt;");
        const log = (i.log.length ? i.log : m.savedUpdateLog()).slice(-8);
        el.innerHTML = `<b>Avisos de versión</b>: cargada ${i.loaded ?? "?"} · última ${i.latest ?? "?"}` +
          (i.checkedAt ? ` · comprobada hace ${Math.round((Date.now() - i.checkedAt) / 1000)} s` : " · sin comprobar") +
          (i.error ? ` · error: ${esc(i.error)}` : "") +
          (log.length ? `<br><span class="mono" style="font-size:11px;white-space:pre-wrap">${esc(log.join("\n"))}</span>` : "");
      }).catch(() => {});
      // Compositor de coma flotante de la vista previa (fase 13): se carga sólo si el documento lo aprovecha
      import("../../editor/render/floatcompositor.js").then(m => {
        const el = body.querySelector(".diag-float"), ok = m.floatAvailable();
        if(el) el.innerHTML = row(ok, "Compositor de coma flotante",
          ok ? "sí: ajustes, 16 bits y modos de fusión sin redondear" + (m.floatInfo.last ? " · último: " + (m.floatInfo.last.f32 ? "32" : "16") + " bits, " + m.floatInfo.composes + " usos" : "")
             : "no: la vista previa se compone en 8 bits");
      }).catch(() => {});
      body.querySelector(".diag-copy").addEventListener("click", e =>
        window.__realifyCopyDiag?.(window.__realifyDiag?.([
          "WebGL2: " + (d.webgl2 ? "sí" : "no") + (d.renderer ? " · " + d.renderer : ""),
          ...compatRows.map(p => "Aviso: " + p.title)]) || "", e.currentTarget));
      // Modelos guardados en este navegador: lo que ocupan y cómo borrarlos
      const listEl = body.querySelector(".diag-models");
      const fill = async () => {
        const { storedModels, forgetModel } = await import("../../ai/runtime.js");
        const { mb } = await import("../../ai/models.js");
        const list = await storedModels().catch(() => []);
        if(!list.length){ listEl.textContent = "Ninguno: se descargan la primera vez que se usan."; return; }
        const total = list.reduce((a, m) => a + m.size, 0);
        listEl.innerHTML = list.map((m, i) => `<div class="field"><label style="width:auto;flex:1">${m.label}${m.premium ? " 👑" : ""}</label>
          <span class="unit mono">${mb(m.size)}</span><button type="button" data-i="${i}">Borrar</button></div>`).join("") +
          `<div class="field"><label style="width:auto;flex:1"><b>Total</b></label><span class="unit mono">${mb(total)}</span>
          <button type="button" data-all="1">Borrar todos</button></div>`;
        listEl.querySelectorAll("button").forEach(b => b.addEventListener("click", async () => {
          b.disabled = true;
          await forgetModel(b.dataset.all ? undefined : list[+b.dataset.i].url);
          fill();
        }));
      };
      fill();
      dialog({ title: "Diagnóstico", wide: true, body, buttons:[{ label:"Cerrar", primary:true }] });
    }
});
