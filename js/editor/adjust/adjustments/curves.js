/* ═══════════════════════════════════════════════════════════════
   adjustments · curves
   Parte de js/editor/adjust/adjustments.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { premiumPref } from "../../../ui/kit/premium.js";
import { runAdjust, slider } from "../adjust.js";
import { applyCurvesPremium } from "../tonepremium.js";
import { doc } from "../../../core/doc.js";
import { applyCurves, CHANNEL_COLORS, curveEditor, CURVE_PRESETS, userCurvePresets, curveThumb, saveUserCurvePresets } from "../curves.js";
import { curvesFullscreen } from "../curvesfs.js";

/* ── curvas ───────────────────────────────────────────────────── */
/* ── Curvas ─────────────────────────────────────────────────────
   Cinco curvas: RGB (maestra), Rojo, Verde, Azul y Luminosidad. El
   orden de aplicación es el de Photoshop más una etapa final:
   canal → maestra RGB → luminosidad.

   · La curva de LUMINOSIDAD cambia sólo el brillo: suma a los tres
     canales la diferencia de luminancia, así que el tono y la
     saturación no se mueven (una curva en S en RGB satura; en
     luminosidad, no).
   · «Vincular luminosidad y color»: las dos curvas pasan a ser la
     misma —se edite la que se edite, la otra la sigue— y un control
     reparte su efecto entre aplicarla como color (RGB) o como
     luminosidad, en vez de aplicarla dos veces.
   · Todas las curvas se ven a la vez (las demás en tenue), y la vista
     «R · G · B» enseña los tres canales en tres paneles simultáneos.
   · Estilos: una galería con miniatura de las curvas más usadas
     (S clásica, cine, mate, película cruzada…) y los estilos propios
     guardados en el navegador. */
const ID = () => [[0,0],[255,255]];

