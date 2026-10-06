/* ═══════════════════════════════════════════════════════════════
   ESTILOS · PANTALLA COMPLETA (v260)
   Mismo armazón que HDR, Unir, Cortar, Formas y el collage (js/ui/fsshell.js):

     · Escritorio: a la izquierda, buscador y miniaturas por categorías (la propia foto con cada estilo aplicado); en el centro la imagen con el
       resultado en directo; a la derecha, la intensidad.
     · Móvil: la imagen a pantalla completa y, debajo, una categoría y un estilo (que abre una hoja con las mismas miniaturas) y la intensidad.

   Aquí sólo hay presentación. La vista previa, el cálculo a resolución completa, el 16 bits, la capa de filtro nueva (editable con el botón fx)
   y el historial son los de runAdjust (editor/adjust.js): cada cambio llama a `preview()`, que calcula sobre una copia reducida y pinta en la capa;
   al aplicar se recalcula la foto entera desde el original, así que lo que se ve mientras se elige nunca empeora el resultado final.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, ensureShellStyles, stateHistory, thumbButton } from "../ui/fsshell.js";

const MOBILE = "(max-width:900px)";
const isMobile = () => matchMedia(MOBILE).matches;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function lookFullscreen({ state, preview, source, edit, onApplied, api }){
  const { styleAt, styleCount, allStyleCats, makeThumbs } = api;
  let sh = null, resolve = null, closed = false, layerRef = null;
  const th = makeThumbs(source, 112);
  const cats = allStyleCats();
  let cat = (styleAt(state.picked)?.cat) || cats[0], query = "";

  const finish = value => {
    if(closed) return;
    closed = true;
    if(value === "go") onApplied?.();
    mq.removeEventListener?.("change", onMq);
    sh?.close();
    resolve?.(value);
  };
  const hist = stateHistory(state, () => { syncAll(); preview(); }, { setUndo: (u, r) => sh?.setUndo(u, r) });

  const pick = idx => {
    state.picked = idx;
    if(idx >= api.LOOKS.length) state.id = styleAt(idx).id; else delete state.id;
    if(idx >= 0) cat = styleAt(idx).cat;
    hist.commit(); syncAll(); preview();
  };
  const syncAll = () => {
    if(!sh) return;
    sh.setApplyEnabled(state.picked >= 0);
    sh.setSubtitle(state.picked >= 0 ? styleAt(state.picked).name : `${styleCount()} estilos`);
    marks(); renderRight(); if(isMobile()) renderMobile();
  };

  /* ── Panel izquierdo (escritorio) ── */
  const cells = new Map();                 // idx → botón
  function renderLeft(){
    const L = sh.left; L.innerHTML = ""; cells.clear();
    const s = document.createElement("div"); s.className = "lkf-search";
    s.innerHTML = `<input type="search" placeholder="Buscar estilo…" aria-label="Buscar estilo" value="${esc(query)}">`;
    s.querySelector("input").addEventListener("input", e => { query = e.target.value; applyFilter(); });
    L.appendChild(s);
    const orig = document.createElement("div"); orig.className = "fsp-thumbs";
    const ob = thumbButton(-1, "Original", () => th.original, state.picked < 0); ob.addEventListener("click", () => pick(-1)); orig.appendChild(ob); cells.set(-1, ob);
    L.appendChild(orig);
    const pending = [];
    for(const c of cats){
      const idxs = []; for(let i = 0; i < styleCount(); i++) if(styleAt(i).cat === c) idxs.push(i);
      if(!idxs.length) continue;
      const h = document.createElement("h3"); h.textContent = `${c} · ${idxs.length}`; h.dataset.cat = c; L.appendChild(h);
      const grid = document.createElement("div"); grid.className = "fsp-thumbs"; grid.dataset.cat = c;
      for(const i of idxs){
        const b = thumbButton(i, styleAt(i).name, null, i === state.picked);
        b.dataset.n = norm(styleAt(i).name);
        b.addEventListener("click", () => pick(i)); grid.appendChild(b); cells.set(i, b); pending.push(i);
      }
      L.appendChild(grid);
    }
    // las miniaturas se pintan por tandas para que la ventana abra al momento
    (function paint(){
      if(closed || !sh) return;
      for(const i of pending.splice(0, 8)){
        const b = cells.get(i), ph = b.querySelector(".ph"); if(!ph) continue;
        const img = document.createElement("img"); img.alt = ""; img.src = th.canvas(i).toDataURL("image/jpeg", .8); ph.replaceWith(img);
      }
      if(pending.length) requestAnimationFrame(paint);
    })();
    applyFilter();
  }
  function applyFilter(){
    const q = norm(query);
    const L = sh.left;
    for(const g of L.querySelectorAll(".fsp-thumbs[data-cat]")){
      let any = false;
      for(const b of g.children){ const ok = !q || b.dataset.n.includes(q); b.style.display = ok ? "" : "none"; if(ok) any = true; }
      g.style.display = any ? "" : "none"; const h = L.querySelector(`h3[data-cat="${CSS.escape(g.dataset.cat)}"]`); if(h) h.style.display = any ? "" : "none";
    }
  }
  function marks(){ for(const [i, b] of cells) b.classList.toggle("on", i === state.picked); }

  /* ── Panel derecho (escritorio): intensidad ── */
  function renderRight(){
    if(!sh) return;
    const R = sh.right, top = R.scrollTop; R.innerHTML = "";
    const h = document.createElement("h3"); h.textContent = "Ajuste"; R.appendChild(h);
    R.appendChild(intensityField(false));
    const note = document.createElement("p"); note.className = "fsp-note";
    note.textContent = state.picked >= 0 ? "Se añade como una capa nueva: el botón fx de la capa lo reabre para cambiar de estilo o de intensidad." : "Elige un estilo de la izquierda.";
    R.appendChild(note); R.scrollTop = top;
  }
  function intensityField(compact){
    const wrap = document.createElement("label"); wrap.className = "fsp-field";
    wrap.innerHTML = `<span>Intensidad<b>${Math.round(state.intensity)} %</b></span><input type="range" min="0" max="100" step="1" value="${Math.round(state.intensity)}" ${state.picked < 0 ? "disabled" : ""}>`;
    const inp = wrap.querySelector("input"), out = wrap.querySelector("b");
    inp.addEventListener("input", () => { state.intensity = +inp.value; out.textContent = inp.value + " %"; preview(); });
    inp.addEventListener("change", () => hist.commit());
    inp.addEventListener("dblclick", () => { inp.value = 100; state.intensity = 100; out.textContent = "100 %"; hist.commit(); preview(); });
    return wrap;
  }

  /* ── Móvil: categoría, estilo (hoja con miniaturas) e intensidad ── */
  function renderMobile(){
    const M = sh.mobile; M.innerHTML = "";
    const row = document.createElement("div"); row.className = "fsp-mrow";
    const cs = document.createElement("select"); cs.setAttribute("aria-label", "Categoría");
    cs.innerHTML = cats.map(c => `<option value="${esc(c)}"${c === cat ? " selected" : ""}>${esc(c)}</option>`).join("");
    cs.addEventListener("change", () => { cat = cs.value; renderMobile(); openStyles(); });
    row.appendChild(cs);
    const idxs = []; for(let i = 0; i < styleCount(); i++) if(styleAt(i).cat === cat) idxs.push(i);
    const pk = document.createElement("div"); pk.className = "fsp-pick";
    const inCat = idxs.includes(state.picked);
    pk.innerHTML = `<select aria-label="Estilo">${[`<option value="-1"${state.picked < 0 ? " selected" : ""}>Original</option>`, ...idxs.map(i => `<option value="${i}"${i === state.picked ? " selected" : ""}>${esc(styleAt(i).name)}</option>`)].join("")}${!inCat && state.picked >= 0 ? `<option value="${state.picked}" selected>${esc(styleAt(state.picked).name)}</option>` : ""}</select><button type="button" class="fsp-pick-hit" aria-label="Estilo: ver miniaturas"></button>`;
    pk.querySelector("select").addEventListener("change", e => pick(+e.target.value));
    pk.querySelector(".fsp-pick-hit").addEventListener("click", openStyles);
    row.appendChild(pk); M.appendChild(row);
    M.appendChild(intensityField(true));
  }
  function openStyles(){
    const idxs = []; for(let i = 0; i < styleCount(); i++) if(styleAt(i).cat === cat) idxs.push(i);
    sh.openSheet(cat, [[-1, "Original"], ...idxs.map(i => [i, styleAt(i).name])], state.picked, i => th.canvas(+i), v => pick(+v));
  }

  const mq = matchMedia(MOBILE);
  const onMq = () => { if(sh) syncAll(); };

  return {
    /* runAdjust avisa aquí después de cada vista previa: se vuelve a pintar la capa en el visor */
    onPreview(){ sh?.redraw(); },
    /* Abre la ventana; devuelve "go" al aplicar o null al cancelar. */
    async present({ layer }){
      layerRef = layer;
      await ensureShellStyles();
      sh = createShell({
        title: "Estilos", subtitle: `${styleCount()} estilos`, applyLabel: edit ? "Guardar" : "Aplicar", cls: "lkf",
        onCancel: () => finish(null), onApply: () => finish("go"), onUndo: () => hist.undo(), onRedo: () => hist.redo()
      });
      sh.setOriginal(source);
      sh.setView(layer.canvas, false);
      renderLeft(); syncAll();
      mq.addEventListener?.("change", onMq);
      hist.reset();
      return new Promise(r => { resolve = r; });
    }
  };
}
