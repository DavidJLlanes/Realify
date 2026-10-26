/* ═══════════════════════════════════════════════════════════════
   adjustments · grayscale
   Parte de js/editor/adjust/adjustments.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { BW_RECIPES, applyBWRecipe } from "../bwrecipes.js";
import { runAdjust, slider } from "../adjust.js";
import { activeLayer, doc } from "../../../core/doc.js";
import { clamp255 } from "./common.js";

/* ── blanco y negro ───────────────────────────────────────────── */
export function grayscale(opts = {}){
  const p = { mode: "manual", r: 30, g: 59, b: 11, recipe: null, ...opts.init };
  if(p.recipe && p.recipe.name) p.recipe = BW_RECIPES.find(r => r.name === p.recipe.name) || p.recipe;

  return runAdjust({
    title: "Blanco y negro",
    wide: true,
    asLayer: true, filterId: "bw", filterParams: p, float: () => p.mode === "manual" ? true : "delta",
    compute(data, w, h){
      if(p.mode === "auto"){
        applyBWRecipe(data, w, h, p.recipe || BW_RECIPES[0]);
        return;
      }
      // Los pesos se normalizan siempre: si suman más de 100 la
      // imagen se quema, y ese no es el trabajo de este ajuste.
      const t = p.r + p.g + p.b || 1;
      const wr = p.r / t, wg = p.g / t, wb = p.b / t;
      for(let i = 0; i < data.length; i += 4){
        const v = clamp255(data[i]*wr + data[i+1]*wg + data[i+2]*wb);
        data[i] = data[i+1] = data[i+2] = v;
      }
    },
    buildBody({ preview, source }){
      const layer = source ? { canvas: source } : activeLayer();
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="seg" id="bwMode" style="margin-bottom:10px">
          <button data-m="manual" class="on">Manual</button>
          <button data-m="auto">Automático</button>
        </div>
        <div id="bwManual"></div>
        <div id="bwAuto" hidden>
          <p class="hint" style="margin-top:0">Dieciocho conversiones inspiradas en otras tantas maneras
            de revelar en blanco y negro: cada una mezcla los canales, el contraste y el grano de
            forma distinta. Elige la que más se ajuste a esta foto.</p>
          <div id="bwGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px"></div>
          <p class="hint mono" id="bwNote" style="margin-top:8px"></p>
        </div>`;

      const manualBox = box.querySelector("#bwManual");
      const note = document.createElement("p");
      note.className = "hint";
      note.style.marginTop = "0";
      note.textContent = "Cuánto aporta cada color al gris. Bajar el azul oscurece " +
        "el cielo; subir el rojo aclara la piel. Es lo que hacían los filtros de " +
        "color sobre película en blanco y negro.";
      manualBox.appendChild(note);
      const sr = slider("Rojo", 0, 100, p.r, v => { p.r = v; preview(); }, "%");
      const sg = slider("Verde", 0, 100, p.g, v => { p.g = v; preview(); }, "%");
      const sb = slider("Azul", 0, 100, p.b, v => { p.b = v; preview(); }, "%");
      manualBox.append(sr, sg, sb);

      const presets = document.createElement("div");
      presets.className = "seg";
      presets.style.marginTop = "8px";
      presets.innerHTML = `<button data-v="30,59,11">Luminancia</button>
                           <button data-v="33,34,33">Plano</button>
                           <button data-v="60,28,12">Filtro rojo</button>
                           <button data-v="10,25,65">Filtro azul</button>`;
      presets.addEventListener("click", e => {
        const b = e.target.closest("[data-v]");
        if(!b) return;
        const [r, g, bl] = b.dataset.v.split(",").map(Number);
        p.r = r; p.g = g; p.b = bl;
        sr.setValue(r); sg.setValue(g); sb.setValue(bl);
        preview();
      });
      manualBox.appendChild(presets);

      // ── modo automático: rejilla de miniaturas ──────────────────
      const grid = box.querySelector("#bwGrid");
      const noteEl = box.querySelector("#bwNote");
      const S = 110;
      const thumb = document.createElement("canvas");
      thumb.width = S; thumb.height = S;
      const tx = thumb.getContext("2d", { willReadFrequently: true });
      const side = Math.min(doc.w, doc.h);
      tx.drawImage(layer.canvas, (doc.w - side) / 2, (doc.h - side) / 2, side, side, 0, 0, S, S);
      const baseData = tx.getImageData(0, 0, S, S);

      const cells = [];
      BW_RECIPES.forEach(recipe => {
        const cell = document.createElement("button");
        cell.style.cssText = "padding:0;display:flex;flex-direction:column;gap:4px;background:transparent;border:0";
        const cv = document.createElement("canvas");
        cv.width = S; cv.height = S;
        cv.style.cssText = "width:100%;border-radius:var(--r);border:2px solid var(--line);display:block";
        const cx = cv.getContext("2d");
        const img = new ImageData(new Uint8ClampedArray(baseData.data), S, S);
        applyBWRecipe(img.data, S, S, recipe);
        cx.putImageData(img, 0, 0);
        const label = document.createElement("span");
        label.textContent = recipe.name;
        label.style.cssText = "font-size:var(--fs-xs);color:var(--tx-dim);text-align:center";
        cell.append(cv, label);
        cell.addEventListener("click", () => {
          p.recipe = recipe;
          cells.forEach(c => c.style.borderColor = "var(--line)");
          cv.style.borderColor = "var(--ac)";
          noteEl.textContent = recipe.note;
          preview();
        });
        cell.cv = cv;
        cells.push(cell);
        grid.appendChild(cell);
      });

      box.querySelector("#bwMode").addEventListener("click", e => {
        const b = e.target.closest("[data-m]");
        if(!b) return;
        p.mode = b.dataset.m;
        box.querySelectorAll("#bwMode button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        manualBox.hidden = p.mode !== "manual";
        box.querySelector("#bwAuto").hidden = p.mode !== "auto";
        if(p.mode === "auto" && !p.recipe){
          p.recipe = BW_RECIPES[0];
          cells[0].cv.style.borderColor = "var(--ac)";
          noteEl.textContent = BW_RECIPES[0].note;
        }
        preview();
      });

      // Estado de partida al reabrir: modo y receta ya elegidos
      if(p.mode === "auto"){
        const btn = box.querySelector('#bwMode [data-m="auto"]');
        box.querySelectorAll("#bwMode button").forEach(x => x.classList.remove("on"));
        btn.classList.add("on");
        manualBox.hidden = true;
        box.querySelector("#bwAuto").hidden = false;
        const idx = Math.max(0, BW_RECIPES.indexOf(p.recipe));
        p.recipe = BW_RECIPES[idx];
        cells[idx].cv.style.borderColor = "var(--ac)";
        noteEl.textContent = BW_RECIPES[idx].note;
      }

      return box;
    }
  }, opts);
}