export function curves(opts = {}){
  const CH = ["rgb", "r", "g", "b", "lum"];
  const state = {
    channel: "rgb",
    points: { rgb: ID(), r: ID(), g: ID(), b: ID(), lum: ID() },
    link: false,      // luminosidad y color vinculadas
    mix: 50,          // reparto con vínculo: 0 = sólo color, 100 = sólo luminosidad
    view: "one",      // "one" (un editor) o "rgb3" (tres paneles R · G · B)
    preset: null,     // último estilo aplicado sin retocar después (sólo informativo)
    // Premium 👑: una capa ya hecha conserva su motor; uno nuevo, la última elección
    premium: opts.init ? !!opts.init.premium : premiumPref.get("curves")
  };
  if(opts.init?.points) for(const k of CH)
    if(Array.isArray(opts.init.points[k])) state.points[k] = opts.init.points[k].map(pt => [pt[0], pt[1]]);
  if(opts.init){
    if(typeof opts.init.link === "boolean") state.link = opts.init.link;
    if(Number.isFinite(opts.init.mix)) state.mix = opts.init.mix;
    if(typeof opts.init.preset === "string") state.preset = opts.init.preset;
  }
  /* Desde el menú (o al reabrir la capa de filtro) se abre el editor a
     pantalla completa (curvesfs.js); montado en el panel de Propiedades
     de una capa de filtro sigue siendo el panel compacto de abajo. */
  const fullscreen = !opts.container && !opts.render;

  return runAdjust({
    title: "Curvas",
    wide: true,
    asLayer: true, filterId: "curves", filterParams: state,
    float: () => !state.premium,
    fullscreen,
    compute(data, w, h){ if(state.premium) applyCurvesPremium(data, state, { fast: w * h < doc.w * doc.h * 0.98 }); else applyCurves(data, state); },
    buildBody({ hist, preview, source }){
      if(fullscreen) return curvesFullscreen({ state, hist, preview, source, title: "Curvas", edit: !!opts.edit });
      const box = document.createElement("div");
      box.className = "curves-panel";
      box.innerHTML = `
        <div class="field"><label>Canal</label>
          <select class="grow" id="cvCh">
            <option value="rgb">RGB (color)</option>
            <option value="r">Rojo</option>
            <option value="g">Verde</option>
            <option value="b">Azul</option>
            <option value="lum">Luminosidad</option>
          </select></div>
        <div class="seg cv-view" style="margin:6px 0">
          <button type="button" data-view="one">Un panel</button>
          <button type="button" data-view="rgb3">R · G · B a la vez</button>
        </div>
        <div class="cv-host"></div>
        <label class="chk cv-link"><input type="checkbox"> Vincular luminosidad y color</label>
        <div class="cv-mix"></div>
        <div class="section-label" style="margin-top:10px">Estilos</div>
        <div class="cv-presets"></div>
        <div class="seg" style="margin-top:8px">
          <button type="button" data-p="reset">Restablecer canal</button>
          <button type="button" data-p="resetAll">Restablecer todo</button>
          <button type="button" data-p="save">Guardar estilo…</button>
        </div>
        <p class="hint" style="margin-top:10px">Clic para añadir un punto, arrastrar para moverlo; para quitarlo, clic derecho, doble clic o arrástralo fuera del cuadro. Las demás curvas se ven en tenue.</p>`;
      const host = box.querySelector(".cv-host");
      const others = ch => CH.filter(k => k !== ch && !(state.link && (k === "lum" || k === "rgb") && (ch === "lum" || ch === "rgb")))
        .filter(k => !(state.points[k].length === 2 && state.points[k][0][0] === 0 && state.points[k][0][1] === 0 && state.points[k][1][0] === 255 && state.points[k][1][1] === 255))
        .map(k => ({ points: state.points[k], color: CHANNEL_COLORS[k] }));
      let editors = [];
      const setPts = (ch, pts) => {
        state.points[ch] = pts; state.preset = null;
        // Vinculadas: la otra sigue a la que se edita
        if(state.link && (ch === "rgb" || ch === "lum")) state.points[ch === "rgb" ? "lum" : "rgb"] = pts.map(p => [p[0], p[1]]);
        preview();
      };
      const renderEditors = () => {
        host.innerHTML = "";
        editors = [];
        box.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
        if(state.view === "rgb3"){
          const grid = document.createElement("div");
          grid.style.cssText = "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px";
          for(const ch of ["r", "g", "b"]){
            const cell = document.createElement("div");
            cell.innerHTML = `<div class="section-label" style="color:${CHANNEL_COLORS[ch]};text-align:center">${ch === "r" ? "Rojo" : ch === "g" ? "Verde" : "Azul"}</div>`;
            const ed = curveEditor({ getPoints: () => state.points[ch], setPoints: pts => { setPts(ch, pts); }, hist, channel: () => ch,
              overlays: () => others(ch), maxWidth: 220, onEnd: refreshAll });
            cell.appendChild(ed.el); grid.appendChild(cell); editors.push(ed);
          }
          host.appendChild(grid);
        } else {
          const ed = curveEditor({ getPoints: () => state.points[state.channel], setPoints: pts => setPts(state.channel, pts),
            hist, channel: () => state.channel, overlays: () => others(state.channel),
            histMode: () => state.channel === "rgb" ? "rgb" : "one", onEnd: refreshAll });
          host.appendChild(ed.el); editors.push(ed);
        }
      };
      const refreshAll = () => { editors.forEach(e => e.refresh()); renderPresets(); };
      const mixHost = box.querySelector(".cv-mix");
      const renderMix = () => {
        mixHost.innerHTML = "";
        if(!state.link) return;
        mixHost.appendChild(slider("Reparto color ↔ luminosidad", 0, 100, state.mix, v => { state.mix = v; preview(); }, "%"));
      };
      const link = box.querySelector(".cv-link input");
      link.checked = state.link;
      link.addEventListener("change", () => {
        state.link = link.checked;
        if(state.link){
          // Al vincular, manda la curva que se está viendo
          const src = state.channel === "lum" ? "lum" : "rgb";
          state.points[src === "rgb" ? "lum" : "rgb"] = state.points[src].map(p => [p[0], p[1]]);
        }
        renderMix(); refreshAll(); preview();
      });

      /* Galería de estilos con miniatura */
      const presetsEl = box.querySelector(".cv-presets");
      presetsEl.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px";
      const applyPreset = set => {
        for(const k of CH) state.points[k] = set[k] ? set[k].map(p => [p[0], p[1]]) : ID();
        state.preset = null;
        if(state.link){ const src = set.lum && !set.rgb ? "lum" : "rgb"; state.points[src === "rgb" ? "lum" : "rgb"] = state.points[src].map(p => [p[0], p[1]]); }
        refreshAll(); preview();
      };
      const renderPresets = () => {
        presetsEl.innerHTML = "";
        const all = [...CURVE_PRESETS, ...userCurvePresets().map(u => [u.id, u.name, u.points, true])];
        for(const [id, name, set, mine] of all){
          const b = document.createElement("button");
          b.type = "button"; b.className = "cv-preset"; b.title = name;
          b.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;padding:4px;min-width:0;height:auto;min-height:88px;font-size:10.5px;line-height:1.15;white-space:normal;overflow-wrap:anywhere;text-align:center";
          const t = curveThumb(set, 52); t.style.cssText = "width:52px;height:52px;border-radius:4px";
          const n = document.createElement("span"); n.textContent = name;
          b.append(t, n);
          b.addEventListener("click", () => applyPreset(set));
          if(mine) b.addEventListener("contextmenu", e => {
            e.preventDefault();
            saveUserCurvePresets(userCurvePresets().filter(u => u.id !== id));
            renderPresets();
          });
          presetsEl.appendChild(b);
        }
      };

      box.addEventListener("click", async e => {
        const v = e.target.closest("[data-view]");
        if(v){ state.view = v.dataset.view; renderEditors(); return; }
        const b = e.target.closest("[data-p]");
        if(!b) return;
        const k = b.dataset.p;
        if(k === "reset"){ setPts(state.channel, ID()); refreshAll(); }
        else if(k === "resetAll"){ for(const c of CH) state.points[c] = ID(); refreshAll(); preview(); }
        else if(k === "save"){
          const { promptDlg } = await import("../../../ui/kit/dialog.js");
          const name = await promptDlg("Guardar estilo de curvas", "Nombre del estilo", "Mi curva");
          if(!name) return;
          const list = userCurvePresets();
          list.push({ id: "u" + Date.now(), name: name.trim().slice(0, 40), points: JSON.parse(JSON.stringify(state.points)) });
          saveUserCurvePresets(list);
          renderPresets();
        }
      });
      box.querySelector("#cvCh").value = state.channel;
      box.querySelector("#cvCh").addEventListener("change", e => {
        state.channel = e.target.value;
        if(state.view !== "one"){ state.view = "one"; }
        renderEditors();
      });
      renderEditors(); renderMix(); renderPresets();
      return box;
    }
  }, opts);
}
